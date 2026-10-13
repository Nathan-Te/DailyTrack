# Mettre Circuit du Jour en ligne

Guide pas à pas pour Nathan, environ **30 minutes**. À la fin : le jeu sur GitHub Pages, l'API sur Google Cloud Run, les temps dans une base Turso, et chaque fusion dans `main` déploie tout seule.

**Ce que ça coûte** : 0 € tant que le jeu reste petit (offres gratuites de Google Cloud, de Turso et de GitHub). Google demande une carte bancaire pour ouvrir la facturation, mais rien n'est prélevé sous les seuils gratuits ; on met une **alerte à 1 €** et l'API est **plafonnée à 2 instances**, ce qui borne le pire cas. Les chiffres mesurés (combien de joueurs tient le gratuit) sont dans [`docs/lots/lot-28-mise-en-ligne.md`](lots/lot-28-mise-en-ligne.md).

**Ce dont tu as besoin** : un compte Google, ton compte GitHub (propriétaire du dépôt `Nathan-Te/DailyTrack`), une carte bancaire, un navigateur. **Rien à installer** : les commandes se tapent dans **Cloud Shell**, un terminal intégré à Google Cloud.

**Comment lire ce guide** : chaque étape dit quoi faire, puis **« Tu dois voir »** ce qui confirme que c'est bon. Si ce n'est pas ce que tu vois, va à la fin (« Si ça ne marche pas »). Les noms de boutons de Google, Turso et GitHub changent de temps en temps : cherche le libellé le plus proche.

**Les trois secrets de l'API** (`ADMIN_TOKEN`, `TURSO_AUTH_TOKEN`, `RATE_SALT`) vivent dans **Secret Manager** (le coffre de Google). Ils ne sont jamais dans le dépôt, ni dans GitHub, ni dans les journaux.

---

## Étape 1 — Le projet Google Cloud, la facturation, l'alerte à 1 €

1. Va sur <https://console.cloud.google.com> et connecte-toi.
2. En haut, clique sur le **sélecteur de projet** → **Nouveau projet**. Nom : `circuit-du-jour`. Clique **Créer**.
   - **Tu dois voir** une notification « Création du projet… » puis le projet sélectionné en haut. **Note son identifiant** (sous le nom, dans la fenêtre de création ou dans le sélecteur) : il ressemble à `circuit-du-jour-123456`. Je l'appelle `PROJECT_ID` plus bas.
3. Menu ☰ → **Facturation**. S'il n'y a pas de compte de facturation : **Créer un compte de facturation**, remplis la carte. Puis **associe-le au projet** (« Associer un compte de facturation »).
   - **Tu dois voir** sur la page Facturation du projet : « Ce projet est associé au compte de facturation … ».
4. **L'alerte à 1 €** : menu ☰ → **Facturation** → **Budgets et alertes** → **Créer un budget**. Nom `alerte-1-euro`, **Montant** : budget ciblé **1 €**, seuils **50 %, 90 % et 100 %**, notifications par e-mail activées. **Terminer**.
   - **Tu dois voir** le budget dans la liste (« 1,00 € »). **Une alerte ne bloque rien** : elle t'écrit quand la dépense approche 1 €. Le vrai frein est le plafond de 2 instances (étape 5).

---

## Étape 2 — Cloud Shell : activer les services et préparer le déploiement

1. Dans la console, en haut à droite, clique sur l'icône **`>_` Activer Cloud Shell**. Un terminal s'ouvre en bas. Valide si on te demande d'autoriser.
   - **Tu dois voir** une invite du genre `nathan@cloudshell:~ (circuit-du-jour-123456)$`.
2. Copie-colle ce bloc **en remplaçant la première ligne par ton identifiant de projet** :

```bash
export PROJECT_ID="circuit-du-jour-123456"   # ← TON identifiant de projet (étape 1)
export REGION="europe-west1"                  # Belgique : région « niveau 1 » (tarif le plus bas), proche des joueurs français
export GITHUB_REPO="Nathan-Te/DailyTrack"     # ← si le dépôt change de nom, mets-le ici (majuscules comprises)
gcloud config set project "$PROJECT_ID"
```

   - **Tu dois voir** `Updated property [core/project].`

