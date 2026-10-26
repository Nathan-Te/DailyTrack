// Lot R6 : « l'ancien code sur la base migrée ». Le retour arrière remet l'ancien serveur sur la base que le nouveau a déjà migrée (la base n'est jamais restaurée) :
// il doit y tourner. Ce script le prouve avant le déploiement, sur une base SQLite locale jetable (jamais une vraie base) :
//   1. le serveur du commit à déployer (`cible`) démarre sur une base neuve — il la migre — et passe son `smoke` complet (il y crée des joueurs, des temps, des vies) ;
//   2. le serveur du code actuellement en production (`prod`, la dernière étiquette prod-…) démarre sur **cette même base**, puis passe son propre `smoke` (complet) et son
//      `smoke --lecture-seule` : santé, niveau du jour, classements, envoi d'un temps, Salon, DailyJump.
//   node scripts/base-migree.mjs <dossier du commit à déployer> <dossier du code en production> [--resume <fichier>]
// Chaque dossier est un dépôt dont les dépendances sont installées (`npm ci`). Aucune variable de production n'est lue ; aucun secret ; la base est supprimée à la fin.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Les variables d'un serveur local jetable : jamais celles du processus (aucune base, aucun jeton de production ne peut s'y glisser). */
export function environnementLocal(port, base) {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? tmpdir(),
    NODE_NO_WARNINGS: "1",
    PORT: String(port),
    DB_PATH: base,
    ALLOWED_ORIGINS: "*",
    ENVIRONMENT: "local",
  };
}

async function sante(port, essais = 60) {
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) return await r.json();
    } catch {
      /* pas encore démarré */
    }
    await attendre(500);
  }
  throw new Error(`le serveur n'a pas répondu sur le port ${port}`);
}

function lancer(commande, args, options) {
  const r = spawnSync(commande, args, { stdio: "inherit", ...options });
  if (r.status !== 0) throw new Error(`${commande} ${args.join(" ")} : échec (code ${r.status}) dans ${options.cwd}`);
}

async function avecServeur(dossier, port, base, travail) {
  const serveur = spawn(process.execPath, ["apps/api/dist/server.mjs"], { cwd: dossier, env: environnementLocal(port, base), stdio: ["ignore", "ignore", "inherit"] });
  try {
    await sante(port);
    await travail();
  } finally {
    serveur.kill("SIGTERM");
    await attendre(500);
  }
}

export async function baseMigree({ cible, prod, resume }) {
  const lignes = [];
  const dossier = mkdtempSync(join(tmpdir(), "cdj-base-migree-"));
  const base = join(dossier, "cdj.sqlite");
  try {
    for (const d of [cible, prod]) lancer("npm", ["run", "build:node", "-w", "@cdj/api"], { cwd: d, env: { ...process.env } });
    const smoke = (d, port, ...extra) => lancer("npm", ["run", "smoke", "-w", "@cdj/api", "--", `http://127.0.0.1:${port}`, "--origin", "https://playdujour.com", ...extra], { cwd: d, env: { ...process.env } });

    console.log("\n=== 1. le code à déployer migre une base neuve et passe son smoke ===");
    await avecServeur(cible, 8093, base, async () => smoke(cible, 8093));
    lignes.push("- ✅ le code à déployer migre une base neuve et passe son `smoke` complet");

    console.log("\n=== 2. le code actuellement en production, sur cette base migrée ===");
    await avecServeur(prod, 8094, base, async () => {
      smoke(prod, 8094, "--lecture-seule");
      smoke(prod, 8094);
    });
    lignes.push("- ✅ le code actuellement en production tourne sur la base migrée (`smoke --lecture-seule` puis `smoke` complet de ce code) : le retour arrière est possible");
  } catch (e) {
    lignes.push(`- ❌ ${e instanceof Error ? e.message : String(e)}`);
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { lignes });
  } finally {
    rmSync(dossier, { recursive: true, force: true });
    if (resume) appendFileSync(resume, ["### Ancien code sur la base migrée (le retour arrière tourne)", "", ...lignes, ""].join("\n"));
  }
}

const estPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (estPrincipal) {
  const args = process.argv.slice(2);
  const [cible, prod] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--resume");
  const resume = args.includes("--resume") ? args[args.indexOf("--resume") + 1] : undefined;
  if (!cible || !prod) {
    console.error("usage : node scripts/base-migree.mjs <dossier du commit à déployer> <dossier du code en production> [--resume <fichier>]");
    process.exit(2);
  }
  try {
    await baseMigree({ cible: resolve(cible), prod: resolve(prod), resume });
    console.log("\nL'ancien code tourne sur la base migrée.");
  } catch (e) {
    console.error(`\n${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
