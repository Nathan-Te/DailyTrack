# Circuit du Jour — guide technique réutilisable

Document destiné à un **agent orchestrateur** qui doit développer un projet *similaire* (autre jeu quotidien, autre thème, autre mécanique), en repartant d'un fork de ce dépôt ou en le recréant. Il décrit **l'architecture, les patrons qui font la valeur du projet, ce qui est réutilisable tel quel, ce qui est propre à ce jeu, les leçons de production et de CI, et comment démarrer un dérivé**. Il est à jour des lots 0 à 30 (état du 14/10/2026). Pour l'historique détaillé et les décisions propres à *ce* projet : `docs/orchestration.md` ; pour la vision : `docs/seed.md` (ne pas modifier) ; pour un sujet précis : `docs/lots/lot-N-*.md` ; pour la mise en ligne : `docs/mise-en-ligne.md`.

---

## 1. L'idée en une page

Un jeu web **quotidien** : une épreuve courte (30–45 s), **identique pour tous**, déduite de la date UTC, avec un **classement dont les résultats sont prouvés** : le serveur ne croit jamais un score annoncé, il **rejoue** la partie. Tout repose sur trois propriétés :

1. **Déterminisme** : même graine + mêmes commandes ⇒ même résultat, au bit près, sur Node, Chromium, Firefox et WebKit.
2. **Une partie = la suite des commandes du joueur** (entiers, un lot par pas de simulation). C'est la seule donnée envoyée.
3. **Un seul code de simulation**, importé par le client (affichage) et par le serveur (validation).

Deux modes en découlent : le **circuit du jour** (un par date) et le **Salon** (un circuit toutes les 10 minutes à heure fixe, fantômes des autres joueurs en direct). Tout projet dérivé (puzzle quotidien, course, plateformes, tir… tant que la logique est déterministe et rejouable) hérite de ce schéma.

## 2. Architecture

```
packages/sim   Simulation PURE, TypeScript, zéro dépendance (ni DOM, ni Three.js, ni Node)
apps/web       Client : Vite + Three.js (+ Web Audio), affiche ce que calcule sim
apps/api       Serveur : cœur portable (Request/Response + interface SqlDb) + adaptateurs
docs/          seed.md (vision), lots/ (un README par lot), orchestration.md, mise-en-ligne.md, ce guide
```

Monorepo **npm workspaces** (`@cdj/sim`, `@cdj/web`, `@cdj/api`), Node ≥ 20, TypeScript, **Vitest** (deux projets : base `sqlite` puis `libsql`), **Playwright** (e2e), GitHub Actions.

Règle de dépendance : `web → sim`, `api → sim`, **jamais** `sim → autre chose`. Rendu, son, effets, tactile, interface = *présentation* : ils lisent l'état de `sim`, ne l'influencent jamais.

### 2.1 `packages/sim` (le cœur)

