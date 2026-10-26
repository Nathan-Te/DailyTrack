# La plateforme — synthèse

État de la plateforme de jeux quotidiens (DailyTrack, DailyJump) après le lot R5 (sécurité du serveur, mentions légales). **Partir d'ici** ; n'ouvrir un README de lot (`docs/plateforme/lots/`) que pour un détail. Vision : `docs/plateforme/seed-phase-2.md` (ne pas modifier). Consignes : `apps/api/CLAUDE.md` (serveur, plateforme, recette), `packages/profile/CLAUDE.md` (profil côté client), `apps/jump/CLAUDE.md`, `apps/web/CLAUDE.md`. Synthèses des jeux : `docs/orchestration.md` (DailyTrack), `docs/jump/synthese.md` (DailyJump).

## 1. En une phrase
Un seul serveur (`createApi`, Cloud Run + Turso), une seule identité, un seul pseudo et un seul code de transfert pour tous les jeux ; chaque jeu s'y branche par le **registre** ; tout ce qui est classé ou montré aux autres est **rejoué par le serveur** ; rien ne part en production sans la **recette** et la validation de Nathan. → P0, R1.

## 2. Le registre des jeux → P0
- `apps/api/src/games.ts` (types), `registry.ts` : `GAMES = [CDJ_GAME, JUMP_GAME]`. Une `GameDefinition` = code (`cdj`, `jump`), préfixe des routes, tables et leur `schema`, versions, `create(plateforme, options)` → `route`, `dailyLevel`, `validate` (rejeu), crochets `onRename`, `rotateStatements`, `profile`, `tick`.
- **Écrit une fois** (`platform.ts`, `identity.ts`, `players.ts`, `pseudos.ts`, `config.ts`, `log.ts`) : joueurs, pseudo (propriété du premier), profil, code, débit (envois **en base**, lectures **en mémoire**), corps de requête, jour de Paris, schéma (empreinte dans `meta`), journaux sans donnée personnelle.
- DailyTrack garde ses routes historiques sous `/api` ; un nouveau jeu prend `/api/<code>/`.

## 3. Les routes
**Communes** (P0 ; lot 30 de DailyTrack) : `GET /api/health` (inchangé depuis le lot 28) · `PUT /api/player` · `GET /api/name` · `GET /api/me` (profil **de DailyTrack**) · `POST /api/me/code` (« Changer mon code ») · **`POST /api/admin/effacer`** (R5 : effacement d'un joueur, jeton d'admin, code de transfert ; `docs/plateforme/effacement.md`) · `GET /api/sonde/entetes` (R5 : recette seulement).

**DailyTrack** (`cdj.ts`, `salon.ts`) : `/api/day/<date>`, `/api/submit`, `/api/day/<date>/leaderboard`, `/api/day/<date>/ghost`, `/api/planning`, `/api/admin/*`, `/api/salon/{now,<session>/board,<session>/ghosts,<session>/submit}` — voir `docs/orchestration.md`.

