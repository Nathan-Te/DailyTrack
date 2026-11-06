# Mettre en production — une page (lot R12)

**Appuie sur le bouton. Si le résumé dit ⛔, fais ce qu'il dit.**

> Un agent ne clique jamais (un agent de session ne peut pas lancer un workflow) : il prépare, tu cliques.

## Le bouton

**Actions › « Mettre en production » › Run workflow**, branche **`main`**, mode **`production`**, les autres champs vides. C'est tout : plus de CI à lancer avant, plus de sauvegarde sur ton ordinateur, plus de « Review deployments », plus de PR « Jours figés » à fusionner.

Le run enchaîne, seul (≈ 25 min visées depuis le lot R16, contre ≈ 34 min avant ; détail : `docs/plateforme/lots/lot-R16-mise-en-production-courte.md`) :

1. **la CI complète** du commit (tout : unitaires, Essentiel et Régression, Firefox et WebKit) — ou il **reprend** celle de la nuit ou d'un essai si elle est verte pour ce même commit ;
2. **en même temps** : **le garde-fou des jours** (aucun jour protégé — d'avant le lancement, déjà figé, ou avec un résultat — ne change ; il ne fait que lire la production) puis **la répétition** sur la recette (la même construction, à l'heure réelle, `smoke` complet) ;
3. **la sauvegarde** de la base des joueurs dans un bucket privé (30 jours), dès que la CI est verte ;
4. **le déploiement** du serveur et du site — **seulement si la CI, le garde-fou, la répétition et la sauvegarde ont tous réussi** —, la vérification en lecture seule, l'étiquette `prod-…` ;
5. **les jours figés versés dans `main`** : le bouton lance le workflow **« Jours figés dans main »** et s'arrête ; ce workflow fait la PR, attend sa CI et la fusionne (≈ 7 min, son propre run). **Tant qu'il tourne, le bouton refuse de repartir** (« attendre sa fin ») : rien à faire, il suffit d'attendre.

Tout arrêt avant l'étape 4 laisse la production intacte (la recette, elle, a pu recevoir la construction : elle reçoit déjà chaque fusion dans `main`).

## Le résumé (en haut du run)

✅ ou ⛔, puis : la CI (« relancée » ou « reprise », son lien, sa durée), ce qui part (les PR), **le jour de bascule** (le premier jour de Paris qui commence après la fin prévue du déploiement, clic + 2 h : avant lui, rien ne change ; à partir de lui, les cartes du nouveau code ; un clic après 22 h met donc la bascule au surlendemain), les jours conservés et régénérés de Track et de Jump, le fichier de sauvegarde, les liens du portail, de Track et de Jump. **En cas de ⛔, la première ligne « À faire » dit quoi faire**, par exemple :

| ⛔ à l'étape | la phrase dit |
|---|---|
| CI complète | « Lance le lot de mise en production avec ce run : <lien> » (un agent rend la CI verte, tu fusionnes, tu rappuies) |
| garde-fou des jours | ne rien corriger à la main ; demander un lot (ou relancer si playdujour.com ne répondait pas) |
| répétition | rien n'est parti ; lot de mise en production avec ce run |
| sauvegarde | faire l'annexe C (une fois), puis rappuyer |
| vérification après déploiement | « Retour arrière » (annexe B) |
| versement des jours figés (lot R16) | la production est en ligne ; relancer « Jours figés dans main » à la main (Run workflow, branche `main`) avec le numéro du run, son étiquette et la veille du jour de bascule |

### Les jours de Tower (lot TP)

Les médailles de Tower viennent d'un bot (≈ 45 s par jour) : **un jour de Tower doit être préparé avant d'être servi**. Le bouton le fait pour toi, dans l'étape « garde-fou des jours » (job `figer`, avec le code **déployé**, jamais celui de la production). Règle des jours (R11) :

