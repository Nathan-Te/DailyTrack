# Lot 38 — Track : direction artistique de la scène (planche à choisir)

Objet : **une planche pour choisir**, pas un changement du jeu. Une page vitrine montre les éléments de la scène (portique de départ, arrivée,
point de contrôle, plaques, panneaux, rebords) et chaque thème, vus par **l'existant**, trois **directions** d'amélioration et un **mélange
recommandé**, côte à côte, dans la même scène et le même cadrage, avec leur coût mesuré. Un **projet** de document de direction
(`lot-38-direction-scene/direction.md`) deviendra la règle des lots de mise en œuvre quand Nathan aura choisi.

Zones : `apps/web/**` (la vitrine, le code des directions, leurs tests), `docs/lots/**`, `docs/orchestration.md`, l'entrée de
`apps/web/e2e/durees.json` et l'exemption de la vitrine dans `packages/ui/test/applications.ts` (exceptions tolérées). **Aucune zone partagée
d'autre** ; pas de `firebase.json` (la vitrine est un dossier du site, servi tel quel). Lot 37 : pas encore fusionné au départ de ce lot (il nettoie
le décor du jeu en parallèle) ; ses règles de pose sont reprises de l'énoncé (§ 6).

## Résultat en quelques lignes

- **La vitrine** : **`/track/vitrine/`** sur la recette et sur l'aperçu de la PR (jamais en production : elle n'y est pas construite). 6 sections
  d'éléments et 8 sections de thèmes, 5 colonnes chacune (existant | A | B | C | mélange) ; on tourne autour de chaque vue, on l'agrandit, on
  mesure son temps d'image **sur son propre appareil**. Légendes en français (outil interne, exempté des catalogues comme l'admin).
- **Rien ne change dans le jeu** : les fichiers du jeu construits sont **identiques octet pour octet** à ceux de `main` (mêmes empreintes, même
  premier chargement : `perf.spec.ts` vert), golden inchangés, `sim` intouché, `trackMesh.ts` et `trackProps.ts` intouchés.
- **Recommandation : un mélange** — les éléments de course de **A** (le portique-cartouche aux couleurs de la marque, des panneaux larges, des
  plaques bordées d'encre) avec les **feux de départ** et l'**arche gonflable** du contrôle de **B**, les **rebords propres à chaque thème** de B peints
  des couleurs franches de A, un **horizon par thème**, la **lumière de C** (une heure du jour par thème : Stade à midi, Nuit vraiment noire et
  éclairée par flaques), et le **décor de B allégé, chargé à la demande**. Coût proposé : **≈ +9,3 ko net** au premier chargement (dans la marge
  de 21,8 ko) et une ligne « décor 3D à la demande » de **≈ 11,5 ko** (plafond proposé 16 ko).

## À tester (sur l'aperçu de la PR)

Ouvrir **`<aperçu>/track/vitrine/`** sur ordinateur, puis sur téléphone. Parcourir les éléments (le sélecteur en tête change le thème de ces
sections) et les thèmes (trois points de vue : poursuite, départ, vue d'ensemble). Pour **chaque élément et chaque thème**, noter : **A, B, C, un
mélange, ou « l'existant suffit »**. Sur le téléphone, « Agrandir et mesurer » donne le vrai temps d'image de l'appareil (la mesure du lot est en
rendu logiciel) : le noter pour Stade, Nuit et Rallye (les plus chargés).

## 1. La vitrine

- **Accès** : `/track/vitrine/`, un dossier du site comme `/track/admin/` (le prompt proposait `?vitrine=scene` ou une page à part). **Pourquoi pas
  `?vitrine=scene`** : il aurait fallu que `main.ts` reconnaisse le paramètre, charge la vitrine et arrête le démarrage du jeu (≈ 100 à 300 o de
  plus dans le premier chargement, et un démarrage interrompu au milieu du module) ; une quatrième entrée de `vite.config.ts` aurait, elle, fait
  passer des modules du jeu dans des morceaux partagés (le découpage du premier chargement aurait changé). **Une construction à part**
  (`vite.vitrine.config.ts`, lancée par `vitrine/construire.mjs` après celle du jeu, dans `npm run build`) ne touche à rien du jeu : son code, sa
  copie de three.js et ses polices vont dans `dist/vitrine/`.
- **Jamais en production** : `construire.mjs` ne construit rien quand `VITE_PRODUCTION=1` (la construction de production, `deploy-site.yml`) :
  `playdujour.com/track/vitrine/` n'existe pas (la page 404 du site répond). La recette et les aperçus l'ont (même construction, sans ce drapeau).
- **Rendu** : un seul moteur WebGL hors de la page dessine chaque vue à la demande puis la copie dans le canvas de la vue (comme les miniatures) ;
  aucune image en continu ; une section se construit quand elle approche de l'écran, une vue à la fois ; au plus 20 scènes vivantes (les autres
  gardent leur image et sont reconstruites si on y revient). Au doigt, glisser horizontalement tourne autour ; à la souris dans tous les sens ;
  la vue agrandie zoome (pincement, molette) et mesure 60 images.
