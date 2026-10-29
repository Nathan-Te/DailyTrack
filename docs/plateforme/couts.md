# Surveiller les coûts de la plateforme

Lot P4. Guide pas à pas **à suivre une fois** (≈ 20 minutes), puis un coup d'œil par semaine. Il complète `docs/mise-en-ligne.md` (étape 1 : l'alerte à 1 €) et `docs/securite-facturation.md` (pire cas, coupures). Chiffres mesurés : `docs/plateforme/lots/lot-P4-consolidation.md` ; projection : `npm run measure:platform -w @cdj/api`.

**Rappel** : une alerte de budget **ne bloque rien** ; elle t'écrit. Le vrai frein reste le plafond de **2 instances** de Cloud Run (`docs/securite-facturation.md`, § 1). Les chiffres de facturation arrivent avec quelques heures de retard.

---

## 1. Un budget Google Cloud avec alertes à 50, 90 et 100 % de 5 € par mois (5 min)

1. [console.cloud.google.com](https://console.cloud.google.com) → projet `dailytrack-511513` → menu ☰ → **Facturation** → **Budgets et alertes**.
2. Si le budget `alerte-1-euro` de la mise en ligne existe : l'ouvrir → **Modifier**. Sinon **Créer un budget**.
3. **Nom** : `plateforme-5-euros`. **Périmètre** : *tous les projets* du compte de facturation (la recette est dans le même projet, elle compte aussi). **Services** : tous.
4. **Montant** : *Montant spécifié*, **5 €**, période **mensuelle**. Décocher « Inclure les crédits » (on veut voir la vraie dépense).
5. **Seuils** : **50 %** (2,50 €), **90 %** (4,50 €), **100 %** (5 €), en *Dépense réelle*. Ajouter un seuil **100 % en dépense prévue** (*Prévisionnelle*) : il prévient dès que la tendance du mois dépasse 5 €.
6. **Notifications** : *Envoyer des alertes par e-mail aux administrateurs et utilisateurs de la facturation* (ton adresse). **Terminer**.
   - **Tu dois voir** `plateforme-5-euros · 5,00 €` dans la liste. Le premier e-mail arrive quand 2,50 € sont dépensés.
7. Facultatif : supprimer l'ancien budget à 1 € (sinon tu reçois les deux séries d'e-mails, ce qui n'est pas grave).

**Pourquoi 5 €** : point de départ du lot. Tant que la plateforme reste dans l'offre gratuite, la dépense est **0 €** ; 5 € couvrent une sortie modérée (par exemple ≈ 200 000 vCPU-s de calcul au-delà du gratuit), pas une emballée. Si tu changes le montant, garde les trois seuils.

## 2. Turso : l'usage de la base (5 min, puis chaque lundi)

1. [app.turso.tech](https://app.turso.tech) → ton organisation → **Usage** (ou *Billing* → *Usage*, selon la version du tableau de bord) : lignes lues, lignes écrites, stockage, pour le mois en cours. Les deux bases (production `dailytrack-misterzcool` et recette) comptent dans la **même** offre gratuite : 500 M lignes lues, 10 M lignes écrites par mois.
2. **Alertes** : si le tableau de bord propose des notifications d'usage (un réglage d'alerte ou de plafond par e-mail dans *Settings* / *Billing*), les activer à **50 %** et **80 %**. *Non vérifié par l'agent* (pas d'accès au compte) : si rien de tel n'existe, regarder la page **Usage chaque lundi** — c'est une minute — et noter les deux nombres dans un fichier (la tendance compte plus que la valeur).
3. Sur l'offre gratuite, Turso **ne facture rien** : au-delà, il bloque ou demande de passer à une offre payante. Pas de surprise sur la carte bancaire, mais un risque d'**interruption** : c'est pour cela qu'on regarde.

## 3. La projection du mois, avec les vrais joueurs (5 min, chaque lundi)

Le nombre de **joueurs par jour** de chaque jeu, lu directement dans la base de production (lectures seules, une par jeu) :

