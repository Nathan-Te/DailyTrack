# Blocks — consignes

Chargé par lecture des fichiers du jeu (zone `docs/blocks/**`). Réponses et docs en français. **Créé par `npm run nouveau-jeu -- --id blocks --classement score`** (lot K4g) à partir du jeu témoin « Cibles » ; vision : `docs/blocks/seed.md` (**ne pas modifier**, c'est Nathan qui le fait) ; à coller dans une conversation d'orchestration : `docs/blocks/passation.md`.

## État de départ
- **Le jeu de départ est un squelette** (toucher des cibles en 30 secondes, classé au score décroissant) : jouable, classé, rejoué par le serveur, avec les écrans du kit. À remplacer par le vrai jeu, lot après lot. Ses textes visibles sont « à remplacer » dans `apps/blocks/src/catalogue.fr.ts` et `catalogue.en.ts`.
- **Il est `off`** (`etatDepart` de la fiche) : absent de l'accueil, « Bientôt » sur sa page ; Nathan le passe en `preview` puis `on` depuis `/admin/` › Jeux. `temoin: false` : c'est un vrai jeu, qui n'est simplement pas encore publié.
- **Teinte de l'étiquette** : à choisir par Nathan (`etiquette.fond` et `etiquette.coque` de `config/jeux/blocks.json`) ; **premier jour** : `premierJour` de la fiche, à régler au lancement ; **plafond de budget** : la ligne `blocks.jsCss` de `docs/plateforme/budgets.md` est celle du modèle, à fixer avec la mesure du jeu.

## Où est quoi
- `packages/blocks-sim` : la simulation (pure, entière), le générateur du jour (`generateur.ts`), la rediffusion, le bot de l'auteur, les médailles, les jours figés ; **`src/variante.ts` : le seul endroit qui sait si le jeu se classe au score ou au temps** (ne garder que la variante utilisée quand le jeu a pris sa forme). Golden : `npm run golden:blocks -w @cdj/blocks-sim`, **jamais sans monter la version concernée**.
- `apps/blocks` : `main.ts` (`brancherJeu`), `definition.ts` (la glue), `scene.ts` (le rendu Canvas 2D et les entrées), catalogues, `e2e/` (Playwright, ports 4179 et 8794 dans `playwright.config.ts`).
- `apps/api/src/blocks.ts` (le contrat minimal : `definirJeuNeuf`), `apps/api/scripts/blocks-essais.ts` (le module d'essais de `smoke` et `recette:seed`), `apps/api/scripts/blocks-empreintes.ts`, `apps/api/test/blocks.test.ts`.

## Règles
- Les zones, la méthode et les règles de la plateforme sont dans `docs/blocks/passation.md` (générée) et le `CLAUDE.md` racine. Un lot de ce jeu reste dans ses zones et déclare tout nouveau spec e2e dans sa fiche (`e2e.specs`) **et** dans `apps/blocks/e2e/durees.json`.
- **Rien ne s'ajoute au premier chargement** qui ne soit pas à la demande (ligne de budget `blocks.jsCss`) ; un budget ne se relève qu'avec Nathan.
- Les deux pages de mentions légales (`apps/portail/mentions-legales/index.html`, `apps/portail/legal/index.html`) ne nomment pas les clés `blocks:*` du jeu tant qu'il est `off` ; **avant de le passer en `on`, un lot de la plateforme les décrit** (règle de fidélité du lot R5).
