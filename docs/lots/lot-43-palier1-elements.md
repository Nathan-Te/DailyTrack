# Lot 43 — Track : le palier 1 en jeu, éléments de course et lumière

Branche `claude/quirky-cerf-e8ynxy` (nom imposé par la session ; le lot prévoyait `lot-43-palier1-elements`, d'où l'étiquette `jeu:track` sur la PR
pour le job `zones` ; PR [#123](https://github.com/Nathan-Te/DailyTrack/pull/123)), partie de `main` à `f15d31d` (lots 39 et 40 fusionnés). Zones : `apps/web/**`, `docs/lots/**`, les lignes de Track de
`docs/plateforme/budgets.md`, ses clés de catalogue (et `docs/plateforme/traductions.md` régénéré), ses deux lignes de `packages/ui/test/applications.ts`.
**Rien dans `sim`** : golden, `SIM_VERSION`, `GENERATOR_VERSION`, rediffusions, classements, identifiants de circuit inchangés. La voiture et le Garage
ne sont pas touchés.

## En deux phrases

**Le palier 1 est la scène du jeu** — course, accueil, Salon, spectateur, revoir le meilleur tour, miniatures : portiques « cartouches » (départ avec
**feux qui s'allument un à un pendant le décompte**, arrivée), arches gonflables aux points de contrôle, plaques et turbos, panneaux de virage et
**panneaux de distance** (3, 2, 1 barres) avant les virages serrés, **sponsors fictifs** discrets, rebords du thème (légers), lumière de C (ciel, brume,
soleil ou lune posé d'où vient la lumière, ombres posées devant la voiture), horizons du thème ; l'orange est à la voiture seule. **L'ancienne scène
(« existant ») sort du premier chargement** : elle n'est plus que dans la vitrine et sous `?palier=existant` (recette et aperçus), chargée à la demande.

## À tester (aperçu de la PR, au téléphone ; le lien est commenté sur la PR)

Stade et Nuit d'abord : ce sont les deux thèmes que le lot 38b trouvait trop proches.

| Thème | Palier 1 (le jeu) | L'existant, pour comparer |
|---|---|---|
| **Stade** (8/10) | `/track/?seed=2026-10-08&home=0` | `/track/?seed=2026-10-08&home=0&palier=existant` |
| **Nuit** (14/10) | `/track/?seed=2026-10-14&home=0` | `/track/?seed=2026-10-14&home=0&palier=existant` |
| Rallye (21/10) | `/track/?seed=2026-10-21&home=0` | `…&palier=existant` |
| Banquise (10/10, imposée) | `/track/?seed=2026-10-10&theme=banquise&home=0` | `…&palier=existant` |
| Campagne (14/10, imposée) | `/track/?seed=2026-10-14&theme=campagne&home=0` | `…&palier=existant` |
| Canyon (6/10) | `/track/?seed=2026-10-06&home=0` | `…&palier=existant` |
| Col alpin (12/10) | `/track/?seed=2026-10-12&home=0` | `…&palier=existant` |
| Ville (16/10) | `/track/?seed=2026-10-16&home=0` | `…&palier=existant` |

- `/track/?home=0` (le circuit du jour) et `/track/?home=0&palier=existant` : les **feux** au départ (un à un de gauche à droite, verts au « PARTEZ ! »),
  les **panneaux de distance** avant un virage serré, les **sponsors** (discrets, jamais plus lisibles qu'un panneau de course), l'arrivée.
- `/track/?mode=salon&api=demo` : le Salon (feux compris), puis une bascule de session.
- **Images par seconde** : ajouter `&debug` (compteur en bas à gauche : images par seconde et pire image ; `&fps=0` le coupe), au **Pixel 7**, sur
  Stade, Nuit et Ville, au palier 1 puis avec `&palier=existant`. Le rendu logiciel de la CI ne dit rien d'un téléphone : **à mesurer chez toi**.

## 1. Ce qui a bougé dans le code

- **`src/scene/composerP1.ts` (nouveau, premier chargement)** : `composerP1`, la scène du palier 1, branchée comme palier par défaut du socle
  (`PALIER_DEFAUT = "P1"`, `socle.ts`) ; `geometrieP1` construit les mêmes formes sans DOM (tests de pose, de couleurs, de feux). Lumière de C construite
  directement (ciel en dégradé, brume, hémisphère, ambiante, soleil), soleil ou lune **posé d'où vient la lumière** (`directionSoleil`), ombres : même
  carte (512 / 1024, ±42 m) mais **posée 24 m devant la voiture** (`OMBRES_AVANT`, là où regarde la caméra), phares la nuit, horizons du thème (`HORIZONS`).
  La nuit : flaques de lumière sous les lampadaires de piste et quatre lampes réelles posées sur les plus proches de la voiture. Miniatures des thèmes
  sombres : lumière relevée et sol de l'existant (une miniature se lit en petit), comme avant.
- **`src/scene/palier1.ts` (réécrit, premier chargement)** : les éléments, paramétrés par thème — `portiqueDepartP` (feux `FeuxDepart` pendus sous la
  poutre, bandeau du catalogue, ligne crème et encre au sol), `arriveeP`, `porteP` (arche gonflable de B, pieds jusqu'au sol), `plaqueP`, `turboP`,
  `coupureP`, `panneauP`, `panneauxDistanceP`, `rythmeP` (repères et arches des portions rapides seulement), `sponsorsRebordsP`, `eclairagePisteP`
  (lampadaires de la Nuit sur le chapeau des rebords) ; `paletteP1`, `routeP`, `VIBREURS_P1`, `REBORDS_P1`, `ROUGE_PISTE`. Tout passe par `placed`
  (règles du lot 37). Le palier 2 (« géométrie ») y arrive par le contexte (`FINITION_ELEMENTS`, `finition.ts`) : `palier1.ts` n'importe pas `finition.ts`.
- **`src/scene/piste.ts` (nouveau)** : la piste de A (couleurs de route, rebord, vibreur, ciel, sol par thème : `PISTE_A`) et les rebords de B, **légers
  au palier 1** (`rebordLeger` : ≤ 2 triangles par mètre, le profil du thème — béton, pneus, bois, roche, glissière ; le lot 38 en dessinait jusqu'à 14) ;
  les profils complets restent à la vitrine (injectés par `composerPalier.ts`). `directionA.ts` et `directionB.ts` en réexportent ce qu'ils avaient.
- **`src/scene/route.ts`** : la route du jeu ; **garde-corps de la Ville porté** (`gardeCorps` : deux lisses et des montants jusqu'à la hauteur de la
  simulation, lot 37).
- **`src/scene/sponsors.ts` (nouveau)** : **la liste des sponsors fictifs, dans un seul fichier** — huit noms inventés (BOULON & FILS, PNEUS GRAVILLON,
  CAFÉ DU VIRAGE, VROMBEX, TOUR DE CLÉ, PISTALO, GOMMIRA, BIDONIX), un atlas dessiné une fois (1024 × 192), atténués (`ATTENUATION`) ; exempté du test des
  chaînes en dur avec sa raison (`packages/ui/test/applications.ts`).
- **`src/feux.ts` (nouveau, pur)** : `etatFeux(phase, restant, total)` — éteints au début du décompte, une colonne de plus à chaque cinquième, toutes
  rouges avant la fin, vertes au départ ; `main.ts` le passe à la scène à chaque image (`TrackScene.feux`), qui ne repeint que si l'état change (les
  sommets des lampes dans le calque lumineux : aucun maillage, aucun appel de plus). **Affichage seulement** : le départ ne dépend que du décompte.
- **`src/signage.ts`** : `distanceSigns` — avant chaque virage serré (sévérité 3), en remontant tous les `PAS_DISTANCE` = 28 m depuis son panneau, du
  même côté, sur les blocs droits fermés ; **depuis la géométrie du circuit, sans le générateur** (`packages/sim/test/legerete.test.ts` et
  `test/socle.test.ts`).
- **`src/scene/existant.ts` (nouveau, à la demande)** : l'ancienne scène entière (route, arches, portes, panneaux sur poteau, ciel, montagnes,
  `trackGeometry`, `composerExistant`), sortie de `trackMesh.ts`, `trackProps.ts` et `socle.ts` ; elle se branche en se chargeant
  (`PAS_DU_JEU.existant`, enregistré par `main.ts`). `trackMesh.ts` garde les palettes, `LOOKS`, le décor de fond (`decorGeometry` : **mêmes tirages au
  sort** qu'avant) ; `trackProps.ts` ne garde que les glyphes des panneaux.
- **`src/access.ts`** : `palierDemande` — `?palier=existant` hors production seulement (jamais avec `?prod` ni en construction de production) ; option de
  `/admin/` (« Scène existante »).
- **`src/compteurImages.ts` (nouveau, à la demande sous `?debug`)** : le compteur d'images par seconde (et la pire image) ; `?debug&fps=0` le coupe.
- **`src/main.ts`** : scène au palier par défaut, `textesScene()` (les bandeaux « DÉPART » / « ARRIVÉE » viennent du catalogue `course.portique.*`, fr
  et en ; la scène se reconstruit hors course si la langue change), feux à chaque image, `__cdj.feux`, `__cdj.socle.constructionMs`.
- **Vitrine** : la colonne « Existant (avant le lot 43) » charge `existant.ts` à la demande ; le palier 1 de la vitrine utilise les éléments du jeu
  (`decorP1.ts` garde le décor de la vitrine : tribunes, écrans) ; `poids-parties.mjs` à jour.
- **Miniatures** : `THUMB_VERSION` 4 (leur aspect change) ; le repli 2D prend les couleurs du palier 1 (`paletteP1`).

## 2. Les éléments, thème par thème (corrections du 38b comprises)

- **Socles jusqu'au sol** : portiques, panneaux, arches gonflables, piliers d'arches de rythme ont leurs pieds sur le sol ou le chapeau d'un rebord
  (≤ 5 cm, test de pose sur 64 circuits : **0 faute** au palier 1 comme à l'existant).
- **Mur de pneus léger** (Stade, Rallye) : bandes noires alternées, liseré blanc, ≤ 2 triangles par mètre.
- **Route grise sous lumière chaude** (Désert, Campagne : `ROUTE_SOUS_LUMIERE_CHAUDE`) ; **le Canyon garde sa route rouge-brun**.
- **Lampadaires de la Nuit** : sur le chapeau des rebords, ils suivent la piste (potence à 7,2 m, au-dessus du passage) ; leurs flaques au sol.
- **Rebords** : le profil de B par thème, en version légère ; la congère de la Banquise garde le béton.
- **L'orange est à la voiture seule** : rouge de la piste `ROUGE_PISTE` = `0xc01818` (ΔE 15,6 avec l'orange `0xe8552d`, 18 avec le grenat de la palette du
  lot 40), vibreurs rouge et blanc partout où ils étaient orange ou rouge-orangé (Rallye, Campagne, Stade, Désert, Neige, Col), roche du Canyon `0x7a3a2a`,
  feux rouges `0xff1f4f` ; **la livrée orange de la marque ne reste qu'en hauteur**, sur le portique de départ (> 4 m au-dessus de la route).
- **Stade et Nuit, d'un coup d'œil** (chiffré, `test/palier1.test.ts`) : écart de luminance de l'horizon > 0,7, zénith 50 fois plus clair au Stade,
  contraste de la route 1,73, soleil 9 fois plus fort, hémisphère 4 fois.

## 3. Images avant / après

**Outil** (hors CI) : `e2e/captures-lot43.spec.ts` — la comparaison du lot 39, **rejouée** : `main` (`f15d31d`) servi à côté pour l'« avant », la branche pour
l'« après » ; un circuit de chaque thème (les jours du lot 37), le **départ**, le **premier tremplin ou bosse**, un **virage serré**, l'**arrivée** et la
**miniature** ; plus l'**accueil** (Ville) et le **Salon** (démo, une session fixe). Ici les différences sont voulues : elles sont chiffrées
(`docs/lots/lot-43/comparaison.txt`) et montrées en planches.

**Planches** (avant à gauche, après à droite) : [Stade](lot-43/planches/stade.jpg) · [Nuit](lot-43/planches/nuit.jpg) ·
[Rallye](lot-43/planches/rallye.jpg) · [Banquise](lot-43/planches/banquise.jpg) · [Campagne](lot-43/planches/campagne.jpg) ·
[Canyon](lot-43/planches/canyon.jpg) · [Col alpin](lot-43/planches/col.jpg) · [Ville](lot-43/planches/ville.jpg) ·
[Accueil et Salon](lot-43/planches/accueil-salon.jpg). Images seules : `docs/lots/lot-43/avant/`, `docs/lots/lot-43/apres/`.

**Un défaut de l'outil du lot 39, trouvé et corrigé ici** : en pas à pas (`__cdj.manual`), le jeu **ne dessine pas la scène** (seulement la simulation et
l'interface). L'outil du lot 39 restait en pas à pas : ses images « tremplin », « virage » et « arrivée » montraient **l'image du décompte** (la voiture au
départ), avec le chrono et la vitesse du bon moment par-dessus. La preuve « 0 pixel différent » du lot 39 vaut donc pour le départ, les miniatures,
l'accueil et le Salon, **pas pour les trois autres moments** (la comparaison au pixel du lot 40, `captures-lot40`, n'a pas ce défaut : elle met déjà en
pause avant de capturer). L'outil du lot 43 fait de même : pause au pas voulu, retour au rendu normal (la scène seule, interface masquée) ; la dernière
seconde avance par pas de 2 (une image à 60 i/s), pour que la caméra suive comme en jeu. `captures-lot39.spec.ts` n'est pas modifié (outil d'un lot fini).

## 4. Budget (décision de Nathan du 23/10/2026)

Mesure : `npm run build && node scripts/budgets.mjs` (la mesure unique `mesureTrack`), `main` à `f15d31d` construit à part, puis la branche.

| Ligne | `main` | Lot 43 | Écart | Plafond avant → après | Marge |
|---|---|---|---|---|---|
| JS + CSS du premier chargement | 259 323 | 268 789 | **+9 466** | 276 600 → **291 600** | 22 811 |
| JS | 247 911 | 257 377 | +9 466 | 265 200 → **280 200** | 22 823 |
| hors three.js | 115 137 | 124 512 | +9 375 | 132 500 → **147 500** | 22 988 |
| CSS | 11 412 | 11 412 | 0 | — | — |
| catalogue anglais (à la demande) | 7 297 | 7 315 | +18 (les deux bandeaux) | 8 000 | 685 |
| page d'admin (hors premier chargement) | 10 885 | 10 907 | +22 (la case « Scène existante ») | 12 500 | 1 593 |
| fils de travail, polices | — | inchangés | 0 | — | — |

- **+9,5 ko net**, un peu au-dessus de la cible de 7 à 9 ko, **sous le plafond relevé de 15 ko** (`perf.spec.ts`, `budgets.md` : lignes JS, hors three.js
  et JS + CSS relevées avec la décision datée ; `apps/portail/test/budgets.test.ts` passe sans changement).
- **Ce qui entre** : `composerP1.ts`, `palier1.ts`, `piste.ts`, `sponsors.ts`, `feux.ts`. **Ce qui sort** : l'ancienne scène (`existant.ts`, ≈ 6 ko
  compressés, chargée à la demande sous `?palier=existant` et par la vitrine).
- **Pour tenir** (premier jet : +11,3 ko) : variantes de route mortes retirées (la route du palier 1 est assemblée pièce par pièce), enregistrement de
  l'existant déplacé dans `main.ts` (déclaré ailleurs, il tirait un morceau d'aide au préchargement dans le premier chargement), les données des directions
  du lot 38 séparées des thèmes, les profils complets des rebords injectés par la vitrine seulement.
- **Ligne « décor 3D à la demande » (16 ko)** : pour le lot suivant (le décor du palier 1), hors du premier chargement ; pas créée ici (aucun fichier
  encore, et la ligne du tableau demande un test qui l'impose).
- **Rien du lot 36 ne revient** : ni le générateur, ni le Salon dans le premier chargement (`perf.spec.ts`, `legerete.test.ts`, et `test/socle.test.ts`
  suit le graphe des imports statiques depuis `main.ts` : ni l'existant, ni la vitrine, ni `decorP1`, `composerPalier`, les directions, ni un module des pas).

## 5. Performance (profil téléphone : 844 × 390 @2, processeur ×4, qualité 2, rendu logiciel)

`MESURE=1 PERF_OUT=docs/lots/lot-43/mesure.json npx playwright test mesure-lot43 --project=chromium` : **la même construction**, palier 1 par défaut contre
`?palier=existant` ; chiffres bruts : `docs/lots/lot-43/mesure.json`.

| Thème | Appels de rendu existant → P1 | Triangles existant → P1 | Écart | Construction (ms, 1ʳᵉ scène, moyenne accueil et départ) |
|---|---|---|---|---|
| Stade | 34 → **30** | 45 128 → 47 478 | +5,2 % | 416 → 496 (+19 %) |
| Rallye | 34 → **30** | 58 216 → 60 712 | +4,3 % | 427 → 501 (+17 %) |
| Banquise | 31 → **29** | 133 416 → 135 523 | +1,6 % | 758 → 786 (+4 %) |
| Nuit | 37 → **36** | 96 654 → 100 172 | +3,6 % | 592 → 692 (+17 %) |
| Campagne | 33 → **29** | 78 872 → 82 112 | +4,1 % | 494 → 569 (+15 %) |
| Canyon | 33 → **29** | 63 820 → 66 043 | +3,5 % | 410 → 579 (+41 %, accueil 642 / départ 516 : bruit) |
| Col alpin | 35 → **30** | 79 578 → 81 559 | +2,5 % | 536 → 602 (+12 %) |
| Ville | 35 → **31** | 83 726 → 84 834 | +1,3 % | 581 → 646 (+11 %) |

- **Appels de rendu : moins partout** (−1 à −5). **Triangles : +1,3 à +5,2 %** — **au-dessus de l'existant**, contrairement à l'énoncé (« ≤ existant »).
  Ce qu'ils paient : les feux, les panneaux de distance, les sponsors, les arches gonflables, les lampadaires de piste, les rebords du thème. Ce qui a été
  fait pour s'en approcher (premier jet : jusqu'à ×2) : rebords légers, rebords, rythme et lampadaires dans le calque de la route (ils ne projettent pas
  d'ombre : la passe d'ombre ne les redessine pas), bordures plus simples, horizons réduits, moins de poteaux de rythme, vibreurs sans lèvres. Les
  triangles comptés sont ceux de l'image **et de la passe d'ombre** ; à 47 000 – 135 000 par image, quelques milliers de plus ne se voient pas sur un
  téléphone récent, mais **c'est à décider par Nathan** (§ 8).
- **Construction de la scène** : la **première** (page chargée, code froid) prend **+4 à +19 %** (Canyon +41 % sur deux mesures bruitées), soit ≈ +80 ms
  à processeur ×4 ; dedans, l'atlas des sponsors (dessiné une fois : 22 ms à ×4). **À chaud** (le même composeur appelé plusieurs fois, sans
  ralentissement, profil CDP) : **palier 1 102 ms contre 114 ms pour l'existant** (Nuit) — le palier 1 est plus rapide une fois le code compilé ;
  l'écart à froid est le code de plus à compiler (le palier 1 a plus de fonctions que l'existant). **Bascule du Salon** (scène construite derrière le
  classement final, trois essais) : construction existant 280 / 261 / 369 ms, palier 1 306 / 256 / 461 ms ; bascule 8,4 / 2,6 / 9,4 ms contre
  6,0 / 20,6 / 13,6 ms — **dans le bruit**, aucune régression visible au Salon.
