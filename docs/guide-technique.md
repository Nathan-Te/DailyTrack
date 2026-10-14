# Circuit du Jour — guide technique réutilisable

Document destiné à un **agent orchestrateur** qui doit développer un projet *similaire* (autre jeu quotidien, autre thème, autre mécanique), en repartant d'un fork de ce dépôt ou en le recréant. Il décrit **l'architecture, les patrons qui font la valeur du projet, ce qui est réutilisable tel quel, ce qui est propre à ce jeu, et comment démarrer un dérivé**. Pour l'historique des lots et l'état d'avancement de *ce* projet, voir `docs/orchestration.md` ; pour la vision, `docs/seed.md` (ne pas modifier) ; pour le détail d'un sujet, `docs/lots/`.

---

## 1. L'idée en une page

Un jeu web **quotidien** : une épreuve courte, **identique pour tous**, déduite de la date UTC, avec un **classement dont les résultats sont prouvés** : le serveur ne croit jamais un score annoncé, il **rejoue** la partie. Tout repose sur trois propriétés :

1. **Déterminisme** : même graine + mêmes commandes ⇒ même résultat, au bit près, sur Node, Chromium, Firefox et WebKit.
2. **Une partie = la suite des commandes du joueur** (entiers, un lot par pas de simulation). C'est la seule donnée envoyée.
3. **Un seul code de simulation**, importé par le client (affichage) et par le serveur (validation).

Tout projet dérivé (puzzle quotidien, course, plateformes, tir… tant que la logique est déterministe et rejouable) hérite de ce schéma.

## 2. Architecture

```
packages/sim   Simulation PURE, TypeScript, zéro dépendance (ni DOM, ni Three.js, ni Node)   ~2 600 lignes
apps/web       Client : Vite + Three.js (+ Web Audio), affiche ce que calcule sim             ~5 400 lignes
apps/api       Classement : cœur portable (Request/Response + interface SqlDb) + 2 adaptateurs
docs/          seed.md (vision), lots/ (un README par lot), orchestration.md, ce guide
```

Monorepo **npm workspaces** (`@cdj/sim`, `@cdj/web`, `@cdj/api`), Node ≥ 20, TypeScript, **Vitest** (tests unitaires), **Playwright** (e2e), CI GitHub Actions.

Règle de dépendance : `web → sim`, `api → sim`, **jamais** `sim → autre chose`. Le rendu, le son, les effets, le tactile sont de la *présentation* : ils lisent l'état de `sim`, ne l'influencent jamais.

### 2.1 `packages/sim` (le cœur, à garder au plus près en cas de fork)

| Fichier | Rôle |
|---|---|
| `constants.ts` | `TICK_RATE` (120 Hz), `DT`, `ticksToMs`, **`SIM_VERSION`**, **`GENERATOR_VERSION`** |
| `math.ts`, `rng.ts` | `sin/cos` maison (tables), PRNG à graine explicite (`Rng`, `mixSeed`) |
| `calendar.ts` | jours UTC sans `Date` (`parseDay`, `formatDay`), `PREMIER_JOUR`, numéro du circuit |
| `car.ts` | physique du véhicule (`stepCar`), entrées entières (`makeInput`), paramètres `CarParams` |
| `track.ts`, `world.ts` | circuit = texte de blocs (`parseTrack`) ; `trackWorld` donne sol/pente/rebords/surface |
| `race.ts` | portes, points de contrôle, chrono, reprises (`createRace`, `stepRace`) |
| `replay.ts` | enregistrer, encoder (octets → base64url), décoder, **`replayRace`** (rejeu = vérité) |
| `autopilot.ts` | pilote automatique : valide qu'un circuit est faisable et donne le **temps d'auteur** |
| `generator.ts`, `themes.ts` | `dailyCircuit(jour)` : texte du circuit + thème + médailles, déterministe |
| `circuits.ts` | circuit d'essai écrit à la main (sert aux tests et aux scénarios) |

Pour un autre jeu, on **remplace** `car/track/world/race/autopilot/generator/themes` par la logique du nouveau jeu et on **garde** `constants, math, rng, calendar, replay` (adapter le format des commandes).

### 2.2 `apps/web`

