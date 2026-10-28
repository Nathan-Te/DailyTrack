// Lot R4 (plateforme) : un serveur local pour e2e/domaine.spec.ts, lancé DANS le spec (rien dans playwright.config.ts) :
//   - `startSite` : le site de playdujour.com comme Firebase Hosting le sert — le site assemblé par `node scripts/site.mjs site` (portail à la
//     racine, DailyTrack sous /track/, DailyJump sous /jump/), un dossier sans « / » final (`/track`, `/jump`, `/mentions-legales`) redirigé vers `<dossier>/` (ce que Hosting fait par défaut
//     pour un dossier avec `index.html`, sans règle dans firebase.json), et `/api/**` renvoyé
//     vers un serveur de la plateforme (même origine : aucune requête CORS). Lot I6 : une adresse inconnue reçoit `404.html` de la racine avec
//     le statut 404 (ce que Hosting fait par défaut, sans règle dans firebase.json) ; le manifeste est servi en `application/manifest+json`.
// (Lot R5 : plus de serveur de l'ancienne adresse GitHub Pages : les redirections sont retirées.)
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
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
};

function fileFor(root: string, path: string): string | null {
  let file = resolve(root, `.${path}`);
  if (!file.startsWith(resolve(root))) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  return existsSync(file) ? file : null;
}

function send(res: import("node:http").ServerResponse, file: string, status = 200, plus: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", ...plus });
  createReadStream(file).pipe(res);
}

function listen(server: Server, port: number): Promise<Server> {
  return new Promise((ok, ko) => {
    server.once("error", ko);
    server.listen(port, () => ok(server));
  });
}

/**
 * Le site (Firebase Hosting) sur `port`, `/api/**` renvoyé vers `apiPort`. Lot N1 : `entetes(chemin)` ajoute des en-têtes aux fichiers servis (le spec du panneau
 * d'administration y met ceux de `firebase.json`, dont la CSP de `/admin/`, pour prouver que la page marche sous elle).
 */
export function startSite(dir: string, port: number, apiPort: number, entetes: (chemin: string) => Record<string, string> = () => ({})): Promise<Server> {
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
      const dirPath = resolve(dir, `.${path}`);
      if (path !== "/" && !path.endsWith("/") && dirPath.startsWith(resolve(dir)) && existsSync(dirPath) && statSync(dirPath).isDirectory()) {
        res.writeHead(301, { Location: `${path}/${url.search}` }).end();
        return;
      }
      const file = fileFor(dir, path);
      if (!file) {
        const introuvable = join(dir, "404.html");
        if (existsSync(introuvable)) send(res, introuvable, 404, entetes(path));
        else res.writeHead(404).end();
        return;
      }
      send(res, file, 200, entetes(path));
    }),
    port,
  );
}
