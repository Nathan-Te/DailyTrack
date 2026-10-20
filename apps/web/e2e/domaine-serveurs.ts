// Lot R4 (plateforme) : deux serveurs locaux pour e2e/domaine.spec.ts, lancés DANS le spec (rien dans playwright.config.ts) :
//   - `startSite` : le site de playdujour.com comme Firebase Hosting le sert — le site assemblé par `node scripts/site.mjs site` (portail à la
//     racine, DailyTrack sous /track/, DailyJump sous /jump/), `/track` et `/jump` redirigés vers `/track/` et `/jump/` (ce que Hosting fait par défaut
//     pour un dossier avec `index.html`, sans règle dans firebase.json), et `/api/**` renvoyé
//     vers un serveur de la plateforme (même origine : aucune requête CORS) ;
//   - `startOldPages` : l'ancienne adresse comme GitHub Pages la sert — les pages de redirection sous `/DailyTrack/` (`index.html` d'un
//     dossier, sinon `404.html` avec le statut 404).
// Lecture seule, rien hors des dossiers donnés.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import { extname, join, resolve } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
};

function fileFor(root: string, path: string): string | null {
  let file = resolve(root, `.${path}`);
  if (!file.startsWith(resolve(root))) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  return existsSync(file) ? file : null;
}

function send(res: import("node:http").ServerResponse, file: string, status = 200): void {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
}

function listen(server: Server, port: number): Promise<Server> {
  return new Promise((ok, ko) => {
    server.once("error", ko);
    server.listen(port, () => ok(server));
  });
}

/** Le site (Firebase Hosting) sur `port`, `/api/**` renvoyé vers `apiPort`. */
export function startSite(dir: string, port: number, apiPort: number): Promise<Server> {
  return listen(
    createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = decodeURIComponent(url.pathname);
      if (path.startsWith("/api/")) {
        const up = request({ host: "127.0.0.1", port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${apiPort}` } }, (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers);
          r.pipe(res);
        });
        up.on("error", () => res.writeHead(502).end());
        req.pipe(up);
        return;
      }
      if (path === "/track" || path === "/jump") {
        res.writeHead(301, { Location: `${path}/${url.search}` }).end();
        return;
      }
      const file = fileFor(dir, path);
      if (!file) {
        res.writeHead(404).end();
        return;
      }
      send(res, file);
    }),
    port,
  );
}

/** L'ancienne adresse (GitHub Pages) : `dir` publié sous `base` (`/DailyTrack/`), `404.html` pour tout chemin absent. */
export function startOldPages(dir: string, port: number, base = "/DailyTrack/"): Promise<Server> {
  return listen(
    createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      const inside = path.startsWith(base) ? path.slice(base.length - 1) : null;
      const file = inside === null ? null : fileFor(dir, inside);
      if (file) return send(res, file);
      if (inside !== null) return send(res, join(dir, "404.html"), 404);
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end("<!doctype html><title>404</title><p>Pas ici.</p>");
    }),
    port,
  );
}
