// Lot K1 (plateforme) — la projection `ci` des fiches de jeu (`config/jeux/<id>.json`, écrite par `npm run fiches`), lue par les scripts de CI : `zones-jeu.mjs` (les zones d'une PR de jeu),
// `ci-scope.mjs` (la portée d'une PR), `ci-zones.mjs` (specs, parts, fumée), `site.mjs` (où le jeu est publié, la preuve de l'auteur) et `budgets.mjs` (les lignes du jeu).
// **Un jeu n'est plus écrit en dur dans ces scripts** : les trois jeux ont leur fiche (lots K1, K1b et K1c). Aucune dépendance, aucun réseau :
// un fichier JSON du dépôt, lu une fois.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les fiches de la projection `ci`, dans l'ordre de leur champ `ordre`. */
export const FICHES_CI = JSON.parse(readFileSync(join(RACINE, "config/jeux/projections/ci.json"), "utf8")).jeux;

/** Les identifiants des jeux (`track`, `jump`, `tower`), dans l'ordre des fiches. */
export const IDS_FICHES = FICHES_CI.map((f) => f.id);

/** La fiche d'un jeu d'après son identifiant, ou `undefined`. */
export const ficheCI = (id) => FICHES_CI.find((f) => f.id === id);

/** Lot K1b : les specs tout entiers « Régression » que déclarent les fiches, au format de `e2e/zones.json` (`<suite>/<spec>`). */
export const regressionDesFiches = () => FICHES_CI.flatMap((f) => (f.e2e.regression ?? []).map((spec) => `${f.e2e.suite}/${spec}`));

// Lot K4 (partie 1) — **les suites e2e, lues dans les fiches**. Un jeu = une suite (`e2e.suite`) : ses specs dans `e2e.dossier`, un projet Playwright `<préfixe><navigateur>` (le préfixe est `e2e.projet`,
// `<suite>-` s'il est absent ; Track, qui héberge aussi les specs du portail et de la plateforme, a le préfixe vide : son projet s'appelle `chromium`), son espace de travail `@cdj/<app>`
// et le document de sa dette de quarantaine. Plus aucun script n'écrit « jump » ou « tower » pour le dire.
/** Les suites e2e, dans l'ordre des fiches : `{ id, suite, dossier, app, espace, projet, dette }`. */
export const SUITES = FICHES_CI.map((f) => ({
  id: f.id,
  suite: f.e2e.suite,
  dossier: f.e2e.dossier,
  app: f.app,
  espace: `@cdj/${f.app}`,
  projet: f.e2e.projet ?? `${f.e2e.suite}-`,
  dette: f.e2e.dette ?? `docs/${f.id}/consignes.md`,
}));
/** La suite d'après son nom (`web`, `jump`, `tower`…), ou `undefined`. */
export const suiteNommee = (suite) => SUITES.find((s) => s.suite === suite);
/** Le projet Playwright d'une suite pour un navigateur (`chromium` pour la suite `web`, `jump-chromium`, `tower-firefox`…). */
export const projetDe = (suite, navigateur) => `${suiteNommee(suite)?.projet ?? `${suite}-`}${navigateur}`;
/** La suite d'un projet Playwright (`jump-chromium` → `jump`, `chromium` → la suite au préfixe vide), ou `undefined`. */
export function suiteDuProjet(projet) {
  const avecPrefixe = SUITES.filter((s) => s.projet !== "" && projet.startsWith(s.projet)).sort((a, b) => b.projet.length - a.projet.length)[0];
  return avecPrefixe ?? SUITES.find((s) => s.projet === "");
}
/** Le navigateur d'un projet Playwright (`tower-webkit` → `webkit`). */
export const navigateurDuProjet = (projet) => projet.slice(suiteDuProjet(projet)?.projet.length ?? 0);

// Lot K4 (partie 1) — les projections `serveur` (versions, jours, tables) et `jeu` (noms) pour « Mettre en production » : les versions à comparer, les jours figés, le nom d'un jeu dans un résumé.
/** Les fiches de la projection `serveur`, dans l'ordre. */
export const FICHES_SERVEUR = JSON.parse(readFileSync(join(RACINE, "config/jeux/projections/serveur.json"), "utf8")).jeux;
/** Le nom français de chaque jeu (`Track`, `Jump`, `Tower`…), d'après sa fiche : `{ id: nom }`. */
export const NOMS_DES_JEUX = Object.fromEntries(JSON.parse(readFileSync(join(RACINE, "config/jeux/projections/jeu.json"), "utf8")).jeux.map((j) => [j.id, j.nom.fr]));
/** Les versions (simulation, générateur) de chaque jeu, `{ nom de la constante, fichier, jeu }` : la fiche dit `fichier:CONSTANTE` (`versions.sim`, `versions.generateur`). */
export const VERSIONS_DES_JEUX = FICHES_SERVEUR.flatMap((f) =>
  [["sim", f.versions.sim], ["generateur", f.versions.generateur]].map(([role, v]) => {
    const [fichier, nom] = v.split(":");
    return { nom, fichier, jeu: NOMS_DES_JEUX[f.id], id: f.id, role };
  }),
);

// Lot K4b — **la chaîne de « Mettre en production » lue dans les fiches** : comment chaque jeu fige, prépare et compare ses jours (`jours.fabrication`, `packages/core/src/fiche.ts`). Plus aucun jeu n'est écrit
// dans `scripts/mise-en-production.mjs` ni dans les workflows de production : un jeu neuf, avec sa fiche, entre dans la chaîne sans une ligne de plus.
/**
 * Les jeux de la chaîne, dans l'ordre des fiches : `{ id, nom, mode, dossier, registre, sim, versions, moduleEmpreinte, moduleRegistre?, figer?, preparer? }`. `mode` : `registre` (un fichier de plages,
 * `registre`) ou `fichier-par-jour` (un fichier par jour dans `dossier`) ; `sim` : le dossier de la simulation (`packages/<sim>`), où l'on voit si un code contient le jeu.
 */
export const CHAINE = FICHES_CI.map((f) => {
  const { empreinte, registre, figer, preparer, apresPose } = f.jours.fabrication;
  return {
    id: f.id,
    nom: NOMS_DES_JEUX[f.id],
    mode: f.jours.registre ? "registre" : "fichier-par-jour",
    dossier: f.jours.dossier,
    registre: f.jours.registre,
    sim: f.sim,
    versions: FICHES_SERVEUR.find((x) => x.id === f.id).versions,
    moduleEmpreinte: empreinte,
    moduleRegistre: registre,
    figer,
    preparer,
    apresPose,
  };
});
/** Un jeu de la chaîne d'après son identifiant ; une erreur claire s'il n'a pas de fiche. */
export function jeuDeLaChaine(id) {
  const j = CHAINE.find((x) => x.id === id);
  if (!j) throw new Error(`jeu inconnu : « ${id} » (les fiches : ${IDS_FICHES.join(", ")})`);
  return j;
}