- **Temps par image** : non mesurable ici (rendu logiciel) : **« À tester » au Pixel 7** avec le compteur de `?debug`. Rien ne s'ajoute par image hors
  du rendu : les feux ne repeignent qu'au changement d'état (six fois par course), les lampes de la Nuit se posent sur les plus proches de la voiture
  (une boucle sur les sources, comme l'existant).
- **`QualityGovernor`** : en place dans le palier 1 (`setQuality` 0–2 : ombres 0 / 512 / 1024, halos, phares, décor, décor dense, collines).

## 6. Tests

- `test/palier1.test.ts` (nouveau, 15 tests) : feux (suivent le décompte ; cinq colonnes de deux lampes ; **un à un de gauche à droite** ; repeindre ne
  touche que leurs sommets ; lecture seule), **ΔE 2000 > 12 avec l'orange pour chaque élément de piste de chaque thème** (route, rebords, vibreurs, plaques,
  portes, panneaux, feux, sol), livrée orange seulement en hauteur, `ROUGE_PISTE` et sponsors, **Stade et Nuit distincts** (chiffré), panneaux de distance
  (3, 2, 1 barres, pas de 28 m, du même côté, jamais au départ ni avant un virage ample, sans le générateur ; posés dans le jeu), sponsors (6 à 10 noms
  distincts, moins contrastés et plus petits que les panneaux de course), rebords ≤ 2 triangles par mètre, garde-corps de la Ville, `?palier=existant`.
