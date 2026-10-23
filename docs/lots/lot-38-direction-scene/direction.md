# Direction de la scène de Track — **la règle de la scène**

> **Statut (lot 39, 23/10/2026) : ce document n'est plus un projet, il est la règle de la scène de Track.** Lot 43 : **le palier 1 est la scène du jeu** ;
> décisions du 23/10/2026 au § 9. Il a été écrit au lot 38 (vitrine
> `/track/vitrine/`), complété par la retouche 38b (les paliers) et tranché par Nathan le 22/10/2026 : voir **§ 9, « Décisions »**, qui l'emporte sur
> tout ce qui précède quand ils diffèrent ; ce qui reste ouvert y est listé comme tel. Les lots de mise en œuvre s'y conforment ; la scène du jeu passe
> par le socle par paliers (`apps/web/src/scene/socle.ts`, lot 39). La charte de l'interface (`docs/plateforme/identite.md`) reste celle de l'interface ;
> ce document est celui de la scène.
>
> README des lots : `docs/lots/lot-38-direction-scene.md`, `docs/lots/lot-38b-paliers-scene.md` (paliers, coûts, plan), `docs/lots/lot-39-socle-scene.md` (le socle).
> Code : `apps/web/src/scene/` (fonctions de construction par élément, paramétrées par thème et par palier).

## 1. Principes

1. **La piste d'abord.** Ce qui porte la voiture et ce qui la borde se lit d'un coup d'œil, à 300 km/h, sur un téléphone en plein soleil :
   la route est un aplat sombre et neutre (jamais confondu avec la terre, le sable ou la glace d'un bloc), ses bords tranchent (rebords à bandes
   franches, vibreurs relevés, liseré d'encre), et tout ce qui annonce (panneaux, portes, plaques) est **sans éclairage** : lisible de jour comme
   de nuit, quelle que soit la lumière du thème.
2. **Le décor habille, il ne gêne pas.** Il donne l'identité du thème et la sensation de vitesse ; il ne cache jamais la sortie d'un virage, ne se
   confond jamais avec un élément de course, ne flotte jamais (règles de pose, § 5). Il est sacrifiable : masqué à la qualité basse, chargé après
   la piste (§ 6).
3. **Une identité par thème, reconnaissable d'un coup d'œil** : une **silhouette d'horizon** (le plus visible depuis la piste : le décor au sol
   est toujours au moins 8 m en contrebas), une **couleur dominante**, une **lumière** (une heure du jour). Deux thèmes ne partagent ni leur
   horizon ni leur lumière (§ 4). En particulier **Stade = midi** (ciel bleu franc, soleil haut, ombres courtes et nettes) et **Nuit = nuit
   noire** (ciel noir, la piste éclairée par flaques de lampes et par les phares, des repères qui brillent) : le défaut relevé (« Stade et Nuit
   trop proches en lumière ») ne doit plus être possible (mesure : README, § 4).
