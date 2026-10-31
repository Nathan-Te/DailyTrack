// Le site de playdujour.com (lot R4 de la plateforme) : assemblage et configuration Firebase. (Lot R5 : plus de pages de redirection de
// l'ancienne adresse GitHub Pages.)
// Fonctions pures testées (apps/portail/test/site.test.ts) ; ligne de commande utilisée par .github/workflows/*.yml et les e2e :
//   node scripts/site.mjs site [--sortie site] [--production] [--origine https://…]
//        → construit le portail (apps/portail) et assemble `site/` : portail à la racine, DailyTrack (apps/web/dist) sous /track/, DailyJump
//          (apps/jump/dist) sous /jump/, la page des mentions légales (lot R5) sous /mentions-legales/ ; vérifie que chaque niveau figé (apps/jump/public/levels) est dans le site, identique. Les deux jeux
//          doivent être construits avant (`npm run build`). Lot I1 : la vitrine des composants (`/ui/`) est dans le site de la recette et des
//          aperçus, **jamais en production** : `--production` (deploy-site.yml, cible production) ne la construit pas, et vérifie qu'elle est absente.
//          Lot I6 : les images de partage et les icônes (scripts/images-partage.mjs, rendues par le navigateur de Playwright) sous /partage/, le
//          manifeste (/manifest.webmanifest) et les adresses absolues des aperçus de partage : `__ORIGINE_DU_SITE__` des pages devient l'origine
//          du site déployé (`--origine` : production → toujours https://playdujour.com ; recette → https://recette.playdujour.com par défaut ;
//          un aperçu passe l'adresse de son canal, sinon il montrerait l'image de la production).
//   node scripts/site.mjs firebase --site <identifiant du site> --service <service Cloud Run> [--region europe-west1] [--public site] [--sortie firebase.deploy.json]
//        → la configuration Firebase d'un déploiement : `firebase.json` (en-têtes, renvoi /api/**), avec le site et le service de la cible.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ADRESSES } from "./domaine.mjs";
import { DOSSIER_PARTAGE, produireImages } from "./images-partage.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Où chaque partie du site est servie. */
export const LAYOUT = [
  { from: "apps/portail/dist", to: "" },
  { from: "apps/web/dist", to: "track" },
  { from: "apps/jump/dist", to: "jump" },
];

/**
 * Lot TP (Tower sur la plateforme) : le jeu Tower, sous `/tower/`. Il est publié **partout, production comprise** : Tower naît `off` (la table `jeux`, lot P) et sa page dit « Bientôt » tant que
 * Nathan ne l'a pas passé en aperçu ou en `on` (`interrupteurInit`) ; ses options d'essai sont fermées en production (règle R9, `urlOptions.ts`). **La preuve de l'auteur ne quitte jamais le
 * serveur** : la construction de production de Tower retire le champ `preuve` des jours publiés (`apps/tower/preuves.ts`), et `assembleSite --production` le revérifie (`fichiersAvecPreuveTower`).
 * (Avant le lot TP, la page de démonstration n'était publiée que hors production : `ESSAI_TOWER`.)
 */
export const TOWER_SITE = { from: "apps/tower/dist", to: "tower" };

/** Région des renvois vers Cloud Run (prise en charge par Firebase Hosting, vérifié au lot R4). */
export const REGION = "europe-west1";

const SITE_ID = /^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/;
const SERVICE = /^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * La configuration d'un déploiement : `firebase.json` du dépôt (en-têtes, redirections, renvoi `/api/**`) avec le **site** et le **service
 * Cloud Run** de la cible. Production → `cdj-api`, recette et aperçus → `cdj-api-recette` : le renvoi ne croise jamais les deux.
 */
