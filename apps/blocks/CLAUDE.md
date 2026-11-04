# `apps/blocks` : le jeu Blocks

Chargé quand on lit un fichier de `apps/blocks`. Les règles du jeu (zones, état de départ, où est quoi) sont dans [docs/blocks/consignes.md](../../docs/blocks/consignes.md), sa vision dans `docs/blocks/seed.md` (**ne pas modifier**), les règles communes dans le `CLAUDE.md` racine.

## Règles
Le jeu suit `docs/blocks/seed.md` **§ 3 (règles), § 4 (catalogue) et § 5 (score)**. Classement : **score ↓, puis combo maximal ↓, puis le premier arrivé** (`submitted_at`, que toute table de résultats départage nativement : rien à ajouter à la fiche). **Un seul endroit sait comment le jeu se classe : `packages/blocks-sim/src/variante.ts`** (`test/variante.test.ts` le garde d'accord avec la fiche). Pas de médaille avant B3.
- **La suite du jour ne dépend jamais de la grille du joueur.** Garde-fous : jamais deux pièces de boîte 3 × 3 de suite (le carré 3 × 3 et les quatre grands L) ; aucune « très grosse pièce » (**6 cases ou plus, ou boîte de 3 × 3**) parmi les 6 premières. La rampe (poids des grosses pièces selon le rang) est réglable : `?debug&tune&rampe=<pente>,<rangMax>`.
- **Les blocs viennent du module commun `@cdj/visuels/blocs`** (direction artistique de Tower, jamais redessinée ici) ; les fonds sont les jetons de `@cdj/ui` ; un manque du module ou du kit se décrit dans le README du lot, il ne se code pas ici. **Rien ne s'ajoute au premier chargement** : le corps du jeu (tirage, scène, blocs) est le chunk à la demande `corps-` (`budget.aLaDemande` de la fiche) ; un budget ne se relève qu'avec Nathan.
- **Le geste** (seed § 6) : la pièce saisie grossit à la taille des cases et flotte au-dessus du doigt (décalage réglable, `&decalage=<cases>`) ; l'ombre s'aimante à la position légale la plus proche ; les lignes et colonnes qui seraient effacées s'allument ; relâcher ailleurs renvoie la pièce. Clavier et manette (M1, M2) : `gauche` … `bas` déplacent l'ombre, `poser` pose. Mise en page : `miseEnPage.ts` (pure, testée) ; portrait, paysage et bureau.

## Représentation
- **Grille** : 8 × 8 en **masque de bits**, deux entiers de 32 bits (`lo` : lignes 0 à 3, `hi` : lignes 4 à 7 ; une ligne = un octet, le bit `c` = la colonne `c`) ; fonctions pures de `grille.ts`.
- **Pièce** : 37 pièces, **chaque orientation est une pièce distincte** ; l'`id` (rang dans le catalogue) est ce que la suite contient.
- **Action** : la case (colonne, ligne) du coin haut-gauche de la boîte de la pièce du moment, sur **un octet : `ligne × 8 + colonne`** (0 à 63) ; une action illégale est rejetée sans changer l'état. **La rediffusion est la suite des actions**, un octet par pose, dans l'enveloppe commune ; **plafond : 2 000 pièces** (la partie s'arrête à la 2 000ᵉ pose ; le serveur refuse une suite plus longue, une action illégale, une action après la fin et une partie non terminée : `invalid_replay`).

## Versions
**Règles v1** (`BLOCKS_SIM_VERSION`) et **tirage v1** (`BLOCKS_GENERATOR_VERSION`). Golden : `npm run golden:blocks -w @cdj/blocks-sim` — **jamais sans monter la version concernée** (règles pour les rediffusions, tirage pour les empreintes de suite). Durée des parties du glouton simple (pour calibrer la rampe) : `npm run mesure:rampe -w @cdj/blocks-sim -- --graines=1000 [--pente=4] [--rangmax=80]`.

## Scénarios (locaux, jamais classés ; jamais sur la production)
`?scenario=presque-plein` (une pose efface 2 lignes et 1 colonne) · `?scenario=blocage` (la pièce ne rentre nulle part : fin immédiate) · `?scenario=plateau-vide` (une pose vide la grille) · `?seed=AAAA-MM-JJ` (le jour d'une date, en archive). **Un scénario ou une rampe réglée met la page en archive** (`essai.ts` pose `?seed=` de la veille avant que le kit ne lise l'adresse) et la rediffusion d'un scénario nomme le scénario : ni classée, ni envoyée. `?debug` ouvre `window.__blocks` (positions de la grille et de la zone de saisie, ombre, surlignage) pour les specs.

## Hors lot B1
Effets, particules, sons, yeux animés, vibration (B2) · bot Diamant, médailles, thème du jour et palettes par thème (B3) · partage, fantôme, `preview` (B4) · HUD sur mesure (après validation des maquettes B0).

## Maquettes (lot B0)
- **`docs/blocks/maquettes/` font foi pour l'étiquette et le HUD** : étiquette sur l'étagère (3 teintes), HUD en partie en portrait (4 états), en paysage et au bureau. Le README du dossier liste les questions ouvertes, les clés de catalogue et les jetons proposés.
- **État : en attente de validation par Nathan.** Tant qu'il n'a pas validé (et tranché les questions du README), **aucun code d'interface** n'est écrit : ni HUD, ni étiquette, ni écran. Une fois validé, cette section dit quelle teinte et quelles réponses sont retenues.
- Les maquettes appellent les fonctions du module commun (`@cdj/visuels/blocs`) : à l'implémentation, **fusionner les cases d'une pièce en rectangles** avant `decrirePiece` (une boîte par case laisse un point d'encre au croisement de quatre cases ; détail dans le README des maquettes).
