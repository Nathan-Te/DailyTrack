// Lot K4e (plateforme) — **la preuve d'un 4ᵉ jeu sans retouche** : un jeu fictif `essai` (étiquette générique, table commune, témoin, score en points) est posé dans une COPIE du dépôt
// (jamais dans le dépôt lui-même), puis on lance le typage et toute la suite unitaire. Le résultat attendu : zéro échec, et aucun fichier au nom du jeu hors de sa zone.
//
//   node scripts/jeu-fictif.mjs                 → copie le dépôt courant, pose `essai`, `npm run fiches`, `tsc -b`, `vitest run` (sqlite puis libsql) ; liste les échecs
//   node scripts/jeu-fictif.mjs --source <dir>  → la même chose sur un autre arbre de sources (un commit extrait : la mesure « avant » du lot)
//   --dans-config                               → pose la fiche dans `config/jeux/essai.json` de la copie au lieu de la variable `CDJ_FICHES_SUPPLEMENTAIRES` (mesure « avant » : la variable n'existait pas)
//   --garder                                    → garde la copie (affiche son chemin)
//   --sans-suite                                → typage seulement
//   --part i/n                                  → la i-ᵉ part sur n de la suite (`vitest --shard`) ; le typage n'est refait que par la part 1 (la CI lance les n parts en parallèle)
//
// La fiche et ses fichiers vivent ici, dans le script, pas dans le dépôt : `config/jeux/` ne reçoit aucune fiche de test. Les fichiers créés dans la copie sont TOUS dans les zones du jeu
// (`apps/essai/`, `packages/essai-sim/`, `apps/api/src/essai*.ts`…) ; le script le vérifie et l'écrit dans son rapport. Aucune dépendance, aucun réseau, aucune base distante.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = resolve(option("--source") ?? RACINE);
const part = option("--part"); // « 2/3 »
if (part !== undefined && !/^[1-9]\d*\/[1-9]\d*$/.test(part)) throw new Error(`--part attend « i/n » (reçu « ${part} »)`);
const premierePart = part === undefined || part.startsWith("1/");

/** La fiche du jeu fictif. Les noms suivent la règle (`apps/essai`, `packages/essai-sim`, `essai:`) : rien n'est « hérité ». */
export const FICHE_ESSAI = {
  id: "essai",
  code: "essai",
  ordre: 9,
  nom: { fr: "Essai", en: "Trial" },
  accroche: "portail.essai.accroche",
  etiquette: { fond: "#C9B6F2", coque: "#5B3FA3", police: '"Rubik Mono One", "Archivo", sans-serif', dessin: "generique" },
  etatDepart: "off",
  premierJour: "2026-11-09",
  classement: {
    colonnes: [
      { nom: "score", sens: "desc" },
      { nom: "ticks", sens: "asc" },
      { nom: "submitted_at", sens: "asc" },
      { nom: "player_id", sens: "asc" },
    ],
    cumul: false,
    unite: "points",
    format: "entier",
  },
  medailles: { methode: "pourcentage-diamant", bareme: [50, 30, 15], plafondDiamant: 1000 },
  partage: { extras: [] },
  themes: ["clair", "sombre"],
  versions: {
    sim: "packages/essai-sim/src/constantes.ts:ESSAI_SIM_VERSION",
    generateur: "packages/essai-sim/src/constantes.ts:ESSAI_GENERATOR_VERSION",
  },
  jours: {
    mode: "fichier-par-jour",
    dossier: "apps/essai/public/jours",
    preuveInterditeEnProd: true,
    fabrication: {
      empreinte: "apps/api/scripts/essai-empreintes.ts",
      figer: { paquet: "@cdj/essai-sim", script: "figer:essai", forme: "jours-proteges" },
    },
  },
  rejeu: { unitesServeur: 10, maxTicks: 5000 },
  donnees: { tables: [], tableCommune: "resultats_jeu", stockage: { prefixe: "essai:", reglagesGardes: [] } },
  message: { ou: "essai" },
  zoneNouveautes: "essai",
  musique: { scenes: ["menu", "theme:clair", "theme:sombre"] },
  admin: { outils: false },
  zones: {
    jeu: ["apps/essai/**", "packages/essai-sim/**", "apps/api/src/essai*.ts", "apps/api/test/essai*.test.ts", "apps/api/scripts/essai-*.ts", "docs/essai/**"],
    serveur: ["apps/api/src/essai*.ts", "apps/api/test/essai*.test.ts", "apps/api/scripts/essai-*.ts"],
  },
  e2e: {
    dossier: "apps/essai/e2e",
    suite: "essai",
    fumee: ["partie.spec.ts"],
    zones: {
      "essai-sim": { globs: ["packages/essai-sim/**"] },
      "essai-jeu": { globs: ["apps/essai/index.html", "apps/essai/src/*"] },
    },
    specs: { "partie.spec.ts": ["essai-sim", "essai-jeu", "ui"] },
    parts: { main: 1, complet: 1, nuit: 1 },
  },
  budget: { lignes: ["essai.jsCss"] },
  temoin: true,
};

