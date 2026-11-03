# Lot K4 — un nouveau jeu en une commande et le jeu témoin « Cibles » : **arrêt propre après une partie 1 incomplète**

*3 novembre 2026. Conception : `docs/plateforme/kit-de-jeu.md`. Pour les joueurs : rien.*

**Résultat.** Seule une **partie de la partie 1** est faite (les scripts de CI, le site et les fonctions pures de « Mettre en production » lisent les fiches). **Les parties 2 et 3 ne sont pas commencées** : ni `npm run nouveau-jeu`, ni « Cibles », ni le job « Kit de bout en bout », ni la table `resultats_jeu`, ni l'enveloppe de rediffusion commune. Aucun jeu neuf n'est donc « figé, déployé et testé sans retouche » : **le but du lot n'est pas atteint**. Choix d'arrêt : la chaîne de production (`production.yml` et consorts) ne s'exécute que par le bouton de Nathan ; la réécrire sans pouvoir la faire tourner aurait mis la production en jeu. Elle mérite son propre lot, essayé en mode `essai` / `repetition`.

## Ce qui est fait (partie 1, en partie)
| Quoi | Comment |
|---|---|
| Suites e2e lues dans les fiches | `scripts/fiches-lecture.mjs` : `SUITES`, `projetDe`, `suiteDuProjet`, `FICHES_SERVEUR`, `NOMS_DES_JEUX`, `VERSIONS_DES_JEUX`. **Deux champs facultatifs** de fiche : `e2e.projet` (préfixe du projet Playwright ; vide pour Track) et `e2e.dette` (document de la dette de quarantaine ; défaut `docs/<id>/consignes.md`) — `packages/core/src/fiche.ts`, `track.json`, `jump.json`, projection `ci.json` régénérée. |
| `e2e-parts`, `e2e-quarantaine`, `e2e-summary`, `mesure-ci`, `inventaire-tests`, `verifier` | plus de `jump` / `tower` écrit : tout vient de `SUITES`. |
| **`scripts/e2e-suite.mjs`** (neuf) | construction, part de la CI complète, petit ensemble `@navigateurs`, part de PR, rassemblement des rapports « blob », matrice de `stabilite.yml`. Essayé pour de vrai : `construire-pr` puis `pr` sur Tower (10 tests verts, rapport rassemblé). |
| `ci.yml` | les étapes par jeu de `e2e-parts` et `e2e-pr` (construction, étape de part, petit ensemble, dépôt du rapport, traces) sont remplacées par 5 appels au script ; sorties de `scope` `track` / `jump` / `tower` retirées (jamais lues). |
| `stabilite.yml` | projet, dossier et construction viennent de la fiche. |
| `recette.mjs` / `recette.yml` | `SERVER_PATHS` : `packages/*-sim/**`, `apps/*/public/jours/**`, `apps/*/public/levels/**` à la place des chemins de Jump et de Tower. |
| `site.mjs` | polices partagées, démos, outils (`admin.outils` de la fiche), vérification des jours figés et de la preuve : pour chaque jeu à dossier de jours, plus seulement Jump. |
| `mise-en-production.mjs` | noms de jeux, liste des jeux de la fusion d'empreintes, versions à comparer (« Ce qui part ») et zone d'une PR lus dans les fiches (Tower a maintenant sa zone et ses versions dans l'inventaire). |

## Preuve avant / après (instantané pris sur `67f63da`, comparé à l'arbre de travail)
- **Portée (`ci-scope`), zones d'une PR (`zones-jeu`), règles, catégories** : identiques (13 listes de fichiers + CI complète).
- **`ci-zones` (`decider` en modes pr, main, complet, nuit × 13 listes)** : sorties et résumés **identiques**, matrices `e2e_pr_matrice` et `e2e_complet_matrice` comprises ; la seule différence est la **sélection des tests unitaires**, qui suit le graphe des imports (les scripts importent maintenant `fiches-lecture`).
- **Parts, durées, régression, quarantaine, `mesure-ci`** : identiques. **`verifier`** : mêmes étapes, seuls les libellés changent (« e2e DailyTrack » → « e2e Track », « DailyJump » → « Jump »).
- **Site assemblé** (`site.mjs site`, construction de développement **et** de production) : liste des fichiers et empreintes de tous les fichiers hors images **identiques** (686 et 511 fichiers). Les PNG des aperçus ne sont pas comparés (dessinés par Chromium).
- **Jobs de `ci.yml`** : mêmes identifiants (`unit test zones scope budgets e2e-parts e2e-pr e2e api-image`). Les noms affichés des jobs `e2e-parts` gagnent le nom de la suite (« e2e-parts (web chromium 1/3) ») ; les statuts requis `test` et `e2e` sont inchangés. Les artefacts de rapport deviennent un seul `blob-<suite>-<navigateur>-<part>` (le petit ensemble n'en a plus trois).
- **Résumé de « Mettre en production »** : « Track », « Jump » à la place de « DailyTrack », « DailyJump » (tests mis à jour).
- `node scripts/securite-workflows.mjs` : 12 workflows, 0 écart. `tsc -b` vert ; `npm run verifier -- --sans-e2e` vert (41 s). Nouveau test `apps/web/test/e2eSuite.test.ts`.

## Ce qui reste nommé dans la partie 1 (inventaire pour le lot suivant)
1. **`production.yml`** (étapes `freeze:days` / `jours-figes-filtrer` de Jump ; trois étapes `tower-*` ; `--niveaux … --tower …` des empreintes ; artefacts `jours-figes`, `jours-tower`), **`jours-figes.yml`**, **`deploy-api.yml`** et **`deploy-site.yml`** (entrées `jours_tower`, `tower-poser`).
2. **`mise-en-production.mjs`** : commandes `tower-plan`, `tower-a-figer`, `tower-figes-poser`, `tower-nettoyer`, `tower-poser`, `tower-resume`, `TOWER_DOSSIER`, `planTower`… (à paramétrer par `--jeu` et par un champ de fiche qui dit comment un jeu fige et prépare : `jours.fabrication` — paquet, scripts `figer` et `preparer`, test du garde-fou) ; `apps/api/scripts/empreintes-tower.ts`, `empreintes-jours.ts`, `empreintes.ts`.
3. **`ci.yml` job `api-image`** : le contrôle des niveaux figés de Jump dans leur format propre (`info.frozenDays`, `source == fige`).
4. **`apps/api/scripts`** : `smoke.ts`, `smokeRead.ts`, `recette-seed.ts`, `routesChaudes.ts`, `platformBudget.ts`, les bancs, `build-node.mjs`, `Dockerfile` ; **`scripts/budgets.mjs`** (une fonction de mesure par jeu, `mesuresParLigne` en dur) ; `package.json` racine (`build` enchaîne trois `-w`) ; `unit-durees.json`.
5. Le workflow `production.yml` ne peut s'essayer que par le bouton (mode `essai` / `repetition`) : **à faire par Nathan** avant de fusionner un lot qui le réécrit.

## Les parties 2 et 3 (non commencées)
Contrat minimal d'un jeu neuf, `resultats_jeu`, formateurs de réponses par défaut, enveloppe de rediffusion dans `@cdj/core`, file d'envoi hors ligne, records locaux et colle des amis dans `@cdj/kit`, `npm run nouveau-jeu`, « Cibles » (et ses deux fiches de test), `docs/<id>/passation.md`, test « Kit de bout en bout », « Créer un jeu » dans `CLAUDE.md` et `docs/orchestration.md` : **rien n'est écrit**. Le `CLAUDE.md` racine et `kit-de-jeu.md` disent l'état exact.

## Vérifié / non vérifié
- **Vérifié en local** : tout ce qui précède ; `construire-pr` + `pr` de `e2e-suite.mjs` sur Tower (10 tests Chromium verts).
- **Vérifié par la CI** : run de PR vert (5,6 min : https://github.com/Nathan-Te/DailyTrack/actions/runs/41629762440) ; **run en mode `main` forcé une fois, vert** (9,7 min, Track 3 parts, Jump, Tower, Firefox et WebKit en petit ensemble, Budgets, api-image : https://github.com/Nathan-Te/DailyTrack/actions/runs/41630585183) ; le forçage est retiré (commit de retour).
- **Non vérifié** : `stabilite.yml` (matrice générée, jamais lancée), `recette.yml` (liste de chemins : testée par `recette.test.ts`), aucune étape de production.
- **Décisions de Nathan (3 novembre)** : les nouveaux noms de jobs et d'artefacts de la CI complète sont acceptés ; la suite du lot (réécriture de `production.yml` et consorts, puis les parties 2 et 3) est un **lot à part**, dont la PR ne se fusionne qu'après un essai du bouton en mode `essai` (puis `repetition`).
