# Lot 44 — Track : palier 1, le décor de chaque thème

Branche `claude/adoring-clarke-mdlzin` (nom imposé par la session ; le lot prévoyait `lot-44-palier1-decor`, d'où l'étiquette `jeu:track` sur la PR pour le
job `zones`), partie de `main` à `9f9a80a` (lot 43 fusionné), puis `main` fusionné à `42154b6` (retouche 40b, les voitures en jeu). PR : [#126](https://github.com/Nathan-Te/DailyTrack/pull/126).
Zones : `apps/web/**`, `docs/lots/**`, la section de Track de `docs/plateforme/budgets.md` (zones de la PR vérifiées : `scripts/zones-jeu.mjs`). **Rien dans
`sim`** : golden, `SIM_VERSION`, `GENERATOR_VERSION`, rediffusions, classements, identifiants de circuit inchangés (aucun fichier de `packages/` touché).

## En deux phrases

**Le décor de fond du palier 1 remplace celui d'avant, thème par thème** — Stade, Rallye, Banquise, Nuit, Campagne, Canyon, Col, Ville : le décor de B
allégé de la vitrine (`decorP` : tribune du départ, recettes du thème) et la matière de C (grain, sol dessiné du thème), **posés sur un sol relevé** près de la
piste (un talus à 1,5 m sous la route, puis une pente douce) pour qu'on voie enfin le décor depuis la voiture ; **la simulation ne voit pas ce sol**. Le décor
de chaque thème est **un morceau chargé à la demande** (12,6 ko pour les huit, plafond 16 ko) : la scène s'affiche d'abord avec la piste, les rebords et les
éléments de course, le décor arrive pendant l'accueil et ne s'ajoute **jamais en course** — s'il n'est pas prêt au décompte, la course part sans lui et il
s'ajoute à la prochaine pause ou à l'arrivée.

## À tester (aperçu de la PR, au téléphone ; le lien est commenté sur la PR)

Regarde surtout **la Ville, le Canyon et le Col depuis la voiture** : on doit voir le décor (talus à hauteur de route, immeubles, falaises, sapins, chalets).

| Thème | Le jeu (décor du palier 1) | Pour comparer (l'ancienne scène, son décor d'avant) |
|---|---|---|
| **Ville** (16/10) | `/track/?seed=2026-10-16&home=0` | `/track/?seed=2026-10-16&home=0&palier=existant` |
| **Canyon** (6/10) | `/track/?seed=2026-10-06&home=0` | `…&palier=existant` |
| **Col alpin** (12/10) | `/track/?seed=2026-10-12&home=0` | `…&palier=existant` |
| Stade (8/10) | `/track/?seed=2026-10-08&home=0` | `…&palier=existant` |
| Rallye (21/10) | `/track/?seed=2026-10-21&home=0` | `…&palier=existant` |
| Banquise (10/10, imposée) | `/track/?seed=2026-10-10&theme=banquise&home=0` | `…&palier=existant` |
| Nuit (14/10) | `/track/?seed=2026-10-14&home=0` | `…&palier=existant` |
| Campagne (14/10, imposée) | `/track/?seed=2026-10-14&theme=campagne&home=0` | `…&palier=existant` |

- `/track/?home=0` (le circuit du jour) et `/track/?home=0&palier=existant` : la consigne du lot.
- **Le décor arrive avec le circuit** (il est demandé en même temps que lui) : sur l'aperçu il est presque toujours dans la scène dès la première image. Sur un
  réseau très lent, avec `?home=0`, il peut arriver après le décompte : la course part sans lui, **il apparaît à la pause** (P, ou le bouton de pause) ou à
  l'arrivée — c'est voulu (jamais en course). Un rechargement le trouve dans le cache.
- `&debug` : le compteur d'images par seconde (lot 43) ; `__cdj.decor` dans la console dit quand le décor a été demandé, quand il est arrivé et quand il a été
  posé (`posePhase`).
- **Images par seconde** au Pixel 7 sur la Ville, le Canyon et le Col, avec et sans `&palier=existant` : le rendu logiciel de la CI ne dit rien d'un téléphone.

## 1. Ce qui a bougé dans le code

- **`src/scene/decor.ts` (nouveau, premier chargement : quelques lignes)** — le registre : `DECORS` (un `import()` par palette ; la palette `neon` reprend la
  Nuit), `chargerDecor` (une fois ; un échec permet de réessayer), `decorPret` (synchrone), `instantsDecor` (demandé / arrivé, pour `?debug` et les mesures).
- **`src/scene/decor/commun.ts` (nouveau, à la demande, un morceau partagé par les huit thèmes)** :
  - **le sol relevé** (`terrainDe`) : une grille de 16 m autour de la piste (trois cellules) ; chaque sommet est à `TALUS_SOUS_ROUTE` = 1,5 m sous la route la
    plus basse alentour, sur un replat de 36 m, puis descend en pente douce (0,22) jusqu'au sol lointain ; il **ne monte jamais au-dessus d'une route voisine
    moins 1,5 m**, il **reste au sol lointain à 10 m d'un bloc sans rebords** (la voiture peut tomber à côté) **et d'un vide de saut** (on voit le vide qu'on
    franchit), puis remonte (0,4) ; **aucun carré dans une cellule de la piste** (il ne passe ni sous un pont ni sous un saut). Un maillage du décor, d'une
    teinte (celle du sol du thème, un ton plus sombre) : la simulation ne le voit pas ;
  - **la pose** (`poserSurTerrain`) : l'élément est construit, mesuré, **descendu sur le point le plus bas du sol sous lui** (rien en l'air ; de l'autre côté
    d'une pente il est un peu enfoui), **refusé** s'il touche la surface roulante (`MARGE_DECOR` = 1 m, `planLibre`, contre `trackWorld`) ou s'il serait trop
    enfoui (1,6 m, ou le quart de sa hauteur pour un grand) ; refusé, il a consommé ses tirages au sort. Une structure qui descend jusqu'au sol lointain
    (immeubles de la Ville, tribune) garde l'appui « sol » ;
  - les places (`placesDeDecor`, reprises de `composer.ts` : rien dans une cellule de la piste ni dans le passage — une cellule entourée par la piste reste
    vide), la tribune du départ (celle de `decorP`, posée du côté libre, sinon de l'autre, sinon nulle part ; crochets des pas : foule, drapeaux, écrans de la
    vitrine), les pièces communes (pneus, drapeaux, panneaux de sponsors **du jeu** — l'atlas de `sponsors.ts`, plus celui de B —, foule, camionnette, sapins,
    cactus, rochers, lampadaires), l'assemblage `construireDecor` (densité par thème, remplissage de la qualité 2 sur la pente).
- **`src/scene/decor/matiereC.ts` (nouveau, avec le commun)** : **la matière de C** — le grain (sur le décor et le sol relevé : coordonnées « monde »,
  `uvMonde`) et **le sol lointain dessiné** du thème (pelouse, sable, neige, champ, alpage, dalles, nuit), qui remplace le damier quand le décor arrive
  (même programme : une texture en remplace une autre). La route et les éléments de course gardent leurs aplats (la piste d'abord). Sortis de
  `textures.ts` (qui ne garde que le ciel) et de `directionC.ts`.
- **`src/scene/decor/<thème>.ts` (nouveaux, un morceau chacun)** : les recettes de B, reprises et retouchées — **Stade** (tentes, panneaux et piles de pneus,
  tours de caméra, postes de commissaire ; **plus de foule hors de la tribune**, décision 14), **Rallye** (assistance, cactus, rochers, spectateurs sur un
  rocher), **Banquise** (bosquets de sapins, cabanes de pêche, blocs de glace), **Nuit** (lampadaires, motel allumé, cônes et camionnette), **Campagne**
  (fermes, grands arbres, bottes de foin, tracteurs ; haies), **Canyon** (**falaises à strates le long de la route**, mesas, citernes, cactus), **Col**
  (sapins, chalets, pylônes de télésiège, blocs), **Ville** (immeubles de rue, abribus, feux, le front de rue et les lampadaires de rue du lot 37 — **la Ville
  reste dégagée** : rebords bas et garde-corps, front de rue à 2–12 m du rebord). L'orange reste à la voiture (maillots, tentes, parasols, camionnettes : plus
  d'orange de marque dans le décor).
- **`src/scene/composerP1.ts`** : la scène se construit **avec le décor s'il est déjà chargé** (`TrackSceneOptions.decor`), sinon sans lui ;
  **`TrackScene.poserDecor`** l'ajoute ensuite : trois maillages (décor et sol relevé — un matériau à grain —, ses lumières, le remplissage de la qualité 2),
  le maillage des sponsors refait avec les affiches du décor, les halos refaits, le damier du sol remplacé ; la qualité courante est réappliquée. `stats().decor`.
- **`src/main.ts`** : le décor du thème du jour est **demandé dès le début** (`themeForDay`, en même temps que le circuit), puis à chaque scène construite ;
  **`poserDecorArrive`** (à chaque image, une lecture) le pose **seulement à l'arrêt** — accueil, pause, arrivée, podium du Salon (la règle de
  `peutReconstruire`), jamais en course ni pendant le décompte ; la scène suivante du Salon (construite pendant le podium) le reçoit de même.
  `__cdj.decor`, `__cdj.render.decor`.
- **Miniatures : avec le décor** (proposition, ci-dessous) — `thumbnails.ts` charge le décor du thème avant de dessiner (puis revérifie qu'aucune course n'a
  commencé), `renderThumbnail(…, { decor })` ; `THUMB_VERSION` 5.
- **Le code mort retiré** : **l'ancien décor** sort de `trackMesh.ts` (premier chargement) pour `scene/existant.ts` (à la demande : `?palier=existant` et la
  vitrine), qui le garde tel quel pour comparer ; **la « direction O »** (`scene/origine.ts`), **les directions A, B, C et le mélange** (`directionA.ts`,
  `directionB.ts`, `directionC.ts`, `directionM.ts`), **le décor de la vitrine** (`decorP1.ts`) et **le compositeur des directions** (`composer.ts` :
  `composerScene`) — ce qui en servait encore a changé de place : la lumière de C (`THEMES_C`, l'occlusion, la flaque) dans `scene/lumiere.ts`, le ciel et les
  horizons dans `scene/ciel.ts`, les noms des sponsors des écrans à diodes (palier 3) dans `scene/logos.ts` (`vie.ts` : une ligne d'import). **La planche des
  directions de la vitrine est partie** (`?planche=directions`, son tableau `src/vitrine/mesures.ts`, ses outils `captures-lot38` et `mesure-lot38`) ; capture
  gardée : [planche des directions](lot-44/planche-directions.jpg). La vitrine des paliers construit **le décor du jeu** (les huit thèmes chargés d'abord,
  `fabriquePalier`) ; la variété du palier 2 lui arrive par le contexte (`Contexte.varierDecor`).
- **Ce que la mise en jeu a révélé, corrigé** : (1) `Builder.tri` convertissait la couleur en linéaire à **chaque triangle** (trois puissances) : la dernière
  couleur est gardée — toute la scène se construit plus vite (mêmes sommets, mêmes couleurs) ; (2) `boite` (outils) recalculait chaque coin trois fois ; (3) la
  tribune de `decorP` ne vérifiait pas la route (elle se posait du côté du premier virage) : posée maintenant comme celle du lot 37 ; (4) les recettes de B ne
  passaient pas par le relevé de pose : toutes y passent (test de pose).

## 2. Le sol relevé

Décision de Nathan du 23/10 (`direction.md` § 9, n° 13) : **on voit enfin le décor depuis la voiture**. Le décor d'avant était posé sur le sol lointain, 8 m
au moins sous la route la plus basse (`track.voidY − FALL_DEPTH`) : derrière un rebord de 1,4 m, depuis la caméra de poursuite, on n'en voyait que le haut.

- **La forme** : à 1,5 m sous la route (`TALUS_SOUS_ROUTE` : le rebord monte à 1,4 m au-dessus d'elle, le talus reste en contrebas de la chaussée et ne se
  confond pas avec un bas-côté), sur un replat de 36 m au-delà de la cellule de la piste, puis une pente de 0,22 jusqu'au sol lointain ; près de plusieurs
  routes à des hauteurs différentes, il suit la plus haute en descendant mais ne dépasse jamais la plus basse qui le touche (moins 1,5 m), avec une pente de
  0,5 au plus. Grille de 16 m (deux carrés par côté de cellule), triangles coupés selon une diagonale fixe ; `hauteur(x, z)` suit exactement les mêmes
  triangles (le décor se pose dessus). Un sommet resté au sol lointain est enfoncé de 0,3 m (pas de scintillement avec le plan du sol).
- **Ce qu'il ne fait pas** : il **ne touche jamais la surface roulante** (aucun carré dans une cellule de la piste ; vérifié contre `trackWorld.sample`) ;
  **il ne crée aucun appui pour la voiture** — c'est un maillage du décor, la simulation ne le voit pas (aucun fichier de `sim` touché, rediffusions et golden
  identiques) ; **près d'un bloc sans rebords** (la Nuit en a 70 %, le Canyon 35 %) **et d'un vide de saut**, il reste au sol lointain sur 10 m puis remonte
  (0,4) : la voiture qui tombe disparaît sous le vide (`voidY`) bien au-dessus de lui, et le vide d'un saut reste un vide ; **il ne passe ni sous un pont ni
  sous un saut** (rien dans une cellule de la piste : sous un pont, sur piliers, on voit un ravin).
- **Ce qu'il coûte** : un passage sur la grille (≈ 3 à 6 ms sans ralentissement, rendu logiciel compris dans les mesures du § 5) et ≈ 2 000 à 5 000 triangles,
  dans le maillage du décor (aucun appel de rendu de plus) ; masqué avec le décor à la qualité 0.
- **Le décor posé dessus** : base sur le point le plus bas du sol sous son plan (à 5 cm près, testé) ; refusé si la pente l'enfouirait de plus de 1,6 m (le quart
  de sa hauteur pour un grand élément) : près des sauts et des blocs sans rebords, peu de décor, c'est voulu.

