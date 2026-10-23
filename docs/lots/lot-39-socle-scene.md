# Lot 39 — Track : socle de la scène par paliers (rien ne change à l'écran)

Branche `claude/zen-pascal-dmempr` (nom imposé par la session ; le lot prévoyait `lot-39-socle-scene`), partie de `main` avec la PR #118 (38b et 38c) **et le lot 37 (PR #119) fusionnés**. Zones : `apps/web/**`, `docs/lots/**`, la ligne de Track de `docs/plateforme/budgets.md`. **Rien dans `sim`** : golden, `SIM_VERSION`, `GENERATOR_VERSION`, rediffusions, classements inchangés. PR : [Nathan-Te/DailyTrack#121](https://github.com/Nathan-Te/DailyTrack/pull/121) (brouillon ; l'aperçu est commenté par la CI).

## En deux phrases

La scène du jeu — course, accueil, Salon, spectateur, revoir le meilleur tour, miniatures — et la colonne « Existant » de la vitrine passent maintenant **par un seul compositeur** (`apps/web/src/scene/socle.ts`), au palier « existant » ; **42 images avant / après sont identiques à `main` au pixel près** (0,000 % des pixels, écart maximum 0/255, seuil 0). Le mécanisme qui chargera à la demande les modules des pas et reconstruira la scène hors course est en place, prouvé avec un pas factice, et **aucun pas n'est encore activé dans le jeu**.

## 1. Ce qui a bougé dans le code

- **`src/scene/socle.ts` (nouveau, dans le premier chargement)** — *la seule construction de scène* :
  - `composer(track, palette, palier, options)` : construit la scène d'un circuit à un palier. `buildTrackScene` n'en est que le nom court du palier d'aujourd'hui (`PALIER_EXISTANT`) ; le jeu, les miniatures et la vitrine l'appellent. **L'ancien chemin a disparu** : `trackMesh.ts` n'a plus de `buildTrackScene` (l'assemblage — ciel, brume, lumières, ombres, phares, maillages fusionnés, halos, sol — a été **déplacé tel quel** dans `composerExistant`, `socle.ts`) ; il ne garde que les palettes, les ambiances (`LOOKS`), la géométrie (`trackGeometry`, lot 37) et ses éléments.
  - `Palier` = `existant` · `P1` · `P2` · `P3`. Seul « existant » est branché : un palier se branche en enregistrant son composeur (`brancherComposeur`) quand le module de ses pas est chargé ; sans quoi `composer` refuse (« palier pas branché : charger ses pas d'abord »).
  - **Pas à la demande** : `chargerPas(ids, registre)` (un `import()` chacun, mémorisé, un pas inconnu est une erreur) ; `PAS_DU_JEU` (le registre : **vide tant qu'aucun palier n'est activé**) et `PAS_DU_PALIER` (les pas de chaque palier). Les lots suivants y ajoutent leurs lignes (`finition`, `matiere`, `reflets`, `lumiere3`, `vie`, `post`…).
  - **Reconstruire hors course** : `creerReconstructeur` — `demander(palier)` charge les pas tout de suite (hors du chemin critique), `essayer()` reconstruit la scène si le jeu est à l'arrêt et **relit `peutReconstruire()` après chaque attente** : une course qui commence pendant le chargement des pas repousse la reconstruction au prochain arrêt. Des pas qui ne chargent pas : on garde la scène courante.
- **`src/main.ts`** : `reconstructeur` (`peutReconstruire` = `isFrozen() || phase === "finished"` : accueil, pause, arrivée, podium du Salon ; jamais en course ni pendant le décompte), `adopterScene` (la voiture, son ombre, le fantôme, les effets passent dans la nouvelle scène, l'ancienne est libérée : c'est le corps de `swapSalonCircuit`, mis en commun), un appel par image **seulement s'il y a une demande en attente** ; la scène du Salon se construit au palier courant. Crochet `?debug` : `__cdj.socle`.
- **Appelants** : `main.ts`, `thumbnail.ts` (miniatures), `vitrine/variantes.ts` et `vitrine/mouvement.ts` (la colonne « Existant (le jeu) » est maintenant construite par **le même code que le jeu**) importent `buildTrackScene` / `composer` du socle ; `scene/origine.ts` inchangé depuis le lot 37.
- **`direction.md`** : n'est plus un projet, il est la règle de la scène ; § 9 « Décisions » (les huit décisions de Nathan du 22/10/2026 et la liste de ce qui reste ouvert) ; règles de pose (§ 5) alignées sur le lot 37.
- **`apps/web/CLAUDE.md`** : rubrique « Scène (lot 39) » (une seule construction, le document de direction fait foi, un palier ne change jamais la simulation, jamais de reconstruction en course, modules des pas à la demande) ; la rubrique de la vitrine ne dit plus « projet ».

## 2. Le palier « existant » reproduit l'image d'aujourd'hui

Un seul chemin de code et le même qu'avant : l'assemblage de `buildTrackScene` a été déplacé dans le socle sans changement (mêmes objets dans le même ordre, mêmes matériaux, mêmes tirages au sort, lot 37 compris). La preuve est une comparaison **image par image** :

- **Outil** (hors CI, rangé avec ses images) : `e2e/captures-lot39.spec.ts` — `CAPTURES=1 LABEL=avant|apres npx playwright test captures-lot39 --project=chromium`, puis `COMPARER=1 … -g comparer`. Images de 640 × 360 dans `docs/lots/lot-39/avant/` (**`main`, lot 37 compris**) et `apres/` ; le verdict est `docs/lots/lot-39/comparaison.txt`.
- **Ce qui est comparé** (42 images) : pour **un circuit de chaque thème** (les jours du lot 37 : Stade 8/10, Rallye 21/10, Banquise 10/10 imposée, Nuit 14/10, Campagne 14/10 imposée, Canyon 6/10, Col 12/10, Ville 16/10) le **départ**, le **premier tremplin ou bosse**, un **virage serré**, l'**arrivée** et la **miniature** (octets de l'image de `renderThumbnail`) ; plus **l'accueil** (la scène du jour sous le cadre, Ville) et le **Salon** (démo, une session fixe).
- **Seuil : 0.** Un pixel est « différent » si un de ses canaux change de plus de 8/255 ; le test échoue si une seule image en a, sans tolérance. **Résultat : 0,000 % partout, écart maximum 0/255** — y compris l'accueil, le Salon et les miniatures.
- **Pourquoi le seuil peut être 0** : les premiers essais ne l'étaient pas (de 0 à 8 % des pixels d'un lancement à l'autre **sur `main` lui-même**, jusqu'à 238/255). Cause trouvée : en pause, la caméra n'avance qu'à l'image et garde le décalage (un demi-pixel) du dernier pas, qui change avec le rythme des images. L'outil ne met plus en pause : voiture immobile au pas voulu, la caméra converge en 700 ms et chaque lancement donne la même image ; deux lancements de `main` contre `main` ont donné **0,000 %, écart 0/255 sur les 42 images** avant qu'on touche au code.

