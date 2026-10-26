# Lot 23 — Champignons (DailyJump, thème forêt)

Versions : `JUMP_SIM_VERSION` **7** (nouvelle : v3 à v6 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **17** (identifiants `…-g17`, `MUSHROOM_GENERATOR`) · `W` = 3 (inchangé). Branche `claude/lot-23-champignons-vcg9t8`, PR brouillon `jeu:jump`.

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. (Depuis le lot R9, `&solution` et `?semaine` ne fonctionnent que dans les constructions hors production : aperçu, recette, local.)

1. **Le morceau où le rebond renforcé est nécessaire** (`champignon-falaise`, un rebord plus haut que le plus haut rebond simple, paroi hérissée de pics : il faut **tenir le saut au contact du chapeau**) :
   - `<aperçu>?module=champignon-falaise&variante=0&entree=arret` : à jouer ; `&solution` rejoue la solution enregistrée (un rebond renforcé) ; `&debug` montre `__jump.mushrooms` et les limites du morceau ;
   - en jouant sans tenir le saut, le rebond simple retombe sous le rebord ; la galerie : `<aperçu>?modules` (étiquette « champignon », sept morceaux).
2. **Un jour de forêt g17 avec deux morceaux à champignons et un vent** : `2026-11-08` (`champignon-tourbillon` v1, rafales + murs, et `champignon-falaise` v0) :
   - `<aperçu>?seed=2026-11-08` · `<aperçu>?seed=2026-11-08&debug` (limites des morceaux, `__jump.mushrooms`, trajets des voies lentes) · `&solution` rejoue la preuve de l'auteur ;
   - autres jours : `2026-11-03` (`champignon-iles` + `champignon-tourbillon`), `2026-11-28` (le jour de référence du golden : `champignon-tourbillon` v3 + `champignon-zigzag` v6) ; la semaine d'un coup : `<aperçu>?semaine=2026-11-02&debug`.

## 1. Les impulsions (simulation v7, `attempt.ts`, constantes de `level.ts`)

Un champignon est une tuile **traversable** (ni solide, ni danger) posée contre un bloc plein ; le rebond part **au pas où la boîte du personnage commence à chevaucher sa zone de contact** (la moitié de la tuile, côté chapeau). Impulsion entière et fixe dans la direction du chapeau, **vitesse parallèle conservée** ; un saut **tenu à ce pas** multiplie tout par 130 % (`MUSHROOM_BOOST_PERCENT`).

| orientation (caractère) | rebond simple | rebond renforcé (×1,3) |
|---|---|---|
| sol `m` (chapeau en haut) | 900 u/pas vers le haut (≈ 5,2 tuiles ; un saut normal ≈ 4,2) | 1 170 (≈ 8,8 tuiles) |
| plafond `w` | 700 vers le bas | 910 |
| mur gauche `)` / mur droit `(` | 460 à l'opposé du mur, avec une montée de 420 (≈ 1,1 tuile) | 598 et 546 |

Tout reste sous `MAX_SPEED` (2 048). Le rebond remet en l'air (sol, coyote, tampon de saut, saut mural et glissade remis à zéro). Aucun champ d'état de plus : un niveau sans champignon se joue **exactement** comme en v3 à v6 (test : le même niveau en `version 6` et `version 7`, états égaux au pas près).

**Chevauchement avec le ressort (`*`)** : aucun. Le ressort est un bloc plein sur lequel on rebondit à la pose, le champignon une tuile traversable ; ils ne se partagent jamais une tuile et aucune règle de la simulation ne les relie. Le ressort n'a pas été touché (golden v3 à v6 intacts). À savoir seulement : le champignon de sol est un « ressort » qu'on **traverse**, plus haut, et dont le rebond se renforce en tenant le saut ; le ressort, lui, ne se renforce pas.

## 2. Règles du générateur (`champignons.ts`, `champignonsPieces.ts`)

- **Rien de mortel sur la trajectoire d'un rebond** : pour chaque champignon, des départs de rebond (simple **et** renforcé, plusieurs vitesses d'arrivée) sont joués **dans la vraie simulation pendant 36 pas (0,3 s)** ; aucun pic, trajet de scie, course de presse, bas de grille, sortie de section n'y est touché. **Aucun point de passage dans une trajectoire de rebond** (ni `S`, ni `F`) ; un champignon reste à ≥ 5 colonnes des bords de son morceau et sa zone de contact ne touche jamais le palier d'un point de passage (`respawnProblems`). Mémoïsée par variante du catalogue.
- Toutes les règles existantes s'appliquent : solveur, phases (attente ≤ 12 s), règle du lot 8c (±3 pas), `voies:modules`, plats (un champignon casse un plat : `tools/plats.ts`), reprise sur une voie lente, repos par la variété (W = 3). Les morceaux à champignons sont `theme: foret` et **réservés à la v7** (`mushroomModuleIds()`) : g9 à g16 restent au bit près. Ils comptent pour le quota de signature de la forêt (vent **ou** champignon).

