# Lot 49 — Fiches d'identité des thèmes (à valider par Nathan)

**Statut : proposition, à discuter.** Rien de ce qui suit n'est encore dans le générateur : les nouveautés existent dans la bibliothèque (`packages/sim/src/figures.ts`, `since: 18`) et se jouent par leur scénario, mais aucun circuit du jour ne les tire tant que les fiches ne sont pas validées (troisième temps du lot).

Comment lire une fiche :
- **Au volant** : ce que le thème doit faire ressentir.
- **Surfaces** : revêtements de la piste et bas-côtés.
- **Figures signatures** : celles qui font le thème, avec leur **poids** proposé (aujourd'hui : signature toujours là, favorites ×4 ; proposé : un poids par figure, et quelques figures « vedettes » tournantes, voir « Variété » en bas).
- **Rythme** : vitesse, enchaînements, part de freinages.
- **Jamais** : ce que le thème ne fait pas (proposé : interdit dans le générateur v18).
- **Mesuré** (avant le lot, 25 circuits par thème à partir du 04/11/2026, générateur v17 ; `IDENTITE=1 npm run measure:generator`, section 5).

Ce que la mesure montre d'abord : **les mêmes figures « génériques » partout**. `plaque-epingle` (28 à 56 % des circuits de chaque thème), `chaine-turbo` (36 à 52 %, **y compris Rallye, Banquise et Campagne, qui n'ont pas de super turbo** : `turboChance` 0 ne règle que le poids, pas l'accès), `turbo-epingle`, `colline-douce`. Elles viennent des règles communes « au moins un freinage franc » et « une portion rapide » (`selectFigures`) : chaque thème les satisfait avec les mêmes figures. Et **52 % des sauts sont « plaque ou turbo puis rampe en ligne droite »** (26 % en sortie de paroi, 23 % à l'élan sur une ligne droite, **0 % en sortie de virage**).

---

## Stade — le terrain de jeu
- **Au volant** : l'arène, pleine vitesse, tout est franc : boosts, grandes courbes relevées prises à fond, sauts nets.
- **Surfaces** : route ; bas-côtés d'herbe (62 % des blocs).
- **Figures signatures** : `turbo-courbe` (signature, toujours), `saut-releve`, `turbo-saut-releve`, `esse-relevee` ×4 ; **nouveautés** : `tremplin-releve` ×4 (on décolle en sortie de relevé), `reception-virage` ×3, `chicane-tremplin` ×2. Le freinage franc : `plaque-virage`, `plaque-epingle`.
- **Rythme** : le plus rapide avec Canyon et Nuit (47,5 m/s de moyenne pour le pilote) ; peu de virages serrés (0,9 par circuit), beaucoup de larges relevés.
- **Jamais** : terre, glace, sable ; épingles d'angle droit à la Ville (au plus un virage serré).
- **Mesuré** : 20 figures différentes en 25 circuits ; 1 saut par circuit, **24 % « boost puis rampe »** (le reste en sortie de paroi : `saut-paroi` 52 %).

