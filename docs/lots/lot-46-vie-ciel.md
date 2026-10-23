# Lot 46 — Track : la vie et le ciel (sans passe plein écran)

Branche `claude/elegant-bohr-s8nb0v` (nom imposé par la session ; le lot prévoyait `lot-46-vie-ciel`, d'où l'étiquette `jeu:track` sur la PR pour le job
`zones`), partie de `main` à `9f9a80a` (lot 43 fusionné), `main` fusionné ensuite à `42154b6` (retouche 40b : la voiture civile et les modèles en jeu). Zones : `apps/web/**`, `docs/lots/**`, les lignes de Track de `docs/plateforme/budgets.md`, son entrée
de `durees.json`. **Rien dans `sim`** : golden, `SIM_VERSION`, `GENERATOR_VERSION`, rediffusions, classements, identifiants de circuit inchangés. Aucune clé de
catalogue (les pas n'ont pas de texte ; la page d'admin est un outil interne, en français). PR : [Nathan-Te/DailyTrack#125](https://github.com/Nathan-Te/DailyTrack/pull/125) (brouillon ; l'aperçu est commenté par la CI).

## En deux phrases

Les pas **« vie »** (drapeaux qui ondulent sur les portiques et la tribune, foule de la tribune du départ qui sautille, écrans à diodes qui font défiler les
sponsors du lot 43 et chronomètre du portique, particules du thème — au Stade, **des confettis à l'arrivée seulement**) et **« ciel »** (dôme et nuages qui
dérivent, brume de profondeur teintée du soleil) sont en jeu, **chacun un module chargé à la demande, un appel de rendu au plus par famille, aucune passe plein
écran** ; avec les **ombres fines** (carte 2048 posée devant la voiture), ils font le **palier 3** (ordinateur), et le **groupe « vie et ciel »** est prêt pour
le palier 2 des téléphones récents (la règle automatique du lot 45). En attendant le lot 45 : `?palier=3` ou `?reglages=2+vie+ciel`, recette et aperçus seulement.

## À tester (aperçu de la PR, au téléphone ; le lien de l'aperçu est commenté sur la PR)

Ajouter ces chemins à l'adresse de l'aperçu (`https://<aperçu>/track/…`) :

| Quoi | Lien |
|---|---|
| **Téléphone : palier 2 + vie et ciel**, compteur d'images | `/track/?home=0&reglages=2+vie+ciel&debug` |
| Le même sans (le palier 1, pour comparer les images par seconde) | `/track/?home=0&debug` |
| **Ordinateur : palier 3** (vie, ciel, ombres fines) | `/track/?home=0&palier=3&debug` |
| **Les confettis du Stade** : terminer la course, ils tombent au passage de la ligne | `/track/?seed=2026-10-08&home=0&reglages=2+vie+ciel&debug` |
| La Nuit (lune, étoiles, lucioles, nuages sombres) | `/track/?seed=2026-10-14&home=0&reglages=2+vie+ciel&debug` |
| La Banquise (neige) | `/track/?seed=2026-10-10&theme=banquise&home=0&reglages=2+vie+ciel&debug` |
| Un pas ou une partie coupés, pour lire leur coût au compteur | `…&reglages=2+vie` · `…&reglages=2+ciel` · `…&reglages=3-particules` · `…-drapeaux`, `-foule`, `-ecrans`, `-nuages`, `-brume`, `-ombres` |
| Le Salon au palier 3 | `/track/?mode=salon&api=demo&palier=3&debug` |

Le compteur de `?debug` (en bas à gauche) donne les images par seconde et la pire image de la dernière seconde ; `&fps=0` le coupe. **Le coût réel de ces pas est
sur la carte graphique** (sommets animés, points translucides) : le rendu logiciel de la CI ne le mesure pas, **à lire chez toi**, au Pixel 7, sur Stade, Nuit et
Ville, avec et sans `reglages=2+vie+ciel`. La page d'admin (`/track/admin/`) a une case « Scène (palier) » qui fait les mêmes liens.

## 1. Ce qui a bougé dans le code

- **Deux pas, deux modules à la demande** (`PAS_DU_JEU`, un `import()` chacun, enregistrés par `main.ts`), qui se branchent en se chargeant (`brancherPas`,
  `scene/socle.ts`) :
  - **`scene/vieJeu.ts` (« vie »)** — reprend `vie.ts` de la vitrine (retouche 38b) : `elements` pose dans les calques les drapeaux des portiques de départ et
    d'arrivée (en haut des piliers, hampes comprises) et ceux des trois mâts du toit de la tribune, les écrans du départ (sur les rebords de la ligne droite), le
    ruban de la façade de la tribune et le chronomètre au-dessus de la poutre du portique de départ (dans son caisson) ; `poser` construit les maillages
    (drapeaux déformés par la carte graphique, foule, écrans, particules) et rend leur animation.
  - **`scene/cielJeu.ts` (« ciel »)** — reprend `lumiere3.ts` : le dôme dessiné (dégradé, lueur du soleil, nuages par thème qui dérivent) et la brume de
    profondeur (brume de hauteur dense au ras du sol lointain, qui prend la couleur du soleil — posé du bon côté depuis le lot 43 — quand on le regarde).
  - **`scene/ombres3.ts` (« ombres »)** : carte d'ombres 2048 sur 120 m posée 34 m devant la voiture (au lieu de 1024 sur 84 m, 24 m devant), le décor
    projette aussi ; un réglage du compositeur, ce module n'en porte que les nombres.
- **Le palier 1 du jeu (`composerP1.ts`, premier chargement) n'importe aucun pas** : il appelle leurs crochets (`PasScene`, `scene/types.ts` : `elements`,
  `poser`, `ombres`, `foule`) et expose `TrackScene.animer(t, caméra, hauteur)` et `TrackScene.arrivee(t)`. Les paliers 2 et 3 du jeu sont le palier 1 et leurs
  pas (`composer(track, palette, palier, options, plus)` : les pas du palier, plus ceux demandés en plus, moins ceux coupés).
