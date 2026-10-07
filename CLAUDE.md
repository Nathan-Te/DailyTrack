# Circuit du Jour

Jeu web quotidien : un circuit court par jour, identique pour tous, classement validé par rediffusion. Source de vérité : `docs/seed.md` (ne pas modifier, c'est Nathan qui le fait). Réponses et docs en français.

## Structure
- `packages/sim` — simulation pure (physique, blocs, chrono, générateur, bot). **Aucune dépendance** au DOM, à Three.js ou à Node.
- `apps/web` — le jeu (Vite + Three.js) ; affiche ce que calcule `sim`.
- `apps/api` — classement (lot 5) ; importe le même `sim` pour rejouer les courses.
- `docs/lots/` — un README d'une page par lot.
- `docs/orchestration.md` — synthèse des lots, règles à ne pas casser, méthode et suite (pour l'agent orchestrateur).

## Commandes
- `npm install` · `npm run dev` · `npm test` (Vitest) · `npm run typecheck` · `npm run build`

## Circuits (lot 2)
- Un circuit = un texte de blocs (`parseTrack`, voir `packages/sim/src/track.ts`) : cellules de 32 m, repère canonique (p = gauche, q = avance) tourné par quarts de tour ; hauteurs enchaînées automatiquement.
- `trackWorld(track)` donne `sample` (hauteur/pente/plaque) et `collide` (rebords) à `stepCar` ; `createRace`/`stepRace` ajoutent portes, chrono et reprises. Les commandes enregistrables sont `{ steer, throttle, brake, respawn }`.
- Tests navigateur : `?debug` expose `window.__cdj`.

## Rediffusions (lot 3)
- Une rediffusion = `Replay` (séries de commandes) ; `encodeReplay`/`decodeReplay` ↔ texte base64url ; `replayRace` rejoue et renvoie le résultat recalculé. **Ne jamais faire confiance à un temps annoncé.**
- **`SIM_VERSION`** (constants.ts) : à incrémenter dès que la physique, un bloc ou un circuit change le résultat d'une course ; puis régénérer la rediffusion de référence : `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`.
- `apps/web/src/session.ts` : `RunSession` avance course + enregistrement + fantôme ; `verify.html` : rejeu sans rendu pour les tests de navigateur (`npm run test:e2e`, Playwright ; `CHROMIUM_PATH` pour un Chromium déjà installé, `E2E_ALL_BROWSERS=1` pour Firefox et WebKit).

## Circuit du jour (lot 4)
- `dailyCircuit(jour)` (`generator.ts`) : graine = jour UTC (`parseDay`/`formatDay`, calendrier sans `Date`) ; `composeSpec` construit le texte, `bestPilotRun` (`autopilot.ts`) valide et donne le temps de l'auteur, d'où `medalsFor`. Id du circuit : `jour-AAAA-MM-JJ-g<GENERATOR_VERSION>`.
- **`GENERATOR_VERSION`** (constants.ts) : à incrémenter dès que le circuit d'une date change (règles, pilote, fenêtre de durée) ; puis régénérer `fixtures/daily-golden.json` (`UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`).
- Web : `?seed=AAAA-MM-JJ` (ou `?day=`), `?theme=<nom>`, `?api=demo`, `?scenario=essai|pilotage|surfaces|plat`, `?debug&tune` (réglages), touche **C** (caméra). Palettes dans `apps/web/src/trackMesh.ts` (`PALETTE_DEFS`).

## Classement (lot 5)
- `apps/api` : `createApi({ db, now })` (`src/api.ts`) ne dépend que de `Request`/`Response` et de `SqlDb` ; adaptateurs : Node + SQLite (`server.ts`, Docker) et Cloudflare Workers + D1 (`worker.ts`). **Le serveur ne fait jamais confiance à un temps annoncé** : il rejoue la rediffusion (`replayRace`) et enregistre son propre résultat.
- Le client est dans `apps/web/src/{api,identity,online}.ts` ; adresse de l'API : `?api=` ou `VITE_API_URL`. Sans elle, aucun classement.
- Tests : `apps/api/test` (SQLite en mémoire, horloge injectée) ; e2e `leaderboard.spec.ts` (Playwright lance le vrai serveur : `npm run test:e2e` construit aussi `apps/api`). Outils `?debug` : `timescale=N`, `__cdj.autoplay(code)`.
- Le Worker ne tient pas dans les 10 ms de calcul de l'offre gratuite de Cloudflare (voir docs/lots/lot-5-classement.md).

## Arrivée, partage, archives, mobile (lot 6)
- `apps/web/src/share.ts` (`shareLine`, ligne façon Wordle), `clipboard.ts`, `archive.ts` (liste des jours, liens `?seed=`), `records.ts` (`listDayBests`, médaille gardée avec le record). Touches : **H** archives, **L** classement, **G** fantôme (A est pris : il tourne à gauche).
- Mise en page : un seul `index.html` avec media queries (`max-width: 900px` / `max-height: 520px`). Test `e2e/mobile.spec.ts` : aucun chevauchement sur 3 formats de téléphone. Poids : budget dans `e2e/perf.spec.ts` ; Three.js reste dans son propre chunk (`vite.config.ts`).
- Outil de test : `?debug&today=AAAA-MM-JJ`.

## Conduite (lot 7)
- `packages/sim/src/car.ts` : modèle **bicyclette** (deux essieux, force latérale saturée par `tireCurve`) + **4 ressorts** posés sur `world` (hauteur, tangage, roulis en pentes ; charge → adhérence ; butée) + **balistique** en l'air (réception à plat / de travers). 2 sous-pas fixes par pas. Rebords : deux disques, impulsion avec rebond et frottement. Dérapage au frein (`car.drift`). Détail et mesures : `docs/lots/lot-7-conduite.md`.
- **`CarParams`** (`DEFAULT_CAR_PARAMS`) passé à `stepCar(car, input, world, params)` et `createRace(track, params)` ; le serveur et les rediffusions utilisent toujours les défauts. **`SurfaceParams`** `{ grip, traction, rolling }` lu sous chaque roue par `surfaceAt(échantillon)` (`world.ts`, table `SURFACES`, « route » seulement).
- Reprise = état de la voiture au passage du dernier point de contrôle (`race.checkpoints`). Virage large `L2`/`R2` (2 × 2 cellules, `blockCells`).
- Pilote (`autopilot.ts`) : trajectoire lissée (`racingLine`), vitesses par courbure, freinage anticipé ; `PILOT_GRIPS`.
- Web : panneau `?debug&tune` (`apps/web/src/tune.ts`) — une course avec réglages modifiés n'est **jamais** enregistrée ni classée ; caméras proche/loin (touche **C**, bouton Vue de la manette) ; `?scenario=pilotage`.
- **Réglages par défaut = ceux de Nathan (retouche 7b, `docs/lots/lot-7b-reglages.md`)** : pointe 48 m/s, grip 44 / 47, seuil de glisse 0,14, dérapage doux (angle 0,32, serrage 33), gravité 24,6, rebords durs (rebond 0,6, frottement 0,3). `SIM_VERSION` et `GENERATOR_VERSION` valaient 3 au 7b ; le lot 8 les passe à **4**.
- Générateur : **deux lignes droites derrière chaque plaque** (`PAD_RUNOUT`, generator.ts) — à 48 m/s, une plaque suivie d'un virage serré ne se prend pas (frein 40 contre poussée 30 pendant 0,9 s). Le circuit d'essai suit la même règle. Pilote : marge aux rebords de 3,6 m (`WALL_MARGIN`).
- Tests de comportement chiffrés : `packages/sim/test/conduite.test.ts` (seuils recopiés dans le README du lot, mis à jour au 7b).

## Commandes tactiles (lot 10)
- `apps/web/src/touch.ts` (logique pure, testée : `TouchPad` = doigts → axes, `dragSteer`, `zoneAt`, réglages `cdj:touch`, seuil de choc) ; `touchUi.ts` (DOM : zones, aides, boutons, réglages, invitation portrait, plein écran) ; `input.ts` (`Controls` fusionne clavier, manette et doigts). Mode actif si `pointer: coarse`, ou `?touch=1` (la souris simule le doigt) ; `?touch=0` le coupe.
- Disposition paysage : moitié gauche = direction (glissement relatif au point de pose, ou boutons ← →), moitié droite = frein ; accélérateur **automatique** par défaut (ou bouton gaz) ; boutons pause / reprise / départ / réglages / plein écran ; **P** = pause (aussi au clavier).
- **Règle : le tactile produit les mêmes commandes entières que les autres entrées** (axes flottants → `makeInput`) ; rien dans `sim`, rediffusions identiques. Vibration (point de contrôle, choc) = présentation seule, lecture de la vitesse sans effet sur la simulation.
- Tests : `apps/web/test/touch.test.ts` ; e2e `tactile.spec.ts` (vrais événements tactiles via `Input.dispatchTouchEvent`, gabarits Android et iPhone) ; outils `?debug` : `spec=<blocs>`, `__cdj.input`, `__cdj.manual(true)` + `__cdj.advance(n)` (pas à pas, sans rendu). Aides de mise en page : `e2e/layout.ts`.

## Surfaces et blocs à effet (lot 8)
- **Revêtement = attribut d'un bloc** (`Block.surface`, notation `S/t` terre, `S/g` glace, `S/h` herbe ; `/b` = virage relevé : `L2/b`, `R/tb`) ; `parseToken` (`track.ts`) lit la notation. `SURFACES` (`world.ts`) : `{ grip, traction, rolling }` — route `1/1/0`, terre `0,7/0,85/1,5`, herbe `0,5/0,55/7`, glace `0,3/0,4/0,3` ; `surfaceAt(échantillon)` les lit sous chaque roue (adhérence latérale ← grip ; motricité et freinage ← traction ; roulement en m/s²). **Où en ajouter un** : `SurfaceKind` + `SURFACE_LETTERS` (track.ts), une ligne de `SURFACES`, ses couleurs dans `trackMesh.ts` (`SURFACE_COLORS`, `SURFACE_MARKS`), `SURFACE_HUD` (main.ts). **Nouvelle surface ou nouveau bloc = `SIM_VERSION` +1** (et `GENERATOR_VERSION` si le pilote ou le générateur s'en sert).
- **Blocs à effet** : `P` plaque, `T` super turbo (`turboTicks` 180, `turboAccel` 42, `turboMaxSpeed` 68 : trois clés de `CarParams`), `C` moteur coupé (`car.cut` : l'accélérateur n'agit plus ; `stepRace` le rend au pas exact qui franchit le point de contrôle suivant). Les états `boost`, `turbo`, `cut` vivent dans `CarState` (donc rejoués à l'identique) ; après l'arrivée les effets sont coupés (`withoutEffects`).
- **Virages relevés** : `bankAt` (track.ts) donne hauteur et gradient du relevé (pente 0,3 serré / 0,22 large, rampe de 8 m) ; `world.sample` les ajoute à la hauteur et au gradient ; `collide` compare au sol réel ; la voiture reçoit la pente latérale (`ay -= gravity × pente`). Rendu : `trackMesh.ts` (`arcPoint` suit le relevé).
- **Pilote** : `racingLine` module vitesse de passage (grip × revêtement + g × pente) et freinage (traction × revêtement + roulement) ; il reste à 1,5 m de l'axe en virage relevé. Générateur : `PAD_RUNOUT` (2 droites derrière une plaque) et `TURBO_RUNOUT` (5 derrière un super turbo).
- Tests : `packages/sim/test/surfaces.test.ts` (seuils recopiés dans `docs/lots/lot-8-surfaces-themes.md`), `e2e/surfaces.spec.ts`. Outils : `?scenario=surfaces`, `?theme=<stade|rallye|banquise|nuit|campagne>`.

## Thèmes (lot 8)
- `themes.ts` : `THEMES` (stade, rallye, banquise, nuit, campagne). **Choix** : `themeForDay(jour)` = `THEME_NAMES[Rng(mixSeed(jour, 0x70a1)).int(5)]` — graine = jour UTC, identique pour tous ; la palette en découle (`paletteForDay`). **Un thème règle** : palette, zones de revêtement (nombre et poids), chance de virage relevé, chance de super turbo, moteur coupé (suivi d'un point de contrôle deux blocs plus loin), passage signature (`signatureParts`, generator.ts). `dailyCircuit(jour, thèmeForcé?)` : un thème forcé donne un autre circuit (id `jour-AAAA-MM-JJ-g<N>-<nom>`), marqué `forcedTheme`, **jamais classé**.
- **Ajouter un thème** : un nom dans `THEME_NAMES`, une entrée de `THEMES` (et une palette `PALETTES` + `PALETTE_DEFS` dans trackMesh.ts + `PALETTE_LABELS` si nouvelle), éventuellement une signature. **Changer un thème (ou en ajouter un) = `GENERATOR_VERSION` +1**, puis régénérer `fixtures/daily-golden.json`.

## Rendu, effets et sons (lot 9)
- **Règle : le rendu ne modifie jamais un résultat de sim ; la télémétrie est en lecture seule.** Tout est dans `apps/web` ; `packages/sim` n'a pas bougé (golden inchangés). Les effets lisent l'état de la voiture et appellent seulement `world.sample` / `world.collide` (purs).
- Fichiers : `carMesh.ts` (voiture low-poly originale, 4 roues séparées : rotation, braquage, débattement borné `clampTravel`, feux stop, fantôme translucide), `telemetry.ts` (`readTelemetry` : vitesse, dérive, sols et revêtements sous les 4 roues, contact de rebord), `fx.ts` (`Effects` : particules `Points` en deux pools recyclés, ruban de traces en tampon circulaire, fumée / terre / glace / herbe, étincelles, flammes, réception, éclair, confettis ; `QualityGovernor`), `audioLogic.ts` (pur, testé : rapports du moteur, crissement, vent, voix des revêtements, volume / muet) et `audio.ts` (`GameAudio`, Web Audio). Intégration dans `main.ts` (`frame`, `stepOnce`).
- **Sons procéduraux** (oscillateurs + bruit filtré, aucun fichier ; crédits dans `docs/credits.md`). Le contexte audio démarre au **premier geste** ; **M** = muet / dernier volume, bouton Son du menu = 4 crans, réglage mémorisé (`cdj:audio`).
- **Budget de performance** : coût du fil principal mesuré avant / après (profil mobile, CPU ×4) dans `docs/lots/lot-9-juice.md` (≈ +1 ms/image, 12 ms à ×4) ; poids ajouté ≈ 8 ko gzip (budget 300 ko) ; `e2e/perf.spec.ts`. **Qualité automatique** : `QualityGovernor` baisse particules et traces si l'intervalle moyen dépasse 26 ms, remonte sous 19 ms ; ne touche jamais à la simulation.
- Outils : `?demo` (le pilote boucle, rien n'est enregistré), `?fx=off`, `?quality=0|1|2` (fige), `?shake=0` ; touche **M** ; `?debug` expose `__cdj.fx` (particules émises, qualité) et `__cdj.audio` (sons joués, réglages). Tests : `apps/web/test/juice.test.ts`, `e2e/juice.spec.ts`.
- **Retouche 9b** (`docs/lots/lot-9b-visuels.md`) : traces de pneus par roue (`Skids`, couleur selon le revêtement, estompées), voiture par sections lissées + ombre douce (`createShadow` / `placeShadow`), ciel dégradé, soleil / lune, étoiles, montagnes et décor de bord de piste dans `trackMesh.ts` (`buildSky`, `buildMountains`, `addScenery`, `addGrandstand`, graine = id du circuit, champs `zenith` / `disc` / `mountain` / `scenery` de `Palette`). **Piège : `Float32BufferAttribute` copie son tableau** — pour écrire dans un tampon dynamique, utiliser `BufferAttribute`.
- **Page `/admin`** (`apps/web/admin/index.html`, `src/admin.ts`, logique pure `src/adminLogic.ts`, test `test/admin.test.ts`, `e2e/admin.spec.ts`) : menu des outils de test — scénario, date, thème forcé, circuit au hasard, panneau de réglages, démo, effets, qualité, tactile, temps accéléré, adresse de l'API, effacement des données locales (`cdj:*`), raccourcis. Elle ne fait que **construire l'adresse du jeu** (paramètres que `main.ts` connaît) ; choix mémorisés dans `cdj:admin`. Troisième entrée de `vite.config.ts` ; adresse publique `<base>/admin/`. **Tout nouveau paramètre d'adresse du jeu = une option dans `adminLogic.ts`.** Touches **N** (circuit au hasard) et **T** (thème suivant) dans le jeu.
- Traces de pneus : roues **arrière** seulement.
- Pour aller plus loin : tout nouvel effet doit tenir dans ses pools (jamais d'objet créé par image) et se couper avec `?fx=off`.

## Historique et mode démo (lot 11)
- **`PREMIER_JOUR`** (`packages/sim/src/calendar.ts`, ex-`LAUNCH_DAY`) : le circuit n° 1, **provisoirement le 2026-09-22** (deux semaines d'archives avant la mise en ligne) ; **à fixer à la vraie date de lancement**. Il ne change que la numérotation (`circuitNumber`), jamais un circuit : les golden gardent texte et temps, seul leur champ `number` suit (`UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`). Les tests du générateur et de l'API sont ancrés sur des dates fixes (06/10 et 13/10/2026).
- **`npm run history:seed`** (`apps/api/src/history.ts` + `scripts/history-seed.ts`) : 14 jours depuis `PREMIER_JOUR`, 8 à 15 pilotes `Démo …` par jour, conduits par le pilote automatique à des niveaux variés ; leurs courses passent par **`createApi(...).handle`** (rejeu serveur, aucun contournement) dans une base **en mémoire** ; joueurs marqués `players.demo = 1` (option `demoPlayers`, **jamais réglée par le serveur de production**) ; refus avec `DB_PATH`, `NODE_ENV=production` ou une base contenant de vrais joueurs (`assertDemoOnly`). Écrit `apps/web/public/demo/` (`index.json` + un fichier par jour : classement figé + fantôme du premier) ; déterministe, ≈ 10 s. **À relancer après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** (le test `apps/web/test/demo.test.ts` le rappelle : « relancer history:seed »).
- **`?api=demo`** (`apps/web/src/demo.ts`, `DemoApi` : même interface `LeaderboardSource` que l'API réelle) : lecture seule des données statiques, rien n'est envoyé ; « aujourd'hui » figé à `DEMO_TODAY` (le lendemain de l'historique) donc aucun jour classable ; seul le fantôme du premier existe (pas « devant toi »). **`?day=AAAA-MM-JJ`** = `?seed=` ; ouvrir un jour passé avec classement (API ou démo) charge le fantôme du premier et affiche le classement figé. Archives : seuils de médailles, nombre de pilotes et ta place figée (`archiveExtras.ts`). Tests : `demo.test.ts`, `apps/api/test/history.test.ts`, `e2e/demo.spec.ts`.
- **Règle : les joueurs `demo` n'existent jamais en production** ; les données de démo sont un fichier statique du jeu, pas des lignes d'une base réelle.

## Règles de la simulation (déterminisme)
- Pas fixe (`TICK_RATE` = 120 Hz), jamais de `dt` variable ; interpolation à l'affichage seulement.
- Pas de moteur physique externe. Pas de `Math.sin/cos/exp/pow/tanh/atan2/…` dans `sim` : implémentations maison ou tables (`sin`/`cos` de `math.ts` ; saturation rationnelle `tireCurve` = t / ⁴√(1 + t⁴) ; angles de glissement, tangage et roulis gardés en **pentes** (rapports), jamais convertis en angles ; amortissements en `x * (1 − k·dt)`).
- Modifier une valeur par défaut de `CarParams` (ou la géométrie de `car.ts`) = incrémenter `SIM_VERSION` + régénérer les références (et `GENERATOR_VERSION` si le temps du pilote change, ce qui est presque toujours le cas).
- Commandes de la voiture = entiers (`makeInput`) ; l'état de référence de `car.test.ts` ne change que si la physique change volontairement.
- Pas de `Math.random` ni `Date` dans `sim` : PRNG à graine explicite.
- Une course = la suite des commandes du joueur ; le même code la rejoue côté serveur.

## Méthode
- Un lot = une session = une branche = une PR. L'agent s'arrête quand les critères du lot sont verts.
- Tout code de `sim` est testé par Vitest en ligne de commande.
