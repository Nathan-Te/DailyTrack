# Budgets de poids — la référence (lot I6, règle refaite au lot B1)

**Ce fichier est la référence des budgets de la plateforme** (`CLAUDE.md` racine). **La règle (lot B1, décision de Nathan : le budget est un garde-fou contre la dérive, pas un objectif d'optimisation) :**
1. **Un plafond s'écrit en Ko** (1 Ko = 1 000 o), **arrondi au Ko supérieur**, posé **une fois** : mesure + une marge proportionnelle. **Premier chargement** (portail, accueil, premier chargement de chaque jeu) : mesure + **5 %**, et **au moins 2 Ko** ; **chargé à la demande** (jeu de Tower, physique, Salon, Garage, sons, catalogues…) : mesure + **10 %**, et au moins **1 Ko** ; **polices et images** : mesure + **10 %**. La colonne « Famille » dit laquelle s'applique (`premier`, `demande`, `police`) ; `plafondKo` de `scripts/budgets-controle.mjs` est la règle.
2. **Le job « Budgets »** (`scripts/budgets-controle.mjs`, lot R17) mesure chaque ligne (`mesuresParLigne` de `scripts/budgets.mjs`) et **échoue seulement si une ligne dépasse son plafond**. Son résumé est un tableau en Ko (ligne · plafond · mesure · marge · écart avec `main`) ; il **avertit sans bloquer** (⚠️, avec le chiffre) quand une PR fait grossir une ligne de **plus de 3 Ko ou de plus de 1 %** par rapport à `main` (un plancher de 200 o écarte le bruit de construction).
3. **Relever un plafond est une décision de Nathan**, avec sa raison écrite dans la section « Relèvements » ci-dessous (un test refuse un plafond au-dessus de sa règle sans cette ligne) ; **le job ne relève jamais rien**, et un lot n'a plus à remesurer ses lignes : la colonne « Mesure à la pose » ne bouge qu'avec un relèvement ou un recalage.
4. **Contre la dérive lente** : `npm run budgets -- --recaler` **propose** de nouveaux plafonds (mesure + marge) pour les lignes dont la mesure a baissé de plus que leur marge. Il ne fait que proposer : un lot l'applique quand Nathan le veut, aucun recalage n'est automatique.
5. Octets **compressés** (gzip) pour le JS, le CSS et le HTML ; octets des fichiers pour les polices (woff2, **découpées aux caractères utilisés** : `packages/ui/CLAUDE.md`, `scripts/polices/decouper.mjs`), les images et la musique. Premier chargement d'un joueur **en français** : l'anglais est chargé à la demande. Les specs e2e (`perf.spec.ts`, `poids.spec.ts`) ne gardent que la *composition* ; `apps/portail/test/budgets.test.ts` vérifie le tableau (mesures, famille, plafond = règle ou relèvement écrit). **Avant le lot B1** (plafonds en octets, historique ligne à ligne de chaque lot) : `docs/plateforme/budgets-historique.md`.

## Le tableau

Posé le 04/11/2026 (lot B1) sur la construction des e2e, polices découpées comprises.

| Clé | Application | Ce qui est mesuré | Famille | Plafond | Mesure à la pose (o) | Marge à la pose (o) |
|---|---|---|---|---:|---:|---:|
| `portail.premier` | Portail | premier chargement de l'accueil (HTML, JS, CSS) ; lot U1 : la salle de jeux (barre, cloche, fronton, deux colonnes, arcade, colonne de droite) — **plafond proposé, à valider par Nathan** | premier | 47 Ko | 44 527 | 2 473 |
| `portail.polices` | Portail | polices de l'accueil | police | 120 Ko | 108 340 | 11 660 |
| `portail.classement` | Portail | premier chargement de la page `/classement/` (HTML, JS, CSS) ; lot U2 : la salle de jeux (barre, fronton, onglets de vue, podium, liste à photos, panneau des groupes) — **ligne nouvelle, plafond posé, à valider par Nathan** | premier | 57 Ko | 53 663 | 3 337 |
| `track.jsCss` | Track | JS + CSS du premier chargement | premier | 312 Ko | 296 957 | 15 043 |
| `track.js` | Track | JS du premier chargement | premier | 300 Ko | 284 811 | 15 189 |
| `track.horsThree` | Track | le code du jeu, hors three.js | premier | 159 Ko | 151 154 | 7 846 |
| `track.anglais` | Track | catalogue anglais | demande | 9 Ko | 7 902 | 1 098 |
| `track.miniatures` | Track | fil de travail des circuits : miniatures et circuit du jour | demande | 37 Ko | 29 472 | 3 528 |
| `track.salon` | Track | fil de travail du Salon | demande | 39 Ko | 31 618 | 3 382 |
| `track.admin` | Track | page d'admin `admin-*.js` (jamais chargée par un joueur) | demande | 14 Ko | 12 278 | 1 722 |
| `track.decor` | Track | décor 3D à la demande, les huit thèmes (le morceau commun compté une fois) | demande | 15 Ko | 13 043 | 1 957 |
| `track.palier2` | Track | palier 2 à la demande | demande | 8 Ko | 6 540 | 1 460 |
| `track.vieCiel` | Track | vie et ciel à la demande | demande | 9 Ko | 7 996 | 1 004 |
| `track.post` | Track | post-traitement à la demande | demande | 7 Ko | 5 249 | 1 751 |
| `track.qualiteMesure` | Track | mesure de la règle de qualité | demande | 3 Ko | 1 092 | 1 908 |
| `track.garage` | Track | Garage à la demande | demande | 11 Ko | 9 888 | 1 112 |
| `track.ombres` | Track | les ombres fines | demande | 2 Ko | 149 | 1 851 |
| `track.fantomes` | Track | le choix des fantômes | demande | 6 Ko | 4 203 | 1 797 |
| `track.son` | Track | le nouveau son | demande | 10 Ko | 8 403 | 1 597 |
| `track.sonBoucles` | Track | les huit boucles de moteur AAC (`<voiture>-*.m4a`) de la voiture la plus lourde, en octets de fichier | demande | 76 Ko | 68 328 | 7 672 |
| `track.steerSlider` | Track | la glissière tactile | demande | 3 Ko | 1 200 | 1 800 |
| `track.steerWheel` | Track | le volant tactile | demande | 3 Ko | 1 801 | 1 199 |
| `track.steerGyro` | Track | le gyroscope tactile | demande | 6 Ko | 4 558 | 1 442 |
| `track.touchReglages` | Track | les réglages tactiles | demande | 2 Ko | 848 | 1 152 |
| `track.polices` | Track | polices | police | 129 Ko | 116 796 | 12 204 |
| `jump.jsCss` | Jump | JS + CSS du premier chargement | premier | 402 Ko | 382 856 | 19 144 |
| `jump.anglais` | Jump | catalogue anglais | demande | 8 Ko | 6 299 | 1 701 |
| `jump.polices` | Jump | polices | police | 86 Ko | 77 812 | 8 188 |
| `tower.jsCss` | Tower | JS + CSS du premier chargement de la page du jeu = **l'accueil seul** (ni Three.js, ni la partie, ni Rapier) | premier | 42 Ko | 39 625 | 2 375 |
| `tower.jeu` | Tower | le jeu à la demande, derrière l'accueil : JavaScript (Three.js compris) et sa feuille, sans la physique ni l'anglais | demande | 193 Ko | 174 711 | 18 289 |
| `cibles.jsCss` | Cibles | JS + CSS du premier chargement de la page du jeu témoin (lot K4f ; **reposé au lot V0** : 44 978 o mesurés, un jeu de plus au catalogue commun ayant mangé la marge de 42 o) = l'accueil seul (le kit, le socle, l'identité, la file d'envoi, le catalogue français ; la partie, le classement, les Réglages, les retours et la version à la demande) ; jeu témoin, jamais en production | premier | 48 Ko | 44 978 | 3 022 |
| `vertige.jsCss` | Vertige | JS + CSS du premier chargement de la page du jeu = l'accueil seul (le kit, le socle, l'identité, la file d'envoi, le catalogue français ; la partie, le classement, les Réglages, les retours et la version à la demande) ; lot V1 : la scène 3D (`corps-`, Three.js, 611 Ko brut, 154 Ko gzip ; la gravité, les portails et leurs fenêtres y sont, les mains et le second style retirés), la partie (`course-`), le panneau d'essai (`tune-`) et les parties d'essai sont à la demande ; plafond provisoire (mesure + 5 %, **à valider par Nathan**) | premier | 53 Ko | 49 926 | 3 074 |
| `rush.jsCss` | Rush | JS + CSS du premier chargement de la page du jeu = l'accueil seul (le kit, le socle, l'identité, la file d'envoi, le catalogue français ; la partie, le classement, les Réglages, les retours et la version à la demande) ; lot BR0 : la scène 3D (`corps-`, Three.js, 587 Ko brut, 152 Ko gzip), la simulation (`rediffusion-`) et les sons sont à la demande ; plafond provisoire (mesure + 5 %, à confirmer par Nathan) | premier | 46 Ko | 41 411 | 2 589 |
| `blocks.jsCss` | Blocks | JS + CSS du premier chargement de la page du jeu = l'accueil seul (le kit, le socle, l'identité, la file d'envoi, le catalogue français ; la partie, le classement, les Réglages, les retours et la version à la demande) ; généré par `npm run nouveau-jeu`, plafond de la ligne du modèle (à fixer par Nathan avec la mesure du jeu) | premier | 47 Ko | 44 574 | 2 426 |
| `musique.lecteur` | Musique | le lecteur et le panneau des réglages de la musique commune (les morceaux ne sont pas comptés) | demande | 7 Ko | 5 937 | 1 063 |
| `retours.dialogue` | Retours | le dialogue « Un bug ? Une idée ? » (`retoursJeu-*` et sa feuille) | demande | 8 Ko | 6 555 | 1 445 |
| `tower.physique` | Tower | la physique à la demande : JavaScript de Rapier et `rapier.wasm` | demande | 1 055 Ko | 958 766 | 96 234 |
| `tower.decors` | Tower | le plus gros des six décors de Tower (le port) avec ce qui les assemble (`decorScene-*`, `decorLogique-*`) | demande | 6 Ko | 4 123 | 1 877 |
| `tower.habits` | Tower | l'habillage des effets et les effets du taquet de Tower (`habits-*`, `taquetFx-*`, `polygones-*`) | demande | 7 Ko | 5 303 | 1 697 |
| `tower.anglais` | Tower | catalogue anglais | demande | 7 Ko | 5 245 | 1 755 |
| `tower.polices` | Tower | polices (Rubik Mono One, Archivo 400 · 600 · 700, JetBrains Mono 700) | police | 70 Ko | 63 012 | 6 988 |
| `partage.image` | Site | chaque image de partage (1200 × 630, PNG) | police | 48 Ko | 42 752 | 5 248 |

**L'image de partage (`partage.image`, lot B1b) : un seul plafond, un seul navigateur.** Le plafond de la ligne (48 Ko) **est lu ici** par `scripts/images-partage.mjs` (`POIDS_MAX`, jamais recopié ; `apps/portail/test/budgets.test.ts` vérifie l'égalité) et la construction du site échoue au-dessus. **Les images sont dessinées par Chromium et lui seul**, quel que soit le job qui assemble le site (pas de repli sur un autre navigateur) : la même page pèse 42 752 o dessinée par Chromium (PNG RGB) et 75 742 o par Firefox (PNG RGBA, compression plus faible) ; les jobs Firefox et WebKit de la CI installent donc Chromium en plus du leur. Le texte de l'image (« DU JOUR », « TRACK », « JUMP ») est couvert par la découpe des polices (`packages/ui/test/polices.test.ts`). Aucun plafond n'est relevé.

