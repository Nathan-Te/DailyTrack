# Lot 0 — Le socle partagé (DailyJump)

**À tester** — base de l'aperçu : `https://nathan-te.github.io/DailyTrack/b/lot-0-socle-dailyjump/`

1. **DailyJump** : `…/b/lot-0-socle-dailyjump/jump/?debug` — une grille d'essai (80 × 18 tuiles, deux écrans et demi), le carré à deux yeux immobile sur le départ, un fond uni à la palette du jour, « DailyJump · sim v1 · <jour> » en bas à droite. Flèches, molette ou glisser pour parcourir la grille (aide d'aperçu, pas un gameplay). Dans la console : `__jump.phase` vaut `"ready"`.
2. **DailyTrack comme avant** : `…/b/lot-0-socle-dailyjump/?scenario=essai`.

Aucun gameplay. Aucun fichier de `apps/web` ni de `apps/api` ne change de comportement (seul `apps/api/Dockerfile` gagne des lignes de copie, voir § 4).

## 1. Ce qui est dans `packages/core` (`@cdj/core`) et ce qui est resté

| Dans `core` | D'où | Note |
|---|---|---|
| `Rng`, `mixSeed` (`rng.ts`) | `sim/src/rng.ts` (déplacé, historique git suivi) | test déplacé avec lui (valeurs figées) |
| `daysFromCivil`, `civilFromDays`, `formatDay`, `parseDay` (`calendar.ts`) | `sim/src/calendar.ts` | sans `PREMIER_JOUR` ni `circuitNumber` |
| `toBase64Url`, `fromBase64Url`, `pushVarint`, `readVarint`, `CodecError` (`codec.ts`) | `sim/src/replay.ts` | le **codage d'octets** de la rediffusion ; `sim` garde les messages d'erreur d'avant (`ReplayError`, mêmes textes) |
| Test de pureté générique (`@cdj/core/testing` : `describePurity`, `FORBIDDEN`) | `sim/test/purete.test.ts` | **même liste d'interdits** ; appliqué à `core`, `sim` et `jump-sim` ; seul import extérieur permis : `@cdj/core` ; le test vérifie aussi que chaque interdit attrape bien ce qu'il doit |