## 3. Le mécanisme « pas à la demande » (prouvé avec un pas factice)

- **Unitaire** (`test/socle.test.ts`, 10 tests) : le registre charge chaque module une fois, *au moment où on le demande* ; un pas inconnu est refusé sans rien charger ; le registre du jeu et celui de chaque palier sont vides ; **ni `socle.ts`, ni `main.ts`, ni `thumbnail.ts` n'importent un module des pas de façon statique** (testé à la source) ; un palier pas branché est une erreur, branché il compose ; le reconstructeur : en course les pas se chargent mais la scène ne change pas ; à l'arrêt elle est reconstruite **une seule fois** ; une course qui commence pendant le chargement repousse la reconstruction au prochain arrêt ; des pas qui ne chargent pas laissent la scène courante ; redemander le palier courant annule la demande.
- **Dans le vrai jeu** (`e2e/socle.spec.ts`) : un pas factice et un palier « P1 » (la scène d'aujourd'hui sous un autre nom) sont enregistrés par la page. Rien n'est chargé avant la demande ; **demandé en pleine course, le palier charge son pas mais la scène (son identité) ne change pas, la course continue ; à la pause, elle est reconstruite une fois** (nouvelle scène, pas de seconde reconstruction), et la course reprend dedans.
- **Aucun pas n'est activé dans le jeu** : `PAS_DU_JEU` est vide, rien n'est demandé, `enAttente()` est faux : l'appel par image ne fait que lire un booléen.

## 4. Budget et performance

**Premier chargement : +644 o** (JS + CSS 256 990 → 257 634 o, `main` après le lot 37 mesuré à côté ; JS 245 578 → 246 222 o, hors three.js 112 812 → 113 456 o ; CSS, catalogue anglais, fils de travail, polices inchangés) : **sous les ≈ +2 ko du plan du 38b** et sous le ko de la règle commune ; marge 19 610 → 18 966 o, plafonds inchangés. Ce que ça paie : le registre, `chargerPas`, le reconstructeur, `adopterScene` et le crochet `?debug` ; l'assemblage de la scène n'a fait que changer de fichier. **Le code des paliers 1 à 3 reste hors du premier chargement** (aucun import statique, testé) ; la mesure unique du premier chargement (`mesureTrack`, graphe statique de `index.html`) le confirme. Ligne de Track de `budgets.md` remesurée.

