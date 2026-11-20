# Lot PBT1 — Pinball : les trois tables dessinées avec Nathan — **BLOQUÉ, décision de Nathan nécessaire**

Branche `ccr-162193cc-ju669l` (le nom imposé à cette session ; la consigne disait `claude/pinball-tables-1`), PR brouillon `jeu:pinball`. **Je me suis arrêté**, comme la consigne le demande (« si une table ne passe pas les tests, arrête-toi et décris le problème, sans redessiner »). Rien n'a été redessiné : les tables A, B et C sont construites **exactement** comme dessinées, et c'est la mesure qui les refuse.

## En une phrase
Telles que dessinées, **aucune des 24 tables ne passe la fenêtre de tir humaine (≥ 30 ms)** : le **verrou** (de 0 à 21 ms, même sans limite de vitesse de capture) et l'**orbite** (de 5 à 16 ms, 8 ms au mieux avec ±15 px, 11 ms avec un évasement) sont structurellement trop difficiles à viser ; les **rampes** et les **missions** se corrigent dans les ±15 px autorisés. Le lot ne peut pas se terminer sans une décision de Nathan (options plus bas).

## Ce qui est fait (code, `packages/pinball-sim`)
- `plans.ts` : les trois tables (`A`, `B`, `C`), leur **miroir** (`miroirDuPlan`, x → 368 − x ; mini-batteur de l'autre côté, angle de la porte inversé), les éléments propres aux thèmes (`extras` : portails de l'espace à ± 30 px du trou noir, accélération du couloir de l'orbite au Volcan), la **disposition du jour** (`dispositionDuJour` : cycles de six, jamais la même deux jours de suite), `banqueDiagonale` / `banqueDuFlanc`.
- `generateur.ts` : plus aucun tirage d'emplacement ; `Contenu.miroir` ; 24 tables (`toutesLesTables`) ; la clé, l'empreinte portent le miroir ; `refusees.ts` vidé (plus de « graine suivante »).
- `table.ts` : bumpers, banques et spinner/coulée sans murs à leurs coordonnées exactes, l'astéroïde est le bumper du bas, guides dessinés (`Table.guides` : guide intérieur de l'orbite, deux guides de la bouche de rampe).
- `partie.ts` : **porte à sens unique** (`Passage.sensUnique`) : fermée, elle arrête la bille qui monte ; la bille qui arrive d'en haut (lancer par-dessus l'arc) la traverse au lieu de s'y poser — un battant plat à (20, 340)–(52, 340) coincerait la bille.
- `tir.ts` : l'orbite se mesure **porte ouverte** (elle est derrière sa porte) ; la porte compte aussi les tirs qui mènent l'orbite à son bout.
- Outils : `fenetres:pinball` (`--plan=A --miroir=false --theme=foire --detail --svg=…`), `tolerance:pinball` (la recherche ±15 px), `vitesse-trou:pinball`.
- Le paragraphe du seed demandé par Nathan est ajouté à la fin de `docs/pinball/seed.md`.