**Resté dans `sim`** (avec la raison) :
- `PREMIER_JOUR`, `circuitNumber` : propres à chaque jeu (le calendrier de `core` n'en a pas besoin).
- Le **format** de la rediffusion (`Replay`, séries steer / throttle / brake / respawn, `FORMAT`, `MAX_REPLAY_TICKS`, `replayRace`) : c'est celui de la course ; le saut aura ses propres commandes (3 bits). Seul le codage d'octets se sépare proprement (fait) ; le reste est à écrire au lot 3 de DailyJump.
- `math.ts` : le saut n'a pas besoin de trigonométrie (consigne du lot).
- **La règle de changement de jour** (« aujourd'hui » = date à Paris, lot 31) est dans `packages/clock`, pas dans `sim` : elle lit l'heure (`Date`, `Intl`) et ne peut pas passer le test de pureté. Elle n'est donc **pas** dans `core`, qui est pur. `@cdj/clock` dépend maintenant de `@cdj/core` (et plus de `@cdj/sim`), son comportement est inchangé (son test passe) ; DailyJump l'utilisera tel quel. Décision à confirmer : § 5.

`sim` ré-exporte `Rng`, `mixSeed`, `daysFromCivil`, `civilFromDays`, `formatDay`, `parseDay` : `apps/web` et `apps/api` importent toujours de `@cdj/sim`, **sans un seul changement de fichier**.

## 2. Ce qui est neuf

- `packages/jump-sim` : `constants.ts` (`TICK_RATE` 120, `JUMP_SIM_VERSION` 1, `JUMP_GENERATOR_VERSION` 1, `UNITS_PER_TILE` 4 096), `idiv` (tronque vers zéro, jamais `-0`, exacte sur de grands entiers — testée contre `BigInt`), `level.ts` (`parseLevel` : `#` `.` `S` `F`, erreurs claires), test de pureté.
- `apps/jump` : Vite + Three.js (caméra orthographique, formes géométriques, zéro asset), palette du jour (`paletteForDay`, cinq palettes), `window.__jump` avec `?debug`, stockage `jump:` (`storageKey`). **Chemins relatifs** (`base: "./"`), pas `/jump/` en dur : le site vit sous `/DailyTrack/` et les aperçus sous `/DailyTrack/b/<branche>/`.
- Publication : `pages.yml` copie `apps/jump/dist` dans `jump/` (racine pour `main`, `b/<branche>/jump/` pour une branche) ; `VITE_API_URL` ne concerne que DailyTrack. `npm run build` construit maintenant les deux applications.
- CI : `tsc -b` et Vitest couvrent les nouveaux espaces ; test de fumée Playwright `apps/jump/e2e/smoke.spec.ts` (`__jump.phase === 'ready'`, un canvas, au moins 4 couleurs de pixels lues dans l'image, `test.skip` motivé sans WebGL) lancé **une fois par navigateur** (part 1 de la matrice `e2e-parts` : +≈ 10 s sur trois jobs), sans relance.
- Consignes : `docs/jump/consignes.md`, importé par `CLAUDE.md` (+ section « Plusieurs jeux dans ce dépôt »).

## 3. DailyTrack n'a pas bougé (preuves)

- **Golden** : `golden.test.ts` et `golden-daily.test.ts` passent **sans** `UPDATE_GOLDEN` ; aucun fichier de `fixtures/` modifié (`git diff --stat` : aucun). `SIM_VERSION` 14 et `GENERATOR_VERSION` 15, inchangés.
- `npm test` (SQLite puis libSQL) : 972 (SQLite) + 158 (libSQL) tests verts, y compris les rediffusions (`replay.test.ts` : erreurs de décodage identiques).
- **`npm run measure:generator`** avant (`main` à `7003cf1`) et après (ce lot), même machine : **toutes les lignes sont identiques** (durées d'auteur, virages, figures, médailles, taux de validation par thème), sauf les temps de calcul de la machine (génération moyenne 180 → 184 ms, rejeu 49,7 → 49,9 ms : bruit). Les deux sorties complètes :

<details><summary>Avant (main)</summary>

```
SIM_VERSION 14 · GENERATOR_VERSION 15 · fenêtre 30–40 s

## 60 dates à partir du 2026-10-06
temps d'auteur : min 31.1 s · moyen 36.9 s · max 39.8 s ; dans [30 ; 40] s : 60/60
répartition (tranches de 2 s) : 30–32 s : 1 · 32–34 s : 4 · 34–36 s : 14 · 36–38 s : 19 · 38–40 s : 22
circuits de secours (aucune tentative n'a abouti) : 0
tentative retenue : moyenne 1.0 · max 12
blocs : moyenne 45.8 · virages larges (L2/R2) : 4.2 par circuit
dénivelé (point le plus haut − le plus bas de la route) : min 12 · moyen 15.5 · max 36 m ; au moins 12 m : 60/60
pentes : 6.4 blocs par circuit dont 0.9 raides (2 ou 3 niveaux) ; circuits avec un dos d'âne (montée raide puis descente raide) : 4/60
sauts : stade 10/10 · rallye 8/8 · banquise 1/6 · nuit 4/4 · campagne 3/8 · canyon 8/8 · col 3/9 · ville 1/7 circuits avec au moins un vrai saut
types de saut : 32 m, bord +0 m × 13 · 32 m, bord -4 m × 16 · 32 m, bord -8 m × 1 · 64 m, bord +0 m × 6 · 64 m, bord -4 m × 2
vitesse du pilote au bord de la rampe, en multiple du plancher de la fenêtre : min 1.08 · moyenne 1.44 (exigé ≥ 1,08)
sections sans rebords : 13/60 circuits (stade 0/10 · rallye 0/8 · banquise 0/6 · nuit 4/4 · campagne 0/8 · canyon 2/8 · col 7/9 · ville 0/7) ; chutes du pilote : 0
cuves : stade 10/10 · rallye 0/8 · banquise 2/6 · nuit 4/4 · campagne 0/8 · canyon 8/8 · col 0/9 · ville 0/7 circuits avec une cuve ; types : cuve droite × 8 · mur latéral × 15 · virage en cuve × 1
cuves : prises sur la paroi par le pilote d'auteur (le plus rapide des deux) : virages 0/1 · droites 11/23 · ensemble 11/24
largeurs : au moins deux par circuit : 60/60 ; largeurs vues : 14, 20, 26 m
virages serrés : moyenne 1.6 · max 4 ; deux d'affilée : 0 circuit(s)
vitesse maximale du pilote : min 64.7 · moyenne 83.9 · max 88.2 m/s (pointe du plat 48 m/s) ; ≥ +30 % (62.4 m/s) : 60/60
part du temps au-delà de la pointe du plat : moyenne 25 % · min 8 % · max 54 %
part du temps à plein gaz (sans frein) : moyenne 81 % · min 65 % · max 90 %
freinages ou relâchements par circuit (≥ 0,1 s, > 10 m/s) : moyenne 10.3 · min 5 · max 17
plus longue ligne droite sans rien (blocs « S » consécutifs, revêtement et largeur sans effet) : moyenne 5.0 · max 6 blocs (192 m)
figures par circuit : moyenne 5.0 · min 5 · max 6 ; répétition d'une figure dans un circuit : 0 circuit(s)
figures utilisées sur 60 dates : 35/44 (jamais : slalom-glace, u-urbain, saut-virage, saut-etroit, double-saut, turbo-saut-releve, glace-coupe-virage, cuve-droite, mur-lateral)
  emplois : plaque-epingle 33 · chaine-turbo 24 · pincement 16 · virage-descente 15 · turbo-courbe 15 · colline-douce 15 · colline-raide 13 · crete-virage 12 · esse-relevee 11 · turbo-epingle 11 · virage-aveugle 11 · descente-plaque 10 · lacets 9 · paroi-long-saut 8 · plaque-virage 8 · saut-terre 8 · freinage-epingle 8 · etranglement-terre 8 · saut-paroi 7 · coupe-virage 7 · demi-tour-large 7 · chicane-angles 7 · saut-cuve 6 · chicane-glace 6 · releve-contre 5 · epingle-terre 5 · s-serre-large 4 · saut-plaque 3 · descente-cuve-saut 2 · saut-releve 2 · saut-niveau-epingle 1 · slalom-route 1 · changement-revetement 1 · saut-simple 1 · virage-cuve 1
répartition par catégorie (moyenne par circuit) : technique 2.6 · saut 0.6 · rapide 0.9 · combo 0.2 · cuve 0.0 · relief 0.6
techniques par circuit : min 2 · moyenne 2.6 ; circuits à moins de deux : 0
figures en commun entre deux jours consécutifs : moyenne 0.86 · max 3 (21 paires sans aucune)
estimation de durée (0,95 × estimateSeconds − temps d'auteur) : écart moyen 1.9 s · biais -1.4 s · pire 4.5 s
génération : moyenne 180 ms · max 712 ms
rejeu d'une course d'auteur : moyenne 49.7 ms · max 76.0 ms
médailles : bronze (×1,40 de l'auteur) : 43.6 s (min) → 55.8 s (max) ; au-dessus de 45 s : 59/60
facteurs candidats (non appliqués) : part des circuits dont la médaille tient en 45 s — ×1,40 : 2 % · ×1,30 : 13 % · ×1,25 : 32 % · ×1,20 : 60 % · ×1,15 : 83 % · ×1,10 : 100 % · ×1,08 : 100 %
bas-côtés par thème (du jour) : stade herbe (60 % des blocs) · rallye terre et gravier (60 % des blocs) · banquise neige poudreuse (62 % des blocs) · nuit vide (14 % des blocs) · campagne herbe (67 % des blocs) · canyon vide+sand (51 % des blocs) · col neige poudreuse+vide (57 % des blocs) · ville aucun (0 % des blocs)
route bosselée : stade 0/10 · rallye 8/8 · banquise 0/6 · nuit 0/4 · campagne 0/8 · canyon 0/8 · col 0/9 · ville 0/7 circuits
règle propre (figure obligatoire) : rallye 8/8 (epingle-terre ou demi-tour-large) · campagne 8/8 (crete-virage ou virage-aveugle) · ville 7/7 (u-urbain ou freinage-epingle ou plaque-epingle ou turbo-epingle ou s-serre-large)
moments de choix par thème (du jour, moyenne par circuit) :
  thème      |         freinages |        roue libre |        paroi/fond | virages coupables |       sauts figés |             total
  stade      |               3.7 |               2.5 |               1.0 |               2.2 |               2.9 |              12.3   (min total 10)
  rallye     |               4.0 |               4.5 |               0.0 |               3.8 |               3.3 |              15.5   (min total 12)
  banquise   |               4.8 |               6.2 |               0.3 |               3.8 |               3.3 |              18.5   (min total 14)
  nuit       |               3.0 |               3.5 |               1.0 |               0.0 |               3.3 |              10.8   (min total 10)
  campagne   |               4.6 |               3.4 |               0.0 |               3.9 |               2.3 |              14.1   (min total 11)
  canyon     |               3.1 |               3.1 |               1.0 |               1.8 |               3.8 |              12.8   (min total 9)
  col        |               5.2 |               5.4 |               0.0 |               3.3 |               3.2 |              17.2   (min total 11)
  ville      |               5.7 |               5.6 |               0.0 |               0.0 |               3.0 |              14.3   (min total 10)
  ensemble   |               4.3 |               4.2 |               0.4 |               2.5 |               3.1 |              14.5
couper par le bas-côté (même pilote sans / avec coupe, 49 circuits à bas-côtés ; le pilote d'auteur garde la coupe de 0,5 m sur 15) : 0.5 m → plus rapide 15, plus lent 32 (meilleur gain 1.88 s) · 1 m → plus rapide 4, plus lent 44 (meilleur gain 1.33 s) · 3 m → plus rapide 1, plus lent 47 (meilleur gain 0.06 s)
par thème (du jour) : stade 10 jours, 36.9 s · rallye 8 jours, 37.2 s · banquise 6 jours, 36.9 s · nuit 4 jours, 38.3 s · campagne 8 jours, 37.0 s · canyon 8 jours, 35.5 s · col 9 jours, 37.8 s · ville 7 jours, 36.3 s
plein gaz par thème (du jour) : stade 87 % (9.1 relâchements) · rallye 85 % (9.4 relâchements) · banquise 76 % (11.2 relâchements) · nuit 83 % (9.5 relâchements) · campagne 82 % (10.6 relâchements) · canyon 83 % (7.9 relâchements) · col 76 % (12.3 relâchements) · ville 79 % (12.7 relâchements)

## Taux de validation par thème (12 dates × 6 tentatives, thème forcé)
thème      | construit | pilote finit | dans la fenêtre | portion rapide | durée moyenne | vitesse max | génération/tentative
stade      |      88 % |         98 % |            76 % |           76 % |       38.2 s |      88 m/s | 153 ms
rallye     |      81 % |         98 % |            62 % |           62 % |       39.6 s |      80 m/s | 80 ms
banquise   |      94 % |         87 % |            34 % |           32 % |       40.8 s |      80 m/s | 109 ms
nuit       |      90 % |         94 % |            58 % |           58 % |       39.4 s |      82 m/s | 131 ms
campagne   |      79 % |         93 % |            68 % |           68 % |       38.7 s |      85 m/s | 73 ms
canyon     |      65 % |         98 % |            81 % |           81 % |       37.0 s |      86 m/s | 111 ms
col        |      89 % |         92 % |            55 % |           53 % |       39.8 s |      80 m/s | 85 ms
ville      |      78 % |         96 % |            82 % |           82 % |       38.2 s |      86 m/s | 55 ms

(MAX_ATTEMPTS = 40. « construit » : le générateur a posé tous les blocs ; « pilote finit » : sur les circuits construits ; « fenêtre » : sur les circuits construits ; « portion rapide » : dans la fenêtre ET pilote ≥ +30 % de la pointe du plat, sur les circuits construits.)
```

</details>

<details><summary>Après (ce lot)</summary>

```
SIM_VERSION 14 · GENERATOR_VERSION 15 · fenêtre 30–40 s

## 60 dates à partir du 2026-10-06
temps d'auteur : min 31.1 s · moyen 36.9 s · max 39.8 s ; dans [30 ; 40] s : 60/60
répartition (tranches de 2 s) : 30–32 s : 1 · 32–34 s : 4 · 34–36 s : 14 · 36–38 s : 19 · 38–40 s : 22
circuits de secours (aucune tentative n'a abouti) : 0
tentative retenue : moyenne 1.0 · max 12
blocs : moyenne 45.8 · virages larges (L2/R2) : 4.2 par circuit
dénivelé (point le plus haut − le plus bas de la route) : min 12 · moyen 15.5 · max 36 m ; au moins 12 m : 60/60
pentes : 6.4 blocs par circuit dont 0.9 raides (2 ou 3 niveaux) ; circuits avec un dos d'âne (montée raide puis descente raide) : 4/60
sauts : stade 10/10 · rallye 8/8 · banquise 1/6 · nuit 4/4 · campagne 3/8 · canyon 8/8 · col 3/9 · ville 1/7 circuits avec au moins un vrai saut
types de saut : 32 m, bord +0 m × 13 · 32 m, bord -4 m × 16 · 32 m, bord -8 m × 1 · 64 m, bord +0 m × 6 · 64 m, bord -4 m × 2
vitesse du pilote au bord de la rampe, en multiple du plancher de la fenêtre : min 1.08 · moyenne 1.44 (exigé ≥ 1,08)
sections sans rebords : 13/60 circuits (stade 0/10 · rallye 0/8 · banquise 0/6 · nuit 4/4 · campagne 0/8 · canyon 2/8 · col 7/9 · ville 0/7) ; chutes du pilote : 0
cuves : stade 10/10 · rallye 0/8 · banquise 2/6 · nuit 4/4 · campagne 0/8 · canyon 8/8 · col 0/9 · ville 0/7 circuits avec une cuve ; types : cuve droite × 8 · mur latéral × 15 · virage en cuve × 1
cuves : prises sur la paroi par le pilote d'auteur (le plus rapide des deux) : virages 0/1 · droites 11/23 · ensemble 11/24
largeurs : au moins deux par circuit : 60/60 ; largeurs vues : 14, 20, 26 m
virages serrés : moyenne 1.6 · max 4 ; deux d'affilée : 0 circuit(s)
vitesse maximale du pilote : min 64.7 · moyenne 83.9 · max 88.2 m/s (pointe du plat 48 m/s) ; ≥ +30 % (62.4 m/s) : 60/60
part du temps au-delà de la pointe du plat : moyenne 25 % · min 8 % · max 54 %
part du temps à plein gaz (sans frein) : moyenne 81 % · min 65 % · max 90 %
freinages ou relâchements par circuit (≥ 0,1 s, > 10 m/s) : moyenne 10.3 · min 5 · max 17
plus longue ligne droite sans rien (blocs « S » consécutifs, revêtement et largeur sans effet) : moyenne 5.0 · max 6 blocs (192 m)
figures par circuit : moyenne 5.0 · min 5 · max 6 ; répétition d'une figure dans un circuit : 0 circuit(s)
figures utilisées sur 60 dates : 35/44 (jamais : slalom-glace, u-urbain, saut-virage, saut-etroit, double-saut, turbo-saut-releve, glace-coupe-virage, cuve-droite, mur-lateral)
  emplois : plaque-epingle 33 · chaine-turbo 24 · pincement 16 · virage-descente 15 · turbo-courbe 15 · colline-douce 15 · colline-raide 13 · crete-virage 12 · esse-relevee 11 · turbo-epingle 11 · virage-aveugle 11 · descente-plaque 10 · lacets 9 · paroi-long-saut 8 · plaque-virage 8 · saut-terre 8 · freinage-epingle 8 · etranglement-terre 8 · saut-paroi 7 · coupe-virage 7 · demi-tour-large 7 · chicane-angles 7 · saut-cuve 6 · chicane-glace 6 · releve-contre 5 · epingle-terre 5 · s-serre-large 4 · saut-plaque 3 · descente-cuve-saut 2 · saut-releve 2 · saut-niveau-epingle 1 · slalom-route 1 · changement-revetement 1 · saut-simple 1 · virage-cuve 1
répartition par catégorie (moyenne par circuit) : technique 2.6 · saut 0.6 · rapide 0.9 · combo 0.2 · cuve 0.0 · relief 0.6
techniques par circuit : min 2 · moyenne 2.6 ; circuits à moins de deux : 0
figures en commun entre deux jours consécutifs : moyenne 0.86 · max 3 (21 paires sans aucune)
estimation de durée (0,95 × estimateSeconds − temps d'auteur) : écart moyen 1.9 s · biais -1.4 s · pire 4.5 s
génération : moyenne 184 ms · max 686 ms
rejeu d'une course d'auteur : moyenne 49.9 ms · max 87.1 ms
médailles : bronze (×1,40 de l'auteur) : 43.6 s (min) → 55.8 s (max) ; au-dessus de 45 s : 59/60
facteurs candidats (non appliqués) : part des circuits dont la médaille tient en 45 s — ×1,40 : 2 % · ×1,30 : 13 % · ×1,25 : 32 % · ×1,20 : 60 % · ×1,15 : 83 % · ×1,10 : 100 % · ×1,08 : 100 %
bas-côtés par thème (du jour) : stade herbe (60 % des blocs) · rallye terre et gravier (60 % des blocs) · banquise neige poudreuse (62 % des blocs) · nuit vide (14 % des blocs) · campagne herbe (67 % des blocs) · canyon vide+sand (51 % des blocs) · col neige poudreuse+vide (57 % des blocs) · ville aucun (0 % des blocs)
route bosselée : stade 0/10 · rallye 8/8 · banquise 0/6 · nuit 0/4 · campagne 0/8 · canyon 0/8 · col 0/9 · ville 0/7 circuits
règle propre (figure obligatoire) : rallye 8/8 (epingle-terre ou demi-tour-large) · campagne 8/8 (crete-virage ou virage-aveugle) · ville 7/7 (u-urbain ou freinage-epingle ou plaque-epingle ou turbo-epingle ou s-serre-large)
moments de choix par thème (du jour, moyenne par circuit) :
  thème      |         freinages |        roue libre |        paroi/fond | virages coupables |       sauts figés |             total
  stade      |               3.7 |               2.5 |               1.0 |               2.2 |               2.9 |              12.3   (min total 10)
  rallye     |               4.0 |               4.5 |               0.0 |               3.8 |               3.3 |              15.5   (min total 12)
  banquise   |               4.8 |               6.2 |               0.3 |               3.8 |               3.3 |              18.5   (min total 14)
  nuit       |               3.0 |               3.5 |               1.0 |               0.0 |               3.3 |              10.8   (min total 10)
  campagne   |               4.6 |               3.4 |               0.0 |               3.9 |               2.3 |              14.1   (min total 11)
  canyon     |               3.1 |               3.1 |               1.0 |               1.8 |               3.8 |              12.8   (min total 9)
  col        |               5.2 |               5.4 |               0.0 |               3.3 |               3.2 |              17.2   (min total 11)
  ville      |               5.7 |               5.6 |               0.0 |               0.0 |               3.0 |              14.3   (min total 10)
  ensemble   |               4.3 |               4.2 |               0.4 |               2.5 |               3.1 |              14.5
couper par le bas-côté (même pilote sans / avec coupe, 49 circuits à bas-côtés ; le pilote d'auteur garde la coupe de 0,5 m sur 15) : 0.5 m → plus rapide 15, plus lent 32 (meilleur gain 1.88 s) · 1 m → plus rapide 4, plus lent 44 (meilleur gain 1.33 s) · 3 m → plus rapide 1, plus lent 47 (meilleur gain 0.06 s)
par thème (du jour) : stade 10 jours, 36.9 s · rallye 8 jours, 37.2 s · banquise 6 jours, 36.9 s · nuit 4 jours, 38.3 s · campagne 8 jours, 37.0 s · canyon 8 jours, 35.5 s · col 9 jours, 37.8 s · ville 7 jours, 36.3 s
plein gaz par thème (du jour) : stade 87 % (9.1 relâchements) · rallye 85 % (9.4 relâchements) · banquise 76 % (11.2 relâchements) · nuit 83 % (9.5 relâchements) · campagne 82 % (10.6 relâchements) · canyon 83 % (7.9 relâchements) · col 76 % (12.3 relâchements) · ville 79 % (12.7 relâchements)

## Taux de validation par thème (12 dates × 6 tentatives, thème forcé)
thème      | construit | pilote finit | dans la fenêtre | portion rapide | durée moyenne | vitesse max | génération/tentative
stade      |      88 % |         98 % |            76 % |           76 % |       38.2 s |      88 m/s | 157 ms
rallye     |      81 % |         98 % |            62 % |           62 % |       39.6 s |      80 m/s | 79 ms
banquise   |      94 % |         87 % |            34 % |           32 % |       40.8 s |      80 m/s | 112 ms
nuit       |      90 % |         94 % |            58 % |           58 % |       39.4 s |      82 m/s | 132 ms
campagne   |      79 % |         93 % |            68 % |           68 % |       38.7 s |      85 m/s | 76 ms
canyon     |      65 % |         98 % |            81 % |           81 % |       37.0 s |      86 m/s | 111 ms
col        |      89 % |         92 % |            55 % |           53 % |       39.8 s |      80 m/s | 87 ms
ville      |      78 % |         96 % |            82 % |           82 % |       38.2 s |      86 m/s | 55 ms

(MAX_ATTEMPTS = 40. « construit » : le générateur a posé tous les blocs ; « pilote finit » : sur les circuits construits ; « fenêtre » : sur les circuits construits ; « portion rapide » : dans la fenêtre ET pilote ≥ +30 % de la pointe du plat, sur les circuits construits.)
```

</details>

## 4. Zones partagées touchées (le prompt le demande, sauf mention)

`package.json` (scripts `build`, `dev:jump`, `e2e:jump`) et `package-lock.json` (régénéré par `npm install`), `tsconfig.json` (références), `.github/workflows/{pages,ci,deploy-api}.yml` (`deploy-api.yml` : **uniquement** `packages/core/**` dans les chemins), `CLAUDE.md`. **Hors liste, nécessaires** : `apps/api/Dockerfile` copie maintenant `packages/core` (sans cela l'image de l'API ne se construit plus : `sim` en dépend) et les manifestes de `jump-sim` et `apps/jump` (le verrou les liste) — le flux a été rejoué dans un dossier propre (`npm ci -w @cdj/api` puis `build:node` : le paquet se construit) ; `packages/clock` (dépend de `core`).

## 5. Vérifié / non vérifié / décisions pour Nathan

**Vérifié** : typecheck ; tests unitaires (SQLite et libSQL) ; golden ; `measure:generator` avant / après ; construction des deux applications ; test de fumée dans **Chromium** (local) ; capture de la page (palette « glace » ce jour-là) ; construction de l'API comme le Dockerfile la fait.

**Non vérifié** : CI sur Firefox et WebKit (pas de navigateur installé ici : c'est la CI de la PR qui tranche) ; l'image Docker elle-même (pas de Docker ici ; le job `api-image` la construit) ; l'aperçu publié `…/jump/?debug` et le déploiement Pages (se vérifient une fois la PR poussée) ; un vrai téléphone.

**Décisions / écarts à connaître**
1. Le seed déposé s'appelle `docs/jump/seed-dailyjump.md` (le prompt dit `seed.md`) : je l'ai cité sous son vrai nom et ne l'ai pas renommé ni modifié.
2. **Règle de jour** : la règle « minuit à Paris » est dans `packages/clock`, qui n'est pas pur ; je l'ai laissée là (le test de pureté de `core` l'interdirait). Dis-moi si tu préfères la déplacer dans `core` avec une exception au test.
3. **`/jump/` relatif** plutôt que `base: "/jump/"` (casserait les aperçus de branche, voir § 2).
4. Test de fumée DailyJump hors du rapport « blob » de DailyTrack et **sans relance** : un échec rend la part (donc `e2e`) rouge, avec le message générique « une part a échoué sans test en échec » ; un test instable ne serait pas nommé dans le résumé. À reprendre si DailyJump gagne beaucoup de tests e2e (il faudra alors fusionner les rapports).
5. `varint` en plus de base64url dans `core` : le seed range les « séries compressées » dans le socle ; c'est ~15 lignes, testées.
6. Pas de nouvelle dépendance : `apps/jump` utilise les mêmes versions de `three`, `vite`, `@playwright/test` que `apps/web`.
