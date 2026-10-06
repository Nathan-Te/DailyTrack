# Circuit du Jour — synthèse pour l'agent orchestrateur

Document de **reprise** : il résume les lots 0 à 6, l'état du dépôt, les règles à ne pas casser, la méthode de travail et la suite. Il ne remplace pas `docs/seed.md` (source de vérité du projet, modifiée par Nathan seulement) ni les README de lots (`docs/lots/`, un par lot, avec le détail et les critères). Mis à jour à la fin du lot 6 (06/10/2026).

## 1. Le projet en trois lignes
Jeu web de course quotidien : **un circuit court (30–60 s) par jour, le même pour tout le monde**, généré à partir de la date, joué dans le navigateur. Le **temps est une preuve** : la physique est déterministe, une course est la suite des commandes du joueur, et le serveur la **rejoue** pour valider le temps. Pas de compte : un pseudo et un identifiant aléatoire dans le navigateur. Partage en une ligne : `Circuit du Jour #142 — 47,312 s — 🥇 — 23e/812`.

## 2. État des lots

| Lot | Contenu | PR | Critère « à tester » |
|---|---|---|---|
| 0 Socle | Monorepo npm, Vite + Three.js, `packages/sim`, Vitest, CI, aperçus | #1 | l'aperçu s'ouvre |
| 1 Voiture | Physique arcade déterministe (120 Hz), clavier + manette, caméra poursuite, scénario `plat` | #3 | la conduite est agréable ? |
| 2 Blocs | Circuits en blocs sur grille, rebords, pentes, tremplin, plaques, portes, chrono, reprise | #6 | un tour complet chronométré |
| 3 Rediffusion | Enregistrement des commandes, rejeu exact, fantôme du meilleur temps, test Node ↔ navigateurs | #7 | le fantôme refait ton tour |
| 4 Circuit du jour | Générateur à partir de la date, pilote de validation, temps d'auteur, médailles, palettes | #8 | 3 dates = 3 circuits jouables |
| 5 Classement | API (Node/SQLite + Workers/D1), rejeu serveur, pseudo, classement, fantômes du premier et du joueur devant | #9 | deux appareils, deux temps, un classement |
| 6 Arrivée & archives | Ligne à partager, boutons, archives, menu cliquable, chargement et mise en page mobile | #10 | copier le résultat ; archives ; mobile |
| (correctif) | CI rouge du lot 6 : fantôme annoncé en pleine course, mise en page robuste à la police | #11 (ouverte) | — |

Un PR à part : #5 (aperçu GitHub Pages par branche). **Reste à faire du plan** : le *jalon* « une semaine de circuits joués par Nathan et quelques amis », et « Ensuite » du seed (commandes tactiles, thèmes visuels, circuit du dimanche, portail de jeux).

## 3. Architecture

```
packages/sim   Simulation PURE (aucun DOM / Three.js / Node) — le cœur partagé
apps/web       Le jeu (Vite + Three.js) : affiche ce que calcule sim
apps/api       Le classement : importe le MÊME sim pour rejouer les courses
docs/          seed.md (source de vérité), lots/ (un README par lot), ce document
```