```bash
turso db shell dailytrack-misterzcool "SELECT ROUND(COUNT(*) / 7.0) FROM results WHERE day >= (SELECT MAX(day) - 6 FROM results)"            # DailyTrack
turso db shell dailytrack-misterzcool "SELECT ROUND(COUNT(*) / 7.0) FROM jump_results WHERE day >= (SELECT MAX(day) - 6 FROM jump_results)"  # DailyJump
```

Chaque table a une ligne par joueur classé et par jour : le résultat est la **moyenne de joueurs classés par jour** sur les 7 derniers jours (un joueur qui ne finit jamais n'est pas compté : majorer de 20 %). Le Salon oublie tout (lot 27b) : son activité se lit dans **Cloud Run → `cdj-api` → Métriques → Nombre de requêtes** (le Salon fait ≈ 560 requêtes par joueur et par demi-heure ; s'il y a beaucoup plus de requêtes que les joueurs du jour n'en expliquent, c'est lui).

Puis, sur ton poste ou dans Cloud Shell (dans le dépôt, après `npm ci`) :

```bash
npm run measure:platform -w @cdj/api -- --jump 800 --track 300 --salon 40
```

`--jump` : joueurs DailyJump par jour · `--track` : joueurs du circuit du jour de DailyTrack · `--salon` : joueurs qui passent 30 minutes au Salon par jour · `--portail` (lot I2) : visiteurs du portail par jour (deux chargements de l'accueil chacun). Le script affiche, pour un mois de 30 jours, chaque ressource (requêtes Cloud Run — **sans pré-vols** depuis le lot R5 : il n'y en a plus —, calcul, mémoire, lignes Turso), sa part de l'offre gratuite, ce qui dépasse (Cloud Run en dollars, au tarif public), le jeu qui pèse le plus, et la **marge** : par combien multiplier les joueurs avant le premier plafond.

**Lire le résultat** : le calcul de Cloud Run est compté **au plus** (chaque requête facturée seule, arrondie à 100 ms) ; avec beaucoup de joueurs simultanés, les requêtes se partagent le temps facturé et la vraie dépense est plus basse. Les requêtes et les lignes Turso, elles, sont exactes à l'hypothèse du joueur type près.

## 4. Quand l'offre gratuite approche : les décisions écrites à l'avance

Ce sont des **propositions de l'agent, à valider par Nathan** (cocher ou corriger). Le déclencheur est la **part la plus haute** que donne `measure:platform` avec les vrais joueurs (ou un e-mail du budget). Chaque étape est un petit lot, préparé à l'avance ; **aucune n'est automatique**. On les prend dans l'ordre : chacune coûte moins au jeu que la suivante.

| Seuil | Ce qu'on fait | Gain estimé | Ce que le joueur perd |
|---|---|---|---|
| ≥ 50 % | Rien. `measure:platform` chaque lundi, Turso chaque lundi. | — | rien |
| ≥ 70 % | **1. Le Salon, moins souvent** : classement lu toutes les **10 s** au lieu de 5 (finale : 2 s inchangé), `now` toutes les 20 s, fantômes seulement quand le classement change. Lot de DailyTrack (`salonMode.ts`, contrat inchangé). | ≈ − 45 % des requêtes du Salon (≈ 300 au lieu de 558 par demi-heure) | un classement du Salon un peu moins vif |
| ≥ 80 % | **2. Moins de relectures** : DailyJump relit le jour à l'arrivée au plus toutes les **10 min** (au lieu de 3), le profil au retour sur l'accueil toutes les 5 min (au lieu de 30 s) ; DailyTrack de même pour son profil. Constantes `ARRIVAL_REFRESH_MS`, `READ_FRESH_MS` (`apps/jump/src/dayReads.ts`), `SYNC_GAP_MS` (`@cdj/profile`, les deux jeux). | ≈ − 2 requêtes par joueur DailyJump et par jour | le top 10 et les taches des autres un peu moins frais |
| ≥ 90 % | **3. La carte des morts moins souvent** : recalcul au plus toutes les **10 min** (`JUMP_MAP_REFRESH_MS`) ; si ce sont les lignes **lues** de Turso qui montent. | ≈ − 70 % des lignes lues par la carte | les taches des autres arrivent plus tard |
| ≥ 100 % prévu | **4. Accepter une petite dépense** : relever le budget (10 €), le plafond de 2 instances borne de toute façon la facture (`docs/securite-facturation.md`). Si ce sont les **lignes Turso** : passer Turso à l'offre payante (le jeu s'arrêterait sinon). | — | rien |
| emballement | **5. Couper** : `--max-instances=1`, puis au besoin la coupure manuelle du niveau 2 (`docs/securite-facturation.md`) ; les jeux restent jouables sans serveur (classement indisponible, rien de perdu, les envois attendent). | arrêt de la dépense | le classement, le Salon et les profils, le temps de la coupure |

