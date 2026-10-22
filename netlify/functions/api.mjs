// Free Fruit Finder API. One function serves every /api/* route.
//
// Storage (Netlify Blobs, or a local file store in dev):
//   data store   "index"        -> { trees: { [id]: TreeRecord } }   one read loads the whole map
//                "notes/<id>"   -> [Note, ...]                        loaded when a tree is opened
//   photo store  "<id>", "<id>-t" -> full-size JPEG and thumbnail
// Read-modify-write goes through mutate(), which uses ETag conditional writes
// so two people posting at the same moment never overwrite each other.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const LIMITS = {
  fruit: 40,
  place: 200,
  city: 80,
  name: 40,
  note: 1000,
  photo: 4 * 1024 * 1024,
  thumb: 512 * 1024,
  body: 6 * 1024 * 1024,
  notesPerTree: 300,
  trees: 20000,
  duplicateMeters: 12,
};

let storeFactory = null;
export function setStoreFactory(factory) {
  storeFactory = factory;
}

async function getStores() {
  if (!storeFactory) {
    const { getStore } = await import("@netlify/blobs");
    storeFactory = (name) => getStore({ name, consistency: "strong" });
  }
  return { data: storeFactory("fruit-data"), photos: storeFactory("fruit-photos") };
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const BASE_HEADERS = { "x-content-type-options": "nosniff" };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mutate(store, key, empty, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await store.getWithMetadata(key, { type: "json" });
    const value = current ? current.data : empty();
    const { value: next, result } = change(value);
    const condition = !current ? { onlyIfNew: true } : current.etag ? { onlyIfMatch: current.etag } : {};
    const write = await store.setJSON(key, next, condition);
    if (write.modified) return result;
    await sleep(15 + Math.random() * 40 * (attempt + 1));
  }
  throw new HttpError(503, "The server is busy. Try again in a moment.");
}

// ---------- validation ----------

const cleanText = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);

const oneLine = (v, max) => cleanText(v, max).replace(/\s+/g, " ");

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

function parseCoord(v, limit) {
  if (v === null || v === undefined || String(v).trim() === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? Math.round(n * 1e6) / 1e6 : NaN;
}

const isStatus = (s) => s === "yes" || s === "no";
const ID_RE = /^[a-f0-9]{16}$/;

function metersBetween(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function imageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function readImage(file, max, label) {
  if (!file || typeof file === "string" || !file.size) return null;
  if (file.size > max) throw new HttpError(413, `The ${label} is too large.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) throw new HttpError(415, `The ${label} must be a JPG, PNG or WebP image.`);
  return { bytes, type };
}

const hashToken = (t) => createHash("sha256").update(String(t)).digest();

function tokenMatches(record, token) {
  if (!token) return false;
  const admin = process.env.ADMIN_TOKEN;
  if (admin && admin.length >= 16) {
    const a = hashToken(admin), b = hashToken(token);
    if (timingSafeEqual(a, b)) return true;
  }
  if (!record.tokenHash) return false;
  return timingSafeEqual(Buffer.from(record.tokenHash, "hex"), hashToken(token));
}

function publicTree(t) {
  const { tokenHash, ...rest } = t;
  return rest;
}

// ---------- routes ----------

async function listTrees() {
  const { data } = await getStores();
  const index = (await data.get("index", { type: "json" })) || { trees: {} };
  const trees = Object.values(index.trees).map(publicTree).sort((a, b) => b.createdAt - a.createdAt);
  return json(200, { trees });
}

async function createTree(req) {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > LIMITS.body) throw new HttpError(413, "That upload is too large. Try a smaller photo.");
  let form;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "The form could not be read. Try again.");
  }
  if (cleanText(form.get("website"), 10)) return json(201, { ok: true }); // honeypot for bots

  const fruit = titleCase(oneLine(form.get("fruit"), LIMITS.fruit));
  const place = oneLine(form.get("place"), LIMITS.place);
  const city = oneLine(form.get("city"), LIMITS.city);
  const status = String(form.get("status") || "");
  const lat = parseCoord(form.get("lat"), 90);
  const lng = parseCoord(form.get("lng"), 180);
  const noteText = cleanText(form.get("note"), LIMITS.note);
  const name = oneLine(form.get("name"), LIMITS.name);

  if (!fruit) throw new HttpError(400, "Say what kind of fruit it is.");
  if (Number.isNaN(lat) || Number.isNaN(lng)) throw new HttpError(400, "Drop a pin on the map where the tree is.");
  if (!isStatus(status)) throw new HttpError(400, "Say whether it's fruiting right now.");
  if (!place) throw new HttpError(400, "Describe where the tree is so people can find it.");

  const photo = await readImage(form.get("photo"), LIMITS.photo, "photo");
  const thumb = photo ? await readImage(form.get("thumb"), LIMITS.thumb, "thumbnail") : null;

  const { data, photos } = await getStores();
  const id = randomBytes(8).toString("hex");
  const token = randomBytes(24).toString("base64url");
  const now = Date.now();

  if (photo) {
    await photos.set(id, photo.bytes, { metadata: { type: photo.type } });
    if (thumb) await photos.set(id + "-t", thumb.bytes, { metadata: { type: thumb.type } });
  }

  const record = {
    id, fruit, place, city, lat, lng, status,
    statusAt: now, createdAt: now,
    photo: Boolean(photo), thumb: Boolean(thumb),
    noteCount: noteText ? 1 : 0,
    tokenHash: hashToken(token).toString("hex"),
  };

  try {
    await mutate(data, "index", () => ({ trees: {} }), (index) => {
      const all = Object.values(index.trees);
      if (all.length >= LIMITS.trees) throw new HttpError(507, "The map is full. Contact the site owner.");
      const dupe = all.find((t) => t.fruit === fruit && metersBetween(t, record) < LIMITS.duplicateMeters);
      if (dupe) throw new HttpError(409, `There's already a ${fruit} tree posted right here.`, { existingId: dupe.id });
      return { value: { trees: { ...index.trees, [id]: record } }, result: null };
    });
  } catch (err) {
    if (photo) await Promise.allSettled([photos.delete(id), photos.delete(id + "-t")]);
    throw err;
  }

  if (noteText) {
    await data.setJSON("notes/" + id, [{ id: randomBytes(6).toString("hex"), text: noteText, status, name, createdAt: now }]);
  }
  return json(201, { tree: publicTree(record), editToken: token });
}

