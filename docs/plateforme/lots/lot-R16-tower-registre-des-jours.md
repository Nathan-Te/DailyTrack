# Lot R16 (plateforme) — Les jours de Tower ne changent jamais, même sans fichier

Branche `claude/sharp-turing-eiyere`, PR brouillon. Aucune version montée, aucun golden touché, aucun fichier de jour existant modifié, aucune dépendance. **Pour les joueurs : rien.**

## 1. Diagnostic
- **Comment Tower trouve le niveau d'un jour** : le jeu (`apps/tower/src/jour.ts`, `chargerJour`) lit le fichier figé `jours/AAAA-MM-JJ.json` s'il existe, **sinon `dailyTower(jour, TOWER_GENERATOR_VERSION, tirage)`** (version courante). Le serveur fait pareil (`apps/api/src/tower.ts`, `calculer` : fichier validé, sinon `dailyTower(day, TOWER_GENERATOR_VERSION, 0)` + `estimationGeometrique`), et l'empreinte du garde-fou aussi (`apps/api/scripts/empreintes-tower.ts`). Il n'y avait **aucun registre de versions**.
- **Quels jours** (sorties des mises en production : PR « Jours figés » `0f57463` et `0023778`, `apps/api/test/jours-passes.json`, sans lire la base) : 15 fichiers (`2026-11-03` → `2026-11-17`, g3), tous en avant de la bascule ; **les 7 jours protégés `2026-10-27` → `2026-11-02` de `jours-passes.json` (clé `tower`) n'avaient pas de fichier**, de même que `2026-10-16` → `2026-10-26` (comparés par le garde-fou depuis le plus ancien niveau de Jump). `planTower` les classait « protégé sans fichier : rien n'est créé pour eux ».
- **Le risque était réel** : à la prochaine `TOWER_GENERATOR_VERSION`, ces jours auraient pris le nouveau générateur. Le garde-fou (empreintes) l'aurait vu et **arrêté la mise en production, sans aucun moyen de la débloquer** (rien ne créait le fichier) ; sans lui, rediffusions refusées et classements faux.
- **Test avant correction** (`apps/api/test/towerJoursFiges.test.ts`, générateur factice « g4 » par `vi.mock`, le vrai reste à 3) — résultat écrit **avant** la correction : 4 verts, **2 rouges** : `chaque jour gardé a son fichier` (« 2026-10-27 : un jour protégé a toujours son fichier » : faux) et `un jour connu prend sa version` (reçu `tower-2026-10-27-g4-t0`, attendu `g3`). Le test « sans fichier, l'empreinte change » était vert : c'est la démonstration du risque. Après la correction : 6 verts.

## 2. Le mécanisme : **un fichier pour chaque jour servi**, sans exception
Choisi plutôt qu'un registre de plages : (a) c'est ce que dit déjà la fiche (`config/jeux/tower.json` : `jours.mode = "fichier-par-jour"`, rien à y changer) ; (b) **aucune lecture nouvelle** dans le jeu, le serveur, l'image ni le site (ils lisent déjà le fichier ; le budget de Tower ne bouge pas : `tower.jsCss` 39 885 o) ; (c) le fichier fige aussi le tirage, le thème, les paliers et le vent ; (d) le registre aurait demandé de toucher les trois lecteurs et les artefacts.
- **Job `figer`** (`production.yml`, nouvelle étape *avant* la comparaison des empreintes) : `tower-a-figer` liste les jours **protégés** (de `proteges.debut` à la veille de la bascule) sans fichier ; `figer:tower` les fige **dans le dépôt du code en production** (ce qu'il sert est ce qu'il fige) ; `tower-figes-poser` les pose dans la construction (donc l'artefact `jours-tower`, le serveur, le site et le dépôt par « Jours figés dans main ») et **arrête s'il en manque un** ou s'il diffère d'un fichier déjà là. Code de production sans Tower (première fois) : rien à figer.
- Un jour connu prend la version de son fichier ; un jour inconnu la plus récente ; `GENERATEURS` garde les anciennes versions (test : toute version nommée par un fichier est appelable).
- **Rattrapage unique** : les 18 jours protégés sans fichier (`2026-10-16` → `2026-11-02`, g3, 465–470 o chacun) sont commités ici, produits par `figer:tower` avec le code actuel (= celui de la production). Vérifié : la chaîne du job rejouée en local refait ces 18 fichiers **octet pour octet**.

## 3. Le garde-fou de R6
Il comparait déjà Tower (lot TP). Test ajouté : un jour protégé de Tower qui change donne `❌ **Tower …**` et `⛔ **La mise en production s'arrête**`, les mêmes phrases que pour Track et Jump.

## 4. `jours-passes.json`
`jours-passes.test.ts` : Tower a **les mêmes jours que Track et Jump**, et chacun a son fichier dont la version est celle de l'identifiant. Le fichier d'empreintes n'a pas changé.

## Tests
`towerJoursFiges.test.ts` (factice : aucun jour figé ne change ; connu → sa version, inconnu → la dernière ; le Diamant et les seuils d'un jour préparé ne bougent pas ; versions appelables), `jours-passes.test.ts`, `miseEnProduction.test.ts` (`towerAFiger`, `towerFigesAPoser`, `plagesConsecutives`, phrases du garde-fou).

## Ce que K2 devra unifier
Trois mécanismes (registre de Track, niveaux de Jump, fichiers de Tower) derrière `jours.mode` ; une seule étape « figer » pilotée par la fiche. K1 est fusionné : `jours.mode` de Tower était déjà `fichier-par-jour`, `npm run fiches` inutile.

## Réserves (décisions pour Nathan)
- Les médailles d'un jour figé **sans préparation** restent l'estimation géométrique du code (`COEFFICIENT_GEOMETRIQUE_PCT`), non écrite dans le fichier : changer ce coefficient arrêterait la mise en production (fail-closed). Les jours préparés gardent leurs seuils et leur Diamant écrits. Les figer dans le fichier toucherait le jeu (budget `tower.jsCss`, marge ≈ 100 o) : hors périmètre.
- Premier essai réel de l'étape : le mode `essai` lancé par Nathan après la fusion (résumé attendu : « 0 jour à figer », les 18 fichiers étant dans `main`).

## Vérifié / non vérifié
Vérifié en local : typecheck ; unitaires listés ci-dessus (74 fichiers, 783 tests) ; spec `poids` de Tower ; `securite-workflows.mjs` (12 workflows, 0 écart) ; répétition locale du garde-fou avec `HEAD` comme code en production : **0 différence**, Tower 18 conservés. **Non vérifié** : l'exécution réelle du job (un agent ne lance pas de workflow), les e2e complets en local. CI de la PR : voir le commentaire de fin de session.
