# Lot 20 — Générateur à figures

**Essayer** : https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figures — un tour de **onze figures marquantes** de la bibliothèque (S serré-large, turbo puis courbe relevée, rétrécissement et virage, saut vers un virage relevé, slalom de glace, descente-cuve-saut, plaque puis épingle, virage aveugle en haut d'une montée, double saut, moteur coupé avant un virage, turbos enchaînés et S large), un point de contrôle tous les dix blocs.
**Puis une figure en boucle** : `?scenario=figure&f=<nom>` (liste ci-dessous) — cinq droites de lancement, point de contrôle juste avant, **R** pour recommencer ; `&v=<n>` choisit la variante, `&m=1` renverse le sens. Exemple : https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-releve&v=1&m=1 — l'admin (`/admin/` → « Une figure en boucle ») le propose avec un sélecteur.
**Puis cinq circuits du jour, un par thème** (voir plus bas) : https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?seed=2026-10-21 (Stade) · `?seed=2026-11-12` (Rallye) · `?seed=2026-11-08` (Banquise) · `?seed=2026-10-18` (Nuit) · `?seed=2026-10-16` (Campagne).

(Si l'environnement impose un autre nom de branche, remplacer `lot-20-figures` dans les liens ; une fois fusionné, les mêmes adresses marchent sur https://nathan-te.github.io/DailyTrack/ et `/admin/` propose « Les figures » et « Une figure en boucle ».)

![La figure `saut-releve` : la voiture, à 224 km/h, arrive au bord de la rampe du saut](img/lot-20-saut-releve.png)

![Admin : la carte d'un jour liste ses figures (aide au remplacement)](img/lot-20-admin-figures.png)

## Ce que fait le lot

Nathan trouvait que « la génération manque de ce qui fait un circuit de Trackmania : on retrouve beaucoup les mêmes motifs, il manque des moments techniques et des sauts sur des éléments techniques, pas seulement un gros test de vitesse en ligne droite ». Le générateur ne tire plus des créneaux « calme + virage » : il **assemble 5 à 7 figures** d'une bibliothèque de **40**.

- **Une figure** (`packages/sim/src/figures.ts`) = une courte suite de blocs avec une intention, un nom, une catégorie et des variantes : miroir (le sens du premier virage), largeur de route (la figure se rétrécit d'elle-même si elle a besoin d'un virage serré), revêtement, niveau, longueur. Catégories : *technique* (17), *saut technique* (10), *rapide* (4), *combinaison* (4), *cuve* (3), *relief* (2).
- **Composition** (`composeFigures`) : la **signature du thème** (toujours) · un **saut** et une **cuve** selon le thème (une figure qui fait les deux, 55 % du temps) · du **dénivelé** (de préférence un virage en pente) · au moins un **freinage franc** (plaque ou super turbo, puis un virage) · une **portion rapide** · une **figure favorite** du thème · **au moins deux techniques** · le reste au poids, dans un budget de durée. **Jamais la même figure deux fois**, jamais de saut en première ni en dernière position. Chaque figure prend la première (variante, miroir) qui tient sur la grille, dans les hauteurs permises et le budget de virages serrés ; une figure qui ne tient pas est remplacée par une autre de la même catégorie (la signature, non : la tentative échoue et la graine voisine prend le relais).
- **Peu de répétition d'un jour à l'autre, sans générer les jours précédents** : `isRested(nom, jour)` — la bibliothèque est répartie en trois groupes (par l'empreinte du nom) et le jour `d` laisse au repos le groupe `d mod 3`. Deux jours de suite n'ont en commun que le tiers des figures ; le coût de génération est celui d'un seul jour.
- **Thèmes** : figures favorites (tirées 4 fois plus souvent) et interdites. *Banquise* : slalom et chicane de glace, moteur coupé sur glace ; *Rallye* : saut sur la terre, épingle de terre ; *Stade* et *Nuit* : sauts techniques et cuves (saut-paroi, descente-cuve-saut) ; *Campagne* : étranglement, virage aveugle, crête. Pas de glace hors de la *Banquise*, pas de terre ni de cuve là où le thème n'en a pas.
- **Huit tirages** : le premier dont la durée estimée tient dans le budget et qui lâche le plus le gaz l'emporte. La **durée estimée** (`estimateSeconds`, par bloc, écart moyen de 1,8 s avec le pilote sur 60 dates) sert aussi à refuser un circuit hors fenêtre **avant** de faire rouler le pilote.
- **Pilote** : il franchit chaque variante de chaque figure, dans les deux sens et sur les trois largeurs (`figures.test.ts`) ; trois corrections de figures ont été nécessaires (un saut dont la réception est *dans* un virage ne se prend pas : il en faut deux blocs de plus ; deux sauts à la suite avec une seule droite entre eux dépassent la fenêtre de vitesse ; un virage serré sur route large demande un rétrécissement d'abord).
- **Web** : `?scenario=figures`, `?scenario=figure&f=…`, admin (« Les figures », « Une figure en boucle », et **la carte d'un jour du planning liste ses figures** : aide au remplacement).
- **Versions** : `GENERATOR_VERSION` 11 → **12** ; `SIM_VERSION` reste **11** (aucun bloc, aucune physique). Golden des circuits du jour et jeu de données de démonstration régénérés.

## Les figures

Toutes les adresses ci-dessous ouvrent la figure, départ juste avant. `?scenario=figure&f=<nom>&v=<variante>&m=1` pour une autre variante, en miroir.

**Techniques**

| Figure | Variantes | Ce qu'elle demande | Essayer |
|---|---|---|---|
| S serré-large (`s-serre-large`) | 2 | Un virage serré tout de suite suivi d'un large en sens inverse (ou l'inverse) : placer la voiture pour la sortie. | [`?scenario=figure&f=s-serre-large`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=s-serre-large) |
| Rétrécissement et virage (`pincement`) | 2 | La route se resserre jusqu'à 14 m, puis un virage serré au bout de la ligne droite étroite. | [`?scenario=figure&f=pincement`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=pincement) |
| Relevé puis plat inverse (`releve-contre`) | 3 | Un virage relevé pris à fond enchaîné sur un virage plat dans l'autre sens : la pente rejette vers l'extérieur. | [`?scenario=figure&f=releve-contre`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=releve-contre) |
| Épingle large sur terre (`epingle-terre`) | 3 | Un demi-tour large sur la terre : freiner tôt, tourner sans glisser. | [`?scenario=figure&f=epingle-terre`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=epingle-terre) |
| Slalom de glace (`slalom-glace`) | 2 | Des S larges sur la glace, en roue libre : alterner gauche et droite sans gaz pour garder la voiture. | [`?scenario=figure&f=slalom-glace`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=slalom-glace) |
| Moteur coupé avant un virage (`coupe-virage`) | 2 | Le moteur se coupe : vivre sur son élan, puis tourner sans pouvoir accélérer jusqu'au prochain point de contrôle. | [`?scenario=figure&f=coupe-virage`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=coupe-virage) |
| Changement de revêtement (`changement-revetement`) | 2 | Deux virages enchaînés qui changent de revêtement au milieu : l'adhérence n'est plus la même à la sortie. | [`?scenario=figure&f=changement-revetement`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=changement-revetement) |
| Virage en descente (`virage-descente`) | 3 | On prend de la vitesse dans la pente et le virage arrive au bas : freiner dans la descente. | [`?scenario=figure&f=virage-descente`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=virage-descente) |
| Virage aveugle en haut d'une montée (`virage-aveugle`) | 3 | On monte, et le virage est juste derrière la crête : on ne le voit qu'une fois en haut. | [`?scenario=figure&f=virage-aveugle`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=virage-aveugle) |
| Crête puis virage (`crete-virage`) | 2 | Un dos d'âne fait décoller, la réception est suivie d'un virage : on ne freine pas en l'air. | [`?scenario=figure&f=crete-virage`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=crete-virage) |
| S relevé (`esse-relevee`) | 3 | Deux virages relevés dans des sens opposés : la pente change de côté au milieu. | [`?scenario=figure&f=esse-relevee`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=esse-relevee) |
| Demi-tour large (`demi-tour-large`) | 2 | Deux virages larges dans le même sens : un demi-tour à prendre sur la corde. | [`?scenario=figure&f=demi-tour-large`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=demi-tour-large) |
| Étranglement et virage sur terre (`etranglement-terre`) | 2 | La route se resserre sur la terre, puis un virage serré au bout de la ligne droite étroite. | [`?scenario=figure&f=etranglement-terre`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=etranglement-terre) |
| Chicane sur la glace (`chicane-glace`) | 2 | Une chicane large sur la glace, après une ligne droite verglacée. | [`?scenario=figure&f=chicane-glace`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=chicane-glace) |
| Gros freinage (`freinage-epingle`) | 2 | Une longue droite, puis un virage serré : freiner le plus tard possible. | [`?scenario=figure&f=freinage-epingle`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=freinage-epingle) |
| Slalom (`slalom-route`) | 3 | Trois ou quatre virages larges qui alternent : le rythme se tient en sortie de chacun. | [`?scenario=figure&f=slalom-route`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=slalom-route) |
| Plaque puis épingle (`plaque-epingle`) | 2 | Une plaque pousse à 66 m/s, trois lignes droites, puis un virage serré : le frein, pas le courage. | [`?scenario=figure&f=plaque-epingle`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=plaque-epingle) |

**Sauts techniques**

| Figure | Variantes | Ce qu'elle demande | Essayer |
|---|---|---|---|
| Saut (`saut-simple`) | 5 | Rampe, vide, réception : prendre assez de vitesse au bord (du saut court au saut vers le haut), puis un virage large derrière. | [`?scenario=figure&f=saut-simple`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-simple) |
| Saut sur la terre (`saut-terre`) | 2 | Une rampe de terre, un vide, une réception de terre. | [`?scenario=figure&f=saut-terre`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-terre) |
| Saut et virage (`saut-virage`) | 3 | La réception est suivie de près d'un virage : on ne freine pas en l'air, tout se règle dès qu'on touche. | [`?scenario=figure&f=saut-virage`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-virage) |
| Saut vers un virage relevé (`saut-releve`) | 2 | On retombe, puis un virage relevé : la pente aide à tourner si la vitesse est bonne. | [`?scenario=figure&f=saut-releve`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-releve) |
| Saut dans une cuve (`saut-cuve`) | 2 | La réception se fait à l'entrée d'une cuve : la paroi se relève devant la voiture. | [`?scenario=figure&f=saut-cuve`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-cuve) |
| Saut vers une section étroite (`saut-etroit`) | 2 | On saute depuis une route large et on retombe sur une route qui se resserre. | [`?scenario=figure&f=saut-etroit`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-etroit) |
| Saut de niveau vers une épingle (`saut-niveau-epingle`) | 2 | On retombe deux niveaux plus bas, avec une épingle large juste derrière : réception et freinage. | [`?scenario=figure&f=saut-niveau-epingle`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-niveau-epingle) |
| Plaque à la réception (`saut-plaque`) | 2 | Une plaque d'accélération juste après la réception : la voiture repart plus vite qu'elle n'est tombée. | [`?scenario=figure&f=saut-plaque`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-plaque) |
| Double saut (`double-saut`) | 2 | Deux vides à la suite, avec une courte réception entre les deux. | [`?scenario=figure&f=double-saut`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=double-saut) |
| Saut en sortie de paroi (`saut-paroi`) | 2 | Le mur latéral donne de la vitesse, et le saut part tout de suite après : sortir de la paroi bien aligné. | [`?scenario=figure&f=saut-paroi`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=saut-paroi) |

**Portions rapides**

| Figure | Variantes | Ce qu'elle demande | Essayer |
|---|---|---|---|
| Turbos enchaînés (`chaine-turbo`) | 3 | Deux super turbos à trois blocs d'écart : le second prolonge le premier, puis un virage large, serré ou un S large au bout des cinq droites : freiner de plus de 80 m/s. | [`?scenario=figure&f=chaine-turbo`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=chaine-turbo) |
| Plaque en haut d'une descente (`descente-plaque`) | 3 | Une plaque au sommet d'une longue descente de six blocs. | [`?scenario=figure&f=descente-plaque`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=descente-plaque) |
| Turbo puis grande courbe relevée (`turbo-courbe`) | 4 | Un super turbo, puis une grande courbe relevée prise à fond (ou, dans une variante, un virage large à plat : il faut freiner). | [`?scenario=figure&f=turbo-courbe`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=turbo-courbe) |
| Plaque puis virage (`plaque-virage`) | 2 | Une plaque pousse à 66 m/s, deux lignes droites, puis un virage large (ou un S large) : le frein tout de suite. | [`?scenario=figure&f=plaque-virage`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=plaque-virage) |

**Combinaisons**

| Figure | Variantes | Ce qu'elle demande | Essayer |
|---|---|---|---|
| Turbo, saut, virage relevé (`turbo-saut-releve`) | 2 | Un super turbo lance un long saut, et la réception est suivie d'un virage relevé. | [`?scenario=figure&f=turbo-saut-releve`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=turbo-saut-releve) |
| Descente, cuve, saut (`descente-cuve-saut`) | 2 | On descend, on remonte la paroi d'une cuve, et le saut part de la sortie. | [`?scenario=figure&f=descente-cuve-saut`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=descente-cuve-saut) |
| Turbo puis épingle (`turbo-epingle`) | 2 | Un super turbo, cinq lignes droites, puis un virage serré : on arrive à plus de 70 m/s sur un virage de 16 m de rayon. | [`?scenario=figure&f=turbo-epingle`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=turbo-epingle) |
| Glace, moteur coupé, virage (`glace-coupe-virage`) | 2 | De la glace, puis le moteur se coupe, puis un virage sur la glace : on ne peut plus rattraper avec les gaz. | [`?scenario=figure&f=glace-coupe-virage`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=glace-coupe-virage) |

**Cuves**

| Figure | Variantes | Ce qu'elle demande | Essayer |
|---|---|---|---|
| Cuve (`cuve-droite`) | 2 | Un demi-tube : monter sur les parois pour garder la vitesse. | [`?scenario=figure&f=cuve-droite`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=cuve-droite) |
| Mur latéral (`mur-lateral`) | 2 | Une paroi d'un seul côté de la route. | [`?scenario=figure&f=mur-lateral`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=mur-lateral) |
| Virage en cuve (`virage-cuve`) | 2 | La paroi extérieure d'un virage se relève : la prendre ou passer par le fond. | [`?scenario=figure&f=virage-cuve`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=virage-cuve) |

**Reliefs**

| Figure | Variantes | Ce qu'elle demande | Essayer |
|---|---|---|---|
| Colline (`colline-douce`) | 5 | Une montée, une crête, une descente de un à trois niveaux. | [`?scenario=figure&f=colline-douce`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=colline-douce) |
| Colline raide (`colline-raide`) | 10 | Des pentes de deux ou trois niveaux : creux, dos d'âne, plateau surélevé. | [`?scenario=figure&f=colline-raide`](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?scenario=figure&f=colline-raide) |


## Cinq circuits du jour (un par thème)

| Date | Thème | Auteur | Blocs | Figures |
|---|---|---|---|---|
| [2026-10-21](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?seed=2026-10-21) | Stade | 37,0 s | 47 | plaque-virage · turbo-courbe · descente-cuve-saut · coupe-virage · virage-descente |
| [2026-11-12](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?seed=2026-11-12) | Rallye | 34,3 s | 40 | descente-plaque · pincement · saut-terre · esse-relevee · virage-descente |
| [2026-11-08](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?seed=2026-11-08) | Banquise | 37,4 s | 33 | plaque-virage · slalom-glace · virage-descente · chicane-glace · colline-raide |
| [2026-10-18](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?seed=2026-10-18) | Nuit | 36,8 s | 46 | turbo-epingle · s-serre-large · saut-paroi · coupe-virage · virage-descente |
| [2026-10-16](https://nathan-te.github.io/DailyTrack/b/lot-20-figures/?seed=2026-10-16) | Campagne | 39,8 s | 48 | changement-revetement · virage-descente · pincement · colline-raide · chaine-turbo · etranglement-terre |

## Mesures (`npm run measure:generator`, 60 dates depuis le 06/10/2026 ; `RHYTHM=1` ajoute le rythme par figure)

| | Avant (lot 19) | Après |
|---|---|---|
| Figures par circuit | — (créneaux) | 5,0 (5 à 6) |
| Figures utilisées sur 60 dates | — | **33 / 40** |
| Figure répétée dans un circuit | — | **0** |
| Techniques par circuit | — | 2,5 (**min 2**) |
| Figures en commun, jours consécutifs | — | **0,98 en moyenne** (max 3) |
| Part du temps à plein gaz | **79 %** | **82 %** ⚠ |
| — par thème (Stade, Rallye, Banquise, Nuit, Campagne) | 79, 85, 68, 86, 80 | 88, 85, 71, 84, 80 |
| Freinages ou relâchements par circuit | 9,7 | 10,3 |
| Plus longue droite ordinaire | 5 blocs | 6 blocs (plafond) |
| Virages serrés par circuit | 0,3 (max 2) | 1,1 (max 2, jamais deux de suite) |
| Temps d'auteur | 35,9 s (30,2–40,0) | 37,5 s (dans la fenêtre : 60 / 60) |
| Génération d'un jour (moyenne · max) | 218 ms · 751 ms | **187 ms** · 868 ms |
| Circuits de secours | 0 | 0 |

Taux de validation par thème (12 dates × 6 tentatives, thème forcé) — « dans la fenêtre » :

| Thème | Avant | Après |
|---|---|---|
| Stade | 50 % | 75 % |
| Rallye | 45 % | 67 % |
| Banquise | 41 % | 37 % |
| Nuit | 55 % | 70 % |
| Campagne | 50 % | 69 % |

(*Banquise* reste le thème où la glace allonge les circuits ; la génération y tient quand même, 1,1 tentative en moyenne sur les 60 dates.)

Catégories (moyenne par circuit) : technique 2,5 · saut 0,7 · rapide 1,1 · combinaison 0,2 · cuve 0,1 · relief 0,6. Les sauts et les cuves restent au niveau des thèmes (Stade et Nuit : 100 %, Rallye : sauts, Banquise : 1 saut et 4 cuves sur 14).

## Critères d'arrêt

- ✅ Tests verts (604 unitaires ; e2e : 117 verts, `perf.spec` relevé de 7 ko pour la bibliothèque ; `cuves.spec` est instable quand la machine est chargée — il passe seul).
- ✅ Au moins 20 figures utilisées sur 60 dates (33) · ✅ aucune figure répétée · ✅ au moins deux techniques par circuit · ✅ figures en commun ≤ 2 en moyenne (0,98) · ✅ validation par thème et temps de génération au moins aussi bons qu'avant (sauf Banquise : 37 % contre 41 % ; génération plus rapide en moyenne).
- ❌ **Part du temps à plein gaz « en baisse nette » : non tenue** (79 % → 82 %).

### Pourquoi le plein gaz n'a pas baissé, et ce qui n'y change rien

Le pilote lâche le gaz sur quatre choses : un virage dont la limite est sous la pointe (un virage large à 48 m/s : 0,3 à 0,5 s ; un serré : 1,2 s), la glace (roue libre), un freinage après un super turbo ou une plaque, et le moteur coupé. Un saut, une cuve ou une colline se prennent à plein gaz (0,1 à 0,3 s hors gaz par passage). Or Stade et Nuit doivent déjà loger un saut et une cuve (≈ 8 à 10 s de plein gaz sur 37), et cinq figures de 7 s remplissent la fenêtre. Essayé sans effet de plus de 2 points : figures « riches » tirées deux fois plus souvent, huit tirages dont on garde le plus riche (c'est ce qui est livré), virages larges relevés, zones de revêtement posées sur les virages, un virage derrière chaque saut ou cuve, trois techniques obligatoires. Un second freinage franc obligatoire fait descendre le plein gaz de Stade à 38 % **mais** sort la moitié des circuits de la fenêtre 30–40 s (7 circuits de secours sur 40). Leviers qui restent, à décider avec Nathan (ils touchent le pilote ou une règle de jeu, pas la composition) : un troisième virage serré par circuit, de la glace ou de la terre dans plus de thèmes, la vitesse visée du pilote en ligne droite (68 m/s : il freine au-delà, d'où des « lâchers » après chaque turbo), une mesure qui ne compte que les moments où le joueur a un choix.

## Limites et décisions

- `saut-cuve` (réception juste devant une cuve) se prend toujours sur le fond : le pilote ne monte pas sur la paroi après un saut ; il est rare à dessein pour que la paroi reste la ligne rapide de la majorité des cuves (`cuves-rapides.test.ts`).
- Un saut puis un virage veut deux droites de plus (le pilote ne freine pas de la rampe à la réception plus un bloc).
- Sept figures sur 40 (`epingle-terre`, `saut-releve`, `saut-niveau-epingle`, `double-saut`, `turbo-saut-releve`, `glace-coupe-virage`, `mur-lateral`) n'apparaissent pas sur ces 60 dates : elles dépendent du thème, du repos et des huit tirages ; essayez-les par `?scenario=figure&f=…`.
- La durée estimée (`estimateSeconds`) et le champ `off` de chaque figure sont **mesurés** : à refaire (`RHYTHM=1 npm run measure:generator`) si la physique ou le pilote changent.