- **Où ils s'activent** (`socle.ts`) : `PAS_DU_PALIER.P3 = ["vie", "ciel", "ombres"]` ; **`GROUPE_VIE_CIEL = ["vie", "ciel"]`**, que la règle automatique du
  lot 45 ajoutera au palier 2 des téléphones récents (`reconstructeur.demander("P2", GROUPE_VIE_CIEL)` : le reconstructeur prend maintenant un palier **et des
  pas en plus**, chargés ensemble, appliqués ensemble hors course). Le palier 2 n'a pas encore de pas à lui (sa finition est le lot 45) : `?reglages=2+vie+ciel`
  montre donc aujourd'hui le palier 1 avec la vie et le ciel — ce que verra un téléphone récent une fois le lot 45 fait, sa finition en moins.
- **Adresses** (`sceneDemandee`, `access.ts`, à la place de `palierDemande`) : `?palier=1|2|3|existant`, `?reglages=<palier>[+module|-pas…]` (`2+vie+ciel`,
  `3-ombres`, `3-particules`) — **recette et aperçus seulement**, jamais en production (`?prod` les ignore), sans rien enregistrer. Un `+` écrit tel quel dans
  une adresse se lit comme une espace : il est rétabli (défaut trouvé par le test). Page d'admin : « Scène (palier) » (`SCENES_ADMIN`).
- **La tribune confie ses spectateurs à la foule animée** (`decorGeometry`, `trackMesh.ts`, `TribuneVie`) : quand le pas « vie » est là, ils ne sont plus
  dessinés dans le décor (mêmes tirages au sort : le reste du décor ne bouge pas, testé) ; la tribune dit aussi où sont sa façade et le haut de son toit.
