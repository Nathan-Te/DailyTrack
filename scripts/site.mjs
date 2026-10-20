// Le site de playdujour.com (lot R4 de la plateforme) : assemblage et configuration Firebase. (Lot R5 : plus de pages de redirection de
// l'ancienne adresse GitHub Pages.)
// Fonctions pures testées (apps/portail/test/site.test.ts) ; ligne de commande utilisée par .github/workflows/*.yml et les e2e :
//   node scripts/site.mjs site [--sortie site] [--production]
//        → construit le portail (apps/portail) et assemble `site/` : portail à la racine, DailyTrack (apps/web/dist) sous /track/, DailyJump
//          (apps/jump/dist) sous /jump/, la page des mentions légales (lot R5) sous /mentions-legales/ ; vérifie que chaque niveau figé (apps/jump/public/levels) est dans le site, identique. Les deux jeux
//          doivent être construits avant (`npm run build`). Lot I1 : la vitrine des composants (`/ui/`) est dans le site de la recette et des
//          aperçus, **jamais en production** : `--production` (deploy-site.yml, cible production) ne la construit pas, et vérifie qu'elle est absente.
//   node scripts/site.mjs firebase --site <identifiant du site> --service <service Cloud Run> [--region europe-west1] [--public site] [--sortie firebase.deploy.json]
//        → la configuration Firebase d'un déploiement : `firebase.json` (en-têtes, renvoi /api/**), avec le site et le service de la cible.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Où chaque partie du site est servie. */
export const LAYOUT = [
  { from: "apps/portail/dist", to: "" },
  { from: "apps/web/dist", to: "track" },
  { from: "apps/jump/dist", to: "jump" },
];

/** Région des renvois vers Cloud Run (prise en charge par Firebase Hosting, vérifié au lot R4). */
export const REGION = "europe-west1";

const SITE_ID = /^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/;
const SERVICE = /^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * La configuration d'un déploiement : `firebase.json` du dépôt (en-têtes, redirections, renvoi `/api/**`) avec le **site** et le **service
 * Cloud Run** de la cible. Production → `cdj-api`, recette et aperçus → `cdj-api-recette` : le renvoi ne croise jamais les deux.
 */
export function firebaseConfig(template, { site, service, region = REGION, publicDir }) {
  if (!SITE_ID.test(site ?? "")) throw new Error(`site Firebase invalide : « ${site} »`);
  if (!SERVICE.test(service ?? "")) throw new Error(`service Cloud Run invalide : « ${service} »`);
  const hosting = structuredClone(template.hosting);
  if (!hosting || Array.isArray(hosting)) throw new Error("firebase.json : un seul bloc `hosting` attendu");
  const api = (hosting.rewrites ?? []).filter((r) => r.source === "/api/**" && r.run);
  if (api.length !== 1) throw new Error("firebase.json : un seul renvoi /api/** vers Cloud Run attendu");
  for (const r of hosting.rewrites) if (r.run) r.run = { serviceId: service, region };
  return { hosting: { site, ...hosting, ...(publicDir ? { public: publicDir } : {}) } };
}

function option(argv, name, fallback) {
  const at = argv.indexOf(name);
  return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : fallback;
}

/** Lot I1 : le dossier de la vitrine des composants dans le site (recette et aperçus seulement). */
export const VITRINE = "ui";

/** L'environnement de la construction du portail : la production ne construit pas la vitrine (`PORTAIL_VITRINE=0`, apps/portail/vite.config.ts). */
export function portailEnv({ production = false } = {}, env = process.env) {
  return { ...env, VITE_CONFIG_NATIVE_IGNORE_WARNING: "true", PORTAIL_VITRINE: production ? "0" : "1" };
}

function viteBuild(options) {
  execFileSync("npx", ["tsc", "-p", "apps/portail"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "warn"], { cwd: ROOT, stdio: "inherit", env: portailEnv(options) });
}

/**
 * Lot I4 : les polices de Track sont demandées à `/assets/<nom>-<empreinte>.woff2`, **le même chemin que celles du portail** (un joueur qui vient du portail les
 * a déjà en cache). Le nom porte l'empreinte du contenu : le même nom, ce sont les mêmes octets. Pour chaque police que la feuille de Track demande : si le portail
 * l'a, elle doit être identique (sinon l'assemblage s'arrête) ; sinon elle rejoint `assets/` du portail ; dans les deux cas la copie de `track/assets/` est retirée
 * (un seul fichier par police sur le site). Rend les polices partagées avec le portail et celles que Track y a ajoutées.
 */
