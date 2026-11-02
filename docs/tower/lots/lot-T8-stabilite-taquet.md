# Lot T8 — Une tour qui tient, et le taquet (Tower)

Branche `claude/tower-stability-wedge-6r0s01`, PR brouillon. **Tower reste `off`.** Aucune version ni aucun golden de Track ou de Jump touché ; `lab/` intact ; `docs/tower/seed.md` intact. Règles : `docs/tower/consignes.md`, « Une tour qui tient, la tolérance et le taquet (lot T8, simulation 5) ». Pour les joueurs : rien (Tower est `off`).

Retour de Nathan (2 novembre) : « les blocs bougent un tout petit peu et on ne peut plus rien emboîter, parfois sans raison » ; « il faut deux touches pour donner un taquet à droite ou à gauche ».

## Le diagnostic, mesuré avant toute correction (`npm run stabilite:tower -w @cdj/tower-sim -- --variante=v4,v5,…`)
**Le corpus** : 200 parties à graine fixe — 168 d'un joueur bruité (il vise la grille avec une heuristique de surface, tire ses temps de réaction et sa cadence, fait des porte-à-faux légers et des pièces mal placées d'une demi-case ; 56 jours × 3 niveaux de bruit), 24 du **bot du lot T3 rendu imparfait** (3 positions de chaque côté, un décalage d'une demi-case toutes les 7 pièces), 8 des scénarios `alignement` et `essai`. ≈ 3 600 poses, 18 poses par partie (le joueur bruité perd ses vies vers la 20e pièce, comme un joueur moyen). **Quatre indicateurs** (définitions : en-tête de `tools/stabilite.ts`) ; chaque cause est mesurée **en ne changeant qu'un facteur** à partir de `neutre` (la simulation 5 avec ses correctifs éteints, qui redonne la 4).

**À lire d'abord** : sur ce corpus, les **mouvements sans cause valent 0 dès la simulation 4**, même au seuil fin (1 mm, 0,1°) : une pièce endormie reste endormie. Ce que Nathan voit est donc autre chose : une pose **décale des pièces que la pièce posée n'a pas touchées** (le choc se propage, 3 poses sur 4 d'une tour bien bâtie en bougent au moins une de plus d'1 mm), et de petits décalages **ferment les trous** (52 % seulement des fosses d'une ou deux cases acceptent encore leur pièce exacte).

<<TABLEAU_AVANT_APRES>>

<<TABLEAU_CAUSES>>

## Ce qui a été changé (simulation 5)
- **Pose douce** : au lâcher la pièce descend à 0,25 m/s, gravité coupée 20 ticks (≤ 7 cm de jeu) : elle arrive au contact à **0,25 m/s au lieu de ≈ 2,6 m/s** ; puis tout son poids. Réglable (`?debug&tune`).
- **Tolérance d'emboîtement 2 cm** en main (déplacement, quart de tour, taquet, vent) et au test de lâcher ; Rapier sépare les corps sans éjecter (essai : trou rétréci de 1,5 cm, voisines < 1 cm).
- **Repos** : aucun amortissement, sommeil forcé, frottement ni contact modifié (aucun n'améliore, voir « causes »).
- **Taquet** : `taquetGauche` / `taquetDroite` ; en main un pas fin de 12,5 cm ; après le lâcher (15 ticks) une poussée de 2,5 m/s, 3 au plus, réservée à la pièce lâchée. Touches : Q / E (A / E en AZERTY), LB / RB, deux petits boutons tactiles au-dessus de ← et →. Aide en partie, « Comment jouer », Réglages › Commandes, catalogues fr et en.
- **Vent** : une demi-case tous les 40 ticks (même dérive moyenne, reste sur la grille).
- **`?scenario=emboitement`**, **`TOWER_SIM_VERSION` = 5** (3 et 4 rejouables au bit près), golden à trois étages (six rediffusions de la 5, dont une avec taquet).

<<PARAMETRES>>

<<BOT>>

<<POIDS>>

<<VERIFIE>>

## Questions pour Nathan
<<QUESTIONS>>

## Liens de test (aperçu de la PR)
- `/tower/?scenario=emboitement` : fais descendre le carré à gauche du bâton couché (4 pas à gauche), laisse-le se poser contre la plateforme, puis **deux taquets à droite à deux ou trois ticks d'écart** (A ou E, LB / RB) : il glisse dans la niche sous le bâton. Puis le bâton (tourner 3 fois, aller à 5 m) dans le trou du dessus rétréci de 1 cm : il entre et s'y pose.
- `/tower/?seed=2026-11-05` : deux parties entières ; une tour bien posée ne bouge plus, les trous restent emboîtables.
