# playdujour.com : le domaine, l'hébergement et la mise en production

Guide pas à pas pour Nathan (lot R4), **à faire une fois**. Compte **≈ 1 h 30 de travail**, plus l'attente du DNS et des certificats (de quelques minutes à 24 h). À la fin :

| adresse | ce qu'elle sert | serveur (`/api/`) |
|---|---|---|
| `https://playdujour.com/` | le portail « Du Jour » (une carte par jeu) | — |
| `https://playdujour.com/track/` · `/jump/` | DailyTrack · DailyJump (production) | `cdj-api` (production), même adresse |
| `https://recette.playdujour.com/` (`/track/`, `/jump/`) | `main` en entier, à chaque fusion | `cdj-api-recette` (recette par défaut), même adresse |
| `https://<site de recette>--pr-<n>-<empreinte>.web.app/` | l'aperçu de la PR n° n (lien commenté sur la PR, 7 jours) | recette par défaut ; **sa révision** si la PR touche le serveur |
| `https://playdujour.com/mentions-legales/` | mentions légales et confidentialité (lot R5) | — |

Le flux : **PR → aperçu → fusion → recette → bouton « Mettre en production » → production**. Plus aucun déploiement automatique de la production. Le serveur est servi **sous la même adresse** que les jeux (Firebase Hosting renvoie `/api/**` vers Cloud Run, `europe-west1`) : plus aucune requête CORS de vérification préalable.

**Coût** : visé **0 €** au départ (§ « Le coût » en bas, et `docs/plateforme/couts.md` § 5).

