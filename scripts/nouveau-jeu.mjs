// Lot K4g (plateforme) — **`npm run nouveau-jeu -- --id <id>`** : crée un jeu neuf à partir de « Cibles » (le modèle, `docs/cibles/consignes.md`) : il copie ses fichiers, les renomme, écrit la fiche, les entrées
// mécaniques des fichiers partagés (lignes AJOUTÉES seulement), les trois documents du jeu (`docs/<id>/` : seed, consignes, passation), puis lance `npm run fiches`, le golden du jeu et `npm run traductions`.
//
//   npm run nouveau-jeu -- --id <id> [--nom "<Nom>"] [--classement score|temps] [--categorie jour|arcade] [--a-blanc]
//   npm run nouveau-jeu -- --id <id> --passation          → réécrit seulement `docs/<id>/passation.md` d'un jeu qui existe (la tenir à jour depuis les CLAUDE.md)
//   --detail             → avec --a-blanc, un fichier par ligne ; --racine <dossier> → un autre arbre de sources (la copie du dépôt du job « Kit de bout en bout ») ; --sans-commandes : n'écrit que les fichiers (tests).
//
// **Le modèle fait foi** : tout ce qui est propre au jeu de départ est dans « Cibles » ; le générateur ne contient aucun fichier de jeu, seulement des règles de renommage et les lignes à ajouter. Une amélioration du
// modèle passe par « Cibles », jamais par ce script. La variante de classement (`score` ou `temps`) est rangée dans UN fichier du modèle, `packages/cibles-sim/src/variante.ts` : le générateur y change une ligne.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RACINE_DEPOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Le jeu qui sert de modèle. */
export const MODELE = "cibles";

/** Les fichiers partagés dont le générateur AJOUTE des lignes (jamais d'autre modification) : le job de bout en bout les admet, à condition qu'il n'y ait aucune ligne retirée. */
export const ENTREES_MECANIQUES = [
  "apps/api/Dockerfile",
  "apps/api/package.json",
  "apps/api/tsconfig.json",
  "tsconfig.json",
  "package-lock.json",
  "packages/ui/src/catalogue.ts",
  "packages/ui/src/catalogue.en.ts",
  "apps/portail/src/catalogue.ts",
  "docs/plateforme/budgets.md",
  "CLAUDE.md", // lot « manques de Blocks » : la ligne du jeu dans la carte du dépôt
];
/** Les fichiers que `npm run fiches` et `npm run traductions` écrivent (générés : jamais à la main). */
export const FICHIERS_GENERES = [/\.generated\.[a-z]+$/, /^config\/jeux\/projections\//, /^docs\/plateforme\/traductions\.md$/];

/** Des teintes d'étiquette (fond clair, coque foncée) : le générateur prend la première qu'aucune fiche n'utilise ; **Nathan choisit la sienne** (charte § 3). */
export const TEINTES = [
  ["#B8D8F4", "#1F4E79"],
  ["#D9C4F0", "#4B2E83"],
  ["#F7C59F", "#8A3B12"],
  ["#C7E9A8", "#3F6B1E"],
  ["#F2E394", "#6B5B10"],
  ["#A6E3E0", "#17625E"],
  ["#F4B6A6", "#7A2A1B"],
  ["#D6D6D6", "#444444"],
];
/** Les paquets communs que TOUT jeu neuf déclare d'office (lot B1) : « Cibles » n'en a pas l'usage, un jeu qui reprend les blocs de Tower (`@cdj/visuels`) ne doit pas attendre un lot de la plateforme pour le déclarer (`package-lock.json` est hors des zones d'un jeu). */
export const DEPENDANCES_COMMUNES = ["@cdj/visuels"];
const IGNORES = new Set(["node_modules", "dist", "dist-types", "test-results", "playwright-report", "blob-report", ".cache"]);
const THEMES_MODELE = { sable: "clair", ardoise: "sombre" };
const THEMES_FR = { clair: "Clair", sombre: "Sombre" };
const THEMES_EN = { clair: "Light", sombre: "Dark" };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lire = (racine, chemin) => readFileSync(join(racine, chemin), "utf8");
const json = (o) => JSON.stringify(o, null, 2) + "\n";
const collateur = new Intl.Collator("en");
const triee = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => collateur.compare(a, b)));

// --- Les options et l'identifiant ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function lireOptions(argv) {
  const valeur = (nom) => {
    const i = argv.indexOf(nom);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const o = {
    id: valeur("--id"),
    nom: valeur("--nom"),
    classement: valeur("--classement") ?? "score",
    categorie: valeur("--categorie") ?? "jour",
    aBlanc: argv.includes("--a-blanc"),
    passation: argv.includes("--passation"),
    sansCommandes: argv.includes("--sans-commandes"),
    detail: argv.includes("--detail"),
    racine: resolve(valeur("--racine") ?? RACINE_DEPOT),
  };
  if (!o.id) throw new Error("--id <id> est obligatoire (minuscules et chiffres, 3 à 20 caractères)");
  if (!["score", "temps"].includes(o.classement)) throw new Error(`--classement : « score » ou « temps » (reçu « ${o.classement} »)`);
  if (!["jour", "arcade"].includes(o.categorie)) throw new Error(`--categorie : « jour » ou « arcade » (reçu « ${o.categorie} ») — lot A3 : un jeu d'arcade a son classement mais ne compte ni dans la journée ni dans le cumul`);
  o.nom = o.nom ?? cap(o.id);
  return o;
}

/** Un identifiant sert de dossier, de préfixe de stockage, de code de route ET de nom dans le code : minuscules et chiffres seulement (pas de tiret). Refuse celui d'un jeu ou d'un paquet qui existe déjà. */
export function verifierId(id, racine, { passation = false } = {}) {
  if (!/^[a-z][a-z0-9]{2,19}$/.test(id)) throw new Error(`id « ${id} » refusé : minuscules et chiffres seulement, 3 à 20 caractères, une lettre en premier (l'identifiant est aussi un nom dans le code : pas de tiret)`);
  const reserves = new Set(["web", "api", "ui", "core", "kit", "sim", "clock", "profile", "musique", "portail", "admin", "config", "docs", "node", "test", "demo", "legal", "partage", "assets", "jours", "levels"]);
  if (reserves.has(id)) throw new Error(`id « ${id} » refusé : nom réservé`);
  if (passation) {
    if (!existsSync(join(racine, "config/jeux", `${id}.json`))) throw new Error(`--passation : le jeu « ${id} » n'existe pas (config/jeux/${id}.json)`);
    return;
  }
  const existe = [`config/jeux/${id}.json`, `apps/${id}`, `packages/${id}-sim`, `docs/${id}`, `apps/api/src/${id}.ts`].filter((c) => existsSync(join(racine, c)));
  if (existe.length > 0) throw new Error(`id « ${id} » refusé : existe déjà (${existe.join(", ")}) — le générateur ne réécrit jamais un jeu`);
  if (id === MODELE) throw new Error(`id « ${id} » refusé : c'est le modèle`);
}

