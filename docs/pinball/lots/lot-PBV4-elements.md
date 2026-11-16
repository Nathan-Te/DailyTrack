# Lot PBV4 — Pinball : de vrais éléments pour chaque thème

Branche `claude/pinball-theme-elements-khyhnr` (le nom du prompt, `claude/pinball-visuel-4`, n'a pas été pris : la session impose celui-ci), PR brouillon `jeu:pinball`. Le jeu reste `off`. **La simulation ne change pas** : aucun fichier de `packages/pinball-sim` ni de `apps/api` touché, mêmes versions, même golden.

## Le retour de Nathan
> « Les bumpers du haut, avec des yeux, sont toujours les mêmes, mais les étiquettes affichent "Braises", "Bulles", etc. Il faut de vrais visuels par thème. »

Décision de Nathan appliquée : **les yeux des bumpers s'en vont** ; chaque module devient l'objet que son nom annonce.

## Livré
1. **Un modèle par module et par thème**, construit par le code (géométries three.js, aucun fichier 3D), dans `apps/pinball/src/modeles/` — un fichier par thème :

   | Module | Fête foraine (`foire.ts`) | Océan (`ocean.ts`) | Espace (`espace.ts`) | Volcan (`volcan.ts`) |
   |---|---|---|---|---|
   | Bumpers et mini-bumpers | pomme rouge glacée, caramel coulé, bâton, socle bleu | bulle translucide à reflets sur un socle de corail (blocs, branches) | planète (quatre teintes) à cratères **ou** à anneau, une sur deux, socle de métal à néon | roche sombre autour d'un cœur de lave : la lave luit dans les creux, socle doré |
   | Banque de cibles | trois boîtes de conserve en pyramide (étiquette, bande blanche, fer-blanc) | coquillage en éventail festonné, côtes | satellite : corps doré, deux panneaux solaires quadrillés, antenne | tas de trois rochers |
   | Spinner | grande roue : jante, rayons, huit nacelles, pied en A | hélice de bateau à trois pales vrillées, sur un mât | radar : parabole de biais, rainures, source sur son bras, qui tourne sur son mât | moulin : tour de pierre, toit rouge, quatre ailes de toile à lattes |
   | Trou | cible rouge et blanche autour du trou | pieuvre : tête et yeux derrière le trou, tentacules qui s'enroulent, ventouses | sonde : anneau d'amarrage en métal, quatre pinces, huit feux | cratère : bord de blocs de roche, lueur de lave au fond |

   **Éléments propres aux thèmes** : manège, tourbillon, trou noir, portails, geyser et coulée gardent leur modèle (ils ne détonnent pas à côté des nouveaux : captures). **L'astéroïde** était un bumper gris à yeux : il devient une roche grise à cratères sur le socle des planètes (`espace.ts`, `asteroide`), lui et son petit voisin.
2. **Lisibilité d'un thème à l'autre.**
   - **Le retour au contact est commun, jamais écrit dans un thème** : il passe par le rôle des pièces (`haut`, `lumiere`, `tourne`), dans `modeles/trois.ts` et `modeles/plat.ts`. Bumper touché : **le haut s'enfonce** (écrasé au-dessus du socle) **et le socle s'allume** (sa couleur va vers la couleur « allumée » du thème) ; cible touchée : **elle bascule en arrière et s'enfonce dans le sol**, une trace pointillée reste ; spinner : **il tourne au passage** (autour de son axe : la roue, l'hélice et le moulin face au joueur, le radar sur son mât) ; trou : **il s'allume quand il garde la bille** (anneaux rouges, ventouses, feux, lueur du cratère), pulsé.
   - **Même emprise que la collision** : vérifié sur les 444 tables (test ci-dessous).
   - **Les modules restent les objets les plus vifs** : couleurs saturées, contour d'encre (une coque retournée), socles clairs sur les sols sombres.
