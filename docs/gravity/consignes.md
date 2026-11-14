# Gravity — consignes

Chargé par lecture des fichiers du jeu (zone `docs/gravity/**`). Réponses et docs en français. **Créé par `npm run nouveau-jeu -- --id gravity --classement score`** (lot K4g) à partir du jeu témoin « Cibles » ; vision : `docs/gravity/seed.md` (**ne pas modifier**, c'est Nathan qui le fait) ; à coller dans une conversation d'orchestration : `docs/gravity/passation.md`.

## État (lot GR1 : le cœur jouable)
- **Le squelette « Cibles » est remplacé** par le vrai jeu : un coureur sans fin en une touche (simulation entière à 120 pas/s, générateur infini des cinq thèmes de Jump, rediffusion = les pas des appuis, rejeu par le serveur, classement au score ↓ puis durée ↑). Le vocabulaire « cibles / touches » a disparu du code. Règles : `packages/gravity-sim/CLAUDE.md` et `apps/gravity/CLAUDE.md` ; compte rendu et défauts connus : `docs/gravity/lots/lot-GR1-coeur-jouable.md`.
- **Il est `off`** (`etatDepart` de la fiche) : absent de l'accueil, « Bientôt » sur sa page ; Nathan le passe en `preview` puis `on` depuis `/admin/` › Jeux. `temoin: false`.
- **Provisoire** : le rendu (`scene.ts`, avant `@cdj/visuels` au GR3), les seuils des médailles (« sur le papier », avant le robot du GR2), les textes (courts, complets au GR4), l'identité de la fiche (`identite` « à choisir », au GR5) et la teinte de l'étiquette (à choisir par Nathan).

## Où est quoi
- `packages/gravity-sim` : la simulation (pure, entière : `partie.ts`), le monde et ses cases (`monde.ts`), le générateur du jour et le chemin sûr (`generateur.ts`), la rediffusion, les seuils et les jours figés, le pilote d'essai (`pilote.ts`) ; **`src/variante.ts` : le seul endroit qui sait comment le jeu se classe**. Golden : `npm run golden:gravity -w @cdj/gravity-sim`, **jamais sans monter la version concernée**.
- `apps/gravity` : `main.ts` (`brancherJeu`), `definition.ts` (la glue), `scene.ts` (le rendu Canvas 2D provisoire et les entrées), `niveau.ts` (le niveau, à la demande), catalogues, `e2e/` (Playwright, ports 4188 et 8798 dans `playwright.config.ts`).
- `apps/api/src/gravity.ts` (le contrat minimal : `definirJeuNeuf`, le rejeu des appuis), `apps/api/scripts/gravity-essais.ts` (le module d'essais de `smoke` et `recette:seed`), `apps/api/scripts/gravity-empreintes.ts`, `apps/api/test/gravity.test.ts`.

## Règles
- Les zones, la méthode et les règles de la plateforme sont dans `docs/gravity/passation.md` (générée) et le `CLAUDE.md` racine. Un lot de ce jeu reste dans ses zones et déclare tout nouveau spec e2e dans sa fiche (`e2e.specs`) **et** dans `apps/gravity/e2e/durees.json`.
- **Rien ne s'ajoute au premier chargement** qui ne soit pas à la demande (ligne de budget `gravity.jsCss`) ; un budget ne se relève qu'avec Nathan.
- **Mentions légales (règle de fidélité du lot R5)** : le jeu écrit dans le navigateur quatre clés, `gravity:records`, `gravity:reglages`, `gravity:aide:vu` et `gravity:identite:vue` (plus `cdj:apercu:gravity` et `cdj:commandes:gravity`). Les deux pages (`apps/portail/mentions-legales/index.html`, `apps/portail/legal/index.html`) doivent les décrire : **le test `apps/portail/test/mentions.test.ts` échoue tant qu'elles ne le font pas** dès que le jeu a dépassé son squelette (son catalogue n'a plus de texte « À remplacer ») et n'est pas un témoin. C'est un lot de la plateforme (zone partagée) : le proposer dans le README du premier lot du jeu, ne pas attendre le dernier.