// --- Le modèle : les fichiers de « Cibles » -----------------------------------------------------------------------------------------------------------------------------------------------------------
function marcher(racine, dossier, sortie) {
  const complet = join(racine, dossier);
  if (!existsSync(complet)) return;
  for (const e of readdirSync(complet, { withFileTypes: true })) {
    if (IGNORES.has(e.name)) continue;
    const chemin = `${dossier}/${e.name}`;
    if (e.isDirectory()) marcher(racine, chemin, sortie);
    else if (e.isFile()) sortie.push(chemin);
  }
}
/** Les fichiers de « Cibles » que le jeu neuf copie (hors documents, outils de capture, jours figés, fichiers construits). */
export function fichiersDuModele(racine) {
  const tous = [];
  marcher(racine, `apps/${MODELE}`, tous);
  marcher(racine, `packages/${MODELE}-sim`, tous);
  for (const [dossier, motif] of [
    ["apps/api/src", new RegExp(`^${MODELE}[^/]*\\.ts$`)],
    ["apps/api/test", new RegExp(`^${MODELE}[^/]*\\.test\\.ts$`)],
    ["apps/api/scripts", new RegExp(`^${MODELE}-[^/]*\\.ts$`)],
  ]) {
    if (!existsSync(join(racine, dossier))) continue;
    for (const f of readdirSync(join(racine, dossier))) if (motif.test(f)) tous.push(`${dossier}/${f}`);
  }
  return tous
    // Lot K5 : l'illustration du modèle (une cible) n'est pas celle du jeu neuf — son fichier est à dessiner d'après une maquette validée par Nathan (`identite.illustration`).
    .filter((c) => !/\.tsbuildinfo$/.test(c) && !/\/e2e\/captures-/.test(c) && !(c.includes("/public/jours/") && !c.endsWith("/.gitkeep")) && !c.endsWith("/public/illustration.svg"))
    .sort();
}

