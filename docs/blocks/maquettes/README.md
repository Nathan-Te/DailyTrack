# Lot B0 — maquettes de l'étiquette et du HUD de Blocks

**État : en attente de validation par Nathan.** Aucun code de jeu, aucun code d'interface : ce lot n'écrit que dans `docs/blocks/maquettes/`. Branche `claude/blocks-b0-mockups-5lrpn0`, PR brouillon `jeu:blocks`, « Pour les joueurs » : `rien`.

## Ce qu'il y a ici
Pages HTML autonomes (un seul fichier chacune : CSS et SVG en ligne ; polices et jetons recopiés de `@cdj/ui`), et leur capture PNG.

| Maquette | Page | Capture |
|---|---|---|
| Étiquette, 3 teintes sur l'étagère (Track · Jump · Tower · Blocks) | `blocks-etagere.html` | `blocks-etagere.png` |
| HUD portrait 390 × 844, 4 états | `blocks-hud-portrait.html` | `blocks-hud-portrait.png` (les 4 côte à côte) + `blocks-hud-portrait-1-debut.png`, `-2-glisser.png`, `-3-effacement.png`, `-4-plus-de-place.png` |
| HUD paysage 844 × 390, « en cours » | `blocks-hud-paysage.html` | `blocks-hud-paysage.png` |
| HUD bureau 1440 × 900, « en cours » (thème Nuit) | `blocks-hud-bureau.html` | `blocks-hud-bureau.png` |

Captures : Chromium de Playwright (déjà dans le dépôt), `file://`, polices du dépôt.
Les blocs, leurs yeux et les palettes ne sont pas redessinés à la main : ils viennent des **vraies fonctions du module commun** (`decrirePiece`, `disposerYeux`, `expressionDe`, palettes `@cdj/visuels/blocs`), donc le relief, l'encre et les yeux sont ceux de Tower. Le module n'est pas modifié.

