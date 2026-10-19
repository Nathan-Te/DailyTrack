# Lot R3 (plateforme) — CI rapide, tests instables réparés

PR brouillon #83. Aucun changement de `packages/sim`, `packages/jump-sim`, `core`, `clock` ni de la physique ; **golden des deux jeux inchangés** ; aucun code de jeu modifié (voir § 1 : aucun test n'a révélé de défaut de calcul ; un défaut d'interface de la page d'admin est signalé, pas corrigé). Aucune dépendance ajoutée.

## 1. Les tests instables : cause, correction, preuve
Recensement : 140 runs de `ci.yml` (14 → 19/10, journaux complets), 171 occurrences d'échec ou d'instabilité. Preuve : `e2e/stabilite.json` + `.github/workflows/stabilite.yml` rejouent chaque test **30 fois de suite, sans relance** (`--repeat-each=30 --retries=0`), sur son navigateur et le runner de la CI.

| Test | Cause trouvée | Correction (même exigence) | 30 de suite en CI |
|---|---|---|---|
| `salon.spec.ts:149` (31 occ., push surtout) | La saccade de 300 à 640 ms après le podium n'est **pas la bascule** : c'est la **première décision de la qualité automatique** (`QualityGovernor`). Le test met fin à la session quelques secondes après le chargement ; la qualité descend donc juste après le podium (mesuré : 2 → 1 à 1,5 s, 1 → 0 à 3,4 s ; plus tôt sur un runner lent) et le passage à 0 coupe les ombres, ce qui **recompile 5 shaders d'un coup** (journal CI : « shaders compilés à [916, …] » ; en local, les 5 programmes recompilés sont ceux sans `USE_SHADOWMAP`). | `?quality=2` fige la qualité (celle où démarre l'automatique : la scène la plus lourde). Le seuil de 250 ms ne bouge pas ; le test mesure la bascule, pas la qualité automatique. | run 39334891366 : 30/30 |
| `accueil.spec.ts:420` « le chrono » | Attentes **en temps réel accéléré** (`timescale=2`, 500 ms puis 1,2 s) qui supposent qu'une image au moins est dessinée dans la fenêtre. Reproduit en local, processeur occupé : 0 pas au lieu de > 100 (CI : 7 et 0). | **Pas à pas** (`manual` + `advance`) : décompte qui ne tourne pas (1 s de pas : chrono à 0), course qui tourne voiture immobile (240 pas), aide « Le chrono tourne », pause qui fige tout **même avec 240 pas demandés** (plus strict qu'avant : pas exact après la reprise). L'accueil reste en temps réel (« rien ne doit changer pendant 1,5 s »). Local, sous charge : 10/10 (avant : 1 échec sur 10). | run 39334891366 : 30/30 |
| `tactile.spec.ts:165` (lot 13 de DailyJump) | Tenir le frein, c'est **freiner puis reculer** (le frein sert de marche arrière) jusqu'au mur du départ, où la voiture se pose à **vz = +0,035 m/s, immobile** (vx = 0) — calculé en Node : la valeur exacte des deux échecs de CI. Lu en temps réel, vz donnait « < 0,01 » pendant le recul (vert) ou 0,035 pour toujours si la première lecture tombait après le choc (rouge). | Lecture **pas à pas** tous les 10 pas depuis l'appui : la voiture doit cesser d'avancer (vz < 0,01) dans les 5 s de simulation, comme avant ; en plus, le doigt doit freiner et couper l'accélérateur (`throttle: 0, brake: 64`). | à confirmer (run suivant) |
| `admin.spec.ts` (`:33` « Lancer le jeu », `:21`, `:5`) et `figures.spec.ts:63` (WebKit) | **La page d'admin se construit encore quand le test clique.** Le planning (Aujourd'hui, 14 cartes, Historique) est au-dessus des outils et se remplit après coup (fiches « en préparation… » → 8 ou 9 lignes) : mesuré dans Chromium, les outils descendent de **680 à 5 856 px en 3,5 s, par 8 sauts**. Chromium compense (ancrage du défilement), **WebKit non** : le clic tombe sur ce qui a pris la place (« Clicking the checkbox did not change its state », « `<button>` from `<div id="presets">` intercepts pointer events », lien « Lancer le jeu » jamais suivi → `waitForURL` jusqu'au délai). | `e2e/adminPage.ts` (`openAdmin`, `adminSettled`) : attendre un **état** (14 cartes et le jour avec leur fiche, historique affiché, outils immobiles pendant 5 images) avant de cliquer, aussi après un rechargement. Aucune assertion touchée. | admin : 120/120 ; figures : 30/30 (run 39334891366) |
| `thumbnails.spec.ts:150` (tracé 2D) | (§ 1 bis) | | |
| `salon.spec.ts:266` (7 occ., hors liste du prompt, vu le 19/10) | « Plus de 5 images notées » était compté à la lecture côté Node ; deux pages en rendu logiciel (≈ 1,3 s par image) en donnaient parfois 4 ou 5. | On attend **dans la page** la bascule et plus de 5 images ; les écarts entre images ne sont pris que jusqu'à la première image basculée (aussi strict ou plus qu'avant), et il faut une image avant la bascule. | run 39334891366 : 30/30 |

