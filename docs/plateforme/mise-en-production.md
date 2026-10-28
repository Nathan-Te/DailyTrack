# Mettre en production — une page (lot R12)

**Appuie sur le bouton. Si le résumé dit ⛔, fais ce qu'il dit.**

> Un agent ne clique jamais (un agent de session ne peut pas lancer un workflow) : il prépare, tu cliques.

## Le bouton

**Actions › « Mettre en production » › Run workflow**, branche **`main`**, mode **`production`**, les autres champs vides. C'est tout : plus de CI à lancer avant, plus de sauvegarde sur ton ordinateur, plus de « Review deployments », plus de PR « Jours figés » à fusionner.

Le run enchaîne, seul (≈ 40 min, détail et durées : `docs/plateforme/lots/lot-R12-un-seul-bouton.md`) :

1. **la CI complète** du commit (tout : unitaires, Essentiel et Régression, Firefox et WebKit) — ou il **reprend** celle de la nuit ou d'un essai si elle est verte pour ce même commit ;
2. **le garde-fou des jours** : aucun jour protégé (d'avant le lancement, déjà figé, ou avec un résultat) ne change ;
3. **la répétition** sur la recette (la même construction, à l'heure réelle, `smoke` complet) ;
4. **la sauvegarde** de la base des joueurs dans un bucket privé (30 jours) ;
5. **le déploiement** du serveur et du site, la vérification en lecture seule, l'étiquette `prod-…` ;
6. **les jours figés versés dans `main`** par le workflow lui-même.

Tout arrêt avant l'étape 5 laisse la production intacte.

## Le résumé (en haut du run)

✅ ou ⛔, puis : la CI (« relancée » ou « reprise », son lien, sa durée), ce qui part (les PR), **le jour de bascule** (le premier jour de Paris qui commence après le déploiement : avant lui, rien ne change ; à partir de lui, les cartes du nouveau code), les jours conservés et régénérés de Track et de Jump, le fichier de sauvegarde, les liens du portail, de Track et de Jump. **En cas de ⛔, la première ligne « À faire » dit quoi faire**, par exemple :

| ⛔ à l'étape | la phrase dit |
|---|---|
| CI complète | « Lance le lot de mise en production avec ce run : <lien> » (un agent rend la CI verte, tu fusionnes, tu rappuies) |
| garde-fou des jours | ne rien corriger à la main ; demander un lot (ou relancer si playdujour.com ne répondait pas) |
| répétition | rien n'est parti ; lot de mise en production avec ce run |
| sauvegarde | faire l'annexe C (une fois), puis rappuyer |
| vérification après déploiement | « Retour arrière » (annexe B) |

**Après le ✅** (5 minutes) : ouvre le portail, Track et Jump (les liens du résumé), lance une course et un niveau ; puis dis aux joueurs ce qui change **à partir du jour de bascule** (cinq lignes, ton de la charte : « ce qui est joué ne bouge pas : tes temps, tes fantômes et tes archives restent comme ils étaient »).

**Pour essayer sans rien risquer** : le même bouton en mode **`essai`** fait tout contre la recette (sauvegarde de la recette comprise) et verse les jours figés dans `main` s'il est lancé sur `main`. Il peut tourner sur une autre branche (la branche `essai/ci-rouge` montre un arrêt sur une CI rouge).

---

## Annexe A — La répétition seule (heure simulée)

Mode **`repetition`** + **heure_simulee** (à Paris) : ni CI, ni sauvegarde, ni `main` ; garde-fou, recette et `smoke` complet, comme si tu cliquais à cette heure-là.

| à tester | heure simulée | jour de bascule attendu |
|---|---|---|
| un matin | `demain 10:00` | après-demain |
| un soir tard | `aujourdhui 23:30` | demain |
| la nuit d'un changement d'heure | `2027-03-28 03:30` (ou `01:30` ; `02:30` n'existe pas) | le lundi 29/03/2027 |

`reference` permet de traiter un commit comme « le code en production » (répéter une date lointaine).

## Annexe B — Le retour arrière

**Actions › « Retour arrière » › Run workflow** (branche `main`) ; « étiquette » vide = la mise en production d'avant la dernière. Il remet l'image du serveur et la version du site notées dans l'étiquette, vérifie en lecture seule et pose une nouvelle étiquette. **Il ne restaure pas la base** (migrations en avant seulement : l'ancien code tourne sur la base d'après — le garde-fou l'a vérifié). **Le jour même, avant minuit de Paris** : sans risque. **Après le début du jour de bascule** : il est refusé (`apres_le_jour_j` pour passer outre, seulement pour une panne grave) — corriger en avant vaut mieux.

## Annexe C — La sauvegarde : installation (une fois) et restauration

**Où** : `gs://dailytrack-511513-sauvegardes/production/AAAA-MM-JJ-HHMM-<base>-run<n>.sql.gz` (l'essai : `…/recette/…`), en Belgique, privé, **effacé au bout de 30 jours** (`config/sauvegarde-cycle.json`). **Qui le lit** : toi (propriétaire du projet) et le compte `cdj-sauvegarde`, que **seul le job `sauvegarde`** peut prendre ; ce compte ne lit qu'un **jeton Turso en lecture seule**. Jamais en artefact GitHub, jamais dans un journal.

**Installation** (Cloud Shell de `dailytrack-511513`, ≈ 10 min ; le jeton se colle sans être affiché) :

```bash
PROJECT_ID=dailytrack-511513
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
BUCKET=$PROJECT_ID-sauvegardes
SA=cdj-sauvegarde@$PROJECT_ID.iam.gserviceaccount.com
# 1. Le bucket privé, effacement au bout de 30 jours
gcloud storage buckets create gs://$BUCKET --project=$PROJECT_ID --location=europe-west1 --uniform-bucket-level-access --public-access-prevention
echo '{ "rule": [{ "action": { "type": "Delete" }, "condition": { "age": 30 } }] }' > /tmp/cycle.json
gcloud storage buckets update gs://$BUCKET --lifecycle-file=/tmp/cycle.json
# 2. Le compte de la sauvegarde : écrire et relire dans ce bucket, rien d'autre
gcloud iam service-accounts create cdj-sauvegarde --project=$PROJECT_ID --display-name="Du Jour : sauvegarde de la base (lecture seule)"
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member=serviceAccount:$SA --role=roles/storage.objectCreator
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member=serviceAccount:$SA --role=roles/storage.objectViewer
# 3. Les jetons Turso EN LECTURE SEULE (sur ton ordinateur : turso db tokens create dailytrack-misterzcool --read-only --expiration 365d,
#    puis de même pour la base de recette), collés ici sans être affichés
read -rs T && printf '%s' "$T" | gcloud secrets create cdj-turso-lecture --project=$PROJECT_ID --data-file=- && unset T
read -rs T && printf '%s' "$T" | gcloud secrets create cdj-recette-turso-lecture --project=$PROJECT_ID --data-file=- && unset T
for s in cdj-turso-lecture cdj-recette-turso-lecture; do gcloud secrets add-iam-policy-binding $s --project=$PROJECT_ID --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor; done
# 4. La fédération : seuls les jobs de l'environnement GitHub « sauvegarde » prennent ce compte
gcloud iam service-accounts add-iam-policy-binding $SA --project=$PROJECT_ID --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/subject/repo:Nathan-Te/DailyTrack:environment:sauvegarde"
gcloud iam workload-identity-pools providers describe github-repo --location=global --workload-identity-pool=github --format='value(attributeMapping)'
```

- **Vérifier (une minute, sans mise en production)** : Actions › **« Sauvegarde : diagnostic »** › Run workflow (sur `main`). Il montre le sujet que GitHub présente à Google, puis teste un par un : la fédération prend le compte, le compte lit le jeton, le compte voit le bucket ; **chaque refus donne la commande exacte à lancer ici**. Le bouton fait le même contrôle avant de sauvegarder.
- **Tu dois voir** `google.subject: assertion.sub` à la dernière commande (sinon la fédération ne reconnaît pas l'environnement : me le dire).
- **GitHub** : Settings › Environments › **New environment** `sauvegarde` › *Deployment branches and tags* : **Selected** › `main` ; et l'environnement **`production`** : décoche **Required reviewers**, garde la branche `main`.
- Le jeton expire dans un an : note la date ; le jour venu, le bouton s'arrête sur « Sauvegarde » et tu refais l'étape 3 (`gcloud secrets versions add` au lieu de `create`).
- Si tu changes un nom : variables du dépôt `SAUVEGARDE_BUCKET`, `GCP_SAUVEGARDE_SA`.

**Restaurer** (une base abîmée ; rare — le retour arrière, lui, ne touche pas la base) : le résumé du run donne la commande exacte. En général, sur ton ordinateur :

```bash
gcloud storage cp gs://dailytrack-511513-sauvegardes/production/<fichier>.sql.gz . && gunzip <fichier>.sql.gz
turso db create dailytrack-restauree --from-dump <fichier>.sql      # une base neuve : vérifie-la avant tout
```

Puis faire pointer le serveur dessus (variable `TURSO_DATABASE_URL` et secret `cdj-turso-token`, puis « Mettre en production ») — ou demander un lot. Le fichier contient des pseudos : il ne quitte ni le bucket ni ton ordinateur, et s'efface avec le reste au bout de 30 jours.
