# Budgets de poids — la référence (lot I6)

**Ce fichier est la référence des budgets de la plateforme** (`CLAUDE.md` racine). Pour chaque application : le budget, le chiffre actuel, la marge. Les limites sont celles que les tests imposent (colonne « gardé par ») ; `apps/portail/test/budgets.test.ts` vérifie que ce tableau dit les mêmes limites que les tests. Un lot qui change un poids **remesure** (`npm run build && node scripts/budgets.mjs`, même méthode que les tests) et met à jour ce tableau ; un budget ne se relève qu'avec Nathan.

Octets **compressés** (gzip) pour le JS, le CSS et le HTML ; octets des fichiers pour les polices (déjà compressées, `woff2`) et les images. Premier chargement d'un joueur **en français** : l'anglais est chargé à la demande.

## Le tableau

« Avant » = `main` au début du lot I6 (`df53a33`) ; « après » = la fin du lot I6, retouche avant fusion comprise (vocabulaire anglais, boutons de segment). Mesures locales (`node scripts/budgets.mjs`), identiques à celles des tests. **Lignes de Track** (lot de plateforme « suites de Track », 22/10/2026) : « avant » = `main` à la fin du lot 36 (`1842813`), l'ancien décompte de `perf.spec.ts` (graphe de `index.html` **plus** la page d'admin) ; « après » = la **mesure unique** (`mesureTrack`, `scripts/budgets.mjs`, importée par `perf.spec.ts`), qui ne compte plus la page d'admin.

| Clé | Application | Mesure | Budget (o) | Avant | Après | Marge | Gardé par |
|---|---|---|---|---|---|---|---|
| `portail.premier` | Portail | premier chargement de l'accueil (HTML, JS, CSS) | 30 720 | 22 360 | 23 694 | 7 026 | `apps/portail/test/construction.test.ts` |
| `portail.polices` | Portail | polices de l'accueil | 153 600 | 117 992 | 117 992 | 35 608 | `apps/portail/test/construction.test.ts` |
| `track.jsCss` | Track | JS + CSS du premier chargement (plafond : lot 43, +15 000, décision de Nathan du 23/10/2026) | 291 600 | 256 990 | 274 646 (lot 39 : +644 ; lot 40 : +1 689 ; lot 43 : +9 466 ; 40b : +7 512 ; lot 44 : −1 655) | 16 954 | `apps/web/e2e/perf.spec.ts` |
| `track.js` | Track | JS du premier chargement (plafond : lot 43, +15 000, décision du 23/10/2026) | 280 200 | 245 578 | 263 234 (lot 39 : +644 ; lot 40 : +1 689 ; lot 43 : +9 466 ; 40b : +7 512 ; lot 44 : −1 655) | 16 966 | `apps/web/e2e/perf.spec.ts` |
| `track.horsThree` | Track | le code du jeu, hors three.js (plafond : lot 43, +15 000, décision du 23/10/2026) | 147 500 | 112 812 | 129 691 (lot 39 : +644 ; lot 40 : +1 681 ; lot 43 : +9 375 ; 40b : +6 834 ; lot 44 : −1 655) | 17 809 | `apps/web/e2e/perf.spec.ts` |
| `track.anglais` | Track | catalogue anglais (à la demande) | 8 000 | 6 104 | 7 585 (lot 43 : +18 ; 40b : +270, noms et descriptions des voitures) | 415 | `apps/web/e2e/perf.spec.ts` |
| `track.miniatures` | Track | fil de travail des circuits : miniatures et circuit du jour (à la demande) | 30 000 | 26 524 | 26 524 | 3 476 | `apps/web/e2e/perf.spec.ts` |
| `track.salon` | Track | fil de travail du Salon (à la demande) | 32 000 | 28 502 | 28 502 | 3 498 | `apps/web/e2e/perf.spec.ts` |
| `track.admin` | Track | page d'admin `admin-*.js` (à la demande, jamais chargée par un joueur ; **hors** du premier chargement) | 12 500 | 10 883 | 11 084 (lot 43 : +22 ; 40b : +177, la voiture d'essai) | 1 416 | `apps/web/e2e/perf.spec.ts` |
| `track.polices` | Track | polices | 153 600 | 139 604 | 139 604 | 13 996 | `apps/web/e2e/perf.spec.ts` |
| `jump.jsCss` | Jump | JS + CSS du premier chargement | 378 490 | 375 298 | 377 003 | 1 487 | `apps/jump/e2e/poids.spec.ts` |
| `jump.anglais` | Jump | catalogue anglais (à la demande) | 8 000 | 4 226 | 5 560 | 2 440 | `apps/jump/e2e/poids.spec.ts` |
| `jump.polices` | Jump | polices | 153 600 | 94 212 | 94 212 | 59 388 | `apps/jump/e2e/poids.spec.ts` |
| `partage.image` | Site | chaque image de partage (1200 × 630, PNG) | 153 600 | — | 42 687 (portail ; Track 28 039, Jump 29 489) | 110 913 | `scripts/images-partage.mjs`, `apps/web/e2e/domaine.spec.ts` |

