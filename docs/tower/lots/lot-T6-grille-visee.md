# Lot T6 — Jouabilité : la grille et la visée

Branche `claude/gallant-brown-6b2d7e`, PR brouillon. **Tower reste `off`.** Aucune version ni aucun golden de Track ou de Jump touché ; `lab/` intact ; `docs/tower/seed.md` intact. Règles : `docs/tower/consignes.md`, « La grille et la pose juste (lot T6) » et « Le dessin, la visée et le fantôme (lot T6) ». Pour les joueurs : rien (Tower est `off`).

## Le diagnostic, mesuré avant toute correction (`npm run alignement:tower -w @cdj/tower-sim`)
Des pièces censées être alignées sont posées par des commandes scriptées (les vraies) ; après la stabilisation : écart des bords qui doivent coïncider, inclinaison, glissement entre le lâcher et le repos, bord visé / bord posé.

| cas | avant (simulation 3) : bords · incl. · glissement · visé/posé | après (simulation 4) |
|---|---|---|
| O sur O · I sur I · O contre O · J et L contre O | 0 mm · 0° · 0 mm · 0 | 0 mm · 0° · 0 mm · 0 |
| **T couché contre O** (un quart de tour) | **−1 861 mm · 90° · 1 361 mm · 250 mm** : le T tombe | **0 · 0° · 0 · 0** |
| T tête en bas dans un creux d'une case | 1 mm · 0,01° · 1 mm | 0 mm · 0° · 0 mm |
| colonne de 8 O (tassement sur 16 m) | 0 mm · 0° · 0 · **−23 mm** | 0 · 0° · 0 · **−2 mm** |
| **mur de 6 pièces** (2 rangs de 3 O) | **2 989 mm, 1 pièce éjectée** | 2 mm · 0° · 3 mm, 6 pièces posées |

**Bords hors de la grille des demi-cases** (28 formes × quarts de tour) : version 3 — **le T à 1 et 3 quarts de tour (2 huitièmes = 25 cm)**, aucune autre ; version 4 — aucune.

**Les causes et leur part** (mesurées en changeant un seul facteur) :
| cause | écart | explique | corrigé par |
|---|---|---|---|
| position pilotée au centre de masse (T couché hors grille) | 250 mm de bord, puis le T bascule | 100 % de l'écart du T couché | boîte englobante + pivot sur la grille |
| **lâcher trop tôt le long d'un voisin collé** (la forme testée était agrandie dans tous les sens), puis éjection au passage du coin (le voisin posé juste dérive de 1 à 2 mm) | 2 989 mm, une vie perdue | 100 % de l'écart du mur de 6 | pièce en main sans contact, lâcher « quand quelque chose est dessous » |
| glissement ou inclinaison à la pose d'une pièce **bien posée** | 0 mm · 0° | **0 %** (la physique tient quand tout est aligné) | — |
| pénétration et tassement de Rapier (paramètres par défaut) | −24 mm sur 8 carrés | 100 % du tassement | contact 120 Hz, pénétration permise 0,1 mm : −2 mm |
| trait d'encre dessiné à cheval sur le bord du collider | 70 mm de chaque côté : **140 mm de recouvrement apparent** entre deux pièces qui se touchent | tout le « trompeur » visuel | encre à l'intérieur du collider (0 mm) |
| référence de grille différente (pièce / plateforme) | aucune : les bords de la plateforme (20 à 32 huitièmes) sont sur la grille | 0 % | — |