// --- Le renommage ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function contexte(opts, racine) {
  const { id, nom } = opts;
  let h = 0x811c9dc5;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return {
    id,
    nom,
    ident: cap(id),
    majuscules: id.toUpperCase(),
    sel: `0x${(h & 0xffffff).toString(16).padStart(6, "0")}`,
    ports: portsLibres(racine),
  };
}
/** Les ports d'un jeu neuf (aperçu du site et serveur d'essai) : les plus petits qu'aucun fichier de test ou de configuration ne cite déjà. */
export function portsLibres(racine) {
  const fichiers = [];
  for (const d of readdirSync(join(racine, "apps"), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of ["playwright.config.ts", "vite.config.ts", "package.json"]) if (existsSync(join(racine, "apps", d.name, f))) fichiers.push(`apps/${d.name}/${f}`);
    marcher(racine, `apps/${d.name}/e2e`, fichiers);
  }
  marcher(racine, "apps/api/scripts", fichiers);
  const cites = new Set();
  // Un port, c'est un nombre cité comme tel : `--port 4176`, `port: 8790`, `PORT = "8793"`, `localhost:4176`, `127.0.0.1:8793`.
  const motif = /(?:--port[ =]|\bport["']?\s*[:=,]?\s*["']?|\bPORT\b["']?\s*[:=,?]*\s*["']?|localhost:|127\.0\.0\.1:|http:\/\/[a-z0-9.-]+:)(4[0-9]{3}|8[0-9]{3})\b/gi;
  for (const f of fichiers) if (/\.(ts|json|mjs)$/.test(f)) for (const m of lire(racine, f).matchAll(motif)) cites.add(Number(m[1]));
  const premier = (depart) => {
    let p = depart;
    while (cites.has(p)) p++;
    return p;
  };
  return { site: premier(4177), serveur: premier(8794) };
}

/** Le texte d'un fichier du modèle, devenu celui du jeu neuf. */
export function renommer(texte, c) {
  return texte
    .replaceAll("« Cibles »", `« ${c.nom} »`)
    .replaceAll("CIBLES", c.majuscules)
    .replaceAll("Cibles", c.ident)
    .replaceAll("cibles", c.id)
    .replace(/\bsable\b/g, THEMES_MODELE.sable)
    .replace(/\bardoise\b/g, THEMES_MODELE.ardoise)
    .replaceAll("0xc1b1e5", c.sel)
    .replaceAll("4176", String(c.ports.site))
    .replaceAll("8793", String(c.ports.serveur));
}
const cheminRenomme = (chemin, c) => chemin.replaceAll("cibles", c.id);

/** Les textes visibles du jeu de départ ne gardent rien de « Cibles » : nom, phrases, aide, plateau — « à remplacer ». */
export function genericiserCatalogue(texte, c, langue) {
  const themes = Object.values(THEMES_MODELE);
  const aide = langue === "fr" ? ["le but du jeu en une phrase", "ce que fait le joueur, en une phrase", "comment les égalités se départagent"] : ["the goal of the game in one sentence", "what the player does, in one sentence", "how ties are broken"];
  const valeurs = {
    "page.titre": `${c.nom} — Du Jour`,
    "scene.aria": langue === "fr" ? "Plateau de jeu (texte à remplacer)" : "Game board (text to replace)",
  };
  for (const t of themes) {
    valeurs[`theme.${t}`] = langue === "fr" ? `${THEMES_FR[t]} (à remplacer)` : `${THEMES_EN[t]} (to replace)`;
    valeurs[`accueil.phrase.${t}`] = langue === "fr" ? `À remplacer : une phrase d'accroche pour le thème « ${THEMES_FR[t]} ».` : `To replace: a tagline for the “${THEMES_EN[t]}” theme.`;
  }
  aide.forEach((a, i) => (valeurs[`aide.point${i + 1}`] = langue === "fr" ? `À remplacer : ${a}.` : `To replace: ${a}.`));
  return texte.replace(/^(\s*)"([^"]+)": "(?:[^"\\]|\\.)*"(,?)$/gm, (ligne, indent, cle, virgule) => (cle in valeurs ? `${indent}"${cle}": ${JSON.stringify(valeurs[cle])}${virgule}` : ligne));
}

/** Insère, après chaque suite de lignes qui répondent à `test`, ces lignes transformées. Rend `{ texte, ajouts }`. */
export function cloner(texte, test, transformer) {
  const lignes = texte.split("\n");
  const sortie = [];
  let ajouts = 0;
  let rang = 0;
  for (let i = 0; i < lignes.length; ) {
    if (!test(lignes[i])) {
      sortie.push(lignes[i++]);
      continue;
    }
    const debut = i;
    while (i < lignes.length && test(lignes[i])) sortie.push(lignes[i++]);
    const clones = transformer(lignes.slice(debut, i), rang++);
    sortie.push(...clones);
    ajouts += clones.length;
  }
  return { texte: sortie.join("\n"), ajouts };
}

// --- La fiche ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function lireVariantes(racine) {
  // `variante.ts` est le seul endroit qui sait ce que chaque variante demande à la fiche : on la compile (esbuild) et on la lit, sans copie de ses chiffres ici.
  const { buildSync } = await import("esbuild");
  const sortie = buildSync({ entryPoints: [join(racine, `packages/${MODELE}-sim/src/variante.ts`)], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
  const dossier = mkdtempSync(join(tmpdir(), "cdj-variantes-"));
  try {
    const f = join(dossier, "variante.mjs");
    writeFileSync(f, sortie.outputFiles[0].text);
    return (await import(pathToFileURL(f).href)).VARIANTES;
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
export function fichesExistantes(racine) {
  const dossier = join(racine, "config/jeux");
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(lire(racine, `config/jeux/${f}`)));
}
export function choisirTeinte(fiches) {
  const utilisees = new Set(fiches.flatMap((f) => [f.etiquette.fond.toUpperCase(), f.etiquette.coque.toUpperCase()]));
  const t = TEINTES.find(([fond, coque]) => !utilisees.has(fond.toUpperCase()) && !utilisees.has(coque.toUpperCase()));
  if (!t) throw new Error("plus aucune teinte libre dans TEINTES (scripts/nouveau-jeu.mjs) : en ajouter une");
  return t;
}
export async function construireFiche(racine, c, classement, categorie = "jour") {
  const fiches = fichesExistantes(racine);
  const modele = JSON.parse(renommer(lire(racine, `config/jeux/${MODELE}.json`), c));
  const variantes = await lireVariantes(racine);
  const v = variantes[classement].fiche;
  const [fond, coque] = choisirTeinte(fiches);
  modele.nom = { fr: c.nom, en: c.nom };
  modele.ordre = Math.max(...fiches.map((f) => f.ordre)) + 1;
  modele.etiquette = { ...modele.etiquette, fond, coque };
  modele.classement = {
    colonnes: [...v.colonnes, { nom: "submitted_at", sens: "asc" }, { nom: "player_id", sens: "asc" }],
    cumul: false,
    unite: v.unite,
    format: v.format,
  };
  modele.medailles = { methode: modele.medailles.methode, bareme: [...v.bareme], ...(v.plafondDiamant !== undefined ? { plafondDiamant: v.plafondDiamant } : {}) };
  modele.temoin = false;
  modele.etatDepart = "off";
  // Lot K5 : l'identité (police, motif, illustration) est à choisir d'après une maquette validée par Nathan ; tant qu'un champ vaut « à choisir », le jeu ne passe ni en `preview` ni en `on` (`etatPermis`, test des fiches, administration).
  modele.identite = { police: "à choisir", motif: "à choisir", illustration: "à choisir", aujourdhui: false };
  // Lot A3 : la catégorie se choisit à la création (`jour` par défaut) ; elle naît avec le jeu, sans `categorieDepuis`. Un jeu d'arcade a `classement.cumul: false` (déjà le cas de tout jeu neuf).
  modele.categorie = categorie;
  delete modele.categorieDepuis;
  return { fiche: modele, teinte: [fond, coque] };
}

// --- Les entrées mécaniques ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
function editerLignes(racine, chemin, c, fn) {
  const avant = lire(racine, chemin);
  const { texte, ajouts } = fn(avant);
  if (ajouts === 0) throw new Error(`${chemin} : aucune ligne du modèle « ${MODELE} » à cloner (le modèle a changé ? le générateur doit suivre)`);
  return { chemin, avant, apres: texte, ajouts };
}
export function entreesMecaniques(racine, c) {
  const est = (l) => /cibles/i.test(l);
  const ed = [];
  ed.push(
    editerLignes(racine, "apps/api/Dockerfile", c, (t) =>
      cloner(t, est, (run, rang) => [
        rang === 0 ? `# ${c.nom} (généré par \`npm run nouveau-jeu\`) : le verrou liste l'espace de travail du jeu.` : `# ${c.nom} : sa simulation (le serveur rejoue ses parties) et ses jours figés.`,
        ...run.filter((l) => !l.startsWith("#")).map((l) => renommer(l, c)),
      ]),
    ),
  );
  ed.push(editerLignes(racine, "apps/api/package.json", c, (t) => cloner(t, (l) => l.includes('"@cdj/cibles-sim"'), (run) => run.map((l) => renommer(l, c)))));
  ed.push(editerLignes(racine, "apps/api/tsconfig.json", c, (t) => ({ texte: t.replace('{ "path": "../../packages/cibles-sim" }', `{ "path": "../../packages/cibles-sim" }, { "path": "../../packages/${c.id}-sim" }`), ajouts: 1 })));
  ed.push(
    editerLignes(racine, "tsconfig.json", c, (t) => {
      const j = JSON.parse(t);
      const refs = [];
      for (const r of j.references) {
        refs.push(r);
        if (r.path === `packages/${MODELE}-sim`) refs.push({ path: `packages/${c.id}-sim` });
        if (r.path === `apps/${MODELE}`) refs.push({ path: `apps/${c.id}` });
      }
      j.references = refs;
      return { texte: json(j), ajouts: 2 };
    }),
  );
  ed.push(
    editerLignes(racine, "package-lock.json", c, (t) => {
      const j = JSON.parse(t);
      const p = j.packages;
      const clone = (o) => JSON.parse(renommer(JSON.stringify(o), c));
      p[`apps/${c.id}`] = { ...clone(p[`apps/${MODELE}`]), dependencies: triee({ ...clone(p[`apps/${MODELE}`]).dependencies, ...Object.fromEntries(DEPENDANCES_COMMUNES.map((d) => [d, "*"])) }) };
      p[`packages/${c.id}-sim`] = clone(p[`packages/${MODELE}-sim`]);
      p[`node_modules/@cdj/${c.id}`] = clone(p[`node_modules/@cdj/${MODELE}`]);
      p[`node_modules/@cdj/${c.id}-sim`] = clone(p[`node_modules/@cdj/${MODELE}-sim`]);
      p["apps/api"].dependencies = triee({ ...p["apps/api"].dependencies, [`@cdj/${c.id}-sim`]: "*" });
      j.packages = Object.fromEntries(Object.entries(p).sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : collateur.compare(a, b))));
      return { texte: json(j), ajouts: 4 };
    }),
  );
  ed.push(
    editerLignes(racine, "packages/ui/src/catalogue.ts", c, (t) => cloner(t, (l) => l.includes('"jeu.cibles.nom"'), (run) => run.map(() => `  "jeu.${c.id}.nom": ${JSON.stringify(c.nom)},`))),
    editerLignes(racine, "packages/ui/src/catalogue.en.ts", c, (t) => cloner(t, (l) => l.includes('"jeu.cibles.nom"'), (run) => run.map(() => `  "jeu.${c.id}.nom": ${JSON.stringify(c.nom)},`))),
  );
  // Le catalogue du portail réunit les deux langues dans un fichier : la 1ʳᵉ occurrence de chaque clé du modèle est le français, la 2ᵉ l'anglais.
  const vus = {};
  ed.push(
    editerLignes(racine, "apps/portail/src/catalogue.ts", c, (t) =>
      cloner(t, (l) => /"portail\.(cibles\.accroche|theme\.cibles\.[a-z]+)"/.test(l), (run) =>
        run.map((l) => {
          const cle = /"(portail\.[^"]+)"/.exec(l)[1];
          const langue = (vus[cle] = (vus[cle] ?? 0) + 1) === 1 ? "fr" : "en";
          const nouvelle = renommer(cle, c);
          const theme = cle.startsWith("portail.theme.") ? nouvelle.split(".").pop() : null;
          const valeur = theme ? (langue === "fr" ? `${THEMES_FR[theme]} (à remplacer)` : `${THEMES_EN[theme]} (to replace)`) : langue === "fr" ? `À remplacer : l'accroche de ${c.nom}.` : `To replace: the tagline of ${c.nom}.`;
          return `  ${JSON.stringify(nouvelle)}: ${JSON.stringify(valeur)},`;
        }),
      ),
    ),
  );
  // Lot « manques de Blocks » : la carte du dépôt du `CLAUDE.md` racine gagne la ligne du jeu (avant celle du jeu témoin), au lieu de l'attendre d'un lot de la plateforme.
  ed.push(
    editerLignes(racine, "CLAUDE.md", c, (t) => {
      const modele = t.split("\n").find((l) => l.startsWith(`| \`packages/${MODELE}-sim\` · \`apps/${MODELE}\``));
      if (!modele) throw new Error("CLAUDE.md : la ligne du jeu témoin n'est plus dans la carte du dépôt, le générateur doit suivre");
      const ligne = `| \`packages/${c.id}-sim\` · \`apps/${c.id}\` | simulation ; le jeu — jeu neuf, branché sur la plateforme par le kit (\`brancherJeu\`), \`off\` jusqu'à ce que Nathan le publie | ${c.nom} | index \`docs/${c.id}/consignes.md\` |`;
      return { texte: t.replace(modele, `${ligne}\n${modele}`), ajouts: 1 };
    }),
    editerLignes(racine, "docs/plateforme/budgets.md", c, (t) =>
      cloner(t, (l) => l.startsWith(`| \`${MODELE}.jsCss\``), (run) =>
        run.map((l) => {
          const cases = l.split("|");
          cases[1] = ` \`${c.id}.jsCss\` `;
          cases[2] = ` ${c.nom} `;
          cases[3] = ` JS + CSS du premier chargement de la page du jeu = l'accueil seul (le kit, le socle, l'identité, la file d'envoi, le catalogue français ; la partie, le classement, les Réglages, les retours et la version à la demande) ; généré par \`npm run nouveau-jeu\`, plafond de la ligne du modèle (à fixer par Nathan avec la mesure du jeu) `;
          return cases.join("|");
        }),
      ),
    ),
  );
  return ed;
}

