# Lot PBV3 — Pinball : la lumière et les couleurs des images cibles

Branche `claude/pinball-light-colors-a7nbmy` (le nom du prompt, `claude/pinball-visuel-3`, n'a pas été pris : la session impose celui-ci ; il contient `pinball`, le job `zones` le reconnaît), PR brouillon `jeu:pinball`. Le jeu reste `off`. **La simulation ne change pas** : aucun fichier de `packages/pinball-sim` ni de `apps/api` touché, mêmes versions, même golden. **Les modèles des modules ne changent pas** (PBV4) : seuls leurs matériaux reçoivent l'étalonnage commun.

## Ce qui rendait Pinball trop clair (et ce qui a été trouvé en plus)
- Le sol était **émissif** : il montrait sa texture à pleine luminosité, sans lumière ni ombre. **Corrigé : il est éclairé** (soleil, ciel, ombres directement dessus).
- Pas de tone mapping. **Corrigé** : ACES filmique et un étalonnage chaud (ci-dessous).
- **Trouvé en route** : en three.js r186, `scene.environment` est aussi échantillonné par le Phong et le Lambert, comme une lumière constante. Le sol et le meuble recevaient donc une forte lumière qui ne dépendait ni du soleil ni du ciel : couper le soleil ne changeait presque rien au sol. **`scene.environment` n'est plus posé** : l'environnement est donné matériau « Standard » par matériau. Le soleil et les ombres comptent enfin, et le sol et le meuble n'échantillonnent plus l'environnement à chaque pixel.

## Livré
1. **Un sol éclairé** (`corps.ts`) : Phong (soleil, ciel, ombres, reflet du verni). `GAIN_SOL` règle la part de lumière renvoyée. `TEINTE_SOL` compense en partie la lumière chaude sur l'eau et l'espace (sans elle, le turquoise vire au vert). Le calque d'ombres à part est supprimé : un plan plein écran de moins. **L'occlusion et le vignettage sont cuits dans la texture du sol** (`ombresDeContact`, `dessin.ts`, donc dans les deux rendus) : une ombre de contact douce autour de chaque module, bumper, poteau, rail, lance-pierre et pivot de batteur, puis le vignettage dans la table (bords, haut de l'arc, bas). La couleur de l'ombre dépend du thème (ambrée, bleu-vert, bleu nuit).
2. **Tone mapping et étalonnage** : **ACES filmique** (le choix du prompt ; AgX n'apportait rien de plus ici, et l'ACES donne le contraste « photo » des cibles). L'étalonnage est **une seule fonction de couleur**, `ETALONNAGE`, le `CustomToneMapping` de three.js : ACES, puis la saturation, les hautes lumières dorées et les ombres un peu ambrées. Chaque matériau l'applique à la fin de son calcul : **aucune passe ni cible de rendu en plus** (au PBV1, une cible plein écran était le poste le plus cher mesuré). Les réglages passent par un uniforme partagé : les curseurs agissent en direct, sans recompiler. Les plaques des étiquettes en sont exclues (`toneMapped: false` : leur blanc reste blanc). **Rendu de secours** : le même étalonnage **cuit une fois dans son sol** (`etalonner`, à chaque taille d'écran, rien par image), avec un vignettage plus léger (il n'a pas la lumière du soleil au centre).
3. **Palettes et densité des sols** :
   - **Fête foraine** : planches miel ambré, veinage marqué (×1,7), joints sombres. Le nom est **peint en rouge à même le bois** et usé (le grain reparaît), entre des filets en arc, avec ses étoiles. La bannière en ruban a disparu.
   - **Océan** : eau turquoise profond, clarté au centre, caustiques plus visibles, sable chaud. **Les marges sont bien plus garnies** : rochers en volume dessiné (ombre portée, dégradé, reflet, arête), touffes d'algues de quatre tons, étoiles de mer, coquillages, trois bancs de poissons, deux méduses qui luisent, dans les coins du bas, le long des rails et sous l'arc.
   - **Espace** : un ciel plus profond, un bas magenta chaud, des nébuleuses plus présentes. **Volcan** : une roche plus sombre et des mares de lave plus chaudes.
   - **Lisibilité** : le décor riche reste dans les marges (`richesseDuDecor`, coins, rails). Rien de nouveau là où passe la bille, sauf des caustiques plus visibles.
4. **Le meuble et la pièce** :
   - un cadre de 28 px au lieu de 20, aux arêtes plus arrondies, en bois verni rouge-orangé aux reflets nets (Phong, brillance 70) ;
   - des coins en laiton et un liseré intérieur sombre ; le fond au-dessus de l'arc est foncé ;
   - **des bandes plus larges** (5,6 px au lieu de 3,2) et une lueur au sol plus large ;
   - **des halos de lampe sur le sol**, une seule instance de dessin, qui suivent le curseur « Lueur des bandes » ;
   - un parquet plus sombre et une lumière de fenêtre plus franche (×1,5).

   `VUE_DEFAUT` est inchangé : le cadrage tient (`rendu.spec.ts` vert).
5. **Étiquettes** : un texte de 9,8 px au lieu de 9 (+9 %) dans des plaques qui le serrent. La plaque d'encre (Fête foraine) est biseautée, posée sur son ombre ; le texte est blanc. Les flèches sont **blanches et franches**, cernées d'encre, sur leur ombre (dans l'Espace et le Volcan, on les voit enfin). **Test sans chevauchement vert** (120 tables, fr et en) : 11,1 % de plaques réduites en français (seuil 15 %) ; 2,8 % plus proches d'un autre module (seuil 3 %, toujours « POMMES D'AMOUR », le cas connu du PBV2). Des plaques de 12 % plus grandes passaient le test des chevauchements, mais pas les seuils (21 % de réduites) : c'est pourquoi seul le texte grandit.
6. **L'outil des couleurs** (`test/couleurs.ts`, testé par `test/couleurs.test.ts`, lancé par `captures-lot-pbv3.spec.ts -g couleurs`, hors CI) mesure quatre valeurs sur la zone de la table, des épaules de l'arc au bas du terrain : luminance, saturation, teinte et contraste. Pour le jeu, la zone vient de `__pinball.trois().table` ; pour les cibles, elle a été relevée à la main (`ZONE_CIBLE`).
7. **Comparaisons** : `captures-pbv3/` (ci-dessous), quatre tours.
8. **Curseurs** (section « Lumière » de `?debug&tune`, dans l'export) : exposition (**0 = sans tone mapping ni étalonnage**), chaleur, saturation, ombres de contact, vignettage (le sol se recuit).

## Les couleurs, avant et après (zone de la table, 390 × 844, haute qualité)
Luminance · saturation · teinte · contraste. La cible est l'image d'IA.

| | luminance | saturation | teinte | contraste |
|---|---|---|---|---|
| **Fête foraine** avant (PBV2) | 70,1 | 38,0 | 35° | 19,2 |
| Fête foraine après | **57,0** | **61,1** | **33°** | **20,2** |
| Fête foraine cible | 57,0 | 62,8 | 26° | 21,8 |
| **Océan** avant (PBV2) | 67,4 | 36,7 | 159° | 15,7 |
| Océan après | **54,2** | **49,1** | **164°** | **17,2** |
| Océan cible | 54,1 | 52,3 | 168° | 21,3 |

Les deux thèmes se rapprochent de la cible sur les quatre mesures. Ce qui reste : le contraste de l'Océan (17 contre 21 : la cible a des noirs plus denses dans les rochers et une écume très blanche) et la teinte de la foire (33° contre 26° : la cible est plus rouge, à cause de son meuble et de ses bumpers).

## Comparaisons (`docs/pinball/lots/captures-pbv3/`)
- `foire-tours.jpg` et `ocean-tours.jpg` : cible | avant (PBV2) | tour 1 (le sol éclairé, encore par l'environnement) | tour 2 (environnement retiré, exposition réglée) | final.
- `foire-cible.jpg`, `ocean-cible.jpg` : la cible à côté du jeu final.
- `final-quatre-themes-390x844.jpg`, `avant-apres-quatre-themes.jpg`, `final-secours-390x844.jpg`, `avant-apres-secours.jpg`.

## Écarts qui restent (jeu final / cibles)
- Ce sont des rendus d'IA : la matière du bois, l'eau en profondeur, les rochers en vrai volume, le meuble photoréaliste. Le jeu se dessine par le code, sans image ajoutée.
- **Les modules** (bumpers pâles de l'Océan, batteurs) relèvent du PBV4.
- La pièce se voit peu en portrait : la table remplit l'écran, et l'élargir aurait rapetissé la table.
- Le contraste de l'Océan (ci-dessus) ; les multiplicateurs, plus petits que sur les cibles (ils sont dans le sol, hors de ce lot).

## Mesures
- **Premier chargement** : `pinball.jsCss` **43,73 Ko** sur 48 Ko, rien ajouté.
- **Rendu à la demande** : `pinball.rendu` **168,85 Ko** sur 172 Ko (166,63 Ko sur `main` : +2,2 Ko), sous le plafond. Ligne `pinball.demande` : **210,56 Ko** sur 213 Ko (208,31 Ko sur `main`). **La marge est faible** (2,4 Ko) : un prochain lot de rendu devra en retirer ailleurs ou demander à Nathan de relever ce plafond.
- **Fluidité**, mesurée comme au PBV1 et au PBV2 : Chromium de Playwright, 390 × 844, bille en jeu, processeur ralenti ×4, WebGL logiciel, médiane du fil principal par image. La mesure varie d'environ ±2 ms d'une passe à l'autre.

  | fil principal | avant (`main`) | après | après, sans bloom | après, sans tone mapping ni étalonnage |
  |---|---|---|---|---|
  | Fête foraine | 11,5 ms | 10,6 ms | 9,6 ms | 10,1 ms |
  | Océan | 9,8 ms | 10,1 ms | 8,4 ms | 9,6 ms |
  | Espace | 10,6 ms | 10,2 ms | 9,0 ms | 10,8 ms |
  | Volcan | 11,2 ms | 10,7 ms | 11,2 ms | 9,6 ms |

  Tout est **sous 16,7 ms**. **Le coût du tone mapping et de l'étalonnage** (« après » moins « sans ») va de −0,6 à +1,1 ms : c'est dans le bruit de la mesure, comme on l'attend d'une fonction de couleur sans passe. Une passe de couleur plein écran, elle, aurait coûté plusieurs ms (PBV1). Une mesure faite plus tôt, avec le cadre à 4 segments d'arrondi, donnait 11,9 à 13,6 ms. Le cadre est revenu à 3 segments (−3 000 triangles), d'où les chiffres ci-dessus. +1 300 triangles et +2 appels de dessin par rapport à `main` (coins en laiton, liseré, halos des lampes ; le calque d'ombres en moins).

## Vérifié
- **`npm run verifier` : tout vert** (typecheck, tests unitaires SQLite et libSQL, construction, e2e Pinball 8 specs dont le cadrage, budgets) ; `npm run consignes` vert. Tests ajoutés : `test/couleurs.test.ts`. `test/etiquettes.test.ts` et `test/decor.test.ts` restent verts et inchangés.
- Captures regardées : cinq planches (quatre thèmes, secours, foire et océan contre leur cible, l'étiquette « RADAR » de l'Espace, où passait la bille).

## Non vérifié
- Un vrai téléphone (carte graphique), Firefox, WebKit. Le coût réel de l'étalonnage sur une carte graphique n'est pas mesurable ici : c'est une dizaine d'opérations par pixel, sans passe.
- Les liens de l'aperçu (le réseau du conteneur refuse `web.app`).

## Zones partagées
Rien hors de `apps/pinball/**` et `docs/pinball/**`.

## Pour Nathan : tester en 2 clics (recette, le jeu est `off`)
La base de l'aperçu est donnée par le commentaire « Recette » de la PR :
- `/pinball/?theme=foire` et `/pinball/?theme=ocean`, **à comparer aux cibles** (`docs/pinball/maquettes/cibles/`)
- `/pinball/?theme=espace` et `/pinball/?theme=volcan`
- `/pinball/?theme=foire&qualite=basse` (le rendu de secours)
- Pour régler : `?debug&tune&theme=foire`, section « Lumière » (exposition, chaleur, saturation, ombres de contact, vignettage), puis « Exporter ».

Ce que Nathan regarde : c'est chaud et contrasté comme les cibles, la table reste lisible en partie, et c'est fluide.

**Pour les joueurs : rien**