## 3. Images avant / après

**Outil** (hors CI) : `e2e/captures-lot44.spec.ts` — celui du lot 43 rejoué : `main` (`42154b6`, lot 43 et retouche 40b) servi à côté pour l'« avant », la
branche pour l'« après » ; un circuit de chaque thème (les jours du lot 37), le **départ**, le **premier tremplin ou bosse**, un **virage serré**,
l'**arrivée** et la **miniature** ; plus l'**accueil** et le **Salon**. Les images en course sont prises **en pause** (c'est là que le décor arrive s'il n'était
pas là). Différences chiffrées : `docs/lots/lot-44/comparaison.txt`.

**Planches** (avant à gauche, après à droite) : [Ville](lot-44/planches/ville.jpg) · [Canyon](lot-44/planches/canyon.jpg) · [Col alpin](lot-44/planches/col.jpg) ·
[Stade](lot-44/planches/stade.jpg) · [Rallye](lot-44/planches/rallye.jpg) · [Banquise](lot-44/planches/banquise.jpg) · [Nuit](lot-44/planches/nuit.jpg) ·
[Campagne](lot-44/planches/campagne.jpg) · [Accueil et Salon](lot-44/planches/accueil-salon.jpg). Images seules : `docs/lots/lot-44/avant/`,
`docs/lots/lot-44/apres/`. La planche des directions du lot 38, retirée : [capture](lot-44/planche-directions.jpg).

