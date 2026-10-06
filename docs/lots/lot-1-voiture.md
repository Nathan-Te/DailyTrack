# Lot 1 — La voiture

**Livré**
- `packages/sim` : physique arcade déterministe à pas fixe (120 Hz), sans `Math.sin/cos` (sinus/cosinus maison par série de Taylor). `stepCar(état, commande)` fait avancer la voiture d'un pas ; la commande est entière (`steer` ∈ [-64, 64], `throttle`/`brake` ∈ [0, 64]), prête à être enregistrée au lot 3.
- `apps/web` : boucle à pas fixe avec rendu interpolé, caméra poursuite (élargissement du champ avec la vitesse), voiture low-poly qui s'incline dans les virages, HUD en km/h.
- Contrôles : clavier (flèches, ZQSD/WASD — même touche physique), manette standard (stick ou croix, RT/A accélère, LT/B freine), **R** ou Y/Start pour recommencer.
- Scénario `?scenario=plat` (le seul pour l'instant) : sol à damier infini, slalom, cercle de cônes et blocs repères. Aucune collision (cônes et blocs sont décoratifs).

**À tester** : ouvrir l'aperçu avec `?scenario=plat` et conduire. La conduite est-elle agréable ? Les réglages à ajuster sont dans `CAR` (`packages/sim/src/car.ts`) : `accel`, `turnRate`, `grip`, `steerIn/steerOut`, `maxSpeed`.

**Garde-fous** (tests Vitest)
- `car.test.ts` : comportement (accélération, 0→100 km/h entre 1,5 et 3,5 s, freinage puis marche arrière, symétrie gauche/droite…) et état final d'un scénario scripté **bit à bit** (`toMatchInlineSnapshot`) : s'il casse, la physique a changé et les rediffusions enregistrées sont invalides.
- `purete.test.ts` : aucune API non déterministe (`Math.sin/cos/exp/pow/random`, `**`, `Date`, imports externes) dans `packages/sim/src`.
- `math.test.ts` : le sinus/cosinus maison colle à `Math.sin/cos` à 1e-12.

**Convention** : `z` = avant à cap 0, `x` = gauche à cap 0 ; `yaw` 0 = vers +z, positif = à gauche ; `steer` positif = à droite.

**Pas encore fait** : tactile, collisions, pentes (lot 2) ; test Node ↔ navigateur (lot 3).
