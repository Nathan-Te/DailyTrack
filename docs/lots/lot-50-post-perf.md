# Lot 50 — Track : un post-traitement qui tient 60 images/s sur une carte intégrée, et un banc d'essai

Branche `claude/gifted-dijkstra-gj0t2y` (nom imposé par la session ; le lot prévoyait `lot-50-post-perf`, d'où l'étiquette `jeu:track` sur la PR pour le job `zones`), partie de
`main` à `450ddda` (**retouche 47b fusionnée** : Auto n'allume plus le post-traitement). Zones : `apps/web/**`, `docs/lots/**`, la ligne de Track de `budgets.md`, son entrée de
`durees.json` et de `packages/ui/test/applications.ts`. **Rien dans `sim`** : golden, rediffusions, classements, identifiants de circuit inchangés. Aucune clé de catalogue
(le banc est un outil interne en français, exempté comme la page d'admin). Aucune donnée gardée de plus : les mentions légales ne changent pas.

## État : en attente du rapport du banc de Nathan

**Étape 2 du lot (« Arrêt : la mesure de Nathan »)** : le banc et une première version de la nouvelle chaîne sont sur l'aperçu de la PR ; le banc mesure **les deux chaînes**
(avant / après) et chaque partie, pour que le premier rapport classe déjà les optimisations. La règle de qualité (le post-traitement dans Auto s'il est prouvé, la descente
en course) attend ce rapport.

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
| module 6 798 o | ≈ 5,0 ko (`postJeu` + `post`) |

- **Le FXAA de la passe de fin lit l'image finale** de chaque voisin (tonalité, halo, étalonnage), comme quand il passait en dernier : le résultat est le même à l'ordre de
  l'étalonnage près. **Mode copie** : un moteur créé sans multi-échantillonnage (la chaîne voulue au chargement) qui la perd (Équilibrée choisie en route, mesure ratée)
  dessine par la cible ×4 et la tonalité seule — jamais une image crénelée. Un moteur créé avec (la chaîne demandée en cours de page) garde la scène de la chaîne sans
  multi-échantillonnage jusqu'au prochain chargement : **jamais deux**.
- **Écart d'image attendu** : le disque du soleil n'a plus son halo le jour (planches à venir, après le rapport).

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

- **Post-traitement à la demande** : **5 028 o** (6 798 au lot 47 ; plafond 7 000) — `postJeu` + `post` (la passe de fin, le halo léger, la table des thèmes).
- **Premier chargement : +1 242 o** (289 406 o, plafond 291 600 ; mesuré contre `main` construit à part, `mesureTrack`) — au-delà de la cible de 1 ko, justifié : `main`
  +1 128 o pour **le moteur choisi au chargement** (`chaineAuChargement`, jamais deux multi-échantillonnages), **le mode copie**, **la précompilation** à l'arrêt, **la
  surveillance de la course** et sa descente (le jugement lui-même est à la demande, dans `qualiteMesure`), l'entrée du banc (les outils du premier chargement lui sont
  **prêtés** par `main.ts` : importés par lui, ils sortaient `cameras`, `decor` et `i18n` du morceau principal, +1,3 ko de plus mesuré au premier jet) et les champs de
  `?debug` ; three.js +50 o. Catalogue anglais +26 o, page d'admin −14 o. Le banc (≈ 6,9 ko) et la chaîne du lot 47 (≈ 6 ko) sont des morceaux à part, hors de toute ligne
  de joueur.

## Le regroupement des deux réglages

« Qualité graphique » et « Qualité » sont devenus un seul réglage le 25/10/2026 : commit `6c5016e` (« Track : un seul réglage de qualité »), fusionné par
[Nathan-Te/DailyTrack#140](https://github.com/Nathan-Te/DailyTrack/pull/140), retouche du lot 45. **`QualityGovernor` (lot 9) fonctionne toujours** : il est créé non figé
(`qualityPlan` : figé seulement par `?quality=`), observe chaque image hors pause (`frame`, `main.ts`) et baisse la qualité au-delà de 26 ms de moyenne (`juice.test.ts`).

## Rapports du banc

*À venir : avant (premier rapport), après.*
