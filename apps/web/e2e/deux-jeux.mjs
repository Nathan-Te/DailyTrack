// Lot P4 (plateforme) : les deux jeux construits, servis par la **même origine** comme sur GitHub Pages — DailyTrack (`apps/web/dist`) à la
// racine, DailyJump (`apps/jump/dist`) sous `/jump/` : ils partagent donc le stockage du navigateur (l'identité `cdj:*`). Réservé à
// `e2e/identite-plateforme.spec.ts` (port 4175, `playwright.config.ts`). Lecture seule, rien hors des deux dossiers.
//   node e2e/deux-jeux.mjs 4175
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const port = Number(process.argv[2] ?? 4175);
const roots = [
  { prefix: "/jump/", dir: resolve("../jump/dist") },
  { prefix: "/", dir: resolve("dist") },
];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  if (path === "/jump") {
    res.writeHead(301, { Location: "/jump/" }).end();
    return;
  }
  const root = roots.find((r) => path.startsWith(r.prefix));
  let file = resolve(root.dir, `.${path.slice(root.prefix.length - 1)}`);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!file.startsWith(root.dir) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`deux jeux sur http://localhost:${port}/ et /jump/`));
