// `@cdj/visuels/blocs` — la DESCRIPTION des blocs de Tower, que tout jeu qui reprend leur direction artistique lit : les palettes par thème (le port ici, les cinq autres dans `@cdj/visuels/blocs/themes`, à la demande),
// les formes, le relief (le trait d'encre, le liseré, la couleur, tous à l'intérieur de la forme), les yeux (l'expression, la géométrie) et leurs temps. **Aucun moteur de rendu ici** : les dessinateurs sont
// `@cdj/visuels/blocs/three` (Three.js, celui de Tower) et `@cdj/visuels/blocs/canvas` (Canvas 2D, pour un jeu en grille). Règles : `packages/visuels/CLAUDE.md`.
export { ENCRE, PAPIER, melanger } from "./couleurs";
export { type Boite8, boitesDeForme, type Forme, FORMES } from "./formes";
export { PALETTE_PORT, type PaletteTheme, type ThemeBloc, THEMES_BLOCS } from "./palettes";
export { BORD, colliderDe, type CoucheRelief, couchesDe, decrirePiece, interieur, LISERE, type OptionsRelief, type Rect } from "./relief";
export { Clignotement, type EntreeExpression, type Expression, expressionDe, type Genre, type Niveau, NIVEAUX, regardVers } from "./expression";
export { centreDesYeux, COTES_DISQUE, disposerYeux, ECART, type PoseOeil, PROFONDEUR_OEIL, R_BLANC, R_ENCRE, R_PUPILLE } from "./yeux";