async function listNotes(id) {
  const { data } = await getStores();
  const notes = (await data.get("notes/" + id, { type: "json" })) || [];
  return json(200, { notes: [...notes].reverse() });
}

async function addNote(req, id) {
  const raw = await req.text();
  if (raw.length > 8000) throw new HttpError(413, "That note is too long.");
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "The note could not be read. Try again.");
  }
  const text = cleanText(body.text, LIMITS.note);
  const status = isStatus(body.status) ? body.status : "";
  const name = oneLine(body.name, LIMITS.name);
  if (!text && !status) throw new HttpError(400, "Write a note or say whether it's fruiting.");

  const { data } = await getStores();
  const index = (await data.get("index", { type: "json" })) || { trees: {} };
  if (!index.trees[id]) throw new HttpError(404, "That tree has been removed.");

  const now = Date.now();
  const note = { id: randomBytes(6).toString("hex"), text, status, name, createdAt: now };
  const count = await mutate(data, "notes/" + id, () => [], (notes) => {
    const next = [...notes, note].slice(-LIMITS.notesPerTree);
    return { value: next, result: next.length };
  });

  const tree = await mutate(data, "index", () => ({ trees: {} }), (idx) => {
    const t = idx.trees[id];
    if (!t) throw new HttpError(404, "That tree has been removed.");
    const updated = { ...t, noteCount: count };
    if (status) Object.assign(updated, { status, statusAt: now });
    return { value: { trees: { ...idx.trees, [id]: updated } }, result: updated };
  });
  return json(201, { note, tree: publicTree(tree) });
}

async function deleteTree(req, id) {
  const token = req.headers.get("x-edit-token") || "";
  const { data, photos } = await getStores();
  await mutate(data, "index", () => ({ trees: {} }), (idx) => {
    const t = idx.trees[id];
    if (!t) throw new HttpError(404, "That tree was already removed.");
    if (!tokenMatches(t, token)) throw new HttpError(403, "Only the person who posted this tree can remove it.");
    const { [id]: _gone, ...rest } = idx.trees;
    return { value: { trees: rest }, result: null };
  });
  await Promise.allSettled([data.delete("notes/" + id), photos.delete(id), photos.delete(id + "-t")]);
  return json(200, { ok: true });
}

async function getPhoto(key) {
  const { photos } = await getStores();
  const found = await photos.getWithMetadata(key, { type: "arrayBuffer" });
  if (!found) return new Response("Not found", { status: 404, headers: BASE_HEADERS });
  return new Response(found.data, {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      "content-type": found.metadata?.type || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

export async function handle(req) {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const parts = path.split("/").slice(2); // drop "", "api"
  const m = req.method;
  try {
    if (parts[0] === "trees") {
      if (parts.length === 1 && m === "GET") return await listTrees();
      if (parts.length === 1 && m === "POST") return await createTree(req);
      const id = parts[1];
      if (!ID_RE.test(id || "")) throw new HttpError(404, "Tree not found.");
      if (parts.length === 2 && m === "DELETE") return await deleteTree(req, id);
      if (parts.length === 3 && parts[2] === "notes" && m === "GET") return await listNotes(id);
      if (parts.length === 3 && parts[2] === "notes" && m === "POST") return await addNote(req, id);
    }
    if (parts[0] === "photos" && parts.length === 2 && m === "GET" && /^[a-f0-9]{16}(-t)?$/.test(parts[1])) {
      return await getPhoto(parts[1]);
    }
    throw new HttpError(404, "Not found.");
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message, ...err.extra });
    console.error(err);
    return json(500, { error: "Something went wrong on the server. Try again." });
  }
}

export default handle;
export const config = { path: "/api/*" };
