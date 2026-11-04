# `apps/api` : consignes du serveur et de la plateforme

Chargé quand on lit un fichier de `apps/api`. Contient (1) les règles du serveur de DailyTrack (classement, pseudos, Salon serveur, profil, jour de Paris, production Cloud Run + Turso) et (2) les **règles de la plateforme** (registre des jeux, identité commune, recette, aperçus, workflows) communes à tous les jeux — rubriques « Plateforme (lot P0) », « Emplacements » et « Recette (lot R1) » en bas. Vision de la phase 2 : `docs/plateforme/seed-phase-2.md` (**ne pas modifier**, c'est Nathan qui le fait). Synthèse de DailyTrack : `docs/orchestration.md`. Autres consignes : `packages/sim/CLAUDE.md`, `apps/web/CLAUDE.md`.

> **Renvois « voir <rubrique> »** : une rubrique citée mais absente de ce fichier est dans un autre `CLAUDE.md` ou dans `docs/regles/` : `CLAUDE.md` racine, « Où sont les rubriques ».

## Classement (lot 5)
`apps/api` : `createApi({ db, now })` (`src/api.ts`) ne dépend que de `Request`/`Response` et de `SqlDb` ; adaptateurs : Node (`server.ts`, Docker, Cloud Run) avec **Turso / libSQL** en […] **→ Détail : [docs/regles/api/classement-lot-5.md](../../docs/regles/api/classement-lot-5.md)**

## Identifiant du joueur dans l'en-tête (lot 32)
- Lot 32 : toutes les lectures et tous les envois de DailyTrack lisent l'identifiant du joueur dans l'en-tête `X-Player-Id` (`playerOf`, `cdj.ts` ; Salon : `kit.playerOf`), jamais dans l'adresse. Transition : l'ancien `?player=` reste lu quand l'en-tête manque, compté sans rien retenir (`legacyPlayerParam` de `/api/admin/overview`, une ligne de journal au plus toutes les 5 min : route et total, jamais l'identifiant), jusqu'à la retouche 32b (7 jours après la mise en production). Les envois lisent l'en-tête puis `body.playerId`.
- **Ce qui reste après la retouche 32b** (prévue le 29 ou 30/10/2026, si le compteur est tombé à presque zéro) : retirer le `else` de `playerOf` et le compteur, `body.playerId` des envois si plus aucun outil ne s'en sert, les tests « transition » de `salon.test.ts` ; **puis, dans un lot de plateforme** (les deux pages des mentions, `apps/portail/test/mentions.test.ts`), retirer « pour certaines lectures de DailyTrack, elle contient ton identifiant » : jusque-là la phrase reste vraie (règle de fidélité du lot R5).

## Garage (lot 41)
**`GET /api/garage`** (`cdj.ts`, identifiant **obligatoire** en `X-Player-Id` : 400 `invalid_player` sinon ; 410 `code_revoked`) : `{ progres { jours, or, auteur }, voitures [{ id, debloquee, progres { fait, nombre } | null }] }`. **→ Détail : [docs/regles/api/garage-lot-41.md](../../docs/regles/api/garage-lot-41.md)**

## Historique et mode démo (lot 11)
**`PREMIER_JOUR`** (`packages/sim/src/calendar.ts`, ex-`LAUNCH_DAY`) : le circuit n° 1, **le 2026-10-13, date de la mise en ligne** (lot 28 ; provisoirement le 22/09 avant). **→ Détail : [docs/regles/api/historique-et-mode-demo-lot-11.md](../../docs/regles/api/historique-et-mode-demo-lot-11.md)**