## Lot 15 de DailyJump (horloge unique)

- **Jump : −7 923 o** (377 325 → 369 402 o, marge 1 165 → 9 088 o). Le lot ajoute ≈ 3 630 o (la simulation joue deux versions — lecture de `version` et des phases, horloge de section, reprise au départ, « Prêt… » au chrono négatif —, le générateur g10 — phases calculées sur la référence, point de reprise sûr, variantes refusées —, deux fois : paquet principal et fil de travail du générateur ; et le « Prêt… » du jeu). Pour tenir, **le catalogue embarqué est allégé** (`catalogOf`, `packages/jump-sim/tools/files.ts`) : le jeu ne garde de chaque solution que la rediffusion, ses pas et la note ; la gigue, le raccord, la plus rapide et l'appui le plus court restent dans `modules/solutions.json` pour les outils et les tests (≈ 5,5 ko par paquet). Mesuré avec la méthode du test, `main` (`96b55a5`) reconstruit à part sur la même machine : 377 325 o, comme le tableau.

## Lot 16 de DailyJump (seconde voie)

- **Jump : +5 907 o** (369 406 → 375 313 o, marge 9 084 → 3 177 o), dans son budget (pas de relèvement). Le lot ajoute le module des voies lentes (géométrie, pilote de la solution lente, coût, médailles ajustées, vérification « aucun raccourci ») au générateur, deux fois (paquet principal et fil de travail du générateur), et le repère d'entrée et la surimpression `?debug` du jeu. Mesuré avec la méthode du test, `main` (`b256979`) reconstruit à part sur la même machine : 369 406 o.

## Lot 17 de DailyJump (ajustements)

- **Jump : +1 322 o** (375 681 → 377 003 o, marge 2 809 → 1 487 o), dans son budget (pas de relèvement). Mesuré avec la méthode du test (`node scripts/budgets.mjs`), `main` (`ec376b5`, fin du lot 16 et lot 35) reconstruit à part sur la même machine : 375 681 o (le tableau disait 375 313 o à la fin du lot 16 : les lots intercalés avaient déjà ajouté 368 o). Le lot ajoute l'estompage des dangers à horloge pendant le carnage (`sawArt.ts` sorti de `scene.ts` avec ses pièces sans recouvrement, le facteur passé aux blocs et au vent, le réglage), le carnage de démonstration d'un niveau du jour (`?carnage=demo`) et trois variantes de morceaux (solutions embarquées). Catalogue anglais : 5 550 → 5 560 o (un message de la démonstration). **La marge est maintenant de 1,5 ko** : un prochain lot de Jump qui ajoute du code en retire ailleurs ou demande à Nathan de relever le budget.

## Ce que le lot I6 a changé (avant / après)