| Fichier | Rôle |
|---|---|
| `constants.ts` | `TICK_RATE` (120 Hz), `DT`, `ticksToMs`, **`SIM_VERSION`**, **`GENERATOR_VERSION`** (valent 14 et 15 au lot 30) |
| `math.ts`, `rng.ts` | `sin/cos` maison (tables), PRNG à graine explicite (`Rng`, `mixSeed`) |
| `calendar.ts` | jours UTC sans `Date`, `PREMIER_JOUR` (n° 1 = 13/10/2026), `circuitNumber` |
| `car.ts` | physique : bicyclette + 4 ressorts + balistique + glace + contact par la normale dans les cuves (`stepCar`, `substepShell`), `CarParams`, `makeInput` |
| `track.ts`, `world.ts`, `cuve.ts`, `jump.ts` | circuit = texte de blocs (`parseTrack`) ; `trackWorld` = sol, pentes, rebords, surfaces, parois ; fenêtres de vitesse des sauts |
| `race.ts` | portes, points de contrôle, chrono, reprises, chute (`stepRace`) |
| `replay.ts` | enregistrer / encoder base64url / décoder / **`replayRace`** (rejeu = vérité) |
| `autopilot.ts`, `choices.ts` | pilote de validation (trajectoire de course, 4 niveaux d'adhérence) et mesure des « moments de choix » |
| `generator.ts`, `figures.ts`, `themes.ts` | `dailyCircuit(jour, variante, thème?)` ; bibliothèque de **figures** assemblées ; 8 thèmes |
| `salon.ts` | sessions de 10 min, `salonCircuit(session)`, `salonTheme` |
| `circuits.ts` | circuits écrits à la main (essai et scénarios de test) |

### 2.2 `apps/web`

- **Boucle et course** : `main.ts` (pas fixe + rendu interpolé, HUD, menus), `session.ts` (`RunSession` : course + enregistrement + fantôme), `verify.html` (rejeu sans rendu pour les tests de navigateur).
- **Rendu** : `trackMesh.ts` (+ `meshKit.ts`, `trackProps.ts`, `signage.ts`, `halo.ts`), `carMesh.ts`, `carPose.ts`, `cameras.ts` (proche, loin, capot), `fx.ts`, `speedFeel.ts`, `landing.ts`, `thumbnail*.ts` (miniatures en fil de travail).
- **Son** : `audio.ts` + `audioLogic.ts` (Web Audio procédural, 2 bus moteur / effets).
- **Entrées** : `input.ts` (clavier, manette, tactile fusionnés), `touch.ts` / `touchUi.ts`.
- **Réseau et données** : `api.ts`, `online.ts`, `identity.ts`, `planning.ts`, `salonMode.ts` / `salonApi.ts` / `salonGhosts.ts` / `salonUi.ts`, `demo.ts` / `salonDemo.ts` (serveurs simulés dans le navigateur), `transfer.ts` (code de transfert), `records.ts`, `settings.ts`.
- **Interface** (lot 29) : accueil (`homeUi.ts` + `homeLogic.ts`), pause, Réglages à onglets (`settingsUi.ts`), « Comment jouer », profil, `watch*.ts` (revoir le meilleur tour), `share.ts`, `archive.ts`, page `/admin/`.

Principe : **la logique testable est dans des fichiers purs** (`audioLogic`, `touch`, `homeLogic`, `salon`, `watch`, `settings`, `transfer`, `adminLogic`) ; le DOM/WebGL est mince.

### 2.3 `apps/api`

`api.ts` : `createApi({ db, now }).handle(Request) → Response`, ne dépend que de `Request`/`Response` et de `SqlDb`. `salon.ts` (Salon), `config.ts` (lecture et refus de configuration), `log.ts` (journaux JSON), `validate.ts`, `errors.ts`, `history.ts` (pilotes fictifs).
Adaptateurs : `server.ts` (Node, Docker, **Cloud Run**) ; bases : `node-sqlite.ts` (local), **`libsql.ts`** (Turso, production), `d1.ts` + `worker.ts` (Cloudflare, non utilisé).

Routes : `GET /api/health`, `POST /api/submit`, `/api/player`, `GET /api/me` et `POST /api/me/code` (profil synchronisé), `GET /api/name`, classement et fantômes, `GET /api/day/…`, `GET /api/planning`, `/api/admin/*` (jeton), `/api/salon/{now,<session>/board,ghosts,submit}`.
Tables : `players` (`demo`, `name_key` unique), `circuits` (cache du jour), `results` (meilleur temps par joueur et par jour + rediffusion = fantôme), `planning`, `rate`, `meta` (empreinte du schéma), `salon_runs` / `salon_sessions` / `salon_circuits` / `salon_presence` / `salon_throttle`.

## 3. Les patrons à reprendre (la valeur du projet)

### 3.1 Déterminisme strict
- **Pas fixe** 120 Hz, jamais de `dt` variable ; interpolation *à l'affichage seulement*. Garde-fou anti-traversée : aucun changement de pas, **testé à la vitesse maximale** (`vitesse.test.ts` : chocs de face, braquage à fond ; toute nouvelle poussée rejoint ce test).
- Interdits dans `sim` : `Math.sin/cos/exp/pow/tanh/atan2/hypot`, `**`, `Math.random`, `Date`, moteur physique externe, tout import externe. Permis : `+ − × ÷`, `sqrt`, `floor/round/abs/min/max`, `Math.imul`. Le test **`purete.test.ts`** scanne les sources. L'heure du Salon est lue **hors de `sim`** et passée en argument.
- Formules rationnelles (`tireCurve`), angles gardés en **pentes**, amortissements en `x * (1 − k·dt)`, profils polynomiaux (quintique pour le relevé).
- Commandes **entières** (`makeInput`), jamais de `-0`.
- Test de déterminisme **Node ↔ Chromium ↔ Firefox ↔ WebKit** (`verify.html`, `replay.spec.ts`, aussi sur la paroi des cuves à 1e-9) : filet ultime.

### 3.2 Rediffusion = preuve
Séries `{count, steer, throttle, brake, respawn}` → octets → base64url, bornée (`MAX_REPLAY_TICKS`). `replayRace` rejoue et renvoie le résultat **recalculé** ; le serveur enregistre *son* résultat. Même règle pour les pilotes de démo, le mode spectateur (`?watch=best`) et le Salon. Une rediffusion d'une autre `SIM_VERSION` est refusée (serveur) ou ignorée (client).

### 3.3 Versions et « golden tests »
- **`SIM_VERSION`** +1 dès que la physique, un bloc, un revêtement ou le circuit d'essai change un résultat → `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`.
- **`GENERATOR_VERSION`** +1 dès que le circuit d'une date change (règles, pilote, figures, thème, tirage des variantes ou du Salon) → `golden-daily.test.ts`. Elle fait partie de l'id (`jour-AAAA-MM-JJ-g<N>[-v<n>][-<thème>]`).
- Après un changement de version : `npm run history:seed` et `npm run measure:generator`.
- Les golden comparent **au bit près** ; ne jamais les régénérer sans comprendre pourquoi. Ancrer les tests du générateur et de l'API sur des **dates fixes**.
- Un lot « rendu seul » ou « interface seule » **ne bouge aucune version** (c'est un critère de sortie vérifiable : golden inchangés).

### 3.4 Contenu quotidien généré et **validé**
- Graine = numéro de jour de la date (`mixSeed(jour, sel)` ; « aujourd'hui » = la date à Paris, lot 31), même circuit pour tous, sans serveur nécessaire côté client.
- `composeSpec` construit un texte de blocs par segments ; **`bestPilotRun`** (pilote automatique, essais à plusieurs niveaux d'adhérence) valide qu'il est faisable et dans une fenêtre de durée (28–48 s) ; son temps devient le **temps d'auteur** → seuils de médailles (or ×1,08, argent ×1,20, bronze ×1,40).
- Chaque nouvel effet de piste crée une **règle de générateur** (ex. deux droites derrière une plaque). Après tout changement de physique ou de règle : **mesurer le taux de circuits validés par thème** (12 jours × 6 tentatives), sinon la génération échoue en silence et ralentit.
- Génération coûteuse (≤ 0,5 s) : le serveur la **met en cache** (`circuits`).

### 3.5 Thèmes et identité
8 thèmes tirés de la date (`themeForDay`) ; un thème règle palette, revêtements, largeurs, bas-côtés, cuves, sauts, figures favorites/interdites, signature, lumière (`LOOKS`) et ambiance sonore. Ajouter un thème = `THEME_NAMES`, `THEMES`, palettes, signature, capture, versions +1. Un thème **forcé** par l'adresse est un essai, jamais classé.

### 3.6 Le rendu ne touche jamais la sim
Effets, sons, caméra, vibration, miniatures, interface : lecture seule. Particules en **pools recyclés**, coupables (`?fx=off`), trois niveaux de qualité pilotés par `QualityGovernor` ; objets lourds marqués (`userData.level/heavy`). **Tout élément posé sur la voiture se vérifie par lancer de rayons** (caméra capot : `hoodView.test.ts`). Piège : `Float32BufferAttribute` copie son tableau. **Un effet « compté » n'est pas un effet « vu »** : regarder une capture.

### 3.7 Entrées : mêmes commandes entières
Clavier, manette, tactile → mêmes commandes. Tactile : **zones actives sans trou définies une fois** (`zoneSpans`), boutons dessinés écartés des frontières (un petit bouton attire les appuis voisins), cibles ≥ 44 px, simulable à la souris (`?touch=1`).

### 3.8 Backend portable et sans confiance
Cœur `Request → Response` + `SqlDb`. Sécurité : SQL paramétré, pseudo rendu en `textContent`, corps borné, **limitation de débit avant tout rejeu** (envois comptés **en base**, lectures **en mémoire par instance**), adresses hachées avec sel, comparaison du jeton admin à temps constant, un joueur n'existe qu'après une course valide, horloge **injectée**. Seul le jour courant accepte des temps (10 min de grâce).

### 3.9 Identité sans compte
Identifiant secret aléatoire + pseudo dans `localStorage`. **Lot 30** : un pseudo appartient à son premier propriétaire (`nameKey` normalisé, index unique, 409 `name_taken` + suggestions, migration des doublons) ; **profil synchronisé, le serveur fait foi** (`GET /api/me`, fusion « le meilleur gagne », record local jamais envoyé rejoué) ; **code de transfert** `CDJ2.<base64url>.<CRC-32>` (aucune donnée envoyée au serveur ; contient l'identifiant : à garder comme un mot de passe) ; « Changer mon code » = rotation avec ancien identifiant révoqué (410), empreinte SHA-256 seule en base. Le jeu **fonctionne sans API**.

### 3.10 Mode démo et historique
`npm run history:seed` fabrique, **en mémoire** et via le vrai `createApi(...).handle`, 14 jours de courses de pilotes fictifs (`demo = 1`) → fichiers statiques `public/demo/` lus par `?api=demo` (lecture seule). Déterministe. Les joueurs `demo` n'existent **jamais** en production. Même principe pour le Salon (`DemoSalonApi` : le navigateur joue le serveur, les courses fictives sont calculées en fil de travail **puis rejouées**).

### 3.11 Mode « live » sans tâche de fond (le Salon)
Session = `floor(heure UTC / durée)` ; circuit à graine propre ; thèmes jamais égaux entre voisines. Contrat d'API par **`ref` publique propre à la session** (jamais l'identifiant secret). Le serveur rejoue chaque envoi, accepte de `start` à `end + 60 s`, **oublie les sessions finies** (décision produit : effacement à la demande, première requête qui voit la session terminée, pas de minuterie). Présence espacée (≤ 1 écriture / joueur / 30 s, upsert conditionnel), un spectateur n'écrit rien. Circuit suivant généré dans les 2 dernières minutes, scène construite derrière le podium, bascule sans gel. **Ce sont les lectures du Salon (toutes les 5 s) qui limitent l'offre gratuite**, pas le circuit du jour.

### 3.12 Spectateur
`?watch=best` rejoue la rediffusion du premier avec le même code que le serveur : caméras, caméra libre, pause, ralenti, retour en arrière **par rejeu depuis le départ** (≈ 20–40 ms, aucun instantané mémoire donc aucune dérive).

### 3.13 Outillage de test intégré
`?debug` expose `window.__cdj` (`phase`, `input`, `manual(true)` + `advance(n)` pas à pas sans rendu, `autoplay`, `fx`, `audio`, `ui`, `salon`, `watch`, `thumbs`, `render`), `timescale=N`, `today=`, `spec=<blocs>`, scénarios (`essai|pilotage|surfaces|largeurs|vitesse|glace|relief|cuves|air|bas-cotes|figures|figure&f=…`), panneau `?debug&tune` (une course aux réglages modifiés n'est **jamais** enregistrée), page `/admin/` (construit l'adresse du jeu + planning). **Tout nouveau paramètre d'URL = une option dans `adminLogic.ts`.**

## 4. Qualité, tests, CI (lot 29b : « rouge = vrai problème »)

| Couche | Outil | Commande |
|---|---|---|
| Types | `tsc -b` | `npm run typecheck` |
| Unitaires (~1 000 d'après le dépôt) | Vitest, projets `sqlite` + `libsql` | `npm test` |
| Pureté de `sim` | `purete.test.ts` | inclus |
| Golden (course, circuits) | Vitest | `UPDATE_GOLDEN=1 …` |
| Mesures | scripts | `measure:generator`, `measure:salon`, `measure:budget` |
| e2e | Playwright | `npm run test:e2e` (`CHROMIUM_PATH`, `E2E_ALL_BROWSERS=1`) |
| Essai de bout en bout de l'API | `npm run smoke -- <url>` | jamais contre la vraie base |

**CI** : job `test`, **matrice** `e2e-parts` (navigateur × `--shard` : Chromium en 8 parts, Firefox et WebKit en 2), job `e2e` = **verdict unique** (fusion des rapports « blob », résumé du run), job `api-image` (construit l'image, la lance contre un vrai `sqld`, passe le smoke test), `deploy-api.yml`, `pages.yml`, run de nuit. Objectif : < 20 min du push au verdict. Protection de `main` sur les statuts `test` et `e2e`.

**Règles de test stable** :
- **Une relance en CI, signalée** : un test qui échoue puis réussit est « instable », nommé dans le résumé et annoté, **jamais caché** ; c'est une dette à corriger.
- **Horloge maîtrisée** : aucun test ne dépend de l'heure réelle ; `e2e/fixtures.ts` décale `Date` (jamais `page.clock.install` : il affame le fil principal en rendu logiciel) ; le serveur de test reçoit `TEST_CLOCK_OFFSET_MS` (**refusée en production**).
- Attendre un **état** (`__cdj.phase`, événements), jamais une durée ; pas à pas (`manual` + `advance`) dès qu'un résultat dépend du nombre d'images ; **un serveur de test par spec** qui compte des présents ou des sessions ; capacité absente (WebGL) = `test.skip` motivé via `hasWebGL(page)`.
- **Interdits** : désactiver, sauter, affaiblir un test, pousser un commit vide pour être vert.

Pièges appris : police de CI plus large (imposer DejaVu Sans dans les tests de mise en page, vérifier **portrait et paysage**) ; rendu logiciel ≈ 8 img/s (mesurer le temps de fil principal, pas les FPS) ; un test de comparaison de surfaces fixe le pied ; un test ancré sur la constante de lancement change de circuit quand on la déplace ; un jeu de données généré doit être déterministe.

## 5. Mise en production (lot 28, à reprendre tel quel)

- **Jeu** : site statique (GitHub Pages) ; `VITE_API_URL` injectée **seulement dans la construction de `main`** (un aperçu de branche n'écrit jamais dans la vraie base).
- **API** : conteneur Docker sur **Cloud Run** (`europe-west1`, `--min-instances=0 --max-instances=2`, 1 vCPU, 512 Mo — mesuré : 43 Mo en usage) + base **Turso/libSQL** (client HTTP pur JS embarqué, une instruction = un aller-retour : lectures indépendantes en parallèle, schéma en un lot). Déploiement par workflow à chaque fusion touchant l'API ou `sim`, avec contrôle de `/api/health` ; authentification par fédération d'identité.
- **Cloudflare Workers gratuit ne convient pas** (10 ms de CPU ; un rejeu ≈ 10–18 ms, une génération ≈ 100–500 ms).
- **Secrets** (Secret Manager → variables d'environnement, jamais dans le dépôt ni les journaux) : `TURSO_AUTH_TOKEN`, `ADMIN_TOKEN`, `RATE_SALT`. `config.ts` **refuse de démarrer** en production avec `SALON_MINUTES`, sans `ALLOWED_ORIGINS` ou `RATE_SALT`, ou sans Turso sur Cloud Run (le disque est éphémère).
- **Pas de tâche de fond indispensable** (Cloud Run éteint le conteneur) : tout est calculé et nettoyé à la demande ; `tick()` n'existe qu'hors production.
- **Schéma versionné par empreinte** (`meta`, calculée du texte de `SCHEMA` + `MIGRATIONS` : aucun numéro à incrémenter). Toute requête SQL doit passer sur **les deux bases** (tests doublés).
- **CORS** par liste d'origines sans chemin ; adresse client lue **depuis la droite** de `X-Forwarded-For` (`TRUST_PROXY=n`) ; `/api/health` complet (503 si la base ne répond pas) ; journaux JSON sans rediffusion, pseudo, identifiant ni adresse (testé).
- **Budget** : un joueur du jour ≈ 9 requêtes ; 30 min de Salon ≈ 560 requêtes ; Turso facture les lignes lues/écrites → mesurer les écritures par table (`measure:salon`) : le débit des lectures qui écrivait en base a été trouvé ainsi.
- **Un agent cloud ne crée ni compte ni carte bancaire ni ne relance un workflow (403)** : il prépare le dépôt et un guide pas à pas pour l'humain (`docs/mise-en-ligne.md`, `docs/securite-facturation.md`).

## 6. Ce qui est générique, ce qui est spécifique

**Générique (reprendre tel quel)** : monorepo, CI (matrice, verdict unique, instables signalés, horloge maîtrisée), `constants/math/rng/calendar/replay`, test de pureté, golden et règle des versions, `RunSession`, API entière (`api.ts`, `config.ts`, `libsql.ts`, rate limiting, pseudos, profil, code de transfert, planning, admin), Salon (contrat, présence, oubli), mode démo + `history:seed`, spectateur, accueil / réglages / aide / pause, partage, archives + miniatures, tactile, audio procédural, `QualityGovernor`, `/admin`, outils `?debug`, workflows de déploiement.

**Spécifique à la course (à remplacer)** : `car.ts`, `track.ts`, `world.ts`, `cuve.ts`, `jump.ts`, `race.ts`, `autopilot.ts`, `choices.ts`, `generator.ts`, `figures.ts`, `themes.ts`, `circuits.ts`, `trackMesh.ts`, `carMesh.ts`, `carPose.ts`, `signage.ts`, `trackProps.ts`, `telemetry.ts`, `speedFeel.ts`, `landing.ts`, caméras, `CarParams`/`SurfaceParams`, panneau `tune.ts`.

## 7. Démarrer un projet dérivé (recette)

1. **Forker** ; renommer paquets (`@cdj/*`), titre, `docs/credits.md`, `PREMIER_JOUR`, noms de stockage (`cdj:*`), domaines.
2. **Définir la partie** : état, commande entière par pas, `step(state, input, world)` pure, fin de partie, **score entier**. D'abord `purete.test.ts` et un test « mêmes commandes ⇒ même état ».
3. **Adapter `replay.ts`** (champs, `FORMAT`, bornes) ; `replayRace` reste la seule source du score.
4. **Générateur quotidien** : `compose(jour)` pur depuis `Rng(mixSeed(jour, …))`, par **briques/figures** ; **bot de validation** (même simple) = faisabilité + score d'auteur → médailles ; script de mesure (taux de validation, durée) **dès le début**.
5. **Golden tests** dès que la sim est stable ; versions à 1.
6. **Client** : garder `main.ts` (boucle), `session.ts`, entrées, accueil / réglages / aide / pause / partage / archives ; remplacer les modules de rendu du jeu.
7. **API** : adapter seulement la génération du circuit et le rejeu ; le reste (identité, classement, Salon, planning, admin, config, base) est réutilisable.
8. **Outils** : `__cdj`, scénarios, `/admin`, démo (`history:seed`).
9. **Production** : guide pas à pas pour l'humain, secrets, `PREMIER_JOUR` à la vraie date de lancement.

## 8. Méthode de travail pour l'orchestrateur
- **Un lot = une session neuve = une branche = une PR (brouillon)** ; README de lot d'une page (livré, « à tester », garde-fous, mesures, limites) ; l'agent s'arrête quand les critères sont verts (**= CI verte sur la PR**). Après fusion, repartir de `main` à jour ; une PR fusionnée ne se réutilise pas.
- Consignes (lot R2) : `CLAUDE.md` racine = carte du dépôt, règles communes, index ; **un `CLAUDE.md` par zone** (`packages/sim`, `apps/web`, `apps/api`, `packages/jump-sim`, `apps/jump`), chargé à la demande quand on lit un fichier de la zone — chaque lot y ajoute sa section, dans la zone qu'il touche ; synthèses : `docs/orchestration.md` (DailyTrack : synthèse, pièges, suite), `docs/jump/synthese.md` (DailyJump).
- Prompt de lot : *Contexte · Objet · À livrer · Critères d'arrêt · Modifications des `CLAUDE.md` de zone · Hors périmètre · Règles rappelées · Rapport attendu*.
- **Une retouche** (7b, 9b, 10b, 18b, 24, 27b, 29b) corrige ou règle un lot livré sans en ouvrir un nouveau ; les **réglages de feeling** viennent du humain (panneau `?debug&tune` → valeurs copiées → nouveaux défauts, versions +1).
- **Rapports honnêtes** : vérifié / non vérifié (vrai téléphone, déploiement réel) / décisions pour l'humain. **Les décisions produit sont consignées** (ex. « le Salon oublie », « un jour commencé est figé », « au-delà d'un rebord : un rebord »).
- **Mesurer plutôt que supposer** : coût de rejeu, taux de validation par thème, budget de requêtes, écritures en base, poids du chunk.
- Ordre de lots conseillé pour un dérivé : socle → cœur déterministe → contenu → rediffusion + golden → générateur + bot → classement → arrivée/partage/archives/mobile → **mise en ligne tôt** (ses contraintes d'hébergement changent l'architecture : le calcul de CPU, l'absence de tâche de fond) → feeling, variété (surfaces, thèmes, figures), juice, tactile, historique/démo, Salon, interface, CI fiable, identité.
- Modèles : effort moyen pour la plupart des lots ; le plus puissant pour la physique déterministe et les bugs multi-navigateurs.

## 9. Check-list « ne pas casser »
- [ ] Aucun `Math.random`/`Date`/fonction transcendante/import externe dans `sim` (test de pureté vert).
- [ ] Commandes entières, pas de `-0` ; vitesse maximale testée contre les rebords.
- [ ] Résultat de course changé ⇒ `SIM_VERSION`+1 ; circuit d'une date changé ⇒ `GENERATOR_VERSION`+1 ; puis golden, `history:seed`, `measure:generator`.
- [ ] Le serveur rejoue toujours ; aucun temps annoncé n'est cru (jour, Salon, démo, spectateur compris).
- [ ] Le rendu et l'interface ne modifient pas la sim ; tout effet tient dans ses pools et se coupe par réglage.
- [ ] Le jeu marche sans API ; les joueurs `demo` n'existent pas en production ; aucun secret dans le dépôt ni les journaux.
- [ ] Toute requête SQL passe sur SQLite **et** libSQL ; aucune tâche de fond indispensable.
- [ ] Nouveau paramètre d'URL ⇒ option dans `adminLogic.ts` ; nouveau comportement chiffré ⇒ test à seuils ; texte en français ; cibles tactiles ≥ 44 px, vérifiées portrait et paysage.
- [ ] CI verte (Chromium, Firefox, WebKit) ; aucun test désactivé ni affaibli ; un test instable est une dette nommée.