- **`main.ts`** : enregistrement des trois modules, la scène de départ au palier et aux pas demandés (chargés avant la première scène : hors course),
  `view.animer(now / 1000, …)` juste avant `renderer.render` (le temps de l'image), `view.arrivee(…)` au passage de la ligne (course du jour et Salon),
  `__cdj.socle.plus()`, `__cdj.render.pas` (`?debug`).

## 2. Les règles de la mise en jeu, et ce qu'elle a révélé (corrigé)

- **Un appel de rendu au plus par famille** : drapeaux (un maillage), foule (un maillage), écrans (un maillage : rubans **et** chronomètre — la vitrine ne
  posait pas le chronomètre ; en jeu il aurait fait un deuxième appel, d'où un nuanceur qui lit deux textures, `ecransEtChrono`), particules (un nuage de points),
  nuages (le dôme) ; la brume n'ajoute aucun appel. Testé sur quatre thèmes (`test/vieCiel.test.ts`) et dans le jeu (`e2e/vie-ciel.spec.ts`, `__cdj.render.pas`).
- **Rien d'animé dans le champ de la piste devant la voiture** : drapeaux, foule, écrans et chronomètre sont à côté de ce que roule la voiture, ou à plus de
  8 m au-dessus (testé sur Stade, Nuit, Banquise et Ville contre `trackWorld`) ; **les drapeaux ne projettent pas d'ombre** (dans la vitrine, si : elle ondulait
  sur la route) ; les particules **s'effacent dans le couloir de la piste devant la caméra** (7 m de part et d'autre de l'axe du regard, fondu jusqu'à 10 m, de
  2 m derrière l'œil au bord de leur boîte, sous 5 m au-dessus de l'œil), **à moins de 4 m de l'objectif** (entières à 8 m ; la vitrine : 0,8 à 2,5 m) et
  **jamais plus de 24 pixels** (la vitrine : 48) — jamais une particule plein écran devant l'objectif. La vitrine suit maintenant les mêmes règles.
- **Les animations suivent un temps d'affichage** (celui de l'image, `requestAnimationFrame`), jamais l'état de la course : testé (le même temps donne les
  mêmes valeurs, rien d'autre n'est lu). Le chronomètre du portique compte ce temps-là. Seuls les feux du lot 43 lisent le décompte.
