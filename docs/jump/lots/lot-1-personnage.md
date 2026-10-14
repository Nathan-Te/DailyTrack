# Lot 1 — Le personnage (DailyJump)

**À tester** : `https://nathan-te.github.io/DailyTrack/b/lot-1-personnage-dailyjump/jump/?scenario=bac-a-sable&debug&tune`
(sans paramètre, `…/jump/` ouvre aussi le bac à sable, sans surimpression).

Commandes : **← →** ou **Q D** (A D en QWERTY) pour courir, **Espace**, **↑** ou **Z** pour sauter (tenir = plus haut), **R** pour revenir au départ. Manette : stick ou croix, A/B saut, Start/Select recommencer. Le panneau de droite règle tout en direct ; « Copier les valeurs » donne le JSON à m'envoyer.

Le bac à sable fait 198 × 30 tuiles ; de gauche à droite (colonnes) :
- **0–32** piste d'élan sous un escalier de plates-formes suspendues (3 tuiles d'écart en hauteur) ;
- **33, 38, 43** marches de 1, 2, 3 tuiles, puis **48** un plateau de 4 tuiles ; **son bout (colonne 57) est le rebord du coyote** : courir dans le vide et sauter un peu tard au-dessus du trou de 7 ;
- **75 → 110** trous de 2, 3, 4, 5, 6 (ils se sautent même à l'arrêt) ; **115** trou de 4 sous un plafond bas, **124** trou de 3 sous un plafond plus bas : **seulement avec élan** ; les fosses font 2 tuiles, on en ressort ;
- **133** couloir d'une tuile de haut ;
- **149 cheminée de 3, 154 cheminée de 2** (11 tuiles), on y entre par un passage d'une tuile sous chaque mur ;
- **163 grand mur isolé** (15 tuiles) : se remonte seul, saut mural après saut mural en revenant vers le mur ;
- **171 dalle basse percée** (trous en 175, 180–181, 186) : **tolérance de coin**, sauter un peu à côté d'un trou fait passer ; une plate-forme au-dessus ;
- **193** l'arrivée, dessinée mais inerte (lot 2).

## Réglages par défaut (`DEFAULT_JUMP_PARAMS`)

1 tuile = 4 096 unités ; tuiles/s × 4 096 ÷ 120 = unités/pas ; tuiles/s² × 4 096 ÷ 14 400 = unités/pas² ; s × 120 = pas.

| Réglage | Unité humaine | Valeur entière |
|---|---|---|
| `runSpeed` vitesse de course | 11,0 tuiles/s | 375 |
| `groundAccel` accélération au sol | 59,8 tuiles/s² (pleine vitesse en 0,19 s) | 17 |
| `groundDecel` freinage au sol, demi-tour | 112,5 tuiles/s² (arrêt en 0,10 s) | 32 |
| `airAccel` accélération en l'air (et demi-tour) | 45,7 tuiles/s² | 13 |
| `airDecel` freinage en l'air sans commande | 21,1 tuiles/s² | 6 |
| `gravity` gravité | 66,8 tuiles/s² | 19 |
| `fallSpeed` chute maximale | 22,0 tuiles/s | 751 |
| `jumpSpeed` impulsion du saut | 23,4 tuiles/s (saut de 4,21 tuiles) | 800 |
| `jumpCut` coupe de saut | 10,0 tuiles/s (saut court 0,98 tuile) | 340 |
| `slideSpeed` glisse murale | 5,0 tuiles/s | 171 |
| `wallJumpX` saut mural, poussée | 10,0 tuiles/s | 340 |
| `wallJumpY` saut mural, impulsion | 19,9 tuiles/s (3,05 tuiles) | 680 |
| `wallLock` verrou vers le mur | 0 s (aucun) | 0 |
| `wallReach` portée du saut mural | 0,125 tuile | 512 |
| `coyote` coyote | 0,083 s | 10 |
| `wallCoyote` coyote mural | 0,05 s | 6 |
| `jumpBuffer` tampon | 0,1 s | 12 |
| `cornerTolerance` tolérance de coin | 0,25 tuile | 1 024 |

Constantes (pas des réglages) : boîte 0,75 × 0,75 tuile, `MAX_SPEED` 2 048 unités/pas (½ tuile/pas ≈ 61 tuiles/s).

## Mesures (simulation, `MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts`)

| Mesure | Valeur |
|---|---|
| Course | 11,0 tuiles/s atteinte en 23 pas (0,19 s) ; arrêt en 12 pas (0,10 s) |
| Saut complet | **4,21 tuiles**, montée 43 pas (0,36 s), 0,72 s en l'air |
| Saut court (appui d'un pas) | **0,98 tuile**, montée 0,16 s, 0,33 s en l'air |
| Distance du saut complet | **6,63 tuiles à l'arrêt** (droite tenue) · **7,87 à pleine vitesse** |
| Sous un plafond à 3 rangées libres, à pleine vitesse | ≈ 4,1 tuiles (d'où les trous « avec élan ») |
| Saut mural | 3,05 tuiles de haut |
| Cheminée de 3 (11 tuiles du sol au sommet) | 93 pas, **0,78 s** (cheminée de 2 : 83 pas, 0,69 s) |
| Coût moyen d'un `stepPlayer` | **≈ 1,3 µs** (Node 22, commandes au hasard sur le bac à sable, 2 millions de pas) |

## Vérifié / non vérifié / décisions

**Vérifié** : typecheck ; Vitest (`jump-sim` : 61 tests dont un fuzz de 140 000 pas, le déterminisme, les 8 directions sans traversée, le golden ; `apps/jump` : 25 tests dont la liste des paramètres d'adresse) ; `npm test` complet (1 035 tests SQLite + 158 libSQL) ; golden de DailyTrack inchangés (aucune zone partagée ni fichier de DailyTrack touché) ; e2e dans **Chromium** en local (5 tests, dont course + saut pas à pas, clavier et appui bref, panneau de réglages) ; captures d'écran.

**Non vérifié** : Firefox et WebKit (pas installés ici : c'est la CI qui tranche) ; une **vraie manette** (la logique est testée, pas le matériel) ; un téléphone (le tactile est au lot 6) ; le **feeling** : c'est ton rôle.

**Décisions pour Nathan**
1. **L'élan compte peu à l'air libre** : le contrôle en l'air (76 % du sol) fait sauter 6,6 tuiles à l'arrêt contre 7,9 avec élan. Les trous « seulement avec élan » sont donc **sous un plafond bas** (le plafond raccourcit le saut, la vitesse fait la différence). Baisser `airAccel` vers 8–10 rend l'élan décisif partout, mais **on ne remonte plus un mur seul** (mesuré : à 10, le pilote du mur isolé plafonne à ≈ 8 tuiles ; à 13, il monte sans limite).
2. **Verrou du saut mural à 0** par défaut : remonter un mur seul reste possible ; un verrou de 40 pas l'empêche (test).
3. Le **saut mural est variable** comme le saut (relâcher coupe) ; il pousse pareil qu'on tienne la direction ou non.
4. **Tampon** : un appui fait jusqu'à 12 pas avant le premier pas posé saute dès l'atterrissage ; s'il a été relâché entre-temps, c'est un saut court.
5. **Coût d'un pas** : ≈ 60 % du temps passe dans les vérifications de `idiv` (tuile d'une coordonnée). Un décalage `>> 12` (division exacte par 4 096, sans `-0`) le ramène à ≈ 0,3 µs (mesuré) ; je ne l'ai pas fait parce que la consigne dit « divisions par `idiv` uniquement ». À trancher avant le solveur du lot 4.
6. Pas de montée automatique d'une marche d'une tuile (il faut sauter) ; la tolérance de coin ne vaut que pour la tête en montée.
7. Le bac à sable n'a ni danger ni mort : les fosses font 2 tuiles de profondeur.