- `test/decorPose.test.ts` : la pose du lot 37 sur 64 circuits, **palier 1 et existant : 0 faute** (`releverP1`, `test/decorChecks.ts`).
- `test/socle.test.ts` : P1 par défaut, existant dans le registre, **graphe des imports statiques depuis `main.ts`** (rien de l'existant, de la vitrine ni
  des pas dans le premier chargement).
- `test/voitureModeles.test.ts` : la palette du lot 40 **contre la scène du palier 1** (plus d'exception pour l'orange).
- `e2e/socle.spec.ts` (réécrit) : l'existant demandé en course se charge à la demande et n'est appliqué qu'à la pause ; `?palier=existant` (et jamais avec
  `?prod`) ; **les feux suivent le décompte** dans le vrai jeu, verts au départ, éteints quand on recommence.
- Outils (hors CI, `durees.json` à 0) : `captures-lot43.spec.ts`, `mesure-lot43.spec.ts`.

## 7. Vérifié, non vérifié

**Vérifié** (en local) : `npm run typecheck` ; `npx vitest run` (les deux projets : 225 fichiers, 2 972 tests, tous verts) ; e2e sur Chromium, un à la
fois, des specs `socle`, `thumbnails`, `vitrine` (et `vitrine-voiture`), `perf`, `scene`, `graphismes`, `daily`, `replay`, `salon`, `watch`, `admin`,
`vitesse`, `juice`, `cameras`, `accessibilite`, `mobile`, `hud-compact`, `futur` (et ce que leurs noms attrapent : 390 tests, 288 passés, 100 sautés
— outils de capture et de mesure —, 2 échecs **dus au lot et corrigés** : le compteur d'images de `?debug` était chargé par un `await import()` en tête
de `main.ts`, ce qui retardait `__cdj` d'un aller-retour — `tactile.spec.ts` le lit dès le chargement ; il se charge maintenant sans attente, et
`juice`, `tactile` (le test en cause), `socle`, `perf` repassent : 19 sur 19) ; budget par `node scripts/budgets.mjs` et
`apps/portail/test/budgets.test.ts` ; zones de la PR (`scripts/zones-jeu.mjs --etiquettes '["jeu:track"]'` : 154 fichiers, tous dans les zones de
Track) ; captures avant / après et planches ; mesures au profil téléphone ; golden et identifiants de circuit (aucun fichier de `packages/sim`
touché) ; les feux s'allument de gauche à droite (capture du décompte, et `test/palier1.test.ts`, qui échoue avec l'ordre inverse).

