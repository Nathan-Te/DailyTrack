# Lot I7 — Le plein écran revient dans les deux jeux, la caméra dans Track (plateforme, phase 3)

Retour de Nathan, sur téléphone : le HUD compact (charte § 9) a envoyé les actions rares dans la pause, dont **le plein écran** ; or il est **important sur mobile** (la barre du navigateur mange la hauteur en paysage) et il ne doit pas être caché dans la pause. Même remarque pour **le changement de caméra de Track**. Ce lot remet les deux **en vue**. Lot de plateforme : il touche les deux jeux et le socle (`@cdj/ui`). Rendu, simulation, règles et zones tactiles ne changent pas ; golden inchangés ; charte et seeds non modifiés.

## 0. En bref

| Livrable | Où | Tests |
|---|---|---|
| Une seule logique de plein écran (possible ? état, bascule, verrou du paysage, mode application, iPhone) | `packages/ui/src/pleinEcran.ts` — **remplace** `toggleFullscreen` / `canFullscreen` de Track (`touchUi.ts`) et `fullscreenAvailable` / `toggleFullscreen` de Jump (`pauseMenu.ts`) | `packages/ui/test/pleinEcran.test.ts` (12 tests) |
| Le bouton (44 px, `aria-pressed`, nom lu, icônes « quatre coins » / « coins rentrants »), la ligne de l'iPhone, l'option `pleinEcran` de `barreJeu` | `packages/ui/src/composants.ts`, `icones.ts`, `composants.css`, catalogue commun (`pleinEcran.*`), vitrine `/ui/` (section « Plein écran et astuce de l'iPhone ») | e2e `portail.spec.ts` (vitrine), `plein-ecran.spec.ts` des deux jeux |
| Track : plein écran et caméra en course, plein écran sur l'accueil, ligne iPhone | `apps/web/src/main.ts` (`#btn-camera`, `#btn-fullscreen`, `syncCameraButton`), `homeUi.ts`, `cadre.ts`, `hud.css` | `apps/web/e2e/plein-ecran.spec.ts`, `hud-compact`, `mobile`, `conduite` (mis à jour) |
| Jump : plein écran en partie, sur l'accueil, ligne iPhone | `apps/jump/src/main.ts` (`#fullscreenbtn`), `home.ts`, `cadre.ts`, `hud.css`, `pauseMenu.ts` | `apps/jump/e2e/plein-ecran.spec.ts`, `hud-compact` (`layout.ts`) |
| Mentions légales FR et EN : le fait d'avoir fermé l'astuce est un réglage gardé | `apps/portail/mentions-legales/index.html`, `legal/index.html` | `apps/portail/test/mentions.test.ts` |
| Budget de Track relevé de 1 024 o | `docs/plateforme/budgets.md`, `apps/web/e2e/perf.spec.ts` | `apps/portail/test/budgets.test.ts`, `perf.spec.ts` |

## 1. Où sont les boutons

### Plein écran
| Écran | Où | Identifiant |
|---|---|---|
| **Track, en course** | rangée du haut à gauche, **à droite de la pause** : pause · dernier point de contrôle · recommencer · caméra · plein écran (les deux premiers après la pause sur appareil tactile seulement). Plaque du HUD (bordure 2 px, ombre nette 2 px), 44 px. La bande du haut ne bouge pas, le centre reste libre | `#btn-fullscreen` |
| **Jump, en partie** | en haut à gauche, **juste après la pause** (même plaque) | `#fullscreenbtn` |
| **Accueil de chaque jeu** | dans la barre des jeux (`barreJeu({ pleinEcran: true })`), **côté droit, à côté de la date** : on se met en plein écran avant de jouer. Les autres écrans (réglages, classement, archives, arrivée…) gardent la barre sans lui | `#home .dj-plein-ecran` |
| **Pause des deux jeux** | le même bouton, en texte (« Plein écran » / « Quitter le plein écran ») | `#pause-fullscreen` (Track), `#menu-fullscreen` (Jump) |

Nom lu : « Plein écran » / « Quitter le plein écran » (`pleinEcran.entrer` / `.quitter` du catalogue commun, fr + en), `aria-pressed`, état suivi par `fullscreenchange` (un bouton déclenché ailleurs — la pause, la touche F11 — se met à jour).

### Caméra (Track seulement)
`#btn-camera`, 44 px, icône « appareil photo » du socle (`icone("camera")`). Il appelle **`cycleCamera`**, la fonction de la touche C et de l'entrée de la pause : même ordre (proche → loin → capot), même mémorisation (`cdj:camera`). Nom lu « Caméra : proche » / “Camera: close”, mis à jour à chaque changement par `syncCameraButton` (une comparaison de clé par image, le DOM n'est écrit que si elle change : touche, pause, réglages, démonstration, langue).