3. **Rendu de secours à plat** : chaque modèle a son icône vue de dessus (`plat` de chaque fichier de thème), dans les couleurs du thème, avec les mêmes retours au contact (le haut rapetisse et le socle s'allume avec une onde, la cible tombée laisse sa trace, le spinner tourne, le trou s'allume et s'entoure d'un anneau moutarde).
4. **Comparaisons** : `docs/pinball/lots/captures-pbv4/` (plus bas).
5. **Performance** : un modèle par type, construit une fois ; **une `InstancedMesh` par pièce** pour tous les modules de ce type sur la table (les cinq bumpers d'une table = un seul appel de dessin par pièce, le contour aussi). Mesures plus bas.

## Où c'est (`apps/pinball/src/modeles/`)
- `types.ts` : pièces, rôles, matières, `Outils` (les fabriques de géométrie passées aux thèmes : un fichier de thème n'importe jamais three.js, qui reste hors du rendu de secours), icônes à plat.
- `foire.ts`, `ocean.ts`, `espace.ts`, `volcan.ts` : les modèles ; `index.ts` : le registre (`MODELES`).
- `outils.ts` (three.js : cylindre, sphère, tore, boîte, calotte, extrusion, roche, tube, fusion, coque d'encre), `trois.ts` (l'instanciation et le retour au contact), `plat.ts` (le rendu à plat), `placements.ts` (où se pose chaque modèle, commun aux deux rendus et au test).
- `corps.ts` et `dessin.ts` : **un appel chacun** (`creerModules`, `modulesAPlat`) à la place des anciens bumpers, cibles, spinners et trous. Rien d'autre n'y a changé (ni lumière, ni sol, ni palettes, ni étiquettes : PBV3).

## Test : `apps/pinball/test/modeles.test.ts`
- **Chaque couple module et thème a son modèle**, en volume et à plat, distinct des autres thèmes ; chaque bumper a un `haut` et une `lumiere`, chaque spinner une pièce qui `tourne` et un axe, chaque trou une `lumiere` ; ENCRE, PAPIER et MOUTARDE sont ceux de `dessin.ts`.
- **Sur les 444 tables** (`toutesLesTables`), chaque modèle posé reste dans l'emprise de collision de son module, aux marges fixées dans le test : bumper (mini et astéroïde compris) **du rayon de collision à 1,3 fois lui, enfoncé compris** (l'ancien modèle : 1,22) ; cible : **longueur à ± 15 % du segment, 6 px devant au plus, jamais derrière le mur de fond (9 px)**, son avant tourné vers les batteurs ; spinner : **entre ses murs (± 24 px, 5 %), au moins 80 % de son capteur, à 12 angles** ; trou : **au plus 1,75 fois son rayon** (l'ancien anneau : 1,5). 2 000 poses et plus.
- Le rendu à plat dessine chaque icône de chaque thème.

## Comparaisons (`docs/pinball/lots/captures-pbv4/`)
Outil : `e2e/captures-lot-pbv4.spec.ts` (hors CI) et `e2e/catalogue-modeles.ts`.
- `foire-avant-apres.jpg`, `ocean-…`, `espace-…`, `volcan-…` : une planche par thème, avant | après, 390 × 844 (le même pas de jeu, robot du PB4).
- `catalogue.jpg` : les 16 modèles côte à côte, de près, au repos puis au contact (bumper enfoncé et allumé, cible à mi-chute, spinner tourné, trou allumé).
- `contact.jpg` : la table de près pendant une partie (socles allumés, cibles tombées).
- `secours-quatre-themes.jpg` : les quatre thèmes en rendu de secours, 390 × 844.

## Mesures
- **Premier chargement** : rien n'y a été ajouté (les modèles sont dans `corps-` et `dessin-`, à la demande) ; `pinball.jsCss` 43,73 Ko pour 48 Ko ; `e2e/poids.spec.ts` vert.
- **Rendu à la demande** (`pinball.rendu`, gzip) : **174 098 o** (166 634 o après le PBV2 : **+7,5 Ko**), **au-dessus de son plafond de 172 Ko** ; `pinball.demande` : **215 769 o** pour 213 Ko. Ce qui pèse : les 16 modèles et leurs 16 icônes (≈ 1,4 à 2 Ko par fichier de thème), `trois.ts` et `outils.ts` (≈ 3 Ko), quelques fonctions de three.js. Déjà resserré : roche, anneau et parabole faits de la sphère et du tore (−1,5 Ko). **Relèvement proposé** (commit à part, « Relèvements » de `budgets.md`) : `pinball.rendu` **172 → 178 Ko**, `pinball.demande` **213 → 220 Ko** (marges ≈ 4 Ko, pour PBV3). **À confirmer par Nathan** ; s'il refuse : retirer ce commit, et il faut ôter ≈ 2,8 Ko (icônes à plat plus simples, moins de pièces par modèle).
- **Fluidité**, comme au PBV1 et au PBV2 (Chromium de Playwright, 390 × 844, bille en jeu, processeur ralenti ×4, WebGL logiciel SwiftShader, médiane du fil principal par image, bloom compris ; **l'avant remesuré le même jour sur la même machine**, deux passes chacun) :

  | thème | avant : ms | après : ms | appels de dessin | triangles |
  |---|---|---|---|---|
  | Fête foraine | 12,9 – 13,1 | 13,3 – 14,3 | 180 → 133 | 40 811 → 54 417 |
  | Océan | 11,9 – 12,1 | 14,0 – 14,6 | 138 → 110 | 35 293 → 51 784 |
  | Espace | 11,4 – 12,3 | 14,4 – 14,6 | 145 → 124 | 38 099 → 44 923 |
  | Volcan | 12,8 – 13,8 | 14,5 – 14,7 | 136 → 107 | 31 405 → 38 125 |

  Tous **sous 16,7 ms**. **Les appels de dessin baissent de 14 à 26 %** (l'instanciation) ; **les triangles montent de 18 à 47 %** (des objets ronds et détaillés, leur contour d'encre, leurs ombres) et le fil principal de ≈ 1 à 2,5 ms. Allégé en route : segments des petites pièces (le corail passait de 4 000 à 2 100 triangles), et **aucune instance n'est renvoyée à la carte graphique tant que son module ne bouge pas** (un bumper au repos, une cible debout, un spinner arrêté ne coûtent rien). **Non mesuré : un vrai téléphone.**

## Fusion de `main` après PBV3 (lumière et couleurs)
- **Conflits** dans `apps/pinball/CLAUDE.md` et `docs/pinball/consignes.md` seulement (les deux lots ajoutaient leur section) : les deux gardées. `corps.ts` et `dessin.ts` ont fusionné seuls.
- **Un effet de PBV3 sur ce lot, corrigé** : PBV3 ne donne plus l'environnement (les reflets de la pièce) par la scène ; les modèles, en « Standard », sortaient presque noirs sous son exposition. Leur rendre l'environnement les remettait en couleur, **mais l'écran de fin des e2e passait au-delà de 5 s sur la CI** (`partie.spec.ts`, `rendu.spec.ts` : run 43896848247), ce qui viole la règle « l'écran de fin des e2e en 5 s ». Mesuré en local, même machine, rendu logiciel, 1 280 × 720 : une image coûtait ≈ 400 ms avec les modèles contre ≈ 370 ms sans, et l'écran de fin arrivait en 4,1 à 4,4 s contre 3,3 à 3,9 s sur `main` (qui échouait lui-même parfois ici). **Correctif** (`modeles/trois.ts`) : **des matériaux Phong** (le reflet du soleil, pas d'environnement échantillonné), avec **un gain de lumière `GAIN_MODULES` (3,4)**, comme `GAIN_SOL` pour le sol, réglé à l'œil contre le rendu avec environnement ; et **seule la plus grosse pièce opaque d'un modèle projette une ombre**. Résultat : ≈ 355 ms par image, écran de fin en 3,6 s, `partie.spec.ts` et `rendu.spec.ts` verts trois fois de suite ; les couleurs passent par le tone mapping et l'étalonnage de PBV3 (traversée de la scène). `corps.ts` garde son seul appel, `creerModules(o.theme, partie, groupe)`. Le catalogue (`e2e/catalogue-modeles.ts`, un outil) reste en « Standard » avec environnement.
- **Budgets après fusion** : `pinball.rendu` **176 438 o** et `pinball.demande` **218 165 o**, sous les plafonds proposés (178 et 220 Ko), au-dessus des actuels (172 et 213 Ko).
- **Fluidité après fusion et correctif** (`captures-lot-pbv4 -g mesure`, 390 × 844, processeur ralenti ×4) : **Fête foraine 12,0 ms, Océan 13,7, Espace 13,3, Volcan 14,1 : tout sous 16,7 ms** ; appels 105 à 128, triangles 37 711 à 52 158. Sur cette machine, `main` seul (PBV3) mesurait 12,5 à 15,8 ms avec l'outil de PBV3 : la mesure est bruitée de ± 2 ms.
- `npm run verifier` vert sur le résultat fusionné (typecheck, unitaires, construction, e2e Pinball 8 specs, budgets avec la proposition).

## Écarts et risques qui restent
- **Le décor de l'Espace a des planètes** (coins bas, silhouettes à 11 % au milieu), et les bumpers de l'Espace sont maintenant des planètes : les bumpers s'en distinguent (volume, socle à néon, contour), mais la règle « le décor ne ressemble jamais à un élément de jeu » invite à les réduire. C'est le sol, donc PBV3 : signalé, pas touché.
- **Les braises du Volcan** : la lave visible dépend du relief tiré de la graine ; elle est franche sur le dessus mais varie d'un angle à l'autre (voulu : une roche, pas une sphère).
- **Le moulin et le radar** se lisent moins bien que la grande roue et l'hélice vus de haut (une croix et une parabole) : leur silhouette est la plus proche possible dans l'emprise du spinner (± 24 px).
- **Un trou n'avait aucun retour au contact avant ce lot** (la bille disparaissait) : il s'allume maintenant, dans les deux rendus.
- Les lumières des socles ne passent pas dans le bloom (sa scène est celle de PBV3) : elles éclairent par leur couleur seule.

## Vérifié
- **`npm run verifier`** : typecheck, tests unitaires SQLite et libSQL, construction, **e2e Pinball (7 specs) verts** ; seul le contrôle des budgets était rouge (`pinball.rendu`, `pinball.demande`), d'où la proposition ci-dessus ; avec elle, `apps/portail/test/budgets.test.ts` est vert. `npm run consignes` vert.
- Test ajouté : `test/modeles.test.ts` (3 tests, dont les 444 tables) ; `test/etiquettes.test.ts` et `test/decor.test.ts` inchangés et verts (les noms et leur place ne bougent pas).
- Captures regardées : le catalogue (repos et contact), les quatre tables en haute et basse qualité, la table de près pendant une partie.
- Aucun fichier de `packages/pinball-sim` ni de `apps/api` touché.
- **CI de la PR, premier run** (43889997813) : tout vert (`zones`, `unit`, `e2e-pr`, `e2e`, **Budgets** avec la proposition) sauf **« Kit de bout en bout »** : `e2e/surimpression.spec.ts:51` d'un jeu généré (« Essaitemps », le HUD de score lu vide à 390 × 844) — hors des zones du lot (le kit et le générateur ; aucun fichier de Pinball n'y entre). Relancé une fois par un commit (run 43890836477) : **même échec**, sur `essai` cette fois (`surimpression.spec.ts:51`, « jeu-hud-score lu », texte vide). **En local, `node scripts/kit-bout-en-bout.mjs --e2e essai` passe en entier** (typage, unitaires, construction, budgets, e2e, zones), et le job est vert sur `main` (61277346, la base de cette PR). Rien de ce lot n'entre dans un jeu généré (il copie « Cibles », pas Pinball). **Arrêt, comme le veut la règle : Nathan tranche** (relancer le job, ou un lot de la plateforme pour ce spec).

## Non vérifié
- Un vrai téléphone (carte graphique), Firefox, WebKit.
- Les liens de l'aperçu (le réseau du conteneur refuse `web.app`).

## Zones partagées
- `docs/plateforme/budgets.md` : les plafonds de `pinball.rendu` et `pinball.demande` et deux lignes « Relèvements » (exception tolérée : la ligne du jeu). **C'est une proposition**, dans un commit à part.
- Rien d'autre hors de `apps/pinball/**` et `docs/pinball/**`.

## Pour Nathan : tester en 2 clics (recette, le jeu est `off`)
La base de l'aperçu est donnée par le commentaire « Recette » de la PR :
- `/pinball/?theme=foire`, `/pinball/?theme=ocean`, `/pinball/?theme=espace`, `/pinball/?theme=volcan`
- **La mission presque finie, pour voir les objets réagir** : `/pinball/?theme=ocean&essai=mission`
- **Le rendu de secours** : `/pinball/?theme=volcan&qualite=basse`

Ce que Nathan regarde : chaque étiquette correspond à un objet qu'on reconnaît, un bumper reste un bumper d'un thème à l'autre (il s'enfonce, son socle s'allume), et c'est fluide.

**Pour les joueurs : rien**
