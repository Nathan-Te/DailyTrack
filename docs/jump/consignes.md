# DailyJump — consignes

Jeu de plateformes quotidien à la Super Meat Boy, deuxième jeu du dépôt. Vision et plan de lots : `docs/jump/seed-dailyjump.md` (**ne pas modifier**, c'est Nathan qui le fait). Réponses et docs en français. Chaque lot de DailyJump ajoute **sa section ici**, jamais dans le `CLAUDE.md` racine.

## Emplacements
- `docs/jump/seed-dailyjump.md` — vision, piliers, plan en lots (le prompt de lot 0 le nomme `seed.md` : le fichier déposé s'appelle `seed-dailyjump.md`).
- `docs/jump/lots/` — un README d'une page par lot (`lot-0-socle.md`…).
- `packages/jump-sim` (`@cdj/jump-sim`) — simulation pure du saut.
- `apps/jump` (`@cdj/jump`) — le jeu (Vite + Three.js, caméra orthographique) ; affiche ce que calcule `jump-sim`.
- `packages/core` (`@cdj/core`) — socle partagé avec DailyTrack : PRNG (`Rng`, `mixSeed`), calendrier (`daysFromCivil`, `civilFromDays`, `formatDay`, `parseDay`), codage d'octets (`toBase64Url`, `fromBase64Url`, `pushVarint`, `readVarint`), et le test de pureté générique (`@cdj/core/testing`). Le jour de Paris (changement de jour) est dans `packages/clock` (`parisDay`), qui lit l'heure et n'est donc pas pur : jamais importé par une simulation.

## Règle du socle (`core`)
- `core` ne contient **aucune logique de jeu**. Tout ce qui y entre doit laisser **inchangés les golden des deux jeux**.
- On n'y déplace un module que lorsque le **deuxième** jeu en a besoin. `PREMIER_JOUR` reste propre à chaque jeu. Le format d'une rediffusion (champs d'une série, bornes, version) reste propre à chaque jeu ; seul le codage d'octets est commun. `math.ts` n'est pas dans `core` (le saut n'a pas besoin de trigonométrie).

## Règles de `jump-sim`
- **État entièrement en entiers** : 1 tuile = 4 096 unités (`UNITS_PER_TILE` : 16 px × 256 sous-pixels), vitesses en unités par tick, minuteries en ticks. Pas fixe à 120 Hz (`TICK_RATE`), jamais de `dt` variable.
- **`idiv(a, b)` pour toute division** : tronque vers zéro, ne renvoie jamais `-0`. Jamais de `/` sur l'état, jamais de `Math.floor` d'un quotient pour couper.
- **Mêmes interdits que `sim`** (pas de `Math.random`, `Date`, `performance`, `**`, fonctions transcendantes, imports extérieurs ; seul `@cdj/core` est permis), vérifiés par `test/purete.test.ts` qui utilise la liste commune de `@cdj/core/testing`.
- **`JUMP_SIM_VERSION`** +1 dès que la physique, un élément de niveau ou un niveau d'essai change le résultat d'un essai ; **`JUMP_GENERATOR_VERSION`** +1 dès que le niveau d'une date change. Puis régénérer les références (golden), comme pour DailyTrack. Valent 1 au lot 0.
- Un niveau est une grille ASCII (`parseLevel`, `level.ts`) : `#` bloc, `.` vide, `S` départ, `F` arrivée (les autres éléments entrent avec leurs lots).

## Conventions de `apps/jump`
- **`?debug`** expose `window.__jump` (même esprit que `__cdj` de DailyTrack) : `phase` (`loading` → `ready`, ou `no-webgl`), `day`, `simVersion`, `palette`, `probe()` (relit les pixels). Sans `?debug`, rien n'est exposé.
- **Stockage local préfixé `jump:`** (`storageKey()`, `storage.ts`) ; DailyTrack garde `cdj:`. Toujours sous `try/catch`.
- **Publication sous `/jump/`** du même site GitHub Pages : `pages.yml` construit `apps/web` à la racine et `apps/jump` dans `jump/` (aperçu de branche : `…/b/<branche>/jump/`). Chemins **relatifs** (`base: "./"`) pour que les aperçus de branche marchent.
- **Tout nouveau paramètre d'adresse rejoint la page d'admin** (à créer côté `apps/jump` avec le premier paramètre qui le demande). Le lot 0 n'en a pas d'autre que `?debug`.
- Rendu, son, effets : lecture seule de la simulation ; jamais l'inverse. Texte en français.

## Commandes
- `npm run dev:jump` — serveur de développement de `apps/jump`.
- `npm run build` — construit DailyTrack **et** DailyJump (`npm run build -w @cdj/jump` pour DailyJump seul).
- `npx vitest run packages/core packages/jump-sim apps/jump` — tests de DailyJump et du socle ; `npm test` lance tout (deux projets, `sqlite` puis `libsql`).
- `npm run typecheck` — `tsc -b` sur tous les espaces de travail.
- `npm run e2e:jump` — construit puis lance le test de fumée Playwright de `/jump/?debug` (`E2E_ALL_BROWSERS=1` pour Firefox et WebKit, `CHROMIUM_PATH` pour un Chromium déjà installé). En CI : une fois par navigateur, dans la part 1 de la matrice `e2e-parts`.
