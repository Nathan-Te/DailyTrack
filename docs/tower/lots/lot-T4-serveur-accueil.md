# Lot T4 — Le serveur, l'accueil et l'arrivée

Branche `claude/upbeat-goldberg-6p1bxc`, PR brouillon. Consignes : `docs/tower/consignes.md` (sections « Le serveur », « Le jeu branché au serveur », « L'accueil et l'arrivée », « Le chargement à la demande et les budgets », « Cahier des charges… »). **Tower reste `off`** et **n'est pas inscrit au registre** (voir la question 1). `lab/` intact ; aucune version ni aucun golden de Track, de Jump ou de Tower ne bouge (voir « Vérifié »). Pour les joueurs : rien.

## Livré
- **Fusion de `main` (lot M1, menus à la manette)** : `manette.ts` est chargé depuis `main.ts` (l'accueil aussi se pilote) et `manetteEcrans.ts` déclare l'accueil (`Jouer`), « Comment jouer » et le classement en dialogue ; budgets remesurés après la fusion (35 355 et 149 013 o).
- **Le serveur** (`apps/api/src/tower*.ts`, `TOWER_GAME`, `/api/tower/`) : `info`, `day/<date>` (jamais la preuve), `submit` (débit → corps → décodage et réglages par défaut → jour de Paris avec grâce → versions → pseudo → copies → `spendReplays(30)` → rejeu ; **le serveur garde son `Resultat`**), `day/<date>/board` (50 premiers + ta ligne, hauteur ↓ vies ↓ ticks ↑), `day/<date>/diamant` (silhouette, `403 not_ranked` hors classés, `404 no_ghost` sans preuve), `me` (records et série). Contenu du jour par la règle du jeu (fichier préparé vérifié — régénéré au tirage écrit **et** preuve rejouée au Diamant écrit — sinon tirage 0 et médailles provisoires), gardé en base et en mémoire. `tower_levels`, `tower_results` (index de classement, de copies, du joueur, de l'aperçu ; aucun `SCAN`), `rotateStatements`, `erase`, `onRename`, `ecrituresApercu`, `viderApercu`. Fil de calcul (`worker_threads`, un fil, file de 4, `503 busy`) écrit et testé ; repli dans le fil principal tant que l'image ne l'embarque pas.
- **Le jeu branché** : `stockage.ts` (`gameStorage()`, `tower:`), `records.ts` (la meilleure partie de chaque jour avec sa rediffusion), `envoi.ts` (envoi, file hors ligne, pseudo), `apiTower.ts` (client, R7), fantôme à trois états (`fantomeEtat.ts`), message en direct, `Partager`, classement en dialogue.
- **L'accueil** (`accueil.ts`) et **l'arrivée** (`fin.ts`) d'après les maquettes ; « Comment jouer » au premier lancement ; **le jeu et Rapier se chargent à la demande**, préchargés dès l'accueil affiché.
- **Petits réglages** : coefficient de repli 165 % ; `?scenario=paliers` sur les paliers de 8 m (tour de départ à 7 m, `TOUR_DEPART_V3`) ; `PREMIER_JOUR_TOWER` (provisoire, 02/11/2026) dans `packages/tower-sim/src/calendrier.ts`.

## Poids (octets compressés, gzip 9, `apps/tower/tools/mesure.mjs`)
| | avant (T3b) | après |
|---|---|---|
| **premier chargement** (`tower.jsCss`) | 167 956 (le jeu compris) | **35 384** (plafond 39 000) |
| **le jeu à la demande** (`tower.jeu`, nouvelle ligne) | — | **149 005** (plafond 164 000) |
| accueil + jeu | 167 956 | 184 389 (+16 433 : le client du serveur, l'envoi, les records, l'accueil, l'aide, le classement, l'arrivée complète) |
| physique, anglais, polices | inchangés (958 766 · 3 962 · 77 688) | |
Le premier chargement est cinq fois plus léger ; le total d'une première partie en français passe de 168 à 184 ko (+9,8 %), sous le plafond de 185 000 o.

## Mesures du serveur (Node 22, Xeon 2,1 GHz ; libSQL `file:` local de 300 classés, **jamais Turso**, `scripts/tower-mesure.ts`)
Rejeu : 40 pièces jusqu'au bout (6 796 ticks) **276 ms** · jour réel qui s'effondre (2 831 ticks) 236 ms · **borne** (15 542 ticks) 301 ms · pire cas vu 642 ms. **`UNITES_REJEU_TOWER` = 30** (≈ 450 ms de plafond global ; 20 rejeux par minute et par instance).
| route | requêtes | lignes lues | écrites | ms |
|---|---|---|---|---|
| `info` | 3 | 6 | 0 | 25 |
| `day`, jour préparé, instance neuve (rejoue la preuve) / relu en base / en mémoire | 5 / 4 / 0 | 6 / 7 / 0 | 1 / 0 / 0 | 403 / 3 / 1 |
| `submit` nouveau record / pas un record / joueur inconnu / refusé avant le rejeu | 11 / 10 / 13 / 2 | 58 / 58 / 56 / 2 | 1 / 0 / 2 / 0 | 60 / 63 / 66 / 8 |
| `board` avec ta ligne / sans | 4 / 2 | 53 / 51 | 0 | 3 / 1 |
| `diamant` · `me` | 2 · 3 | 1 · 2 | 0 | 1 · 2 |
Lignes lues = estimation basse du moteur local (`src/comptage.ts`) ; **non mesuré sur un `sqld`** (absent ici). Un envoi coûte 10 à 13 requêtes (Jump : 8 à 12).

## Vérifié / non vérifié
- **Échecs de CI hors de la zone du lot** : deux timeouts de 5 s de la génération d'un niveau de Jump (`apps/api/test/jump.test.ts:80`, `apps/jump/test/surfaces.test.ts:663`) sur la part unitaire 3/4 ou 4/4 de runs de cette PR (runs 41221350516 et le suivant à la fusion de `main`) ; les deux fichiers passent en local (45 tests, 16 s) et la part 4/4 passe au run suivant : charge du runner, non lié à Tower. Si la part rougit encore, c'est à Nathan de trancher (zone de Jump).
- **Vérifié** : `npm run typecheck` ; **47 tests du serveur sur SQLite et libSQL** (refus et ordre de validation, classement, copies, Diamant, aperçu, effacement, « serveur = jeu » sur 60 dates et 4 fichiers préparés, fil de calcul, plans `EXPLAIN`) ; tests du jeu (stockage, records, envoi et hors ligne, ligne à partager pour chaque médaille et 0 à 3 vies, séquence du fantôme, client, chargement à la demande par les imports statiques) ; **e2e Chromium avec le vrai serveur** (`classement.spec.ts` : partie scriptée envoyée et classée, copie refusée, Diamant débloqué après le classement, « hors ligne, non classé », aide au premier lancement) ; budgets (`poids.spec.ts`) ; tests de la plateforme voisins (codes d'erreur, `pasDeTurso`, `plans`, zones, `ciZones`, catalogues, traductions, budgets).
- **Non vérifié** : Firefox et WebKit (aucun test n'y a été ajouté, sauf si la plateforme le demande) ; un téléphone ; Turso / `sqld` ; l'image Docker avec le fil de calcul ; le serveur sous charge ; la sensation d'un humain ; la CI de la PR (voir la fin du rapport de session).

## Écarts aux maquettes
- Accueil : **pas de « Archives » ni de « Réglages »** (ils n'existent pas) ; décor = aplat du thème (ciel, sol) au lieu du dessin de la tour ; coque centrée.
- Arrivée : **« Jeu suivant du jour » absent du DOM** (crochet `portail`, plateforme) ; une ligne « Paliers franchis » en plus du modèle de la maquette, comme demandé ; le bloc « Classement » devient un formulaire de pseudo au premier envoi.

## Cahier des charges du lot de plateforme (liste exacte)
1. `apps/api/src/registry.ts` : `import { TOWER_GAME } from "./tower"` et `GAMES = [CDJ_GAME, JUMP_GAME, TOWER_GAME]`. **Ne se fait qu'avec 2 et 3** (sinon `remiseAZero.test.ts` et `apps/portail/test/mentions.test.ts` échouent).
2. `apps/api/src/remiseAZero.ts` : `TABLES_VIDEES.tower_results`, `TABLES_GARDEES.tower_levels`.
3. Mentions : `apps/portail/mentions-legales/index.html` **et** `apps/portail/legal/index.html` (`data-tables="tower_levels tower_results"`, ce que Tower garde — hauteur, vies, temps, médaille, rediffusion, empreinte des entrées —, les clés `tower:records`, `tower:aide:vu`, `tower:identite:vue`, `apercu:tower:*`, `cdj:apercu:tower`) ; `docs/plateforme/effacement.md` (`partiesDailyTower`).
4. `packages/profile/src/generation.ts` : le préfixe `tower:` fait partie des données de jeu effacées au « Nouveau départ » ; le jeu lira `generation` de `board` et `me` (déjà rendue) avec `appliquerGeneration`.
5. `apps/api/src/api.ts` : `ApiOptions.towerFrozen` et `gameOptions.tower = { frozen: options.towerFrozen, executeur: options.towerExecuteur }` ; `apps/api/src/server.ts` : `__TOWER_JOURS__`, `executeurFil(new URL("./tower-fil.mjs", import.meta.url))` si le fichier est là.
6. `apps/api/scripts/build-node.mjs` : lire `apps/tower/public/jours/*.json` (preuve comprise : elle reste dans l'image) et une **seconde entrée** `src/towerFilTravail.ts` → `dist/tower-fil.mjs` ; `apps/api/Dockerfile` : copier `packages/tower-sim`, `apps/tower/package.json`, `apps/tower/public/jours`, `tower-fil.mjs` ; `apps/api/package.json` : `@cdj/tower-sim` + script `measure:tower` (+ `package-lock.json`).
7. `apps/api/src/plans.ts` (`GRANDES_TABLES` += `tower_results`), `apps/api/scripts/routesChaudes.ts` (`board`, `me`, `submit` de Tower), `platformBudget.ts`.
8. `apps/api/src/games.ts` + `portail*.ts` + `admin*.ts` : le crochet `portail` (`PortailDuJeu` ne connaît que des **temps** : `tempsMs`, `seuils` en ms, `ClasseDuJour` ; il faut un score en **hauteur**), le crochet `admin` (`activite = tower_results (day, player_id)`, `retirer` avec `resultats_retires.game = 'tower'`, `masquer` = `UPDATE tower_results SET hidden = ?`), l'onglet de classement à la hauteur (Tower n'entre pas dans le cumul au temps), la journée, la série, la journée parfaite, `live_from`.
9. « Jeu suivant du jour » (`jeuSuivant` de `@cdj/profile`, `packages/ui`) dans l'arrivée et l'accueil ; la cartouche du portail ; `JEUX_PUBLICS` (inchangé tant que `off`).
10. L'interrupteur côté client : `import "./interrupteurInit"` en tête de `apps/tower/src/main.ts` (« Bientôt » si `off`, bandeau « Aperçu »), clé `cdj:apercu:tower` ; remplace la garde `PRODUCTION` de `main.ts`.
11. Message en direct : une destination `tower` dans `OuAnnonce` (`packages/profile/src/annonce.ts`), la table `annonces`, `apps/api/src/diffusion.ts` et le panneau `/admin/` ; Tower lit « portail » en attendant (`OU_TOWER`, `messageDirect.ts`).
12. `scripts/budgets.mjs` : `mesureTower` d'après `apps/tower/tools/mesure.mjs` (l'accueil seul au premier chargement), `LIGNES_TOWER` += `tower.jeu`, la ligne `tower.jeu` passée au grand tableau de `budgets.md` (+ `apps/portail/test/budgets.test.ts`), `apps/tower/tools/poids.mjs`.
13. Catalogue commun : `erreur.invalid_replay`, `not_finished`, `replay_copy`, `track_mismatch` parlent de « course » et d'« arrivée » (à reformuler ou clés propres) ; `docs/plateforme/codes-erreur.md` : citer `/api/tower/*` dans leurs lignes.
14. « Mettre en production » : préparer (`npm run preparer:tower`) et figer les jours servis, un registre des versions à la manière de `jours-track.json`, `empreintes.ts` et `jours-passes.json` pour Tower ; `scripts/site.mjs` (copier `apps/tower/dist` hors production ; en production vérifier qu'aucun fichier publié ne contient `preuve`, R9) ; `scripts/recette.mjs` (`SERVER_PATHS`), `recette.yml`, `smoke.ts` / `smokeRead.ts` (une partie scriptée de `tower-aide.ts`, jamais la preuve), `recette:seed` (joueurs fictifs).

## Questions pour Nathan
1. **Le registre.** L'inscrire fait échouer `remiseAZero.test.ts` et les tests des mentions (zones de la plateforme) : je ne l'ai pas fait (« arrête-toi et propose »). Les tests et le serveur d'essai montent Tower par l'option `games` de `createApi`. D'accord ?
2. **Hors de la liste fermée, trois fichiers touchés par nécessité** : `apps/api/tsconfig.json` (une référence de projet : sans elle `npm run typecheck` casse), `e2e/zones.json` (le nouveau spec et la zone `api-tower`), `apps/web/test/ciZones.test.ts` (trois attentes qui nommaient les trois specs de Tower). À garder ?
3. **`PREMIER_JOUR_TOWER`** : le lundi 2 novembre 2026, provisoire. Quel jour ?
4. **Message en direct** : Tower lit les messages « portail » faute de destination propre. Acceptable en attendant ?
5. **Premier envoi hors ligne** : un joueur neuf sans réseau ne se voit pas demander de pseudo (« hors ligne, non classé »), il le sera quand le serveur répond `name_required`. Convient-il ?
6. **Plafond `tower.jsCss`** : 39 000 o (l'accueil seul) au lieu de 168 000 ; le total d'une première partie monte de 168 à 184 ko. À valider.

## Liens de test (aperçu de la PR : `/tower/…`, sans serveur : « hors ligne, non classé » est normal)
- `/tower/?seed=2026-11-05` : l'accueil (sans la scène 3D), JOUER, une partie, l'arrivée (médailles, Partager, Rejouer).
- Le même en mode avion après un premier chargement : l'accueil et le jeu restent jouables.
