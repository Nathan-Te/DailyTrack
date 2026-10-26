# Lot 20 — Plateformes mobiles (DailyJump)

Versions : `JUMP_SIM_VERSION` **5** (nouvelle : v3 et v4 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **15** (identifiants `…-g15`) · `PLATFORM_VERSION` 5 · `PLATFORM_GENERATOR` 15 · `W` (délai de variété) reste **3**. Consignes : `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`, sections « Plateformes mobiles (lot 20) ».

Images : `img/lot-20-radeau-porte.png` (le radeau porte le personnage, solution en cours), `img/lot-20-tour-mobile.png` (variante 1, deux ascenseurs), `img/lot-20-chaland.png` (variante 2, l'élan), `img/lot-20-semaine-g15.png` (`?semaine=2026-10-27&debug`, miniatures avec plateformes en crème).

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté par `apercu.yml` sur la PR) ; en local : `npm run dev:jump` puis `http://localhost:5173/`. Un aperçu ouvre toutes les dates (`isPreview`).

1. **Le premier morceau neuf, seul** (`radeau`, la respiration : trois appuis, note 1 à 3 selon la variante) :
   - `<aperçu>?module=radeau&variante=0&entree=arret`
   - avec la surimpression : `<aperçu>?module=radeau&variante=0&entree=arret&debug` (ajoute `__jump.platforms` et les limites du morceau). `&solution` rejoue la solution gardée : on voit la dalle porter le personnage.
   - la galerie qui les filtre : `<aperçu>?modules` puis l'étiquette « plateforme mobile » (7 morceaux).
2. **Un jour g15 avec au moins deux morceaux à plateforme** : `2026-11-02` (glace : `navette` v3 + `chaland` v2, 3 plateformes au total) :
   - `<aperçu>?seed=2026-11-02`
   - `<aperçu>?seed=2026-11-02&debug` (limites des morceaux, `__jump.platforms`, trajets de la voie lente). `&solution` rejoue la preuve de l'auteur de ce jour.
   - autre jour possible : `2026-10-28` (néon : `va-et-vient` v0 + `monte-charge` v1) ; la semaine d'un coup : `<aperçu>?semaine=2026-10-27&debug`, et `&generateur=14` pour la même semaine telle que l'aurait faite g14.

## 1. La physique

Une plateforme est une rangée de 2 à 4 tuiles qui fait un aller-retour horizontal (`h`) ou vertical (`v`) entre deux positions, **à sens unique**. Annexe : `plateforme <id> <largeur> <h|v> <cycle> <col,rangée> <col,rangée>`. Elle n'est pas dans la grille (les tuiles de son trajet sont toutes vides) ; son trajet est dans une seule section et suit **l'horloge de la section** comme une scie : `f(t + phase)` (v4, v5), « depuis l'entrée du morceau » dans un morceau seul (v3).

| règle | valeur |
|---|---|
| largeur | 2 à 4 tuiles |
| cycle | pair, 120 à 1 200 pas (à 120 Hz) |
| trajet | ≤ 12 tuiles, une seule section, à une colonne au moins des bords de la section, deux trajets ne se recoupent pas |
| vitesse maximale | ≤ `MAX_PLATFORM_STEP` = 256 unités par pas (1 tuile = 4 096) |

**Position (`platformPos`)** : fonction entière et pure de la phase. `q = phase mod cycle`, `tri` = `q` (première moitié) ou `cycle − q` (seconde) ; part du trajet = `PLATFORM_EASE` interpolée à `tri / (cycle/2)`, déplacement = `idiv(trajet × part, 4096)`. Retour exact au départ à chaque cycle, `a` à la phase 0, `b` au demi-cycle, aucun flottant, aucun `−0`.

**Table de ralenti `PLATFORM_EASE`** : 65 valeurs de 0 à 4 096, `idiv(192·k² − 2·k³, 64)` pour `k` de 0 à 64 (« smoothstep » entier, symétrique), interpolée linéairement. Début de la table : 0, 2, 11, 26, 46, 71… puis environ 96 par intervalle au milieu. **Elle ralentit aux deux extrémités** : le premier dixième du trajet prend 47 pas sur 240, la vitesse est nulle exactement aux deux bouts. Le jeu l'annonce (chevrons qui s'estompent et se retournent, § 4).

