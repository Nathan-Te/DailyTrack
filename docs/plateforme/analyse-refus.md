# Rediffusions refusées et « serveur indisponible » — analyse (lot D1)

Enquête **sans correction** (K2bc et K3 modifient en ce moment le serveur et les jeux). Niveaux de preuve : **reproduit** (en local, `scripts/analyse/reproduire-refus.ts`), **déduit** (du code, fichier cité), **à confirmer** (il faut les données de la production, que cet agent n'a pas). Aucune donnée de joueur ici.

## En tête

- **H6 (écart de déterminisme navigateur ↔ serveur) : non confirmée, non exclue.** Rien ne la montre ; elle est gardée par les golden rejoués dans Node (31 tests verts relancés ici : `packages/sim`, `packages/jump-sim`, `packages/tower-sim`) et par les specs `@navigateurs` (Chromium, Firefox, WebKit). Mais le tableau de bord additionne tout : **il ne peut pas la voir** (§3).
- **Les deux constats ne se rejoignent pas comme on le pensait.** Le renvoi d'une partie déjà acceptée **n'est jamais un refus** (H2 : reproduit). L'hypothèse « le jeu abandonne avant la fin du rejeu, le serveur écrit quand même » (H1) est **possible et reproduite dans son mécanisme**, mais il faut ≈ 320 à 600 ms par instruction SQL, ou un blocage équivalent, pour atteindre les 8 s du jeu : c'est un événement rare, pas le fonctionnement normal.
- **Le tableau de bord ne dit pas pourquoi** : il affiche un seul total « Rediffusions refusées (24 h) » (`apps/api/src/admin.ts:432` jette le détail par code que `journaux.erreurs24h()` calcule). C'est la première correction.

## 1. Le chemin d'un envoi

### Côté jeu

| | Track | Jump | Tower |
|---|---|---|---|
| Délai de la requête | 8 s (`TIMEOUT_MS`, `packages/profile/src/client.ts:43`, `AbortController`) | 8 s (même `call`) | 8 s (même `call`) |
| Nouvelles tentatives | **pas de file** : le record reste « non envoyé » (`needsSubmit`) ; renvoi manuel (« Réessayer »), au lancement, au retour sur l'accueil, à l'événement `online` (`apps/web/src/main.ts:1173`, `:1597`) | **file** `RankQueue` : un envoi par jour, le meilleur ; 5 s, 15 s, 30 s, 60 s, 120 s, 300 s (`rankQueue.ts` `RETRY_MS`) ; tout de suite au retour du réseau | `Envoi` : 15 s doublé jusqu'à 300 s (`envoi.ts:51`) ; retour du réseau, page visible |
| Réponse → message | timeout / réseau (statut 0) : « Hors ligne : course non classée (Le serveur ne répond pas. / Serveur injoignable.) » ; 429, 503 : le texte du code (`erreur.rate_limited`, `erreur.busy`) | **statut 0, 429, ≥ 500, `not_found` → tous « Classement indisponible, ton temps sera envoyé. »** (`ranking.ts:195`, `rankView.ts:92` ; seul le 429 a « Trop d'envois ») ; `version` → « nouvelle version », envoi **oublié** ; autre 4xx → « refused », envoi oublié | statut 0, 429, ≥ 500 → « Hors ligne, non classé : ta partie sera envoyée. » ; `version` et autres 4xx : record marqué envoyé, oublié |
| Au renvoi | renvoie le même record | renvoie la même rediffusion ; `confirm` ne se fait qu'à une réponse reçue | idem (`noterEnvoye` seulement si `r.ok`) |

Conséquence : **timeout, coupure réseau, 429, 502/503/504 et 500 donnent le même message** (Jump, Tower) ; le message ne dit pas si le serveur a reçu la partie.

### Côté serveur (module commun pour Tower ; `cdj.ts` et `jump.ts` pour Track et Jump)

Ordre (du moins cher au plus cher) : débit par adresse puis par joueur (**en base**) → taille du corps → décodage et versions → jour (Paris, **grâce de 10 minutes**) → contenu du jour → pseudo et code → **copies** (`player_id <>` : le même joueur n'est jamais « copie » de lui-même, `cdj.ts:443`, `jump.ts:555`, `jeux/adaptateur.ts:166`) → **plafond de rejeux** (`spendReplays`, 600 unités/min/instance, 503) → rejeu → écriture → rang et classement. Instructions SQL mesurées : **Track 14 (24 sur instance neuve), Jump 13 (24), Tower 11 à 13**.

Ce que le tableau de bord compte (« rediffusions refusées ») = **8 codes sur une route finissant par `/submit`** (`journaux.ts:24,38`) :

| Code | Statut | Déclencheur | Jeu |
|---|---|---|---|
| `invalid_replay` | 400 | illisible, tronquée, réglages non permis, autre niveau, départ non neuf | tous |
| `sim_version` | 409 | simulation d'une autre version | Track, Salon |
| `track_mismatch` | 409 | autre circuit que celui du serveur (autre version du générateur **ou planning remplacé**) | Track, Salon |
| `version` | 409 | versions annoncées ≠ celles du niveau du jour, ou identifiant de niveau ≠ celui du serveur | Jump, Tower |
| `not_finished` | 422 | le **rejeu du serveur** n'arrive pas au bout | tous |
| `replay_copy` | 409 | mêmes entrées que l'auteur, qu'un autre joueur ce jour-là, ou qu'un résultat retiré | tous |
| `not_daily` | 409 | niveau du futur, thème forcé, scénario | Jump, Tower |
| `invalid_level` | 400 | identifiant de niveau illisible | Jump |

**Non comptés** : `day_closed` (grâce passée), `unknown_day` (Track, date du futur), `name_taken`/`name_required`, `code_revoked`, **429 `rate_limited`**, **503 `busy`** (compté « erreur serveur », pas « rediffusion »).

Durée du rejeu : Track ≈ 15 à 40 ms, Jump ≈ 5 à 30 ms (`apps/api/CLAUDE.md`), Tower 0,25 s en médiane, **0,65 s au pire** (`towerRejeu.ts`, un fil, file de **4**, `503 busy` au-delà). Limites : 30 envois par joueur et **60 par adresse** par fenêtre de 10 min ; lectures (classement…) 120 par adresse (Jump) ou 300 (Track), en mémoire par instance.

### Côté plateforme

Cloud Run (`deploy-api.yml:383-390`) : `europe-west1`, **min 0**, **max 2**, 1 vCPU, 512 Mo, **concurrence 40**, `--timeout=30`, pas de `--cpu-boost` ni de CPU permanent. Firebase Hosting renvoie `/api/**` vers lui, **60 s** au plus. Image : un seul `server.mjs` de 5 Mo ; démarrage mesuré ici **857 ms** (processus + schéma), premier circuit Track 0,3 s, **premier niveau Jump 1,1 s**. Base Turso : une instruction = un aller-retour réseau. `node-server.ts` ne règle ni `keepAliveTimeout` ni l'abandon d'une requête annulée : **le serveur finit toujours le travail d'un client parti**.

## 2. Les hypothèses

| # | Verdict | Preuve |
|---|---|---|
| **H1** délai du jeu < travail du serveur | **Mécanisme reproduit ; fréquence inconnue** | Script §B : serveur HTTP local, jeu qui abandonne à 1 s → rien d'écrit à cet instant, **résultat écrit quelques secondes plus tard sans nouvel envoi**. Seuil : un envoi chaud dure 0,75 s à 50 ms/instruction, 2,1 s à 150 ms, 5,7 s à 400 ms ; **8 s à ≈ 570 ms/instruction (Track chaud), ≈ 320 ms (instance neuve)**. Normalement loin du compte ; il faut une panne de Turso, un démarrage à froid sur une instance saturée ou un processeur bridé (voir limite plus bas). **À confirmer** : requêtes `/submit` en 200 avec latence ≥ 8 s (§4). |
| **H2** renvoi d'une partie acceptée compté en refus | **Réfutée** (reproduit) | Même joueur, mêmes entrées : `200 improved=false`, **aucune ligne** dans `journal_erreurs`, sur Track et Jump ; Tower par le même module (`towerEnvoi.test.ts`). Le renvoi coûte seulement **un second rejeu**. Variante rare, **déduite** : une identité changée entre le premier envoi (accepté mais sans réponse) et le renvoi (code chargé, `applyIdentity` garde le record du jour non confirmé) donne un `replay_copy`. |
| **H3** 429 / 503 affichés « indisponible » | **Vraie pour le message (déduit du code), cause à confirmer** | Jump et Tower : tout 429/503 → « indisponible », puis succès au renvoi (5 s / 15 s). 429 reproduit à la 31ᵉ requête d'un joueur et à la **61ᵉ d'une même adresse**. **Piste sérieuse : CGNAT mobile, école, entreprise** — les joueurs d'une même adresse publique partagent 60 envois et 120 lectures par 10 min (déduit). 503 `busy` : plafond de 600 unités/min/instance (Track/Jump : hors d'atteinte) ; **Tower : plus de 4 rejeux en attente par instance** (file) — hors production tant que Tower est `off`. |
| **H4** onglet ouvert pendant une mise en production | **Reproduite** | Jump `version` ×2 (générateur, simulation), Track `sim_version` et `track_mismatch` : **comptés**. Chaque mise en production régénère les jours sans résultat (règle R11) : tout onglet resté ouvert envoie un `version`. Effet pour le joueur : Jump **oublie** l'envoi. Fréquence : à croiser avec les étiquettes `prod-…` (§4). |
| **H5** partie commencée avant minuit, envoyée après la grâce | **Reproduite, mais invisible au tableau de bord** | 00:09:59 Paris → accepté ; 00:10:02 → `409 day_closed`, **non compté**. Ne peut donc pas expliquer le total affiché. |
| **H6** déterminisme | **Non confirmée** | Golden verts (31 tests). Signal à guetter : un `not_finished`/`invalid_replay` venu du **jeu officiel** (qui n'envoie que des parties qu'il a vues finir). Aujourd'hui noyé dans le total. |
| **H7** triche, rediffusions abîmées | **Plausible, non mesurable** | `invalid_replay`, `not_finished` (tronquée), `replay_copy` : reproduits. Pas de motif régulier observable sans le détail par code. |
| **H8** (nouvelle) horloge de l'appareil | **Reproduite** | Date/niveau du lendemain : Jump `not_daily` (**compté**), Track `unknown_day` (non compté). |
| **H9** (nouvelle) démarrage à froid ou pic de minuit | **À confirmer** | min 0, pas de boost : l'instance neuve coûte 24 instructions au premier envoi, plus 0,3 s (Track) ou 1,1 s (Jump) de calcul du jour ; une seule instance mono-fil sert d'abord tout le monde. Reproduit ici : 245 ms (Track), 49 ms (Jump) de calcul, sans latence réseau. |
| **H10** (nouvelle) connexions inactives coupées | **Piste, aucune preuve** | `keepAliveTimeout` de Node à sa valeur par défaut (5 s) derrière le frontal de Google : 502 sporadiques possibles, partie non reçue, renvoi réussi. Non reproductible en local. |

**Limite de la reproduction** : en local rien ne bride le processeur. Sur Cloud Run, le processeur n’est garanti que pendant une requête (à confirmer pour une requête abandonnée par le client) : un envoi abandonné peut donc **ne pas** être écrit : c'est alors le renvoi qui fait apparaître le temps.

## 3. Ce que les données existantes disent

- **Gardé** : `journal_erreurs` (heure, code, route sans date ni identifiant, 14 jours, 60 écritures/min/instance) ; compteurs 24 h `serveur` et `rediffusions` ; par résultat : `submitted_at`, versions, `inputs_hash`. Journaux Cloud Run : une ligne « refus » (statut, code) pour chaque 429 et 5xx **mais pas pour les 4xx** (`api.ts:354`), une ligne « temps du jour » / « essai du jour » par envoi accepté, et le journal de requêtes de Cloud Run (statut, **latence**, URL).
- **Conclusion sans toucher à la production** : (1) le total est un mélange de huit codes qui n'ont pas la même gravité ; (2) 429, 503, `day_closed` n'y sont pas, alors qu'ils produisent « indisponible » ou un temps perdu ; (3) aucun moyen de relier un échec du jeu à ce que le serveur a fait.
- **Manque, sans donnée personnelle** : jeu ; code ; **version du jeu qui envoie** ; **famille de navigateur** (Chrome, Safari, Firefox, autre) ; **durée du rejeu et durée totale** de la requête ; **« renvoi depuis la file »** (en-tête fourni par le jeu) ; **« ce joueur a-t-il déjà été accepté pour ce jour dans les 10 minutes ? »** (booléen calculé par le serveur, rien d'autre gardé) ; **le détail par code dans le tableau de bord**.

## 4. Ce que Nathan peut regarder tout de suite (lecture seule)

Console Google Cloud, projet `dailytrack-511513` → **Cloud Run** → service **`cdj-api`** (région `europe-west1`).

1. **Journaux** (onglet « Journaux », champ de requête). Essayer, sur 7 jours :
   - envois de plus de 8 s **qui ont réussi** (H1 confirmée si le nombre est non nul) : `httpRequest.requestUrl=~"/submit$" AND httpRequest.status=200 AND httpRequest.latency>="8s"`
   - envois lents : mêmes critères avec `httpRequest.latency>="3s"` ;
   - 5xx : `httpRequest.status>=500` ; 429 : `httpRequest.status=429` ; requêtes annulées : `httpRequest.status=499` (existe peut-être) ;
   - raisons des 429 et 5xx (statut et code) : `jsonPayload.message="refus"` ;
   - refus 409 par heure : `httpRequest.requestUrl=~"/submit$" AND httpRequest.status=409`, puis regarder les pics après chaque étiquette `prod-…` (H4) ou après 22 h UTC (minuit à Paris, H5).
2. **Métriques** : « Latence des requêtes » (p50, p95, p99), « Nombre d'instances de conteneur », « Nombre de requêtes » par classe de code, **« Latence de démarrage des conteneurs »** (démarrages à froid), « Utilisation du processeur ». Chercher la p99 ≥ 5 s et les instances à 2 (plafond atteint).
3. **En ligne de commande** : `gcloud logging read '<filtre ci-dessus>' --project=dailytrack-511513 --freshness=7d --limit=50 --format='table(timestamp,httpRequest.status,httpRequest.latency,httpRequest.requestUrl)'` ; `gcloud run revisions list --service=cdj-api --region=europe-west1`.
4. **Administration** : `/admin/` → tableau de bord → « État du site » → « Rediffusions refusées (24 h) » : **le total seulement** (le détail par code n'y est pas, voir §5). Faute de mieux, lecture seule de la base : `turso db shell <base de production> "SELECT code, route, COUNT(*) FROM journal_erreurs GROUP BY 1, 2"` (quelques centaines de lignes au plus ; ne rien écrire).
5. **Dans Turso** : la région de la base (`turso db show`) — si elle est loin de `europe-west1`, chaque instruction coûte cher (14 par envoi).

Rapporter dans la conversation : (a) le nombre d'envois 200 de plus de 8 s ; (b) le décompte 429 et 5xx par code ; (c) la p99 de latence et le pic d'instances ; (d) la région Turso ; (e) le détail par code si la requête SQL est faite.

## 5. Conclusion et corrections proposées

**Causes les plus probables, classées**

| Rang | Cause | Explique | Preuve |
|---|---|---|---|
| 1 | **Échec passager de l'aller-retour** (429 d'une adresse partagée, 502/503/504, `busy`, coupure) **puis renvoi réussi**, affiché « indisponible » | constat 2 | message : déduit ; fréquence : à confirmer (§4) |
| 2 | **Onglets d'avant une mise en production** (`version`, `sim_version`, `track_mismatch`) | la plus grosse part du constat 1 | reproduit (mécanisme), à confirmer (dates) |
| 3 | **Jeu qui abandonne à 8 s alors que le serveur écrit** (H1) | constat 2 sans second envoi | mécanisme reproduit, fréquence à confirmer |
| 4 | Horloge de l'appareil (H8), copies et rediffusions abîmées (H7) | « quelques-uns » du constat 1 | reproduit |
| — | H2, H5 : **ne produisent pas** de refus au tableau de bord | — | reproduit |
| — | H6 : non confirmée ; H10 : piste | — | à instrumenter |

**Corrections, à faire après K2bc et K3, dans le module commun (une fois pour les trois jeux)**

| # | Correction | Taille |
|---|---|---|
| C1 | Tableau de bord : exposer et afficher `parCode` (déjà calculé, jeté par `admin.ts:432`) | S |
| C2 | Instrumentation de §3 : colonnes additives de `journal_erreurs` (jeu, version du jeu, famille de navigateur, durée du rejeu, durée totale, renvoi, déjà-accepté), alimentées par le module ; mêmes champs dans la ligne « temps du jour » ; compter aussi 429, `day_closed`, `busy` | M |
| C3 | Délai d'un envoi aligné sur le pire cas : ≈ 20 s pour `submit` seulement (`call` prend déjà `timeoutMs`), sous les 30 s de Cloud Run | S |
| C4 | Message honnête : distinguer `timeout` de `network` et dire « Envoi en cours, ton temps sera pris en compte » tant que la partie est en file ; fr + en pour les trois jeux | M |
| C5 | Renvoi d'une partie déjà acceptée : si le même joueur a déjà ce `inputs_hash` ce jour-là, répondre `200` « déjà enregistrée » avec le rang **avant** le rejeu (économise un rejeu, ne change aucun compte) | S |
| C6 | Si §4 montre des 429 sur des adresses partagées : relever ou affiner la limite par adresse (décision de Nathan, coûts) ; si des instances saturent ou démarrent à froid : `--cpu-boost` (coût à chiffrer dans `couts.md`) | S + décision |
| C7 | Si 502 sporadiques : régler `keepAliveTimeout` du serveur Node | S |

Ordre conseillé : C1, C2 (pour trancher), puis C3 à C5 ensemble ; C6 et C7 seulement sur preuve.