4. **Cohérence avec la charte « Cartouches »** de l'interface, traduite ainsi en 3D :
   - **les éléments de course sont des cartouches** : aplats de couleur, bordure d'encre, **ombre nette décalée** (un double d'encre posé derrière
     et en dessous, vers la droite du conducteur : l'ombre `4px 4px 0` des cartouches) ; textes en Barlow Condensed 800 italique (la police du
     chrono du HUD) ; **la livrée à 115°** (rayures orange `--track-livree` et asphalte) sur le portique de départ et les arches de vitesse ;
     couleurs de la marque (asphalte, crème, encre, livrée) sur le départ et l'arrivée, qui portent la marque Track comme le bouton « Courir » ;
   - **pas de translucidité sur un élément** : le voile translucide de la porte de contrôle disparaît (remplacé par l'arche) ;
   - **la lumière, elle, reste continue** : le soleil, la brume, le ciel et les flaques de lumière ont des dégradés (c'est de la lumière, pas de
     l'interface). La règle « ni flou ni dégradé » vaut pour l'interface et pour les éléments graphiques de la scène (panneaux, bandeaux,
     marquages), pas pour l'éclairage. *(Question pour Nathan : la direction A applique la règle à toute la scène — ciel en bandes, lumière en trois
     tons ; la vitrine la montre.)*
5. **Tout se mesure.** Chaque lot de mise en œuvre donne, avant et après, sur la vitrine : poids ajouté (premier chargement et à la demande),
   appels de rendu et triangles par image, temps d'image et de construction au profil téléphone (processeur ×4) — § 7.

## 2. Ce que fait chaque direction (rappel)

- **A — Net et graphique** : silhouettes franches, peu de pièces, aplats, marquages forts, lumière en trois tons (matériau « toon »), ciel en
  aplats. La plus légère à l'image (−20 à −65 % de triangles selon le thème) et la plus lisible ; la plus pauvre en profondeur.
- **B — Détaillé** : pièces chanfreinées et petites histoires (pneus, drapeaux, câbles, rivets, feux de départ, arche gonflable, sponsors fictifs
  dans un atlas), un rebord propre à chaque thème. Même nombre d'appels de rendu (tout est fusionné), deux à trois fois plus de triangles.
- **C — Lumière et matière** : mêmes formes que l'existant ; ciel, brume, lumière et ombres par thème, occlusion par sommets, ombres de contact de
  la piste, grain et sol dessinés au chargement, lampes de nuit. Un traitement appliqué à une scène construite.

## 3. Les éléments de course (recommandation : le mélange)

| Élément | Forme recommandée | Vient de | Couleurs | Rôle |
|---|---|---|---|---|
| Portique de départ | cartouche : deux piliers plats, poutre-panneau crème bordée d'encre, « DÉPART » en Barlow 800 italique, livrée en haut, ombre nette décalée ; **cinq paires de feux de départ** sous la poutre ; au sol la ligne crème et livrée et la case de départ | A + feux de B | marque : asphalte, crème, encre, livrée | la première image de la course ; la marque |
| Arrivée | la même cartouche, poutre à damier, « ARRIVÉE », damier au sol en carrés de 2 m | A | encre et crème | la fin, reconnue de loin |
| Point de contrôle | **arche gonflable** (demi-ovale de boudins, bandes blanches) lestée, banderole de sponsor, bornes de chronométrage ; bande de la couleur du contrôle au sol | B | couleur du contrôle du thème (`checkpoint`) et blanc | se distingue du départ et de l'arrivée par sa forme ronde |
| Plaque, super turbo | plaque bordée d'encre (0,35 m), trois chevrons épais | A | jaune et encre ; rouge et jaune | lisible de loin sans gêner la trajectoire |
| Moteur coupé | rayures d'alerte à 45°, encre et jaune | A | encre, jaune | avertissement, pas un bonus |
| Panneau de virage | panneau large (4,2 × 1,7 m) sur deux pieds, 1 à 3 chevrons étalés, liseré, ombre nette d'encre derrière | A | jaune / orange / rouge selon la sévérité, bleu pour une cuve | annonce le virage et sa sévérité |
| Rebord | le **profil du thème** de B (béton, mur de pneus, clôture de bois, roche, glissière double) peint des **couleurs franches** du thème (bandes de 4 m), catadioptres tous les 8 m | B (formes) + A (couleurs) | voir § 4 | borde la piste et dit le thème |
| Vibreurs | dents relevées de 1,8 m, 3 m par couleur, lèvre d'encre côté route | A | rouge et blanc (jaune et encre en Ville et Nuit) | le bord intérieur d'un virage |
| Bord du vide | liseré crème, blocs bas encre et livrée, balises réfléchissantes tous les 8 m ; néon la nuit | A + B | crème, encre, livrée ; néon cyan et magenta | « ici c'est le vide » |
| Lignes | lignes de rive de 0,35 m, tirets de 0,4 × 5 m, pas de sillons | A | `dash` de la palette | l'axe et les bords |
| Rythme de vitesse | repères plats encre et crème sur le rebord tous les 16 m (8 m en portion rapide, livrée) ; arches plates à livrée dans les portions rapides | A | encre, crème, livrée | la vitesse |

La voiture ne change pas (elle ne détonne avec aucune direction ; en A seule, son ombrage continu tranche un peu avec le « toon » du décor).

## 4. Palettes par thème

Couleurs de la route, des rebords et des vibreurs : celles de la direction A (`PISTE_A`, `apps/web/src/scene/piste.ts` depuis le lot 43) ; lumière : celle de
la direction C (`THEMES_C`, `lumiere.ts` depuis le lot 44, qui a retiré les directions) ; horizon : `HORIZONS` (`types.ts`). Valeurs en hexadécimal.

| Thème (palette) | Heure | Dominante | Horizon | Ciel (zénith → horizon) | Route | Rebord (profil, bandes) | Vibreurs | Lumière (soleil, hémisphère, exposition) | Ombres | Brume (couleur, début–fin) |
|---|---|---|---|---|---|---|---|---|---|---|
| Stade (`stade`) | midi | vert pelouse, bleu ciel | **anneau de tribunes et mâts d'éclairage** | `1a63d6` → `c4e6ff` | `47464c` | béton, `2e7dff` / `f4f4f4` | `e8283a` / `f4f4f4` | `fff6e6` × 3,1 ; 0,62 ; 1,00 | nettes (1, rayon 1) | `c4e6ff`, 190–540 m |
| Rallye (`desert`) | après-midi, poussière | ocre sable | **buttes à sommet plat** | `2f8fd0` → `f2c08a` | `67655f` (gris chaud, jamais brun) | mur de pneus, `1e1b19` / `f4f1e6` | `e8552d` / `f4f1e6` | `ffe2b0` × 2,8 ; 0,55 ; 1,02 | 0,9, rayon 1 | `f0c590`, 90–320 m |
| Banquise (`neige`) | jour blanc | blanc bleuté | **pics enneigés** | `b9cde0` → `f2f6fa` | `5b6676` | béton (une congère blanche ne se lit pas), `2f6fd0` / `ffffff` | `e8283a` / `ffffff` | `ffffff` × 1,2 ; 1,30 ; 1,05 | douces (0,35, rayon 4) | `eef3f7`, 50–230 m |
| Nuit (`nuit`) | nuit noire | bleu nuit, jaune sodium | **collines noires, ville allumée au loin** | `010208` → `10193e` | `1d2030` | béton, `1e1b19` / `f2b544` (ambre réfléchissant) | `f2b544` / `1e1b19` | lune `8ea6ff` × 0,32 ; 0,14 ; 1,00 ; **lampadaires sodium** sur le rebord tous les deux blocs (4 lampes réelles, flaques) ; phares | 0,6 | `060a1c`, 35–180 m |
| Campagne (`campagne`) | fin d'après-midi dorée | vert doré, ciel orangé | **collines rondes** | `3f6fc4` → `ffc77a` | `6d6e72` | clôture de bois, `7a5230` / `d9b27a` | `d9402a` / `f6f6f0` | `ffb35c` × 2,7, soleil bas ; 0,48 ; 1,00 | longues (0,95) | `f6c88a`, 110–360 m |
| Canyon (`canyon`) | soleil rasant | rouge roche, ciel violet | **mesas à strates** | `4a3b8c` → `ffa25a` | `6a605c` | blocs de roche, `a8472a` / `e0a466` | `1e1b19` / `f6e6c8` | `ff8a3c` × 3,0, soleil bas ; 0,50 ; 1,02 | longues (1) | `f4a065`, 90–320 m |
| Col alpin (`alpin`) | matin limpide | blanc, gris roche, alpage | **grands pics enneigés** | `0f4fb8` → `d6ecfa` | `55595f` | glissière double, `e8283a` / `f6f6f6` | `e8283a` / `f6f6f6` | `fffaf0` × 2,9 ; 0,58 ; 1,00 | 0,95 | `d6ecfa`, 170–540 m |
| Ville (`ville`) | jour voilé | gris béton, jaune | **immeubles** | `5f86b4` → `d4dbe2` | `3c3e44` | béton (murs hauts), `c8cbd1` / `a9adb4` | `f2b544` / `1e1b19` | `fff1d8` × 2,0 ; 0,70 ; 0,98 | 0,75, rayon 2 | `c9d1d9`, 80–300 m |

La palette `neon` existe dans le code mais aucun thème ne l'utilise : à retirer, ou à garder pour un thème futur (question pour Nathan).

## 5. Règles de pose (celles du lot 37, reprises ici)

Ces règles sont celles du lot 37 (`docs/lots/lot-37-decor-propre.md`, `apps/web/CLAUDE.md` « Décor : règles de pose »), **vérifiées sans rendu par le test de pose**
(`apps/web/test/decorPose.test.ts`) ; elles valent pour tout palier et pour tout élément (`placesDeDecor`, `decor/commun.ts` depuis le lot 44 ; `trackGeometry` pour l'existant). Précisions du lot 37 : l'appui
d'un pied est le sol lointain, **le chapeau d'un rebord plein** (hauteur du bord, pas de la ligne centrale) ou une structure qui descend jusqu'au sol, à 5 cm près ;
« rien dans le passage » = rien sur la surface roulante (route, bas-côté, paroi de cuve) ni à moins de 4,6 m au-dessus (la caméra « loin » est à 4,2 m), un élément au sol
reste à 1 m de la route ; les trois rôles du lot 37 (*signaler*, *marquer*, *habiller*) regroupent les cinq ci-dessous.

1. **Aucun élément en l'air.** Tout est posé au sol lointain (`floorY`, au moins 8 m sous la route la plus basse) ou sur un socle plein jusqu'à lui
   (la tribune du départ, la tour de chronométrage, les piles de pneus sur la bande) ; rien ne flotte (plus de cubes lumineux suspendus).
2. **Rien dans le passage.** Le décor ne touche jamais une cellule de la piste ; une cellule vide **entourée par la piste** (trois cellules de piste
   ou plus autour d'elle : l'intérieur d'un virage ou d'une épingle) reste vide, parce que c'est là que le regard coupe vers la sortie ; rien entre
   les rebords et la route ; les éléments de course sont hors de la chaussée, sauf ce qui est peint dessus.
3. **Chaque élément a un rôle**, et un seul : *repère* (portiques, panneaux, porte, plaques), *rythme* (poteaux, arches de vitesse, lampadaires de
   nuit), *identité* (horizon, profil du rebord, recettes du thème), *vie* (spectateurs, assistance, commissaires), *cadre* (tribunes, falaises,
   immeubles qui ferment l'horizon proche). Un élément sans rôle n'est pas posé.
4. **Le décor est sacrifiable** : masqué à la qualité basse (`userData.heavy`), le décor dense à la qualité 2 (`userData.level = 2`), il ne projette
   pas d'ombre (lot 23) ; les éléments de course ne sont jamais masqués.
5. **Même décor pour tout le monde** : tiré avec la graine `${id du circuit}:${palette}` (comme le jeu) ; un tirage refusé (passage) consomme quand
   même ses nombres, pour que le reste ne bouge pas.

## 6. Stratégie de chargement

Le premier chargement de Track contient la scène **dont la course a besoin** ; le reste arrive juste après, sans à-coup, et **ne retarde jamais le
départ d'une course**.

- **Dans le premier chargement** : la route paramétrable et le compositeur (qui remplacent la route et le squelette de `buildTrackScene`), les
  éléments de course (§ 3), les rebords du thème et leurs couleurs, la lumière de chaque thème (ciel, brume, lumières, ombres, exposition) et la
  forme de son horizon. C'est-à-dire tout ce qui se voit en course de près, plus la lumière (quelques nombres par thème).
- **Chargé à la demande pendant l'accueil** (un morceau `import()`, ≈ 11 ko compressés mesurés) : le décor de fond détaillé (les recettes du thème,
  la tribune et ses spectateurs, l'atlas des sponsors), la matière de C (occlusion par sommets, grain, sol dessiné, ombres de contact de la piste,
  éclairage de piste et lampes de la nuit).
- **Comment la scène s'enrichit** : le morceau arrive pendant l'accueil (le jeu le demande dès le circuit connu) ; ses maillages s'**ajoutent** à
  la scène (deux ou trois appels de rendu), la matière s'applique aux géométries déjà là (quelques millisecondes ; les programmes sont compilés à
  l'avance, `compileAsync`, pour qu'aucune image ne saute). **Jamais pendant une course** : si le morceau arrive après « Courir », il attend la
  pause, l'arrivée ou le retour à l'accueil. Le Salon le reçoit dans la préparation du circuit suivant (`prebuild`, pendant le podium) : la
  bascule n'en est pas plus longue. Sans réseau ou en qualité basse : la scène reste celle du premier chargement, complète et jouable.
- **Miniatures** : la vue aérienne reprend la piste et l'horizon, sans le décor à la demande (comme aujourd'hui elle ne construit que le décor proche).