- **Track : −115 o de marge** (735 → 620 o). Le lot ajoute le suivi du focus des écrans en surimpression (`suivreDialogue` de `@cdj/ui`, ≈ 600 o) et le lien des mentions selon la langue ; il retire 23 clés de catalogue jamais lues (≈ 100 o) et **sort l'anglais du catalogue commun du premier chargement** (≈ 420 o rendus : il voyage maintenant avec l'anglais du jeu, chargé à la demande — d'où +1 156 o au catalogue anglais, toujours sous son budget). Le nettoyage seul (clés, textes des aperçus de partage hors du paquet) rendait 101 o (283 264 o mesurés à mi-lot) ; c'est l'accessibilité qui les reprend. La retouche avant fusion rend 6 o (un `flex` de segment plus court, des libellés anglais plus courts).
- **Jump : −46 o de marge** (3 192 → 3 146 o) : mêmes ajouts et mêmes retraits (4 clés retirées).
- **Portail : +452 o** (les balises de partage dans `index.html`, comptées dans son premier chargement ; les textes des aperçus sont dans un catalogue lu seulement à la construction).
- **Les aperçus de partage ne coûtent rien aux jeux** : leurs textes (`apercu.*`) sont dans `catalogue.apercu.ts`, lus seulement par `vite.config.ts` ; les balises sont dans le HTML (hors budget JS + CSS des jeux).

## Lot 32 (Track) : l'identifiant du joueur dans l'en-tête

- **Track : −40 o** (283 480 → 283 440 o, marge 620 → 660 o ; JS 272 225 → 272 185 o, hors three.js 139 459 → 139 419 o ; catalogue anglais, fils de travail et polices inchangés). Les adresses n'ont plus `&player=…` ni `encodeURIComponent`, l'identifiant n'est plus dans le corps d'un envoi ; l'en-tête s'écrit par une seule fonction (`asPlayer`) et l'appel de `LeaderboardApi` passe par `ProfileClient.call`. Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `2bd5b93`) et après.

## Lot 33 (Track) : partage qui se copie, classement final du Salon

- **Track : +404 o** (283 440 → 283 844 o, marge 660 → 256 o ; JS 272 185 → 272 589 o, hors three.js 139 419 → 139 823 o ; catalogue anglais 7 245 → 7 224 o). Le lot ajoute le champ de repli de « Copier » et la séparation classement final / circuit suivant, et compense en partie en retirant l'ancienne copie par `execCommand`, 7 clés de catalogue (dont l'ancien « Partager mon temps ») et la reconstruction du podium à chaque seconde (le décompte seul est mis à jour). Fils de travail et polices inchangés. Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `eb6647d`) et après.

## Lot I7 : le plein écran et la caméra en vue

- **Track : budget JS + CSS relevé de 1 024 o** (284 100 → 285 124 o ; autorisé par Nathan, au plus 1 024 o) ; **la marge tombe à 57 o**. Le lot ajoute 1 223 o compressés à `main` (283 844 → 285 067 o : JS +1 066 o, CSS +157 o) **après avoir été resserré** : la première version ajoutait 1 529 o (285 373 o) ; le budget de JS hors three.js (141 000 o) et celui du JS (274 000 o) tiennent sans relèvement (marges 111 o et 345 o). Ce qui a été retiré de Track : la logique de plein écran de la pause (`touchUi.ts`, types préfixés WebKit compris) et l'icône `plein-ecran` propre à Track ; le bouton caméra réutilise `cycleCamera` (aucune fonction de plus) et **ses noms réutilisent les clés existantes** (`course.camera.proche|loin|capot` s'écrivent désormais « Caméra : proche » : le bandeau et la pause aussi, au lieu de « Caméra proche »).
- **Ce qui coûte** (mesuré en retirant chaque pièce de la première version) : l'astuce de l'iPhone ≈ 370 o (code seul), les deux boutons du HUD, leur place et leur nom lu ≈ 240 o, le plein écran de la barre de l'accueil ≈ 45 o ; le reste est le module de plein écran, le composant du bouton, les textes du catalogue commun et la feuille. **Ce qui a été coupé pour tenir** : la prise en charge du préfixe WebKit du plein écran (−65 o ; Track l'avait, Jump non : iPad avant iPadOS 16.4, qui n'a désormais pas de bouton), le test `navigator.standalone` du mode application (le `display-mode: standalone` suffit, iOS 13 et plus), l'injection d'un navigateur fictif dans les fonctions (−145 o : les tests remplacent la page par `vi.stubGlobal`), les quatre clés de nom de caméra.
- **Jump : −1 083 o de marge** (2 248 → 1 165 o), dans son budget (pas de relèvement) : mêmes ajouts, sans le bouton caméra. **Portail : +882 o** (22 812 → 23 694 o, marge 7 026 o) : le socle a grandi du plein écran (la barre des jeux importe le bouton).
- Piste si un lot Track en a besoin ensuite : charger l'astuce de l'iPhone à la demande (`import()` : elle ne sert que sur un iPhone ; son fichier serait à sortir du décompte du premier chargement, comme le catalogue anglais — décision de budget à prendre avec Nathan).
- Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `e5658f9`) et après.