**Pas fait** (le critère d'arrêt n'étant pas atteignable, je n'ai pas investi dedans) : rendu three.js et à plat, flèches au sol, schémas et captures, mise à jour des tests existants (ils référencent les anciens plans), robot / golden / seuils / versions (`PINBALL_*_VERSION`), consignes (`CLAUDE.md` du jeu et de la simulation, `consignes.md`), jours figés. **La branche est donc rouge** (typecheck et tests) : c'est un état de travail, à ne pas fusionner.

## Hypothèses de modélisation (à confirmer)
- **L'orbite** = un couloir physique de 32 px (mur gauche + guide intérieur x = 52, arc de rayon 144 jusqu'à (196, 61)) où roulent le spinner et la coulée sans murs, puis **un rail** (une seule bouche, au pied de l'arc, y = 230) qui mène la bille au sommet. Le rail est le mécanisme existant (combo, points, robot). Une orbite entièrement physique ne change pas la conclusion (voir la mesure).
- **« Rayon 25 au plus »** de l'élément de la mission (table A) : non appliqué. Le manège (50 px) et le tourbillon (56 px) gardent leur taille ; à trancher.
- Mini-batteur de la table C : côté gauche (`cote: 0`), pivot (46, 405), longueur 38 (celle du plan « bretelle », qui l'avait en miroir à droite).

## Les mesures (fenêtre de tir, ms ; seuil 30 ; les 24 tables, `npm run fenetres:pinball -w @cdj/pinball-sim -- --defauts --n=0 --resume`)
| table | mission (4 thèmes) | verrou | rampe | orbite | porte |
|---|---|---|---|---|---|
| A, A' | 73 (foire), 21 (océan), 45 (espace), 20 (volcan) | 1 à 5 | — | 5 à 16 | 5 à 16 |
| B, B' | 191, 45, 45, 45 | 0 à 18 | 13 | 6 à 16 | 6 à 16 |
| C, C' | 251, 131, 71, 138 | 1 à 6 | 3 à 5 | — | — |

(miroir : mêmes chiffres, à un ou deux ms près.) Le tir de chaque objectif est mesuré avec le geste de référence du lot PBL2 : la bille est frappée à un moment `d`, la fenêtre est le nombre de `d` consécutifs qui la mènent à l'objectif ; **un pas de `d` déplace le tir de 3 à 6 px à 350 px du batteur**.

## Pourquoi (mesuré)
1. **L'orbite** : la bouche fait 32 px et se trouve à 370 px du batteur droit, au bord extrême de l'éventail (la bille y part à 1 480 px/s, l'angle change de ≈ 5,6 px par pas) : 32 px ÷ 5,6 px ≈ 6 pas ≈ 10 ms **au mieux**. Mesuré : 5 ms (A), 6 ms (B) ; porte ouverte, seuls `d` = 298 à 300 passent. Les tirs voisins heurtent le mur gauche ou passent à droite du guide. Un évasement du pied du guide (hors dessin) : 8 ms (+ 28 px), 11 ms (+ 60 px).
2. **Le verrou** : un trou de 22 px ; il ne garde que la bille qui arrive à moins de 650 px/s, or une frappe pleine puissance qui monte à y ≈ 250 y arrive à environ 1 200 px/s (calcul : 1 480 px/s au départ, gravité 820 px/s²). Mais **la vitesse n'est pas la seule cause** : en relevant `trouVitesseMax` à 2 000 px/s (la capture de n'importe quelle bille) le verrou passe seulement à 21 ms (A), 23 ms (B), 10 ms (C) — la cible est trop étroite pour l'éventail.
3. Les **rampes** (B : 13 ms ; C : 3 à 5 ms) et deux **missions** de la table A (océan 21, volcan 20) sont proches de l'éventail.

## Ce que permettent les ±15 px (`npm run tolerance:pinball`, pas de 3 px)
| élément | meilleur résultat | verdict |
|---|---|---|
| mission A (océan, volcan) | 73 ms à (−15, −3) / (−15, 6) | **corrigeable** |
| rampe B (bouche et guides) | 86 ms à (+15, −15) — au bord de la tolérance | **corrigeable** (limite) |
| rampe C (bouche et guides) | 86 ms à (+9, +6) | **corrigeable** |
| **verrou A** | 5 ms (partout) | **impossible** |
| **verrou B** | 0 ms | **impossible** |
| **verrou C** | 3 ms | **impossible** |
| **orbite A** (porte, pied du guide, y ± 15) | 6 ms | **impossible** |
| **orbite B** | 8 ms | **impossible** |

## Décisions possibles pour Nathan (je n'en ai pris aucune)
1. **Redessiner le verrou et la bouche de l'orbite** sur l'éventail (la zone où le geste passe vite et large, comme l'avait fait le recuit du lot PBL2), tout en gardant le reste du dessin : c'est > 15 px, donc une décision à toi.
2. **Changer la règle de mesure** pour ces deux objectifs : un seuil plus bas (par exemple 15 ms pour le verrou et l'orbite) ou un geste de référence plus large (le tir à la volée, deux frappes). La règle PBL2 est née de « personne ne pouvait prendre le verrou » : la baisser rouvre ce risque, il faudrait la jouer à la main (captures à l'appui).
3. **Ajouter un élément** (un entonnoir au verrou, une bouche d'orbite évasée de 60 px) : c'est un élément de gameplay nouveau, hors du périmètre du lot ; mesuré ci-dessus : l'orbite monte à 11 ms seulement.
4. **Relever la vitesse de capture du verrou** (`trouVitesseMax`) : utile (21 à 23 ms) mais insuffisant seul.

Ma recommandation : (1) pour le verrou (le déplacer le long du tir central vers le flanc haut d'un tir croisé) et (1) ou (2) pour l'orbite, puis relancer le lot : le reste de la liste « Pas fait » se construit sur le code déjà écrit, sans le refaire.

## Vérifié / non vérifié
- Vérifié : les fenêtres ci-dessus (outils reproductibles), la compilation de `packages/pinball-sim/src`.
- Non vérifié : tout le reste de la liste « Pas fait » ; la validation (billes coincées, robot, rediffusion), le golden et les budgets n'ont pas été relancés ; les tests existants du paquet et de l'app échouent (anciens plans).

Pour les joueurs : rien