Ce que montrent les planches (à juger au téléphone : une image de 640 × 360 en rendu logiciel n'est pas l'écran du Pixel 7) :

- **Au départ, partout** : la tribune du départ (gradins, toit crème, sponsors du jeu), du côté libre de la piste, et le décor du thème **à hauteur de la
  route** derrière les rebords (le sol relevé) ; avant, le décor était 8 m plus bas.
- **Ville** (17 à 22 % des pixels changent en course) : la plus changée — immeubles de rue à vitrines et stores, front de rue, lampadaires et abribus, tout
  monte du sol lointain ; la rue reste **dégagée** (rebords bas et garde-corps, rien à moins de 2 m du rebord).
- **Campagne** (5 à 6 %) et **Col** (3 à 6 %) : granges et silos, grands arbres ; sapins, chalets, pylônes de télésiège — on les voit au-dessus des rebords.
- **Canyon** : falaises à strates et mesas le long de la route, plus présentes sur les parties plates ; **près des sauts et des blocs sans rebords le sol reste
  au fond** (c'est la règle), et le décor y est rare.
- **Stade, Rallye, Nuit** : le moins changé en course (0,1 à 2 % aux moments retenus, qui regardent surtout la route et l'horizon) ; leur décor est fait de
  petites pièces (panneaux, tentes, cactus, lampadaires) — à regarder au téléphone, c'est là que le palier 2 (variété, géométrie) aura le plus à apporter.
- **Miniatures (avec le décor)** : le sol relevé se voit d'en haut (plateau à hauteur de piste, pentes vers le sol lointain) ; le décor est le même que dans la
  scène (mêmes tirages), construit seulement près de la portion montrée.

## 4. Budget

Mesure : `npm run build && node scripts/budgets.mjs` (la mesure unique `mesureTrack`), `main` à `42154b6` construit à part ; décor : `node apps/web/e2e/mesureDecor.mjs`.

| Ligne | `main` | Lot 44 | Écart | Plafond | Marge |
|---|---|---|---|---|---|
| JS + CSS du premier chargement | 276 301 | **274 687** | **−1 614** | 291 600 | 16 913 |
| JS | 264 889 | 263 275 | −1 614 | 280 200 | 16 925 |
| hors three.js | 131 346 | 129 732 | −1 614 | 147 500 | 17 768 |
| CSS, catalogue anglais, page d'admin, fils de travail, polices | — | inchangés | 0 | — | — |
| **décor 3D à la demande** (nouvelle ligne : les huit thèmes, le commun une fois) | — | **12 554** | — | **16 000** | 3 446 |

**Chaque thème** (JS compressé, ce que charge un joueur : son morceau et le morceau commun, 5 742 o) : Stade 6 342 · Rallye 6 344 · Banquise 6 256 · Nuit
6 369 · Campagne 6 613 · Canyon 6 488 · Col 6 425 · Ville 7 911 (son morceau seul : 514 à 871 o, la Ville 2 169 o avec son front de rue).

- **Le premier chargement baisse** : l'ancien décor (≈ 2 ko compressés dans `trackMesh.ts`) en sort ; il y entre le registre (huit `import()`), la pose du décor
  dans la scène et dans le jeu (≈ 0,4 ko). **Rien du décor n'est dans le premier chargement** (testé : `e2e/perf.spec.ts` par les fichiers construits,
  `test/socle.test.ts` par le graphe des imports statiques).
- **La ligne « décor 3D à la demande »** est imposée par `e2e/perf.spec.ts` et écrite dans la section du lot 44 de `docs/plateforme/budgets.md`, **pas encore
  dans le grand tableau** : `apps/portail/test/budgets.test.ts` (zone partagée) n'y accepte que les clés qu'il connaît ; y ajouter `track.decor` est une ligne
  dans son `ATTENDUS` — à faire par un lot de plateforme (§ 8).

## 5. Performance (profil téléphone : 844 × 390 @2, processeur ×4, qualité 2, rendu logiciel)

`MESURE=1 PERF_AVANT=http://localhost:4174 PERF_OUT=docs/lots/lot-44/mesure.json npx playwright test mesure-lot44 --project=chromium` : `main` (le lot 43,
retouche 40b comprise) servi à côté, la branche ; au départ d'une course, **la scène avec son décor**, médiane de trois pages neuves ; chiffres bruts :
`docs/lots/lot-44/mesure.json`.

| Thème | Appels de rendu : lot 43 → lot 44 | Triangles par image : lot 43 → lot 44 | Construction de la scène, décor compris (ms ; médiane, les trois essais) |
|---|---|---|---|
| Stade | 30 → **30** | 52 170 → **51 438** (−1 %) | 554 → **497** (483 / 497 / 501) |
| Rallye | 30 → **30** | 65 404 → **58 121** (−11 %) | 584 → **553** (571 / 553 / 493) |
| Banquise | 29 → **29** | 140 215 → **78 999** (−44 %) | 849 → **679** (679 / 590 / 774) |
| Nuit | 36 → **35** | 104 864 → **75 256** (−28 %) | 804 → **695** (695 / 805 / 636) |
| Campagne | 29 → **29** | 86 804 → **60 446** (−30 %) | 587 → **523** (522 / 523 / 626) |
| Canyon | 29 → **29** | 70 735 → **61 045** (−14 %) | 550 → **593** (666 / 512 / 593) — +8 % |
| Col alpin | 30 → **30** | 86 251 → **66 522** (−23 %) | 645 → **547** (547 / 613 / 540) |
| Ville | 31 → **31** | 89 526 → **82 556** (−8 %) | 688 → **736** (747 / 689 / 736) — +7 % |
| **moyenne** | 30,5 → 30,4 | 87 000 → 66 800 | 658 → **603** (−8 %) |

- **Appels de rendu : jamais plus qu'au lot 43** (la Nuit : un de moins). Le décor dessine trois maillages (décor et sol relevé, ses lumières, le remplissage de
  la qualité 2) au lieu de quatre (décor, ses lumières, la passe dense et ses lumières) ; ses affiches entrent dans le maillage des sponsors (refait).