## 7. Budget (proposition, à décider avec Nathan)

Mesuré par `node apps/web/vitrine/poids-parties.mjs` (esbuild, minifié, gzip ; three.js, la simulation et les modules de scène déjà présents
laissés dehors) :

| Ligne | Ce qu'elle contient | Mesuré | Proposition |
|---|---|---|---|
| Premier chargement de Track | socle (route paramétrable, compositeur, outils) + piste du mélange + lumière de C + ce qu'ils gardent de `trackMesh.ts` et `trackProps.ts` (palettes, ambiances, glyphes) : 23,7 ko, **à la place** de `trackMesh.ts` et `trackProps.ts` d'aujourd'hui (14,4 ko) | **≈ +9,3 ko net** (un plafond : le lot 1 le remesure dans le jeu) | dans la marge actuelle (21,8 ko) : il en resterait ≈ 12 ko |
| **Décor 3D à la demande** (nouvelle ligne) | décor du mélange (recettes de B allégées, tribune, atlas : 7,2 ko) + matière de C (4,3 ko) | ≈ 11,5 ko | **plafond 16 ko**, gardé par `perf.spec.ts` comme le fil des circuits |
| Image (profil téléphone, processeur ×4) | appels de rendu, triangles, temps d'envoi et d'image en caméra de poursuite, moyenne des huit thèmes | voir le README du lot, § 5 | appels : pas plus que l'existant + 3 ; sur **chaque** thème, triangles et temps d'image **sous le pire thème de l'existant** (la Ville : 168 k triangles, 306 ms) ; envoi : ≤ l'existant + 1 ms |
| Construction d'une scène | au profil téléphone, moyenne des huit thèmes | voir le README, § 5 | ≤ l'existant + 150 ms (elle compte à l'accueil et à la bascule du Salon) |

Chaque lot de mise en œuvre remesure ces lignes (vitrine, `mesure-lot38`, `poids-parties.mjs`) et les reporte dans son README et dans
`docs/plateforme/budgets.md` (ligne de Track).

## 8. Paliers de qualité (retouche 38b ; tranchés au § 9)

Au-dessus du mélange recommandé, trois paliers, **rendu seul** (un palier ne change jamais la simulation : même route sous la voiture, mêmes
rebords physiques, même chrono, mêmes rediffusions). Chaque pas se coupe seul ; la vitrine (`/track/vitrine/`) les montre côte à côte, chiffrés,
et en mouvement. Détail, coûts et mesures : `docs/lots/lot-38b-paliers-scene.md`.

| Palier | Contenu | Chemin de rendu | Pour quel appareil (proposition) |
|---|---|---|---|
| **1 — base** | le mélange, nettoyé : lumière de C construite directement, ombres de contact des seuls rebords, mur de pneus allégé, rien en l'air (socles et pieds jusqu'au sol), route grise sous les lumières chaudes, soleil du côté d'où vient la lumière | celui du jeu | tout appareil (le plancher) |
| **2 — finition** | *géométrie* (chanfreins, courbes plus lisses, pièces d'échelle : boulons, câbles, haubans, pneus empilés, banderoles), *variété* (rotation, taille, teinte, usure du décor ; pièces inégales), *matière* (textures calculées au chargement avec cartes de normales et de rugosité ; traces de pneus et marquages au sol), *reflets* (carte d'environnement tirée du ciel du thème) | le même : **aucun appel de rendu de plus** | téléphone récent |
| **3 — vitrine** | *lumière* (ombres nettes et loin, occlusion, brume de profondeur, ciel et nuages), *vie* (drapeaux, foule, écrans, particules), *post-traitement* (étalonnage, anticrénelage, halo), chacun commutable | + un appel par famille de vie ; les passes plein écran (occlusion, étalonnage, anticrénelage, halo) font dessiner la scène dans une cible | ordinateur ; la vie et le ciel sans les passes, peut-être sur téléphone récent |