`main.ts` (boucle à **pas fixe** + rendu interpolé, HUD, menus), `session.ts` (`RunSession` : course + enregistrement + fantôme), `trackMesh.ts` (rendu, palettes, décor), `carMesh.ts`, `fx.ts` (particules en pools recyclés, `QualityGovernor`), `audio.ts`/`audioLogic.ts` (Web Audio procédural, logique pure testée), `input.ts` (clavier/manette/tactile fusionnés en commandes entières), `touch.ts`/`touchUi.ts`, `online.ts`/`api.ts`/`identity.ts` (client du classement), `share.ts`/`clipboard.ts`/`archive.ts`/`records.ts`, `demo.ts` (mode `?api=demo`), `tune.ts` (panneau de réglages), `verify.html` (rejeu sans rendu pour les tests de navigateur), `admin/` (page d'outils de test).

Principe : **la logique testable est dans des fichiers purs** (`audioLogic`, `touch`, `adminLogic`, `share`) ; le DOM/WebGL est mince.

### 2.3 `apps/api`

`api.ts` : `createApi({ db, now }).handle(Request) → Response`, ne dépend que de `Request`/`Response` et de l'interface `SqlDb`. Adaptateurs : `server.ts` (Node + SQLite, Docker) et `worker.ts` (Cloudflare Workers + D1). `validate.ts` (validation des entrées), `history.ts` (pilotes fictifs).

Routes : `GET /api/health`, `POST /api/submit` (rediffusion → rejeu serveur → résultat), `/api/player` (pseudo), lecture du classement et des fantômes.
Tables : `players(id, name, demo, …)`, `circuits(day, track_id, spec, author_ms, …)` (cache du circuit du jour), `results(day, player_id, ms, splits, replay, …)` (meilleur temps par joueur et par jour ; la rediffusion sert de fantôme), `rate` (limitation de débit).

## 3. Les patrons à reprendre (la valeur du projet)

### 3.1 Déterminisme strict
- **Pas fixe** 120 Hz, jamais de `dt` variable ; interpolation *à l'affichage seulement*.
- Interdits dans `sim` : `Math.sin/cos/exp/pow/tanh/atan2/hypot`, `**`, `Math.random`, `Date`, moteur physique externe, tout import externe. Permis : `+ − × ÷`, `sqrt`, `floor/round/abs/min/max`, `Math.imul`. Le test **`purete.test.ts`** scanne les sources et l'impose.
- Saturations et angles en formules rationnelles ou en pentes (pas d'angles), amortissements en `x * (1 − k·dt)`.
- Commandes **entières** (`makeInput`), jamais de `-0` (`Math.round(-0.3)` en donne un ; une commande doit survivre à encode → decode à l'identique).
- Le test de déterminisme **Node ↔ Chromium ↔ Firefox ↔ WebKit** (`verify.html` + e2e `replay.spec.ts`) est le filet ultime : à garder en CI.

### 3.2 Rediffusion = preuve
- Format : séries `{count, steer, throttle, brake, respawn}` → octets → base64url ; borné (`MAX_REPLAY_TICKS`, 10 min).
- `replayRace(track, replay)` rejoue et renvoie le résultat **recalculé** : c'est la seule source du temps. Le serveur enregistre *son* résultat.
- Une rediffusion d'une autre `SIM_VERSION` est refusée (serveur) ou ignorée (client).

### 3.3 Versions et « golden tests »
- **`SIM_VERSION`** : +1 dès que la physique, un bloc ou le circuit d'essai change un résultat de course → régénérer `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`.
- **`GENERATOR_VERSION`** : +1 dès que le circuit d'une date change (règles, pilote, fenêtre de durée, thème) → `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`. Elle fait partie de l'id du circuit (`jour-AAAA-MM-JJ-g<N>`), donc les records d'un autre générateur ne se mélangent pas.
- Les golden comparent **au bit près** : un échec = quelque chose a changé la sim ou les circuits. Ne jamais les régénérer sans avoir compris pourquoi.
- Ancrer les tests du générateur/API sur des **dates fixes**, pas sur la constante de lancement.

### 3.4 Contenu quotidien généré et **validé**
- Graine = numéro de jour de la date (`mixSeed(jour, sel)` ; « aujourd'hui » = la date à Paris, lot 31), même circuit pour tous, sans serveur nécessaire côté client.
- `composeSpec` construit un texte de blocs par segments ; **`bestPilotRun`** (pilote automatique, essais à plusieurs niveaux d'adhérence) valide qu'il est faisable et dans une fenêtre de durée (28–48 s) ; son temps devient le **temps d'auteur** → seuils de médailles (or ×1,08, argent ×1,20, bronze ×1,40).
- Chaque nouvel effet de piste crée une **règle de générateur** (ex. deux droites derrière une plaque). Après tout changement de physique ou de règle : **mesurer le taux de circuits validés par thème** (12 jours × 6 tentatives), sinon la génération échoue en silence et ralentit.
- Génération coûteuse (≤ 0,5 s) : le serveur la **met en cache** (`circuits`).

### 3.5 Thèmes
`themeForDay(jour)` tiré de la date ; un thème règle palette, revêtements, probabilités d'effets, passage signature. Un thème **forcé** (`?theme=`) = autre circuit, jamais classé.

### 3.6 Le rendu ne touche jamais la sim
Effets, sons, caméra, vibrations, télémétrie : lecture seule. Particules en **pools recyclés** (jamais d'allocation par image), coupables par `?fx=off`, `QualityGovernor` baisse la qualité sans toucher à la sim. Piège : `Float32BufferAttribute` **copie** son tableau ; pour un tampon dynamique, utiliser `BufferAttribute`.

### 3.7 Un client, plusieurs entrées, mêmes commandes
Clavier, manette et tactile produisent les **mêmes commandes entières** ; rien dans `sim`. Le tactile est simulable à la souris (`?touch=1`).

### 3.8 Backend portable et sans confiance
Cœur `Request → Response` + interface `SqlDb` ⇒ Node/SQLite (Docker) **ou** Workers/D1. Sécurité : SQL paramétré, pseudo validé et rendu en `textContent`, corps borné (fermer la connexion si refusé sans lecture), **limitation de débit avant tout rejeu**, adresses hachées, un joueur n'existe qu'après une course valide. Horloge **injectée** (`now`) pour les tests. Seul le jour UTC courant accepte des temps (10 min de grâce), les jours passés sont figés.

### 3.9 Identité sans compte
Identifiant aléatoire + pseudo dans `localStorage`. Le jeu **fonctionne sans API** (pas d'adresse = pas de classement).

### 3.10 Mode démo et historique
`npm run history:seed` fabrique, **dans une base en mémoire** et via le vrai `createApi(...).handle`, 14 jours de courses de pilotes fictifs (`demo = 1`) → fichiers statiques `apps/web/public/demo/` ; `?api=demo` les lit en lecture seule. Déterministe (aucune date ni `Math.random`). Les joueurs `demo` n'existent **jamais** en production. À relancer après tout changement de version.

### 3.11 Outillage de test intégré
`?debug` expose `window.__cdj` (`phase`, `input`, `manual(true)` + `advance(n)` pas à pas sans rendu, `autoplay(code)`, `fx`, `audio`), `timescale=N`, `today=`, `spec=<blocs>`, panneau `?debug&tune` (une course aux réglages modifiés n'est **jamais** enregistrée ni classée). Page `/admin/` : construit l'adresse du jeu ; **tout nouveau paramètre d'URL = une option dans `adminLogic.ts`**.

## 4. Qualité, tests, CI

| Couche | Outil | Commande |
|---|---|---|
| Types | `tsc -b` | `npm run typecheck` |
| Unitaires (~300) | Vitest | `npm test` |
| Pureté de `sim` | `purete.test.ts` | inclus |
| Golden (course, circuits du jour) | Vitest | `UPDATE_GOLDEN=1 …` pour régénérer |
| e2e (déterminisme multi-navigateurs, classement avec vrai serveur, mobile, tactile, perf, admin, démo) | Playwright | `npm run test:e2e` (`CHROMIUM_PATH=…`, `E2E_ALL_BROWSERS=1`) |
| Build | Vite | `npm run build` (Three.js dans son propre chunk, budget de poids dans `perf.spec.ts`) |

CI (`.github/workflows/`) : `ci.yml` (typecheck + tests + build ; e2e sur 3 navigateurs), `pages.yml` (aperçu par branche sous `/b/<branche>/`), `preview.yml` (Cloudflare Pages, optionnel). Les tests de rendu 3D ne tournent que sous Chromium (WebGL).

Pièges de test appris à la dure : police de CI plus large (imposer une police dans les tests de mise en page) ; CI plus lente (attendre `phase`, pas l'horloge) ; rendu logiciel ≈ 8 img/s (mesurer le **temps de fil principal**, pas les FPS) ; un effet « compté » n'est pas « vu » (regarder une capture) ; ne jamais désactiver un test pour être vert.

## 5. Ce qui est générique, ce qui est spécifique

**Générique (reprendre tel quel)** : structure monorepo, CI, `constants/math/rng/calendar/replay`, test de pureté, golden tests et règle des deux versions, `RunSession` (boucle pas fixe + enregistrement + fantôme), API complète (`api.ts`, adaptateurs, `validate.ts`, limitation de débit, schéma), identité, partage façon Wordle, archives, mode démo + `history:seed`, `/admin`, outils `?debug`, tactile, audio procédural, `QualityGovernor`.

**Spécifique au jeu de course (à remplacer)** : `car.ts`, `track.ts`, `world.ts`, `race.ts` (portes/chrono), `autopilot.ts`, `generator.ts`, `themes.ts`, `circuits.ts`, `trackMesh.ts`, `carMesh.ts`, `telemetry.ts`, ainsi que `CarParams`/`SurfaceParams` et le panneau `tune.ts`.

## 6. Démarrer un projet dérivé (recette)

1. **Forker** le dépôt ; renommer les paquets (`@cdj/*`), le titre, `docs/credits.md`.
2. **Définir la partie** : état (`GameState`), commande entière par pas (`Input`), fonction pure `step(state, input, world)`, condition de fin et **score entier**. Écrire d'abord `purete.test.ts` et un test de déterminisme (même commandes ⇒ même état final).
3. **Adapter `replay.ts`** : champs de la commande, `FORMAT`, bornes. Garder `replayRace` comme *seule* source du score.
4. **Générateur quotidien** : `compose(jour)` pur à partir de `Rng(mixSeed(jour, …))` ; **bot de validation** (même simple) qui prouve la faisabilité et donne le score d'auteur ; médailles = multiples de ce score. Mesurer le taux de validation.
5. **Golden tests** (`golden.test.ts`, `golden-daily.test.ts`) dès que la sim est stable ; régler `SIM_VERSION`/`GENERATOR_VERSION` à 1.
6. **Client** : remplacer `trackMesh/carMesh` par le rendu du nouveau jeu en gardant `main.ts` (boucle), `session.ts`, `input.ts`, HUD, menus, partage.
7. **API** : adapter seulement ce qui dépend de la partie (génération du circuit du jour, rejeu) ; le reste est inchangé. Choisir l'hébergement (voir §7).
8. **Outils** : `__cdj`, scénarios, `/admin`, mode démo.
9. **Fixer la date de lancement** (`PREMIER_JOUR`) quand elle est connue.

## 7. Déploiement et décisions à connaître
- Front statique (GitHub Pages / Cloudflare Pages) ; variable `VITE_API_URL` ou `?api=`.
- **API : préférer un serveur Node + SQLite en Docker** (aucune limite de calcul). **Cloudflare Workers gratuit ne convient pas** : 10 ms de CPU par requête, alors qu'un rejeu coûte ≈ 10–12 ms et une génération de circuit ≈ 100 ms (Workers Paid sinon). Détails : `docs/lots/lot-5-classement.md`.
- Sauvegarde de la base, `/api/health`, HTTPS, nom de domaine : à prévoir à la mise en ligne.

## 8. Méthode de travail pour l'orchestrateur
- **Un lot = une session neuve = une branche = une PR (brouillon)** ; README de lot d'une page (livré, « à tester », garde-fous, limites) ; l'agent s'arrête quand les critères sont verts. Après fusion, repartir de `main` à jour.
- Prompt de lot : *Contexte · Objet · À livrer · Critères d'arrêt · Modifications de `CLAUDE.md` · Hors périmètre · Règles rappelées · Rapport attendu*.
- Avant de pousser : `npm run typecheck && npm test`, puis `npm run test:e2e` pour tout ce qui touche au rendu, à l'API ou au partage.
- Rapports honnêtes : vérifié / non vérifié (vrai téléphone, déploiement réel) / décisions pour l'humain.
- **Ordre de lots conseillé** pour un dérivé : 0 socle → 1 cœur de jeu déterministe → 2 contenu/éditeur de niveaux → 3 rediffusion + golden → 4 générateur quotidien + bot → 5 classement → 6 arrivée/partage/archives/mobile → puis conduite/feeling, surfaces/thèmes, juice, tactile, historique/démo (ces lots-là sont indépendants et peuvent être permutés).
- Modèles : effort moyen suffit pour la plupart des lots ; réserver le plus puissant à la physique déterministe ou aux bugs de déterminisme multi-navigateurs.

## 9. Check-list « ne pas casser »
- [ ] Aucun `Math.random`/`Date`/fonction transcendante/import externe dans `sim` (test de pureté vert).
- [ ] Commandes entières, pas de `-0`.
- [ ] Changement de résultat de course ⇒ `SIM_VERSION`+1 + golden régénérés ; changement de circuit d'une date ⇒ `GENERATOR_VERSION`+1 + golden + `history:seed`.
- [ ] Le serveur rejoue toujours ; aucun temps annoncé n'est cru.
- [ ] Le rendu ne modifie pas la sim ; tout nouvel effet tient dans ses pools et se coupe avec `?fx=off`.
- [ ] Le jeu marche sans API ; les joueurs `demo` n'existent pas en production.
- [ ] Nouveau paramètre d'URL ⇒ option dans `adminLogic.ts` ; nouveau comportement chiffré ⇒ test à seuils.
- [ ] Tests e2e verts sur Chromium, Firefox et WebKit avant fusion.