export function partagerPolices(out) {
  const assetsTrack = join(out, "track/assets");
  const noms = new Set();
  for (const f of existsSync(assetsTrack) ? readdirSync(assetsTrack).filter((x) => x.endsWith(".css")) : []) {
    for (const m of readFileSync(join(assetsTrack, f), "utf8").matchAll(/url\(["']?\/assets\/([^)"']+\.woff2)["']?\)/g)) noms.add(m[1]);
  }
  const communes = [];
  const ajoutees = [];
  for (const nom of noms) {
    const source = join(assetsTrack, nom);
    const dest = join(out, "assets", nom);
    if (!existsSync(source)) throw new Error(`police de Track absente de la construction : assets/${nom}`);
    if (existsSync(dest)) {
      if (!readFileSync(dest).equals(readFileSync(source))) throw new Error(`police différente de celle du portail sous le même nom : assets/${nom}`);
      communes.push(nom);
    } else {
      mkdirSync(join(out, "assets"), { recursive: true });
      cpSync(source, dest);
      ajoutees.push(nom);
    }
    rmSync(source);
  }
  return { communes, ajoutees };
}

/** Assemble le site (portail, /track/, /jump/) ; rend le nombre de niveaux figés vérifiés. `production` : sans la vitrine `/ui/`. */
export function assembleSite(out, { production = false } = {}) {
  for (const part of LAYOUT.slice(1)) if (!existsSync(join(ROOT, part.from, "index.html"))) throw new Error(`${part.from} n'est pas construit : npm run build`);
  viteBuild({ production });
  rmSync(out, { recursive: true, force: true });
  for (const part of LAYOUT) {
    const dest = join(out, part.to);
    mkdirSync(dest, { recursive: true });
    cpSync(join(ROOT, part.from), dest, { recursive: true });
  }
  partagerPolices(out); // lot I4 : les polices de Track sont celles du portail
  // Les niveaux figés de DailyJump (lot 10) doivent être dans le site publié, identiques : sinon un jour déjà joué changerait de niveau.
  const levels = join(ROOT, "apps/jump/public/levels");
  const files = existsSync(levels) ? readdirSync(levels).filter((f) => f.endsWith(".json")) : [];
  for (const f of files) {
    const got = join(out, "jump/levels", f);
    if (!existsSync(got) || !readFileSync(got).equals(readFileSync(join(levels, f)))) throw new Error(`niveau figé absent ou différent du site : jump/levels/${f}`);
  }
  // Lot I1 : la vitrine n'est jamais publiée en production ; ailleurs elle doit y être.
  const vitrine = existsSync(join(out, VITRINE, "index.html"));
  if (production && vitrine) throw new Error(`la vitrine /${VITRINE}/ ne doit pas être dans le site de production`);
  if (!production && !vitrine) throw new Error(`vitrine /${VITRINE}/ absente du site`);
  return files.length;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const [cmd, ...argv] = process.argv.slice(2);
  try {
    if (cmd === "site") {
      const out = resolve(option(argv, "--sortie", "site"));
      const production = argv.includes("--production");
      const n = assembleSite(out, { production });
      console.log(`site assemblé dans ${out} : portail, /track/, /jump/${production ? " (production : sans la vitrine /ui/)" : ", vitrine /ui/"} ; ${n} niveau(x) figé(s) vérifié(s)`);
    } else if (cmd === "firebase") {
      const template = JSON.parse(readFileSync(join(ROOT, "firebase.json"), "utf8"));
      const config = firebaseConfig(template, { site: option(argv, "--site"), service: option(argv, "--service"), region: option(argv, "--region", REGION), publicDir: option(argv, "--public") });
      const out = option(argv, "--sortie", "firebase.deploy.json");
      writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
      console.log(`configuration Firebase : ${out} (site ${config.hosting.site}, /api/** → ${config.hosting.rewrites.find((r) => r.run).run.serviceId})`);
    } else {
      console.error("usage : node scripts/site.mjs site [--sortie site] [--production] · firebase --site <id> --service <svc>");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