Déjà fait par le lot P4 (ne compte plus comme réserve) : la lecture regroupée de DailyJump (30 → 12 requêtes par joueur et par jour), l'envoi qui rend le classement, les en-têtes de cache.

**Fait au lot R4** : l'API est servie sur **la même origine** que les jeux (playdujour.com, renvoi `/api/**` de Firebase Hosting vers Cloud Run) : **plus aucun pré-vol CORS** (≈ 7 requêtes par joueur DailyJump et par jour, ≈ 37 % de ses requêtes ; § 5).

## 5. Firebase Hosting (lot R4 : playdujour.com)

Le site (portail, DailyTrack, DailyJump) est servi par **Firebase Hosting** : deux sites (production, recette) et les canaux d'aperçu des PR, dans le projet `dailytrack-511513` (offre Blaze : celle du compte de facturation de Cloud Run). Tarifs publics vérifiés le 20/10/2026 (<https://firebase.google.com/pricing>) :

| ressource | gratuit | au-delà |
|---|---|---|
| stockage des versions | 10 Go | 0,026 $ par Go et par mois |
| transfert (fichiers **et** réponses de `/api/` passées par Hosting) | **360 Mo par jour** (≈ 10,8 Go par mois) | **0,15 $ par Go** |
| domaines, certificats, plusieurs sites, canaux d'aperçu | inclus | — |

**Poids d'un premier chargement** (mesuré au lot R4 sur le site assemblé, `node scripts/site.mjs site` ; fichiers demandés par la page jusqu'au jeu prêt, compressés gzip / brotli comme Hosting les sert) :

| page | fichiers | brut | gzip | brotli |
|---|---|---|---|---|
| portail `/` | 2 | 5,8 ko | 2,8 ko | 2,4 ko |
| DailyTrack `/track/` | 6 | 890 ko | **259 ko** | 220 ko |
| DailyJump `/jump/` | 9 | 1 407 ko | **355 ko** | 298 ko |

Three.js pèse à lui seul ≈ 140 ko compressés par jeu. Les fichiers à empreinte (`assets/`) sont gardés **un an** par le navigateur (`immutable`) : une visite suivante ne retélécharge que le HTML (≈ 6 à 8 ko compressés) et ce qu'une nouvelle version a changé ; le chunk `three` ne change presque jamais.

**Ce que cela donne** : ≈ **1 000 premiers chargements de DailyJump par jour** (360 Mo ÷ 0,355 Mo), ou ≈ 1 400 de DailyTrack, tiennent dans le gratuit. Au-delà : 1 000 nouveaux joueurs de plus par jour ≈ 10,7 Go par mois ≈ **1,6 $ par mois**. Les réponses de `/api/` passent aussi par Hosting (quelques dizaines de ko par joueur et par jour, à mesurer en production : console Firebase → Hosting → **Utilisation**).

**Ce que Firebase fait gagner** : plus de pré-vols CORS (≈ 7 requêtes de moins par joueur DailyJump et par jour ; retirés de `measure:platform` au lot R5) ; et le CDN de Hosting **garde en cache** les lectures `public` du serveur (lot P4 : niveau, carte des morts, échantillon ; jour fermé 24 h, jour ouvert 30 s) : autant de requêtes Cloud Run en moins. Les réponses personnelles (`private`, `Vary: X-Player-Id`) ne sont jamais gardées par le CDN.