## Lot 34 (Track) : moins de virages-pièges après les boosts

- **Track : budgets relevés, autorisés par Nathan** (21/10/2026) : JS + CSS 285 124 → **286 400 o**, JS 274 000 → **275 000 o**, hors three.js 141 000 → **142 300 o**, fil des miniatures 26 000 → **26 600 o**. La règle « freinage possible après un boost » vit dans le générateur, que le jeu charge au premier écran (le circuit du jour se calcule dans la page) et que les deux fils de travail embarquent : **+1 214 o** au premier chargement (285 067 → 286 281 o, marge 119 o ; JS +1 214 o, CSS inchangé), +1 101 o au fil des miniatures (25 385 → 26 486 o), +1 074 o au fil du Salon (27 372 → 28 446 o, sous son budget). Le module de mesure des virages-pièges (`traps.ts`) n'est pas dans le paquet (mesure et tests seulement).
- **Ce qui a été essayé pour tenir** : le code resserré (compteurs de mesure, plafond de lignes droites simplifié : −100 o) ; sortir les circuits de scénario d'essai (`?scenario=…`) du premier chargement : **+100 o au lieu d'un gain** (leurs textes se compressent presque pour rien dans le gros morceau, et le morceau à part a son coût), abandonné. Piste suivante si un lot Track en a besoin : calculer le circuit du jour dans un fil de travail (le générateur et les figures sortiraient du premier chargement : ≈ 11 ko compressés à eux deux, mesurés hors paquet), un chantier à part.
- Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `96b55a5`) et après.

## Lot 35 (Track) : la page d'admin « Médailles »

- **Track : budgets relevés de 1 000 o, autorisés par Nathan** (21/10/2026) : JS + CSS 286 400 → **287 400 o**, JS 275 000 → **276 000 o**, hors three.js 142 300 → **143 300 o**. La mesure (`perf.spec.ts`, `scripts/budgets.mjs`) compte **tout** le JS de `dist/assets`, donc aussi la page d'admin (`admin-*.js`), que les joueurs ne chargent jamais : la section « Médailles » (outil de calibrage du lot 35) y ajoute **+933 o** (286 281 → 287 214 o ; le jeu lui-même ne change pas d'un octet). Pour tenir : en-têtes, légende et cibles dans le HTML de l'admin (non compté), code resserré (≈ 1,5 ko au premier jet). Piste pour un lot de plateforme : ne plus compter `admin-*.js` dans la mesure du premier chargement.
- Mesure : `npm run build && node scripts/budgets.mjs`, avant (`main` à `7082e5c`) et après.
- **Étape 2 (calibrage)** : les seuils datés (`medalsFor(pilote, jour)`, `MEDAL_FACTORS_35`, `BASCULE_LOT_35`) entrent dans le générateur du premier chargement : **+61 o** (287 214 → 287 275 o, marge 186 → 125 o ; JS 275 802 → 275 863 o). Mesure : avant (`main` à `af12115`) et après.

## Lot 36 (Track) : alléger le premier chargement

