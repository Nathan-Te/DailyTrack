import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

// Le serveur de développement et d'aperçu des jeux (`npm run dev`, `vite preview`, les e2e) sert `/musique/` depuis `musique/servi/`, comme le site assemblé (`scripts/site.mjs`) :
// ainsi un morceau ajouté s'écoute sans assembler le site. Les lectures par morceaux (`Range`) sont prises en charge (le lecteur lit en flux). Rien n'est publié par ce plugin :
// il ne touche pas à la construction.
const DOSSIER = fileURLToPath(new URL("../../../musique/servi", import.meta.url));
const TYPES: Record<string, string> = { ".m4a": "audio/mp4", ".json": "application/json; charset=utf-8" };

type Requete = { url?: string; headers: Record<string, string | string[] | undefined>; method?: string };
type Reponse = { statusCode: number; setHeader(k: string, v: string | number): void; end(d?: string): void } & NodeJS.WritableStream;

function servir(req: Requete, res: Reponse, suite: () => void): void {
  const url = (req.url ?? "").split("?")[0] ?? "";
  const m = /^\/musique\/([a-z0-9][a-z0-9.-]*)$/.exec(url);
  if (!m) return suite();
  const fichier = join(DOSSIER, m[1]!);
  const ext = fichier.slice(fichier.lastIndexOf("."));
  if (!TYPES[ext] || !existsSync(fichier)) return suite();
  const taille = statSync(fichier).size;
  res.setHeader("Content-Type", TYPES[ext]!);
  res.setHeader("Accept-Ranges", "bytes");
  const r = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (r && (r[1] || r[2])) {
    const debut = r[1] ? Number(r[1]) : Math.max(0, taille - Number(r[2]));
    const fin = r[1] && r[2] ? Math.min(Number(r[2]), taille - 1) : taille - 1;
    if (debut > fin || debut >= taille) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${taille}`);
      return res.end();
    }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${debut}-${fin}/${taille}`);
    res.setHeader("Content-Length", fin - debut + 1);
    createReadStream(fichier, { start: debut, end: fin }).pipe(res);
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Length", taille);
  if (req.method === "HEAD") return res.end();
  createReadStream(fichier).pipe(res);
}

/** Le plugin Vite de la musique (développement et aperçu local). */
export function musiqueServie(): Plugin {
  return {
    name: "cdj-musique",
    configureServer: (s) => void s.middlewares.use((req, res, next) => servir(req as Requete, res as unknown as Reponse, next)),
    configurePreviewServer: (s) => void s.middlewares.use((req, res, next) => servir(req as Requete, res as unknown as Reponse, next)),
  };
}
