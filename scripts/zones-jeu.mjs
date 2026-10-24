// Zones d'une PR de jeu (retouche du lot I6, « Lots en parallèle », docs/orchestration.md) : un lot Track et un lot Jump peuvent tourner en même
// temps parce que chacun reste dans SES zones ; les zones partagées sont réservées aux lots de la plateforme. Pur et testé
// (apps/api/test/zonesJeu.test.ts) ; utilisé par le job `zones` de .github/workflows/ci.yml :
//   git diff --name-only origin/main...HEAD | node scripts/zones-jeu.mjs --etiquettes '["jeu:jump"]' --branche claude/lot-14-jump
//
// Règles :
//   - le jeu d'une PR : l'étiquette `jeu:track` / `jeu:jump` (elle l'emporte), sinon un morceau du nom de branche (`track` / `jump`, coupé sur
//     `/`, `-`, `_`) ; un morceau `plateforme` dans le nom de branche = une PR de la plateforme, même avec un nom de jeu ; deux étiquettes = refus (une PR de jeu ne sert qu'un jeu) ; deux jeux ou aucun dans le nom de branche = une PR de la
//     plateforme, sans garde ;
//   - une PR de jeu ne change que les fichiers de ses ZONES ou de ses EXCEPTIONS tolérées ; tout autre fichier fait échouer le job ;
//   - le diff est pris depuis la base commune (`origin/main...HEAD`) : fusionner `main` dans la branche n'ajoute aucun fichier.

export const JEUX = ["track", "jump"];

// Les zones de chaque jeu. Dans `apps/api`, liste FERMÉE, fichier par fichier, alignée sur scripts/ci-scope.mjs (le test le vérifie) :
// `history.ts` est importé par jumpHistory.ts et classementDemo.ts, `api.test.ts` et `classement.test.ts` passent par le cœur du serveur :
// zones partagées.
export const ZONES = {
  track: [
    "apps/web/**",
    "packages/sim/**",
    "apps/api/src/cdj.ts",
    "apps/api/src/salon.ts",
    // Suites des lots 40 à 47 : le Garage du serveur (lot 41 : ses règles sont dans packages/sim/src/garage.ts, ses routes dans cdj.ts) pourra
    // vivre dans `garage.ts` avec son test à part ; aucun de ces fichiers n'existe encore (un motif, comme `jump*.ts` pour Jump).
    "apps/api/src/garage*.ts",
    "apps/api/test/garage*.test.ts",
    "apps/api/test/salon.test.ts",
    "apps/api/test/planning.test.ts",
    "apps/api/scripts/measure-salon.ts",
    "apps/api/scripts/measure-generator.ts",
    "apps/api/scripts/measure-budget.ts",
    "apps/api/scripts/history-seed.ts",
    "docs/lots/**",
    // La synthèse de DailyTrack (celle de DailyJump est dans docs/jump/**) : un lot Track y écrit son état et ses pièges.
    "docs/orchestration.md",
  ],
  jump: [
    "apps/jump/**",
    "packages/jump-sim/**",
    "apps/api/src/jump*.ts",
    "apps/api/test/jump*.test.ts",
    "apps/api/scripts/jump-*.ts",
    "apps/api/scripts/measure-jump.ts",
    "docs/jump/**",
  ],
};

// Les exceptions tolérées, communes aux deux jeux : sa ligne de budgets.md, ses listes de packages/ui/test/applications.ts, et le relevé des
// traductions, régénéré par `npm run traductions` après tout changement de catalogue (ses clés de catalogue sont dans ses zones). Rien d'autre.
export const EXCEPTIONS = ["docs/plateforme/budgets.md", "packages/ui/test/applications.ts", "docs/plateforme/traductions.md"];

function globToRegExp(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}
// Un chemin qui remonte (`..`) n'est dans aucune zone : il sortirait du dossier qu'il semble nommer.
const correspond = (globs, chemin) => !chemin.split("/").includes("..") && globs.some((g) => globToRegExp(g).test(chemin));

/** Chemin normalisé (séparateurs `/`, pas de `./` en tête). */
function normaliser(chemin) {
  return String(chemin).trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
}