Règles proposées (non appliquées) :
- **Le palier se choisit par la mesure des premières images**, jamais en course (§ 5 du README de la retouche) ; un réglage « Qualité graphique »
  (Auto · Économie · Équilibrée · Maximale) aux catalogues fr et en ; la qualité 0–2 du lot 9 reste en place dans un palier.
- **Les modules des pas se chargent à la demande** (un par famille : `finition`, `matiere`, `reflets`, `lumiere3`, `vie`, `post`), jamais au
  premier chargement ; le palier 1 seul tient dans la ligne « décor 3D à la demande » du § 7.
- **La charte et la 3D** : le halo (un flou lumineux), la brume de profondeur (un dégradé) et les particules (des points translucides) touchent
  aux règles de la charte « Cartouches » écrites pour l'interface ; **à Nathan de dire s'ils entrent dans la scène** (chacun se coupe seul).
- **La voiture** suit le palier (lot du véhicule, à placer avant les paliers : la ramener à 6 maillages est le pas le plus rentable) : README de la
  retouche, § 6.

## 9. Décisions (Nathan, 22/10/2026)

Prises après la vitrine des paliers (retouche 38b) et appliquées à la vitrine par la retouche 38c (`docs/lots/lot-38b-paliers-scene.md`, § 38c) ; écrites ici au lot 39.

