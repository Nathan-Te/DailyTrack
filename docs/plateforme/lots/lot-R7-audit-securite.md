# Lot R7 (plateforme) — Audit de sécurité, et le dépôt public ou privé

Rapport complet : **`docs/plateforme/audit-securite-2026-10.md`** (22 constats classés par gravité avec preuve, scénario, correction et vérification ; sections « Administration et recette », « Le dépôt public : ce qu'il expose », « Le dépôt privé : ce que cela coûterait » avec le tableau de coût par option). Aucun accès à la production, à la recette ni aux consoles : tout ce qui demande une console est une étape de Nathan (§ 9 du rapport). Aucun changement de `packages/sim`, `packages/jump-sim`, de physique, de générateur ni de règle de jeu ; **golden inchangés** ; **aucune dépendance ajoutée**.

## Synthèse
- Aucun secret dans le code ni dans les 784 commits (gitleaks, 2 faux positifs ; **rien à révoquer**). Aucune XSS. Aucune injection SQL. Aucun moyen de faire accepter un temps faux (le serveur ne retient que le temps qu'il rejoue).
- Corrigé ici (élevé) : `?api=` mène l'identifiant secret hors du site (S-01) et le jeton d'admin (S-02) ; `demo/` de la production contient la rediffusion parfaite des jours à venir (S-03) ; le plafond de rejeux ignorait la durée (S-04) ; classement de Track sans limite de lecture (S-05) ; workflows sans `permissions:` et actions non épinglées (S-06).
- À décider par Nathan : la fédération Google ne vérifie que le dépôt (S-07, élevée) — toute branche peut déployer en production ; moyens et étapes au rapport.
- Dépôt privé : **≈ 35 000 minutes facturables la dernière semaine** (86 000 à 150 000 par mois), soit **≈ 500 à 900 $ par mois** ; la validation de « Mettre en production » n'existe pas en privé sans Enterprise. **Recommandation : rester public**, corriger l'exposition (fait pour l'essentiel), protéger la recette par une clé ; la décision est à Nathan.

## Corrections faites (chacune avec son test)
| Constat | Correction | Test |
|---|---|---|
| S-01, S-02 | `apiFromAddress` (`packages/profile`) : sur la production, `?api=` ne vise que `/`, `demo`, la même origine ou la machine locale ; `apiBase`, `adminApiBase` (Track), `rankApiBase` (Jump) | `packages/profile/test/apiAdresse.test.ts`, `apps/web/test/api.test.ts`, `apps/jump/test/classement.test.ts` |
| S-03 | `scripts/site.mjs --production` retire `track/demo` et `jump/demo` | `apps/portail/test/site.test.ts` |
| S-04 | `replayUnits` (`apps/api/src/replayCost.ts`) : une unité de plafond par 5 000 pas rejoués (Track, Salon, Jump) | `apps/api/test/auditR7.test.ts` |
| S-05 | `BOARD_READS_PER_CLIENT` = 300 pour le classement et les fantômes de Track | `auditR7.test.ts` |
| S-18 | ménage de `rate` une fois par fenêtre et par instance ; adresse de connexion comptée avant l'écriture en base | suites existantes + `adresse.test.ts` |
| S-06 | actions épinglées par empreinte (`# vX.Y.Z`), `permissions: contents: read` sur `ci.yml` et `stabilite.yml`, entrées passées par `env:` dans `deploy-site.yml` ; **nouveau contrôle** `node scripts/securite-workflows.mjs` | `apps/web/test/securiteWorkflows.test.ts` (dans le job `unit`) |
| S-11 | en-têtes de sécurité sur Hosting (`firebase.json`) et sur toute réponse de l'API | `apps/portail/test/site.test.ts`, `auditR7.test.ts` |
| Administration (§ 2 bis) | journal des actions et des jetons refusés (sans jeton, adresse ni pseudo), avertissement de jeton faible, `X-Robots-Tag` sur `/track/admin/**`, `?token=` ignoré (testé) | `auditR7.test.ts` |
| Recette (§ 2 bis) | `robots.txt` « tout interdit » et `X-Robots-Tag: noindex` sur la recette et les aperçus ; `robots.txt` permissif en production ; limites de débit identiques à la production | `apps/portail/test/site.test.ts` |

Modifications de tests existants : **aucune assertion retirée ni relâchée**. (Une comparaison littérale de `deploy-site.yml` a été gardée intacte en laissant ces lignes telles quelles ; la règle de sécurité accepte la comparaison à des constantes.)

Budgets : Track **+253 o** (marge 4 257 o), Jump **+177 o** (marge 3 846 o), portail inchangé (`docs/plateforme/budgets.md`, section « Lot R7 »).

## Lots proposés (titre, zone, taille, priorité — détail au § 8 du rapport)
L-CSP (CSP stricte, S–M, haute) · L-ADM (administration hors du site public, M, haute) · L-REC (porte de la recette, M, haute) · L-DEP (séparer recette et production, M–L, haute) · L-FUT (ne pas publier demain, M) · L-GRN (graine secrète du jour, L, décision de Nathan) · L-RJ (rejeu borné, M) · L-LEC (cache des lectures, S) · L-ID (identifiants hachés, M) · L-ENT (entrée unique, M) · L-CPT (comptes en masse, M) · L-ROB (plausibilité des entrées, M) · **L-SEM (`?semaine=` hors production, S, avant la prochaine mise en production)** · L-T32 (DailyTrack sans `?player=`, S) · L-PSD (pseudos, S) · L-DEV (dépendances de développement, S).

## Étapes manuelles pour Nathan
Pas à pas avec ce qu'il doit voir : § 9 du rapport. Les plus importantes : (1) désactiver GitHub Pages (`has_pages` est encore vrai) ; (2) ajouter `assertion.repository_id` à la condition de la fédération Google et supprimer `GCP_SA_KEY` s'il existe ; (3) environnement `production` limité à `main` ; (4) vérifier la longueur du jeton d'administration (≥ 32) ; (5) jetons Turso : expiration ; (6) budget Google Cloud avec alertes.

## Chiffrage public / privé (résumé)
| Option | Coût mensuel estimé | À retenir |
|---|---|---|
| A. Public | 0 $ | tout disponible ; recommandée |
| B. Privé + Free | CI arrêtée après 2 000 min (≈ 15 h de travail) ou ≈ 500–880 $ | pas de protection de branche ni d'environnement : non viable |
| C. Privé + Pro | abonnement + ≈ 500–880 $ au rythme actuel (≈ 50 $ en régime sobre de 11 000 min) | pas de relecteurs d'environnement |
| D. Privé + exécuteurs auto-hébergés | abonnement + serveur ; minutes GitHub ≈ 0 pour ces jobs | ≈ 3,5 machines à 2 cœurs occupées ; code d'agents exécuté chez Nathan ; isolation obligatoire |

## Vérifié / non vérifié
**Vérifié** : `npx tsc -b` et `npx tsc -p apps/portail` ; tests unitaires complets sur SQLite (220 fichiers, 3 272 tests) et libSQL (28 fichiers, 415 tests) avant les dernières retouches, puis les fichiers touchés ensuite ; `node scripts/securite-workflows.mjs` (9 workflows, 0 écart) ; build et `node scripts/budgets.mjs` avant / après ; historique complet par gitleaks ; CSP essayée dans Chromium sur le site de production assemblé (l'audit du client) ; niveaux futurs recalculés avec le code de l'étiquette `prod-2026-10-25-0933` ; minutes de CI par l'API publique de GitHub.
**Non vérifié** : réglages du dépôt GitHub (protection de `main`, environnements, droits par défaut d'Actions — l'API les refuse à ce compte), consoles Google Cloud et Turso, les nouveaux en-têtes sur le vrai Firebase Hosting (visibles à l'aperçu de la PR), la CSP sous Firefox et WebKit, les lignes lues facturées par Turso, le prix de GitHub Pro et les tarifs de Cloud Run (valeurs de mémoire).
**Hors périmètre respecté** : le dépôt n'est pas passé en privé ; le panneau d'administration n'est pas déplacé ; `production.yml` : seulement les permissions et l'épinglage des actions (logique de gel des jours et ordre des étapes intacts) ; aucune authentification refondue.

## Runs de CI
_(à remplir une fois la CI de la PR terminée)_
