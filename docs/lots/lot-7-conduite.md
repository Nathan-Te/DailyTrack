# Lot 7 — Refonte de la conduite

**Essayer** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=pilotage
**Régler** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=pilotage&debug&tune

**Livré**
- **Nouveau modèle de voiture** (`packages/sim/src/car.ts`), toujours déterministe (+ − × ÷ et √, pas fixe 120 Hz découpé en **2 sous-pas fixes** de 240 Hz) :
  - *plan horizontal* : modèle **bicyclette** à deux essieux ; chaque essieu donne une force latérale selon son glissement, saturée par une fonction rationnelle `t / ⁴√(1 + t⁴)` (adhérence forte jusqu'au seuil, puis glisse qui garde 78 % de l'adhérence) ; braquage qui diminue avec la vitesse pour rester près de la limite ; la glisse coûte de la vitesse en proportion de son angle ;
  - *dérapage* : un coup de frein braqué au-delà de 15 m/s fait décrocher l'arrière ; la direction règle alors l'**angle de dérive** (~22°) au lieu du braquage, on le tient au volant, on sort en relâchant. Plus lent qu'une trajectoire en grip dans une grande courbe, plus rapide dans une épingle ;
  - *vertical* : **4 ressorts amortis** posés sur `world` (hauteur et pente sous chaque roue), caisse avec hauteur, tangage et roulis (transfert de charge au freinage et en virage), adhérence modulée par la charge, butée pour les grosses réceptions ;
  - *en l'air* : balistique (gravité 22 m/s²), pas de contrôle aérien, orientation maintenue et ramenée doucement à l'horizontale ; **réception** à plat sans perte, de travers avec perte et rebond ;
  - *rebords* : deux disques (avant, arrière), choc par impulsion avec rebond et frottement de Coulomb : on frôle un rebord en perdant peu, on le prend de face en perdant beaucoup, jamais coincé.
- **`CarParams`** (défauts `DEFAULT_CAR_PARAMS`) passé à `stepCar` / `createRace` ; **`SurfaceParams`** `{ grip, traction, rolling }` lu sous chaque roue par `surfaceAt(échantillon)` (`world.ts`, table `SURFACES` : une seule surface « route », neutre — l'accroche du lot 8).
- **Reprise au point de contrôle** avec la vitesse et le cap du passage (état de la voiture mémorisé à la porte) ; « depuis le départ » reste arrêté.
- **Virage large** `L2` / `R2` (2 × 2 cellules, rayon 48 m) : la grande courbe, aussi utilisée par le générateur (une fois sur quatre).
- **Pilote automatique** refait (`autopilot.ts`) : trajectoire de course (ligne médiane relâchée dans la largeur de la route), vitesse de passage par courbure, points de freinage par passe arrière, 4 niveaux d'adhérence essayés. Sur le circuit d'essai : 33,2 s (ancien pilote, ancienne physique : 33,8 s).
- **Jeu** : caméra poursuite avec léger retard, champ de vision qui s'ouvre avec la vitesse, **caméra proche / loin sur C** (bouton Vue/Select de la manette), mémorisée ; caisse inclinée selon la suspension ; gâchettes tout-ou-rien, direction analogique (stick) ; **panneau `?debug&tune`** (20 curseurs, effet immédiat, « Copier les réglages » en JSON, « Par défaut »). Une course jouée avec d'autres réglages n'est **ni enregistrée ni envoyée** et le dit (bandeau + écran d'arrivée).
- **Versions** : `SIM_VERSION` 2, `GENERATOR_VERSION` 2, références régénérées. L'API refuse une rediffusion d'une autre version avec un message clair (« Course enregistrée avec une ancienne version du jeu (simulation v1, serveur v2) : recharge la page… ») ; les records locaux d'une autre version sont ignorés. Le format de rediffusion n'a pas changé (la direction était déjà analogique, −64…64).

**Mesures** (Node, cette machine)
| | Avant | Lot 7 |
|---|---|---|
| Vitesse de pointe | 42 m/s (151 km/h) | 42 m/s (inchangée : échelles du générateur gardées) |
| 0 → 100 km/h | ≈ 1,9 s | 1,69 s |
| 150 km/h → 0 | 18 m, 0,88 s | 22 m, 1,07 s |
| Adhérence latérale, braquage à fond | 35–46 m/s², sans limite ni glisse (« sur rail ») | ≈ 40 m/s², puis glisse |
| Rejeu d'une course de 35–40 s | ≈ 6 ms | ≈ 10–12 ms |
| Génération d'un circuit du jour (60 jours consécutifs) | — | moyenne 101 ms, pire 180 ms (sous Vitest) |

**Tests de comportement** (`packages/sim/test/conduite.test.ts`, seuils fixés) : 0 → 100 km/h entre 1,4 et 2,2 s ; pointe > 99 % de `maxSpeed` ; arrêt depuis 150 km/h < 25 m ; braquage tenu à 20/30/42 m/s : 36–46 m/s² latéraux, dérive < 8° ; cap tourné de 5° en 0,25 s ; **grande courbe à la limite : ≥ 92 % de la vitesse conservée** ; **dérapage** : dérive ≥ 14° tenue, < 35°, éteint (< 2°) 0,5 s après avoir relâché, demi-tour plus rapide qu'en grip ; **contact rasant à 8° : ≥ 85 % conservé** ; plus l'angle est franc, plus la perte est grande ; **choc de face** : rebond 3–15 m/s, **sortie en moins de 2 s** ; jamais coincé ; **réception à plat ≥ 95 %**, tremplin ≥ 95 %, réception de travers < 85 % avec rebond ; plaque : dépasse la pointe de 8 m/s, y revient en ~3 s. Générateur : **60 dates consécutives** validées par le pilote dans la fenêtre 28–48 s, temps de génération mesuré. E2E `conduite.spec.ts` : scénario `pilotage`, panneau `tune` (curseur → effet immédiat, course non classée ni enregistrée, aucun envoi, copie JSON), caméra C.

**Décisions pour Nathan — ce qui change le plus la sensation** (à essayer dans cet ordre dans le panneau)
1. **Grip avant / arrière** (44 / 47) : l'écart fait le caractère. Arrière ≤ avant → la voiture pivote vite mais devient vive à la limite ; arrière plus fort → plus stable, plus « sur rail ». Essaie 46 / 46.
2. **Braquage rapide (× limite)** (1,15) : plus haut = on tourne plus fort à haute vitesse mais on « frotte » l'avant ; plus bas = sous-virage. 1,0 à 1,3.
3. **Seuil de glisse** (0,11) et **grip gardé en glisse** (0,78) : la franchise de la limite. Seuil plus petit = adhérence plus « dure » ; grip en glisse plus bas = décrochages plus marqués.
4. **Dérapage** : angle (0,42 ≈ 22°) et « serre le virage » (45) — combien un dérapage aide dans une épingle.
Ensuite, **Copier les réglages** et m'envoyer le JSON (retouche 7b).

**Limites / non vérifié**
- La **sensation** n'a été jugée que par les tests chiffrés : personne n'a encore conduit cette voiture. Pas de vrai test manette.
- Le pilote ne dérape pas et ne coupe pas au-delà de la route : un bon joueur devrait le battre de quelques %. Les seuils des médailles (×1,08 / 1,20 / 1,40) n'ont pas été recalés.
- Le rejeu coûte ~2× plus qu'avant (sous-pas, 4 roues) : sans effet sur le choix d'hébergement (Workers gratuit était déjà exclu).
