# Codes d'erreur du serveur (lot I1 ; lot I6 : plus de `message`)

Chaque réponse d'erreur du serveur (`apps/api`, tous les jeux) porte un **code stable**, lisible par le jeu — et, depuis le lot I6, **rien d'autre qu'un code et ses détails** : plus de message en français. La liste, le statut HTTP de chaque code et son sens vivent dans **un seul fichier source** : `apps/api/src/codesErreur.ts` (`CODES_ERREUR`). Ce document la décrit ; le test `apps/api/test/codesErreur.test.ts` vérifie qu'il dit exactement la même chose que le code.

## 1. À quoi servent les codes

- **Le jeu traduit le code, pas le message.** Le catalogue commun de `packages/ui` porte une clé **`erreur.<code>`** par code (français et anglais) : le jeu affiche le texte de la langue du joueur, et peut réagir au code (proposer « Charger un code » sur `name_taken`, recharger la page sur `version` ou `sim_version`, attendre sur `rate_limited`…).
- **Plus de `message` (lot I6)** : depuis les lots I4 et I5, plus aucun client ne le lisait (le portail, Track, Jump et le profil commun affichent `erreur.<code>` du catalogue de la langue) ; le lot I6 l'a retiré de toutes les réponses. Seul le code compte. Le texte passé à `HttpError` reste dans le code du serveur, pour qui le lit, sans sortir.
- Le code est un **contrat** : un code ne change ni de nom ni de statut. Un nouveau cas de refus qui a le même sens pour le joueur réutilise un code existant ; sinon il en ajoute un (règle du § 3).

## 2. La forme

```json
{ "error": "<code>", "…": "détails éventuels" }
```

- `error` : un code de la liste ; le statut HTTP de la réponse est **celui de la liste** (un code = un statut). `HttpError` (`apps/api/src/errors.ts`) l'impose par le typage : `new HttpError(<statut>, "<code>", message)` ne compile que si le statut est celui du code ; `message` (le troisième argument) explique le refus à qui lit le code et n'est jamais renvoyé.
- Détails : certains codes ajoutent des champs (`name_taken` → `suggestions`) ; certains ajoutent un en-tête (`rate_limited`, `too_fast`, `busy` → `Retry-After`).
- **`/api/health`** garde sa forme (`ok`, `db`, versions… : la sonde de Cloud Run, `smoke` et la CI les lisent) ; en 503 elle ajoute `error: "db_unavailable"`.
- **Erreur inattendue** (défaut du code) : `500 { "error": "internal" }` (`ERREUR_INTERNE`, la même dans `api.ts` et `node-server.ts`) ; aucun détail ne sort, la cause est dans le journal.

## 3. La règle

