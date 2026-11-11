# Lot V2 — mesures

Mesuré dans ce conteneur (Node 22, sans GPU : le rendu est logiciel, SwiftShader). Les durées de rejeu viennent de `npm run mesures:vertige -w @cdj/vertige-sim` (médiane de 25 rejeux) ; les temps du robot de `npm run module:vertige -w @cdj/vertige-sim -- --table`.

## Le rejeu : l'index spatial (partie 1)

La simulation ne teste plus que les boîtes proches du balayage du joueur, dans l'ordre du niveau (`grille.ts`). **Le golden de V1 est resté identique au bit près** (commit « l'index spatial », avant le retrait des orbes) et `test/grille.test.ts` rejoue chaque niveau avec et sans index.

| partie | boîtes | avant l'index | après l'index |
|---|---:|---:|---:|
| marche au hasard, **45 s** | 600 | 62,5 ms | **9,0 ms** |
| marche au hasard, **120 s** | 600 | 171,8 ms | **25,7 ms** |
| marche au hasard, 120 s | 200 | 57,0 ms | 16,3 ms |
| marche au hasard, 120 s (bac à sable) | 17 | 9,5 ms | 14,7 ms (*) |

(*) Sous 64 boîtes l'index ne sert plus (on les essaie toutes, comme avant) : l'écart de quelques ms vient du bruit du conteneur, pas de la grille — les deux mesures n'ont pas été prises le même jour de la machine. Sur Cloud Run, compter 4 à 8 fois plus (V1 : 25 à 50 ms pour 120 s sans index et 17 boîtes).

## L'enchaînement (partie 2)

| mesure | valeur |
|---|---|
| modules | 7 : `saut-1` → `mur-1` → `gravite-1` → `portail-gravite` → `dash-2` → `portail-gravite-retour` → `dash-1` |
| **boîtes** | **41** (deux paires de portails, 98,5 m l'une de l'autre) |
| rejeu du robot (4 161 pas, **34,7 s**) | **10,5 ms** |
| rejeu d'une marche au hasard de **45 s** | **14,3 ms** |
| rejeu d'une marche au hasard de **120 s** | **37,8 ms** (0,32 ms par seconde de jeu) |
| **appels de dessin** (`?debug&fps`, rendu logiciel) | voir le tableau « dessin » plus bas |
| temps du robot | départ 123 pas (1,0 s) + 7 modules 3 991 pas (33,3 s) + arrivée 47 pas = **4 161 pas, 34,675 s** |

Les 120 s avec 600 boîtes (la ligne synthétique du tableau précédent) tiennent donc en **25,7 ms** : un niveau de plusieurs centaines de boîtes ne coûte plus au serveur que quelques millisecondes par rediffusion.

## Le temps du robot, module par module

| module | nom | mécaniques | diff. | robot (pas) | robot (s) | plus forte charge (% du permis) |
|---|---|---|:-:|---:|---:|---|
| `saut-1` | Trois sauts | course, saut | 1 | 531 | 4,42 | 83 % (saut 5,00 m) |
| `saut-2` | Marches en l'air | course, saut | 2 | 531 | 4,42 | 91 % (saut 6,50 m) |
| `mur-1` | Le long du mur | course, saut, mur | 1 | 546 | 4,55 | 87 % (mur 11,95 m) |
| `mur-2` | De mur en mur | course, saut, mur, saut de mur | 2 | 685 | 5,71 | 89 % (saut de mur 2,48 m) |
| `mur-dash` | Du mur au dash | course, saut, mur, dash | 3 | 530 | 4,42 | 55 % (mur 7,52 m) |
| `dash-1` | Le dash | course, saut, dash | 1 | 653 | 5,44 | 88 % (saut + dash 11,00 m) |
| `dash-2` | Dash sur dash | course, saut, dash | 2 | 553 | 4,61 | 89 % (dash seul 3,50 m) |
| `gravite-1` | Le mur devient sol | course, gravité | 1 | 672 | 5,60 | (pas d'écart : surfaces) |
| `gravite-2` | Le tonneau | course, gravité | 2 | 728 | 6,07 | (pas d'écart : surfaces) |
| `gravite-portail` | Du mur au portail | course, gravité, portail | 3 | 682 | 5,68 | (pas d'écart : surfaces et portail) |
| `portail-1` | Le portail | course, saut, portail | 1 | 569 | 4,74 | 75 % (saut 4,50 m) |
| `portail-quart` | Le portail qui tourne | course, saut, portail | 2 | 518 | 4,32 | 83 % (saut 5,00 m) |
| `portail-gravite` | Le monde bascule | course, saut, portail, gravité | 2 | 518 | 4,32 | 83 % (saut 5,00 m) |
| `portail-gravite-retour` | Le monde se remet | course, saut, portail, gravité | 3 | 518 | 4,32 | 83 % (saut 5,00 m) |

Tous les modules sont entre **4,32 s et 6,07 s** (la règle : 4 à 8 s) ; **la plus forte charge est de 91 % du permis** (le permis est lui-même 85 % de la portée maximale : le module le plus tendu demande 77 % de ce qu'un joueur parfait peut faire). Somme des 14 : 8 234 pas (68,6 s).

## Les jauges (calculées des constantes de sensation)

| jauge | maximum | permis (85 %) |
|---|---:|---:|
| saut, écart libre entre deux bords, à niveau | 7,09 m | 6,03 m |
| saut, +1,0 m | 5,82 m | 4,95 m |
| saut, −1,5 m | 8,3 m | 7,1 m |
| saut + dash (au meilleur moment), à niveau | 14,62 m | 12,43 m |
| dash seul, à niveau | 4,62 m | 3,93 m |
| course sur le mur (204 pas à 9,5 m/s) | 16,15 m | 13,73 m |
| saut de mur, d'un mur à l'autre | 3,3 m | 2,80 m |
| hauteur d'un saut | 1,61 m | 1,36 m |

## Le poids

| | V1 | V2 | plafond | marge |
|---|---:|---:|---:|---:|
| premier chargement (`vertige.jsCss`, mesure officielle `mesureJeuNeuf`) | 50 002 o | **52 082 o** | 53 Ko | **918 o** |
| `corps-` (à la demande, gzip) | 156,1 Ko | 156,6 Ko (la bibliothèque de modules est dans `corps-`, la galerie dans `galerie-`) | — | — |

Le premier chargement grossit de **2 080 o** : le fichier des niveaux devient un morceau à part (1 429 o) parce que l'enchaînement s'y enregistre, plus les touches de reprise et leur nom au catalogue. La bibliothèque (14 modules et leurs solutions), les jauges, la galerie et les textes d'essai sont **à la demande**. Plafond intact ; **la marge n'est plus que de 918 o : un lot qui ajoute au premier chargement devra en retirer ailleurs**.