## Ce qui a été changé
- **Simulation 4** (`TOWER_SIM_VERSION` = 4, `VERSIONS_SIM_JOUABLES` = 3 et 4, option `version` de `Partie`, la rediffusion nomme la sienne) : position pilotée = **bord gauche de la boîte englobante** (`grille.ts`), la pièce naît sur la grille ; **quart de tour autour du centre de la boîte** (translation calculée dans `src/`, `lab/pieces.ts` intact) ; **décalage de secours** d'un quart de tour refusé : demi-case à gauche, puis à droite, puis vers le haut, avant de refuser (**proposition**, débrayable : `ROTATION_SECOURS` / option `secoursRotation`) ; **la pièce en main est un fantôme** (aucun contact) qui lâche quand quelque chose est EN DESSOUS (forme agrandie vers le bas de la marge de 3 cm, rétrécie de 5 mm sur les côtés) ; paramètres de contact.
- **Paramètres de contact retenus** (`contact.ts`, `CONTACT_V4`) : fréquence naturelle du contact **120 Hz** (Rapier : 30), pénétration permise **0,1 mm** (1 mm), prédiction 2 mm (inchangée), 30 itérations, 1 itération interne. Essais (colonne de 8 : tassement) : défaut −24 mm ; 0,1 mm seul −24 ; + 60 Hz −6 ; **+ 120 Hz −2** ; itérations internes ×4 −21 ; prédiction 1 mm −24. Seule la fréquence agit.
- **La version 3 reste rejouable au bit près** : ses cinq rediffusions de référence sont gardées sous `anciennesSim` dans le golden (Node et trois navigateurs), les jours figés en simulation 3 se relisent (la preuve se rejoue en version 3). **Golden de la version 4** : cinq rediffusions (`essai`, `alignement`, `jour-avec-paliers`, `zero-vie`, `tirage`) ; empreinte de la partie scriptée de `partie.test.ts` : v3 `1e7e3a52a2102cf8`, v4 `56a779235d584dc4`. Le serveur enregistre la version de la rediffusion rejouée (`apps/api/src/tower.ts`, une ligne).
- **Dessin égal au collider** (`dessinPiece.ts`) : l'encre est la forme physique ; couleur et liseré d'effet en retrait, à l'intérieur ; la plateforme aussi (son dessus est à y = 0).
- **Visée** (`Partie.visee()`, lecture seule) : deux traits translucides depuis les bords de la pièce jusqu'à la première surface, et le contour de l'arrivée. Option `visee` (allumée ; `?visee=0` l'éteint ; `Scene3D.viseeActive` pour les Réglages du T7).
- **Fantôme éteint par défaut**, en **un seul contour** de la silhouette de la tour (`contour.ts`) ; le Diamant suit la même règle.
- **`?scenario=alignement`** (hors production) : O, O, I, J, L, T, T, S, Z, O, I, T sur 7 m.
- **Jours déjà préparés** de `apps/tower/public/jours/` (versés par une mise en production, simulation 3) : **non touchés** ; ceux sans résultat seront re-préparés à la prochaine mise en production, parce que leur version diffère. Trois jours préparés en simulation 4 s'ajoutent aux fixtures de test (05, 13 et 16/11).

## Le bot en version 4 (30 jours du T3b : 05/11 → 04/12/2026, `mesures-t3:tower`, les mêmes tirages que le T3b)
| Diamant (m) | min | Q1 | médiane | Q3 | max |
|---|---|---|---|---|---|
| T3b (simulation 3) | 25,2 | 33,9 | 47,5 | 60,0 | 60,0 |
| **Simulation 4** | **27,7** | **36,6** | **46,4** | 60,0 | 60,0 |
- Tirages retenus : t0 22 · t1 5 · t2 2 · t3 1 (T3b : 25 · 4 · 1 · 0) ; **1,40 bot joué par jour** (T3b : 1,20) ; aucun jour hors plage [25 ; 60] m ; bots au-dessus du plafond : 10 jours sur 30 (T3b : 8). Le bot n'a pas changé : ses coups sont des pas de demi-case du bord de la boîte, désormais toujours sur la grille.
- **Temps de préparation : 14 jours sur 4 cœurs en 6 min 24 s** (limite 8 min ; T3b : 4 min 49 s, soit +33 % : la pièce en main sans contact, les contacts plus raides et un tirage de plus par jour). Par jour sur un fil : médiane 80 s, pire 262 s (T3b : 43 s et 179 s). La mesure des 30 jours (13 min 36 s) a tourné pendant que d'autres calculs chargeaient la machine : seule la mesure des 14 jours, seule sur la machine, compte.

## Poids (`node apps/tower/tools/mesure.mjs`, gzip)
| ligne | avant (T5) | après | plafond | marge |
|---|---|---|---|---|
| `tower.jsCss` (l'accueil) | 37 011 | **37 101** (+90) | 39 000 | 1 899 |
| `tower.jeu` | 161 613 | **163 876** (+2 263) | 164 000 | **124** |
`budgets.md` est remesuré. **La marge de 2,4 Ko du jeu est consommée (reste 124 o)** (visée, dessin, contour, grille) : le prochain lot de Tower devra alléger ou demander un relèvement à Nathan (chiffré : +2 000 o suffiraient pour le T5b et les Réglages du T7 si leur code est à la demande).

## Vérifié / non vérifié
- **Vérifié** : tests unitaires (`grille`, `poseJuste`, `visee`, `dessinPiece`, `contour`, rediffusion 3 et 4, golden, bot, fantôme éteint par défaut) ; la visée n'influence pas la rediffusion (même code, même résultat, même empreinte avec ou sans visée à chaque tick, versions 3 et 4) ; 7 formes × 3 tailles × 4 quarts de tour sur la grille ; dessin = collider au pixel près à 20 px/m ; rendu dans un vrai Chromium (visée, contour d'arrivée, deux carrés collés avec leur trait double, tour de 10 pièces) ; typecheck, build.
- **Non vérifié** : la sensation d'un humain (la visée est discrète : 35 % d'opacité, à ajuster en jouant) ; téléphone en portrait ; Firefox et WebKit autrement que par le petit ensemble `@navigateurs` de la CI (les dix rediffusions de référence) ; la stabilité de contacts à 120 Hz sur de très hautes tours jouées par des humains (le bot a joué 42 parties de 40 pièces sans incident, mais un joueur fait des tours plus mal bâties) ; la CI de la PR.

## Questions pour Nathan
1. **Le décalage de secours** d'un quart de tour refusé (gauche, droite, haut) est une proposition : le garder ? (`ROTATION_SECOURS = false` le débraye.)
2. **Le coup de vent** pousse d'un huitième de mètre par construction : pendant ses trois pièces la pièce sort de la grille. À garder tel quel, ou pousser d'une demi-case moins souvent (au T5b, avec ses autres valeurs) ?
3. **La pièce en main ne touche plus rien** (elle passe à travers une pièce encore en train de tomber) : sans effet pour un joueur normal, mais à valider en jouant.
4. **Budget** : accepter 124 o de marge sur `tower.jeu`, ou relever le plafond (+2 000 o) maintenant ?
5. Le calcul des jours coûte 33 % de plus ; la limite de 8 min tient (6 min 24 s pour 14 jours).

## Liens de test (aperçu de la PR)
- `/tower/?scenario=alignement` : pose les O côte à côte, l'I dessus, cale le J et le L contre, tourne le T et pose-le dans un creux ; les traits de visée montrent où la pièce tombe.
- `/tower/?seed=2026-11-05` : plus de silhouette de la partie précédente, sauf si tu la choisis avec le bouton fantôme.
