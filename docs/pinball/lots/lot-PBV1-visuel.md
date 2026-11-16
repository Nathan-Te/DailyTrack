# Lot PBV1 — Pinball : passe visuelle vers les images cibles (Fête foraine et Océan)

Branche `claude/pinball-visuel-foire-ocean-hiz5bg` (le nom du prompt, `claude/pinball-visuel-1`, n'a pas été pris : la session impose celui-ci), PR brouillon `jeu:pinball`. Le jeu reste `off`. **La simulation ne change pas** : aucun fichier de `packages/pinball-sim` ni de `apps/api` touché, mêmes versions (`PINBALL_SIM_VERSION` 3, `PINBALL_GENERATOR_VERSION` 3, `PINBALL_BOT_VERSION` 1), même golden.

## ⚠ Les images cibles n'étaient pas dans la session
Le prompt annonçait quatre images jointes (`cible-foire.png`, `cible-ocean.png`, `actuel-foire.png`, `actuel-ocean.png`) : **aucune n'a été reçue par l'agent**. Le lot a donc travaillé **d'après la description écrite des cibles** (lumière, meuble, matériaux, sol de chaque thème), et les comparaisons côte à côte sont **avant / tours successifs**, pas jeu / cible. `docs/pinball/maquettes/cibles/LISEZMOI.md` dit où déposer les quatre fichiers. **À faire par Nathan : les y verser, puis regarder les captures finales à côté** ; la liste des écarts ci-dessous est celle que je peux écrire sans les avoir vues.

## Livré
- **La recette commune, dans les quatre thèmes** (`apps/pinball/src/corps.ts`, haute qualité) :
  - **lumière** chaude de fin d'après-midi : ciel doux (hémisphère crème et bois), soleil bas et chaud qui vient du haut de la table (azimut −28°, hauteur 36°), ombres douces (carte de 2 048, filtrage PCF de rayon 5) ;
  - **la pièce** : un parquet autour du meuble, avec **le motif d'une fenêtre** (16 carreaux allongés dans le sens du soleil) et **l'ombre du meuble sur pieds**, cuits dans une texture de 1 024 px (redessinée seulement quand la direction du soleil change) ;
  - **reflets** : le sol est verni (émissif, donc les couleurs exactes de la palette ; la lumière n'y ajoute que les reflets de la pièce et du soleil, et les ombres), comme le meuble, les bumpers, les batteurs, les lance-pierres ; le métal reflète la pièce ;
  - **le meuble** : bois verni orangé, veiné (texture dessinée), arêtes arrondies (`RoundedBoxGeometry`), une caisse sur quatre pieds en métal, **des vis en métal** aux coins et le long du meuble et aux coins des lance-pierres (une seule instance de dessin) ;
  - **les bandes lumineuses** sur les rails latéraux (rail gauche et rail du couloir du lanceur ; ambre pour la foire, cyan pour l'océan, rose pour l'espace, orange pour le volcan : `Palette.bande`) et leur lueur sur le sol ; **de petites lampes allumées** sur les flancs de l'arc et sur le dessus des lance-pierres (`Palette.lampe`), avec une vague de lueur qui court, fonction du seul pas ;
  - **les matériaux** : poteaux en métal brossé (plus de beige), batteurs crème brillants sur une base de métal avec leur pastille rouge vernie, lance-pierres à **liseré clair**, bumpers vernis avec **un rivet en métal** sur le chapeau — **les yeux restent** ; la bille a désormais **un contour d'encre** (elle se détache de tous les sols, le bois clair et le sable compris) ;
  - **le bloom**, en haute qualité seulement : une passe de composition (`Composition`, l'idée du pipeline de Rush, recopiée et réduite : cible flottante anticrénelée, seuil à 1,25 en lumière linéaire, deux flous séparables à demi-résolution, un vignettage chaud). Ce qui rayonne : les bandes, les lampes, les éclats (bumper touché, lave, portails).
- **Le sol riche** (`dessin.ts`, donc **aussi dans le rendu de secours**) :
  - **Fête foraine** : planches de bois clair veinées (nœuds, joints), le nom du thème sur **une bannière rouge en arc** (queues repliées, coutures, lettres crème qui suivent l'arc), **des étoiles**, et la peinture usée par endroits (« estampé ») ;
  - **Océan** : eau turquoise avec **les reflets du fond** (caustiques en boucles lissées, des taches plus profondes), **un dégradé vers le sable** en bas (grains, rides) ; **dans les marges** (coins bas sous les couloirs de retour, bande le long du rail gauche) des rochers, des algues, des étoiles de mer ; **des silhouettes de poissons et de méduses** à 13 % d'opacité ; le nom **en blanc avec une vague** ; **les étiquettes deviennent des plaques de bois** clouées (`styleEtiquette`) ;
  - **le tourbillon** devient une spirale d'eau animée (du turquoise au bleu profond) avec **de l'écume blanche** qui tourne moins vite ; **le manège**, un plateau en volume avec **un bord doré** (métal) ;
  - **Espace et Volcan** gardent leur sol, avec la recette commune (lot PBV2 pour leur décor).
- **Le rendu de secours** (basse qualité) garde le nouveau sol, et reçoit à plat les bandes, les lampes, les poteaux en métal et le rivet des bumpers : rien de coûteux (un trait, quelques disques).
- **`?debug&tune`** : une section **« Lumière »** (en direct, rendu haute qualité) : soleil (intensité, direction, hauteur), lumière du ciel (l'ancien curseur « Lumière »), force du bloom (0 : pas de passe de composition), lueur des bandes et des lampes. **Les six valeurs passent dans « Exporter »** (`vue`) et dans `&reglages=` (`bornes.ts` : bornes, un ancien export garde les valeurs par défaut).
- **Aucune image ajoutée au jeu** : tout est dessiné par le code (canvas : veinage, parquet, fenêtre, eau, sable, écume, silhouettes).
- **Outil de capture** `e2e/captures-lot-pbv1.spec.ts` (hors CI) : les quatre thèmes en haute (390 × 844 et 360 × 640) et en secours, sans les contours de `?debug` (nouveau `__pinball.contours(false)` des essais) ; `MESURE=1 … -g mesure` mesure la fluidité avec et sans bloom.

## Comparaisons (`docs/pinball/lots/captures-pbv1/`)
Quatre tours de correction après l'état de départ, au même cadrage (portrait 390 × 844, la bille du pilote d'essai en jeu) :
- `foire-tours.jpg` et `ocean-tours.jpg` : avant (PB3) | tour 1 | tour 2 | tour 3 | tour 4 (final). Tour 1 : sol, bandes, meuble ; **trop clair et délavé, batteurs qui « brûlent » au bloom, pièce invisible, bille perdue sur le bois**. Tour 2 : caisse sur pieds (le parquet et la fenêtre apparaissent), bille à contour d'encre, seuil du bloom. Tour 3 : lumière baissée (la scène était surexposée), bois plus profond, halo des bandes plus étroit, fenêtre plus nette, caustiques organiques au lieu de cellules, vignettage. Tour 4 : liseré des lance-pierres, base des batteurs, vis.
- `final-quatre-themes-390x844.jpg`, `final-quatre-themes-360x640.jpg`, `final-secours-390x844.jpg`, `avant-apres-secours-ocean.jpg`.

**La dernière comparaison de chaque thème** est la dernière colonne de `foire-tours.jpg` et de `ocean-tours.jpg` (à poser à côté de `cible-foire.png` et `cible-ocean.png` quand elles seront dans `maquettes/cibles/`).

## Écarts qui restent (d'après la description des cibles, sans les avoir vues)
- **La pièce se voit peu** : le cadrage n'a pas changé (la table occupe tout l'écran : lisibilité d'abord), donc le parquet et la fenêtre n'apparaissent qu'en haut, sur les côtés et sous le meuble. Le curseur « Caméra : distance » (110-120 %) en montre plus, au prix d'une table plus petite : à trancher par Nathan.
- **Les ombres** sont douces et dirigées vers le bas de la table, mais **pas aussi longues** qu'une photo de fin d'après-midi : plus bas que ~30°, l'ombre des rails couvre les étiquettes. Curseur « Soleil : hauteur ».
- **Les reflets** sont discrets (le sol verni, les bumpers, le métal) : pas de reflet d'écran ni de reflet de la bille dans le sol ; à 390 px de large, le vernis se lit surtout sur le meuble.
- **Le meuble** : le veinage se voit sur la caisse et les grandes faces ; sur le cadre, à cette taille, c'est surtout une couleur. Les vis font 2 à 3 px à l'écran.
- **Les bandes** sont fines (un tube sur le rail et une lueur sur le sol) et le bloom reste discret à la taille d'un téléphone ; les lampes sont petites. Curseur « Lueur des bandes ».
- **L'eau** de l'Océan est **immobile** (seuls le tourbillon et l'écume tournent) : animer les caustiques demanderait de redessiner le sol ou un second calque.
- **Le tourbillon** reste un disque plat (pas de creux) ; **le manège** est un plateau bas.
- La cible écrit « POMPES D'AMOUR » : le jeu écrit **« POMMES D'AMOUR »** (catalogue), comme il se doit.

## Mesures
- **Premier chargement** : rien n'y a été ajouté (le rendu, le sol et le panneau sont à la demande) ; gardé par `e2e/poids.spec.ts` (plafond 48 Ko), vert dans `npm run verifier`.
- **Rendu à la demande** (`corps-` + `dessin-`, gzip) : **162 303 o** (`corps-` 154 980, `dessin-` 7 323), contre 155 599 o mesurés au lot K8 après le PB3 : **+6,7 Ko, sous le plafond de 172 Ko** de `pinball.rendu`. Pas de relèvement à demander.
- **Fluidité**, mesurée comme au PB2 (Chromium de Playwright, 390 × 844, bille en jeu, processeur ralenti ×4, **WebGL logiciel SwiftShader : pas de carte graphique dans le conteneur**), médiane du temps du fil principal par image (`__pinball.trois().ms`) :

  | | avant (PB3) | après, sans bloom | après, avec bloom |
  |---|---|---|---|
  | Fête foraine | 5,3 ms | 10,0 ms | 11,8 ms |
  | Océan | 5,2 ms | 7,8 ms | 9,9 ms |

  **Sous le budget d'une image à 60 i/s (16,7 ms)**, mais la hausse est nette. **Le bloom coûte ~2 ms de fil principal** (cinq passes) ; le reste vient surtout de la géométrie ajoutée (appels de dessin 154 → 170 pour la foire, triangles 23,7 k → 37,6 k ; essai : le sol non verni et les ombres non adoucies ne reprennent que 1,3 ms). **L'image entière** (non représentative : le rasteriseur logiciel dessine tout) passe de ~95-114 ms à 220-239 ms sans bloom et 304-311 ms avec. **Non mesuré : un vrai téléphone.** Le passage automatique en basse (moins de 25 i/s) reste le filet ; le bloom se coupe par le curseur (0 %).

## Vérifié
- `npm run verifier` : voir la fin de ce fichier (résultat recopié).
- Tests unitaires ajoutés : `apps/pinball/test/decor.test.ts` (8) — les bandes courent le long des rails latéraux de la table, les lampes de l'arc restent au ras du rail et **loin de tout module, poteau et couloir sur 120 tables** (30 jours × 4 thèmes), celles des lance-pierres sur leur dessus, la lueur ne dépend que du pas, les plaques de bois de l'Océan, les bornes et l'export des curseurs de la lumière.
- Les e2e existants (`rendu.spec.ts` : cadrage sur deux téléphones, même partie dans les deux rendus, sans WebGL…) passent avec le nouveau rendu.
- **Captures regardées : sept planches** (avant ; tours 1, 2, 3 de la foire et de l'océan, deux zooms ; tour 4 : Espace, Volcan et 360 × 640 ; secours des quatre thèmes) — au-delà des cinq du lot R10 : le prompt demande au moins trois tours de comparaison, chaque planche en assemble quatre.
- Lisibilité regardée sur 390 × 844 et 360 × 640 : étiquettes et flèches inchangées en taille et en contraste (les plaques de bois : texte crème sur bois sombre, contraste ~7:1) ; la bille se voit sur la bannière, sur le sable, sur l'eau, sur l'espace et sur le volcan.

## Non vérifié
- **La comparaison avec les vraies images cibles** (non reçues, voir plus haut).
- **La fluidité et le rendu sur un vrai téléphone** (carte graphique, MSAA de la cible flottante : WebGL 2 seulement ; en WebGL 1 l'image avec bloom n'est pas anticrénelée) ; Firefox et WebKit.
- Les liens de l'aperçu : le réseau du conteneur refuse `web.app` (comme aux PB2 et PB3).

## Zones partagées et propositions
Rien hors des zones de Pinball (`apps/pinball/**`, `docs/pinball/**`). Reste proposé aux lots de la plateforme (déjà dit aux PB2 et PB3) : déclarer `three` dans `apps/pinball/package.json`, les mentions légales (clés du navigateur du jeu).

## Pour Nathan : tester en 2 clics (recette, le jeu est `off`)
La base de l'aperçu est donnée par le commentaire « Recette » de la PR (expire 7 jours après la dernière poussée) :
- **Les deux thèmes ciblés** : `/pinball/?theme=foire` et `/pinball/?theme=ocean`
- **Les deux autres, recette commune seulement** : `/pinball/?theme=espace` et `/pinball/?theme=volcan`
- **Le rendu de secours** : `/pinball/?theme=ocean&qualite=basse`
- **Le réglage de la lumière** : `/pinball/?debug&tune` (bouton « Réglages d'essai », section « Lumière » ; « Exporter » écrit le JSON avec la vue)
- Ce que Nathan regarde : sur son téléphone, à côté des images cibles ; qu'il lit toujours bien la table pendant une partie ; que c'est fluide.

## Attend les lots suivants
PBV2 : le décor de l'Espace et du Volcan (après validation de la direction sur ces deux-là) · les valeurs de lumière que Nathan réglera (une retouche de `VUE_DEFAUT`, sans toucher à la simulation) · PB4, PB5, les sons.

**Pour les joueurs : rien**