## Admin et planning (lot 14)
- **Variantes** : `dailyCircuit(jour, variante = 0, thème?)` (`generator.ts`). **La variante 0 est exactement le circuit d'avant** (même texte, même id sans suffixe : golden et rediffusions de référence inchangés) ; une variante n ≥ 1 décale la graine de n × 1000 tentatives et ajoute `-v<n>` à l'id ; un thème imposé ajoute son nom : `jour-AAAA-MM-JJ-g<G>[-v<n>][-<thème>]` (`dailyTrackId(jour, thème, variante)`, `isVariant`, `MAX_VARIANT` = 99). **Changer la façon dont une variante est tirée = `GENERATOR_VERSION` +1** comme pour le reste du générateur.
- **Planning (API)** : table `planning` (jour → variante, thème imposé, date du choix). `getCircuit` lit le planning et **rejoue toujours le circuit en vigueur** (cache ignoré s'il est d'une autre variante ou version). Public : `GET /api/day/AAAA-MM-JJ` (`variant`, `theme`, `trackId`), `GET /api/planning` (jours remplacés jusqu'à aujourd'hui). Admin (`Authorization: Bearer`) : `GET /api/admin/overview`, `PUT` / `DELETE /api/admin/planning/AAAA-MM-JJ`.
- **Jeton (retouche N2 : plus utilisé par la page `/track/admin/`, qui n'ouvre que par la session du panneau ; il reste pour les scripts et `effacer`)** : `ADMIN_TOKEN` (variable d'environnement, ≥ 16 caractères, jamais dans le dépôt ; absent ou court = admin désactivé, routes en 404), comparaison à temps constant, 10 mauvais jetons par 10 min et par adresse puis 429.
- **Règle : un jour commencé est figé** — remplacement et retour à l'original refusés pour aujourd'hui et le passé (date de Paris, 409 `day_started`), au plus 60 jours à l'avance ; le circuit est généré et validé à l'enregistrement.

## Salon (lots 26 et 27)
**Serveur du Salon (lot 27)** : `apps/api/src/salon.ts` (`createSalon`, branché dans `createApi` ; `errors.ts` porte `HttpError`). **→ Détail : [docs/regles/api/salon-lots-26-et-27.md](../../docs/regles/api/salon-lots-26-et-27.md)**