**Avant de commencer** : la production (lot 28, `docs/mise-en-ligne.md`) et la recette (lot R1, `docs/plateforme/recette.md`) sont en place : projet `dailytrack-511513`, région `europe-west1`, comptes `cdj-deploy` (déploiement, fédération d'identité `github`) et services `cdj-api`, `cdj-api-recette`. Tout se fait dans **Cloud Shell** (console Google → icône `>_`), dans la **console Firebase**, chez **OVH** et dans les réglages du dépôt. Chaque étape dit quoi faire, puis **« Tu dois voir »**.

**Ordre** : étapes 1 à 6, puis l'étape 7 (la mesure de `TRUST_PROXY`) **avant** l'étape 8 (la première « Mettre en production »). Lot R5 : **plus aucune redirection depuis GitHub Pages** (décision de Nathan) — l'ancienne adresse disparaît avec le dépôt privé ; un joueur de l'ancienne adresse retrouve son profil avec son code de transfert (Réglages › Profil). Pour couper GitHub Pages : § « GitHub Pages » en bas.

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
1. **Supprime d'abord** les entrées par défaut d'OVH qui entreraient en conflit : les **A** (`213.186.33.5`, la page d'attente d'OVH) et **AAAA** de `@` et de `www`, leurs **TXT** de redirection OVH (`"1|www…"`, `"3|welcome"`), et un éventuel **CNAME** `www`. Chez OVH, la racine s'écrit **`@`** dans le champ « Sous-domaine ». Ne touche ni aux **NS**, ni aux **MX** / **SPF** (le courrier, si tu en as).
2. **Ajouter une entrée** pour chaque ligne donnée par Firebase :

| sous-domaine (OVH) | type | valeur | pour |
|---|---|---|---|
| `@` | TXT | `hosting-site=playdujour` (copié de Firebase) | preuve, `playdujour.com` |
| `@` | A | l'IP donnée par Firebase (une ligne par IP, ex. `199.36.158.100`) | `playdujour.com` |
| `www` | TXT / A (ou CNAME) | ce que Firebase affiche pour `www` | redirection `www` |
| `recette` | TXT | `hosting-site=playdujour-recette` (copié de Firebase) | preuve, recette |
| `recette` | A (ou CNAME) | ce que Firebase affiche pour `recette` | `recette.playdujour.com` |
| `_acme-challenge…` | TXT | seulement si Firebase le demande | certificat |

   Laisse le TTL par défaut. **Un CNAME ne peut pas cohabiter avec une autre entrée du même sous-domaine** (« CNAME and other data ») : pour `recette`, soit un CNAME seul vers `playdujour-recette.web.app`, soit A + TXT, comme Firebase le propose. Si la zone contient un enregistrement **CAA**, il doit permettre `letsencrypt.org` et `pki.goog` (sans CAA, rien à faire).
3. Reviens dans la console Firebase → **Vérifier** sur chaque domaine.

- Firebase garde sa dernière lecture du DNS (« Valeur(s) découverte(s) ») : après une suppression, l'ancienne adresse peut y rester **jusqu'à une heure** (TTL de 3600 s), avec l'erreur « défi ACME … 213.186.33.5 ». Vérifie les deux serveurs d'OVH (`dig +short playdujour.com A @dns103.ovh.net` et `@ns103.ovh.net`), puis reclique sur **Valider** plus tard ; si ça dure, mode **Avancé** → TXT `_acme-challenge`.
- **Tu dois voir** les domaines passer à « **Configuration en cours** » (DNS vu), puis « **Connecté** » quand le certificat HTTPS est prêt. **Délai** : le DNS d'OVH se propage en quelques minutes à quelques heures ; le certificat suit, **jusqu'à 24 h** (souvent moins d'une heure). Pendant ce temps, `https://playdujour.com` peut afficher une erreur de certificat : c'est normal, attends.
- Vérification depuis Cloud Shell : `dig +short playdujour.com A`, `dig +short recette.playdujour.com`, `dig +short TXT playdujour.com` doivent rendre les valeurs de Firebase.

## Étape 5 — Les variables et réglages du dépôt (10 min)

GitHub → dépôt → **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable** :

| Nom | Valeur | Obligatoire |
|---|---|---|
| `FIREBASE_SITE_PRODUCTION` | `playdujour` (l'identifiant de l'étape 2) | oui |
| `FIREBASE_SITE_RECETTE` | `playdujour-recette` | oui |
| `RECETTE_TRUST_PROXY` | *(étape 7 : la valeur mesurée)* | avant la première mise en production |
| `TRUST_PROXY` | *(étape 7 : la même valeur, pour la production)* | avant la première mise en production |

Les secrets ne changent pas (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`). `VITE_API_URL` et `RECETTE_API_URL` ne servent plus aux jeux publiés (ils appellent `/api/` sur leur propre adresse) ; garde `VITE_API_URL` (le garde-fou « un aperçu ne vise jamais la production » la lit) ; `RECETTE_API_URL` n'est plus lue, tu peux la laisser.

**Le jeton de robot (facultatif depuis le lot R12 : le workflow fusionne lui-même les jours figés)** — avec lui, la PR des jours figés lance sa CI comme une PR ordinaire : GitHub → ton profil → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate new token** : nom `dailytrack-robot`, expiration 1 an, **Only select repositories** → `DailyTrack`, permissions **Contents : Read and write**, **Pull requests : Read and write**. Copie-le → dépôt → **Settings** → **Secrets and variables** → **Actions** → **Secrets** → **New repository secret** `ROBOT_TOKEN`.
- Sans lui, tout marche aussi (lot R12) : le workflow lance la CI de la PR des jours figés et la fusionne lui-même ; aucune mise en production n'exige plus le run `push` de `main`.

**Deux réglages** : **Settings** → **General** → **Pull Requests** → coche **Allow auto-merge** ; **Settings** → **Actions** → **General** → **Workflow permissions** → coche **Allow GitHub Actions to create and approve pull requests** → **Save**.

L'environnement **`production`** : branche `main` seulement ; **lot R12 : sans relecteur** (le lancement du bouton sur `main` vaut validation : `docs/plateforme/mise-en-production.md`, annexe C).

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

## Étape 7 — Mesurer `TRUST_PROXY` sur la recette (10 min) — **avant la première mise en production**

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
- **Mesuré au lot R5 sur la recette** : la valeur juste derrière Firebase est **2**. Un appel **direct** à l'adresse `run.app` peut alors inventer l'avant-dernière entrée de `X-Forwarded-For` ; depuis le lot R5, le serveur compte aussi la **dernière** (écrite par Google, jamais par le client) dans chaque limite par adresse, et plafonne les rejeux par minute : README du lot R5 et `apps/api/CLAUDE.md`, « Adresse du client ». Vérification : `node scripts/sonde-proxy.mjs faille <adresse directe de la recette>` (« Faille fermée »).

## Étape 8 — « Mettre en production » (15 min)

Onglet **Actions** → **Mettre en production** → **Run workflow** → **Branch : main**, mode `production`, les autres champs vides → **Run workflow**. **Lot R12 : un seul clic, plus rien à valider ni à fusionner** — CI complète (relancée ou reprise), garde-fou des jours, répétition sur la recette, sauvegarde de la base, serveur et site, `smoke --lecture-seule`, étiquette `prod-…`, jours figés versés dans `main` par le workflow ; le détail et le résumé : `docs/plateforme/mise-en-production.md` (une page) et `docs/plateforme/lots/lot-R12-un-seul-bouton.md`.

- **Tu dois voir** tout en vert, <https://playdujour.com/> avec les deux cartes, <https://playdujour.com/api/health> → `ok: true, db: "ok", salonOverride: false`, et l'étiquette dans **Code** → **Tags**.
- **Ensuite, à chaque mise en production** : le même bouton. Une mise en production à la fois (une seconde attend la première).

## Étape 9 — La conservation des versions de Firebase (2 min, une fois)

Firebase garde **toutes** les versions publiées de chaque site (une par mise en production, par fusion pour la recette) : ≈ 3 Mo chacune, sur les 10 Go gratuits. Décision 3 du lot R4 : **50 versions par site** (assez pour revenir en arrière de plusieurs semaines). Console Firebase → **Hosting** → site `playdujour` → onglet du tableau de bord → **⋮** (en haut du « Historique des versions ») → **Paramètres de conservation des versions** → **50** → Enregistrer ; **même chose** pour `playdujour-recette`.
- **Tu dois voir** « Conserver les 50 dernières versions » sur les deux sites. Le retour arrière (`retour-arriere.yml`) ne revient qu'à la version de l'étiquette précédente : elle est toujours dans les 50.

## Le retour arrière

Actions → **Retour arrière** → **Run workflow** (sur `main`) ; « étiquette » vide = la mise en production d'avant la dernière. Validation demandée (environnement `production`).
- Le serveur reprend **l'image** notée dans l'étiquette (`gcloud run deploy --image`, réglages du service inchangés) ; le site reprend **la version** notée (historique de Firebase : `hosting:clone <site>@<version> <site>:live`) ; puis `smoke --lecture-seule`, puis une nouvelle étiquette `prod-…` sur le commit remis (la prochaine mise en production figera les jours avec **ce** code).
- **Limite** : les jours figés **après** l'étiquette remise ne sont pas dans son image ; si le générateur a changé entre les deux, un de ces jours peut changer de carte. **Lot R6** : le retour arrière est donc **refusé une fois commencé le jour de bascule** de la dernière mise en production (case `apres_le_jour_j` pour passer outre, en connaissance de cause) ; avant, aucun joueur n'a vu la carte du nouveau code et rien ne change. Ce qu'il restaure et ce qu'il ne restaure pas (la base, les jours figés) : `docs/plateforme/mise-en-production.md`, § 5.
- **À la main**, si GitHub ne répond pas : `gcloud run services update-traffic cdj-api --region europe-west1 --to-revisions=<révision d'avant>=100` ; console Firebase → Hosting → site → **Historique des versions** → ⋮ → **Restaurer**.

## GitHub Pages (lot R5 : plus rien n'y est publié)

Le workflow `pages.yml` est retiré : plus aucune publication, plus de redirection. Si GitHub Pages sert encore l'ancien site (branche `gh-pages`) :
1. GitHub → dépôt → **Settings** → **Pages** → **Build and deployment** : si une source est réglée (« Deploy from a branch » → `gh-pages`), **Unpublish site** (en haut de la page, menu « … »), ou règle la source sur **None**.
2. **Code** → **Branches** → supprime la branche `gh-pages` (elle ne sert plus).
3. **Tu dois voir** `https://nathan-te.github.io/DailyTrack/` répondre « 404 ». Quand le dépôt repasse en **privé**, Pages s'arrête de toute façon sur l'offre gratuite de GitHub.
- Un joueur de l'ancienne adresse retrouve son profil sur playdujour.com avec son **code de transfert** (Réglages › Profil › « Copier mon code » sur l'ancienne adresse, tant qu'elle répond, puis « Charger un code »). Le serveur n'accepte plus l'origine `https://nathan-te.github.io` (lot R5).

## Le coût

| poste | gratuit | au-delà | nous |
|---|---|---|---|
| Firebase Hosting, stockage | 10 Go | 0,026 $/Go/mois | ≈ 3 Mo par version ; **50 versions par site** (étape 9) : ≈ 300 Mo pour les deux sites |
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
| « Mettre en production » : « ⛔ CI complète : rouge » | la CI complète que le bouton a lancée (lot R12) est rouge | la phrase du résumé : un lot de mise en production avec ce run |
| « jour(s) figé(s) différent(s) » | un jour figé du commit diffère de celui du code en production | ne jamais réécrire un jour figé : enquêter (README du lot R4) |
| « ⛔ Jours figés : la protection de main refuse… » | la protection de `main` interdit au workflow de fusionner (lot R12) | README du lot R12, « Jours figés sans PR » ; ou fusionner la PR à la main |
| « redirigé à de trop nombreuses reprises » sur `/track/` ou `/jump/` | une redirection `/track` → `/track/` dans `firebase.json` (corrigé après le lot R4) | aucune redirection de dossier dans `firebase.json` : Hosting ajoute le « / » lui-même |
| L'aperçu d'une PR ne parle pas à sa révision | la PR ne touche pas le serveur (normal : recette par défaut), ou la recette n'est pas configurée | `docs/plateforme/recette.md` |
