# Lot 3c (DailyJump) — les tests de DailyJump dans le verdict de la CI

PR : [Nathan-Te/DailyTrack#73](https://github.com/Nathan-Te/DailyTrack/pull/73). Aucun changement de jeu, de `jump-sim` ni de générateur ; golden des deux jeux inchangés ; aucun test de DailyTrack modifié.

## Ce qui change
Les ≈ 100 e2e de DailyJump suivent les règles de CI de DailyTrack (retouche 29b) :
- **Matrice** : 4 entrées `suite: jump` dans `e2e-parts` — Chromium 1/2 et 2/2 (parts composées par durée, `scripts/e2e-parts.mjs` + `apps/jump/e2e/durees.json`, un test à la fois), Firefox 1/1, WebKit 1/1 (`--shard`). Plus de « test de fumée » à part dans la part 1.
- **Projets Playwright `jump-chromium|firefox|webkit` en CI** (noms simples hors CI) : `smoke`, `mobile`, `replay`, `themes` existent dans les deux jeux, le nom du projet dit de quel jeu vient un test dans le rapport.
- **Rapport fusionné et verdict** : blobs `report-jump-*.zip` fusionnés avec ceux de DailyTrack par le job `e2e` ; Playwright refuse de fusionner des dossiers de tests différents, d'où `scripts/e2e-merge.config.mjs` (`testDir` = `apps/`) et des sorties en chemins absolus.
- **Relance** : `retries: 1` en CI, trace des essais ratés gardée ; un test qui réussit à la relance est « instable » (nommé dans le résumé, `::warning`, échec au run de nuit).
- **`MESURE` / `CAPTURES`** : déjà sautés d'eux-mêmes avec leur motif (« outil de mesure : MESURE=1 », « outil de captures : CAPTURES=1, Chromium ») ; ni l'un ni l'autre n'est défini en CI. Garde : `apps/jump/test/ciE2e.test.ts` (aussi : chaque spec dans une part et dans `durees.json`, relance, nom des projets, instable de DailyJump nommé).
- **Scripts racine** : `solve:modules`, `measure:jump`, `freeze:days` (vers `jump-sim` / `jump`, arguments après `--`) ; `e2e:jump` existait, il passe maintenant ses arguments (`npm run e2e:jump -- smoke`).
- **Pages** : `apps/jump/dist/` (donc `levels/`, copié par Vite depuis `public/`) était déjà copié sous `jump/` pour `main` et `b/<branche>/jump/`. Ajout d'une étape « Vérifier les niveaux figés publiés » qui échoue si un fichier de `public/levels/` manque ou diffère dans le site préparé.
- `docs/jump/consignes.md` : mention de la dette retirée, règles de CI de DailyJump écrites.

## Répartition de la matrice (run [38916375876](https://github.com/Nathan-Te/DailyTrack/actions/runs/38916375876))
| Part | Durée du job |
|---|---|
| jump chromium 1/2 | 2 min 22 s |
| jump chromium 2/2 | 3 min 02 s |
| jump firefox 1/1 | 1 min 33 s |
| jump webkit 1/1 | 2 min 53 s |
| DailyTrack (12 parts, inchangées) | 1 à 12 min |

Les parts DailyJump finissent ≈ 8 min avant la plus longue part DailyTrack : elles ne sont pas sur le chemin critique. Durées Chromium par fichier (essais ratés compris) relevées dans le résumé du job `e2e` et recopiées dans `apps/jump/e2e/durees.json` (≈ 4,5 min au total, réparties 1/2 et 2/2).

## Durée du push au verdict
- **Avant** : 11 min 19 s (run [38913401908](https://github.com/Nathan-Te/DailyTrack/actions/runs/38913401908), `main`, lot 11 ; 10 min 26 s au lot 8c, run 38881324836). Les e2e DailyJump y tournaient à la suite de la part 1 (Chromium +2 min ; Firefox +45 s ; WebKit +1 min 46 s).
- **Après** : 12 min 10 s (14:30:54 → 14:43:04). Chemin critique inchangé : Chromium 1/8 de DailyTrack (11 min), dont la durée varie d'un run à l'autre (4 à 11 min selon les runs vus) ; mes changements n'y touchent pas. Objectif < 20 min tenu.
- Un seul run « après » : la dispersion d'un run à l'autre n'est pas mesurée.

## Vérifié / non vérifié / décisions pour Nathan
**Vérifié** : CI verte sur le commit `3c51c28` (jobs `test`, `e2e`, 16 parts dont les 4 de DailyJump, `api-image`, Pages) ; 440 réussis, 0 instable, 0 échec dans le rapport fusionné ; lignes `jump/…` des durées Chromium dans le résumé du job `e2e` ; fusion reproduite en local avec un blob de chaque jeu ; Vitest (`ciE2e.test.ts`, `e2eParts.test.ts`, `e2eSummary.test.ts`) et `tsc -b` ; les 100 tests DailyJump en Chromium en local ; site publié : `jump/levels/2026-10-16.json` et `2026-10-17.json` présents sur la branche `gh-pages` pour `main` et pour des aperçus de branche, et l'étape de vérification a réussi.
**Non vérifié** : le nom des tests DailyJump dans le rapport HTML de Firefox et WebKit (le résumé les compte, je n'ai lu que le résumé de Chromium) ; le nombre de tests DailyJump sautés faute de WebGL dans Firefox et WebKit (508 sautés en tout, sans détail par jeu — comportement d'avant, motivé dans les tests) ; le run de nuit (`--fail-on-flaky`) ; un test DailyJump réellement instable (le chemin « nommé » est couvert par un test du résumé, pas par un run).
**Décisions / écarts**
1. Branche : la session imposait `main` ; une PR brouillon ne peut pas en partir, j'ai poussé `lot-3c-ci-dailyjump`.
2. Hors liste autorisée, deux scripts de CI ont été étendus sans changer leur comportement pour DailyTrack : `scripts/e2e-parts.mjs` (jeu déduit du préfixe `jump-` du projet) et `scripts/e2e-summary.mjs` (durées `jump/…`), plus `scripts/e2e-merge.config.mjs` (nouveau). À toi de valider.
3. Le nombre de parts DailyJump (2 pour Chromium, 1 pour les autres) est large : une seule part Chromium (≈ 4,5 min) suffirait. Gardé à 2 pour la marge ; à réduire si tu veux moins de jobs.
4. Le test `e2eParts.test.ts` de DailyTrack lit le nombre de parts dans `ci.yml` par la première occurrence de `browser: chromium, shard:` : les entrées DailyJump s'écrivent donc dans l'ordre `suite, shard, browser` (commentaire dans `ci.yml`).
