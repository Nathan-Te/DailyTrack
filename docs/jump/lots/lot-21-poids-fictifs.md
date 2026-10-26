# Lot 21 — Poids, joueurs fictifs et économie (DailyJump)

`JUMP_SIM_VERSION` **5**, `JUMP_GENERATOR_VERSION` **15** : **inchangées**. Aucun niveau ne change, tous les golden sont identiques (`golden*.json`, `daily-golden*.json`, `replay-golden*.json`). Consignes : `apps/jump/CLAUDE.md` (« Catalogue et générateur à la demande », « Économie des lots »), `packages/jump-sim/CLAUDE.md` (« Joueurs fictifs qui reprennent bien »).

## Scénario en 2 clics
PR : https://github.com/Nathan-Te/DailyTrack/pull/150 ; aperçu : https://playdujour-recette--pr-150-ci740epj.web.app/jump/ (`<aperçu>` ci-dessous) ; en local `npm run dev:jump`, `http://localhost:5173/`.
1. **Un jour figé, `?debug`** : https://playdujour-recette--pr-150-ci740epj.web.app/jump/?seed=2026-10-26&debug — la surimpression doit dire **« origine   fichier figé, catalogue non chargé »** (onglet Réseau : aucun fichier `modules-…` ni `daily-…`). Un jour non figé, pour comparer : `<aperçu>?seed=2026-10-29&debug` → « généré (worker), catalogue chargé (worker) ».
2. **Le carnage de démonstration d'un jour v5** : https://playdujour-recette--pr-150-ci740epj.web.app/jump/?seed=2026-10-29&api=demo&carnage=demo — des joueurs fictifs meurent, attendent sur le palier, puis repartent et passent les morceaux (plateformes `navette`, portions dures `demi-tour`, `mur-seul`).

## 1. Poids : le catalogue et le générateur hors du premier chargement
| | avant | après |
|---|---|---|
| Budget `jump.jsCss` (`mesureJump`, inchangée) | 376 557 o (marge 1 933) | **326 546 o (marge 51 944)** |
| JS réellement reçu au premier chargement (graphe statique page + jeu, compressé) | 304 960 o | **264 554 o (−40 406)** |

- **Ce qui sortait de trop** : le catalogue (91 morceaux, 25 ko compressés), l'analyse des morceaux (20 ko) et le générateur (12 ko) étaient dans le fichier de la page **et** recopiés dans le fil de travail (56 ko). Le générateur, le solveur de la preuve et le catalogue n'existent plus qu'une fois et ne sont chargés qu'à la demande (fichier figé absent, `?module=`, `?modules`, `?semaine`, `?carnage=demo`).
- **Comment** (détail dans `apps/jump/CLAUDE.md`) : `dailyGen.ts` seul importe `dailyLevel` ; le fil de travail est une entrée de la même construction (`vite.config.ts`) qui partage ses fichiers avec le repli ; `sideEffects: false` pour `jump-sim` et deux annotations `/* @__PURE__ */` ; trois petits fichiers de `jump-sim` (`texthash.ts`, `jours.ts`, `constants.ts`) reçoivent ce que la page lit (code déplacé, réexporté, aucun calcul changé) ; l'adresse lit un index léger des morceaux (`moduleIndex.ts`, écrit par `solve:modules`).
- **Gardé par un test de construction** (`e2e/poids.spec.ts`, éprouvé : il échoue sur la construction d'avant) et par `test/catalogueALaDemande.test.ts` : avec un fichier figé ni worker ni générateur ni catalogue ; sans fichier figé le niveau est celui de la référence au bit près (golden g15) ; repli si le fichier n'arrive pas ou si le worker échoue. `e2e/chargement.spec.ts` le vérifie dans un navigateur (corps de tout le JS reçu).
- **Durée du chargement du niveau** (Chromium, profil téléphone, `mesure-lot-21.spec.ts`, médiane de 5, `localhost`) : figé 48 → 52 ms (×1) et 224 → 188 ms (×4) ; prêt 539 → 524 ms et 2 428 → 2 134 ms ; worker 386 → 407 ms ; repli 300 → 368 ms. **Réseau mobile lent** (150 ms, 1,6 Mbit/s, `RESEAU=1`, prêt) : figé **2 790 → 2 638 ms** ; worker 3 335 → 3 734 ms ; repli 2 930 → 3 242 ms.

## 2. Joueurs fictifs
Deux défauts : la faute qui tuait un joueur fictif était rejouée à chaque vie (il mourait huit fois au même endroit), et après une mort sur un point de passage il rejouait les commandes de la preuve (franchie en courant) depuis l'arrêt. `demoAttempts(…, { reprise: repriseParPhase(niveau) })` : faute passée oubliée ; attente sur le palier de la phase voulue, solution du morceau depuis l'arrêt (élan dans la zone pour une portion dure, plateformes de même), reprise de la preuve à sa sortie ; chaque reprise **vérifiée dans la simulation**. Option facultative : sans elle, essais d'avant, golden intacts.

Part des essais fictifs qui arrivent, les **15 jours de la démonstration** (16 → 30/10/2026, 200 essais par jour, 8 vies, graine de `jump:seed`) :
| niveaux | avant | après |
|---|---|---|
| v3 (8 jours) | 39 % | 59 % |
| v4 (3 jours) | 37 % | 68 % |
| **v5 (4 jours)** | **33 %** | **60 %** |
| **les 15 jours** | **37 %** | **61 %** |

Démonstration régénérée (`npm run jump:seed`) : classés par jour 6 à 24 → 14 à 28 (le 28/10 : 6 → 14). Les tests `jumpBoard`, `jumpBundle`, `jumpProfile` reprennent le **30/10/2026** (au lieu du 13/11) avec les mêmes assertions ; seule donnée touchée : `jumpBoard` borne à 8 les essais plus lents (le test des égalités compte 12 joueurs, il en arrivait trop). Voir aussi `demoReprise.test.ts` (part qui arrive, vraies parties, reprise à toute heure, plateformes et portions dures).

## 3–4. `?debug`, étiquette
Ligne `origine` de la surimpression et `__jump.daily.load.catalog`. Branche sans « jump » : l'étiquette `jeu:jump` est posée sur la PR.

## À décider / non vérifié
- **Jour sans fichier figé sur réseau mobile lent : +0,3 à 0,4 s** (le fil importe le générateur, qui importe le catalogue, l'un après l'autre ; l'ancien fil était un seul fichier de 56 ko). Production : les jours sont figés avant la mise en ligne, c'est le cas rare ; aperçus et recette sont concernés. Pistes si gênant : indiquer ces fichiers au navigateur depuis `index.html` (`modulepreload` sur les seuls jours non figés).
- Les autres appelants de `demoAttempts` (`portailDemo.ts`, `classementDemo.ts`, tests de la plateforme) gardent les essais d'avant (zone de la plateforme) ; `mesureJump` compte tout fichier JS : les fichiers à la demande restent dans le budget (la proposition du lot 19 de les en sortir tient toujours).
- **`e2e/zones.json`** : `ciZones.test.ts` est rouge sur `main` (le spec `plateformes.spec.ts` du lot 20 n’a pas de zone) ; zone partagée, corrigée par la PR de la plateforme #151 (une ligne). Cette PR en dépend : après sa fusion, fusionner `main` ici (`test` redevient vert).
- Firefox et WebKit : CI complète (lot de mise en production).
