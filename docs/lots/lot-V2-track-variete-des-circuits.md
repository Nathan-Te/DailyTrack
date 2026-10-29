# Lot V2 (Track) — Variété des circuits et identité des biomes

Branche `claude/compassionate-thompson-p4w7fe`, PR brouillon. **Générateur 21** (`GENERATOR_VERSION`, `GENERATOR_RYTHMES`) ; `SIM_VERSION` inchangée (14) ; aucune date écrite (R11) : c'est « Mettre en production » qui décidera du premier jour de la v21. Mesure complète : [`docs/track/variete.md`](../track/variete.md) ; fiches : [`docs/track/biomes.md`](../track/biomes.md) ; **blocs à choisir pour le V2b : [`docs/track/blocs-proposes.md`](../track/blocs-proposes.md)**.

## Pour les joueurs
- [Track] Des circuits plus variés, et des biomes qui se reconnaissent au tracé. // More varied tracks, and biomes you can tell apart by their layout.

## Ce qui a été fait
1. **Mesure** (`packages/sim/src/variete.ts`, pure ; outil `npm run mesure-circuits -- --jours 200 --depuis 2026-10-30`, hors CI, ≈ 1 min) : éléments, motifs de 2 et 3 éléments, le motif « boost → longue ligne droite → virage serré », profils (lignes droites, rayons, largeur, route sans rebords, dénivelé, changements de direction, parts), distance de profils, ressemblance d'un jour à l'autre, par biome et par rythme ; elle réécrit `docs/track/variete.md`.
2. **Motifs cassés** : le motif est **permis un jour « rapide » seulement, une fois** (compté en posant chaque figure) ; les épingles à plaque (`plaque-epingle`, `turbo-epingle`, qui le font toujours) et la liaison à plaque ne sortent que ces jours-là ; quand il apparaît, **jamais un virage-piège** (zone de freinage complète, route sans revêtement, bosse ni bord ouvert : testé). Le virage derrière une poussée change avec le jour (large, ample, relevé).
3. **Rythmes** (`rythmes.ts`) : technique, rapide, mixte, vertical, aérien — un sac de cinq (règle du sac de thèmes, sel propre), **jamais deux jours de suite le même** ; le rythme dominant du biome prend la place de « mixte ». Il oriente les poids des figures (`POIDS_RYTHME`).
4. **Fiches de biomes**, appliquées par le générateur (`FICHES_V21`) : poids des figures, relief, rythme dominant, traits de tracé (`serrer`, `amplifier`, `alterner`, `pente`, `maxDroite`, `maxTight`, `aussi`).
5. **Huit blocs proposés** (six techniques), schémas SVG, rien de construit.
6. **Galerie** `/track/?debug&galerie=30` (aperçu de PR et recette ; refusée en production par `isRestricted`) : plan de chaque jour, biome, rythme, temps, motifs, interrupteur v20 / v21.

## Chiffres avant (v20) → après (v21), 200 jours du 30/10/2026
| mesure | v20 | v21 |
|---|---:|---:|
| circuits avec « boost → longue → serré » | 44 % | 10 % |
| ce motif, au plus par circuit | 3 | 1 |
| jours de suite qui l'ont tous les deux | 40 | 0 |
| suite de trois éléments la plus fréquente | boost → longue → large, 44 % | boost → saut → descente, 35 % |
| « boost → longue » (deux éléments) | 89 % | 70 % |
| distance des profils de deux jours qui se suivent (moyenne · plus faible) | 0,19 · 0,06 | 0,20 · 0,08 |
| ressemblance du lot 49 de deux jours qui se suivent | 0,07 | 0,05 |
| paires de biomes nettement distinctes (≥ 2 grandeurs à ≥ 1 écart-type) | 27 / 28 | 28 / 28 |
| galerie, 30 jours du 29/10/2026 : jours avec le motif · paires de jours de suite | 14 · 6 | 4 · 0 |

**Profils par biome (v20 → v21)** : Stade amples 24 → 43 % · Rallye changements de direction 2,5 → 4,1 · Banquise amples 0 → 13 %, serrés 12 → 8 % · Nuit motif 64 → 20 %, sans rebords 20 → 25 % · Campagne dénivelé 20 → 24 m · Canyon serrés 34 → 35 % (malgré le retrait des épingles à plaque) · Col dénivelé 18,5 → 26,5 m, pentes 13 → 30 % · Ville serrés 47 → 50 %. La distance moyenne entre biomes bouge peu (0,13 → 0,14) : elle moyenne seize grandeurs, la plupart communes ; le critère « nettement distincts » dit ce qui se voit.

## Fiches de biomes (une ligne chacune)
- **Stade** — rapide : de grandes courbes amples et relevées, peu de serrés.
- **Rallye** — aérien : des virages qui changent de sens sans ligne droite libre de plus de 3 blocs, des bosses et des sauts.
- **Banquise** — mixte : la route large, des S larges et amples, un serré au plus, presque plat.
- **Nuit** — aérien : des sauts et la route au bord du vide.
- **Campagne** — technique : une route étroite qui ondule, des crêtes et des virages aveugles.
- **Canyon** — technique : des virages serrés entre les parois (quatre au plus), pas de ligne droite libre de plus de 3 blocs, le relief en marches.
- **Col alpin** — vertical : chaque droite libre en pente, des lacets et des demi-tours.
- **Ville** — technique : des angles droits et des rues courtes (4 blocs).