- **Au Stade, des confettis à l'arrivée seulement** (décision du 23/10) : pas de particules d'ambiance ; au passage de la ligne, une salve (elle monte en
  0,4 s, s'efface entre 5 et 8 s ; invisible le reste du temps, donc rien à dessiner). **La foule seulement dans la tribune du départ** (décision du 23/10) : la
  seule tribune du décor d'aujourd'hui.
- **La Nuit garde son ciel de nuit** : son dôme est sombre (zénith et nuages sombres, testé), la lune et les étoiles du palier 1, transparentes, sont dessinées
  après lui ; ses particules sont des lucioles.
- **Les écrans font défiler les sponsors fictifs du lot 43** (`sponsors.ts`, encre atténuée : jamais plus lisibles qu'un panneau de course) — la vitrine
  montrait encore ceux de la direction B ; corrigé pour les deux.
- **Aucune classe de three.js de plus** : `InstancedMesh` (la foule de la vitrine) et `SphereGeometry` (son dôme) entraient dans le morceau partagé de three.js,
  donc **au premier chargement** (+1 046 o mesurés). La foule est un maillage fusionné (même appel unique, même nuanceur, les sommets portent le rythme de leur
  spectateur) et le dôme un cube (le nuanceur ne lit que la direction, exacte sur une face plane). Écrit dans `apps/web/CLAUDE.md`.
- **Poids** : premier jet 10,1 ko à la demande. Pour tenir les 8 ko : les nuanceurs marqués `/* glsl */` sont resserrés à la construction (`outils/glsl.ts`,
  un greffon de Vite : commentaires et indentation retirés, chaque ligne gardée — −0,8 ko ; il resserre aussi ceux du premier chargement) ; le mouvement des six
  sortes de particules est une table au lieu de six branches du nuanceur ; les réglages du ciel (`CIEL_3`, lumiere3.ts) et des particules (`PARTICULES_3`,
  vie.ts) sont séparés de l'étalonnage, du halo et des reflets (`themes3.ts`, la vitrine), pour que « vie » et « ciel » n'aient pas de morceau commun ; les
  drapeaux ont leur module (`drapeaux.ts`, sans la banderole souple que rien ne posait ; `verserDrapeaux` pour le palier 2) ; la brume sans la branche des
  instances ; les écrans sans brume (des diodes, tout près du départ).

## 3. Planches, sans / avec

**Outil** (hors CI) : `e2e/captures-lot46.spec.ts` — l'outil du lot 43 rejoué sur **la même construction** : « sans » = le palier 1, « avec » = `?palier=3`.
Un circuit de chaque thème (les jours du lot 37) : départ, premier tremplin ou bosse, virage serré, arrivée, miniature ; au Stade, en plus, juste après la ligne
(les confettis) ; plus l'accueil et le Salon. La vie bouge : deux captures d'un même moment ne sont jamais identiques au pixel, aucune comparaison chiffrée.

**Planches** (sans à gauche, avec à droite) : [Stade](lot-46/planches/stade.jpg) (avec les confettis juste après la ligne) · [Nuit](lot-46/planches/nuit.jpg) ·
[Rallye](lot-46/planches/rallye.jpg) · [Banquise](lot-46/planches/banquise.jpg) · [Campagne](lot-46/planches/campagne.jpg) · [Canyon](lot-46/planches/canyon.jpg) ·
[Col alpin](lot-46/planches/col.jpg) · [Ville](lot-46/planches/ville.jpg) · [Accueil et Salon](lot-46/planches/accueil-salon.jpg). Images seules :
`docs/lots/lot-46/sans/`, `docs/lots/lot-46/avec/`.

Ce qui se voit : les drapeaux en haut des piliers des portiques et sur le toit de la tribune, le chronomètre au-dessus du portique de départ, les rubans de
sponsors sur les rebords du départ et la façade de la tribune, la foule (plus grande que les petites boîtes d'avant : de vrais spectateurs, qui sautillent), les
nuages, la brume au loin (plus dense en contrebas, teintée du soleil quand on le regarde), les ombres fines (le décor projette : les immeubles de la Ville sur la
route). Les particules sont discrètes sur une image fixe (petites, jamais devant la voiture : c'est voulu) ; elles se voient en mouvement. La miniature ne change
pas (vue aérienne : aucun pas). **Sur les planches du Stade, les gros ronds flous devant la voiture à l'arrivée sont les confettis du lot 9** (`fx.ts`, effets de
la course, présents sans et avec) : pas ceux du pas « vie » (voir § 8).

## 4. Ce que coûte chaque pas (mesuré)

**Profil** (`MESURE=1 PERF_OUT=docs/lots/lot-46/mesure.json npx playwright test mesure-lot46 --project=chromium`) : Chromium en rendu logiciel, paysage
844 × 390 @2, **processeur ×4**, qualité 2, au départ d'une course, sur le Stade, le Rallye, la Nuit et le Col (les thèmes du 38b), **la même construction**
pour toutes les colonnes (`?reglages=`). Chiffres bruts : `docs/lots/lot-46/mesure.json`.

### Les paliers

| | Palier 1 (le jeu) | Palier 2 + vie et ciel (téléphone récent) | Palier 3 (ordinateur) |
|---|---|---|---|
| Appels de rendu par image | 30 · 30 · 36 · 30 | 34 · 35 · 41 · 35 (**+4 à +5**) | 35 · 36 · 42 · 36 (**+5 à +6**) |
| Triangles par image (ombres comprises) | 47 478 · 60 712 · 100 172 · 81 559 | 49 430 · 62 628 · 102 148 · 83 391 (**+1 950**) | 58 682 · 79 344 · 134 812 · 117 974 (**+11 200 à +36 400**) |
| Programmes compilés | 16 · 16 · 20 · 15 | +5 à +6 | +5 à +6 |
| Construction de la scène (ms, moyenne des quatre) | 674 | 792 (+118) | 762 (+88) |
| Passe plein écran, cible de rendu | aucune | **aucune** | **aucune** |

(Stade · Rallye · Nuit · Col.) Au Stade, un appel de moins que sur les autres thèmes : ses particules n'existent qu'à l'arrivée (rien à dessiner avant).

### Chaque pas

| Pas | Appels | Triangles | Programmes | Mémoire (calculée) | Poids à la demande | Ce qui coûte sur la carte graphique |
|---|---|---|---|---|---|---|
| **vie** (au-dessus du palier 1) | +3 (Stade) à +4 | +1 940 à +1 980 | +3 à +4 | ≈ 0,5 Mo (ruban 1024 × 64, chronomètre 256 × 128) | vieJeu 5 035 o | sommets animés (drapeaux, foule), points translucides (particules) |
| · drapeaux | 1 | +328 | 1 | — | — | ≈ 110 triangles par drapeau, déformés à chaque image |
| · foule | 1 | ≈ 0 net (les spectateurs quittent le décor : 24 triangles chacun au lieu d'une boîte et de son ombre) | 1 | — | — | ≈ 125 spectateurs, 48 sommets chacun, qui sautillent |
| · écrans (rubans et chronomètre) | 1 | +76 | 1 | ruban et chronomètre | — | deux textures lues ; le chronomètre redessiné dix fois par seconde au plus (128 Ko envoyés) |
| · particules | 1 (0 au Stade avant l'arrivée) | 0 (des points) | 1 | — | — | 420 à 1 400 points translucides (neige : 1 400 sur la Banquise, 800 au Col) |
| **ciel** (au-dessus du palier 1) | +1 | +12 | +2 | ≈ 0,35 Mo (nuages 256 × 256 et leurs réductions) | cielJeu 2 850 o | le dôme : un calcul de ciel par pixel du fond |
| · nuages | 1 | +12 (un cube) | 1 | nuages | — | — |
| · brume | 0 | 0 | 0 à 1 (une variante de chaque matériau) | — | — | quelques opérations de plus par pixel |
| **ombres** (palier 3 seulement) | +1 (le décor projette) | **+10 800 (Stade) à +36 000 (Col)** | 0 | **+12 Mo** (carte 2048² au lieu de 1024²) | ombres3 150 o | la passe d'ombre redessine le décor |

- **Construction** : dans le bruit de la mesure (±200 ms d'un chargement à l'autre au profil téléphone), sauf **le ciel**, qui dessinait au premier jet sa
  texture de nuages en 512 × 512 (bruit fractal, ≈ +300 ms à processeur ×4) : **corrigé en 256 × 256** (mêmes sept octaves, quatre fois moins de calcul ;
  ≈ +80 ms aujourd'hui ; une texture par couverture de nuages, gardée pour les scènes suivantes, donc pour la bascule du Salon). La vitrine aussi.
- **Envoi** (temps de `renderer.render`, fil principal) : 3 à 14 ms par image selon les essais, sans écart qui sorte du bruit : les pas n'ajoutent que
  quelques appels, et l'animation (`animer`) ne fait que régler des uniformes.
- **Les ombres fines sont le seul pas cher** (triangles de la passe d'ombre, 12 Mo de carte) : c'est pour cela qu'elles ne sont pas dans le groupe des
  téléphones. La vie et le ciel tiennent la promesse du 38b : **un appel chacun, aucune cible plein écran** ; leur coût réel est sur la carte graphique
  (sommets animés, points translucides, un dôme calculé par pixel) : **à lire au compteur de `?debug`**, au téléphone.

## 5. Budget

Mesure : `npm run build && node scripts/budgets.mjs` (la mesure unique `mesureTrack`), `main` construit à part, puis la branche — avant la fusion (`main` à
`9f9a80a`) et après (`main` à `42154b6`, retouche 40b comprise) : le même écart à 20 o près.

| Ligne | `main` (`42154b6`) | Lot 46 | Écart (avant la fusion de la 40b : 268 789 → 270 010) |
|---|---|---|---|
| JS + CSS du premier chargement | 276 301 | 277 542 | **+1 241** (+1 221) |
| JS | 264 889 | 266 130 | +1 241 |
| hors three.js | 131 346 | 132 580 | +1 234 |
| three.js | 133 543 | 133 550 | +7 |
| CSS, catalogue anglais, fils de travail, polices | — | inchangés | 0 |
| page d'admin (hors premier chargement) | 11 084 | 11 156 | +72 (la case « Scène (palier) ») |
| **vie et ciel à la demande** (nouvelle ligne, plafond **8 000**) | — | **7 885** (vieJeu 5 035, cielJeu 2 850) | marge 115 |
| ombres fines à la demande (plafond 500) | — | 150 | — |

- **Premier chargement : +1 241 o** (le lot 38b prévoyait 0 ; c'est au-dessus du ko de la règle commune : justifié ici). Ce qu'il paie : les crochets des pas dans
  le palier 1 (`composerP1.ts` : pièces dans les calques, maillages, animation, arrivée, ombres fines, ce que chaque pas dit à `?debug`) ≈ 0,5 ko ; la lecture de
  `?palier=` et `?reglages=` (`access.ts`), les pas en plus du reconstructeur et le registre des pas branchés (`socle.ts`) ≈ 0,3 ko ; les trois `import()` et leurs
  listes de préchargement, la foule confiée par la tribune (`trackMesh.ts`) ≈ 0,4 ko. **Essayé et abandonné** : laisser la tribune ne confier que des nombres et
  calculer les positions dans le pas « vie » : −64 o au premier chargement, +214 o à la demande (la ligne de 8 ko ne le permettait pas). **Évité** : `InstancedMesh`
  et `SphereGeometry` entraient dans le morceau partagé de three.js (+1 046 o au premier chargement) ; le resserrage des nuanceurs rend ≈ 120 o au premier
  chargement (ceux des effets et de la voiture). Marge de Track : 15 299 → **14 058 o** (après la 40b), plafonds inchangés ; `docs/plateforme/budgets.md` à jour.
- **À la demande : 7 885 o sur 8 000** (premier jet : 10,1 ko ; ce qui a été fait pour tenir : § 2, « Poids »). Gardé par `e2e/perf.spec.ts` (les morceaux et
  ce qu'ils tirent hors du premier chargement). **La ligne n'est pas encore dans le tableau de `budgets.md`** : chaque ligne du tableau doit avoir sa limite lue
  par `apps/portail/test/budgets.test.ts` (zone partagée) — décrite dans la section « Lot 46 » de `budgets.md`, à ajouter par un lot de plateforme.
- Rien du lot 36 ne revient (générateur, Salon) ; aucun module des pas au premier chargement (`test/socle.test.ts`, `e2e/perf.spec.ts`).

## 6. Tests

- `test/vieCiel.test.ts` (nouveau, 11 tests) : adresses (`?palier=`, `?reglages=`, production, illisibles) et page d'admin ; les ombres fines dans le seul palier
  3 ; **un appel par famille** sur quatre thèmes ; les parties coupées ne sont pas posées et la foule coupée revient dans le décor, **le reste du décor
  identique** ; **rien devant la voiture** (drapeaux, écrans, chronomètre, foule contre `trackWorld`, quatre thèmes) ; **l'animation ne dépend que du temps
  d'affichage** ; les confettis du Stade (invisibles avant, une salve de 8 s après la ligne ; la Ville garde sa poussière) ; le ciel de la Nuit ; le
  resserrage des nuanceurs.
- `test/socle.test.ts` : le palier 3 = vie + ciel + ombres, `GROUPE_VIE_CIEL`, **chaque pas a son `import()` dans `main.ts`** ; un palier reçoit ses pas, ceux
  en plus, moins ceux coupés ; un pas pas branché est une erreur ; le reconstructeur avec des pas en plus ; le graphe des imports statiques depuis `main.ts` ne
  tire aucun des nouveaux modules (`vieJeu`, `cielJeu`, `ombres3`, `drapeaux`, `themes3`).
- `e2e/vie-ciel.spec.ts` (nouveau, 4 tests, `durees.json`) : `?palier=3` charge les trois modules **avant la course** (la scène est au palier 3 dès le
  décompte), un appel par famille, carte d'ombres 2048, rien avec `?prod` ; `?reglages=2+vie+ciel` sans les ombres fines ; **demandés en pleine course, ils se
  chargent mais la scène ne change qu'à la pause** ; **au Stade, aucun confetti pendant la course, une salve au passage de la ligne** (rediffusion du pilote),
  qui se voit puis s'efface.
- `e2e/perf.spec.ts` : la ligne « vie et ciel à la demande » (8 000 o), les ombres (500 o), aucun module des pas au premier chargement.
- Outils (hors CI, `durees.json` à 0) : `captures-lot46.spec.ts`, `mesure-lot46.spec.ts`.

## 7. Vérifié, non vérifié

**Vérifié** (en local) : `npm run typecheck` ; `npm test` (les deux projets : 199 fichiers et 2 594 tests en SQLite, tous verts ; en libSQL, un test de
l'API, `planning.test.ts`, a dépassé ses 5 s pendant que les captures chargeaient la machine — relancé seul : 16 sur 16, vert ; hors des zones du lot) ;
e2e Chromium, un à la fois, sur la construction finale : `vie-ciel` (4), `perf` (6), `socle` (3), `vitrine` (7), `vitrine-voiture` (2), `scene`, `juice`, `admin` — 40 sur 40 ; captures et planches des huit thèmes, sans et avec ;
mesures au profil téléphone (deux passes) ; budget par `scripts/budgets.mjs` et `apps/portail/test/budgets.test.ts` ; golden et identifiants de circuit (aucun
fichier de `packages/sim` touché) ; zones de la PR (`scripts/zones-jeu.mjs --etiquettes '["jeu:track"]'`).

**Non vérifié** : **le temps d'image sur un vrai téléphone** (rendu logiciel seulement : c'est la mesure qui compte pour décider du groupe « vie et ciel » au
palier 2, « À tester ») ; Firefox et WebKit (la CI de la PR lance le sous-ensemble multi-navigateurs) ; la chauffe d'un téléphone après plusieurs courses.

## 8. Pour Nathan (décisions et questions)

1. **Le groupe « vie et ciel » au palier 2 des téléphones récents** : prêt (`GROUPE_VIE_CIEL`), à confirmer par ton Pixel 7 — `?reglages=2+vie+ciel&debug`
   contre `?home=0&debug` sur Stade, Nuit, Ville. Si une partie coûte trop, elle se coupe seule (`…-particules`, `…-foule`) : dis laquelle, le lot 45 peut
   garder le groupe sans elle.
2. **Premier chargement +1 241 o** pour les crochets (prévu : 0) : accepter, ou demander un lot qui les allège (piste : sortir la lecture de `?reglages=` dans un
   module chargé seulement quand l'adresse en a un).
3. **Ligne « vie et ciel à la demande »** : 7 885 o pour un plafond de 8 000 (115 o de marge) — le lot 47 (post-traitement) aura sa propre ligne ; tout ajout à
   la vie ou au ciel devra en retirer ailleurs. À inscrire dans le tableau de `budgets.md` par un lot de plateforme (le test du tableau est en zone partagée).
4. **La foule** : de vrais petits spectateurs (1,3 m) qui sautillent, à la place des boîtes du décor d'aujourd'hui, seulement dans la tribune du départ. Le
   lot 44 (décor) pose une autre tribune : le pas « vie » lit la place et les spectateurs que lui confie le décor (`TribuneVie`) ; la tribune de la vitrine
   (`tribuneP`) remplit déjà `Calques.foule`, `drapeaux` et `ecrans` — à raccorder au moment de fusionner les deux lots (le conflit attendu est dans les
   registres des pas et la tribune de `trackMesh.ts`).
5. **Les confettis du lot 9** (`fx.ts`, à l'arrivée, tous les thèmes et tous les paliers) sont de gros ronds flous tout près de l'objectif (planche du Stade,
   colonne « sans » comprise) : la règle « jamais une particule plein écran devant l'objectif » du lot n'est écrite que pour les pas ; les faire suivre la
   même règle (taille plafonnée, effacés près de l'objectif) serait une petite retouche des effets — à décider.
6. **Les ombres fines font projeter le décor** (immeubles de la Ville sur la route : planche Ville) : c'est le pas « ombres » du 38b tel quel, +11 000 à +36 000
   triangles ; à garder sur ordinateur, ou à limiter au décor proche.
