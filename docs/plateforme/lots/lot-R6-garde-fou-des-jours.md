# Lot R6 (plateforme) — Le garde-fou des jours, avant toute mise en production après l'ouverture

Branche `ccr-274b0e05-u6tifv`, PR en brouillon. **Ce lot ne lance jamais la vraie production** (un agent ne peut d'ailleurs lancer aucun workflow). Guide de Nathan : **`docs/plateforme/mise-en-production.md`** (liste de contrôle pas à pas, notes de version FR/EN). Ce README est le rapport.

## Ce qui est livré
| | |
|---|---|
| **Jour de bascule** | `scripts/mise-en-production.mjs bascule` : le premier jour de Paris qui commence après le déploiement, calculé **au clic** (calendrier, pas des heures : 23 h / 25 h). Mardi 10 h → mercredi ; lundi 23 h 30 → mardi ; nuit du 28/03/2027 → lundi 29/03. Testé (`miseEnProduction.test.ts`). |
| **Garde-fou** | Job `figer` de `production.yml`, **avant tout déploiement** : jours servis par la production (`jours-servis`) → `freeze:days` jusqu'à **la veille de la bascule** → empreintes de chaque jour (journée n° 1 → bascule + 13) du code en production et de la nouvelle construction → `comparer` : **toute différence avant la bascule = arrêt**, jours en cause dans le résumé → ancien code sur la base migrée. |
| **Après la validation** | `deploy-api.yml` et `deploy-site.yml` re-vérifient que le jour de bascule n'a pas commencé (la validation de Nathan peut durer) ; le retour arrière est refusé une fois ce jour commencé (`apres_le_jour_j`). |
| **Répétition** | `production.yml`, `mode: repetition` + `heure_simulee` (+ `reference` pour une date lointaine) : tout contre la **recette**, `smoke` complet, ni étiquette, ni PR, ni production. |
| **Inventaire** | `inventaire` : PR (titre, lot, zone), versions (`JUMP_SIM_VERSION`, `JUMP_GENERATOR_VERSION`, `SIM_VERSION`, `GENERATOR_VERSION`, dates de bascule de Track), migrations, tables, routes — chacune avec effet, risque, vérification — dans le résumé du run. Exemple (tag `prod-2026-10-25-0933` → `main`) dans le guide, § 7. |
| **Vieux onglets** | Jump : les versions annoncées sont acceptées si ce sont celles **du niveau** d'un jour conservé (`validateJump`) ; jour régénéré ou onglet « du futur » : `409 version` (traduit). Track : `sim_version` / `track_mismatch` (déjà traduits). `jumpVieuxOnglets.test.ts`. |
| **Base** | `migrations.test.ts` (en avant seulement, compatible avec le code d'avant) + `scripts/base-migree.mjs` (le serveur en production sur la base migrée par le nouveau, puis son `smoke`). |
| **Notes de version** | FR + EN, 5 lignes, dans le guide (§ 9). |

## La protection des jours passés, par jeu
- **Jump — existait** : jours figés (`apps/jump/public/levels/`), rejoués par `thawLevel` côté serveur et jeu. **Failles trouvées et corrigées** (avec les données réelles du dépôt) : (1) `freeze:days -- demain` figeait le **jour de bascule** avec l'ancien code, alors que celui-ci doit être régénéré ; (2) le commit de l'étiquette `prod-…` ne contient pas les jours que la production sert (ils n'entrent dans `main` que par la PR « robot ») : le code en production les **régénérait avec son code d'aujourd'hui**, d'où un faux conflit — **la mise en production suivante aurait échoué** sur `2026-10-24/25/26` (g12 contre g10), reproduit puis corrigé par `jours-servis` ; (3) `validateJump` refusait tout onglet d'une autre version, même pour un jour inchangé.
- **Track — n'avait qu'une demi-protection** : la version du générateur est choisie selon la date, mais **rien ne vérifiait** qu'un lot ne changeait pas un jour passé (le golden n'a que cinq jours d'avant le 28/10) — et le circuit est recalculé **dans le navigateur** : un jour altéré fausserait les rejeux. **Ajouté** : `apps/api/test/jours-passes.json` (empreinte de chaque jour passé, complétée par la PR « robot » à chaque mise en production) + `jours-passes.test.ts` (échoue dès la PR) + le garde-fou du workflow. Aucun jour déjà servi ne change (golden inchangés, aucune version).

## Vérifié / non vérifié
**Vérifié (sur le code réel du dépôt)**
- `npm run verifier -- --sans-e2e` vert (typecheck, portail, 97 fichiers SQLite, 32 libSQL) ; sécurité des workflows (`node scripts/securite-workflows.mjs`, 0 écart) ; YAML des quatre workflows lu.
- **Répétitions locales** du garde-fou, mêmes commandes que le workflow, avec le **vrai code en production** (`prod-2026-10-25-0933`, copie de travail) contre `main` : voir ci-dessous.
- **Ancien code sur base migrée** : le serveur de `prod-2026-10-25-0933` tourne sur la base migrée par `main` et passe son propre `smoke` (lecture seule puis complet) : `scripts/base-migree.mjs`, vert.
- **E2E locaux** (`npm run verifier`) : DailyTrack 14 specs verts ; DailyJump 36 verts sur 37 — `profil-commun.spec.ts:99` (« deux appareils… », la synchronisation n'atteint jamais `ok` après le rechargement) échoue **aussi sans mon changement de `jump.ts`** (reconstruit et relancé) : hors des zones du lot, à voir avec la CI de `main` (règle d'arrêt (1)).
- **Le garde-fou arrête à raison** : une mise en production simulée le 05/11 (bascule le 06/11) s'arrête, `DailyTrack 2026-11-04` et `2026-11-05` en cause (`g16` en production, `g18` ensuite : `BASCULE_LOT_48/49` valent le 04/11).

**Non vérifié (à toi, Nathan)**
- **Les deux répétitions sur la recette** : un agent ne lance pas de workflow, et `production.yml` ne se lance que sur `main`. Elles se font **après la fusion**, en deux clics (§ « Scénario »). Les résumés ci-dessous sont ceux des **répétitions locales**, pas ceux de la recette ; le déploiement de la recette, le site Firebase, `smoke` sur la recette et les expressions du YAML (`inputs.mode`) n'ont pas pu être exécutés par GitHub.
- La PR « Jours figés » avec `jours-passes.json` (`empreintes-fusion` testée, l'étape du workflow non).

### Résumés des répétitions (locales, `main` contre `prod-2026-10-25-0933`)
| heure simulée | jour de bascule | DailyTrack : conservés / différences / régénérés / validés / changent | DailyJump : idem | verdict |
|---|---|---|---|---|
| un matin, `demain 10:00` (27/10 10 h) | mercredi 28/10 | 2 / 0 / 14 / 14 / 7 | 2 / 0 / 14 / 14 / 14 | ✅ |
| un soir, `aujourdhui 23:30` (26/10 23 h 30) | mardi 27/10 | 1 / 0 / 14 / 14 / 6 | 1 / 0 / 14 / 14 / 14 | ✅ |
| nuit du changement d'heure, `2027-03-28 03:30`, **`reference` = le commit lui-même** | lundi 29/03/2027 | 154 / 0 / 14 / 14 / 0 | 154 / 0 / 14 / 14 / 0 | ✅ |
| `2026-11-05 10:00` (cas qui doit s'arrêter) | vendredi 06/11 | 9 / **2** / 14 / 14 / 14 | 11 / 0 / 14 / 14 / 14 | ⛔ arrêt |
Lecture : Track « changent » = les jours dès le 04/11 (herbe, identité des thèmes : générateur v17/v18) ; Jump change tous les jours régénérés (g12 → g17). Avec le code en production réel, la nuit du 28 mars seule est refusée (les dates de bascule de Track sont passées) : d'où `reference`.

## Scénario pour Nathan (2 clics, après la fusion)
1. Actions › **Mettre en production** › mode **repetition**, `heure_simulee` = `demain 10:00` › Run : le résumé dit jour de bascule après-demain, N jours conservés sans différence, M régénérés et validés, ancien code sur la base migrée ✅, `smoke` vert. Même chose avec `aujourdhui 23:30`.
2. Ouvrir `https://recette.playdujour.com/` : le jour en cours de chaque jeu est le même qu'en production ; avec `/track/?seed=` et `/jump/?semaine=`, le jour de bascule montre la nouvelle carte.

## Décisions et changements de procédure à connaître
- **Les lots de Jump ne figent plus eux-mêmes** (`freeze:days -- demain` à la fin d'un lot) : c'est « Mettre en production » qui fige (consignes mises à jour : `packages/jump-sim/CLAUDE.md`, `docs/jump/synthese.md`). Un fichier figé par un lot avec un autre code que celui en production **arrête** la mise en production (message « jour(s) figé(s) différent(s) ») : le retirer.
- **Les dates `BASCULE_LOT_48` / `BASCULE_LOT_49` (04/11/2026)** sont à confirmer à chaque mise en production : au-delà du 03/11, le garde-fou arrête (voulu) ; il faut alors les déplacer (PR d'une ligne + `UPDATE_GOLDEN=1`).
- **« Mettre en production » refuse** une PR « Jours figés » encore ouverte ; la sauvegarde Turso se garde **7 jours** après chaque mise en production.
- `lancement.md` § 6 : « ne plus cliquer avant le lot R6 » devient « se clique avec la liste du lot R6 ».

## Runs de CI et verdicts
_À compléter une fois la PR poussée (voir le fil de la PR)._

## Ce qui reste risqué à la prochaine mise en production
1. **Les workflows ne se testent qu'en vrai** : le YAML (expressions `inputs.mode`, `needs.verifier.outputs.bascule_le`, artefacts `empreintes-jours`, `npm ci` de deux dépôts dans le même job, 60 min) n'a été lu que par des tests de texte et exécuté « à la main » commande par commande. **La répétition sur la recette est la vraie preuve : ne cliquer pour de bon qu'après elle.**
2. **Le temps du job `figer`** (deux `npm ci`, deux constructions du serveur, 16 jours ≈ 20 s, 168 jours ≈ 75 s ; un an ≈ 3 minutes par dépôt) : compter 5 à 8 minutes avant le déploiement.
3. **La comparaison est celle du code, pas de la base** : le planning de l'administration (`planning`, variantes et thèmes imposés) vit en base ; un jour déjà remplacé par l'admin n'est pas vu par les empreintes (un jour commencé ne se remplace plus, 409 `day_started`, mais un jour à venir si — vérifier le planning de la semaine avant de cliquer).
4. **Les jours figés d'avant** (`24–26/10`, g10) viennent d'une mise en production qui figeait « demain » : leur fichier dans `main` fait foi et la PR « Jours figés » doit être fusionnée avant la suivante (le workflow le vérifie).
5. **Une mise en production tardive** (après le 03/11) fera arrêter le garde-fou sur Track tant que les dates de bascule ne sont pas déplacées ; sans effet pour les joueurs, mais à prévoir.
6. **Retour arrière** après le début du jour de bascule : refusé par défaut ; corriger en avant.
7. **Pas de test de charge** de la régénération des jours à la première requête (un jour régénéré est calculé à la première requête, ≈ 0,2–2 s, comme avant).