## Rallye — la terre
- **Au volant** : la terre qui glisse, des bosses en série, des dérapages, des sauts **sans boost** : l'élan se gagne et se garde.
- **Surfaces** : terre (21 % des blocs, à monter : 30 %), bas-côtés de gravier (66 %), route bosselée.
- **Figures signatures** : `saut-terre` (signature), `epingle-terre` / `demi-tour-large` (règle propre) ; **nouveautés** : `bosses-terre` ×5 (vedette), `demi-tour-mixte` ×4, `saut-sortie-virage` ×4 (à la terre, sans plaque).
- **Rythme** : moyen (45,4 m/s), beaucoup de virages larges (4,6), des freinages longs sur terre.
- **Jamais** : **super turbo** (aujourd'hui `chaine-turbo` dans 44 % des circuits et `turbo-epingle` 24 % : à interdire), glace, cuves, sections sans rebords. Proposé : la portion rapide du Rallye = `descente-plaque` (une plaque, une descente) ; le freinage franc = `plaque-epingle` sur terre ou `descente-plaque`.
- **Mesuré** : 40 % des sauts « boost puis rampe » (le saut de terre de la signature en est un sur deux).

## Banquise — la glisse
- **Au volant** : longues glisses, virages à anticiper en roue libre, la glace qui demande de lâcher les gaz ; sauts sur la glace, réception qui glisse.
- **Surfaces** : glace (13 % des blocs, à monter : 20 %), un peu de terre ; bas-côtés de neige poudreuse (63 %).
- **Figures signatures** : `chicane-glace` (signature), `slalom-glace` ×4, `glace-coupe-virage` ×3 ; **nouveautés** : `saut-glace` ×5 (vedette), `demi-tour-glace` ×4.
- **Rythme** : le plus lent (41,6 m/s), c'est voulu ; beaucoup de virages larges (4,5).
- **Jamais** : **super turbo** (aujourd'hui `chaine-turbo` 52 % des circuits : à interdire), cuves droites ; les sauts restent rares (24 %), et quand il y en a, ils retombent sur la glace.
- **Mesuré** : 23 figures différentes, mais **`pincement` 60 % et `chaine-turbo` 52 %** : ce sont elles, pas la glace, qu'on retrouve d'un jour à l'autre.

## Campagne — l'herbe de course (lot 48)
- **Au volant** : l'herbe de course qu'on tient d'un seul geste, des chemins de terre, des transitions herbe-terre-route, des crêtes.
- **Surfaces** : herbe de course (12 %), terre (12 %), route ; bas-côtés d'herbe haute (64 %).
- **Figures signatures** : `etranglement-terre` (signature), une figure d'herbe toujours (`ample-herbe`, `chicane-herbe`, `droite-herbe`), `crete-virage` / `virage-aveugle` (règle propre) ; **nouveautés** : `demi-tour-mixte` ×4, `saut-sortie-virage` ×3.
- **Rythme** : moyen-lent (43,9 m/s), le plus de virages serrés avec Col et Ville (1,9).
- **Jamais** : **super turbo** (aujourd'hui `chaine-turbo` 48 % et `turbo-epingle` 40 % : à interdire), glace, cuves, sections sans rebords.
- **Mesuré** : la paire la plus semblable des 200 circuits est de Campagne (18/12 et 27/12/2026 : **les mêmes sept figures**, quatre enchaînements en commun, ressemblance 0,75).

## Canyon — le vide
- **Au volant** : grands sauts au-dessus du vide, descentes, **réceptions plus basses que le départ**, parois de roche.
- **Surfaces** : sable en bas-côté (57 %) et en zones (3 %).
- **Figures signatures** : `paroi-long-saut` (signature) ; **nouveautés** : `saut-falaise` ×5 (vedette : deux cellules de vide, réception deux niveaux plus bas), `reception-virage` ×3, `saut-sortie-virage` ×3.
- **Rythme** : le plus rapide (49,1 m/s), peu de virages (1,6 serré, 2,8 larges).
- **Jamais** : terre, glace, cuve droite.
- **Mesuré** : **100 % des sauts « boost puis rampe »** (la signature les fait tous ainsi) — le thème des sauts n'a qu'une sorte de saut.

## Col alpin — la montagne
- **Au volant** : épingles, descentes rapides, **dévers** ; la route sans rebords au-dessus du vide.
- **Surfaces** : route, plaques de glace (2 %) ; bas-côtés de neige (55 %).
- **Figures signatures** : `lacets` (signature) ; **nouveautés** : `devers-descente` ×5 (vedette), `demi-tour-glace` ×2, `saut-glace` ×1 (rare).
- **Rythme** : 44,4 m/s, le plus de virages larges (5,7 par circuit).
- **Jamais** : terre, cuves ; peu de sauts (36 %).
- **Mesuré** : la ressemblance la plus basse dans un même thème (0,147 en moyenne) : les lacets varient déjà ; mais `pincement` (56 %), `freinage-epingle` (56 %), `plaque-epingle` (52 %) reviennent.

## Ville — les rues
- **Au volant** : angles droits, chicanes, rues étroites, **marches** (la ville qui descend d'un niveau à chaque rue).
- **Surfaces** : route seule, rebords partout (murets et garde-corps).
- **Figures signatures** : `chicane-angles` (signature), `u-urbain` et les épingles (règle propre) ; **nouveauté** : `rues-en-escalier` ×5 (vedette), `chicane-tremplin` ×2.
- **Rythme** : 44,6 m/s, **3,9 virages serrés** par circuit (jusqu'à 4 permis), le plus court (35,5 s).
- **Jamais** : bas-côtés, route large, cuves, glace, terre, sable.
- **Mesuré** : `turbo-epingle` 60 %, `plaque-epingle` 56 % — les mêmes épingles qu'ailleurs.

## Nuit — la précision
- **Au volant** : des routes sans rebords, la précision, des virages qu'on devine dans le noir.
- **Surfaces** : route ; vide en bas-côté (15 %), sections sans rebords.
- **Figures signatures** : `coupe-virage` (signature) ; **nouveauté** : `fil-du-rasoir` ×5 (vedette : 14 m sans rebords, un virage au milieu), `tremplin-releve` ×3, `reception-virage` ×2.
- **Rythme** : rapide (47,3 m/s), cuves et sauts toujours.
- **Jamais** : terre, glace, sable.
- **Mesuré** : la ressemblance la plus haute dans un même thème (0,247) et entre thèmes (Stade ↔ Nuit : 0,66 pour la pire paire) : `saut-cuve`, `saut-paroi`, `plaque-epingle`, `chaine-turbo` y sont les mêmes qu'au Stade.

---

## Variété garantie (proposée pour le troisième temps)
- **« La suite de figures principale »** = les figures **vedettes** du circuit (les figures signatures de sa fiche, hors la signature elle-même, qui est toujours là). Proposé : chaque thème a 2 à 3 groupes de vedettes ; **deux circuits consécutifs d'un même thème** (le jour d et le jour d'avant qui a le même thème) prennent leurs vedettes dans **deux groupes différents**. Calcul sans générer les jours passés : le numéro d'apparition du thème depuis la bascule (`themeForDay` jour après jour, quelques microsecondes), comme `isRested` le fait déjà par la date.
- **Et aucun enchaînement de deux figures en commun** entre deux circuits consécutifs d'un même thème (aujourd'hui : 26 paires sur 192 en partagent un).
- **Interdits proposés** (v18 seulement) : les figures à super turbo là où le thème n'en a pas (Rallye, Banquise, Campagne) ; la portion rapide et le freinage franc pris dans les figures du thème.
- **Cible de la mesure de ressemblance** (section 5 du script) : même thème **0,187 → ≤ 0,14** (−25 %), jours consécutifs d'un même thème **0,179 → ≤ 0,12**, aucune paire de jours consécutifs au-dessus de 0,5 ; entre thèmes **0,091 → ≤ 0,07**.

## À décider (Nathan)
1. **Garder, écarter ou retoucher chaque nouveauté** (liste et liens dans le README du lot, § 2).
2. **Valider ou corriger chaque fiche** (surtout les « jamais » : interdire les super turbos au Rallye, à la Banquise et à la Campagne change beaucoup ces trois thèmes).
3. La règle de variété et sa cible.
