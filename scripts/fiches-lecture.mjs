// Lot K1 (plateforme) — la projection `ci` des fiches de jeu (`config/jeux/<id>.json`, écrite par `npm run fiches`), lue par les scripts de CI : `zones-jeu.mjs` (les zones d'une PR de jeu),
// `ci-scope.mjs` (la portée d'une PR), `ci-zones.mjs` (specs, parts, fumée), `site.mjs` (où le jeu est publié, la preuve de l'auteur) et `budgets.mjs` (les lignes du jeu).
// **Un jeu qui a une fiche n'est plus écrit en dur dans ces scripts** ; Track et Jump (sans fiche jusqu'aux lots K1b et K1c) gardent leur code d'avant. Aucune dépendance, aucun réseau :
// un fichier JSON du dépôt, lu une fois.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les fiches de la projection `ci`, dans l'ordre de leur champ `ordre`. */
export const FICHES_CI = JSON.parse(readFileSync(join(RACINE, "config/jeux/projections/ci.json"), "utf8")).jeux;

/** Les identifiants des jeux qui ont une fiche (`tower`). */
export const IDS_FICHES = FICHES_CI.map((f) => f.id);

/** La fiche d'un jeu d'après son identifiant, ou `undefined` (Track et Jump). */
export const ficheCI = (id) => FICHES_CI.find((f) => f.id === id);