1. **Cible visuelle : le palier 3**, avec une **matière sobre** (38c) : un cran au-dessus du grain du palier 1, **rien qui imite une photo** — ni rapiéçages, ni
   fissures, ni taches d'huile, ni granulats visibles un à un. Un grain plus fin et moins contrasté, une variation de teinte douce à grande échelle (une ligne
   droite n'est pas uniforme), pas de carte de normales (le relief ne se voyait pas). Même règle pour le béton des rebords, le métal des portiques et le grain du
   décor ; depuis la caméra de poursuite la matière se sent, elle ne se remarque pas. Les traces de pneus et de freinage restent, discrètes, dans un pas à part.
   L'ancienne matière (« détaillée ») est retirée au lot de mise en œuvre. Captures : `docs/lots/lot-38b-paliers-scene/matiere-<thème>.jpg`.
2. **Palier par appareil** :
   - **ordinateur : palier 3, sans l'occlusion GTAO** ;
   - **téléphone récent : palier 2, plus la vie** (drapeaux, foule, écrans, particules) **et le ciel** (nuages, brume), **sans aucune passe plein écran** ;
   - **entrée de gamme : palier 1**.
   Le choix est fait par **la règle automatique du 38b** (`docs/lots/lot-38b-paliers-scene.md`, § 5 : mesure des premières images, **jamais en course**). Mesure de
   Nathan sur un Pixel 7, dans la vue en mouvement de la vitrine, sur un bandeau d'environ un tiers de l'écran : **palier 2 à 90 images/s** (11 ms, pire image 11 ms) ;
   **palier 3 à 64 images/s** (16 ms, pire image 67 ms, 95 Mo de cibles, 269 appels).
