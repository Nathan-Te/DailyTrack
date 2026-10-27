# Lot R13 (plateforme) — Le tri des tests

Branche `claude/test-sorting-optimization-bcv4qu`, PR en brouillon. **L'inventaire est `docs/tests.md`** (quatre familles, nombre de tests et durée de chacune, ce qui a été supprimé et ce qui le couvre encore). Golden inchangés ; aucun code de jeu ni de serveur modifié (seulement des tests, la CI et des consignes) ; aucune dépendance ajoutée ; `node scripts/securite-workflows.mjs` : 0 écart.

## 1. Ce qui change
| | |
|---|---|
| **Familles** | **Essentiel** (PR de sa zone, chaque fusion, nuit) · **Régression** (nuit et « Run workflow ») : 39 specs entiers (`regression` de `e2e/zones.json`) et 87 tests `{ tag: "@regression" }` · **Doublon** : 138 tests e2e supprimés (≈ 1 330 s de Chromium), dont 3 specs entiers (`glace`, `largeurs`, Jump `semaine`) · **Outil** : 42 specs `captures-*` / `mesure-*` hors de la CI (`testIgnore` sans `CAPTURES=1`, `MESURE=1`…) |
| **CI de `main`** (mode `main`, nouveau) | tous les unitaires + **l'Essentiel de tous les specs** (Chromium : Track 3 parts, Jump 1 ; `--essentiel`, `--grep-invert=@regression`) + Firefox et WebKit (un job chacun). Avant : tout, 17 jobs e2e |
| **Nuit et « Run workflow »** | tout (Track en 6 parts au lieu de 8, Jump en 1 au lieu de 3) + Firefox et WebKit ; matrice calculée par `scope` (`matriceComplete`, `scripts/ci-zones.mjs`) |
| **Firefox / WebKit** | le petit ensemble `@navigateurs` (16 tests : rediffusions, circuits du jour, chargement, une partie de chaque jeu), y compris la nuit ; avant : 6 jobs, 1 420 tests listés dont 1 102 sautés (sans WebGL ou réservés à Chromium), ≈ 22 min de jobs |
| **Formats d'écran** | 844 × 390 et ordinateur, 390 × 844 pour les écrans qui s'affichent en portrait ; 740 × 360, 360 × 640, 320 × 568, 667 × 375 et le doublement iPhone / Android retirés (exception gardée : `plein-ecran` 740 × 360, la seule branche « caméra à droite ») |
| **PR** | l'Essentiel des specs liés (le budget de 900 s n'est plus atteint) ; un spec « Régression » modifié tourne en entier ; `npm run verifier -- --regression` lance la Régression en local |
| **Unitaires** | libSQL sans les trois jeux de données fictives (−105 s par run) ; `portailDemo` et `classementDemo` en Régression (PR) ; 2 tests de texte supprimés (`lancement.md`, `codes-erreur.md`) ; **un test sim ajouté** (`relief.test.ts` : le pilote finit le relief) avant de supprimer son e2e |
| **Outils** | `node scripts/inventaire-tests.mjs [--specs]` (les chiffres de `docs/tests.md`) |
| **Consignes** | `CLAUDE.md` racine (« Tests et CI » : familles, où ça tourne, écrire un test), `apps/web/CLAUDE.md`, `apps/jump/CLAUDE.md`, `docs/orchestration.md` § 12 (la mise en production lance « Run workflow ») |

## 2. Méthode
Durée de chaque test lue dans le rapport fusionné du run vert de `main` 40472051036 (blobs téléchargés, `playwright merge-reports`). Quatre audits en lecture (Track interface, Track serveur et Salon, Track rendu et scénarios, Jump) : pour chaque test, ce qu'il protège, et pour un doublon le test qui reste, **lu** (fichier et titre exacts) ; je les ai recoupés sur les fichiers avant chaque suppression. Règle suivie : un e2e qui vérifie le câblage réel (DOM, serveur) n'est pas un doublon d'une fonction pure ; un doublon est supprimé seulement si la même chose est vérifiée ailleurs.

## 3. Mesures avant (`npm run mesure-ci -- --depuis 2026-10-20 --evenement push`, minutes arrondies par job)
| | Runs | Minutes de jobs / run | Mur (min) |
|---|---|---|---|
| `main`, 20 derniers runs (25 → 27/10) | 20 | **192** (médiane ; moyenne 196) | **26,3** (médiane) |
| dont les 8 verts | 8 | 171 | 17,4 |
| semaine du 26/10 | 15 | 198 | 31,0 / p90 41,8 |
Détail du dernier vert (40472051036) : Chromium Track 8 parts ≈ 113 min (469 à 1 220 s chacune), Firefox / WebKit Track 4 jobs ≈ 13 min, Jump 5 jobs ≈ 25 min, unitaires 3 parts ≈ 20 min. Objectif : **≤ 96 min de jobs** (moitié de 192) et **≤ 15 min de mur**.

