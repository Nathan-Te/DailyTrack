# Lot 50 — Track : un post-traitement qui tient 60 images/s sur une carte intégrée, et un banc d'essai

Branche `claude/gifted-dijkstra-gj0t2y` (nom imposé par la session ; le lot prévoyait `lot-50-post-perf`, d'où l'étiquette `jeu:track` sur la PR pour le job `zones`), partie de
`main` à `450ddda` (**retouche 47b fusionnée** : Auto n'allume plus le post-traitement). Zones : `apps/web/**`, `docs/lots/**`, la ligne de Track de `budgets.md`, son entrée de
`durees.json` et de `packages/ui/test/applications.ts`. **Rien dans `sim`** : golden, rediffusions, classements, identifiants de circuit inchangés. Aucune clé de catalogue
(le banc est un outil interne en français, exempté comme la page d'admin). Aucune donnée gardée de plus : les mentions légales ne changent pas.

## État : la forme du jeu fixée sur le rapport 2 ; reste le rapport « après » de Nathan

Rapport 1 (avant, première version) → passe de fin et halo corrigés, plafond de pixels ajouté. Rapport 2 → **la forme du jeu** : scène sans multi-échantillonnage,
plafonnée à 2,1 millions de pixels (`FORME_JEU`), halo à la demi-résolution ; **le post-traitement revient dans Auto** (`POST_DANS_AUTO`) ; **la chaîne du lot 47 est
retirée** (`post47.ts`, `?chaine=47` ; ses mesures restent ici). Reste : le rapport « après » (banc version 3) et la course en « Maximale » et en Auto.

## À tester (aperçu de la PR, sur le portable Iris Xe, branché, navigateur en plein écran)

| Quoi | Lien |
|---|---|
| **Le banc** (≈ 1 min 40, ne rien toucher ; « Copier le rapport », puis le coller dans la session) | `/track/?banc` |
| La course du jour en Auto (le post-traitement y est) ou en « Maximale », compteur `?debug` : 60 images/s sans saccade | `/track/?debug` |
| Un jour de Nuit (le halo) | `/track/?debug&palier=3&theme=nuit` |

## Le banc d'essai (`?banc`)

- **Ce qu'il mesure** : `src/banc/bancLogique.ts` (liste, statistiques, rapport : testé, `test/banc.test.ts`) et `src/banc/banc.ts` (le dessin). La voiture suit la course du
  pilote automatique sur le circuit du **20/10/2026** (un jour passé : il ne change jamais), de 2 s à 5,2 s, sur **Stade, Nuit, Ville**, caméra de poursuite « proche » ;
  0,7 s de mise en route écartée, puis **2,5 s de mesure** par configuration ; ≈ 30 mesures, **≈ 1 min 40**.
- **Deux moteurs, l'un après l'autre** : `antialias` ne se change qu'à la création du contexte. D'abord l'écran multi-échantillonné (paliers 1, 2, 3 sans la chaîne,
  densité 1), puis l'écran sans (référence, la chaîne du jeu, chacune de ses parties coupée, ses formes : multi-échantillonnage, demi-flottants, halo au quart, sans
  plafond, plafond de 2,8 Mpx). Versions du rapport : 1 et 2 mesuraient aussi la chaîne du lot 47 et ses parties ; 3 (actuelle) la chaîne du jeu seule.
- **Par mesure** : temps d'image (médiane, 95ᵉ, 99ᵉ, pire), images/s, **temps de la carte graphique par passe** (`EXT_disjoint_timer_query_webgl2` : `scene`,
  `halo`, `fin`), fil principal, appels, programmes, **compilations pendant la mesure**, tâches longues.
  En-tête : carte graphique, navigateur, canevas, densité, plein écran, fréquence de l'écran, palier d'Auto, chaîne permise, minuteur disponible.
- **Aucune course, rien d'écrit** : `main.ts` charge le banc et ne démarre pas le jeu (recette et aperçus seulement : `isRestricted`). Les effets de course (particules) ne
  sont pas dans la scène du banc.

## La nouvelle chaîne