// --- Les documents du jeu --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function section(texte, titre) {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => l.replace(/^#+\s*/, "").startsWith(titre) && l.startsWith("#"));
  if (debut < 0) return [];
  const niveau = /^#+/.exec(lignes[debut])[0].length;
  const corps = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const m = /^(#+)\s/.exec(lignes[i]);
    if (m && m[1].length <= niveau) break;
    corps.push(lignes[i]);
  }
  return corps;
}
/** Les puces de premier niveau d'une section, chacune réduite à ses `max` premiers caractères (coupés à la fin d'une phrase quand c'est possible). */
export function resume(texte, titre, max = 330) {
  const puces = [];
  for (const l of section(texte, titre)) {
    if (l.startsWith("- ")) puces.push(l);
    else if (/^\s+\S/.test(l) && puces.length > 0) continue;
  }
  return puces.map((p) => {
    if (p.length <= max) return p;
    const coupe = p.slice(0, max);
    const fin = Math.max(coupe.lastIndexOf(". "), coupe.lastIndexOf(" ; "));
    return `${fin > 120 ? coupe.slice(0, fin + 1) : coupe.replace(/\s+\S*$/, "")} […]`;
  });
}

/** Les intitulés (le gras de tête) des puces d'une section : de quoi nommer les règles sans les recopier. */
export function intitulesDesRegles(texte, titre) {
  const sortie = [];
  for (const l of section(texte, titre)) {
    const m = /^- \*\*([^*]+)\*\*/.exec(l);
    if (m && !/^Règles communes/.test(m[1])) sortie.push(m[1].replace(/\s*[:—-]\s*$/, "").trim());
  }
  return sortie;
}

/**
 * Lot B1 — où en est le jeu, lu sur le dépôt : **squelette** tant que ses catalogues portent encore les textes « À remplacer » du générateur, **seed vide** tant que `docs/<id>/seed.md` est le gabarit
 * (« À écrire par Nathan »). Un jeu qui n'existe pas encore (plan à blanc) est l'un et l'autre. La passation d'un jeu qui a dépassé son squelette ne dit plus « squelette » et ne nomme plus le modèle.
 */