3. **Active les services** (une minute) :

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com
```

   - **Tu dois voir** `Operation "operations/…" finished successfully.` (si Cloud Shell demande d'autoriser, accepte).

4. **Le dépôt d'images Docker** (Artifact Registry) + un nettoyage automatique (on ne garde que les 5 dernières images : le stockage gratuit est de 0,5 Go) :

```bash
gcloud artifacts repositories create cdj --repository-format=docker --location="$REGION" --description="Images de l'API Circuit du Jour"
cat > /tmp/cleanup.json <<'EOF'
[
  {"name": "supprimer-les-anciennes", "action": {"type": "Delete"}, "condition": {"olderThan": "604800s"}},
  {"name": "garder-les-5-dernieres", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 5}}
]
EOF
gcloud artifacts repositories set-cleanup-policies cdj --location="$REGION" --policy=/tmp/cleanup.json --no-dry-run
```

   - **Tu dois voir** `Created repository [cdj].` puis une confirmation de la politique de nettoyage.

5. **Deux comptes de service** : un qui *exécute* l'API (il ne peut presque rien faire), un qui *déploie* (utilisé par GitHub) :

```bash
gcloud iam service-accounts create cdj-api-runtime --display-name="API Circuit du Jour (exécution)"
gcloud iam service-accounts create cdj-deploy --display-name="Déploiement depuis GitHub"
export RUNTIME_SA="cdj-api-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA="cdj-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

# Le compte de déploiement peut : déployer sur Cloud Run, pousser des images, et « agir comme » le compte d'exécution.
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" --role="roles/artifactregistry.writer"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$DEPLOY_SA" --role="roles/iam.serviceAccountUser"
```

   - **Tu dois voir** trois fois un bloc `Updated IAM policy for …` (ou `bindings:` suivi d'une liste).

6. **Relier GitHub à Google sans clé** (fédération d'identité : GitHub prouve à Google qui il est, aucun mot de passe ni fichier de clé n'est stocké). Seul **ce dépôt** est accepté :

```bash
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github-repo \
  --location=global --workload-identity-pool=github --display-name="Dépôt Circuit du Jour" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
POOL="$(gcloud iam workload-identity-pools describe github --location=global --format='value(name)')"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL}/attribute.repository/${GITHUB_REPO}"
echo
echo "GCP_WORKLOAD_IDENTITY_PROVIDER = $(gcloud iam workload-identity-pools providers describe github-repo --location=global --workload-identity-pool=github --format='value(name)')"
echo "GCP_SERVICE_ACCOUNT            = $DEPLOY_SA"
echo "GCP_PROJECT_ID                 = $PROJECT_ID"
```

   - **Tu dois voir** à la fin trois lignes, dont `GCP_WORKLOAD_IDENTITY_PROVIDER = projects/123456789012/locations/global/workloadIdentityPools/github/providers/github-repo`. **Copie ces trois lignes dans un bloc-notes** : tu en as besoin à l'étape 4.

> **Si tu préfères une clé JSON** (moins sûr, une clé qui ne périme jamais) : crée-la avec `gcloud iam service-accounts keys create /tmp/cle.json --iam-account="$DEPLOY_SA"`, colle son contenu dans le secret GitHub `GCP_SA_KEY`, **supprime le fichier**, et saute les secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_SERVICE_ACCOUNT`. La fédération ci-dessus est conseillée.

---

## Étape 3 — La base Turso, puis les trois secrets

### 3a. Turso

1. Va sur <https://turso.tech> → **Sign in** → **Continue with GitHub** (offre gratuite, pas de carte).
2. **Create database** : nom `cdj`, emplacement **en Europe** (le plus proche de la Belgique : Irlande ou Francfort selon la liste). Valide.
   - **Tu dois voir** la base `cdj` dans ta liste, état « Active ».
3. Ouvre la base. Copie son **URL** : `libsql://cdj-ton-compte.turso.io`. C'est `TURSO_DATABASE_URL`.
4. Crée un **jeton** pour cette base (bouton du type **Generate token** / **Create token** de la page de la base) : droits **Read & Write** (accès complet), **expiration : jamais**. Copie-le (une longue suite de caractères commençant par `eyJ`) : **il ne s'affiche qu'une fois**.

### 3b. Les secrets dans Secret Manager (retour dans Cloud Shell)

```bash
# 1. Le jeton Turso (colle-le entre les guillemets, SANS espace autour)
printf '%s' 'COLLE-ICI-LE-JETON-TURSO' | gcloud secrets create cdj-turso-token --data-file=-

# 2. Le jeton de l'admin (≥ 16 caractères) : généré au hasard et AFFICHÉ UNE FOIS — range-le dans ton gestionnaire de mots de passe
ADMIN="$(openssl rand -hex 24)"; echo "ADMIN_TOKEN = $ADMIN"
printf '%s' "$ADMIN" | gcloud secrets create cdj-admin-token --data-file=-

# 3. Le sel du limiteur de débit (jamais besoin de le revoir)
openssl rand -hex 24 | tr -d '\n' | gcloud secrets create cdj-rate-salt --data-file=-

# 4. Seul le compte d'exécution de l'API peut les lire
for s in cdj-turso-token cdj-admin-token cdj-rate-salt; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor"
done
```

   - **Tu dois voir** `Created secret [cdj-turso-token].` (et les deux autres), puis trois confirmations `Updated IAM policy`. Menu ☰ → **Sécurité → Secret Manager** liste les trois secrets.
   - L'API **refuse de démarrer** sans `RATE_SALT` (≥ 16 caractères) ni `TURSO_DATABASE_URL` : c'est voulu, pour ne jamais tourner sur une base qui s'efface.

