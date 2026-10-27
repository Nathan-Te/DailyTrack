# Lot 25 — Lasers (DailyJump, thème néon), W = 4 et génération à froid

Versions : `JUMP_SIM_VERSION` **9** (nouvelle : v3 à v8 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **19** (identifiants `…-g19`, `LASER_GENERATOR`) · `VARIETY_DAYS` **4** (3 pour les références g14 à g18). Branche `ccr-2fbe4e7b-ar5e7t`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`, « Lasers (lot 25) ».

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. (`&solution` et `?semaine` ne fonctionnent que hors production.)

1. **Une barre coulissante, à l'arrêt** : `<aperçu>?module=laser-balayage&variante=0&entree=arret` (un rayon horizontal de 4 tuiles balaie une fosse de haut en bas : sa vitesse ralentit aux extrémités, le trajet est en pointillés) ; `&debug` ajoute `__jump.lasers` ; `&solution` rejoue la solution enregistrée. Autre barre, verticale : `<aperçu>?module=laser-barre-sol&variante=0&entree=arret`. Les portails : `?module=laser-allee&variante=0&entree=arret` (la visée apparaît 0,5 s avant chaque allumage). La galerie : `<aperçu>?modules` (étiquette « laser », sept morceaux).
2. **Un jour de néon g19 qui contient trois morceaux à lasers** : `2026-11-14` (`laser-alterne-portes`, `laser-barre-sol`, `laser-balayage`) :
   - **sans `&debug`** : `<aperçu>?seed=2026-11-14` ; **avec** : `<aperçu>?seed=2026-11-14&debug` (limites des morceaux, `__jump.lasers`, trajets des voies lentes) ; `&solution` rejoue la preuve de l'auteur ;
   - autres jours à deux morceaux ou plus : `2026-11-07` (portails + deux barres), `2026-12-06` (trois), `2026-12-14` ; la semaine d'un coup : `<aperçu>?semaine=2026-11-10&debug`.

## 1. Simulation (v9) — ce qui a été retenu

| point | valeur retenue |
|---|---|
| laser fixe | rayon `h` ou `v` de 1 à 12 tuiles **entre deux `#`** (les émetteurs sont de vrais pleins, refusés sinon) ; `f(t + phase)` : allumé pour `q < allumé`, `q = (phase + décalage) mod cycle` |
| **durées minimales** | **éteint ≥ 120 pas (1 s), allumé ≥ 90 pas (0,75 s)**, cycle ≤ 1 200 — refusées par la lecture du niveau ; testées au pas près (changement d'état au pas exact, décalage compris) |
| mort | bande de **1 024 unités (¼ de tuile)** au milieu des tuiles du rayon, `DEATH_LASER` = 6, à la fin du pas, après l'arrivée ; un bord ne tue pas ; éteint on traverse |
| barre coulissante | rayon toujours allumé de 2 à 8 tuiles, glisse **perpendiculairement à sa longueur** (`h` : monte et descend sur sa colonne ; `v` : va et vient sur sa rangée), trajet ≤ 8 tuiles, cycle pair de 240 à 1 200, table de ralenti `PLATFORM_EASE` du lot 20 |
| **plafond de vitesse** | **160 unités/pas à la pointe (4,7 tuiles/s)** : la pointe de la table vaut `3 × trajet × 4 096 / cycle` (8 tuiles : 620 pas au moins). Justification : moins de la moitié de la course (11 tuiles/s) — un rayon qui tue ne doit pas rattraper qui s'écarte — et sous le plafond des plateformes (256) |
| émetteurs d'une barre | dessinés, **ni solides ni mortels** (aucun plein mobile : comme les presses et les plateformes) |

Règles du générateur (`lasers.ts`) : course à une colonne au moins des bords de sa section ; rien d'autre dans la course (scie, presse, plateforme, autre rayon) ; **aucun point de passage dans la course et sûr à toute phase** (`respawnProblems`, `palierProblems`) ; **une place sûre pour attendre** dans les 5 colonnes devant chaque rayon ; **une barre ne coince jamais** : la tuile qui suit chaque extrême de son glissement est libre (le rayon ne touche jamais un plein). Toutes les règles existantes s'appliquent (solveur, 8 phases avec attente ≤ 12 s, lot 8c, `voies:modules` : 0 variante fermée, plats, reprise près d'une voie lente).

Golden v3 à v8 **identiques au bit** (`daily-golden*.json`, `replay-golden*.json`, y compris v4 à v8 avec W = 3) ; un niveau sans laser est identique en v8 et en v9 sur 1 500 pas ; nouvelles références `…-v9.json` (jour : 14/11/2026).

## 2. Les 7 morceaux du néon (67 variantes, `theme: neon`, réservés à la v9)

Note = la plus haute des deux entrées (`solutions.json`), dans l'ordre des variantes.

| morceau | idée | étiquettes | notes |
|---|---|---|---|
| `laser-allee` | trois portails de sol à plafond, quatre bornes à sauter : on ne s'arrête pas | **respiration** | 1 2 1 1 2 1 2 |
| `laser-serre` | des piliers sur des pics, un portail sur chacun : se poser, attendre l'extinction, repartir dans la fenêtre d'une seconde | précision | 5 5 1 2 5 5 2 4 4 3 |
| `laser-cheminee` | une cheminée traversée par deux rayons horizontaux (mur à mur) | mural, vertical | **4 4 5 4 5 4 5 4 4 5** |
| `laser-balayage` | une fosse balayée de haut en bas par une barre de 4 tuiles | **barre**, précision | 3 2 5 3 3 4 2 3 4 2 |
| `laser-barre-sol` | un sol troué balayé d'un bout à l'autre par une barre verticale de 2 tuiles à enjamber | **barre**, précision | 1 2 1 1 1 1 1 2 1 2 |
| `laser-alterne-portes` | trois portails sur des piliers entre des segments de sol alterné A / B | **lasers + alternés**, précision | 1 4 4 4 2 5 5 3 3 5 |
| `laser-alterne-balai` | des îlots alternés sous une barre qui balaie l'air | **barre + alternés**, précision | 2 1 2 4 2 2 4 2 1 1 |

Demande : 1 respiration (✓ : note ≤ 2 aux deux entrées, au moins trois sauts, testé) · 2 portions dures compatibles avec la voie lente (✓ : `laser-serre`, `laser-cheminee`, `laser-alterne-portes`, `laser-balayage`, aucune variante fermée par `voies:modules`) · 2 morceaux à barre (✓ : trois) · 2 combinaisons avec les alternés (✓ : deux). **`laser-barre-sol` est le plus doux** (notes 1 et 2, pas de portion dure) : voulu comme morceau d'entrée, à durcir plus tard si besoin.

## 3. Variantes et idées refusées (une ligne chacune)

- **Barre verticale de sol à plafond** : infranchissable (un mur de mort qui balaie le couloir) ; jamais écrite. **Barre verticale de 3 tuiles posée sur le sol** : solutions de 5 à 7 s d'attente, exigence 0 (refusées) ; ramenée à 2 tuiles.
- **Dégagement de 2 tuiles autour des extrêmes d'une barre** : empêchait la barre de descendre à deux tuiles d'un îlot, sans protéger personne de plus ; ramené à 1 (aucun plein contre le rayon).
- **Obstacles (pics) sous le trajet d'une barre** : refusés par la lecture (trajet vide) ; remplacés par des fosses à pics dessous.
- **`laser-allee`, portails ouverts ensemble** : l'arrivée au bord de la fenêtre donnait la note 5 ; les fenêtres sont décalées (4 variantes de 10 essayées gardées, puis 3 remplacées au pas près).
- **`laser-serre` v3 (6,06 s)** et **v7** : au-dessus des 6 s d'un morceau / course de 218 pas ; remplacées. `laser-cheminee` v1 : refusée par la validation toutes phases (phases 225 et 262 sur 300) ; remplacée.
- **`laser-alterne-balai` x = 11** : pas de place sûre devant (les îlots B sont absents au départ) ; décalée à x = 7.
- **`laser-alterne-portes` v0, v1, v5, v9** (courses de 129 à 192 pas) : remplacées par des fenêtres plus longues ouvertes plus tôt (≤ 133).
- **Pré-allouer les tableaux de `parseLevel`** : donne des tableaux « troués » (accès plus lents), gain non mesuré ; non retenu.
- **300 tentatives par jour** : insuffisantes (le 11/07/2027, nuit, 798 tentatives) ; 1 000.

## 4. Mesures (120 dates du 16/10/2026 au 12/02/2027, g19 contre g18 du § 5 du lot 24)

| mesure | g18 (lot 24) | g19 |
|---|---|---|
| niveaux de néon · avec au moins un morceau à lasers · avec deux ou plus | — | **23 · 23 · 16** (47 morceaux à lasers sur 243 : 19 %) |
| tirages validés · des composés | 162 (19,1 %) · 29,4 % | 173 (17,2 %) · 30,9 % |
| **niveau de secours utilisé** | **0** (365 dates : 0) | **0** (365 dates : 0) |
| temps de l'auteur (min · moyenne · max) | 28,01 · 29,69 · 31,82 s | 27,98 · 29,49 · 31,97 s |
| morceaux par niveau · exigence par minute | 10,6 · 502,1 | 10,3 · 490,8 |
| voies lentes par niveau · cages montées | 2,0 · 26/238 | 1,9 · 16/225 |
| morceaux en commun entre deux jours consécutifs (moyenne · max) | 0,01 · 1 | 0,03 · 2 (les jours d'avant le 27/10, hors règle) |
| un même morceau sur 7 jours glissants (au plus) | 3 | 3 |
| **plus longue course au sol sans saut** (moyenne · max) | 1,15 s · 1,88 s | **1,25 s** · 2,00 s |
| génération d'un niveau, tirages et rejeux compris (moyenne · max) | 86,5 · 473,8 ms | 97,8 · 474,6 ms |
| budget Jump (JS + CSS, premier chargement) | 342 836 o | 351 324 o (+8 488, marge 27 166) |

La seule mesure qui sort de ses cibles est la **plus longue course au sol sans saut** : attendre qu'un rayon s'éteigne est une course sans saut (W = 4 : +0,03 s, les lasers : +0,07 s). Cible portée de 1,2 à **1,3 s en moyenne** (test et `CLAUDE.md`), maximum de 2 s inchangé.

## 5. W = 4 sur 365 dates (`npm run variete:jump`, `test/variete.test.ts`)

**0 secours, aucun retour avant 4 jours** (écart minimal 4, moyenne 10,87, médiane 7 ; retours avant 5 jours : 17,3 %, avant 7 : 40,9 %) ; 118 morceaux de base employés sur 118 (les 7 morceaux à lasers compris) ; distincts sur 7 / 30 jours glissants : 64,3 / 106,1. Deux jours (le 06/05/2027 en forêt, le 11/07/2027 en nuit) tombaient au secours avec 120 puis 300 tentatives : `DAILY_MAX_ATTEMPTS_LASERS` = 1 000 (un jour qui réussissait garde son tirage). **W = 4 tient**.

**Réserve pour W = 5** (méthode du lot 19, seuil de g14 ; morceaux de base à ajouter, jour moyen · pire jour) : forêt 13 · 20, usine 9 · 15, glace 12 · 20, nuit **17 · 25**, néon 10 · 16 → **≈ 25 morceaux communs** (g18 à W = 3 : ≈ 21). W = 5 reste hors de portée.

## 6. Génération à froid (48 dates, dépendances comprises ; même contenu, même machine)

| | moyenne · maximum |
|---|---|
| avant l'optimisation (W = 4, lasers) | **0,84–0,89 s · 2,2–2,7 s** (2 à 3 dates au-dessus de 2 s) |
| après | **0,38–0,43 s · 1,0–1,2 s** (aucune au-dessus de 1,5 s) |
| 365 dates à froid | 0,38 s · 1,28 s (le 28/08/2027) |

**Niveaux identiques au bit** : l'empreinte sha256 (identifiant, empreinte du niveau, temps de l'auteur, rediffusion, morceaux, médailles, tentatives) des 365 niveaux est la même avant et après (`060e0986…`, 68 s → 35 s). Aucune règle changée. Profil d'abord, puis : tables de positions des plateformes (par plateforme, une fois) ; scies lointaines écartées avant tout calcul (`sawReach`) ; points de passage : trajets entiers écartés d'un rectangle ; clignotants recalculés par groupe et tableau de tuiles déjà conforme retenu ; **un seul rejeu** pour la preuve v4 et les statistiques de course (repli sur l'ancien chemin au moindre cas inhabituel) ; copies d'états champ par champ au lieu de `{ ...état }` (le point chaud) ; fermetures et tableaux retirés du pas.

## 7. Décisions, vérifié, non vérifié

- **Jours** : g19 commence au jour de bascule choisi par « Mettre en production » ; **aucun jour public ni figé touché** (`apps/jump/public/levels/` jusqu'au 27/10, `figes:jump -- --verifier` à jour ; la table des jours figés couvre maintenant les 3 jours d'avant l'origine, les références W = 3 n'en lisent que 2). Démonstration `public/demo/` régénérée (`jump:seed`).
- **À décider (Nathan)** : (1) la cible de la plus longue course moyenne (1,3 s) ; (2) 1 000 tentatives par jour en v9 ; (3) `laser-barre-sol` doux : à durcir ? ; (4) les lasers sont sur **tous** les jours de néon (23 sur 23) : les alternés seuls deviennent rares, à rééquilibrer par le quota si besoin ; (5) **index du `CLAUDE.md` racine** (zone partagée, non touchée) : y ajouter « Lasers (lot 25) » sous `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`.
- **Tests corrigés avec leur raison** : seuil de la plus longue course (ci-dessus) ; versions attendues (`constants`, `stalactites`, `rythme`, `horloge`, `rediffusion`, `smoke.spec`) ; références v9 ; `blocks.test.ts` (le néon a deux mécaniques) ; durée de `plateformes.spec.ts` (14 → 19 s).
- **Vérifié** : tests unitaires (jump-sim, apps/jump, apps/api sur SQLite), e2e Chromium (`plateformes`, dont les trois nouveaux : portails, barre, jour de néon), construction, typecheck, 365 dates sans secours, niveaux identiques avant / après l'optimisation. **Non vérifié** : Firefox et WebKit (la CI complète de `main`), le rendu sur téléphone, la fluidité à ×4.
- **Retouche de lisibilité (retour de Nathan : « de simples barres rouges »)** : affichage seul, rien dans la simulation ni les golden. Aura additive autour du rayon (derrière lui : la bande mortelle reste la seule qui tue), éclair blanc à l'allumage (18 pas), lueur des émetteurs qui se charge avec la visée, explose, puis retombe à l'extinction (30 pas), visée qui grossit avec l'annonce, fil neutre discret du trajet quand le rayon est éteint. Détail : `apps/jump/CLAUDE.md`, « Lasers (lot 25) ». Budget `jump.jsCss` : 352 182 o (+858), marge 26 308. Captures des six états regardées en local (éteint, visée à mi-annonce, visée pleine, éclair, allumé, retombée). Non vérifié : rendu sur téléphone et fluidité ×4.
