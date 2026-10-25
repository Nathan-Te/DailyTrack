# Lot 48 — Track : l'herbe de la Campagne, une vraie surface de course

Retour de Nathan (25/10/2026) : sur la Campagne, l'herbe des portions de piste est la même que celle d'autour — **on ne voit pas la piste**, et **on ne s'amuse pas dessus** (elle freine, elle ne fait que ralentir). Objet : une **herbe de course** qu'on reconnaît d'un coup d'œil et sur laquelle on glisse plutôt qu'on ne freine, **à partir d'une date de bascule**.

Zones : `packages/sim/**`, `apps/web/**`, `apps/api/scripts/measure-generator.ts`, `docs/lots/**`, `docs/orchestration.md`, les lignes de Track de `docs/plateforme/budgets.md`, ses clés de catalogue (et `docs/plateforme/traductions.md` régénéré), son entrée de `durees.json`. **Aucune zone partagée touchée.**

## 1. L'existant (mesuré avant de coder)

- **L'herbe (`grass`) a deux usages** : (1) **revêtement de bloc** (`S/h`) — dans le générateur, seulement les **zones de revêtement de la Campagne** (2 à 3 zones de 3 à 6 blocs, herbe 1 fois sur 3, terre 2 fois sur 3) ; à la main, le circuit d'essai et `?scenario=surfaces` ; (2) **bas-côté** (`~h`, lot 21) : Stade 85 %, Campagne 75 % des blocs qui peuvent en porter. **Une seule table** pour les deux : `SURFACES.grass` = adhérence 0,5, motricité 0,55, **roulement 7 m/s²** → pointe ≈ **27 m/s** à plat (57 % de la route), 0 → 100 km/h jamais atteint.
- **Rendu** : bloc d'herbe `0x58a340` / `0x4e9638`, à côté d'un sol `#6fb44c` / `#5c9e3c` et d'une herbe haute de bas-côté `0x6f9a3a` : **ΔE 2000 de 1,7 à 12** entre l'herbe de la piste et ce qui l'entoure (sol relevé 1,7 ; sol lointain 1,8 et 5,5 ; bas-côtés 5,0 à 7,3) — c'est le « on ne voit pas la piste ».
- **20 circuits de Campagne récents** (du 03/11 en remontant, v15 et v16 ; `HERBE=1 npm run measure:generator`, section 4) : **2,5 % des blocs** en herbe, **8 circuits sur 20** en ont, **1,3 s** passée dessus en moyenne (jusqu'à 7,8 s), **0,31 s perdue** en moyenne par le pilote d'auteur (jusqu'à **2,75 s** le 25/10, 14 % du circuit en herbe ; le même circuit avec la route à la place) — rien à y gagner, seulement à y perdre.

## 2. Le comportement : « herbe de course » (`turf`, notation `S/z`)

**Une surface nouvelle, avec un identifiant nouveau.** L'herbe d'avant ne change pas (ni ses valeurs, ni les bas-côtés `~h`, qui punissent toujours la sortie de piste). **`SIM_VERSION` reste 14** (décision du lot, à confirmer) : aucun circuit enregistré n'a de `z`, donc aucun résultat ne change ; l'incrémenter aurait rendu **injouables toutes les rediffusions gardées** (`replay.ts` refuse une autre version : classements, « revoir le meilleur tour », fantômes). Règle écrite dans `packages/sim/CLAUDE.md` et `constants.ts` : *une surface nouvelle qu'aucun ancien circuit n'utilise ne change pas `SIM_VERSION` ; un ancien paramètre changé, toujours.* Dans `car.ts`, tout le nouveau passe par des branches `turf > 0` : les autres revêtements font exactement les calculs d'avant.

| Clé (`CarParams`, toutes dans `?debug&tune`) | Valeur | Effet |
|---|---|---|
| `turfGrip` | 0,8 | adhérence latérale (× route) — aussi `SURFACES.turf.grip`, lu par le pilote et le générateur |
| `turfTraction` | 0,85 | motricité et freinage : accélération un peu plus molle |
| `turfRolling` | 0,6 m/s² | roulement : **pointe ≈ 47 m/s** (98 % de la route, contre 27 m/s sur l'herbe d'avant) |
| `turfRear` | 0,9 | l'essieu arrière tient moins que l'avant : **l'arrière décroche le premier** |
| `turfDriftSlip` | 0,12 | l'arrière qui glisse au-delà (direction tenue, > 15 m/s) **déclenche le dérapage sans le frein** : la glisse se tient alors à la direction (`driftAngle`, comme le dérapage au frein du lot 7) |
| `turfSlideDrag` | 0,4 | perte en glisse = 40 % de celle de la route : **un dérapage tenu se paie peu** |
| `turfSlideFree`, `turfScrub` | 0,2 ; 60 | au-delà d'une dérive de 0,2 (≈ 11,5°), un coût en carré : **surbraquer coûte cher** |

Passage route ↔ herbe : chaque roue lit son revêtement (comme toujours), le dérapage s'éteint en douceur une fois sur la route (`driftHold`) ; aucun à-coup mesuré.

### Tests de comportement chiffrés (`packages/sim/test/herbe.test.ts`)

| Test | Seuil | Mesuré |
|---|---|---|
| pointe sur l'herbe de course / route | 0,97 – 0,99 | 47,03 / 48,00 m/s (l'herbe d'avant : 27,1, < 0,6) |
| 0 → 100 km/h / route | 1,1 – 1,3 | 1,95 / 1,59 s |
| 128 m d'herbe à fond (pilote) | < 0,1 s perdue | +0,05 s (l'herbe d'avant : +0,91 s, > 0,5) |
| **seuil de glisse** : accélération latérale à 3° de dérive | < 0,85 × route | 21,2 contre 26,5 m/s² (0,80) |
| l'arrière décroche le premier | glissement arrière ÷ avant > celui de la route | vérifié |
| **la glisse se tient à la direction** : volant à fond 5 s à 44 m/s | dérive < 21°, > 12°, dérapage tenu > 4 s, < 2° 0,5 s après avoir lâché | 19,5° max, jamais de tête-à-queue |
| volant doux (30 %) 3 s | pas de dérapage, dérive < 5° | vérifié |
| **virage ample bien négocié** (pilote d'auteur, `L3`) | < 0,25 s perdue (l'herbe d'avant : > 1 s) | +0,16 s (herbe d'avant +1,54) ; `L3 S R3` +0,32 s (< 0,5 ; herbe d'avant +3,82) |
| virage large, serré | < 0,5 s chacun | +0,36 s, +0,32 s |
| **surbraquer** : quart de tour à 44 m/s | dosé (1/3) < 1 m/s perdu ; à fond > 3 × dosé et > 2 × la route à fond ; à fond tourne plus vite que sur la route | dosé 44,7 → 44,7 ; à fond → 34,7 m/s (route : 43,0) ; 1,68 s contre 1,86 s |
| dérapage au frein tenu (90°) | < 1,3 × le même sur la route | 7,4 contre 7,6 m/s perdus |
| passages route ↔ herbe | ligne droite à 46 m/s : < 3 m/s², aucun lacet ; en virage : lacet < 1,5 × le même virage sur l'herbe seule | vérifié |
| **aucun blocage** | repart à l'arrêt volant à fond, recule ; pilote au scénario `herbe` à 4 adhérences ; 60 s de commandes au hasard : jamais 1 s à l'arrêt en accélérant | vérifié |
| bas-côté d'herbe | il punit toujours (< 30 m/s après 10 s) | 28,2 m/s |

## 3. Le rendu : on voit la piste

- **L'herbe de course** (`SURFACE_COLORS.turf` `0x8fe04a` / `0x8adb45`) : vert tendre, plus clair et plus saturé que tout sol de la Campagne ; **tonte en bandes** d'≈ 3,5 m **dans le sens de la course** (une sur deux assombrie de 10 %, `TONTE_SOMBRE`) ; **bord net** : une **ligne blanche** de 0,35 m de chaque côté (`BORD_HERBE`, pas de vibreur sur l'herbe). Elles suivent l'arc des virages et les transitions de largeur (`addTurfMarks`, `scene/route.ts`).
- **Autour, plus sombre, plus rugueux, plus haut** (toute la Campagne, rendu seulement, jours passés compris : aucun résultat ne change) : sols assombris (`THEMES_C.campagne.sol` `#5a8f3a` / `#4c7f31`, `PISTE_A.campagne.sol` `#3f7d3a` / `#38733a`, `floorA/B`), herbe haute des bas-côtés plus sombre (`HERBE_HAUTE` `0x557a2f` / `0x4e722b`) et à brins deux fois plus hauts, **herbes folles** dans le décor (`decor/campagne.ts`, anneau proche et remplissage). `THUMB_VERSION` 6 (miniatures refaites).
- **ΔE 2000, vérifié par le calcul** (`apps/web/test/herbe.test.ts`, sur la Campagne et **tout thème qui l'utilise**, trouvé par `themeOfVersion` et les figures) : chacune des quatre couleurs de l'herbe de course (deux tons, deux bandes de tonte) contre le sol relevé (22,4 à 28,7), le sol lointain (16,6 à 28,8), le sol du palier 1 (24,3 à 34,7), le sol de l'existant (13,2 à 22,9) et les bas-côtés (23,8 à 33,3) : **minimum 13,2 > 12** ; contre l'orange de Track ≥ 61 ; contre les huit livrées ≥ 18 ; ligne blanche contre l'herbe > 20 ; deux tons contre l'herbe d'avant ≥ 16. Le sol du palier 1 a été choisi aussi à plus de 12 des livrées (l'olive était à 8,4 avec un premier choix : test `voitureModeles.test.ts`).
- **Traces** : gazon arraché (`SKID_STYLE.turf`, toutes qualités). **Brins d'herbe** au dérapage seulement (`DUST.turf`, quand la voiture glisse : un revêtement de course ne fume pas en ligne droite) ; ils suivent le réglage des particules (`QualityGovernor`, pas un palier). Voix propre (`SURFACE_SOUNDS.turf`), bandeau « Herbe de course » / « Racing turf ».

## 4. Les circuits : générateur v17 à partir du mercredi 04/11/2026

- **`BASCULE_LOT_48` = 04/11/2026** (`dailyId.ts`, constante unique, **à confirmer par Nathan selon la date de mise en production** : le premier jour ni passé, ni en cours, ni joué à ce moment-là) ; `GENERATOR_VERSION` = **17** ; `generatorVersionOf` : 15 avant le 28/10, **16 du 28/10 au 03/11**, 17 ensuite ; l'identifiant porte la version (`jour-2026-11-04-g17`). Le Salon suit la dernière version dès la mise en production (`salon-…-g17`).
- **Campagne v17** (`themeOfVersion`, `themes.ts`) : zones de revêtement **herbe de course 3 / terre 1** (au lieu de terre 2 / herbe 1), posées là où trois blocs de suite peuvent la porter (`turfZone` : tirées au hasard, elles tombaient sur les approches protégées du lot 34) ; **l'une des trois figures d'herbe toujours là** (`requireAlso`), et favorites : **`ample-herbe`** (virage ample entre deux droites d'herbe ; variante : ample puis large), **`chicane-herbe`** (S large herbe-route ou route-herbe), **`droite-herbe`** (ligne droite d'herbe de 3 ou 4 blocs entre deux virages larges). `Figure.since = 17` : un générateur plus ancien ne les tire pas ; `only: ["campagne"]`. Chaque variante finie par le pilote dans les deux sens et sur les trois largeurs (`figures.test.ts`).
- **Les autres thèmes sont identiques en v17** (texte au bit près, à l'identifiant près ; testé sur 16 dates × 4 thèmes).
- **Proposés à Nathan, non faits** (hors du strict objet, et leur sol devrait d'abord être assombri pour l'écart ΔE) : **Stade** — une zone d'herbe de course (3–4 blocs) par circuit, sa pelouse (`#4fae3c` / `#47a335`) étant à ΔE 8 à 11 de l'herbe de course il faudrait la foncer ; **Col alpin** — 0 à 1 zone « alpage » sur une descente ; ni Rallye, ni Banquise, ni Canyon, ni Nuit, ni Ville.
- **`?scenario=herbe`** (`HERBE_TRACK_SPEC`) : longue ligne droite d'herbe bordée d'herbe haute, virage ample en herbe, transition vers la route, S large herbe-route, serré en herbe sur la route étroite puis grande courbe d'herbe, ligne droite d'herbe entre deux larges ; palette de la Campagne ; raccourci « Herbe de course » de `/admin/` ; 38,1 s pour le pilote.

### Mesure : 20 circuits de Campagne d'après la bascule (`HERBE=1 npm run measure:generator`, section 4)

| | avant (20 Campagne du 03/11 en remontant, herbe d'avant) | après (20 Campagne à partir du 04/11, herbe de course) |
|---|---|---|
| circuits qui en ont | 8 / 20 | **20 / 20** |
| part des blocs | 2,5 % | **14,0 %** (3,7 à 21,7 %) |
| temps passé dessus (pilote d'auteur) | 1,3 s | **7,0 s** (2,5 à 11,2 s) |
| temps perdu par le pilote (contre la route) | 0,31 s (jusqu'à 2,75 s) | 0,55 s (jusqu'à 0,96 s) **pour 5 fois plus d'herbe** |
| durée du pilote (fenêtre 30–40 s) | 37,4 s, 20/20 | 37,8 s (33,0 à 39,9 s), **20/20 validés** |
| or (lot 35) dans 30–45 s | 20/20 | 19/20 (le 20/05/2027 : 28,9 s — pilote à 33,0 s ; la fenêtre du pilote et les facteurs du lot 35 ne changent pas) |

**Médailles** : non recalibrées. Le pilote d'auteur prend l'herbe de course en adhérence (il ne dérape pas) ; un humain qui tient bien ses glisses peut y être plus proche du pilote que sur la route, un humain qui surbraque plus loin. **Non mesuré** (aucune course humaine sur l'herbe de course) : à regarder dans « Médailles » de `/admin/` après les premiers jours de Campagne.

### Golden et rediffusions

- `fixtures/daily-golden.json` : 13 dates (5 v15, **2 v16 : 28/10 et 03/11**, 6 v17 dont **04/11 et 15/11, de Campagne, sur l'herbe de course**). **La régénération refuse de réécrire un jour d'avant la bascule du lot 48** (le message dit « un jour passé ne change jamais »). Le test vérifie aussi qu'aucun jour d'avant n'a d'herbe de course et que chaque Campagne d'après en a.
- **Bit pour bit, hors des tests** : les 22 jours du 13/10 au 03/11, variante 0, variante 1, Campagne et Ville imposées (88 circuits : texte, identifiant, temps de l'auteur, tentative, médailles, thème) identiques avant et après le lot (code de `main` à `33d4bd8` à côté).
- Rediffusion de référence (`golden.test.ts`), rediffusions de `replay.test.ts` et `car.test.ts` : identiques (`SIM_VERSION` 14). `npm run history:seed` relancé : seul `generatorVersion` de `apps/web/public/demo/index.json` change (16 → 17), aucun jour.

### Remplacements du planning touchés

**Le lot n'a pas accès à la base de production ni à celle de la recette.** Tout remplacement déjà choisi pour un jour **≥ 04/11/2026** devient la variante du générateur v17 : **un jour de Campagne change de circuit**, un autre thème garde son texte mais change d'identifiant (`-g17`). **À revoir dans `/admin/` (planning)** — la carte d'un jour dit « v17 · herbe de course (lot 48) » ou « v16 · … avant la bascule du lot 48 (2026-11-04) ».

## 5. Budget (`npm run build && node scripts/budgets.mjs`, `main` à `33d4bd8` construit à part)

- **Premier chargement : +717 o** (JS + CSS 286 356 → **287 073 o**, marge 5 244 → **4 527 o**, sous la cible de 1,5 ko) : la surface (table, huit clés, branches de `car.ts`), son rendu (tonte, bords, couleurs), traces, brins, voix, bandeau, panneau `?debug&tune`.
- Fils de travail (générateur v17) : miniatures 26 524 → **27 250 o** (marge 2 750 sous 30 000) ; Salon 28 502 → **29 232 o** (marge 2 768 sous 32 000). Catalogue anglais +22 o ; page d'admin +113 o ; décor (huit thèmes) 12 583 → 12 723 o (+140, les herbes folles).

## 6. Captures avant / après

Outil : `apps/web/e2e/captures-lot48.spec.ts` (`CAPTURES=1 LABEL=avant|apres …`, en tête du fichier). Images dans `docs/lots/lot-48/avant/` et `docs/lots/lot-48/apres/` : la Campagne du 25/10 (herbe d'avant) avant et après (le décor plus sombre autour), la Campagne du 04/11 (herbe de course) et le scénario `herbe` ; chacune **depuis la voiture** (`-voiture`), **caméra loin** (`-loin`) et **de haut** (la miniature, `-de-haut`).

## 7. Vérifié / non vérifié / décisions pour Nathan

- **Vérifié** : `npm run typecheck`, `npm test` (SQLite et libSQL), `npm run build` ; tests de comportement et de ΔE ; golden, rediffusions de référence et 88 circuits d'avant identiques ; mesure complète de la section 4 ; `history:seed` ; `npm run traductions`.
- **Non vérifié** : la sensation au volant et au téléphone (le dérapage sans frein, la tonte vue de la voiture) — c'est l'objet de l'aperçu ; les e2e Firefox et WebKit en local (la CI les lance).
- **Décisions pour Nathan** : (1) **la date de bascule** (04/11/2026) selon la mise en production ; (2) **`SIM_VERSION` inchangée** pour une surface nouvelle (règle proposée et appliquée, § 2) ; (3) la **proportion** d'herbe de course en Campagne (14 % des blocs ; plus = plus de figures ou des zones plus longues) ; (4) **Stade et Col** (§ 4) ; (5) le **sol de la Campagne assombri pour tous les jours** (rendu seulement) ; (6) l'**index du `CLAUDE.md` racine** (zone partagée, non modifié) : ajouter « Herbe de course (lot 48) » aux rubriques de `packages/sim/CLAUDE.md` et `apps/web/CLAUDE.md`, et la marge de Track (≈ 4,5 ko au lieu de 5,2) ; (7) les remplacements du planning ≥ 04/11 (§ 4).

## 8. À tester (aperçu de la PR, au téléphone)

Les liens sont ceux du canal d'aperçu de la PR (commentaire « Aperçu » de la PR) ; les jours d'après la bascule ne sont jouables qu'en aperçu ou avec `?debug`.
- `/track/?scenario=herbe` : on voit la piste (tonte, bords blancs, herbe haute autour), on y glisse au lieu de freiner.
- `/track/?scenario=herbe&debug&tune` : régler la sensation (les huit lignes « Herbe de course »), puis « Copier les réglages ».
- `/track/?seed=2026-11-04` (premier jour de Campagne de la v17) et `/track/?seed=2026-11-15`.
