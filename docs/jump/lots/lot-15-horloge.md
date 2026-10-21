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
- **Compatibilité v3** : le comportement v3 est choisi par la version du niveau, au bit près. Une rediffusion porte la version de son niveau et ne se rejoue que sur lui. Niveaux v3 : essai, dangers, bac à sable, vent, morceaux seuls (le solveur et `solutions.json` restent v3 : `MODULE_SIM_VERSION`), jours figés du 16 au 22/10/2026. **Golden v3 identiques** (`golden.json`, `replay-golden.json`, `essai-solution.json`, et `daily-golden.json`, que `dailyLevel(jour, thème, 3)` rend encore au bit près). Côté client (mémoire du jour, fantôme du premier, carnage de tout le monde, cache) et côté API (`jump.ts`, `jumpLives.ts` via `checkLife`) la version attendue est celle du niveau. `ghost/first` rend les versions **du serveur qui le sert** (comme `/carnage` et `/api/jump/me`), et non plus celles gardées dans `jump_results` : un premier classé par le serveur d'avant (v3, g9) reste servi au jeu v4, qui vérifie la version propre de la rediffusion contre celle du niveau (relevé par le contrôle de fumée de la recette, test « premier enregistré par le serveur d'avant » dans `apps/api/test/jump.test.ts`).

**Affichage (`apps/jump`)** — le « Prêt… » (1 s, réglable dans `?debug&tune`, section Caméra) commence au premier pas joué, donc à la fermeture de l'accueil ; message « Prêt… » puis « Partez ! ». Pendant le « Prêt… », l'état montré est celui du chrono négatif (`readyAttempt`) : les dangers bougent déjà, sans saut au départ ; rien n'est simulé ni enregistré ; le chrono affiché reste à 0. La pause fige tout. « Recommencer » / « Rejouer » relancent le « Prêt… ». `?debug` : surimpression « horloge v4 · phase · période · cycle », limites des morceaux avec `phase p / période`, `__jump.pret`, `__jump.go()` ; `__jump.autoplay` donne le départ tout de suite.

**Générateur (g10)** — assemblage et preuve inchangés (en v3), puis phase de chaque section = `−(pas où la preuve y entre)` modulo sa période (`phasesFromEntries`), passage en v4 (`withSingleClock`) et **nouveau rejeu de la preuve en v4 : mêmes commandes, même temps, sans mort**, sinon le tirage est refusé. Règle de `dailyProblems` en v4 : **chaque point de reprise (`S`, `C`) est sûr à toute phase** (`respawnProblems` : aucune scie à aucun pas de son cycle dans la boîte du palier, ni pic, ni bloc, ni vent ; sol plein et immobile).

**Validation toutes phases** (`npm run phases:modules -w @cdj/jump-sim`, `tools/phases.ts`) — pour chaque variante utilisable dont l'horloge tourne : le morceau seul passé en v4 à **8 phases réparties sur sa période** (`phasesOf`), repris **à l'arrêt** sur son palier d'entrée (= la reprise sur son point de passage), recherche (attendre est permis), durcissement, repli robuste, puis la règle du lot 8c (gigue ±3 ≥ 50 %, appuis du lot 11). `modules/phases.json` garde verdicts et solutions ; `src/phases.ts` (`PHASE_REFUSED`) liste les variantes refusées, que le générateur v4 ne pose jamais. La règle n'est pas relâchée.