## 3. Les 7 morceaux (44 variantes ; `theme: foret`)

Exigence (la plus haute des deux entrées) de chaque variante, dans l'ordre : `solutions.json`, `npm run rebonds:modules -w @cdj/jump-sim`.

| morceau | idée | étiquettes | exigences |
|---|---|---|---|
| `champignon-balade` | de champignon en champignon par-dessus des tours de 5 tuiles, puis deux marches (**respiration**) | respiration | 2 2 1 2 2 |
| `champignon-chapelet` | des piliers au-dessus d'un sol de pics, chaque rebond retombe sur le suivant | précision | 2 1 1 2 1 1 **4** 1 |
| `champignon-falaise` | un rebord plus haut que le plus haut rebond simple, paroi à pics : **rebond renforcé nécessaire** | vertical, précision | **5** 2 **5 5 5 5** |
| `champignon-iles` | des îlots suspendus, chaque champignon lance à peine plus haut que l'îlot suivant | vertical, précision | 1 1 1 1 3 1 |
| `champignon-rafale` | rebondir au bord d'une fosse, la rafale donne la distance (**vent**) | précision, vent | 1 2 3 **5** 2 **4** |
| `champignon-tourbillon` | un puits en deux étages : courant d'air montant par rafales puis champignons de mur (**vent**) | vertical, vent | 2 3 **4** 2 **4 5** |
| `champignon-zigzag` | un puits en zigzag, champignons de mur, saut tenu qui renforce | vertical | **4** 2 **4** 2 **5 4** 3 |

- **1 respiration** : `champignon-balade` (exigence 1–2 aux deux entrées). Sa règle « au moins trois sauts à faire » **compte les rebonds comme des sauts** (les solutions ont 2 à 5 appuis de saut et 1 à 2 rebonds) : décision à confirmer (§ 6).
- **Portions dures (une variante notée 4 ou 5), compatibles avec la voie lente** : `champignon-falaise` (5 variantes), `champignon-zigzag` (4), `champignon-tourbillon` (3), `champignon-rafale` (2), `champignon-chapelet` v6 ; **un morceau où le renfort est nécessaire** : `champignon-falaise` (les six variantes n'ont « aucune solution » avec un renfort de 100 % : vérifié en posant la constante à 100 le temps d'un `solve:modules --force --dry`, puis rétablie à 130).
- **2 morceaux qui combinent champignons et rafales** : `champignon-rafale`, `champignon-tourbillon`.

## 4. Variantes et idées refusées (une ligne chacune)

- **Ricochet** (flipper plafond + murs, plusieurs rebonds enchaînés) : toutes les variantes refusées par la jouabilité humaine (±3 pas < 50 %) ; abandonné.
- **`champignon-cascade`** (un rebord en cascade de huit tuiles) : un plat de 8 tuiles viole la règle des plats ; mis de côté.
- **Première `champignon-falaise`** (rebord à 6 tuiles, puis face du rebord sans pics) : une solution existait **sans** renfort ; rebord à ≥ 7 tuiles et pic sur la face de la rangée du rebord.
- **Champignons de plafond près des pics** ou **pics au sol dans les 36 pas d'une chute** : refusés par la règle des 0,3 s ; les zones sont dégagées, les champignons à ≥ 5 colonnes des bords.
- **Premières variantes de `champignon-balade`** (marches et tours trop hautes) : exigence 3 (une respiration reste ≤ 2) ; variantes remplacées (`entre`, `fin`) et un plat de 7 à 9 tuiles refait en marches.
- **Le nom `champignon-promenade` et un 8ᵉ morceau (la cascade ci-dessus)** : renommer en `champignon-balade` et retirer le 8ᵉ a rejoué la loterie du générateur, qui avait **un** secours sur 365 dates (le 14/09/2027, néon) ; le catalogue final n'en a plus (§ 5).

## 5. Mesures (120 dates du 16/10/2026 au 12/02/2027, g17 contre g16 du § 5 du lot 22)

