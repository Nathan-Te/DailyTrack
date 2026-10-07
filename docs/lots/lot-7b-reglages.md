# Lot 7b — Les réglages de Nathan

**À essayer** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=pilotage
(l'aperçu est publié par la CI à chaque push de la branche ; `&debug&tune` pour retoucher encore au panneau)

**Livré**
- Le JSON copié du panneau est appliqué tel quel comme **valeurs par défaut de `CarParams`** (39 clés, aucune manquante ni en trop). 12 valeurs changent, les 27 autres étaient déjà celles du lot 7 :

| Réglage | Lot 7 | 7b (Nathan) |
|---|---|---|
| `maxSpeed` (pointe) | 42 m/s (151 km/h) | **48 m/s (173 km/h)** |
| `steerMax` / `steerAtLimit` / `steerSpeed` | 0,55 / 1,15 / 12 | 0,5 / 1,2 / 14 |
| `slipPeak` / `slideGrip` | 0,11 / 0,78 | 0,14 / 0,82 |
| `driftGrip` / `driftAngle` / `driftPull` | 0,45 / 0,42 / 45 | **0,6 / 0,32 / 33** (dérapage plus doux) |
| `gravity` | 22 | 24,6 |
| `wallBounce` / `wallFriction` | 0,25 / 0,22 | **0,6 / 0,3** (rebords plus durs) |

- `SIM_VERSION` **3**, `GENERATOR_VERSION` **3** ; références régénérées (`golden.test.ts`, `golden-daily.test.ts`, instantanés de `car.test.ts` et `race.test.ts`). Les courses et records enregistrés avec la version 2 sont refusés ou ignorés (message clair, comme au lot 7).
- **Pilote et générateur réajustés** — deux ajustements, tous deux mesurés :
  1. *Règle du générateur : deux lignes droites derrière chaque plaque d'accélération* (`PAD_RUNOUT`). La plaque pousse 0,9 s à 30 m/s², le frein ne fait que 40 : à 48 m/s, une plaque suivie d'un virage serré à moins de ~80 m **ne se prend pas** (le pilote n'a fini que **28 circuits sur 91** avec les nouveaux réglages ; avec la règle, **90 sur 92**). Ce n'est pas qu'un défaut du pilote : le jeu doit rester jouable pour un humain.
  2. *Marge du pilote aux rebords portée de 1,9 à 3,6 m (sa trajectoire reste à 3,4 m de l'axe au plus, au lieu de 5,1 m)* : avec des rebords à 0,6 de rebond, frôler un rebord coûte cher, et la trajectoire serrée touchait chaque virage du circuit d'essai.
- **Circuit d'essai** (`TEST_TRACK_SPEC`, lot 2) : la règle ci-dessus s'applique aussi à lui (le pilote s'y crashait à chaque virage) : une plaque déplacée (`P S S R`), une retirée (`P B S R` : on décolle sur la bosse, donc on ne freine plus). **3 plaques** au lieu de 4, géométrie et 37 blocs inchangés.
- **Tests de comportement mis à jour** (`conduite.test.ts`) : pointe 48 m/s ; arrêt depuis la pointe en moins de 32 m et 1,4 s ; braquage tenu essayé aussi à 48 m/s ; **épingle** : le test comparait un seul dérapage à sept essais de grip, il compare maintenant le meilleur des deux camps et à trois vitesses d'approche. Nouveau test du générateur : deux blocs sans virage après chaque plaque.

**Mesures** (Node, lot 7 → 7b)
| | Lot 7 | 7b |
|---|---|---|
| 0 → 100 km/h | 1,69 s | 1,59 s |
| Arrêt depuis la pointe | 22 m, 1,07 s (depuis 42 m/s) | 28,7 m, 1,22 s (depuis 48 m/s) |
| Adhérence latérale, braquage à fond (30–48 m/s) | ≈ 40 m/s² | 38–40 m/s² ; dérive 4–6° |
| Cap tourné en 0,25 s à 30 m/s | — | 12° |
| Demi-tour en épingle à 38 / 44 / 48 m/s (meilleur dérapage contre meilleur grip) | 1,27 / 1,53 / 1,69 s contre 1,80 / 1,93 / 2,00 s | **1,35 / 1,70 / 1,97 s contre 1,88 / 2,02 / 2,12 s** : le dérapage reste plus rapide, mais l'écart fond à haute vitesse |
| Pilote, circuit d'essai | 33,2 s | 31,7 s (meilleur des 4 niveaux) |
| Temps de l'auteur, 60 jours consécutifs | 28,3 – 43,6 s (médiane 35,6) | 28,1 – 45,5 s (médiane 36,7), tous dans la fenêtre 28–48 s |
| Génération d'un circuit (60 jours, sous Vitest) | moyenne 101 ms, pire 180 ms | moyenne 113 ms, pire 231 ms |

**Décisions / à regarder**
- À 48 m/s, les **virages larges** (rayon 48 m) ne se prennent plus à fond : 48²/48 = 48 m/s² demandés pour ≈ 40 disponibles. C'est voulu (il faut lever le pied) ; le pilote le fait.
- Les temps de l'auteur ont **peu baissé** (médiane 36,7 s) malgré 14 % de vitesse en plus : les circuits ont de la distance à parcourir en plus (lignes droites derrière les plaques) et le pilote freine pour les virages. La fenêtre 28–48 s est inchangée ; si les circuits te paraissent trop longs ou trop courts, `AUTHOR_MIN_MS` / `AUTHOR_MAX_MS` se règlent d'un coup.
- Les seuils de médailles restent à recaler sur de vraies courses (inchangé).

**Non vérifié**
- La **sensation** de ces réglages n'a pas été jugée par moi (je ne conduis pas) : seuls les tests chiffrés le sont. Aucun test sur vrai téléphone ni manette.
- Les 4 navigateurs de la CI : Firefox et WebKit ne sont pas installés ici (le déterminisme y est vérifié par la CI).
