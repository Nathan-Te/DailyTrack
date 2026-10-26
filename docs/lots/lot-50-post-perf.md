# Lot 50 — Track : un post-traitement qui tient 60 images/s sur une carte intégrée, et un banc d'essai

Branche `claude/gifted-dijkstra-gj0t2y` (nom imposé par la session ; le lot prévoyait `lot-50-post-perf`, d'où l'étiquette `jeu:track` sur la PR pour le job `zones`), partie de
`main` à `450ddda` (**retouche 47b fusionnée** : Auto n'allume plus le post-traitement). Zones : `apps/web/**`, `docs/lots/**`, la ligne de Track de `budgets.md`, son entrée de
`durees.json` et de `packages/ui/test/applications.ts`. **Rien dans `sim`** : golden, rediffusions, classements, identifiants de circuit inchangés. Aucune clé de catalogue
(le banc est un outil interne en français, exempté comme la page d'admin). Aucune donnée gardée de plus : les mentions légales ne changent pas.

## État : en attente du rapport 2 du banc

Rapport 1 reçu (plus bas) : la passe de fin et le halo de la première version sont corrigés, un plafond de pixels est proposé ; le banc (rapport version 2) mesure la
chaîne corrigée, ses parties et ses plafonds. Restent à décider sur le rapport 2 : la forme du jeu (plafond, multi-échantillonnage, halo), `POST_DANS_AUTO`, puis le
retrait de la chaîne du lot 47 et le rapport « après ».

## À tester (aperçu de la PR, sur le portable Iris Xe, branché, navigateur en plein écran)

| Quoi | Lien |
|---|---|
| **Le banc** (≈ 2 min, ne rien toucher ; « Copier le rapport » à la fin, puis le coller dans la session) | `/track/?banc` |
| La course en « Maximale » avec la nouvelle chaîne (compteur `?debug`) | `/track/?debug` puis Réglages › Graphismes › Maximale, recharger |
| La même chose, palier 3 imposé, un jour de Nuit (halo) | `/track/?debug&palier=3&theme=nuit` |
| La chaîne du lot 47 (avant), pour comparer en jeu (le temps du lot) | `/track/?debug&palier=3&chaine=47` |

## Le banc d'essai (`?banc`)

- **Ce qu'il mesure** : `src/banc/bancLogique.ts` (liste, statistiques, rapport : testé, `test/banc.test.ts`) et `src/banc/banc.ts` (le dessin). La voiture suit la course du
  pilote automatique sur le circuit du **20/10/2026** (un jour passé : il ne change jamais), de 2 s à 5,2 s, sur **Stade, Nuit, Ville**, caméra de poursuite « proche » ;
  0,7 s de mise en route écartée, puis **2,5 s de mesure** par configuration ; ≈ 31 à 35 mesures, **≈ 2 min**.
- **Deux moteurs, l'un après l'autre** : `antialias` ne se change qu'à la création du contexte. D'abord l'écran multi-échantillonné (le jeu jusqu'ici : paliers 1, 2, 3, chaîne
  47 et ses parties coupées une à une, densité 1), puis l'écran sans (référence, chaîne 47 sans double multi-échantillonnage, chaîne 50 et ses formes).
- **Par mesure** : temps d'image (médiane, 95ᵉ, 99ᵉ, pire), images/s, **temps de la carte graphique par passe** (`EXT_disjoint_timer_query_webgl2` : `scene`,
  `halo`, `sortie`, `etalonnage`, `fxaa` pour la 47 ; `scene`, `halo`, `fin` pour la 50), fil principal, appels, programmes, **compilations pendant la mesure**, tâches longues.
  En-tête : carte graphique, navigateur, canevas, densité, plein écran, fréquence de l'écran, palier d'Auto, chaîne permise, minuteur disponible.
- **Aucune course, rien d'écrit** : `main.ts` charge le banc et ne démarre pas le jeu (recette et aperçus seulement : `isRestricted`). Les effets de course (particules) ne
  sont pas dans la scène du banc ; la chaîne 47 y refait le parcours des matériaux de chaque image du lot 47 (`parcourirMateriaux`).

## La nouvelle chaîne (première version, à classer par le rapport)

