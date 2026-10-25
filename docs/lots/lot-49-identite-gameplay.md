# Lot 49 — Track : une identité de jeu par thème, des sauts plus techniques

Retour de Nathan (25/10/2026) : les circuits se ressemblent beaucoup ; il faut plus d'identité par thème, plus de variantes de blocs, et sur certains thèmes des sauts plus techniques qu'un boost suivi d'une rampe en ligne droite. Objet : que chaque thème **se joue** différemment, et que deux circuits du même thème ne se ressemblent plus. Trois temps, **avec un arrêt** après le deuxième pour que Nathan essaie les nouveautés au volant.

Zones : `packages/sim/**`, `apps/web/**`, `apps/api/scripts/measure-generator.ts`, `docs/lots/**`, la ligne de Track de `docs/plateforme/budgets.md`, ses clés de catalogue (et `docs/plateforme/traductions.md` régénéré), son entrée de `durees.json`. **Aucune zone partagée touchée.**

**État : les trois temps sont livrés.** Arrêt après le deuxième : Nathan a essayé les nouveautés sur l'aperçu et répondu « **je garde tout, fiches validées, passe au générateur** » (25/10/2026). Le générateur **v18** part de la bascule du **04/11/2026** (celle du lot 48, qui n'est pas en production) ; **les jours d'avant ne changent pas** (§ 4).

## 1. L'état des lieux (mesuré avant de coder)

