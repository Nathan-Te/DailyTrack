# Lot B7 — Blocks : la pièce suivante à sa vraie taille

Branche `claude/blocks-b7-suivante-doan2q` (celle que la session impose ; le prompt disait `blocks/b7-suivante`), PR brouillon `jeu:blocks`. Partie de `main` à jour (rien de nouveau depuis). Jeu `off` : « Pour les joueurs » = `rien`. **Aucun changement** de simulation (règles, tirage, barème, médailles), de décors, de sons ni de musique ; golden intacts.

## Ce qui est fait
- **Échelle fixe** (`miseEnPage.ts`, `scene.ts`) : la pièce du moment est **toujours à la taille exacte des cases de la grille** (`coteMain` = `cote`) ; la suivante **toujours à 60 %** (`PART_SUIVANTE`), la même pour les 40 pièces. `coteEnMain` et `coteEnSuivante` (qui ajustaient chaque pièce à sa zone) sont supprimées : plus aucun ajustement.
- **Cases lisibles** : chaque case de la suivante a son contour (trait fin sombre posé sur le dessin du module commun, `contourDesCases`) ; les yeux ne sont pas dessinés sur la suivante (comme avant).
- **Gabarit de 5 × 5 cases** derrière la suivante (pointillés fins à 30 %), à la même échelle, la pièce centrée dedans.
- **Zones dimensionnées pour la plus grande pièce** (barre de 5 couchée ou debout, 3 × 3) à ces échelles : « Ta pièce » = 5 cases + marges, « Suivante » = gabarit de 3 cases (5 × 60 %) + marges. Si elles ne tiennent pas, **la grille rapetisse, pas les pièces** (boucle sur le côté d'une case).
- **`?scenario=suivantes`** (local, jamais classé ; `packages/blocks-sim/src/scenarios.ts`) : grille vide, suite domino, carré 3 × 3, coin, barre de 5, carré 2 × 2, grand L, puis domino et barre de 5 debout, coin, grand T, barre de 4, carré 3 × 3. La partie continue ensuite avec la suite du jour 0.
- `apps/blocks/CLAUDE.md` : « Mise en page » (règle « échelle fixe des pièces ») et « Scénarios » (`suivantes`) ; `docs/blocks/consignes.md` (état).

## Ce que ça coûte (mesuré, à connaître)
Dimensionner les zones pour la barre de 5 à pleine taille demande de la place :
- **Portrait** : les deux zones côte à côte font 8 cases de large, la grille ne peut plus être pleine largeur : **92 à 94 % de la largeur utile** (avant : 99 %) ; 390 × 844 : cases de 44 px (46 avant) ; 360 × 640 : 40 px (43 avant), et **la ligne d'aide d'avant la première pose n'y tient plus** (elle s'efface sous 24 px de haut, règle de B5 inchangée).
- **Paysage et PC** : la colonne de droite est large de 5 cases (3,5 avant), plus que celle du HUD : la grille garde ses 80 % de hauteur, mais **n'est plus exactement centrée** (décalée vers la gauche de 1 à 3 % de la largeur selon l'écran) ; la colonne dépasse un peu la grille en haut et en bas (elle reste dans l'écran et ne touche jamais le bouton pause).
- **Tests relâchés ou changés par ce choix (et seulement eux)** : `test/miseEnPage.test.ts` « grille centrée à ±1 px » → ±3 % de la largeur ; « grille pleine largeur aux cases entières près » (portrait) → ≥ 90 % de la largeur utile (e2e : ≥ 88 % de la largeur de l'écran) ; « colonne de droite alignée sur le haut de la grille et sous son bas » → dans l'écran, centrée sur la grille. Les seuils de HUD, de grille (≥ 70 %, ≈ 80 % en paysage), de zones jamais plus grandes que la grille et de non-recouvrement sont **inchangés**.

## Vérifié
- **Unitaires** (SQLite) : `miseEnPage.test.ts` (sept tailles : côté des cases de la suivante identique pour les 40 pièces et sur les 7 tailles, = 60 % de celui de la grille ; pièce du moment = côté de la grille ; la plus grande pièce tient dans sa zone et dans le gabarit, sous l'étiquette ; zones ≤ grille ; gabarit de 5 × 5 centré), `scenarios.test.ts` (cinq scénarios, jamais classables ; `suivantes` : grille vide, les six premières pièces, jouable), `essai.test.ts`. Les 141 tests de `apps/blocks` et les 120 de `blocks-sim` passent.
- **E2E** (Chromium, les 79 tests de Blocks) : `scenarios.spec.ts` (`suivantes` à 1280 × 720 et 390 × 844 : à chaque pose, pièce du moment = taille des cases, suivante = 60 %, dans le gabarit, centrée, six tailles différentes) ; `disposition.spec.ts` sur les 7 tailles ; glisser, sensations, thèmes, etc. inchangés.
- `npm run typecheck`, `npm run build`, budgets : verts (`blocks.jsCss` 46,85 Ko sur 47).
- Captures : `docs/blocks/lots/captures-b7/` (PC 1280 × 720, portrait 390 × 844) ; regardées aussi : 844 × 390.

## Non vérifié / à signaler
- **`npm run verifier` rouge hors de ma zone** : `packages/ui/test/traductions.test.ts` (« le fichier du dépôt est à jour ») échoue — `docs/plateforme/traductions.md` n'est pas à jour **sur `main` lui-même** (reproduit sur l'arbre sans mes changements ; `main` n'a rien de nouveau). Zone de la plateforme : non corrigé (règle d'arrêt), Nathan tranche (`npm run traductions`). Le verifier s'arrête à cette étape : le reste a été lancé à la main (typecheck, build, budgets, e2e Blocks).
- Tests libSQL non lancés (pas d'`sqld` local ; aucun fichier d'API touché).
- Regardé par un humain : rien sur un vrai téléphone ; l'aspect du gabarit (très discret, volontairement) est à juger par Nathan, ainsi que la perte de largeur de grille en portrait.