/** Les fichiers que la fiche promet (versions, empreinte, e2e) : un jeu qui existe, réduit à ce que les contrôles de cohérence regardent. Tous dans les zones de `essai`. */
const FICHIERS = {
  "packages/essai-sim/package.json": JSON.stringify({ name: "@cdj/essai-sim", private: true, version: "0.0.0", type: "module", scripts: { "figer:essai": "echo figer" } }, null, 2) + "\n",
  "apps/api/src/essai.ts": `import { decoderEnveloppe, ErreurEnveloppe } from "@cdj/core/enveloppe";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, refusDEnveloppe, type RejeuNeuf } from "./jeux/index";

// Le module serveur du jeu fictif \`essai\` (le contrat minimal d'un jeu neuf, comme le fera le générateur) : la charge d'une rediffusion est une suite d'octets, le score est leur somme.
const fiche = FICHES_SERVEUR.find((f) => f.id === "essai") as unknown as FicheServeur;
interface Niveau { jour: number }
interface Mesure { points: number; octets: number }
interface Rejeu extends RejeuNeuf { charge: readonly number[] }
const LIMITES = { maxCaracteres: 600, sims: [1], generateurs: [1] };

const contrat = (): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: 1, generatorVersion: 1 }),
  niveauDuJour: (jour) => ({ jour }),
  decoder(texte) {
    try {
      return decoderEnveloppe(texte, LIMITES);
    } catch (e) {
      if (e instanceof ErreurEnveloppe) throw refusDEnveloppe(e);
      throw e;
    }
  },
  rejouer(_niveau, texte) {
    const r = decoderEnveloppe(texte, LIMITES);
    if (r.charge.length === 0) throw new RefusJeu("not_finished", "Partie vide");
    return { points: r.charge.reduce((a, b) => a + b, 0), octets: r.charge.length };
  },
  score: (m) => ({ score: m.points, ticks: m.octets }),
  seuils: () => ({ author: 200, gold: 100, silver: 50, bronze: 20 }),
  entrees: (r) => \`essai|\${r.charge.join(",")}\`,
  theme: () => "clair",
});

export const ESSAI_GAME: GameDefinition<never> = definirJeuNeuf<Niveau, Rejeu, Mesure, never>({ fiche, nom: "Essai" }, contrat) as GameDefinition<never>;
`,
  "packages/essai-sim/src/constantes.ts": "export const ESSAI_SIM_VERSION = 1;\nexport const ESSAI_GENERATOR_VERSION = 1;\n",
  "apps/api/scripts/essai-empreintes.ts": "export const empreinteJour = (): string => \"essai\";\n",
  "apps/essai/e2e/partie.spec.ts": "// Spec de l'essai (jamais lancé : la fiche le déclare, les contrôles de cohérence le lisent).\n",
  "apps/essai/e2e/durees.json": JSON.stringify({ _: "Durées du jeu fictif.", secondes: { "partie.spec.ts": 5 }, essentiel: { "partie.spec.ts": 5 } }, null, 2) + "\n",
  "apps/essai/package.json": JSON.stringify({ name: "@cdj/essai", private: true, version: "0.0.0", type: "module" }, null, 2) + "\n",
  "apps/essai/public/jours/.gitkeep": "",
  "apps/essai/index.html": "<!doctype html><title>Essai</title>\n",
  "apps/essai/src/jeu.ts": "export {};\n",
};