**DailyJump** (`jump.ts`, `jumpLives.ts`) :
| route | quoi | lot |
|---|---|---|
| `GET /api/jump/info` | versions, jour de Paris, jours figés, `environment` | P0 |
| `GET /api/jump/day/<date>` | le niveau tel que le serveur le calcule (figé d'abord, sinon généré) | P0 |
| `POST /api/jump/submit` | un essai, rejoué ; rend temps, morts, rang **et le classement** (P4) | P1, P4 |
| `GET /api/jump/day/<date>/board` | top 10, classés, ta ligne (`X-Player-Id`) | P1 |
| `GET /api/jump/day/<date>/ghost/first` | la rediffusion du premier | P2 |
| `GET /api/jump/me` | le profil DailyJump | P2 |
| `POST /api/jump/lives` | un lot de vies, chacune rejouée (30 morts par jour au plus) | P3 |
| `GET /api/jump/day/<date>/deaths` · `/carnage` | carte des morts · échantillon du carnage (≈ 150 vies) | P3 |
| **`GET /api/jump/day/<date>/bundle`** | **lecture regroupée** : classement, premier, carte (+ profil du jour avec `X-Player-Id`) | P4 |

**Portail** (lot I2, `portail.ts`) : `GET /api/portail/jour` (les jeux du jour, l'heure du serveur, le prochain minuit de Paris ; avec `X-Player-Id` : l'état du joueur dans chaque jeu, la série tous jeux confondus, les journées parfaites ; publique ≤ 60 s sans joueur, `private` avec) · `GET /api/portail/profil` (le profil commun). Chaque jeu déclare au registre ce que le portail montre de lui (crochet `portail` : numéro, thème, seuils, premier jour, état du joueur ; **lot I3** : son dossier sur le site (`site`), son nom (`nom`) et ses classés du jour (`classes`)) : `apps/api/CLAUDE.md`, « Portail (lot I2) ». **Lot I3** : `GET /api/portail/classement?date=` (le classement du jour tous jeux confondus : barème auteur 4 · or 3 · argent 2 · bronze 1, calculé au plus une fois par fenêtre de 45 s et par instance), le numéro de journée commun (journée n° 1 = 23/10/2026) et les points du joueur dans `jour` : « Portail (lot I3) ».

**En-têtes de cache (P4)** : lectures d'un jour fermé `max-age=86400`, du jour en cours `max-age=30` ; **tout ce qui dépend de `X-Player-Id` est `private` + `Vary: X-Player-Id`, jamais en cache partagé** ; le reste `public` ; erreurs, envois et DailyTrack : `no-store` (`cache.ts`).

## 4. Les tables et leur durée de vie
| table | contenu | durée de vie | lot |
|---|---|---|---|
| `players` | identifiant secret, pseudo réservé, dates | permanente | 5, 30, P0 |
| `revoked_codes` | empreintes des codes remplacés | permanente | 30 |
| `rate` | compteurs de débit des envois | ≈ 40 min (ménage au passage) | 5, P0 |
| `meta` | empreinte du schéma, rapports de migration ; **lot R8 : la génération de données** (l'instant de la remise à zéro du lancement) | permanente | 28, R8 |
| `results` | meilleur temps par joueur et par jour (DailyTrack) | permanente | 5 |
| `circuits`, `planning` | circuit du jour en cache, variantes choisies | permanente (cache recalculable) | 5, 14 |
| `salon_runs`, `salon_sessions`, `salon_circuits` | une session du Salon | **oubliée à fin + 20 s** | 27, 27b |
| `salon_presence`, `salon_throttle` | présence, débit du Salon | 10 min, 1 h | 27b |
| `jump_levels` | niveau du jour de chaque date (texte compris, jamais rendu) | permanente (cache recalculable) | P0 |
| `jump_results` | meilleur essai par joueur et par jour, avec sa rediffusion (lot I2 : et sa place finale, une fois le jour fermé) | permanente | P1, I2 |
| `jump_lives` | les vies du jour (une ligne par joueur) | **oubliée à la fin du jour** | P3 |
| `jump_deaths` | carte et échantillon du jour (une ligne par jour), figés à la fin du jour | permanente | P3 |

**Lot R8 — le lancement public** : toutes les tables ci-dessus liées à un joueur ou à une partie sont **vidées une fois**, le jour du partage, par le workflow « Lancement : remise à zéro » (`remiseAZero.ts`, liste calculée du schéma ; gardés : `planning`, `circuits`, `jump_levels`, `meta`) ; `docs/plateforme/lancement.md`. **Rien de tout cela n'est nettoyé par une tâche de fond** : l'oubli se fait à la première requête qui voit la session ou le jour terminé (Cloud Run éteint le conteneur). **Lot R5** : chaque table est décrite sur la page publique « Mentions légales et confidentialité » (`apps/portail/mentions-legales/`, test de fidélité `apps/portail/test/mentions.test.ts`) ; un joueur est effacé à sa demande par `POST /api/admin/effacer` (crochet `erase` de chaque jeu, ligne retirée des classements passés).

## 5. L'ordre de validation d'un envoi → P1, P3
Du moins cher au plus cher : (1) **débit compté en base**, avant de lire le corps — par adresse du joueur **et** (R5) par adresse de connexion (dernière entrée de `X-Forwarded-For`, × 10, en mémoire), qu'un appel direct à `run.app` ne peut pas inventer ; (2) **taille** du corps ; (3) **le niveau du jour seulement** (jour de Paris, grâce de 10 min ; archive, thème forcé, futur refusés) ; (4) **versions** (simulation, générateur, niveau du serveur → 409 « nouvelle version ») ; puis code révoqué (410), pseudo / joueur existant, plafonds ; (5) **rejeu** : seul le temps et les morts du serveur comptent. Jamais un temps annoncé. **R5** : juste avant le rejeu, le plafond global de l'instance (600 rejeux par minute, 503 `busy` au-delà).

## 6. Le client : profil commun et lectures → P0, P2, P4
- `@cdj/profile` (`packages/profile`) : identité `cdj:*`, code `CDJ2`, client, `ProfileSync` générique, pseudo, rotation ; stockage et réseau injectés. **Compteur de révision d'identité** (P4, `cdj:identite:rev`, `cdj:identite:code`) : avancé par tout changement d'identité (code chargé, rotation, création) ; chaque jeu le lit au démarrage (`identityRevisionSeen`) : un code chargé **dans un autre jeu** vide son cache de l'ancienne identité (DailyTrack : `applyIdentity` ; DailyJump : rangs et jours passés).
- Les deux jeux partagent l'origine (lot R4 : `playdujour.com`, `/track/` et `/jump/` ; avant : `nathan-te.github.io`) donc le stockage ; la recette et chaque aperçu sont d'autres origines (plus de préfixe `apercu:` dans les déploiements). Ils appellent `/api/` sur leur propre origine (aucun pré-vol CORS). **Lot R5** : plus d'import par l'adresse (le fragment `#dujour=…` du R4 est retiré) : le code de transfert est le seul moyen de déplacer un profil.
- DailyJump lit le jour **en une requête** (`dayReads.ts`), jamais deux fois en moins de 30 s, à l'arrivée seulement après 3 min ; l'envoi rend le classement ; le jeu ne bloque jamais sur le réseau (files hors ligne : classement P1, vies P3).

## 7. La recette et la production → R1, P2, P4, R4
- **Lot R4 (playdujour.com, `docs/plateforme/domaine.md`)** : Firebase Hosting sert le portail et les deux jeux ; `/api/**` renvoyé vers Cloud Run (même adresse). Flux : PR → **aperçu** (canal Firebase `pr-<n>`) → fusion → **recette** (`recette.playdujour.com` : serveur, `recette:seed`, site, à chaque fusion) → bouton **« Mettre en production »** (CI complète → figer avec le code en production → serveur, validation de Nathan → site → `smoke --lecture-seule` → étiquette `prod-…` → PR des jours figés). Retour arrière : `retour-arriere.yml`. **Lot R5** : plus rien sur GitHub Pages (`pages.yml` et le job `bascule` retirés ; l'ancienne origine n'est plus permise) ; 50 versions gardées par site Firebase (`domaine.md`, étape 9). Ce qui suit (R1, P4) décrit l'état d'avant pour ce qui a changé (aperçus `/b/`, production à la fusion).
- Une PR qui touche le serveur (`SERVER_PATHS`) a sa **révision de recette** (sans trafic) et son aperçu branché dessus ; commentaire « Recette » sur la PR ; `smoke` complet contre elle ; joueurs fictifs (`recette:seed`, automatique depuis P2).
- Fusion dans main : recette par défaut, puis **validation de Nathan** (un clic), puis API et site ensemble ; **puis (P4) `smoke --lecture-seule`** contre la production : des GET seulement, aucun identifiant, rien n'est écrit ; un échec rend le run rouge et le résumé dit la route, la réponse, et la commande de retour arrière (manuel).
- **`smoke --lecture-seule` est le seul mode permis contre la production** ; le mode complet la refuse (garde testée, `smokeRead.ts`).
- Un agent ne valide, ne relance et ne crée ni ressource ni secret ; aucun outil de test n'écrit dans la base de production.

## 8. Les budgets mesurés → P1, P2, P3, P4 ; lot 28 ; `couts.md`
| | requêtes / joueur / jour | + pré-vols CORS | lignes lues | écrites |
|---|---|---|---|---|
| DailyJump P1 | 9 | — | 824 | 17 |
| DailyJump P2 | 19 | — | 1 084 | 17 |
| DailyJump P3 | 30 | ≈ 41 | 1 252 | 32 |
| **DailyJump P4** | **12** | **≈ 19** | 1 120 | 32 |
| DailyTrack, circuit du jour + profil (`measure:budget`) | 13 | ≈ 17 (estimé) | 1 650 | 42 |
| Salon, 30 min (`measure:budget`) | 558 | ≈ 561 | 12 763 | 265 |

**Lot R5** : les pré-vols CORS n'existent plus (API sous la même adresse depuis le R4) : `measure:platform` ne les compte plus (colonne ci-dessus : historique). Offre gratuite par mois : Cloud Run 2 M requêtes, 180 000 vCPU-s ; Turso 500 M lignes lues, 10 M écrites. **Premier plafond** : le calcul facturé de Cloud Run (compté au plus : 100 ms par requête), puis les requêtes. DailyJump seul : ≈ 3 100 joueurs/jour (P3 : ≈ 1 430 avec la même règle ; ≈ 2 230 en ne comptant que les requêtes sans pré-vols, le chiffre du P3). Le Salon pèse lourd : 100 joueurs × 30 min par jour dépassent à eux seuls le calcul gratuit. Projection : `npm run measure:platform -w @cdj/api -- --jump N --track N --salon N`. Ce que l'on fait quand ça approche : `docs/plateforme/couts.md`, § 4.

## 9. Les décisions de Nathan (appliquées)
- **P1** : la démonstration décale les dates (30/10/2026) et garde tout sous `demo:` ; elle fait confiance au rejeu du jeu pour ton essai ; joueurs fictifs = les « Démo … » de DailyTrack ; `recette:seed` lancé par Nathan (automatique depuis P2).
- **P2** : fantômes cyan clair (le tien) et mauve (le premier) ; le compte `cdj-deploy` lit `cdj-recette-turso-token` ; `?watch=first` attend le serveur 8 s au plus.
- **P3** : **au plus 30 morts par joueur et par jour** ; seules les vies qui finissent par une mort partent ; § 3 (profil des morts) retiré : `/api/jump/me` ne change pas.
- **P4** : à valider (README du lot) — profil dans la lecture regroupée, révision d'identité nuancée (seul un code chargé vide le cache), décisions de `couts.md` § 4.
- **R8** : la journée n° 1 est le lundi 26/10/2026 (`config/lancement.json`, une seule ligne à changer si le partage glisse) ; tous les profils sont supprimés le jour du partage (sauvegarde sur l'ordinateur de Nathan, supprimée un mois après) ; les navigateurs repartent de zéro (génération de données), langue, son et réglages gardés ; après le partage, plus de « Mettre en production » avant le lot R6.
- **R5** : plus aucune redirection depuis GitHub Pages (le code de transfert suffit) ; éditeur « MZC Studios », particulier, contact `mzc.studios.gamedev@gmail.com` ; à valider (README du lot R5) : les points ouverts des mentions (téléphone de l'hébergeur, région de la base Turso), la ligne retirée (et non anonymisée) des classements passés.

## 10. Ajouter le jeu n° 3, de bout en bout
1. **Vision et lots** : `docs/<jeu>/seed-….md` (Nathan), `docs/<jeu>/lots/`, une synthèse `docs/<jeu>/synthese.md`. → R2
2. **Simulation pure** `packages/<jeu>-sim` (aucune dépendance au DOM ni à Node ; PRNG et calendrier de `@cdj/core`) ; ses golden ; sa version de simulation et de générateur. → modèle `packages/jump-sim/CLAUDE.md`
3. **Le jeu** `apps/<jeu>` (Vite) publié sous `/<jeu>/` du même site (même origine : même identité) ; **un seul point d'accès au stockage** (`gameStorage()`, préfixe `<jeu>:` / `apercu:<jeu>:`) ; `@cdj/profile` sur ce stockage (pseudo, code, profil commun, **compteur de révision d'identité** lu au démarrage) ; tout paramètre d'adresse dans son `urlOptions.ts` ; jouable **sans serveur**. → P0, R1, P4
4. **Serveur** `apps/api/src/<jeu>.ts` : tables `<jeu>_*` dans `schema`, routes sous `/api/<jeu>/`, `dailyLevel` **par la même règle que le client**, `validate` par rejeu, l'ordre de validation du § 5, débit (`hit` en base pour les envois, `readHit` en mémoire pour les lectures), identifiant en `X-Player-Id` et `players.assertActive`, pseudo par `players.resolveName` / `save`, journaux sans donnée personnelle ; son profil sous `/api/<jeu>/me` (jamais dans `/api/me`) ; **une lecture regroupée** de ce que le jeu lit au chargement ; `Cache-Control` par `cache.ts` (`private` + `Vary` dès que la réponse dépend du joueur). Une ligne dans `registry.ts`. → P0–P4
5. **Tests** `apps/api/test/<jeu>*.test.ts` sur SQLite **et** libSQL, avec la preuve « serveur = jeu » ; tests du jeu ; e2e dans `apps/<jeu>/e2e` (+ `durees.json`) ; suite de l'API de DailyTrack et golden des autres jeux inchangés. → P0, R2
6. **Recette et CI** : ses chemins dans `SERVER_PATHS` et `recette.yml` (le test les compare), le `Dockerfile` (fichiers lus par l'API), sa partie de `smoke.ts` (mode complet) **et de `smokeRead.ts`** (lecture seule), ses specs dans la matrice e2e (`scripts/e2e-parts.mjs`) ; ses fichiers serveur propres (`apps/api/src/<jeu>*.ts`, tests, scripts) dans les règles de `scripts/ci-scope.mjs` (sinon : doute, tout tourne) ; ses tests de comparaison entre navigateurs dans `apps/<jeu>/e2e/multi-navigateurs.json` (seuls à tourner sur Firefox et WebKit d'une PR) ; la production attend la CI complète de `main` (`ci-complete`). → R1, R2, R3, P4
7. **Coût** : mesuré avant la production (requêtes, pré-vols, lignes lues et écrites, calcul) dans un `measure:<jeu>` ; son joueur type ajouté à `scripts/platformBudget.ts` et à `measure:platform`. → P1, P4
8. **Mise en ligne** : PR (CI de PR verte, aperçu) → fusion (CI complète de `main` verte, trois navigateurs ; la recette suit) → « Mettre en production » (lot R4 : figer, validation de Nathan, serveur puis site, `smoke --lecture-seule` vert, étiquette). Le jeu est servi sous `/<jeu>/` de playdujour.com : une ligne dans `LAYOUT` (`scripts/site.mjs`) et une carte dans `apps/portail/src/jours.ts`. **Lot I3** : le crochet `portail` du jeu fournit aussi `site`, `nom` et `classes(day)` (ses classés du jour, dans l'ordre de son classement prouvé, avec leur médaille) : le classement du jour, « Partager ma journée » et « Jeu suivant du jour » le prennent sans autre changement. Aucun autre jeu n'est touché.