### 1 bis. `thumbnails.spec.ts:150` et `:204`
(en cours)

## 2. Ce qui tourne
**Sur une PR** (mode `pr`) : `scope` ; tous les tests unitaires en **3 parts** (`unit`, typecheck et construction dans la 1ʳᵉ) + leur verdict **`test`** ; les e2e des **jeux touchés** sur **Chromium** ; le **sous-ensemble multi-navigateurs** sur Firefox et WebKit (leur part 1 ; les autres réussissent sans rien faire) ; `api-image` si le serveur est touché ; le verdict **`e2e`** (quarantaine non bloquante).
**Sur `main` (chaque fusion, mode `complet`), la nuit (mode `nuit`) et à la demande** : tout, trois navigateurs, sans filtre, quarantaine bloquante ; la nuit, un instable ou une dette expirée fait aussi échouer.
**Plus de run `push` sur les branches** : chaque commit d'une PR lançait deux CI (`push` et `pull_request`), et les instables du run `push` bloquaient sans rien apprendre de plus.
**Filtre d'`apps/api`** (`scripts/ci-scope.mjs`, liste fermée, testée : `apps/api/test/ciScope.test.ts`, 27 tests) : `src/jump*.ts`, `test/jump*.test.ts`, `scripts/jump-*.ts`, `scripts/measure-jump.ts` → DailyJump + plateforme ; `src/cdj.ts`, `src/salon.ts`, `test/salon.test.ts`, `test/planning.test.ts`, `scripts/measure-{salon,generator,budget}.ts`, `scripts/history-seed.ts` → DailyTrack + plateforme ; tout le reste (registre, identité, configuration, serveur, base, `Dockerfile`, `history.ts` que `jumpHistory.ts` importe, un nouveau fichier) → tout.

## 3. Le sous-ensemble multi-navigateurs
`apps/web/e2e/multi-navigateurs.json` : `replay.spec.ts` (rediffusion de référence rejouée au bit près), `daily.spec.ts` (circuits du jour de référence régénérés : texte, temps d'auteur, palette). `apps/jump/e2e/multi-navigateurs.json` : `replay.spec.ts` (empreintes de Node). Chacun avec sa raison. Garde (`apps/web/test/multiNavigateurs.test.ts`) : chaque spec existe, tourne hors de Chromium, compare à Node, et tout spec « le navigateur rejoue / régénère » est dans la liste.

## 4. La production exige la CI complète
`production.yml` commence par `ci-complete` (`scripts/ci-complete.mjs`, testé : `apps/web/test/ciComplete.test.ts`) : il attend le run `push` de `main` du commit (90 min au plus) et refuse s'il n'est pas vert — résumé avec la raison et le lien du run. `changes` en dépend, donc recette, validation (environnement `production`), API, Pages et vérification aussi : **la validation de Nathan n'est jamais demandée** pour un commit refusé.

## 5. La quarantaine
`e2e/quarantaine.json` (**vide** à la fin du lot), `scripts/e2e-quarantaine.mjs`, effet dans `scripts/e2e-summary.mjs` (`--mode pr|complet|nuit`). Garde-fous testés (`apps/web/test/quarantaine.test.ts`, 14 tests) : entrée sans dette (ou dont le document ne nomme pas le test), incomplète, en double → refusée ; plus de 3 entrées → refusée ; plus de 14 jours → échec du run de nuit ; sur une PR l'échec d'un test en quarantaine est un avertissement nommé, ailleurs il reste bloquant ; le fichier du dépôt est vérifié par `npm test`.

## 6. Durées du push au verdict
(en cours)

## 7. Vérifié / non vérifié / décisions pour Nathan
(en cours)