- **Sections d'éléments** : un petit circuit écrit à la main par élément (`src/vitrine/sujets.ts`), cadré sur l'élément (poursuite ou trois
  quarts), dans le thème choisi en tête de page. **Sections de thèmes** : le **vrai circuit du jour** du premier jour de ce thème depuis la mise en
  production (13/10/2026), calculé par le fil de travail des circuits du jeu ; points de vue : la caméra de poursuite du jeu (« proche ») avant
  le premier virage, le départ, une vue d'ensemble.
- **Les colonnes** (`src/vitrine/variantes.ts`) : *Existant* = la vraie scène du jeu (`buildTrackScene`) ; *A* et *B* = le **compositeur**
  (`src/scene/composer.ts`) avec la direction ; *C* = la vraie scène du jeu passée par le traitement de C ; *Mélange* = le compositeur avec la
  direction M, puis le traitement de C. Chaque direction est un morceau chargé à la demande : son poids est mesuré à la construction
  (`poids.json`, plugin de `vite.vitrine.config.ts`) et affiché.
- **Résumé des coûts** en tête de page : poids, appels et triangles (mesurés sur l'appareil qui regarde, moyenne des thèmes déjà dessinés), et
  les temps de référence au profil téléphone (§ 5).

## 2. Les directions (le code, prêt à reprendre)

Tout est dans `apps/web/src/scene/`, écrit pour être repris tel quel par les lots de mise en œuvre : **des fonctions de construction par élément,
paramétrées par thème**, dans les mêmes calques que le jeu (maillages fusionnés à couleurs par sommet : un appel de rendu par calque, quel que
soit le nombre de pièces).

- **Socle** : `route.ts` — la route du jeu (surface, jupe, piliers, cuves, bas-côtés, sauts, marques des revêtements : **les mêmes points que la
  simulation**) dont les rebords, vibreurs, bordures du vide et marquages sont confiés à un style (`StyleRoute`) ; c'est une **copie de travail**
  de `trackMesh.ts`, qui ne bouge pas dans ce lot (le lot 37 le modifie en même temps) : le premier lot de mise en œuvre en fera la route du jeu.
  `composer.ts` — la scène d'une direction (même interface que `buildTrackScene`), les **horizons par thème** (pics, collines, buttes, mesas,
  immeubles, anneau de tribunes, ville allumée la nuit) et les **places du décor** (règles de pose, § 6). `outils.ts` (repères, boîtes, chanfreins,
  tubes, livrée à 115°, affiches texturées), `pieces.ts` (bandeaux de texte, damiers, chevrons, couleurs de la marque), `origine.ts` (l'existant
  réécrit en direction : base commune et contrôle du compositeur), `types.ts`.
- **A — Net et graphique** (`directionA.ts`) : palettes par thème (`THEMES_A`), route (rebords en blocs à bandes de 8 m, liseré d'encre, ombre
  nette au pied ; vibreurs en dents relevées ; lignes épaisses), portique-cartouche (départ, arrivée), porte plate, plaques bordées, panneaux
  larges à ombre nette, repères de rythme, décor de peu de pièces par thème, ciel en aplats, matériau « toon » (trois tons nets).
