# Lot R12 (plateforme) — Mettre en production : un clic, une CI

Branche `claude/production-one-click-lu174w`, PR en brouillon. **Décision de Nathan : un seul bouton**, « Mettre en production » ; il lance **une** CI complète, puis met à jour la production ; tout le reste est fait par le workflow, ou l'arrête avec une phrase claire. Golden, jeux, serveur (routes) inchangés ; aucune dépendance npm ajoutée ; `node scripts/securite-workflows.mjs` : 0 écart.

## 1. Le déroulé du bouton (`.github/workflows/production.yml`)
| # | job | ce qu'il fait | durée (estimée, à confirmer au premier run) |
|---|---|---|---|
| 0 | `verifier` | sur `main` (sauf `essai`), lancé par le propriétaire du dépôt ; commit, jour de bascule, ce qui part ; **une CI complète verte de ce commit existe-t-elle ?** | ≈ 1 min |
| 1 | `ci` | **ci.yml appelé** (`workflow_call`, mode `complet`, `ref` = le commit déployé) — sauté si reprise | ≈ 12,5 min (mesuré, § 3) ; 0 si reprise |
| 2 | `ci-verdict` | `scripts/ci-complete.mjs verdict` : un run `complet` vert de ce commit, sinon ⛔ | < 1 min |
| 3 | `figer` | garde-fou des jours (R6, R11), inchangé | ≈ 6 à 10 min (comme avant) |
| 4 | `recette-serveur`, `recette-site`, `recette-verification` | **répétition** à l'heure réelle : la même construction (jours figés, registre) sur la recette, `smoke --lecture-seule` puis `smoke` complet | ≈ 8 min |
| 5 | `sauvegarde` | base lue en lecture seule, restaurée à blanc et recomptée, déposée dans le bucket privé | ≈ 1 min |
| 7 | `serveur`, `site`, `verification`, `etiquette` | comme avant, **sans « Review deployments »** | ≈ 8 min |
| 8 | `depot` | jours figés **versés dans `main`** par le workflow (§ 5) | ≈ 6 à 15 min (la CI d'une PR) |
| 9 | `resume` | en haut du run : ✅ / ⛔, **une phrase** à suivre, CI relancée ou reprise (lien, durée), PR qui partent, jour de bascule, jours par jeu, sauvegarde, liens ; chaque étape et sa durée (`scripts/resume-bouton.mjs`, testé : `apps/portail/test/bouton.test.ts`) | < 1 min |

Un arrêt survient toujours **avant** de toucher la production, sauf à l'étape 7 (déploiement, qui a son retour arrière). Le jour de bascule est re-vérifié juste avant de déployer (`bascule-valide`, `proteges-verifier`), le run ayant pu durer. **Modes** : `production` ; **`essai`** (tout contre la recette : CI, garde-fou, répétition, sauvegarde **de la recette**, jours figés versés dans `main` s'il tourne sur `main` ; sur une autre branche, ni sauvegarde ni `main`) ; `repetition` (R6 : la répétition seule, heure simulée, ni CI ni sauvegarde).

## 2. La CI appelée ou reprise
- **Appelée** : `ci.yml` gagne `workflow_call` (entrées `mode`, `ref` ; sortie `echecs`, les tests e2e rouges) ; toutes ses `actions/checkout` prennent `ref: ${{ inputs.ref }}` (vide hors appel : rien ne change). **Sans aucun accès** : le job `ci` de `production.yml` n'a que `contents: read`, ni `secrets:`, ni environnement, ni `id-token` (testé : `apps/web/test/ciComplete.test.ts`) ; seuls les jobs qui suivent y ont accès. Son groupe de concurrence est à part (`github.workflow`) : une poussée ne l'annule jamais.
- **Règle de reprise** (`ci-complete.mjs reprise`) : un run de **ce commit exact**, le plus récent d'abord, parmi les runs de `ci.yml` **`schedule` ou `workflow_dispatch` finis en vert** et les runs de `production.yml` (leurs jobs « ci / … ») ; il compte s'il a **une matrice `e2e-parts`** (signe du mode complet : la CI d'une PR a `e2e-pr`), `test` et `e2e` verts et aucun job en échec. Un run `push` de `main` (mode `main`, l'Essentiel seulement, lot R13) ne compte **jamais** : **`ci-complete.mjs` exige un run `complet` vert** (point 2 du lot).
- **Rouge** : arrêt avant la répétition et la sauvegarde ; le résumé liste les jobs et les tests e2e rouges et dit : **« Lance le lot de mise en production avec ce run : <lien> »**.
- `ci.yml` « Run workflow » propose `complet` (défaut) ou `pr` (comme une PR, par rapport à `main` : sert au commit des jours figés).