| Lot 47 | Lot 50 |
|---|---|
| scène en demi-flottants ×4 (8 o + 4 × 12 o par pixel) **et** écran multi-échantillonné | scène en `R11F_G11F_B10F` ×4 (4 o + 4 × 8 o ; repli demi-flottants), **écran sans multi-échantillonnage** |
| `UnrealBloomPass` (dont un mélange additif sur tout l'écran) **tous les thèmes** | halo **la Nuit et le Néon seulement**, mêmes niveaux, flous et poids, **aucune passe à la taille de l'écran** |
| `OutputPass`, étalonnage, `FXAAPass` : trois passes plein écran en demi-flottants | **une seule passe de fin** (`FIN`) : tonalité, espace de l'écran, étalonnage, FXAA, écrit l'écran |
| `lineaire.adapter` parcourt la scène à chaque image | un uniforme partagé (`SORTIE_LINEAIRE`), aucun parcours |
| programmes compilés à la première image | `compileAsync` à l'arrêt (scène dans la cible, passes) |
| 157,5 Mo de cibles à 1080p | 71,2 Mo le jour, 85,7 la Nuit |
| module 6 798 o | 5 208 o (`postJeu` + `post`) |

- **Le FXAA de la passe de fin lit l'image finale** de chaque voisin (tonalité, halo, étalonnage), comme quand il passait en dernier : le résultat est le même à l'ordre de
  l'étalonnage près. **Mode copie** : un moteur créé sans multi-échantillonnage (la chaîne voulue au chargement) qui la perd (Équilibrée choisie en route, mesure ratée)
  dessine par la cible ×4 et la tonalité seule — jamais une image crénelée. Un moteur créé avec (la chaîne demandée en cours de page) garde la scène de la chaîne sans
  multi-échantillonnage jusqu'au prochain chargement : **jamais deux**.
- **Planches avant / après** (`captures-lot47` rejoué, rendu logiciel 480 × 270) : [Stade](lot-50/planches/stade.jpg), [Nuit](lot-50/planches/nuit.jpg),
  [Ville](lot-50/planches/ville.jpg), [accueil et Salon](lot-50/planches/accueil-salon.jpg). Le jour : identiques à l'œil (le disque du soleil n'a plus son halo). La
  Nuit : même halo au départ (cibles lues : 0,00388 contre 0,00389) ; au tremplin le halo d'avant paraît plus étendu — à juger sur la planche par Nathan.

## La règle de qualité

- **Le post-traitement dans Auto** : `POST_DANS_AUTO` (`qualite.ts`), **à décider sur le rapport** (critère du lot : la fréquence de l'écran et une pire image ≤ 25 ms sur
  l'Iris Xe). Faux en attendant : Auto ne l'allume pas (47b). Vrai : Auto le donne au palier 3 là où les passes sont permises, le moteur est créé sans multi-échantillonnage
  quand la mémoire dit palier 3, et une mesure ratée à l'accueil **retire d'abord la chaîne** (`sansPost`, le palier 3 remesuré sans elle).
- **La règle surveille la course** (`SurveillanceCourse`, `qualiteMesure.ts`, chargée à la première course) : la médiane des images sur **5 s de course** ; au-delà du seuil
  de descente (22 ms à 60 Hz, ramené à la fréquence estimée), une descente est proposée et **appliquée à la prochaine occasion hors course** (accueil, arrivée, podium ;
  pas la pause) : **d'abord la chaîne, puis le palier** (`descenteCourse`), et on s'en souvient (`cdj:qualite` : `sansPost`, ou un plafond durable ; `trop`). En Auto
  seulement ; un autre choix garde sa scène, et les Réglages disent **« Trop lourd pour cet appareil : Auto allégerait l'image. »** (`reglages.graphismes.tropLourd`, fr
  et en). Essai : `__cdj.qualite.ralentir(ms)`. Tests : `test/qualite.test.ts` (fenêtre, seuil, pause, descente, mémoire), `e2e/qualite.spec.ts` (descente simulée, rien en
  course ni à la pause, appliquée à l'accueil, mémorisée au rechargement, « Maximale » et sa note).

## Budget

- **Post-traitement à la demande** : **5 208 o** (6 798 au lot 47 ; plafond 7 000) — `postJeu` + `post` (la passe de fin, le halo léger, la table des thèmes).
- **Premier chargement : +1 260 o** (289 424 o, plafond 291 600 ; mesuré contre `main` construit à part, `mesureTrack`) — au-delà de la cible de 1 ko, justifié : `main`
  ≈ +1 150 o pour **le moteur choisi au chargement** (`chaineAuChargement`, jamais deux multi-échantillonnages), **le mode copie**, **la précompilation** à l'arrêt, **la
  surveillance de la course** et sa descente (le jugement lui-même est à la demande, dans `qualiteMesure`), l'entrée du banc (les outils du premier chargement lui sont
  **prêtés** par `main.ts` : importés par lui, ils sortaient `cameras`, `decor` et `i18n` du morceau principal, +1,3 ko de plus mesuré au premier jet) et les champs de
  `?debug` ; three.js +50 o. Catalogue anglais +26 o, page d'admin −14 o. Le banc (≈ 6,9 ko) et la chaîne du lot 47 (≈ 6 ko) sont des morceaux à part, hors de toute ligne
  de joueur.

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

### Rapport 2 — après

*À venir.*