3. **Halo, brume de profondeur et particules : oui dans la scène 3D.** La charte « Cartouches » (ni flou, ni transparence, ni dégradé) vaut pour **l'interface**,
   pas pour la scène.
4. **Anticrénelage d'après-coup : FXAA, pas SMAA** (2,3 ko contre 37,7 ko, une passe).
5. **Un réglage « Qualité graphique » dans les Réglages** : **Auto** (par défaut) · **Économie** (palier 1) · **Équilibrée** (palier 2) · **Maximale** (palier 3, et ce que
   l'appareil supporte), fr et en. Il est posé **au lot du palier 2** (pas avant).
6. **Le lot du véhicule passe en deuxième** (lot 40) ; il peut tourner en parallèle du socle.
7. **Le soleil (ou la lune) est posé du côté d'où vient la lumière, dans le jeu aussi**, au lot de la lumière.
8. **Le Canyon garde sa route rouge-brun** sous son soleil rasant orangé.

**Un palier ne change jamais la simulation.** **On ne reconstruit jamais la scène pendant une course** (accueil, pause, arrivée, podium du Salon seulement). **Les modules des
pas se chargent à la demande**, jamais dans le premier chargement (lot 39 : `socle.ts`).

### Décisions du 23/10/2026 (Nathan, écrites au lot 43)

9. **Budget** : **+7 à 9 ko au premier chargement** pour le palier 1, et une ligne « **décor 3D à la demande** » de **16 ko** (lot suivant). Le plafond du
   premier chargement de Track est **relevé de +15 ko quand le palier 1 entre en jeu** (lot 43) : les lignes JS, hors three.js et JS + CSS de
   `docs/plateforme/budgets.md` montent d'autant. *Mesuré au lot 43 : +9,5 ko net (9 466 o ; README du lot 43, § 4).*
10. **Panneaux de distance avant les virages serrés : oui** (lot 43 : « 3, 2, 1 » barres tous les 28 m, calculés depuis la géométrie du circuit).
11. **Feux de départ allumés pendant le décompte : oui** (lot 43 : un à un, puis verts au départ ; l'affichage lit l'état du décompte, rien de plus ; au
    Salon aussi).
12. **Sponsors fictifs, sur les portiques et les rebords : oui, discrets** (lot 43 : huit noms inventés, `src/scene/sponsors.ts`, jamais plus lisibles que
    les panneaux de course).
13. **Sol relevé près de la piste**, pour voir le décor : **oui** — au lot du décor (palier 1, thème par thème), pas au lot 43. *Fait au lot 44 : un talus à 1,5 m sous la route, puis une pente douce ; la simulation ne le voit pas (`decor/commun.ts`, `terrainDe`).*
14. **Vie au Stade** : **confettis à l'arrivée seulement ; foule seulement dans la tribune du départ** — au lot de la vie (palier 3).

Et, du lot 40 (§ 6 de son README) : **l'orange est à la voiture seule**. Les vibreurs orange du Rallye et rouge-orangé de la Campagne changent de teinte ;
chaque élément de piste de chaque thème garde un écart ΔE 2000 > 12 avec l'orange de Track (`0xe8552d`) — lot 43 : le rouge de la piste devient
`0xc01818` (`ROUGE_PISTE`, `palier1.ts`), la roche du Canyon `0x7a3a2a` ; la livrée orange de la marque ne reste qu'en hauteur, sur le portique de départ.

**Reste ouverte** : la **palette `neon`** (dans le code, aucun thème ne l'utilise).
