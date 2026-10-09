# Lot 27 — Le Salon côté serveur

**À essayer**

1. **Le Salon en démonstration, inchangé** (aperçu de la branche) : [`?mode=salon&api=demo`](https://nathan-te.github.io/DailyTrack/b/lot-27-salon-serveur/?mode=salon&api=demo) — joueurs fictifs dans le navigateur, rien n'est envoyé nulle part. Ce lot n'y change rien.
2. **Le vrai Salon, en local** (le vrai serveur : même code que le conteneur Docker, base SQLite). Le **vrai Salon en ligne se testera à la mise en ligne** : il n'y a pas encore de serveur déployé, l'aperçu GitHub Pages ne peut donc pas l'essayer.

   ```
   npm install
   npm run build:node -w @cdj/api
   SALON_MINUTES=2 DB_PATH=:memory: npm start -w @cdj/api        # l'API : http://localhost:8787  (sessions de 2 minutes)
   npm run dev                                                    # le jeu : http://localhost:5173
   ```

   puis ouvrir **`http://localhost:5173/?mode=salon&api=http://localhost:8787`** dans **deux fenêtres** (une normale, une privée : chacune est un joueur). Jouez chacun un tour : l'autre apparaît au classement et en fantôme (touche **G**, **Tab** pour le classement) ; à la fin de la session (compte à rebours en haut à gauche, « dernier essai » à 30 s) le podium s'affiche, puis le circuit suivant s'installe pour les deux au même moment. Sans `SALON_MINUTES` : sessions de 10 minutes, comme en production. Le jeu sait quoi demander : `?api=…` (ou `VITE_API_URL` à la construction) suffit, rien d'autre à régler.
3. **Mesurer la charge** : `npm run measure:salon` (≈ 20 s ; `PLAYERS=200` pour un autre nombre de joueurs).

## Ce qui a été fait

- **Routes** (`apps/api/src/salon.ts`, branchées dans `api.ts` ; elles servent exactement le contrat `SalonApi` du lot 26) :

| Route | Rôle |
|---|---|
| `GET /api/salon/now?player=<id>` | heure du serveur, session, début/fin, id du circuit, **présents** ; compte le joueur comme présent |
| `GET /api/salon/<session>/board?player=<id>&since=<v>` | classement : les 15 premiers + le voisin de devant et de derrière du joueur, sa ligne, la **version** (`unchanged` si inchangée) |
| `GET /api/salon/<session>/ghosts?refs=a,b` | rediffusions demandées par **référence publique** (au plus 8, 16 hexadécimaux) |
| `POST /api/salon/<session>/submit` `{ playerId, name, replay }` | **rejeu** sur `salonCircuit(session)` ; temps recalculé, rang, classement à jour |
| `GET /api/salon/podiums?limit=N` | (en plus du contrat, pas utilisée par le jeu) podiums gardés des dernières sessions |

- **Validation** : l'envoi est **rejoué** sur `salonCircuit(session)` (même code de simulation que le jeu) ; seul le temps recalculé est enregistré. Refus : session pas commencée (`session_future`) ou terminée depuis plus de 60 s (`session_closed`), rediffusion d'un autre circuit (`track_mismatch`), d'une autre `SIM_VERSION` (`sim_version`), qui ne finit pas (`not_finished`), illisible (`invalid_replay`), pseudo invalide ou manquant. **Meilleur temps par joueur et par session** (un temps égal ne vole pas la place du premier arrivé) ; **un joueur n'existe qu'après une course valide** (même table `players` que le classement du jour : un seul pseudo, `PUT /api/player` marche pour les deux). Un tour plus lent ne change rien ; un pseudo changé change la version du classement.
- **Données** (`db.ts`, créées au premier appel) : `salon_runs` (session, joueur, **référence**, pseudo, temps, étapes, rediffusion, date), `salon_podiums` (trois premiers de chaque session terminée + nombre de participants), `salon_sessions` (**version** du classement), `salon_circuits` (circuit généré, id et texte), `salon_presence`, `salon_throttle`. **Purge** : courses de plus de **48 h** supprimées (après avoir figé leur podium, même si le serveur est resté arrêté des jours), podiums gardés **30 jours** (choix de ce lot : le seed dit « conservés », sans durée), restes de présence et de débit nettoyés ; au plus une fois par minute, au fil des envois et par la tâche périodique.
- **Référence publique** : empreinte salée de `session | identifiant` (`RATE_SALT`) tronquée à 16 hexadécimaux : l'identifiant secret ne sort jamais du serveur, et la même personne n'a pas la même référence d'une session à l'autre (on ne peut pas la suivre).
- **Circuits préparés à l'avance** : la tâche `api.tick()` (le serveur Node l'appelle toutes les 15 s, et au démarrage) garde le circuit de la session en cours et, **dans les deux dernières minutes**, génère celui de la suivante ; il est gardé en base (`salon_circuits`) et en mémoire, donc un redémarrage ne régénère rien. Sans la tâche (Workers, aucune minuterie), le circuit se génère à la première requête qui en a besoin. Un circuit gardé par une autre `GENERATOR_VERSION` est ignoré et régénéré.
- **Heure et présence** : `now` donne l'heure du serveur. Présence = joueurs ayant interrogé le Salon (`now`, `board`, `submit`) dans les **30 dernières secondes** ; seule l'**empreinte salée** de l'identifiant est gardée (rien d'autre : ni identifiant, ni adresse).
- **Sécurité et débit** (règles du § 4 de l'orchestration) : requêtes SQL paramétrées, corps borné (400 ko, 413 sinon), pseudo validé (affiché en `textContent` par le jeu), adresses et identifiants hachés. **Au plus un envoi toutes les 5 s par joueur** (un seul `INSERT … ON CONFLICT … WHERE … RETURNING` atomique ; compté même pour une rediffusion invalide, mais pas pour un pseudo oublié), **60 envois par adresse et par 10 minutes comptés avant tout rejeu**, 600 lectures par adresse et par 10 minutes. Numéros de session bornés (de la plus ancienne session gardée à la suivante) ; références invalides refusées avant toute requête.
- **`SALON_MINUTES`** (0,5 à 60 ; **tests et essais locaux seulement, absente en production**) : durée d'une session. Le serveur journalise un avertissement quand elle est réglée, refuse de démarrer si elle est hors limites, et `GET /api/health` la répète (`salonMinutes`). Le jeu, lui, lit la durée dans `now` : `?salonMinutes` n'a pas d'effet avec un vrai serveur.
- **`PRAGMA synchronous = NORMAL`** (`node-sqlite.ts`, en mode WAL) : trouvé par la mesure de charge — chaque lecture du Salon écrit (présence, débit), et un `fsync` par écriture, sur le fil de Node, multipliait par 2,5 le temps de calcul et faisait grimper les lectures à ≈ 20 ms au p95 (0,7–1,1 ms depuis). Seule conséquence : une coupure de courant peut perdre les toutes dernières écritures, jamais corrompre la base.
- **Jeu** : rien à changer — `HttpSalonApi` (lot 26) parle déjà ce contrat ; ouverture du Salon avec une API = `bootSalon` ; le mode démo est intact.
- **Docker** : rien à changer. Variables du serveur : `PORT`, `DB_PATH`, `ALLOW_ORIGIN`, `TRUST_PROXY`, `RATE_SALT`, `ADMIN_TOKEN`, et, **jamais en production**, `SALON_MINUTES`.
- **Workers** : les routes passent par le même `createApi`, elles y marchent donc sans rien de plus ; mais l'offre gratuite ne tient de toute façon pas un rejeu (≈ 38 ms) et le Worker n'a pas de minuterie : pas de préparation anticipée, ni de purge hors des envois. Non essayé sur Workers.

## Mesure de charge

`npm run measure:salon` : une session de 10 minutes, **50 joueurs** qui envoient une course toutes les 40 s (707 envois) et lisent le classement toutes les 5 s (5 828 lectures), `now` toutes les 30 s, fantômes quand le classement change. **Horloge simulée** (la session se déroule en ≈ 20 s), mais **temps de calcul réel** de chaque requête, rejeu compris, sur une base SQLite en fichier. Conteneur de test : Intel Xeon 2,8 GHz, **un seul cœur utilisé** (Node traite les requêtes sur un fil).

| | médiane | p95 | max |
|---|---|---|---|
| envoi (rejeu compris) | 18,1 ms | 27,4 ms | 43,5 ms |
| classement | 0,64 ms | 1,1 ms | 13,7 ms |
| fantômes (≈ 5 rediffusions) | 0,52 ms | 0,9 ms | 3,9 ms |
| `now` | 0,46 ms | 0,76 ms | 11,4 ms |

- **Une session à 50 joueurs : 19,1 s de calcul sur 600 s, soit 3,2 % du fil** (0,64 ms par joueur et par seconde) ; **200 joueurs : 13,1 %** (la charge est linéaire : 0,66 ms par joueur et par seconde). Réponses : 16 ko/s à 50 joueurs, 60 ko/s à 200.
- **Mémoire** : RSS 88 → 130 Mo (tas JS 13 → 12 Mo) ; **base** : 8 ko par rediffusion, un seul meilleur temps gardé par joueur et par session → ≈ 0,4 Mo par session à 50 joueurs, **≈ 112 Mo sur 48 h** (≈ 450 Mo à 200 joueurs en continu), puis purge.
- **Génération du circuit d'une session : ≈ 0,4–0,5 s** (jusqu'à ≈ 1,3 s mesuré au lot 26), faite deux minutes avant, **mais sur le fil principal de Node** : pendant ce temps le serveur ne répond à rien d'autre (une demi-seconde toutes les 10 minutes).
- **Salve** : si les 50 joueurs envoient au même instant, ≈ 1 s pour tout traiter (200 joueurs : ≈ 3,9 s). Dans la réalité les envois sont étalés (chaque joueur finit sa course quand il veut) ; la salve est le pire cas, pas l'ordinaire.

