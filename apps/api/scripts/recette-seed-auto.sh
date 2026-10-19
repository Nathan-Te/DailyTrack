#!/usr/bin/env bash
# Lot P2 (plateforme) : `npm run recette:seed` **automatique**, lancé par `.github/workflows/recette-seed.yml` (chaque jour, et après chaque
# déploiement d'une révision de recette). Nathan n'a plus à le lancer à la main.
#
#   RECETTE_DB=libsql://…recette….turso.io GCP_PROJECT_ID=<projet> bash apps/api/scripts/recette-seed-auto.sh [jours]
#
# **Aucun secret GitHub de plus** : le jeton de la base de recette est lu dans Secret Manager (`cdj-recette-turso-token`) avec les accès que le
# workflow « Recette » a déjà (fédération d'identité, compte `cdj-deploy`), masqué dans les journaux, jamais écrit sur le disque. Il faut que ce
# compte puisse lire ce seul secret (une commande, une fois : voir docs/plateforme/lots/lot-P2-fantome-profil.md) ; sinon le script le dit et
# ne fait rien (sans échec : la recette elle-même marche).
#
# Gardes (en plus de celles de `recette:seed`, qui refuse tout sauf ENVIRONMENT=recette et une base dont le nom contient « recette ») : la base
# visée doit avoir « recette » dans son nom avant même de demander le jeton ; ENVIRONMENT est posé à `recette` ici, jamais autre chose.
set -euo pipefail

days="${1:-7}"
summary="${GITHUB_STEP_SUMMARY:-/dev/null}"
: "${RECETTE_DB:?RECETTE_DB (adresse de la base de recette) manquante}"
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID manquant}"

# Même règle des noms de base que apps/api/src/config.ts et deploy-api.yml : la base de recette a « recette » dans son nom, toujours.
dbname="$(printf '%s' "$RECETTE_DB" | sed -E 's#^[a-z]+://##; s#[/:?].*$##; s#\..*$##' | tr '[:upper:]' '[:lower:]')"
case "$dbname" in
  *recette*) ;;
  *) echo "::error title=recette:seed refusé::la base « $dbname » n'est pas une base de recette (son nom ne contient pas « recette »)"; exit 1 ;;
esac

if ! token="$(gcloud secrets versions access latest --secret=cdj-recette-turso-token --project="$GCP_PROJECT_ID" 2>/tmp/secret-err)"; then
  echo "::notice title=recette:seed automatique non autorisé::le compte de déploiement ne lit pas le secret cdj-recette-turso-token ($(head -c 160 /tmp/secret-err | tr '\n' ' ')). Une commande, une fois, dans Cloud Shell : gcloud secrets add-iam-policy-binding cdj-recette-turso-token --member=serviceAccount:cdj-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor"
  {
    echo "### Joueurs fictifs de la recette : non lancés"
    echo "Le compte de déploiement ne peut pas lire \`cdj-recette-turso-token\` (Secret Manager). Une commande, une fois (Cloud Shell) :"
    echo ""
    echo "\`gcloud secrets add-iam-policy-binding cdj-recette-turso-token --member=serviceAccount:cdj-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor\`"
  } >> "$summary"
  exit 0
fi
echo "::add-mask::$token"
[ -n "$token" ] || { echo "::error::secret cdj-recette-turso-token vide"; exit 1; }

[ -d node_modules ] || npm ci -w @cdj/api --ignore-scripts
started=$(date +%s)
ENVIRONMENT=recette TURSO_DATABASE_URL="$RECETTE_DB" TURSO_AUTH_TOKEN="$token" npm run --silent recette:seed -- --days "$days" | tee /tmp/recette-seed.txt
unset token
{
  echo "### Joueurs fictifs de la recette (\`recette:seed\`, $days jours, $(( $(date +%s) - started )) s)"
  echo '```'
  tail -n 12 /tmp/recette-seed.txt
  echo '```'
} >> "$summary"
