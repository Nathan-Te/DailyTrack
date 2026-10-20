# playdujour.com : le domaine, l'hébergement et la mise en production

Test Guide pas à pas pour Nathan (lot R4), **à faire une fois**. Compte **≈ 1 h 30 de travail**, plus l'attente du DNS et des certificats (de quelques minutes à 24 h). À la fin :

| adresse | ce qu'elle sert | serveur (`/api/`) |
|---|---|---|
| `https://playdujour.com/` | le portail « Du Jour » (une carte par jeu) | — |
| `https://playdujour.com/track/` · `/jump/` | DailyTrack · DailyJump (production) | `cdj-api` (production), même adresse |
| `https://recette.playdujour.com/` (`/track/`, `/jump/`) | `main` en entier, à chaque fusion | `cdj-api-recette` (recette par défaut), même adresse |
| `https://<site de recette>--pr-<n>-<empreinte>.web.app/` | l'aperçu de la PR n° n (lien commenté sur la PR, 7 jours) | recette par défaut ; **sa révision** si la PR touche le serveur |
| `https://nathan-te.github.io/DailyTrack/…` | après la bascule : des redirections vers playdujour.com, profil compris | — |

Le flux : **PR → aperçu → fusion → recette → bouton « Mettre en production » → production**. Plus aucun déploiement automatique de la production. Le serveur est servi **sous la même adresse** que les jeux (Firebase Hosting renvoie `/api/**` vers Cloud Run, `europe-west1`) : plus aucune requête CORS de vérification préalable.

**Coût** : visé **0 €** au départ (§ « Le coût » en bas, et `docs/plateforme/couts.md` § 5).