**Ce que tient le serveur de Nathan** (estimation) : sur ce processeur, **50 % du fil occupé ≈ 770 joueurs présents en continu, 80 % ≈ 1 200**. À garder en tête : (1) c'est un **calcul de coût moyen** — des pointes (fin de session) font attendre les lectures de quelques centaines de millisecondes ; (2) le serveur de Nathan n'a probablement pas ce processeur : pour **un cœur 3 à 5 fois plus lent** (petit serveur, Raspberry Pi), compter **≈ 150 à 250 joueurs** à 50 % ; (3) le classement du jour s'ajoute (un envoi par joueur et par jour : négligeable) ; (4) au-delà de ≈ 500 joueurs simultanés, la première chose à faire serait de sortir les rejeux dans un `worker_threads` (le fil principal ne ferait plus que les lectures). **Ordre de grandeur honnête : « plusieurs centaines » sans rien changer** ; le Salon lui-même n'a pas été mesuré en ligne (tunnel Cloudflare, latence réseau).

## Garde-fous

- `apps/api/test/salon.test.ts` (34 tests, SQLite en mémoire, horloge injectée) : envoi valide classé ; **temps annoncé ignoré** ; deux joueurs, écarts et ligne marquée ; **meilleur temps conservé** (version inchangée si rien ne change) ; égalité ; pseudo mémorisé ou demandé ; joueur inconnu non créé ; **rediffusion falsifiée refusée** (tronquée, autre circuit, autre `SIM_VERSION`, texte quelconque) ; **envoi hors délai refusé** (à +59,999 s accepté, à +60,001 s refusé, session future refusée) ; pseudo / corps / session invalides, corps énorme (413) ; circuit généré par le serveur puis relu après un « redémarrage » ; **débit limité** (un envoi toutes les 5 s, par adresse avant tout rejeu, lectures) ; aucune adresse ni identifiant en clair dans `rate`, `salon_throttle` et `salon_presence` ; version / `unchanged` ; voisins de devant et de derrière d'un 41ᵉ ; références invalides et injections refusées, références d'une autre session ignorées ; **circuit suivant préparé dans les deux dernières minutes** ; **podium figé puis gardé quand les courses sont purgées à 48 h** (horloge simulée) ; podium d'un serveur resté arrêté cinq jours ; rien de purgé pendant l'envoi encore ouvert.
- `apps/web/e2e/salon-serveur.spec.ts` (Chromium, **vrai serveur local** `SALON_MINUTES=1` lancé par Playwright sur le port 8788, **deux navigateurs** isolés) : chacun termine une course (rediffusion d'un pilote, `timescale=6`), le serveur retrouve **exactement** les temps de la simulation, chacun voit la ligne et le fantôme de l'autre (« Toi » compris), le serveur compte deux présents, **la bascule de session se fait pour les deux au même moment** (écart mesuré : 225 ms, tolérance 3 s) vers le même circuit `salon-<session+1>-g<G>`, aucune génération sur le fil principal.
- Golden inchangés ; `SIM_VERSION` et `GENERATOR_VERSION` inchangées (aucune physique, aucun circuit). Le classement du jour, ses tests et ceux du Salon en démo : verts.

## Décisions et limites

- **Lot 25 pas encore fusionné** ([#41](https://github.com/Nathan-Te/DailyTrack/pull/41)) au moment de ce lot : le Salon utilise le générateur tel qu'il est sur `main`. À la fusion, `GENERATOR_VERSION` change : le serveur suit tout seul (`salonTrackId` / `salonCircuit` viennent de `sim`, un circuit gardé par une autre version est régénéré) ; seul le jeu de démonstration (`history:seed`) est à refaire, comme après tout changement de version.
- Les sessions sont comptées en **UTC** ; le classement d'une session ne se lit plus au-delà de 48 h (404) : seuls les podiums restent (`GET /api/salon/podiums`, 30 jours).
- La **présence n'est pas authentifiée** (comme le reste des lectures) : quelqu'un qui connaît des identifiants — ou en invente — peut gonfler le compteur « joueurs présents » ; limité par les 600 lectures par adresse et par 10 minutes, et purement cosmétique (rien ne dépend de ce nombre).
- Un joueur qui change de navigateur est un autre joueur (même règle que le jour). Pas de modération des pseudos au-delà de la validation existante.
- Voitures en direct (WebSocket), plusieurs salons, points cumulés : hors périmètre. Le jeu interroge le serveur (classement toutes les 5 s, `now` toutes les 30 s).
- **Non vérifié** : un Salon **en ligne** (tunnel Cloudflare, latence réelle), le Worker Cloudflare, Firefox et WebKit (la CI les lance), un vrai téléphone, la charge avec de vrais navigateurs (la mesure simule les requêtes, pas les clients).