export function firebaseConfig(template, { site, service, region = REGION, publicDir, noindex = false }) {
  if (!SITE_ID.test(site ?? "")) throw new Error(`site Firebase invalide : « ${site} »`);
  if (!SERVICE.test(service ?? "")) throw new Error(`service Cloud Run invalide : « ${service} »`);
  const hosting = structuredClone(template.hosting);
  if (!hosting || Array.isArray(hosting)) throw new Error("firebase.json : un seul bloc `hosting` attendu");
  const api = (hosting.rewrites ?? []).filter((r) => r.source === "/api/**" && r.run);
  if (api.length !== 1) throw new Error("firebase.json : un seul renvoi /api/** vers Cloud Run attendu");
  for (const r of hosting.rewrites) if (r.run) r.run = { serviceId: service, region };
  // Lot R7 : la recette et les aperçus ne sont jamais indexés (aucun moteur de recherche ne doit montrer des fonctionnalités pas encore sorties).
  if (noindex) hosting.headers = [{ source: "**", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }, ...(hosting.headers ?? [])];
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
  // Lot R8 : la date du lancement est celle de config/lancement.json ; la recette et les aperçus peuvent la déplacer (VITE_LANCEMENT_PREMIER_JOUR), la production jamais.
  if (production && env.VITE_LANCEMENT_PREMIER_JOUR) throw new Error("VITE_LANCEMENT_PREMIER_JOUR est réglée pour une construction de production : la date du lancement est celle de config/lancement.json, jamais une variable.");
  return { ...env, VITE_CONFIG_NATIVE_IGNORE_WARNING: "true", PORTAIL_VITRINE: production ? "0" : "1" };
}

function viteBuild(options) {
  execFileSync("npx", ["tsc", "-p", "apps/portail"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "warn"], { cwd: ROOT, stdio: "inherit", env: portailEnv(options) });
}

/**
 * Lot I4 : les polices de Track sont demandées à `/assets/<nom>-<empreinte>.woff2`, **le même chemin que celles du portail** (un joueur qui vient du portail les
 * a déjà en cache). Lot I5 : celles de Jump aussi. Le nom porte l'empreinte du contenu : le même nom, ce sont les mêmes octets. Pour chaque police que la feuille
 * d'un jeu demande : si le portail l'a (ou un jeu précédent l'y a mise), elle doit être identique (sinon l'assemblage s'arrête) ; sinon elle rejoint `assets/` du
 * portail ; dans les deux cas la copie de `<jeu>/assets/` est retirée (un seul fichier par police sur le site). Rend les polices déjà là et celles ajoutées.
 */
export function partagerPolices(out, jeux = ["track", "jump"]) {
  const communes = [];
  const ajoutees = [];
  for (const jeu of jeux) {
    const assetsJeu = join(out, jeu, "assets");
    const noms = new Set();
    for (const f of existsSync(assetsJeu) ? readdirSync(assetsJeu).filter((x) => x.endsWith(".css")) : []) {
      for (const m of readFileSync(join(assetsJeu, f), "utf8").matchAll(/url\(["']?\/assets\/([^)"']+\.woff2)["']?\)/g)) noms.add(m[1]);
    }
    for (const nom of noms) {
      const source = join(assetsJeu, nom);
      const dest = join(out, "assets", nom);
      if (!existsSync(source)) throw new Error(`police de ${jeu} absente de la construction : ${jeu}/assets/${nom}`);
      if (existsSync(dest)) {
        if (!readFileSync(dest).equals(readFileSync(source))) throw new Error(`police différente de celle du portail sous le même nom : assets/${nom}`);
        if (!communes.includes(nom) && !ajoutees.includes(nom)) communes.push(nom);
      } else {
        mkdirSync(join(out, "assets"), { recursive: true });
        cpSync(source, dest);
        ajoutees.push(nom);
      }
      rmSync(source);
    }
  }
  return { communes, ajoutees };
}

/** Lot I6 : le jeton que les pages portent à la place de l'origine du site (`og:url`, `og:image`), remplacé à l'assemblage. */
export const JETON_ORIGINE = "__ORIGINE_DU_SITE__";

/** Lot I6 : le manifeste « Ajouter à l'écran d'accueil » (`/manifest.webmanifest`). */
export const MANIFESTE = "manifest.webmanifest";

/**
 * L'origine du site à écrire dans les aperçus de partage : la production a toujours `https://playdujour.com` (une autre origine est refusée) ;
 * ailleurs l'origine donnée (canal d'aperçu, recette, local), sinon la recette. Une origine, sans chemin ; `http://` seulement en local.
 */
