// Portée d'une PR pour la CI (lot R2) : range chaque fichier changé dans une ou plusieurs catégories — un jeu (son identifiant : `track`, `jump`, `tower`, lus dans les fiches
// `config/jeux/<id>.json`) ou `plateforme` — et dit quelles parties de la CI doivent tourner. Pur et testé (apps/api/test/ciScope.test.ts) ; utilisé par le job `scope` de
// .github/workflows/ci.yml :
//   git diff --name-only origin/main...HEAD | node scripts/ci-scope.mjs [--full]   → lignes `clé=valeur` pour $GITHUB_OUTPUT
//
// Règles (docs/plateforme/lots/lot-R2-hygiene.md) :
//   - lot R3 : dans `apps/api`, les fichiers propres à un jeu (`zones.serveur` de sa fiche : jump*.ts, cdj.ts, salon.ts…) comptent pour ce jeu + plateforme ;
//   - un fichier propre à un jeu compte pour ce jeu seul ; une zone partagée (le reste d'apps/api, packages/core, packages/clock, le module de profil, les
//     workflows, les scripts de CI, la configuration racine, package.json et son verrou, le CLAUDE.md racine…) compte pour TOUS LES JEUX ;
//   - tout fichier qu'aucune règle ne reconnaît compte pour tous les jeux (le doute ne saute jamais un test) ; une liste vide aussi ;
//   - typecheck et tests unitaires : toujours tout (hors de ce script) ; e2e : les suites des catégories touchées ; api-image : si le serveur est touché (SERVER_PATHS, ou toute zone partagée / tout doute).
import { FICHES_CI } from "./fiches-lecture.mjs";
import { touchesServer } from "./recette.mjs";

// Lots K1, K1b et K1c : les catégories sont les jeux, lus dans leurs fiches (`config/jeux/<id>.json`), puis la plateforme. Plus aucun jeu n'est écrit ici.
export const CATEGORIES = [...FICHES_CI.map((f) => f.id), "plateforme"];
/**
 * **Exception nommée (portail)** : les specs e2e du portail et de la plateforme (portail, domaine, profil, amis, admin…) vivent dans le dossier des specs de Track (`apps/web/e2e`, la suite `web`) : une
 * modification de `apps/portail/**` lance donc cette suite, et la plateforme. Le jour où ces specs auront leur propre suite (lot K2 ou K3), cette ligne disparaît.
 */
const SUITE_DES_SPECS_DU_PORTAIL = "web";
const HOTE_DU_PORTAIL = FICHES_CI.find((f) => f.e2e.suite === SUITE_DES_SPECS_DU_PORTAIL).id;
const IDS = FICHES_CI.map((f) => f.id);
/** Les règles d'un jeu : la part `serveur` de ses zones compte aussi pour la plateforme (l'image de l'API tourne), le reste pour lui seul. */
const reglesServeur = FICHES_CI.flatMap((f) => f.zones.serveur.map((glob) => ({ glob, cats: [f.id, "plateforme"] })));
const reglesJeu = FICHES_CI.flatMap((f) => [...f.zones.jeu, ...(f.zones.documents ?? [])].filter((g) => !f.zones.serveur.includes(g)).map((glob) => ({ glob, cats: [f.id] })));

// Dans l'ordre : la première règle qui reconnaît le fichier l'emporte. Les exceptions précèdent la règle générale de leur dossier.
export const RULES = [
  // Lot R3 — le serveur (`apps/api`) n'est plus d'un bloc. Ce qui ne sert qu'à un jeu compte pour ce jeu et la plateforme (l'image de l'API
  // tourne toujours : SERVER_PATHS) ; le cœur (registre, identité, configuration, serveur, base, Dockerfile, CLAUDE.md…) et tout fichier
  // non listé ici restent « les trois » (règle par défaut). Liste FERMÉE, fichier par fichier : un nouveau fichier du serveur est un doute.
  // Lots K1 et K1b : les jeux à fiche côté serveur (Jump : jump*.ts, ses tests, ses scripts, ses niveaux figés que le serveur lit ; Tower : tower*.ts…), lus dans leur fiche (`zones.serveur`), comme scripts/zones-jeu.mjs.
  ...reglesServeur,
  // Lot I1 — le socle de l'interface (`packages/ui`) sert à toutes les applications : les trois (comme une zone partagée, explicitement). Le
  // portail (`apps/portail`) : ses tests unitaires (toujours lancés) et ses e2e, qui vivent dans la suite DailyTrack (apps/web/e2e :
  // portail.spec.ts, domaine.spec.ts, qui assemblent le site) → DailyTrack + plateforme ; il ne touche pas le serveur.
  { glob: "packages/ui/**", cats: [...IDS, "plateforme"] },
  { glob: "apps/portail/**", cats: [HOTE_DU_PORTAIL, "plateforme"] },
  // Lots R15, K1, K1b et K1c : un jeu (Track, Jump, Tower), sa simulation et ses documents ne lancent que ses e2e (les tests unitaires, eux, suivent le graphe des imports).
  ...reglesJeu,
  { glob: "docs/plateforme/**", cats: ["plateforme"] },
  { glob: "docs/mise-en-ligne.md", cats: ["plateforme"] },
  { glob: "docs/securite-facturation.md", cats: ["plateforme"] },
];

function globToRegExp(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}
const COMPILED = RULES.map((r) => ({ re: globToRegExp(r.glob), cats: r.cats }));

/** Chemin normalisé (séparateurs `/`, pas de `./` en tête). */
function normalize(path) {
  return String(path).trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

/** Catégories d'un fichier : jamais vide (zone partagée ou doute = les trois). */
export function categoriesOf(path) {
  const p = normalize(path);
  if (!p || p.startsWith("../") || p.includes("/../")) return [...CATEGORIES];
  for (const r of COMPILED) if (r.re.test(p)) return [...r.cats];
  return [...CATEGORIES];
}

/**
 * Ce qui doit tourner pour ces fichiers changés. `full` (run de nuit, lancement manuel, `main`, base introuvable) lance tout.
 * Une liste vide est un doute : tout tourne aussi.
 */
export function scopeOf(files, { full = false } = {}) {
  const list = files.map(normalize).filter(Boolean);
  const all = full || list.length === 0;
  const cats = new Set(all ? CATEGORIES : list.flatMap(categoriesOf));
  return {
    full: all,
    ...Object.fromEntries(IDS.map((id) => [id, cats.has(id)])),
    plateforme: cats.has("plateforme"),
    // Le serveur est touché par ses chemins (SERVER_PATHS) ou par toute zone partagée / tout doute (workflows, scripts de CI, configuration racine…).
    server: all || touchesServer(list) || list.some((f) => categoriesOf(f).length === CATEGORIES.length),
    reason: full ? "lancement complet demandé" : list.length === 0 ? "aucun fichier connu (doute : tout tourne)" : `${list.length} fichier(s) changé(s)`,
  };
}

/** Lignes `clé=valeur` pour $GITHUB_OUTPUT. */
export function toOutputs(scope) {
  return Object.entries(scope).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/scripts/ci-scope.mjs");
if (isMain) {
  const { readFileSync } = await import("node:fs");
  const files = readFileSync(0, "utf8").split("\n");
  process.stdout.write(toOutputs(scopeOf(files, { full: process.argv.includes("--full") })));
}
