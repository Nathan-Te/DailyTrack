# Lot R17 — Les budgets de tous les jeux, contrôlés sur chaque PR

**Pourquoi.** Le 02/11/2026 `main` est passé au rouge : Track dépassait son budget de 144 o, venus du socle, et sa CI de PR (filtrée par zones) n'avait pas lancé `perf.spec.ts`. Désormais le dépassement se voit dans la PR qui le cause.

## Quand le job « Budgets » tourne
- **PR** : si un fichier change ce que charge un joueur — `apps/**` sauf `apps/api`, `packages/**` (catalogues compris), `config/**` (fiches, projections), `package.json` / `package-lock.json`, `tsconfig*.json`, Vite, l'outil de mesure, `docs/plateforme/budgets.md`, `ci.yml` ; **jamais** pour l'API, la documentation, les tests ni les specs (`budgetsPour`, `scripts/ci-zones.mjs`).
- **CI complètes** (`main`, nuit, « Run workflow », le bouton de production) : toujours. `main` publie ses mesures ; le verdict `test` dépend du job (dépassement = fusion bloquée, sans toucher à la protection de branche).
- Sortie de `ci-zones` pour une PR qui ne touche que `packages/ui/src/jetons.ts` : `Budgets (lot R17) : le job « Budgets » tourne — packages/ui/src/jetons.ts : code servi aux joueurs` / `budgets_actif=true` ; pour `apps/api/src/cdj.ts` : `pas de job « Budgets »` / `budgets_actif=false` (testé : `ciZones.test.ts`).

## Ce qu'il mesure
`npm ci`, `npm run build` (la construction des e2e : les plafonds de `budgets.md` sont posés dessus), puis `scripts/budgets-controle.mjs` : **chaque ligne de `budgets.md`** (portail, Track, Jump, Tower, musique) à sa mesure (`mesuresParLigne`, `scripts/budgets.mjs`), `mesure ≤ plafond`. Échec nommant chaque ligne et son excédent ; **jamais de relèvement** ; une ligne du tableau sans mesure (ou l'inverse) échoue aussi. Résumé : ligne · plafond · mesure · marge · écart avec `main`. `partage.image` (il faut Chromium) reste gardée par `domaine.spec.ts`.

## D'où vient la mesure de `main`
Le job du run de `main` publie l'artefact `budgets-<sha>` (30 jours). Une PR lit celui du commit dont elle part (`HEAD^1` du commit de fusion), sinon le plus récent (le tableau le dit) ; sans artefact, colonne « — ». Choix : recalculer `main` coûterait un `npm ci` et une construction de plus (≈ 1 min) pour le même chiffre.

## `perf.spec.ts` et ses équivalents
Plus aucun plafond en octets (testé : `budgets.test.ts`). Gardés, parce que ce n'est pas du poids : la **composition** (rien d'à-la-demande dans le premier chargement, polices et préchargement) et, pour `perf.spec.ts`, le chargement sur un téléphone simulé (navigateur). Aucun spec supprimé. Les plafonds sans ligne (fantômes, son, modes de direction, ombres, boucles : 8) sont devenus des **lignes de `budgets.md`** (même valeur). Retirés : le doublon esbuild de `musique.lecteur` (`poids.test.ts`) et les `BUDGET_*` du portail.

## Durée
Job en parallèle des tests, sans en attendre la construction (l'attendre aurait allongé la CI). Local : construction 8 s, mesure 2 s. CI : voir « Runs ».

## Vérifié / non vérifié
- Vérifié en local : `npm run verifier` vert (499 s), `securite-workflows` 0 écart ; **aucun plafond de `budgets.md` changé** (comparé ligne à ligne).
- **Constat pour Nathan** : une construction avec `VITE_PRODUCTION=1` mesure `tower.jsCss` = 40 111 o (> 40 000) ; les plafonds sont posés sur la construction des e2e (sans ce drapeau), que le job reprend. Non corrigé (hors périmètre).
- Runs de CI et run d'essai rouge : voir ci-dessous.
