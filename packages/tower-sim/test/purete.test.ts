import { describePurity } from "@cdj/core/testing";

// Mêmes interdits que `sim` et `jump-sim` (liste commune de `@cdj/core/testing`) pour tout ce qui entre dans l'ÉTAT d'un moteur : l'interface, les pièces, le banc,
// l'empreinte (lab/) et le moteur A (lab/a/). Ne sont PAS scannés : lab/b/ (Rapier, dépendance externe permise là seulement) et lab/mesures/ (outils de lecture
// qui utilisent Math.hypot, cos, sin sur les sorties flottantes : jamais dans un état). Le seul import extérieur permis ici : `@cdj/core`.
describePurity("packages/tower-sim/lab", new URL("../lab", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
describePurity("packages/tower-sim/lab/a", new URL("../lab/a", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
// Lot T1 : la simulation de jeu (src/) et sa suite d'essai (scenarios/) suivent les mêmes interdits. Rapier est la seule dépendance externe permise (règle du lot T1 :
// entrées entières ÷ 8, trigonométrie par la table) ; `rapier.ts` en est l'unique chargeur.
const RAPIER = "@dimforge/rapier2d-deterministic-compat";
describePurity("packages/tower-sim/src", new URL("../src", import.meta.url).pathname, { allowedImports: ["@cdj/core", RAPIER] });
describePurity("packages/tower-sim/scenarios", new URL("../scenarios", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
// Lot T2 : le générateur du contenu du jour (src/generateur/) est pur : la graine vient du numéro de jour, jamais d'une horloge.
describePurity("packages/tower-sim/src/generateur", new URL("../src/generateur", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
// Lot T3 : le bot (src/bot/) est pur lui aussi : aucun hasard, aucune horloge (ses essais sont ordonnés, sa preuve est la même d'un passage à l'autre).
describePurity("packages/tower-sim/src/bot", new URL("../src/bot", import.meta.url).pathname, { allowedImports: ["@cdj/core"] });
