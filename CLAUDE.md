# Circuit du Jour

Jeu web quotidien : un circuit court par jour, identique pour tous, classement validé par rediffusion. Source de vérité : `docs/seed.md` (ne pas modifier, c'est Nathan qui le fait). Réponses et docs en français.

## Structure
- `packages/sim` — simulation pure (physique, blocs, chrono, générateur, bot). **Aucune dépendance** au DOM, à Three.js ou à Node.
- `apps/web` — le jeu (Vite + Three.js) ; affiche ce que calcule `sim`.
- `apps/api` — classement (lot 5) ; importe le même `sim` pour rejouer les courses.
- `docs/lots/` — un README d'une page par lot.

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
- Web : `?seed=AAAA-MM-JJ`, `?scenario=essai|plat`. Palettes dans `apps/web/src/trackMesh.ts` (`PALETTE_DEFS`).

## Classement (lot 5)
- `apps/api` : `createApi({ db, now })` (`src/api.ts`) ne dépend que de `Request`/`Response` et de `SqlDb` ; adaptateurs : Node + SQLite (`server.ts`, Docker) et Cloudflare Workers + D1 (`worker.ts`). **Le serveur ne fait jamais confiance à un temps annoncé** : il rejoue la rediffusion (`replayRace`) et enregistre son propre résultat.
- Le client est dans `apps/web/src/{api,identity,online}.ts` ; adresse de l'API : `?api=` ou `VITE_API_URL`. Sans elle, aucun classement.
- Tests : `apps/api/test` (SQLite en mémoire, horloge injectée) ; e2e `leaderboard.spec.ts` (Playwright lance le vrai serveur : `npm run test:e2e` construit aussi `apps/api`). Outils `?debug` : `timescale=N`, `__cdj.autoplay(code)`.
- Le Worker ne tient pas dans les 10 ms de calcul de l'offre gratuite de Cloudflare (voir docs/lots/lot-5-classement.md).

## Règles de la simulation (déterminisme)
- Pas fixe (`TICK_RATE` = 120 Hz), jamais de `dt` variable ; interpolation à l'affichage seulement.
- Pas de moteur physique externe. Pas de `Math.sin/cos/exp/pow/…` dans `sim` : implémentations maison ou tables.
- Commandes de la voiture = entiers (`makeInput`) ; l'état de référence de `car.test.ts` ne change que si la physique change volontairement.
- Pas de `Math.random` ni `Date` dans `sim` : PRNG à graine explicite.
- Une course = la suite des commandes du joueur ; le même code la rejoue côté serveur.

## Méthode
- Un lot = une session = une branche = une PR. L'agent s'arrête quand les critères du lot sont verts.
- Tout code de `sim` est testé par Vitest en ligne de commande.
