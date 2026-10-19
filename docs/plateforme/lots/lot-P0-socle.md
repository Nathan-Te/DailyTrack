# Lot P0 (plateforme) — le socle commun, invisible

Branche `claude/plateforme-socle-p0-nugfss`, PR brouillon #78. Vision : `docs/plateforme/seed-phase-2.md` § 8 (lot P0). Rien de visible ne change : DailyTrack joue, se synchronise et répond comme avant ; DailyJump n'affiche rien de nouveau.

## À tester
1. **Aperçu de la branche branché sur la recette** : `https://nathan-te.github.io/DailyTrack/b/claude-plateforme-socle-p0-nugfss/`
   - DailyTrack : `?scenario=essai` se joue comme avant ; l'accueil montre la carte du profil (pseudo, jours, médailles) ; **Réglages › Profil** : « Copier mon code » donne un code `CDJ2.<32 hexadécimaux>.<8>` ; « Charger un code » avec ce code dans un autre navigateur (ou une fenêtre privée) montre le même pseudo ; « Changer mon code » puis l'ancien code est refusé (« Ce code n'est plus valide »).
   - DailyJump : `…/jump/?debug`, puis dans la console `__jump.profile` → `{ exists: true, name: "<ton pseudo de DailyTrack>" }` si DailyTrack a déjà une identité dans ce navigateur (aperçu : clés `apercu:cdj:*`), sinon `{ exists: false, name: null }`. Rien ne s'affiche, rien n'est créé.
2. **Révision de recette** : `https://b-claude-platefor-yq9bao---cdj-api-recette-5qi6aa4qqa-ew.a.run.app` (commentaire « Recette » de la PR ; elle change d'empreinte si la branche change de nom, pas à chaque poussée).
   - `<révision>/api/jump/info` → `simVersion` 3, `generatorVersion` 9, `today` (date de Paris), `frozenDays` `["2026-10-16","2026-10-17","2026-10-18"]`, `environment: "recette"`.
   - `<révision>/api/jump/day/<aujourd'hui>` → `id` `jour-<date>-g9`, `hash`, `authorTicks`, `medals`, `theme`, `source: "genere"` ; `/api/jump/day/2026-10-16` → `jour-2026-10-16-g4`, `hash` `8a7c90f7`, `source: "fige"` ; demain → 404 « Ce niveau n'est pas encore sorti ».
   - `<révision>/api/health` → exactement les mêmes champs qu'avant (rien de DailyJump).

## Le module de profil (`packages/profile`, `@cdj/profile`)
- **Déplacé d'`apps/web`, sans changement** : identifiant secret et pseudo (lecture, création ; `cdj:player`, `cdj:name`, `cdj:player:next`, `cdj:notice:*`), code de transfert `CDJ2` (encodage, lecture, CRC-32), client `GET /api/me`, `GET /api/name`, `PUT /api/player`, `POST /api/me/code` (identifiant en `X-Player-Id`, suggestions de pseudo gardées), service de synchronisation (`ProfileSync`, fusion injectée ; part commune : le pseudo du serveur gagne), `Profile.rename` (propriété du premier, suggestions, hors ligne) et `Profile.changeCode` (rotation, révocation, réponse perdue). Stockage et réseau injectés ; ni `localStorage`, ni `document`, ni paquet de jeu (test de pureté).
- **Reste dans DailyTrack** (propre à ses données) : lecture des anciens codes `CDJ1` (records), cache des records vidé au changement d'identité (`applyIdentity`), fusion des records `mergeProfile`, `LeaderboardApi` (hérite de `ProfileClient`). `identity.ts`, `transfer.ts`, `api.ts`, `profileSync.ts`, `online.ts` sont des façades : mêmes noms exportés, même comportement.
- **Preuve que les assertions sont identiques** : `bash packages/profile/tools/blocs-deplaces.sh` compare les blocs `describe(` entiers d'`apps/web/test/{transfer,api,online}.test.ts` sur `main` (2e51804) à ceux des mêmes fichiers et de `packages/profile/test/{transfer,client,identity,profile}.test.ts` : « Blocs identiques : 11 blocs, 108 lignes expect — diff vide ». Seuls changent les imports et, dans deux fichiers, une ligne qui garde le nom d'avant (`const LeaderboardApi = ProfileClient`, une façade `Online` de dix lignes) pour que les assertions restent mot pour mot. `apps/web` : 356 tests avant, 356 après (dont les déplacés) ; `profileSync.test.ts` et tous les autres tests d'`apps/web` sont **inchangés**.

## Le registre et la recette « ajouter un jeu »
- `apps/api/src/games.ts` (types), `registry.ts` (`GAMES = [CDJ_GAME, JUMP_GAME]`). Une définition = code, préfixe des routes, tables, `schema`, versions, `create` ; le jeu créé rend `route`, `dailyLevel`, `validate` (DailyTrack : rejeu `replayRace` ; DailyJump : lot P1), et des crochets (`onRename`, `rotateStatements`, `profile`, `tick`).
- **DailyTrack** (`cdj.ts`) : le code d'`api.ts` déplacé tel quel ; routes historiques sous `/api`, mêmes réponses. La suite de l'API (199 tests) **n'a pas changé une ligne** et passe sur SQLite et libSQL.
- **Commun, écrit une fois** : `platform.ts` (débit en base et en mémoire, corps de requête, joueurs, schéma, jour de Paris), `identity.ts` (pseudo, profil, code), `config.ts`, `log.ts`. Le schéma = tables de la plateforme + `schema` de chaque jeu (empreinte `meta`).
- **Ajouter un jeu** : (1) sa simulation pure `packages/<jeu>-sim` ; (2) `apps/api/src/<jeu>.ts` : tables `<jeu>_*`, routes sous `/api/<jeu>/`, `dailyLevel` par la même règle que son client, `validate` par rejeu, une `GameDefinition` ; (3) une ligne dans `registry.ts` ; (4) `apps/api/test/<jeu>.test.ts` sur SQLite et libSQL, avec la preuve « serveur = jeu » ; (5) ses chemins dans `SERVER_PATHS` et `recette.yml`, le `Dockerfile`, `smoke.ts` ; (6) son coût mesuré ; (7) son client importe `@cdj/profile` sur son `gameStorage()`. Aucun autre jeu n'est touché.

## `/api/jump/` et la preuve « serveur = jeu »
- `GET /api/jump/day/<date>` : fichier figé d'abord (vérifié, **preuve rejouée** : `thawFrozen`, miroir de `thawLevel`), sinon `dailyLevel(jour)` ; table `jump_levels` (règle = versions + empreinte du fichier figé), une promesse en cours par jour, débit en mémoire (120 lectures / 10 min / adresse), futur et avant le 16/10/2026 refusés. `/api/health` identique (test).
- `apps/api/test/jump.test.ts` : 60 dates (16/10 → 14/12/2026, dont les 3 jours figés) comparées à `loadDaily` d'`apps/jump` (identifiant, empreinte, temps de l'auteur, médailles, thème, numéro) ; fichiers figés abîmés (8 variantes) refusés des deux côtés pour la même raison. **Réserve** : le serveur et le jeu tournent dans le même processus de test, donc `dailyLevel` y partage son cache mémoire ; la preuve porte sur la règle (figé d'abord, vérifications, reconstruction de la charge), l'égalité de `dailyLevel` à lui-même étant garantie par les golden de `jump-sim`.

## Mesures (conteneur de la session, 4 cœurs ; `sqld` local, le moteur de Turso)
| | avant (main) | après |
|---|---|---|
| image (`docker image inspect`) | 326 698 563 o | 327 182 860 o (+0,48 Mo) |
| `server.mjs` | 460 813 o | 865 222 o (jump-sim + 3 jours figés) |
| démarrage Node (`startupMs`, 5 essais à froid) | 90–113 ms | 118–150 ms |
| `docker run` → premier `/api/health` 200 | 338–406 ms | 364–432 ms |

`npm run measure:jump-api -w @cdj/api` (sqld local) :
| requête | durée | instructions | lignes lues | écrites |
|---|---|---|---|---|
| `/api/jump/info` | 3 ms | 0 | 0 | 0 |
| `/api/jump/day/<aujourd'hui>`, premier calcul (généré) | 397 ms | 2 | 2 | 1 |
| idem, figé (preuve rejouée) | 22 ms | 2 | 2 | 1 |
| relu en base (instance neuve) | 5–6 ms | 1 | 1 | 0 |
| en mémoire (même instance) | < 1 ms | 0 | 0 | 0 |
Le schéma neuf coûte une fois 23 instructions (une table de plus) ; une instance qui trouve la bonne empreinte : 2 instructions, 1 ligne lue (inchangé).

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : typecheck ; `npm test` (1 797 tests `sqlite` + 208 `libsql`) ; suite de l'API et golden des deux jeux inchangés (aucun fichier de `packages/sim`, `packages/jump-sim`, `packages/core`, `packages/clock` touché) ; e2e locaux Chromium `leaderboard`, `profil` (7/7 avec un test à la fois comme en CI ; à 2 workers en local, un test a dépassé son délai par la charge), `accueil`, `perf`, DailyJump `smoke` ; image construite dans un dossier propre, lancée contre `sqld` : `smoke` (DailyTrack et DailyJump) et l'étape DailyJump d'`api-image` verts ; le test de durée du générateur garde sa marge avec la preuve en parallèle (pire jour 1 584 ms contre 1 611 ms sans, limite 3 500). **Recette** (workflow « Recette », run 39238816304, révision `cdj-api-recette-r39238816304-1`) : déploiement, contrôle de `/api/health` et `smoke` verts dans les journaux, DailyJump compris (`/api/jump/info` avec `environment: "recette"`, niveau du jour `jour-2026-10-19-g9` `ee3dc622` calculé en 1,9 s au premier appel sur Cloud Run puis 0,16 s, les 3 jours figés servis depuis leur fichier, demain refusé) ; interrogée aussi directement : `/api/health` a exactement les champs de la production. CI de la PR : voir le dernier commentaire de la PR.
**Non vérifié** : la production (aucun déploiement par l'agent) ; un vrai appareil mobile.
**Décisions pour Nathan** : (1) la règle du niveau figé existe en double (`thawLevel` du jeu, `thawFrozen` du serveur), gardée égale par le test ; la mettre dans `jump-sim` est hors de ce lot (interdit) ; (2) `/api/jump/day` refuse les dates d'avant le 16/10/2026 (le jeu les ouvre en archive) ; (3) `jump_levels` garde le texte du niveau (`ascii`, jamais rendu) pour que le lot P1 rejoue sans régénérer.

### Checklist de validation
Sur la recette, avant « Approve » : ☐ commentaire « Recette » présent sur la PR ; ☐ journaux du workflow : `/api/health` et `smoke` verts sur la révision ; ☐ `<révision>/api/health` = mêmes champs que la production ; ☐ `/api/jump/info` liste les 3 jours figés, `environment: "recette"` ; ☐ `/api/jump/day/<aujourd'hui>` rend `jour-<date>-g9` ; ☐ aperçu : DailyTrack (`?scenario=essai`, carte du profil, copier / charger / changer le code) comme avant ; ☐ DailyJump `?debug` : `__jump.profile`.
Sur la production, après : ☐ `<API>/api/health` : `ok: true, db: "ok", salonOverride: false`, mêmes champs qu'avant ; ☐ `<API>/api/jump/info` : `environment: "production"`, 3 jours figés ; ☐ `<API>/api/jump/day/<aujourd'hui>` : l'empreinte que montre `__jump.daily` du jeu publié ; ☐ DailyTrack publié : un temps, le classement, le profil synchronisé sur un deuxième appareil.