- **Track : −21 221 o sur le premier chargement, plafonds inchangés** (JS + CSS 286 901 → **265 680 o**, marge 125 → **21 720 o** ; JS 275 489 → 254 268 o ; hors three.js 142 723 → 121 502 o ; CSS inchangé à 11 412 o). Le générateur de circuits (figures, règles de freinage, pilote de validation), les circuits des scénarios d'essai, le pilote de la démo, le Salon et le spectateur ne sont plus dans le premier chargement : le circuit du jour se calcule dans le fil de travail (celui des miniatures, partagé), le reste se charge à la demande. Détail, temps avant / après et essais abandonnés : `docs/lots/lot-36-allegement.md`.
- **La méthode de mesure a changé** (`apps/web/e2e/perf.spec.ts`, `premierChargement()`) : le premier chargement est ce que `index.html` demande (entrée, `modulepreload`, imports statiques de proche en proche), non plus « tout le JS de `dist/assets` moins quatre préfixes » : un morceau chargé par `import()` n'y compte jamais, quel que soit son nom. `admin-*.js` (jamais chargé par un joueur) reste compté, comme depuis le lot 35. Avec l'ancienne méthode `main` donnait 275 863 o de JS ; avec la nouvelle, 275 489 o (la page `verify`, 374 o, n'est plus comptée) : c'est le « avant » ci-dessus. **Le tableau ci-dessus donne les chiffres de la méthode du test.**
- **Pour un lot de plateforme** : fait par le lot « suites de Track » (section suivante) : `scripts/budgets.mjs` suit désormais le même graphe, et la page d'admin (10 882 o) est sortie du premier chargement.
- **Fil de travail des circuits** (miniatures et circuit du jour) : 26 542 → 26 524 o sur cette machine (plafond 26 600 o inchangé, **marge 76 o**) ; le fil du Salon 28 513 → 28 502 o. Les chiffres « avant » de cette machine sont ≈ 60 o au-dessus de ceux du tableau du lot 35 (26 486, 28 446) : les marges ci-dessus sont celles qu'elle mesure.
- Mesure : `npm run build`, puis `premierChargement()` de `perf.spec.ts` (le test), avant (`main` à `826ba25`) et après.

## Lot de plateforme — suites de Track (22/10/2026)

- **Une seule mesure du premier chargement de Track** : `mesureTrack` de `scripts/budgets.mjs` (le graphe statique de `index.html` : entrée, `modulepreload`, feuilles, imports statiques de proche en proche), que `apps/web/e2e/perf.spec.ts` **importe** au lieu de garder sa copie. `node scripts/budgets.mjs` et `perf.spec.ts` donnent le même chiffre, à l'octet près (le test l'écrit dans ses annotations). Test sur un petit `dist` factice, sans construction : `apps/portail/test/mesureTrack.test.ts` (un morceau chargé par `import()` et `admin-*.js` ne comptent pas, un import statique ajouté à l'entrée compte). Aucun workflow ne lance `budgets.mjs` ; `npm run measure:budget` est une autre mesure (le coût de l'API). Les tests qui lisent ce tableau (`apps/portail/test/budgets.test.ts`) suivent les limites de `perf.spec.ts`.
- **La page d'admin n'est plus dans le premier chargement** (`admin-*.js`, 10 882 o, jamais chargée par un joueur) : elle a sa ligne `track.admin` et son plafond (mesure + 15 %, arrondi à 500 o : **12 500 o**), pour qu'elle ne grossisse pas sans qu'on le voie.
- **Décision de Nathan du 22/10/2026 — plafonds du premier chargement** : ils baissent de la page d'admin retirée, arrondie à la centaine inférieure (**−10 800 o**) : JS + CSS 287 400 → **276 600 o**, JS 276 000 → **265 200 o**, hors three.js 143 300 → **132 500 o**. La marge de Track reste ≈ 21,8 ko (21 720 → 21 802 o) : le plafond est maintenant ce que charge un joueur, et tout relèvement futur reste une décision de Nathan.
- **Décision de Nathan du 22/10/2026 — les deux fils de travail** : fil des circuits (miniatures et circuit du jour) **26 600 → 30 000 o** (marge 76 → 3 476 o), fil du Salon (il embarque aussi le générateur) **30 000 → 32 000 o** (marge 1 498 → 3 498 o). **Justification** : ces deux fils ne retardent pas le premier écran (téléchargés en parallèle, calcul hors du fil principal), et sans relèvement la moindre retouche du générateur ou du pilote les aurait dépassés.
- **Avant / après (octets compressés)** : ancienne méthode de `scripts/budgets.mjs` (tout `dist/assets` moins quatre préfixes) JS + CSS 294 850 ; méthode du test du lot 36 (graphe + admin) 265 680 ; **méthode unique 254 798** (JS 243 386, CSS 11 412, hors three.js 110 620). Détail et plafonds avant / après : `docs/plateforme/lots/lot-suites-track.md`.
- Mesure : `npm run build && node scripts/budgets.mjs`, `main` à `1842813` et après.