---

## Étape 4 — Les variables et secrets GitHub

Sur GitHub : dépôt `DailyTrack` → **Settings** → **Secrets and variables** → **Actions**.

**Onglet « Variables »** → **New repository variable** (une par ligne) :

| Nom | Valeur | Obligatoire |
|---|---|---|
| `GCP_PROJECT_ID` | ton identifiant de projet (`circuit-du-jour-123456`) | oui |
| `TURSO_DATABASE_URL` | `libsql://cdj-ton-compte.turso.io` | oui |
| `GCP_REGION` | `europe-west1` | non (c'est le défaut) |
| `GCP_SERVICE` | `cdj-api` | non (défaut) |
| `GCP_AR_REPO` | `cdj` | non (défaut) |
| `GCP_RUNTIME_SA` | `cdj-api-runtime@<projet>.iam.gserviceaccount.com` | non (défaut) |
| `ALLOWED_ORIGINS` | autres origines autorisées, séparées par `;` (ex. `http://localhost:5173`) | non : le site `https://nathan-te.github.io` est ajouté tout seul |
| `VITE_API_URL` | *(étape 5, une fois l'API déployée)* | pour le site |

**Onglet « Secrets »** → **New repository secret** :

| Nom | Valeur |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | la ligne `projects/…/providers/github-repo` de l'étape 2.6 |
| `GCP_SERVICE_ACCOUNT` | `cdj-deploy@<projet>.iam.gserviceaccount.com` |

- **Tu dois voir** les deux secrets et les variables dans les deux onglets. **Les valeurs des secrets ne s'affichent plus après l'enregistrement** : c'est normal.
- Tant que `GCP_PROJECT_ID`, `TURSO_DATABASE_URL` et un moyen de s'authentifier manquent, le workflow **« Deploy API »** s'exécute mais **ne fait rien** et l'écrit dans son résumé (« Déploiement de l'API ignoré »).

---

## Étape 5 — Fusionner, vérifier `/api/health`, brancher le site

1. **Fusionne la PR du lot 28** dans `main`.
2. Onglet **Actions** de GitHub → workflow **Deploy API** (une exécution vient de démarrer). Attends 3 à 5 minutes.
   - **Tu dois voir** une coche verte. Ouvre l'exécution : le **résumé** (en bas de la page) donne **« API déployée — Adresse : https://cdj-api-xxxxxxxxxx-ew.a.run.app »**. Copie cette adresse.
   - Les étapes se lisent ainsi : *Configuration présente ?* → *Authentification* → *Construire et pousser l'image* → *Déployer sur Cloud Run* → *Vérifier la santé du service déployé* (qui échoue si l'API ne répond pas ou si `SALON_MINUTES` est réglée).
3. **Ouvre `<adresse>/api/health` dans un navigateur.**
   - **Tu dois voir** un JSON de ce genre :