| Lot 47 | Lot 50 |
|---|---|
| scène en demi-flottants ×4 (8 o + 4 × 12 o par pixel) **et** écran multi-échantillonné | scène en `R11F_G11F_B10F` (4 o + profondeur ; repli demi-flottants), **sans multi-échantillonnage** (FXAA), **plafonnée à 2,1 Mpx** ; **écran sans multi-échantillonnage** |
| `UnrealBloomPass` (dont un mélange additif sur tout l'écran) **tous les thèmes** | halo **la Nuit et le Néon seulement**, mêmes niveaux, flous et poids, **aucune passe à la taille de l'écran** |
| `OutputPass`, étalonnage, `FXAAPass` : trois passes plein écran en demi-flottants | **une seule passe de fin** (`FIN`) : tonalité, espace de l'écran, étalonnage, FXAA, écrit l'écran |
| `lineaire.adapter` parcourt la scène à chaque image | un uniforme partagé (`SORTIE_LINEAIRE`), aucun parcours |
| programmes compilés à la première image | `compileAsync` à l'arrêt (scène dans la cible, passes) |
| 157,5 Mo de cibles à 1080p | 15,8 Mo le jour, 30,3 la Nuit (le plafond les borne à toutes les tailles) |
| module 6 798 o | 5 216 o (`postJeu` + `post`) |

- **Le FXAA de la passe de fin** juge les bords sur une luminance approchée et mêle les couleurs finales de deux voisins. **Mode copie** : un moteur créé sans
  multi-échantillonnage (la chaîne voulue au chargement) qui la perd (Équilibrée choisie en route, mesure ratée, course trop lente) dessine par la chaîne, tonalité et
  FXAA seulement — jamais une image crénelée. **Plafond** : au-delà de 2,1 Mpx (un écran 1440p, 4K…) la scène est dessinée plus petite (×0,75 à 1440p) et la passe de
  fin l'agrandit ; les halos en points et les particules gardent leur taille (`PostJeu.echelle`).
- **Planches avant / après** (`captures-lot47` rejoué, rendu logiciel 480 × 270) : [Stade](lot-50/planches/stade.jpg), [Nuit](lot-50/planches/nuit.jpg),
  [Ville](lot-50/planches/ville.jpg), [accueil et Salon](lot-50/planches/accueil-salon.jpg). Le jour : identiques à l'œil (le disque du soleil n'a plus son halo). La
  Nuit : même halo au départ (cibles lues : 0,00388 contre 0,00389) ; au tremplin le halo d'avant paraît plus étendu — à juger sur la planche par Nathan.

## La règle de qualité

- **Le post-traitement revient dans Auto** : `POST_DANS_AUTO = true` (`qualite.ts`), parce que le critère du lot est tenu au rapport 2 (fréquence de l'écran, pire image
  17 ms ≤ 25, Stade et Nuit, forme du jeu). Auto le donne au palier 3 là où les passes sont permises ; le moteur est créé sans multi-échantillonnage quand la mémoire dit
  palier 3 ; une mesure ratée à l'accueil **retire d'abord la chaîne** (`sansPost`, le palier 3 remesuré sans elle). À confirmer par le rapport « après » (Ville comprise) :
  sinon `POST_DANS_AUTO` repasse à faux.
- **La règle surveille la course** (`SurveillanceCourse`, `qualiteMesure.ts`, chargée à la première course) : la médiane des images sur **5 s de course** ; au-delà du seuil
  de descente (22 ms à 60 Hz, ramené à la fréquence estimée), une descente est proposée et **appliquée à la prochaine occasion hors course** (accueil, arrivée, podium ;
  pas la pause) : **d'abord la chaîne, puis le palier** (`descenteCourse`), et on s'en souvient (`cdj:qualite` : `sansPost`, ou un plafond durable ; `trop`). En Auto
  seulement ; un autre choix garde sa scène, et les Réglages disent **« Trop lourd pour cet appareil : Auto allégerait l'image. »** (`reglages.graphismes.tropLourd`, fr
  et en). Essai : `__cdj.qualite.ralentir(ms)`. Tests : `test/qualite.test.ts` (fenêtre, seuil, pause, descente, mémoire), `e2e/qualite.spec.ts` (descente simulée, rien en
  course ni à la pause, appliquée à l'accueil, mémorisée au rechargement, « Maximale » et sa note).

## Budget

- **Post-traitement à la demande** : **5 216 o** (6 798 au lot 47 ; plafond 7 000) — `postJeu` + `post` (la passe de fin, le halo léger, la table des thèmes).
- **Premier chargement : +1 130 o** (289 323 o après la fusion de `main` — lot R9 compris —, plafond 291 600 ; mesuré contre `main` construit à part, `mesureTrack`) — au-delà de la cible de 1 ko, justifié : `main`
  ≈ +1 097 o pour **le moteur choisi au chargement** (`chaineAuChargement`, jamais deux multi-échantillonnages), **le mode copie**, **la précompilation** à l'arrêt, **la
  surveillance de la course** et sa descente (le jugement lui-même est à la demande, dans `qualiteMesure`), l'entrée du banc (les outils du premier chargement lui sont
  **prêtés** par `main.ts` : importés par lui, ils sortaient `cameras`, `decor` et `i18n` du morceau principal, +1,3 ko de plus mesuré au premier jet) et les champs de
  `?debug` ; three.js +33 o. Catalogue anglais +27 o, page d'admin −13 o. Le banc (≈ 6,9 ko) est un morceau à part, hors de toute ligne de joueur.