## Lot 37 (Track) : décor propre

- **Track : +2 192 o** (254 798 → 256 990 o ; JS 243 386 → 245 578 o, hors three.js 110 620 → 112 812 o ; CSS, catalogue anglais et fils de travail inchangés ; la marge passe de 21 802 à 19 610 o, plafonds inchangés). **C'est plus que le ko toléré par l'énoncé du lot** : le dépassement est signalé à Nathan (README du lot, « Budget »). Mesure : `npm run build && node scripts/budgets.mjs`, `main` à `2363986` (construit à part) et après.
- **Ce que coûte chaque pièce** (mesuré en la retirant, octets compressés) : le front de rue de la Ville 385 o, les lampadaires 266 o, le garde-corps 145 o, les arches de vitesse (pieds jusqu'au sol) ≈ 200 o, le test de non-contact avec la route (`planLibre`) ≈ 155 o, le relevé de pose (`placed`, `Builder.mark` / `rollback`) 179 o ; le reste est réparti (pieds jusqu'au sol, tribune qui essaie l'autre côté, bornes sur le chapeau, hauteurs du sol d'une ville relevée). Ce que le lot retire : les bornes hors portion rapide, le mobilier de rue posé au sol, les fenêtres en boîtes.

## Lot 39 (Track) : socle de la scène par paliers

- **Track : +644 o** (256 990 → 257 634 o, `main` après le lot 37 mesuré à côté ; JS 245 578 → 246 222 o, hors three.js 112 812 → 113 456 o ; CSS, catalogue anglais, fils de travail et polices inchangés ; la marge passe de 19 610 à 18 966 o, plafonds inchangés). C'est **sous les ≈ +2 ko du plan du 38b** : le lot ajoute le registre des pas (`chargerPas`), le reconstructeur hors course (`creerReconstructeur`), la mise en commun de `adopterScene` et un crochet `?debug` ; l'assemblage de la scène n'a fait que changer de fichier (`trackMesh.ts` → `scene/socle.ts`). **Le code des paliers 1 à 3 reste hors du premier chargement** (aucun import statique : `test/socle.test.ts`). Mesure : `npm run build && node scripts/budgets.mjs`, `main` à `0d84dec` (construit à part) et après.

## Lot 43 (Track) : le palier 1 de la scène en jeu