**Lot U1 (06/11/2026) — `portail.premier` : 38 Ko → 47 Ko, à valider par Nathan.** L'accueil est devenu une salle de jeux : la mesure passe de 35 193 à 44 527 o (+9 334 o : le code de la barre, de la cloche, du fronton, des quatre panneaux de la colonne de droite ≈ +3,5 Ko ; la feuille de la salle ≈ +3 Ko ; le module de la manette qui sert la navigation ≈ +1 Ko ; la feuille des photos des amis et le sous-ensemble de Bungee ≈ +0,6 Ko). Le plafond proposé suit la règle de la famille « premier » (mesure + 5 %, arrondi au Ko supérieur : 46 753 o → 47 Ko) ; **les illustrations des jeux sont des fichiers à part** (lot K5) et n'y entrent pas. Aucun autre plafond ne bouge (jeux : la mesure de chaque ligne est inchangée).

**Lot U2 (06/11/2026) — nouvelle ligne `portail.classement`, à valider par Nathan.** La page `/classement/` a son propre budget : la mesure est celle de son premier chargement (HTML, scripts et imports statiques, feuilles ; `mesurePortail`, `scripts/budgets.mjs`, la construction de production), 53 663 o, plafond **57 Ko** (règle de la famille « premier » : mesure + 5 %, arrondi au Ko supérieur). Elle pèse plus que l'accueil parce qu'elle porte les feuilles de la salle **et** celles du classement (portail.css, salle.css, classementSalle.css) ; le code des amis, des groupes et de la feuille d'un joueur reste à la demande. **L'accueil grossit de ≈ 0,6 Ko** (45 163 o mesurés contre 44 598 sur `main` ; plafond de `portail.premier` inchangé, 47 Ko) : une ligne de teinte par jeu dans `jeux.generated.css` (la pastille des onglets, tirée de la fiche) et le paramètre de taille de l'emblème. Les photos de 48 à 128 px sont dans une feuille à part (`avatar-grand.css`) que l'accueil ne paie pas.

