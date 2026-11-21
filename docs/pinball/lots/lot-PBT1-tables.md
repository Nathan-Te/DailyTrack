# Lot PBT1 — Pinball : les trois tables dessinées avec Nathan

Branche `ccr-162193cc-ju669l` (le nom imposé à cette session ; la consigne disait `claude/pinball-tables-1`), PR brouillon `jeu:pinball`. Les trois tables de Nathan (A « Classique », B « Rampe et orbite », C « Mini-batteur », chacune jouable en miroir) remplacent les quatre plans tirés au hasard. Le jeu est `off` : **Pour les joueurs : rien**.

## Historique du lot
1. **Première passe : arrêt** (commit `f3f95a7`). Construites exactement comme dessinées, les 24 tables étaient refusées par la fenêtre de tir humaine (≥ 30 ms) : le verrou (0 à 21 ms, même sans limite de vitesse de capture) et la bouche de l'orbite (5 à 16 ms) ne se visaient pas ; les rampes et les missions se corrigeaient dans les ±15 px.
2. **Décision de Nathan : option 1** — redessiner le verrou et la bouche de l'orbite sur l'éventail du geste, garder le reste. Les rampes et la mission de la table A ont été retouchées dans les ±15 px.
3. **Résultat** : les 24 tables passent toutes les fenêtres (36 ms au pire), la validation (billes coincées, modules touchés, mission, porte, rampes, orbite) et le robot.