**Surveiller** : console Firebase → **Hosting** → **Utilisation** (transfert par jour) chaque lundi, avec Turso (§ 2). Si le transfert dépasse 360 Mo par jour de façon durable : rien à faire tant que le budget de 5 € (§ 1) n'alerte pas (il couvre ≈ 33 Go de transfert par mois) ; ensuite, la piste la moins chère est d'alléger le premier chargement (lot de jeu : Three.js plus petit, chargement différé).

## 6. Le portail (lot I2, mis à jour au lot I3)

**Une requête par chargement de l'accueil** : `GET /api/portail/jour` (jeux du jour, état du joueur dans chaque jeu, série, journées parfaites ; lot I3 : numéro de journée, points et place du jour). Mesuré par `npm run measure:portail -w @cdj/api` (sqld local, 20/10/2026 ; 50 autres classés par jour et par jeu) :

| lecture | instructions | lignes lues | écrites | durée |
|---|---|---|---|---|
| jour, sans joueur (niveaux en mémoire de l'instance) | 1 | 1 | 0 | ≈ 4 ms |
| jour, sans joueur, instance neuve (niveaux lus en base) | 3 | 3 | 0 | ≈ 9 ms |
| jour, sans joueur, premier appel du jour (circuit et niveau calculés une fois) | 5 | 5 | 2 | ≈ 0,6 s |
| **jour, joueur de 30 jours** (lot I3 : place lue dans le classement gardé) | 11 | **172** (lot I2 : 275) | 0 | ≈ 25 ms |
| **jour, joueur de 365 jours** | 8 | **737** (lot I2 : 841) | 0 | ≈ 20 ms |
| profil commun, 30 jours (ensuite) | 11 | 393 | 0 | ≈ 34 ms |
| profil commun, 365 jours (ensuite) | 11 | 2 404 | 0 | ≈ 38 ms |
| profil commun, 365 jours, **premier appel** (places finales des jours fermés calculées une fois et gardées) | 13 | 81 146 | 728 | ≈ 48 ms |

**Borné** : sans joueur, une ligne ; avec un joueur, une ligne par jour fini (série et journées parfaites : un parcours d'index par jeu). Le premier appel du profil commun calcule une fois les places finales de chaque jour fermé (comme `GET /api/me` de DailyTrack depuis le lot 30) ; ensuite elles sont lues. **Aucune écriture** pour l'accueil. La réponse sans joueur est **publique** (60 s au plus, jamais au-delà de minuit de Paris : le CDN de Hosting la garde, autant de requêtes Cloud Run en moins) ; avec un joueur, `private, no-cache`.

### Le classement du jour (lot I3)

Le classement du jour tous jeux confondus est calculé **au plus une fois par fenêtre de 45 s et par instance** (une lecture de `results` et de `jump_results`), jamais à chaque requête ; la page `/classement/`, la tuile du portail et les arrivées des jeux le lisent en mémoire. **La place d'un joueur déjà classé vient de ce classement gardé** (avant : une ligne lue par classé devant lui, à chaque visite : 38 009 lignes à 10 000 joueurs). Mesuré (`measure:portail`, sqld local, 20/10/2026, joueur du milieu) :

| joueurs du jour | calcul du classement (une fois par fenêtre et par instance) | lecture suivante (page publique, en mémoire) | page avec ta ligne | accueil d'un joueur classé (instance qui a le classement) | accueil, instance neuve (calcul compris) | mémoire de l'instance |
|---|---|---|---|---|---|---|
| 100 | 4 instr., **341** lignes lues, ≈ 15 ms | 0 | 2 instr., 1 ligne | 8 instr., **9** lignes | 13 instr., 202 lignes, ≈ 29 ms | ≈ 1 Mo |
| 1 000 | 4 instr., **2 051** lignes lues, ≈ 25 ms | 0 | 2 instr., 1 ligne | 8 instr., **9** lignes | 13 instr., 1 912 lignes, ≈ 51 ms | ≈ 4 Mo |
| 10 000 | 4 instr., **19 151** lignes lues, ≈ 190 ms | 0 | 2 instr., 1 ligne | 8 instr., **9** lignes | 13 instr., 19 012 lignes, ≈ 193 ms | ≈ 2 à 10 Mo |

**Lot A1 (classement au chrono)** : les trois vues (Cumulé, Track, Jump) se calculent **ensemble**, avec **les mêmes deux lectures** qu'au lot I3 (le temps était déjà lu) : les chiffres ci-dessus ne changent pas (`measure:portail`, non rejoué à la main : voir le README du lot). Seul ajout : les pseudos du haut de **chaque vue** sont lus à la première lecture de cette vue dans la fenêtre (une requête sur `players`, ≤ 50 lignes ; ≤ 3 par fenêtre et par instance). `PORTAIL_VISITOR` et `CLASSEMENT_JOUR` (`platformBudget.ts`) restent donc tels quels.

Soit **≈ 1,9 ligne lue par joueur du jour et par calcul**, 0 écrite. Une lecture (page, tuile, arrivée) sur une instance qui a le classement coûte **0 à 9 lignes quel que soit le nombre de joueurs** ; un joueur qui vient de finir (absent du classement gardé) est inséré à sa place sans relecture globale, et ses jeux comptent ses classés devant lui (une fois : le rang de chaque jeu, comme à l'envoi). **Pire cas d'un jour** (`classementReadsPerDay`, `scripts/platformBudget.ts`) : 2 instances qui le recalculent chaque fenêtre pendant 12 heures actives = 100 000 lignes à 100 joueurs (soit ≈ 0,1 M par mois), 1,1 M à 1 000 (≈ 3,3 M par mois), **36,5 M à 10 000 (≈ 1,1 Md par mois : au-delà de l'offre gratuite de Turso, 500 M — à 10 000 joueurs par jour on est de toute façon sur l'offre payante)**. Le réglage à tourner si besoin : `CLASSEMENT_FENETRE_MS` (45 s → 60 s ou plus : −25 %). Ce que le calcul ne fait pas : écrire, lire les rediffusions, rejouer quoi que ce soit.

### Vérification de `Vary: X-Player-Id` par Firebase Hosting (lot I3)

Le portail rend la **même adresse** en deux versions (publique et personnelle) : tout repose sur `Vary: X-Player-Id` dans le cache de Hosting. **Mesuré sur la recette, par l'adresse de Hosting (`https://recette.playdujour.com`, pas Cloud Run en direct), le 20/10/2026** : deux lectures de `/api/portail/jour` sans identifiant (`public, max-age=60`, `x-cache: HIT`), puis une lecture avec l'identifiant du joueur de démonstration → **l'état du joueur** (`private, no-cache`, `x-cache: MISS`, `joueur`, `etat` de chaque jeu), puis une lecture sans identifiant → la réponse publique sans `joueur` (`HIT`). Hosting **honore** `Vary` (sa réponse liste `Vary: Origin, X-Player-Id, cookie, …`). **Rien à changer côté serveur** : une seule adresse, deux réponses ; pas de seconde adresse. La vérification est refaite **après chaque fusion** par le job `hosting` de `recette.yml` (`smoke --lecture-seule --par-hosting --joueur-demo`, pour `/api/portail/jour` **et** `/api/portail/classement`, des `GET` seulement, rien n'est écrit) ; sans joueur connu (production), la même commande utilise un identifiant inventé (404 `unknown_player`, jamais la réponse publique gardée).

**Projection** : `PORTAIL_VISITOR` dans `scripts/platformBudget.ts` (3 requêtes, 350 lignes lues, 0 écrite par visiteur et par jour : 2 chargements de l'accueil et la page du classement) : 1 000 visiteurs par jour ≈ 0,09 M requêtes et 10,5 M lignes lues par mois (`measure:platform -- --portail 1000`) ; à ajouter, le classement du jour (ci-dessus) ; et « Jeu suivant du jour » ajoute **une requête** à l'arrivée de chaque jeu (`JUMP_PLAYER` 13 requêtes, `TRACK_PLAYER` 14) ; **lot G1** : le fantôme Diamant n'ajoute aucune requête dans le cas courant (Jump le calcule dans la page quand le niveau du jour y est généré ; `GET /api/jump/fantome-diamant` ne sert qu'un niveau figé publié sans preuve : une archive, ou le jour même après une mise en production ce jour-là), Track jamais.

## 7. La génération de données (lot R8)
- Chaque instance du serveur lit `meta.generation` **au plus toutes les 30 s** (`GENERATION_TTL_MS`) : **une ligne lue**, aucune écriture, par instance et par fenêtre de 30 s d'activité (au pire 120 lignes par heure et par instance, 2 instances au plus) ; rien ne s'ajoute au nombre de requêtes de Cloud Run ni au joueur type de `platformBudget.ts`. La remise à zéro elle-même (une fois, le jour du partage) lit chaque table pour la compter (une ligne lue par table) et efface ce qu'elle contient : le coût d'un `DELETE` est proportionnel au nombre de lignes de la table (les joueurs de quelques jours : négligeable devant l'offre gratuite).

## 8. Le panneau d'administration (lot N1)

Un seul utilisateur (l'éditeur), quelques consultations par jour : le panneau ne pèse rien sur l'offre gratuite **s'il ne lit jamais une table entière** (testé : `admin.test.ts`, plans `EXPLAIN QUERY PLAN`). Mesure : `npm run measure:admin -w @cdj/api` (base libSQL fichier, 14 jours d'historique).

**Réserve honnête : ce sont des *estimations* de lignes lues d'après les plans de requête, pas le « rows read » de Turso** (pas de `sqld` dans la session qui a fait le lot : à refaire sur la recette, `npm run measure:admin` contre `sqld`, avant de s'y fier). Les instructions, lignes rendues, durées et tailles sont mesurées.

### 100 joueurs par jour et par jeu (14 jours d'historique)

| appel | instructions | lignes rendues | lignes lues (estimées d'après les plans) | durée | réponse |
|---|---|---|---|---|---|
| tableau de bord, premier appel (calcul) | 10 | 21 | 3 105 | 8.3 ms | 1.0 ko |
| tableau de bord, dans la minute (mémoire) | 2 | 1 | 0 | 1.3 ms | 1.0 ko |
| tableau de bord, recalculé une minute plus tard (jours fermés gardés en mémoire) | 11 | 9 | 705 | 2.4 ms | 1.0 ko |
| joueurs : premier passage après la mise à jour (références calculées, une fois) | 204 | 252 | 0 | 30.8 ms | 4.7 ko |
| joueurs : la première page (sans critère) | 3 | 52 | 0 | 2.1 ms | 4.7 ko |
| joueurs : début de pseudo | 3 | 12 | 11 | 1.4 ms | 1.1 ko |
| joueurs : début de référence | 3 | 2 | 1 | 1.3 ms | 0.1 ko |
| fiche d'un joueur (14 jours dans chaque jeu) | 37 | 47 | 1 415 | 5.6 ms | 2.3 ko |
| action : masquer | 12 | 3 | 1 | 8.7 ms | 0.0 ko |
| journal (200 dernières actions) | 2 | 2 | 0 | 1.2 ms | 0.2 ko |

### 1 000 joueurs par jour et par jeu (14 jours d'historique)

| appel | instructions | lignes rendues | lignes lues (estimées d'après les plans) | durée | réponse |
|---|---|---|---|---|---|
| tableau de bord, premier appel (calcul) | 10 | 22 | 31 050 | 23.5 ms | 1.2 ko |
| tableau de bord, dans la minute (mémoire) | 2 | 2 | 0 | 1.4 ms | 1.2 ko |
| tableau de bord, recalculé une minute plus tard (jours fermés gardés en mémoire) | 11 | 10 | 7 050 | 5.1 ms | 1.2 ko |
| joueurs : premier passage après la mise à jour (références calculées, une fois) | 2013 | 2052 | 0 | 307.9 ms | 4.8 ko |
| joueurs : la première page (sans critère) | 3 | 52 | 0 | 1.6 ms | 4.8 ko |
| joueurs : début de pseudo | 3 | 52 | 111 | 4.8 ms | 4.8 ko |
| joueurs : début de référence | 3 | 2 | 1 | 1 ms | 0.1 ko |
| fiche d'un joueur (14 jours dans chaque jeu) | 37 | 47 | 14 015 | 6.9 ms | 2.3 ko |
| action : masquer | 12 | 3 | 1 | 18.7 ms | 0.0 ko |
| journal (200 dernières actions) | 2 | 3 | 0 | 1.1 ms | 0.3 ko |

### 10 000 joueurs par jour et par jeu (14 jours d'historique)

| appel | instructions | lignes rendues | lignes lues (estimées d'après les plans) | durée | réponse |
|---|---|---|---|---|---|
| tableau de bord, premier appel (calcul) | 10 | 23 | 310 500 | 209 ms | 1.4 ko |
| tableau de bord, dans la minute (mémoire) | 2 | 3 | 0 | 1.6 ms | 1.4 ko |
| tableau de bord, recalculé une minute plus tard (jours fermés gardés en mémoire) | 11 | 11 | 70 500 | 32.4 ms | 1.4 ko |
| joueurs : premier passage après la mise à jour (références calculées, une fois) | 20103 | 20052 | 0 | 3193 ms | 4.8 ko |
| joueurs : la première page (sans critère) | 3 | 52 | 0 | 5.8 ms | 4.8 ko |
| joueurs : début de pseudo | 3 | 52 | 1 111 | 1.4 ms | 4.8 ko |
| joueurs : début de référence | 3 | 2 | 1 | 1 ms | 0.1 ko |
| fiche d'un joueur (14 jours dans chaque jeu) | 37 | 47 | 140 015 | 28.1 ms | 2.3 ko |
| action : masquer | 12 | 3 | 1 | 111.9 ms | 0.0 ko |
| journal (200 dernières actions) | 2 | 4 | 0 | 1.1 ms | 0.5 ko |

Lecture :
- **Tableau de bord** : calculé au plus une fois par minute et par instance ; le premier calcul lit ≈ 3 lignes par joueur du jour et par jour d'historique, le suivant (jours fermés gardés en mémoire) seulement aujourd'hui et hier. Hors des consultations, **0 ligne**.
- **Écarter les masqués ne coûte rien** : les index `results_by_visible` / `jump_results_by_visible` portent `hidden` (les classements des jeux ne lisent pas plus de lignes qu'avant).
- **Fiche d'un joueur : le poste cher** (≈ 14 lignes par jour joué et par millier de classés, à cause du rang de chaque résultat) — acceptable pour une consultation de l'éditeur (140 000 lignes à 10 000 joueurs par jour et par jeu ; à comparer au plafond de lignes lues de l'offre Turso, § 2), à surveiller si la fiche était un jour ouverte en boucle ; le rang gardé d'un jour fermé (`final_rank`) est déjà réutilisé.
- **Premier passage après la mise à jour** : le calcul des références publiques des joueurs d'avant (`players.ref`) se fait **une fois** (≈ 2 instructions par joueur) ; ensuite 0.
- Aucune écriture hors des actions de l'éditeur, de la session (1 ligne par connexion) et du journal des erreurs (borné à 60 écritures par minute et par instance).

## Checklist (une fois)
- ☐ Budget `plateforme-5-euros` : 50 / 90 / 100 % réels + 100 % prévu, e-mail.
- ☐ Turso : alerte d'usage activée, ou rappel « Usage chaque lundi » dans ton agenda.
- ☐ `npm run measure:platform -w @cdj/api -- --jump … --track … --salon …` lancé une fois avec les vrais chiffres.
- ☐ Le tableau du § 4 relu : chaque ligne acceptée ou corrigée (réponds dans la PR du lot P4 ou dans le prochain prompt).
- ☐ Lot R4 : console Firebase → Hosting → Utilisation regardée une fois après la bascule ; conservation des versions limitée à 50 par site (`domaine.md`, « Le coût »).

## 9. Le message en direct (lot N2)

**Livraison sans serveur en direct** : le message actif est dans `GET /api/portail/jour` (au chargement du portail : aucune requête de plus) et `GET /api/annonce` le rend **seul**, avec `Cache-Control: public, max-age=0, s-maxage=30` : le cache de Firebase Hosting, partagé par toutes les pages ouvertes, le garde 30 s. **Une page ouverte et visible le relit toutes les 60 s** ; cachée, ou dans une course ou un niveau, elle ne lit rien. Un message arrive donc chez un joueur **au bout de 45 s en moyenne, 90 s au pire** (60 s de relecture + 30 s de cache) ; il s'éteint à son heure de fin même si le cache l'a encore (le client compare `fin` à l'heure du serveur).

Mesure : `npm run measure:annonce -w @cdj/api` (28/10/2026, base en mémoire ; le cache est un **modèle** de celui de Hosting — pas une mesure de Hosting —, par point de présence du CDN : on ne sait pas combien servent la France, on montre 1, 3 et 10).

**Une requête qui arrive à Cloud Run** : 1 instruction, **1 ligne lue** (l'index `annonces_by_fin`), 0 écrite, ≈ 0,8 ms, réponse ≈ 711 octets (corps et en-têtes).

| pages ouvertes et visibles, 1 heure | requêtes Hosting | octets Hosting | Cloud Run **sans** cache | Cloud Run, 1 point | 3 points | 10 points (simulé / borne) | lignes Turso (3 points) |
|---|---|---|---|---|---|---|---|
| 100 | 6 000 | 3,7 Mo | 6 000 | 118 | 340 | 991 / 1 200 | 340 |
| 1 000 | 60 000 | 37,2 Mo | 60 000 | 120 | 360 | 1 181 / 1 200 | 360 |
| 10 000 | 600 000 | 372 Mo | 600 000 | 120 | 360 | 1 200 / 1 200 | 360 |

- **Cloud Run et Turso ne le sentent pas** : jamais plus de 120 requêtes par heure et par point de présence, quel que soit le nombre de pages (≤ 1 200 par heure à 10 points : de l'ordre de 0,06 % de l'offre gratuite mensuelle de requêtes par heure de message), une ligne lue chacune. `platformBudget.ts` : `ANNONCE`, `annonceParHeure` (testé : `platformBudget.test.ts`).
- **Le poids est celui de Hosting** : une requête par page et par minute, cache ou pas. **À 10 000 pages ouvertes pendant une heure : 372 Mo, soit plus que le transfert gratuit de Hosting (360 Mo par jour)** ; à 1 000 pages : 37 Mo par heure (10 % du jour). Au-delà de l'offre, le transfert de Hosting se paie au gigaoctet (tarif à lire dans la console, Facturation → Tarifs) : une heure à 10 000 pages ≈ 0,4 Go. **Décision laissée à Nathan** si le site atteint ce public : allonger la relecture (90 ou 120 s) ou retirer les en-têtes de sécurité de cette seule réponse (≈ 400 octets de ses 711). Aucun seuil n'est franchi aujourd'hui.
- **Limites de débit** : 120 lectures par adresse et par fenêtre de 10 minutes (`ANNONCE_LECTURES_PAR_ADRESSE`, en mémoire : aucune écriture) ; une page qui relit chaque minute en fait 10.
- **Portail** : la réponse publique de `GET /api/portail/jour` ajoute deux lectures indexées de 1 ligne (le message actif, la dernière nouveauté publiée) à chaque calcul (au plus un par minute et par point de présence : cache public de 60 s). **`GET /api/portail/nouveautes`** : cache public de 60 s, 21 lignes lues au plus (index `nouveautes_by_date`), jamais une table entière (test « coût » de `diffusion.test.ts`).