- **Un jour protégé ne change jamais** : d'avant le lancement, déjà figé, ou avec au moins un résultat (Tower, Track ou Jump). Son fichier, s'il existe, reste tel quel ; sans fichier on ne lui en crée pas.
- **Un jour sans résultat** est **préparé** s'il n'a pas de fichier, **refait** si son fichier est d'une autre version (simulation ou générateur) que le code déployé, **gardé** sinon.
- **La fenêtre** va de la veille de la bascule à **J+14** (16 jours) : **une mise en production au moins tous les quinze jours suffit**. Au-delà, un jour n'a plus de fichier préparé et Tower le sert avec l'estimation géométrique de ses médailles (« provisoire »). Le résumé du run le dit : une ligne **Jours de Tower** en haut (« 3 conservés, 14 préparés, 0 refaits, couvert jusqu'au 2026-11-24 ») et, dans le job `figer`, le détail, **les jours couverts**, le **temps de la préparation mesuré sur le runner** et la **date de la prochaine mise en production au plus tard**.
- Les fichiers (preuve comprise) vont dans l'image du serveur, qui la rejoue ; le site publié **la perd** (vérifié par `scripts/site.mjs` : aucune `preuve` dans un fichier publié) ; ils sont versés dans `main` par la PR « Jours figés ». La répétition sur la recette (mode `essai` ou `repetition`) montre les mêmes lignes.
- Tower reste **`off`** tant que tu ne l'as pas passé en aperçu ou en `on` dans `/admin/` › Jeux : préparer ses jours ne l'ouvre pas.

**Après le ✅** (5 minutes) : ouvre le portail, Track et Jump (les liens du résumé), lance une course et un niveau ; puis dis aux joueurs ce qui change **à partir du jour de bascule** (cinq lignes, ton de la charte : « ce qui est joué ne bouge pas : tes temps, tes fantômes et tes archives restent comme ils étaient »).

**Pour essayer sans rien risquer** : le même bouton en mode **`essai`** fait tout contre la recette (sauvegarde de la recette comprise) et verse les jours figés dans `main` s'il est lancé sur `main`. Il peut tourner sur une autre branche (la branche `essai/ci-rouge` montre un arrêt sur une CI rouge).

---

## Annexe A — La répétition seule (heure simulée)

Mode **`repetition`** + **heure_simulee** (à Paris) : ni CI, ni sauvegarde, ni `main` ; garde-fou, recette et `smoke` complet, comme si tu cliquais à cette heure-là.

| à tester | heure simulée | jour de bascule attendu |
|---|---|---|
| un matin | `demain 10:00` | après-demain |
| un soir avant 22 h | `aujourdhui 21:30` | demain |
| un soir tard (minuit passerait pendant le déploiement : marge de 2 h) | `aujourdhui 23:30` | après-demain |
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
  --member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/subject/repo:Nathan-Te@61011485/DailyTrack@1407318739:environment:sauvegarde"
gcloud iam workload-identity-pools providers describe github-repo --location=global --workload-identity-pool=github --format='value(attributeMapping)'
```

- **Le sujet que GitHub présente porte les numéros du propriétaire et du dépôt** (`repo:Nathan-Te@61011485/DailyTrack@1407318739:environment:sauvegarde`, lu par le diagnostic le 28/10/2026) : la forme sans numéros (`repo:Nathan-Te/DailyTrack:…`) ne correspond pas et la fédération refuse (« PERMISSION_DENIED »). Si le dépôt change de nom ou de propriétaire, le diagnostic donne le nouveau sujet et la commande.
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

---

## Annexe E — Essayer un lot qui touche la chaîne de production (lot K4b)

La chaîne (`production.yml`, `jours-figes.yml`, `deploy-api.yml`, `deploy-site.yml`, `scripts/mise-en-production.mjs`) **lit les fiches des jeux** (`jours.fabrication`) : un jeu neuf n'y ajoute aucune ligne. Un lot qui la modifie **ne se fusionne qu'après deux essais de ta part, sur la branche du lot** (un agent ne lance jamais de workflow) :

1. Actions › **Mettre en production** › *Use workflow from* : **la branche du lot** › mode **`essai`** › Run. Contre la recette seulement. Le résumé doit être ✅ ; pour chaque jeu, la ligne « Jours » montre les jours conservés sans différence ; l'artefact **`jours`** (un dossier par jeu + `proteges.json`) est là, avec `empreintes-jours`.
2. Même bouton, mode **`repetition`**, heure simulée « demain 10:00 », **sur la même branche** (lot K4b : la répétition peut tourner sur une branche, comme l'essai, et prend alors le commit de la branche ; seule la production est réservée à `main`) : ✅, avec le jour de bascule.

Seulement ensuite, fusionner. Les commandes que le workflow lance (toutes lisent les fiches ; `node scripts/mise-en-production.mjs <commande>`) :

| commande | ce qu'elle fait |
|---|---|
| `jeux [--mode registre\|fichier-par-jour]` | les jeux de la chaîne, dans l'ordre des fiches |
| `figer-jeux --prod … --cible … --proteges … --veille … --bascule … --instant … --reference … --sortie <dossier>` | pour chaque jeu, avec le code en production : registre, jours figés (Jump, lot 33 : **tout jour non figé jusqu'à demain**, comparé à ce que le code en production sert sans fichier, refus s'il en reste un sans fichier ou si la bascule du générateur est fixée à aujourd'hui ou avant) ou jours protégés sans fichier ; superpose à la cible ; écrit l'artefact `jours` |
| `servi-verifier --sortie <artefact jours> --origine <url>` | (lot 33, production) compare, en lecture seule, les jours figés à nouveau au niveau que le serveur de production sert en ce moment |
| `empreintes <dépôt> --du … --au … --sortie <fichier>` | les empreintes des jours de chaque jeu (une clé par jeu) ; un jeu absent du code n'a rien à conserver |
| `preparer-jeux --cible … --proteges … --veille … --bascule … --sortie <dossier>` | les jours que préparent certains jeux (`preparer` de la fiche), avec le code déployé ; sortie `preparation` |
| `poser-jours <dossier de l'artefact>` | pose, dans le dépôt courant, le registre et les jours de chaque jeu (serveur, site, `main`) |
| `jours-servis <réf> <cible> --jeu <id>`, `registre --jeu <id> <dépôt> …`, `registres`, `chemins-du-versement`, `apres-pose` | les pièces de ce qui précède |

Les artefacts de l'ancienne chaîne (`jours-figes`, `registre-track`, `jours-tower`) n'existent plus : tout est dans `jours`.