## Plafonds choisis
- **Le motif « boost → longue → serré »** : au plus **une fois par circuit**, **un jour rapide seulement** (donc jamais deux jours de suite, la règle des rythmes le garantit), jamais en virage-piège.
- **Toute suite de trois éléments : dans 40 % des circuits au plus** sur 200 jours (`PLAFOND_SUITE_3`). Pourquoi 40 % : la v20 avait deux suites à 44 % ; en v21 la plus haute est à 35 %, « boost → saut → descente », le plancher du saut à plat (sa rampe a besoin d'une plaque, sa réception est une descente). Descendre plus bas demandait de refuser des circuits : essayé sur « longue → boost → longue » (la poussée dans une grande ligne droite), 27 jours sur 365 sans circuit valide (0 permis) ou aucun effet (1 permis) : retiré.

## Temps de l'auteur
Temps du pilote (celui des médailles) sur les 200 jours : **v20 30,4 – 39,9 s** (P5 34,0, médiane 37,9) ; **v21 30,9 – 40,0 s** (P5 33,1, médiane 37,8) : dans la fenêtre 30–40 s et à ±10 % de la plage d'avant. Le temps de l'auteur affiché = 0,92 × pilote (lot G1, inchangé).

## Garde-fous
- **365 graines** : 365 sur 365 (`test/variete365.test.ts`, à partir du 01/01/2029) ; vérifié aussi à la main sur trois années (30/10/2026, 2028, 2029) : aucun circuit de secours. Tentatives par jour : 1,8–2,3 (v20) → 2,0–2,7 (v21).
- **Génération** : sur 200 jours, moyenne 128 ms, pire 455 ms (v20 : 130 et 827) en local ; sur trois années, pire jour 1 667 ms (v20 : 1 074). Le test 365 garde les limites de `generator.test.ts` (moyenne < 0,8 s, pire < 4,5 s). **Premier run de CI rouge** : avec la première version des fiches (Stade 100 % de courbes amples, Nuit sauts ×1,8), le pire jour du test valait 3 617 ms en CI (1 424 en local) et le test, qui recopiait à tort l'ancienne limite de 3,5 s, a échoué : les deux fiches sont adoucies (Stade 60 %, Nuit sauts ×1,4), pire jour 562 ms en local, et la limite est celle de `generator.test.ts`.
- **Golden** : les vecteurs gelés (v15, v16) sont inchangés au bit près (la régénération refuse de les réécrire) ; les vecteurs de la dernière version (dates d'après le 04/11/2026) sont régénérés, comme à chaque version (`UPDATE_GOLDEN=1`). `jours-passes.test.ts` vert (aucun jour du registre ne change).
- **Budgets** (contre `main` reconstruit à part, `node scripts/budgets.mjs`) : premier chargement **294 461 / 294 512 o** (+54 : l'entrée de la galerie ; marge 51 o) ; fil des circuits **29 459 / 30 000** (−352) et du Salon **31 605 / 32 000** (−386) : les phrases des figures (`intent`, lues par un test seulement) sortent dans `figureIntents.ts`, ce qui paie les rythmes, le motif et les fiches.

## Tests changés (et pourquoi)
- `generator.test.ts` : le Canyon a droit à quatre serrés à partir de la v21 (règle de sa fiche), comme la Ville.
- `figures.test.ts` : « favorites plus souvent que les autres » ne compte plus les figures qui font toujours le motif (elles ne sortent qu'un jour rapide, par la règle) ; la phrase d'une figure se lit dans `figureIntents.ts`.
- `freinage.test.ts` : `GENERATOR_VERSION` vaut 21.
- Nouveaux : `variete.test.ts` (mesure, rythmes, plafonds sur 200 graines, zone de freinage), `variete365.test.ts`, `apps/web/test/galerie.test.ts`.

## Vérifié / non vérifié
- Vérifié en local : tests de `packages/sim` (tous), typecheck, construction, budgets, galerie dans Chromium (captures : `lot-V2/galerie-actuelle.png`, `lot-V2/galerie-nouvelle.png`), `npm run verifier`. `FAST=1 npm run measure:generator` tourne (sortie 0), mais ses tableaux de validation comparent encore les v15 et v16 : la validation de la v21 vient de `mesure-circuits` (200 jours, 0 secours) et des 3 × 365 jours.
- **Non vérifié** : la conduite des circuits v21 à la main (à faire par Nathan : 2 ou 3 jours de la galerie avec `?seed=<date>`) ; Firefox et WebKit (CI).
- **CI de PR verte** sur `6704535` : https://github.com/Nathan-Te/DailyTrack/actions/runs/40924913159 (5,9 min) ; `npm run verifier` vert en local (unitaires SQLite et libSQL, constructions, 28 specs e2e Chromium). `main` n'avait pas bougé depuis la base de la branche (36f44ab) : rien à fusionner.

## Décisions laissées à Nathan
- Les blocs du lot V2b (`docs/track/blocs-proposes.md`) ; ils touchent presque tous le premier chargement, qui n'a plus que 51 o de marge : un relèvement sera nécessaire.
- La marge de 105 o écrite dans le `CLAUDE.md` racine (zone partagée, non modifiée par ce lot) vaut désormais **51 o**.
- Ce lot touche, comme son énoncé le demande, trois fichiers hors des zones de Track : `package.json` (le script `mesure-circuits`), `docs/track/**` et `scripts/unit-durees.json` (durées des nouveaux tests) — la PR ne porte pas l'étiquette `jeu:track`.
