# Plateforme — consignes

Règles communes aux jeux du portail (DailyTrack, DailyJump, et les suivants) pour tout ce qui touche le serveur, son déploiement et le stockage des jeux. Vision : `docs/plateforme/seed-phase-2.md` (**ne pas modifier**, c'est Nathan qui le fait). Créé par le lot R1 (recette) ; le lot P0 complète ce fichier. Réponses et docs en français.

## Emplacements
- `docs/plateforme/seed-phase-2.md` — vision et plan en lots de la phase 2.
- `docs/plateforme/recette.md` — guide pas à pas de l'environnement de recette (pour Nathan, à faire une fois).
- `docs/plateforme/lots/` — un README d'une page par lot de la plateforme (`lot-R1-recette.md`…).
- `.github/workflows/` : `production.yml` (fusion dans main → recette → validation → production), `recette.yml` (une révision de recette par PR), `deploy-api.yml` (déploiement réutilisable, production ou recette), `pages.yml` (aperçus de branche ; main seulement par `production.yml`).
- `scripts/recette.mjs` — étiquette de révision, dossier d'aperçu, adresse de révision, liste des chemins du serveur (`SERVER_PATHS`) : partagés par les workflows, testés dans `apps/api/test/recette.test.ts`.

## Recette (lot R1)
- **Rien ne part en production sans passer par la recette.** Une PR qui touche le serveur (`SERVER_PATHS` : `apps/api`, `packages/sim`, `core`, `clock`, `jump-sim`, le module de profil, `apps/jump/public/levels`, le verrou npm…) déploie sa révision sur le serveur de recette (`recette.yml`) ; une fusion dans main met d'abord à jour la recette par défaut, puis seulement la production (`production.yml`).
- **Un lot qui touche le serveur donne dans son README** l'adresse de sa révision de recette (commentaire « Recette » de la PR : `https://b-<branche>-<empreinte>---<service de recette>`) et **le scénario à jouer sur l'aperçu** de sa branche (`https://nathan-te.github.io/DailyTrack/b/<branche>/`, en deux clics), avec ce qu'on doit y voir.
- **La production attend la validation de Nathan** : l'API et le site publié depuis main partent ensemble, après un clic sur « Review deployments » (environnement GitHub `production`). Un agent ne valide jamais, ne relance jamais un workflow (403), ne crée ni ressource ni secret : il prépare le dépôt et le guide.
- **Les aperçus n'écrivent jamais dans le stockage ni dans la base de production.**
  - Base : un aperçu est construit avec l'adresse de la recette (sa révision étiquetée, sinon la recette par défaut), **jamais** `VITE_API_URL` de la production (`pages.yml` refuse de publier sinon).
  - Stockage local : chaque jeu a **un seul point d'accès** (`apps/web/src/storage.ts`, `apps/jump/src/storage.ts` : `gameStorage()`), préfixé à la construction (`VITE_STORAGE`) : `cdj:*` / `jump:*` en production, `apercu:cdj:*` / `apercu:jump:*` dans un aperçu et sur le serveur de développement. **Aucun autre fichier ne touche `localStorage` ni `sessionStorage`** (tests `storage.test.ts` des deux jeux) ; un nouveau jeu fait de même.
- **Règle des noms de base** : la base de recette a « recette » dans son nom, la base de production jamais. `apps/api/src/config.ts` refuse de démarrer sinon (`ENVIRONMENT=recette` sur une base sans « recette », production sur une base « recette ») ; les workflows le vérifient aussi avant de construire.
- **`ENVIRONMENT`** = `production` | `recette` | `local` (absente : `production` si `NODE_ENV=production`, sinon `local`). La recette permet ce que la production refuse toujours : `TEST_CLOCK_OFFSET_MS` (tester minuit) et `SALON_MINUTES` (Salon court), par « Run workflow » de `recette.yml` sur une branche. Toutes les autres règles d'un serveur en ligne s'y appliquent (origines, sel, Turso).
- **`npm run recette:seed` refuse la production** : il ne tourne qu'avec `ENVIRONMENT=recette` et une base dont le nom contient « recette » (`recetteSeedTarget`), et ses joueurs fictifs passent par le vrai `createApi` (rejeu serveur).
- **Jamais de recette pour une PR venue d'un fork** : les secrets ne sortent pas du dépôt.
- **Sans configuration, tout est sauté avec un message** (« recette non configurée : voir docs/plateforme/recette.md ») et la CI reste verte ; un nouveau workflow qui dépend de la recette fait de même.
- **Un nouveau chemin du serveur** (module, données lues par l'API) s'ajoute à `SERVER_PATHS` **et** à `on.pull_request.paths` de `recette.yml` (le test vérifie qu'elles sont identiques) ; il s'ajoute aussi au `Dockerfile` s'il entre dans l'image.
