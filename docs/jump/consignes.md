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

## Lot 1 — personnage
- **Simulation** (`packages/jump-sim`) : `stepPlayer(état, commande, niveau, réglages) → état`, pur, 120 Hz (`player.ts`) ; collisions boîte contre grille axe par axe, en ne parcourant que les tuiles nouvellement couvertes (`collide.ts` : `sweep`, `boxHits`, `floorDiv`) ; bac à sable écrit en ASCII (`sandbox.ts` : `SANDBOX_LEVEL`, repères `SANDBOX_MARKS`). Boîte de collision constante 3/4 × 3/4 de tuile (`PLAYER_WIDTH`, `PLAYER_HEIGHT`) ; le rendu dessine exactement cette boîte.
- **État 100 % entier** (drapeaux 0/1, côtés −1/0/1), divisions par `idiv` uniquement (`floorDiv` est bâtie dessus), jamais de `-0` (les vitesses rendues passent par `+ 0`). **`MAX_SPEED`** (2 048 unités/pas, une demi-tuile) < 1 tuile/pas, appliqué **à chaque pas** sur les deux axes quels que soient les réglages. **Toute nouvelle mécanique rejoint le fuzz d'intégrité** (`test/player.test.ts`, « intégrité (fuzz) » : commandes aléatoires du PRNG de `core`, graine fixe, réglages par défaut et au hasard ; tout reste `Number.isInteger`, sans `-0`, sous `MAX_SPEED`, hors des murs).
- **Commandes = 3 bits** (`INPUT_LEFT` 1, `INPUT_RIGHT` 2, `INPUT_JUMP` 4 = saut *tenu*) ; gauche + droite = neutre ; l'**appui** (front montant) est déduit dans la sim (`PlayerState.held`). **« Recommencer » n'est pas une commande de la sim** : c'est un événement de la session (`JumpSession.restart`, touche R, Start/Select).
- **Réglages** `JumpParams` (entiers, `DEFAULT_JUMP_PARAMS`, tableau en unités humaines dans `docs/jump/lots/lot-1-personnage.md`). **Tout changement de réglage par défaut, de physique ou du bac à sable ⇒ `JUMP_SIM_VERSION` +1** et golden régénérés **en comprenant pourquoi** : `UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden.test.ts` (le test vérifie la version, les réglages et l'empreinte du bac à sable, puis rejoue les suites au pas près). Mesures : `MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts`.
- **Une session aux réglages modifiés (`tuned`) n'est jamais enregistrée** (`JumpSession.tuned`, vrai dès qu'un pas a été joué avec d'autres réglages que les défauts ; « recommencer » aux défauts l'efface). Panneau `?debug&tune` (`tune.ts`) : un curseur par réglage, en unités humaines avec la valeur entière, « Copier les valeurs » (JSON), « Réinitialiser », mémorisé dans `jump:tune` (seulement en mode `tune`), badge « réglages modifiés ».
- **Tout nouveau paramètre d'adresse rejoint `apps/jump/src/urlOptions.ts`** (`URL_OPTIONS` : nom, description, valeurs ; `readUrlOptions` est le seul lecteur de l'adresse, un test le vérifie). La page d'admin de DailyJump lira cette liste.
- **Jeu** (`apps/jump`) : boucle à pas fixe (`loop.ts`, `FixedStepper`, au plus 30 pas par image), rendu interpolé entre `session.prev` et `session.state` ; entrées (`input.ts`) : clavier par `KeyboardEvent.code` (flèches, `KeyA`/`KeyD`, saut `Space`/`ArrowUp`/`KeyW`, R), manette (stick avec zone morte, croix, A/B saut, Start/Select recommencer), **aucun appui de saut perdu** (`JumpLatch`) ; caméra (`camera.ts`, affichage seul : avance, lissage, zone morte verticale, bornée au niveau) ; allure (`look.ts` : écrasement, étirement, regard — affichage seul).
- **`window.__jump`** (avec `?debug`) : `phase` (`ready` au chargement et après « recommencer », `playing` dès la première commande non nulle), `player` (tuiles, tuiles/s, `mode`, compteurs, `raw`), `params` (l'objet en vigueur), `tuned`, `ticks`, `manual(on)`, `advance(n)` (joue `n` pas **tout de suite, sans rendu**, renvoie `player`), `input(bits | null)`, `restart()`, `probe()`.
- **Tests de jeu en pas à pas** (`manual(true)` + `input` / `advance`), **jamais sur une durée** (`e2e/smoke.spec.ts`).
- **Zones partagées, en plus de la liste du `CLAUDE.md`** : `packages/clock` et `apps/api/Dockerfile`.

## Lot 1b — mobile
- **Toute nouvelle commande a son équivalent tactile** (et reste dans `Controls` : le tactile ne produit que les mêmes 3 bits, rien dans la simulation). Un bouton de plus = une zone ou un bouton dessiné, une entrée dans `touch.ts`, un test.
- **Les zones restent sans trou, la logique reste pure et testée** : `apps/jump/src/touch.ts` (zones `ZONE_SPANS`, `zoneAt`, `TouchPad`, `buttonRects`, aucun DOM) ; `touchUi.ts` ne fait que brancher le DOM (pointer events, boutons dessinés). Le toucher se décide par la **zone**, jamais par le bouton dessiné ; la bande haute (`BAND_PX`, recommencer, ⚙, plein écran) est exclue des zones de jeu. `?touch=1` force le tactile (la souris simule le doigt), `?touch=0` le coupe, `?zones=1` dessine zones et doigts.
- **Cibles ≥ 44 px, vérifiées en portrait et en paysage** (`e2e/mobile.spec.ts` : téléphone émulé, boutons, panneau de réglages et curseurs compris) ; un nouvel élément cliquable passe par ce test. Cadrage : `viewHeightTiles` (`camera.ts`), 18 tuiles de haut au poste, 13 sur téléphone en paysage, jamais moins de 10 tuiles de large.
- **Page** : `touch-action: none`, `overscroll-behavior: none`, corps fixe `100dvh`, `viewport-fit=cover`, marges `safe-area-inset-*` ; rien ne défile, ne se sélectionne, ne se zoome.
- **`tileOf` est le seul décalage permis dans la sim** (`v >> 12`, `collide.ts`, testé contre `Math.floor(v / 4096)` négatifs compris, jamais `-0`) ; **toute autre division passe par `idiv`**. Les golden et `JUMP_SIM_VERSION` n'ont pas bougé : c'est la preuve d'un calcul identique.
- **Tests de navigateur tactiles** : doigts posés par `Input.dispatchTouchEvent` (Chromium) ou par pointer events sur la couche `#touch` (Firefox, WebKit), toujours en pas à pas.

## Lot 2 — dangers et mort
- **Chaque élément de niveau a son caractère documenté** (légende et format du bloc annexe en tête de `packages/jump-sim/src/level.ts`), **sa boîte « juste »** (plus petite que le visuel quand c'est mortel : pics = moitié côté base, retrait de ¼ sur les flancs, dans le triangle ; scies = disque plein, les dents dessinées le dépassent), **ses tests** (`test/dangers.test.ts`) et **sa place dans `?scenario=dangers`** (galerie `DANGERS_LEVEL`, `levels.ts`). Un nouvel élément rejoint aussi le fuzz d'intégrité de l'essai.
- **Les éléments mobiles démarrent à l'entrée de leur section** (`section <nom> <col0>-<col1>` dans le bloc annexe ; un élément appartient à la section de son premier point ; avant, il attend à son départ et tue quand même). Position = fonction **entière et pure** des pas écoulés (`sawCenter`, `idiv`), exactement au départ à chaque cycle. La rotation des scies est un effet d'affichage.
- **Tout l'état du niveau est entier** (`AttemptState`, `attempt.ts` : scies par sections, blocs friables, ressort, chrono) **et revient à zéro à la mort** (égalité profonde avec `initialAttempt`, testée). `stepPlayer` (lot 1) ne connaît que la grille ; `stepAttempt` l'enveloppe.
- **Le monde attend la première commande** (une direction, ou un saut appuyé) : rien ne bouge, le chrono reste à 0.
- **Le temps est en pas** (`AttemptState.time`, du premier pas commandé au contact de `F` compris) ; l'affichage en secondes à 3 décimales (`formatTicks`) n'est que de l'affichage.
- **L'arrivée l'emporte sur la mort au même pas** (vérifiée d'abord, testée).
- **Pas de saut automatique à la réapparition** : un saut tenu depuis l'essai précédent ne compte qu'après avoir été relâché ; une direction tenue compte tout de suite. Réapparition `RESPAWN_TICKS` (18 pas = 0,15 s ; jamais plus de 24) après la mort, commandes ignorées entre-temps.
- **Recommencer n'est pas une mort** : c'est un événement de la session (`JumpSession.restart`), qui repart de `initialAttempt`.
- **Les distances au carré restent sous `Number.MAX_SAFE_INTEGER`** : bornes `MAX_LEVEL_WIDTH` / `MAX_LEVEL_HEIGHT` / `MAX_SAW_*` refusées par `parseLevel`, test « bornes » sur la plus grande carte possible. Toute nouvelle grandeur multipliée rejoint ce test.
- Bas de la grille **ouvert** (on en meurt), les trois autres bords restent pleins (`tileAt`).
- **Preuve de faisabilité** : `test/fixtures/essai-solution.json` (et `dangers-solution.json`), rejouées par `essai-solution.test.ts` et le golden ; trouvées par le chercheur hors simulation `test/solver.ts` (`SOLVE=1 npx vitest run packages/jump-sim/test/essai-solution.test.ts`). **Modifier le niveau d'essai ou la physique ⇒ `JUMP_SIM_VERSION` +1, `SOLVE=1`, puis `UPDATE_GOLDEN=1`.**
- **Jeu** : `?scenario=essai` (page par défaut) · `dangers` · `bac-a-sable` ; `?debug&hitbox` (boîtes justes et sections) ; `?fx=off` (ni éclats ni tremblement : `fx.ts`, pool recyclé, jamais d'objet créé en jeu). `__jump.attempt` (statut, chrono, morts, meilleur, dernière mort, scies, friables, sections), `__jump.fx`, `__jump.banner`. HUD (`hud.ts`) : chrono, meilleur temps, morts, sous la bande haute sur téléphone ; bandeau d'arrivée au-dessus de la couche tactile, bouton ≥ 44 px. Meilleur temps et morts : **session seulement** (lot 3 pour l'enregistrement) ; un essai aux réglages modifiés ne devient jamais le meilleur.
- Mesures : `MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts --silent=false`. Outils tactiles des e2e communs : `apps/jump/e2e/phone.ts`.
