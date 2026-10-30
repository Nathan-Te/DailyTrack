// Portée d'une PR pour la CI (lot R2) : range chaque fichier changé dans une ou plusieurs catégories — `track` (DailyTrack), `jump` (DailyJump),
// `plateforme` — et dit quelles parties de la CI doivent tourner. Pur et testé (apps/api/test/ciScope.test.ts) ; utilisé par le job `scope` de
// .github/workflows/ci.yml :
//   git diff --name-only origin/main...HEAD | node scripts/ci-scope.mjs [--full]   → lignes `clé=valeur` pour $GITHUB_OUTPUT
//
// Règles (docs/plateforme/lots/lot-R2-hygiene.md) :
//   - lot R3 : dans `apps/api`, les fichiers propres à DailyJump (jump*.ts…) ou à DailyTrack (cdj.ts, salon.ts…) comptent pour ce jeu + plateforme ;
//   - un fichier propre à un jeu compte pour ce jeu seul ; une zone partagée (le reste d'apps/api, packages/core, packages/clock, le module de profil, les
//     workflows, les scripts de CI, la configuration racine, package.json et son verrou, le CLAUDE.md racine…) compte pour LES TROIS ;
//   - tout fichier qu'aucune règle ne reconnaît compte pour les trois (le doute ne saute jamais un test) ; une liste vide aussi ;
//   - typecheck et tests unitaires : toujours tout (hors de ce script) ; e2e : les suites des catégories touchées ; api-image : si le serveur est touché (SERVER_PATHS, ou toute zone partagée / tout doute).
import { touchesServer } from "./recette.mjs";

export const CATEGORIES = ["track", "jump", "tower", "plateforme"];

// Dans l'ordre : la première règle qui reconnaît le fichier l'emporte. Les exceptions précèdent la règle générale de leur dossier.
export const RULES = [
  // Les niveaux figés de DailyJump sont lus par le serveur (SERVER_PATHS) : DailyJump et plateforme.
  { glob: "apps/jump/public/levels/**", cats: ["jump", "plateforme"] },
  // Lot R3 — le serveur (`apps/api`) n'est plus d'un bloc. Ce qui ne sert qu'à un jeu compte pour ce jeu et la plateforme (l'image de l'API
  // tourne toujours : SERVER_PATHS) ; le cœur (registre, identité, configuration, serveur, base, Dockerfile, CLAUDE.md…) et tout fichier
  // non listé ici restent « les trois » (règle par défaut). Liste FERMÉE, fichier par fichier : un nouveau fichier du serveur est un doute.
  // DailyJump côté serveur : jump*.ts (jump, jumpHistory, jumpLives), leurs tests, leurs scripts.
  { glob: "apps/api/src/jump*.ts", cats: ["jump", "plateforme"] },
  { glob: "apps/api/test/jump*.test.ts", cats: ["jump", "plateforme"] },
  { glob: "apps/api/scripts/jump-*.ts", cats: ["jump", "plateforme"] },
  { glob: "apps/api/scripts/measure-jump.ts", cats: ["jump", "plateforme"] },
  // Tower côté serveur (lot R15, aligné sur scripts/zones-jeu.mjs ; les routes viennent au lot T4) : tower*.ts, leurs tests, leurs scripts.
  { glob: "apps/api/src/tower*.ts", cats: ["tower", "plateforme"] },
  { glob: "apps/api/test/tower*.test.ts", cats: ["tower", "plateforme"] },
  { glob: "apps/api/scripts/tower-*.ts", cats: ["tower", "plateforme"] },
  // DailyTrack côté serveur : son jeu (`cdj.ts` : jour, planning, classement) et son Salon, leurs tests, ses outils de mesure et d'historique.
  // `history.ts` n'y est pas : jumpHistory.ts l'importe (doute → les trois).
  { glob: "apps/api/src/cdj.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/src/salon.ts", cats: ["track", "plateforme"] },
  // Suites des lots 40 à 47 : le Garage du serveur (`garage.ts`) et son test à part, alignés sur scripts/zones-jeu.mjs.
  { glob: "apps/api/src/garage*.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/test/garage*.test.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/test/salon.test.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/test/planning.test.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/scripts/measure-salon.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/scripts/measure-generator.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/scripts/measure-budget.ts", cats: ["track", "plateforme"] },
  { glob: "apps/api/scripts/history-seed.ts", cats: ["track", "plateforme"] },
  // Lot I1 — le socle de l'interface (`packages/ui`) sert à toutes les applications : les trois (comme une zone partagée, explicitement). Le
  // portail (`apps/portail`) : ses tests unitaires (toujours lancés) et ses e2e, qui vivent dans la suite DailyTrack (apps/web/e2e :
  // portail.spec.ts, domaine.spec.ts, qui assemblent le site) → DailyTrack + plateforme ; il ne touche pas le serveur.
  { glob: "packages/ui/**", cats: ["track", "jump", "tower", "plateforme"] },
  { glob: "apps/portail/**", cats: ["track", "plateforme"] },
  { glob: "apps/web/**", cats: ["track"] },
  { glob: "packages/sim/**", cats: ["track"] },
  { glob: "docs/lots/**", cats: ["track"] },
  { glob: "docs/seed.md", cats: ["track"] },
  { glob: "docs/orchestration.md", cats: ["track"] },
  { glob: "docs/guide-technique.md", cats: ["track"] },
  { glob: "apps/jump/**", cats: ["jump"] },
  { glob: "packages/jump-sim/**", cats: ["jump"] },
  { glob: "docs/jump/**", cats: ["jump"] },
  // Lot R15 : Tower. Le jeu, sa simulation et ses documents ne lancent que les e2e de Tower (les tests unitaires, eux, suivent le graphe des imports).
  { glob: "apps/tower/**", cats: ["tower"] },
  { glob: "packages/tower-sim/**", cats: ["tower"] },
  { glob: "docs/tower/**", cats: ["tower"] },
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
    track: cats.has("track"),
    jump: cats.has("jump"),
    tower: cats.has("tower"),
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