export function origineDuSite({ production = false, origine } = {}) {
  if (production) {
    if (origine && origine.replace(/\/+$/, "") !== ADRESSES.production) throw new Error(`la production s'annonce sous ${ADRESSES.production}, pas « ${origine} »`);
    return ADRESSES.production;
  }
  const o = (origine ?? ADRESSES.recette).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(o) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) throw new Error(`origine du site invalide : « ${origine} » (https://hôte, sans chemin)`);
  if (o === ADRESSES.production) throw new Error("un site de recette ou d'aperçu ne s'annonce jamais sous l'adresse de la production");
  return o;
}

/** Remplace le jeton d'origine d'une page (pur, testé). */
export function poserOrigine(texte, origine) {
  return texte.split(JETON_ORIGINE).join(origine);
}

/**
 * Le manifeste (pur, testé) : nom « Du Jour », couleurs de la charte (lues dans les jetons de @cdj/ui, jamais écrites ici), icônes 192 et 512
 * produites à la construction, affichage autonome (`standalone` : iOS traite `fullscreen` comme `standalone`), départ au portail. Pas de service worker (lot I6).
 */
export function manifeste(jetonsCss) {
  const jeton = (nom) => {
    const m = new RegExp(`--${nom}:\\s*(#[0-9A-Fa-f]{6})`).exec(jetonsCss);
    if (!m) throw new Error(`jeton absent : --${nom}`);
    return m[1];
  };
  return {
    name: "Du Jour",
    short_name: "Du Jour",
    lang: "fr",
    // Lot 53 : l'identité de l'application (stable si le départ change) ; l'iPhone ouvre la page ajoutée à l'écran d'accueil, `start_url` vaut pour Android et l'ordinateur.
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: jeton("dj-creme"),
    theme_color: jeton("dj-creme"),
    icons: [192, 512].map((t) => ({ src: `/${DOSSIER_PARTAGE}/icone-${t}.png`, sizes: `${t}x${t}`, type: "image/png", purpose: "any" })),
  };
}

/**
 * Lot R7 : les jeux de données de démonstration (`track/demo/`, `jump/demo/`, mode `?api=demo`) ne vont pas en production. Chaque fichier d'un jour
 * à venir y porte la rediffusion « parfaite » du premier — la preuve de l'auteur du niveau que le jeu jouera ce jour-là (constaté le 25/10/2026 :
 * `jump/demo/2026-10-30.json`, acceptée par le serveur le jour J). La démonstration reste dans la recette et les aperçus. Rend les dossiers retirés.
 */
export const DOSSIERS_DEMO = ["track/demo", "jump/demo"];
export function retirerDemos(out) {
  const retires = [];
  for (const d of DOSSIERS_DEMO) {
    if (!existsSync(join(out, d))) continue;
    rmSync(join(out, d), { recursive: true, force: true });
    retires.push(d);
  }
  return retires;
}

/**
 * Lot R9 : **la preuve de l'auteur d'un niveau de Jump ne quitte jamais le serveur.** La renvoyer à `POST /api/jump/submit` donnerait le temps de l'auteur
 * (audit S-08, S-16). La construction de production de Jump (`apps/jump/vite.config.ts`, `VITE_PRODUCTION=1`) retire le champ `preuve` de chaque fichier
 * figé et supprime `outils/` (`?semaine=`) et `demo/` ; ici on **revérifie le site assemblé** : aucun fichier publié ne contient la preuve d'un jour (le texte
 * même, lu dans les fichiers du dépôt), et `jump/outils` n'y est pas. Rend les fichiers fautifs (vide : tout va bien).
 */
export const DOSSIERS_OUTILS = ["jump/outils"];
export function fichiersAvecPreuve(out, niveaux = join(ROOT, "apps/jump/public/levels")) {
  const preuves = existsSync(niveaux)
    ? readdirSync(niveaux)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(join(niveaux, f), "utf8")).preuve)
        .filter((p) => typeof p === "string" && p.length > 0)
    : [];
  const fautifs = [];
  const parcourir = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.(png|jpe?g|woff2?|ico|webp|gif)$/i.test(e.name)) {
        const texte = readFileSync(chemin, "utf8");
        if (preuves.some((p) => texte.includes(p))) fautifs.push(relative(out, chemin));
      }
    }
  };
  parcourir(out);
  for (const d of DOSSIERS_OUTILS) if (existsSync(join(out, d))) fautifs.push(`${d}/`);
  return fautifs;
}

