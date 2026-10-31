# Lot 30 — Saut moins sensible (DailyJump)

Versions : `JUMP_SIM_VERSION` **13** (`MIN_HOLD_VERSION` : v3 à v12 se jouent toujours, golden **identiques au bit**) · `JUMP_GENERATOR_VERSION` **24** (identifiants `…-g24`, `MIN_HOLD_GENERATOR`) · `EXIGENCE_VERSION` 5 · `MODULE_SIM_VERSION` 3 inchangée. Branche `claude/eloquent-newton-cf9dhu`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` (« Saut moins sensible (lot 30) »), `apps/jump/CLAUDE.md` (même titre). Retour des joueurs : le saut est trop sensible, un petit saut s'obtient par un appui de 5 pas (42 ms) qu'on ne dose pas au clavier ou à la manette.

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. Le morceau choisi, **`vent-piliers` variante 1**, est celui qui exigeait le plus petit appui avant le lot (5 pas, notée 5, la plus dure des solutions à 5 pas qui existent encore) :

1. **Taps normaux** : `<aperçu>?module=vent-piliers&variante=1&entree=arret` — joue le morceau seul dans la version 13. Tape le saut brièvement (60 à 120 ms) : un appui de 5 à 10 pas fait **le même petit saut** (2,53 tuiles), tenir plus longtemps monte plus haut. Le passage ne demande plus un appui au pas près. **Micro-saut** : un effleurement de 33 ms ou moins (4 pas, une image à 60 Hz) coupe le saut comme avant (≈ 1 tuile).
2. **Le réglage** : `<aperçu>?module=vent-piliers&variante=1&entree=arret&debug&tune` — section « Maintien du saut » du panneau : deux curseurs : le **maintien** (10 pas) et le **micro-saut** (4 pas). Maintien à **0** : l'ancien comportement (le saut dépend de la durée exacte) ; micro-saut à **0** : plus de micro-saut, tout appui bref est le petit saut ; maintien à 20 : le petit saut monte à ≈ 3,8 tuiles. La partie est alors « réglages modifiés » : **rien n'est enregistré ni envoyé**. Ramener le curseur à 10 retire le réglage.

## 1. Mesure d'abord (catalogue g23, avant tout changement)

`npm run appuis:modules -w @cdj/jump-sim` (nouvel outil, lecture seule ; `--liste` pour le détail) sur les **1 404 solutions gardées** (arrêt + élan, note ≥ 1) : sortie complète dans [`lot-30-appuis-avant.txt`](lot-30-appuis-avant.txt). Aucune solution n'avait d'appui de 1 à 4 pas (la règle du lot 11 : ≥ 5 pas), mais :

| mesure | avant (g23) | après (g24) |
|---|---|---|
| solutions gardées · appuis de saut | 1 404 · 4 824 | 1 342 · 4 728 |
| appuis de **moins de 10 pas** | **1 772 (37 %)** : 5 pas 573, 6 pas 567, 7 pas 194, 8 pas 299, 9 pas 139 | **0** |
| variantes avec un saut · dont un appui < 10 pas | 689 · **506** | 661 · 0 |
| plus court appui par solution | 5 pas pour 384 solutions, 6 pour 247 | 10 pas pour 470, 11 pour 173, 12 pour 205 |
| reprises de `phases.json` à appui < 10 pas | 1 723 sur 2 624 | 0 sur 2 472 (refaites) |
| variantes dont **un** appui ne tolère pas ±4 pas (essai appui par appui, plancher 5 puis 10) | 293 | 238 (la règle retenue est statistique : voir § 3) |

Les morceaux concernés avant le lot : tous ceux dont le plus court appui valait 5 ou 6 pas — **la grande majorité du catalogue** (`ascenseur`, `scie-ronde`, `stalactite-*`, `tapis-*`, `vent-*`, `laser-balayage`, `marelle`… : voir les 100 lignes de `lot-30-appuis-avant.txt`).

## 2. Le maintien minimal (sim v13)

- `JUMP_MIN_HOLD` = **10 pas** (≈ 83 ms). Un saut (sol, coyote, tampon, **mural**) relâché avant 10 pas continue comme s'il était tenu 10 pas, puis la coupe agit si le bouton est encore relâché. **Micro-saut (retour de Nathan sur l'aperçu)** : un appui de `JUMP_MICRO_MAX` = **4 pas ou moins** (33 ms) n'est pas prolongé et coupe le saut comme avant (0,98 tuile à 1 pas, 1,36 à 3 pas, 1,55 à 4 pas ; `PlayerState.pressLen`). Hauteurs : 5 pas 1,71 → 2,53 ; 10 pas 2,53 (inchangé) ; 12 pas 2,82, 16 pas 3,35, 24 pas 4,19 : **au-delà de 10 pas la courbe est celle d'avant, au bit près**. Le petit saut est donc plus haut qu'avant (2,53 contre 1,71 pour le plus petit appui admis jusqu'ici) : c'est le prix du « tout appui bref donne le même saut » et la raison de l'écart du catalogue (§ 4).
- `PlayerState.jumpAge` (absent sans maintien : les empreintes d'avant ne bougent pas), `Level.minHold` (0 avant la v13 ; ligne `maintien <n>` pour les morceaux joués seuls), `JumpParams.jumpMinHold` (absent des défauts, `?debug&tune` seulement : la partie devient `tuned`).
- Tests : `maintien.test.ts` (appui de 1 à 10 pas = même trajectoire au bit près ; au-delà, la courbe d'avant ; mural, coyote, nouvel appui tenu ; niveaux v12 et v13 côte à côte), `golden*.test.ts` (**v3 à v12 intacts**, v13 nouvelle : `daily-golden-v13.json`, `replay-golden-v13.json`).

## 3. Solveur et règle du lot 8c (g24)

- **Appuis humains ≥ 10 pas** (`PRESS_MIN` = 10, 5 avant), relâchement ≥ 3 pas inchangé (la mesure n'a pas montré de problème). **Tolérance sur la durée d'appui** (`HOLD_VARIATION` = 4) : la gigue ±3 sur les instants s'accompagne d'une variation de **−4 à +4 pas de la durée de chaque appui** (`holdVaried`) ; au-dessus du minimum seulement (sous 10 pas, c'est le même saut) ; **même seuil que le lot 8c** (≥ 50 % à ±3, note sur ±3, raccord ≥ 90 %). Un saut qui ne réussit que pour quatre durées consécutives tombe à ≈ 20 % : refusé (`appuis.test.ts`) ; sans la variation, la même suite passait.
- **Catalogue re-résolu en entier** (`solve:modules --force`, **46 min** sur 4 fils, puis `phases:modules` 16 min, `etats:modules` 25 s, `voies:modules` 100 s). Solutions : 9 introuvables, 53 « au pas près » (note 0).
- **Variantes écartées** (méthode du lot 17 : la variante garde son texte, sa place et ses anciennes solutions pour les références ; le catalogue g24 ne la pose pas) : **52 sur 702** (liste : [`lot-30-variantes-ecartees.txt`](lot-30-variantes-ecartees.txt)) — sans solution jouable (42 : introuvable ou « au pas près ») ; 10 autres tiennent la règle des appuis mais pas une règle de composition du catalogue (respiration à plus de 2 ou à moins de 3 sauts, durée hors de 1–6 s — 5–8 s pour les enchaînements longs —, poursuite franche des ponts). Un seul morceau disparaît : **`tapis-relais`**. `tunnel` garde 4 variantes sur 7, `ressort-mur-iles` 2 sur 5, `pont-coude` 2 sur 4. Refus de la validation toutes phases : 9 variantes (3 avant) ; reprise en B : aucune (`laser-alterne-portes` v6 était refusée) ; voies parasites : aucune.
- **Ce qui est allé avec** : le catalogue d'avant est figé dans `src/legacy/` (hors du jeu, chargé par les tests et les outils : `useLegacyCatalog()`), de quoi garder les références v3 à v12 au bit près **sans doubler le poids du jeu** ; secours de chaque thème rechoisis (`FALLBACK_V13`, `secours:modules`) ; `?semaine=…&generateur=14` ne recalcule plus g14 (la page le dit).
- Aucune règle relâchée dans le générateur ; **trois tests de composition du catalogue ont été ajustés et sont signalés** : « deux portions dures » de la nuit à ponts → une (`pont-coude`), un échange de danger garde l'exigence de son origine « à une note près » (solutions re-résolues une à une), 40 → 37 variantes à alternés.

## 4. Mesures comparées au dernier lot (120 dates, `measure:jump` ; 365 dates, `variete:jump`)

| mesure | g22 (lot 28) | g24 |
|---|---|---|
| niveau de secours (120 dates) | 0 | **0** |
| tirages validés · retenu (moy. · max) | 162 · 6,74 · 186 | 154 · 7,03 · **101** |
| temps de l'auteur (min · moy. · max) | 28,02 · 29,53 · 32,01 s | 28,00 · **29,51** · 31,62 s |
| plus longue course au sol sans saut (moy. · max) | 1,18 · 1,93 s | 1,19 · **1,98 s** (≤ 2 s) |
| génération rejeux compris (moy. · max, machine différente) | 66,4 · 362,9 ms | 93,6 · 647,5 ms |
| W = 4, 365 dates | 0 secours, 0 retour avant 4 jours | **0 secours, 0 retour** (W = 5 : 614 retours, hors de portée comme avant) |
| génération à froid, 48 dates | 0,22 · 0,60 s | **0,35 · 1,18 s** (< 1,5 s) |
| jours avec l'élément du lot (forêt · usine · glace · nuit · néon) | 81 · 56 · 83 · 81 · 61 % | 71 · 84 · 67 · 78 · 71 % |
| budget Jump (JS + CSS) | 372 941 o (`main`, mesuré) | **376 010 o (+3 069, marge 2 480)** |

**Les temps de l'auteur bougent à peine** (moyenne 29,53 → 29,51 s) : pas de recalibrage des médailles à proposer. Les 120 dates restent dans la cible (exigence par minute 426–562, hauteur ≤ 56, 8 à 12 morceaux).

## Décisions laissées à Nathan

0. **Micro-saut ajouté après ton essai** : un appui de 4 pas ou moins redonne le saut bas d'avant ; **mais il ne reste aucun saut intermédiaire** (1,6 à 2,4 tuiles) pour un appui de 5 à 10 pas : entre le micro-saut (≤ 1,55) et le petit saut (2,53), seul un appui de 11 pas et plus monte plus haut. Les passages « un peu plus bas que 2,5 » restent donc fermés à un appui court. Si tu veux un petit saut plus bas (6 ou 7 pas ≈ 1,9–2,0 tuiles) en plus du micro-saut, c'est un autre `JUMP_MIN_HOLD` : tout le catalogue est à re-résoudre (≈ 1 h 30 de calcul, comme ce lot) ; les deux curseurs de `?debug&tune` servent à en juger au ressenti avant.
1. **Le petit saut monte à 2,53 tuiles** : c'est la conséquence directe de « tout appui de 1 à 10 pas = le saut de 10 pas » (cahier des charges). Les passages à plafond bas (`tunnel`, `plafond-pics`, `saut-plafond`…) sont plus difficiles ou écartés. Si c'est trop haut, `JUMP_MIN_HOLD` est réglable : 8 donnerait 2,22 tuiles (un nouveau lot, solveur compris).
2. **Variantes de remplacement** : je n'en ai ajouté aucune (`MAX_VARIANTS` reste 10, `tapis-relais` disparaît). Un lot « variantes plus tolérantes » peut les rendre ; l'usine perd son morceau de tapis le plus dur.
3. **`?semaine=…&generateur=14`** ne recalcule plus g14 (poids) ; à rétablir par un fichier comme g13 si l'outil sert encore.
4. **Index du `CLAUDE.md` racine** (zone partagée, non touché) : y ajouter « Saut moins sensible (lot 30) » sous `packages/jump-sim/CLAUDE.md` et sous `apps/jump/CLAUDE.md`.
5. **Pour les joueurs** : la PR le dit.

## Vérifié, non vérifié

**Vérifié** : tests unitaires `jump-sim` (1 069, golden v3 à v12 inchangés), `apps/jump`, API Jump, typecheck, mesures ci-dessus. **Non vérifié** : tests e2e (CI), Firefox et WebKit, libSQL, le ressenti du petit saut sur clavier et manette réels (à essayer avec les deux liens), aucune capture regardée.
