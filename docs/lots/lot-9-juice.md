# Lot 9 — Feel & juice : voiture, effets visuels, sons

**À essayer** : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=surfaces&demo
(le pilote automatique boucle sur le circuit des surfaces : toutes les caméras, tous les effets et les sons ; un clic ou une touche démarre le son)
Puis à la main : https://nathan-te.github.io/DailyTrack/b/claude-bold-thompson-ank8u1/?scenario=pilotage
Autres : `?demo` seul (circuit du jour), `?demo&seed=AAAA-MM-JJ`, `?demo&scenario=pilotage`.

**Règle du lot** : tout est dans `apps/web`. **`packages/sim` n'a pas changé** (`git diff packages/sim` vide, `SIM_VERSION` = 4, références golden non régénérées) : le rendu ne modifie jamais un résultat de simulation, la télémétrie est en lecture seule.

## Livré

**Voiture** (`carMesh.ts`, construite en code, originale : coupé trapu orange et crème, nez en coin, bulle de toit, aileron, bandeau sombre)
- 4 roues **séparées** (pneu, jante, rayons) : elles tournent avec la vitesse, les deux avant braquent selon le braquage réel de la sim ;
- **suspension visible** : chaque roue suit le sol sous elle (`readTelemetry` lit `world.sample` sous les 4 roues) dans un débattement borné (−0,15 / +0,22 m) ; en l'air les roues pendent ; la caisse reprend le tangage et le roulis de la simulation ;
- **feux stop** allumés au frein ; **fantôme** bleu, translucide, teinte froide (distinct de la voiture).

