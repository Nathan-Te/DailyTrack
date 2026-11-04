# Blocks — consignes

Chargé par lecture des fichiers du jeu (zone `docs/blocks/**`). Réponses et docs en français. **Créé par `npm run nouveau-jeu -- --id blocks --classement score`** (lot K4g, lot B0) ; vision : `docs/blocks/seed.md` (**ne pas modifier**, c'est Nathan qui le fait) ; à coller dans une conversation d'orchestration : `docs/blocks/passation.md` (générée). Les règles en vigueur (règles du jeu, représentation, versions, scénarios, hors lot) sont dans `apps/blocks/CLAUDE.md` ; l'historique des lots est dans `docs/blocks/lots/`.

## État
- **Le cœur du jeu est jouable (lot B1)** : règles du seed § 3 à 5, une scène au glisser-déposer avec les blocs communs, le contrat serveur minimal, les scénarios d'essai.
- **Le HUD de la maquette A et les sensations sont là (lot B2)** : plaques du score et du combo, effacement en particules, combo qui monte d'un demi-ton, yeux, sons, plateau vide ; la pièce reste sous le doigt (plus de décalage) ; catalogue de 40 pièces (grand T ajouté, pièce de 1 case retirée), tirage v2. Règles : `apps/blocks/CLAUDE.md` (« Sensations »). Reste : bot Diamant, médailles, thèmes (B3) ; partage, fantôme, `preview` (B4).
- **Il est `off`** (`etatDepart` de la fiche) : absent de l'accueil, « Bientôt » sur sa page ; Nathan le passe en `preview` puis `on` depuis `/admin/` › Jeux. `temoin: false`.
- **À décider par Nathan** : le premier jour (`premierJour`, à régler au lancement) et les budgets (ligne `blocks.jsCss` de `docs/plateforme/budgets.md`).

## Où est quoi
- `packages/blocks-sim` : la simulation (pure, entière) — `pieces.ts` (catalogue : 40 pièces), `grille.ts` (masque de bits), `suite.ts` (tirage et rampe), `generateur.ts` (`dailyBlocks`), `partie.ts` (la partie, `jouer`), `scenarios.ts`, `rediffusion.ts`, `jours.ts` (jours figés), `variante.ts` (le classement : le seul endroit qui le sait), `glouton.ts` (bot d'essai, hors de l'index : `@cdj/blocks-sim/glouton`, **pas le Diamant**).
- `apps/blocks` : `main.ts` (`brancherJeu`), `definition.ts` (la glue), `corps.ts` (à la demande : tirage, scène, blocs communs), `scene.ts` (Canvas 2D et entrées), `miseEnPage.ts`, `boites.ts`, `couleurs.ts`, `essai.ts` (options d'adresse d'essai), `textes.ts`, catalogues, `e2e/` (ports 4179 et 8794).
- `apps/api/src/blocks.ts` (le contrat minimal : `definirJeuNeuf`), `apps/api/scripts/blocks-essais.ts` (module d'essais), `apps/api/test/blocks.test.ts`.

## Zone et budget
La ligne `blocks.jsCss` de `docs/plateforme/budgets.md` est celle du premier chargement (l'accueil seul) : **le corps du jeu (`corps-`) est à la demande** (`budget.aLaDemande` de la fiche) ; un budget ne se relève qu'avec Nathan. Un nouveau spec e2e se déclare dans la fiche (`e2e.specs`) **et** `apps/blocks/e2e/durees.json`. Les pages de mentions légales ne nomment pas les clés `blocks:*` tant que le jeu est `off` ; **avant `on`, un lot de la plateforme les décrit**.