- **B — Détaillé** (`directionB.ts`) : un rebord par thème (béton à profil « Jersey » et catadioptres, mur de pneus, clôture de bois, blocs de
  roche, glissière double, congère), portique en treillis avec panneau à diodes et **feux de départ** (`feuxDeDepart`), arrivée à damier et tour de
  chronométrage, **arche gonflable** du contrôle et bornes, plaques en métal rivetées à flèches lumineuses, panneaux sur pieds boulonnés et
  panneaux de distance, balises, décor en vignettes par thème (assistance, spectateurs, ferme, chalets, télésiège, motel, abribus…), **atlas de
  sponsors fictifs** (un seul canvas, un seul maillage pour toutes les affiches ; « DU JOUR » y figure, dessiné selon la charte).
- **C — Lumière et matière** (`directionC.ts`, `textures.ts`) : `appliquerLumiereC` (ciel à quatre arrêts, brume, lumières, ombres, exposition
  par thème : `THEMES_C`) et `appliquerMatiereC` (occlusion par sommets, grain en coordonnées « monde », sol dessiné par thème, ombres de contact de
  la piste, **éclairage de piste et quatre lampes réelles la nuit**) ; s'applique à **n'importe quelle scène construite** — celle du jeu (lot 37
  compris) comme celle du compositeur.
- **Mélange** (`directionM.ts`) : `PISTE_M` (ce qui doit être au premier écran) et `DECOR_M` (le décor, à la demande), réunis dans `DIRECTION_M`.

## 3. Recommandation par élément

Captures : une planche par élément, **existant | A | B | C | mélange** (`lot-38-direction-scene/<élément>.jpg`).

| Élément | Recommandé | Pourquoi |
|---|---|---|
| Portique de départ | **A + feux de B** | La cartouche de la charte en 3D (panneau crème bordé d'encre, ombre nette décalée, livrée, Barlow 800 italique : la police du chrono) : le départ porte la marque Track comme le bouton « Courir ». Les feux disent « départ » sans texte et pourront s'allumer au décompte. Le treillis de B est beau mais chargé (2 × les triangles) et son texte à diodes se lit moins bien de loin ; C ne change pas sa forme générique (« un bandeau rouge sur deux piliers »). |
| Arrivée | **A** | La même famille que le départ, damier franc ; la tour de chronométrage de B est une bonne idée pour plus tard. |
| Point de contrôle | **arche gonflable de B** | Une silhouette ronde qu'on ne confond ni avec le départ ni avec l'arrivée (rectangles) ; plus de voile translucide (refusé par la charte) ; 224 triangles. La porte plate de A ressemble à un petit portique. |
| Plaques, super turbo, moteur coupé | **A** | Bordure d'encre et chevrons épais : lisibles de plus loin que l'existant ; les rivets de B ne se voient pas à 250 km/h. |
| Panneaux de virage | **A** | Un panneau large à 1–3 chevrons étalés, une ombre nette d'encre : la sévérité se lit d'un coup d'œil. Les panneaux de distance de B (deux traits, un trait) : une option (question 5). |
| Rebords | **profils de B, couleurs de A** | Le rebord est ce qu'on voit le plus : son profil dit le thème (pneus au Rallye, bois en Campagne, roche au Canyon, glissière au Col), ses bandes franches de A gardent le bord lisible. **Banquise : béton**, pas la congère (blanc sur blanc : la piste d'abord). |
| Vibreurs, bord du vide, lignes | **A** (+ balises de B au bord du vide) | Dents relevées et lèvre d'encre ; lignes épaisses ; au bord du vide, des balises réfléchissantes. |
| Voiture | **inchangée** | Elle ne détonne avec aucune direction ; seul A (« toon » partout) la rendrait un peu différente (ombrage continu) : à revoir seulement si A est choisi en entier. |

## 4. Recommandation par thème