## Le regroupement des deux réglages

« Qualité graphique » et « Qualité » sont devenus un seul réglage le 25/10/2026 : commit `6c5016e` (« Track : un seul réglage de qualité »), fusionné par
[Nathan-Te/DailyTrack#140](https://github.com/Nathan-Te/DailyTrack/pull/140), retouche du lot 45. **`QualityGovernor` (lot 9) fonctionne toujours** : il est créé non figé
(`qualityPlan` : figé seulement par `?quality=`), observe chaque image hors pause (`frame`, `main.ts`) et baisse la qualité au-delà de 26 ms de moyenne (`juice.test.ts`).

## Rapports du banc

### Rapport 1 — avant, et la première version de la chaîne (Nathan, 26/10/2026, 13 h 53)

Iris Xe (Direct3D 11), Chrome 155, **2560 × 1440 à la densité 1** (3,7 millions de pixels : au-delà de `PIXELS_MSAA`, la scène de la chaîne n'était **pas**
multi-échantillonnée, ni au lot 47 ni ici), plein écran, 60 Hz, minuteur de la carte graphique présent, 106 s. Temps de la carte graphique en médiane (ms) :

| Configuration (Stade) | images/s | médiane / 99ᵉ (ms) | carte graphique | par passe |
|---|---|---|---|---|
| Palier 1 | 59,5 | 16,7 / 17,3 | 9,7 | — |
| Palier 3 (écran multi-échantillonné) | 53,1 | 16,7 / 33,5 | 7,7 | — |
| **Palier 3 + chaîne 47 (avant)** | **25,5** | **33,5 / 50,3** | **32,1** | scène 14,5 · halo 5,0 · sortie 5,0 · étalonnage 4,8 · FXAA 2,2 |
| Palier 3 + chaîne 50, v1 | 38,1 | 33,0 / 66,7 | 21,1 | scène 8,4 · fin 12,2 |
| Chaîne 50 v1 sans FXAA | 56,7 | 16,7 / 33,5 | 14,8 | scène 12,9 · fin 1,8 |
| Chaîne 50 en mode copie | 57,9 | 16,7 / 33,3 | 14,0 | scène 12,6 · fin 1,4 |

Nuit : chaîne 47 **22,8 images/s** (38,2 ms : scène 18,3, halo 7,2) ; chaîne 50 v1 31,0 (27,9 : scène 11,0, **halo 3,2**, fin 13,0) ; halo au quart 0,8 ms ;
scène en demi-flottants 15,9 ms contre 11,0 en `R11F_G11F_B10F`. Ville : 22,0 images/s avant, 38,6 après. **Aucune compilation ni tâche longue pendant les mesures**,
fil principal ≤ 5 ms partout. Le temps de la carte graphique varie d'une mesure à l'autre (la fréquence de la puce suit la charge) : c'est le temps d'image qui juge.

**Ce qu'il dit** :
1. **Chaque passe plein écran en demi-flottants coûte ≈ 5 ms à 1440p** (sortie, étalonnage, halo) : la fusion et le format de 4 octets sont les bons leviers
   (scène −42 %, halo −55 %).
2. **La passe de fin v1 coûtait 12 ms, dont 10 pour le FXAA** : il recalculait la couleur finale (tonalité, espace de l'écran, étalonnage) de chacun des 9 à
   21 voisins qu'il lit. **Corrigé (v2)** : il juge les bords sur une luminance approchée (une lecture, sans puissance) ; seuls les deux pixels mêlés ont le calcul complet.
3. **À 1440p, même le palier 3 sans chaîne ne tient pas toujours la fréquence de l'écran** (95ᵉ centile à 33 ms) : d'où **un plafond de pixels** pour la scène de
   la chaîne (`FormeChaine.pixelsMax`, dessinée plus petite puis agrandie par la passe de fin, halos et particules compensés) — mesuré au rapport 2 (1080p et 2,8 Mpx,
   avec et sans multi-échantillonnage) avant d'être retenu.
4. **Le halo de la v1 était trois fois trop faible** (planche de la Nuit) : la composition d'`UnrealBloomPass` de three.js r186 multiplie par 3 et mêle le halo pesé par
   sa composante la plus forte. **Corrigé (v2)**, vérifié par lecture des cibles : 0,00371 contre 0,00388 en moyenne.

### Rapport 2 — la chaîne corrigée, ses formes (Nathan, 26/10/2026, 14 h 35)

Même machine et même écran (2560 × 1440, densité 1). Cette fois, le palier 3 sans chaîne tient 60 images/s sur les trois thèmes (pire image 17 ms : le rapport 1 avait
sans doute la puce plus chaude ou moins rapide). Avant (chaîne 47) : **21,5 / 28,8 / 28,1 images/s** (Stade, Nuit, Ville), pire image 50 ms.

| Chaîne du lot 50 (v2) | Stade | Nuit | carte graphique (Stade / Nuit, ms) |
|---|---|---|---|
| à la taille de l'écran (la scène n'y a pas de multi-échantillonnage : > 2,8 Mpx) | **60**, pire 17 | 51,9, pire 33,5 · (même forme, mesurée plus tard : 59,9, pire 17) | 12,1 (scène 8,6, fin 3,5) / 15,8 (scène 9,4, halo 2,6, fin 3,5) |
| plafond 2,1 Mpx (×0,75), ×4 dessous | 59,9, pire 17,1 | 55,5, pire 33,4 | 14,1 / 15,5 |
| **plafond 2,1 Mpx, sans multi-échantillonnage** | **60**, pire 17,1 | **60**, pire 17 | **9,2** (scène 5,9, fin 3,3) / **9,9** (scène 6,0, halo 1,0, fin 2,9) |
| plafond 2,8 Mpx (×0,87), ×4 / sans | 53,5 / 60 | 45,4 / 60 | 15,9 / 10,0 · 19,3 / 14,1 |
| halo au quart (Nuit) | — | 60, pire 17 | — / 11,2 (halo 0,6) |
| sans étalonnage / sans FXAA / mode copie (Stade) | 60 / 60 / 60 | — | 10,3 / 9,3 (fin 1,1) / 8,8 (fin 0,9) |

**Décisions** : (1) **pas de multi-échantillonnage dans la scène de la chaîne** — une cible ×4 coûte presque le double de la scène sur cet Iris Xe (5,9 → 10,9 ms à 2,1 Mpx),
le FXAA lisse ; (2) **plafond de 2,1 millions de pixels** — la seule forme qui laisse de la marge la Nuit (9,9 ms pour 16,7) ; à 1440p la scène est à ×0,75, un peu plus
douce (à juger en jeu) ; à 1080p et en dessous, rien ne change ; (3) **halo à la demi-résolution** (le quart ne gagne qu'≈ 1 ms et change le halo) ; (4) **le
post-traitement dans Auto**. Le FXAA bon marché a ramené la passe de fin de 12,2 à 3,5 ms ; le halo ne coûte plus que 1 à 2,6 ms.

Un troisième passage du même banc (Nathan, 15 h 26) confirme : **toutes les formes sans multi-échantillonnage tiennent 60 images/s, pire image ≤ 17,2 ms**, Ville
comprise (chaîne à la taille de l'écran : 11,9 ms) ; la Nuit à 2,1 Mpx : 11,0 ms sans multi-échantillonnage, 13,6 avec ×4 ; à 2,8 Mpx : 10,9 ms (14,1 au rapport 2).
Avant (chaîne 47) : 31 à 34 images/s ce jour-là. **2,8 Mpx tiendrait aussi** (×0,87, plus net) avec un peu moins de marge la Nuit : à trancher par Nathan en jeu.

### Rapport 4 — après (la forme du jeu, banc version 3)

*À venir.*
