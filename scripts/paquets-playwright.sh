#!/usr/bin/env bash
# Lot R12 (plateforme) — les paquets système des navigateurs de Playwright, SANS apt quand c'est possible.
#   bash scripts/paquets-playwright.sh <chromium|firefox|webkit> <dossier du cache>
# `playwright install-deps` passe par apt, dont le miroir est parfois très lent (jusqu'à 10 min sur un runner sur cinq, lot R13). Le job restaure
# d'abord <dossier> (actions/cache, clé : navigateur + version de Playwright + image du runner) :
#   - cache présent (fichier `fait`) : `dpkg -i` des paquets gardés que le runner n'a pas déjà (jamais une rétrogradation), sans réseau ; même image du
#     runner, ou une précédente (`restore-keys`) tant que les dépendances s'accordent ;
#   - sinon (une fois par image du runner, ≈ chaque semaine) : `install-deps` comme avant, apt réglé pour GARDER les paquets téléchargés dans <dossier>,
#     que le job enregistre ensuite (actions/cache/save).
# Pourquoi pas l'image Docker officielle de Playwright : elle n'a pas DejaVu Sans, la « police large de la CI » dont les specs de mise en page ont
# besoin (accueil, mobile…), et elle change de version de Node (24) ; le cache garde exactement le runner d'avant (docs/plateforme/lots/lot-R12-un-seul-bouton.md).
set -euo pipefail
navigateur="$1"
dossier="$2"
debut=$(date +%s)
cd "$(dirname "$0")/../apps/web"

# Les paquets gardés que le runner n'a pas déjà (absents, ou dans une version plus ancienne) : jamais une rétrogradation.
manquants() {
  local f nom version installe
  for f in "$@"; do
    nom="$(dpkg-deb -f "$f" Package)"
    version="$(dpkg-deb -f "$f" Version)"
    installe="$(dpkg-query -W -f='${Status} ${Version}' "$nom" 2>/dev/null || true)"
    if [[ "$installe" == "install ok installed "* ]] && dpkg --compare-versions "${installe##* }" ge "$version"; then continue; fi
    echo "$f"
  done
}

if [ -f "$dossier/fait" ]; then
  shopt -s nullglob
  mapfile -t paquets < <(manquants "$dossier"/*.deb)
  # `dpkg -i`, sans réseau : même image du runner, ou une précédente (`restore-keys`) tant que les dépendances s'accordent ; sinon apt, comme avant.
  if [ "${#paquets[@]}" -eq 0 ] || sudo dpkg -i "${paquets[@]}" > "${RUNNER_TEMP:-/tmp}/paquets.log" 2>&1; then
    echo "paquets de $navigateur : ${#paquets[@]} installés depuis le cache, sans réseau ($(($(date +%s) - debut)) s)"
    exit 0
  fi
  echo "::warning title=Paquets de Playwright::le cache ne s'accorde pas avec ce runner ($navigateur) : installation par apt"
  tail -n 20 "${RUNNER_TEMP:-/tmp}/paquets.log" || true
  sudo apt-get update -qq && sudo apt-get -f install -y -qq || true
fi
sudo rm -rf "$dossier"

# Sans cache : apt, comme avant le lot R12. Une connexion muette échoue au bout de 30 s et se retente 3 fois (le 26/10, WebKit a attendu 29 min,
# run 40399054124) ; un miroir lent mais vivant n'est jamais interrompu (tuer apt garde le verrou dpkg). Les paquets téléchargés restent dans <dossier>.
mkdir -p "$dossier/partial"
printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nDir::Cache::Archives "%s/";\nAPT::Keep-Downloaded-Packages "true";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\n' "$dossier" | sudo tee /etc/apt/apt.conf.d/99ci > /dev/null
npx playwright install-deps "$navigateur"
sudo rm -rf "$dossier/partial" "$dossier/lock"
sudo chown -R "$(id -u):$(id -g)" "$dossier"
touch "$dossier/fait"
echo "paquets de $navigateur : $(find "$dossier" -name '*.deb' | wc -l) installés par apt et gardés pour le cache ($(($(date +%s) - debut)) s)"
