// A small stand-in for Netlify Blobs that keeps data in files, for local runs.
// It supports only what the API uses: get, getWithMetadata, set, setJSON
// (with onlyIfMatch / onlyIfNew) and delete. All file work is synchronous,
// so a conditional check and its write can't interleave with another request.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function fileStoreFactory(root) {
  return (name) => new FileStore(path.join(root, name));
}

class FileStore {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  #file(key) {
    return path.join(this.dir, encodeURIComponent(key));
  }

  #read(key) {
    const file = this.#file(key);
    if (!fs.existsSync(file)) return null;
    const bytes = fs.readFileSync(file);
    const metaFile = file + ".meta";
    const metadata = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
    return { bytes, metadata, etag: etagOf(bytes) };
  }

  async get(key, { type = "text" } = {}) {
    const found = this.#read(key);
    return found ? convert(found.bytes, type) : null;
  }

  async getWithMetadata(key, { type = "text" } = {}) {
    const found = this.#read(key);
    return found ? { data: convert(found.bytes, type), etag: found.etag, metadata: found.metadata } : null;
  }

  async set(key, data, { metadata, onlyIfMatch, onlyIfNew } = {}) {
    const file = this.#file(key);
    const exists = fs.existsSync(file);
    if (onlyIfNew && exists) return { modified: false };
    if (onlyIfMatch && (!exists || etagOf(fs.readFileSync(file)) !== onlyIfMatch)) return { modified: false };
    const bytes = typeof data === "string" ? Buffer.from(data) : Buffer.from(data.buffer ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data);
    fs.writeFileSync(file, bytes);
    if (metadata) fs.writeFileSync(file + ".meta", JSON.stringify(metadata));
    return { modified: true, etag: etagOf(bytes) };
  }

  async setJSON(key, value, options) {
    return this.set(key, JSON.stringify(value), options);
  }

  async delete(key) {
    const file = this.#file(key);
    fs.rmSync(file, { force: true });
    fs.rmSync(file + ".meta", { force: true });
  }
}

const etagOf = (bytes) => '"' + createHash("md5").update(bytes).digest("hex") + '"';

function convert(bytes, type) {
  if (type === "json") return JSON.parse(bytes.toString("utf8"));
  if (type === "arrayBuffer") return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return bytes.toString("utf8");
}