/**
 * Le jeu d'une PR : `{ jeu: "track" | "jump" | null, source, erreur? }`. `jeu: null` = une PR de la plateforme (pas de garde).
 * @param {{ etiquettes?: string[], branche?: string }} pr
 */
export function jeuDeLaPr({ etiquettes = [], branche = "" } = {}) {
  const parEtiquette = JEUX.filter((j) => etiquettes.includes(`jeu:${j}`));
  if (parEtiquette.length > 1) return { jeu: null, source: "étiquettes", erreur: "les deux étiquettes jeu:track et jeu:jump : une PR de jeu ne sert qu'un jeu" };
  if (parEtiquette.length === 1) return { jeu: parEtiquette[0], source: `étiquette jeu:${parEtiquette[0]}` };
  const morceaux = String(branche).toLowerCase().split(/[/_-]+/);
  // Un lot de la plateforme qui parle d'un jeu dans son nom (`plateforme-suites-track-2`) reste une PR de la plateforme : le morceau `plateforme` l'emporte sur le nom de jeu
  // (l'étiquette `jeu:…`, plus haut, l'emporte sur les deux). Une PR de jeu n'a pas de raison de porter ce mot dans sa branche.
  if (morceaux.includes("plateforme")) return { jeu: null, source: `branche « ${branche} » (plateforme)` };
  const parBranche = JEUX.filter((j) => morceaux.includes(j));
  if (parBranche.length === 1) return { jeu: parBranche[0], source: `branche « ${branche} »` };
  return { jeu: null, source: parBranche.length > 1 ? `branche « ${branche} » (deux jeux : plateforme)` : "aucune étiquette de jeu ni jeu dans le nom de branche" };
}

/** Les fichiers changés qui sortent des zones de ce jeu (et de ses exceptions). */
export function horsZones(jeu, fichiers) {
  if (!JEUX.includes(jeu)) throw new Error(`jeu inconnu : ${jeu}`);
  return fichiers.map(normaliser).filter(Boolean).filter((f) => !correspond(ZONES[jeu], f) && !correspond(EXCEPTIONS, f));
}

/** Verdict complet, avec le texte du résumé du run. */
export function verifierZones({ etiquettes = [], branche = "", fichiers = [] } = {}) {
  const { jeu, source, erreur } = jeuDeLaPr({ etiquettes, branche });
  if (erreur) return { ok: false, jeu, source, hors: [], texte: `Refusé : ${erreur}.` };
  if (!jeu) return { ok: true, jeu, source, hors: [], texte: `PR de la plateforme (${source}) : pas de garde de zones.` };
  const hors = horsZones(jeu, fichiers);
  if (hors.length === 0) return { ok: true, jeu, source, hors, texte: `PR de jeu ${jeu} (${source}) : les ${fichiers.filter(Boolean).length} fichier(s) changé(s) restent dans ses zones.` };
  return {
    ok: false,
    jeu,
    source,
    hors,
    texte: [
      `PR de jeu ${jeu} (${source}) : ${hors.length} fichier(s) hors de ses zones — un lot de jeu ne touche pas une zone partagée ;`,
      "s'il en a besoin, il s'arrête et le propose dans son README : c'est un lot de la plateforme (docs/orchestration.md, « Lots en parallèle »).",
      ...hors.map((f) => `  - ${f}`),
    ].join("\n"),
  };
}

const estPrincipal = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/scripts/zones-jeu.mjs");
if (estPrincipal) {
  const { readFileSync } = await import("node:fs");
  const arg = (nom) => {
    const i = process.argv.indexOf(nom);
    return i >= 0 ? process.argv[i + 1] ?? "" : "";
  };
  let etiquettes = [];
  try {
    etiquettes = JSON.parse(arg("--etiquettes") || "[]");
  } catch {
    console.error("--etiquettes : un tableau JSON attendu");
    process.exit(2);
  }
  const fichiers = readFileSync(0, "utf8").split("\n");
  const verdict = verifierZones({ etiquettes, branche: arg("--branche"), fichiers });
  console.log(verdict.texte);
  if (!verdict.ok) process.exit(1);
}