**Effets** (`fx.ts`, particules en `Points` avec shader maison, deux pools recyclés — normal et additif — et un ruban de traces en tampon circulaire : aucun objet créé en course)
- fumée de pneus + traces au sol (roues arrière en glisse ou au freinage appuyé), traces en nombre limité (260 segments recyclés) ;
- particules par revêtement : poussière (terre), éclats (glace), brins (herbe) ; étincelles quand la caisse frotte un rebord ; poussière à la réception d'un saut, d'autant plus grande que l'impact est fort ;
- flammes d'échappement : orange (plaque), bleu-blanc (super turbo) ; indicateur « MOTEUR COUPÉ » (déjà dans le HUD du lot 8, conservé) ;
- caméra : **petite secousse** (chocs, réceptions), **coup de champ de vision** au turbo (+7° plaque, +12° super turbo), **lignes de vitesse** sur les bords au-delà de 75 % de la pointe ;
- **éclair** bleu au point de contrôle (+ gerbe d'étincelles) ; **confettis** à l'arrivée ; **reflet** qui glisse sur la ligne de médaille.
- Respect de `prefers-reduced-motion` pour le reflet.

**Sons** (`audio.ts` + `audioLogic.ts` ; Web Audio, **100 % procéduraux** : oscillateurs et bruit blanc filtré, aucun fichier)
- moteur avec 6 rapports simulés (côté son seulement : `GEAR_SPEEDS`, le régime monte puis retombe), plus grave et discret sans gaz ;
- crissement selon la dérive, roulement selon le revêtement (route / terre / herbe / glace ont chacun leur voix), vent selon la vitesse, impacts, réceptions, turbo, moteur coupé, bip de point de contrôle, décompte (3-2-1) et départ, arrivée, médaille (arpège d'autant plus haut que la médaille est belle) ;
- le contexte audio **démarre au premier geste** (clic, touche, toucher) ; suspendu quand l'onglet est caché ; coupé en pause ;
- **volume + muet** : touche **M** (muet ↔ dernier volume) et bouton **Son** du menu (4 crans) ; mémorisés (`localStorage` `cdj:audio`).

**Télémétrie** (`telemetry.ts`) : vitesse, dérive, 4 sols et revêtements sous les roues, contact de rebord. Lecture seule : n'appelle que `world.sample` / `world.collide` (purs).

**Performance** : qualité **automatique** (`QualityGovernor` : si l'intervalle moyen entre images dépasse 26 ms on baisse d'un cran — moins de particules, plus de traces —, on remonte après 4 s sous 19 ms) ; `?quality=0|1|2` la fige, `?fx=off` coupe les effets, `?shake=0` coupe les secousses. Ne touche jamais à la simulation.

**`?demo`** : le pilote automatique (`bestPilotRun`) roule en boucle, la caméra alterne proche / loin toutes les 7 s, on repart 6 s après l'arrivée ; **rien n'est enregistré ni classé**.

## Mesures

Chromium (Playwright), profil mobile 844 × 390 @2, rendu **logiciel** (SwiftShader : ~7-9 images/s, donc seul le **coût du fil principal par image** est significatif, pas les i/s). Course du pilote en cours, 8 s de mesure, deux niveaux de ralentissement CPU (×1, ×4). Script : mesure CDP `Performance.getMetrics` (TaskDuration / ScriptDuration ÷ images).

| Scénario | Avant (lot 8) ×1 / ×4 | Après, qualité auto ×1 / ×4 | Après, qualité 2 fixe ×1 / ×4 | Après, `?fx=off` ×1 / ×4 |
|---|---|---|---|---|
| pilotage — fil principal (ms/image) | 2,25 / 9,86 | 3,22 / 12,04 | 2,83 / 11,20 | 2,94 / 11,20 |
| surfaces — fil principal (ms/image) | 2,04 / 9,24 | 3,34 / 11,97 | 2,79 / 10,87 | 3,57 / 11,84 |

Lecture : **+1 ms/image** à vitesse normale, **+2 à +3 ms** avec le processeur ralenti ×4 (≈ 12 ms sur un budget de 16,7 ms à 60 i/s). Les effets eux-mêmes coûtent peu (< 0,5 ms) : l'essentiel vient de la voiture à 4 roues (plus d'objets) et de la lecture de la télémétrie. Mesures bruitées (± 0,5 ms) : à lire comme un ordre de grandeur.

**Poids ajouté** (JS compressé gzip) : jeu 29,9 → 37,5 ko (+7,6 ko), three.js 129,4 → 129,8 ko (+0,4 ko, `Points` et `ShaderMaterial`) : **≈ +8 ko**, très en dessous du budget de 300 ko (aucun fichier son ni modèle). Budget de `e2e/perf.spec.ts` relevé : 185 ko au total, 50 ko hors three.js.

## Tests
- Vitest `apps/web/test/juice.test.ts` (16) : régime et rapports du moteur, crissement, vent, voix des revêtements, notes, volume et sourdine (M), débattement des roues borné, dérive signée, **qualité automatique** (baisse, remontée sans yo-yo, figée, onglet en arrière-plan ignoré).
- E2E `e2e/juice.spec.ts` (9, Chromium) : fumée et traces au dérapage ; étincelles et son de choc au rebord ; poussière, secousse et son à la réception, roues qui pendent en l'air puis suivent le sol ; `?fx=off` sans particule ; flammes, coup de champ de vision et son au turbo ; décompte, départ et point de contrôle sonnent ; **M** coupe, le réglage survit au rechargement, le bouton fait le tour des crans ; contexte audio démarré seulement au premier geste ; arrivée du pilote sur le circuit du jour : confettis, éclair, fanfare, médaille ; `?demo` roule seul, effets actifs, aucun record enregistré, aucune erreur de page ; `?quality=` figé.
- **Non-régression de la simulation** : `git diff packages/sim` vide, tests golden (rediffusion de référence et circuits du jour) inchangés et verts sans régénération.

## Limites / non vérifié
- **Rendu sur un vrai téléphone** : non vérifié (le rendu logiciel ne dit rien du GPU d'un téléphone). Le coût mesuré est celui du fil principal ; les particules additives plein écran (lignes de vitesse, éclair) sont des `div` en `opacity` seule, mais à surveiller sur un vieux téléphone (`?quality=0`, `?fx=off`).
- **Son sur iOS (Safari)** : non vérifié. Le contexte est créé au premier geste (`pointerdown`, `keydown`, `touchstart`) et repris au retour d'onglet, comme l'exige Safari ; en revanche l'interrupteur « silencieux » de l'iPhone coupe peut-être le son Web Audio, et je n'ai pas d'appareil pour le dire. Aucun test n'**écoute** : on vérifie ce qui est joué (`__cdj.audio.log`), pas comment ça sonne.
- La **qualité du rendu** (proportions de la voiture, lisibilité des particules en plein soleil) n'a été jugée que sur captures d'écran.

## Décisions pour Nathan
1. **Style des sons** : arcade synthétique (carrés / triangles pour les bips, scie pour le moteur). Plus « mécanique » (moteur plus riche en harmoniques, vrais échantillons CC0 listés dans `docs/credits.md`) ou plus doux ? Dis-moi ce qui te gêne à l'oreille (moteur trop aigu ? crissement ? bips ?) : tout est réglé par `audioLogic.ts` (fréquences et volumes), sans toucher au reste.
2. **Intensité de la secousse de caméra** (réceptions, chocs) : actuellement ≈ 0,05–0,2 m. Trop ? `?shake=0` pour comparer ; on peut la baisser, la garder seulement pour les réceptions, ou la rendre réglable.
3. **Qualité automatique** : seuils 26 / 19 ms ; faut-il aussi baisser la résolution du rendu (pixel ratio) sur téléphone ? Non fait : cela change l'image, pas seulement les effets.
4. **Bouton Son** dans le menu en haut à droite (comme Fantôme / Archives), pas dans la barre tactile : suffisant ?

## Note de pile
Le lot 8 (PR #16) **n'était pas fusionné** au début de ce lot : le lot 9 est empilé sur la même branche et la même PR.
