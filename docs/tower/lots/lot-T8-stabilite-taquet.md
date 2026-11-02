# Lot T8 — Une tour qui tient, et le taquet (Tower)

Branche `claude/tower-stability-wedge-6r0s01`, PR brouillon. **Tower reste `off`.** Aucune version ni aucun golden de Track ou de Jump touché ; `lab/` intact ; `docs/tower/seed.md` intact. Règles : `docs/tower/consignes.md`, « Une tour qui tient, la tolérance et le taquet (lot T8, simulation 5) ». Pour les joueurs : rien (Tower est `off`).

Retour de Nathan (2 novembre) : « les blocs bougent un tout petit peu et on ne peut plus rien emboîter, parfois sans raison » ; « il faut deux touches pour donner un taquet à droite ou à gauche ».

## Le diagnostic, mesuré avant toute correction (`npm run stabilite:tower -w @cdj/tower-sim -- --variante=v4,v5,…`)
**Le corpus** : 200 parties à graine fixe — 168 d'un joueur bruité (il vise la grille avec une heuristique de surface, tire ses temps de réaction et sa cadence, fait des porte-à-faux légers et des pièces mal placées d'une demi-case ; 56 jours × 3 niveaux de bruit), 24 du **bot du lot T3 rendu imparfait** (3 positions de chaque côté, un décalage d'une demi-case toutes les 7 pièces), 8 des scénarios `alignement` et `essai`. ≈ 3 600 poses, 18 poses par partie (le joueur bruité perd ses trois vies vers la 20e pièce). **Quatre indicateurs** (définitions : en-tête de `tools/stabilite.ts`) ; chaque cause est mesurée **en ne changeant qu'un facteur** à partir de `neutre` (la simulation 5 avec ses correctifs éteints, qui redonne la 4).

**À lire d'abord** : sur ce corpus, les **mouvements sans cause valent 0 dès la simulation 4**, même au seuil fin (1 mm, 0,1°) : une pièce endormie reste endormie. Ce que Nathan voit est donc autre chose : une pose **décale des pièces que la pièce posée n'a pas touchées** (le choc se propage : 95e centile de 21 mm sur une tour bien bâtie, 64 mm sur toutes, et jusqu'à 10 cm quand la pièce arrive à plus de 2,4 m/s), et de petits décalages **ferment les trous** (52 % seulement des fosses d'une ou deux cases acceptent encore leur pièce exacte).

### Le tableau avant / après (200 parties, 3 592 poses en version 4, 4 194 en version 5 : les joueurs de la 5 vivent plus longtemps, 21 poses par partie au lieu de 18)
| indicateur | cible | version 4 (avant) | **version 5 (après)** |
|---|---|---|---|
| mouvements **sans cause** (> 5 mm ou 0,5°) ; au seuil fin (> 1 mm, 0,1°) | 0 | 0 ; 0 | **0 ; 0** |
| mouvements « en chaîne » (une autre pièce de l'îlot bougeait encore) | — | 19 | 24 |
| déplacement des pièces **non touchées** : maximum par pose, médiane | < 2 mm | 1,6 mm | **0,9 mm** |
| … 95e centile, toutes les poses sans effondrement | < 1 cm | 64 mm | 32 mm (voir ci-dessous) |
| … 95e centile, **tour bien bâtie** (aucune pièce penchée de plus d'1°) | < 1 cm | 21,1 mm | **9,4 mm** |
| … 95e centile, bien bâtie **et calme** au lâcher (la pose d'avant est finie) | < 1 cm | 15,9 mm | **6,9 mm** |
| … toutes les paires (pose × pièce non touchée) : médiane ; 95e centile | < 2 mm ; < 1 cm | 0,6 ; 21,8 mm | **0,3 ; 4,3 mm** |
| vitesse de la pièce posée dans les 30 ticks du lâcher : médiane ; 95e centile | bornée, petite | 1,4 ; 4,3 m/s | **0,3 ; 1,1 m/s** |
| **dérive** (bord gauche de la pièce posée à la grille des demi-cases) : médiane ; 95e centile | — | 6,1 ; 124 mm | **1,9 ; 40 mm** |
| fosses d'une ou deux cases qui acceptent encore leur pièce exacte, **à la tolérance de la version** (5 mm ; 2 cm) | ≥ 95 % | 67,2 % (n = 778) | 92,7 % (n = 1 106) |
| … même tolérance de 1 mm (strict) | — | 52,1 % | 54,2 % |
| … **tour bien bâtie**, à la tolérance de la version | ≥ 95 % | 75,1 % (à 5 mm) | **≈ 98 %** (97,3 % à 15 mm, 99,0 % à 30 mm ; n = 926) |
| galeries latérales sous un surplomb | ≥ 95 % | 0 % (n = 16) | 7 relevées seulement : trop rares pour conclure (le scénario `emboitement` et ses tests les couvrent) |

**Cibles atteintes** : zéro mouvement sans cause ; médiane des non touchées sous 2 mm ; 95e centile sous 1 cm **sur une tour bien bâtie** (9,4 mm) et sur toutes les paires (4,3 mm) ; au moins 95 % des trous emboîtables **sur une tour bien bâtie** (≈ 98 %).
**Non atteintes, et pourquoi** : le 95e centile du *maximum par pose* sur **toutes** les poses reste à 32 mm, et les fosses ne sont emboîtables qu'à 92,7 % sur **tout** le corpus. Ce qui reste vient de tours où une pièce est déjà penchée de plus d'un degré ou posée en équilibre précaire (un porte-à-faux léger que le joueur bruité fait exprès 3 à 8 % du temps, une pièce mal placée d'une demi-case) : la pose suivante la fait glisser de quelques centimètres ou la tranche penchée ferme la fosse de plus de 2 cm. C'est la physique, voulue par la consigne (« une tour mal bâtie s'effondre ») : la corriger demanderait de coller les pièces (frottement ou sommeil forcé), ce que la mesure rejette (parties de 6 poses au lieu de 21 avec le sommeil forcé). **Proposition** : si Nathan veut aller plus loin, le seul levier qui reste est une tolérance de 3 cm (99 % à 30 mm sur tour bien bâtie, ≈ 94,4 % sur tout le corpus) — au prix d'un recouvrement visible entre deux pièces qui se touchent.


### Les causes, une à la fois (à partir de `neutre`, la simulation 5 sans ses correctifs : elle redonne la 4 à quelques pour cent près, le coup de vent mis à part)
« Part expliquée » = la baisse du 95e centile des déplacements de toutes les paires non touchées quand **ce seul facteur** change (neutre : 20,9 mm). Dérive : 95e centile (neutre : 118 mm). Fosses : part emboîtable à 15 mm, tour bien bâtie (neutre : 86,3 %).
| cause | essai | non touchées p95 (mm) | part expliquée | dérive p95 (mm) | fosses à 15 mm | mouvements en chaîne |
|---|---|---|---|---|---|---|
| neutre (= version 4) | — | 20,9 | — | 118 | 86,3 % | 16 |
| **vitesse d'impact à la pose** | part de 0 m/s au lâcher (gravité normale) | 11,7 | **44 %** | 69 | 96,5 % | 48 |
| | part de 0,5 m/s | 10,3 | **51 %** | 62 | 94,6 % | 44 |
| | **retenu** : 0,25 m/s, gravité coupée 20 ticks | **4,3** | **79 %** | **40** | **97,3 %** | 24 |
| réveil de l'îlot et gigue du solveur | tour pas calme au lâcher (la pose d'avant n'est pas finie : l'îlot réveillé n'a pas fini de se rasseoir) : p95 **32,1 mm** contre **15,9 mm** si la tour est calme (tour bien bâtie, version 4) | 32,1 contre 15,9 | **×2** pour un joueur qui descend vite ; pas réglable : Rapier réveille l'îlot entier à chaque contact | — | — | — |
| seuils de sommeil | endormir de force toute pièce calme depuis 20 ticks (< 5 cm/s) | (sans objet) | **rejeté** : les pièces se figent en pleine bascule, les parties tombent à 6 poses | — | — | — |
| raideur des contacts (version 4 : 120 Hz) | 30 Hz (Rapier) | 16,9 | 19 % | 90 | 92,9 % | 46 |
| | 60 Hz | 16,3 | 22 % | 73 | 90,4 % | 10 |
| | 240 Hz | 29,0 | −39 % (pire) | 147 | 88,5 % | 1 |
| frottement | 0,9 au lieu de 0,6 | 18,1 | 13 % | 86 | 93,9 % | 4 |
| amortissements | linéaire et angulaire 1 | 20,1 | 4 % | 97 | 92,9 % | 34 |
| | 3 | 19,8 | 5 % | 124 | 94,9 % | **121** (secousses) |
| prédiction de contact | 1 mm / 5 mm (2 mm retenus) | 23,1 / 18,8 | −11 % / 10 % | 116 / 97 | 89,4 % / 91,6 % | 5 / 5 |
| itérations du solveur | 60 au lieu de 30 | 18,4 | 12 % | 102 | 89,0 % | 16 |
| | 4 internes au lieu d'1 | 13,7 | 34 % (**disparaît** une fois la pose douce en place : variante E, 4,4 mm) | 73 | 92,3 % | 5 |
| démarrage à chaud (`warmstart`) | pas réglable dans l'API JavaScript de Rapier 0.21 | non mesuré | — | — | — | — |
| pièces sur un coin | la forme de la pièce posée n'explique rien : de 54 à 62 poses à plus de 20 mm pour chacune des sept formes (409 à 430 poses chacune) ; la pièce non touchée qui bouge le plus est de n'importe quelle forme (O 15 %, I 16 %, J 17 %, T 14 %, S 11 %, L 8 %, Z 19 % des 403 poses à plus de 20 mm) : la cause est l'équilibre précaire de la pièce voisine, pas son coin | — | — | — | — | — |
| **tolérance d'emboîtement** | 2 cm en main au lieu de 1 mm | (sans effet sur les non touchées) | — | 102 | 90,8 % (96,9 % tour bien bâtie à 30 mm) | 11 |

**Lecture** : la pose douce explique à elle seule **les trois quarts** des mouvements des pièces non touchées et deux tiers de la dérive ; elle est aussi ce qui rend la fosse emboîtable (pièces posées plus près de la grille). Aucun autre réglage ne fait mieux, ni **en plus** d'elle. L'amortissement ajoute de la gigue (121 secousses), le sommeil forcé casse le jeu, la raideur du contact de la version 4 (120 Hz) reste le bon compromis (30 Hz tasse davantage, 240 Hz jitter).


## Ce qui a été changé (simulation 5)
- **Pose douce** : au lâcher la pièce descend à 0,25 m/s, gravité coupée 20 ticks (≤ 7 cm de jeu) : elle arrive au contact à **0,25 m/s au lieu de ≈ 2,6 m/s** ; puis tout son poids. Réglable (`?debug&tune`).
- **Tolérance d'emboîtement 2 cm** en main (déplacement, quart de tour, taquet, vent) et au test de lâcher ; Rapier sépare les corps sans éjecter (essai : trou rétréci de 1,5 cm, voisines < 1 cm).
- **Repos** : aucun amortissement, sommeil forcé, frottement ni contact modifié (aucun n'améliore, voir « causes »).
- **Taquet** : `taquetGauche` / `taquetDroite` ; en main un pas fin de 12,5 cm ; après le lâcher (15 ticks) une poussée de 2,5 m/s, 3 au plus, réservée à la pièce lâchée. Touches : Q / E (A / E en AZERTY), LB / RB, deux petits boutons tactiles au-dessus de ← et →. Aide en partie, « Comment jouer », Réglages › Commandes, catalogues fr et en.
- **Vent** : une demi-case tous les 40 ticks (même dérive moyenne, reste sur la grille).
- **`?scenario=emboitement`**, **`TOWER_SIM_VERSION` = 5** (3 et 4 rejouables au bit près), golden à trois étages (six rediffusions de la 5, dont une avec taquet).

## Les paramètres retenus (`stabilite.ts`, `PARAMS_STABILITE`) et le taquet
| réglage | valeur de départ | bornes du curseur (`?debug&tune`) | rôle |
|---|---|---|---|
| `vitessePose8` | 2 (0,25 m/s) | 0,125 à 2,5 m/s | vitesse de la pièce du lâcher au contact |
| `graviteDouce` / `dureeGraviteDouce` | 0 / 20 ticks | (fixes) | gravité coupée les 20 premiers ticks (≤ 7 cm de jeu au lâcher) |
| `tolerance` | 2 cm | 1 mm à 4 cm | recouvrement accepté en main et au test de lâcher |
| `pasFin8` | 1 (12,5 cm) | 1 à 4 huitièmes | taquet en main |
| `taquetFenetre` | 15 ticks | 3 à 45 | fenêtre de la poussée après le lâcher |
| `taquetDv8` | 20 (2,5 m/s) | 0,25 à 4 m/s | vitesse ajoutée par poussée |
| `taquetMax` | 3 | 1 à 8 | poussées par pièce |
| vent (simulation 5) | une demi-case / 40 ticks | `ventPas8` 1 à 6… ; `ventPeriodeTicks` 2 à 40 | même dérive moyenne que d'un huitième / 10 ticks |

**Pas retenus** (mesurés, voir les causes) : amortissement, sommeil forcé, frottement 0,9, raideur du contact, prédiction, itérations — aucun n'améliore une fois la pose douce en place (variante E : + 4 itérations internes, p95 des non touchées 4,4 mm contre 4,3 ; variante D : + frottement 0,9, 5,8 mm ; variante C : + amortissement 0,5, 7,5 mm : pire). **Correction plus molle du recouvrement au lâcher** (raideur du contact abaissée les premiers ticks) : essayée sur le trou rétréci, les voisines bougeaient davantage (13,6 mm contre 10,3), rejetée.

**Le taquet à l'essai** (carré posé à gauche du bâton couché, niche à 1 m) : une poussée seule porte la pièce de 4 à 12 cm (le contact d'arrivée en mange une partie), **deux poussées à trois ticks d'écart la portent dans la niche** (x = −1,07 m visé −1 avec 2,5 m/s) ; trois poussées poussent aussi le pilier (« elle peut pousser légèrement ce qu'elle touche »). Les valeurs sont **des points de départ pour les curseurs**, à régler en jouant (lot T5b).


## Le bot en simulation 5 (30 jours du T3b : 05/11 → 04/12/2026, `mesures-t3:tower`, les mêmes tirages)
**Premier essai, raté, et sa cause** : le bot finissait à ≈ 2 m avec zéro vie. La pose douce coupe la gravité 20 ticks : un coup en porte-à-faux ne bascule qu'**après** ; le bot jugeait « calme » une tour qui allait tomber (`CALME_MIN_TICKS` = 8). **Corrigé : 28 ticks** (la gravité revient à 20, la bascule se voit dans les 8 suivants). Ce changement du bot ne touche aucune preuve déjà préparée (une preuve se rejoue par la simulation qu'elle nomme) et ne monte pas `TOWER_GENERATOR_VERSION` (le contenu du jour est identique).
| Diamant (m) | min | Q1 | médiane | Q3 | max |
|---|---|---|---|---|---|
| T6 (simulation 4) | 27,7 | 36,6 | 46,4 | 60,0 | 60,0 |
| **Simulation 5** | **26,2** | **30,0** | **42,9** | **47,0** | **60,0** |
- Tirages retenus : t0 21 · t1 6 · t2 3 · t3 0 (T6 : 22 · 5 · 2 · 1) ; **1,40 bot joué par jour** (T6 : 1,40) ; **aucun jour hors de la plage** [25 ; 60] m ; bots au-dessus du plafond : 2 jours sur 30 (T6 : 10). Le Diamant médian baisse de 3,5 m (la pose douce rend la tour plus honnête : moins de coups « chanceux »).
- **Temps de préparation : 14 jours sur 4 cœurs en 4 min 37 s** (limite 8 min ; T6 : 6 min 24 s) ; les 30 jours : 8 min 2 s. Par jour sur un fil : médiane 54 à 56 s, pire 244 à 254 s.
- **À savoir pour le T5b** : le coefficient de l'estimation géométrique (`COEFFICIENT_GEOMETRIQUE_PCT` = 165) est maintenant trop haut (médiane du rapport Diamant / estimation du tirage 0 : 128 % sur 30 jours, 119 % sur les 14 premiers) ; non touché (hors périmètre : recalibrage des médailles au T5b).


## Poids (`node apps/tower/tools/mesure.mjs`, gzip)
| ligne | avant (T7) | après | plafond | marge |
|---|---|---|---|---|
| `tower.jsCss` (l'accueil) | 39 669 | **39 745** (+76) | 40 000 | 255 |
| `tower.jeu` | 169 111 | **170 150** (+1 039 : +990 du lot, +49 venus de `main`) | **170 200** (relevé de 1 000 o) | 50 |
`budgets.md` est remesuré. Sur les 3 000 o accordés par Nathan : **990 o pris** par le lot (les deux bits, la poussée, le pas fin, la pose douce, la tolérance, deux boutons tactiles, l'aide et les textes) ; `physique` inchangé (958 766 o dont le `.wasm`). L'outil de diagnostic, le scénario, les curseurs et les écrans sont hors du jeu (outils, à la demande).

## Vérifié / non vérifié
- **Vérifié** : `npm run verifier` vert (typecheck, unitaires SQLite et libSQL, construction, **e2e Tower en Chromium : classement, déterminisme — les six rediffusions de la simulation 5 et les dix des simulations 3 et 4 rejouées au bit près —, partie, poids**) ; tests ajoutés : `taquet.test.ts` (pas fin, tolérance, fenêtre, nombre de poussées, bits refusés par les versions 3 et 4, rediffusion avec taquets), `stabilite.test.ts` (pose douce, trou rétréci de 1,5 cm, refus au-delà de la tolérance, garde-fou de la physique en version 5 : O dans le vide, trois quarts, escalier, alignement ; échantillon de 12 parties du corpus : zéro mouvement sans cause), entrées M2 (mêmes bits avec d'autres touches, LB / RB, Q / E, un ordre par appui), vent d'une demi-case ; traductions à jour ; zones du lot respectées (`scripts/zones-jeu.mjs`) ; rendu tactile contrôlé dans Chromium en 844 × 390 et 390 × 844 (les deux petits boutons au-dessus de ← et →, sans chevauchement).
- **Non vérifié** : la sensation d'un humain (la pose à 0,25 m/s ralentit la pièce sur ses 7 derniers centimètres ; le taquet à 2,5 m/s) ; Firefox et WebKit autrement que par le petit ensemble `@navigateurs` de la CI ; la manette (LB / RB) sur un vrai matériel ; l'effet du taquet sur un téléphone ; les 5 e2e « Régression » (non concernés) ; la CI de la PR.


## Questions pour Nathan
1. **« Taquet »** pour le joueur (« Nudge » en anglais) : le mot te va-t-il ? (`commandes.action.taquetGauche`, `aide.taquet`.)
2. **La pose douce** ralentit la pièce à 0,25 m/s sur ses derniers centimètres (au plus 7 cm, 0,3 s) : acceptable à l'œil, ou préfères-tu 0,5 m/s ? (moins douce : p95 des non touchées 10,3 mm au lieu de 4,3 ; les curseurs de `?debug&tune` le règlent.)
3. **Valeurs du taquet** (pas fin 12,5 cm ; poussée 2,5 m/s, 3 au plus, fenêtre 15 ticks) : des points de départ ; la première poussée est en partie mangée par le contact d'arrivée, il faut deux poussées pour entrer dans la niche du scénario. À ajuster en jouant (T5b).
4. **Tolérance 2 cm** (tu disais 1 à 2) : 98 % des fosses emboîtables sur une tour bien bâtie, 92,7 % sur tout le corpus ; la monter à 3 cm donnerait 94,4 % de tout le corpus, au prix d'un recouvrement visible. À garder ?
5. **Budget** : 990 o pris sur 3 000, plafond de `tower.jeu` relevé de 1 000 o (170 200) : à valider.
6. **Coefficient de l'estimation géométrique** (165 %) trop haut avec la simulation 5 (128 %) : à régler au T5b avec les médailles.
7. Le **Diamant médian baisse de 3,5 m** (42,9 m) : les médailles à 15, 30 et 50 % suivent ; rien à décider, à savoir.

## Liens de test (aperçu de la PR)
- `/tower/?scenario=emboitement` : fais descendre le carré à gauche du bâton couché (4 pas à gauche), laisse-le se poser contre la plateforme, puis **deux taquets à droite à deux ou trois ticks d'écart** (A ou E, LB / RB) : il glisse dans la niche sous le bâton. Puis le bâton (tourner 3 fois, aller à 5 m) dans le trou du dessus rétréci de 1 cm : il entre et s'y pose.
- `/tower/?seed=2026-11-05` : deux parties entières ; une tour bien posée ne bouge plus, les trous restent emboîtables.
