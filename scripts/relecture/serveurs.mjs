// Lot QA1 : les serveurs locaux de `npm run relecture` — le site assemblé servi comme Firebase Hosting (`/api/**` renvoyé au serveur de la plateforme, `/groupe/<nom>` réécrit, 404 de la racine), le vrai
// serveur (`apps/api/dist/server.mjs`) sur une base SQLite de fichier remplie par le vrai `recette:seed`, et le vérificateur factice du panneau (local seulement) pour passer les jeux `off` en `on`.
// Rien ici ne touche une base distante : `TURSO_DATABASE_URL` est vidé pour chaque processus lancé.
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { extname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const ADRESSE_ADMIN = "relecture@example.test";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".m4a": "audio/mp4", ".txt": "text/plain; charset=utf-8" };

/** Le jour de Paris d'aujourd'hui (AAAA-MM-JJ). */
export const jourDeParis = (t = Date.now()) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));

/** Le site sur `port`, `/api/**` renvoyé vers `portApi` (même origine : la session du panneau, un cookie, vaut pour la page). */
export function lancerSite(dossier, port, portApi) {
  const racine = resolve(dossier);
  const fichierDe = (chemin) => {
    let f = resolve(racine, `.${chemin}`);
    if (!f.startsWith(racine)) return null;
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    return existsSync(f) ? f : null;
  };
  const envoyer = (res, f, statut = 200) => {
    res.writeHead(statut, { "Content-Type": TYPES[extname(f)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(f).pipe(res);
  };
  const serveur = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const chemin = decodeURIComponent(url.pathname);
    if (chemin.startsWith("/api/")) {
      const amont = request({ host: "127.0.0.1", port: portApi, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${portApi}` } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      amont.on("error", () => res.writeHead(502).end());
      req.pipe(amont);
      return;
    }
    const dossierVise = resolve(racine, `.${chemin}`);
    if (chemin !== "/" && !chemin.endsWith("/") && dossierVise.startsWith(racine) && existsSync(dossierVise) && statSync(dossierVise).isDirectory()) return void res.writeHead(301, { Location: `${chemin}/${url.search}` }).end();
    const groupe = /^\/groupe\/[^/]+\/?$/.test(chemin) ? join(racine, "groupe/index.html") : null;
    const f = groupe && existsSync(groupe) ? groupe : fichierDe(chemin);
    if (f) return envoyer(res, f);
    const introuvable = join(racine, "404.html");
    if (existsSync(introuvable)) envoyer(res, introuvable, 404);
    else res.writeHead(404).end();
  });
  return new Promise((ok, ko) => {
    serveur.once("error", ko);
    serveur.listen(port, () => ok(serveur));
  });
}

/** Le vrai serveur de la plateforme sur `port`, base `base`, vérificateur factice du panneau (local seulement). Rend le processus, une fois `/api/health` vert. */
export async function lancerApi(racineDepot, port, base, origine) {
  const enfant = spawn("node", [join(racineDepot, "apps/api/dist/server.mjs")], {
    cwd: join(racineDepot, "apps/api"),
    env: { ...process.env, PORT: String(port), DB_PATH: base, TURSO_DATABASE_URL: "", ALLOWED_ORIGINS: origine, ADMIN_FAKE_VERIFIER: "1", ADMIN_EMAILS: ADRESSE_ADMIN, ADMIN_SESSION_KEY: "cle-de-session-de-la-relecture-assez-longue-pour-passer", ADMIN_GOOGLE_CLIENT_ID: "123456789012-relecture.apps.googleusercontent.com", NODE_NO_WARNINGS: "1" },
    stdio: "ignore",
  });
  for (let i = 0; i < 150; i++) {
    if (await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false)) return enfant;
    await new Promise((r) => setTimeout(r, 100));
  }
  enfant.kill();
  throw new Error(`relecture : le serveur de la plateforme ne répond pas sur ${port} (apps/api/dist/server.mjs est-il construit ? npm run build:node -w @cdj/api)`);
}

/** Ouvre une session factice du panneau et rend son cookie `__session` (valeur seule). */
export async function sessionAdmin(origine) {
  const entetes = { Origin: origine, "X-Cdj-Admin": "1", "Content-Type": "application/json" };
  const r = await fetch(`${origine}/api/admin/session`, { method: "POST", headers: entetes, body: JSON.stringify({ credential: `factice:${ADRESSE_ADMIN}` }) });
  if (r.status !== 200) throw new Error(`relecture : session du panneau refusée (${r.status})`);
  return /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")[1];
}

/** Passe un jeu dans un état, comme le fait le panneau. Rend `null`, ou le refus du serveur (texte). */
export async function etatDuJeu(origine, cookie, jeu, etat) {
  const r = await fetch(`${origine}/api/admin/jeux/${jeu}/etat`, { method: "POST", headers: { Origin: origine, "X-Cdj-Admin": "1", "Content-Type": "application/json", Cookie: `__session=${cookie}` }, body: JSON.stringify({ etat, confirmer: true }) });
  return r.status === 200 ? null : `${r.status} ${(await r.text()).slice(0, 200)}`;
}

/**
 * Un jeu passé `on` ne compte que le lendemain (son classement du jour serait refusé jusqu'à minuit) : sur la base **locale** de la relecture, les jeux `on` sont ouverts « depuis toujours », comme Track et
 * Jump le sont sur une base neuve. Seule écriture directe de l'outil, jamais sur une base distante (un fichier SQLite).
 */
export function ouvrirDepuisToujours(base) {
  const db = new DatabaseSync(base);
  try {
    db.exec("UPDATE jeux SET live_from = 0, periodes = '[[0,null]]' WHERE etat = 'on'");
  } finally {
    db.close();
  }
}

/**
 * Le limiteur de débit des **écritures** (table `rate` : par adresse et par joueur, par fenêtre de 10 minutes) : la relecture envoie des parties et ouvre des centaines de pages depuis une seule machine.
 * Sa table est vidée avant chaque écran, sur la base **locale** seulement. (Les lectures sont comptées en mémoire par le serveur : `relecture.mjs` relance le serveur de chaque poste avant chaque sujet.)
 */
export function viderLeLimiteur(base) {
  try {
    const db = new DatabaseSync(base);
    try {
      db.exec("PRAGMA busy_timeout = 3000; DELETE FROM rate");
    } finally {
      db.close();
    }
  } catch {
    /* base occupée : le sujet suivant réessaiera */
  }
}

/** Le vrai `recette:seed` sur la base locale (jamais une base distante : `TURSO_DATABASE_URL` vide). */
export function semer(racineDepot, base, jour) {
  execFileSync("npm", ["run", "--silent", "recette:seed", "--", "--today", jour], { cwd: racineDepot, env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: base, TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "" }, stdio: ["ignore", "ignore", "inherit"] });
}

/**
 * Les joueurs des états photographiés, lus dans la base locale : « Démo » (amis, groupe, Track fini, Jump en cours) et un joueur du classement de démonstration qui a fini tous les jeux du jour, sans ami ni
 * groupe (« journée parfaite », « sans amis », « sans groupe »). Les identifiants sont ceux de comptes fictifs de cette base locale ; ils ne sont écrits nulle part.
 */
export function joueursDesEtats(base) {
  const db = new DatabaseSync(base, { readOnly: true });
  try {
    const jour = db.prepare("SELECT max(day) AS d FROM results").get().d;
    const parfait = db.prepare(
      `SELECT p.id, p.name FROM players p WHERE p.id <> 'de30de30de30de30de30de30de30de30'
         AND EXISTS (SELECT 1 FROM results r WHERE r.player_id = p.id AND r.day = ?) AND EXISTS (SELECT 1 FROM jump_results j WHERE j.player_id = p.id AND j.day = ?)
         AND NOT EXISTS (SELECT 1 FROM amities a WHERE a.joueur = p.id) AND NOT EXISTS (SELECT 1 FROM groupe_membres g WHERE g.player_id = p.id) ORDER BY p.name LIMIT 1`,
    ).get(jour, jour);
    const groupe = db.prepare("SELECT g.name FROM groupes g JOIN groupe_membres m ON m.groupe = g.id WHERE m.player_id = 'de30de30de30de30de30de30de30de30'").get();
    return { demo: { id: "de30de30de30de30de30de30de30de30", nom: "Démo" }, parfaite: parfait ? { id: parfait.id, nom: parfait.name } : null, groupe: groupe?.name ?? null };
  } finally {
    db.close();
  }
}