**`packages/sim`** (TypeScript, testé par Vitest) : `math` (sin/cos maison), `car` (physique, `stepCar`), `track` (blocs, grille, `parseTrack`), `world` (sol, pentes, rebords), `race` (portes, chrono, reprises : `stepRace`), `replay` (enregistrer / encoder base64url / décoder / `replayRace`), `rng` + `calendar` (graine et dates sans `Date`), `autopilot` (pilote de validation), `generator` (`dailyCircuit(jour)`), `circuits` (circuit d'essai écrit à la main).

**`apps/web`** : `main.ts` (boucle à pas fixe, rendu interpolé, HUD), `session.ts` (`RunSession` : course + enregistrement + fantôme), `trackMesh.ts` (rendu du circuit, 4 palettes), `input.ts` (clavier ZQSD/WASD, flèches, manette), `online.ts` / `api.ts` / `identity.ts` (classement, pseudo, fantômes distants), `share.ts` / `clipboard.ts` / `archive.ts` / `records.ts` (partage, archives, records locaux), `verify.html` (rejeu sans rendu, pour les tests de navigateur).

**`apps/api`** : `api.ts` (cœur : n'utilise que `Request`/`Response` et l'interface `SqlDb`), adaptateurs Node + SQLite (`server.ts`, `Dockerfile`) et Cloudflare Workers + D1 (`worker.ts`, `wrangler.toml`).

**Flux d'une course** : le joueur conduit → `RunSession` applique et enregistre une commande entière par pas de 1/120 s → à l'arrivée, le record local est gardé avec sa rediffusion → envoi à `POST /api/submit` → le serveur régénère le circuit du jour (mis en cache en base), **rejoue** la rediffusion, enregistre **son** temps → rang, classement, fantômes.

## 4. Règles à ne pas casser

1. **Déterminisme de `sim`** : pas fixe 120 Hz ; pas de `Math.sin/cos/exp/pow/hypot/atan2`, `Math.random`, `Date`, `**`, import externe dans `packages/sim/src` (le test `purete.test.ts` le vérifie). Opérations permises : `+ − × ÷`, `sqrt`, `floor/round/abs/min/max`, `Math.imul`. Commandes entières, jamais de `-0` (`makeInput`).
2. **Ne jamais faire confiance à un temps annoncé** : seul le résultat d'un rejeu serveur compte. Un joueur n'existe qu'après une course valide.
3. **Deux numéros de version** (`packages/sim/src/constants.ts`), à incrémenter dès que le résultat d'une course ou le circuit d'une date change :
   - `SIM_VERSION` (physique, blocs, circuit d'essai) → régénérer la rediffusion de référence : `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`
   - `GENERATOR_VERSION` (règles du générateur, pilote, fenêtre de durée 28–48 s) → `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`
   Valeurs actuelles : **1 et 1**. L'id d'un circuit du jour est `jour-AAAA-MM-JJ-g<GENERATOR_VERSION>`. Les tests « golden » comparent **au bit près** : s'ils cassent, quelque chose a changé la physique ou les circuits.
4. **Une seule vérité pour le temps** : le chrono est en pas de simulation affiné par interpolation, en millisecondes entières.
5. **Sécurité de l'API** : requêtes SQL paramétrées, pseudo validé et affiché en `textContent`, corps de requête borné, limitation de débit avant tout rejeu, adresses hachées. Voir `docs/lots/lot-5-classement.md`.
6. **Le jeu marche sans API** (pas d'adresse configurée = pas de classement, rien d'autre ne change).

## 5. Commandes

```
npm install · npm run dev · npm test (Vitest, ~180 tests) · npm run typecheck · npm run build
npm run test:e2e         # construit web + api, lance Playwright (Chromium) ; démarre le vrai serveur de classement
  CHROMIUM_PATH=/opt/pw-browsers/chromium   # Chromium déjà installé (conteneur)
  E2E_ALL_BROWSERS=1                         # + Firefox et WebKit (ce que fait la CI)
API en local : npm run build:node -w @cdj/api && DB_PATH=:memory: npm start -w @cdj/api   → jeu avec ?api=http://localhost:8787
Réglages d'URL du jeu : ?seed=AAAA-MM-JJ · ?scenario=essai|plat · ?api=… · ?ghost=off
Outils de test (avec ?debug) : window.__cdj, timescale=N, today=AAAA-MM-JJ, __cdj.autoplay(code)
```

**CI** (`.github/workflows/`) : `ci.yml` (job `test` : typecheck + Vitest + build ; job `e2e` : Playwright sur Chromium, Firefox et WebKit — le test de déterminisme Node ↔ navigateurs tourne dans les trois), `pages.yml` (publie `main` à la racine et chaque branche sous `/b/<branche>/` sur la branche `gh-pages`), `preview.yml` (Cloudflare Pages, ignoré sans secrets). Les tests de **rendu 3D** ne tournent que dans Chromium (WebGL).

## 6. Méthode de travail (seed § 8 + pratique)

- **Un lot = une session neuve = une branche = une PR** (brouillon). Les README de lot tiennent en une page ; le prompt de lot précise les modifications du `CLAUDE.md`. L'agent s'arrête quand les critères du lot sont verts.
- **Après la fusion d'une PR**, repartir de `main` à jour (`git fetch origin main && git checkout -B <branche> origin/main`) : une PR fusionnée ne se réutilise pas.
- **Environnement cloud** : pas de `gh` ; passer par les outils GitHub (MCP). Pousser sur la branche désignée, ouvrir la PR en brouillon, la surveiller (abonnement aux événements) jusqu'à la fusion ; ne jamais désactiver un test pour être vert.
- **Avant de pousser** : `npm run typecheck && npm test`, puis `npm run test:e2e` pour tout ce qui touche au rendu, à l'API ou au partage. Mesurer plutôt que supposer (chargement, coût de calcul).
- **Rapports honnêtes** : dire ce qui est vérifié (et comment), ce qui ne l'est pas (CI pas encore passée, vrai téléphone, déploiement réel), et les décisions qui reviennent à Nathan. Les PR décrivent « À tester », « Garde-fous », « Vérifications faites » et « Non vérifié ».
- **Modèles** : Sonnet en effort moyen suffit pour la plupart des lots ; Opus seulement si la physique déterministe résiste.

## 7. Décisions prises et questions ouvertes

**Décidé**
- Monorepo npm workspaces, TypeScript, Three.js ; physique **maison** (pas de moteur externe) ; cellules de 32 m, route de 14 m ; blocs : droit, virages, montée/descente, bosse, tremplin, plaque ; pas de banquettes ni de boucles (hors premier jalon).
- Générateur par segments + validation par pilote (4 vitesses de virage essayées) ; fenêtre de durée du pilote 28–48 s ; médailles : or ×1,08, argent ×1,20, bronze ×1,40 du temps de l'auteur.
- Classement : meilleur temps par joueur et par jour, égalité départagée par l'ordre d'arrivée ; seul le jour courant (UTC) accepte des temps, avec 10 min de grâce après minuit ; jours passés consultables et figés.
- Identité : identifiant aléatoire + pseudo dans `localStorage` (changer de navigateur = nouveau joueur, accepté).
- Touche **H** pour les archives (**A** sert à tourner à gauche).

**Ouvert — à trancher par Nathan**
1. **Hébergement de l'API.** Le seed suppose que le gratuit suffit ; **faux sur Cloudflare Workers** : l'offre gratuite limite à 10 ms de calcul par requête, or rejouer une course coûte ≈ 6 ms et générer un circuit 35–500 ms. Options : serveur de Nathan en Docker (recommandé, aucune limite) ou Workers Paid (5 $/mois). Rien n'est déployé ; pour brancher le jeu : variable GitHub `VITE_API_URL`. Détails et commandes : `docs/lots/lot-5-classement.md`.
2. **Seuils des médailles** : non calibrés sur de vrais joueurs (le pilote suit la ligne médiane et peut être battu). `MEDAL_FACTORS` et la fenêtre de durée se règlent d'un coup (`generator.ts`), à faire après quelques circuits joués ; toute modification impose d'incrémenter `GENERATOR_VERSION`.
3. **Commandes tactiles** : non faites (« Ensuite » du plan). **Sur téléphone, le jeu se charge et s'affiche bien mais on ne peut pas conduire sans clavier ni manette.** Prérequis du jalon si des amis jouent sur mobile.

## 8. Pièges rencontrés (à éviter)

- **La CI n'a pas la même police que ma machine** (DejaVu Sans, large, contre une police étroite) : une mise en page « sans chevauchement » peut passer en local et échouer en CI. Le test `mobile.spec.ts` impose donc DejaVu Sans. Même idée pour tout test sensible aux dimensions.
- **Timing de la CI** (plus lente) : un test qui suppose « la course n'a pas encore démarré » est fragile ; attendre l'état voulu (`window.__cdj.phase`).
- **`-0`** : `Math.round(-0.3)` donne `-0` ; une commande enregistrée doit rester identique une fois encodée puis décodée.
- **Corps de requête refusé sans être lu** : fermer la connexion (`Connection: close`), sinon la requête suivante se bloque.
- **Création de joueurs** : seule une course valide en crée un (renommer un inconnu est refusé), sinon la base se remplit sans jouer.
- **Tests de classement et horloge réelle** : les e2e utilisent la date UTC du jour ; le serveur de test est neuf à chaque lancement (`reuseExistingServer: false`) ; les tests qui n'ont pas à toucher au vrai serveur simulent l'API (`page.route`) pour ne pas fausser les rangs.
- **Shell du conteneur** : `pkill -f <motif>` peut tuer le shell lui-même si le motif apparaît dans la commande ; tuer par PID.
- **Génération du circuit du jour** : coûteuse au premier appel (jusqu'à ~0,5 s) ; le serveur la met en cache en base.

## 9. Suite proposée (à confirmer avec Nathan)

| Lot | Objet | Critères d'arrêt |
|---|---|---|
| 7 Tactile | Commandes tactiles (volant glissé ou boutons, frein, reprise) + réglages de sensibilité | on finit un tour au doigt sur téléphone (test Playwright avec événements tactiles + essai réel) ; la mise en page reste sans chevauchement |
| 8 Mise en ligne | Hébergement de l'API (selon décision 1), `VITE_API_URL`, sauvegarde de la base, surveillance minimale, nom de domaine | `/api/health` répond en HTTPS ; deux vrais appareils classés ; la CI reste verte |
| 9 Calibrage | Régler médailles et durées d'après des courses réelles, tableau des temps de la semaine | médailles atteignables mais exigeantes ; `GENERATOR_VERSION` incrémenté et fixtures régénérées |
| Jalon | Une semaine de circuits joués par Nathan et quelques amis | retours consignés dans `docs/` |
| Ensuite | Thèmes visuels (décor), circuit dessiné du dimanche, éditeur, portail de jeux web | à définir |

**Modèle de prompt de lot** : *Contexte* (lien vers ce document et vers `docs/seed.md`, lot précédent fusionné) · *Objet* (une phrase) · *À livrer* (liste courte) · *Critères d'arrêt* (tests verts + « À tester » pour Nathan) · *Modifications de `CLAUDE.md`* (sections à ajouter ou changer) · *Hors périmètre* · *Règles rappelées* (§ 4 : déterminisme, versions, confiance) · *Rapport attendu* (vérifié / non vérifié / décisions pour Nathan).

## 10. Index
- `docs/seed.md` — vision, piliers, plan en lots (source de vérité)
- `docs/lots/lot-0-socle.md` … `lot-6-arrivee-et-archives.md` — le détail de chaque lot (livré, à tester, garde-fous, limites)
- `CLAUDE.md` — consignes courtes de l'agent (structure, commandes, règles de déterminisme, sections par lot)
- `apps/api/wrangler.toml`, `apps/api/Dockerfile` — déploiement de l'API