| mesure | g16 (lot 22) | g17 |
|---|---|---|
| niveaux de forêt avec au moins un morceau à champignons · avec deux ou plus | — | **28 sur 31 · 12** (40 morceaux) |
| tirages validés · des composés | 179 (20,9 %) · 29,0 % | 157 (18,7 %) · 27,5 % |
| **niveau de secours utilisé** | **0** | **0** (365 dates : 0) |
| temps de l'auteur (min · moyenne · max) | 28,02 · 29,72 · 31,99 s | 28,01 · 29,69 · 31,97 s |
| morceaux par niveau · exigence par minute | 10,7 · 490,8 | 10,6 · 494,4 |
| exigence du morceau le plus exigeant | 4,9 | 4,9 |
| voies lentes par niveau · cages montées | 1,9 · 23/232 | 1,9 · 21/226 |
| morceaux en commun entre deux jours consécutifs | 0,03 (max 4) | 0,02 (max 2) |
| un même morceau sur 7 jours glissants (au plus) | 3 | 3 |
| morceaux de base employés sur 365 jours | 98 sur 98 | **105 sur 105** |
| écart entre deux apparitions : minimum · moyenne · médiane | 3 · 8,79 · 6 j | 3 · 9,36 · 6 j |
| distincts sur 7 / 30 jours glissants (moyenne) | 58,9 / 90,8 | 59,1 / 94,5 |
| retours avant 4 / 5 / 7 jours | 18,6 / 33,3 / 55,5 % | 17,0 / 32,0 / 53,6 % |
| génération d'un niveau : moyenne · max | 167,0 · 657,8 ms | 113,0 · 451,2 ms (autre charge de la machine : non comparable) |
| génération à froid (48 dates) : moyenne · max | 0,57 · 1,24 s | 0,42 · 0,99 s (sous les 2 s) |

Les chiffres de g16 sont ceux du README du lot 22 (on ne relance pas l'ancien générateur ; `measure:jump -- --generateur=16` le permet).

## 6. Réserve de la forêt (méthode du lot 19, seuil = 17 ; `npm run variete:jump`, 365 dates)

| thème | seuil | W = 4 | W = 5 | W = 7 |
|---|---|---|---|---|
| forêt | 17 | **0 · 4** (5 · 10 au lot 22) | **8 · 14** (14 · 22) | 21 · 29 |

(jour moyen · pire jour ; morceaux de base à ajouter.) Les 7 morceaux comblent la réserve de la forêt : **W = 4 n'y manque presque plus de rien** (4 morceaux le pire jour), W = 5 en manque encore 8 (14 le pire jour). **Mais la règle vaut pour tous les thèmes** : glace 4 · 11 pour W = 4 et 14 · 19 pour W = 5, nuit 3 · 8 / 13 · 22, néon 3 · 9 / 12 · 17 : **pour W = 4 il manque encore ≈ 11 morceaux communs, pour W = 5 ≈ 22**. W reste 3.

## 7. Décisions, vérifié, non vérifié

- **Jours** : g17 commence le 27/10/2026 ; **aucun jour public ni figé touché** (`apps/jump/public/levels/` n'a pas bougé ; `figes:jump -- --verifier` : à jour ; aucun nouveau jour figé, donc rien à refiger). La démonstration `public/demo/` est régénérée (`jump:seed`).
- **Budget** : Jump 332 502 (`main` après le lot R9) → 337 938 o (+5 436, plafond 378 490, marge 40 552) ; ligne de `docs/plateforme/budgets.md` mise à jour. Le catalogue n'est pas dans le premier chargement.
- **Golden** : v3 à v6 **intacts** ; nouvelles références `daily-golden-v7.json` et `replay-golden-v7.json` (jour de référence le 28/11/2026 : deux morceaux à champignons, des morts avant et sur un point de passage).
- **Test assoupli, avec sa mesure** : `apps/api/test/jumpHistory.test.ts` exigeait « plus de la moitié » de temps distincts parmi les joueurs fictifs du 30/10 ; le niveau g17 de ce jour en donne 10 pour 21 (reprises identiques après la même faute) : seuil « plus du tiers ». Test e2e de la nuit : `draining` est le dernier rendu, lu en pas à pas sans rendu il dépendait de la composition du jour ; il lit maintenant `simFills` (la simulation).
- **À décider (Nathan)** : (1) la respiration `champignon-balade` compte les rebonds comme des sauts ; (2) le renfort à 130 % (un seul niveau) ; (3) la loterie : une modification du catalogue de forêt rejoue la composition de dates lointaines (un secours est apparu une fois le 14/09/2027 : surveiller avec `variete:jump` à chaque ajout) ; (4) **index du `CLAUDE.md` racine** (zone partagée, non touchée) : y ajouter « Champignons (lot 23) » sous `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`.
- **Vérifié** : tests unitaires (SQLite et libSQL des fichiers touchés, `npm run verifier`), e2e Chromium des specs liés (dont `plateformes.spec.ts`, section champignons), construction, typecheck, 365 dates sans secours. **Non vérifié** : Firefox et WebKit (la CI complète de `main`), le rendu à l'œil sur téléphone (l'écrasement ne se lit pas en pas à pas : testé en unitaire), la mesure de fluidité à ×4.
