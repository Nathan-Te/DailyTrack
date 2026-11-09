# Track — les thèmes et les blocs du jeu

État du code à la fin du lot 58 : **générateur v22**, simulation v14. Relevé dans le code (`themes.ts`, `themesVersion.ts`, `figures.ts`, `track.ts`), pas recopié de mémoire : à refaire si le générateur change (une nouvelle version, un thème, une figure).

Un circuit du jour = 5 à 7 **figures** (de courtes suites de blocs avec une intention) posées à la suite, sur le **thème** du jour (sac de thèmes : jamais deux jours de suite le même), validé par le pilote automatique (30–40 s). Le thème décide des figures (favorites, vedettes, interdites, familles nouvelles), des revêtements, des largeurs, du relief et des bas-côtés.

## 1. Les thèmes

| thème | rythme dominant | signature | largeurs (étroite · normale · large) | bas-côté | revêtements | sauts | cuves | super turbo | relevés | sans rebords | bosses |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| **Stade** | rapide | Turbo puis grande courbe relevée (`turbo-courbe`) | 1 · 3 · 6 | herbe (85 %) | route seule | 100 % | 100 % | 30 % | 50 % | 0 % | — |
| **Rallye** | aérien | Saut sur la terre (`saut-terre`) | 6 · 3 · 1 | gravier (75 %) | terre ×1 (3–4 zones) | 60 % | 0 % | 0 % | 10 % | 0 % | 1–2 séries |
| **Banquise** | mixte | Chicane sur la glace (`chicane-glace`) | 1 · 3 · 5 | neige (70 %) | glace ×3, terre ×1 (2–3 zones) | 35 % | 25 % | 0 % | 15 % | 0 % | — |
| **Nuit** | aérien | Moteur coupé avant un virage (`coupe-virage`) | 3 · 4 · 3 | vide (30 %) | route seule | 100 % | 100 % | 25 % | 20 % | 70 % | — |
| **Campagne** | technique | Étranglement et virage sur terre (`etranglement-terre`) | 6 · 3 · 1 | herbe (75 %) | herbe de course ×3, terre ×1 (2–3 zones) | 40 % | 0 % | 0 % | 10 % | 0 % | — |
| **Canyon** | technique | Paroi rocheuse et long saut (`paroi-long-saut`) | 3 · 4 · 3 | sable (80 %) | sable ×1 (2–3 zones) | 100 % | 85 % | 25 % | 20 % | 35 % | — |
| **Col alpin** | vertical | Descente en lacets (`lacets`) | 2 · 5 · 3 | neige (60 %) | glace ×1 (0–2 zones) | 25 % | 0 % | 15 % | 30 % | 80 % | — |
| **Ville** | technique | Chicane d'angles droits (`chicane-angles`) | 5 · 5 · 0 | aucun | route seule | 30 % | 0 % | 20 % | 0 % | 0 % | — |

Pourcentages : la chance qu'un circuit du thème en ait (sauts, cuves, sections sans rebords), ou qu'un virage ordinaire soit relevé / qu'un super turbo soit posé. Largeurs : poids du tirage.