export function etatDuJeu(racine, id) {
  const lireSi = (chemin) => (existsSync(join(racine, chemin)) ? lire(racine, chemin) : null);
  const catalogue = lireSi(`apps/${id}/src/catalogue.fr.ts`);
  const seed = lireSi(`docs/${id}/seed.md`);
  return { squelette: catalogue === null || /À remplacer/.test(catalogue), seedVide: seed === null || /\*\*À écrire par Nathan\.\*\*/.test(seed) };
}

export function construirePassation(racine, fiche, { classement, teinte, aDefinir = true }) {
  // Lot T1 : la passation RENVOIE aux consignes au lieu de les résumer (elle faisait 22 Ko, et se périmait à chaque changement d'une règle). Elle ne garde
  // que ce qui est propre à ce jeu (état, fiche, zones) et la liste des intitulés des règles communes, lue dans le CLAUDE.md racine.
  const claude = lire(racine, "CLAUDE.md");
  const id = fiche.id;
  const nom = fiche.nom.fr;
  const { squelette, seedVide } = etatDuJeu(racine, id);
  const autres = fichesExistantes(racine).filter((f) => f.id !== id);
  const tableauJeux = autres.map((f) => `- **${f.nom.fr}** (\`${f.id}\`) — classement : ${f.classement.colonnes[0].nom} ${f.classement.colonnes[0].sens === "desc" ? "↓" : "↑"}${f.temoin ? " — jeu témoin, jamais en production" : ""}`);
  const intitules = intitulesDesRegles(claude, "Règles communes à tous les lots");
  const lignes = [
    `# Passation — ${nom} (\`${id}\`)`,
    "",
    `> **À coller telle quelle** dans une nouvelle conversation d'orchestration du jeu, avec le seed (\`docs/${id}/seed.md\`). Générée par \`npm run nouveau-jeu\` à partir des \`CLAUDE.md\` du dépôt : **ne pas la retoucher à la main** ; pour la mettre à jour après un changement des règles de la plateforme : \`npm run nouveau-jeu -- --id ${id} --passation\`.`,
    "",
    "## 1. Où en est ce jeu",
    `- **${nom}** (\`${id}\`) est un jeu de la plateforme **Du Jour** (un niveau par jour, identique pour tous, classement validé par rediffusion côté serveur). ${squelette ? "Il vient d'être créé par le générateur : l'état" : "L'état de départ"} est \`off\` (absent de l'accueil, la page dit « Bientôt »), **Nathan le publie depuis \`/admin/\` › Jeux : \`off\` → \`preview\` → \`on\`**.`,
    ...(squelette
      ? [`- **Le jeu de départ est un squelette** : « toucher des cibles » (${classement === "temps" ? "classé au temps croissant : toucher les 20 cibles le plus vite possible" : "classé au score décroissant : les cibles touchées en 30 secondes"}), copié du jeu témoin « Cibles ». Il est jouable, classé et rejoué par le serveur, avec tous les écrans de la plateforme ; **sa simulation, son rendu et ses textes sont à remplacer** par ceux du vrai jeu. Son vocabulaire (« ${id} » pour des cibles dans le code) n'est pas à garder.`]
      : [`- **Le jeu a dépassé son squelette** : sa simulation, son rendu et ses textes sont ceux de ${nom}. L'état exact (ce qui est fait, ce qui reste, les décisions à relire) est dans \`docs/${id}/consignes.md\`, \`apps/${id}/CLAUDE.md\` et les README de \`docs/${id}/lots/\` ; **cette passation ne le résume pas**.`]),
    `- **Classement** : ${fiche.classement.colonnes.slice(0, -2).map((k) => `\`${k.nom}\` ${k.sens === "desc" ? "↓" : "↑"}`).join(", ")} (fiche \`config/jeux/${id}.json\`). Variante de départ : \`${classement}\` (\`packages/${id}-sim/src/variante.ts\` : tout ce qui dépend du sens du classement y est rangé).`,
    `- **Catégorie** : \`${fiche.categorie}\` (fiche, lot A3)${fiche.categorie === "arcade" ? " — un jeu d'arcade a son niveau du jour et son classement, mais ne compte ni dans la journée (journée parfaite, série, ligne de partage), ni dans le classement cumulé ; il a sa section « Arcade » sur l'accueil et ses onglets après le séparateur « Arcade » de /classement/" : " — il compte dans la journée (journée parfaite, série, ligne de partage) ; son classement n'entre au cumul que si Nathan le décide"}.`,
    seedVide
      ? `- **Vision** : \`docs/${id}/seed.md\` — **à écrire par Nathan** (un gabarit vide avec ses titres). Tant qu'il est vide, le jeu de départ n'a pas de direction.`
      : `- **Vision** : \`docs/${id}/seed.md\` (**ne pas modifier**, c'est Nathan qui le fait).`,
    `- **Teinte de l'étiquette** : ${teinte[0]} / ${teinte[1]} — **à choisir par Nathan** (charte § 3 ; la fiche, \`etiquette\`)${squelette ? " ; le générateur a pris la première teinte qu'aucun jeu n'utilise" : ""}.`,
    `- **Identité** : \`identite\` de la fiche (police, motif, illustration, panneau « Aujourd'hui ») vaut « à choisir » — **le premier lot du jeu la remplit d'après une maquette validée par Nathan, illustration comprise** (\`apps/${id}/public/illustration.svg\`, charte rév. 18 § 4, § 5 et § 9). Pas de \`preview\` ni de \`on\` sans identité complète (test des fiches ; l'administration le refuse). \`aujourdhui: false\` n'est permis qu'avec une ligne de la liste d'exemptions du test (\`packages/core/test/identite.test.ts\`), raison « à fournir par la conversation du jeu » ; le panneau se branche par \`brancherJeu(…, { aujourdhui })\`. Une police nouvelle demande aussi sa découpe « profil » (\`scripts/polices/decouper.mjs\`) et ses deux feuilles (\`packages/ui/src/polices/\`, \`polices-profil/\`).`,
    `- **Premier jour** : ${squelette ? "celui du modèle, " : ""}\`${fiche.premierJour}\` — à régler au lancement du jeu (\`premierJour\` de la fiche, une ligne).`,
    "",
    "## 2. La plateforme en bref — et où lire les règles (elles ne sont pas recopiées ici)",
    "- **Du Jour** : un portail (`playdujour.com`) et des jeux quotidiens (un niveau par jour, identique pour tous, minuit à Paris), un profil commun, un serveur unique (`apps/api`) qui **rejoue chaque partie** pour classer. Un monorepo ; français et anglais.",
    "- **Lis, dans cet ordre** : `CLAUDE.md` (racine : carte du dépôt, règles communes, ce qu'on n'ouvre pas, discipline de l'agent) ; `packages/kit/CLAUDE.md` (ce que le kit donne déjà) ; `docs/regles/racine/un-jeu-une-fiche.md`, `ajouter-une-fiche-suffit.md`, `creer-un-jeu.md`, `publication-des-jeux.md`, `tests-et-ci.md`, `adresses-et-mise-en-production.md` ; `docs/plateforme/kit-de-jeu.md`.",
    "",
    "## 2 bis. Les jeux qui existent",
    ...tableauJeux,
    "- Les jeux **ne s'importent jamais l'un l'autre**. Track, Jump et Tower ne sont pas branchés par `brancherJeu` (le kit) ; ce jeu l'est.",
    "",
    "## 3. Tes zones (liste fermée)",
    ...fiche.zones.jeu.map((z) => `- \`${z}\``),
    "- **Exceptions tolérées, rien d'autre** : ta fiche `config/jeux/" + id + ".json` et ce que `npm run fiches` en tire, ta ligne de `docs/plateforme/budgets.md`, tes clés de catalogue (et `docs/plateforme/traductions.md` régénéré par `npm run traductions`).",
    "- **Tout le reste est partagé** (le serveur hors de ces fichiers, `scripts/**`, `.github/**`, `packages/**` communs, la charte, ce fichier) : un lot de jeu qui en a besoin **s'arrête et le propose** dans son README. Une PR de ce jeu porte l'étiquette `jeu:" + id + "` (ou `" + id + "` dans son nom de branche) ; le job `zones` échoue si elle sort de ses zones.",
    "",
    "## 4. Ce que le jeu écrit (le kit écrit le reste : `packages/kit/CLAUDE.md`)",
    `- Sa simulation (\`packages/${id}-sim\`), le rendu et les entrées de sa scène (\`apps/${id}/src/scene.ts\`), sa définition (\`definition.ts\`, la glue de \`brancherJeu\`), ses catalogues fr + en, son contrat serveur (\`apps/api/src/${id}.ts\`) et son module d'essais (\`apps/api/scripts/${id}-essais.ts\`). **Aucun écran** : le kit les écrit. Si le jeu a besoin d'écrire une ligne hors de ses zones, c'est un défaut du kit à corriger dans un lot de la plateforme.`,
    "",
    "## 5. Les règles de la plateforme (intitulés seulement ; le texte est dans `CLAUDE.md`, « Règles communes à tous les lots »)",
    ...intitules.map((i) => `- ${i.length > 90 ? `${i.slice(0, 90).replace(/\s+\S*$/, "")} […]` : i}`),
    "",
    "## 6. La charte visuelle",
    "- `docs/plateforme/identite.md` (direction « Cartouches ») prime. **Maquettes d'abord** pour l'étiquette et le HUD, validées par Nathan avant le code ; aucune couleur ni chaîne d'interface en dur (jetons et catalogues `fr` + `en` de `@cdj/ui`).",
    "",
    "## 7. La méthode",
    "- **Un lot = une session = une branche = une PR brouillon.** L'agent s'arrête quand les critères d'arrêt du lot sont verts ; rapport honnête (vérifié / non vérifié) ; README de lot de 150 lignes au plus ; section « Pour les joueurs » dans la PR (une ligne `- [" + nom + "] … // …` par changement visible, ou `rien`).",
    "- Avant de pousser : `npm run verifier` ; attendre la CI : `npm run attendre-ci` (une seule commande, silencieuse). Fusionner `main` une seule fois, juste avant de s'arrêter.",
    "- **Ordre conseillé** : (1) Nathan écrit le seed ; (2) maquettes de l'étiquette et du HUD ; (3) la simulation et son golden (`npm run golden:" + id + " -w @cdj/" + id + "-sim`, jamais sans monter la version) ; (4) le rendu et les sensations ; (5) le serveur (le contrat minimal suffit longtemps) ; (6) les textes fr + en ; (7) la publication, par Nathan.",
    "- **Ne pas modifier** les visions (`docs/seed.md`, `docs/*/seed*.md`, `docs/plateforme/seed-phase-*.md`) ni la charte : c'est Nathan qui le fait.",
  ];
  void aDefinir;
  return lignes.join("\n") + "\n";
}