## 3. Validation toutes phases : morceaux corrigés ou écartés
- **116 variantes** utilisables ont une horloge (scies mobiles, clignotants, rafales) ; **928 reprises** essayées (8 phases par période ; toutes si la période est plus courte). Calcul : ≈ 1 h sur 4 fils (`phases:modules`), puis une passe de 2,5 min sur les refusées avec le candidat ci-dessous.
- **Premier passage : 37 variantes refusées.** La recherche seule trouvait des solutions trop justes à certaines phases (attendre au bon moment sur le palier n'émergeait pas du faisceau). **Correction de l'outil, pas de la règle** : premier candidat de chaque phase = attendre sur le palier jusqu'à retrouver la phase où la solution « arrêt » stockée rencontrait l'horloge, puis la jouer ; la gigue ±3 est mesurée sur toute la suite (l'instant du départ compris, ce que la v3 ne mesurait pas : son horloge partait avec le joueur). 35 variantes passent alors.
- **Écartées (2)**, la règle n'est pas relâchée ; le générateur v4 ne les pose plus (`PHASE_REFUSED`) :

| variante | phases sans solution jouable (sur la période) | ce qui casse |
|---|---|---|
| `cheminee-scie` v3 | 0 et 75 (sur 600) | la gigue ±3 tombe sous 50 % : la scie de la cheminée passe juste quand le saut mural doit partir |
| `nuit-opposition` v4 | 187 et 225 (sur 300) | deux groupes de clignotants en opposition : à ces phases, aucune attente ne laisse une fenêtre assez large |

Aucune n'a été corrigée par un mutateur dans ce lot (proposition : `cheminee-scie` v3 avec un cycle plus lent, `nuit-opposition` v4 avec le profil `lent` ; à résoudre et revalider avec `solve:modules -- --only=…` puis `phases:modules -- --only=…`).
- **À regarder (décision pour Nathan)** : `scie-sol` v3 a deux scies aux cycles peu compatibles (période commune 6 600 pas = 55 s) ; à la phase 1 650, la seule solution jouable attend ≈ 55 s sur le palier. Elle passe la règle, mais un joueur ne le fera pas : la corriger (cycles commensurables) ou l'écarter. Les autres reprises sortent en moins de 12 s (médiane 3,3 s).
- **Points de reprise** : la règle « sûr à toute phase » (`respawnProblems`) n'a refusé aucun tirage sur 120 dates (le palier standard du lot 6 l'assurait déjà pour les scies ; elle est maintenant écrite et vérifiée).

## 4. Le générateur g10 mesuré (`npm run measure:jump`, 120 dates)
- **Secours : 0** ; tirages validés **50,3 %** (64,6 % des composés) ; temps de l'auteur 28,03–31,87 s, moyenne 29,5 s. Par thème : forêt 48,4 %, usine 37,5 % (35,5 % au lot 13), glace 58,0 %, nuit 49,1 %, néon 56,5 % — secours 0 partout, thème forcé compris.
- Avant le candidat « attendre puis rejouer », les 37 refus vidaient l'usine (`tapis-relais` refusé : 6,9 % de tirages validés, **7 jours de secours sur 16**) : c'est ce qui a fait corriger l'outil plutôt que les seuils.

## 5. Jours régénérés et temps de référence avant / après
**Aucun jour public n'est touché.** Le 22/10/2026 a été **figé avec le code v3** (`freeze:days -- demain` avant tout changement, g9) ; les jours figés du 16 au 22/10 restent en v3 et se rejouent tels quels (jeu, serveur, fantômes, vies). Il n'y avait aucun jour figé au-delà : **les jours régénérés sont ceux qui seront générés par g10 à partir de J+2** (la PR date du 21/10/2026) ; deux semaines sont testées (`horloge.test.ts` : référence sans attente, toutes phases rejouées dans le niveau, points de reprise sûrs) :

| date | thème | identifiant | auteur v3 (g9) | auteur v4 (g10) | écart (pas) | morceaux | sections qui tournent |
|---|---|---|---|---|---|---|---|
| 2026-10-23 | usine | `jour-2026-10-23-g10` | 28,767 s | 28,758 s | −1 | autres (tirage) | 4 / 10 |
| 2026-10-24 | forêt | `jour-2026-10-24-g10` | 29,858 s | 29,817 s | −5 | autres (tirage) | 3 / 12 |
| 2026-10-25 | nuit | `jour-2026-10-25-g10` | 29,458 s | 29,508 s | +6 | autres (`nuit-opposition` v4 refusée) | 6 / 12 |
| 2026-10-26 | glace | `jour-2026-10-26-g10` | 29,283 s | 29,425 s | +17 | autres (tirage) | 1 / 12 |
| 2026-10-27 | forêt | `jour-2026-10-27-g10` | 29,633 s | 29,633 s | 0 | mêmes | 6 / 12 |
| 2026-10-28 | néon | `jour-2026-10-28-g10` | 30,925 s | 30,925 s | 0 | mêmes | 3 / 11 |
| 2026-10-29 | forêt | `jour-2026-10-29-g10` | 30,325 s | 30,325 s | 0 | mêmes | 5 / 11 |
| 2026-10-30 | néon | `jour-2026-10-30-g10` | 28,708 s | 29,417 s | +85 | autres (tirage) | 4 / 11 |
| 2026-10-31 | nuit | `jour-2026-10-31-g10` | 29,092 s | 29,208 s | +14 | autres (tirage) | 7 / 12 |
| 2026-11-01 | forêt | `jour-2026-11-01-g10` | 29,225 s | 29,225 s | 0 | mêmes | 4 / 11 |
| 2026-11-02 | glace | `jour-2026-11-02-g10` | 30,100 s | 29,083 s | −122 | autres (`cheminee-scie` v3 refusée) | 4 / 10 |
| 2026-11-03 | forêt | `jour-2026-11-03-g10` | 29,917 s | 29,917 s | 0 | mêmes | 4 / 10 |
| 2026-11-04 | néon | `jour-2026-11-04-g10` | 29,483 s | 28,825 s | −79 | autres (tirage) | 3 / 9 |
| 2026-11-05 | glace | `jour-2026-11-05-g10` | 30,042 s | 30,042 s | 0 | mêmes | 3 / 12 |

« autres (tirage) » : le catalogue v4 sans les 2 variantes refusées change les listes où le tirage pioche, donc parfois la suite tirée, même sans variante refusée dans la suite v3. **À composition égale, le temps de la référence est exactement le même** (la référence passe sans attendre : mêmes commandes, même temps, vérifié pour chaque niveau g10 par le générateur). Écarts sur les 14 jours : de −1,02 s à +0,71 s, tous dans la cible 25–40 s. **Calibration des médailles (lot 17) non touchée** : les médailles suivent toujours le temps de l'auteur (×1,10 / ×1,30 / ×1,60).

## 6. Vérifié / non vérifié
- **Vérifié** : `npm test` (projet sqlite complet : 2 385 tests ; tests DailyJump de l'API aussi sur libSQL) ; `npm run typecheck` ; golden v3 **identiques** (`golden.json`, `replay-golden.json`, `essai-solution.json`, `dangers-solution.json`, `daily-golden.json` rendu par `dailyLevel(jour, thème, 3)`) ; golden v4 ajoutés (`daily-golden-v4.json`, `replay-golden-v4.json` : preuve, essais fictifs, vies reprises au départ et aux points) ; rediffusions v3 côté jeu (mémoire, fantôme du premier, carnage de tout le monde, jours figés) et côté serveur (`apps/api/test/jump.test.ts` : la preuve v3 du 22/10 se classe, ses vies v3 sont rejouées, une rediffusion marquée v4 y est refusée, et l'inverse le lendemain) ; e2e Jump dans Chromium en local (dont `horloge.spec.ts` : les dangers bougent pendant le « Prêt… », départ sans commande, pause qui fige tout, jour v3 qui attend) ; budget de poids (`poids.spec.ts`, −7 923 o) ; zones de la PR (`zones-jeu.mjs`).
- **Corrigé après la première CI** : `fantome-premier.spec.ts` jouait 120 pas sur le jour de la démo (maintenant v4) sans donner le départ : selon la vitesse de la page, une partie des pas allait au « Prêt… » (29 et 54 pas au lieu de plus de 100 sur le runner) ; il appelle `__jump.go()` (règle du lot). Le golden v4 (`horloge.test.ts`, ≈ 3 s seul) dépassait le délai par défaut de 5 s sur le runner chargé : délai de 60 s, comme les autres tests lourds du fichier, aucune assertion changée.
- **Non vérifié en local** : Firefox et WebKit (`replay.spec.ts` compare maintenant aussi les empreintes v4 ; la CI le fait) ; la fluidité ressentie du « Prêt… » sur téléphone.

## 7. Décisions laissées à Nathan
1. **Mort avant le premier point de passage** : en v4 on reprend **au départ, chrono qui continue** (même essai) ; seul « recommencer » remet le chrono à 0 (avec un nouveau « Prêt… »). C'est la conséquence directe de « une horloge qui ne s'arrête jamais » ; l'ancien « nouvel essai à zéro » aurait remis les dangers à leur phase de départ.
2. **Friables et blocs alternés** sont remis en état à la reprise (ce ne sont pas des horloges) : à confirmer.
3. **Carnage** : les dangers dessinés sont ceux du héros ; une vie reprise plus tard (son chrono à elle) voit ses dangers ailleurs. Le léger décalage accepté au lot 3 est plus visible en v4 ; piste : faire partir chaque vie au chrono de son départ.
4. `scie-sol` v3 (attente de 55 s à une phase) et les 2 variantes écartées (§ 3).
5. Durée du « Prêt… » : 1 s (`?debug&tune`, section Caméra).

## 8. Scénario en 2 clics
Aperçu de la PR (branché sur la révision de recette `https://b-claude-youthful-nqyd4f---cdj-api-recette-5qi6aa4qqa-ew.a.run.app`), un jour régénéré (v4, g10), le 25/10/2026 :
- https://playdujour-recette--pr-105-qbrpzjv6.web.app/jump/?seed=2026-10-25
- https://playdujour-recette--pr-105-qbrpzjv6.web.app/jump/?seed=2026-10-25&debug

En local (`npm run dev:jump`) : `http://localhost:5173/?seed=2026-10-25` et `…&debug`.

À voir : à la fermeture de l'accueil, « Prêt… » pendant 1 s, les scies et les clignotants bougent déjà ; « Partez ! » et le chrono part même sans toucher à rien. Mourir avant le premier fanion : reprise au départ, le chrono continue, les dangers ne se remettent pas à zéro. La pause fige tout. Avec `?debug` : la surimpression « horloge v4 · phase · période · cycle » et `phase p / période` sur les limites des morceaux.

## Retouche — `horloge.spec.ts` sur WebKit (CI complète de `main`)
Après la fusion, la CI complète de `main` (runs 39681125858 et 39682594613) échouait sur WebKit seulement, relance comprise : le premier test lisait le « Prêt… » juste après le chargement en le supposant intact (`expect(s0.pret.ticks).toBe(s0.pret.total)` : 100 ou 101 reçus au lieu de 120). La boucle en temps réel en avait déjà consommé une partie avant le passage en pas à pas. C'était une dépendance au temps réel, et le jeu n'y était pour rien. Correction : comme le deuxième test du même fichier, `manual(true)` puis `restart()` avant de lire, ce qui donne un « Prêt… » neuf et entièrement en pas à pas. Le test n'a pas été affaibli : il fait les mêmes vérifications. WebKit ne tourne pas dans la CI d'une PR. La preuve est donc la CI complète lancée par `[ci complet]`.
