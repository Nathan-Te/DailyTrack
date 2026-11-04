# Lot D3b — Le test des mesures de D3, stable sous charge

Suite de D3. Branche `claude/hopeful-fermi-v4mbpf`, PR en brouillon. **Pour les joueurs : rien.** Comportement de `mesures.ts` en production : inchangé (mêmes seuils, même décision, mêmes lignes).

## Le défaut
`apps/api/test/mesures.test.ts` chronométrait un vrai blocage (`occuper(200)`) et attendait le type « calcul » : sur un runner à 2 cœurs chargé (part 4/4), le fil était dépossédé du processeur, le processeur consommé tombait sous la moitié de l'écart et la ligne disait « attente ».

## Ce qui change
- **`src/mesures.ts`** : la décision est séparée de la mesure — `typeDeBlocage(cpuMs, ecartMs)` (« calcul » si le processeur couvre au moins la moitié de l'écart), `analyserPassage({ maintenant, dernier, pasMs, cpu, dernierCpu })` et `cpuDuFil(proc)` (repli sur `process.cpuUsage` sans `threadCpuUsage`) sont des fonctions pures exportées. `creerMesures` accepte `horloge` et `cpu` (défauts : `performance.now`, `cpuDuFil`) et rend `passage` et `releve` (la sentinelle et le relevé, appelables à la main).
- **`test/mesures.test.ts`** : décision et cas limites (moitié exacte, juste en dessous, écart nul, horloge qui recule) ; sentinelle pilotée par une fausse machine (calcul, attente, seuil, bornes de 10 lignes par minute, hors requête, relevé, étapes d'un envoi lent) ; aucune durée réelle. **Aucune assertion retirée sans équivalent** : « calcul » et « attente » sont sur valeurs injectées ; le test de vie privée force un envoi lent par une horloge injectée (il vérifie maintenant des lignes qui existent toujours).
- **Le vrai blocage** est gardé dans un seul test qui ne vérifie que ce que la charge ne change pas : une ligne bien formée (mêmes champs, route présente, type ∈ {calcul, attente}, retard ≥ 150 ms pour un blocage de 200 ms, aucun identifiant). Pas d'outil à part : il ne dépend plus de la machine.
- **`test/niveauxFil.test.ts`** : `reponseMs < 3000` (durée réelle) remplacé par une porte fermée qui retient le calcul du niveau — la réponse doit revenir quand même, rien n'est prêt tant que la porte est fermée.
- Revus sans changement (aucune durée réelle en jeu) : `towerFil` (délai de 1 ms : un rejeu ne peut qu'être plus lent), `admin`, `envoiLent` du profil.
- `apps/api/CLAUDE.md` : une ligne.

## Vérifié
`tsc -b apps/api` ; `mesures`, `niveauxFil`, `towerFil` sur SQLite **et** libSQL ; `mesures` six fois de suite avec 12 boucles de processeur sur 4 cœurs : 26/26 à chaque fois.

## CI
Critère d'arrêt : trois runs verts de la PR d'affilée sur la part 4/4. **Non vérifié à l'écriture** (liens des runs à ajouter ci-dessous).
