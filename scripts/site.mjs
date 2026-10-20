// Le site de playdujour.com (lot R4 de la plateforme) : assemblage, configuration Firebase, pages de redirection de l'ancienne adresse.
// Fonctions pures testées (apps/portail/test/site.test.ts) ; ligne de commande utilisée par .github/workflows/*.yml et les e2e :
//   node scripts/site.mjs site [--sortie site]
//        → construit le portail (apps/portail) et assemble `site/` : portail à la racine, DailyTrack (apps/web/dist) sous /track/, DailyJump
//          (apps/jump/dist) sous /jump/ ; vérifie que chaque niveau figé (apps/jump/public/levels) est dans le site, identique. Les deux jeux
//          doivent être construits avant (`npm run build`).
//   node scripts/site.mjs firebase --site <identifiant du site> --service <service Cloud Run> [--region europe-west1] [--public site] [--sortie firebase.deploy.json]
//        → la configuration Firebase d'un déploiement : `firebase.json` (en-têtes, renvoi /api/**), avec le site et le service de la cible.
//   node scripts/site.mjs redirections [--sortie pages] [--cible https://playdujour.com] [--base /DailyTrack/]
//        → les pages de redirection de GitHub Pages : index.html, jump/index.html, 404.html (tout le reste, anciens aperçus compris).
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

/** Les pages de redirection publiées sur GitHub Pages (toutes la même page : elle lit son chemin). */
export const REDIRECTION_PAGES = ["index.html", "jump/index.html", "404.html"];

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

function viteBuild(mode, env = {}) {
  execFileSync("npx", ["tsc", "-p", "apps/portail"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "warn", ...(mode ? ["--mode", mode] : [])], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

/** Assemble le site (portail, /track/, /jump/) ; rend le nombre de niveaux figés vérifiés. */
export function assembleSite(out) {
  for (const part of LAYOUT.slice(1)) if (!existsSync(join(ROOT, part.from, "index.html"))) throw new Error(`${part.from} n'est pas construit : npm run build`);
  viteBuild(null);
  rmSync(out, { recursive: true, force: true });
  for (const part of LAYOUT) {
    const dest = join(out, part.to);
    mkdirSync(dest, { recursive: true });
    cpSync(join(ROOT, part.from), dest, { recursive: true });
  }
  // Les niveaux figés de DailyJump (lot 10) doivent être dans le site publié, identiques : sinon un jour déjà joué changerait de niveau.
  const levels = join(ROOT, "apps/jump/public/levels");
  const files = existsSync(levels) ? readdirSync(levels).filter((f) => f.endsWith(".json")) : [];
  for (const f of files) {
    const got = join(out, "jump/levels", f);
    if (!existsSync(got) || !readFileSync(got).equals(readFileSync(join(levels, f)))) throw new Error(`niveau figé absent ou différent du site : jump/levels/${f}`);
  }
  return files.length;
}

/** Les pages de redirection (GitHub Pages) dans `out`. */
export function buildRedirections(out, { cible, base }) {
  viteBuild("redirection", { CIBLE: cible, ANCIENNE_BASE: base });
  const built = join(ROOT, "apps/portail/dist-redirection");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(built, "assets"), join(out, "assets"), { recursive: true });
  const page = readFileSync(join(built, "redirection.html"));
  for (const p of REDIRECTION_PAGES) {
    mkdirSync(dirname(join(out, p)), { recursive: true });
    writeFileSync(join(out, p), page);
  }
  writeFileSync(join(out, ".nojekyll"), "");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const [cmd, ...argv] = process.argv.slice(2);
  try {
    if (cmd === "site") {
      const out = resolve(option(argv, "--sortie", "site"));
      const n = assembleSite(out);
      console.log(`site assemblé dans ${out} : portail, /track/, /jump/ ; ${n} niveau(x) figé(s) vérifié(s)`);
    } else if (cmd === "firebase") {
      const template = JSON.parse(readFileSync(join(ROOT, "firebase.json"), "utf8"));
      const config = firebaseConfig(template, { site: option(argv, "--site"), service: option(argv, "--service"), region: option(argv, "--region", REGION), publicDir: option(argv, "--public") });
      const out = option(argv, "--sortie", "firebase.deploy.json");
      writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
      console.log(`configuration Firebase : ${out} (site ${config.hosting.site}, /api/** → ${config.hosting.rewrites.find((r) => r.run).run.serviceId})`);
    } else if (cmd === "redirections") {
      const out = resolve(option(argv, "--sortie", "pages"));
      buildRedirections(out, { cible: option(argv, "--cible", "https://playdujour.com"), base: option(argv, "--base", "/DailyTrack/") });
      console.log(`pages de redirection dans ${out} : ${REDIRECTION_PAGES.join(", ")}`);
    } else {
      console.error("usage : node scripts/site.mjs site [--sortie site] · firebase --site <id> --service <svc> · redirections [--sortie pages] [--cible <origine>]");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
