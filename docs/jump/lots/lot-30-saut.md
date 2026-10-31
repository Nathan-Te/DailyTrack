# Lot 30 — Saut moins sensible (DailyJump)

Versions : `JUMP_SIM_VERSION` **13** (`MIN_HOLD_VERSION` : v3 à v12 se jouent toujours, golden **identiques au bit**) · `JUMP_GENERATOR_VERSION` **24** (identifiants `…-g24`, `MIN_HOLD_GENERATOR`) · `EXIGENCE_VERSION` 6 · `MODULE_SIM_VERSION` 3 inchangée. Branche `claude/eloquent-newton-cf9dhu`, PR brouillon `jeu:jump`. Règles : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md` (« Saut moins sensible (lot 30) »). Retour des joueurs : le saut est trop sensible, un petit saut s'obtient par un appui de 5 pas (42 ms) qu'on ne dose pas au clavier ou à la manette.

**Décisions de Nathan en cours de lot** : le cahier des charges disait 10 pas ; après essai de l'aperçu (hauteur minimale trop haute) il a demandé **le micro-saut comme avant**, puis **un maintien de 6 pas** et la re-résolution complète. Ce rapport décrit l'état final ; un premier catalogue à 10 pas (46 min de calcul) a été résolu puis remplacé.

## Scénario en 2 clics

`<aperçu>` = `https://playdujour-recette--pr-206-dy33k3w9.web.app/jump/` (commentée sur la PR) ; en local : `npm run dev:jump`. Le morceau, **`vent-piliers` variante 1**, est celui qui exigeait le plus petit appui avant le lot (5 pas, notée 5, la plus dure des solutions à 5 pas qui existent encore).

1. **Taps normaux** : `<aperçu>?module=vent-piliers&variante=1&entree=arret` — le morceau seul dans la version 13. Un appui de **5 ou 6 pas** (42–50 ms) donne le petit saut (1,89 tuile), plus long la courbe d'avant, un effleurement de **4 pas ou moins** (33 ms) le **micro-saut** d'avant (0,98 à 1,54 tuile).
2. **Les réglages** : `<aperçu>?module=vent-piliers&variante=1&entree=arret&debug&tune` — section « Maintien du saut », deux curseurs : le **maintien** (6 pas) et le **micro-saut** (4 pas). Maintien à 0 : l'ancien comportement ; micro-saut à 0 : plus de micro-saut ; maintien à 10 : le petit saut de 2,53 tuiles du premier essai (le catalogue est résolu pour 6). La partie est « réglages modifiés » : **rien n'est enregistré ni envoyé**.

**Niveaux du jour qui commencent par de petits sauts** (preuve de l'auteur) : `<aperçu>?seed=2026-11-02` (néon : 4 petits sauts sur les 5 premiers), `?seed=2026-11-15` (néon : 3 d'affilée), `?seed=2027-01-05` (glace : 3 d'affilée), `?seed=2027-01-23` (nuit). `?seed=` est fermé en production pour une date future.

## 1. Mesure d'abord (catalogue g23, avant tout changement)

`npm run appuis:modules -w @cdj/jump-sim` (nouvel outil, lecture seule ; `--liste`, `--seuil=`, `--plancher=`) sur les **1 404 solutions gardées** (arrêt + élan, note ≥ 1) : [`lot-30-appuis-avant.txt`](lot-30-appuis-avant.txt). Aucune solution n'avait d'appui de 1 à 4 pas (règle du lot 11 : ≥ 5 pas), mais :

| mesure | avant (g23) | après (g24, maintien à 6) |
|---|---|---|
| solutions gardées · appuis de saut | 1 404 · 4 824 | 1 359 · 4 710 ([`après`](lot-30-appuis-apres.txt)) |
| appuis de **moins de 10 pas** | **1 772 (37 %)** : 5 pas 573, 6 pas 567, 7 pas 194, 8 pas 299, 9 pas 139 | la règle est 6 pas : **0 appui sous 6** |
| variantes avec un saut · dont un appui < 10 pas | 689 · **506** | 681 · 506 (sous 6 pas : **0**) |
| plus court appui par solution | 5 pas : 384 solutions, 6 pas : 247 | 6 pas : 602, 7 pas : 113, 8 pas : 129 |
| reprises de `phases.json` sous la règle | 1 723 sur 2 624 (< 10) | 0 sur 2 480 (< 6) |
| variantes dont **un** appui seul ne tolère pas ±4 pas | 293 (plancher 5) | 151 (plancher 6) ; la règle retenue est statistique (§ 3) |

Morceaux concernés avant le lot : tous ceux dont le plus court appui valait 5 ou 6 pas, **la grande majorité du catalogue** (`ascenseur`, `scie-ronde`, `stalactite-*`, `tapis-*`, `vent-*`, `laser-balayage`, `marelle`… : `lot-30-appuis-avant.txt`).

## 2. Le maintien minimal et le micro-saut (sim v13)

- `JUMP_MIN_HOLD` = **6 pas** (50 ms). Un saut (sol, coyote, tampon, **mural**) relâché avant 6 pas continue comme s'il était tenu 6 pas, puis la coupe agit si le bouton est encore relâché. Hauteurs (tuiles) : 1 pas **0,98** · 2 pas 1,17 · 3 pas 1,36 · 4 pas 1,54 · **5 et 6 pas 1,89** · 8 pas 2,22 · 10 pas 2,53 · 12 pas 2,82 : **au-delà de 6 pas la courbe est celle d'avant, au bit près**.
- **Micro-saut** (`JUMP_MICRO_MAX` = 4 pas, 33 ms, `PlayerState.pressLen`) : un appui de 4 pas ou moins n'est pas prolongé, le saut est coupé comme avant (un appui bref pendant la chute, relâché avant que le saut parte à l'atterrissage, reste un micro-saut). **Aucune solution n'en a besoin** (appuis ≥ 6 pas) : le catalogue n'en dépend pas, il se règle à part.
- **La zone « tout appui donne le même saut » ne fait que 2 pas (5 et 6)** : conséquence de « 6 pas » avec un micro-saut jusqu'à 4. Micro-saut à 3 ou 2 (curseur de `?debug&tune`, sans rien re-résoudre) : la zone devient 4–6 ou 3–6.
- `Level.minHold` / `Level.microMax` (0 avant la v13), `JumpParams.jumpMinHold` / `jumpMicroMax` (absents des défauts, `?debug&tune` seulement : la partie devient `tuned`).
- Tests : `maintien.test.ts` (trajectoires au bit près, micro-saut, tampon, mural, coyote), `golden*.test.ts` (**v3 à v12 intacts**, v13 nouvelle).