**Avant de commencer** : la production (lot 28, `docs/mise-en-ligne.md`) et la recette (lot R1, `docs/plateforme/recette.md`) sont en place : projet `dailytrack-511513`, région `europe-west1`, comptes `cdj-deploy` (déploiement, fédération d'identité `github`) et services `cdj-api`, `cdj-api-recette`. Tout se fait dans **Cloud Shell** (console Google → icône `>_`), dans la **console Firebase**, chez **OVH** et dans les réglages du dépôt. Chaque étape dit quoi faire, puis **« Tu dois voir »**.

**Ordre** : étapes 1 à 6 quand tu veux (rien ne change pour les joueurs : GitHub Pages sert toujours les jeux) ; l'étape 7 (la mesure de `TRUST_PROXY`) **avant** l'étape 8 ; **la bascule a lieu à l'étape 8**, à la première « Mettre en production ».

---

## Étape 1 — Firebase sur le projet existant (5 min)

Dans Cloud Shell :

```bash
PROJECT_ID=dailytrack-511513
gcloud config set project $PROJECT_ID
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com
npx --yes firebase-tools@15.34.0 projects:addfirebase $PROJECT_ID
```

- `firebase-tools` te demande de te connecter la première fois : `npx --yes firebase-tools@15.34.0 login --no-localhost`, ouvre le lien, colle le code.
- **Tu dois voir** `Firebase has been added to your project` (ou « already a Firebase project »). Dans <https://console.firebase.google.com>, le projet `dailytrack-511513` apparaît, sur l'offre **Blaze** (le projet a déjà un compte de facturation : celui de Cloud Run). Ne coche pas Google Analytics.

## Étape 2 — Les deux sites (5 min)

Un projet Firebase peut héberger plusieurs sites. Les identifiants sont **uniques sur tout Firebase** : si `playdujour` est pris, prends `playdujour-prod` (et note ce que tu as choisi).

```bash
npx --yes firebase-tools@15.34.0 hosting:sites:create playdujour --project $PROJECT_ID
npx --yes firebase-tools@15.34.0 hosting:sites:create playdujour-recette --project $PROJECT_ID
npx --yes firebase-tools@15.34.0 hosting:sites:list --project $PROJECT_ID
```

- **Tu dois voir** les deux sites dans la liste, avec leurs adresses par défaut `https://playdujour.web.app` et `https://playdujour-recette.web.app` (plus le site par défaut du projet, qu'on n'utilise pas).

## Étape 3 — Les droits de déploiement de Hosting pour `cdj-deploy` (3 min)

Les workflows publient avec le même compte que le serveur (`cdj-deploy`, par la fédération d'identité : aucune clé). Il lui faut le droit de publier sur Hosting :

```bash
DEPLOY_SA=cdj-deploy@$PROJECT_ID.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$DEPLOY_SA --role=roles/firebasehosting.admin --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$DEPLOY_SA --role=roles/serviceusage.serviceUsageConsumer --condition=None
gcloud projects get-iam-policy $PROJECT_ID --flatten=bindings --filter="bindings.members:$DEPLOY_SA" --format='value(bindings.role)'
```

- **Tu dois voir** au moins `roles/artifactregistry.writer`, `roles/firebasehosting.admin`, `roles/run.admin`, `roles/serviceusage.serviceUsageConsumer`.
- Le renvoi `/api/**` vers Cloud Run n'a besoin d'aucun autre droit : les deux services sont publics (`--allow-unauthenticated`, comme aujourd'hui).
- **Les images de production pour le retour arrière** : le dépôt d'images `cdj` garde les **5 dernières** images (`docs/mise-en-ligne.md`, étape 4). Comme une image n'est plus construite qu'à chaque « Mettre en production », le retour à la mise en production précédente reste toujours possible.

## Étape 4 — Connecter les domaines, et les enregistrements DNS chez OVH (20 min, puis attente)

### 4.1 Dans la console Firebase
<https://console.firebase.google.com> → projet `dailytrack-511513` → **Hosting** :
1. site **`playdujour`** → **Ajouter un domaine personnalisé** → `playdujour.com` → **Continuer**. Firebase affiche les enregistrements à créer (garde l'onglet ouvert).
2. même site → **Ajouter un domaine personnalisé** → `www.playdujour.com` → coche **« Rediriger vers un domaine existant »** → `playdujour.com`. *(Important : sans redirection, `www` serait une autre origine, avec un autre profil.)*
3. site **`playdujour-recette`** → **Ajouter un domaine personnalisé** → `recette.playdujour.com`.

Pour chaque domaine, Firebase donne **un enregistrement TXT** (preuve de propriété, de la forme `hosting-site=playdujour`) et **un ou deux enregistrements A** (des adresses IP de Firebase), parfois un **CNAME** ou un TXT `_acme-challenge` pour le certificat. **Copie exactement ce que Firebase affiche** : les valeurs peuvent changer d'un projet à l'autre.

### 4.2 Chez OVH
<https://www.ovh.com/manager> → **Web Cloud** → **Noms de domaine** → `playdujour.com` → onglet **Zone DNS**.
1. **Supprime d'abord** les entrées par défaut d'OVH qui entreraient en conflit : les **A** et **AAAA** de `playdujour.com` (sous-domaine vide) et de `www` (souvent un A vers une page de parking d'OVH), et un éventuel **CNAME** `www`. Ne touche ni aux **NS**, ni aux **MX** / **SPF** (le courrier, si tu en as).
2. **Ajouter une entrée** pour chaque ligne donnée par Firebase :

| sous-domaine (OVH) | type | valeur | pour |
|---|---|---|---|
| *(vide)* | TXT | `hosting-site=playdujour` (copié de Firebase) | preuve, `playdujour.com` |
| *(vide)* | A | l'IP donnée par Firebase (une ligne par IP) | `playdujour.com` |
| `www` | TXT / A (ou CNAME) | ce que Firebase affiche pour `www` | redirection `www` |
| `recette` | TXT | `hosting-site=playdujour-recette` (copié de Firebase) | preuve, recette |
| `recette` | A (ou CNAME) | ce que Firebase affiche pour `recette` | `recette.playdujour.com` |
| `_acme-challenge…` | TXT | seulement si Firebase le demande | certificat |

   Laisse le TTL par défaut. Si la zone contient un enregistrement **CAA**, il doit permettre `letsencrypt.org` et `pki.goog` (sans CAA, rien à faire).
3. Reviens dans la console Firebase → **Vérifier** sur chaque domaine.

- **Tu dois voir** les domaines passer à « **Configuration en cours** » (DNS vu), puis « **Connecté** » quand le certificat HTTPS est prêt. **Délai** : le DNS d'OVH se propage en quelques minutes à quelques heures ; le certificat suit, **jusqu'à 24 h** (souvent moins d'une heure). Pendant ce temps, `https://playdujour.com` peut afficher une erreur de certificat : c'est normal, attends.
- Vérification depuis Cloud Shell : `dig +short playdujour.com A`, `dig +short recette.playdujour.com`, `dig +short TXT playdujour.com` doivent rendre les valeurs de Firebase.

## Étape 5 — Les variables et réglages du dépôt (10 min)

GitHub → dépôt → **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable** :

| Nom | Valeur | Obligatoire |
|---|---|---|
| `FIREBASE_SITE_PRODUCTION` | `playdujour` (l'identifiant de l'étape 2) | oui |
| `FIREBASE_SITE_RECETTE` | `playdujour-recette` | oui |
| `RECETTE_TRUST_PROXY` | *(étape 7 : la valeur mesurée)* | avant la bascule |
| `TRUST_PROXY` | *(étape 7 : la même valeur, pour la production)* | avant la bascule |

Les secrets ne changent pas (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`). `VITE_API_URL` et `RECETTE_API_URL` ne servent plus aux jeux publiés (ils appellent `/api/` sur leur propre adresse) ; garde `VITE_API_URL` (le garde-fou « un aperçu ne vise jamais la production » la lit) ; `RECETTE_API_URL` n'est plus lue, tu peux la laisser.

**Le jeton de robot (recommandé)** — pour que les jours figés entrent dans `main` tout seuls (étape 8) : GitHub → ton profil → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate new token** : nom `dailytrack-robot`, expiration 1 an, **Only select repositories** → `DailyTrack`, permissions **Contents : Read and write**, **Pull requests : Read and write**. Copie-le → dépôt → **Settings** → **Secrets and variables** → **Actions** → **Secrets** → **New repository secret** `ROBOT_TOKEN`.
- Sans lui, tout marche quand même : la PR des jours figés est ouverte, sa CI lancée, et **tu la fusionnes** d'un clic (une fusion faite par le jeton du workflow ne lancerait pas la CI de `main`, et la mise en production suivante la refuserait).

**Deux réglages** : **Settings** → **General** → **Pull Requests** → coche **Allow auto-merge** ; **Settings** → **Actions** → **General** → **Workflow permissions** → coche **Allow GitHub Actions to create and approve pull requests** → **Save**.

L'environnement **`production`** (toi comme relecteur, branche `main`) reste tel quel (`docs/plateforme/recette.md`, étape 4).

- **Tu dois voir** les deux variables `FIREBASE_SITE_*` à côté de `GCP_PROJECT_ID`.

## Étape 6 — Le premier essai : une PR, son aperçu, la fusion, la recette (20 min)

1. **Une PR d'essai** (interface GitHub) : modifie une phrase de `docs/plateforme/domaine.md` sur une nouvelle branche `essai-domaine` → **Create pull request** (brouillon).
   - **Tu dois voir** le workflow **Aperçu** puis, sur la PR, un commentaire **« Aperçu »** avec `https://playdujour-recette--pr-<n>-<empreinte>.web.app/` et les liens `/track/`, `/jump/`.
2. **Ouvre l'aperçu** : le portail, puis DailyTrack et DailyJump.
   - **Tu dois voir** les deux jeux, le classement du jour de la **recette** (les « Démo … » de `recette:seed`). Ton profil y est **neuf** : l'aperçu est une autre adresse, il ne voit pas ton stockage de la production (ni celui d'un autre aperçu).
3. *(Si tu veux voir le cas « serveur »)* une PR qui touche `apps/api` : le workflow **Recette** crée sa révision, puis publie **le même canal** `pr-<n>`, branché sur cette révision ; son commentaire **« Recette »** donne la révision et l'aperçu.
4. **Ferme la PR d'essai** sans fusionner. **Tu dois voir** dans **Aperçu** → job `cleanup` : « Canal d'aperçu `pr-<n>` supprimé ».
5. **Fusionne une PR** (celle du lot R4, par exemple). Onglet **Actions** → workflow **Recette** (événement `push`) : `deploy` (révision par défaut), `seed`, `site`.
   - **Tu dois voir** <https://recette.playdujour.com/> (le portail), `/track/`, `/jump/` à jour, et <https://recette.playdujour.com/api/health> → `"ok":true,"db":"ok"`. **Aucune** production ne part.

## Étape 7 — Mesurer `TRUST_PROXY` sur la recette (10 min) — **avant la bascule**

**Pourquoi** : le serveur limite le débit **par adresse** du joueur, lue dans `X-Forwarded-For` en comptant `TRUST_PROXY` proxys depuis la droite. Derrière Firebase Hosting, Cloud Run voit un relais de plus. Avec la valeur d'aujourd'hui (1), il risque de lire l'adresse **du relais de Firebase** : tous les joueurs partageraient alors la même limite (des « Trop de requêtes » pour tout le monde). Firebase ne documente pas ce nombre : on le **mesure** (`scripts/sonde-proxy.mjs`, contre la recette seulement ; il n'observe que des réponses 429, rien de personnel).

Dans Cloud Shell, dans le dépôt (`git clone --depth 1 https://github.com/Nathan-Te/DailyTrack.git && cd DailyTrack`) :

```bash
DIRECT="$(gcloud run services describe cdj-api-recette --region=europe-west1 --format='value(status.url)')"
node scripts/sonde-proxy.mjs "$DIRECT" https://recette.playdujour.com --trust-proxy 1
```

- **Tu dois voir** l'un de ces verdicts :
  - « **TRUST_PROXY est juste** » → mets `RECETTE_TRUST_PROXY` **et** `TRUST_PROXY` à la valeur essayée (1) ;
  - « **TROP BAS** » → mets `RECETTE_TRUST_PROXY` à **2**, relance la recette (Actions → **Recette** → **Run workflow** sur `main`), **attends 10 minutes** (la fenêtre du débit), relance la sonde avec `--trust-proxy 2` ; recommence jusqu'à « juste » ; puis mets **`TRUST_PROXY`** (production) à la même valeur ;
  - « TROP HAUT » → diminue de 1, même démarche.
- **Ce qui reste ouvert**, quelle que soit la valeur : quelqu'un qui appelle **directement** l'adresse `run.app` du service (sans passer par playdujour.com) peut, avec une valeur ≥ 2, inventer son adresse et contourner la limite **par adresse** (pas celle par joueur, comptée en base). Le fermer demande un petit lot du serveur (lire l'en-tête posé par Firebase, ou n'accepter que le trafic de Firebase) : décision pour toi, README du lot R4.

## Étape 8 — « Mettre en production » : la première fois, c'est la bascule (15 min)

Onglet **Actions** → **Mettre en production** → **Run workflow** → **Branch : main**, laisse « commit » vide (le dernier de `main`) et « reference » vide → **Run workflow**.

1. **`verifier`** — la CI complète du commit doit être verte (sinon : refus, avec le lien du run) ; le résumé liste **les PR et les commits** depuis la dernière mise en production, et **le code en production**. La première fois (aucune étiquette `prod-…`), c'est le commit du dernier run réussi de l'ancienne « Production » : **vérifie-le** (c'est le code que les joueurs ont aujourd'hui sur GitHub Pages) ; s'il est faux, annule et relance en donnant **reference** (le bon commit).
2. **`figer`** — `freeze:days -- demain` **avec le code en production** : aujourd'hui et demain gardent le niveau que les joueurs voient déjà, même si le commit déployé change le générateur de DailyJump.
3. **`serveur`** attend ton clic : **Review deployments** → coche **production** → **Approve and deploy**. *(Un seul clic : le site et la suite partent après.)*
4. **`site`** — playdujour.com publié (avec les jours figés). **`verification`** — `smoke --lecture-seule` contre `https://playdujour.com/api/…` (des GET seulement, rien n'est écrit).
5. **`etiquette`** — le commit reçoit `prod-AAAA-MM-JJ-HHMM` (heure de Paris), avec l'image du serveur et la version du site.
6. **`bascule`** — **la première fois** : GitHub Pages ne sert plus que des redirections vers playdujour.com (sans effet les fois suivantes).
7. **`depot`** — une PR « **Jours figés — prod-…** » : fusionnée toute seule quand sa CI est verte (avec `ROBOT_TOKEN`), sinon **à fusionner par toi**.
8. **`resume`** — le tableau des étapes.

- **Tu dois voir** tout en vert, <https://playdujour.com/> avec les deux cartes, <https://playdujour.com/api/health> → `ok: true, db: "ok", salonOverride: false`, et l'étiquette dans **Code** → **Tags**.
- **Ensuite, à chaque mise en production** : le même bouton. Une mise en production à la fois (une seconde attend la première).

## Étape 9 — Vérifier la migration : ton profil sur la nouvelle adresse (10 min)

1. Sur un appareil où tu as joué sur l'ancienne adresse (avec ton pseudo) : ouvre **<https://nathan-te.github.io/DailyTrack/>**.
   - **Tu dois voir** « Le jeu a déménagé… » un instant, puis **<https://playdujour.com/track/>**, l'adresse **sans** `#dujour=…` (effacé aussitôt), et dans **Réglages › Profil** **ton pseudo** et **ton code** (le même qu'avant). Tes records reviennent par la synchronisation du serveur.
2. **<https://nathan-te.github.io/DailyTrack/jump/?seed=2026-10-18>** → **<https://playdujour.com/jump/?seed=2026-10-18>** (les paramètres sont gardés) ; même profil dans DailyJump.
3. **<https://nathan-te.github.io/DailyTrack/b/nimporte/>** → « Les aperçus ont déménagé ».
4. *(Facultatif)* sur un appareil où tu as **déjà** un profil **différent** sur playdujour.com : ouvre l'ancienne adresse. **Tu dois voir** une question (« OK : prendre le profil de l'ancienne adresse ; Annuler : garder celui de cet appareil »). Elle n'est posée qu'une fois pour ce lien.

**Ce qui passe** dans l'adresse (le fragment `#dujour=…`, jamais envoyé à un serveur) : l'identité (code `CDJ2`), le pseudo, et de DailyJump ce qui n'existe qu'en local et tient dans 16 000 caractères (un meilleur essai pas encore classé, les vies en attente d'envoi, la mémoire du jour). **Ce qui ne passe pas** : les réglages (son, caméra, commandes), la série et l'historique locaux, les records non envoyés des jours passés. Un joueur **sans identité** (jamais classé) arrive sans profil : il n'avait rien sur le serveur.

## Le retour arrière

Actions → **Retour arrière** → **Run workflow** (sur `main`) ; « étiquette » vide = la mise en production d'avant la dernière. Validation demandée (environnement `production`).
- Le serveur reprend **l'image** notée dans l'étiquette (`gcloud run deploy --image`, réglages du service inchangés) ; le site reprend **la version** notée (historique de Firebase : `hosting:clone <site>@<version> <site>:live`) ; puis `smoke --lecture-seule`, puis une nouvelle étiquette `prod-…` sur le commit remis (la prochaine mise en production figera les jours avec **ce** code).
- **Limite** : les jours figés **après** l'étiquette remise ne sont pas dans son image ; si le générateur de DailyJump a changé entre les deux, un de ces jours peut changer de niveau sur le serveur. Une mise en production de correctif le règle.
- **À la main**, si GitHub ne répond pas : `gcloud run services update-traffic cdj-api --region europe-west1 --to-revisions=<révision d'avant>=100` ; console Firebase → Hosting → site → **Historique des versions** → ⋮ → **Restaurer**.

## Les dates à retenir

- **31/12/2026** — dernière journée où le serveur accepte l'ancienne origine `https://nathan-te.github.io` (`scripts/domaine.mjs`, `RETRAIT_ANCIENNE_ORIGINE`) : passé ce jour, les déploiements ne la mettent plus dans `ALLOWED_ORIGINS`. Rien à faire de ton côté.
- **01/06/2027** au plus tôt — retrait des redirections de GitHub Pages (au moins 6 mois après la bascule ; `RETRAIT_REDIRECTIONS`). Ce jour-là (ou plus tard) : GitHub → **Settings** → **Pages** → **Unpublish site**, puis supprimer la branche `gh-pages`. Les liens anciens tombent alors en erreur 404.

## Le coût

| poste | gratuit | au-delà | nous |
|---|---|---|---|
| Firebase Hosting, stockage | 10 Go | 0,026 $/Go/mois | ≈ 3 Mo par version ; Firebase garde l'historique des versions (mets une limite de 50 versions par site : console → Hosting → ⋮ → **Paramètres de conservation des versions**) |
| Firebase Hosting, transfert | **360 Mo par jour** (≈ 10,8 Go/mois) | **0,15 $/Go** | premier chargement : DailyTrack ≈ 0,26 Mo, DailyJump ≈ 0,35 Mo (compressés) ; ensuite le navigateur garde les fichiers à empreinte (un an) |
| Domaines, certificats, deux sites, canaux d'aperçu | inclus | — | — |
| Cloud Run, Turso | inchangés | `couts.md` | **moins** de requêtes : plus de pré-vols CORS, et Firebase garde en cache les lectures publiques |
| Le domaine chez OVH | — | ≈ 10 à 15 € par an (déjà payé) | — |

Détail et seuils : `docs/plateforme/couts.md`, § 5. **Ordre de grandeur** : ≈ 1 000 premiers chargements de DailyJump par jour restent gratuits ; au-delà, ≈ 1,6 $ par mois pour 1 000 nouveaux joueurs de plus chaque jour.

---

## Si ça ne marche pas

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| « Firebase non configuré : voir docs/plateforme/domaine.md » (notice, job vert) | une variable manque | le résumé dit laquelle ; étape 5 |
| `HTTP Error: 403, The caller does not have permission` au déploiement du site | `cdj-deploy` sans `firebasehosting.admin` | étape 3 |
| `Failed to get Firebase project` / `Firebase Hosting API has not been used` | Firebase pas ajouté au projet, ou API éteinte | étape 1 |
| Le domaine reste « Configuration en cours » | DNS pas encore propagé, ou une ancienne entrée A / AAAA d'OVH en conflit | étape 4.2 : supprimer les entrées par défaut ; attendre ; `dig` |
| Erreur de certificat sur playdujour.com | certificat en cours (jusqu'à 24 h) | attendre ; un CAA qui interdit Let's Encrypt / Google bloque tout |
| `www.playdujour.com` ne redirige pas | `www` ajouté sans « Rediriger » | étape 4.1, point 2 |
| `/api/…` rend 404 sur playdujour.com | le renvoi vise un service absent | `GCP_SERVICE` / `RECETTE_GCP_SERVICE` ; le service existe dans `europe-west1` |
| Des « Trop de requêtes » (429) pour tout le monde | `TRUST_PROXY` trop bas derrière Firebase | étape 7 |
| « Mettre en production » refuse : « CI complète … pas verte » | le run `push` de `main` de ce commit est rouge ou en cours | attendre, ou réparer, fusionner, relancer |
| « jour(s) figé(s) différent(s) » | un jour figé du commit diffère de celui du code en production | ne jamais réécrire un jour figé : enquêter (README du lot R4) |
| La PR « Jours figés » ne se fusionne pas | pas de `ROBOT_TOKEN`, ou « Allow auto-merge » décoché | étape 5 ; ou fusionner à la main |
| L'aperçu d'une PR ne parle pas à sa révision | la PR ne touche pas le serveur (normal : recette par défaut), ou la recette n'est pas configurée | `docs/plateforme/recette.md` |