**Appels de rendu et triangles** (profil téléphone 844 × 390 @2, processeur ×4, qualité 2 ; `MESURE=1 … mesure-lot39`, `main` servi à côté) — **identiques à l'unité près** :

| Scène | accueil, appels / triangles | départ, appels / triangles |
|---|---|---|
| Stade 8/10 | 128 → 128 / 45 128 → 45 128 | 128 → 128 / 45 128 → 45 128 |
| Nuit 14/10 | 131 → 131 / 96 654 → 96 654 | 131 → 131 / 96 654 → 96 654 |
| Ville 16/10 | 129 → 129 / 83 726 → 83 726 | 129 → 129 / 83 726 → 83 726 |

**Bascule d'une session du Salon** (durée de la bascule ; durée de construction de la scène, derrière le classement final — trois essais, ×4) : `main` 25,8 · 11,8 · 13,9 ms ; 248 · 230 · 366 ms → socle 10,2 · 11,9 · 3,9 ms ; 218 · 235 · 356 ms : dans le bruit (la scène est construite d'avance dans les trois cas). `perf.spec` (poids, chargement à ×4) : voir « Vérifié ». Chiffres bruts : `docs/lots/lot-39/mesure-perf-avant.json` et `-apres.json`. **Le temps d'image à ×4 en rendu logiciel** n'est pas une mesure fiable (voir le README du lot 37) : les appels, les triangles et les durées de construction le sont, et ils n'ont pas bougé.

## 5. Ce que le lot suivant (palier 1) n'aura plus qu'à brancher

Le plan du 38b (§ 7) : lot 40 (véhicule, en parallèle), puis lot 3 « palier 1 — éléments et lumière ». Il lui reste :
1. écrire le composeur du palier 1 (`composerPalier.ts` de la vitrine, `DIRECTION_P`) — **le décor, la route et les éléments du palier 1 doivent suivre les règles de pose du lot 37** (`placed`, `ROLES`, test de pose ; le Garde-corps de la Ville est à porter dans `scene/route.ts`, qui ne connaît que `wallHeight`) ;
2. lister ses pas dans `PAS_DU_JEU` (un `import()` chacun) et `PAS_DU_PALIER`, et **brancher son composeur** (`brancherComposeur("P1", …)`) depuis le premier de ces modules ;
3. appeler `reconstructeur.demander("P1")` (la règle automatique du 38b, § 5, est le lot du palier 2 ; le réglage « Qualité graphique » aussi) ;
4. refaire la comparaison d'images (`captures-lot39`) avec la différence voulue, et remesurer le budget (la ligne « décor 3D à la demande », 16 ko).
`composer` sait déjà construire un autre palier ; `adopterScene` le remplace hors course ; `QualityGovernor` fonctionne tel quel dans un palier (même `TrackScene`).

## Vérifié / non vérifié

**Vérifié** : 42 images avant / après identiques à `main` (accueil, Salon, huit thèmes × départ, tremplin, virage, arrivée, miniature ; seuil 0) ; bruit de fond `main` contre `main` nul ; `npx tsc -b` ; `test/socle.test.ts` (10) et `e2e/socle.spec.ts` ; appels, triangles et bascule du Salon avant / après ; budget remesuré. Les tests unitaires complets et les e2e ciblés : voir la fin de ce paragraphe une fois la CI lue.
**Non vérifié** : la CI de la PR (à lire sur la PR) ; Firefox et WebKit (la CI) ; un vrai téléphone (rien ne change à l'écran : aucun palier n'est branché).

## Décisions pour Nathan

1. **Aucune nouvelle** : le lot est un socle. Les décisions du 22/10 sont écrites dans `direction.md` § 9 ; les questions encore ouvertes y sont listées (vie au Stade, sponsors fictifs, panneaux de distance, feux au décompte, sol relevé, palette `neon`, budget du premier chargement des paliers ≈ +9 ko et ligne « décor 3D à la demande » à 16 ko).
2. Le palier « existant » est **la scène de `main` après le lot 37**, pas la « direction O » du lot 38 (`scene/origine.ts`) : celle-ci, qui ne reproduisait pas le décor, reste un contrôle de la vitrine ; à retirer avec les directions au lot de mise en œuvre du palier 1.

## À tester (2 clics, sur l'aperçu de la PR)

Tout doit être **exactement comme avant** : `/track/?home=0` (la course du jour), puis `/track/?mode=salon&api=demo` (le Salon en démonstration). Le jour passé de la Ville : `/track/?seed=2026-10-16&home=0`.
