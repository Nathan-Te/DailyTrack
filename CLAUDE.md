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
- Web : `?seed=AAAA-MM-JJ`, `?scenario=essai|pilotage|plat`, `?debug&tune` (réglages), touche **C** (caméra). Palettes dans `apps/web/src/trackMesh.ts` (`PALETTE_DEFS`).

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
- **Réglages par défaut = ceux de Nathan (retouche 7b, `docs/lots/lot-7b-reglages.md`)** : pointe 48 m/s, grip 44 / 47, seuil de glisse 0,14, dérapage doux (angle 0,32, serrage 33), gravité 24,6, rebords durs (rebond 0,6, frottement 0,3). `SIM_VERSION` et `GENERATOR_VERSION` valent **3**.
- Générateur : **deux lignes droites derrière chaque plaque** (`PAD_RUNOUT`, generator.ts) — à 48 m/s, une plaque suivie d'un virage serré ne se prend pas (frein 40 contre poussée 30 pendant 0,9 s). Le circuit d'essai suit la même règle. Pilote : marge aux rebords de 3,6 m (`WALL_MARGIN`).
- Tests de comportement chiffrés : `packages/sim/test/conduite.test.ts` (seuils recopiés dans le README du lot, mis à jour au 7b).

## Commandes tactiles (lot 10)
- `apps/web/src/touch.ts` (logique pure, testée : `TouchPad` = doigts → axes, `dragSteer`, `zoneAt`, réglages `cdj:touch`, seuil de choc) ; `touchUi.ts` (DOM : zones, aides, boutons, réglages, invitation portrait, plein écran) ; `input.ts` (`Controls` fusionne clavier, manette et doigts). Mode actif si `pointer: coarse`, ou `?touch=1` (la souris simule le doigt) ; `?touch=0` le coupe.
- Disposition paysage : moitié gauche = direction (glissement relatif au point de pose, ou boutons ← →), moitié droite = frein ; accélérateur **automatique** par défaut (ou bouton gaz) ; boutons pause / reprise / départ / réglages / plein écran ; **P** = pause (aussi au clavier).
- **Règle : le tactile produit les mêmes commandes entières que les autres entrées** (axes flottants → `makeInput`) ; rien dans `sim`, rediffusions identiques. Vibration (point de contrôle, choc) = présentation seule, lecture de la vitesse sans effet sur la simulation.
- Tests : `apps/web/test/touch.test.ts` ; e2e `tactile.spec.ts` (vrais événements tactiles via `Input.dispatchTouchEvent`, gabarits Android et iPhone) ; outils `?debug` : `spec=<blocs>`, `__cdj.input`, `__cdj.manual(true)` + `__cdj.advance(n)` (pas à pas, sans rendu). Aides de mise en page : `e2e/layout.ts`.

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