- **Décision de Nathan du 23/10/2026** : +7 à 9 ko au premier chargement pour le palier 1 ; **plafonds relevés de 15 000 o** dans ce lot (JS + CSS 276 600 → **291 600 o**, JS 265 200 → **280 200 o**, hors three.js 132 500 → **147 500 o**) ; une ligne « décor 3D à la demande » de 16 ko viendra avec le lot suivant (le décor du palier 1), hors du premier chargement.
- **Track : +9 466 o** (259 323 → 268 789 o, `main` à `f15d31d` construit à part ; JS 247 911 → 257 377 o, hors three.js 115 137 → 124 512 o ; CSS inchangé ; catalogue anglais +18 o, les deux textes des portiques ; page d'admin +22 o, la case « Scène existante » ; fils de travail et polices inchangés ; marge 17 277 → **22 811 o**). Un peu au-dessus de la cible de 7 à 9 ko, sous le plafond. Le palier 1 (`scene/composerP1.ts`, `palier1.ts`, `piste.ts`, `sponsors.ts`, `feux.ts`) entre dans le premier chargement ; **l'ancienne scène en sort** (`scene/existant.ts`, chargée à la demande sous `?palier=existant` et dans la vitrine : ≈ 6 ko compressés). Ce qui a été retiré pour tenir (premier jet : +11,3 ko) : les variantes de route mortes, l'enregistrement de l'existant déplacé dans `main.ts` (sans lui, un morceau d'aide au préchargement entrait au premier chargement), les données des directions séparées des thèmes, les rebords complets du lot 38b injectés par la vitrine seulement. Détail : `docs/lots/lot-43-palier1-elements.md`.

## Lot 44 (Track) : le décor du palier 1, à la demande

- **Premier chargement : −1 655 o** (JS + CSS 276 301 → **274 646 o**, `main` à `42154b6` — lot 43 et retouche 40b — construit à part ; JS 264 889 → 263 234 o, hors three.js 131 346 → 129 691 o ; CSS, catalogue anglais, page d'admin, fils de travail et polices inchangés ; marge 15 299 → **16 954 o**, plafonds inchangés). Le décor d'avant (tribune, décor du thème, front de rue, passe dense : `addScenery`… de `trackMesh.ts`) quitte le premier chargement pour `scene/existant.ts` (à la demande, `?palier=existant` et la vitrine) ; il entre le registre du décor (`scene/decor.ts`, quelques lignes : huit `import()`) et la pose du décor dans la scène (`poserDecor`, `composerP1.ts`) et dans le jeu (`main.ts`).
- **Ligne « décor 3D à la demande »** (décision de Nathan du 23/10/2026 : **16 000 o** pour les huit thèmes) : **12 305 o** (marge 3 695 o), le morceau commun compté une fois. Mesure : `node apps/web/e2e/mesureDecor.mjs` après `npm run build` (le morceau du thème et, de proche en proche, ce qu'il importe hors du premier chargement), imposée par `apps/web/e2e/perf.spec.ts` (avec « rien du décor dans le premier chargement »). **Elle n'est pas encore une ligne du tableau ci-dessus** : `apps/portail/test/budgets.test.ts` (zone partagée, lot de plateforme) n'y attend que les clés qu'il connaît ; y ajouter `track.decor` est une ligne de plus dans `ATTENDUS` (proposition du lot 44 pour un lot de plateforme).

| Morceau (gzip) | Seul | Avec le morceau commun (ce que charge un joueur) |
|---|---|---|
| commun (`decor/commun.ts`, `decor/matiereC.ts` : sol relevé, pose, tribune, pièces, matière de C) | 5 700 | — |
| Stade (`decor/stade.ts`) | 600 | 6 300 |
| Rallye (`decor/rallye.ts`) | 588 | 6 288 |
| Banquise (`decor/banquise.ts`) | 502 | 6 202 |
| Nuit (`decor/nuit.ts`, la palette `neon` aussi) | 612 | 6 312 |
| Campagne (`decor/campagne.ts`) | 847 | 6 547 |
| Canyon (`decor/canyon.ts`) | 625 | 6 325 |
| Col alpin (`decor/col.ts`) | 668 | 6 368 |
| Ville (`decor/ville.ts` : front de rue et lampadaires compris) | 2 163 | 7 863 |
| **les huit thèmes** | | **12 305** (plafond 16 000) |

## Les marges les plus serrées (à surveiller)

1. **Track, catalogue anglais : 415 o** (il porte l'anglais commun ; retouche 40b : +270 o, les voitures). La contrainte la plus serrée depuis le relèvement des deux fils de travail (suites de Track).
2. **Jump, JS + CSS : 1 487 o** (voir plus haut).
3. **Track, page d'admin : 1 416 o** (plafond mesure + 15 %), puis **JS + CSS : 16 954 o** (lot 44 : −1 655 o, le décor d'avant sorti du premier chargement ; retouche 40b : +7 512 o, la voiture civile, les modèles à la demande, le catalogue et le choix — accepté par Nathan le 23/10/2026, détail dans `docs/lots/lot-40b-voitures-en-jeu.md` ; lot 43 : +9 466 o, plafonds relevés de 15 000 o ; lot 40 : +1 689 o, la voiture en six maillages — détail dans `docs/lots/lot-40-vehicule.md` ; lot 39 : +644 o ; lot 37 : +2 192 o ; lot 36 : −21 221 o ; 125 o au lot 35). Règle : le générateur ne revient pas dans le premier chargement, tout nouveau module lourd se charge à la demande sauf s'il sert au premier écran (`apps/web/CLAUDE.md`).
4. **Track, fils de travail : 3 476 o (circuits) et 3 498 o (Salon)** après leur relèvement (avant : 76 et 1 498 o). Ils embarquent le générateur et le pilote : tout ajout à la génération les entame.
