# `packages/visuels` (`@cdj/visuels`) : les visuels communs des jeux (lot DA1)

Chargé quand on lit un fichier de `packages/visuels`. **Zone partagée** (un lot n'y touche que si son prompt le dit : lot de plateforme). Premier module : **`blocs`**, la direction artistique des blocs de Tower (aplats bordés d'encre, relief, petits yeux, palettes par thème du jour), que Blocks et d'autres jeux reprennent. Le module ne dépend d'aucun jeu ni de la plateforme (`three` seulement, dans le dessinateur Three.js) et ne nomme aucun jeu dans son code.

## Les couches (un point d'entrée chacune ; l'index est vide)
| Point d'entrée | Contient | Chargement |
|---|---|---|
| `@cdj/visuels/blocs` | **la description**, sans moteur de rendu : palettes (le port), formes (`boitesDeForme`), relief (`decrirePiece` : l'encre, le liseré, la couleur, tous dans la forme), yeux (`expressionDe`, `disposerYeux`, `Clignotement`), couleurs de la charte (`ENCRE`, `PAPIER`, `melanger`) | premier chargement du jeu qui s'en sert (palette du port, mélange) |
| `@cdj/visuels/blocs/themes` | les cinq autres palettes | `import()` |
| `@cdj/visuels/blocs/three` | le dessinateur **Three.js** (celui de Tower) : formes de base, `poserCouches`, `Yeux` | avec la scène du jeu, jamais au premier chargement |
| `@cdj/visuels/blocs/canvas` | le dessinateur **Canvas 2D** (pour un jeu en grille) : `placer`, `dessinerCouches`, `dessinerYeux`, `dessinerPiece` | à la demande |

**Règles** : (1) un fichier de description n'importe ni `three`, ni le navigateur, ni un jeu (`test/description.test.ts`) ; (2) **les deux dessinateurs lisent la même description** : un nouvel élément du dessin s'ajoute d'abord à la description, puis aux deux dessinateurs, et la planche `/ui/` › Blocs doit rester sous 1 % de pixels différents par paire (`apps/web/e2e/portail.spec.ts`, `test/dessinateurs.test.ts`) ; (3) le module ne lit aucun jeton : l'encre et le papier sont des constantes que les tests des jeux comparent aux jetons (`apps/tower/test/visuelsBlocs.test.ts`) ; (4) les couleurs et les distances viennent de Tower **sans changement** : toute modification d'apparence est une décision de Nathan, et Tower le voit (captures de référence) ; (5) tout dépasse-t-il le budget d'un jeu ? mesurer (`node scripts/budgets.mjs`).

## Le relief n'a pas de trou (lot B1)
`interieur` (`relief.ts`) ajoute un carré de `2 × retrait` à tout point que quatre quarts de plan remplis se partagent (quatre cases autour d'un point, ou deux cases appuyées sur une troisième) : sans lui les ponts s'arrêtent tous à `retrait` du point et un point d'encre reste au milieu du bloc. Les coins rentrants (T, L) n'en reçoivent pas. **Aucune forme de Tower n'a un tel point** : `test/description.test.ts` vérifie que leurs rectangles sont inchangés (une boîte, ou autant de boîtes que de ponts + 1), donc leur rendu aussi. Le regard (`regard`, `regardVers`) et la fermeture des yeux (`fermeture`, genre `figee`, clignement) existent déjà dans `expression.ts`.

## Détails qui font le même rendu
Le disque est le polygone de 20 côtés de Three.js (`COTES_DISQUE`) ; les rectangles d'une couche sont **un seul chemin rempli une fois** en Canvas (sinon un filet clair marque l'arête de deux rectangles) ; les yeux se dessinent **couche par couche** (tous les contours, puis les blancs, les pupilles, les sourcils : un œil écarquillé recouvre l'autre).

## Réutiliser un design (comment un jeu reprend les blocs)
1. Donner au dessin des **boîtes** (`Boite8`, huitièmes de case autour du centre de masse) : `boitesDeForme` pour les sept formes à quatre cases, ou les siennes.
2. `decrirePiece(boites, { couleur: palette.pieces[forme], encre: ENCRE, halo? })` → les couches ; `centreDesYeux(boites)` et `disposerYeux(x, y, échelle, expressionDe({ niveau, genre, regard, clignement, t }), t, phase)` → les yeux. Le niveau de panique et le regard sont **calculés par le jeu** (Tower : `panique.ts`) ; le module ne lit que le nombre.
3. Dessiner : en Canvas, `dessinerPiece(ctx, { x, y, pxParMetre, angle }, couches, yeux)` ; avec Three.js, `poserCouches(groupe, couches)` et `new Yeux(groupe, x, y, échelle, phase).appliquer(expression, t)` à chaque image.
4. Palette : `PALETTE_PORT`, puis `import("@cdj/visuels/blocs/themes")` ; le jeu vérifie le contraste avec ses propres fonds (Tower : `test/palettes.test.ts`).
5. **Rien de ce qui est propre à un jeu n'entre ici** (décors, effets de palier, particules, habits : restent dans le jeu). Un nouveau design commun = un nouveau dossier `src/<nom>/` et ses points d'entrée.