## Finale du Salon (lot 31)
- **Serveur** : un envoi n'est accepté que jusqu'à **`fin + 3 s`** (`SALON_GRACE_MS`, était 60 s) ; marge réseau justifiée dans le code (une course finie *avant* l'heure pile peut arriver après ; une course non finie à l'heure pile n'est jamais envoyée). La session reste **lue** (classement, fantômes) jusqu'à **`fin + 20 s`** (`SALON_SERVE_MS`) pour le podium, puis oubliée (27b). Sessions toujours alignées sur l'horloge (xx:00, xx:10…) ; `?salonMinutes` suit la même règle.

## Jour de Paris (lot 31)
- **« Aujourd'hui » = la date à Paris** (Europe/Paris, heure d'été comprise), la même pour tout le monde au même instant, où que soit le joueur (décision du 14/10/2026 ; **remplace la règle « jour UTC »**). Une seule fonction, **hors de `sim`** : `packages/clock` (`@cdj/clock`, `parisDay(ms)`, `parisDayStart(jour)`, `msUntilNextParisDay(ms)`), qui lit `Intl.DateTimeFormat` avec `timeZone: "Europe/Paris"` et se **contrôle** contre la règle de l'Union européenne (dernier dimanche de mars à 01 h UTC → dernier dimanche d'octobre à 01 h UTC) sur des instants de contrôle ; sans fuseaux dans l'environnement, c'est la règle seule (`parisClockSource` : `intl` ou `table`, rendu par `/api/health` → `clock`). `sim` reçoit toujours une date : **les circuits de chaque date ne changent pas**, seul l'instant où « aujourd'hui » passe au jour suivant bouge (aucune version à monter).
- **API** : jour accepté pour un envoi, **grâce de 10 min après minuit de Paris** (`GRACE_MS`), classement du jour, jours figés du planning, `GET /api/day`, `/api/me`, admin : tout passe par `today = parisDay(now())` et `parisDayStart`. Un jour peut durer **23 h, 24 h ou 25 h** (changements d'heure : 25/10/2026, 28/03/2027) : ne jamais supposer 86 400 000 ms.
- **Jeu** : accueil « Prochain circuit dans HH:MM:SS (minuit, heure de Paris) » (`#home-nextday`) ; à zéro la page se recharge sur le nouveau circuit (une course en cours n'est pas interrompue : l'accueil est fermé ; son temps compte s'il est envoyé pendant la grâce). Admin : « Aujourd'hui (Paris) ».

## Production (lot 28)
**En ligne depuis le 13/10/2026** : API `https://cdj-api-5qi6aa4qqa-ew.a.run.app` (projet Google Cloud `dailytrack-511513`, base Turso `dailytrack-misterzcool`, `VITE_API_URL` réglée) ; […] **→ Détail : [docs/regles/api/production-lot-28.md](../../docs/regles/api/production-lot-28.md)**

## Le garde-fou des jours et la répétition (lot R6)
**Le jour de bascule** = le premier jour de Paris qui commence après le déploiement, calculé **au clic** (`jourDeBascule`, calendrier et non des heures : un jour dure 23, 24 ou 25 h). **→ Détail : [docs/regles/api/le-garde-fou-des-jours-et-la-repetition-lot-r6.md](../../docs/regles/api/le-garde-fou-des-jours-et-la-repetition-lot-r6.md)**

## Profil (lot 30)
**Le serveur fait foi, le stockage local n'est qu'un cache.** Un profil = un identifiant secret (`players.id`, 128 bits tirés par le navigateur) + un pseudo réservé + ses temps (`results`). **→ Détail : [docs/regles/api/profil-lot-30.md](../../docs/regles/api/profil-lot-30.md)**

## Plateforme (lot P0)
Un seul serveur pour tous les jeux du portail : `createApi` (`api.ts`) n'assemble plus que la plateforme et le registre. **→ Détail : [docs/regles/api/plateforme-lot-p0.md](../../docs/regles/api/plateforme-lot-p0.md)**

## Classement de DailyJump (lot P1)
Code : `apps/api/src/jump.ts` (routes, validation, classement), `jumpHistory.ts` (joueurs fictifs). **→ Détail : [docs/regles/api/classement-de-dailyjump-lot-p1.md](../../docs/regles/api/classement-de-dailyjump-lot-p1.md)**

## Fantôme du premier et profil DailyJump (lot P2)
Code : `apps/api/src/jump.ts` ; tests `apps/api/test/jumpProfile.test.ts` (SQLite **et** libSQL). **→ Détail : [docs/regles/api/fantome-du-premier-et-profil-dailyjump-lot-p2.md](../../docs/regles/api/fantome-du-premier-et-profil-dailyjump-lot-p2.md)**

## Les morts de tout le monde (lot P3)
Code : `apps/api/src/jumpLives.ts` (branché par `jump.ts`) ; aide pure de validation : `checkLife` de `@cdj/jump-sim` ; tests `apps/api/test/jumpLives.test.ts` (SQLite **et** libSQL). **→ Détail : [docs/regles/api/les-morts-de-tout-le-monde-lot-p3.md](../../docs/regles/api/les-morts-de-tout-le-monde-lot-p3.md)**

## Moins de requêtes, coûts et vérification de la production (lot P4)
Synthèse de la plateforme : `docs/plateforme/synthese.md`. Guide des coûts : `docs/plateforme/couts.md`. **→ Détail : [docs/regles/api/moins-de-requetes-couts-et-verification-de-la-production.md](../../docs/regles/api/moins-de-requetes-couts-et-verification-de-la-production.md)**

## Lancement public et remise à zéro (lot R8)
**La date du lancement** : une seule source, `config/lancement.json` (voir le `CLAUDE.md` racine) ; le serveur la prend de `@cdj/core/lancement` (`createApi({ premierJourDuJour })` pour les […] **→ Détail : [docs/regles/api/lancement-public-et-remise-a-zero-lot-r8.md](../../docs/regles/api/lancement-public-et-remise-a-zero-lot-r8.md)**

## Publication des jeux (lot P)
**Table `jeux`** (`PLATFORM_SCHEMA`, migration **réversible** : `DROP TABLE jeux`, `ALTER TABLE results|jump_results DROP COLUMN apercu`) : une ligne par jeu, nommé par son dossier sur le […] **→ Détail : [docs/regles/api/publication-des-jeux-lot-p.md](../../docs/regles/api/publication-des-jeux-lot-p.md)**

## Emplacements
- `docs/plateforme/seed-phase-2.md` — vision et plan en lots de la phase 2.
- `docs/plateforme/recette.md` — guide pas à pas de l'environnement de recette (pour Nathan, à faire une fois).
- `docs/plateforme/lots/` — un README d'une page par lot de la plateforme (`lot-R1-recette.md`, `lot-P0-socle.md`…).
- `docs/plateforme/synthese.md` — l'état de la plateforme (lot P4) ; `docs/plateforme/couts.md` — budget, alertes, décisions quand l'offre gratuite approche (lot P4).
- `apps/api/src/` (lot P0) : `remiseAZero.ts` (lot R8 : la remise à zéro du lancement), `api.ts` (assemblage), `platform.ts`, `identity.ts`, `games.ts`, `registry.ts`, `cdj.ts` (DailyTrack), `jump.ts` (DailyJump), `jumpLives.ts` (lot P3 : vies, carte des morts, échantillon du carnage, oubli), `cache.ts` (lot P4 : en-têtes de cache), `codesErreur.ts` (lot I1 : la liste unique des codes d'erreur, voir « Codes d'erreur (lot I1) »), `portail.ts` et `portailDemo.ts` (lot I2, voir « Portail (lot I2) »), `classementDuJour.ts` et `classementDemo.ts` (lot I3, voir « Portail (lot I3) ») ; `packages/profile` — le profil commun côté client.
- `apps/api/scripts/` : `smoke.ts` + `smokeRead.ts` (lot P4 : `--lecture-seule`), `measure-*.ts`, `platformBudget.ts` + `measure-platform.ts` (lot P4).
- `.github/workflows/` (lot R4) : `production.yml` (**« Mettre en production »**, lot R12 : un bouton — CI complète lancée ou reprise → figer avec le code en production → répétition sur la recette → sauvegarde → serveur → site → `smoke --lecture-seule` → étiquette `prod-…` → jours figés versés dans `main`), `retour-arriere.yml` (image et version du site de l'étiquette précédente), `recette.yml` (fusion dans main → recette : serveur, `recette:seed`, site ; une révision et un aperçu par PR qui touche le serveur), `apercu.yml` (un canal d'aperçu Firebase par PR), `deploy-api.yml` (déploiement réutilisable du serveur), `deploy-site.yml` (déploiement réutilisable du site sur Firebase Hosting), `recette-seed.yml` (lot P2). (`pages.yml` retiré au lot R5 : plus rien sur GitHub Pages.)
- `scripts/domaine.mjs` (adresses, origines permises, canal d'aperçu), `scripts/site.mjs` (site assemblé avec la page des mentions, `firebase.json` d'un déploiement), `scripts/mise-en-production.mjs` (étiquette, changements, jours figés), `scripts/sonde-proxy.mjs` (mesure de `TRUST_PROXY` derrière Firebase ; lot R5 : `entetes`, `faille`) : testés dans `apps/portail/test/`. `docs/plateforme/effacement.md` (lot R5) : la procédure d'effacement d'un joueur. `firebase.json` (racine) : en-têtes, redirections, renvoi `/api/**`.
- `scripts/recette.mjs` — étiquette de révision, dossier d'aperçu, adresse de révision, liste des chemins du serveur (`SERVER_PATHS`) : partagés par les workflows, testés dans `apps/api/test/recette.test.ts`.

## Recette (lot R1)
**Rien ne part en production sans passer par la recette.** Une PR qui touche le serveur (`SERVER_PATHS` : `apps/api`, `packages/sim`, `core`, `clock`, `jump-sim`, le module de profil, […] **→ Détail : [docs/regles/api/recette-lot-r1.md](../../docs/regles/api/recette-lot-r1.md)**

## Domaine et origines (lot R4)
**Le serveur sous la même adresse que les jeux** : Firebase Hosting (`firebase.json`) renvoie `/api/**` vers le service Cloud Run de chaque site (production → `cdj-api`, recette et aperçus […] **→ Détail : [docs/regles/api/domaine-et-origines-lot-r4.md](../../docs/regles/api/domaine-et-origines-lot-r4.md)**

## Sécurité, mentions et effacement (lot R5)
**Comment l'adresse du client est établie** (`node-server.ts`) : `clientKey` = l'entrée de `X-Forwarded-For` à la position `TRUST_PROXY` depuis la droite (**2** derrière Firebase : […] **→ Détail : [docs/regles/api/securite-mentions-et-effacement-lot-r5.md](../../docs/regles/api/securite-mentions-et-effacement-lot-r5.md)**

## Codes d'erreur (lot I1 ; lot I6 : plus de `message`)
Documentation : `docs/plateforme/codes-erreur.md` (la forme, la règle, le tableau code | statut | sens | routes principales).
- **Lot I6 : les erreurs n'ont plus de `message` ; seul le code compte.** Le client traduit `erreur.<code>` (catalogue commun de `@cdj/ui`, français et anglais) ; le texte passé à `HttpError` explique le refus à qui lit le code, il ne sort jamais. (La réponse des vies de Jump n'a plus de `message` non plus : `overCap` et `cap` disent le plafond.)
- **Forme de toute réponse d'erreur** : `{ error: "<code>", …détails }` (`reply` d'`api.ts`) ; erreur inattendue : `500 { error: "internal" }` (`ERREUR_INTERNE`, la même dans `api.ts` et `node-server.ts`) ; `/api/health` en 503 garde `ok` et `db` et ajoute `error: "db_unavailable"`.
- **Liste unique** : `src/codesErreur.ts` (`CODES_ERREUR` : code → statut HTTP + sens ; `CodeErreur`, `estCodeErreur`, `corpsErreur`). **Un code = un statut, imposé par le typage** : `HttpError<C>` (`errors.ts`) déduit `C` du code et n'accepte que le statut de la liste (un autre statut fait échouer `tsc`). Jamais de corps d'erreur écrit à la main.
- **Toute nouvelle erreur** : un code de la liste (ou un code ajouté à la liste avec son statut et son sens), une ligne dans `docs/plateforme/codes-erreur.md`, et sa traduction `erreur.<code>` dans le catalogue commun de `packages/ui` (**français et anglais**), dans le même lot.
- Tests : `apps/api/test/codesErreur.test.ts` (parcours de toutes les routes × méthodes × corps × en-têtes, analyse des sources, accord avec la documentation) et `verifierErreur` (`apps/api/test/helpers.ts`), appliqué par `makeApi().call` à chaque réponse d'erreur de tous les tests de l'API — **lot I6 : il refuse une réponse d'erreur qui porte un `message`** ; SQLite **et** libSQL.

## Portail (lot I2)
Code : `src/portail.ts` (routes), crochet `portail` de chaque jeu (`cdj.ts`, `jump.ts`), `src/portailDemo.ts` (joueur de démonstration) ; tests `test/portail.test.ts`, `test/portailDemo.test.ts` (SQLite **et** libSQL). **→ Détail : [docs/regles/api/portail-lot-i2.md](../../docs/regles/api/portail-lot-i2.md)**

## Mes jeux (lot F1)
**Stockage** : table **`favoris_jeux`** (`PLATFORM_SCHEMA`, clé `(player_id, du)`) — **une ligne par changement** : à partir du jour de Paris `du`, `jeux` (JSON, le dossier de chaque jeu […] **→ Détail : [docs/regles/api/mes-jeux-lot-f1.md](../../docs/regles/api/mes-jeux-lot-f1.md)**

## Sécurité du serveur (lot R7)
Rapport : `docs/plateforme/audit-securite-2026-10.md`. Règles qui en découlent (tests : `apps/api/test/auditR7.test.ts`) :
- **Le plafond de rejeux est proportionnel à la durée** : `platform.spendReplays(replayUnits(replay.runs))` (`replayCost.ts` : une unité par `REPLAY_TICKS_PER_UNIT` = 5 000 pas). Un nouveau rejeu côté serveur appelle `spendReplays` avec ses unités **juste avant** de rejouer, après les vérifications bon marché. Une rediffusion qui ne finit jamais coûte 200 à 350 ms (mesuré) : elle ne vaut jamais « 1 ».
- **Une lecture publique qui parcourt les temps du jour a sa limite** (`readHitAddress`) : classement et fantômes de Track `BOARD_READS_PER_CLIENT` = 300 par fenêtre ; ne jamais ajouter de route de lecture sans limite ni cache.
- **Administration** : jeton Bearer en en-tête, jamais dans l'adresse (`?token=` ignoré), comparaison des empreintes à temps constant, 10 échecs par fenêtre → 429 y compris pour le bon jeton ; **chaque action est journalisée** (`admin : circuit remplacé`, `jeton refusé`…) **sans** jeton, adresse ni pseudo ; au démarrage, `adminTokenWarning` signale un jeton de moins de 32 caractères (≥ 32 : `openssl rand -hex 24`). Une nouvelle route `/api/admin/*` passe par `requireAdmin` et se journalise.
- **Compteurs de débit** : l'adresse de connexion (mémoire) est comptée **avant** d'écrire un compteur en base (`hitAddress`) ; le ménage de `rate` se fait une fois par fenêtre et par instance.
- **En-têtes de réponse** : `SECURITY_HEADERS` (`api.ts`) sur toutes les réponses (JSON seulement).
- **Validation** : toute entrée (corps, en-tête, paramètre d'adresse) est validée avant la base ; aucune requête SQL construite par concaténation d'une donnée (des `?` seulement ; `${}` réservé aux listes de `?` et aux constantes).
- Journaux : ni identifiant, ni pseudo, ni adresse, ni jeton, ni rediffusion.

## La preuve de l'auteur et les copies (lot R9)
Audit : S-08, S-16 (`docs/plateforme/audit-securite-2026-10.md`). **→ Détail : [docs/regles/api/la-preuve-de-l-auteur-et-les-copies-lot-r9.md](../../docs/regles/api/la-preuve-de-l-auteur-et-les-copies-lot-r9.md)**

## Administration (lot N1)
**Fichiers** : `adminGoogle.ts` (vérification du jeton d'identité), `adminSession.ts` (cookie et table `admin_sessions`), `admin.ts` (routes, tableau de bord, joueurs, les cinq actions), […] **→ Détail : [docs/regles/api/administration-lot-n1.md](../../docs/regles/api/administration-lot-n1.md)**

## Nouveautés et message en direct (lot N2)
**Tables** (`PLATFORM_SCHEMA`, migration **réversible** : deux tables nouvelles, rien d'existant touché ; retour arrière : `DROP TABLE nouveautes` et `DROP TABLE annonces`) : […] **→ Détail : [docs/regles/api/nouveautes-et-message-en-direct-lot-n2.md](../../docs/regles/api/nouveautes-et-message-en-direct-lot-n2.md)**

## Des envois sans faux « serveur indisponible » (lot D2)
**Un renvoi déjà accepté répond avant le rejeu (C5)** : même joueur, même jour (et même état d'aperçu), **même rediffusion (texte identique)** que la partie déjà écrite → `200` avec **la […] **→ Détail : [docs/regles/api/des-envois-sans-faux-serveur-indisponible-lot-d2.md](../../docs/regles/api/des-envois-sans-faux-serveur-indisponible-lot-d2.md)**

## Minuit, mémoire et blocages (lot D3)
**Le niveau du lendemain est calculé avant minuit.** Dans la **demi-heure qui précède minuit de Paris**, la première requête qui arrive sur une instance lance, sans que sa réponse […] **→ Détail : [docs/regles/api/minuit-memoire-et-blocages-lot-d3.md](../../docs/regles/api/minuit-memoire-et-blocages-lot-d3.md)**

## Turso sobre (lot R14)
**Jamais de Turso dans un test ou un outil de mesure** : `openTestDb` = `:memory:` ou un fichier libSQL ; `openLibsql` lève sous Vitest (`VITEST`) devant tout hôte hors de la machine […] **→ Détail : [docs/regles/api/turso-sobre-lot-r14.md](../../docs/regles/api/turso-sobre-lot-r14.md)**

## Module des jeux (lots K2 et K2b)
conception : `docs/plateforme/kit-de-jeu.md`, § 4. Code : `src/jeux/` (**importer `./jeux/index`** : `src/jeux.ts` est l'interrupteur des jeux, lot P) ; tests : `test/jeuxModule.test.ts` et **les bancs de réponses** `test/bancTower.test.ts`, `bancJump.test.ts`, `bancTrack.test.ts`. **Tower (K2) et Jump (K2b) sont sur le module** ; **Track (`cdj.ts`) ne l'est pas encore** (K2c : son banc existe, la migration non — voir le README).
- **Ce qu'un jeu fournit** : (1) la **fiche** (`config/jeux/<id>.json`, lue par `src/fiches.generated.ts` : `FICHES_SERVEUR`, écrit par `npm run fiches` — colonnes du classement et sens, poids d'un rejeu, premier jour, format) ; (2) son **contrat** (`jeux/contrat.ts`, `ContratJeu`) : versions, règle et calcul du niveau du jour (`regle`, `calculer`, `restaurer`), validation d'un envoi (`decoder`, `jourDe`, `memeContenu`, `entrees`, `rejouer` — **ou** `valider`, voir plus bas), ce qu'une partie écrit (`rejouee`), la médaille, le fantôme, le format de ses réponses (`ligneClassement`, `reponseEnvoi`, `jourProfil`, `versPortail`, `tableau`). **Le contrat ne connaît ni la base ni HTTP** : il lève `RefusJeu` (un code de la liste unique `codesErreur.ts`), le module en fait la réponse au statut de la liste ; (3) son **adaptateur de table** (`jeux/adaptateur.ts`, `AdaptateurTable`) : la table des résultats, ses colonnes de classement et leur sens (celui de l'index de la table ; `signe: -1` pour une clé rangée en croissant), les colonnes écrites, celles qu'une meilleure partie ne remplace pas, la table du niveau du jour, et si la table n'a pas de colonne `medal` (`sansMedaille`, Jump : la médaille se lit sur le niveau, `medailleDeLigne`) ou lit des colonnes de plus (`lecturesPlus`, Jump : `deaths`). `verifierAdaptateur` refuse un adaptateur qui ne dit pas le classement de la fiche. **Une table commune `resultats_jeu` (lot K4) sera un adaptateur de plus** (`filtreJeu`, `signe`) : le test `jeuxModule.test.ts` le prouve sur une table d'essai ; elle n'existe pas dans le schéma.
- **Ce que fait le module** (`jeux/module.ts`, `creerJeu`) : les routes `info`, `day/<date>`, `submit`, `day/<date>/board`, le fantôme réservé aux classés (`403 not_ranked`), `me` ; l'**ordre de validation** d'un envoi (débit en base → taille → texte → jour de Paris et grâce → version → pseudo → copies → `spendReplays` → rejeu → écriture) ; le classement (rang par l'index, `hidden = 0`, meilleure partie seulement), l'aperçu (`apercu`, `viderApercu`), l'effacement, « Changer mon code » et les crochets `portail` et `admin`. Le filtre `filtre=amis` / `groupe` et le classement des groupes ne sont **pas** dans le module : ils passent par `api.ts` → `amis.classementJeu` (`MOTIFS_JEUX` de `amis.ts`, une ligne par jeu) et lisent le classement que `portail.classes` rend. **Les requêtes sont fabriquées une fois par `sqlDe`** (plan et lignes lues vérifiés, R14).
- **Les points d'extension (lot K2b)** — tous facultatifs, absents = le comportement de Tower ; **le module ne nomme jamais un jeu** : (1) `valider(corps, ctx)` : un jeu dont l'ordre des contrôles est le sien (Jump : le niveau du jour d'après `levelId`, les versions du corps, la rediffusion, un essai qui part du départ) valide tout, dans son ordre, et appelle `ctx.avantRejeu()` (joueur actif et pseudo) avant de dépenser le plafond (`unites` dit le poids d'un rejeu) ; le module fait ensuite les copies (**après** le rejeu, comme avant), l'écriture et la réponse ; `corpsDeRegistre` donne le corps du `validate` du registre ; (2) `tableau(c)` met le classement en forme (**le point d'extension du board** : `levelId`, `deaths`, un niveau lu seulement s'il y a des classés ; il sert aussi la réponse d'un envoi, sans relire ta ligne) ; (3) `jourMin` (avant lui `404 unknown_day`), `messagesJournal`, `etatSansEssai` (Jump : `en_cours`) ; (4) dans `ConfigJeu` : `avantRoute` (Jump y oublie les vies d'un jour fini), `recevoirOutils` (le module prête `OutilsModule` : le niveau d'un jour, `dayOf`, `ouvert`, le classement, la place, le nombre de classés), `profil` (le `me` du jeu quand son format n'est pas celui du module), `memoClasses` (le nombre de classés gardé en mémoire par le portail), `surcharges` (`portail`, `admin`, `rotation`, `effacement`, `apresRenommage`, `apresEffacement` : ce que le jeu ajoute ou remplace dans ce que le module fabrique — Jump y met la place gardée d'un jour fermé, `final_rank`, et ses vies).
- **`routesPropres`** (`ConfigJeu`) : les routes que seul un jeu a (Salon, Garage, vies, carnage, fantôme du premier, lecture regroupée, pages d'outils) sont des fonctions `(path, req, url, info, outils)` essayées après celles du module ; **elles ne migrent jamais**. Une écriture permise en aperçu se déclare dans `ecrituresApercuPropres`.
- **Jump (K2b)** : `src/jump.ts` = `contratJump` (+ `ADAPTATEUR_JUMP`), ses routes propres (`lives`, `ghost/first`, `deaths`, `carnage`, `bundle`), son profil `me` et les surcharges du portail et de l'administration ; `jumpLives.ts` (vies, carte, carnage, oubli) est inchangé et reçoit ses dépendances du module (`recevoirOutils`).
- **Le fil de calcul** (`jeux/fil.ts`, fiche `rejeu.fil`) : `executeurFil` est générique (un fil par instance, file de 4, `503 busy`, délai de 15 s) ; le script du fil est celui du jeu (`towerFilTravail.ts` → `tower-fil.mjs`).
- **Les bancs de réponses** (`scripts/banc.ts`, scénarios `scripts/banc-tower.ts`, `banc-jump.ts`, `banc-track.ts`, références versées `test/fixtures/banc-<jeu>.json`) : un scénario scripté joue tout ce qui sort du serveur du jeu (envoi, un refus par code, classements Tous / Amis / Mon groupe / Groupes, profil, fantôme, copie, `off` / `preview` / `on`, administration, effacement, jour figé ; Jump : vies, carte, carnage, `bundle`, oubli de fin de jour ; Track : routes historiques, planning, Salon, Garage, médailles de chaque version du générateur) et compare **chaque réponse** (statut, en-têtes de cache, corps normalisé) à la référence, sur SQLite **et** libSQL `file:` (jamais Turso). **À lancer à toute modification de `src/jeux/**`, des trois à la fois** (ils tournent avec `npm test` ; `npx vitest run --project sqlite apps/api/test/banc`). `UPDATE_BANC=1` réécrit la référence : **seulement pour une différence voulue**, listée et justifiée dans le README du lot, jamais pour faire passer un refactor. Une durée mesurée sur l'horloge réelle est masquée (`normaliser`). `npm run measure:rejeu -w @cdj/api` : le temps d'un envoi complet de chaque jeu (médiane de 20 passes).
- **Règles** : une nouvelle route ou un nouveau champ communs à tous les jeux s'écrit **dans le module** (puis le banc de chaque jeu migré) ; un jeu migré ne réécrit pas ce que le module fait ; les `new HttpError(<statut>, "<code>"` du module sont écrits en clair (le test de `codesErreur.test.ts` lit `src/jeux/`) et un code que seul un contrat lève (`new RefusJeu("<code>"`) compte aussi ; aucune table, aucune migration, aucune version ne change à cause du module.

## Un jeu neuf sur le module (lot K4c)
Code : `src/jeux/defauts.ts`, `adaptateur.ts` (`adaptateurResultatsJeu`) ; tests : `test/jeuNeuf.test.ts` (un jeu jouet, **deux fiches de test** : un score ↓ et un temps ↑, SQLite **et** libSQL) et `test/jeuNeufAide.ts`. **→ Détail : [docs/regles/api/un-jeu-neuf-sur-le-module-lot-k4c.md](../../docs/regles/api/un-jeu-neuf-sur-le-module-lot-k4c.md)**

## Tower (lot T4)
**Au registre depuis le lot TP** (voir « Tower sur la plateforme (lot TP) » ci-dessous) ; il reste `off` (jeu sans ligne dans `jeux`). **→ Détail : [docs/regles/api/tower-lot-t4.md](../../docs/regles/api/tower-lot-t4.md)**

## Tower sur la plateforme (lot TP)
**Le score en hauteur dans les crochets** (`games.ts`) : `ScorePortail = { unite: "mm", valeur, vies }` est un champ **facultatif à côté des champs existants** (`EtatPortail.fini.score`, […] **→ Détail : [docs/regles/api/tower-sur-la-plateforme-lot-tp.md](../../docs/regles/api/tower-sur-la-plateforme-lot-tp.md)**

## Amis (lot F2)
**Modèle** : `amities (joueur, ami, origine, cree_le)`, clé `(joueur, ami)` + index `amities_by_ami` ; `invitations_amis (joueur PK, empreinte UNIQUE, cree_le)` (un lien actif par joueur). **→ Détail : [docs/regles/api/amis-lot-f2.md](../../docs/regles/api/amis-lot-f2.md)**

## Retours (lot C1)
**Modèle** (`PLATFORM_SCHEMA`, migration **réversible** : deux tables nouvelles ; retour arrière `DROP TABLE retours` et `DROP TABLE retours_messages`) : `retours` (un fil : `player_id` — […] **→ Détail : [docs/regles/api/retours-lot-c1.md](../../docs/regles/api/retours-lot-c1.md)**

## Avatars (lot C1, partie B)
**Contrôle** (`controlerImage`, octet par octet, aucune bibliothèque) : **WebP nu** (conteneur RIFF avec un seul segment `VP8 ` ou `VP8L`) **ou JPEG** (marqueurs lus un à un jusqu'au […] **→ Détail : [docs/regles/api/avatars-lot-c1-partie-b.md](../../docs/regles/api/avatars-lot-c1-partie-b.md)**

## Groupes (lot C1, partie C)
**Modèle** (migration **réversible** : deux tables nouvelles ; retour arrière `DROP TABLE groupes` et `DROP TABLE groupe_membres`) : `groupes` (`id` public de 12 hexadécimaux tirés au […] **→ Détail : [docs/regles/api/groupes-lot-c1-partie-c.md](../../docs/regles/api/groupes-lot-c1-partie-c.md)**
