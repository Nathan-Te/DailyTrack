# Lot 24 — Stalactites (DailyJump, thème glace)

Versions : `JUMP_SIM_VERSION` **8** (nouvelle : v3 à v7 se jouent toujours, chaque niveau porte sa version) · `JUMP_GENERATOR_VERSION` **18** (identifiants `…-g18`, `STALACTITE_GENERATOR`) · `W` = 3 (inchangé, seulement mesuré). Branche `ccr-2228a105-cd7uao`, PR brouillon `jeu:jump`.

## Scénario en 2 clics

`<aperçu>` = l'adresse de l'aperçu de la PR (`https://…--pr-<n>-<empreinte>.web.app/jump/`, lien commenté sur la PR) ; en local : `npm run dev:jump`. (`&solution` et `?semaine` ne fonctionnent que hors production : aperçu, recette, local.)

1. **Le morceau où l'on déclenche exprès** (`stalactite-decroche` : un puits de pics sous une stalactite basse, le saut la frôlerait ; on entre dans la zone, on recule, on la laisse tomber au fond du puits, on prend son élan) :
   - `<aperçu>?module=stalactite-decroche&variante=0&entree=arret` : à jouer ; `&solution` rejoue la solution enregistrée (déclenche, recule, attend, saute) ; `&debug` montre `__jump.stalactites` (âge, zone, gouttes) ;
   - la galerie : `<aperçu>?modules` (étiquette « stalactite », six morceaux).
2. **Un jour de glace g18 avec trois morceaux à stalactites** : `2026-12-08` (`stalactite-allee`, `stalactite-decroche`, `stalactite-sentier`) :
   - **sans `&debug`** : `<aperçu>?seed=2026-12-08` ; **avec** : `<aperçu>?seed=2026-12-08&debug` (limites des morceaux, `__jump.stalactites`, trajets des voies lentes) ; `&solution` rejoue la preuve de l'auteur ;
   - autres jours à deux morceaux ou plus : `2026-12-13` (`stalactite-glace-rangee` + `stalactite-glace-ilots`, 28 morts par stalactite parmi les 35 + 42 reprises des essais fictifs), `2026-11-22` (trois) ; la semaine d'un coup : `<aperçu>?semaine=2026-12-07&debug`. Captures : `img/lot-24-tremblement.png` (âge 40 : le pic tremble et laisse tomber ses gouttes, pointe rouge), `img/lot-24-rangee.png`.

## 1. La simulation (v8, `attempt.ts`, constantes de `level.ts`)

| point | valeur retenue |
|---|---|
| déclenchement | à la fin du pas où le **centre** du personnage est dans la zone (`col − avant` à `col + après`, 1 à 8 colonnes de chaque côté), à hauteur du corps ou plus bas ; âge 1 au pas du déclenchement |
| **tremblement** | **60 pas (0,5 s)**, `STALACTITE_SHAKE_TICKS` : le corps ne bouge pas, mais **tue déjà** |
| **chute** | table entière `STALACTITE_DROP` : vitesse du pas *i* = `min(24 × i, 1 024)` unités (30 tuiles/s au plus), puis 1 024 par pas ; position = fonction pure de l'âge |
| casse | au premier pas où le corps (2 tuiles, retrait de 1 024 de chaque côté) chevauche un plein (glace, friable… compris) ou sort de la grille : état −1, disparue |
| mort | `DEATH_STALACTITE` (5) au contact tant qu'elle tremble ou tombe ; intacte ou brisée, elle ne tue pas ; l'arrivée l'emporte |
| reprise | `initialAttempt` la remet intacte (départ comme point de passage), comme les friables ; **hors horloge** ; elle continue de tomber pendant l'attente de la reprise (affichage) |

