# Lot V3 — mesures

Produites par `npm run niveaux:vertige -w @cdj/vertige-sim` (Node, machine de Nathan : Windows 11, Node 24) ; les durées sont des ordres de grandeur d'une machine, les comptes sont exacts. Les chiffres du navigateur et du poids sont en fin de fichier.

## Les 365 jours (365 jours à partir du 2026-11-02)

## Temps de génération (Node v24.16.0, un niveau à froid, tirages refusés compris)
- le catalogue de variantes (14 modules, miroirs, 8 formes pilotées) : 91.8 ms, une fois ;
- un niveau : médiane 30.7 ms, moyenne 37.0 ms, pire 129.1 ms ; les 365 niveaux : 13.5 s.

## Histogramme des temps du robot (secondes, de son premier mouvement à l'arrivée)
mini 28.1 s · médiane 33.6 s · maxi 38.0 s

| temps | niveaux | |
|---|---|---|
| 28 – 29 s | 15 | ████████ |
| 29 – 30 s | 30 | ███████████████ |
| 30 – 31 s | 46 | ███████████████████████ |
| 31 – 32 s | 40 | ████████████████████ |
| 32 – 33 s | 32 | ████████████████ |
| 33 – 34 s | 32 | ████████████████ |
| 34 – 35 s | 44 | ██████████████████████ |
| 35 – 36 s | 52 | ██████████████████████████ |
| 36 – 37 s | 51 | ██████████████████████████ |
| 37 – 38 s | 23 | ████████████ |

## Nombre de modules par niveau et tirages refusés
6 modules : 162 · 7 modules : 203

139 tirages refusés pour 365 niveaux (pire jour : 3), secours (cycles ignorés) : 0.

| motif du refus | fois |
|---|---|
| monde tourné | 65 |
| le robot met N s (de N à N s) | 45 |
| la seconde moitié n'est pas plus dure que la première (N) | 29 |

## Fréquence de chaque module (nombre de niveaux qui le contiennent, sur 365)
| module de base | niveaux |
|---|---|
| dash-1 | 218 |
| saut-1 | 209 |
| saut-2 | 208 |
| dash-2 | 194 |
| mur-1 | 174 |
| portail-quart | 165 |
| gravite-1 | 164 |
| gravite-2 | 154 |
| mur-2 | 153 |
| portail-gravite | 148 |
| mur-dash | 139 |
| gravite-portail | 135 |
| portail-1 | 129 |
| portail-gravite-retour | 107 |

## Fréquence de chaque variante (nombre de modules posés, sur l'ensemble des niveaux)
| variante | posée | forme | miroir |
|---|---|---|---|
| saut-1 | 83 | base | non |
| saut-1/c | 86 | court | non |
| saut-1/l | 52 | long | non |
| saut-2 | 89 | base | non |
| saut-2/c | 52 | court | non |
| saut-2/l | 80 | long | non |
| mur-1 | 88 | base | non |
| mur-1~ | 89 | base | oui |
| mur-2 | 75 | base | non |
| mur-2~ | 82 | base | oui |
| mur-dash | 74 | base | non |
| mur-dash~ | 70 | base | oui |
| dash-1 | 77 | base | non |
| dash-1/c | 104 | court | non |
| dash-1/l | 54 | long | non |
| dash-2 | 74 | base | non |
| dash-2/c | 54 | court | non |
| dash-2/l | 83 | long | non |
| gravite-1 | 83 | base | non |
| gravite-1~ | 85 | base | oui |
| gravite-2 | 79 | base | non |
| gravite-2~ | 80 | base | oui |
| gravite-portail | 69 | base | non |
| gravite-portail~ | 69 | base | oui |
| portail-1 | 129 | base | non |
| portail-quart | 102 | base | non |
| portail-quart~ | 72 | base | oui |
| portail-gravite | 73 | base | non |
| portail-gravite~ | 76 | base | oui |
| portail-gravite-retour | 46 | base | non |
| portail-gravite-retour~ | 64 | base | oui |

2393 modules posés : base 1141 · base + miroir 687 · court 296 · long 269.

## Placement et monde tourné
- 226 niveaux passent par un monde tourné (dont 0 avec deux passages) ;
- distance minimale entre deux modules non voisins : 32.6 m au plus bas, médiane 42.0 m (seuil : 30 m).

## Rejeu serveur d'une partie de 45 s sur un niveau du jour
- partie de 5400 pas (45 s), rediffusion de 22787 caractères (17083 octets) : **18.7 ms** (médiane de 30, niveau déjà assemblé), pire 29.5 ms ;
- le robot (4116 pas, 34.3 s, rediffusion de 126 caractères) : 12.1 ms ;
- le tout premier envoi d'un jour, à froid (niveau à générer, assembler et rejouer) : 64.6 ms.

## Le navigateur et le poids
- **Génération d'un niveau dans Chromium** (60 jours consécutifs, `window.__jours` de `verify.html`, machine de Nathan) : **médiane 13 ms, moyenne 17 ms, pire 104 ms** — le pire est le premier, qui construit le catalogue de variantes ; 60 niveaux en 1,0 s. Firefox et WebKit : rejoués par le job `@navigateurs` de la CI (le temps de chaque niveau est annoté dans le rapport du spec `determinisme`).
- **Golden** : 10 jours (modules, temps du robot, empreinte du contenu, empreinte des boîtes du niveau assemblé) et 6 rediffusions de jours (le robot de 4 jours, une reprise au palier, une marche au hasard) : Node (`golden.test.ts`) et Chromium (`e2e/determinisme.spec.ts`) trouvent les mêmes résultats et les mêmes empreintes d'état tous les 600 pas.
- **Premier chargement** (`vertige.jsCss`, `scripts/budgets.mjs` → `mesureJeuNeuf`) : **50 631 o** (V2 : 52 218 o ; plafond 55 Ko, marge 4 369 o). Le générateur, la bibliothèque et les variantes sont un seul morceau à la demande, `modulesIndex-` (51 Ko brut, 19 Ko gzip), chargé pendant que l'accueil s'affiche ; la galerie des jours est `galerieJours-` (1,5 Ko). Le morceau `enchainement-` du premier chargement disparaît (fondu dans `modulesIndex-`).
- **Fantôme** : 1 `Partie` de plus par partie (≈ 8 ms pour 4 000 pas de simulation en Node, soit ≈ 2 µs par pas) ; une capsule de 4 × 12 segments.
