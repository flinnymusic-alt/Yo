// Local server: `npm start`, then open http://localhost:8888
// Serves public/ and sends /api/* to the same handler Netlify runs.
// Data is kept in ./.data so it survives restarts.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { handle, setStoreFactory } from "./netlify/functions/api.mjs";
import { fileStoreFactory } from "./dev/file-store.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT) || 8888;

setStoreFactory(fileStoreFactory(process.env.DATA_DIR || path.join(root, ".data")));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

async function serveApi(req, res) {
  const method = req.method || "GET";
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method,
    headers: req.headers,
    body: method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(req),
    duplex: "half",
  });
  const response = await handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(publicDir, urlPath));
  if (!file.startsWith(publicDir)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      serveApi(req, res).catch((err) => {
        console.error(err);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    } else {
      serveStatic(req, res);
    }
  })
  .listen(port, () => console.log(`Free Fruit Finder running at http://localhost:${port}`));
