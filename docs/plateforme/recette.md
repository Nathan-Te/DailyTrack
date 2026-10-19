# Mettre en place la recette

Guide pas à pas pour Nathan, **à faire une fois**, environ **45 minutes**. À la fin :
- un **serveur de recette** (service Cloud Run `cdj-api-recette` et base Turso `dailytrack-recette`), entièrement séparé de la production ;
- chaque PR qui touche le serveur y déploie **sa** version, commente l'adresse sur la PR, et l'aperçu de sa branche lui parle ;
- **la production attend ton clic** : une fusion dans main met à jour la recette, puis l'API et le site attendent ta validation, et partent ensemble.

**Ce que ça coûte** : visé **0 €**. Même projet Google Cloud que la production (offre gratuite partagée), **0 instance au repos et 1 au plus** pour la recette, une deuxième base sur l'offre gratuite de Turso, environnement GitHub gratuit (le dépôt est public). Le seul poste qui peut coûter quelques centimes : le stockage des images Docker au-delà de 0,5 Go (on n'en garde que 3 en recette, et les couches de base sont partagées au sein d'un dépôt d'images).

**Avant de commencer** : la production du lot 28 est en place (`docs/mise-en-ligne.md`) : projet `dailytrack-511513`, fédération d'identité `github`, comptes `cdj-deploy` et `cdj-api-runtime`. Tout se fait dans **Cloud Shell** (console Google → icône `>_`) et dans les réglages du dépôt sur GitHub. Chaque étape dit quoi faire, puis **« Tu dois voir »**.

