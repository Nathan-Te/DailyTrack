# Lot 49 — Track : une identité de jeu par thème, des sauts plus techniques

Retour de Nathan (25/10/2026) : les circuits se ressemblent beaucoup ; il faut plus d'identité par thème, plus de variantes de blocs, et sur certains thèmes des sauts plus techniques qu'un boost suivi d'une rampe en ligne droite. Objet : que chaque thème **se joue** différemment, et que deux circuits du même thème ne se ressemblent plus. Trois temps, **avec un arrêt** après le deuxième pour que Nathan essaie les nouveautés au volant.

Zones : `packages/sim/**`, `apps/web/**`, `apps/api/scripts/measure-generator.ts`, `docs/lots/**`, la ligne de Track de `docs/plateforme/budgets.md`, ses clés de catalogue (et `docs/plateforme/traductions.md` régénéré), son entrée de `durees.json`. **Aucune zone partagée touchée.**

**État : deuxième temps livré, arrêt — en attente des choix de Nathan** (garder / écarter / retoucher chaque nouveauté, valider les fiches). Le troisième temps (le générateur) n'est pas commencé : **aucun circuit du jour ne change encore** (golden, rediffusions de référence et 240 circuits identiques à `main`, voir § 4).

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

## 2. Les fiches et les nouveautés (deuxième temps : à essayer)

**Fiches d'identité** : [`docs/lots/lot-49-identite/fiches.md`](lot-49-identite/fiches.md) — au volant, surfaces, figures signatures et poids proposés, rythme, ce que le thème ne fait jamais, la règle de variété proposée et sa cible. **À valider.**

**Douze nouveautés**, dont **six sauts techniques** (aucun n'est « boost puis rampe en ligne droite » sauf la falaise, qui est un grand saut au-dessus du vide). Toutes écrites avec les blocs existants (aucun bloc nouveau, aucune physique nouvelle) ; chacune **finie par le pilote d'auteur dans chaque variante, les deux sens et les trois largeurs** (`figures.test.ts`, qui parcourt toute la bibliothèque), et réservée au générateur v18 (`since: 18`) : **aucun circuit du jour ne les tire avant la validation**. Leçons du lot 34 : aucune plaque ni super turbo suivi d'un mur (la falaise part d'une plaque, la réception a quatre droites puis un virage large ; la règle `secureBraking` les vérifiera dans le générateur).

| figure | catégorie | thèmes | ce qu'elle demande | variantes |
|---|---|---|---|---|
| `saut-sortie-virage` — Saut à l'élan | saut | tous | pas de plaque : la vitesse gardée dans le virage d'avant fait passer le vide | `L3 S S K GD` ; `L2 S S S K G D` (même niveau : ≥ 43 m/s au bord) |
| `tremplin-releve` — Tremplin en sortie de relevé | saut | tous | on décolle encore en train de tourner : se redresser avant la rampe ou figer la caisse au frein (lot 19) | `L2/b K GD` ; `L3/b K GD` |
| `chicane-tremplin` — Chicane avant le tremplin | saut | tous | assez vite pour le vide, assez propre pour arriver droit | `L2 R2 S K GD` ; `L R2 S S K GD` (route large rétrécie) |
| `reception-virage` — Réception dans un virage | saut | tous | on retombe au début d'un virage ample : pas trop vite (fenêtre 36–43 m/s au bord de la rampe), tourner dès que les roues touchent | `K GD L3` ; `K GD L3 R2` |
| `saut-glace` — Saut vers la glace | saut | Banquise, Col | on retombe sur la glace, le virage se prépare en roue libre | quatre droites de glace puis un large sur glace ; plaque, saut plat, réception en descente sur glace |
| `saut-falaise` — Saut de la falaise | saut | Canyon | deux cellules de vide, réception deux niveaux plus bas | plaque, `K G GD2 D`, quatre droites, un large ou un ample |
| `bosses-terre` — Bosses en série | technique | Rallye | trois bosses de terre, garder la voiture droite pour tourner | `B/t ×3` ; `B/t S/t B/t B/t` |
| `demi-tour-mixte` — Demi-tour route et terre | technique | Rallye, Campagne | l'adhérence change au milieu du demi-tour | route → terre ; terre → route |
| `demi-tour-glace` — Demi-tour route et glace | technique | Banquise, Col | lâcher les gaz sur la glace, les reprendre sur la route | glace → route ; route → glace |
| `rues-en-escalier` — Rues en escalier | relief | Ville | un angle, une pente, un angle | serré, descente, large ; trois descentes et deux larges |
| `fil-du-rasoir` — Fil du rasoir | technique | Nuit | 14 m sans rebords, un virage au milieu | droite, droite, large, droite ; S large |
| `devers-descente` — Relevés en descente | relief | Col | la pente pousse, le dévers retient | `D L2/b D R2/b` ; `D2 S L3/b D` |