const SEED = (c) => `# ${c.nom} — seed (vision du jeu)

> **À écrire par Nathan.** Le générateur n'invente pas la vision. Ce gabarit donne les titres ; le seed de Tower (\`docs/tower/seed.md\`) est un exemple rempli. Tant qu'il est vide, le jeu de départ (un squelette) n'a pas de direction.

## 1. Le jeu en une phrase

*(à écrire)*

## 2. Les piliers

*(trois à cinq principes que chaque lot doit respecter)*

## 3. Une partie

*(ce que fait le joueur, du premier geste à l'arrivée ; la durée ; ce qui rend le jour différent d'hier)*

## 4. Le classement et les médailles

*(ce qui se classe — un score ou un temps —, le départage, le Diamant : qui le fixe, comment ; les seuils or, argent, bronze)*

## 5. Le contenu du jour

*(ce qui est tiré de la graine du jour, ce qui ne l'est jamais ; les thèmes)*

## 6. Les commandes

*(clavier, manette, tactile)*

## 7. L'identité visuelle et sonore

*(l'étiquette, le HUD, l'ambiance ; une direction par maquette)*

## 8. Ce que le jeu n'est pas

*(ce qu'on refuse)*

## 9. Plan en lots

*(l'ordre proposé)*
`;
const CONSIGNES = (c, classement) => `# ${c.nom} — consignes

Chargé par lecture des fichiers du jeu (zone \`docs/${c.id}/**\`). Réponses et docs en français. **Créé par \`npm run nouveau-jeu -- --id ${c.id} --classement ${classement}\`** (lot K4g) à partir du jeu témoin « Cibles » ; vision : \`docs/${c.id}/seed.md\` (**ne pas modifier**, c'est Nathan qui le fait) ; à coller dans une conversation d'orchestration : \`docs/${c.id}/passation.md\`.

## État de départ
- **Le jeu de départ est un squelette** (${classement === "temps" ? "toucher les 20 cibles le plus vite possible, classé au temps croissant" : "toucher des cibles en 30 secondes, classé au score décroissant"}) : jouable, classé, rejoué par le serveur, avec les écrans du kit. À remplacer par le vrai jeu, lot après lot. Ses textes visibles sont « à remplacer » dans \`apps/${c.id}/src/catalogue.fr.ts\` et \`catalogue.en.ts\`.
- **Il est \`off\`** (\`etatDepart\` de la fiche) : absent de l'accueil, « Bientôt » sur sa page ; Nathan le passe en \`preview\` puis \`on\` depuis \`/admin/\` › Jeux. \`temoin: false\` : c'est un vrai jeu, qui n'est simplement pas encore publié.
- **Teinte de l'étiquette** : à choisir par Nathan (\`etiquette.fond\` et \`etiquette.coque\` de \`config/jeux/${c.id}.json\`) ; **premier jour** : \`premierJour\` de la fiche, à régler au lancement ; **plafond de budget** : la ligne \`${c.id}.jsCss\` de \`docs/plateforme/budgets.md\` est celle du modèle, à fixer avec la mesure du jeu.

## Où est quoi
- \`packages/${c.id}-sim\` : la simulation (pure, entière), le générateur du jour (\`generateur.ts\`), la rediffusion, le bot de l'auteur, les médailles, les jours figés ; **\`src/variante.ts\` : le seul endroit qui sait si le jeu se classe au score ou au temps** (ne garder que la variante utilisée quand le jeu a pris sa forme). Golden : \`npm run golden:${c.id} -w @cdj/${c.id}-sim\`, **jamais sans monter la version concernée**.
- \`apps/${c.id}\` : \`main.ts\` (\`brancherJeu\`), \`definition.ts\` (la glue), \`scene.ts\` (le rendu Canvas 2D et les entrées), catalogues, \`e2e/\` (Playwright, ports ${"{site}"} et ${"{serveur}"} dans \`playwright.config.ts\`).
- \`apps/api/src/${c.id}.ts\` (le contrat minimal : \`definirJeuNeuf\`), \`apps/api/scripts/${c.id}-essais.ts\` (le module d'essais de \`smoke\` et \`recette:seed\`), \`apps/api/scripts/${c.id}-empreintes.ts\`, \`apps/api/test/${c.id}.test.ts\`.

## Règles
- Les zones, la méthode et les règles de la plateforme sont dans \`docs/${c.id}/passation.md\` (générée) et le \`CLAUDE.md\` racine. Un lot de ce jeu reste dans ses zones et déclare tout nouveau spec e2e dans sa fiche (\`e2e.specs\`) **et** dans \`apps/${c.id}/e2e/durees.json\`.
- **Rien ne s'ajoute au premier chargement** qui ne soit pas à la demande (ligne de budget \`${c.id}.jsCss\`) ; un budget ne se relève qu'avec Nathan.
- **Mentions légales (règle de fidélité du lot R5)** : le jeu écrit dans le navigateur quatre clés, \`${c.id}:records\`, \`${c.id}:reglages\`, \`${c.id}:aide:vu\` et \`${c.id}:identite:vue\` (plus \`cdj:apercu:${c.id}\` et \`cdj:commandes:${c.id}\`). Les deux pages (\`apps/portail/mentions-legales/index.html\`, \`apps/portail/legal/index.html\`) doivent les décrire : **le test \`apps/portail/test/mentions.test.ts\` échoue tant qu'elles ne le font pas** dès que le jeu a dépassé son squelette (son catalogue n'a plus de texte « À remplacer ») et n'est pas un témoin. C'est un lot de la plateforme (zone partagée) : le proposer dans le README du premier lot du jeu, ne pas attendre le dernier.
`;