/**
 * Lot TP : **la preuve de l'auteur d'un jour de Tower ne quitte jamais le serveur** (règle R9). Rend les fichiers fautifs du site assemblé : tout fichier qui contient le texte d'une preuve des jours
 * du dépôt (`apps/tower/public/jours/*.json`, `preuve`), ou qui porte un champ `preuve` dans `tower/jours/`, ou un jour publié qui n'est pas celui du dépôt moins sa preuve. Vide : tout va bien.
 */
export function fichiersAvecPreuveTower(out, jours = join(ROOT, "apps/tower/public/jours")) {
  const depot = existsSync(jours) ? readdirSync(jours).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : [];
  const preuves = depot.map((f) => JSON.parse(readFileSync(join(jours, f), "utf8")).preuve).filter((p) => typeof p === "string" && p.length > 0);
  const fautifs = [];
  const parcourir = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (!/\.(png|jpe?g|woff2?|ico|webp|gif|wasm)$/i.test(e.name)) {
        const texte = readFileSync(chemin, "utf8");
        if (preuves.some((p) => texte.includes(p))) fautifs.push(relative(out, chemin));
      }
    }
  };
  parcourir(out);
  const publies = join(out, TOWER_SITE.to, "jours");
  for (const f of depot) {
    const publie = join(publies, f);
    if (!existsSync(publie)) {
      fautifs.push(`${TOWER_SITE.to}/jours/${f} (absent)`);
      continue;
    }
    const attendu = JSON.parse(readFileSync(join(jours, f), "utf8"));
    delete attendu.preuve;
    const lu = JSON.parse(readFileSync(publie, "utf8"));
    if ("preuve" in lu || JSON.stringify(lu) !== JSON.stringify(attendu)) fautifs.push(`${TOWER_SITE.to}/jours/${f}`);
  }
  return [...new Set(fautifs)];
}

/** Lot R7 : le `robots.txt` du site. Production : tout est permis ; recette et aperçus : rien (en plus de l'en-tête `X-Robots-Tag` de Hosting). */
export function robots({ production = false } = {}) {
  return production ? "User-agent: *\nAllow: /\n" : "# Recette ou aperçu de PR : rien à indexer.\nUser-agent: *\nDisallow: /\n";
}

/** Lot R9 : le texte d'un fichier figé sans son champ `preuve` (le reste inchangé, même ordre des champs, même fin de ligne : `frozenJson`). */
export function sansPreuve(texte) {
  const { preuve: _preuve, ...publie } = JSON.parse(texte);
  return `${JSON.stringify(publie)}\n`;
}

/** Les pages HTML d'un dossier (récursif). */
function pagesHtml(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pagesHtml(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : []));
}

/**
 * Assemble le site (portail, /track/, /jump/) ; rend le nombre de niveaux figés vérifiés et les images de partage. `production` : sans la vitrine
 * `/ui/`. `origine` (lot I6) : celle du site déployé, pour les adresses absolues des aperçus de partage.
 */