**Ce qui a changé dans la simulation : rien de la physique.** Deux ajouts du **pilote** et de la **fenêtre de saut**, qui ne servent qu'à un virage posé juste derrière un vide (aucun circuit d'avant n'en a ; preuve § 4) :
- `trackJumps` (`jump.ts`) : une réception dans un virage compte `CURVE_LANDING` = 32 m de réception (la voiture vole droit, la route tourne sous elle : elle doit toucher au début de l'arc) — fenêtre d'un saut `K GD` vers un virage : **33,2 à 43,2 m/s** au bord de la rampe (pilote : 37 à 42 m/s) ;
- `denseCenterline` (`autopilot.ts`) : sur un virage qui suit un vide, la trajectoire part de l'axe et s'en écarte en douceur sur la première moitié de l'arc (sans cela un coude au bord du vide faisait viser 22 m/s au pilote, et il tombait). Les virages amples seulement : sur un virage large, la route s'écarte trop vite de la trajectoire de vol (le pilote n'y arrive pas, un humain non plus).

**Le jeu** : `?scenario=figure-<nom>` (`&v=1` la variante 2, `&m=1` le miroir ; `?scenario=figure&f=<nom>` du lot 20 reste) ; **`?scenario=figures`** ouvre d'abord **la page des nouvelles figures** (un écran posé sur la scène, `scenarios.ts` : `pageFigures`) — une ligne par nouveauté (titre, ce qu'elle demande, ses thèmes, « Essayer » et « Variante 2 »), deux touchers du téléphone jusqu'à une figure ; fermée (« ‹ TRACK », Échap, « Rouler le tour des figures »), on roule le tour des figures du lot 20 comme avant. Une figure propre à un thème se joue sur la palette de ce thème (`figurePalette`). Textes en français et en anglais (`catalogue.course.figures.*.ts`, **chargés avec les scénarios**, pas au premier écran). e2e : `figures.spec.ts` (la page, deux touchers, la réception en virage finie au temps de Node, les douze scénarios).

### Budget (deuxième temps ; `npm run build && node scripts/budgets.mjs`, `main` à `5688560` : 287 153 / 27 307 / 29 280 o)
- **Premier chargement : +122 o** (287 275 o, marge 4 325 o) : la lecture du nom de figure de l'adresse, la palette d'une figure, la page gelée dans `main.ts`.
- Fils de travail : miniatures 27 307 → **28 525 o** (+1 218, marge 1 475 sous 30 000) ; Salon 29 280 → **30 548 o** (+1 268, marge 1 452 sous 32 000) — les douze figures sont dans le générateur même si la v17 ne les tire pas. Le troisième temps ajoutera les fiches (tables des thèmes) et la règle de variété : **viser ≤ +800 o de plus** ; sinon les intentions des figures (des phrases, lues seulement par l'admin) pourraient quitter le générateur.

## 3. Arrêt : ce que Nathan essaie et choisit

**À tester (aperçu de la PR, au téléphone)** — liens dans le commentaire « Aperçu » de la PR ; sur l'aperçu :
1. `/track/?scenario=figures` : la page des nouveautés ; « Essayer » (ou « Variante 2 ») sur chacune.
2. Pour chaque nouveauté, dire : **garder**, **écarter** ou **retoucher** (et quoi : plus long, plus court, plus étroit, sur un autre thème…).
3. Lire les fiches (`docs/lots/lot-49-identite/fiches.md`) : valider ou corriger, surtout les « jamais » (plus de super turbo au Rallye, à la Banquise et à la Campagne) et la règle de variété (vedettes tournantes, aucun enchaînement commun entre deux jours consécutifs d'un même thème ; cible : même thème 0,187 → ≤ 0,14).

## 4. Vérifié / non vérifié (deuxième temps)
- **Vérifié** : `npm run typecheck` ; `npx vitest run packages/sim` (517 tests : **golden des jours, rediffusions de référence, figures — dont les douze nouvelles, chaque variante, deux sens, trois largeurs —, freinage, médailles : tous identiques ou verts**) ; tests de `apps/web` et `packages/ui` (catalogues, clés, chaînes en dur) ; `npm run traductions` ; e2e `figures.spec.ts` (Chromium, 4 tests) ; budget mesuré.
- **Bit pour bit, hors des tests** : 60 jours du 13/10 au 11/12/2026 (v15, v16 et v17), variante 0, variante 1, Campagne et Ville imposées — **240 circuits** (texte, identifiant, temps de l'auteur, tentative, médailles, thème) identiques à ceux de `main` (`5688560`, construit à côté).
- **Non vérifié** : la sensation au volant de chaque nouveauté (c'est l'objet de l'arrêt) ; la CI complète (en cours sur la PR).
- **Décisions pour Nathan** : § 3.