## 4. Mesures après (runs réels de la PR, `npm run mesure-ci -- --run <id>`)
| Mode (ce qu'il lance) | Run | Minutes de jobs | Mur | Jobs e2e |
|---|---|---|---|---|
| **`main`** (chaque fusion : unitaires, Essentiel de tous les specs, Firefox et WebKit) | [40496679376](https://github.com/Nathan-Te/DailyTrack/actions/runs/40496679376), vert | **56** (−71 % ; avant 192) | **15,4 min** (avant 26,3) | 6 (avant 17) |
| **`complet`** = nuit et « Run workflow » (tout) | [40493310181](https://github.com/Nathan-Te/DailyTrack/actions/runs/40493310181), **vert** | 137 (avant 192) | 24,8 min | 9 |
| PR, estimation de `ci-zones` (parts e2e, s de specs) | — | — | ≈ 5 à 6 min | Track HUD 123 s · sim 173 + 168 · Salon 200 · scène 128 ; Jump 20 à 26 ; zone `ui` 197 + 196 |
Durées de tests dans ces runs : Chromium Track 4 461 s (avant 5 477), Jump 235 s (avant 582), Firefox 15 s et WebKit 62 s pour les deux jeux (avant 426 s et 1 017 s). **Le mur de 15,4 min (objectif ≤ 15) et de 24,8 min tient à `playwright install-deps`** : apt a pris 577 s sur une part de `main` (sans lui : la part la plus longue fait 453 s, mur ≈ 9 min) et 586 et 614 s sur deux parts du mode `complet` — le miroir lent du 26/10 (`CLAUDE.md`, « Les installations de la CI… »), qui touche un runner sur cinq environ. Moins de jobs, moins de tirages : 6 au lieu de 17 sur `main`. Piste (non faite, hors périmètre) : une image de runner, ou un cache des paquets apt.

## 5. Comment c'est mesuré
La PR a forcé une fois le mode `complet`, puis une fois le mode `main` (variable `MESURE_R13` du job `scope`, **retirée** au dernier commit) ; le dernier commit est une CI de PR normale. Mesures « avant » : `npm run mesure-ci -- --depuis 2026-10-20 --evenement push`.

## 6. Vérifié / non vérifié / décisions
**Vérifié** : `npm run typecheck` (specs e2e compris) ; tous les unitaires en local (SQLite 241 fichiers, 3 696 tests ; libSQL 31 fichiers, 440 tests) ; `playwright test --list` des deux jeux ; tests de la plomberie (`ciZones`, `e2eParts`, `ciE2e`, `outilsAgent`, `stabilite`, `securiteWorkflows`) ; **la CI complète verte** (mode `complet`, 375 tests Chromium, petit ensemble Firefox et WebKit) et le mode `main` vert, sur la PR. En local, Chromium, 156 des 177 tests de Track sans `@regression` : 2 échecs dans `garage.spec.ts` (non modifié ; délai de 5 s sur un écran chargé à la demande, deux pages à la fois sur la machine), verts en CI ; le run local a été arrêté à sa limite de temps.
**Non vérifié** : un vrai run `push` de `main` et un run de nuit (après la fusion : le mode `main` est le même code, mesuré ici) ; Firefox et WebKit en local (pas installés).
**Décisions pour Nathan**
1. **La Régression ne tourne plus à chaque fusion**, seulement la nuit et par « Run workflow » : c'est ce qui fait tenir « ≤ 15 min, moitié moins ». `production.yml` exige toujours le run `push` de `main` vert (`scripts/ci-complete.mjs`, non touché : hors périmètre) — il ne couvre donc plus la Régression ; le lot de mise en production lance « Run workflow » (`docs/orchestration.md` § 12). Si tu veux que la production l'exige aussi, c'est un changement de `ci-complete.mjs` (lot R12).
2. `e2e/stabilite.json` : les trois preuves sur WebKit (`admin`, `figures` admin, Jump `plateformes`) sont retirées, ces tests ne tournant plus sur WebKit ; changer ce fichier relance « Stabilité » sur la PR une fois (7 tests × 30).
3. Les audits ont proposé des accélérations non faites (rien n'a été réécrit pour aller plus vite) : `salon-serveur` aligné sur la session (≈ −90 s), `watch` sans lecture jusqu'au bout (≈ −30 s), fusion de `watch-serveur` dans `adresses-joueur` (≈ −55 s), cache des miniatures en 2D (≈ −95 s). Elles touchent des specs de jeu : pour un lot Track.