- **Triangles : moins sur chaque thème** ; le pire thème passe de 140 215 (Banquise, lot 43) à **82 556** (Ville). Le décor fait ≈ 29 000 triangles par circuit
  en moyenne (373 éléments ; test de pose, `DECOR_RAPPORT=1`) contre ≈ 51 000 (745 éléments) pour le décor d'avant : des éléments plus parlants, moins
  nombreux, posés à hauteur de route sur le sol relevé (le décor d'avant devait sa masse aux passes denses du sol lointain, 8 m plus bas).
- **Construction de la scène, le décor compris : −8 % en moyenne, en dessous sur six thèmes ; le Canyon (+43 ms) et la Ville (+48 ms) un peu au-dessus**,
  dans l'écart entre deux essais (le Canyon : 512 à 666 ms ; le lot 43 : 514 à 581 ; la Ville : 689 à 747 contre 622 à 730). Ce qui a été fait pour tenir
  (premier jet : jusqu'à +100 % sur la Ville) : la couleur gardée par `Builder.tri` (la conversion en couleur linéaire à chaque triangle coûtait ≈ un tiers de
  la construction de tout le décor), les coins des boîtes calculés une fois (`boite`), le sol relevé calculé dans une grille plutôt qu'en lisant la table des
  cellules à chaque sommet (×3), `planLibre` par le pourtour (comme le lot 37) au lieu de toute la surface, une densité par thème (`densite`). Sans
  ralentissement (Node, sans rendu, dix fois chaque circuit) : le décor seul se construit en ≈ 31 ms en moyenne contre ≈ 55 ms pour le décor d'avant.
- **L'arrivée du décor en 4G lente** (150 ms, 1,6 Mbit/s, cache vide, processeur ×4, cinq essais) : **demandé à ≈ 2,15 s** de l'ouverture de la page (avec
  le circuit du jour), **prêt à ≈ 2,4 s** ; le jeu, lui, est prêt (première image de la scène) à 4,4 – 5,4 s à l'accueil et à 6,6 – 7,4 s sans accueil :
  **dans les dix essais, le décor était là quand la scène s'est construite** (`posePhase` = « construction ») — il arrive donc **avant la fin de l'accueil**
  dans le cas habituel, et même avant l'accueil. Le cas « pas prêt au décompte » (réseau coupé, très lent) est vérifié par `e2e/decor.spec.ts`.
- **Temps par image** : non mesurable ici (rendu logiciel) — « À tester » au Pixel 7 avec le compteur de `?debug`. Rien ne s'ajoute par image : `poserDecorArrive`
  lit un booléen tant que le décor est posé (ou une table tant qu'il ne l'est pas) ; le grain du décor est une texture lue par pixel sur le décor seul (pas sur
  la route ni les éléments de course).
- **`QualityGovernor`** : en place ; le décor et le sol relevé sont masqués à la qualité 0, le remplissage sous la qualité 2 (`denseDecor`).

## 6. Tests

- `test/terrain.test.ts` (nouveau) : **le sol relevé contre la simulation** (`trackWorld`), 64 circuits (13/10 → 15/12/2026, chaque thème imposé 8 fois) — aucun
  carré dans une cellule de la piste ni sous la surface roulante ; 1,5 m au moins sous chaque bloc qui le touche ; au sol lointain près d'un bloc sans
  rebords ou d'un vide de saut ; bien relevé ailleurs (plus de 60 % des bords de piste) ; la hauteur suit les triangles construits.
- `test/decorPose.test.ts` : la pose du lot 37 sur 64 circuits, **le nouveau décor compris** (palier 1 : 0 faute ; existant : 0 faute) — nouvel appui
  `terrain` dans `test/decorChecks.ts` (la base sur le point le plus bas du sol relevé sous l'élément, à 5 cm près ; rien sur la surface roulante).
- `test/socle.test.ts` : le graphe des imports statiques depuis `main.ts` ne tire **ni le décor** (`scene/decor/`), ni l'existant, ni la vitrine, ni un pas ;
  le registre (`scene/decor.ts`) y est.
- `test/paliers.test.ts`, `test/scene.test.ts`, `test/palier1.test.ts` : repris sans les directions (la variété du palier 2 sur le décor du jeu).
- `e2e/decor.spec.ts` (nouveau) : **à l'accueil**, le décor du thème est dans la scène avant « Courir », un morceau du thème et le commun, rien de plus ; **son
  morceau retenu jusqu'en pleine course** : la course part sans lui, il est prêt mais **pas posé en course**, il s'ajoute **à la pause**.
- `e2e/perf.spec.ts` : la ligne « décor 3D à la demande » (16 000 o, chaque thème, rien dans le premier chargement).
- `e2e/vitrine.spec.ts` : la planche des directions partie ; le test du téléphone (agrandir, tourner au doigt, mesurer) repris sur la planche des paliers.
- `e2e/graphismes.spec.ts` : la qualité 2 (« décor dense ») attend le décor à la demande (une pause le pose s'il n'était pas là à la construction).
- Outils (hors CI, `durees.json` à 0) : `captures-lot44.spec.ts`, `mesure-lot44.spec.ts` ; `e2e/mesureDecor.mjs` (la mesure du décor).

## 7. Vérifié, non vérifié

**Vérifié** (en local, Chromium, un test à la fois) :
- `npm run typecheck` (`tsc`) ; `npx vitest run --project sqlite apps/web` (50 fichiers, 609 tests) et `apps/portail/test/budgets.test.ts` ; test de pose
  (64 circuits, palier 1 et existant : **0 faute**), `test/terrain.test.ts` (64 circuits) ;
- e2e : `decor`, `socle`, `graphismes`, `perf` ; puis une passe large sur la branche avant la fusion de `main` (390 tests choisis par nom — `thumbnails`,
  `vitrine`, `salon`, `graphismes`, `daily`, `watch`, `mobile`, `hud-compact`, `accueil` et ce que ces noms attrapent : **292 passés, 0 échec**, 98 sautés,
  outils de capture et de mesure) ;
- budget (`node scripts/budgets.mjs`, `node apps/web/e2e/mesureDecor.mjs`) contre `main` construit à part ; zones de la PR (`scripts/zones-jeu.mjs
  --etiquettes '["jeu:track"]'` : tous les fichiers dans les zones de Track) ;
- mesures au profil téléphone (§ 5, `mesure-lot44`), arrivée du décor en 4G lente, captures avant / après et planches (`captures-lot44`) ;
- golden et identifiants de circuit : aucun fichier de `packages/` touché.

**Non vérifié** : le temps par image sur un vrai téléphone (rendu logiciel seulement) ; Firefox et WebKit (la CI de la PR lance le sous-ensemble
multi-navigateurs, la CI complète de `main` tout) ; sur la construction finale (après la fusion de `main`, retouche 40b), relancés en local : tous les tests unitaires
(`npx vitest run --project sqlite` : 200 fichiers, 2 692 tests), `typecheck`, et les e2e `decor`, `perf`, `socle`, `graphismes`, `thumbnails`, `vitrine*` (33 passés) ; le
reste des e2e par la CI de la PR.

## 8. Pour Nathan (décisions et questions)

1. **La densité du décor** : ≈ 370 éléments par circuit (≈ 29 000 triangles) contre ≈ 750 (≈ 51 000) pour le décor d'avant — des pièces plus détaillées (B
   allégé), à hauteur de route, mais moins nombreuses, pour que la construction de la scène ne coûte pas plus qu'avant (§ 5). Le Stade, le Rallye et la Nuit
   paraissent encore clairsemés en course. **Plus de décor** (la règle `densite` de chaque thème, une ligne) coûterait de la construction (≈ 1 ms par
   millier de triangles sans ralentissement, ≈ ×6 au profil téléphone) : à dire au vu du téléphone.
2. **Construction de la scène** : −8 % en moyenne, mais **le Canyon (+8 %) et la Ville (+7 %) un peu au-dessus du lot 43**, dans l'écart entre deux essais
   (§ 5). Accepter, ou retirer un peu de décor à ces deux thèmes.
3. **Miniatures avec le décor** (ma proposition) : le même décor que la scène, le sol relevé compris ; coût : le morceau du thème chargé avant de dessiner (≈ 6 ko
   la première fois, rien ensuite) et un peu de construction (le décor n'est construit que près de la portion montrée). `THUMB_VERSION` 5 : les miniatures
   déjà gardées par les navigateurs sont refaites une fois. Sans le décor, elles montreraient un sol nu à côté d'une scène habillée.
4. **La ligne « décor 3D à la demande »** n'entre pas dans le grand tableau de `budgets.md` sans toucher `apps/portail/test/budgets.test.ts` (zone partagée) :
   proposition pour un lot de plateforme — ajouter `"track.decor": limite(PERF, /"décor 3D à la demande, les huit thèmes \(gzip\)"\)\.toBeLessThan\(([\d_]+)\)/)`
   à son `ATTENDUS` et la ligne au tableau. En attendant, la ligne est dans la section du lot 44 et `perf.spec.ts` l'impose.
5. **Le sol relevé près des sauts et des blocs sans rebords reste au fond** (la voiture qui tombe ne doit pas traverser un talus, le vide d'un saut doit se voir) :
   sur la Nuit (70 % de blocs sans rebords possibles) et le Canyon (sauts), il y a donc moins de talus et moins de décor ; à juger.
6. **La tribune du départ** est celle de B (gradins, spectateurs en boîtes), posée du côté libre de la piste ; son toit est crème (il était à la livrée orange
   dans la vitrine : l'orange est à la voiture).
7. **Le code mort retiré** : les directions A, B, C, le mélange, la « direction O », leur planche et leurs outils (`captures-lot38`, `mesure-lot38`) ; les
   README des lots 38 et 38b citent encore ces fichiers (historique, non réécrit) ; `direction.md` (la règle) est mis à jour aux trois endroits qui les citaient.
8. **Pour le lot 46 (vie et ciel, en parallèle)** : la foule, les drapeaux et les écrans de la tribune sont dans `decor/commun.ts` (`tribune`, crochets
   `Calques.foule`, `drapeaux`, `ecrans`), plus dans `decorP1.ts` ; `vie.ts` lit les noms des écrans dans `scene/logos.ts` (une ligne d'import changée).
