# Lot 51 — Track : netteté en haute résolution, chrono du portique, la voiture des fantômes, la voiture sur tous les appareils

Branche `claude/modest-wright-n4kcw9` (nom imposé par la session ; le lot prévoyait `lot-51-nettete-voitures`), partie de `main` à `824bd8b` (lot 50 fusionné). Zones : `apps/web/**`,
`packages/sim/**`, `cdj.ts` et `salon.ts`, leurs tests, `docs/lots/**`, la ligne de Track de `budgets.md`, `durees.json`. **Exception autorisée par Nathan** (points 3 et 4 : des données
nouvelles côté serveur) : la liste des fichiers hors zone est en bas. Golden, rediffusions, classements et identifiants de circuit **inchangés** (la voiture n'est jamais dans la rediffusion).
Le nom de la branche ne porte ni `track` ni `jump` : la PR est une PR « plateforme » pour le job `zones` (aucune garde), ce que l'exception demande.

## État : tout est en place ; reste le rapport « après » du banc de Nathan, en résolution native

| À tester (aperçu de la PR) | Lien |
|---|---|
| **Le banc, en résolution native** (≈ 1 min 40, plein écran, ne rien toucher ; « Copier le rapport », le coller dans la session) — sur le portable, puis sur un écran 1440p ou 4K | `/track/?banc` |
| Netteté : la course en Auto puis en « Maximale », compteur `?debug` (60 images/s attendues) ; `__cdj.resolution` donne le tampon, la densité, la taille des cibles et le FXAA | `/track/?home=0&debug` |
| Chrono : lancer une course, recommencer (Entrée) : le chronomètre du portique repart de 0 | `/track/?home=0&palier=3` |
| Fantôme : choisir une voiture au Garage, finir la course du jour, l'ouvrir sur l'autre appareil (même profil) ; « revoir le meilleur tour » | `/track/` |
| Synchronisation : changer de voiture sur le PC, recharger sur le téléphone : elle y est, après l'accueil | `/track/` |

## 1. La netteté au-delà de 1080p

### Ce que le lot 50 avait changé à la résolution (retrouvé dans le code)
Une seule chose, et seulement quand la chaîne de post-traitement dessine : **`pixelsMax: PIXELS_CHAINE`** (2 073 600 pixels, un 1080p) dans `FORME_JEU` (`scene/post.ts`). `ChainePost.taille`
appliquait `echelleScene` : au-delà, la cible de la scène était **plus petite que le tampon** (×0,75 à 1440p, ×0,5 en 4K) et la passe de fin l'agrandissait ; `main.ts` compensait la taille des
halos en points et des particules (`PostJeu.echelle`, `echelleImage`). Rien d'autre : la densité du moteur restait `min(devicePixelRatio, 2)` ; **les paliers 1 et 2 (pas de chaîne) dessinent
directement dans le canevas, à la taille native** ; il n'y a **jamais eu de mise à l'échelle dynamique** (ni dans `qualite.ts` ni ailleurs : la règle de qualité change de *palier*, pas de
résolution). La chaîne est dans Auto depuis le lot 50 (`POST_DANS_AUTO`), d'où un défaut visible à partir de 1440p sur un ordinateur en Auto ou en « Maximale ». (Autre changement de netteté du
lot 50, non demandé ici : la scène de la chaîne n'a plus de multi-échantillonnage, le FXAA lisse seul.)

### Ce que le lot 51 fait
- **Le plafond de pixels est retiré** (`pixelsMax`, `echelleScene`, `PIXELS_CHAINE`, `ChainePost.echelle`, `PostJeu.echelle`, `echelleImage` de `main.ts`, les variantes « plafond » du banc) : la cible de
  la scène a toujours la taille du tampon (largeur × hauteur × densité plafonnée à 2). **Seule la cible du halo est réduite** (la moitié de l'écran, floue par nature). On garde ce que le lot 50
  avait fait pour gagner du temps : une seule passe de fin, pas de halo le jour et un halo léger la nuit, pas de double multi-échantillonnage, rien par image qui parcoure les matériaux.
- **FXAA coupé à partir de la densité de dessin 1,75** (`fxaaVoulu`, `DENSITE_SANS_FXAA` ; `PostJeu.effectives` pour le dessin **et** la précompilation) : à 2 il floute plus qu'il n'aide.
- **Mise à l'échelle dynamique : aucune** (rien à retirer ; si le banc de Nathan en montrait le besoin, elle ne viendrait qu'avec son accord, sur mesure en course, jamais sous 0,85, jamais par défaut).
- **Le banc (version 4 du rapport)** : l'en-tête dit le canevas (CSS) **et le tampon** ; chaque mesure dit son tampon et **la taille de chaque cible** (la scène, puis celles du halo), dans le tableau et le JSON ;
  `rapportValide` exige `resolutionConforme` (tampon = canevas × densité, partie entière ; cible de la scène = tampon ; halo ≤ tampon). Plus de variantes de plafond.
- **Tests** : `test/banc.test.ts` (tampon = fenêtre × densité à 1080p, 1440p, 4K, 1,5 ; une scène plus petite que le tampon est refusée), `test/post.test.ts` (aucun plafond dans le code, densité plafonnée à 2, FXAA
  coupé ≥ 1,75), `e2e/rendu.spec.ts` (**Essentiel**, densités 1,5 et 2 : canevas = fenêtre × densité aux paliers 1, 2 et 3, cible de la scène = tampon, halo plus petit, FXAA coupé ≥ 1,75), le banc court de `e2e/post.spec.ts`.

### Tailles avant / après (canevas et cibles ; mémoire = 8 octets par pixel de scène, halo = la Nuit)
| Écran | Canevas | Scène avant (lot 50) | Scène après | Halo (1ʳᵉ cible) avant → après | Mémoire scène + halo, avant → après |
|---|---|---|---|---|---|
| 1080p, densité 1 | 1920 × 1080 | 1920 × 1080 | 1920 × 1080 | 960 × 540 → 960 × 540 | 15,8 + 14,5 → 15,8 + 14,5 Mo |
| 1440p, densité 1 | 2560 × 1440 | **1920 × 1080** (×0,75) | **2560 × 1440** | 960 × 540 → 1280 × 720 | 15,8 + 14,5 → 28,1 + 25,8 Mo |
| 4K, densité 1 | 3840 × 2160 | **1920 × 1080** (×0,5) | **3840 × 2160** | 960 × 540 → 1920 × 1080 | 15,8 + 14,5 → 63,3 + 58,0 Mo |
| Portable 1920 × 1200, densité 1,5 | 1920 × 1200 | 1821 × 1138 (×0,95) | 1920 × 1200 | 911 × 569 → 960 × 600 | 15,8 + 14,5 → 17,6 + 16,1 Mo |
| Portable 2560 × 1600, densité 1,5 | 2560 × 1600 | 1821 × 1138 (×0,71) | 2560 × 1600 | 911 × 569 → 1280 × 800 | 15,8 + 14,5 → 31,3 + 28,6 Mo |
| 1280 × 720, densité 2 | 2560 × 1440 | 1920 × 1080 (×0,75), FXAA | 2560 × 1440, **sans FXAA** | 960 × 540 → 1280 × 720 | 15,8 + 14,5 → 28,1 + 25,8 Mo |

Sans chaîne (paliers 1 et 2, ou Auto qui a retiré la chaîne) : canevas direct, inchangé. **Le coût est la mémoire et la bande passante en 4K** (la chaîne y pèse ≈ 121 Mo la Nuit contre ≈ 30 Mo) : à Nathan de dire,
au banc, si l'Iris Xe le tient (sinon `POST_DANS_AUTO = false` : une ligne, la chaîne reste en « Maximale »).

### Captures avant / après (tailles réelles : recadrages de 960 × 540 pixels de l'écran, sans mise à l'échelle)
Outil `e2e/captures-lot51.spec.ts` (`CAPTURES=1`, rendu logiciel, Stade, départ, `?appareil=ordinateur&palier=3`) ; « avant » = `main` (lot 50) servi à part. `__cdj.resolution` confirme chaque cas.
| Cas | Avant (scène plafonnée) | Après (résolution native) |
|---|---|---|
| 1440p (tampon 2560 × 1440, scène avant 1920 × 1080) | [`1440p-avant.jpg`](lot-51/nettete/1440p-avant.jpg) | [`1440p-apres.jpg`](lot-51/nettete/1440p-apres.jpg) — scène 2560 × 1440 |
| 4K (tampon 3840 × 2160, scène avant 1920 × 1080) | [`4k-avant.jpg`](lot-51/nettete/4k-avant.jpg) | [`4k-apres.jpg`](lot-51/nettete/4k-apres.jpg) — scène 3840 × 2160 |
| 1280 × 720, densité 2 (tampon 2560 × 1440, **FXAA coupé**) | [`1440p-densite2-avant.jpg`](lot-51/nettete/1440p-densite2-avant.jpg) | [`1440p-densite2-apres.jpg`](lot-51/nettete/1440p-densite2-apres.jpg) — `fxaa: false` |
À l'œil (4K, cinq images regardées au plus) : avant, les bords des bordures, la ligne médiane et la pancarte sont étalés (la scène à moitié de résolution, agrandie) ; après, ils sont francs.

### Performance : ce qui est vérifié, ce qui ne l'est pas
**Non vérifié ici** (le rendu logiciel de la CI n'a pas d'avis sur une carte intégrée) : le palier 3 à 60 images/s en résolution native sur l'i7-1260P, et la chaîne à 1440p/4K. Les mesures du lot 50 (rapport 2,
2560 × 1440, densité 1, **scène à la taille de l'écran, sans plafond**) disent : Stade 60 images/s (pire image 17 ms, carte graphique 12,1 ms), Nuit 51,9 puis 59,9 (15,8 ms) — c'est la forme qui revient. **Arrêt demandé :** Nathan lance
`/track/?banc` (version 4) sur le portable puis sur un 1440p ou un 4K ; lire : la médiane et le pire temps d'image, « carte graphique par passe » (`scene`, `halo`, `fin`), et la colonne « Cibles ».

## 2. Le chronomètre du portique
Il affichait le *temps d'affichage* (`animer(t)`, modulo 60 s) : il ne revenait jamais à zéro. Il lit maintenant **le temps de la course en cours**, en lecture seule comme les feux du lot 43 : `view.chrono(secondes)`
(`main.ts`, à chaque image : `raceElapsedMs(race) / 1000`, 0 au décompte, au « recommencer » et sans course ; `composerP1` → `vieJeu` → `Chronometre.afficher`, format `M:SS.d`). Il ne change rien à la course.
Test : `e2e/rendu.spec.ts` (le chronomètre reste à 0 pendant le décompte, suit la plaque du HUD au dixième près, **revient à 0 à Entrée**, repart au départ) + `texteChrono` (unitaire).
**Vérifié ailleurs** : les écrans de la tribune ne montrent que les sponsors fictifs qui défilent (aucun temps de course) ; au Salon la course est la même boucle de jeu (`view.chrono`) et chaque session reconstruit la scène (chrono neuf à 0).
La vitrine (`composerPalier`) n'a pas de course : son chronomètre y reste sur le temps d'affichage.

## 3. Le fantôme garde la voiture de sa course
- **Donnée** : `VoitureDeCourse` (`packages/sim/src/garage.ts` : `id`, `couleur`, `motif`, `teinteMotif`), texte `id.couleur.motif.teinte` dans `results.car` et `salon_runs.car` (`NULL` pour une ligne d'avant). **Jamais dans la rediffusion** (test serveur : la
  `replay` rendue est celle qui a été envoyée).
- **Envoi** (`POST /api/submit`, `POST /api/salon/<s>/submit`, corps `voiture`) : la voiture **de la course** — `VoitureEnJeu.affichee`, celle qu'on voit (elle ne change jamais en course), enregistrée avec le record (`BestRun.voiture`) :
  l'envoi d'un record ancien porte la voiture de ce record, pas celle d'aujourd'hui. Le serveur la vérifie sur la progression d'après cette course (`voitureAutorisee`) : **verrouillée ou illisible → la Sparrow en orange**. La progression est lue
  *avant* l'écriture (la même requête qu'avant : aucune lecture de plus à l'envoi du jour).
- **Rendue** : `voiture` avec le fantôme du jour (`first`, `ahead`), chaque fantôme du Salon, `best` de `GET /api/me`. Course d'avant ou valeur abîmée : la Sparrow en orange.
- **Affichée** : les fantômes (le premier, le joueur devant, **ton record — la voiture de ce record**, ceux du Salon) montrent le modèle de leur voiture **en version simple** (`voiture/fantomes.ts`, à la demande) ; « revoir le meilleur tour »
  et le spectateur la montrent **en version complète** (`VoitureEnJeu.regarder` : modèle, couleur, motif, teinte), le pseudo reste au-dessus (il suit la voiture quand elle est remplacée).
  Le fantôme est de teinte unie : seul le modèle compte. Au Salon une place = un modèle (`GhostField.poserVoiture`).
- **Chargement à la demande — chiffres** (mesurés en Node, construction d'un fantôme ; `civile` déjà dans le premier chargement) : **1 maillage et 368 à 440 triangles par fantôme** (les dix modèles), construction ≈ 0,4 à 2,7 ms (×4 à ×6 sur un téléphone),
  plan de voiture ≈ 1,7 à 2,1 ko compressés par modèle (7 à 62 ms d'`import()` en Node, une seule fois par modèle, gardé). **Au pire (Salon, dix voitures différentes)** : au plus **six modèles posés à la fois** (cinq autres joueurs + ton tour), donc **six maillages et six étiquettes, exactement comme
  avant** : *aucun appel de rendu de plus* ; ≈ 20 ko compressés de plans en tout, chargés pendant la session. Test : six places, six modèles différents, six maillages.
- Tests : `apps/api/test/garageVoiture.test.ts` (SQLite **et** libSQL : jointe à l'envoi, verrouillée → Sparrow, ancienne course → Sparrow, meilleur temps remplace la voiture, `ahead`, `/api/me`, Salon), `test/voitureCourse.test.ts`, `e2e/voiture-course.spec.ts`.

## 4. La voiture sur tous les appareils du même profil
- **Serveur** : table `garage_choices` (`player_id`, `car`, `minute`), **`PUT /api/garage`** (en-tête `X-Player-Id`, corps `{ voiture, minute }`) : **voiture verrouillée refusée** (`enregistre: false`), **choix illisible → Sparrow en orange**, **dernier choix gagnant à la minute près**
  (plus ancien refusé, même minute écrase, futur ramené à maintenant + 1), 404 `unknown_player` tant que le joueur n'est pas classé, code révoqué refusé ; réponse = ce que le serveur garde. Relu **sans requête de plus** : `garage` dans `GET /api/me` (lu au lancement et au retour à l'accueil)
  et `choix` dans `GET /api/garage` (ouverture du Garage). « Changer mon code » : le choix suit ; effacement d'un joueur : `erase` l'efface (test).
- **Jeu** (`voiture/synchro.ts`, **à la demande** — jamais dans le premier chargement) : `cdj:track:garage` reste la copie locale (voitures vues, pastille « Nouveau ») et reçoit `minute` / `envoye`. Choisir au Garage note la minute et envoie (seulement si le choix change : toucher la couleur déjà
  choisie n'écrase pas un choix plus récent fait ailleurs) ; **hors connexion** il part au profil suivant ou au retour du réseau (`online`) ; après la première course d'un joueur neuf ; **le plus récent gagne** ; refusé par le serveur : l'appareil reprend ce que le serveur garde ; la voiture reçue s'ajoute aux voitures
  débloquées de l'appareil ; remplacée **hors course** (`garage.relire` → `tick`, comme en 40b). Un choix d'avant le lot (sans minute) est envoyé si le serveur n'a rien, sinon le serveur gagne.
- **Coût** (`platformBudget.ts`, `TRACK_PLAYER`) : **zéro requête de plus par chargement** ; un enregistrement (une requête, une ligne écrite + deux compteurs de débit) par jour où le joueur change de voiture : 15 → **16 requêtes**, 1 878 → 1 911 lignes lues, 42 → 45 écrites.
- Tests : `garageVoiture.test.ts` (enregistré, relu par le même identifiant, verrouillée refusée, illisible, minute, futur, inconnu, révoqué, code changé, débit, effacement), `voitureCourse.test.ts` (deux appareils, dernier choix gagnant, hors connexion puis reconnexion, refus), `e2e/voiture-course.spec.ts` (vrai serveur, **deux appareils**, port 8799).

## Budget (premier chargement de Track, `docs/plateforme/budgets.md`, « Lot 51 »)
**+726 o** (289 425 → **290 151 o**, plafond 291 600, marge 1 449 o ; `main` reconstruit à part sur la même machine) : sous la cible de 1 ko. La synchronisation du choix (`synchro.ts`, 1 016 o) et la construction des fantômes
(`fantomes.ts`, 494 o) sont **à la demande** ; sans l'exclusion de `vite.config.ts` l'empaqueteur les rangeait dans le morceau `voiture` du premier chargement (+830 o). Lignes à la demande : `track.vieCiel` 7 998 / 8 000 (le chronomètre
du portique, +7 : **2 o de marge**, à relever par Nathan au prochain lot de la vie et du ciel), `track.garage` 9 026 / 10 000. Catalogues, fils de travail et polices inchangés (**aucune clé de catalogue** : `npm run traductions -- --verifier` vert).

## Vérifié / non vérifié / décisions pour Nathan
- **Vérifié** : `npm test` (SQLite **et** libSQL) ; e2e `rendu`, `voiture-course` (vrai serveur, deux appareils), `perf`, `post` (dont le banc court), `garage`, `ghost`, `watch`, `watch-serveur`, `salon`, `leaderboard`, `profil`, `vie-ciel`, `socle`, `voiture` verts, en Chromium, en un worker à la fois
  (`watch.spec:52` est sensible à la charge : il échoue quand deux pages dessinent côte à côte, il passe seul, sur `main` comme ici). Golden et rediffusions inchangés.
- **Non vérifié** : les 60 images/s du palier 3 à la résolution native sur l'i7-1260P, et la chaîne à 1440p / 4K sur une carte intégrée (le rendu logiciel n'en dit rien) ; Firefox et WebKit (seule la CI de `main` les lance). **Le rapport du banc de Nathan (version 4, résolution native) est attendu dans la session** (ci-dessus, « Arrêt demandé »).
- **Décisions** : (1) si le banc dit que la chaîne ne tient pas à la résolution native sur l'Iris Xe, `POST_DANS_AUTO = false` (une ligne ; la chaîne reste en « Maximale ») — la mémoire de la chaîne en 4K (≈ 121 Mo la Nuit) est à regarder ; (2) la limite de `track.vieCiel` (2 o de marge) ;
  (3) le choix de voiture d'un joueur **pas encore classé** reste sur son appareil jusqu'à sa première course (le serveur ne garde rien pour un inconnu) ; (4) **mentions légales** : la voiture de chaque course et le choix du Garage y sont décrits (français et anglais) — à relire ;
  (5) `smoke` n'a pas de contrôle de `PUT /api/garage` (script de la plateforme, hors de l'exception) ; (6) les jeux de données de démonstration (`public/demo`) n'ont pas de voiture : la Sparrow en orange, jusqu'à leur prochaine génération.

## Fichiers touchés hors de la zone de Track (exception du lot, un par un)
- `apps/api/src/db.ts` — `MIGRATIONS` : `ALTER TABLE results / salon_runs ADD COLUMN car` (en avant seulement) ; `apps/api/src/remiseAZero.ts` — `garage_choices` rejoint `TABLES_VIDEES` (+ libellés).
- `apps/portail/mentions-legales/index.html` et `apps/portail/legal/index.html` — la voiture de chaque course et le choix du Garage (rubrique « Ta voiture dans DailyTrack », `data-tables="garage_choices"`) ; parité vérifiée par `mentions.test.ts` (inchangé, vert).
- `docs/plateforme/effacement.md` (le choix de voiture est effacé) ; `docs/plateforme/codes-erreur.md` (`PUT /api/garage` dans les routes des codes existants — **aucun code d'erreur créé** ; `codesErreur.test.ts` inchangé : son parcours couvre déjà `/api/garage` en PUT).
- `apps/api/scripts/platformBudget.ts` — `TRACK_PLAYER` ; `apps/api/test/jumpProfile.test.ts` — la liste exacte des champs de `GET /api/me` gagne `garage` (une ligne).
- `e2e/zones.json` (deux nouveaux specs), `docs/plateforme/budgets.md` (ligne de Track), `apps/api/CLAUDE.md` et `apps/web/CLAUDE.md` (consignes demandées).
- Si un lot de plateforme travaille en parallèle sur ces fichiers, la seconde fusion réconcilie (`db.ts`, `remiseAZero.ts`, `platformBudget.ts`, mentions).

## Liens
Lot 50 : `docs/lots/lot-50-post-perf.md` · lot 41 (Garage) : `docs/lots/lot-41-garage.md` · lot 40c (fantôme simple) : `docs/lots/lot-40c-voitures-qualite.md` · lot 43 (feux) : `docs/lots/lot-43-palier1-elements.md`.