## 3. Solveur et règle du lot 8c (g24)

- **Appuis humains ≥ 6 pas** (`PRESS_MIN` = `JUMP_MIN_HOLD`, 5 avant), relâchement ≥ 3 pas inchangé. **Tolérance sur la durée d'appui** (`HOLD_VARIATION` = 4) : la gigue ±3 sur les instants s'accompagne d'une variation de **−4 à +4 pas de la durée de chaque appui** (`holdVaried`), jamais sous 5 pas (pas de micro-saut par accident) ; **même seuil que le lot 8c** (≥ 50 % à ±3, note sur ±3, raccord ≥ 90 %). Un saut qui ne réussit que pour quatre durées consécutives tombe à ≈ 20 % : refusé (`appuis.test.ts`) ; sans la variation, il passait.
- **Plus le petit saut est bas, plus la variation de ±4 pas pèse** : un appui de 6 pas varié à 10 monte de 1,89 à 2,53 tuiles ; un passage qui ne tolère que 6 à 7 pas échoue la règle. D'où plus de variantes écartées qu'avec 10 pas (52 sur 702) alors que le petit saut est plus bas.
- **Catalogue re-résolu en entier** (`solve:modules --force` 45 min sur 4 fils, `phases:modules` 10 min, `etats:modules` 35 s, `voies:modules` 2,5 min). Solutions : 6 introuvables (variantes à rafales, inconnues de la v13), 48 « au pas près » (note 0).
- **Variantes écartées** (méthode du lot 17 : texte, place et anciennes solutions gardés pour les références, le catalogue g24 ne les pose pas) : **61 sur 707**, liste : [`lot-30-variantes-ecartees.txt`](lot-30-variantes-ecartees.txt) — 44 sans solution jouable, 17 qui tiennent la règle des appuis mais pas une règle de composition (respiration à plus de 2 ou à moins de 3 sauts, durée hors de 1–6 s — 5–8 s pour les longs —, poursuite franche des ponts). Refus toutes phases : 10 ; reprise en B : aucune ; voies parasites fermées : 4 (`chaland` v1 et v3, `monte-charge` v1, `nuit-cheminee` v7). **Un morceau disparaît : `tapis-relais`** (quatre essais de variantes plus clémentes ont tous échoué à l'entrée en élan, 0 à 3 % de réussite). `lucarne` et `neon-cheminee` n'ont plus qu'une variante.
- **Ajouts pour garder le générateur à secours 0** (méthode du lot 17) : `escalier-scies` v4 (`cycle=278`, retenue sur six essais) et **un morceau neuf, `tunnel-rase`** (un long de 5,5 s dérivé de `tunnel-scies`, autre rythme de scie : trois variantes jouables sur quatre). Sans lui, le 01/12/2026 (usine) n'avait plus aucun enchaînement long disponible : les huit longs communs étaient exclus par la règle de variété (W = 4) et `tapis-relais` n'existe plus.
- **Avec le lot** : le catalogue d'avant est figé dans `src/legacy/` (hors du jeu, chargé par les tests et les outils : `useLegacyCatalog()`), de quoi garder les références v3 à v12 au bit près **sans doubler le poids du jeu** ; secours de chaque thème rechoisis (`FALLBACK_V13`) ; `?semaine=…&generateur=14` ne recalcule plus g14 (la page le dit).
- **Tests de composition ajustés, signalés** (aucune règle du générateur relâchée) : « deux portions dures » de la nuit à ponts → une ; un échange de danger garde l'exigence de son origine « à deux notes près » ; `champignon-falaise` n'est plus une portion dure (note 3 au plus) ; 1 passage intermédiaire (au lieu de 2) parmi les morceaux à plateformes ; 2 jours sur 8 (au lieu de 3) avec deux morceaux à pont ; le plafond de morceaux en commun entre deux jours consécutifs ne vaut qu'à partir de la règle de variété (27/10/2026).

## 4. Mesures comparées au dernier lot (120 dates `measure:jump`, 365 dates `variete:jump`)

| mesure | g22 (lot 28) | g24 |
|---|---|---|
| niveau de secours (120 dates · 365 dates) | 0 · 0 | **0 · 0** |
| tirages validés · retenu (moy. · max) | 162 · 6,74 · 186 | 158 · **5,05 · 45** |
| temps de l'auteur (min · moy. · max) | 28,02 · 29,53 · 32,01 s | 28,04 · **29,46** · 31,78 s |
| plus longue course au sol sans saut (moy. · max) | 1,18 · 1,93 s | 1,19 · **2,00 s** (≤ 2 s) |
| génération rejeux compris (moy. · max, machine différente) | 66,4 · 362,9 ms | 77,9 · 318,1 ms |
| W = 4, 365 dates | 0 secours, 0 retour | **0 secours, 0 retour** (W = 5 : hors de portée comme avant) |
| génération à froid, 48 dates | 0,22 · 0,60 s | **0,26 · 0,60 s** (< 1,5 s) |
| jours avec l'élément du lot (forêt · usine · glace · nuit · néon) | 81 · 56 · 83 · 81 · 61 % | 71 · 84 · 67 · 78 · 71 % |
| budget Jump (JS + CSS) | 377 503 o (`main`, `scripts/budgets.mjs`) | **378 225 o (+722, marge 3 265 o sur 381 490)** — pour que le gain vienne de ce lot, les anciennes suites de secours (v3 à v12) quittent le jeu avec l'ancien catalogue (`src/legacy/secours.ts`) |
| même budget, mesuré par `apps/jump/e2e/poids.spec.ts` | 379 481 o (`main`, **déjà au-dessus du plafond de 991 o**) | 380 203 o (+722) |

**Budget Jump relevé par Nathan (31/10/2026) : 378 490 → 381 490 o** (`apps/jump/e2e/poids.spec.ts`, `PLAFOND_RELEVE`). `poids.spec.ts` compte `interrupteur-*` (≈ 1 980 o) que `scripts/budgets.mjs` exclut : `main` mesurait déjà 379 481 o par le spec, ce lot 380 203 o (+722).

**Les temps de l'auteur ne bougent pas** (moyenne 29,53 → 29,46 s) : pas de recalibrage des médailles à proposer. Le niveau et la preuve du jour ne dépendent pas du micro-saut (`daily-golden-v13.json` identique avec ou sans) ; seuls les essais fictifs de la démo ont changé (`replay-golden-v13.json`, `public/demo/` régénérés).

## Décisions laissées à Nathan

1. **Zone « même saut » de 2 pas (5–6)** : voir § 2. Si le geste reste trop précis : micro-saut à 3 ou 2 pas (réglage seul) ; ou un maintien de 7 à 8 pas (zone plus large, petit saut plus haut, catalogue à re-résoudre, ≈ 1 h 30).
2. **`tapis-relais` disparaît** ; `tunnel-rase` est un morceau dérivé de `tunnel-scies` (même géométrie, autre rythme) ajouté pour la réserve de longs : à remplacer par un vrai morceau si la ressemblance gêne.
3. **`?semaine=…&generateur=14`** ne recalcule plus g14 (poids) ; à rétablir par un fichier comme g13 si l'outil sert encore.
4. **Index du `CLAUDE.md` racine** (zone partagée, non touché) : y ajouter « Saut moins sensible (lot 30) » sous `packages/jump-sim/CLAUDE.md` et sous `apps/jump/CLAUDE.md`.
5. **Pour les joueurs** : la PR le dit.

## Vérifié, non vérifié

**Vérifié** : suite sqlite complète (338 fichiers, 5 130 tests, golden v3 à v12 inchangés), typecheck, construction, les mesures ci-dessus, le budget. **Non vérifié** : e2e et libSQL du dernier commit (la CI), Firefox et WebKit, le ressenti du petit saut et du micro-saut sur clavier et manette réels (à essayer avec les liens), aucune capture regardée.
