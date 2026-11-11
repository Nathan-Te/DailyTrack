# Lot V2 — « Vertige » : modules de niveau et leurs solutions

**État : prêt à tester, PR en brouillon, jeu `off`.** Les deux parties sont livrées. Hors périmètre, non touché : générateur et niveau du jour, médailles (V3), thèmes et passe artistique (V4), son, téléphone, valeurs de sensation, zones partagées (`seed.md` non modifié).

## Livré
- **Ordre demandé** : (1) l'**index spatial** (`grille.ts`) avec le golden de V1 **identique au bit près** (commit à part) ; (2) les **orbes retirées** (commit à part) : `VERTIGE_SIM_VERSION` 3, golden régénéré, le « cube » des six directions refait avec des plaques marquées (cinq faces voisines), `gravite` et `portails` sans orbe (des plaques de sol marquées ramènent vers le bas) ; (3) le format de module, les jauges, le langage de solution, les points de passage ; (4) la bibliothèque et l'enchaînement.
- **Format de module** (`modules.ts`) : des blocs en coordonnées locales, un palier d'entrée (l'origine) et un palier de sortie (position + `ori` = repère de gravité, direction −z local), des étiquettes (mécaniques, difficulté 1 à 3 ; **plus d'étiquette « déclencheur »**), la solution en texte ; la durée du robot se **mesure** (jamais écrite, elle ne périme pas).
- **État de jonction canonique exact en entiers — le mécanisme (à valider) : « l'aimantation du palier »**. Une dynamique entière ne s'arrête jamais exactement à pleine vitesse (la vitesse converge à 8 µm/s près selon le chemin), donc pour que deux solutions s'enchaînent **telles quelles**, un palier ramène l'état à l'état canonique (au sol, au centre, pleine vitesse dans l'axe, regard dans l'axe, plus rien en cours) quand on en passe le plan **déjà presque dans cet état** (5 cm, 1,5°, 98,5 à 101,5 % de la vitesse, au sol, bonne gravité). Un humain n'y sent rien ; un joueur lent, de côté ou de travers n'est jamais ramené. Testé : le temps de chaque module dans l'enchaînement est celui de son robot seul, au pas près.
- **Jauges** (`jauges.ts`), calculées en entiers à partir des constantes ; **chaque écart d'un module ≤ 85 % de la portée maximale** (`analyser` rejoue la solution et mesure chaque phase en l'air). Plus forte charge de la bibliothèque : 91 % du permis (`V2-mesures.md`).
- **Langage de solution** (`solution.ts`) : `cours N`, `attends N`, `saute`, `dash`, `tourne D [N]`, touches `+gauche`… ; outil `npm run module:vertige -w @cdj/vertige-sim -- <id>` (événements, phases mesurées, pas en trop).
- **Points de passage** : chaque palier est une reprise ; **une chute ramène au dernier palier, le chrono continue** ; **R reprend au dernier palier** (touche et manette Y, comme « point de contrôle » de Track et Jump ; le bit `T_REPRISE` des touches, donc dans la rediffusion) ; **Entrée (le kit) recommence à zéro**.
- **14 modules** (`bibliotheque.ts`) : `saut-1`, `saut-2`, `mur-1`, `mur-2` (de mur en mur), `dash-1`, `dash-2`, `gravite-1` (le mur devient sol), `gravite-2` (le tonneau : sol, mur, plafond, mur, sol), `portail-1` (droit), `portail-quart` (quart de tour), `portail-gravite` / `portail-gravite-retour` (le monde tourne d'un quart de tour autour de l'axe de la course, dans un sens puis dans l'autre), `mur-dash`, `gravite-portail`. Tous de 4,3 à 6,1 s pour le robot.
- **Contraintes de niveau**, testées sur chaque module puis sur l'enchaînement : jamais deux surfaces marquées qui se touchent (plaque + liseré de pierre), au plus une paire de portails par module et deux paires à plus de 40 m, poches et murs des portails, jauges, étiquettes qui disent vrai, 12 à 16 modules, durées 4 à 8 s, deux ou trois difficultés par mécanique.
- **Enchaînement fixe** (`?scenario=enchainement`) : 7 modules, **34,7 s** pour le robot, dont un passage dans un monde tourné d'un quart de tour. Galerie (`?scenario=modules`) : nom, étiquettes, temps du robot, « Voir la solution » (la caméra rejoue), « Jouer ».
- **Règles écrites** dans `docs/vertige/consignes.md` (modules, état de jonction, jauges et marge, contraintes, points de passage, règle des constantes de sensation, questions ouvertes). Ligne de `budgets.md` mise à jour.

## À tester (2 clics, sur l'aperçu de la PR, sur ordinateur)
1. `/vertige/?scenario=modules&debug` : la galerie ; « Voir la solution » de `gravite-2` (le tonneau) et de `portail-gravite` ; « Jouer » sur `mur-1` (courir le long du mur, au bord de la plateforme).
2. `/vertige/?scenario=enchainement&debug&fps` : jouer le niveau (R reprend au dernier palier, chuter exprès au premier écart), et comparer son temps à celui du robot (en haut de l'écran, et à l'arrivée pendant 5 s). Captures et GIF : `images/lot-V2-*`.

## Critères d'arrêt
- **Tests** : `modules.test.ts` rejoue la solution de **chaque module** (échoue en nommant le module), `enchainement.test.ts` celle de l'**enchaînement complet** et vérifie que les paliers s'enchaînent tels quels ; `e2e/modules.spec.ts` fait la même chose **dans le navigateur** (même état qu'en Node, au bit près). **Golden de V1 inchangé** pour l'index spatial (commit 1) ; régénéré au retrait des orbes ; **golden de l'enchaînement ajouté** (robot, marche au hasard, reprise).
- **Mesures** (détail et méthode : `V2-mesures.md`) : rejeu de l'enchaînement **10,5 ms** (34,7 s) et marche de 45 s **14,3 ms** ; **120 s avec 600 boîtes : 25,7 ms** (171,8 ms avant l'index ; 45 s : 9,0 ms contre 62,5) ; **41 boîtes** dans l'enchaînement, **appels de dessin : voir `V2-mesures.md`** ; poids du premier chargement **52 082 o** (V1 : 50 002 ; **plafond 53 Ko, marge 918 o**) ; temps du robot par module de 4,32 à 6,07 s, **34,675 s** pour l'enchaînement.
- **CI de la PR** : à lire (voir la PR) ; les 32 specs e2e de Vertige passent en local (Chromium), les 3 navigateurs sont dans le job `@navigateurs`.

## Décisions prises (à confirmer)
- **R reprend au palier, Entrée recommence** : l'énoncé dit « R recommence à zéro » *et* « mêmes commandes de reprise que Track et Jump » (où R reprend et Entrée recommence) ; j'ai suivi Track et Jump. R ne recommence donc plus.
- **Le premier chargement grossit de 2 080 o** (marge 918 o) : l'enchaînement s'enregistre dans le fichier des niveaux, qui devient un morceau à part. La bibliothèque est dans un point d'entrée à part (`@cdj/vertige-sim/modules`) et tout le reste est à la demande.
- **Toucher une surface marquée ne dépend plus de l'ordre des blocs** (V1 : un sol ordinaire avant la plaque dans le niveau empêchait de la toucher) ; corrigé et testé.
- **Une gravité qui reste tournée à la sortie d'un module est permise** (`portail-gravite` sort à −x) : le module d'après est posé dans ce monde tourné ; `portail-gravite-retour` le remet. L'enchaînement passe par là.

## Non vérifié, ou limites
- **Jamais joué à la souris ni à la manette réelles** : les solutions sont des scripts, la sensation (l'aimantation, les tonneaux, le monde tourné de l'enchaînement, la reprise) est à juger par toi. Aucun vrai GPU ici : les appels de dessin sont exacts, les images par seconde non.
- **Le décor lointain** (îlots, nuages) reste autour de l'origine : au loin dans l'enchaînement il n'y a plus que le ciel (le soleil et le ciel suivent la caméra). À reprendre en V4.
- **Firefox et WebKit** : non lancés ici (leur téléchargement est refusé dans ce conteneur) ; rien n'est propre à un moteur (entiers seulement), le job `@navigateurs` de la CI les lit.
- **Mentions légales** : aucune clé de stockage nouvelle. **Zones** : tout est dans les zones du jeu, sa fiche (spec `modules.spec.ts` et ligne `aLaDemande`) et `budgets.md`.

## Questions pour Nathan
1. L'aimantation du palier (5 cm, 1,5°) : acceptable ? sinon, quel autre mécanisme exact ?
2. Durée visée des modules (4 à 8 s) et nombre (6 à 8 pour 30 à 45 s) : on garde ?
3. R reprend / Entrée recommence : confirmer.
4. Le monde qui reste tourné à la sortie d'un module (le tonneau du jeu, `portail-gravite`) : à garder pour le niveau du jour (V3) ?

## Pour les joueurs
rien