```json
{"ok":true,"db":"ok","simVersion":14,"generatorVersion":15,"today":"2026-10-13","salonMinutes":10,"salonOverride":false,"revision":"cdj-api-00001-abc"}
```

   `"db":"ok"` : la base Turso répond. `"salonOverride":false` et `"salonMinutes":10` : la durée du Salon est la vraie. (La première requête après un moment d'inactivité met 1 à 2 secondes : le conteneur se réveille.)
4. **Brancher le site** : GitHub → Settings → Secrets and variables → Actions → Variables → ajoute **`VITE_API_URL`** = l'adresse de l'API (sans `/` final). Puis onglet **Actions** → workflow **Pages** → dernière exécution sur `main` → **Re-run all jobs**.
   - **Tu dois voir** une coche verte au bout de 2 minutes. Le site `https://nathan-te.github.io/DailyTrack/` n'utilise l'API **que** pour la construction de `main` : les aperçus de branches (`/b/…`) restent sans classement, pour ne rien polluer.
5. Ouvre le jeu : le bouton **🏆 Classement** est là, le bandeau n'indique plus « hors ligne, non classé ».
6. Le panneau d'admin : `https://nathan-te.github.io/DailyTrack/admin/` → champ **adresse de l'API** = l'adresse de l'API, et le **jeton** = l'`ADMIN_TOKEN` noté à l'étape 3b.

> **Le premier jour** est le **13/10/2026** (`PREMIER_JOUR`, circuit n° 1) : l'API n'accepte aucun temps avant cette date. Les circuits de la démo (`?api=demo`) restent un jeu de données à part, intact.

---

## Étape 6 — L'essai final : deux appareils, un temps classé, le Salon à deux

1. **Deux appareils** (ton PC et ton téléphone, ou deux navigateurs) sur `https://nathan-te.github.io/DailyTrack/`.
2. **Un temps classé** : sur le PC, finis un tour, choisis un pseudo (« Alice »). Sur le téléphone, fais un tour avec un autre pseudo (« Bob »).
   - **Tu dois voir** sur chaque appareil « Rang 1/2 » ou « Rang 2/2 », et le **classement** (touche **L** ou bouton 🏆) avec les deux pseudos. Le temps affiché est celui **rejoué par le serveur** : il peut différer de quelques millisecondes de l'affichage local, c'est voulu.
3. **Le code de transfert** : sur le PC, touche **P** (pause) → **Réglages** → **Copier mon code**. Envoie-le au téléphone (message à toi-même), puis sur le téléphone : **⏸ → Réglages → Coller un code → Remplacer mon identité**. Le téléphone devient « Alice » ; il garde sa place au classement.
4. **Le Salon à deux** : sur les deux appareils, bouton **Salon**. Courez sur le même circuit.
   - **Tu dois voir** le compte à rebours de la session, les **fantômes** de l'autre, et le classement de la session avec deux joueurs.
5. **Les journaux** : console Google → **Cloud Run** → `cdj-api` → onglet **Journaux**. Tu y lis des lignes courtes (« temps du jour », « circuit du jour généré », « schéma à jour »). **Ni pseudo, ni identifiant, ni adresse, ni rediffusion n'y figurent.**

---

## Si ça ne marche pas

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| Le workflow dit « Déploiement de l'API ignoré » | une variable ou un secret manque | le résumé liste ce qui manque ; étape 4 |
| Échec à l'authentification Google (`Unable to acquire impersonated credentials`) | fédération mal reliée ; nom du dépôt différent | refaire l'étape 2.6 avec le bon `GITHUB_REPO` (majuscules comprises) ; vérifier le secret `GCP_SERVICE_ACCOUNT` |
| `Permission denied on secret …` au déploiement | le compte d'exécution ne peut pas lire un secret | refaire l'étape 3b.4 |
| `Image … not found` ou refus à la poussée de l'image | dépôt Artifact Registry absent ou région différente | étape 2.4 ; `GCP_REGION` doit être celle du dépôt |
| Le déploiement réussit mais « Vérifier la santé » échoue | l'API ne démarre pas | Cloud Run → Journaux : « configuration refusée » dit laquelle (`TURSO_DATABASE_URL`, `RATE_SALT`, `ALLOWED_ORIGINS`…) |
| `/api/health` répond **503** `"db":"error"` | adresse ou jeton Turso faux, jeton expiré | vérifier `TURSO_DATABASE_URL` (variable) et le secret `cdj-turso-token` (`gcloud secrets versions add cdj-turso-token --data-file=-`, puis relancer le déploiement) |
| Le jeu affiche « hors ligne, non classé » | `VITE_API_URL` absente ou site pas reconstruit | étape 5.4 ; vérifier dans la console du navigateur (F12) |
| Erreur « CORS » dans la console du navigateur | l'origine du jeu n'est pas autorisée | le site est autorisé tout seul ; pour un autre domaine, variable `ALLOWED_ORIGINS` (séparées par `;`) puis redéployer (Actions → Deploy API → Run workflow) |
| Première requête lente (1–2 s) | réveil du conteneur (0 instance au repos) | normal ; la suivante est instantanée |
| Facture inattendue | trop de joueurs dans le Salon | voir `docs/lots/lot-28-mise-en-ligne.md` (budget) ; au besoin `gcloud run services update cdj-api --region=europe-west1 --max-instances=1` |

**Changer un secret** : `printf '%s' 'nouvelle-valeur' | gcloud secrets versions add cdj-turso-token --data-file=-`, puis relancer **Deploy API** (Actions → Run workflow).
**Tout arrêter** : `gcloud run services delete cdj-api --region=europe-west1` (le jeu retombe en « hors ligne, non classé » sans rien casser).
**Sauvegarde de la base** : Turso → ta base → l'onglet de sauvegarde / `turso db shell cdj .dump > sauvegarde.sql` (avec la CLI Turso) ; à faire de temps en temps, rien n'est automatique sur l'offre gratuite.