- **Toute nouvelle erreur du serveur prend un code de la liste unique** `apps/api/src/codesErreur.ts` (ou y ajoute le sien, avec son statut et son sens), **est décrite ici** (une ligne du tableau) **et est traduite dans le catalogue commun** de `packages/ui` (`erreur.<code>`, français **et** anglais), dans le même lot.
- Jamais de corps d'erreur écrit à la main : `throw new HttpError(…)` dans une route, `corpsErreur(code)` hors des routes (santé, erreur inattendue).
- Tests : `codesErreur.test.ts` parcourt les routes du registre (toutes les méthodes, corps vides, illisibles ou trop gros, avec et sans `X-Player-Id` ou jeton d'admin), lit les sources (chaque `HttpError` a un code de la liste et son statut ; chaque code de la liste est rendu quelque part) et ce document ; `makeApi().call` (`apps/api/test/helpers.ts`, `verifierErreur`) vérifie chaque réponse d'erreur de tous les tests de l'API.

## 4. Les codes

Routes : `/api/…` = DailyTrack et routes communes (chemins historiques), `/api/jump/…` = DailyJump ; `<j>` = une date `AAAA-MM-JJ`, `<n>` = un numéro de session du Salon.

| code | statut | sens | routes principales |
|---|---|---|---|
| `not_found` | 404 | Route inconnue (y compris les routes d'admin quand l'admin est désactivé, et toute adresse inconnue sous `/api/jump/`). | toute adresse inconnue ; `/api/admin/*` sans `ADMIN_TOKEN` ; `/api/sonde/entetes` hors recette |
| `method_not_allowed` | 405 | La route existe, mais pas pour cette méthode HTTP . | toutes les routes |
| `invalid_json` | 400 | Le corps de la requête n'est pas un objet JSON. | tous les envois (`POST`, `PUT`) |
| `too_large` | 413 | Le corps dépasse la taille permise (`MAX_BODY_BYTES`), annoncée ou lue. | tous les envois |
| `rate_limited` | 429 | Trop de requêtes pour cette adresse, ce joueur ou ce jeton d'admin dans la fenêtre de débit (`Retry-After`). | envois, `/api/name`, `/api/me`, lectures du Salon, du Garage (`GET /api/garage`, lot 41), son enregistrement (`PUT /api/garage`, lot 51), de DailyJump et du portail, `/api/admin/*` |
| `busy` | 503 | Serveur saturé : plafond de rejeux par minute de l'instance atteint (`Retry-After`), ou envois simultanés de vies du même joueur impossibles à fusionner. | `POST /api/submit`, `/api/salon/<n>/submit`, `/api/jump/submit`, `/api/jump/lives` |
| `internal` | 500 | Erreur inattendue du serveur (défaut du code, base qui ne répond plus pendant une route) ; aucun détail. | toutes |
| `db_unavailable` | 503 | `/api/health` : la base de données ne répond pas. | `GET /api/health` |
| `invalid_player` | 400 | Identifiant de joueur manquant ou mal formé (en-tête `X-Player-Id` ou corps), ou nouvel identifiant identique à l'ancien. | `/api/me`, `/api/me/code`, `PUT /api/player`, `/api/submit`, `GET` et `PUT /api/garage` (lots 41 et 51), Salon, `/api/jump/me`, `/api/jump/submit`, `/api/jump/lives`, `/api/portail/*`, lectures avec `X-Player-Id` |
| `unknown_player` | 404 | Aucun joueur sur le serveur pour cet identifiant (jamais classé), ou aucun profil à effacer pour ce code. | `GET /api/me`, `PUT /api/player`, `PUT /api/garage` (lot 51 : le choix se garde après la première course), `POST /api/me/code`, `GET /api/jump/me`, `POST /api/jump/lives`, `POST /api/admin/effacer`, `GET /api/portail/jour` et `/api/portail/profil` (lot I2 : le corps porte quand même les jeux du jour) |
| `code_revoked` | 410 | Ce code (identifiant secret) a été remplacé par « Changer mon code ». | `/api/me`, `/api/me/code`, `PUT /api/player`, `GET` et `PUT /api/garage` (lots 41 et 51), envois des deux jeux, `/api/jump/me`, `POST /api/admin/effacer`, `/api/portail/*` (lot I2) |
| `id_taken` | 409 | « Changer mon code » : le nouvel identifiant est déjà pris (recommencer). | `POST /api/me/code` |
| `invalid_name` | 400 | Pseudo invalide (longueur ou caractères hors des règles). | `GET /api/name`, `PUT /api/player`, envois avec `name` |
| `name_forbidden` | 400 | Pseudo refusé : mot interdit ou nom réservé. | `GET /api/name`, `PUT /api/player`, envois avec `name` |
| `name_taken` | 409 | Pseudo déjà à un autre joueur ; `suggestions` libres jointes. | `PUT /api/player`, envois avec `name` (`GET /api/name` répond `available: false`) |
| `name_required` | 400 | Premier envoi d'un joueur inconnu sans pseudo. | `POST /api/submit`, `/api/salon/<n>/submit`, `/api/jump/submit` |
| `invalid_code` | 400 | Admin, effacement : code de transfert mal formé ou abîmé (somme de contrôle). | `POST /api/admin/effacer` |
| `unauthorized` | 401 | Admin : jeton manquant ou incorrect (outils de DailyTrack), ou session du panneau absente, expirée, révoquée, ou connexion Google refusée (jamais dit pourquoi : adresse ou jeton). | `/api/admin/*` (lot N1 : `/api/admin/session`, `tableau`, `joueurs`, `journal`) |
| `forbidden` | 403 | Panneau d'administration (lot N1) : une requête qui modifie quelque chose sans l'en-tête `X-Cdj-Admin: 1`, ou dont l'`Origin` n'est pas celle du site. | `POST` / `DELETE` de `/api/admin/session`, `POST /api/admin/joueurs/<ref>/…` |
| `invalid_action` | 400 | Panneau d'administration (lot N1) : le corps d'une action est refusé (confirmation absente ou fausse, motif ou pseudo manquant, jeu ou jour illisible). | `POST /api/admin/joueurs/<ref>/…` |
| `unknown_result` | 404 | Panneau d'administration (lot N1) : ce joueur n'a pas de résultat classé ce jour-là dans ce jeu. | `POST /api/admin/joueurs/<ref>/retirer` |
| `invalid_news` | 400 | Panneau d'administration (lot N2) : nouveauté refusée à l'enregistrement ou à la publication (`problemes` : titre, date, zone, français, anglais manquant, trop long) — une ligne sans anglais bloque la publication. | `POST /api/admin/nouveautes` |
| `unknown_news` | 404 | Panneau d'administration (lot N2) : cette nouveauté n'existe pas. | `POST /api/admin/nouveautes`, `POST /api/admin/nouveautes/<id>/depublier`, `…/supprimer` |
| `invalid_message` | 400 | Panneau d'administration (lot N2) : message en direct refusé (`problemes` : texte manquant ou de plus de 160 caractères, lien ou HTML, endroit, ton, heure de fin passée ou à plus de 7 jours). | `POST /api/admin/message` |
| `invalid_cursor` | 400 | Portail, nouveautés (lot N2) : `avant` n'est pas au format AAAA-MM-JJ.<n>. | `GET /api/portail/nouveautes` |
| `invalid_date` | 400 | Date illisible (`AAAA-MM-JJ` attendue). | `/api/day/<j>…` (lot I2 : un encodage illisible aussi, plus jamais 500), `/api/submit`, `/api/admin/planning/<j>`, `/api/jump/day/<j>…`, `/api/portail/classement?date=` (lot I3) |
| `invalid_view` | 400 | Classement du jour du portail : `vue` n'est ni `cumul` ni le dossier d'un jeu qui existe ce jour-là (lot A1). | `GET /api/portail/classement?vue=` |
| `unknown_day` | 404 | Ce jour n'a pas (encore) de circuit ou de niveau : futur, ou avant le premier jour du jeu. | `/api/day/<j>…`, `/api/submit`, `/api/jump/day/<j>…`, `/api/portail/classement?date=` (lot I3 : un jour futur, ou d'avant les jeux) |
| `day_closed` | 409 | Envoi pour un jour dont le classement est figé (jour passé, après la grâce de 10 minutes). | `POST /api/submit`, `/api/jump/submit`, `/api/jump/lives` |
| `day_started` | 409 | Admin, planning : ce jour a déjà commencé, son circuit ne peut plus être remplacé. | `PUT` / `DELETE /api/admin/planning/<j>` |
| `too_far` | 400 | Admin, planning : jour trop loin dans le futur (plus de `PLANNING_HORIZON` jours). | `PUT` / `DELETE /api/admin/planning/<j>` |
| `invalid_variant` | 400 | Admin, planning : variante hors de 0 à `MAX_VARIANT`. | `PUT /api/admin/planning/<j>` |
| `invalid_theme` | 400 | Admin, planning : thème inconnu. | `PUT /api/admin/planning/<j>` |
| `circuit_unavailable` | 503 | DailyTrack : le générateur n'a pas produit de circuit valide pour ce jour ou cette session du Salon (réessayer). | `/api/day/<j>…`, `/api/submit`, routes du Salon |
| `invalid_replay` | 400 | Rediffusion manquante ou illisible, d'un autre niveau, ou essai qui ne part pas du départ (DailyJump). | `POST /api/submit`, `/api/salon/<n>/submit`, `/api/jump/submit` |
| `sim_version` | 409 | DailyTrack : rediffusion enregistrée avec une autre version de la simulation (recharger la page). | `POST /api/submit`, `/api/salon/<n>/submit` |
| `track_mismatch` | 409 | DailyTrack : la rediffusion n'est pas celle du circuit de ce jour ou de cette session. | `POST /api/submit`, `/api/salon/<n>/submit` |
| `not_finished` | 422 | La rediffusion, rejouée par le serveur, n'arrive pas au bout. | `POST /api/submit`, `/api/salon/<n>/submit`, `/api/jump/submit` |
| `replay_copy` | 409 | Les entrées de la rediffusion sont identiques à celles de l'auteur du niveau ou d'une course déjà classée d'un autre joueur ce jour-là (une copie) : classements du jour seulement (lot R9). | `POST /api/submit`, `POST /api/jump/submit` |
| `ghost_locked` | 403 | Le fantôme Diamant du jour (la trajectoire de l'auteur du niveau) n'est rendu qu'à un joueur qui a fini le niveau du jour, quelle que soit la médaille ; les jours passés sont libres (lot G1). | `GET /api/jump/fantome-diamant?date=` |
| `no_ghost` | 404 | Pas de fantôme : personne de classé, pas de temps pour ce joueur, ou personne devant lui. | `GET /api/day/<j>/ghost`, `GET /api/jump/day/<j>/ghost/first` |
| `invalid_kind` | 400 | DailyTrack : fantôme demandé avec un `kind` autre que `first` ou `ahead`. | `GET /api/day/<j>/ghost` |
| `invalid_session` | 400 | Salon : numéro de session (ou adresse) illisible. | `/api/salon/<n>/board`, `/ghosts`, `/submit` |
| `unknown_session` | 404 | Salon : cette session n'est pas servie (pas encore préparée, ou finie et oubliée). | `GET /api/salon/<n>/board`, `/ghosts` |
| `session_future` | 409 | Salon : envoi pour une session qui n'a pas commencé. | `POST /api/salon/<n>/submit` |
| `session_closed` | 409 | Salon : envoi arrivé plus de 3 secondes après la fin de la session. | `POST /api/salon/<n>/submit` |
| `too_fast` | 429 | Salon : plus d'un envoi par 5 secondes pour ce joueur (`Retry-After`). | `POST /api/salon/<n>/submit` |
| `invalid_since` | 400 | Salon, classement : `since` n'est pas un entier. | `GET /api/salon/<n>/board?since=` |
| `too_many_refs` | 400 | Salon, fantômes : trop de références demandées à la fois. | `GET /api/salon/<n>/ghosts?refs=` |
| `invalid_ref` | 400 | Salon, fantômes : référence de joueur mal formée. | `GET /api/salon/<n>/ghosts?refs=` |
| `invalid_level` | 400 | DailyJump : identifiant de niveau illisible (`jour-AAAA-MM-JJ-g<N>` attendu). | `POST /api/jump/submit`, `/api/jump/lives` |
| `not_daily` | 409 | DailyJump : ce n'est pas le niveau du jour (thème forcé, futur, avant le premier niveau) : jamais classé. | `POST /api/jump/submit`, `/api/jump/lives` |
| `version` | 409 | DailyJump : versions du jeu, de la rediffusion ou du niveau différentes de celles du serveur (recharger la page). | `POST /api/jump/submit`, `/api/jump/lives` |
| `level_unavailable` | 503 | DailyJump : le niveau du jour gardé en base est abîmé (empreinte) : réessayer plus tard. | `POST /api/jump/submit`, `/api/jump/lives` |
| `invalid_lives` | 400 | DailyJump, vies : liste `lives` absente ou vide. | `POST /api/jump/lives` |
| `too_many_lives` | 413 | DailyJump, vies : plus de `JUMP_LIVES_PER_LOT` vies dans un même lot. | `POST /api/jump/lives` |