### Stade
- **Tracé** : 60 % des virages larges deviennent amples ; relief : 1–3 collines, 60 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Tremplin en sortie de relevé (`tremplin-releve`), Réception dans un virage (`reception-virage`), Chicane avant le tremplin (`chicane-tremplin`), Turbo, saut, virage relevé (`turbo-saut-releve`).
- **Blocs nouveaux du lot 58** (un par circuit, à tour de rôle) : Direction bloquée (`effet-direction`), Freins coupés (`effet-freins`), Régulateur (`effet-regulateur`), Route bombée (`route-bombee`), Virages relevés à 45° (`releve-fort`), Mur roulable (`mur-roulable`).
- **Favorites** (poids ×4) : Turbo puis grande courbe relevée (`turbo-courbe`), Saut vers un virage relevé (`saut-releve`), Saut en sortie de paroi (`saut-paroi`), Saut et virage (`saut-virage`), Descente, cuve, saut (`descente-cuve-saut`), Plaque puis virage (`plaque-virage`), Turbos enchaînés (`chaine-turbo`), Relevé puis plat inverse (`releve-contre`), S relevé (`esse-relevee`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Épingle large sur terre (`epingle-terre`), Étranglement et virage sur terre (`etranglement-terre`), Saut sur la terre (`saut-terre`), Changement de revêtement (`changement-revetement`).

### Rallye
- **Tracé** : ligne droite libre de 3 blocs au plus ; les virages changent de sens ; relief : 2–3 collines, 50 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Bosses en série sur la terre (`bosses-terre`), Demi-tour qui change de revêtement (`demi-tour-mixte`), Saut à l'élan, en sortie de virage (`saut-sortie-virage`).
- **Toujours une de** : Épingle large sur terre (`epingle-terre`), Demi-tour large (`demi-tour-large`).
- **Blocs nouveaux du lot 58** (un circuit sur deux) : Voiture fragile (`effet-fragile`).
- **Favorites** (poids ×4) : Saut sur la terre (`saut-terre`), Épingle large sur terre (`epingle-terre`), Demi-tour large (`demi-tour-large`), Changement de revêtement (`changement-revetement`), Saut (`saut-simple`), Virage aveugle en haut d'une montée (`virage-aveugle`), Crête puis virage (`crete-virage`), Plaque en haut d'une descente (`descente-plaque`), Virage en descente (`virage-descente`), Slalom (`slalom-route`), S serré-large (`s-serre-large`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Cuve (`cuve-droite`), Mur latéral (`mur-lateral`), Virage en cuve (`virage-cuve`), Saut dans une cuve (`saut-cuve`), Descente, cuve, saut (`descente-cuve-saut`), Saut en sortie de paroi (`saut-paroi`), Turbos enchaînés (`chaine-turbo`), Turbo puis épingle (`turbo-epingle`), Turbo puis grande courbe relevée (`turbo-courbe`), Turbo, saut, virage relevé (`turbo-saut-releve`).

### Banquise
- **Tracé** : 40 % des virages larges deviennent amples ; 1 virage serré au plus ; relief : 1–2 collines, 10 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Saut vers la glace (`saut-glace`), Demi-tour qui passe sur la glace (`demi-tour-glace`), Slalom de glace (`slalom-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Tube de glace (`tube-glace`).
- **Blocs nouveaux du lot 58** : en vedette : Tube de glace (`tube-glace`).
- **Favorites** (poids ×4) : Chicane sur la glace (`chicane-glace`), Changement de revêtement (`changement-revetement`), S relevé (`esse-relevee`), Demi-tour large (`demi-tour-large`), Rétrécissement et virage (`pincement`), Slalom (`slalom-route`).
- **Jamais** : Étranglement et virage sur terre (`etranglement-terre`), Saut sur la terre (`saut-terre`), Turbos enchaînés (`chaine-turbo`), Turbo puis épingle (`turbo-epingle`), Turbo puis grande courbe relevée (`turbo-courbe`), Turbo, saut, virage relevé (`turbo-saut-releve`).

### Nuit
- **Tracé** : relief : 2–3 collines, 60 % raides ; moteur coupé possible.
- **Vedettes** (une par circuit, à tour de rôle) : Fil du rasoir (`fil-du-rasoir`), Tremplin en sortie de relevé (`tremplin-releve`), Réception dans un virage (`reception-virage`).
- **Blocs nouveaux du lot 58** (un par circuit, à tour de rôle) : Route bombée (`route-bombee`), Direction bloquée (`effet-direction`).
- **Favorites** (poids ×4) : Descente, cuve, saut (`descente-cuve-saut`), Saut en sortie de paroi (`saut-paroi`), Moteur coupé avant un virage (`coupe-virage`), Saut et virage (`saut-virage`), Double saut (`double-saut`), Virage aveugle en haut d'une montée (`virage-aveugle`), Virage en descente (`virage-descente`), Turbo puis épingle (`turbo-epingle`), Plaque puis épingle (`plaque-epingle`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Épingle large sur terre (`epingle-terre`), Étranglement et virage sur terre (`etranglement-terre`), Saut sur la terre (`saut-terre`), Changement de revêtement (`changement-revetement`).

### Campagne
- **Tracé** : relief : 3–4 collines, 10 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Demi-tour qui change de revêtement (`demi-tour-mixte`), Saut à l'élan, en sortie de virage (`saut-sortie-virage`), Ligne droite d'herbe (`droite-herbe`), Virage ample en herbe (`ample-herbe`).
- **Toujours une de** : Crête puis virage (`crete-virage`), Virage aveugle en haut d'une montée (`virage-aveugle`).
- **Et toujours une de** : Virage ample en herbe (`ample-herbe`), Chicane herbe-route (`chicane-herbe`), Ligne droite d'herbe (`droite-herbe`).
- **Blocs nouveaux du lot 58** : aucun.
- **Favorites** (poids ×4) : Étranglement et virage sur terre (`etranglement-terre`), Épingle large sur terre (`epingle-terre`), Changement de revêtement (`changement-revetement`), Virage aveugle en haut d'une montée (`virage-aveugle`), Crête puis virage (`crete-virage`), Virage en descente (`virage-descente`), Gros freinage (`freinage-epingle`), Rétrécissement et virage (`pincement`), Chicane herbe-route (`chicane-herbe`), Colline (`colline-douce`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Cuve (`cuve-droite`), Mur latéral (`mur-lateral`), Virage en cuve (`virage-cuve`), Saut dans une cuve (`saut-cuve`), Descente, cuve, saut (`descente-cuve-saut`), Saut en sortie de paroi (`saut-paroi`), Turbos enchaînés (`chaine-turbo`), Turbo puis épingle (`turbo-epingle`), Turbo puis grande courbe relevée (`turbo-courbe`), Turbo, saut, virage relevé (`turbo-saut-releve`).

### Canyon
- **Tracé** : ligne droite libre de 3 blocs au plus ; 100 % des virages larges deviennent serrés ; 4 virages serrés au plus ; relief : 1–3 collines, 90 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Saut de la falaise (`saut-falaise`), Réception dans un virage (`reception-virage`), Saut à l'élan, en sortie de virage (`saut-sortie-virage`).
- **Blocs nouveaux du lot 58** (un par circuit, à tour de rôle) : Freins coupés (`effet-freins`), Virages relevés à 45° (`releve-fort`).
- **Favorites** (poids ×4) : Paroi rocheuse et long saut (`paroi-long-saut`), Demi-tour large (`demi-tour-large`), Crête puis virage (`crete-virage`), Virage aveugle en haut d'une montée (`virage-aveugle`), Colline raide (`colline-raide`), Virage en descente (`virage-descente`), S relevé (`esse-relevee`), Relevé puis plat inverse (`releve-contre`), S serré-large (`s-serre-large`), Rétrécissement et virage (`pincement`), Chicane d'angles droits (`chicane-angles`).
- **Tire aussi** (propres à un autre thème) : Chicane d'angles droits (`chicane-angles`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Épingle large sur terre (`epingle-terre`), Étranglement et virage sur terre (`etranglement-terre`), Saut sur la terre (`saut-terre`), Changement de revêtement (`changement-revetement`), Cuve (`cuve-droite`).

### Col alpin
- **Tracé** : 100 % des droites deviennent des pentes ; relief : 3–4 collines, 85 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Virages relevés en descente (`devers-descente`), Demi-tour qui passe sur la glace (`demi-tour-glace`), Saut vers la glace (`saut-glace`).
- **Blocs nouveaux du lot 58** : aucun.
- **Favorites** (poids ×4) : Descente en lacets (`lacets`), Demi-tour large (`demi-tour-large`), Virage en descente (`virage-descente`), Plaque en haut d'une descente (`descente-plaque`), Colline raide (`colline-raide`), Relevé puis plat inverse (`releve-contre`), S relevé (`esse-relevee`), Plaque puis épingle (`plaque-epingle`), Gros freinage (`freinage-epingle`), Virage aveugle en haut d'une montée (`virage-aveugle`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Épingle large sur terre (`epingle-terre`), Étranglement et virage sur terre (`etranglement-terre`), Saut sur la terre (`saut-terre`), Changement de revêtement (`changement-revetement`), Cuve (`cuve-droite`), Mur latéral (`mur-lateral`), Virage en cuve (`virage-cuve`), Saut dans une cuve (`saut-cuve`), Descente, cuve, saut (`descente-cuve-saut`), Saut en sortie de paroi (`saut-paroi`).

### Ville
- **Tracé** : ligne droite libre de 4 blocs au plus ; 40 % des virages larges deviennent serrés ; 4 virages serrés au plus ; relief : 1–2 collines, 30 % raides.
- **Vedettes** (une par circuit, à tour de rôle) : Rues en escalier (`rues-en-escalier`), Chicane avant le tremplin (`chicane-tremplin`), Slalom (`slalom-route`), Demi-tour urbain (`u-urbain`).
- **Toujours une de** : Demi-tour urbain (`u-urbain`), Gros freinage (`freinage-epingle`), Plaque puis épingle (`plaque-epingle`), Turbo puis épingle (`turbo-epingle`), S serré-large (`s-serre-large`).
- **Blocs nouveaux du lot 58** (un par circuit, à tour de rôle) : Régulateur (`effet-regulateur`), Direction bloquée (`effet-direction`).
- **Favorites** (poids ×4) : Chicane d'angles droits (`chicane-angles`), Gros freinage (`freinage-epingle`), Plaque puis épingle (`plaque-epingle`), Turbo puis épingle (`turbo-epingle`), S serré-large (`s-serre-large`), Rétrécissement et virage (`pincement`), Virage en descente (`virage-descente`).
- **Jamais** : Slalom de glace (`slalom-glace`), Chicane sur la glace (`chicane-glace`), Glace, moteur coupé, virage (`glace-coupe-virage`), Épingle large sur terre (`epingle-terre`), Étranglement et virage sur terre (`etranglement-terre`), Saut sur la terre (`saut-terre`), Changement de revêtement (`changement-revetement`), Cuve (`cuve-droite`), Mur latéral (`mur-lateral`), Virage en cuve (`virage-cuve`), Saut dans une cuve (`saut-cuve`), Descente, cuve, saut (`descente-cuve-saut`), Saut en sortie de paroi (`saut-paroi`), Saut vers une section étroite (`saut-etroit`).

## 2. Les blocs (la notation des circuits)

Un circuit s'écrit bloc par bloc : `LETTRE[/modificateurs][@repère]`, une cellule de 32 m par bloc (un virage large en couvre 2 × 2, un ample 3 × 3).

### Formes
| lettre | bloc | ce qu'il fait |
|---|---|---|
| `S` | droite | ligne droite (32 m) |
| `L / R` | virage serré | une cellule, 16 m de rayon ; jamais sur la route large, jamais deux de suite |
| `L2 / R2` | virage large | 2 × 2 cellules |
| `L3 / R3` | virage ample | 3 × 3 cellules, se prend vite |
| `U / D` | montée / descente | un niveau (4 m) ; `U2` `U3` `D2` `D3` : 2 ou 3 niveaux |
| `B` | bosse | une bosse sur la droite |
| `J` | rampe de saut | tremplin en ligne droite |
| `K` | appel | le bord d'où l'on saute, avant un vide |
| `G` | vide | le saut lui-même ; `GU` réception un niveau plus haut, `GD` / `GD2` un ou deux niveaux plus bas |
| `P` | plaque de vitesse | pousse la voiture (≈ 66 m/s) |
| `T` | super turbo | pousse plus fort (plus de 70 m/s) |
| `C` | moteur coupé | plus de gaz jusqu'au point de contrôle suivant |
| `V` | cuve droite | demi-tube : parois des deux côtés |
| `ML / MR` | mur latéral | une paroi à gauche / à droite |

### Blocs à effet (lot 58)
Une bande peinte en travers de la route, sous un portique de sa couleur avec son nom : l'effet commence à la bande, s'annonce au milieu de l'écran, et le HUD dit le temps qui reste. Un seul effet à la fois ; un point de contrôle, l'arrivée ou une reprise l'éteignent aussi.
| lettre | effet | durée | couleur |
|---|---|---:|---|
| `Ed` | direction bloquée : le volant ne répond plus | 1,5 s | violet |
| `Ef` | freins coupés : ni frein, ni marche arrière, ni « figer » en l'air | 3 s | cyan |
| `Er` | régulateur : la vitesse d'entrée est tenue, gaz et frein sans effet | 4 s | bleu |
| `Ex` | voiture fragile : une réception brutale ou de travers, ou un rebord pris de face, la casse (retour au point de contrôle) | 8 s | rose |
| `E0` | remise à zéro : éteint l'effet (et le moteur coupé) | — | crème |

### Modificateurs (après `/`)
| modificateur | ce qu'il fait |
|---|---|
| `t · g · h · s · z` | revêtement : terre, glace, herbe, sable, herbe de course |
| `q` | glace de piste (lot 58, le tube de glace) : glisse comme la glace mais tient la paroi d'une cuve |
| `e · n · l` | largeur : étroite (14 m), normale (20 m), large (26 m) ; `n>l` : transition en un bloc droit |
| `b` | virage relevé |
| `f` | virage relevé à 45° (lot 58, virage ample seulement) |
| `c` | virage en cuve (son mur extérieur) |
| `m` | mur roulable (lot 58, sur `ML` / `MR`) : le fond disparaît, on roule sur la paroi |
| `a` | route bombée (lot 58) : chaussée arrondie, sans rebords ; naît et meurt sur une droite |
| `o` | sans rebords |
| `u` | tôle ondulée |
| `i · j` | dévers d'une droite vers la gauche / la droite (lot 57) |
| `+ · -` | virage en montée / en descente (lot 57) |
| `k` | virage-tremplin (lot 57) |
| `~h ~t ~p ~s ~v` | bas-côté : herbe, gravier, neige, sable, vide (`~r` : retour aux rebords) |

Repères : `@start` départ, `@cp` point de contrôle, `@finish` arrivée.

## 3. Les figures du générateur

67 figures. **Thèmes** : « tous » sauf mention (une figure propre à des thèmes ne sort que chez eux) ; les interdits de chaque thème sont au § 1. **Depuis** : la première version du générateur qui la tire (sans mention : depuis toujours).

### Techniques (32)
| figure | ce qu'on y fait | thèmes | depuis |
|---|---|---|---|
| **S serré-large** `s-serre-large` | Un virage serré tout de suite suivi d'un large en sens inverse (ou l'inverse) : placer la voiture pour la sortie. | tous | — |
| **Rétrécissement et virage** `pincement` | La route se resserre jusqu'à 14 m, puis un virage serré au bout de la ligne droite étroite. | tous | — |
| **Relevé puis plat inverse** `releve-contre` | Un virage relevé pris à fond enchaîné sur un virage plat dans l'autre sens : la pente rejette vers l'extérieur. | tous | — |
| **Épingle large sur terre** `epingle-terre` | Un demi-tour large sur la terre : freiner tôt, tourner sans glisser. | tous | — |
| **Slalom de glace** `slalom-glace` | Des S larges sur la glace, en roue libre : alterner gauche et droite sans gaz pour garder la voiture. | tous | — |
| **Moteur coupé avant un virage** `coupe-virage` | Le moteur se coupe : vivre sur son élan, puis tourner sans pouvoir accélérer jusqu'au prochain point de contrôle. | tous | — |
| **Changement de revêtement** `changement-revetement` | Deux virages enchaînés qui changent de revêtement au milieu : l'adhérence n'est plus la même à la sortie. | tous | — |
| **Virage en descente** `virage-descente` | On prend de la vitesse dans la pente et le virage arrive au bas : freiner dans la descente. | tous | — |
| **Virage aveugle en haut d'une montée** `virage-aveugle` | On monte, et le virage est juste derrière la crête : on ne le voit qu'une fois en haut. | tous | — |
| **Crête puis virage** `crete-virage` | Un dos d'âne fait décoller, la réception est suivie d'un virage : on ne freine pas en l'air. | tous | — |
| **S relevé** `esse-relevee` | Deux virages relevés dans des sens opposés : la pente change de côté au milieu. | tous | — |
| **Demi-tour large** `demi-tour-large` | Deux virages larges dans le même sens : un demi-tour à prendre sur la corde. | tous | — |
| **Étranglement et virage sur terre** `etranglement-terre` | La route se resserre sur la terre, puis un virage serré au bout de la ligne droite étroite. | tous | — |
| **Chicane sur la glace** `chicane-glace` | Une chicane large sur la glace, après une ligne droite verglacée. | tous | — |
| **Gros freinage** `freinage-epingle` | Une longue droite, puis un virage serré : freiner le plus tard possible. | tous | — |
| **Slalom** `slalom-route` | Trois ou quatre virages larges qui alternent : le rythme se tient en sortie de chacun. | tous | — |
| **Plaque puis épingle** `plaque-epingle` | Une plaque pousse à 66 m/s, trois lignes droites, puis un virage serré : le frein, pas le courage. | tous | — |
| **Chicane d'angles droits** `chicane-angles` | Des angles droits qui se suivent, une ligne droite entre chacun : freiner, tourner, relancer. | Ville | — |
| **Demi-tour urbain** `u-urbain` | Deux angles droits dans le même sens, une ligne droite entre eux : un demi-tour entre deux rangées de murs. | Ville | — |
| **Virage ample en herbe** `ample-herbe` | Un virage ample sur l'herbe de course, entre deux lignes droites d'herbe : y entrer bien placé et le tenir d'un seul geste du volant (chaque correction coûte). | Campagne | v17 |
| **Chicane herbe-route** `chicane-herbe` | Un S large qui passe de la route à l'herbe de course (ou l'inverse) entre ses deux virages : l'adhérence change en pleine corde. | Campagne | v17 |
| **Ligne droite d'herbe** `droite-herbe` | Une ligne droite d'herbe de course entre deux virages larges : garder l'élan sur l'herbe, se placer pour le second virage. | Campagne | v17 |
| **Bosses en série sur la terre** `bosses-terre` | Des bosses de terre en série : garder la voiture droite pour tourner après. | Rallye | v18 |
| **Demi-tour qui change de revêtement** `demi-tour-mixte` | Un demi-tour large, moitié route moitié terre : l'adhérence change en plein virage. | Rallye, Campagne | v18 |
| **Demi-tour qui passe sur la glace** `demi-tour-glace` | Un demi-tour large, moitié route moitié glace : lâcher les gaz sur la glace. | Banquise, Col alpin | v18 |
| **Rues en escalier** `rues-en-escalier` | Un angle, une pente, un angle : la ville descend d'un niveau à chaque rue. | Ville | v18 |
| **Fil du rasoir** `fil-du-rasoir` | 14 m sans rebords, un virage large au milieu : la précision, pas la vitesse. | Nuit | v18 |
| **Virages relevés en descente** `devers-descente` | Des virages relevés dans la descente : la pente pousse, le dévers retient. | Col alpin | v18 |
| **Direction bloquée** `effet-direction` — *bloc nouveau* | Sortir aligné du virage avant le portique violet : le volant ne répond plus 1,5 s, puis la remise à zéro le rend avant le virage suivant. | Stade, Nuit, Ville | v22 |
| **Freins coupés** `effet-freins` — *bloc nouveau* | Freins coupés 3 s : lever le pied tôt pour le virage large qui suit, puis la remise à zéro. | Stade, Canyon | v22 |
| **Régulateur** `effet-regulateur` — *bloc nouveau* | Le régulateur tient 4 s la vitesse d'entrée, gaz et frein sans effet : on ne fait que tourner, puis la remise à zéro. | Stade, Ville | v22 |
| **Route bombée** `route-bombee` — *bloc nouveau* | Une chaussée arrondie sans rebords : rester sur le sommet, les côtés font glisser vers le vide. | Nuit, Stade | v22 |

### Sauts (18)
| figure | ce qu'on y fait | thèmes | depuis |
|---|---|---|---|
| **Paroi rocheuse et long saut** `paroi-long-saut` | Le mur latéral donne de l'élan, une plaque ou un super turbo le complète, puis la rampe lance la voiture au-dessus du ravin. | Canyon | — |
| **Saut à l'élan, en sortie de virage** `saut-sortie-virage` | Pas de plaque : la vitesse gardée dans le virage d'avant fait passer le vide. | tous | v18 |
| **Tremplin en sortie de relevé** `tremplin-releve` | On décolle en sortie de relevé, en train de tourner : se redresser ou figer la caisse. | tous | v18 |
| **Chicane avant le tremplin** `chicane-tremplin` | Une chicane juste avant la rampe : vite pour le vide, droit sur la rampe. | tous | v18 |
| **Réception dans un virage** `reception-virage` | On retombe au début d'un virage ample : pas trop vite, tourner dès qu'on touche. | tous | v18 |
| **Saut vers la glace** `saut-glace` | On retombe sur la glace : la réception glisse, le virage se prend en roue libre. | Banquise, Col alpin | v18 |
| **Saut de la falaise** `saut-falaise` | Deux cellules de vide, réception deux niveaux plus bas, après une plaque. | Canyon | v18 |
| **Saut** `saut-simple` | Rampe, vide, réception : prendre assez de vitesse au bord (du saut court au saut vers le haut), puis un virage large derrière. | tous | — |
| **Saut sur la terre** `saut-terre` | Une rampe de terre, un vide, une réception de terre. | tous | — |
| **Saut et virage** `saut-virage` | La réception est suivie de près d'un virage : on ne freine pas en l'air, tout se règle dès qu'on touche. | tous | — |
| **Saut vers un virage relevé** `saut-releve` | On retombe, puis un virage relevé : la pente aide à tourner si la vitesse est bonne. | tous | — |
| **Saut dans une cuve** `saut-cuve` | La réception se fait à l'entrée d'une cuve : la paroi se relève devant la voiture. | tous | — |
| **Saut vers une section étroite** `saut-etroit` | On saute depuis une route large et on retombe sur une route qui se resserre. | tous | — |
| **Saut de niveau vers une épingle** `saut-niveau-epingle` | On retombe deux niveaux plus bas, avec une épingle large juste derrière : réception et freinage. | tous | — |
| **Plaque à la réception** `saut-plaque` | Une plaque d'accélération juste après la réception : la voiture repart plus vite qu'elle n'est tombée. | tous | — |
| **Double saut** `double-saut` | Deux vides à la suite, avec une courte réception entre les deux. | tous | — |
| **Saut en sortie de paroi** `saut-paroi` | Le mur latéral donne de la vitesse, et le saut part tout de suite après : sortir de la paroi bien aligné. | tous | — |
| **Voiture fragile** `effet-fragile` — *bloc nouveau* | Voiture fragile : un saut et des bosses à poser bien à plat (une réception brutale la casse), puis la remise à zéro. | Rallye | v22 |

### Portions rapides (5)
| figure | ce qu'on y fait | thèmes | depuis |
|---|---|---|---|
| **Turbos enchaînés** `chaine-turbo` | Deux super turbos à trois blocs d'écart : le second prolonge le premier, puis un virage large, serré ou un S large au bout des cinq droites : freiner de plus de 80 m/s. | tous | — |
| **Plaque en haut d'une descente** `descente-plaque` | Une plaque au sommet d'une longue descente de six blocs. | tous | — |
| **Turbo puis grande courbe relevée** `turbo-courbe` | Un super turbo, puis une grande courbe relevée prise à fond (ou, dans une variante, un virage large à plat : il faut freiner). | tous | — |
| **Plaque puis virage** `plaque-virage` | Une plaque pousse à 66 m/s, deux lignes droites, puis un virage large (ou un S large) : le frein tout de suite. | tous | — |
| **Virages relevés à 45°** `releve-fort` — *bloc nouveau* | Des virages amples relevés à 45°, pris à fond, plaqué contre la pente. | Stade, Canyon | v22 |

### Combinaisons (4)
| figure | ce qu'on y fait | thèmes | depuis |
|---|---|---|---|
| **Turbo, saut, virage relevé** `turbo-saut-releve` | Un super turbo lance un long saut, et la réception est suivie d'un virage relevé. | tous | — |
| **Descente, cuve, saut** `descente-cuve-saut` | On descend, on remonte la paroi d'une cuve, et le saut part de la sortie. | tous | — |
| **Turbo puis épingle** `turbo-epingle` | Un super turbo, cinq lignes droites, puis un virage serré : on arrive à plus de 70 m/s sur un virage de 16 m de rayon. | tous | — |
| **Glace, moteur coupé, virage** `glace-coupe-virage` | De la glace, puis le moteur se coupe, puis un virage sur la glace : on ne peut plus rattraper avec les gaz. | tous | — |

### Cuves et murs (5)
| figure | ce qu'on y fait | thèmes | depuis |
|---|---|---|---|
| **Cuve** `cuve-droite` | Un demi-tube : monter sur les parois pour garder la vitesse. | tous | — |
| **Mur latéral** `mur-lateral` | Une paroi d'un seul côté de la route. | tous | — |
| **Virage en cuve** `virage-cuve` | La paroi extérieure d'un virage se relève : la prendre ou passer par le fond. | tous | — |
| **Tube de glace** `tube-glace` — *bloc nouveau* | Façon bobsleigh : des cuves de glace de piste, on monte sur la paroi extérieure des virages. | Banquise | v22 |
| **Mur roulable** `mur-roulable` — *bloc nouveau* | Monter sur la paroi avant que le fond disparaisse, la longer sans descendre, redescendre à la fin. | Stade | v22 |

### Relief (3)
| figure | ce qu'on y fait | thèmes | depuis |
|---|---|---|---|
| **Descente en lacets** `lacets` | La route descend en lacets : virages larges et demi-tours qui se suivent, avec la pente qui pousse dans chaque entrée. | Col alpin | — |
| **Colline** `colline-douce` | Une montée, une crête, une descente de un à trois niveaux. | tous | — |
| **Colline raide** `colline-raide` | Des pentes de deux ou trois niveaux : creux, dos d'âne, plateau surélevé. | tous | — |

## 4. Hors du générateur

- **Prototypes du lot 58** (`?scenario=bloc-<nom>`, page `?scenario=blocs`) : Direction bloquée (`bloc-direction`), Freins coupés (`bloc-freins`), Régulateur (`bloc-regulateur`), Voiture fragile (`bloc-fragile`), Remise à zéro (`bloc-remise`), Route bombée (`bloc-bombee`), Virage relevé à 45° (`bloc-releve-fort`), Tube de glace (`bloc-tube`), Mur roulable (`bloc-mur`). Ce que le générateur en tire est au § 3 (figures « bloc nouveau »).
- **Grammaire des sauts et des transitions du lot 57** (`?scenario=saut-<nom>`, `transition-<nom>`, page `?scenario=sauts`) — prototypes, **pas encore dans le générateur** : Saut en biais (`saut-biais`), Réception en angle (`saut-angle`), Saut dans un virage (`saut-courbe`), Réception dans un virage relevé (`saut-reception-relevee`), Saut en contrebas, à l'élan (`saut-drop`), Saut vers plus haut (`saut-step-up`), Saut à l'élan, sans freiner (`saut-elan`), Double saut enchaîné (`saut-double`), Appel sur une crête (`saut-bosse`), Réception sur l'herbe de course (`saut-herbe`), Saut, puis chicane (`saut-chicane`), Crête qui allège (`transition-crete`), Compression au creux (`transition-compression`), Dévers qui naît et meurt (`transition-devers`), Virages en montée et en descente (`transition-pente`), S relevé en descente (`transition-esse`), Rétrécissement sur une crête (`transition-retrecissement`), Changement de revêtement en appui (`transition-appui`).
- **Écartés par Nathan** (retirés du code) : le propulseur, l'eau (lot 58) ; la boucle (lot 58b, mise de côté : commit `a8e6799`).
