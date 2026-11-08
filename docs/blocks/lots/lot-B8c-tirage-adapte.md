# Lot B8c — Blocks : un tirage adapté à la grille, des médailles à la mesure d'un joueur

Branche `ccr-2069f135-qfcdct` (imposée par la session ; le prompt disait `blocks/b8c-tirage-adapte`), PR brouillon `jeu:blocks`. Seed § 4 et 5, pilier 5 (Nathan, 8 nov. 2026, **non modifié ici**). Règles en vigueur : `apps/blocks/CLAUDE.md` (« Règles », « Versions », « Médailles », « Scénarios »).

## Ce qui est fait
- **Tirage v6, règles v3, bot v5.** Plus de suite fixe : chaque série est tirée de **(graine, rang, grille au moment où elle arrive)**, par essais successifs ; `Partie` tire elle-même ses séries, le serveur retire chaque série depuis la grille rejouée (format de rediffusion inchangé : un octet par pose).
- **Méthode** (`suite.ts`, `ordre.ts`) : l'essai `k` tire une candidate avec les poids et règles de série de B8b (générateur `Rng(mixSeed(mixSeed(graine, 2·rang+1), 3k+j))`) ; acceptée si elle tient les exigences du rang, sinon on retire jusqu'à **40** essais puis on garde la meilleure (nombre de pièces posables d'abord, coup de pouce ensuite, la première à égalité). Les exigences d'un rang sont tirées de (graine, rang).
- **Réglages par défaut** : exigence 1 « série posable » 100 % jusqu'à la série 25, puis 0 % à la série 75 ; exigence 2 « coup de pouce » 60 % (30 % à la série 80), jamais sur une grille vide ; rampe 1 / 80 et **0,5 après 80** ; première série sans exigence 2. Tout se règle par `?debug&tune` (`rampe`, `essais`, `posable`, `pouce`).
- **Scénarios** : un scénario impose ses séries de départ, les suivantes sont tirées pour la grille ; `ordre` et `blocage` n'ont que la leur. **Nouveau `?scenario=coup-de-pouce`** (deux lignes attendent une barre de 3 ; la série tirée en contient une, exigence à 100 %).
- **Seuils dans la fiche** : `medailles.seuils` de `config/jeux/blocks.json` (bronze, argent, or, diamant), lus par le serveur et le jeu (`SEUILS_MEDAILLES`), `npm run fiches` accepte la clé sans toucher à la plateforme. Une fiche aux seuils non croissants arrête le jeu et le serveur.
- **Jour figé = format 3** : `{ graine, empreinte }` + seuils + bot (plus de suite à écrire). `empreinteContenu` hache les séries tirées par une **marche de référence** (`empreinte.ts`) : toute modification du tirage la change.
- **Outils** : `mesure:tirage` (nouveau), `courbe:medailles` (nouveau), `mesure:repartition`, `mesure:rampe` et `calibrer:medailles` refaits pour le tirage adapté ; le golden est régénéré (versions montées).

## Écarts à la consigne (dits, justifiés)
- **Exigence 1 plus dure : 0 % à la série 75, pas 60 % à la 100.** Avec 60 % à la 100, le Diamant survit **578 pièces en médiane et touche le plafond de 2 000 pièces** (la consigne demandait 150 à 350 et aucun plafond). Mesuré (100 à 300 jours) : 25→100→30 % : médiane 416, plafond 0,5 % ; 25→100→0 % : 350, tail 1 472 ; 25→75→0 % : 329 à 338.
- **Rampe après 80 (`apres` 0,5)** : même à 0 %, 2 parties sur 6 000 jours touchaient 2 000 pièces. Avec `apres` 0,5 : **0 sur 6 000 jours** (max 1 733). Jusqu'à la série 80 la rampe est celle de B8b ; le test « le poids reste là après rangMax » devient « il monte plus doucement » (remplacé, dit).
- **Coup de pouce 60 → 30 %** (le prompt disait « environ 60 %, qui baisse un peu ») pour tenir la médiane de survie avec l'exigence 1.
- **Poids de base retouchés d'un cran** (barres de 3 / 4 / 5 : 15 / 11 / 6 ; coins 13 ; L et J, grand L, grand T 6) : la nouvelle graine d'essai sortait 22,3 % de pièces de 5 cases ou plus au début (fourchette B8b 15 à 22) et le coup de pouce en ajoute un point (il choisit des pièces qui complètent des lignes). Séries candidates, 1 000 jours : début 8,4 · 24,6 · 45,4 · 21,6 % (dominos, 3, 4, 5+ cases), plafond 5,2 · 14,7 · 44,6 · 35,4 % — **toutes dans les fourchettes de B8b**. **Pièces réellement tirées (bot Diamant) : 8,2 · 24,0 · 44,9 · 23,0 début (5+ cases : 23,0, un point au-dessus de la fourchette), plafond 5,2 · 14,5 · 44,5 · 35,8 % : l'écart est dit, il vient du coup de pouce.** Entorses aux règles de série : 0.
- **Nombres de pièces des bots de référence : 36 / 60 / 90 / 165** au lieu de 30 / 60 / 105 / 180 (`courbe:medailles`) : à 30 / 60 / 105 / 180 les rapports étaient 2,92 · 3,16 · 2,08 (hors 1,5 à 2,5), car les scores croissent plus vite que les pièces (les combos). `&bot` s'arrête à 165 pièces.
- **Les tirages v4 et v5 ne sont pas gardés** (aucun jour figé avec eux, comme le v4 en B8b) ; `dailyBlocks(jour, 4 | 5)` lève.

## Mesures (1 000 jours à partir du 2026-11-02, `npm run mesure:tirage`)
| Série posable, par rang | 0-9 | 10-24 | 25-49 | 50-74 | 75-99 | 100-149 |
|---|---|---|---|---|---|---|
| Bot faible, tiré · **sans adaptation** | 100 · 95,6 | 100 · 81,3 | 98,1 · 77,7 | — | — | — |
| Bot moyen, tiré · sans adaptation | 100 · 99,7 | 100 · 98,1 | 99,5 · 97,1 | 97,9 · 96,4 | 95,8 · 95,4 | 98 · 96 |
| Diamant, tiré · sans adaptation | 100 · 100 | 100 · 99,6 | 99,8 · 99,3 | 99,3 · 98,9 | 98,7 · 98,4 | 98,6 · 98,3 |
Sur des grilles propres (Diamant, moyen) presque toute série est posable même sans adaptation ; sur des grilles abîmées (bot faible) elle ne l'est que 78 à 82 % du temps sans adaptation et **100 % avec, jusqu'à la série 24**. Un humain est entre les deux : **les bots ne montrent donc qu'un effet minimum** (dit). Exigence 1 tenue à 100 % jusqu'à la série 25 sur 1 000 parties du bot moyen (testé).
- **Exigences posées** (Diamant) : exigence 1 100 % (séries 0-24), 76 % (25-49), 27 % (50-74), 0 % ensuite ; exigence 2 52 % (0-9), 54 % (10-24), 47 %, 37 %, puis 30 %. Elle est **tenue** dans 92 à 97 % des séries (le reste : aucune des 40 candidates ne la permet, par exemple les deux premières poses d'une grille presque vide). **Part des séries qui contiennent une pièce qui complète une ligne** : 62 à 69 % (Diamant), 73 à 83 % (moyen), 67 à 80 % (faible). Essais utilisés : 1,3 à 2,2 en moyenne.
- **Survie du Diamant (1 000 jours)** : minimum 26, Q1 230, **médiane 316**, Q3 449, maximum 1 733 pièces ; **6 000 jours : médiane 320, p99 911, plafond atteint 0 fois**. Bot moyen : médiane 113 (Q1 68, Q3 166, max 350).
- **Temps** (poste de dev) : une série se tire en **0,01 ms en médiane, 0,43 ms au p99, 5,6 ms au pire** ; le rejeu serveur d'une partie entière (1 000 parties du Diamant) : **4,1 ms en médiane, 16,2 ms au pire** (borne demandée : 50 ms). N n'est pas réduit.

## Médailles (`npm run calibrer:medailles`, 1 000 jours)
| Médaille | Bot, arrêté après | Q1 · médiane · Q3 | Mort avant | Seuil de la fiche |
|---|---|---|---|---|
| Bronze | moyen, 36 pièces | 678 · 843 · 1 160 | 6,7 % | **850** |
| Argent | moyen, 60 pièces | 1 417 · 1 934 · 2 568 | 20,7 % | **1 900** |
| Or | fort, 90 pièces | 3 572 · 4 604 · 6 284 | 0,8 % | **4 600** |
| Diamant | fort, 165 pièces | — · 11 080 · — | 9 % | **11 000** |
- **Rapports** 2,24 · 2,42 · 2,39 (cible 1,5 à 2,5 ; gardés par `medailles.test.ts`). **Repère humain** : sous les anciennes règles le bot moyen à 54 pièces faisait 1 100 pour 1 200 au joueur expérimenté de Nathan : **rapport 0,92 (environ 1)**, le bot moyen est un repère honnête. L'Argent est le bot moyen à 60 pièces (6 à 8 minutes) : **1 934 → 1 900**. Le Diamant joué sans arrêt le dépasse 91 % des jours. La variation d'un jour à l'autre reste forte (50 à 56 % des jours hors de ±25 % de la médiane).
- **Jours figés** : un jour figé (format 3) porte ses seuils et les garde. Retoucher la fiche ne change **que** les jours qui commencent après le déploiement : « Mettre en production » fige d'abord, avec le code en production, tout jour protégé sans fichier. `bareme` (42 · 17 · 8) n'est plus qu'une indication, sans lien avec les seuils : le test ne le compare plus au calcul (remplacé, dit). `docs/regles/racine/adresses-et-mise-en-production.md` parle encore du calcul par le bot et du format 2 : à mettre à jour par un lot de la plateforme (zone partagée).

## Tests
- **Remplacés** (ils figeaient une suite indépendante de la grille) : `suite.test.ts` (réécrit : déterminisme, séries qui dépendent de la grille, exigences, répartition, temps), `jours.test.ts`, `diamant.test.ts` (« ne voit jamais les séries à venir » : le plan ne lit que la grille et les pièces restantes), `calibrage.test.ts`, `medailles.test.ts` (valeurs de la fiche non figées, calibration à part dans `aide.ts`), le poids du grand T / grand L (7 → 6), `golden` (seuils retirés : la fiche est la donnée). Aucun test désactivé, aucun seuil de test relâché sans mesure.
- **Ajoutés** : exigence 1 à 100 % jusqu'à la série 25 (1 000 parties) et sa baisse mesurée ; coup de pouce ; refus d'une rediffusion trichée (`rediffusion.test.ts`) ; `coup-de-pouce` ; `?debug&tune` ; e2e « une partie à trois séries », « coup-de-pouce », seuils de la fiche à l'écran de fin.

## Vérifié / non vérifié
Vérifié : tests unitaires de `blocks-sim`, de `apps/blocks`, `apps/api/test/blocks*` ; typecheck ; e2e de Blocks en Chromium (87 tests) ; `npm run consignes`. **Non vérifié** : un vrai téléphone, le ressenti du jeu avec le tirage adapté (Nathan), Firefox et WebKit. Le budget `blocks.jsCss` est mesuré par la CI (la fiche importée n'embarque que ce qui se lit : `main-` inchangé à 38,5 Ko).
Pour les joueurs : Blocks est `off` → `rien`.