// --- Le plan et son exécution ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
export async function planifier(opts) {
  const { racine } = opts;
  verifierId(opts.id, racine, { passation: opts.passation });
  if (opts.passation) {
    const fiche = JSON.parse(lire(racine, `config/jeux/${opts.id}.json`));
    const classement = fiche.classement.format === "temps" ? "temps" : "score";
    const texte = construirePassation(racine, fiche, { classement, teinte: [fiche.etiquette.fond, fiche.etiquette.coque] });
    return { opts, creations: [{ chemin: `docs/${opts.id}/passation.md`, contenu: texte, ecraser: true }], editions: [], liens: [], commandes: [] };
  }
  const c = contexte(opts, racine);
  const creations = [];
  for (const chemin of fichiersDuModele(racine)) {
    let texte = renommer(lire(racine, chemin), c);
    const cible = cheminRenomme(chemin, c);
    if (/\/src\/catalogue\.fr\.ts$/.test(chemin)) texte = genericiserCatalogue(texte, c, "fr");
    if (/\/src\/catalogue\.en\.ts$/.test(chemin)) texte = genericiserCatalogue(texte, c, "en");
    if (opts.classement !== "score" && /packages\/cibles-sim\/src\/variante\.ts$/.test(chemin)) {
      const avant = 'export const VARIANTE_NOM: NomVariante = "score";';
      if (!texte.includes(avant)) throw new Error("variante.ts : la ligne VARIANTE_NOM a changé, le générateur doit suivre");
      texte = texte.replace(avant, `export const VARIANTE_NOM: NomVariante = "${opts.classement}";`);
    }
    if (cible === `apps/${c.id}/package.json`) {
      const j = JSON.parse(texte);
      j.dependencies = triee({ ...j.dependencies, ...Object.fromEntries(DEPENDANCES_COMMUNES.map((d) => [d, "*"])) });
      texte = json(j);
    }
    if (cible === `apps/${c.id}/tsconfig.json`) {
      // La dernière référence du modèle est `packages/ui` : les paquets communs déclarés d'office la suivent (ordre alphabétique : `ui` < `visuels`).
      const fin = '{ "path": "../../packages/ui" }]';
      if (!texte.includes(fin)) throw new Error(`${cible} : la dernière référence n'est plus packages/ui, le générateur doit suivre`);
      texte = texte.replace(fin, `{ "path": "../../packages/ui" }, ${DEPENDANCES_COMMUNES.map((d) => `{ "path": "../../packages/${d.replace("@cdj/", "")}" }`).join(", ")}]`);
    }
    creations.push({ chemin: cible, contenu: texte });
  }
  const { fiche, teinte } = await construireFiche(racine, c, opts.classement, opts.categorie);
  creations.push({ chemin: `config/jeux/${c.id}.json`, contenu: json(fiche) });
  creations.push({ chemin: `docs/${c.id}/seed.md`, contenu: SEED(c) });
  creations.push({ chemin: `docs/${c.id}/consignes.md`, contenu: CONSIGNES(c, opts.classement).replace("{site}", String(c.ports.site)).replace("{serveur}", String(c.ports.serveur)) });
  creations.push({ chemin: `docs/${c.id}/lots/.gitkeep`, contenu: "" });
  const editions = entreesMecaniques(racine, c);
  // La passation se lit sur le dépôt TEL QU'IL SERA (la fiche du jeu comprise) : elle est produite à l'écriture.
  creations.push({ chemin: `docs/${c.id}/passation.md`, contenu: null, passation: { fiche, classement: opts.classement, teinte } });
  const liens = existsSync(join(racine, "node_modules/@cdj")) ? [[`node_modules/@cdj/${c.id}`, `../../apps/${c.id}`], [`node_modules/@cdj/${c.id}-sim`, `../../packages/${c.id}-sim`]] : [];
  const commandes = opts.sansCommandes
    ? []
    : [
        ["npm", ["run", "fiches"]],
        ["npm", ["run", `golden:${c.id}`, "-w", `@cdj/${c.id}-sim`]],
        ["npm", ["run", "traductions"]],
      ];
  return { opts, c, fiche, teinte, creations, editions, liens, commandes };
}