## Écarts avec le dessin (position voulue → position finale, raison)
| Élément | Voulue | Finale | Écart | Raison |
|---|---|---|---|---|
| Bumpers A, B, C ; banque C ; mini-batteur C ; poteau sauveur ; portails ± 30 px | dessin | dessin | 0 | — |
| **Banque A** (flanc droit) | cibles x = 329, y = 340, 366, 392 ; fond x = 340 | cibles x = 335, y = 334, 360, 386 ; fond x = 346, de 316 à 402 | (+6, −6) | la banque est un tir numéroté : 11 → 96 ms |
| **Banque B** (diagonale −28°) | (88, 267), (112, 255), (136, 243) | (100, 261), (124, 249), (148, 237) | (+12, −6) | 21 → 45 ms (Espace : le trou noir dévie les tirs) |
| Élément de la mission A | (184, 285) | (190, 285) | 6 px | tourbillon (océan) : fenêtre de 20 à 45 ms |
| Élément de la mission B, C | (176, 300), (205, 350) | idem | 0 | — |
| **Verrou A** | (262, 250) | **(208, 464)** | 230 px | option 1 : 5 ms → 40 ms (devant les batteurs, seul endroit où l'éventail est large et lent) |
| **Verrou B** | (236, 250) | **(288, 352)** | 107 px | option 1 : 0 ms → 50 ms (flanc droit, sous la rampe) |
| **Verrou C** | (282, 338) | **(160, 464)** | 175 px | option 1 : 3 ms → 40 ms |
| **Bouche de l'orbite (A)** | porte (20, 340)–(52, 340), bouche de 32 px | bouche **large de 76 px à y = 340**, porte à 26 px dessous (**battant de 64 px, y = 366, sens unique**) | option 1 | un couloir de 32 px à 370 px du batteur : 5 ms. La bouche large recueille les tirs directs et ceux qui rebondissent sur le mur gauche : 111 ms |
| Bouche de l'orbite (B) | porte (20, 330)–(52, 330) | bouche large à y = 340, porte y = 366 | 10 px (vertical) + largeur | idem ; B et A partagent la même bouche (même éventail) |
| Guide intérieur de l'orbite | x = 52 de y = 340 | x = 52 de y = 328 | 12 px | il s'arrête au-dessus de la bouche |
| Rampe B (guides de la bouche) | (262, 322)–(272, 300), (296, 332)–(304, 310) | (250, 322)–(272, 300), (311, 332)–(304, 310) | pieds de 12 et 15 px | 13 → 36 ms (entonnoir plus ouvert) ; rail inchangé |
| Rampe C (guides de la bouche) | (246, 246)–(256, 226), (280, 256)–(288, 236) | (246, 246)–(244, 226), (295, 256)–(288, 236) | 12 et 15 px | 3 → 88 ms ; rail inchangé |
| Aiguillage | « sur la rampe » | B : 450 ‰, C : 700 ‰ de la rampe | choix | non précisé : le point où la dérivation vers le verrou ne croise rien |
| Spinner A, B | (36, 275), (36, 270) | idem, **sans murs** (capteur seul, dans le couloir) | 0 | les murs du couloir sont ceux de l'orbite |
| Coulée (A, B, Volcan) | « l'accélération du couloir de l'orbite » | capteur sans murs en (36, 300) / (36, 295) | choix | position non précisée |
| Rayon de l'élément de la mission (A) | « 25 au plus » | manège 50, tourbillon 56 | non appliqué | à trancher (voir plus bas) |

## Ce qui est construit (`packages/pinball-sim`)
- `plans.ts` : les trois tables, le miroir (`miroirDuPlan`), `extras` (portails de l'espace, coulée du Volcan), `dispositionDuJour` (6 dispositions, jamais la même deux jours de suite : testé sur 400 et 5 000 jours), `banqueDiagonale`, `banqueDuFlanc`.
- `generateur.ts` : plus aucun tirage d'emplacement ; `Contenu.miroir` ; **24 tables** ; `refusees.ts` vide, plus de graine suivante.
- `table.ts` : bumpers, banques, spinner et coulée sans murs à leurs coordonnées ; l'astéroïde est le bumper du bas ; `Table.guides`.
- `partie.ts` : **porte à sens unique** (la bille qui tombe d'en haut la traverse : un battant plat la coincerait) ; **capteurs du couloir de l'orbite** (le spinner et la coulée se déclenchent au passage de la bille sur le rail).
- `tir.ts` : l'orbite se mesure porte ouverte ; la porte compte aussi les tirs qui mènent l'orbite à son bout.
- Versions : sim 10, générateur 9, robot 9 ; golden régénéré (il porte le miroir) ; jours figés du 19 au 23/11 refaits (`miroir` dans le fichier).
- Outils : `fenetres`, `tolerance`, `chercher-verrou`, `chercher-orbite`, `regler-rampe`, `vitesse-trou` (`npm run …:pinball -w @cdj/pinball-sim`).

## Hypothèses de modélisation (à confirmer par Nathan)
- **Orbite** : un couloir physique de 32 px (mur gauche + guide intérieur) puis **un rail** à une bouche (le mécanisme existant : combo, points, robot). La bouche est celle qui a été redessinée.
- **« Rayon 25 au plus »** (élément de la mission, table A) : non appliqué, le manège (50 px) et le tourbillon (56 px) gardent leur taille.
- **Mini-batteur C** : côté gauche, pivot (46, 405), longueur 38.
- Le verrou de A et de C est **devant les batteurs** : il garde la bille qui arrive lentement et la relance ; c'est la zone où l'éventail du geste de référence est large et lent (comme au lot PBL2).

## Les fenêtres de tir finales (ms, 24 tables, `fenetres:pinball -- --defauts --n=0 --resume`)
| Table | mission | verrou | rampe | orbite | porte | banque |
|---|---|---|---|---|---|---|
| A, A' (4 thèmes) | 36 à 86 | 40 | — | 111 | 113 | 96 |
| B, B' | 45 à 191 | 50 | 36 | 111 | 113 | 45 à 195 |
| C, C' | 71 à 188 | 40 | 88 | — | — | 61 |

**Aucun tir sous 30 ms**, dans les deux sens et dans les quatre thèmes. Deux précisions de mesure : (1) **la banque entre dans les objectifs** (`objectifsDeLaTable`) ; (2) **le manège se traverse** (`tir.ts`) : la bille qui le franchit puis touche un autre objectif compte pour les deux (`mission+banque`), sans quoi le manège « volait » la banque de la table B (16 ms). Les bumpers (P) ne sont pas un objectif : ils se touchent en passant (21 à 173 ms selon la table).

## Vérifié / non vérifié
- **Vérifié** : `npm run valider:pinball` (24/24 valides : aucune bille coincée, chaque module touché, mission, porte ouverte et franchie, rampes et orbite menées à leur bout par le robot) ; `vitest` du paquet (431 tests) et de `apps/pinball` (146 tests) verts ; le golden (régénéré, il porte le miroir) et les jours figés du 19 au 23/11 refaits ; budget du robot : 8,39 M pas pour la pire table (plafond 10,4 M), 10,62 pas pour 1 000 pas joués (plafond 13,5) ; fluidité du rendu mesurée comme au PBL2 (390 × 844, processeur ralenti ×4, multibille) : 12,9 à 16,7 ms sur les trois tables, quatre thèmes, contre 15 à 26 ms sur `main` ; les schémas et les captures dans `docs/pinball/lots/captures-pbt1/` (schémas A, B, C ; tables A, B, C en Volcan et Foire ; miroirs ; rendu de secours ; essai du verrou).
- **Budgets de poids** (plafonds inchangés) : `pinball.jsCss` 46 546 / 48 Ko, `pinball.rendu` 189 130 / 190 Ko, `pinball.demande` 254 108 / 255 Ko ; la marge de `rendu` et `demande` est de moins de 1 Ko, le prochain lot Pinball devra en retirer ou demander un relèvement chiffré à Nathan (le delta de ce lot n'a pas été mesuré sur `main`).
- **Écarts connus** : la banque est inclinée de −26,6° et non −28° (les extrémités des cibles sont tronquées en pixels entiers) ; l'inclinaison du dessin n'est pas retrouvée au dixième de degré. La légende du schéma (PNG) est tronquée à droite. La page d'administration ne liste pas les paramètres d'adresse de Pinball (`?miroir` n'y est donc pas déclaré).
- **Non vérifié** : le jeu n'a pas été joué à la main par un humain (Nathan : les URL ci-dessous) ; `?plan=` en production est ignoré, non testé sur la recette.

## Scénario de test pour Nathan (2 clics, base : l'aperçu de la PR)
- `/pinball/?plan=A&theme=volcan`, `?plan=B&theme=foire`, `?plan=C&theme=ocean` ;
- un miroir : `/pinball/?plan=B&theme=espace&miroir` ;
- le verrou et la rampe : `/pinball/?plan=B&theme=volcan&essai=verrou`.
Ce que Nathan regarde : chaque table ressemble à son dessin, chaque tir se vise, et rien ne bloque ni ne traîne sans servir. **Les écarts voulus sont dans le tableau en haut de ce README** (le verrou de A et de C est devant les batteurs).

Pour les joueurs : rien