## 3. Plus court : cache des paquets plutôt qu'image Docker
**Choix : un cache des paquets système** (`scripts/paquets-playwright.sh`, jobs `e2e-parts` et `e2e-pr`). Clé : navigateur, version de Playwright, image du runner (`ImageOS`, `ImageVersion` ; `restore-keys` sur l'image : plusieurs images tournent en même temps). Présent : `dpkg -i` des seuls paquets que le runner n'a pas déjà (absents ou plus anciens : **jamais une rétrogradation**), **sans apt ni réseau** ; absent, ou qui ne s'accorde pas : `install-deps` comme avant, apt réglé pour garder les paquets téléchargés, que le job enregistre (`actions/cache/restore` et `save`, même empreinte que `actions/cache`).
**Pourquoi pas l'image officielle** (`mcr.microsoft.com/playwright:v1.63.0-noble`, lue dans son Dockerfile) : elle n'installe pas **DejaVu Sans**, la « police large de la CI » que les specs de mise en page imposent (`accueil`, `mobile`, `hud-compact`, `scene`… : sans elle, ils retombent sur une police plus étroite et ne prouvent plus l'absence de débordement — un test affaibli) ; elle passe Node à **24** (le dépôt : 22) ; et elle se tire à chaque job (≈ 2 Go). Le cache garde **exactement** le runner d'avant.
**Matrice** : `complet` et `nuit` repassent à **8 parts** de Track (6 au lot R13) : ≈ 560 s de specs par part au lieu de ≈ 745 s (`durees.json`), pour tenir ≤ 15 min de mur.

Mesuré sur la PR (le mode `complet` forcé le temps de trois runs, variable `MESURE_R12` de `scope`, **retirée** au dernier commit ; `npm run mesure-ci -- --run <id>` et la durée de chaque étape) :

| run `complet` | cache des paquets | « Paquets système » par job | mur | minutes de jobs |
|---|---|---|---|---|
| avant, lot R13 ([40493310181](https://github.com/Nathan-Te/DailyTrack/actions/runs/40493310181)), 6 parts | — (apt) | 13 s d'ordinaire ; **586 et 614 s** sur deux parts | 24,8 min | 137 |
| [40512741627](https://github.com/Nathan-Te/DailyTrack/actions/runs/40512741627), 8 parts | vide : apt partout | 11 à 46 s ; **789, 338 s**, et Firefox **coupé à 15 min** (miroir à 25 ko/s) | 20,1 min (rouge : Firefox) | 151 |
| [40516087502](https://github.com/Nathan-Te/DailyTrack/actions/runs/40516087502) | trouvé, mais `apt-get --no-download` le refusait (corrigé : `dpkg -i`) | 13 à 35 s ; **217 et 816 s** | 15,3 min | 137 |
| **[40518895226](https://github.com/Nathan-Te/DailyTrack/actions/runs/40518895226)** | **présent** | **3 à 15 s, sans réseau** (Chromium 17 paquets, Firefox 40, WebKit 187) | **12,5 min ✅** | **118** |

Les deux premiers runs montrent le « avant » réel : 3 runners sur 11, puis 2 sur 11, ont eu le miroir lent. Avec le cache, plus aucun job n'attend apt ; la part la plus longue (Chromium 5/8, 711 s) fixe le mur. Le cache absent (une nouvelle version de Playwright, ou une image du runner dont les dépendances ne s'accordent plus) repasse une fois par apt, comme avant.

## 4. La sauvegarde (job `sauvegarde`)
- **Où** : `gs://dailytrack-511513-sauvegardes/production/AAAA-MM-JJ-HHMM-<base>-run<n>.sql.gz` (essai : `…/recette/…`), `europe-west1`, accès uniforme, accès public interdit, **effacement au bout de 30 jours** (`config/sauvegarde-cycle.json` = `SAUVEGARDE_JOURS`, testé ; dit dans les deux pages des mentions légales et `docs/plateforme/effacement.md`).
- **Quoi** : `npm run base:sauvegarde -w @cdj/api` (`apps/api/src/sauvegarde.ts`, pur) : la liste des tables, puis **un seul lot `read`** de libSQL (une transaction de lecture : instantané cohérent) ; texte SQL au format `sqlite3 .dump` (tables, lignes, compteur d'AUTOINCREMENT, index), **restauré dans SQLite et recompté avant d'être gardé** ; compressé. Test : `apps/api/test/sauvegarde.test.ts` (vrai schéma, apostrophes, octets, réels, base vide ; rien que des `SELECT`). Résumé : noms de tables, nombres de lignes, taille, empreinte — jamais un pseudo. **Jamais en artefact GitHub ni dans un journal.**
- **Droits, au plus étroit** : le compte `cdj-deploy` **n'obtient rien**. Un compte dédié, **`cdj-sauvegarde`**, lit **deux secrets seulement** (`cdj-turso-lecture`, `cdj-recette-turso-lecture`) qui sont des **jetons Turso en lecture seule** (`turso db tokens create … --read-only`), et écrit / relit **ce seul bucket** (`objectCreator` + `objectViewer`, au niveau du bucket). La fédération Google ne le donne qu'aux jobs de l'**environnement GitHub `sauvegarde`** (limité à `main`) : `principal://…/subject/repo:Nathan-Te/DailyTrack:environment:sauvegarde`. Même un workflow modifié sur une branche ne peut donc ni le prendre, ni écrire dans la base avec lui. Lecteurs du bucket : Nathan (propriétaire du projet) et `cdj-sauvegarde`.
- **Restaurer** : la commande exacte est dans le résumé (`gcloud storage cp … && gunzip … && turso db create <nouvelle base> --from-dump …`) ; annexe C de `docs/plateforme/mise-en-production.md`.
- Non configurée : ⛔ « faire l'annexe C (une fois), puis rappuyer » — rien n'est parti.

## 5. Jours figés sans PR à fusionner
Le job `depot` (production, ou essai lancé sur `main`) pousse la branche `robot/jours-figes-<étiquette>`, ouvre la PR, obtient sa CI (`pull_request` avec `ROBOT_TOKEN` ; sinon `ci.yml` lancé en mode `pr`, GitHub ne lançant aucun workflow pour un commit du jeton du workflow), attend `test` et `e2e` (`ci-complete.mjs statuts`), puis **fusionne lui-même** (`gh pr merge --merge --match-head-commit`). Si `main` a avancé (« à jour avant de fusionner »), la branche reprend `main` (`update-branch`) et la CI recommence (trois essais). Aucune mise en production n'exige plus le run `push` de `main` : une fusion faite par le jeton du workflow (qui ne lance pas ce run, ni la recette) ne bloque plus rien. Message des commits inchangé (« Jours figés de la mise en production … » : `jours-servis` le lit).
**Réglage minimal si la protection de `main` l'empêche** (le résumé le dit, ⛔ à l'étape 8, avec le lien de la PR) : (a) sans `ROBOT_TOKEN`, cocher Settings › Actions › General › *Allow GitHub Actions to create and approve pull requests* (le workflow ouvre la PR) ; (b) si `main` exige une **approbation**, ne pas l'exiger (les statuts requis `test` et `e2e` restent) — ou garder `ROBOT_TOKEN` et laisser le workflow programmer la fusion automatique (« Allow auto-merge »). Je n'ai pas pu lire la protection réelle de `main` (aucun accès aux réglages).

## 6. Le compromis sur la validation
Plus de « Review deployments » : **lancer le bouton sur `main` vaut validation** (réservé à qui peut écrire dans le dépôt, et `verifier` n'accepte que le propriétaire du dépôt — variable `MISE_EN_PRODUCTION_PAR` pour en nommer d'autres). L'environnement `production` reste **limité à `main`** (S-07). Ce qu'on perd : un second regard entre la CI et le déploiement, et le dernier « non » possible une fois lancé (il reste « Cancel workflow » jusqu'à l'étape 7). Ce qu'on gagne : le garde-fou n'est plus contourné par l'attente (un clic de validation tardif faisait refuser le jour de bascule), la répétition et la sauvegarde ne sont plus oubliables. Le même environnement sert à « Retour arrière » et à « Lancement : remise à zéro » : leur validation disparaît aussi (la remise à zéro garde ses deux confirmations saisies et son garde-fou de date).

## 7. Étapes manuelles de Nathan (un agent ne crée ni ressource ni secret)
1. **Annexe C de `docs/plateforme/mise-en-production.md`** (≈ 10 min, Cloud Shell) : bucket, cycle de 30 jours, compte `cdj-sauvegarde`, deux jetons Turso en lecture seule dans Secret Manager, liaison de fédération à l'environnement `sauvegarde`.
2. **GitHub › Environments** : créer `sauvegarde` (branche `main`) ; dans `production`, décocher *Required reviewers* (garder `main`).
3. Si un jeton Turso Read & Write de production a été donné à `cdj-deploy` pour la remise à zéro du lancement (R8, `docs/plateforme/lancement.md`), le retirer s'il ne sert plus : `gcloud secrets remove-iam-policy-binding cdj-turso-token --member=serviceAccount:cdj-deploy@dailytrack-511513.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor`.
4. Le réglage du § 5 si le premier essai le demande.
5. **Après la fusion** : le scénario de test (deux clics) ci-dessous.

## 8. Scénario de test pour Nathan (après la fusion)
1. Actions › Mettre en production › mode `essai`, branche `main` › Run. Attendu : ✅, « CI complète : relancée par le bouton » (ou « reprise »), une sauvegarde de la recette dans `gs://dailytrack-511513-sauvegardes/recette/`, les jours figés dans `main` sans PR à fusionner (ou « déjà dans main »).
2. Même bouton, mode `essai`, branche **`essai/ci-rouge`** (poussée par ce lot : ce lot + un seul test unitaire volontairement rouge, `apps/web/test/essaiCiRouge.test.ts` ; ni PR ni fusion). Attendu : ⛔ **avant** toute répétition ou sauvegarde, « À faire : Lance le lot de mise en production avec ce run : <lien> ».

## 9. Vérifié / non vérifié
**Vérifié** : _à compléter (runs)_.
**Non vérifié** : un vrai run du bouton (un agent ne lance pas de workflow) — mode `essai` à lancer par Nathan après la fusion ; la sauvegarde contre Turso (testée contre libSQL local, le même client) ; la fédération de `cdj-sauvegarde` et la protection réelle de `main`.
