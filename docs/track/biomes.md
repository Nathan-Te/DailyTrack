# Fiches des biomes de Track (lot V2, générateur v21)

**Le générateur applique ces fiches** : elles sont écrites une fois dans le code, `FICHES_V21` (`packages/sim/src/themesVersion.ts`) et `RYTHME_DOMINANT` (`packages/sim/src/rythmes.ts`) ; cette page les dit en mots. Elles s'ajoutent à l'identité des thèmes des lots 21, 22 et 49 (bas-côtés, revêtements, signatures, vedettes : `docs/lots/lot-49-identite/fiches.md`), qui ne change pas. Aucun biome nouveau : chaque fiche part de ce que le biome montre déjà (son décor, son nom, sa signature). **Un nouveau biome a sa fiche** (le type `Record<ThemeName, FicheBiome>` l'exige) et sa ligne ici.

## Ce qu'une fiche règle

- **Sa palette de blocs (poids)** : le poids de tirage d'une figure est multiplié par celui de chaque étiquette qu'elle porte — sa catégorie (`technique`, `saut`, `rapide`, `combo`, `cuve`, `relief`) et ses drapeaux (`tight` : un virage serré, `braking` : un freinage franc derrière une poussée, `jump`, `relief`, `banked`, `turbo`). Le rythme du jour multiplie aussi (ci-dessous). Les figures imposées (signature, vedette, règle propre, saut ou cuve d'un thème à 100 %) ne sont pas tirées au poids : la palette agit sur les autres.
- **Son relief** : la part des collines raides (`steep`) quand le circuit tire une colline, et le poids des figures en relief.
- **Son rythme dominant** : il prend la place du rythme « mixte » d'un jour de ce biome (sauf s'il est celui de la veille ou du lendemain dans le sac) : il sort deux fois plus que chacun des autres rythmes sur un long temps.
- **Ses traits de tracé** (`tournures` et `reliefDuBiome`, `generator.ts`), posés sur les figures qui ne sont ni la signature ni la vedette : `serrer` (part des virages larges qui deviennent serrés : jamais sur la route large ni à côté d'un autre serré), `amplifier` (part qui deviennent amples, rayon 80 m), `alterner` (le premier virage d'une figure tourne à l'opposé du dernier virage posé), `pente` (part des droites libres qui deviennent des pentes, dans les hauteurs permises), `maxDroite` (plus longue ligne droite **libre** : hors du dégagement d'une poussée, d'un saut ou d'une cuve, et hors de l'élan d'une rampe), `maxTight` (virages serrés permis).

## Les rythmes (pour mémoire)

Un sac de cinq rythmes, jamais deux jours de suite le même (`rythmeDuJour`) : **technique** (virages et freinages courts, moins de boosts et de sauts ; pas de freinage franc exigé), **rapide** (portions rapides et freinages francs ; le seul jour où le motif « boost → longue ligne droite → virage serré » est permis, une fois), **mixte** (les poids du biome seuls), **vertical** (le relief ×3 ; pas de freinage franc exigé), **aérien** (un saut toujours, les sauts ×3 ; pas de freinage franc exigé).

## Les huit fiches

Chiffres : `docs/track/variete.md` (200 jours du 30/10/2026, v20 → v21 ; moyennes par circuit).

| biome | rythme dominant | palette (poids) | relief | traits de tracé (appliqués) | mesuré v20 → v21 |
|---|---|---|---|---|---|
| **Stade** | rapide | relevés ×1,5, rapides ×1,5, combinaisons ×1,5 ; virages relevés 50 % (35 avant) | inchangé | **les virages larges deviennent des courbes amples** (`amplifier` 100 %), souvent relevées | virages amples 24 → 55 %, rayon moyen 50 → 62 m ; motif 56 → 4 % |
| **Rallye** | aérien | techniques ×1,5, sauts ×1,5, serrés ×0,5, rapides ×0,6 ; favorites : slalom, S serré-large, bosses de terre | inchangé | **les virages changent de sens** (`alterner`) ; **aucune ligne droite libre de plus de 3 blocs** | changements de direction 2,5 → 4,1 ; serrés 4 → 2 % |
| **Banquise** | mixte | serrés ×0,2, relevés ×0,6, relief ×0,3 ; favorites : slalom de glace, slalom, demi-tour large | collines douces (raides 10 %) | **un seul virage serré au plus** (`maxTight` 1) ; des virages amples (`amplifier` 40 %) | amples 0 → 13 %, serrés 12 → 8 % |
| **Nuit** | aérien | sauts ×1,8, combinaisons ×1,5, rapides ×0,7 ; favorites : double saut, saut et virage | inchangé | (ses traits restent ceux du lot 21 : bas-côté de vide, route sans rebords) | sans rebords 20 → 23 % ; motif 64 → 24 % |
| **Campagne** | technique | relief ×1,5, techniques ×1,5, rapides ×0,6 ; favorites : colline, crête et virage, virage aveugle | collines douces (raides 10 %, 40 avant) | (la route étroite, les crêtes et l'herbe de course, lots 21 et 48) | dénivelé 20 → 24 m, pentes 19 → 23 % ; motif 42 → 4 % |
| **Canyon** | technique | serrés ×2,5, techniques ×1,8, rapides ×0,4, freinages francs ×0,5 ; tire aussi la chicane d'angles droits de la Ville | **en marches** : collines raides 90 % (plateaux) | **chaque virage large des figures devient serré** (`serrer` 100 %, quatre serrés au plus) ; **aucune ligne droite libre de plus de 3 blocs** | serrés 34 → 35 % (sans les épingles à plaque, ôtées du motif : voir le README), changements 1,4 → 1,8 ; motif 62 → 12 % |
| **Col alpin** | vertical | relief ×3, serrés ×0,6, sauts ×0,6 ; favorites : virage en descente, virage aveugle, demi-tour large | grosses descentes (lot 22) | **chaque droite libre devient une pente** (`pente` 100 %) | dénivelé 18,5 → 26,5 m, pentes 13 → 30 %, montée 7,5 → 18,2 m |
| **Ville** | technique | serrés ×1,5, techniques ×1,5, relief ×0,5, sauts ×0,5, rapides ×0,6 | inchangé | **des virages larges deviennent serrés** (`serrer` 40 %) ; **rues courtes** : aucune ligne droite libre de plus de 4 blocs | serrés 47 → 50 %, rayon moyen 33 → 35 m ; motif 69 → 27 % |

## Ce qui distingue deux biomes

La mesure compare les profils jour par jour : deux biomes sont **nettement distincts** quand au moins deux grandeurs de leur profil s'écartent d'au moins un écart-type d'un jour à l'autre. **v20 : 27 paires sur 28 ; v21 : 28 sur 28** (Campagne / Col alpin n'en avait qu'une, la route sans rebords du Col ; en v21 s'y ajoute la part des lignes droites de trois blocs ou plus, 81 % contre 64 %). Le détail, paire par paire, est dans `docs/track/variete.md` (§ 3).

## Une ligne par biome

- **Stade** — rapide : de grandes courbes amples et relevées, peu de serrés.
- **Rallye** — aérien : des virages qui changent de sens sans ligne droite, des bosses et des sauts.
- **Banquise** — mixte : la route large, des S larges et amples, un serré au plus, presque plat.
- **Nuit** — aérien : des sauts et la route au bord du vide.
- **Campagne** — technique : une route étroite qui ondule, des crêtes et des virages aveugles.
- **Canyon** — technique : des virages serrés entre les parois, pas de ligne droite libre, le relief en marches.
- **Col alpin** — vertical : toujours dans la pente, des lacets et des demi-tours.
- **Ville** — technique : des angles droits et des rues courtes.