Outil : `IDENTITE=1 npm run measure:generator` (section 5 de `apps/api/scripts/measure-generator.ts`, ≈ 25 s) — les 25 premiers circuits du jour de chaque thème à partir du 04/11/2026 (la bascule du lot 48, générateur v17), **200 circuits**, de vrais jours (donc aussi des jours consécutifs d'un même thème). `IDENTITE_GEN=<v>` impose une version, `IDENTITE_FROM`, `IDENTITE_N` changent la fenêtre.

| thème | vitesse moyenne du pilote | auteur | virages serrés / larges / amples | sauts par circuit | dont « plaque ou turbo puis rampe en ligne droite » | revêtements (part des blocs) | bords |
|---|---|---|---|---|---|---|---|
| Stade | 47,5 m/s | 37,5 s | 0,9 / 3,1 / 0,8 | 1,00 | 24 % | route 100 % | herbe 62 % |
| Rallye | 45,4 m/s | 37,5 s | 1,1 / 4,6 / 0,2 | 1,00 | 40 % | route 79 %, terre 21 % | gravier 66 % |
| Banquise | 41,6 m/s | 38,1 s | 1,2 / 4,5 / 0,2 | 0,24 | 17 % | route 86 %, glace 13 %, terre 1 % | neige 63 % |
| Nuit | 47,3 m/s | 38,0 s | 1,4 / 2,4 / 0,0 | 1,00 | 48 % | route 100 % | rebords 85 %, vide 15 % |
| Campagne | 43,9 m/s | 37,7 s | 1,9 / 3,9 / 0,3 | 0,36 | 33 % | route 76 %, herbe de course 12 %, terre 12 % | herbe 64 % |
| Canyon | 49,1 m/s | 36,5 s | 1,6 / 2,8 / 0,0 | 1,00 | **100 %** | route 97 %, sable 3 % | sable 57 % |
| Col alpin | 44,4 m/s | 37,8 s | 1,9 / 5,7 / 0,2 | 0,36 | 67 % | route 98 %, glace 2 % | neige 55 % |
| Ville | 44,6 m/s | 35,5 s | 3,9 / 2,8 / 0,1 | 0,36 | 67 % | route 100 % | rebords 100 % |

- **Sauts** (133 sur 200 circuits) : **52 % « plaque ou turbo puis rampe en ligne droite »**, 26 % en sortie de paroi (`saut-paroi`, `descente-cuve-saut`), 23 % à l'élan sur une ligne droite (le saut court, celui du Rallye), **0 % en sortie de virage ni de descente**. Génération : 127 ms en moyenne par circuit (Node), 489 ms au pire.
- **Figures** (part des circuits de chaque thème qui l'ont ; liste complète : sortie du script) : la signature à 100 % partout ; puis **les mêmes figures génériques dans tous les thèmes** — `plaque-epingle` 28 à 56 %, **`chaine-turbo` 36 à 52 % (Rallye 44 %, Banquise 52 %, Campagne 48 % : trois thèmes sans super turbo)**, `turbo-epingle` jusqu'à 60 % (Ville, Canyon), `colline-douce`, `pincement` (Banquise 60 %, Col 56 %). Elles viennent des règles communes de `selectFigures` (au moins un freinage franc, une portion rapide) : `turboChance` 0 ne baisse que leur poids, pas leur accès.

### La mesure de ressemblance (`packages/sim/src/ressemblance.ts`)
Deux parts, chacune un **indice de Jaccard** (intersection ÷ réunion, 0 à 1), moyennées :
- **les figures** : les figures du circuit **et leurs enchaînements** (deux figures consécutives, `saut-simple→plaque-virage`) ;
- **les blocs** : les suites de quatre blocs consécutifs, par leur **forme** seulement (droite, taille du virage et sens par rapport au précédent, pente, rampe, vide, plaque, cuve, revêtement ; ni largeur, ni repère, ni bas-côté, ni sens absolu : un circuit et son miroir se ressemblent).

Un circuit comparé à lui-même vaut 1. Fonctions pures et testées (`packages/sim/test/ressemblance.test.ts`) : `empreinte`, `ressemblance`, `enchainementsCommuns`.

| ressemblance moyenne (200 circuits, v17) | total | figures | blocs |
|---|---|---|---|
| même thème | **0,187** | 0,172 | 0,202 |
| thèmes différents | 0,091 | 0,055 | 0,126 |
| jours consécutifs d'un même thème (192 paires) | 0,179 | 0,164 | 0,193 |

Par thème (même thème, moyenne · pire paire) : Stade 0,209 · 0,600 ; Rallye 0,179 · 0,608 ; Banquise 0,149 · 0,476 ; **Nuit 0,247 · 0,671** ; Campagne 0,152 · **0,750** ; Canyon 0,210 · 0,577 ; Col 0,147 · 0,392 ; Ville 0,204 · 0,568. Jours consécutifs d'un même thème : **2,2 figures en commun** en moyenne (5 au plus, signature comprise), 26 paires sur 192 partagent un enchaînement.

**Paires les plus semblables** — même thème : 18/12 ↔ 27/12/2026 Campagne **0,750** (les mêmes sept figures, quatre enchaînements communs : `turbo-epingle→etranglement-terre→saut-simple→virage-aveugle→ample-herbe`) ; 13/12/2026 ↔ 12/05/2027 Nuit 0,671 ; 06/05 ↔ 08/07/2027 Nuit 0,668 ; 10/12/2026 ↔ 29/06/2027 Nuit 0,658. Entre thèmes : **10/11/2026 Stade ↔ 27/04/2027 Nuit 0,661** (`plaque-epingle→saut-cuve→turbo-courbe→colline-douce`), puis Stade ↔ Nuit encore (0,469, 0,467, 0,464…) : ces deux thèmes partagent cuves, sauts et épingles.

## 2. Les fiches et les nouveautés (validées)

**Fiches d'identité** : [`docs/lots/lot-49-identite/fiches.md`](lot-49-identite/fiches.md) — au volant, surfaces, figures signatures, rythme, ce que le thème ne fait jamais ; **validées par Nathan** ; la section « Ce qui a été appliqué » dit ce que le générateur en a fait (dont une quatrième vedette pour le Stade, la Banquise, la Campagne et la Ville, prise dans leur fiche) et les cibles tenues ou non.

**Douze nouveautés, toutes gardées**, dont **six sauts techniques** (un seul, la falaise du Canyon, part d'une plaque : c'est un grand saut au-dessus du vide). Toutes écrites avec les **blocs existants** (aucun bloc ni aucune physique nouvelle : `SIM_VERSION` reste 14) ; chacune **finie par le pilote d'auteur dans chaque variante, les deux sens et les trois largeurs** (`figures.test.ts`), **posée sans faute** (règles du lot 37, palier 1 et existant : `apps/web/test/decorPose.test.ts`), **générée dans les circuits du jour de chacun de ses thèmes** (`identite-a/b.test.ts`). Leçons du lot 34 : aucune plaque ni super turbo suivi d'un mur — la règle `secureBraking` s'applique à chaque figure posée (pièges inchangés : § 3).

| figure | catégorie | thèmes | ce qu'elle demande | variantes | capture |
|---|---|---|---|---|---|
| `saut-sortie-virage` — Saut à l'élan | saut | tous (vedette Rallye, Campagne, Canyon) | pas de plaque : la vitesse gardée dans le virage d'avant fait passer le vide | `L3 S S K GD` ; `L2 S S S S K G D` (même niveau : ≥ 43 m/s au bord) | [image](lot-49-identite/captures/saut-sortie-virage.jpg) |
| `tremplin-releve` — Tremplin en sortie de relevé | saut | tous (vedette Stade, Nuit) | on décolle en tournant : se redresser avant la rampe ou figer la caisse au frein (lot 19) | `L2/b K GD` ; `L3/b K GD` | [image](lot-49-identite/captures/tremplin-releve.jpg) |
| `chicane-tremplin` — Chicane avant le tremplin | saut | tous (vedette Stade, Ville) | assez vite pour le vide, assez propre pour arriver droit | `L2 R2 S S K GD` ; `L R2 S S K GD` (route large rétrécie) | [image](lot-49-identite/captures/chicane-tremplin.jpg) |
| `reception-virage` — Réception dans un virage | saut | tous (vedette Stade, Canyon, Nuit) | on retombe au début d'un virage ample : 36–43 m/s au bord de la rampe, tourner dès que les roues touchent | `K GD L3` ; `K GD L3 R2` | [image](lot-49-identite/captures/reception-virage.jpg) |
| `saut-glace` — Saut vers la glace | saut | Banquise, Col (vedette) | on retombe sur la glace, le virage se prépare en roue libre | quatre droites de glace puis un large sur glace ; plaque, saut plat, réception sur glace | [image](lot-49-identite/captures/saut-glace.jpg) |
| `saut-falaise` — Saut de la falaise | saut | Canyon (vedette) | deux cellules de vide, réception deux niveaux plus bas | plaque, `K G GD2 D`, quatre droites, un large ou un ample | [image](lot-49-identite/captures/saut-falaise.jpg) |
| `bosses-terre` — Bosses en série | technique | Rallye (vedette) | trois bosses de terre, garder la voiture droite pour tourner | `B/t ×3` ; `B/t S/t B/t B/t` | [image](lot-49-identite/captures/bosses-terre.jpg) |
| `demi-tour-mixte` — Demi-tour route et terre | technique | Rallye, Campagne (vedette des deux) | l'adhérence change au milieu du demi-tour | route → terre ; terre → route | [image](lot-49-identite/captures/demi-tour-mixte.jpg) |
| `demi-tour-glace` — Demi-tour route et glace | technique | Banquise, Col (vedette des deux) | lâcher les gaz sur la glace, les reprendre sur la route | glace → route ; route → glace | [image](lot-49-identite/captures/demi-tour-glace.jpg) |
| `rues-en-escalier` — Rues en escalier | technique (relief) | Ville (vedette) | un angle, une pente, un angle | serré, descente, large ; trois descentes et deux larges | [image](lot-49-identite/captures/rues-en-escalier.jpg) |
| `fil-du-rasoir` — Fil du rasoir | technique | Nuit (vedette) | 14 m sans rebords, un virage au milieu | droite, droite, large, droite ; S large | [image](lot-49-identite/captures/fil-du-rasoir.jpg) |
| `devers-descente` — Relevés en descente | technique (relief) | Col (vedette) | la pente pousse, le dévers retient | `D L2/b D R2/b` ; `D2 S L3/b D` | [image](lot-49-identite/captures/devers-descente.jpg) |

Captures : `CAPTURES=1 npx playwright test captures-lot49 --project=chromium` (variante 1, caméra loin, palette du thème ; un saut quand la voiture vole). **Retouches après l'arrêt** (pour que le générateur tienne la fenêtre 30–40 s, sans changer l'idée de chaque figure) : le saut à l'élan au même niveau et la chicane ont **une droite d'élan de plus** (en situation, le pilote arrivait à 42 m/s pour 43,4 requis, et à 33,8 pour 35,9) ; **les trois sauts sans plaque n'ont plus de virage imposé derrière leur réception** (`turned` vise les sorties à plus de 55 m/s, on les quitte ici sous la pointe du plat : −2 à −2,5 s chacun) ; `rues-en-escalier` et `devers-descente` passent de la catégorie « relief » à « technique » (avec le drapeau relief, comme `virage-descente`) ; les intentions (texte lu par personne d'autre que l'admin) sont resserrées (−270 o dans les fils de travail).

**Le jeu** : `?scenario=figure-<nom>` (`&v=1` la variante 2, `&m=1` le miroir) ; **`?scenario=figures`** ouvre la page des nouvelles figures (deux touchers jusqu'à une figure), puis le tour du lot 20 ; textes fr + en chargés avec les scénarios. Rubrique : `apps/web/CLAUDE.md`, « Nouvelles figures (lot 49) ».

**Ce qui a changé dans la simulation : rien de la physique** (`SIM_VERSION` 14). Pour la réception dans un virage seulement (un virage juste derrière un vide, qu'aucun circuit d'avant n'a) : `trackJumps` compte `CURVE_LANDING` = 32 m de réception (fenêtre 33,2–43,2 m/s au bord de la rampe) et le pilote part de l'axe sur la première moitié de l'arc (sans cela un coude au bord du vide le faisait viser 22 m/s, et il tombait). Un virage **large** derrière un vide n'est pas pris par le pilote (la route s'écarte trop vite de la trajectoire de vol) : seuls les virages amples sont posés.

## 3. Le générateur v18

**Bascule** : `BASCULE_LOT_49` (`packages/sim/src/dailyId.ts`, **constante unique**) = **mercredi 04/11/2026**, la même que le lot 48 : celui-ci n'est pas en production (dernière étiquette `prod-2026-10-25-0933`, avant sa fusion), la v17 ne sert donc à aucun jour. **À confirmer par Nathan selon la mise en production** : si le lot 48 part seul avant, `BASCULE_LOT_49` passe au premier jour ni passé, ni en cours, ni joué à la mise en production du lot 49 (puis `UPDATE_GOLDEN=1` sur `golden-daily.test.ts`, qui refuse de réécrire un jour d'avant). `GENERATOR_VERSION` = **18**, `GENERATOR_BEFORE_49` = 17 ; identifiants `jour-…-g18`, Salon `salon-…-g18` (il suit la dernière version dès la mise en production).

**Les fiches dans le générateur** (`packages/sim/src/themesVersion.ts`, hors du premier chargement) : favorites de chaque fiche ; **vedettes** (une par circuit, à tour de rôle : jamais la même deux fois de suite pour un thème) ; **interdits** — plus aucun super turbo au Rallye, à la Banquise et à la Campagne (ni `chaine-turbo`, `turbo-epingle`, `turbo-courbe`, `turbo-saut-releve`, ni variante qui pose un `T`) ; la Nuit a toujours de la route sans rebords ; Rallye : 3 à 4 zones de terre, Banquise : 2 à 3 zones de glace.

**Règles de composition** (v18 seulement ; v15 à v17 font exactement les mêmes calculs qu'avant) : la vedette tient lieu d'une des deux techniques exigées ; le freinage franc se prend d'abord parmi les figures qui font aussi la portion rapide (une figure générique de moins), ou parmi les figures au repos si aucune autre ne convient ; le poids ×2 des figures à freinage ne vaut plus pour un thème à vedettes ; un saut peut ouvrir le circuit (deux droites d'élan de plus) ou le finir quand aucun ordre ne l'évite. **Pourquoi** (mesuré, 200 jours) : avec la vedette seule, 15 jours de Stade sur 25 n'avaient aucun circuit valide (trop longs : la vedette s'ajoutait aux figures obligatoires) ; exiger « ni saut en tête ni en queue » faisait échouer un jour de Nuit sur cinq ; le minimum de cinq figures, lui, a pu être gardé.

**Variété garantie** : le numéro d'apparition du thème depuis la bascule (`themeOccurrence`) donne la vedette (`k mod n`), le tiers de figures au repos (`k + ⌊k / n⌋`) et le sens de l'ordre : un **tournoi fixe** par thème (chaque paire de figures a un sens permis aux apparitions paires, l'autre aux impaires) — **deux circuits consécutifs d'un même thème ne partagent aucun enchaînement de deux figures**, ni leur vedette (testé sur 60 apparitions de chaque thème). L'ordre reste tiré au hasard parmi ceux qui conviennent : un tri fixe (essayé d'abord) donnait le même ordre à deux circuits de même parité qui avaient les mêmes figures.

### Avant / après (mêmes 200 jours : 25 par thème à partir du 04/11/2026 ; `IDENTITE=1 npm run measure:generator`, `IDENTITE_GEN=17` pour l'avant)

| | v17 (avant) | v18 (après) | cible (fiches) |
|---|---|---|---|
| ressemblance, thèmes différents | 0,091 | **0,059** (−35 %) | ≤ 0,07 : **tenue** |
| ressemblance, jours consécutifs d'un même thème | 0,179 | **0,136** (−24 %) | ≤ 0,12 : **pas tout à fait** |
| pire paire de jours consécutifs d'un même thème | 0,750 | **0,308** | aucune > 0,5 : **tenue** |
| paires de jours consécutifs d'un même thème qui partagent un enchaînement | 26 / 192 | **0 / 192** | 0 : **tenue** |
| figures communes à deux jours consécutifs d'un même thème | 2,21 (max 5) | **1,88** (max 4) | — |
| ressemblance, toutes paires | 0,102 | **0,074** (−28 %) | — |
| ressemblance, jours qui se suivent au calendrier (174 paires) | 0,090 | **0,068** (−24 %) | — |
| ressemblance, même thème (toutes paires) | 0,187 | **0,179** (−4 %) | ≤ 0,14 : **pas tenue** |
| sauts « plaque ou turbo puis rampe en ligne droite » | **52 %** | **37 %** | — |
| sauts en sortie de virage / à l'élan / en sortie de paroi | 0 % / 23 % / 26 % | **25 %** / 26 % / 12 % | — |
| sauts par circuit | 0,67 | 0,97 | — |
| génération d'un circuit (Node, fil de travail) | 129 ms (pire 461) | **110 ms** (pire 410) | — |
| circuits de secours | 0 | 0 | 0 |

**Pourquoi la ressemblance dans un même thème baisse peu** : c'est le prix de l'identité. Les fiches **resserrent** chaque thème (plus de super turbo au Rallye, à la Banquise et à la Campagne ; une vedette et une règle propre obligatoires ; des circuits de cinq figures, dont trois ou quatre imposées) : deux circuits du même thème partagent donc plus souvent leur signature, leur règle propre et leurs surfaces — c'est ce qui les fait reconnaître. Ce que la variété garantit, c'est **le jeu d'une semaine à l'autre** (jours consécutifs d'un même thème : −24 %, plus aucun enchaînement commun, pire paire divisée par 2,4), et **d'un jour à l'autre** (jours qui se suivent au calendrier : −24 %). Pour aller plus loin, il faudrait plus de figures par thème (un prochain lot de figures) ; restreindre davantage (un seul tiers ouvert par apparition) a été essayé : des jours sans circuit valide.

**Par thème** (v18, vitesse moyenne du pilote · virages serrés / larges / amples par circuit · part « boost puis rampe » des sauts) : Stade 47,7 m/s · 0,8/2,7/1,4 · 21 % (24 % avant) ; Rallye 43,9 · 0,2/5,9/0,2 · 33 % (40 %), terre 31 % des blocs (21 %) ; Banquise 39,0 · 0,6/5,8/0,0 · 64 % (17 % : le saut vers la glace, variante à plaque), glace 22 % (13 %) ; Nuit 46,6 · 0,7/3,5/0,5 · 10 % (48 %), vide 21 % des bords (15 %) ; Campagne 41,6 · 1,2/5,1/0,5 · 0 % (33 %), herbe de course 18 % (12 %) ; Canyon 49,9 · 1,3/1,7/0,7 · 68 % (100 %), 2,0 sauts par circuit (1,0) ; Col 44,2 · 1,6/5,7/0,3 · 73 % (67 %) ; Ville 44,2 · 3,9/4,2/0,2 · 17 % (67 %). Figures les plus fréquentes et paires les plus semblables : sortie du script (section 5).

**Validation par thème** (`COMPARE=17,18 npm run measure:generator`, section 2 : 12 dates × 6 tentatives, thème forcé) — tentatives dans la fenêtre, v17 → v18 : Stade 62 → 90 %, Rallye 59 → 38 %, Banquise 49 → 33 %, Nuit 57 → 46 %, Campagne 61 → 55 %, Canyon 93 → 61 %, Col 44 → 59 %, Ville 86 → 67 %. **Les thèmes sans super turbo plafonnent à 66 m/s** (au lieu de 79 à 84 : leur portion rapide est une plaque, toujours au-dessus de `FAST_PEAK` 62,4) et refusent plus de tentatives ; avec 40 tentatives, **aucun jour sans circuit** sur 60 dates (section 1), 200 jours (section 5) et 480 jours (tests : 60 par thème). **Tri des tentatives par une première course** (v18 seulement, `QUICK_SLACK_MS`, generator.ts) : la course de la plus haute adhérence, sur le fond, roule seule d'abord ; si elle finit à plus de 40,5 s, la tentative est refusée sans les trois (ou sept) autres, et sinon elle compte parmi les quatre (pas refaite). Mesuré sur 279 tentatives de 160 jours : une adhérence plus basse ou la paroi ne gagnent jamais plus de 1,1 s sur elle, plus de 0,5 s deux fois ; **les 200 premiers circuits v18 sont identiques octet pour octet avec et sans ce tri**. Sans lui, la v18 (plus de tentatives refusées) prenait 146 ms en moyenne et jusqu'à 1 s par jour (Node), et le test de durée échouait en CI (pire jour 3,6 s contre 3,5 : le 14/11, Banquise, 18 tentatives) ; avec lui, 110 ms en moyenne, pire 0,4 s (le 14/11 : 787 → 425 ms), moins que la v17 sur les mêmes jours (129 ms, pire 461). Un essai à 1,5 s de marge ne retirait presque rien (757 ms).

**Lot 34 : virages-pièges et contacts** (section 3, 156 circuits, v17 → v18) : pièges par circuit 0,22 → **0,23**, jamais plus d'un ; contacts du pilote « humain correct » 0,48 → **0,54** par circuit (Ville 1,25 → 1,92 : ses épingles et la chicane avant le tremplin ; Stade 1,08 → 0,75) ; droites de freinage ajoutées 2,15 → 1,71.

### L'écart pilote / humain et les médailles
**Non recalibrées** (hors périmètre). Les nouveautés demandent ce que le pilote d'auteur fait sans effort et qu'un humain doit apprendre : **garder l'élan dans un virage avant une rampe** (trop prudent, on tombe dans le vide : le pilote est à 1,08–1,31 fois la vitesse minimale), **arriver à la bonne vitesse sur une réception en virage** (fenêtre 36–43 m/s, sans freiner en l'air) et **figer la caisse** en sortie de relevé. Mesuré sans humain : le pilote « humain correct » du lot 34 heurte un peu plus (+0,06 contact par circuit). **À regarder dans « Médailles » de `/admin/`** après les premiers jours v18 : si la part des joueurs qui ont l'or baisse, c'est l'écart pilote / humain qui a grandi (et le lot 35 se recalibre par une nouvelle date de bascule, jamais en place).

## 4. Les jours passés ne changent pas

- **Bit pour bit, hors des tests** : les 22 jours du 13/10 au 03/11/2026, variante 0, variante 1, Campagne et Ville imposées — **88 circuits** (texte, identifiant, temps de l'auteur, tentative, médailles, thème) identiques à ceux de `main` (`5688560`, construit à côté).
- `fixtures/daily-golden.json` : les jours d'avant la bascule inchangés (la régénération refuse d'en réécrire un) ; **un jour d'après la bascule par thème** (04/11 Campagne, 05/11 Banquise, 08/11 Ville, 10/11 Stade, 16/11 Canyon, 10/12 Nuit, 25/12 Col, 28/02/2027 Rallye ; testé). Rediffusion de référence (`golden.test.ts`), rediffusions de `replay.test.ts` et `car.test.ts` : identiques (`SIM_VERSION` 14). `npm run history:seed` : seul `generatorVersion` de `apps/web/public/demo/index.json` change (17 → 18).

## 5. Remplacements du planning touchés

**Le lot n'a pas accès à la base de production ni à celle de la recette.** Tout remplacement déjà choisi pour un jour **≥ 04/11/2026** devient la variante du générateur v18 : **son circuit change** (et son identifiant passe à `-g18`). **À revoir dans `/admin/` (planning)** : la carte d'un jour dit « v18 · identité des thèmes (lot 49) et herbe de course (lot 48) ».

## 6. Budget (`npm run build && node scripts/budgets.mjs`, `main` à `5688560`)

- **Premier chargement : +184 o** (JS + CSS 287 153 → **287 337 o**, marge 4 447 → **4 263 o** ; sous la cible de 1,5 ko) : la lecture `?scenario=figure-<nom>`, la palette d'une figure, la page des figures gelée dans `main.ts`, la version 18 et sa bascule (`dailyId.ts`). **Les tables des thèmes par version** (`themesVersion.ts`, lot 48 compris) **sont sorties du premier chargement** : dans `themes.ts`, partagé avec les scénarios et le générateur, elles y entraient (≈ +410 o mesurés, repris en les déplaçant).
- **Fils de travail** (le générateur v18 : douze figures, fiches, variété) : miniatures et circuit du jour 27 307 → **29 192 o** (+1 885, marge **808 o** sous 30 000) ; Salon 29 280 → **31 187 o** (+1 907, marge **813 o** sous 32 000). Au-dessus des ≈ +800 o visés au deuxième temps : les deux plafonds tiennent, mais **la prochaine règle de générateur n'aura que ≈ 0,8 ko** — à surveiller (`budgets.md`, « marges les plus serrées »).
- Page d'admin +26 o (886 o de marge) ; catalogue anglais inchangé (les textes des figures voyagent avec les scénarios, à la demande).

## 7. Vérifié / non vérifié / décisions pour Nathan

- **Vérifié** : `npm run typecheck` ; `npx vitest run --project sqlite` (toute la suite) ; les tests du lot (`identite-a/b`, `identite-avant-apres`, `ressemblance`, figures, golden, pose du décor) ; e2e `figures.spec.ts` et `daily.spec.ts` (Chromium) ; `npm run measure:generator` complet (v18, puis `COMPARE=17,18`) et `IDENTITE=1` avant / après ; `npm run history:seed` ; `npm run traductions` ; budget mesuré.
- **Non vérifié** : la sensation au volant des circuits du jour v18 (deux jours d'un même thème qui se jouent différemment : c'est l'objet de l'aperçu) ; l'écart pilote / humain réel (aucune course humaine en v18) ; les e2e Firefox et WebKit en local (la CI les lance).
- **Décisions pour Nathan** : (1) **la date de bascule** (04/11/2026, celle du lot 48) selon la mise en production ; (2) **la cible « même thème ≤ 0,14 » n'est pas tenue** (0,179) : la garder pour un lot de figures, ou la remplacer par celle des jours consécutifs (0,136, cible 0,12) ; (3) les quatre vedettes du Stade, de la Banquise, de la Campagne et de la Ville ; (4) **un saut peut ouvrir ou finir un circuit** en v18 (deux droites d'élan de plus en tête) ; (5) **la marge des fils de travail** (≈ 0,9 ko chacun) ; (6) l'**index du `CLAUDE.md` racine** (zone partagée, non modifié) : ajouter « Générateur : identité des thèmes (lot 49) » aux rubriques de `packages/sim/CLAUDE.md` et « Nouvelles figures (lot 49) » à celles de `apps/web/CLAUDE.md`, et la marge de Track (≈ 4,3 ko) ; (7) les remplacements du planning ≥ 04/11 (§ 5) ; (8) **itinéraires bis** (hors périmètre, demandé : « à proposer si fort intérêt ») : la grille réserve une cellule par bloc et un circuit est une suite ; deux chemins demanderaient une bifurcation et une jonction (blocs nouveaux, portes et rediffusions inchangées mais pilote à deux trajectoires) — **intérêt réel** (un choix risqué / sûr, comme les coupes du lot 21) mais un lot à part, après une mesure de ce que les coupes par bas-côté apportent déjà.

## 8. À tester (aperçu de la PR, au téléphone)

Aperçu de la PR #138 : https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/ (les jours d'après la bascule ne sont jouables qu'en aperçu ou en recette, ou avec `?debug`).
- **Deux jours d'un même thème : ils doivent se jouer différemment** — Stade [`?seed=2026-11-10`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-10) (tremplin en sortie de relevé) puis [`?seed=2026-11-11`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-11) (réception en virage) ; Rallye [`?seed=2026-11-13`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-13) (bosses) puis [`?seed=2026-11-23`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-23) (demi-tour route et terre).
- **Un jour par thème** : Campagne [`2026-11-04`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-04), Banquise [`2026-11-05`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-05), Col [`2026-11-06`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-06), Ville [`2026-11-08`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-08) (un saut en tête), Stade [`2026-11-10`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-10), Rallye [`2026-11-13`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-13), Canyon [`2026-11-16`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-11-16) (la falaise), Nuit [`2026-12-10`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?seed=2026-12-10) (le fil du rasoir).
- Les nouveautés seules : [`?scenario=figures`](https://playdujour-recette--pr-138-1pcq6e9u.web.app/track/?scenario=figures).
