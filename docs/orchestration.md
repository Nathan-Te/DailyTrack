# Circuit du Jour — synthèse pour l'agent orchestrateur

Document de **reprise** : il résume les lots 0 à 12, l'état du dépôt, les règles à ne pas casser, la méthode de travail et la suite. Il ne remplace pas `docs/seed.md` (source de vérité du projet, modifiée par Nathan seulement) ni les README de lots (`docs/lots/`, un par lot, avec le détail et les critères). Mis à jour à la fin du lot 12 (07/10/2026).

## 1. Le projet en trois lignes
Jeu web de course quotidien : **un circuit court (30–45 s) par jour, le même pour tout le monde**, généré à partir de la date, joué dans le navigateur. Le **temps est une preuve** : la physique est déterministe, une course est la suite des commandes du joueur, et le serveur la **rejoue** pour valider le temps. Pas de compte : un pseudo et un identifiant aléatoire dans le navigateur. Partage en une ligne : `Circuit du Jour #142 — 37,312 s — 🥇 — 23e/812`.

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
| (correctif) | CI rouge du lot 6 : fantôme annoncé en pleine course, mise en page robuste à la police | #11 | — |
| 7 Conduite | Modèle bicyclette + 4 ressorts + balistique, dérapage au frein, rebords par impulsion, reprise avec la vitesse, virage large L2/R2, `CarParams`/`SurfaceParams`, panneau `?debug&tune`, caméras C, pilote sur trajectoire de course ; versions 2/2 | #13 | la sensation sur `?scenario=pilotage`, puis réglages au panneau → ⏸ retouche 7b |
| 7b Réglages | Les réglages de Nathan (copiés du panneau) deviennent les valeurs par défaut de `CarParams` (pointe 48 m/s, dérapage plus doux, rebords plus durs) ; règle « deux droites derrière une plaque » dans le générateur, marge du pilote ; versions 3/3 | #15 | la sensation sur `?scenario=pilotage` |
| 8 Surfaces & thèmes | Revêtements terre / glace / herbe (attribut du bloc), blocs à effet super turbo et moteur coupé, virages relevés (serré et large), 5 thèmes tirés de la date (palette, zones de revêtement, effets, passage signature), `?scenario=surfaces`, `?theme=` (essai, jamais classé), pilote conscient des revêtements ; versions 4/4 | #16 | `?scenario=surfaces` et un circuit par thème |
| 9 Feel & juice | Voiture low-poly originale (4 roues, suspension visible, feux stop, fantôme bleu), effets (fumée, traces, particules par revêtement, étincelles, flammes, réception, secousse, coup de FOV, lignes de vitesse, éclair, confettis), sons Web Audio procéduraux (moteur à rapports simulés, crissement, roulement, vent, impacts…), touche M, qualité automatique, `?demo` ; **aucun changement de `sim`** | #16 | `?scenario=surfaces&demo`, puis `?scenario=pilotage` à la main |
| 9b Visuels | Traces de pneus aux roues arrière (enfin visibles), voiture refaite (sections lissées, bandes, roues à branches, freins), ombre, ciel dégradé, soleil / lune, montagnes, décor par thème, tribune, lignes de rive ; **aucun changement de `sim`** | #16, #18 | une course sur chaque thème, freiner en braquant ; `/admin/` ; touches N (circuit au hasard) et T (thème suivant) ; tremplin lisible |
| 10 Tactile (fait **avant** les lots 8 et 9, à la demande de Nathan) | Commandes tactiles : glissement ou boutons ← →, frein à droite, accélérateur auto ou bouton gaz, pause, reprise / départ, réglages mémorisés, invitation portrait, plein écran, vibrations ; `?touch=1` ; outils de test pas à pas | #14 | finir un tour au doigt sur téléphone |
| 10b Zones tactiles | Zones actives sans trou définies une fois (`zoneSpans`, `buttonRects`), boutons dessinés compacts et écartés des zones sûres, barre d'actions compacte hors des frontières (elle volait les appuis), `lostpointercapture` retiré, réglage taille des boutons, `?steer=`, `?zones=1` ; **aucun changement de `sim`** | (cette PR) | boutons ← → et frein sur ton téléphone, avec `zones=1` |
| 11 Historique | `PREMIER_JOUR` (n° 1, provisoirement 22/09/2026, remplace `LAUNCH_DAY`), pilotes fictifs `npm run history:seed` (14 jours × 8–15 pilotes, courses validées par le vrai code de l'API, joueurs `demo`), mode `?api=demo` (jeu de données statique, lecture seule), `?day=`, archives enrichies (médailles, pilotes, ta place figée), ouverture d'un jour avec fantôme du premier et classement figé ; **aucun changement de `sim`** hors la constante | #21 | `?api=demo`, touche H, `?api=demo&day=2026-09-30` |
| 12 Circuits amples | Trois largeurs de route (14 / 20 / 26 m, attribut de bloc `e` `n` `l`) et **blocs de transition** (`S/e>l`, rebords lissés, sans marche), **virage ample** `L3` / `R3` (3 × 3 cellules), générateur refait : courbes larges ou amples, **au plus 2 virages serrés** (jamais deux de suite, jamais sur la route large), **au moins deux largeurs** par circuit selon le thème, temps de l'auteur **30–40 s** ; pilote sur la largeur (corde plus ouverte) ; `?scenario=largeurs` ; **script de mesure** `npm run measure:generator` ; versions 5/5, `history:seed` relancé | (à créer) | `?scenario=largeurs`, puis un circuit par thème |

Un PR à part : #5 (aperçu GitHub Pages par branche). **Reste à faire du plan** : mise en ligne, calibrage et le *jalon* « une semaine de circuits joués par Nathan et quelques amis ». Le lot 10 ne dépend que du lot 7.

## 3. Architecture

```
packages/sim   Simulation PURE (aucun DOM / Three.js / Node) — le cœur partagé
apps/web       Le jeu (Vite + Three.js) : affiche ce que calcule sim
apps/api       Le classement : importe le MÊME sim pour rejouer les courses
docs/          seed.md (source de vérité), lots/ (un README par lot), ce document
```

**`packages/sim`** (TypeScript, testé par Vitest) : `math` (sin/cos maison), `car` (physique, `stepCar`), `track` (blocs, grille, largeurs de route et transitions, `parseTrack`), `world` (sol, pentes, rebords), `race` (portes, chrono, reprises : `stepRace`), `replay` (enregistrer / encoder base64url / décoder / `replayRace`), `rng` + `calendar` (graine et dates sans `Date`), `autopilot` (pilote de validation), `generator` (`dailyCircuit(jour)` : largeurs, courbes amples, virages serrés limités), `themes` (poids de largeur par thème), `circuits` (circuit d'essai écrit à la main).

**`apps/web`** : `main.ts` (boucle à pas fixe, rendu interpolé, HUD), `session.ts` (`RunSession` : course + enregistrement + fantôme), `trackMesh.ts` (rendu du circuit, 4 palettes), `input.ts` (clavier ZQSD/WASD, flèches, manette), `online.ts` / `api.ts` / `identity.ts` (classement, pseudo, fantômes distants), `share.ts` / `clipboard.ts` / `archive.ts` / `records.ts` (partage, archives, records locaux), `verify.html` (rejeu sans rendu, pour les tests de navigateur).

**`apps/api`** : `api.ts` (cœur : n'utilise que `Request`/`Response` et l'interface `SqlDb`), adaptateurs Node + SQLite (`server.ts`, `Dockerfile`) et Cloudflare Workers + D1 (`worker.ts`, `wrangler.toml`). `history.ts` + `scripts/history-seed.ts` (lot 11 : pilotes fictifs et jeu de données de démonstration, `npm run history:seed`).

**Depuis les lots 9 à 11 (`apps/web`)** : `carMesh.ts` (voiture, ombre), `fx.ts` (particules, traces de pneus, `QualityGovernor`), `telemetry.ts`, `audio.ts` + `audioLogic.ts` (sons procéduraux), décor et ciel dans `trackMesh.ts`, `demo.ts` (`DemoApi`, mode `?api=demo`) et `archiveExtras.ts` (archives enrichies), page `admin/` (`admin.ts`, `adminLogic.ts`), données statiques `public/demo/` (générées, ne pas éditer à la main).

**Flux d'une course** : le joueur conduit → `RunSession` applique et enregistre une commande entière par pas de 1/120 s → à l'arrivée, le record local est gardé avec sa rediffusion → envoi à `POST /api/submit` → le serveur régénère le circuit du jour (mis en cache en base), **rejoue** la rediffusion, enregistre **son** temps → rang, classement, fantômes.

## 4. Règles à ne pas casser

1. **Déterminisme de `sim`** : pas fixe 120 Hz ; pas de `Math.sin/cos/exp/pow/hypot/atan2`, `Math.random`, `Date`, `**`, import externe dans `packages/sim/src` (le test `purete.test.ts` le vérifie). Opérations permises : `+ − × ÷`, `sqrt`, `floor/round/abs/min/max`, `Math.imul`. Commandes entières, jamais de `-0` (`makeInput`).
2. **Ne jamais faire confiance à un temps annoncé** : seul le résultat d'un rejeu serveur compte. Un joueur n'existe qu'après une course valide.
3. **Deux numéros de version** (`packages/sim/src/constants.ts`), à incrémenter dès que le résultat d'une course ou le circuit d'une date change :
   - `SIM_VERSION` (physique, blocs, circuit d'essai) → régénérer la rediffusion de référence : `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden.test.ts`
   - `GENERATOR_VERSION` (règles du générateur, pilote, fenêtre de durée 30–40 s) → `UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts`
   Valeurs actuelles : **5 et 5** (lot 12 : largeurs de route, virage ample, générateur refait, fenêtre 30–40 s). L'id d'un circuit du jour est `jour-AAAA-MM-JJ-g<GENERATOR_VERSION>`. Les tests « golden » comparent **au bit près** : s'ils cassent, quelque chose a changé la physique ou les circuits. **Après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION` : golden, `npm run history:seed` et `npm run measure:generator`** (toute règle de générateur se valide par le script de mesure, pas seulement par les tests).
4. **Une seule vérité pour le temps** : le chrono est en pas de simulation affiné par interpolation, en millisecondes entières.
5. **Sécurité de l'API** : requêtes SQL paramétrées, pseudo validé et affiché en `textContent`, corps de requête borné, limitation de débit avant tout rejeu, adresses hachées. Voir `docs/lots/lot-5-classement.md`.
6. **Le jeu marche sans API** (pas d'adresse configurée = pas de classement, rien d'autre ne change).
7. **Les joueurs `demo` n'existent jamais en production** (lot 11) : les pilotes fictifs vivent dans un jeu de données statique (`apps/web/public/demo/`), fabriqué par `npm run history:seed` dans une base en mémoire et validé par le vrai code de l'API ; **relancer le script après tout changement de `SIM_VERSION` ou `GENERATOR_VERSION`** (un test le rappelle). `PREMIER_JOUR` ne change que la numérotation des circuits.

## 5. Commandes

```
npm install · npm run dev · npm test (Vitest, ~300 tests) · npm run typecheck · npm run build
npm run test:e2e         # construit web + api, lance Playwright (Chromium) ; démarre le vrai serveur de classement
  CHROMIUM_PATH=/opt/pw-browsers/chromium   # Chromium déjà installé (conteneur)
  E2E_ALL_BROWSERS=1                         # + Firefox et WebKit (ce que fait la CI)
API en local : npm run build:node -w @cdj/api && DB_PATH=:memory: npm start -w @cdj/api   → jeu avec ?api=http://localhost:8787
npm run history:seed     # (re)fabrique les archives de démonstration (apps/web/public/demo/), ≈ 10 s, déterministe
npm run measure:generator  # lot 12 : durées d'auteur, largeurs, virages serrés, génération, rejeu (60 dates) + taux de validation par thème ; FAST=1 pour aller vite, ≈ 25 s sinon
Page d'outils de test : `<base>/admin/` (menu qui construit l'adresse du jeu). Réglages d'URL du jeu : ?seed=AAAA-MM-JJ (ou ?day=) · ?api=demo (archives de démonstration) · ?scenario=essai|pilotage|surfaces|largeurs|plat · ?touch=1 · ?steer=boutons|glisser · ?zones=1 · ?api=… · ?ghost=off · ?demo · ?fx=off · ?quality=0|1|2 · ?shake=0 · touche M (son)
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
- Monorepo npm workspaces, TypeScript, Three.js ; physique **maison** (pas de moteur externe) ; cellules de 32 m, route de 14 m ; blocs : droit, virages (serrés, larges, **relevés** depuis le lot 8), montée/descente, bosse, tremplin, plaque, super turbo, moteur coupé ; revêtements route / terre / glace / herbe ; **la décision « pas de banquettes » est levée** (virages relevés au lot 8) ; toujours pas de boucles ni de murs verticaux (hors premier jalon).
- Générateur par segments + validation par pilote ; fenêtre de durée du pilote **30–40 s** (lot 12, était 28–48 s) ; médailles : or ×1,08, argent ×1,20, bronze ×1,40 du temps de l'auteur.
- **Lot 8** : un revêtement est un attribut de **bloc** entier (pas de revêtement par zone de la route : l'herbe n'est donc pas un bas-côté, mais une surface lente que le circuit traverse) ; le thème vient de la date avec la même graine que l'ancienne palette (5 thèmes au lieu de 4 palettes : les circuits d'une date changent, `GENERATOR_VERSION` 4) ; un thème forcé (`?theme=`) est un autre circuit, jamais classé ; le moteur coupé est toujours suivi d'un point de contrôle deux blocs plus loin ; un super turbo laisse cinq blocs sans virage derrière lui.
- **Lot 7b** : les réglages de Nathan remplacent les défauts du lot 7 (`lot-7b-reglages.md`) ; pointe **48 m/s**. Une plaque d'accélération doit être suivie de deux blocs sans virage (générateur et circuit d'essai) ; marge du pilote aux rebords 3,6 m (`WALL_MARGIN`). Les lots 8 et suivants partent de ces valeurs.
- **Lot 7** (valeurs du lot 7, avant la 7b) : vitesse de pointe 42 m/s (échelles du générateur inchangées) ; adhérence ≈ 40 m/s² puis glisse ; pas de migration des anciennes courses (aucun joueur réel) : l'API refuse une autre `SIM_VERSION` avec un message clair, les records locaux d'une autre version sont ignorés ; format de rediffusion inchangé (direction déjà analogique). Le pilote suit une trajectoire de course et essaie 4 niveaux d'adhérence (`PILOT_GRIPS`) ; virage large L2/R2 ajouté (le générateur en met une fois sur quatre). Les réglages par défaut sont provisoires : la retouche 7b appliquera ceux de Nathan.
- Classement : meilleur temps par joueur et par jour, égalité départagée par l'ordre d'arrivée ; seul le jour courant (UTC) accepte des temps, avec 10 min de grâce après minuit ; jours passés consultables et figés.
- Identité : identifiant aléatoire + pseudo dans `localStorage` (changer de navigateur = nouveau joueur, accepté).
- Touche **H** pour les archives (**A** sert à tourner à gauche).
- **Lot 12 — largeurs de route et circuits amples** : trois largeurs **14 / 20 / 26 m** (étroite = la largeur d'avant, donc les circuits écrits à la main et leurs références sont **inchangés au bit près**) ; la largeur est un attribut de bloc **chaîné** (un bloc sans largeur garde la précédente) et ne change que par un **bloc de transition** d'une cellule (lissage cubique, un cran à la fois dans le générateur) ; un virage garde sa largeur. Plaques à la moitié de la largeur. **Virage ample L3 / R3** (rayon 80 m, 3 × 3 cellules, 8 cellules réservées). **Virages serrés** : au plus 2 par circuit (signature comprise), jamais deux de suite, **jamais sur la route large** (géométriquement possible jusqu'à 26 m, rayon intérieur 3 m, mais sans intérêt de jeu). Les ex-« épingle » et « chicane » serrées deviennent **demi-tour large** (`L2 L2`) et **S large** (`L2 R2`) ; signatures *Banquise* = chicane large sur glace, *Campagne* = étranglement (14 m) suivi d'un virage serré sur la terre. Largeurs par thème : *Stade* et *Banquise* larges, *Rallye* et *Campagne* étroits, *Nuit* mélangé. Marge du pilote aux rebords **conservée** (3,6 m) : la corde s'ouvre seule avec la largeur.
- **Lot 11 — `PREMIER_JOUR` provisoire (22/09/2026)** : il fixe le numéro n° 1 pour avoir deux semaines d'archives avant la mise en ligne ; **à régler sur la vraie date de lancement à la mise en ligne** (une ligne de `calendar.ts`, puis régénérer les numéros du golden des circuits et, si l'on veut, `history:seed`). Les pilotes `demo` n'existent que dans le jeu de données statique (`apps/web/public/demo/`), jamais dans une base de production ; en démo « aujourd'hui » est figé à `DEMO_TODAY` (lendemain de l'historique).

**Ouvert — à trancher par Nathan**
1. **Hébergement de l'API.** Le seed suppose que le gratuit suffit ; **faux sur Cloudflare Workers** : l'offre gratuite limite à 10 ms de calcul par requête, or rejouer une course coûte ≈ 10–12 ms depuis le lot 7 (≈ 6 ms avant) et générer un circuit ~100 ms en moyenne. Options : serveur de Nathan en Docker (recommandé, aucune limite) ou Workers Paid (5 $/mois). Rien n'est déployé ; pour brancher le jeu : variable GitHub `VITE_API_URL`. Détails et commandes : `docs/lots/lot-5-classement.md`.
2. **Seuils des médailles** : non calibrés sur de vrais joueurs (depuis le lot 7 le pilote suit une trajectoire de course, mais ne dérape pas : un bon joueur le bat de quelques %). `MEDAL_FACTORS` et la fenêtre de durée se règlent d'un coup (`generator.ts`), à faire après quelques circuits joués ; toute modification impose d'incrémenter `GENERATOR_VERSION`.
3. ~~**Commandes tactiles**~~ **résolue au lot 10** : on conduit au doigt (glissement + frein, accélérateur automatique). **À confirmer sur un vrai téléphone** (aucun testé : gestes synthétiques seulement) ; zones corrigées à la retouche 10b, à confirmer avec `?zones=1`.

## 8. Pièges rencontrés (à éviter)

- **La CI n'a pas la même police que ma machine** (DejaVu Sans, large, contre une police étroite) : une mise en page « sans chevauchement » peut passer en local et échouer en CI. Le test `mobile.spec.ts` impose donc DejaVu Sans. Même idée pour tout test sensible aux dimensions.
- **Timing de la CI** (plus lente) : un test qui suppose « la course n'a pas encore démarré » est fragile ; attendre l'état voulu (`window.__cdj.phase`).
- **`-0`** : `Math.round(-0.3)` donne `-0` ; une commande enregistrée doit rester identique une fois encodée puis décodée.
- **Corps de requête refusé sans être lu** : fermer la connexion (`Connection: close`), sinon la requête suivante se bloque.
- **Création de joueurs** : seule une course valide en crée un (renommer un inconnu est refusé), sinon la base se remplit sans jouer.
- **Tests de classement et horloge réelle** : les e2e utilisent la date UTC du jour ; le serveur de test est neuf à chaque lancement (`reuseExistingServer: false`) ; les tests qui n'ont pas à toucher au vrai serveur simulent l'API (`page.route`) pour ne pas fausser les rangs.
- **Shell du conteneur** : `pkill -f <motif>` peut tuer le shell lui-même si le motif apparaît dans la commande ; tuer par PID.
- **Génération du circuit du jour** : coûteuse au premier appel (jusqu'à ~0,5 s) ; le serveur la met en cache en base.

- **Physique (lot 7)** : un modèle bicyclette part en tête-à-queue à la limite si l'arrière accroche moins que l'avant — garder l'arrière un peu plus fort (47 / 44). Un dérapage obtenu seulement en baissant l'adhérence arrière finit en toupie : l'angle de dérive est tenu par un rappel amorti (`DRIFT_SPRING` / `DRIFT_DAMPING`).
- **Restes flottants** : sans seuil, une voiture « arrêtée » garde 1e-18 m/s de glisse ; à l'arrêt sur le plat sans commande, on remet tout à 0. Après l'arrivée, le frein à fond faisait reculer : on freine tant qu'on avance, puis plus rien.
- **Mesurer le coût du rejeu** : 2 sous-pas × 4 roues l'ont doublé (≈ 10–12 ms par course) ; les échantillons de sol de fin de sous-pas sont réutilisés au suivant, et la trajectoire du pilote est calculée une fois par circuit (`WeakMap`).
- **Bandeau pendant le décompte** : il est réécrit à chaque image (3, 2, 1) ; un test qui attend un message dans `#banner` doit attendre `phase === "racing"`.
- **Tests tactiles** : `Input.dispatchTouchEvent` de type `touchEnd` attend **le doigt qu'on lève**, pas ceux qui restent posés (sinon on lève le mauvais). Un test « boucle fermée » (lire l'état, pousser le pouce) ne doit pas dépendre de l'horloge : sous charge, le jeu avance moins vite que le temps réel (rendu logiciel). Utiliser `__cdj.manual(true)` + `__cdj.advance(n)` (pas à pas, sans rendu) : 22 s, stable avec 3 navigateurs en parallèle, contre un échec sur trois en temps réel. Ne pas exiger un nombre exact d'événements dont l'occurrence dépend du glissement (chocs successifs le long d'un rebord).
- **Zones tactiles (10b)** : un petit bouton (barre d'actions, menu) attire les appuis à ≈ 12 px (correction du toucher du navigateur) : placé au milieu d'une zone, il met en pause ou ouvre une fenêtre qui avale les appuis suivants. Garder la barre loin des frontières entre zones ; dans les tests d'appui, ne pas viser sous les petits boutons. Dans un test `dispatchTouchEvent`, le même identifiant de doigt est réutilisé : ne pas lever un doigt sur `lostpointercapture`. Lire la commande après un toucher demande parfois quelques pas (`settle` dans `tactile.spec.ts`).
- **Mise en page tactile** : les boutons de menu passent à 44 px, ce qui a fait déborder la pile d'infos en portrait (médailles, chrono, fantôme, temps intermédiaires) : `mobile.spec.ts` l'a vu avant moi. En mode tactile, l'accélérateur automatique oblige à **figer** le jeu quand une fenêtre (archives, réglages) est ouverte, sinon la voiture roule pendant qu'on lit.
- **Réglages de physique et pilote (7b)** : changer la pointe ou la dureté des rebords peut rendre des circuits générés infranchissables **sans que le pilote soit en cause** : une plaque (poussée 30 m/s² pendant 0,9 s) lutte contre le frein (40 m/s²), donc un virage serré trop près derrière elle ne se prend pas. Après tout changement de `CarParams`, **mesurer le taux de circuits validés** (pas seulement « les tests passent » : la génération retombait sur 70 échecs sur 91 en silence, ralentie à 68 s). Un décollage (bosse, tremplin) coupe aussi tout freinage.
- **Lot 8 — chaque nouvel effet de piste crée une règle de générateur** : une plaque (poussée 30 contre frein 40 pendant 0,9 s) puis un super turbo (42 contre 40 pendant 1,5 s) interdisent un virage serré trop près derrière ; **mesurer le taux de circuits validés par thème** (script : pour chaque thème, 12 jours × 6 tentatives, pilote à 4 niveaux d'adhérence) plutôt que de supposer. Un décollage (bosse, tremplin) coupe tout freinage : « plaque, bosse, virage » ne passe pas.
- **Virage relevé** : le bord intérieur est en contrebas et la rampe d'entrée est raide : un pilote qui colle à l'intérieur décolle ; le garder près de l'axe (1,5 m) et lui faire retrancher le travail de la pesanteur (g × pente) de son braquage. Dans `collide`, comparer la hauteur de la voiture à celle du sol **réel** (relevé compris), sinon on survole le rebord extérieur.
- **Après l'arrivée**, une plaque sous la voiture à l'arrêt la relançait (frein 40 contre plaque 30 : équilibre à 0,5 m/s) : couper les effets à la ligne (`withoutEffects`).
- **Un test de comparaison doit donner à chaque camp les mêmes essais** : « dérapage plus rapide que grip » comparait un dérapage à sept essais de grip.
- **Branche imposée** : l'environnement de session peut imposer un nom de branche différent de celui du prompt de lot (lot 7 : `claude/bold-thompson-ank8u1`) ; le lien d'aperçu suit le nom réel (`/b/<branche avec - au lieu de />/`).
- **Lot 9 — perf et audio** : en CI et en conteneur le rendu est **logiciel** (SwiftShader, ~8 images/s) : les images par seconde ne disent rien, mesurer le **temps de fil principal par image** (CDP `Performance.getMetrics`, `Emulation.setCPUThrottlingRate`) avant / après avec le même script et les mêmes rediffusions. Un test d'effet en pas à pas doit avancer par **petits paquets de pas** (`advance(8)`) : les effets lisent l'état de chaque *image*, un saut de 120 pas ne montre que l'état final (le dérapage a fini). Le contexte audio n'existe pas avant un geste : tests et code doivent tolérer `running = false` ; on vérifie ce qui est *joué* (`__cdj.audio.log`), jamais comment ça sonne. Pas de `pkill -f` (voir plus haut).
- **9b — un effet « compté » n'est pas un effet « vu »** : les traces de pneus du lot 9 n'ont jamais été visibles (`Float32BufferAttribute` copie le tableau passé : on écrivait à côté), alors que le compteur d'émission et les tests passaient. Pour un effet visuel, **regarder une capture** (en mode pas à pas `?debug`, `manual(true)` ne rend pas : mettre en pause avec P, repasser `manual(false)`, attendre une image, capturer) et tester l'état réel (`__cdj.fx.marks`).
- **Lot 11 — un test ancré sur `PREMIER_JOUR` change de circuit quand on déplace la constante** : les tests du générateur et de l'API valident des dates précises avec un pilote ; les ancrer sur des dates fixes (06/10 et 13/10/2026) plutôt que sur le premier jour. Seul le champ `number` du golden suit la constante. Un jeu de données généré doit être **déterministe** (graine fixe, aucune date ni `Math.random`), sinon chaque régénération salit le dépôt de fichiers « modifiés ».
- **Lot 12 — chaque règle de génération doit se compter** : un budget de virages serrés décrémenté seulement pour les virages « ordinaires » laissait passer un 3ᵉ virage serré dans un créneau signature **sans virage propre** (Nuit, Rallye) ; le script de mesure (`virages serrés : max 3`) l'a vu tout de suite. Écrire la règle (au plus 2) comme **test** *et* regarder le maximum mesuré.
- **Mesurer l'écart à une ligne brisée, pas au sommet le plus proche** : la ligne médiane d'une droite n'a un sommet que tous les 16 m ; « distance au point le plus proche » donnait 8 m d'écart pour une trajectoire pourtant bien centrée.
- **Comparer à l'ancien comportement** : avant de toucher aux rebords, vérifier qu'un circuit de 14 m rejoue **au bit près** (la référence `essai-autopilot.json` n'a changé que de numéro de version) ; le contact sur un rebord droit garde exactement l'ancienne formule (branche « pente nulle »).
- **`pkill -f` tue le shell** (vu encore au lot 12 en voulant arrêter `vite preview`) : repérer le PID avec `ps -eo pid,args | grep "[v]ite"` puis `kill <pid>`.
- **Un `main` local en retard** ne dit rien de l'état des PR : après `git fetch`, regarder `origin/main` (`git log origin/main`), pas le `main` local, pour savoir ce qui est fusionné.

## 9. Suite proposée (à confirmer avec Nathan)

Les lots 0 à 12 du plan du seed sont livrés ; restent les lots 13 (miniatures) et 14 (admin et planning), puis la mise en ligne. Reste :

| Étape | Objet | Critères d'arrêt |
|---|---|---|
| Mise en ligne | Hébergement de l'API (selon la décision 1 du § 7), `VITE_API_URL`, sauvegarde de la base, surveillance minimale, nom de domaine, **`PREMIER_JOUR` réglé sur la vraie date de lancement** (puis `UPDATE_GOLDEN=1` sur `golden-daily.test.ts` pour les numéros, et `history:seed` si l'historique doit suivre) | `/api/health` répond en HTTPS ; deux vrais appareils classés ; la CI reste verte |
| Calibrage | Régler médailles et durées d'après des courses réelles, tableau des temps de la semaine | médailles atteignables mais exigeantes ; `GENERATOR_VERSION` incrémenté, fixtures et `history:seed` régénérés |
| Jalon | Une semaine de circuits joués par Nathan et quelques amis | retours consignés dans `docs/` |
| Ensuite | Circuit dessiné du dimanche, éditeur, portail de jeux web | à définir |

À vérifier sur un **vrai téléphone** (rien n'a été essayé hors navigateur simulé) : commandes tactiles (lot 10), rendu et fluidité du décor (lot 9b), sons sur iOS (lot 9), archives (lot 11).

**Modèle de prompt de lot** : *Contexte* (lien vers ce document et vers `docs/seed.md`, lot précédent fusionné) · *Objet* (une phrase) · *À livrer* (liste courte) · *Critères d'arrêt* (tests verts + « À tester » pour Nathan) · *Modifications de `CLAUDE.md`* (sections à ajouter ou changer) · *Hors périmètre* · *Règles rappelées* (§ 4 : déterminisme, versions, confiance) · *Rapport attendu* (vérifié / non vérifié / décisions pour Nathan).

## 10. Index
- `docs/seed.md` — vision, piliers, plan en lots (source de vérité)
- `docs/lots/lot-0-socle.md` … `lot-12-circuits-amples.md` — le détail de chaque lot (livré, à tester, garde-fous, limites) ; `lot-7b-reglages.md`, `lot-9b-visuels.md`, `lot-10b-zones-tactiles.md` pour les retouches
- `docs/credits.md` — crédits (sons procéduraux, voiture originale, bibliothèques)
- `CLAUDE.md` — consignes courtes de l'agent (structure, commandes, règles de déterminisme, sections par lot)
- `apps/api/wrangler.toml`, `apps/api/Dockerfile` — déploiement de l'API
