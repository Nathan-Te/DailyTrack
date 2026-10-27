#!/usr/bin/env bash
# Lot R12 (plateforme) — les paquets système des navigateurs de Playwright, SANS apt quand c'est possible.
#   bash scripts/paquets-playwright.sh <chromium|firefox|webkit> <dossier du cache>
# `playwright install-deps` passe par apt, dont le miroir est parfois très lent (jusqu'à 10 min sur un runner sur cinq, lot R13). Le job restaure
# d'abord <dossier> (actions/cache, clé : image du runner + version de Playwright + navigateur) :
#   - cache présent (fichier `fait`) : `dpkg -i` des paquets gardés, sans réseau — mêmes paquets, même image du runner, donc même résultat ;
#   - sinon (une fois par image du runner, ≈ chaque semaine) : `install-deps` comme avant, apt réglé pour GARDER les paquets téléchargés dans <dossier>,
#     que le job enregistre ensuite (actions/cache/save).
# Pourquoi pas l'image Docker officielle de Playwright : elle n'a pas DejaVu Sans, la « police large de la CI » dont les specs de mise en page ont
# besoin (accueil, mobile…), et elle change de version de Node (24) ; le cache garde exactement le runner d'avant (docs/plateforme/lots/lot-R12-un-seul-bouton.md).
set -euo pipefail
navigateur="$1"
dossier="$2"
debut=$(date +%s)
cd "$(dirname "$0")/../apps/web"

if [ -f "$dossier/fait" ]; then
  shopt -s nullglob
  paquets=("$dossier"/*.deb)
  if [ "${#paquets[@]}" -eq 0 ] || sudo dpkg -i --skip-same-version "${paquets[@]}" > "${RUNNER_TEMP:-/tmp}/dpkg.log" 2>&1; then
    echo "paquets de $navigateur : ${#paquets[@]} depuis le cache, sans apt ($(($(date +%s) - debut)) s)"
    exit 0
  fi
  echo "::warning title=Paquets de Playwright::dpkg a refusé le cache ($navigateur) : installation par apt"
  tail -n 20 "${RUNNER_TEMP:-/tmp}/dpkg.log" || true
  sudo apt-get -f install -y > /dev/null 2>&1 || true
fi

# Sans cache : apt, comme avant le lot R12. Une connexion muette échoue au bout de 30 s et se retente 3 fois (le 26/10, WebKit a attendu 29 min,
# run 40399054124) ; un miroir lent mais vivant n'est jamais interrompu (tuer apt garde le verrou dpkg). Les paquets téléchargés restent dans <dossier>.
mkdir -p "$dossier/partial"
printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nDir::Cache::Archives "%s/";\nAPT::Keep-Downloaded-Packages "true";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\n' "$dossier" | sudo tee /etc/apt/apt.conf.d/99ci > /dev/null
npx playwright install-deps "$navigateur"
sudo rm -rf "$dossier/partial" "$dossier/lock"
sudo chown -R "$(id -u):$(id -g)" "$dossier"
touch "$dossier/fait"
echo "paquets de $navigateur : $(find "$dossier" -name '*.deb' | wc -l) installés par apt et gardés pour le cache ($(($(date +%s) - debut)) s)"