/** Les clés de catalogue du jeu fictif, insérées après celles de Tower (ancres) dans la copie. Le générateur du lot suivant les écrira ; ici, le banc s'en charge. */
const CLES_COMMUN = { fr: ['"jeu.essai.nom": "Essai",'], en: ['"jeu.essai.nom": "Trial",'] };
const CLES_PORTAIL = {
  fr: ['"portail.essai.accroche": "Un essai par jour.",', '"portail.theme.essai.clair": "Clair",', '"portail.theme.essai.sombre": "Sombre",'],
  en: ['"portail.essai.accroche": "One trial a day.",', '"portail.theme.essai.clair": "Light",', '"portail.theme.essai.sombre": "Dark",'],
};

function inserer(fichier, ancre, lignes, occurrence) {
  let t = readFileSync(fichier, "utf8");
  let idx = -1;
  for (let i = 0; i <= occurrence; i++) idx = t.indexOf(ancre, idx + 1);
  if (idx < 0) throw new Error(`ancre introuvable dans ${fichier} : ${ancre}`);
  const fin = t.indexOf("\n", idx);
  t = t.slice(0, fin + 1) + lignes.map((l) => `  ${l}\n`).join("") + t.slice(fin + 1);
  writeFileSync(fichier, t);
}

/** Un chemin entre-t-il dans une zone du jeu (motifs `*` = un segment, `**` = tout) ? */
const globVersRegExp = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`);
export const horsDesZones = (chemins, fiche = FICHE_ESSAI) => chemins.filter((c) => !fiche.zones.jeu.some((g) => globVersRegExp(g).test(c)));

function lancer(cmd, argv, cwd, env = {}, sortie = false) {
  const r = spawnSync(cmd, argv, { cwd, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1 << 29 });
  if (sortie) process.stdout.write(`$ ${cmd} ${argv.join(" ")}\n`);
  return r;
}

export function preparerCopie(src, { dansConfig }) {
  const copie = mkdtempSync(join(tmpdir(), "cdj-essai-"));
  // Les fichiers suivis et ceux qui ne sont pas ignorés : le dépôt tel qu'un lot le voit, sans `node_modules`, `dist`, `site`.
  const liste = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: src, encoding: "utf8", maxBuffer: 1 << 28 }).stdout.split("\0").filter(Boolean);
  for (const f of liste) {
    if (!existsSync(join(src, f))) continue;
    mkdirSync(dirname(join(copie, f)), { recursive: true });
    cpSync(join(src, f), join(copie, f));
  }
  // node_modules : tout est lié à l'original, sauf `@cdj` (liens relatifs vers CETTE copie) et `.cache` (la sortie des commandes de la copie).
  mkdirSync(join(copie, "node_modules"));
  for (const e of readdirSync(join(RACINE, "node_modules"))) {
    if (e === "@cdj" || e === ".cache") continue;
    symlinkSync(join(RACINE, "node_modules", e), join(copie, "node_modules", e));
  }
  mkdirSync(join(copie, "node_modules/@cdj"));
  for (const e of readdirSync(join(RACINE, "node_modules/@cdj"))) symlinkSync(readlinkSync(join(RACINE, "node_modules/@cdj", e)), join(copie, "node_modules/@cdj", e));
  symlinkSync("../../packages/essai-sim", join(copie, "node_modules/@cdj/essai-sim"));

  const creés = [];
  for (const [chemin, contenu] of Object.entries(FICHIERS)) {
    mkdirSync(dirname(join(copie, chemin)), { recursive: true });
    writeFileSync(join(copie, chemin), contenu);
    creés.push(chemin);
  }
  const texte = JSON.stringify(FICHE_ESSAI, null, 2) + "\n";
  let supplementaires;
  if (dansConfig) {
    const f = JSON.stringify({ ...FICHE_ESSAI, temoin: undefined }, null, 2) + "\n";
    writeFileSync(join(copie, "config/jeux/essai.json"), f);
    creés.push("config/jeux/essai.json");
  } else {
    supplementaires = mkdtempSync(join(tmpdir(), "cdj-fiches-"));
    writeFileSync(join(supplementaires, "essai.json"), texte);
  }
  // Le bloc du jeu dans le Dockerfile de l'image : un `COPY` ne se calcule pas, le générateur d'un jeu neuf l'écrit (lot K4f) ; le banc fait de même (apps/api/test/dockerfile.test.ts le exige).
  const docker = join(copie, "apps/api/Dockerfile");
  let d = readFileSync(docker, "utf8");
  d = d.replace("COPY apps/tower/package.json apps/tower/\n", "COPY apps/tower/package.json apps/tower/\nCOPY apps/essai/package.json apps/essai/\nCOPY packages/essai-sim/package.json packages/essai-sim/\n");
  d = d.replace("COPY apps/jump/public/levels apps/jump/public/levels\n", "COPY apps/jump/public/levels apps/jump/public/levels\nCOPY packages/essai-sim packages/essai-sim\nCOPY apps/essai/public/jours apps/essai/public/jours\n");
  writeFileSync(docker, d);
  // La ligne de budget du jeu dans le tableau de `docs/plateforme/budgets.md` (un jeu neuf obtient sa mesure d'office ; le générateur du lot K4f écrit la ligne).
  const budgets = join(copie, "docs/plateforme/budgets.md");
  const b = readFileSync(budgets, "utf8");
  const ancre = b.indexOf("\n| `tower.jsCss`");
  const finLigne = b.indexOf("\n", ancre + 1);
  writeFileSync(budgets, b.slice(0, finLigne) + "\n| `essai.jsCss` | Essai | JS + CSS du premier chargement du jeu fictif | premier | 40 Ko | 30 000 | 10 000 |" + b.slice(finLigne));
  const ui = join(copie, "packages/ui/src");
  inserer(join(ui, "catalogue.ts"), '"jeu.tower.nom"', CLES_COMMUN.fr, 0);
  inserer(join(ui, "catalogue.en.ts"), '"jeu.tower.nom"', CLES_COMMUN.en, 0);
  const portail = join(copie, "apps/portail/src/catalogue.ts");
  inserer(portail, '"portail.tower.accroche"', [CLES_PORTAIL.fr[0]], 0);
  inserer(portail, '"portail.theme.tower.nuit"', CLES_PORTAIL.fr.slice(1), 0);
  inserer(portail, '"portail.tower.accroche"', [CLES_PORTAIL.en[0]], 1);
  inserer(portail, '"portail.theme.tower.nuit"', CLES_PORTAIL.en.slice(1), 1);
  return { copie, supplementaires, creés };
}

function echecsVitest(fichierJson) {
  if (!existsSync(fichierJson)) return null;
  const j = JSON.parse(readFileSync(fichierJson, "utf8"));
  const echecs = [];
  for (const s of j.testResults ?? []) {
    const f = s.name;
    if (s.status === "failed" && (s.assertionResults ?? []).every((a) => a.status !== "failed")) echecs.push({ fichier: f, test: "(le fichier ne se charge pas)", message: (s.message ?? "").split("\n").slice(0, 3).join(" | ") });
    for (const a of s.assertionResults ?? []) if (a.status === "failed") echecs.push({ fichier: f, test: a.fullName, message: (a.failureMessages?.[0] ?? "").split("\n")[0] });
  }
  return { echecs, total: j.numTotalTests, fichiers: j.numTotalTestSuites };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const dansConfig = args.includes("--dans-config");
  const { copie, supplementaires, creés } = preparerCopie(source, { dansConfig });
  const env = { CDJ_MODE_ESSAI: "1", ...(supplementaires ? { CDJ_FICHES_SUPPLEMENTAIRES: supplementaires } : {}) };
  console.log(`copie : ${copie}${supplementaires ? ` · fiches en plus : ${supplementaires}` : " · fiche dans config/jeux de la copie"}`);
  const rapport = { fiches: null, typage: null, projets: {} };

  let r = lancer("npm", ["run", "fiches"], copie, env, true);
  rapport.fiches = r.status === 0 ? "ok" : `échec : ${(r.stderr + r.stdout).split("\n").filter(Boolean).slice(-8).join("\n")}`;
  console.log(`npm run fiches : ${rapport.fiches}`);

  // Les clés de catalogue du jeu fictif ont changé les catalogues : le document des traductions (relu par Nathan) se réécrit, comme le fera le générateur.
  r = lancer("npm", ["run", "traductions"], copie, env, true);
  rapport.traductions = r.status === 0 ? "ok" : `échec : ${(r.stderr + r.stdout).split("\n").filter(Boolean).slice(-6).join("\n")}`;
  console.log(`npm run traductions : ${rapport.traductions}`);

  if (premierePart) {
    r = lancer("npx", ["tsc", "-b"], copie, env, true);
    const lignesTsc = (r.stdout + r.stderr).split("\n").filter((l) => /error TS/.test(l));
    rapport.typage = { statut: r.status, erreurs: lignesTsc.length, exemples: lignesTsc.slice(0, 30) };
    console.log(`typage : ${r.status === 0 ? "ok" : `${lignesTsc.length} erreur(s)`}`);
    for (const l of lignesTsc.slice(0, 30)) console.log(`  ${l}`);
  } else rapport.typage = { statut: 0, erreurs: 0, exemples: [], ailleurs: "refait par la part 1" };

  if (!args.includes("--sans-suite")) {
    for (const projet of ["sqlite", "libsql"]) {
      const sortie = join(copie, `vitest-${projet}.json`);
      lancer("npx", ["vitest", "run", "--project", projet, ...(part ? [`--shard=${part}`] : []), "--reporter=json", `--outputFile=${sortie}`], copie, env, true);
      rapport.projets[projet] = echecsVitest(sortie);
      const p = rapport.projets[projet];
      console.log(`${projet} : ${p ? `${p.echecs.length} échec(s) sur ${p.total} tests` : "pas de rapport"}`);
      for (const e of p?.echecs ?? []) console.log(`  ✗ ${relative(copie, e.fichier)} › ${e.test}\n      ${e.message.slice(0, 220)}`);
    }
  }
  console.log(`fichiers créés dans la copie pour le jeu : ${creés.join(", ")}`);
  // « Aucun fichier à son nom hors de sa zone » : tout ce que le banc a créé est dans les zones de la fiche (les clés de catalogue, le bloc du Dockerfile et la ligne de budget sont des LIGNES de fichiers partagés,
  // que le générateur du lot K4f écrit ; ils ne créent aucun fichier).
  const dehors = horsDesZones(creés.filter((c) => c !== "config/jeux/essai.json"));
  rapport.horsDesZones = dehors;
  console.log(dehors.length === 0 ? "fichiers créés hors des zones du jeu : aucun" : `FICHIERS HORS DES ZONES : ${dehors.join(", ")}`);
  writeFileSync(join(copie, "rapport-jeu-fictif.json"), JSON.stringify(rapport, null, 2));
  const ok = rapport.horsDesZones.length === 0 && rapport.fiches === "ok" && rapport.typage.statut === 0 && Object.values(rapport.projets).every((p) => p && p.echecs.length === 0);
  if (!args.includes("--garder")) rmSync(copie, { recursive: true, force: true });
  else console.log(`copie gardée : ${copie}`);
  console.log(ok ? "JEU FICTIF : zéro échec" : "JEU FICTIF : des échecs");
  process.exit(ok ? 0 : 1);
}