**Non vérifié** : le temps par image sur un vrai téléphone (rendu logiciel seulement) ; Firefox et WebKit (la CI de la PR lance le sous-ensemble
multi-navigateurs, la CI complète de `main` tout) ; le rendu sur un écran réel des sponsors (lisibilité « discrète » jugée sur captures).

## 8. Pour Nathan (décisions et questions)

1. **Triangles +1,3 à +5,2 %** au-dessus de l'existant (appels de rendu en baisse partout). Accepter, ou demander un lot qui en retire (pistes : arches
   gonflables à 6 côtés au lieu de 8, moins de lampadaires de piste la nuit, sponsors des rebords seulement au départ).
2. **Première construction de la scène +4 à +19 %** (code froid ; plus rapide que l'existant à chaud ; Salon dans le bruit). Accepter, ou viser
   l'atlas des sponsors dessiné après la première image (≈ 22 ms à ×4).
3. **Budget +9 466 o**, 466 o au-dessus de la cible de 7 à 9 ko (sous le plafond de +15 ko).
4. **Rebords légers au palier 1** (≤ 2 triangles par mètre) : les profils complets du 38b restent à la vitrine ; à reprendre au palier 2 ?
5. **Arches de rythme et repères seulement dans les portions rapides** (règle du lot 37) ; **le décor de fond est celui d'aujourd'hui** (le décor du
   palier 1 et le sol relevé : lot suivant, décision 13).
6. **Le défaut de l'outil de captures du lot 39** (§ 3) : la preuve au pixel du lot 39 ne couvrait pas les moments « tremplin », « virage » et
   « arrivée ». Le lot 43 change la scène de toute façon ; à savoir pour les prochains « rien ne change à l'écran ».
7. **La lumière des lampadaires de la Nuit teinte la route en ambre** près des lampes (planche Nuit : virage, arrivée) : c'est la couleur et la
   portée des lampes de C (`THEMES_C.nuit.lampes`), pas une couleur de la piste — le test ΔE porte sur les couleurs, pas sur la lumière. La voiture
   reste lisible sur les captures ; à juger au téléphone, et à baisser (portée ou teinte plus froide) si elle se confond avec la voiture.
8. `CLAUDE.md` racine dit encore « Track a ≈ 21,8 ko de marge » (zone partagée, non modifiée) : la marge est maintenant de 22 811 o avec le plafond
   relevé — à mettre à jour par un lot de plateforme.
