# Lot 2 — Les blocs

**Livré**
- **Blocs sur une grille** (`packages/sim/src/track.ts`) : cellules de 32 m, route de 14 m, rebords de 1,4 m. Blocs : droit (`S`), virage à gauche (`L`) / à droite (`R`), montée (`U`) / descente (`D`) de 4 m, bosse (`B`), tremplin (`J`), plaque d'accélération (`P`). Un circuit est un texte : `parseTrack("essai", "S@start S P … S@finish")`. Les blocs s'enchaînent tout seuls (position, cap, hauteur) ; un circuit qui se recoupe est refusé.
- **Physique 3D simple** (`car.ts`, `world.ts`) : la voiture suit le sol (pente, ralentit en montée, accélère en descente), décolle sur les bosses et le tremplin (trajectoire balistique), atterrit sans rebond. Les rebords repoussent et font glisser la voiture ; on les survole si l'on est assez haut. Hors route, c'est le vide : la voiture tombe puis est ramenée au dernier point de contrôle.
- **Course** (`race.ts`) : départ, trois points de contrôle franchis **dans l'ordre**, arrivée ; chrono au pas près, affiné par interpolation au passage de la ligne, en millisecondes entières ; temps intermédiaires ; reprise au dernier point de contrôle (le chrono continue) ; `respawn` fait partie des commandes enregistrables.
- **Circuit d'essai** (`circuits.ts`) : 37 blocs, ~1,2 km, 3 points de contrôle, une montée, une descente, deux bosses, un tremplin, quatre plaques.
- **Web** : rendu du circuit en low-poly (thème « désert », rebords rouge et blanc, tirets centraux, plaques jaunes, portes bleues, damier d'arrivée), décompte 3-2-1, chrono, temps intermédiaires comparés à son meilleur (stocké dans le navigateur), panneau d'arrivée.

**Contrôles** : ZQSD/WASD ou flèches ; **R** = dernier point de contrôle (le chrono continue) ; **Entrée** = repartir du départ (nouveau décompte) ; manette : Y = point de contrôle, Start = départ.

**À tester** : ouvrir l'aperçu (scénario `essai` par défaut, `?scenario=plat` pour le terrain d'essai du lot 1) et faire **un tour complet chronométré**. Le pilote de test, lui, le finit en ≈ 35 s : un humain devrait viser 40 à 60 s. Dis-moi si : les virages sont trop serrés, les rebords trop collants, le tremplin trop faible/fort, le circuit trop long/court.

**Garde-fous** (Vitest, 60 tests)
- `track.test.ts` : lecture du circuit, refus des circuits invalides, ligne médiane continue (blocs bien raccordés, y compris les virages), pentes et rebords.
- `race.test.ts` : un **pilote automatique de test** (`test/helpers/autopilot.ts`, poursuite de la ligne médiane) finit le circuit sans chute ni reprise en passant les 4 portes dans l'ordre ; temps de référence figé bit à bit (`toMatchInlineSnapshot`) ; tremplin, montée, rebords, chute dans le vide, reprise, ordre des portes, arrêt après l'arrivée.
- La physique du lot 1 sur sol plat n'a pas bougé d'un bit (le snapshot du lot 1 passe tel quel).

**Outil de test navigateur** : `?debug` expose `window.__cdj` (`race`, `car`, `phase`) pour les tests Playwright (téléporter la voiture, lire le chrono…).

**Choix à connaître**
- Les virages sont des quarts de cercle de rayon 16 m (route 14 m) : on les passe vers 90 km/h ; les plaques et le tremplin se prennent à plein gaz.
- Pas de banquettes relevées ni de boucles (hors premier jalon). Marche arrière dans le dos du tremplin : la marche de 3 m est un mur.
- Le chrono démarre au « PARTEZ ! » (le décompte n'est qu'à l'écran). Le temps compté pour un classement sera celui d'une course sans « Entrée » : les reprises au point de contrôle sont des commandes, donc rejouables.

**Pas encore fait** : rediffusion et fantôme (lot 3), générateur et vrai pilote de validation (lot 4), tactile.
