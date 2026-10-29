# Variété des circuits de Track (lot V2)

Produit par `npm run mesure-circuits -- --jours 200 --depuis 2026-10-30` (`packages/sim/scripts/mesure-circuits.ts`, hors CI) : les circuits des 200 jours du 2026-10-30 au 2027-05-17, générés avec chaque version (v20 → v21) sur les mêmes jours (la version est imposée : `dailyCircuit(jour, 0, null, g)`). Définitions : `packages/sim/src/variete.ts`. **Ne pas modifier à la main** : relancer la commande.

- **Éléments** : `boost` (plaque, super turbo), `longue` (trois blocs droits ou plus), `serré` / `large` / `ample` (virages d'une, deux, trois cellules), `relevé`, `montée`, `descente`, `saut`, `cuve`, `bosse`, `coupé` ; une droite d'un ou deux blocs n'est qu'une liaison et n'entre pas dans les motifs.
- **Fréquence d'un motif** : la part des circuits qui le contiennent au moins une fois.
- **Distance de deux profils** : la moyenne des écarts de seize grandeurs ramenées entre 0 et 1 (lignes droites, rayons, part des serrés et des amples, dénivelé, montée, changements de direction, largeur de la route, part sans rebords, part des boosts, des sauts, des cuves et des pentes, temps de l'auteur) ; 0 = identiques.

## 1. Résumé avant / après

| mesure | v20 | v21 |
|---|---:|---:|
| circuits avec « boost → longue → serré » | 44 % | 10 % |
| ce motif, au plus par circuit | 3 | 1 |
| jours de suite qui l'ont tous les deux | 40 | 0 |
| motif de trois éléments le plus fréquent | boost → longue → large (44 %) | boost → saut → descente (35 %) |
| motif de deux éléments le plus fréquent | boost → longue (89 %) | boost → longue (70 %) |
| distance des profils de deux jours qui se suivent (moyenne) | 0.19 | 0.20 |
| … la plus faible | 0.06 | 0.08 |
| ressemblance (lot 49) de deux jours qui se suivent | 0.07 | 0.05 |
| distance entre deux biomes (moyenne des paires) | 0.13 | 0.14 |
| … les deux biomes les plus proches | banquise / campagne (0.05) | banquise / campagne (0.06) |
| paires de biomes nettement distinctes (≥ 2 grandeurs à ≥ 1 écart-type) | 27 / 28 | 28 / 28 |
| grandeurs nettement différentes par paire (moyenne) | 6.0 | 5.8 |
| temps du pilote : min · P5 · médiane · P95 · max (s) | 30.4 · 34.0 · 37.9 · 39.7 · 39.9 | 30.9 · 33.1 · 37.8 · 39.6 · 40.0 |
| circuits de secours | 0 | 0 |
| génération : moyenne · pire (ms, cette machine) | 130 · 827 | 128 · 455 |

## 2. Motifs (v20)

Les quinze suites de trois éléments et les dix de deux les plus fréquentes, puis les suites de figures.

| suite de trois | circuits | | suite de deux | circuits |
|---|---:|---|---|---:|
| boost → longue → large | 44 % | | boost → longue | 89 % |
| boost → longue → serré | 44 % | | longue → large | 72 % |
| longue → large → large | 40 % | | longue → serré | 68 % |
| boost → saut → descente | 35 % | | large → large | 58 % |
| saut → descente → longue | 34 % | | large → longue | 56 % |
| longue → boost → longue | 33 % | | longue → boost | 54 % |
| large → large → longue | 29 % | | descente → longue | 48 % |
| longue → serré → longue | 24 % | | descente → large | 47 % |
| boost → boost → longue | 22 % | | montée → descente | 42 % |
| descente → large → montée | 21 % | | saut → descente | 36 % |
| descente → longue → large | 21 % | |  |  |
| longue → large → longue | 20 % | |  |  |
| boost → longue → relevé | 19 % | |  |  |
| longue → montée → descente | 18 % | |  |  |
| montée → large → descente | 18 % | |  |  |

Figures les plus présentes (part des circuits) : plaque-virage (35 %) ; pincement (27 %) ; colline-douce (26 %) ; virage-descente (25 %) ; virage-aveugle (22 %) ; chaine-turbo (22 %) ; turbo-epingle (21 %) ; descente-plaque (18 %).

Suites de deux figures les plus fréquentes : chaine-turbo → colline-douce (6 %) ; virage-aveugle → etranglement-terre (5 %) ; plaque-virage → saut-sortie-virage (4 %) ; colline-douce → coupe-virage (4 %) ; descente-plaque → demi-tour-mixte (4 %).

Suites de trois figures : chaine-turbo → colline-douce → coupe-virage (3 %) ; etranglement-terre → plaque-virage → saut-sortie-virage (3 %) ; plaque-virage → saut-sortie-virage → chicane-herbe (3 %) ; virage-aveugle → descente-plaque → demi-tour-mixte (3 %) ; virage-aveugle → etranglement-terre → plaque-virage (3 %).

## 2. Motifs (v21)

Les quinze suites de trois éléments et les dix de deux les plus fréquentes, puis les suites de figures.

| suite de trois | circuits | | suite de deux | circuits |
|---|---:|---|---|---:|
| boost → saut → descente | 35 % | | boost → longue | 70 % |
| saut → descente → longue | 34 % | | longue → large | 56 % |
| longue → large → large | 29 % | | large → longue | 56 % |
| boost → longue → relevé | 28 % | | descente → longue | 53 % |
| large → large → longue | 27 % | | montée → descente | 52 % |
| longue → boost → longue | 26 % | | large → large | 50 % |
| longue → large → longue | 20 % | | longue → boost | 45 % |
| boost → longue → ample | 20 % | | longue → serré | 44 % |
| boost → longue → large | 20 % | | longue → relevé | 40 % |
| longue → montée → descente | 19 % | | saut → longue | 40 % |
| montée → descente → longue | 19 % | |  |  |
| large → large → large | 18 % | |  |  |
| descente → longue → large | 16 % | |  |  |
| descente → large → montée | 15 % | |  |  |
| longue → serré → longue | 14 % | |  |  |

Figures les plus présentes (part des circuits) : plaque-virage (35 %) ; colline-douce (27 %) ; pincement (27 %) ; descente-plaque (27 %) ; virage-descente (26 %) ; turbo-courbe (23 %) ; colline-raide (21 %) ; virage-aveugle (20 %).

Suites de deux figures les plus fréquentes : descente-plaque → saut-terre (5 %) ; descente-plaque → demi-tour-mixte (4 %) ; etranglement-terre → virage-aveugle (4 %) ; saut-terre → demi-tour-large (4 %) ; plaque-virage → saut-sortie-virage (4 %).

Suites de trois figures : demi-tour-large → demi-tour-mixte → descente-plaque (2 %) ; demi-tour-mixte → descente-plaque → saut-terre (2 %) ; descente-plaque → demi-tour-mixte → chicane-herbe (2 %) ; esse-relevee → colline-douce → virage-cuve (2 %) ; etranglement-terre → plaque-virage → saut-sortie-virage (2 %).

## 3. Profils par biome (v20)

| biome | jours | droite moy. (blocs) | droite max | lignes ≥ 3 blocs | rayon moy. (m) | serrés | amples | dénivelé (m) | montée (m) | changements de direction | largeur (m) | sans rebords | boosts | sauts | cuves | pentes | auteur (s) | motif « boost → longue → serré » |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| stade | 25 | 5.7 | 11.9 | 69 % | 49.9 | 18 % | 24 % | 14.1 | 16.3 | 1.9 | 19.7 | 0 % | 5 % | 6 % | 7 % | 14 % | 37.8 | 56 % |
| rallye | 25 | 4.3 | 9.8 | 64 % | 49.0 | 4 % | 7 % | 17.1 | 13.9 | 2.5 | 15.8 | 0 % | 4 % | 7 % | 0 % | 16 % | 38.0 | 4 % |
| banquise | 25 | 5.0 | 10.6 | 73 % | 44.3 | 12 % | 0 % | 17.3 | 12.3 | 3.6 | 18.9 | 0 % | 3 % | 2 % | 1 % | 18 % | 37.9 | 0 % |
| nuit | 25 | 5.1 | 13.2 | 62 % | 46.5 | 16 % | 11 % | 15.5 | 16.8 | 2.0 | 19.3 | 20 % | 3 % | 5 % | 7 % | 13 % | 38.3 | 64 % |
| campagne | 24 | 4.8 | 10.1 | 74 % | 43.0 | 23 % | 7 % | 20.3 | 13.2 | 3.2 | 16.8 | 0 % | 4 % | 2 % | 0 % | 19 % | 37.5 | 42 % |
| canyon | 26 | 5.8 | 13.7 | 82 % | 43.3 | 34 % | 19 % | 18.3 | 22.9 | 1.4 | 18.0 | 2 % | 5 % | 10 % | 6 % | 15 % | 37.8 | 62 % |
| col | 24 | 4.3 | 11.7 | 58 % | 42.4 | 22 % | 4 % | 18.5 | 7.5 | 4.1 | 16.7 | 4 % | 6 % | 2 % | 0 % | 13 % | 37.0 | 54 % |
| ville | 26 | 3.9 | 11.3 | 44 % | 33.3 | 47 % | 1 % | 14.3 | 10.9 | 4.9 | 16.5 | 0 % | 5 % | 2 % | 0 % | 14 % | 36.5 | 69 % |
| **tous** | 200 | 4.9 | 11.5 | 66 % | 43.9 | 22 % | 9 % | 16.9 | 14.3 | 2.9 | 17.7 | 3 % | 5 % | 4 % | 2 % | 15 % | 37.6 | 44 % |

Distances entre les profils moyens des biomes (v20) :

| | stade | rallye | banquise | nuit | campagne | canyon | col | ville |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| stade | — | 0.11 | 0.12 | 0.08 | 0.14 | 0.09 | 0.15 | 0.18 |
| rallye | 0.11 | — | 0.09 | 0.14 | 0.08 | 0.15 | 0.10 | 0.13 |
| banquise | 0.12 | 0.09 | — | 0.14 | 0.05 | 0.16 | 0.09 | 0.12 |
| nuit | 0.08 | 0.14 | 0.14 | — | 0.17 | 0.14 | 0.16 | 0.21 |
| campagne | 0.14 | 0.08 | 0.05 | 0.17 | — | 0.15 | 0.07 | 0.10 |
| canyon | 0.09 | 0.15 | 0.16 | 0.14 | 0.15 | — | 0.17 | 0.20 |
| col | 0.15 | 0.10 | 0.09 | 0.16 | 0.07 | 0.17 | — | 0.07 |
| ville | 0.18 | 0.13 | 0.12 | 0.21 | 0.10 | 0.20 | 0.07 | — |

Ce qui distingue deux biomes (v20) : les grandeurs dont l'écart des moyennes vaut au moins 1 écart-type d'un jour à l'autre (+ : le premier en a plus). 27 paires sur 28 en ont au moins 2.

| paire | grandeurs nettement différentes |
|---|---|
| stade / rallye | droite moy. +, serrés +, amples +, largeur +, cuves + |
| stade / banquise | rayon +, amples +, changements −, boosts +, sauts +, cuves +, pentes − |
| stade / nuit | sans rebords −, boosts + |
| stade / campagne | rayon +, amples +, montée +, changements −, largeur +, sauts +, cuves +, pentes − |
| stade / canyon | serrés −, montée −, sauts − |
| stade / col | droite moy. +, rayon +, amples +, montée +, changements −, largeur +, sans rebords −, sauts +, cuves + |
| stade / ville | droite moy. +, lignes longues +, rayon +, serrés −, amples +, montée +, changements −, largeur +, sauts +, cuves + |
| rallye / banquise | rayon +, serrés −, amples +, largeur −, sauts + |
| rallye / nuit | serrés −, largeur −, sans rebords −, cuves − |
| rallye / campagne | rayon +, serrés −, sauts + |
| rallye / canyon | droite moy. −, lignes longues −, serrés −, amples −, montée −, changements +, largeur −, sauts −, cuves − |
| rallye / col | rayon +, serrés −, changements −, sans rebords −, sauts + |
| rallye / ville | lignes longues +, rayon +, serrés −, changements −, sauts + |
| banquise / nuit | amples −, changements +, sans rebords −, sauts −, cuves −, pentes + |
| banquise / campagne | serrés −, amples −, largeur + |
| banquise / canyon | droite moy. −, serrés −, amples −, montée −, changements +, boosts −, sauts −, cuves − |
| banquise / col | serrés −, sans rebords −, boosts −, pentes + |
| banquise / ville | droite moy. +, lignes longues +, rayon +, serrés −, largeur +, boosts −, pentes + |
| nuit / campagne | lignes longues −, montée +, changements −, largeur +, sans rebords +, sauts +, cuves +, pentes − |
| nuit / canyon | lignes longues −, serrés −, montée −, sans rebords +, boosts −, sauts − |
| nuit / col | montée +, changements −, largeur +, sans rebords +, boosts −, sauts +, cuves + |
| nuit / ville | droite moy. +, lignes longues +, rayon +, serrés −, amples +, montée +, changements −, largeur +, sans rebords +, boosts −, sauts +, cuves + |
| campagne / canyon | droite moy. −, droite max −, amples −, montée −, changements +, boosts −, sauts −, cuves − |
| campagne / col | sans rebords − |
| campagne / ville | droite moy. +, lignes longues +, rayon +, serrés −, changements − |
| canyon / col | droite moy. +, lignes longues +, amples +, montée +, changements −, sauts +, cuves + |
| canyon / ville | droite moy. +, lignes longues +, rayon +, serrés −, amples +, montée +, changements −, sauts +, cuves + |
| col / ville | rayon +, serrés −, sans rebords + |

## 3. Profils par biome (v21)

| biome | jours | droite moy. (blocs) | droite max | lignes ≥ 3 blocs | rayon moy. (m) | serrés | amples | dénivelé (m) | montée (m) | changements de direction | largeur (m) | sans rebords | boosts | sauts | cuves | pentes | auteur (s) | motif « boost → longue → serré » |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| stade | 25 | 5.0 | 10.0 | 67 % | 58.7 | 9 % | 43 % | 14.9 | 18.4 | 1.7 | 18.8 | 0 % | 4 % | 7 % | 6 % | 15 % | 37.1 | 0 % |
| rallye | 25 | 4.0 | 9.9 | 61 % | 50.5 | 2 % | 10 % | 19.8 | 13.3 | 4.1 | 16.2 | 0 % | 4 % | 7 % | 0 % | 17 % | 37.5 | 0 % |
| banquise | 25 | 4.9 | 10.0 | 73 % | 49.5 | 8 % | 13 % | 17.1 | 12.3 | 3.7 | 18.9 | 0 % | 4 % | 2 % | 1 % | 18 % | 38.0 | 0 % |
| nuit | 25 | 4.9 | 12.7 | 57 % | 51.5 | 7 % | 18 % | 15.4 | 15.7 | 2.2 | 17.7 | 25 % | 3 % | 5 % | 7 % | 13 % | 38.7 | 20 % |
| campagne | 24 | 4.8 | 10.3 | 81 % | 46.5 | 19 % | 15 % | 23.5 | 13.3 | 3.5 | 16.8 | 0 % | 3 % | 3 % | 0 % | 23 % | 37.3 | 4 % |
| canyon | 26 | 5.5 | 12.7 | 78 % | 44.3 | 35 % | 24 % | 17.2 | 22.5 | 1.8 | 17.6 | 1 % | 5 % | 10 % | 6 % | 15 % | 36.9 | 12 % |
| col | 24 | 4.5 | 11.7 | 64 % | 47.3 | 15 % | 13 % | 26.5 | 18.2 | 3.4 | 17.8 | 8 % | 4 % | 3 % | 0 % | 30 % | 36.8 | 17 % |
| ville | 26 | 3.9 | 10.5 | 51 % | 34.9 | 50 % | 9 % | 14.6 | 12.3 | 4.7 | 16.1 | 0 % | 4 % | 3 % | 0 % | 14 % | 35.5 | 27 % |
| **tous** | 200 | 4.7 | 11.0 | 66 % | 47.8 | 18 % | 18 % | 18.5 | 15.8 | 3.1 | 17.5 | 4 % | 4 % | 5 % | 3 % | 18 % | 37.2 | 10 % |

Distances entre les profils moyens des biomes (v21) :

| | stade | rallye | banquise | nuit | campagne | canyon | col | ville |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| stade | — | 0.12 | 0.11 | 0.12 | 0.15 | 0.10 | 0.16 | 0.19 |
| rallye | 0.12 | — | 0.07 | 0.16 | 0.08 | 0.16 | 0.11 | 0.10 |
| banquise | 0.11 | 0.07 | — | 0.15 | 0.06 | 0.16 | 0.09 | 0.12 |
| nuit | 0.12 | 0.16 | 0.15 | — | 0.18 | 0.16 | 0.17 | 0.21 |
| campagne | 0.15 | 0.08 | 0.06 | 0.18 | — | 0.16 | 0.07 | 0.12 |
| canyon | 0.10 | 0.16 | 0.16 | 0.16 | 0.16 | — | 0.18 | 0.19 |
| col | 0.16 | 0.11 | 0.09 | 0.17 | 0.07 | 0.18 | — | 0.14 |
| ville | 0.19 | 0.10 | 0.12 | 0.21 | 0.12 | 0.19 | 0.14 | — |

Ce qui distingue deux biomes (v21) : les grandeurs dont l'écart des moyennes vaut au moins 1 écart-type d'un jour à l'autre (+ : le premier en a plus). 28 paires sur 28 en ont au moins 2.

| paire | grandeurs nettement différentes |
|---|---|
| stade / rallye | droite moy. +, rayon +, amples +, changements −, largeur +, cuves + |
| stade / banquise | rayon +, amples +, montée +, changements −, sauts +, cuves + |
| stade / nuit | amples +, sans rebords −, auteur − |
| stade / campagne | lignes longues −, rayon +, amples +, dénivelé −, montée +, changements −, sauts +, cuves +, pentes − |
| stade / canyon | rayon +, serrés −, sauts − |
| stade / col | rayon +, amples +, dénivelé −, changements −, sans rebords −, sauts +, cuves +, pentes − |
| stade / ville | droite moy. +, lignes longues +, rayon +, serrés −, amples +, changements −, largeur +, sauts +, cuves + |
| rallye / banquise | droite moy. −, largeur −, sauts + |
| rallye / nuit | droite moy. −, changements +, sans rebords −, cuves −, pentes + |
| rallye / campagne | droite moy. −, lignes longues −, serrés −, sauts + |
| rallye / canyon | droite moy. −, lignes longues −, serrés −, montée −, changements +, boosts −, sauts −, cuves − |
| rallye / col | serrés −, dénivelé −, sans rebords −, sauts +, pentes − |
| rallye / ville | rayon +, serrés −, sauts + |
| banquise / nuit | lignes longues +, changements +, sans rebords −, sauts −, cuves −, pentes + |
| banquise / campagne | serrés −, largeur + |
| banquise / canyon | serrés −, montée −, changements +, boosts −, sauts −, cuves − |
| banquise / col | dénivelé −, sans rebords −, pentes − |
| banquise / ville | droite moy. +, lignes longues +, rayon +, serrés −, largeur +, auteur + |
| nuit / campagne | lignes longues −, serrés −, dénivelé −, changements −, sans rebords +, sauts +, cuves +, pentes −, auteur + |
| nuit / canyon | lignes longues −, serrés −, montée −, sans rebords +, boosts −, sauts −, pentes −, auteur + |
| nuit / col | dénivelé −, sans rebords +, sauts +, cuves +, pentes −, auteur + |
| nuit / ville | droite moy. +, rayon +, serrés −, changements −, sans rebords +, cuves +, auteur + |
| campagne / canyon | droite moy. −, serrés −, montée −, changements +, boosts −, sauts −, cuves −, pentes + |
| campagne / col | lignes longues +, sans rebords − |
| campagne / ville | droite moy. +, lignes longues +, rayon +, serrés −, dénivelé +, pentes + |
| canyon / col | droite moy. +, serrés +, dénivelé −, changements −, sans rebords −, sauts +, cuves +, pentes − |
| canyon / ville | droite moy. +, lignes longues +, rayon +, serrés −, montée +, changements −, sauts +, cuves + |
| col / ville | rayon +, serrés −, dénivelé +, sans rebords +, pentes + |

## 4. Rythmes (v21)

| rythme | jours | droite moy. | serrés | dénivelé (m) | sauts | boosts | auteur (s) | motif |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| aérien | 47 | 4.6 | 14 % | 18.0 | 6 % | 4 % | 38.0 | 0 % |
| mixte | 24 | 4.8 | 18 % | 15.8 | 5 % | 4 % | 36.9 | 0 % |
| rapide | 40 | 4.5 | 23 % | 17.8 | 4 % | 4 % | 37.4 | 50 % |
| technique | 45 | 4.8 | 20 % | 19.6 | 5 % | 4 % | 37.0 | 0 % |
| vertical | 44 | 4.7 | 18 % | 20.3 | 5 % | 4 % | 36.6 | 0 % |

Deux jours de suite avec le même rythme : 0.

### Rythme par biome

| biome | aérien | mixte | rapide | technique | vertical |
|---|---:|---:|---:|---:|---:|
| stade | 6 | 4 | 5 | 4 | 6 |
| rallye | 9 | 1 | 5 | 6 | 4 |
| banquise | 4 | 7 | 3 | 5 | 6 |
| nuit | 10 | 2 | 6 | 6 | 1 |
| campagne | 5 | 2 | 5 | 6 | 6 |
| canyon | 3 | 4 | 3 | 10 | 6 |
| col | 6 | 0 | 6 | 2 | 10 |
| ville | 4 | 4 | 7 | 6 | 5 |
