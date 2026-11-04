# Lot DA1 (plateforme, touche Tower) — les blocs de Tower, un module visuel commun

Nathan veut que les jeux reprennent des designs existants ; premier cas : Blocks (`docs/blocks/seed.md`, **absent de ce dépôt** : le lot B0 qui le verse n'est pas dans `main`, le lot n'en dépend pas). Module : **`packages/visuels`** (`@cdj/visuels/blocs`). Pour les joueurs : rien.

## 1. Inventaire : où vivait la direction artistique de Tower
| Quoi | Où (avant) | Dépend de Three.js ? |
|---|---|---|
| Forme des blocs (sept formes, boîtes en huitièmes) | `tower-sim/lab/pieces.ts` (physique) ; table recopiée dans `blocs/formes.ts` (test d'égalité) | non |
| Relief : encre = collider, liseré, couleur en retrait | `dessinPiece.ts` (pur) + boucle de `scene.ts` | non / oui (les rectangles) |
| Yeux : géométrie, états, clin, regard | `expression.ts` (pur), `yeux.ts` (maillages) | non / oui |
| Palettes par thème (6) | `palette.ts` (port), `palettes.ts` (cinq, à la demande) | non |
| Encre, papier, mélange | jetons `@cdj/ui`, `couleurs.ts` | non |
| Formes de base (rect, disque de 20 côtés, matières) | `formes.ts` | oui |
| Panique (niveau 0–3 dérivé de la vue) | `panique.ts` | non, **propre à Tower** |
| Halo, glace, habits, taquet, particules (gerbe, traînées), décors par thème | `habits.ts`, `taquetFx.ts`, `gerbe.ts`, `decor*.ts` | oui, **propres à Tower** (restent) |
| Rendu (caméra orthographique, y vers le haut, 1 m = 1 unité) | `scene.ts` | oui |

## 2. Le module, et pourquoi un paquet à part
Un paquet (`packages/visuels`) plutôt qu'une brique de `@cdj/kit` : le kit ne dépend d'aucune bibliothèque externe et ne s'occupe que du câblage des jeux ; le dessinateur Three.js a besoin de `three`, et la planche de la vitrine doit pouvoir dessiner « comme Tower » sans importer `apps/tower`. Deux couches, un point d'entrée chacune (index vide) : `blocs` (description : palettes, formes, relief, yeux, sans moteur de rendu), `blocs/themes` (cinq palettes, à la demande), `blocs/three` (dessinateur de Tower), `blocs/canvas` (Canvas 2D). Règles et « réutiliser un design » : `packages/visuels/CLAUDE.md`.

## 3. Tower sans changer d'un pixel
Tower perd ses six copies (`palettes`, `couleurs`, `dessinPiece`, `expression`, `yeux`, `formes`) et appelle le module ; `construirePiece` compose le relief par `decrirePiece` + `poserCouches`. **Captures de référence** (accueil, partie avec yeux en panique — un œil affolé —, arrivée ; thèmes port et nuit ; Chromium 1280 × 720, temps d'affichage posé à la main) : **les six PNG de la version d'origine et de la nouvelle sont identiques octet pour octet** (comparaison `cmp` ; le temps d'affichage est posé à la main, le décompte de l'accueil et les temps affichés sont masqués : ils changent d'une seconde à l'autre). Golden de `tower-sim` : **non touchés** (aucun fichier de la simulation modifié).

## 4. La planche `/ui/` › Blocs
114 paires (6 thèmes × [7 formes + 12 états des yeux]) : Canvas 2D à gauche, dessinateur de Tower à droite, avec **l'écart mesuré** (part de pixels qui diffèrent nettement). **Pire paire 0,19 %, moyenne 0,085 %** (les bords). La mesure a trouvé un vrai défaut avant la livraison (un œil écarquillé recouvrait la pupille de l'autre en Canvas : 0,53 % → corrigé, les yeux se dessinent couche par couche). Spec : `apps/web/e2e/portail.spec.ts` (Essentiel, seuil 1 %).

## Budgets (octets gzip, `scripts/budgets.mjs`, même machine, avant → après)
| ligne | avant | après |
|---|---:|---:|
| `tower.jsCss` (accueil) | 39 639 | 39 640 |
| `tower.jeu` | 174 714 | ≈ 175 130 |
| `tower.decors` · `tower.habits` | 4 129 · 5 309 | 4 134 · 5 301 |
Plafonds **non relevés** (jeu : 193 Ko). **Écart non résolu : `tower.jeu` grossit d'environ 0,4 Ko** (la couche de description, les poses d'yeux en objets ; la version intermédiaire coupait déjà `three` en deux fichiers, +1,9 Ko, évité). **Accepté par Nathan** (règle B1 : garde-fou, pas objectif) : aucun plafond ni mesure à la pose de `budgets.md` ne change, la mesure reste très sous le plafond.

## Modifications des consignes
`docs/tower/consignes.md` (les visuels viennent du module), `packages/visuels/CLAUDE.md` (description, dessinateurs, réutiliser un design), `docs/orchestration.md` § 12 ter, `CLAUDE.md` racine et `carte-du-depot.md` (une ligne), `apps/tower/CLAUDE.md`. Hors périmètre : Blocks, l'apparence de Tower.