`AttemptState.stalactites` n'existe que dans un niveau qui en a : **un niveau sans stalactite est identique en v7 et en v8** au pas près (test sur 1 500 pas), golden v3 à v7 et rediffusions intacts. Aucune clé de plus dans `lifeStartProblem`, le solveur connaît l'état (clé, seconde passe qui réserve l'attente au sol).

## 2. Règles du générateur (`stalactites.ts`, `stalactitesPieces.ts`)

- Zone à une colonne au moins des bords de sa section et **jamais sur le palier d'un départ, d'une arrivée ou d'un point de passage** (aucun point dans une zone ni sous une chute) ; sous le corps une tuile vide et un plein à moins de 12 rangées.
- **La course franche** : au sol au bord gauche de la zone, lancé à la vitesse de course, droite tenue, 300 pas dans la vraie simulation (quatre positions d'entrée) : tué par une stalactite **encore au sol** = variante refusée. Une zone de 8 colonnes devant un sol proche ou un plafond bas sont refusés (tests). Une mort après avoir quitté le sol (puits, saut) n'est pas jugée ici.
- Toutes les règles existantes : solveur, attente ≤ 12 s (sans horloge : une phase), règle du lot 8c, `voies:modules` (0 variante fermée), plats (la zone et la colonne de chute sont un défi), repos W = 3, reprise près d'une voie lente.

## 3. Les 6 morceaux (28 variantes ; `theme: glace`, réservés à la v8)

Exigence (la plus haute des deux entrées) de chaque variante, dans l'ordre (`solutions.json`).

| morceau | idée | étiquettes | exigences |
|---|---|---|---|
| `stalactite-allee` | trois stalactites au plafond d'une allée, trois bornes à sauter : on ne s'arrête pas (**respiration**) | respiration | 1 1 1 2 |
| `stalactite-sentier` | des îlots de sol entre des nappes de pics, sous des stalactites basses : un grand saut frapperait leur pointe qui tremble | précision | 3 **4 4 5 4 5** |
| `stalactite-decroche` | **déclencher exprès**, reculer, laisser tomber, passer : puits de pics, pics sur le mur d'arrivée | précision | 2 **4** 3 **5** |
| `stalactite-ilots` | des îlots suspendus sur des pics, une stalactite sur chacun : l'île ne sert jamais de halte | précision | 1 2 1 2 1 |
| `stalactite-glace-rangee` | **glace** : glisser sans pouvoir s'arrêter sous une rangée de trois stalactites, deux bornes, deux nappes de pics | glace, précision | **4 4** 2 **4 4** |
| `stalactite-glace-ilots` | **glace** : des îlots de glace sur des pics, sauter avant leur bord, la stalactite tombe derrière soi | glace, précision | 1 2 2 2 |

- **1 respiration** : `stalactite-allee` (1–2 aux deux entrées, trois sauts à chaque entrée : testé). **Portions dures (note 4 ou 5), compatibles avec la voie lente** : `stalactite-sentier` (5 variantes), `stalactite-decroche` (2), `stalactite-glace-rangee` (4). **2 morceaux glace + stalactites** : `-glace-rangee`, `-glace-ilots`. **1 morceau « exprès »** : `-decroche`, **testé** : sa solution ne passe là où la stalactite pendait qu'une fois tombée.
- Aucun mutateur : les variantes viennent des plages répétées (largeur des puits, des nappes, des îlots) ; les mutateurs de silhouette déplaceraient le plafond qui porte les stalactites.

## 4. Variantes et idées refusées (une ligne chacune)

- **`stalactite-decroche`, zone de 8 colonnes** : la stalactite était tombée quand le saut passait, aucune attente n'était nécessaire ; zone ramenée à 4 colonnes (le saut tombe sous le tremblement).
- **Puits à bord nu** : le solveur le franchissait par un saut court sous le corps, puis un saut mural ; pics sur le mur d'arrivée (`<`).
- **Puits de 6 tuiles** (`p=2`) : franchissable sous la stalactite ; remplacé par 7 et 8. **Variantes « au pas près »** (`p=4 d=1` et `p=4 a=0` à l'élan) : remplacées par `p=3 d=0` et `p=3 a=2`.
- **Approche plate de 10 tuiles** devant le puits (règle des plats) : raccourcie à 6, la zone compte comme défi.
- **`stalactite-glace-rangee` sans bornes** : une course de 2 à 3 s sans saut, refusée par la règle de la plus longue course (0 emploi sur 120 dates) ; deux bornes ajoutées (18 tirages valides au lieu de 8).
- **Corps qui pend jusqu'au sol** (couloir barré) : tue le coureur franc, refusé par la règle de la course franche ; un plafond trop bas, un corps trop long : idem.

## 5. Mesures (120 dates du 16/10/2026 au 12/02/2027, g18 contre g17 du § 5 du lot 23)

| mesure | g17 (lot 23) | g18 |
|---|---|---|
| niveaux de glace avec au moins un morceau à stalactites · avec deux ou plus | — | **18 sur 23 · 7** (28 morceaux, 70 stalactites) |
| tirages validés · des composés | 157 (18,7 %) · 27,5 % | 162 (19,1 %) · 29,4 % |
| **niveau de secours utilisé** | **0** | **0** (365 dates : 0) |
| temps de l'auteur (min · moyenne · max) | 28,01 · 29,69 · 31,97 s | 28,01 · 29,62 · 31,82 s |
| morceaux par niveau · exigence par minute | 10,6 · 494,4 | 10,6 · 502,1 |
| exigence du morceau le plus exigeant | 4,9 | 4,9 |
| voies lentes par niveau · cages montées | 1,9 · 21/226 | 2,0 · 26/238 |
| morceaux en commun entre deux jours consécutifs | 0,02 (max 2) | 0,01 (max 1) |
| un même morceau sur 7 jours glissants (au plus) | 3 | 3 |
| morceaux de base employés sur 365 jours | 105 sur 105 | **111 sur 111** |
| écart entre deux apparitions : minimum · moyenne · médiane | 3 · 9,36 · 6 j | 3 · 9,97 · 6 j |
| distincts sur 7 / 30 jours glissants (moyenne) | 59,1 / 94,5 | 59,2 / 98,0 |
| retours avant 4 / 5 / 7 jours | 17,0 / 32,0 / 53,6 % | 16,8 / 31,1 / 51,4 % |
| génération d'un niveau : moyenne · max | 113,0 · 451,2 ms | 220,3 · 1 017,5 ms (g17 remesurée sur cette machine : 172,7 · 641,0 ms) |
| génération à froid (48 dates) : moyenne · max | 0,42 · 0,99 s | 0,70 · 1,95 s (g17 remesurée : 0,60 · 1,63 s) — **sous 2 s, marge mince** |

Le coût d'un pas de simulation n'a pas bougé de façon mesurable (3 400 à 3 900 ns pour g17, 4 000 à 4 400 pour g18 : le bruit de la machine couvre l'écart). Les chiffres de g17 sont ceux du README du lot 23, sauf mention.

## 6. Réserve de tous les thèmes (méthode du lot 19, seuil de g14 ; `npm run variete:jump`, 365 dates)

| thème | seuil | W = 4 | W = 5 | W = 7 |
|---|---|---|---|---|
| forêt | 17 | 0 · 3 | 8 · 15 | 22 · 29 |
| usine | 12 | 0 · 1 | 5 · 13 | 19 · 24 |
| **glace** | 14 | **0 · 5** (4 · 11 au lot 23) | **8 · 16** (14 · 19) | 22 · 30 |
| nuit | 13 | 3 · 10 (3 · 8) | 13 · 21 (13 · 22) | 27 · 34 |
| néon | 11 | 2 · 9 (3 · 9) | 12 · 20 (12 · 17) | 26 · 33 |

(jour moyen · pire jour ; morceaux de base à ajouter ; les autres thèmes bougent de ±2 sans avoir été touchés : c'est la composition des jours voisins.) Les 6 morceaux comblent la glace pour W = 4 le jour moyen et réduisent de moitié son manque le pire jour. **Pour W = 4, l'estimation par la réserve dit encore ≈ 10 morceaux (nuit 3 · 10, néon 2 · 9), pour W = 5 ≈ 21 ; la mesure directe dit autre chose :** en posant `VARIETY_DAYS` à 4 le temps de la mesure (puis rétabli, ainsi que `src/figes.ts` régénéré sur 3 jours), **W = 4 tient avec 0 secours sur 365 dates** (aucun retour avant 4 jours, écart minimal 4, génération à froid 0,78 · 1,87 s) — **W = 4 devient tenable** ; W = 5 non : 17 secours sur 120 dates. Le passer à 4 est un lot (règle, `figes.ts`, golden, `JUMP_GENERATOR_VERSION`), pas ce lot.

## 7. Décisions, vérifié, non vérifié

- **Jours** : g18 commence le 27/10/2026 ; **aucun jour public ni figé touché** (`apps/jump/public/levels/` jusqu'au 26/10, `figes:jump -- --verifier` à jour). La démonstration `public/demo/` est régénérée (`jump:seed`).
- **Budget** : Jump 337 942 (`main`) → 342 836 o (+4 894, plafond 378 490, marge 35 654) ; ligne de `docs/plateforme/budgets.md` mise à jour. Le catalogue n'est pas dans le premier chargement.
- **Golden** : v3 à v7 **intacts** ; nouvelles références `daily-golden-v8.json` et `replay-golden-v8.json` (jour de référence le 08/12/2026 : trois morceaux à stalactites, 21 reprises au départ, 48 sur un point, 7 morts par stalactite).
- **Hors de la zone Jump, rien** : seul `apps/api/src/jumpLives.ts` (zone `jump*.ts`) compte la cause 5 dans la carte des morts. Pas de nouveau spec e2e : pas de changement de `e2e/zones.json`.
- **Tests assouplis ou corrigés, avec leur raison** : délais explicites de `jour.test.ts` et de `jumpLives.test.ts` (rouges sous la charge de la CI, verts seuls) ; `carnage-lisible.spec.ts` (nuit) choisit un jour dont les clignotants sont près de l'arrivée : le carnage s'ouvre sur la fin du niveau, un bloc hors de la vue n'est pas dessiné (`blinkFace` −1) et le premier jour de nuit de g18 n'en avait que dans son milieu — une fragilité de composition qui existait déjà.
- **À décider (Nathan)** : (1) le tremblement de 0,5 s et la chute (accélération 24, plafond 1 024) sont ceux du point de départ, gardés ; (2) la règle de la course franche ne juge que la course **au sol** : un saut dans la zone n'est pas couvert — dans `-sentier` et `-decroche` le corps pend à 3 tuiles du sol et un grand saut le touche (voulu : c'est ce qui oblige à sauter court ou à attendre), ailleurs à 4 ou 5 tuiles ; (3) **passer W à 4** (§ 6) ; (4) la génération à froid approche les 2 s (1,95 s) : à surveiller avant le prochain lot de contenu ; (5) **index du `CLAUDE.md` racine** (zone partagée, non touchée) : y ajouter « Stalactites (lot 24) » sous `packages/jump-sim/CLAUDE.md` et `apps/jump/CLAUDE.md`.
- **Vérifié** : tests unitaires (jump-sim, apps/jump, apps/api sur SQLite), e2e Chromium des specs liés (dont `plateformes.spec.ts`, section stalactites, et `carnage-lisible.spec.ts`), construction, typecheck, 365 dates sans secours. **Non vérifié** : Firefox et WebKit (la CI complète de `main`), le rendu à l'œil sur téléphone, la mesure de fluidité à ×4.
- **Échec hors de la zone Jump (CI de PR, run 40397412095)** : `apps/api/test/planning.test.ts` « médailles du lot 35 … le même temps : auteur avant la bascule, rien après » — `Test timed out in 5000ms` (part unit 4/4). Pas dû au lot : le test dure ≈ 3,9 s seul, avec ou sans lot 24 (mesuré sur `main` : 3 908 ms contre 3 948 ms ici), donc à la limite des 5 s sous la charge de la CI. Zone Track : non corrigé ; première relance par ce commit de documentation. Piste : lui donner un délai explicite.
