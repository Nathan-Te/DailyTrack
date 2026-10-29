// Lot N1 (plateforme) : de quoi lancer le panneau d'administration en local pour les specs `admin-panneau.spec.ts` (le parcours) et `captures-lot-n1.spec.ts` (les captures) :
// le portail construit seul (`/admin/`), servi comme Firebase Hosting le sert **avec les en-têtes de `firebase.json`** (dont la CSP de `/admin/`), et le serveur de l'API
// (`apps/api/dist/server.mjs`, construit par `npm run build:node -w @cdj/api`) avec **le vérificateur factice** (local et CI seulement), une base SQLite de fichier que ce
// module peuple de joueurs fictifs, l'horloge de test (20/10/2026) et les origines permises comme en production (`ALLOWED_ORIGINS` : la page).
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { startSite } from "./domaine-serveurs";
import { FIXED_NOW, TODAY } from "./fixtures";

const ROOT = resolve("../..");
export const ADRESSE_ADMIN = "admin@example.test";
export const CLE_SESSION = "cle-de-session-des-essais-assez-longue-pour-passer";
const JOUR = 86_400_000;

/** Les règles `source` de `firebase.json` qui s'appliquent à un chemin (les mêmes globs `**`, `/dossier/**`), dans l'ordre : le suivant l'emporte. */
function entetesDeFirebase(chemin: string): Record<string, string> {
  const config = JSON.parse(readFileSync(join(ROOT, "firebase.json"), "utf8")) as { hosting: { headers: { source?: string; headers: { key: string; value: string }[] }[] } };
  const out: Record<string, string> = {};
  for (const regle of config.hosting.headers) {
    const s = regle.source;
    if (!s) continue;
    const prefixe = s.endsWith("/**") ? s.slice(0, -3) : null;
    const ok = s === "**" || (prefixe !== null && (chemin === prefixe || chemin.startsWith(`${prefixe}/`)));
    if (ok) for (const h of regle.headers) out[h.key] = h.value;
  }
  return out;
}

export interface Panneau {
  site: string;
  api: ChildProcess;
  servers: Server[];
  base: string;
  dossier: string;
  /** Écrit directement dans la base de l'API en marche (fichier SQLite) : des joueurs et des résultats fictifs. */
  peupler(): void;
  arreter(): Promise<void>;
}

/**
 * `track: true` : le site contient aussi Track (`apps/web/dist`, construit par `npm run build`) sous `/track/` : sa page d'outils (`/track/admin/`) est alors sur la même origine
 * que l'API, comme en production (la session du panneau est un cookie : elle ne vaut que pour la même origine). `jump: true` : de même pour Jump (`apps/jump/dist`) sous `/jump/`, dont la
 * page d'outils est `/jump/admin/`.
 */
export async function demarrerPanneau(o: { portSite: number; portApi: number; track?: boolean; jump?: boolean }): Promise<Panneau> {
  if (!existsSync(join(ROOT, "apps/api/dist/server.mjs"))) throw new Error("l'API n'est pas construite : npm run build:node -w @cdj/api");
  const dossier = mkdtempSync(join(tmpdir(), "panneau-"));
  // Le portail seul (la page `/admin/` n'a besoin ni de Track ni de Jump), dans un dossier à part.
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--outDir", join(dossier, "site"), "--emptyOutDir", "--logLevel", "error"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, PORTAIL_VITRINE: "0" } });
  if (o.track) {
    if (!existsSync(join(ROOT, "apps/web/dist/admin/index.html"))) throw new Error("Track n'est pas construit : npm run build");
    cpSync(join(ROOT, "apps/web/dist"), join(dossier, "site", "track"), { recursive: true });
  }
  if (o.jump) {
    if (!existsSync(join(ROOT, "apps/jump/dist/admin/index.html"))) throw new Error("Jump n'est pas construit : npm run build");
    cpSync(join(ROOT, "apps/jump/dist"), join(dossier, "site", "jump"), { recursive: true });
  }
  const site = `http://localhost:${o.portSite}`;
  const base = join(dossier, "base.sqlite");
  const api = spawn("node", ["../api/dist/server.mjs"], {
    env: {
      ...process.env,
      PORT: String(o.portApi),
      DB_PATH: base,
      ALLOWED_ORIGINS: site, // comme en production : l'`Origin` d'une écriture du panneau doit en faire partie
      ADMIN_FAKE_VERIFIER: "1",
      ADMIN_EMAILS: ADRESSE_ADMIN,
      ADMIN_SESSION_KEY: CLE_SESSION,
      ADMIN_GOOGLE_CLIENT_ID: "123456789012-essais.apps.googleusercontent.com",
      RELEASE_TAG: "prod-2026-10-19-1830",
      GIT_SHA: "0123456789abcdef0123456789abcdef01234567",
      NODE_NO_WARNINGS: "1",
      TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS,
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${o.portApi}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const servers = [await startSite(join(dossier, "site"), o.portSite, o.portApi, entetesDeFirebase)];
  return {
    site,
    api,
    servers,
    base,
    dossier,
    peupler() {
      const db = new DatabaseSync(base);
      db.exec("PRAGMA busy_timeout = 5000");
      const maintenant = FIXED_NOW;
      const joueur = db.prepare("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, ?, ?, ?, 1, ?)");
      const track = db.prepare("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, inputs_hash) VALUES (?, ?, ?, '[]', ?, 0, ?, ?)");
      const noms: [string, string][] = [["Démo Alice", "demo alice"], ["Démo Bob", "demo bob"], ["Chloé", "chloe"], ["Dan", "dan"]];
      noms.forEach(([nom, cle], i) => {
        const id = (i + 1).toString(16).padStart(32, "0");
        const creation = maintenant - (i < 2 ? 5 * JOUR : i === 2 ? 3_600_000 : 3 * JOUR);
        joueur.run(id, nom, creation, creation, cle);
        if (i < 3) track.run(TODAY, id, 60_000 + i * 1500, `REDIFFUSION-${i}`, maintenant - 3_600_000 + i, `h${i}`);
        if (i === 0 || i === 3) track.run(TODAY - 1, id, 70_000 + i * 100, `REDIFFUSION-HIER-${i}`, maintenant - JOUR, `hh${i}`);
      });
      db.close();
    },
    async arreter() {
      await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
      api.kill();
      rmSync(dossier, { recursive: true, force: true });
    },
  };
}