export function ecrire(plan) {
  const { racine } = plan.opts;
  for (const f of plan.creations) {
    const complet = join(racine, f.chemin);
    mkdirSync(dirname(complet), { recursive: true });
    const contenu = f.passation ? construirePassation(racine, f.passation.fiche, f.passation) : f.contenu;
    writeFileSync(complet, contenu);
  }
  for (const e of plan.editions) writeFileSync(join(racine, e.chemin), e.apres);
  for (const [lien, cible] of plan.liens) {
    const complet = join(racine, lien);
    if (!existsSync(complet) && !(() => { try { return lstatSync(complet); } catch { return null; } })()) symlinkSync(cible, complet);
  }
}

function cinqEtapes(id, classement) {
  return [
    "Les 5 étapes de « Créer un jeu » :",
    `  1. Nathan écrit le seed (le jeu, les piliers, une partie, le classement) dans la conversation de la plateforme : gabarit docs/${id}/seed.md.`,
    `  2. Ce lot de la plateforme (npm run nouveau-jeu -- --id ${id} --classement ${classement}) verse le seed dans docs/${id}/seed.md.`,
    `  3. Nathan ouvre la conversation du jeu avec docs/${id}/passation.md et le seed.`,
    `  4. Les lots du jeu, dans ses zones seulement : simulation, rendu, sensations ; maquettes d'abord pour l'étiquette et le HUD.`,
    `  5. Nathan publie depuis /admin/ : off → preview → on. La liste des jeux du classement cumulé reste un réglage à part.`,
  ];
}

export async function principal(argv) {
  const opts = lireOptions(argv);
  const plan = await planifier(opts);
  const sortie = [];
  if (opts.passation) {
    sortie.push(`${opts.aBlanc ? "À blanc — " : ""}passation de « ${opts.id} » : docs/${opts.id}/passation.md ${opts.aBlanc ? "serait réécrit" : "réécrit"}.`);
    if (!opts.aBlanc) ecrire(plan);
    return sortie;
  }
  const { c } = plan;
  sortie.push(`${opts.aBlanc ? "À BLANC (rien n'est écrit) — " : ""}nouveau jeu « ${c.nom} » (id ${c.id}), classement : ${opts.classement}, modèle : ${MODELE}`);
  sortie.push(`  fiche : ordre ${plan.fiche.ordre}, état ${plan.fiche.etatDepart}, temoin ${plan.fiche.temoin}, teinte ${plan.teinte[0]} / ${plan.teinte[1]} (à choisir par Nathan), ports ${c.ports.site} (site) et ${c.ports.serveur} (serveur d'essai)`);
  sortie.push(`  fichiers créés (${plan.creations.length}) :`);
  // Groupés par dossier (`--detail` : un par ligne), de quoi lire d'un coup d'œil ce qui entre dans les zones du jeu.
  const dossiers = new Map();
  for (const f of plan.creations) dossiers.set(dirname(f.chemin), [...(dossiers.get(dirname(f.chemin)) ?? []), f.chemin.slice(dirname(f.chemin).length + 1)]);
  for (const [d, noms] of dossiers) sortie.push(opts.detail ? noms.map((n) => `    + ${d}/${n}`).join("\n") : `    + ${d}/ (${noms.length}) : ${noms.join(", ")}`);
  sortie.push(`  lignes ajoutées aux fichiers partagés (${plan.editions.length}) :`);
  for (const e of plan.editions) sortie.push(`    ~ ${e.chemin} (+${e.ajouts})`);
  if (plan.liens.length > 0) sortie.push(`  liens d'espaces de travail : ${plan.liens.map(([l]) => l).join(", ")}`);
  sortie.push(`  commandes lancées à la fin : ${plan.commandes.length > 0 ? plan.commandes.map(([m, a]) => `${m} ${a.join(" ")}`).join(" · ") : "aucune"}`);
  if (!opts.aBlanc) {
    ecrire(plan);
    for (const [cmd, args] of plan.commandes) {
      sortie.push(`$ ${cmd} ${args.join(" ")}`);
      const r = spawnSync(cmd, args, { cwd: opts.racine, encoding: "utf8", maxBuffer: 1 << 28 });
      if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} a échoué :\n${(r.stdout + r.stderr).split("\n").slice(-20).join("\n")}`);
    }
    sortie.push(`${relative(process.cwd(), join(opts.racine, "docs", c.id)) || `docs/${c.id}`} : seed.md (vide), consignes.md, passation.md`);
  }
  sortie.push("", `À décrire dans les mentions légales (fr et en) dès que le jeu a dépassé son squelette (catalogue sans « À remplacer ») — le test de apps/portail/test/mentions.test.ts échoue sinon : ${c.id}:records, ${c.id}:reglages, ${c.id}:aide:vu, ${c.id}:identite:vue (et cdj:apercu:${c.id}, cdj:commandes:${c.id}).`);
  sortie.push("", ...cinqEtapes(c.id, opts.classement));
  return sortie;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then(
    (lignes) => console.log(lignes.join("\n")),
    (e) => {
      console.error(`nouveau-jeu : ${e.message}`);
      process.exit(1);
    },
  );
}