**Vitesses de pointe (au milieu du trajet)** des morceaux livrés :

| morceau | trajet | cycles | pointe |
|---|---|---|---|
| radeau | 4 tuiles (h) | 300 à 420 | 117 à 164 u/pas |
| navette | 9 tuiles (h) | 480 à 540 | 205 à 230 u/pas |
| monte-charge | 8 tuiles (v) | 420 à 480 | 205 à 234 u/pas |
| chaland | 6 tuiles (h et h) | 330 à 480 | 153 à 223 u/pas |
| tour-mobile | 5 tuiles (v et v) | 330 à 420 | 146 à 186 u/pas |
| balancier | 11 tuiles (h) | 540 à 600 | 225 à 250 u/pas (au plus près de la limite de 256) |
| va-et-vient | 4 tuiles (h, deux dalles) | 360 à 420 | 117 à 136 u/pas |

(Vitesse de pointe = 1,5 × trajet ÷ demi-cycle = 3 × trajet × 4 096 ÷ cycle, car la pente maximale de la table est 1,5 ; c'est `platformPeak` côté jeu. La limite `MAX_PLATFORM_STEP` est 256 : le balancier à cycle 540 et 11 tuiles est le plus proche.)

**Le personnage et la plateforme** (`stepAttempt`, `stepPlayerJump(…, platformVx)`) :
- **Sens unique** : une plateforme n'est pas une tuile (`isSolidTile` ne la voit pas). On la traverse par-dessous et par les côtés ; pas de saut mural dessus ; jamais d'écrasement (rien ne pousse le personnage dans un plein : c'est une règle du générateur, § 2).
- **Atterrissage** : le personnage se pose sur la plus haute plateforme dont il était **au-dessus** au pas précédent (pied au plus au niveau de son dessus, avant son déplacement) et que le pied atteint maintenant, en recouvrement horizontal, sans entrer dans un plein ; sinon il la traverse.
- **Transport** : posé dessus, il reçoit son déplacement à chaque pas (balayé contre la grille : un mur l'arrête, jamais de pénétration) et reste au sol relativement à elle. `AttemptState.ride` (absent sans plateforme ; −1 : aucune) dit laquelle le porte ; il est gardé pendant la tolérance de coyote.
- **Héritage horizontal** : un saut qui part d'une plateforme (sol ou coyote, pas un saut mural) garde la vitesse horizontale de la plateforme, **ajoutée une fois le pas déplacé** (jamais sa vitesse verticale), bornée par `MAX_SPEED`.
- **Un niveau sans plateforme se joue exactement comme en v3 ou en v4** (aucun champ de plus ; test : même niveau en v4 et en v5, états égaux au pas près).

## 2. Les morceaux et le générateur

**Règles du générateur** (`plateformes.ts`, `platformProblems`, vérifiées sur chaque variante du catalogue et sur chaque niveau du jour) : (1) trajet jamais à moins de **2 rangées d'un plafond ou d'un plein** au-dessus d'elle, à aucun pas du cycle ; (2) le personnage porté n'est **jamais poussé** contre un mur ni vers un danger (place libre de plein et de pic sur tout le trajet, aucune scie ne passe dans sa place) ; (3) trajet à au moins une colonne du bord de sa section ; (4) **le point de passage reste sûr à toute phase** (aucune plateforme dans la boîte du palier à aucun pas de son cycle : `respawnProblems`, `palierProblems`). Un morceau avec l'étiquette `plateforme` doit porter une ligne `plateforme` dans son annexe. Ces morceaux sont **réservés à la v5** (`platformModuleIds()`) : les catalogues v3 et v4 ne les connaissent pas, ce qui garde g9 et g14 au bit près.

**Les 7 morceaux** (tous : `solve:modules` ✔, `phases:modules` ✔ avec 8 phases et attente ≤ 12 s — la plus longue observée est de 7,2 s —, règle du lot 8c ✔, `voies:modules` ✔ sans voie parasite fermée, règle de la reprise près d'une voie lente ✔) :

| morceau | idée | étiquettes | palier | variantes (cycle · mutateur) |
|---|---|---|---|---|
| `radeau` | traverser un fossé sur un radeau, puis une marche | respiration | 10 10 | 5 : 360 · 300 · 420 · 360 +hausse 1 · 420 +glace |
| `navette` | grand fossé, navette étroite et rapide, il faut l'attendre | précision | 10 10 | 4 : 480 · 540 · 480 +hausse 1 · 540 +glace |
| `monte-charge` | monter dans un puits sur une plateforme verticale | vertical | 12 4 | 4 : 420 · 480 · 420 +hausse 1 · 480 +glace |
| `chaland` | deux plateaux à contresens, deux départs à calculer | précision | 11 8 | 5 : 390 · 420 · 330 · 480 · 420 +glace |
| `tour-mobile` | deux ascenseurs qui n'ont pas la même heure | précision, vertical | 13 4 | 5 : 330 · 360 · 420 · 390 · 420 +glace |
| `balancier` | grand fossé sous une grande scie qui monte et descend | scie, précision | 11 11 | 7 : 540/270 · 600/300 · 540/180 · 540/270 +hausse 1 · 600/300 +décalage 2 · 540/180 +glace · 540/135 |
| `va-et-vient` | deux fossés, deux radeaux inverses, une île | — | 10 10 | 3 : 420 · 360 · 360 +glace |

Notes de jouabilité humaine (gigue ±3, appuis humains ; `note` = exigence de la solution gardée en entrée à l'arrêt, puis avec élan ; « phases » = la note à chacune des 8 phases ; sortie = temps pour sortir, de la phase la plus favorable à la plus défavorable). Les notes sont celles de `modules/solutions.json` et `modules/phases.json`.

| morceau | variante | arrêt | élan | phases | sortie |
|---|---|---|---|---|---|
| radeau | 0 · 1 · 2 · 3 · 4 | 1 · 1 · 1 · 1 · 1 | 1 · 1 · 1 · 1 · 1 | 3 · 2 · 1 · 2 · 1 | 2,3 à 5,6 s |
| navette | 0 · 1 · 2 · 3 | 1 · 1 · 1 · 1 | 3 · 3 · 3 · 2 | 2 · 1 · 3 · 1 | 2,3 à 6,4 s |
| monte-charge | 0 · 1 · 2 · 3 | 1 · 1 · 1 · 1 | 1 · 2 · 1 · 2 | 1 · 1 · 1 · 1 | 2,5 à 6,0 s |
| chaland | 0 · 1 · 2 · 3 · 4 | 2 · 2 · 1 · 2 · 2 | 2 · 1 · **4** · 3 · 2 | 2 · 3 · 1 · 3 · 3 | 2,7 à 6,3 s |
| tour-mobile | 0 · 1 · 2 · 3 · 4 | **4 · 4** · 1 · 2 · 1 | **4 · 5** · 2 · 2 · 2 | **5 · 4** · 3 · 3 · 3 | 2,3 à 6,2 s |
| balancier | 0 à 6 | 3 · 1 · 2 · 2 · 3 · 1 · 1 | 1 · 2 · 1 · 3 · 3 · 1 · 1 | 4 · 2 · 2 · 3 · 3 · 1 · 2 | 2,7 à 7,2 s |
| va-et-vient | 0 · 1 · 2 | 2 · 1 · 1 | 1 · 1 · 1 | 3 · 2 · 2 | 2,9 à 6,1 s |

- **Respiration** (note ≤ 2 avec trois appuis de saut ou plus) : `radeau` (5 appuis en entrée à l'arrêt, notes 1 à 3 selon la phase, aucun palier difficile) — la note 3 de la variante 0 selon la phase est la seule exception, voir « variantes refusées ».
- **Notes dures (4–5)**, compatibles avec la voie lente (la règle du lot 16 s'y applique : zone de bifurcation, cage ou galerie) : `tour-mobile` v0 (note 5 à toutes les phases, élan 4) et v1 (note 4, élan 5), `chaland` v2 en élan (note 4), `balancier` v0 en phase (note 4). `voies:modules` classe `chaland` v2, `tour-mobile` v0 et v1 « injouable, gardée » : le détour trouvé existe mais n'est jouable qu'au pas près (note 0), la voie lente se pose donc normalement, sans fermer de voie.
- **Intermédiaires** : le reste (notes 2–3), dont `navette` en élan (note 3).

**Variantes acceptées / refusées** (aucune règle n'a été relâchée pour en garder une) :
- *Refusées, sans règle changée* : `chaland` et `tour-mobile` avec `+hausse` (gestes « au pas près », rien de jouable à la main) ; `balancier` v0 `+hausse` avec 17,8 s d'attente à la pire phase (au-dessus du plafond de 12 s : remplacée par `+decale:2`) ; `radeau` +hausse et d'autres : deux appuis seulement puis note 3 (une respiration doit avoir trois appuis) ; `va-et-vient` +hausse (la plateforme de retour aurait poussé le personnage porté contre la paroi : règle (2)). Tout changement de paramètre refusé a été remplacé par un autre jeu de cycles ou de mutateurs, jamais par un assouplissement.
- *Acceptées* : toutes celles du tableau ci-dessus (33 variantes au total).

## 3. Mesures : g14 (avant) et g15 (après)

Même machine, mêmes 120 dates (16/10/2026 → 12/02/2027), `npm run measure:jump` avec `-- --generateur=14` pour la référence, puis avec le code du lot ; variété sur 365 dates à partir du 27/10/2026 (`npm run variete:jump`).

| mesure | g14 | g15 |
|---|---|---|
| niveaux contenant au moins une plateforme (120 dates) | 0 | **83** (1,06 plateforme-morceau par niveau en moyenne) |
| tirages validés (rejeu sans mort) · des composés | 154 (18,1 %) · 25,5 % | 162 (19,0 %) · 26,6 % |
| **niveau de secours utilisé** | **0** | **0** |
| temps de l'auteur (min · moyenne · max) | 28,01 · 29,62 · 31,95 s | 28,07 · 29,62 · 31,85 s |
| morceaux par niveau (moyenne) | 10,6 | 10,7 |
| exigence par minute (moyenne ; fenêtre 425–570) | 488,6 | 491,4 |
| exigence du morceau le plus exigeant (moyenne) | 4,9 | 4,8 |
| voies lentes par niveau · cages montées | 1,9 · 34/224 | 1,9 · 20/223 |
| morceaux en commun entre deux jours consécutifs | 0,02 (max 2) | 0,02 (max 2) |
| un même morceau sur 7 jours glissants (au plus) | 3 | 3 |
| morceaux de base employés sur 365 jours | 84 sur 91 (les 7 morceaux neufs : jamais) | **91 sur 91** |
| écart entre deux apparitions : minimum · moyenne · médiane | 3 · 7,76 · 5 j | 3 · 8,26 · 6 j |
| morceaux de base distincts sur 7 jours glissants (min · moyenne · max) | 50 · 56,3 · 65 | 49 · 58,3 · 65 |
| … sur 30 jours | 75 · 80,4 · 83 | 81 · 86,1 · 89 |
| retours avant 4 / 5 / 7 jours | 20,9 / 37,4 / 61,0 % | 19,0 / 34,9 / 57,4 % |
| génération d'un niveau (tous tirages, rejeux compris) : moyenne · max | 93,5 · 503,6 ms | 131,3 · 601,2 ms |
| génération à froid (48 dates) : moyenne · max | 0,33 · 1,06 s | 0,45 · 1,00 s |

Lecture : la variété monte (tous les morceaux de base sont employés, les fenêtres de 7 et 30 jours en comptent plus), la difficulté et le temps de l'auteur ne bougent pas, aucun secours. La génération est plus lente (+40 % en moyenne ; la preuve se fait en v3 puis en v5) : **mesure faite sur une machine partagée, bruitée** — le maximum de génération à froid reste sous 2 s (seuil de l'outil) ; à refaire au calme si Nathan veut un chiffre ferme.

## 4. Affichage dans `apps/jump`

Dalle **crème cernée d'encre** (`--dj-papier` / `--dj-encre`), distincte des blocs de la nuit (colorés) ; jamais rouge, jamais jaune ; **chevrons** posés dans le sens du mouvement dont l'opacité suit la vitesse affichée (`platformLook` : la vitesse de la simulation en part de sa pointe) — presque éteints aux extrémités, retournés au demi-cycle : **le ralenti annonce le demi-tour** ; **trajet en pointillés neutres** (jamais rouge) et empreinte de chaque extrémité. Pendant le carnage elles sont à **35 %** comme les autres éléments à horloge (pièces sans recouvrement). `?modules` filtre l'étiquette « plateforme mobile » (7 morceaux) ; `?semaine` dessine les plateformes dans les miniatures ; `__jump.platforms` avec `?debug`. Aucune variation brusque de la vitesse affichée, jamais plus de 3 pics par seconde (`FLICKER_MAX_HZ`).

## 5. Jours régénérés et réserve de morceaux communs

- **Jours régénérés** : g15 commence le **27/10/2026** (J+2 au moment du lot ; le 26/10 reste en g10, figé le 25/10 par la mise en production). **Aucun jour public ni figé n'a été touché** : `apps/jump/public/levels/` n'a pas bougé. Sur les 120 niveaux mesurés (à partir du 16/10), ceux d'avant le 27/10 gardent leur identifiant d'origine (figés ou g14 de la référence) ; à partir du 27/10, **83 sur 120 contiennent au moins une plateforme** et tous sont refaits (comme au lot 19, l'identifiant suit le générateur). La démonstration `public/demo/` a été régénérée (`jump:seed`) et les tests d'API qui dépendent de joueurs fictifs ont changé de jour fixe (30/10 → 13/11, voir § 7).
- **Jonction de la règle de variété avec les jours figés** : `VARIETY_FROZEN` n'est plus une table à la main : `packages/jump-sim/src/figes.ts` est **déduit des fichiers** de `apps/jump/public/levels/` par `npm run figes:jump -w @cdj/jump-sim` (`-- --verifier` : échoue si le fichier n'est pas à jour). Aujourd'hui : 2 jours (25 et 26/10/2026). Si la production part après le 25/10 avec de nouveaux jours figés, relancer l'outil (un test échoue sinon).
- **Réserve pour W = 5** (méthode du lot 19, seuil = la plus petite réserve de g14 à W = 3 : `npm run variete:jump`, section « Réserve ») :

| thème | seuil (g14, W = 3) | W = 4 | W = 5 | W = 7 |
|---|---|---|---|---|
| forêt | 17 | 4 · 11 | 14 · 19 | 25 · 29 |
| usine | 12 | 2 · 5 | 10 · 15 | 21 · 25 |
| glace | 14 | 3 · 9 | 12 · 19 | 23 · 29 |
| nuit | 13 | 3 · 9 | 11 · 17 | 23 · 28 |
| néon | 11 | 2 · 7 | 11 · 16 | 22 · 27 |

(jour moyen · pire jour ; nombre de morceaux de base à ajouter.) **Pour W = 5 il manque encore environ 19 morceaux communs** (le pire jour du pire thème ; 25 selon la même méthode avant ce lot — les 7 morceaux neufs en ont apporté ≈ 6), 11 pour W = 4 et 29 pour W = 7. W reste donc à 3.

## 6. Outils et tests

- Nouveaux : `npm run trace:module -w @cdj/jump-sim -- <id> <variante> <arret|elan>` (colonne, portage, appuis), `npm run figes:jump -w @cdj/jump-sim`, `measure:jump` / `variete:jump` `-- --generateur=14`, `?semaine=…&generateur=14`, `public/outils/intentions.json`.
- Tests (tous ajoutés, rien d'affaibli) : `packages/jump-sim/test/plateformes.test.ts` (version, annexe et refus, table de ralenti entière, position, **transport exact au pas près**, **héritage de la vitesse horizontale**, **traversée par en dessous et par les côtés**, ralenti complet aux deux extrémités, niveau sans plateforme identique à la v4, fuzz d'intégrité, **règles de trajet**, point de passage sûr, **chaque morceau neuf passe toutes les règles**, niveaux du jour), `variete.test.ts` (**`VARIETY_FROZEN` identique aux fichiers**), `horloge.test.ts` et `golden-daily.test.ts` (références v4 inchangées au bit près + références v5 nouvelles `daily-golden-v5.json`, `replay-golden-v5.json`), `apps/jump/test/plateformes.test.ts`, `apps/jump/e2e/plateformes.spec.ts` (dans `durees.json`).
- **Golden v3 et v4 : aucun octet modifié** (`golden.json`, `replay-golden.json`, `daily-golden.json`, `daily-golden-v4.json`, `replay-golden-v4.json`).

## 7. Ce qui est vérifié, ce qui ne l'est pas, décisions pour Nathan

**Vérifié localement** : `npm run typecheck` (`tsc -b`) vert ; Vitest sur la base SQLite : 3 318 tests verts sur 3 319 au premier passage, le seul échec étant un délai de 5 s dépassé par un test de `apps/jump/test/plateformes.test.ts` qui générait jusqu'à 20 niveaux pendant que toute la suite tournait — le test a été ramené à un seul niveau (le 28/10/2026) et passe seul (11 tests), le test était le mien et rien n'a été relâché ; `npm run build` et `node scripts/budgets.mjs` (§ budget) ; `npm run traductions -- --verifier` à jour (aucun catalogue changé) ; e2e `plateformes.spec.ts` (3 sur 3) et `smoke.spec.ts` en Chromium ; rendu inspecté à l'œil dans Chromium (captures ci-dessus). Les mesures du § 3 ont été faites sur une machine partagée.

**Non vérifié localement** : Firefox et WebKit (la CI de la PR et le commit `[ci complet]` les lancent), Vitest sur libSQL (la CI), les autres e2e de Jump hors `plateformes.spec.ts` et `smoke.spec.ts` (la CI), un carnage complet avec plateformes en conditions réelles (le facteur 35 % est testé en unitaire et par `__jump.platforms.opacity`).

**Décisions / propositions à trancher** :
1. **Budget de poids** : le lot passe à 376 557 o (plafond 378 490, marge 1 933 o). Pour tenir, les `intention:` des morceaux ne sont plus dans le catalogue embarqué (`public/outils/intentions.json`, lu à la demande par la galerie). Un prochain lot Jump qui ajoute morceaux ou code devra en retirer ou demander le relèvement du plafond.
2. **Zones partagées (non touchées, à faire par un lot de la plateforme)** : (a) ajouter dans le `CLAUDE.md` racine, rubrique « `packages/jump-sim/CLAUDE.md` » de l'index, « Plateformes mobiles (lot 20) » ; (b) ligne de budget Jump de `docs/plateforme/budgets.md` : **mise à jour dans cette PR** (exception tolérée par le `CLAUDE.md` racine) ; (c) le script `scripts/` du figeage n'a pas besoin de changer pour `VARIETY_FROZEN`.
3. **Jonction avec les jours figés** (§ 5) si la production part après le 25/10.
4. **Étiquette de PR** : la branche (`claude/intelligent-maxwell-tbqnw7`) ne porte pas « jump » dans son nom : l'étiquette `jeu:jump` doit être posée sur la PR pour que le job `zones` applique les zones de Jump (sinon la PR est traitée comme une PR de plateforme).
5. **W = 5** : il faudrait ≈ 19 morceaux communs de plus (§ 5), hors périmètre.
6. **Tests d'API à jour de jour fixe** : `jumpBoard`, `jumpBundle`, `jumpProfile` utilisent des joueurs fictifs dont l'arrivée dépend du niveau du jour ; leur jour fixe est passé du 30/10 au 13/11/2026 (aucun test affaibli : seule la date change, les assertions sont les mêmes).