**Quand le faire** : les étapes 0 à 6 **avant de fusionner la PR du lot R1** (elle est vérifiée sur la recette à l'étape 7) ; les étapes 8 et 9 ensuite.

---

## Étape 0 — La branche par défaut du dépôt (2 min)

Aujourd'hui la branche par défaut du dépôt est `ccr-9cb88ba0-62npko`, pas `main`. Or GitHub ne propose « Run workflow » que pour les workflows présents sur la branche par défaut, et y lance les tâches planifiées (le run de nuit de la CI tourne donc sur cette branche, pas sur `main`).

GitHub → dépôt → **Settings** → **General** → **Default branch** → ⇄ → choisis **`main`** → **Update**.
- **Tu dois voir** `main` comme branche par défaut, et la page d'accueil du dépôt sur `main`.

---

## Étape 1 — La base Turso de recette (5 min)

1. <https://turso.tech> → ta console → **Create database**. Nom : **`dailytrack-recette`** (le nom **doit** contenir `recette` : le serveur refuse de démarrer sinon). Même emplacement que la base de production.
   - **Tu dois voir** la base `dailytrack-recette` « Active » à côté de `dailytrack`.
2. Ouvre-la, copie son **URL** telle quelle (de la forme `libsql://dailytrack-recette-<compte>.<région>.turso.io` : la partie région peut y être, ne la retire pas). C'est **`RECETTE_TURSO_DATABASE_URL`**. Vérifie qu'elle contient bien `recette` **avant** le premier `.turso.io`.
3. **Generate token** sur **cette** base : Read & Write, expiration jamais. Copie-le (il commence par `eyJ`, il ne s'affiche qu'une fois). **Ne prends pas le jeton de la production.**

## Étape 2 — Dépôt d'images, compte d'exécution et secrets de recette (10 min)

Dans Cloud Shell, copie-colle ce bloc (il refait les variables : Cloud Shell les oublie quand il se met en veille) :

```bash
PROJECT_ID=dailytrack-511513
REGION=europe-west1
gcloud config set project $PROJECT_ID
DEPLOY_SA=cdj-deploy@$PROJECT_ID.iam.gserviceaccount.com
RECETTE_SA=cdj-recette-runtime@$PROJECT_ID.iam.gserviceaccount.com

# Dépôt d'images à part (le nettoyage de la production ne voit jamais les images de recette) : on garde les 3 dernières.
gcloud artifacts repositories create cdj-recette --repository-format=docker --location=$REGION --description="Images de l'API, recette"
cat > /tmp/cleanup-recette.json <<'EOF'
[
  {"name": "supprimer-les-anciennes", "action": {"type": "Delete"}, "condition": {"olderThan": "259200s"}},
  {"name": "garder-les-3-dernieres", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 3}}
]
EOF
gcloud artifacts repositories set-cleanup-policies cdj-recette --location=$REGION --policy=/tmp/cleanup-recette.json --no-dry-run

# Le compte qui exécute l'API de recette (il ne lit que les secrets de recette) ; le compte de déploiement peut « agir comme » lui.
gcloud iam service-accounts create cdj-recette-runtime --display-name="API Circuit du Jour (recette)"
gcloud iam service-accounts add-iam-policy-binding $RECETTE_SA --member=serviceAccount:$DEPLOY_SA --role=roles/iam.serviceAccountUser
```

- **Tu dois voir** `Created repository [cdj-recette].`, la politique de nettoyage, `Created service account [cdj-recette-runtime].` et `Updated IAM policy`.

Puis les **trois secrets de recette** (distincts de ceux de la production) :

```bash
# 1. Le jeton Turso de la base de RECETTE (étape 1.3), entre les guillemets, sans espace autour
printf '%s' 'COLLE-ICI-LE-JETON-DE-LA-BASE-DE-RECETTE' | gcloud secrets create cdj-recette-turso-token --data-file=-
# 2. Le jeton d'admin de la recette : AFFICHÉ UNE FOIS, range-le (il ouvre /admin/ contre la recette)
ADMIN="$(openssl rand -hex 24)"; echo "ADMIN_TOKEN de recette = $ADMIN"
printf '%s' "$ADMIN" | gcloud secrets create cdj-recette-admin-token --data-file=-
# 3. Le sel du limiteur de débit de la recette
openssl rand -hex 24 | tr -d '\n' | gcloud secrets create cdj-recette-rate-salt --data-file=-
# Seul le compte d'exécution de la recette peut les lire
for s in cdj-recette-turso-token cdj-recette-admin-token cdj-recette-rate-salt; do
  gcloud secrets add-iam-policy-binding $s --member=serviceAccount:$RECETTE_SA --role=roles/secretmanager.secretAccessor
done
```

- **Tu dois voir** trois `Created secret [cdj-recette-…]` et trois `Updated IAM policy`. Secret Manager liste maintenant six secrets : `cdj-*` (production) et `cdj-recette-*` (recette).

## Étape 3 — Les droits de déploiement et la fédération d'identité (3 min, rien à créer)

Le compte `cdj-deploy` a déjà `roles/run.admin` et `roles/artifactregistry.writer` **sur le projet** : il peut créer le service `cdj-api-recette`, y poser des révisions étiquetées et les retirer, et pousser dans `cdj-recette`. La fédération accepte déjà **ce dépôt** : les workflows lancés par une PR d'une branche du dépôt (`pull_request`) sont reconnus comme le dépôt, une PR venue d'un fork n'a jamais de jeton (et le workflow ne lui en demande pas). Vérifie seulement :

```bash
gcloud iam workload-identity-pools providers describe github-repo --location=global --workload-identity-pool=github --format='value(attributeCondition)'
gcloud projects get-iam-policy $PROJECT_ID --flatten=bindings --filter="bindings.members:$DEPLOY_SA" --format='value(bindings.role)'
```

- **Tu dois voir** `assertion.repository=='Nathan-Te/DailyTrack'`, puis au moins `roles/artifactregistry.writer` et `roles/run.admin`. Sinon : bloc « Réparer les droits » de `docs/mise-en-ligne.md`.

> **Pour aller plus loin (facultatif)** : aujourd'hui une branche du dépôt pourrait, en modifiant un workflow, déployer en production avec `cdj-deploy`. Seuls toi et tes agents poussez sur le dépôt, donc c'est accepté ; pour le fermer, il faudrait un second compte de déploiement réservé à la recette (`roles/run.developer` sur le seul service de recette) et réserver `cdj-deploy` aux jobs de l'environnement `production` (condition `attribute.environment`). À demander dans un lot si besoin.

## Étape 4 — L'environnement GitHub `production`, avec toi comme relecteur (3 min)

GitHub → dépôt → **Settings** → **Environments**. L'environnement `production` peut déjà exister (créé tout seul par un premier déploiement) : ouvre-le, sinon **New environment** → `production` → **Configure environment**.
1. **Required reviewers** : coche, ajoute **Nathan-Te**. (Laisse « Prevent self-review » décoché : c'est toi qui fusionnes et toi qui valides.)
2. **Deployment branches and tags** : **Selected branches and tags** → **Add deployment branch or tag rule** → `main`.
3. **Save protection rules**.
- **Tu dois voir** « 1 reviewer » et « main » sur la carte de l'environnement. Le dépôt est **public** : la validation obligatoire est gratuite (sur un dépôt privé, elle demanderait GitHub Enterprise ; l'alternative serait de lancer la production à la main, `workflow_dispatch`).
- Les environnements `recette` et `apercu` apparaîtront tout seuls au premier déploiement : ils n'ont **aucune** règle, ne les protège pas.

## Étape 5 — Les variables GitHub de recette (3 min)

GitHub → **Settings** → **Secrets and variables** → **Actions** → onglet **Variables** → **New repository variable** :

| Nom | Valeur | Obligatoire |
|---|---|---|
| `RECETTE_TURSO_DATABASE_URL` | l'URL copiée à l'étape 1.2, telle quelle | oui |
| `RECETTE_API_URL` | *(étape 6 : l'adresse du service de recette, une fois créé)* | pour les aperçus |
| `RECETTE_GCP_SERVICE` | `cdj-api-recette` | non (défaut) |
| `RECETTE_GCP_AR_REPO` | `cdj-recette` | non (défaut) |
| `RECETTE_GCP_RUNTIME_SA` | `cdj-recette-runtime@dailytrack-511513.iam.gserviceaccount.com` | non (défaut) |
| `RECETTE_ALLOWED_ORIGINS` | autres origines du jeu, séparées par `;` (ex. `http://localhost:5173`) | non : `https://nathan-te.github.io` est ajoutée toute seule |

Aucun nouveau **secret** GitHub : la recette utilise les mêmes `GCP_WORKLOAD_IDENTITY_PROVIDER` et `GCP_SERVICE_ACCOUNT` que la production ; ses propres secrets sont dans Secret Manager (étape 2).
- **Tu dois voir** `RECETTE_TURSO_DATABASE_URL` à côté de `TURSO_DATABASE_URL`, avec deux valeurs **différentes**.

## Étape 6 — Créer le service de recette (5 min)

Onglet **Actions** du dépôt → dans la colonne de gauche, le workflow **Recette** (pas **CI** : la CI ne fait que les tests, elle ne déploie rien) → son run sur la PR du lot R1 (il a été « sauté », recette non configurée) → **Re-run all jobs**.
- **Tu dois voir**, au bout de 4 à 6 minutes, le job `deploy / deploy` vert, et dans le **résumé** : « API de recette déployée (révision b-…, sans trafic) », puis « Essai de bout en bout : réussi ». Comme le service n'existait pas, cette première révision reçoit aussi le trafic de recette (annonce « Service de recette créé »).
- Sur la PR, un commentaire **« Recette »** avec l'adresse de la révision (`https://b-…---cdj-api-recette-xxxxxxxxxx-ew.a.run.app`) et le lien de l'aperçu.

Récupère l'adresse **du service** (sans étiquette) :

```bash
gcloud run services describe cdj-api-recette --region=europe-west1 --format='value(status.url)'
```

- **Tu dois voir** `https://cdj-api-recette-xxxxxxxxxx-ew.a.run.app`. Ouvre `<adresse>/api/health` : `"ok":true,"db":"ok"`. Mets cette adresse (sans `/` final) dans la variable GitHub **`RECETTE_API_URL`** (étape 5). **Vérifie qu'elle n'est pas `VITE_API_URL`** (l'adresse de production : `cdj-api-5qi6aa4qqa…`) ; le workflow Pages refuse de publier un aperçu qui viserait la production.

## Étape 7 — Les joueurs fictifs de la recette (5 min)

Dans Cloud Shell (Node 20 ou plus suffit contre Turso) :

```bash
git clone --depth 1 https://github.com/Nathan-Te/DailyTrack.git && cd DailyTrack
npm ci -w @cdj/api --ignore-scripts
# L'adresse exacte de la base de recette : celle que le service de recette utilise déjà (étape 6)
RECETTE_DB="$(gcloud run services describe cdj-api-recette --region=europe-west1 --format=json \
  | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="TURSO_DATABASE_URL") | .value')"
echo "$RECETTE_DB"
ENVIRONMENT=recette \
TURSO_DATABASE_URL="$RECETTE_DB" \
TURSO_AUTH_TOKEN="$(gcloud secrets versions access latest --secret=cdj-recette-turso-token)" \
npm run recette:seed
```

- Le `echo` doit afficher une adresse `libsql://…recette….turso.io`. « la base de recette ne répond pas … HTTP status 404 » : l'adresse ne désigne aucune base (recopiée à la main ?) ; « … 401 » : le jeton n'est pas celui de cette base.

(Avant la fusion du lot R1, ajoute `--branch lot-R1-recette` — ou le nom de la branche de la PR — au `git clone`.)
- **Tu dois voir** une ligne par jour (`2026-10-…  : 11 pilote(s) classé(s)`, 7 jours jusqu'à aujourd'hui), puis « N temps envoyés par createApi (rejoués par le serveur) ». Relancer ne crée aucun doublon (mêmes pilotes « Démo … »).
- **Il refuse** sans `ENVIRONMENT=recette`, ou si l'adresse n'est pas celle d'une base « recette » : « recette:seed refusé : … ». C'est voulu : il ne touche jamais la base des joueurs.
- Options : `-- --days 14` (jusqu'à 30 jours), `-- --today 2026-10-20`.

## Étape 8 — Vérifier de bout en bout (10 min)

1. **Une PR d'essai** : dans l'interface GitHub, modifie un commentaire de `apps/api/src/log.ts` sur une nouvelle branche `essai-recette`, **Propose changes** → **Create pull request** (brouillon).
   - **Tu dois voir** le workflow **Recette** démarrer, puis le commentaire « Recette » avec l'adresse `https://b-essai-recette-…---cdj-api-recette-…` et le lien `https://nathan-te.github.io/DailyTrack/b/essai-recette/`. Le workflow **Pages** de la branche se relance tout seul pour viser cette révision (2 à 3 min).
2. **Ouvre l'aperçu** (lien du commentaire).
   - **Tu dois voir** le classement du jour avec les pilotes « Démo … » de l'étape 7. Joue un tour, choisis un pseudo : tu es classé **sur la recette**. Ton profil de l'aperçu est **neuf** (stockage `apercu:*`) : ton vrai profil n'est pas touché.
   - Sur le vrai jeu (`https://nathan-te.github.io/DailyTrack/`), rien n'a bougé : ni ton pseudo, ni ce tour, ni les « Démo » dans le classement.
3. **Ferme la PR d'essai** (sans fusionner).
   - **Tu dois voir** le job `cleanup` du workflow Recette : « Étiquette b-essai-recette-… retirée ».
4. **Fusionne la PR du lot R1** dans `main`. Onglet **Actions** → workflow **Production** :
   - `changes` → `recette / deploy` (la recette par défaut prend la version de main, essai de bout en bout compris) → puis **`api / deploy` et `pages / publish` en attente** (« Waiting for review: production needs approval »).
   - Clique **Review deployments** → coche **production** → **Approve and deploy**. **Un seul clic** libère les deux.
   - **Tu dois voir** les deux jobs verts, `<API de production>/api/health` avec la nouvelle révision, et le jeu publié.
5. Dorénavant : chaque fusion attend ce clic. Si deux fusions se suivent, la seconde attend la fin de la première ; une troisième remplace la seconde en attente (valide la plus récente, ou **Reject** l'ancienne pour passer à la suivante).

## Étape 9 — Les essais spéciaux sur la recette (quand tu en as besoin)

- **Tester minuit, ou le Salon vite** : Actions → **Recette** → **Run workflow** → choisis **la branche** → `TEST_CLOCK_OFFSET_MS` (millisecondes ajoutées à l'heure réelle ; calcule-le dans Cloud Shell au moment de lancer : `echo $(( ($(TZ=Europe/Paris date -d '23:55' +%s) - $(date +%s)) * 1000 ))` met l'horloge du serveur à 23 h 55 à Paris ; le temps du déploiement, ≈ 5 min, et il passera minuit sous tes yeux.) et/ou `SALON_MINUTES` (ex. `2`). La révision étiquetée de la branche est redéployée avec ces réglages (l'essai de bout en bout est sauté si `SALON_MINUTES` est réglée). La production les refuse toujours.
- **Remettre la révision de la branche à la normale** : relance le même workflow sans rien remplir, ou pousse un commit sur la PR.
- **Redéployer la production à la main** : Actions → **Production** → **Run workflow** (case « Redéployer aussi l'API ») ; validation demandée.

---

## Si ça ne marche pas

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| « recette non configurée : voir docs/plateforme/recette.md » | une variable manque | le message liste laquelle ; étape 5 |
| « Base de recette mal branchée » / « configuration refusée … ne contient pas « recette » » | `RECETTE_TURSO_DATABASE_URL` vise la base de production, ou une base mal nommée | étape 1 : la base doit s'appeler `…recette…` |
| `Permission denied on secret cdj-recette-…` | le compte `cdj-recette-runtime` ne lit pas ses secrets | refaire la boucle de l'étape 2 |
| `iam.serviceAccounts.actAs` refusé | `cdj-deploy` ne peut pas agir comme `cdj-recette-runtime` | refaire la dernière commande du premier bloc de l'étape 2 |
| L'aperçu dit « hors ligne, non classé » | `RECETTE_API_URL` absente, ou l'aperçu construit avant elle | étape 6 ; puis Actions → Pages → Run workflow sur la branche |
| « Aperçu branché sur la production » (Pages en rouge) | `RECETTE_API_URL` = l'adresse de production | mettre l'adresse de `cdj-api-recette` |
| Le commentaire « Recette » n'apparaît pas | PR venue d'un fork (jamais de recette), ou PR qui ne touche pas le serveur | normal : l'aperçu vise alors la recette par défaut |
| Production en attente depuis longtemps | elle attend ton clic | Actions → Production → Review deployments |

**Tout arrêter côté recette** : `gcloud run services delete cdj-api-recette --region=europe-west1` (les aperçus retombent en « hors ligne », la production n'est pas touchée) ; supprimer la variable `RECETTE_TURSO_DATABASE_URL` fait sauter toutes les étapes de recette.
