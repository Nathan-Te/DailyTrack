# Lot 15 — Horloge unique des dangers (DailyJump)

Retour de Nathan : « les dangers attendent le joueur pour se lancer ». Décisions validées : **une seule horloge de course**, qui ne s'arrête jamais (sauf en pause) ; **à la mort, les dangers continuent leur course** (rien n'est remis à zéro, comme dans Super Meat Boy).

Versions : `JUMP_SIM_VERSION` **4** (le code joue aussi la v3, version inscrite dans chaque niveau) · `JUMP_GENERATOR_VERSION` **10** (identifiants `…-g10`). Consignes : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`, « Horloge unique (lot 15) ».

## 1. État des lieux : comment les dangers « attendaient » (v3)
Trois mécanismes, tous dans `packages/jump-sim/src/attempt.ts` :
1. **Le monde attend la première commande** (`ATTEMPT_READY`) : tant que le joueur ne bouge pas (une direction, ou un saut appuyé), aucun pas n'est joué, le chrono reste à 0, rien ne bouge.
2. **Activation par section, à l'approche** : chaque morceau est une section (`section <nom> <c0>-<c1>`) ; son horloge démarre au premier pas où **le centre du personnage entre dans ses colonnes** (`AttemptState.sections[i]` = pas d'entrée ; phase = pas écoulés depuis, **0 avant** : l'élément attend à son départ). C'est ce qui donnait les scies figées qui démarrent quand on arrive.
3. **Remise à zéro à la mort** : la reprise sur un point de passage remet à l'arrêt les sections du point et d'après (`checkpointAttempt`) ; sans point, la mort termine l'essai et tout repart de `initialAttempt`.

Éléments concernés (tout ce qui lit `sections`) :

| élément | thème | lecture de l'horloge (v3) | v4 |
|---|---|---|---|
| scies mobiles (`scie … aller-retour|boucle`, mutateur `+patrouille`) | tous | `sawPhase` → `sawCenter` | `f(t + phase)` |
| blocs clignotants `b` / `d` (`clignote`) | nuit | `settleDynamic` → `blinkIsSolid` | `f(t + phase)` |
| rafales des zones de vent (`vent … rafale`) | forêt | `windPhase` → `windBlows` | `f(t + phase)` |
| blocs alternés `A` / `B` | néon | parité des sauts (pas une horloge) | inchangé (remis à A à la reprise) |
| scies fixes, pics, ressorts, tapis, glace, vents sans rafale | — | aucune horloge | inchangé |
| blocs friables | — | minuterie au contact | inchangé (reposés à la reprise) |

## 2. Ce qui a changé
**Simulation (v4, `Level.simVersion`)** — ligne `version 4` du bloc annexe ; `section <nom> <c0>-<c1> phase <p>`.
- Tout élément cyclique vaut `f(t + phase)` : `sectionClock` est la seule lecture de l'horloge ; `cycleMod` lit une phase négative. **Plus aucune activation par proximité** : `sections` reste vide dans l'état.
- **Le chrono part au premier pas, commandé ou non.** Le jeu le donne à la fin du « Prêt… ».
- **Mort** : rien ne revient à zéro. Reprise sur le dernier point de passage, ou **au départ si aucun point n'est pris, chrono qui continue** (`respawnAttempt`) : dans un niveau à une seule horloge, un essai ne finit qu'à l'arrivée ou par « recommencer » (sinon le chrono repartirait à 0 avec des dangers ailleurs). Rediffusion : drapeau de départ 8 « reprise au départ » ; `lifeStartProblem` v4.
- **Compatibilité v3** : le comportement v3 est choisi par la version du niveau, au bit près. Une rediffusion porte la version de son niveau et ne se rejoue que sur lui. Niveaux v3 : essai, dangers, bac à sable, vent, morceaux seuls (le solveur et `solutions.json` restent v3 : `MODULE_SIM_VERSION`), jours figés du 16 au 22/10/2026. **Golden v3 identiques** (`golden.json`, `replay-golden.json`, `essai-solution.json`, et `daily-golden.json`, que `dailyLevel(jour, thème, 3)` rend encore au bit près). Côté client (mémoire du jour, fantôme du premier, carnage de tout le monde, cache) et côté API (`jump.ts`, `jumpLives.ts` via `checkLife`) la version attendue est celle du niveau.

**Affichage (`apps/jump`)** — le « Prêt… » (1 s, réglable dans `?debug&tune`, section Caméra) commence au premier pas joué, donc à la fermeture de l'accueil ; message « Prêt… » puis « Partez ! ». Pendant le « Prêt… », l'état montré est celui du chrono négatif (`readyAttempt`) : les dangers bougent déjà, sans saut au départ ; rien n'est simulé ni enregistré ; le chrono affiché reste à 0. La pause fige tout. « Recommencer » / « Rejouer » relancent le « Prêt… ». `?debug` : surimpression « horloge v4 · phase · période · cycle », limites des morceaux avec `phase p / période`, `__jump.pret`, `__jump.go()` ; `__jump.autoplay` donne le départ tout de suite.

**Générateur (g10)** — assemblage et preuve inchangés (en v3), puis phase de chaque section = `−(pas où la preuve y entre)` modulo sa période (`phasesFromEntries`), passage en v4 (`withSingleClock`) et **nouveau rejeu de la preuve en v4 : mêmes commandes, même temps, sans mort**, sinon le tirage est refusé. Règle de `dailyProblems` en v4 : **chaque point de reprise (`S`, `C`) est sûr à toute phase** (`respawnProblems` : aucune scie à aucun pas de son cycle dans la boîte du palier, ni pic, ni bloc, ni vent ; sol plein et immobile).

**Validation toutes phases** (`npm run phases:modules -w @cdj/jump-sim`, `tools/phases.ts`) — pour chaque variante utilisable dont l'horloge tourne : le morceau seul passé en v4 à **8 phases réparties sur sa période** (`phasesOf`), repris **à l'arrêt** sur son palier d'entrée (= la reprise sur son point de passage), recherche (attendre est permis), durcissement, repli robuste, puis la règle du lot 8c (gigue ±3 ≥ 50 %, appuis du lot 11). `modules/phases.json` garde verdicts et solutions ; `src/phases.ts` (`PHASE_REFUSED`) liste les variantes refusées, que le générateur v4 ne pose jamais. La règle n'est pas relâchée.

<!-- RÉSULTATS -->
