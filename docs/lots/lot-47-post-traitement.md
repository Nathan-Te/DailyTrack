# Lot 47 — Track : le post-traitement, sur ordinateur seulement

Branche `claude/lot-47-post-traitement-jefqws` (nom imposé par la session ; le lot prévoyait `lot-47-post-traitement`, d'où l'étiquette `jeu:track` sur la PR pour le job
`zones`), partie de `main` à `76e0725` (**lots 40c, 45 et 46 fusionnés**). Zones : `apps/web/**`, `docs/lots/**`, la ligne de Track de `docs/plateforme/budgets.md`, son entrée de
`durees.json`. **Rien dans `sim`** : golden, `SIM_VERSION`, `GENERATOR_VERSION`, rediffusions, classements, identifiants de circuit inchangés. Aucune clé de catalogue (la chaîne n'a
aucun texte ; la page d'admin est un outil interne, en français) : `npm run traductions -- --verifier` reste vert. Aucune donnée gardée de plus (`cdj:qualite` existe déjà) : les mentions
légales ne changent pas. PR : À REMPLIR

## En deux phrases

Sur **ordinateur seulement**, le palier 3 a maintenant ses passes plein écran — **l'étalonnage** de chaque thème, **le halo** des lumières fortes (fort la Nuit, discret le jour) et
**l'anticrénelage FXAA** (pas SMAA) —, un module **chargé à la demande** (`postJeu`, 6,8 ko compressés pour une ligne de 7), **jamais sur un téléphone ni sans demi-flottants
rendables**, qui ne s'allume ni ne s'éteint en course et qui, **si le contexte WebGL se perd** (ou si deux images de suite échouent), se coupe à l'instant, laisse la course
continuer et ramène le jeu au palier 2 avec la vie et le ciel. **Pas d'occlusion GTAO**, et GTAO comme SMAA sont **retirés du code**, vitrine comprise.

## À tester (aperçu de la PR, **sur ordinateur** ; le lien de l'aperçu est commenté sur la PR)

Ajouter ces chemins à l'adresse de l'aperçu (`https://<aperçu>/track/…`) :

| Quoi | Lien |
|---|---|
| **Palier 3 avec le post-traitement** (halo, étalonnage, FXAA) : l'étiquette du compteur dit `P3+post` | `/track/?home=0&palier=3&debug` |
| **Palier 3 sans post-traitement**, pour comparer | `/track/?home=0&reglages=3-post&debug` |
| **La Nuit** (lampadaires, plaques, portes : le halo) — avec, puis sans | `/track/?seed=2026-10-14&home=0&palier=3&debug` · `/track/?seed=2026-10-14&home=0&reglages=3-post&debug` |
| Le jour, la peinture claire (Stade, Banquise) : le halo n'y touche pas | `/track/?seed=2026-10-08&home=0&palier=3&debug` · `/track/?seed=2026-10-10&theme=banquise&home=0&palier=3&debug` |
| Une partie coupée, pour lire son coût au compteur | `…&reglages=3-halo` · `…&reglages=3-etalonnage` · `…&reglages=3-fxaa` |
| **La règle automatique** : sur ton PC, l'accueil mesure puis garde le palier 3 avec la chaîne | `/track/?debug&home=1` (puis `__cdj.post` dans la console : voulue, permise, allumée) |
| **Le réglage « Maximale »** | Réglages › Qualité graphique › Maximale (ordinateur : la chaîne ; téléphone : le palier 3 **sans** la chaîne) |

À lire : le compteur de `?debug` (en bas à gauche) donne les images par seconde, la pire image de la dernière seconde et, depuis ce lot, `P3+post` quand la chaîne est allumée.
**Au téléphone, rien ne change** : `/track/?home=0&debug` donne `P2+vie+ciel` (ou `P1`) et jamais `+post` ; même `?palier=3` ou « Maximale » n'y allument pas la chaîne.

## 1. Ce qui a bougé dans le code

- **`scene/post.ts`** (le code de la vitrine, 38b, **sans GTAO ni SMAA**) : `ChainePost` dessine la scène dans une cible en **demi-flottants multi-échantillonnée ×4** (comme l'écran
  du jeu : le FXAA vient en plus), puis `UnrealBloomPass` (le **halo**, réglé par thème), `OutputPass` (tonalité et espace de l'écran), l'**étalonnage** par thème (contraste,
  saturation, teinte des ombres et des lumières) et **`FXAAPass`** — une passe, 2 ko à l'époque du 38b contre 38 pour SMAA. Une cible **refusée** par la carte graphique (framebuffer
  incomplet) est d'abord retentée sans multi-échantillonnage ; refusée encore, `rendre` rend faux et l'appelant dessine directement. Une seule chaîne pour le jeu **et** la vitrine.
- **`scene/postJeu.ts`** (le module à la demande, `PAS_DU_JEU.post`, un `import()` de `main.ts`) : `PostJeu` — la chaîne du jeu, ses parties (`?reglages=3-halo`, `3-etalonnage`,
  `3-fxaa`), ses **garde-fous** (`GardePost`, l'écouteur de `webglcontextlost`) et le pas « post » qu'il enregistre pour la scène (`brancherPas`, sans rien à poser : la scène sait
  ainsi que la chaîne est demandée). `scene/themesPost.ts` : l'étalonnage et le halo de chaque thème, **sortis** de `themes3.ts` (qui les réunit encore avec la brume, les nuages et
  les particules pour la vitrine) : sans cela, la chaîne aurait tiré les tables de la vie et du ciel avec elle. `scene/lineaire.ts` : la linéarisation des nuanceurs d'écran (§ 2).
- **`main.ts`** : `post` se demande **en plus du palier 3** (`sceneDuNiveau(3)`, `plusDepart`) **seulement si `passesPermises(appareil)`** (`postPermis`) ; `suivrePost` allume la
  chaîne ou l'éteint **à l'arrêt seulement** (`arretPost` : accueil, pause, arrivée, podium) — la page qui vient de se charger l'allume avant la première course ; à chaque image
  `post.dessiner(…)` remplace `renderer.render` et rend faux si elle n'a pas pu (on dessine alors directement) ; `couperPost` (perte du contexte, deux images ratées) redescend au
  palier 2 avec la vie et le ciel (`reconstructeur.demander("P2", GROUPE_VIE_CIEL)`, appliqué à la prochaine pause, **jamais avant que le contexte soit revenu** : `contexteHS`) et
  s'en souvient (`apresCoupure`, `qualiteMesure.ts` : `cdj:qualite` = palier 2, plafond durable). `?debug` : `__cdj.post` (voulue, permise, allumée, coupée, parties, échantillons,
  octets, appels de la scène seule), `__cdj.render.moteurImages` ; l'étiquette du compteur d'images dit `P3+post`.