export async function assembleSite(out, { production = false, origine } = {}) {
  const origineSite = origineDuSite({ production, origine });
  for (const part of [...LAYOUT.slice(1), TOWER_SITE]) if (!existsSync(join(ROOT, part.from, "index.html"))) throw new Error(`${part.from} n'est pas construit : npm run build`);
  viteBuild({ production });
  rmSync(out, { recursive: true, force: true });
  for (const part of LAYOUT) {
    const dest = join(out, part.to);
    mkdirSync(dest, { recursive: true });
    cpSync(join(ROOT, part.from), dest, { recursive: true });
  }
  cpSync(join(ROOT, TOWER_SITE.from), join(out, TOWER_SITE.to), { recursive: true });
  partagerPolices(out); // lots I4 et I5 : les polices de Track et de Jump sont celles du portail (Tower garde les siennes : lot I1)
  // Les niveaux figés de DailyJump (lot 10) doivent être dans le site publié, identiques : sinon un jour déjà joué changerait de niveau.
  const levels = join(ROOT, "apps/jump/public/levels");
  const files = existsSync(levels) ? readdirSync(levels).filter((f) => f.endsWith(".json")) : [];
  for (const f of files) {
    const got = join(out, "jump/levels", f);
    if (!existsSync(got)) throw new Error(`niveau figé absent ou différent du site : jump/levels/${f}`);
    // Lot R9 : la production publie le fichier sans sa `preuve` (le reste, octet pour octet) ; ailleurs il est identique au dépôt.
    const attendu = production ? sansPreuve(readFileSync(join(levels, f), "utf8")) : readFileSync(join(levels, f), "utf8");
    if (readFileSync(got, "utf8") !== attendu) throw new Error(`niveau figé absent ou différent du site : jump/levels/${f}`);
  }
  // Lot I1 : la vitrine n'est jamais publiée en production ; ailleurs elle doit y être.
  const vitrine = existsSync(join(out, VITRINE, "index.html"));
  if (production) {
    retirerDemos(out);
    // Lot R9 : la preuve de l'auteur et les outils de Jump ne sont jamais publiés (ils sont retirés à la construction de Jump ; ici on le vérifie).
    const fautifs = fichiersAvecPreuve(out, levels);
    if (fautifs.length > 0) throw new Error(`le site de production publierait la preuve de l'auteur ou les outils de Jump : ${fautifs.join(", ")}`);
    // Lot TP : de même pour les jours de Tower (la construction de production de Tower retire la preuve ; ici on le revérifie).
    const fautifsTower = fichiersAvecPreuveTower(out);
    if (fautifsTower.length > 0) throw new Error(`le site de production publierait la preuve de l'auteur d'un jour de Tower : ${fautifsTower.join(", ")}`);
  }
  if (production && vitrine) throw new Error(`la vitrine /${VITRINE}/ ne doit pas être dans le site de production`);
  if (!production && !vitrine) throw new Error(`vitrine /${VITRINE}/ absente du site`);
  // Lot I6 : images de partage et icônes (produites ici), manifeste, adresses absolues ; la page 404 à la racine (servie par Hosting).
  const images = await produireImages(join(out, DOSSIER_PARTAGE));
  writeFileSync(join(out, MANIFESTE), JSON.stringify(manifeste(readFileSync(join(ROOT, "packages/ui/src/jetons.css"), "utf8")), null, 2) + "\n");
  for (const f of pagesHtml(out)) {
    const html = readFileSync(f, "utf8");
    if (html.includes(JETON_ORIGINE)) writeFileSync(f, poserOrigine(html, origineSite));
  }
  if (!existsSync(join(out, "404.html"))) throw new Error("page 404 absente du site (apps/portail/404.html)");
  // Lot R7 : la production s'indexe (le portail et les jeux) ; la recette et les aperçus s'interdisent à tous les robots.
  writeFileSync(join(out, "robots.txt"), robots({ production }));
  return { niveaux: files.length, images, origine: origineSite };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const [cmd, ...argv] = process.argv.slice(2);
  try {
    if (cmd === "site") {
      const out = resolve(option(argv, "--sortie", "site"));
      const production = argv.includes("--production");
      const { niveaux, images, origine } = await assembleSite(out, { production, origine: option(argv, "--origine") });
      console.log(`site assemblé dans ${out} : portail, /track/, /jump/, /tower/${production ? " (production : sans la vitrine /ui/)" : ", vitrine /ui/"} ; ${niveaux} niveau(x) figé(s) vérifié(s)`);
      console.log(`aperçus de partage : ${origine} ; images ${images.map((i) => `${i.nom}.png ${(i.octets / 1024).toFixed(1)} ko`).join(", ")}`);
    } else if (cmd === "firebase") {
      const template = JSON.parse(readFileSync(join(ROOT, "firebase.json"), "utf8"));
      const config = firebaseConfig(template, { site: option(argv, "--site"), service: option(argv, "--service"), region: option(argv, "--region", REGION), publicDir: option(argv, "--public"), noindex: argv.includes("--noindex") });
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
