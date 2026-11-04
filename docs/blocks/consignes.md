# Blocks — consignes du jeu (`apps/blocks`, `packages/blocks-sim`, `apps/api/src/blocks*.ts`)

Chargé par lecture des fichiers du jeu (zone `docs/blocks/**`). Réponses et docs en français. **Ce texte est celui que doit porter `apps/blocks/CLAUDE.md`** : le créer demande d'ajouter une ligne à la liste de `apps/portail/test/consignes.test.ts` (zone partagée, une PR de jeu n'y touche pas : lot de plateforme, voir le README du lot B1) ; en attendant il vit ici. **Vision : `docs/blocks/seed.md` (ne pas modifier, c'est Nathan qui le fait)**. Zones, méthode et règles de la plateforme : `docs/blocks/passation.md` (générée) et le `CLAUDE.md` racine ; le kit (`brancherJeu`) écrit les écrans : `packages/kit/CLAUDE.md`. Jeu **Arcade**, `off` jusqu'à ce que Nathan le publie.

Créé par `npm run nouveau-jeu -- --id blocks --classement score` (lot K4g, lot B0) ; à coller dans une conversation d'orchestration : `docs/blocks/passation.md` (générée). L'historique des lots est dans `docs/blocks/lots/`.

## Où est quoi
- `packages/blocks-sim` : la simulation (pure, entière) — `pieces.ts` (catalogue), `grille.ts` (masque de bits), `suite.ts` (tirage et rampe), `generateur.ts` (`dailyBlocks`), `partie.ts` (la partie, `jouer`), `scenarios.ts`, `rediffusion.ts`, `jours.ts` (jours figés), `variante.ts` (le classement : le seul endroit qui le sait), `glouton.ts` (bot d'essai, hors de l'index : `@cdj/blocks-sim/glouton`, **pas le Diamant**).
- `apps/blocks` : `main.ts` (`brancherJeu`), `definition.ts` (la glue), `corps.ts` (à la demande : tirage, scène, blocs communs), `scene.ts` (Canvas 2D et entrées), `miseEnPage.ts`, `boites.ts`, `couleurs.ts`, `essai.ts` (options d'adresse d'essai), `textes.ts`, catalogues, `e2e/` (ports 4179 et 8794).
- `apps/api/src/blocks.ts` (le contrat minimal : `definirJeuNeuf`), `apps/api/scripts/blocks-essais.ts` (module d'essais), `apps/api/test/blocks.test.ts`.

## Règles
Le jeu suit `docs/blocks/seed.md` **§ 3 (règles), § 4 (catalogue) et § 5 (score)**. Le classement est **score ↓, puis combo maximal ↓, puis le premier arrivé** (`submitted_at`, que toute table de résultats départage nativement : rien à ajouter). Pas de médaille avant B3 (`seuils` rend `null` côté serveur, zéros côté client).
- **Un seul endroit sait comment le jeu se classe : `variante.ts`** ; `test/variante.test.ts` le garde d'accord avec la fiche.
- **La suite du jour ne dépend jamais de la grille du joueur.** Garde-fous : jamais deux pièces de boîte 3 × 3 de suite (le carré 3 × 3 et les quatre grands L) ; aucune « très grosse pièce » (**6 cases ou plus, ou boîte de 3 × 3**) parmi les 6 premières.
- **Les couleurs et le dessin des blocs viennent du module commun `@cdj/visuels/blocs`** (direction artistique de Tower, jamais redessinée ici) ; les fonds sont les jetons de `@cdj/ui`. Un manque du module ou du kit se décrit dans le README du lot, il ne se code pas dans ce jeu.

## Représentation
- **Grille** : 8 × 8 en **masque de bits**, deux entiers de 32 bits (`lo` : lignes 0 à 3, `hi` : lignes 4 à 7 ; une ligne = un octet, le bit `c` = la colonne `c`) ; fonctions pures de `grille.ts`.
- **Pièce** : ses `rangees` (un octet par ligne de sa boîte) ; 37 pièces, **chaque orientation est une pièce distincte** ; l'`id` (rang dans le catalogue) est ce que la suite contient.
- **Action** : la case (colonne, ligne) du coin haut-gauche de la boîte de la pièce du moment, sur **un octet : `ligne × 8 + colonne`** (0 à 63). Une action illégale est rejetée sans changer l'état. **La rediffusion est la suite des actions** (un octet par pose) dans l'enveloppe commune ; **plafond : 2 000 pièces** (la partie s'arrête à la 2 000ᵉ pose ; le serveur refuse une suite plus longue, une action illégale, une action après la fin et une partie non terminée : `invalid_replay`).
- Un jour figé écrit sa suite en un texte (un caractère par pièce : `48 + id`).

## Versions
**Règles v1** (`BLOCKS_SIM_VERSION`) et **tirage v1** (`BLOCKS_GENERATOR_VERSION`). Golden : `npm run golden:blocks -w @cdj/blocks-sim` — **jamais sans monter la version concernée** (règles pour les rediffusions, tirage pour les empreintes de suite). Mesure de la rampe : `npm run mesure:rampe -w @cdj/blocks-sim -- --graines=1000 [--pente=4] [--rangmax=80]` (durée des parties du glouton simple, en pièces).

## Scénarios (locaux, jamais classés ; jamais sur la production)
`?scenario=presque-plein` (une pose efface 2 lignes et 1 colonne) · `?scenario=blocage` (la pièce ne rentre nulle part : fin immédiate) · `?scenario=plateau-vide` (une pose vide la grille) · `?seed=AAAA-MM-JJ` (le jour d'une date, en archive). **Un scénario ou une rampe réglée met la page en archive** (`essai.ts` pose `?seed=` de la veille avant que le kit ne lise l'adresse) et sa rediffusion nomme le scénario : ni classée, ni envoyée. **Réglage de la rampe** : `?debug&tune&rampe=<pente>,<rangMax>` (défaut `4,80`) et `&decalage=<cases>` (la pièce au-dessus du doigt, défaut 1,3). `?debug` ouvre `window.__blocks` (positions de la grille et de la zone de saisie, ombre, surlignage) pour les specs.

## Mise en page et geste
Portrait : grille en pleine largeur, pièce du moment dessous dans une zone de saisie large, pièce suivante petite (non saisissable) ; paysage et bureau : grille à gauche, zone à droite (`miseEnPage.ts`, pure, testée). La pièce saisie grossit à la taille des cases et flotte au-dessus du doigt ; l'ombre s'aimante à la position légale la plus proche (moins d'une case) ; les lignes et colonnes qui seraient effacées s'allument ; relâcher ailleurs renvoie la pièce. Clavier et manette (M1, M2) : `gauche` … `bas` déplacent l'ombre, `poser` pose.

## Hors lot B1
Effets, particules, sons, yeux animés, vibration (B2) · bot Diamant, médailles, thème du jour et palettes par thème (B3) · partage, fantôme, `preview`, HUD sur mesure (B4 et maquettes B0).

## Zone et budget
La ligne `blocks.jsCss` de `docs/plateforme/budgets.md` est celle du premier chargement (l'accueil seul) : **le corps du jeu (`corps-`) est à la demande** (`budget.aLaDemande` de la fiche) ; un budget ne se relève qu'avec Nathan. Un nouveau spec e2e se déclare dans la fiche (`e2e.specs`) **et** `apps/blocks/e2e/durees.json`. Les pages de mentions légales ne nomment pas les clés `blocks:*` tant que le jeu est `off` ; **avant `on`, un lot de la plateforme les décrit**.