## Ce qui est proposé (en bref)
- **Étiquette** : « BLOCKS » en Rubik Mono One ; une petite grille où une pièce à yeux vole vers sa case (Tower : une pile). Trois teintes : **A** bleu ciel `#B8D8F4` / `#1F4E79` (actuelle), **B** lilas `#D9C9F5` / `#5B3F9A`, **C** abricot `#F7C28E` / `#9A4A12` (aucune n'est prise par un autre jeu).
- **HUD portrait** : en haut, plaques de la charte (bordure 2 px, ombre nette 2 px) : **score**, **combo** (passe en moutarde dès ×2, deux carrés = poses sans effacement avant qu'il se perde), **fantôme** puis **pause** (44 px). La **grille prend 374 px** (cases de 45 px). Sous la grille, la **zone de saisie large** (252 × 200) ; à droite, la **pièce suivante**, petite, en pointillés sur fond crème-2 (le style « inactif » de la charte) : on voit qu'on ne la prend pas.
- **Glisser** : la pièce prend la taille de la grille et flotte au-dessus du doigt ; **ombre hachurée** (motif, ni transparence ni dégradé) sur la case aimantée ; lignes et colonnes qui seraient effacées **allumées** (anneau moutarde + papier, fond clair sur les cases vides) ; les yeux regardent la pièce ; sa place reste en pointillés dans la zone de saisie.
- **Effacement** : cases qui éclatent (liseré papier, yeux fermés), particules de leur couleur, **gain flottant** « +90 » (autocollant moutarde), annonce « Combo ×3 ! », compteur en moutarde.
- **Plus de place !** : les cases vides restantes clignotent en pointillés, les pièces s'affolent (niveau 2), la pièce du moment aussi (niveau 3), annonce sombre sur la grille ; l'écran de fin vient après.
- **Paysage** : score et combo à gauche, grille centrée (cases de 40 px), zone de saisie et suivante à droite, boutons en haut à droite. **Bureau** : même plan, cases de 64 px, avec une ligne d'aide souris/clavier.
- **Couleur par famille** de pièce (une couleur de la palette du thème par famille du seed) : petites = vert, barres = orange, carrés et rectangles = jaune, coins et grand L = rose, L et J = bleu, T = violet, S et Z = rouge.

## Vérifié / non vérifié
**Vérifié** : les quatre pages se génèrent et se rendent (captures regardées : portrait 4 états, paysage, bureau, étagère) ; cibles tactiles : boutons 44 × 44, zone de saisie 252 × 200 ; aucun émoji, aucune ombre floue, aucun dégradé, aucun jeton en dur hors jetons recopiés (les couleurs de pièces viennent du module) ; contrastes calculés (WCAG) : encre sur papier 15,1:1, légende encre-douce sur papier 6,3:1, légende encre sur crème-2 11,3:1, encre sur moutarde 8,4:1, papier sur encre 15,1:1, encre sur le fond d'étiquette A 10,9:1 / B 10,5:1 / C 10,1:1 (charte : 4,5:1) ; le contour d'allumage papier sur le fond Port 5,2:1 (Nuit : 16,1:1) et moutarde sur Nuit 9,0:1.
**Non vérifié** : le rendu sur un vrai téléphone et les marges de sécurité (`env(safe-area-inset-*)`, à faire à l'implémentation) ; le contraste des 7 couleurs de pièce avec les 6 fonds de thème (Tower a son `palettes.test.ts`, ici seulement Port et Nuit regardés) ; les couleurs de l'allumage en daltonisme (le signal est aussi une forme : anneau + ombre hachurée) ; les animations (les maquettes sont des images fixes) ; le moutarde seul sur le fond Port fait 2,9:1 (sous 3:1) : l'anneau est doublé de papier (5,2:1), à confirmer sur appareil ; le plateau plein de l'état 4 est tiré au hasard (pièces de 1 à 4 cases, pas le catalogue exact du seed).

## Deux constats à connaître
1. **Défaut du module commun avec une boîte par case.** `decrirePiece` ponte les arêtes communes des boîtes mais laisse **un point d'encre au croisement de quatre cases** (un 2×2, un 3×3 dessinés case par case). Tower n'est pas touché (ses pièces sont faites de grandes boîtes). Les maquettes **fusionnent les cases en rectangles** (bandes par rangée, puis bandes identiques réunies) avant d'appeler le module : le rendu de Blocks devra faire pareil, à chaque effacement partiel (les restes se refusionnent). Pas de correction ici (zone partagée).
2. **Le HUD du kit ne suffit pas tel quel.** `packages/kit/src/jeu/jeu.css` (`.jeu-hud`) est une bande crème pleine largeur de 44 px, avec le bouton fantôme à 60 % d'opacité ; la charte (§ 9, § 11) veut des plaques posées sur la scène, sans transparence. Voir la question 8.

## Questions ouvertes pour Nathan
1. **Teinte de l'étiquette : A, B ou C ?** Recommandation : **B (lilas)**, la plus distincte des quatre jeux et la seule qui rappelle les pièces. Contre : le bloc violet y est moins net. C : coque trop proche du bouton terre cuite. A : correcte mais confondue avec le ciel de Port.
2. **Police du nom : Rubik Mono One (comme Tower) ou Archivo Black ?** Recommandation : Rubik Mono One (déjà hébergée, 0 Ko, « lettres-blocs » ; les deux étiquettes se distinguent par la teinte et le dessin).
3. **Le gain flottant et le barème.** « +90 » et « Combo ×3 ! » (énoncé du lot) ne vont pas ensemble avec le seed : 90 = 3 lignes × 10 × 3² au combo ×1 ; au combo ×3, trois lignes valent 270. La maquette garde « +90 » pour une pose qui efface 2 lignes + 1 colonne. Recommandation : **afficher le gain total** (donc « +270 ») pour que le score monte exactement du chiffre flottant.
4. **Couleur par famille** (déterministe, on reconnaît la forme) ou par pièce au hasard ? Recommandation : par famille, comme ci-dessus.
5. **Les yeux** : une paire **par pièce posée** (sur sa case la plus centrale), jamais par case ; après un effacement partiel, **chaque morceau reconnecté garde une paire**. Ici, un morceau sans sa case d'yeux reçoit la paire de sa case la plus centrale. Recommandation : oui. (Toutes les pièces, même la 3 × 3, ont les yeux de taille d'une case : ceux d'un grand bloc sont petits, comme chez Tower.)
6. **Les deux carrés du combo** (poses restantes avant de le perdre) : les garder ? Recommandation : oui, c'est la règle la moins devinable du seed ; à retirer si le HUD paraît chargé.
7. **Pièce suivante** dans la zone de saisie, à droite (maquette), ou en haut à droite comme Tower ? Recommandation : à côté de la pièce du moment, là où se pose le regard.
8. **Le HUD des jeux neufs** (kit) doit-il adopter les plaques de la charte ? Recommandation : oui, **un lot de plateforme** distinct, avant le lot d'interface de Blocks (il profite aux jeux à venir) ; sinon Blocks dessinerait son HUD seul.
9. **Plein écran en vue** (charte, révision 12) : la maquette n'a que fantôme et pause (demande du lot). Recommandation : l'ajouter au paysage et au bureau seulement (iPhone ne l'offre pas), en portrait il reste dans la pause.
10. **Marges de la grille** : 8 px de chaque côté (cases de 45 px) au lieu des 16 px de la charte. Recommandation : accepter cet écart pour la grille seule (16 px donneraient des cases de 41 px, −9 %).
11. **Annonces en ombre terre cuite** (« Combo ×3 ! », « Plus de place ! ») : la charte réserve la terre cuite à l'action principale et à l'ombre du logo. Recommandation : garder une ombre encre et réserver la terre à « Rejouer » ; à trancher, la maquette montre la terre.
12. **Bouton fantôme à trois états visibles** (aucun : pointillés ; ma meilleure : moutarde ; Diamant : couleur diamant) : validé ? Recommandation : oui, le nom lu « Fantôme : … » reste celui du kit.

## Clés de catalogue à ajouter (non ajoutées) — catalogue du jeu, `fr` + `en`
| Clé | fr | en |
|---|---|---|
| `hud.score` | Score | Score |
| `hud.score.aria` | Score : {n} points | Score: {n} points |
| `hud.combo` | Combo | Combo |
| `hud.combo.aria` | Combo ×{n}, encore {k} poses sans effacement | Combo ×{n}, {k} moves left before it ends |
| `hud.combo.aucun` | Pas de combo | No combo |
| `hud.combo.annonce` | Combo ×{n} ! | Combo ×{n}! |
| `hud.piece` | Ta pièce | Your piece |
| `hud.piece.aria` | Pièce à poser | Piece to place |
| `hud.suivante` | Suivante | Next |
| `hud.suivante.aria` | Pièce suivante (information, non saisissable) | Next piece (for information, can't be picked up) |
| `hud.aide.glisser` | Glisse la pièce dans la grille | Drag the piece onto the grid |
| `hud.aide.bureau` | Glisse une pièce dans la grille, ou déplace l'ombre aux flèches | Drag a piece onto the grid, or move the shadow with the arrow keys |
| `hud.fin.plusDePlace` | Plus de place ! | No room left! |

Déjà dans le kit : `kit.hud.pause`, `kit.hud.fantome` (« Fantôme : {nom} »), `kit.fantome.*`. Le gain « +90 » et le « ×3 » sont des formats, pas des textes ; l'espace insécable sépare les milliers.

## Jetons proposés (non créés)
Aucun jeton de **couleur** nouveau pour le HUD : plaques et textes en jetons existants (`--dj-papier`, `--dj-creme-2`, `--dj-encre`, `--dj-encre-douce`, `--dj-moutarde`, `--dj-diamant`), grille et pièces en palettes du module (`sol`, `vague`, `ciel`).
- Teinte choisie : sa **fiche** (`etiquette.fond`, `etiquette.coque` de `config/jeux/blocks.json`) ; `npm run fiches` en tire les jetons de l'étiquette.
- `--blocks-epaisseur-jouer: 0 5px 0 var(--blocks-coque)` (bouton principal : fond encre, texte de la teinte, comme Tower).
- `--blocks-ombre-annonce` : `4px 4px 0 var(--dj-encre)` (ou terre cuite, question 11).
