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

## 4. Mesures après
_À compléter avec les runs de la PR (§ 5)._

## 5. Comment c'est mesuré
La PR du lot force une fois le mode `complet` puis une fois le mode `main` (variable `MESURE_R13` du job `scope`, **retirée** au dernier commit) : on lit les deux runs avec `npm run mesure-ci -- --run <id>`. Le dernier commit est une CI de PR normale.

## 6. Vérifié / non vérifié / décisions
_À compléter._