**Place** : dans la rangée du haut à gauche, devant le plein écran, tant que la rangée laisse la place à la bande du centre ; sinon **en tête du groupe de droite**, devant l'objectif. La décision est une **formule** (largeur de l'écran, nombre de boutons de la rangée, 300 px réservés à la bande : `BANDE_MAX_PX`), pas une mesure : le bouton ne saute donc pas pendant la course. Résultat vérifié : **844 × 390** → dans la rangée (la rangée finit à 254 px) ; **740 × 360** → groupe de droite (la rangée à cinq boutons finirait à 254 px ; la formule ne la garde que si elle finit avant 214 px, soit la moitié de l'écran moins la moitié de la bande réservée et une marge) ; **portrait 390 × 844 et 360 × 640** → groupe de droite. Caché en rediffusion (la barre de lecture a sa caméra). Il reste aussi dans la pause (`#pause-camera`).

**Jump** : pas de bouton caméra. Jump n'a **pas de choix de caméra** (une seule caméra orthographique qui suit le personnage ; ses réglages `?debug&tune` sont un outil) : rien n'a été ajouté.

## 2. Comportement par appareil

| Appareil | Plein écran | Verrou paysage | Ligne iPhone |
|---|---|---|---|
| **Android (Chrome)** | bouton visible partout (course / partie, accueil, pause) ; entre sans barre de navigation | **essayé en entrant** (`screen.orientation.lock("landscape")`) ; un refus est ignoré sans message | — |
| **iPhone (Safari)** | **aucun bouton** (`document.fullscreenEnabled` est faux) | — | **sur l'accueil, une fois** : « Pour jouer en plein écran : Partager › Sur l'écran d'accueil » (`pleinEcran.iphone`), sous le titre ; la croix (44 px) la ferme et elle **ne revient pas** (`cdj:astuce:plein-ecran`, gardé dans le stockage du jeu) |
| **Ordinateur** | bouton visible (course / partie, accueil, pause) ; le clavier garde ses touches | tenté en entrant, ignoré (refusé hors téléphone) | — |
| **Site ouvert comme application** (icône de l'écran d'accueil, `display-mode: standalone`) | **aucun bouton** ni astuce (le site n'a déjà plus de barre) | — | — |
| **Petit portrait** (≤ 500 px de large) | pas de bouton dans la course / la partie (la bande du centre prend la place, on joue en paysage) ; il reste sur l'accueil et dans la pause | — | — |

L'astuce n'a lieu d'être que sur un **iPhone ou iPod** (agent) **sans plein écran**, hors mode application : un ordinateur ou un Android sans plein écran n'a rien à apprendre de « l'écran d'accueil ».

## 3. Budgets avant / après

Mesures : `npm run build && node scripts/budgets.mjs` (octets compressés), avant = `main` à `e5658f9`, après = ce lot. Détail et pistes : `docs/plateforme/budgets.md`, section « Lot I7 ».

| Clé | Budget avant | Budget après | Avant | Après | Marge après |
|---|---|---|---|---|---|
| `track.jsCss` | 284 100 | **285 124 (+1 024, autorisé par Nathan)** | 283 844 | 285 067 | 57 |
| `track.js` | 274 000 | 274 000 | 272 589 | 273 655 | 345 |
| `track.horsThree` | 141 000 | 141 000 | 139 823 | 140 889 | 111 |
| `track.anglais` | 8 000 | 8 000 | 7 224 | 7 297 | 703 |
| `jump.jsCss` | 378 490 | 378 490 | 376 242 | 377 325 | 1 165 |
| `portail.premier` | 30 720 | 30 720 | 22 812 | 23 694 | 7 026 |

- **Le relèvement a été nécessaire** : le remplacement des deux logiques des pauses ne compensait pas ce que le lot ajoute (l'astuce de l'iPhone, deux boutons du HUD, les textes). La première version ajoutait 1 529 o à Track (285 373 o, au-delà du relèvement permis) ; elle a été **resserrée** avant de relever : le module sans navigateur injecté (−145 o), pas de préfixe WebKit (−65 o), pas de `navigator.standalone` (le `display-mode: standalone` suffit), les noms de caméra qui **réutilisent les clés existantes** (« Caméra : proche » partout : le bandeau et la pause aussi, `conduite.spec.ts` mis à jour), les libellés passés par la traduction du jeu. Reste 57 o de marge : **le prochain lot Track qui ajoute du code devra en retirer ailleurs ou demander à Nathan** (piste : charger l'astuce de l'iPhone à la demande, ≈ 370 o ; son fichier sortirait du décompte du premier chargement comme le catalogue anglais — décision à prendre avec Nathan).
- **Ce qui coûte, dit comme demandé** (mesuré en retirant chaque pièce de la première version) : l'astuce de l'iPhone ≈ 370 o ; les deux boutons du HUD de Track, leur place et leur nom lu ≈ 240 o ; le plein écran de la barre de l'accueil ≈ 45 o ; le reste est le module de plein écran, le composant du bouton, les textes du catalogue commun et la feuille.
- **Jump** reste dans sa marge (1 165 o). **Portail** : +882 o (la barre des jeux du socle importe le bouton).

## 4. Captures (paysage, français et anglais)

`CAPTURES=1 npx playwright test captures-lot-i7 --project=chromium` (dans `apps/web` et dans `apps/jump`), dossier `docs/plateforme/lots/img/` :

| Vue | Français | Anglais |
|---|---|---|
| Track, course 844 × 390 (caméra et plein écran dans la rangée) | `lot-I7-track-course-paysage-fr.png` | `lot-I7-track-course-paysage-en.png` |
| Track, course 740 × 360 (la caméra passe devant l'objectif) | `lot-I7-track-course-compact-fr.png` | `lot-I7-track-course-compact-en.png` |
| Track, accueil (plein écran dans la barre) | `lot-I7-track-accueil-fr.png` | `lot-I7-track-accueil-en.png` |
| Track, accueil sur iPhone (la ligne) | `lot-I7-track-accueil-iphone-fr.png` | `lot-I7-track-accueil-iphone-en.png` |
| Jump, partie (plein écran après la pause) | `lot-I7-jump-partie-fr.png` | `lot-I7-jump-partie-en.png` |
| Jump, accueil (plein écran dans la barre) | `lot-I7-jump-accueil-fr.png` | `lot-I7-jump-accueil-en.png` |
| Jump, accueil sur iPhone (la ligne) | `lot-I7-jump-accueil-iphone-fr.png` | `lot-I7-jump-accueil-iphone-en.png` |

## 5. Ligne proposée pour la charte (`docs/plateforme/identite.md`, non modifiée par le lot)

À ajouter au § 9, à la suite de « Surimpressions en partie (Track et Jump) : compactes. » :

> **Exception aux « actions rares dans la pause » : le plein écran** (Track et Jump : en partie, à droite de la pause, et sur l'accueil, dans la barre des jeux ; caché quand le navigateur ne le permet pas ou que le site est une application ; sur iPhone, une ligne d'aide à la place) **et, dans Track, la caméra** (rangée du haut à gauche, ou groupe de droite quand la place manque) restent toujours en vue : ce sont des actions de confort fréquentes sur téléphone (la barre du navigateur mange la hauteur en paysage). Boutons de 44 px, plaques du HUD, centre libre.

## 6. Vérifié / non vérifié

**Vérifié (localement, Chromium)**
- Unitaires : tout `npx vitest run --project sqlite` (2 354 tests), dont `pleinEcran.test.ts` (possible / pas possible, état, entrée, sortie, verrou refusé ou absent sans erreur, entrée refusée sans verrou, mode application, iPhone), catalogues (parité, clés lues, chaînes en dur), traductions régénérées, budgets, mentions.
- e2e Track (`plein-ecran.spec.ts`, 13 tests) : paysage 844 × 390 et 740 × 360 (boutons visibles, 44 px, sur une ligne, dans l'ordre, hors de la zone centrale, sans chevauchement — mêmes aides que `hud-compact` et `scene`), portraits 390 × 844 et 360 × 640, bascule `aria-pressed` + nom lu + **vrai plein écran** + verrou paysage demandé ; la pause suit ; caméra = touche C (mêmes caméras, même mémorisation, nom lu mis à jour, FR et EN) ; caché sans API et en mode application ; accueil 844 × 390 et 740 × 360 ; ligne iPhone une fois (FR et EN, mémorisée, absente au rechargement) ; axe sans violation grave (accueil et course).
- e2e Jump (`plein-ecran.spec.ts`, 9 tests) : mêmes vérifications, juste après la pause, sans caméra.
- Existants mis à jour : `hud-compact` et `mobile` de Track (les boutons du haut ne sont plus « trois » : la caméra et le plein écran les suivent), `conduite` (le bandeau dit « Caméra : loin »), `layout.ts` de Jump (`#fullscreenbtn` dans `SURIMPRESSIONS`).
- Le plein écran réel a été essayé **par Chromium sans écran** (il entre, sort, notifie) ; le verrou d'orientation est **observé par un espion** (le vrai verrou n'existe pas sur un ordinateur).

**Non vérifié**
- **Sur un vrai téléphone** (Android et iPhone) : la barre qui disparaît, le passage en paysage, la ligne de l'iPhone, l'icône d'écran d'accueil (`display-mode: standalone` est simulé). C'est le scénario de Nathan ci-dessous.
- Firefox et WebKit : le plein écran n'est pas dans le sous-ensemble multi-navigateurs ; ces specs sautent hors Chromium (WebGL).
- iPad avant iPadOS 16.4 : **plus de bouton** (préfixe WebKit retiré pour le budget).

## 7. Décisions laissées à Nathan

1. **Budget** : relèvement de 1 024 o utilisé en entier ; marge de Track : 57 o. Faut-il prévoir l'astuce de l'iPhone à la demande (sortie du décompte du premier chargement) ?
2. **« Caméra : proche »** dans le bandeau et la pause (au lieu de « Caméra proche ») : conséquence d'avoir réutilisé les clés pour économiser des octets. À défaire (≈ 130 o) si le bandeau doit rester « Caméra proche ».
3. **Petit portrait** : pas de plein écran dans la course (il reste sur l'accueil et dans la pause), et la caméra passe à droite.
4. **La ligne à ajouter à la charte** (§ 5).
5. **Mentions légales** : une phrase ajoutée aux deux pages (« le fait d'avoir fermé l'astuce du plein écran sur iPhone ») : le stockage `cdj:astuce:plein-ecran` est un réglage gardé.

## 8. Scénario pour Nathan (2 clics)

1. Sur le téléphone (Android), ouvrir **l'aperçu de la PR** → Track : sur l'accueil, toucher le **bouton plein écran** de la barre du haut (à côté de la date) : la barre du navigateur disparaît, l'écran passe en paysage ; lancer la course : le plein écran est à droite de la pause, avec le **bouton caméra** ; le toucher fait passer d'une caméra à l'autre.
2. Même chose dans **Jump** (pas de bouton caméra). **Sur iPhone** : la ligne « Partager › Sur l'écran d'accueil » à la place ; la fermer, recharger : elle ne revient pas.

## 9. Runs de CI et verdicts

*(à compléter une fois la CI de la PR terminée)*
