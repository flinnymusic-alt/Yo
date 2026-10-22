import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handle, setStoreFactory } from "../netlify/functions/api.mjs";
import { fileStoreFactory } from "../dev/file-store.mjs";

let dir;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fruit-"));
  setStoreFactory(fileStoreFactory(dir));
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

function treeForm(fields = {}) {
  const f = new FormData();
  const base = { fruit: "fig", place: "Corner of Oak & 5th", city: "Oakland, California", lat: "37.8044", lng: "-122.2712", status: "yes", ...fields };
  for (const [k, v] of Object.entries(base)) if (v !== undefined) f.set(k, v);
  return f;
}
const call = async (method, url, body, headers = {}) => {
  const res = await handle(new Request("http://x" + url, { method, body, headers }));
  return { status: res.status, body: res.headers.get("content-type")?.includes("json") ? await res.json() : await res.arrayBuffer() };
};

test("empty store lists no trees", async () => {
  const r = await call("GET", "/api/trees");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.trees, []);
});

test("create a tree with photo and first note; token hash is never exposed", async () => {
  const f = treeForm({ note: "Ripe in August", name: "Sam" });
  f.set("photo", new Blob([JPEG], { type: "image/jpeg" }), "p.jpg");
  f.set("thumb", new Blob([JPEG], { type: "image/jpeg" }), "t.jpg");
  const r = await call("POST", "/api/trees", f);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.tree.fruit, "Fig");
  assert.equal(r.body.tree.noteCount, 1);
  assert.ok(r.body.editToken.length > 20);
  assert.equal(r.body.tree.tokenHash, undefined);

  const list = await call("GET", "/api/trees");
  assert.equal(list.body.trees.length, 1);
  assert.equal(list.body.trees[0].tokenHash, undefined);

  const img = await call("GET", `/api/photos/${r.body.tree.id}-t`);
  assert.equal(img.status, 200);
  assert.equal(img.body.byteLength, JPEG.length);

  const notes = await call("GET", `/api/trees/${r.body.tree.id}/notes`);
  assert.equal(notes.body.notes[0].text, "Ripe in August");
  assert.equal(notes.body.notes[0].name, "Sam");
});

test("validation rejects bad input", async () => {
  assert.equal((await call("POST", "/api/trees", treeForm({ fruit: "" }))).status, 400);
  assert.equal((await call("POST", "/api/trees", treeForm({ lat: "abc" }))).status, 400);
  assert.equal((await call("POST", "/api/trees", treeForm({ lat: "95" }))).status, 400);
  assert.equal((await call("POST", "/api/trees", treeForm({ lng: "" }))).status, 400);
  assert.equal((await call("POST", "/api/trees", treeForm({ status: "maybe" }))).status, 400);
  assert.equal((await call("POST", "/api/trees", treeForm({ place: "   " }))).status, 400);
  const f = treeForm({ lat: "10", lng: "10" });
  f.set("photo", new Blob(["<script>alert(1)</script>"], { type: "image/jpeg" }), "x.jpg");
  assert.equal((await call("POST", "/api/trees", f)).status, 415);
  assert.equal((await call("POST", "/api/trees", "not a form", { "content-type": "multipart/form-data; boundary=zz" })).status, 400);
});

test("same fruit at the same spot is flagged as a duplicate; a different fruit is fine", async () => {
  const dupe = await call("POST", "/api/trees", treeForm({ lat: "37.80441", lng: "-122.27121" }));
  assert.equal(dupe.status, 409);
  assert.match(dupe.body.existingId, /^[a-f0-9]{16}$/);
  const lemon = await call("POST", "/api/trees", treeForm({ fruit: "Lemon", lat: "37.80441" }));
  assert.equal(lemon.status, 201);
});

test("notes update fruiting status, and concurrent notes are all kept", async () => {
  const { body } = await call("POST", "/api/trees", treeForm({ fruit: "Plum", lat: "40.7", lng: "-74.0", status: "no" }));
  const id = body.tree.id;
  const post = (text, status) => call("POST", `/api/trees/${id}/notes`, JSON.stringify({ text, status }), { "content-type": "application/json" });

  const r = await post("Loaded with plums", "yes");
  assert.equal(r.status, 201);
  assert.equal(r.body.tree.status, "yes");

  const results = await Promise.all(Array.from({ length: 15 }, (_, i) => post("note " + i, "")));
  results.forEach((x) => assert.equal(x.status, 201));
  const notes = await call("GET", `/api/trees/${id}/notes`);
  assert.equal(notes.body.notes.length, 16);
  const tree = (await call("GET", "/api/trees")).body.trees.find((t) => t.id === id);
  assert.equal(tree.noteCount, 16);
  assert.equal(tree.status, "yes");

  assert.equal((await post("", "")).status, 400);
  assert.equal((await call("POST", `/api/trees/${id}/notes`, "{bad", {})).status, 400);
});

test("concurrent tree posts are all kept", async () => {
  const before = (await call("GET", "/api/trees")).body.trees.length;
  const posts = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    call("POST", "/api/trees", treeForm({ fruit: "Apple", lat: String(10 + i), lng: "20" }))));
  posts.forEach((p) => assert.equal(p.status, 201));
  assert.equal((await call("GET", "/api/trees")).body.trees.length, before + 10);
});

test("only the poster (or admin) can delete a tree", async () => {
  const { body } = await call("POST", "/api/trees", treeForm({ fruit: "Pear", lat: "-33.86", lng: "151.2" }));
  const id = body.tree.id;
  assert.equal((await call("DELETE", `/api/trees/${id}`, undefined, { "x-edit-token": "wrong" })).status, 403);
  assert.equal((await call("DELETE", `/api/trees/${id}`)).status, 403);
  assert.equal((await call("DELETE", `/api/trees/${id}`, undefined, { "x-edit-token": body.editToken })).status, 200);
  assert.equal((await call("DELETE", `/api/trees/${id}`, undefined, { "x-edit-token": body.editToken })).status, 404);

  const other = await call("POST", "/api/trees", treeForm({ fruit: "Pear", lat: "-33.9", lng: "151.2" }));
  process.env.ADMIN_TOKEN = "admin-secret-token-123";
  assert.equal((await call("DELETE", `/api/trees/${other.body.tree.id}`, undefined, { "x-edit-token": "admin-secret-token-123" })).status, 200);
  delete process.env.ADMIN_TOKEN;
});

test("unknown routes and malformed ids are 404", async () => {
  assert.equal((await call("GET", "/api/nope")).status, 404);
  assert.equal((await call("GET", "/api/trees/../../etc/notes")).status, 404);
  assert.equal((await call("GET", "/api/photos/../index")).status, 404);
  assert.equal((await call("GET", "/api/photos/0123456789abcdef")).status, 404);
  assert.equal((await call("POST", "/api/trees/0123456789abcdef/notes", JSON.stringify({ text: "hi" }))).status, 404);
});

test("bots filling the hidden field are ignored", async () => {
  const before = (await call("GET", "/api/trees")).body.trees.length;
  const r = await call("POST", "/api/trees", treeForm({ website: "http://spam", lat: "1", lng: "1" }));
  assert.equal(r.status, 201);
  assert.equal((await call("GET", "/api/trees")).body.trees.length, before);
});