- **Où elle s'active** : `?palier=3` ou `?reglages=3` (recette et aperçus), la règle automatique (l'ordinateur part du palier 3 ; un ordinateur qui tient le palier 3 l'a avec la
  chaîne, et **la mesure de l'accueil la contient** : une mesure ratée la coupe en redescendant au palier 2), le réglage « Maximale » — **partout sous la même condition**,
  `passesPermises` : un ordinateur (pointeur fin, écran large), des demi-flottants rendables, 4 Go au moins quand c'est annoncé, jamais un rendu logiciel. `?reglages=3-post` la coupe ;
  `?reglages=2+post` n'y fait rien. Page d'admin : l'option « Palier 3 sans le post-traitement ».
- **GTAO et SMAA sont retirés du code** : le pas « occlusion » n'existe plus (`paliers.ts`, textes de la vitrine, mesures, scripts), la vitrine montre FXAA ; `test/post.test.ts` lit
  tous les fichiers de `src/` et `perf.spec.ts` toute la construction : ni `GTAO` ni `SMAA` nulle part. (`mesuresPaliers.ts`, « écrit par l'outil de mesure » du 38b, a perdu sa ligne
  « occlusion » à la main : elle n'a plus de pas à décrire ; les chiffres restent dans `lot-38b-paliers-scene.md`.)
- **Le bundle** : `vite.config.ts` laisse les passes de `three/examples/jsm/postprocessing` et `shaders` **dans le morceau du post-traitement** (comme `Reflector` pour le Garage) ;
  rangées avec three.js, elles entraient dans le premier chargement (**+4,7 ko compressés mesurés** pour un téléphone qui ne les affichera jamais). Leurs nuanceurs sont resserrés comme
  les nôtres (`outils/glsl.ts`, −0,2 ko).

## 2. Ce que la mise en jeu a révélé (corrigé, ou à décider)

- **Les passes rangées avec three.js** (ci-dessus) : premier jet à **+5,2 ko** au premier chargement, ramené à ≈ +0,5 ko en gardant les passes dans leur morceau.
- **Les nuanceurs qui écrivent des couleurs d'écran** (halos de `halo.ts`, particules de `fx.ts` : `gl_FragColor = vec4(c, a)` sans les morceaux de colorimétrie de three.js) sortent en
  gros disques pâles dans une chaîne qui dessine en lumière linéaire — le défaut du 38b, qui n'avait été corrigé que **à la construction** de la vitrine (`lineariser`). Dans le jeu la
  chaîne s'allume et s'éteint sur une scène vivante (effets adoptés, décor et halos refaits à la pose du décor) : `lineaire.ts` adapte **à la volée** (`adapter`, à chaque image, un matériau
  adapté une seule fois) et **rend le nuanceur d'origine** (`restituer`) quand la chaîne s'éteint — perte du contexte comprise, où le jeu retombe sur le rendu direct sans attendre la
  reconstruction de la scène. Testé au caractère près (`test/post.test.ts`) ; les nuanceurs qui incluent déjà `colorspace_fragment` (écrans, particules et ciel du lot 46) ne sont pas touchés.
  **Règle écrite dans `apps/web/CLAUDE.md`** : toute nouvelle matière `ShaderMaterial` incluse `<tonemapping_fragment>` et `<colorspace_fragment>`, ou passe par ce chemin.
- **Les compteurs du moteur** : chaque passe plein écran est un `renderer.render`, qui remet à zéro `info.render.calls` : `__cdj.render.calls` aurait donné le dernier quadrilatère. La
  chaîne remet les compteurs à zéro **une fois par image** (`autoReset` coupé le temps de l'image, rétabli dans un `finally`) ; `post.appels` donne la scène seule.
- **Le compteur d'images du moteur repart de zéro à une restauration de contexte** (`renderer.info.render.frame`) : le test de la perte de contexte compare donc ce qui suit la
  restauration, pas ce qui la précède (défaut du premier jet du test : 6 échecs sur 6 avant de le comprendre).
- **Le palier 2 lui-même ne tient pas sans demi-flottants rendables** (constat, hors du lot) : la carte d'environnement des reflets ciblés (lot 45, `PMREMGenerator`) est dessinée dans une
  cible en demi-flottants ; sans l'extension, le moteur signale « Framebuffer is incomplete » à chaque image. Les appareils sans cette extension en WebGL 2 sont rares (de très vieux
  iPhone) ; la règle de qualité ne les écarte pas du palier 2. À trancher : l'ajouter à `passesPermises`… ou plutôt à la règle des **points de départ** (`depart`, lot 45).
- **« Deux mesures ratées de suite font la même chose »** (l'énoncé) : la règle du lot 45 va **plus loin** — dès **la première** mesure ratée au palier 3 (médiane ≥ 22 ms à 60 Hz), la
  scène redescend au palier 2 avec la vie et le ciel (donc **sans la chaîne**), et **la deuxième de suite** rend le plafond durable ; la mesure de l'accueil contient la chaîne, c'est ce
  qui la juge. J'ai gardé cette règle telle quelle (testée : `qualite.spec.ts`, « un ordinateur part du palier 3, descend à 30 ms… »). **En plus**, une chaîne qui échoue **deux images de
  suite** (cible refusée) se coupe d'elle-même — c'est ma lecture de « deux mesures ratées de suite » pour la chaîne elle-même.
- **Une panne n'attend pas la pause** : « la chaîne ne s'allume ou ne s'éteint que hors course » vaut pour les choix (palier, réglage, règle) ; une perte de contexte ou une cible refusée
  coupent la chaîne **à l'instant** — elle ne dessine plus rien, c'est déjà une chaîne éteinte —, le jeu dessine directement dans l'intervalle (aucune image noire) et le palier 2 arrive à
  la pause.

## 3. Planches, sans / avec

**Outil** (hors CI) : `e2e/captures-lot47.spec.ts` — l'outil du lot 46 rejoué sur **la même construction**, **sur ordinateur** (`?appareil=ordinateur` : le navigateur piloté de la CI part sinon
du palier 1) : « sans » = `?reglages=3-post` (le palier 3 **sans** la chaîne : vie, ciel, ombres fines), « avec » = `?palier=3` (la chaîne en plus). Un circuit de chaque thème (les jours
du lot 37) : départ, premier tremplin ou bosse, virage serré, arrivée, miniature ; plus l'accueil et le Salon. La vie bouge (drapeaux, chronomètre) : deux captures d'un même moment ne
sont pas identiques au pixel, aucune comparaison chiffrée ; rendu **logiciel**, 640 × 360 (la chaîne y est la même qu'en carte graphique, pas son coût).

**Planches** (sans à gauche, avec à droite) : [Stade](lot-47/planches/stade.jpg) · [Nuit](lot-47/planches/nuit.jpg) · [Rallye](lot-47/planches/rallye.jpg) ·
[Banquise](lot-47/planches/banquise.jpg) · [Campagne](lot-47/planches/campagne.jpg) · [Canyon](lot-47/planches/canyon.jpg) · [Col alpin](lot-47/planches/col.jpg) ·
[Ville](lot-47/planches/ville.jpg) · [Accueil et Salon](lot-47/planches/accueil-salon.jpg). Images seules : `docs/lots/lot-47/sans/`, `docs/lots/lot-47/avec/`.

Ce qui se voit : **la Nuit** change le plus — les lumières fortes débordent (les feux des rebords du départ, la poutre lumineuse des portes de contrôle, les plaques, les néons de
l'arrivée), le ciel et le bleu de la route gagnent en contraste. **Le jour, presque rien ne change, c'est voulu** : un étalonnage léger par thème (le Stade un peu plus saturé, la
Banquise plus froide, la Ville plus grise) et, **sur le blanc, aucun halo** — la peinture blanche de la route, les rebords, la neige et les damiers restent mats (§ 5). Le FXAA se voit aux
bords fins et lointains (câbles et rebords des portiques, bordures) ; à 640 × 360 en rendu logiciel la différence est mince, **elle se juge à l'œil sur ton écran**. La miniature ne change pas
(vue aérienne : aucune passe). **Le cas le plus fort est le premier tremplin de la Nuit** ([`avec/nuit-tremplin.jpg`](lot-47/avec/nuit-tremplin.jpg)) : la poutre lumineuse d'une porte de
contrôle, au loin, se couronne d'un halo large — c'est « fort la Nuit », mais c'est le premier réglage à retoucher si tu le trouves trop (§ 9, n° 1).

## 4. Mémoire des cibles de rendu

Les cibles ont **la taille réelle de l'image** (le tampon de dessin du moteur : largeur × hauteur × densité, jamais plus) et suivent ses changements de taille. **Mesuré dans le jeu**
(`__cdj.post.octets`, au rendu logiciel : la mémoire d'une cible ne dépend pas de la carte graphique ; ce sont les octets que les cibles demandent, **un plafond** : sur une carte à
carreaux, les échantillons du multi-échantillonnage restent souvent dans la puce).

| Taille de l'image | Pixels | Multi-échantillonnage | Octets par pixel | **Mémoire** |
|---|---|---|---|---|
| 1280 × 720 | 921 600 | ×4 | 79,6 | 70,0 Mio |
| **1920 × 1080** | 2 073 600 | ×4 | 79,6 | **157,4 Mio (165,1 Mo)** |
| 2560 × 1440 | 3 686 400 | non (au-delà de 2,8 millions de pixels) | 35,6 | 125,2 Mio |
| 3840 × 2160 (4K, densité 1) | 8 294 400 | non | 35,6 | 281,6 Mio (calculée) |

**Le détail à 1920 × 1080** (octets par pixel → Mio) : la scène résolue, en demi-flottants RGBA : **8** → 15,8 ; ses échantillons ×4 (un demi-flottant RGBA **8** et la profondeur **4**, par
échantillon : 48) → 94,9 ; deux cibles de passes (8 chacune) → 31,6 ; le halo (une chaîne de demi-résolutions, ≈ 7,6) → 15,0 ; le FXAA et l'étalonnage n'ont pas de cible à eux. **Total 79,6
octets par pixel = 157,4 Mio** ; sans multi-échantillonnage la scène prend 8 + 4 de profondeur : 35,6 → **70,4 Mio**. À côté de cela, le tampon d'écran du moteur (`antialias: true`) garde ses
propres échantillons (≈ 63 Mio à 1080p : déjà là aux paliers 1 et 2).

**Pourquoi le multi-échantillonnage s'arrête à 2,8 millions de pixels** (`PIXELS_MSAA`, `post.ts`) : c'est lui qui pèse (95 des 157 Mio) ; à partir d'un écran 1440p les pixels sont
plus fins, le FXAA reste, et la mémoire cesse de grimper (un écran 4K en multi-échantillonné ferait 630 Mio). Le téléphone n'est pas concerné : jamais de chaîne. Pour comparaison, la
vitrine du 38b donnait 95 Mo de cibles au Pixel 7 sur un bandeau d'un tiers d'écran (avec l'occlusion et SMAA, retirées ici).

## 5. Le halo, la peinture claire de jour et les lampadaires de la Nuit

**La vérification** (« 38b : la peinture blanche brillait ») se fait **sur la carte graphique**, pas à l'œil : `e2e/post.spec.ts` lit la cible de la scène de la chaîne (la lumière linéaire,
**avant** le halo : `readRenderTargetPixels`, demi-flottants) au départ de chaque thème, avec **la voiture la plus claire de la palette (« Lagon », motif damier)**, et compte les pixels
au-dessus du **seuil du halo** du thème (`POST_3`, `themesPost.ts`) :

| Thème (seuil du halo) | Lumière maximale | 99,9 % des pixels sous | Pixels > 1,8 | Pixels > seuil |
|---|---|---|---|---|
| Stade (2,4) | 1,65 | 0,98 | 0 | **0** |
| Rallye (2,4) | 5,53 | 0,78 | 6 | 2 (le disque du soleil) |
| Banquise (2,8) | 1,26 | 0,95 | 0 | **0** |
| Campagne (2,2) | 1,13 | 0,77 | 0 | **0** |
| Canyon (2,2) | 10,25 | 0,77 | 8 | 7 (le disque du soleil) |
| Col alpin (2,6) | 1,66 | 0,92 | 0 | **0** |
| Ville (2,0) | 4,61 | 0,80 | 2 | 2 (le disque du soleil) |
| **Nuit (0,95)** | 5,05 | 1,03 | 35 | **336** (les lumières) |

(Mesuré à 640 × 360 = 230 400 pixels ; le test, à 480 × 270, tolère 0,05 % de l'image, soit 65 pixels, au-dessus du seuil de chaque thème de jour.) **Le jour, rien de blanc n'atteint le seuil** — la peinture claire éclairée monte à
≈ 1,0 à 1,65 pour des seuils de 2,0 à 2,8 — et les seuls pixels au-dessus sont ceux du disque du soleil (quelques pixels : un éclat discret, voulu). **La Nuit allume ses lumières** : plus de
trois cents pixels au-dessus de 0,95 (feux des rebords, plaques, portes de contrôle, lampadaires), qui sont ce que le halo fait déborder. Le halo du jour est donc bien discret :
force 0,10 à 0,16, seuil de 2,0 à 2,8.

**Les halos en points** (`halo.ts` : lampadaires, plaques, portes ; forts la Nuit et au Néon, 0 à 0,2 le jour) existent déjà au palier 1 et **restent** ; dans la chaîne leur nuanceur écrit des
couleurs d'écran, il est donc **passé en lumière linéaire à la volée** (§ 2) — sans cela le halo des lampadaires sortait « démesuré » en gros disque pâle (le défaut que le 38b avait corrigé
dans la vitrine seulement). Testé sur la Nuit : ses lampadaires, plaques et portes ont des halos (`test/post.test.ts`), dont le nuanceur est adapté puis rendu à l'identique à l'extinction.

## 6. Budget

Mesure : `npm run build && node scripts/budgets.mjs` (la mesure unique `mesureTrack`), `main` à `76e0725` construit à part (`git worktree`) puis la branche ; `perf.spec.ts` garde les lignes.

| Ligne | `main` (`76e0725`) | Lot 47 | Écart |
|---|---|---|---|
| JS + CSS du premier chargement | 285 599 | 286 145 | **+546** |
| JS | 274 051 | 274 597 | +546 |
| hors three.js | 140 442 | 140 973 | +531 |
| three.js | 133 609 | 133 624 | +15 |
| CSS, catalogue anglais, fils de travail, polices | — | inchangés | 0 |
| page d'admin (hors premier chargement) | 11 424 | 11 431 | +7 (l'option « Palier 3 sans le post-traitement ») |
| `qualiteMesure` (à la demande, plafond 1 500) | 800 | 838 | +38 (`apresCoupure`) |
| **post-traitement à la demande** (nouvelle ligne, plafond **7 000**) | — | **6 798** (`postJeu`, ce qu'il tire hors du premier chargement compris) | marge 202 |

- **Premier chargement : +546 o** (< 1 ko : sans justification de plus). Ce qu'il paie : les crochets de `main.ts` (le `import()` du module, `postPermis`, `suivrePost`, `couperPost`, la lecture
  de `__cdj.post`) ; `passesPermises` existait déjà (lot 45). Marge de Track : 6 001 → **5 455 o** (plafond 291 600 o).
- **Le piège évité** : les passes de three.js (`UnrealBloomPass`, `OutputPass`, `FXAAPass`, leurs nuanceurs) sont des modules de `node_modules/three/`, que `manualChunks` range **dans le fichier
  de three.js, donc au premier chargement** : premier jet à **+5 161 o** (three.js +4 659 o) pour un téléphone qui ne les affichera jamais. Les exclure du morceau `three` (`vite.config.ts`, comme
  `Reflector` pour le Garage) les laisse dans le morceau du post-traitement. Rien d'autre n'a bougé : `perf.spec.ts` vérifie qu'**aucune passe n'est dans le premier chargement**.
- **À la demande : 6 798 o sur 7 000** (premier jet : 6 995 o, au bord de la ligne). Ce qui a été fait pour tenir : les nuanceurs de three.js passent par le resserrage de `outils/glsl.ts` (−214 o),
  l'étalonnage et le halo de chaque thème sont dans leur table à part (`themesPost.ts`, sans la brume ni les particules), le module du jeu n'embarque ni GTAO ni SMAA. **La ligne n'est pas
  encore dans le tableau de `budgets.md`** (comme « palier 2 », « vie et ciel » et « décor » : le test du tableau, `apps/portail/test/budgets.test.ts`, est en zone partagée) : clé proposée
  `track.post`, motif `"le post-traitement, à la demande, compressé"\)\.toBeLessThan\(([\d_]+)\)`, à ajouter par un lot de plateforme.
- Rien du lot 36 ne revient (générateur, Salon) ; aucune passe de post-traitement ni module du pas au premier chargement (`test/socle.test.ts`, `e2e/perf.spec.ts`).
- **Profil téléphone, avant / après** (Chromium, 844 × 390 @2, `?appareil=telephone`, à la pause, `main` contre la branche) : **identique** — Stade : palier 2 + vie et ciel 34 appels, 80 034 triangles,
  23 programmes, 16 textures ; palier 3 imposé 35 appels, 92 694 triangles ; palier 1 30 appels, 50 576 triangles ; Nuit : 40 appels / 105 294 triangles, 41 / 122 762, 35 / 74 810 ; construction
  dans le bruit (± 50 ms) ; **aucun module du post-traitement n'est même demandé** sur le téléphone (`performance.getEntriesByType("resource")`).

## 7. Tests

- `test/post.test.ts` (nouveau, 14 tests) : **FXAA seul** (aucun fichier de `src/` n'importe GTAO ou SMAA ; le pas « occlusion » n'existe plus ; la famille post = étalonnage, anticrénelage, halo ;
  un étalonnage et un halo par thème, fort la Nuit et le Néon, seuil haut le jour) ; **la mémoire** (octets par pixel, 157,4 Mio à 1080p, le multi-échantillonnage s'arrête à 1440p) ;
  **les garde-fous** (deux images ratées de suite coupent, une réussie remet à zéro ; la perte de contexte coupe à l'instant, rend les nuanceurs à l'écran direct et n'est dite qu'une
  fois ; après une coupure, palier 2, plafond durable, la remesure part du palier 2) ; **jamais de passe plein écran sur un profil téléphone** (toutes mémoires et cartes graphiques) et « Maximale »
  qui ne la donne pas sans demi-flottants, avec peu de mémoire ou en rendu logiciel ; `main.ts` ne la demande qu'avec `passesPermises` ; **la linéarisation** (halo et particules adaptés une
  fois, nuanceur déjà colorimétrique intact, restitution au caractère près, effet posé après coup repris, halos de la Nuit).
- `e2e/post.spec.ts` (nouveau, 8 tests, `durees.json` : 480 s ; **rendu logiciel, `?appareil=ordinateur`**) : `?palier=3` charge la chaîne **avant la course** (module à la demande, ×4, parties, mémoire =
  `octets/px × pixels`) ; `?reglages=3-post` (rien n'est chargé), `3-halo-fxaa`, `2+post` (n'y fait rien), `?prod` ; **téléphone** (profil imposé : `?palier=3` et « Maximale », jamais la chaîne, jamais
  le module) ; **sans demi-flottants rendables** (extension masquée : jamais la chaîne) ; **jamais en course** (demandée ou retirée en pleine course, elle attend la pause) ; **perte du contexte
  WebGL simulée** (`WEBGL_lose_context`) en pleine course : chaîne coupée à l'instant, la course continue (la simulation avance), le contexte revient et le moteur redessine, le palier 2 + vie et
  ciel arrive à la pause, `cdj:qualite` en garde le plafond, aucune erreur de page ; **deux images ratées** (`echouer(2)`) ; **le halo et la peinture claire de jour** (lecture de la cible).
- `e2e/perf.spec.ts` : la ligne « post-traitement à la demande » (7 000 o), aucune passe dans le premier chargement, FXAA présent, ni `GTAO` ni `SMAA` dans la construction.
- Mis à jour : `test/socle.test.ts` (le pas `post` hors des paliers, son `import()`, hors du graphe du premier chargement), `test/paliers.test.ts`, `e2e/qualite.spec.ts` (l'ordinateur part de
  `P3+post`), `e2e/globals.d.ts`. Outils (hors CI, `durees.json` à 0) : `captures-lot47.spec.ts`.

## 8. Vérifié, non vérifié

**Vérifié** (en local, sur la construction finale) : `npm run typecheck` ; `npx vitest run --project sqlite` — **207 fichiers, 2 799 tests, tous verts** (dont `test/post.test.ts`, `socle`, `paliers`, le tableau
des budgets du portail) ; `--project libsql` (les tests de l'API, que ce lot ne touche pas) — 27 fichiers, 399 tests verts ; `npm run traductions -- --verifier` (aucune clé de catalogue) ; **e2e Chromium, un
à la fois, 61 sur 61** sur dix fichiers : `post` (8 tests), `qualite` (l'ordinateur part de `P3+post`), `perf` (la ligne de 7 000 o), `socle`, `vie-ciel`, `vitrine` (15 pas au lieu de 16, sans l'occlusion), `vitrine-voiture`,
`admin`, `scene`, `juice` — la perte de contexte a d'abord échoué 6 fois sur 6 à cause du test (§ 2), puis réussi 3 fois de suite et à chaque passe complète ; captures et planches des huit thèmes, sans et avec ;
mémoire des cibles lue dans le jeu à 1280 × 720, 1920 × 1080 et 2560 × 1440 ; luminance de la scène lue sur la cible, huit thèmes ; profil téléphone avant / après (`main` à `76e0725` construit à part) ;
budget par `scripts/budgets.mjs` et `perf.spec.ts` ; golden, `SIM_VERSION`, `GENERATOR_VERSION` (aucun fichier de `packages/sim` touché) ; zones de la PR (`scripts/zones-jeu.mjs --etiquettes '["jeu:track"]'`).

**Non vérifié** : **le temps d'image sur une vraie carte graphique** — tout ce qui précède est du rendu **logiciel** (SwiftShader) : il dit que la chaîne fait ce qu'elle doit (cibles, passes, garde-fous), pas ce qu'elle
coûte ; c'est la mesure qui manque, à lire chez toi au compteur de `?debug` (§ 9, n° 3) ; une **vraie** perte de contexte (pilote, mise en veille, carte graphique qui manque de mémoire : `WEBGL_lose_context`
la simule fidèlement côté page, pas côté pilote) ; **Safari et Firefox** (les e2e de ce lot sont du Chromium seul ; la CI de la PR lance le sous-ensemble multi-navigateurs, qui ne contient pas ce lot) —
en particulier le multi-échantillonnage d'une cible en demi-flottants sur Safari, que la vérification de la cible (retentée sans multi-échantillonnage) est faite pour rattraper ; la chauffe d'un ordinateur portable
après plusieurs courses ; l'œil sur le FXAA et le halo de jour, à 640 × 360 en rendu logiciel.

## 9. Pour Nathan (décisions et questions)

1. **La force du halo de la Nuit** (`POST_3.nuit.halo` : force 0,55, seuil 0,95, rayon 0,55 ; Néon 0,65 / 0,9 / 0,6) : c'est « fort la Nuit », mais **le premier tremplin de la Nuit** (poutre des portes
   de contrôle au loin) se couronne d'un halo large. Si c'est trop : `force` 0,4 ou `rayon` 0,45, une ligne de `scene/themesPost.ts` — dis-moi la valeur, ou règle-la à la vue avec
   `/track/?seed=2026-10-14&home=0&palier=3` contre `…&reglages=3-halo` (le halo seul coupé).
2. **Multi-échantillonnage ×4 + FXAA, coupé au-delà de 2,8 millions de pixels** : **157 Mio de cibles à 1920 × 1080** (95 Mio pour les seuls échantillons), 125 Mio à 2560 × 1440 (sans). Garder
   ainsi, ou : FXAA seul partout (70 Mio à 1080p, moins beau aux bords fins), ou toujours ×4 (630 Mio en 4K). **La porte de mémoire est celle de la règle du lot 45** (`navigator.deviceMemory` ≥ 4 Go,
   la mémoire vive, pas celle de la carte graphique : aucune API ne la donne) ; la mesure de l'accueil juge le temps d'image avec la chaîne.
3. **Aucune mesure d'images par seconde sur une vraie carte graphique** (rendu logiciel ici) : le coût est à lire **chez toi**, `?debug`, `…&palier=3` contre `…&reglages=3-post`, au Stade, à la Nuit et à la Ville,
   plein écran ; si une partie coûte trop, elle se coupe seule (`3-halo`, `3-etalonnage`, `3-fxaa`) et je la retire du palier.
4. **Après une perte de contexte, le plafond durable (palier 2) est écrit pour la règle Auto** ; un joueur en « Maximale » réessaie la chaîne au chargement suivant (c'est son choix) — ou la coupure
   se souvient aussi pour « Maximale » ? Je n'ai pas décidé à ta place : le risque est une boucle (perte de contexte à chaque chargement) sur une machine fragile.
5. **La règle du lot 45 descend dès la première mesure ratée** (pas « deux de suite » pour descendre ; deux de suite rendent le plafond durable) : c'est plus strict que l'énoncé du lot 47, donc
   plus sûr pour la chaîne ; à confirmer. (§ 2.)
6. **Hors du lot, à décider** : sans demi-flottants rendables, **le palier 2 lui-même** (reflets ciblés, lot 45) ne tient pas — la règle de qualité devrait écarter ces appareils du palier 2 (§ 2).
7. **La ligne « post-traitement à la demande » (7 000 o, 6 798 mesurés)** est à inscrire dans le tableau de `budgets.md` par un lot de plateforme, avec « palier 2 », « vie et ciel » et « décor » (§ 6).
8. **`mesuresPaliers.ts`** (écrit par l'outil du 38b, « ne pas modifier à la main ») a perdu sa ligne « occlusion » à la main : à régénérer au prochain `MESURE=1 … mesure-lot38b` si tu veux les chiffres à jour
   (la vitrine n'a plus ce pas).