Captures : `lot-38-direction-scene/theme-<thème>.jpg` (poursuite) et `theme-<thème>-ensemble.jpg` (vue d'ensemble).

| Thème | Recommandé | Identité d'un coup d'œil (horizon, dominante, lumière) |
|---|---|---|
| Stade | mélange | **anneau de tribunes et mâts d'éclairage** à l'horizon, pelouse tondue, **midi** : soleil haut, blanc, ombres courtes et nettes ; rebords béton bleu et blanc ; tentes, panneaux de sponsors, commissaires, spectateurs |
| Rallye | mélange | **buttes** à sommet plat, ocre, soleil franc et brume de poussière ; **mur de pneus** (le thème le plus chargé : à surveiller sur téléphone) ; assistance, cactus, spectateurs sur les rochers |
| Banquise | mélange (rebords béton) | pics enneigés, **jour blanc** (brume laiteuse, ombres douces) ; sapins enneigés, cabanes de pêche |
| Nuit | mélange | **nuit noire** et **ville allumée** au loin ; la piste éclairée **par flaques** de lampadaires au sodium posés sur le rebord tous les deux blocs, et par les phares ; rebords encre et ambre à catadioptres ; motel, cônes |
| Campagne | mélange | **collines rondes**, **fin d'après-midi dorée** (soleil bas, ombres longues) ; clôture de bois ; ferme, foin, tracteur |
| Canyon | mélange | **mesas à strates**, ciel violet et soleil rasant orangé ; blocs de roche ; citerne, cactus |
| Col alpin | mélange | grands pics enneigés, **matin limpide** (ciel bleu profond, loin) ; glissière double ; chalets, télésiège |
| Ville | mélange (densité gardée) | **immeubles** serrés (le décor de la Ville n'est pas allégé : sa densité est son identité), jour voilé ; murs hauts en béton ; commerces, abribus, feux |

**Stade et Nuit « trop proches en lumière »** : le défaut n'est pas décrit plus précisément dans le dépôt. Mesuré sur les captures (luminance
moyenne 0–255 de la vue en poursuite) : l'existant les sépare déjà en luminosité (Stade 99, Nuit 20), mais **dans la même famille de couleurs**
— ciel bleu et nuit bleue (rapport rouge / bleu 0,70 et 0,32), mêmes rebords rouge et blanc, même tribune, mêmes arches, une nuit éclairée
partout d'un bleu uniforme (la route se lit jusqu'à l'horizon comme en plein jour). C'est sans doute ce qui les fait paraître proches. Le mélange
les sépare sur tout ce qui fait une lumière : **la quantité** (Nuit 14, et la route n'est claire que sous les lampes et dans les phares), **la
température** (midi blanc contre sodium orangé et lune froide), **l'horizon** (tribunes contre ville allumée), **les rebords** (bleu et blanc
contre encre et ambre). Testé : `apps/web/test/scene.test.ts` (« Stade et Nuit ne se ressemblent plus »). À confirmer par Nathan (question 2).

## 5. Les coûts

**Méthodes.** *Poids* : le morceau de chaque direction, gzip, mesuré à la construction de la vitrine (`poids.json`) ; et le poids **ajouté au jeu**
partie par partie (`node apps/web/vitrine/poids-parties.mjs` : esbuild, minifié, gzip, sans ce que le premier chargement contient déjà).
*Appels, triangles* : une image en caméra de poursuite, ombres comprises (`renderer.info`). *Temps* : `MESURE=1 npx playwright test mesure-lot38`
— Chromium, **rendu logiciel** (SwiftShader, comme la CI), paysage 844 × 390, densité 1, **processeur ×4** (CDP) ; *construction* = la scène d'un
circuit ; *envoi* = le temps du fil principal pour une image (il dépend surtout des appels de rendu) ; *image* = l'image attendue jusqu'au bout
(lecture d'un pixel). En rendu logiciel l'image est calculée par le processeur : **ses millisecondes ne valent pas celles d'un téléphone**, leurs
**rapports** donnent l'ordre de grandeur ; sur un vrai téléphone, « Agrandir et mesurer » donne le vrai chiffre.

### Par colonne (moyenne des huit thèmes, poursuite)

| Colonne | Morceau de la vitrine | Appels | Triangles (moyenne / pire thème) | Construction (moyenne / pire) | Image (moyenne / pire) | Envoi |
|---|---|---|---|---|---|---|
| Existant | — | 123 | 90,6 k / 168,3 k (Ville) | 346 ms / 592 ms (Ville) | 185 ms / 306 ms (Ville) | 4,7 ms |
| A — Net et graphique | 5,8 ko | 120 | **33,6 k** / 39,9 k | **122 ms** / 185 ms | **116 ms** / 130 ms | 3,9 ms |
| B — Détaillé | 9,4 ko | 121 | 92,8 k / 116,8 k (Rallye) | 396 ms / 553 ms (Ville) | 183 ms / 226 ms (Rallye) | 4,5 ms |
| C — Lumière et matière | 4,6 ko | 125 | 100,8 k / 175,3 k (Ville) | 416 ms / 713 ms (Banquise) | 248 ms / 389 ms (Ville) | 4,9 ms |
| **Mélange** | 0,6 ko (+ A, B, C) | 123 | 97,5 k / 141,4 k (Rallye) | 333 ms / 460 ms (Rallye) | 217 ms / 249 ms (Rallye) | 4,6 ms |

Les colonnes A, B et mélange partagent aussi le **socle** de la vitrine (route paramétrable, compositeur, outils : 10,9 ko), qui remplacerait la
route et le squelette de la scène du jeu : le poids **ajouté au jeu** est le tableau suivant. Mesure du 22/10/2026 (`src/vitrine/mesures.ts`) ;
le détail par thème est dans la sortie de `mesure-lot38`.

### Poids ajouté au jeu, partie par partie

| Partie | ko (gzip) |
|---|---|
| Socle : route paramétrable (remplacerait la route de `trackMesh.ts`) | 4,5 |
| Socle : compositeur (remplacerait le squelette de `buildTrackScene`) | 7,9 |
| Socle : outils, pièces, types | 1,2 |
| A : route (rebords, vibreurs, lignes) | 4,0 |
| A : éléments (portiques, porte, plaques, panneaux, rythme) | 5,1 |
| A : palettes et ambiance | 2,3 |
| A : décor | 4,4 |
| A : tout | 10,0 |
| B : rebords par thème | 3,8 |
| B : éléments (treillis, feux, arche, plaques, panneaux, rythme) | 5,5 |
| B : atlas des sponsors | 2,2 |
| B : décor | 5,6 |
| B : tout | 13,7 |
| C : lumière (ciel, brume, lumières, ombres, exposition) | 1,9 |
| C : matière (occlusion, grain, sol, ombres de contact, lampes de nuit) | 4,3 |
| C : tout | 4,8 |
| Mélange : piste (premier chargement) | 12,5 |
| Mélange : décor (à la demande) | 7,2 |
| **Mélange : premier chargement complet** (socle + piste + lumière de C + ce qu'il garde de `trackMesh.ts` et `trackProps.ts` : palettes, ambiances, glyphes des panneaux, ≈ 2,9 ko) | **23,7** |
| Existant : `trackMesh.ts` + `trackProps.ts` (dans le premier chargement aujourd'hui) | 14,4 |

Les parties partagent du code (outils, pièces) : leur somme dépasse un peu le poids de leur réunion. **Bilan du mélange** : premier chargement
**≈ +9,3 ko net** (23,7 ko à la place de 14,4 ko), dans la marge actuelle (21,8 ko : il en resterait ≈ 12 ko) ; décor et matière à la
demande **≈ 11,5 ko** (7,2 + 4,3). Ces chiffres sont un plafond : le compositeur garde tout ce qu'une direction *peut* demander (le matériau
« toon » de A, les sept formes d'horizon) ; le lot 1 du plan les remesure dans le vrai jeu (`node scripts/budgets.mjs`).

### Ce que disent les mesures

- **Les appels de rendu ne bougent pas** (≈ 120 par image dans toutes les colonnes, la voiture comprise) : tout est fusionné, l'atlas aussi. Le
  temps d'**envoi** du fil principal reste donc le même (≈ 4 à 5 ms au processeur ×4) : aucune direction ne coûte au fil principal en course.
- **A est la plus légère** (−63 % de triangles, −37 % de temps d'image, construction près de trois fois plus rapide) : peu de pièces, matériau
  « toon ».
- **B** coûte **autant que l'existant** (triangles +2 %, image −1 %, construction +15 %) : ses petites pièces sont fusionnées et l'existant a déjà
  un décor dense (la Ville et la Banquise d'aujourd'hui sont plus lourdes que leur version B). Son pire thème est le **Rallye** (mur de pneus : une
  pile tous les 1,1 m, déjà réduite à la moitié visible).
- **C** coûte surtout **à l'image** (+34 % en rendu logiciel) : la piste dessinée une seconde fois dans la carte d'ombres (ombres de contact) et le
  grain ; ses ombres de contact peuvent se couper à la qualité 1 si un téléphone peine.
- **Le mélange** : triangles +8 %, image +17 % (surtout la matière de C), construction −4 % en moyenne ; **son pire thème reste sous le pire de
  l'existant** (Rallye : 141 k triangles, 249 ms, contre la Ville d'aujourd'hui : 168 k, 306 ms). Par thème, il allège la Ville (×0,47 en
  triangles), la Banquise (×0,54) et la Nuit (×0,84), et charge le Rallye (×2,3), le Stade (×1,8) et le Col (×1,6), qui avaient le moins de décor.
- La **construction** d'une scène du mélange (0,33 s en moyenne au processeur ×4, 0,46 s au pire) reste sous celle de l'existant (0,35 s, 0,59 s
  pour la Ville) ; elle compte à l'accueil et à la bascule du Salon (construite pendant le podium).

## 6. Règles de pose (lot 37) et ce qu'on a appris du décor

- Le décor des directions suit les règles du lot 37 telles que l'énoncé les donne (aucun élément en l'air, rien dans le passage, chaque élément a
  un rôle) : `placesDeDecor` laisse vide toute cellule **entourée par la piste** (intérieur d'un virage ou d'une épingle), rien ne flotte (tribune et
  tour de chronométrage sur un socle plein jusqu'au sol), chaque recette dit le rôle de ses pièces. **À aligner sur le README du lot 37 à sa
  fusion** (ses règles exactes et ses tests).
- **Le décor au sol est toujours au moins 8 m sous la piste** (le sol lointain est à `voidY − 4`, soit 8 m sous la route la plus basse) : depuis la
  caméra de poursuite on le voit en contrebas, souvent caché par les rebords. **L'identité d'un thème vient donc d'abord de ce qui est à hauteur de
  piste** — rebords, portiques, panneaux, poteaux, lampadaires — **et de l'horizon, du ciel et de la lumière** : c'est ce que la recommandation
  privilégie (et pourquoi le décor peut arriver après la piste). Relever le sol près de la piste (talus) est une autre question (question 4).
- La route de A au Rallye était brune au premier essai : on la confondait avec la terre d'un bloc. **Règle : la route est un gris** (jamais brun,
  jamais vert ; testé).

## 7. Plan des lots de mise en œuvre (proposition)

| Ordre | Lot | Contenu | Budget du premier chargement | Critère |
|---|---|---|---|---|
| 1 | **Socle de la scène** | `route.ts` et `composer.ts` deviennent la scène du jeu (`trackMesh.ts` ne garde que palettes et réexports) ; l'existant reproduit **à l'identique** (direction « origine », décor du lot 37 déplacé tel quel) ; miniatures comprises ; le mécanisme du morceau « décor à la demande » (vide) | ≈ +2 ko (ce que le compositeur garde de plus que `buildTrackScene`) | captures avant / après identiques au pixel près (rendu logiciel), golden et miniatures inchangés |
| 2 | **Éléments de course** | portique-cartouche et feux, arrivée, arche du contrôle, plaques, panneaux, vibreurs, lignes, bord du vide (le mélange) ; feux synchronisés au décompte (question 6) | ≈ +3 ko | vitrine et jeu identiques sur ces éléments ; lisibilité vérifiée sur téléphone |
| 3 | **Lumière et horizons par thème** | `appliquerLumiereC` dans la scène, horizons par thème, éclairage de piste de la Nuit | ≈ +2,5 ko | Stade et Nuit séparés (test), temps d'image ≤ existant + 10 % |
| 4 | **Rebords par thème** | profils de B, couleurs de A, catadioptres | ≈ +2 ko | Rallye mesuré sur un vrai téléphone |
| 5 | **Décor à la demande, thème par thème** | `DECOR_M` + matière de C (occlusion, grain, sol, ombres de contact, lampes) dans un morceau chargé pendant l'accueil ; deux lots : Stade, Rallye, Campagne, Canyon ; puis Banquise, Col, Ville, Nuit | 0 (≈ +0,3 ko de chargeur) ; **morceau ≤ 16 ko** | jamais pendant une course, aucune image qui saute, Salon inchangé |

Chaque lot remesure avec la vitrine (qui reste le banc d'essai : elle montre l'existant tel qu'il devient) et met à jour `budgets.md`.

## 8. Questions pour Nathan

1. **Le choix**, élément par élément et thème par thème (A, B, C, mélange, ou « l'existant suffit »), sur l'aperçu.
2. **Stade et Nuit** : le défaut relevé était-il bien celui-là (même famille de couleurs, nuit éclairée partout) ? Sinon, où le voyais-tu
   (accueil, miniatures, course) ?
3. **La charte en 3D** : la règle « ni flou ni dégradé » vaut-elle pour toute la scène (A : ciel en aplats, lumière en trois tons) ou seulement pour
   les éléments graphiques, la lumière restant continue (recommandé) ?
4. **Le décor en contrebas** : garder le sol lointain 8 m sous la piste (le vide se lit, le décor se voit peu), ou relever le sol près de la piste
   (talus) pour que le décor se voie depuis la voiture (un autre lot, qui touche la lecture du vide) ?
5. **Panneaux de distance** (deux traits, un trait) avant les virages serrés : oui, non ?
6. **Feux de départ** qui s'allument au « 3, 2, 1 » et s'éteignent au « PARTEZ ! » (présentation seule) : oui, non ?
7. **Rallye** : le mur de pneus est le poste le plus lourd ; à confirmer sur ton téléphone (« Agrandir et mesurer ») avant le lot 4.
8. **Sponsors fictifs** (VOLTA, MISTRAL, PNEUS ROC… et « DU JOUR ») : d'accord pour en mettre dans le jeu ?
9. **Budget** : d'accord pour ≈ +9 ko au premier chargement (il resterait ≈ 12 ko de marge) et une ligne « décor 3D à la demande » à 16 ko ?
10. **La palette `neon`**, sans thème : la retirer, ou la garder pour un thème futur ?

## 9. Vérifié, non vérifié

- **Vérifié (ici, Chromium 141 en rendu logiciel)** : `e2e/vitrine.spec.ts` (ordinateur : les 14 sections × 5 colonnes se construisent et se
  dessinent sans aucune erreur ; téléphone 390 × 844 : rien ne déborde, cibles de 44 px, vue agrandie qu'on tourne au doigt et qu'on mesure ; axe :
  aucune violation grave) ; `e2e/perf.spec.ts` vert (le jeu construit est identique à `main`) ; `apps/web/test/scene.test.ts` (règles de pose,
  route paramétrable, occlusion, palettes) ; `npm test` ; `npm run typecheck` ; captures et mesures de ce README.
- **Non vérifié** : un vrai téléphone (le temps d'image réel : à faire par Nathan sur l'aperçu) ; Firefox et WebKit (la vitrine y est sautée :
  rendu 3D de dizaines de scènes, Chromium seulement) ; l'aperçu de la PR et la CI (au moment d'écrire ces lignes : voir la PR) ; les règles exactes
  du lot 37 (pas encore fusionné).
- **Décisions laissées à Nathan** : § 8.

## 10. Fichiers

- Vitrine : `apps/web/vitrine/index.html`, `vitrine.css`, `construire.mjs`, `poids-parties.mjs` ; `apps/web/vite.vitrine.config.ts` ;
  `apps/web/src/vitrine/` (`vitrine.ts`, `vues.ts`, `sujets.ts`, `variantes.ts`, `mesures.ts` écrit par la mesure) ; `npm run build` de
  `apps/web` lance la construction de la vitrine.
- Directions : `apps/web/src/scene/` (`route.ts`, `composer.ts`, `outils.ts`, `pieces.ts`, `types.ts`, `origine.ts`, `directionA.ts`,
  `directionB.ts`, `directionC.ts`, `textures.ts`, `directionM.ts`).
- Tests et outils : `apps/web/e2e/vitrine.spec.ts`, `mesure-lot38.spec.ts` (`MESURE=1`), `captures-lot38.spec.ts` (`CAPTURES=1`),
  `apps/web/test/scene.test.ts` ; `durees.json` (+ `vitrine.spec.ts`, 150 s).
- Documents : ce README, `lot-38-direction-scene/direction.md` (projet), les captures `lot-38-direction-scene/*.jpg` ; `apps/web/CLAUDE.md`
  (« Vitrine de la scène (lot 38) ») ; `docs/orchestration.md` (ligne du lot 38).
- Exemption : `packages/ui/test/applications.ts` (`apps/web/src/vitrine` : outil interne, en français).