## Relèvements décidés par Nathan

Un plafond au-dessus de ce que donne la règle (mesure à la pose + marge de sa famille) est écrit ici, **avec sa raison**, par le lot qui applique la décision. Aucun à ce jour : le tableau ci-dessus est la pose du lot B1.

| Date | Clé | De | À | Raison |
|---|---|---:|---:|---|
| 2026-11-07 | `rush.jsCss` | 44 Ko | 46 Ko | Lot BR4 (relèvement prévu par le prompt du lot, « si c'est indispensable »). Mesure : 43 752 o avant le lot, 44 043 o après (la marge de BR3 : 248 o). Ce qui grossit est **le catalogue français, chargé en entier au premier chargement** : les textes de l'écran de fin (boss du jour, cartes choisies, le Diamant) et de la carte Brise-pierre qui dit sa valeur contre chacun des cinq boss (cinq noms de boss avec leur article), avec le tableau des médailles d'essai. Les chaînes d'essai ont été resserrées (17 clés → 13) et deux clés mortes retirées avant de relever. Le plafond précédent était provisoire (« mesure + 5 %, à confirmer par Nathan », lot BR0). |
| 2026-11-08 | `track.miniatures` | 33 Ko | 34 Ko | Lot 58 (Track), décision de Nathan (« relève le budget », 08/11/2026). Mesure : 30 187 o sur `main` (f82a321), 32 380 o après le lot (le générateur v22 : huit familles de blocs nouveaux, leurs règles d'équité et de pose ; la simulation des blocs à effet, de la route bombée, du virage à 45°, de la glace de piste et du mur roulable, que le pilote du fil de travail fait rouler). La boucle, qui faisait dépasser le plafond (33 240 o), a été mise de côté. Marge rendue : ≈ 1,6 Ko. |
| 2026-11-08 | `track.salon` | 35 Ko | 36 Ko | Lot 58 (Track), même décision et même raison (le Salon tire ses circuits du même générateur). Mesure : 32 350 o sur `main` (f82a321), 34 540 o après le lot ; 35 400 o avec la boucle, mise de côté. Marge rendue : ≈ 1,5 Ko. |
| 2026-11-09 | `track.miniatures` | 34 Ko | 37 Ko | Lot 57b (Track), décision de Nathan (« tu peux monter le budget sans soucis », 09/11/2026). Mesure : 32 380 o après le lot 58, 35 870 o après le lot (le générateur v23 : les 19 sauts et transitions de la grammaire du lot 57, leurs tours et vedettes par thème, les règles de variété des sauts et le budget de technicité). Marge rendue : ≈ 1,1 Ko. |
| 2026-11-09 | `track.salon` | 36 Ko | 39 Ko | Lot 57b (Track), même décision et même raison (le Salon tire ses circuits du même générateur). Mesure : 34 540 o après le lot 58, 38 130 o après le lot. Marge rendue : ≈ 0,9 Ko. |

## La musique (lot « musique »)

Procédure et règles : `docs/plateforme/musique.md`, `packages/musique/CLAUDE.md`.

- **Premier chargement de chaque jeu : le branchement seul** (`@cdj/musique/branche` : des écouteurs de geste, un `import()`) — **Track +363 o, Jump +348 o, Tower +238 o (accueil) et +196 o (jeu)** (avec les scènes : le jeu annonce « menu » ou « theme:<code> ») mesurés contre `main` (limite de l'énoncé : 0,5 ko ; le branchement seul pèse ≈ 0,3 ko compressé, testé par `packages/musique/test/poids.test.ts`). Le portail n'est pas branché (aucun octet).
- **À la demande : 5 937 o** (ligne `musique.lecteur` ; 4 691 o avant la couche du jeu du lot B6, qui en ajoute 1 246 : `couche.ts` et sa logique pure, plafond posé par la règle des lignes « à la demande », mesure + 10 % : 7 Ko au lieu de 6 Ko, marge de 1 063 o) : le lecteur (flux sur deux voix, fondu, reprise, compresseur, couche du jeu) et le panneau des réglages, **un seul morceau pour tous les jeux**. Rien n'est téléchargé avant le premier geste (liste, morceaux), rien ne l'est pour une liste vide.
- **Les morceaux, non comptés dans les jeux** : AAC (`.m4a`) à **96 kbit/s** en stéréo à 44,1 kHz, volume harmonisé à −18 LUFS : **≈ 12 Ko par seconde, ≈ 0,7 Mo pour une minute**, soit 2 à 3 Mo pour un morceau de trois minutes, téléchargé en entier puis décodé par Web Audio (lot S2 : au plus deux morceaux décodés en mémoire, `docs/plateforme/lots/lot-S2-son-melange.md`) et mis en cache sans fin par le navigateur (nom à empreinte, `firebase.json`). Le total du catalogue se lit avec `node scripts/budgets.mjs` (clé `musique.octetsMorceaux`). Les 29 boucles générées par le code (`musique/generateur/`, 26,6 Mo en tout ; Blocks : 7 boucles de 96 à 114 s, 9,2 Mo, 1,2 à 1,4 Mo chacune) sont les morceaux livrés : Nathan en ajoute ou les remplace par les siens. **Blocks : le branchement coûte 0 o de plus au premier chargement** (déjà branché, `blocks.jsCss` inchangé) ; la couche et le fondu de fin sont dans le lecteur et le corps du jeu, à la demande.
