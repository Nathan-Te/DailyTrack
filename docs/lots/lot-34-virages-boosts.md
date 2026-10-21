# Lot 34 — Track : moins de virages-pièges après les boosts

Retour des amis : trop de murs, surtout des virages serrés bordés d'un mur juste après une plaque ou un super turbo — à 66–88 m/s on ne freine plus à temps et l'on finit contre le mur trois fois sur quatre. **Décision de Nathan : le contact avec le mur doit exister, mais beaucoup moins.** Objet : qu'après un boost le virage suivant se prenne en freinant bien, et que « taper le mur » soit rare et volontaire.

Zones : `packages/sim/**` (générateur, mesure), `apps/web/**` (records par version du jour, admin, tests), `apps/api/scripts/measure-generator.ts`, `docs/lots/**`, `docs/orchestration.md`, la ligne de Track de `docs/plateforme/budgets.md`. **Aucun changement de physique** (`SIM_VERSION` 14 inchangée), ni de l'API, ni des catalogues. Médailles (lot 35) hors périmètre.

## 1. Date de bascule et versionnement par date

- **`GENERATOR_VERSION` = 16**, mais **seulement à partir du 28/10/2026** (`BASCULE_LOT_34`, `packages/sim/src/generator.ts`) : `generatorVersionOf(jour)` vaut **15 avant**, 16 ensuite. Choix de la date : le premier jour qui n'est ni passé, ni en cours, ni joué à la mise en production — aujourd'hui (21/10) + une semaine pour la revue, la recette et le bouton « Mettre en production ». Le 27/10 est aussi le « aujourd'hui » figé de la démonstration (`DEMO_TODAY`) : tout le jeu de démonstration reste en v15.
- **L'identifiant porte la version du jour** : `jour-2026-10-27-g15`, `jour-2026-10-28-g16`. Les classements, rediffusions, records locaux (`records.ts` lit la version de chaque jour), miniatures en cache et caches du serveur (table `circuits`, comparée à l'identifiant attendu) des jours d'avant restent valides ; aucun classement existant n'est cassé.
- **Preuve « au bit près »** : le golden (`packages/sim/test/fixtures/daily-golden.json`) contient 5 jours d'avant la bascule (06/10, 07/10, 08/10, **21/10 = aujourd'hui**, **27/10**), calculés avec le code d'avant le lot puis vérifiés identiques (texte, tentative, temps de l'auteur, thème, palette, et maintenant l'identifiant) ; **sa régénération refuse de réécrire un jour d'avant la bascule** (`UPDATE_GOLDEN=1` lève « un jour passé ne change jamais »). Vérifié aussi hors des tests : les 15 jours du 13/10 au 27/10, variante 0, variante 1 et thème Ville imposé (45 circuits) sont identiques octet pour octet avant et après le lot. `npm run history:seed` relancé : seul `generatorVersion` de `apps/web/public/demo/index.json` change (15 → 16), aucun jour.
- **Le planning de l'admin le montre** : la carte d'un jour (`/admin/`, `adminPlanning.ts`) a une ligne « Générateur » — « v15 · avant la bascule du lot 34 (2026-10-28) » ou « v16 · freinage après les boosts (lot 34) ». Un remplacement déjà choisi pour un jour ≥ 28/10 devient la variante du nouveau générateur : **à revoir dans le planning** (Nathan).
- **Le Salon** suit la dernière version (`salon-<session>-g16`) dès la mise en production : ses sessions sont oubliées. La session en cours à l'instant du déploiement change de circuit (comme à chaque version du générateur : le serveur ne rejoue jamais sur un circuit d'une autre version).
- **Si la mise en production arrive après le 27/10** : déplacer `BASCULE_LOT_34` au lendemain du jour de la mise en production, puis `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts` (les dates du golden d'avant la nouvelle bascule doivent rester v15 : la régénération le vérifie).
- `/api/day` et `/api/health` rendent toujours `generatorVersion` = la dernière version du serveur (inchangé : le test partagé `api.test.ts` l'attend) ; la version d'un jour est dans son `trackId`.

## 2. Mesure (ajoutée à `npm run measure:generator`, section 3)

Pour chaque virage (`turnReports`, `packages/sim/src/traps.ts`), sur la course du pilote d'auteur :
- **point libre** : la fin de la dernière poussée (plaque, super turbo) depuis le virage précédent — tant qu'une poussée agit, le frein ne gagne presque rien (frein 40 contre plaque 30 et turbo 42) — ou la sortie du virage précédent ;
- **vitesse d'arrivée possible** : plein gaz depuis le point libre jusqu'à l'entrée du virage (même direction que le pilote : une course refaite) ;
- **vitesse de passage** : la plus basse du pilote dans le virage ;
- **distance de freinage nécessaire** (0,8 × 40 m/s² × motricité, roulement, pente) contre **distance disponible**, et la **marge** : le temps qu'on peut rouler plein gaz après le point libre avant de devoir freiner.

**Virage-piège** : approche rapide (après une poussée, ou au-delà de 52,8 m/s : une portion rapide), un vrai freinage (au moins 8 m/s à perdre), **marge sous 0,3 s** et **un mur à l'extérieur** (ni bas-côté, ni cuve). Les mêmes marges courtes sans approche rapide (un large, une droite, puis un serré : un enchaînement technique, l'intention de sa figure) sont comptées à part (colonne « techniques »).

**Pilote « humain correct »** (`humanRun`) : le pilote d'auteur (même trajectoire, même adhérence) qui **ne freine ni pendant une poussée, ni dans les 0,3 s qui suivent sa fin, la sortie d'un virage ou une réception** ; on compte ses contacts avec un rebord (deux contacts à moins d'1 s = un). **Pourquoi celui-là** : les deux modèles proposés ont été essayés sur les mêmes 24 circuits. « Le pilote d'auteur avec une marge de freinage réduite » (il compte sur 95 à 115 % du frein au lieu de 80 %) ne change presque rien (0,6 → 0,75 contact par circuit) : à 70–88 m/s la traînée aide déjà à freiner. « Un pilote qui freine 0,3 s trop tard partout » arrive à chaque virage freiné avec le même excès (≈ 10 m/s : 0,3 s × 32 m/s²), **quelle que soit la distance disponible** : il ne peut pas juger une règle de distance (2,3 contacts par circuit avant comme après les premières règles). Le pilote retenu est le même retard de 0,3 s, **appliqué là où il compte** : un joueur correct freine bien quand il a le temps de voir venir le virage, et freine 0,3 s trop tard quand il faut freiner tout de suite après la fin de la poussée. C'est la définition du virage-piège, jouée par la simulation.

### Avant / après (60 dates du jour + 12 circuits par thème forcé, à partir du 06/10/2026, v15 et v16 sur les mêmes dates)

Colonnes : virages-pièges par circuit (moyenne, maximum, circuits à plus d'un) ; « techniques » = marges courtes sans approche rapide (hors définition) ; contacts du pilote « humain correct » par circuit, dont dans les 3 s après une poussée ; contacts du pilote d'auteur (référence) ; durée de l'auteur.

| circuits | n | pièges v15 → v16 | max | > 1 | techniques | contacts (humain) | après poussée | auteur | durée moyenne |
|---|---|---|---|---|---|---|---|---|---|
| du jour (60 dates) | 60 | 0,87 → **0,25** | 3 → **1** | 12 → **0** | 0,02 → 0,00 | 2,28 → **0,52** | 1,45 → 0,23 | 0,67 → 0,23 | 36,9 → 37,3 s |
| Stade | 12 | 1,25 → 0,75 | 2 → 1 | 4 → 0 | 0 → 0 | 1,75 → 1,08 | 1,25 → 0,83 | 0,50 → 0,25 | 36,4 → 36,6 s |
| Rallye | 12 | 0,08 → 0,00 | 1 → 0 | 0 → 0 | 0 → 0 | 1,17 → 0,00 | 0,92 → 0,00 | 0,50 → 0,00 | 38,0 → 37,5 s |
| Banquise | 12 | 0,58 → 0,00 | 1 → 0 | 0 → 0 | 0,08 → 0 | 1,92 → 0,33 | 1,25 → 0,08 | 0,92 → 0,33 | 37,7 → 37,3 s |
| Nuit | 12 | 1,00 → 0,00 | 2 → 0 | 3 → 0 | 0,08 → 0 | 3,92 → 0,00 | 1,17 → 0,00 | 0,75 → 0,00 | 38,0 → 37,8 s |
| Campagne | 12 | 0,75 → 0,00 | 2 → 0 | 3 → 0 | 0 → 0 | 2,33 → 0,25 | 1,50 → 0,00 | 0,75 → 0,08 | 36,8 → 38,1 s |
| Canyon | 12 | 0,42 → 0,00 | 1 → 0 | 0 → 0 | 0,08 → 0 | 2,83 → 0,50 | 2,42 → 0,00 | 0,83 → 0,25 | 36,7 → 35,7 s |
| Col alpin | 12 | 0,50 → 0,00 | 2 → 0 | 1 → 0 | 0,08 → 0 | 2,58 → 0,25 | 1,58 → 0,00 | 0,67 → 0,08 | 37,7 → 36,7 s |
| Ville | 12 | 1,75 → 0,83 | 3 → 1 | 8 → 0 | 0,08 → 0,17 | 2,75 → 1,25 | 1,75 → 1,00 | 0,58 → 0,25 | 36,1 → 36,6 s |
| **ensemble** | **156** | **0,82 → 0,22** | **3 → 1** | **31 → 0** | 0,04 → 0,01 | **2,36 → 0,48** (÷ 4,9) | **1,47 → 0,24** (÷ 6) | 0,68 → 0,19 | **37,1 → 37,1 s** |

**Objectifs** : au plus un virage-piège par circuit — **tenu** (maximum 1 sur les 156 circuits ; les pièges qui restent sont ceux que la règle garde : le passage signature de Stade, le super turbo puis la grande courbe relevée, et une épingle de Ville) ; contacts divisés au moins par 3 — **tenu** (÷ 4,9 ; ÷ 6 pour ceux qui suivent une poussée). Le pilote d'auteur touche lui aussi moins les murs (0,68 → 0,19).

Règle du lot 34 (v16, par circuit, 156 circuits) : **2,26 droites de freinage ajoutées**, **1,60 bas-côté imposé** sur un virage rapide, **0,26 piège gardé** (signature, Ville).

Virages abordés vite (approche après une poussée ou au-delà de 52,8 m/s) : v15 360 virages (2,3 par circuit), arrivée possible 65 m/s (max 83), passage 34 m/s, **freinage nécessaire 61 m pour 110 m disponibles**, marge médiane **−0,03 s**, 213 sous 0,3 s dont 128 contre un mur → v16 350 virages, arrivée 64 m/s (max 81), passage 32 m/s, **67 m pour 147 m disponibles**, marge médiane **0,65 s**, 38 sous 0,3 s dont 34 contre un mur (les pièges gardés, et des virages qui ne sont pas des pièges : moins de 8 m/s à perdre).

### Durées et taux de validation par thème (section 2 : 12 dates × 6 tentatives, thème forcé)

« Dans la fenêtre » = circuits construits dont le pilote finit en 30–40 s avec une portion rapide (le taux de validation du générateur, par tentative).

| thème | construit v15 → v16 | pilote finit | dans la fenêtre | durée moyenne |
|---|---|---|---|---|
| Stade | 88 → 92 % | 98 → 100 % | 76 → **62 %** | 38,2 → 39,2 s |
| Rallye | 81 → 85 % | 98 → 100 % | 62 → 59 % | 39,6 → 39,3 s |
| Banquise | 94 → 88 % | 87 → 98 % | 32 → 49 % | 40,8 → 40,0 s |
| Nuit | 90 → 100 % | 94 → 100 % | 58 → 57 % | 39,4 → 39,7 s |
| Campagne | 79 → 82 % | 93 → 100 % | 68 → 69 % | 38,7 → 39,3 s |
| Canyon | 65 → 96 % | 98 → 100 % | 81 → 93 % | 37,0 → 36,5 s |
| Col alpin | 89 → 88 % | 92 → 97 % | 53 → **44 %** | 39,8 → 40,0 s |
| Ville | 78 → 79 % | 96 → 98 % | 82 → 86 % | 38,2 → 37,4 s |
| **moyenne** | 83 → 89 % | 95 → 99 % | **64 → 65 %** | |

- **Durée de l'auteur** : toujours dans 30–40 s (60/60 dates ; 156 circuits sur 156 dans la section 3), 32,1 / 37,3 / 39,9 s (min / moyenne / max des 60 dates du jour en v16) ; aucun circuit de secours. Génération d'un circuit du jour : 166 ms en moyenne, 480 ms au plus.
- **Validation par thème** : comparable à l'avant-lot sur l'ensemble ; **Stade** (−14 points) et **Col** (−9) perdent « dans la fenêtre » (les droites de freinage allongent leurs circuits riches en turbos et en descentes, la fenêtre de 30–40 s en garde moins) ; Banquise (+17) et Canyon (+12) en gagnent ; le pilote finit plus souvent (95 → 99 %). Le générateur cherche jusqu'à 40 tentatives : les circuits du jour n'en souffrent pas (tentative retenue : 0,7 en moyenne, 6 au plus).

## 3. Règles du générateur (v16), chacune comptée et mesurée

`secureBraking` (`packages/sim/src/braking.ts`), appliquée par `composeFigures` à chaque figure posée (connecteur compris), **en v16 seulement** :

1. **Après une plaque, un super turbo ou une portion rapide, le premier virage laisse une distance de freinage suffisante, calculée à partir de la vitesse** (jamais un nombre fixe de blocs) : modèle statique de la vitesse le long des blocs (`advance`, `approachAfter`, `brakingDeficit`) — pointe du plat 48, plaque 66, super turbo 88 m/s ; **aucun freinage utile pendant la poussée** (74 m pour une plaque, 136 m pour un super turbo, depuis l'entrée de leur bloc) ; traînée au-delà de la pointe ; pente ; pas de freinage en l'air ni à la réception ; vitesse de passage serré 21, large 38, ample 46 m/s × √adhérence du revêtement (glace : roue libre) ; freinage nécessaire = (v² − v_passage²) / (2 × 0,8 × 40 × motricité) + **0,3 s × v** de réaction. Si elle manque, **des droites de freinage sont ajoutées devant le virage, une à une** (une droite donne de la place mais la voiture y accélère aussi), au plus 4 ; au-delà, la variante de la figure est refusée et le générateur en essaie une autre. Un virage large, ample ou relevé abordé assez lentement n'a besoin de rien. Calé sur la mesure dynamique (les déficits du modèle correspondent aux marges dynamiques négatives, comparés virage par virage sur 20 circuits).
2. **Un virage serré après une portion rapide a une échappatoire** : sa droite de freinage (règle 1) — et le bas-côté du thème quand il en a un. **Le bas-côté seul ne suffit pas** : la bande finit par un rebord à 15 m de l'axe ; essayé comme échappatoire unique, les contacts ne baissaient pas (1,9 → 1,5 par circuit sur 30 dates) ; avec les droites, 1,9 → 0,5.
3. **Au plus un virage-piège par circuit, seulement quand le thème s'y prête** : le passage signature (Stade : `turbo-courbe`, le super turbo puis la grande courbe relevée) ou Ville (ses épingles et angles droits) garde **un** virage sans droite ajoutée (`Composition.braking.kept`) ; partout ailleurs, la règle 1. **Rallye et Canyon gardent leur format** (signature, figures, revêtements) ; ils n'ont plus de piège.
4. **Moins de murs à l'extérieur des virages rapides** : un virage abordé vite reçoit le bas-côté du thème (lui et le bloc qui le suit), là où le format le permet — ni Ville (aucun bas-côté), ni Nuit (son bas-côté est le vide), jamais sur un virage relevé ni sur une réception.

Et pour que la règle tienne jusqu'au bout : l'approche d'un virage rapide est **protégée** (ni zone de revêtement, ni route bosselée, ni section sans rebords : le freinage y est compté sur la route) ; la plus longue ligne droite sans figure peut atteindre 6 + 4 blocs (les droites de freinage) ; les droites ajoutées se prennent pour **1 unité sur le budget des figures** (`BRAKING_BUDGET` ; 2 unités rendaient plus de circuits dans la fenêtre, 68 % contre 65 %, mais retiraient trop de virages larges et de figures favorites de Banquise).

## 4. Tests

| Test | Vérifie |
|---|---|
| `packages/sim/test/freinage.test.ts` | versions par date (27/10 → g15, 28/10 → g16, Salon g16) ; le modèle (un serré derrière un turbo et cinq droites ne se freine pas, derrière trois droites ordinaires si ; plus de droites derrière un turbo que derrière une plaque ; un enchaînement technique n'est pas touché ; le seul piège permis gardé tel quel ; au-delà de 4 droites, refus ; le bas-côté imposé tombe sur le virage) ; **24 dates d'après la bascule** : chaque virage abordé vite se freine sauf au plus un, dans la signature ou en Ville ; les virages rapides ont le bas-côté du thème ; **mesure dynamique** sur 8 dates : au plus un piège par circuit, contacts du pilote « humain correct » au moins divisés par deux par rapport à la v15 ; durées 30–40 s |
| `packages/sim/test/golden-daily.test.ts` | 10 dates (5 avant la bascule : identiques à la v15 ; 5 après : v16), version de chaque jour dans l'identifiant ; régénération refusée si un jour d'avant la bascule change |
| `apps/web/e2e/daily.spec.ts` | Chromium, Firefox et WebKit régénèrent les 10 circuits du golden à l'identique, identifiant compris |
| `generator.test.ts`, `variants.test.ts`, `figures.test.ts`, `archive.test.ts`, `thumbnails.test.ts`, `demo.spec.ts`, `share.spec.ts` | identifiant à la version du jour ; records des jours d'avant la bascule toujours lus (et une clé `-g16` pour un jour d'avant refusée) |

**Seuil changé, mesuré** : `generator.test.ts` « préfère les courbes amples » demandait 3× plus de virages larges que de serrés ; mesuré sur ses 120 dates : 3,28 en v15, **2,90** en v16 (même nombre de serrés, 148 ; les circuits allongés par les droites de freinage gardent, à durée égale, moins de virages larges, lents) ; sur 240 autres dates la v15 elle-même n'est qu'à 2,86. Seuil passé à **2,8×** (commentaire du test).

## 5. Budget (décision de Nathan)

La règle vit dans le générateur, que Track charge au premier écran (le circuit du jour se calcule dans la page) : **+1 214 o** compressés au premier chargement (285 067 → 286 281 o) pour une marge de 57 o, +1 101 o au fil des miniatures. Le code a été resserré (−100 o) ; sortir les scénarios d'essai du premier chargement a été essayé et **coûtait 100 o au lieu d'en rendre** (abandonné). **Nathan a autorisé le relèvement** (21/10/2026) : JS + CSS 286 400 o, JS 275 000 o, hors three.js 142 300 o, fil des miniatures 26 600 o (`apps/web/e2e/perf.spec.ts`, `docs/plateforme/budgets.md`). Piste pour un lot suivant : calculer le circuit du jour dans un fil de travail (générateur et figures hors du premier chargement).

## 6. Vérifié / non vérifié / décisions pour Nathan

- **Vérifié** : `npm test` (SQLite et libSQL), `npm run typecheck`, `npm run build` ; e2e Chromium `daily`, `demo`, `share`, `perf`, `planning`, `futur` (46 passés) ; jours d'avant la bascule identiques au bit près (golden + 45 circuits comparés) ; `npm run measure:generator` complet (chiffres ci-dessus) ; `history:seed` relancé.
- **Non vérifié** : le ressenti au volant (le « 3 fois sur 4 » des amis n'est mesuré que par le pilote « humain correct ») ; les e2e Firefox et WebKit en local (la CI les lance sur `daily.spec.ts`) ; la recette et l'aperçu (liens ci-dessous, à jouer).
- **Décisions pour Nathan** : (1) la **date de bascule** (28/10/2026) : la déplacer si la mise en production a lieu après le 27/10 (§ 1) ; (2) les remplacements du planning déjà choisis pour un jour ≥ 28/10 changent de circuit (§ 1) ; (3) **Stade et Col** : 14 et 9 points de moins « dans la fenêtre » (sans effet sur les circuits du jour, mais la génération essaie un peu plus) ; (4) Ville garde son piège (identité) : 0,83 par circuit, 1,25 contact du joueur « humain correct » — à confirmer au volant ; (5) **index du `CLAUDE.md` racine** (zone partagée, non modifié) : ajouter « Freinage après un boost (lot 34) » à la liste des rubriques de `packages/sim/CLAUDE.md`.

## 7. À tester (aperçu de la PR)

Les jours d'après la bascule ne sont jouables qu'en aperçu ou avec `?debug` (la production refuse un jour à venir). Aperçu de la PR : https://playdujour-recette--pr-104-aond8hhi.web.app/track/ ; révision de recette du serveur : https://b-claude-nifty-tu-7eakgn---cdj-api-recette-5qi6aa4qqa-ew.a.run.app (santé : `/api/health`).

- **Un circuit rapide** — [`/track/?seed=2026-11-01`](https://playdujour-recette--pr-104-aond8hhi.web.app/track/?seed=2026-11-01) (Campagne : turbos enchaînés, plaque puis épingle ; 3 droites de freinage ajoutées, bas-côtés d'herbe sur les virages rapides) : après chaque poussée, freiner à la fin de la poussée doit suffire.
- **Un circuit technique** — [`/track/?seed=2026-10-28`](https://playdujour-recette--pr-104-aond8hhi.web.app/track/?seed=2026-10-28) (Rallye, premier jour de la v16 : épingle sur terre, virage aveugle, saut de terre, turbo puis épingle avec ses droites de freinage, pincement).
- **Un circuit de Ville** — [`/track/?seed=2026-10-29`](https://playdujour-recette--pr-104-aond8hhi.web.app/track/?seed=2026-10-29) (turbo puis épingle : le seul piège gardé, chicane d'angles droits).
- **Un Salon** — [`/track/?mode=salon`](https://playdujour-recette--pr-104-aond8hhi.web.app/track/?mode=salon) (serveur de la recette : sessions en v16) ou [`/track/?mode=salon&api=demo`](https://playdujour-recette--pr-104-aond8hhi.web.app/track/?mode=salon&api=demo).
- Admin : [`/track/admin/`](https://playdujour-recette--pr-104-aond8hhi.web.app/track/admin/) (planning : la ligne « Générateur » montre v15 jusqu'au 27/10, v16 ensuite).

