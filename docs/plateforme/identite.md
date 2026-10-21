# Charte visuelle — Du Jour (direction « Cartouches »)

Charte de la phase 3 (`seed-phase-3.md` § 6), choisie par Nathan au lot I0 le 20 octobre 2026. Vit dans `docs/plateforme/identite.md`. Seul Nathan la modifie ; un lot qui a besoin d'un écart le propose dans son README, il ne l'applique pas.

Révision 2 (après le lot I1) : écarts 1 à 5 du README du lot I1 inscrits (afficheur opaque, jetons de texte des médailles, tailles 14 · 16 · 21 px, espaces insécables, états des boutons).
Révision 3 (après le lot I2) : écarts 1 à 3 du README du lot I2 inscrits (numéro et thème sous le nom du jeu, bouton de cartouche pleine largeur, profil posé sur les étiquettes) ; numéro de journée commun.
Révision 4 (après le lot I3) : émojis de la ligne de la journée (§ 6) ; ta ligne d'un classement en moutarde (§ 9).
Révision 5 (avant le lot I4) : surimpressions de course de Track (§ 9), maquettes `track-*.html` choisies par Nathan.
Révision 6 (après le lot I4) : accueil d'un jeu posé sur sa scène sous un voile à rayures (§ 9) ; nom des jeux dans leurs lignes à partager (§ 2).
Révision 7 (essai de Nathan sur téléphone) : surimpressions compactes pour les deux jeux, commandes aux bords et boutons par défaut, « Comment jouer » dans le jeu (§ 9).
Révision 8 (après le lot I5) : « quand on entre dans un jeu, on y reste » — tous les écrans d'un jeu sur sa scène, le cadre crème réservé aux écrans Du Jour (§ 9).
Révision 9 (après les lots I4b et I6) : la pause et « Comment jouer » sont des dialogues sans barre des jeux ; l'étiquette de Track n'a pas de coque (§ 9) ; vocabulaire anglais (§ 7).

Maquettes de référence (sources HTML, à lire, jamais à copier telles quelles ni à construire) : `docs/plateforme/maquettes/cartouches/portail.html`, `track.html`, `jump.html`. Toutes les valeurs de ce document priment sur les maquettes en cas d'écart.

Chaque règle porte sa raison. Une règle dont la raison ne s'applique plus se discute avec Nathan ; elle ne se contourne pas.

---

## 1. L'idée

**Du Jour est une ludothèque chaleureuse, comme le logiciel d'une vieille console ou un lanceur d'émulateur : chaque jeu du jour est une cartouche posée sur l'étagère.**

- Le **portail** est l'étagère : fond crème de plastique, encre brun foncé, cartouches alignées.
- Chaque **jeu** est une cartouche : même coque (forme, bordure, ombre), **étiquette propre au jeu**. L'étiquette porte la personnalité du jeu.
- Dans un jeu, l'écran hors partie (accueil, arrivée, classement, profil) est **l'étiquette de la cartouche agrandie**, posée dans le cadre crème de Du Jour, avec en haut le retour « ‹ DU JOUR ».

Raison : une seule image (la cartouche) relie la marque et les jeux, se comprend sans explication, et laisse chaque jeu libre sur son étiquette. Un jeu n° 3 ajoute une étiquette, pas une nouvelle interface.

## 2. La marque

- **Logo** : le mot `DU JOUR` en Archivo Black, crème `--dj-creme` sur un rectangle `--dj-encre`, coins de 3 px, ombre nette décalée de 3 px vers le bas et la droite en `--dj-terre`. Marges internes : 7 px en haut, 11 px sur les côtés, 6 px en bas. Taille d'usage : 21 px dans la barre du portail, 14 px dans la barre de retour des jeux (sans rectangle : texte encre seul, précédé du chevron).
  Raison : l'étiquette tamponnée évoque un nom imprimé sur une boîte de jeu ; l'ombre terre cuite est la signature de couleur de la marque.
- **Nom des jeux** : `TRACK` et `JUMP`, en capitales, chacun dans sa typographie (§ 4). Le nom complet en texte courant est « Track » et « Jump ». (Noms d'affichage provisoires : si Nathan en choisit d'autres, seuls les catalogues de traduction changent.)
- **Dans les lignes à partager d'un jeu** : `Du Jour · Track #8`, `Du Jour · Jump #8` (même forme en français et en anglais).
- **Titre de la plateforme dans le navigateur** : « Du Jour », puis « Track — Du Jour », « Jump — Du Jour ».

## 3. Les couleurs

Toutes les couleurs passent par des **jetons** (`packages/ui`). Aucune couleur écrite en dur dans une application.

### 3.1 Marque (portail et cadre des jeux)

| Jeton | Valeur | Usage |
|---|---|---|
| `--dj-creme` | `#EDE3CF` | fond de page |
| `--dj-creme-2` | `#E3D6BC` | tuiles, zones secondaires |
| `--dj-papier` | `#FFF6E0` | étiquettes claires, champs, bulles |
| `--dj-encre` | `#2A1E16` | texte, bordures, ombres nettes |
| `--dj-encre-douce` | `#6B5847` | texte secondaire (5,3:1 sur crème) |
| `--dj-terre` | `#C2401F` | action principale ; texte `#FFF4E0` dessus (4,8:1) |
| `--dj-terre-texte` | `#FFF4E0` | texte sur terre cuite |
| `--dj-moutarde` | `#E8B23A` | accent : avatar, coque de cartouche Jump, surlignage |
| `--dj-ecran` | `#3A2C20` | afficheur encastré (compte à rebours) |
| `--dj-ambre` | `#F2B544` | chiffres de l'afficheur |
| `--dj-ecran-texte` | `#E9DCC2` | légendes de l'afficheur |
| `--dj-ecran-ombre` | `#261D15` | ombre interne haute de l'afficheur (opaque) |
| `--dj-ecran-reflet` | `#4A3D32` | reflet interne bas de l'afficheur (opaque) |

### 3.2 Médailles (communes à tous les jeux)

| Jeton | Valeur | Texte dessus |
|---|---|---|
| `--dj-auteur` | `#2E9E5B` | `--dj-auteur-texte` (`#0E1F14`) |
| `--dj-or` | `#D9A21B` | `--dj-medaille-texte` (= `--dj-encre`) ou `#1E1B19` |
| `--dj-argent` | `#A7A9AC` | `--dj-medaille-texte` ou `#1E1B19` |
| `--dj-bronze` | `#C07A42` | `--dj-medaille-texte` ou `#1E1B19` |

Une médaille obtenue est un aplat de sa couleur ; une médaille pas encore obtenue est un contour de la couleur (Track) ou un aplat neutre (Jump), jamais grisée jusqu'à l'illisible. Le texte dit toujours le nom de la médaille : la couleur seule ne porte pas l'information.

### 3.3 Étiquette Track

| Jeton | Valeur | Usage |
|---|---|---|
| `--track-asphalte` | `#1E1B19` | fond de l'étiquette |
| `--track-coque` | `#4A4440` | coque de la cartouche Track |
| `--track-route` | `#5A524C` | tracés, séparateurs, bordures de boutons secondaires |
| `--track-piste` | `#26221F` | fond des aperçus de circuit |
| `--track-texte` | `#F4EFE6` | texte principal |
| `--track-texte-doux` | `#CFC6BA` | texte secondaire |
| `--track-livree` | `#E8552D` | bandes de livrée, bouton « Courir » (texte asphalte dessus) |
| `--track-livree-texte` | `#FF8A5C` | écarts de temps et accents en petit texte sur asphalte |
| `--track-livree-ombre` | `#8E2E14` | épaisseur du bouton « Courir » |

### 3.4 Étiquette Jump

| Jeton | Valeur | Usage |
|---|---|---|
| `--jump-jaune` | `#FFD23F` | fond de l'étiquette (c'est la couleur du personnage) |
| `--jump-papier` | `--dj-papier` | cadres, aperçus de niveau |
| `--jump-encre` | `--dj-encre` | texte, bordures épaisses, bouton principal (texte jaune dessus) |
| `--jump-danger` | `#D7263D` | **réservé aux dangers** (scies, pics) dans les aperçus : jamais pour un bouton ni un texte d'interface |

Raison du rouge réservé : dans le jeu, rouge = ça tue. L'interface ne doit pas affaiblir ce signal.

## 4. Les typographies

| Rôle | Police | Graisses | Où |
|---|---|---|---|
| Titres de la marque, boutons de marque | Archivo Black | 400 | partout |
| Texte courant | Archivo | 400, 600, 700 | partout |
| Chiffres, dates, numéros du jour, temps | JetBrains Mono | 500, 700 | partout |
| Voix de Track | Barlow Condensed | 600 droit, 700 et 800 italique | étiquette Track |
| Voix de Jump | Lilita One | 400 | étiquette Jump |

- **Hébergées sur le site** (fichiers `woff2`, sous-ensemble latin qui couvre le français), `font-display: swap`. Aucun appel à un service de polices externe : rapidité et confidentialité (rien n'est envoyé à un tiers).
- Toutes sous licence SIL Open Font License ; les fichiers de licence accompagnent les polices.
- **Budget** : le portail charge au plus 150 Ko de polices ; seules Archivo Black et Archivo 400 sont préchargées.
- Les **chiffres** (temps, compte à rebours, rangs dans les tableaux) sont en JetBrains Mono ou dans la police du jeu, jamais dans une police à chasse variable sans chiffres tabulaires : un temps qui change ne doit pas faire bouger la ligne.
- Échelle : 12 · 13 · 14 · 15 · 16 · 21 · 22 · 24 · 32 · 38 · 64-72 px.
- Espaces : les polices n'ont pas l'espace fine insécable (U+202F) ; les formats utilisent l'espace insécable (U+00A0) entre milliers et avant les unités. Pas de texte d'interface sous 12 px (sauf légendes en capitales de 10-11 px, graisse 700, contraste ≥ 4,5:1).

Raison : Archivo Black donne le côté boîte de jeu imprimée ; la mono donne l'afficheur ; Barlow Condensed italique est tendue comme un chronométrage de course (Trackmania) ; Lilita One est ronde, lourde et drôle (Super Meat Boy, Mario).

## 5. Les formes

- **Cartouche** : bordure 3 px `--dj-encre`, coins **12 px en haut et 3 px en bas** (la coque s'enfiche par le bas), ombre nette `4px 4px 0 var(--dj-encre)`, **stries de préhension** en haut (bande de 12 px, traits de 3 px tous les 8 px, en retrait de 40 px de chaque côté). L'étiquette est posée dans la coque avec 10 px de marge et des coins de 3 px.
- **Bouton** : coins 3 px, bordure 2 px encre ; hauteur 44 px minimum, 46 px pour l'action principale du portail, 56-60 px pour l'action principale d'un jeu (« Courir », « Jouer »).
  - principal de marque : fond `--dj-terre`, texte `--dj-terre-texte`, Archivo Black en capitales ;
  - secondaire : fond crème ou transparent, texte encre ;
  - principal Track : fond `--track-livree`, texte asphalte, Barlow Condensed 800 italique, épaisseur `0 4px 0 var(--track-livree-ombre)` ;
  - principal Jump : fond encre, texte jaune, Lilita One, épaisseur `0 5px 0 var(--dj-terre)`.
- **Tuile** : fond `--dj-creme-2`, bordure 2 px encre, coins 4 px ; légende en capitales 11 px `--dj-encre-douce`, valeur en Archivo Black 24 px.
- **Afficheur encastré** (compte à rebours, futur chronomètre du portail) : fond `--dj-ecran`, coins 6 px, ombres internes opaques (`--dj-ecran-ombre` en haut, `--dj-ecran-reflet` en bas), chiffres JetBrains Mono 700 en `--dj-ambre`.
- **États des boutons** : survol du bouton de marque = fond encre ; du secondaire = `--dj-creme-2` ; de « Courir » = `--track-livree-texte` ; du principal Jump = texte papier. **Désactivé** = aplat `--dj-creme-2`, texte `--dj-encre-douce`, bordure pointillée, sans ombre (jamais de transparence). Le bouton de marque ne se pose pas sur l'asphalte.
- **Ombres** : toujours **nettes** (sans flou), décalées vers le bas et la droite. Aucune ombre floue, aucune transparence d'arrière-plan (pas de verre dépoli).
- **Coins** : jamais uniformes partout. 3 px (boutons, étiquettes), 4 px (tuiles), 6 px (afficheur), 12/3 px (coques), cercle (avatar uniquement).
- **Bandes de livrée Track** : rayures obliques à 115°, 10-12 px d'orange pour 8-10 px de vide, sur le bord droit de l'étiquette.
- **Jump** : bordures épaisses (3 px), petites inclinaisons (−2° à +6°) pour les autocollants et pastilles, texte à ombre nette papier sur le titre.

Raison : les ombres nettes et les coques dissymétriques font « objet » ; le flou et la translucidité font « gabarit d'interface ».

## 6. Les icônes

- SVG au **trait** de 2 à 2,5 px, extrémités carrées, couleur `currentColor` ; formes simples (chevron, flamme, crâne, drapeau, horloge).
- **Aucun émoji dans l'interface.** Les émojis n'apparaissent que dans les **lignes à partager** (texte collé dans une messagerie), où ils sont la convention. Ligne de la journée : 🏆 🥇 🥈 🥉 (médailles, ceux des jeux), ✅ fini sans médaille, ⬜ pas fini, 🔥 série, ⭐ journée parfaite.
- Une icône seule a toujours un `aria-label` ; une icône décorative est `aria-hidden`.

## 7. Les textes (le ton)

- **Tutoiement** partout en français ; en anglais, ton direct et familier équivalent (« you »), sans traduction mot à mot.
- **Du Jour** : chaleureux, simple, court. « Les jeux du jour », « Prochains jeux dans », « Partager ma journée ».
- **Track** : sec, précis, les chiffres d'abord. « Courir », « Meilleur temps », « Fantôme à battre ».
- **Jump** : drôle et un peu cruel, **une seule réplique par écran au plus**, liée au thème ou à la mécanique du jour (« Les tapis roulants ne t'attendront pas. La scie non plus. »). Les répliques vivent dans les catalogues de traduction, par thème, et existent dans les deux langues (adaptées, pas traduites littéralement).
- **Vocabulaire anglais fixé** : « Pseudo » → “Name” ; « Classement » → “Leaderboard” partout (jeux et portail ; « Classement du jour » → “Today's leaderboard”) ; « Fini » → “Done” ; « Point de contrôle » / « point de passage » → “Checkpoint” (« PC » → “CP”) ; médaille « Auteur » → “Author” ; « Salon » → “Room” ; caméra « proche » → “Close” partout.
- Formats : `31,402 s` / `31.402 s` ; `14e` / `14th` ; « Mardi 20 octobre » / « Tuesday, October 20 » ; `n° 12` / `#12`.

## 8. Le mouvement

- Court (120 à 200 ms), **mécanique** : une cartouche ou un bouton qui s'**enfonce** au toucher (décalage de 2 px vers le bas et la droite, ombre réduite d'autant).
- Aucune animation décorative en boucle sur le portail. Le compte à rebours change de chiffre sans animation.
- `prefers-reduced-motion: reduce` : aucune transition de déplacement.

## 9. Mise en page

- **Mobile d'abord**, portrait 390 px de large, marges latérales de 16 px. Le contenu s'aligne **à gauche** avec une hiérarchie nette (date et titre de section en haut, cartouches, puis tuiles) ; rien n'est centré par défaut sauf les boutons pleine largeur.
- En paysage et sur grand écran : l'étagère passe à plusieurs cartouches côte à côte, largeur de contenu limitée (environ 720 px pour le portail), fond crème sur toute la fenêtre.
- **Barre du portail** : logo à gauche ; à droite le choix de langue (FR/EN, deux boutons de 44 px) et l'avatar.
- **Barre des jeux** : « ‹ DU JOUR » à gauche (lien vers le portail, 44 px de haut), date et numéro du jour à droite en mono.
- **Étiquette d'une cartouche du portail** : le nom du jeu seul sur sa ligne ; le numéro du jour du jeu et le thème **en dessous** (« n° 8 · Nuit ») ; le statut sur deux rangées dont la place est réservée avant l'arrivée des données ; le bouton de la cartouche (« Jouer », « Continuer », « Rejouer ») **prend toute la largeur** et garde la même hauteur quel que soit le statut. Raison : rien ne bouge quand le statut arrive.
- **Journée commune** : « Journée n° *N* » à droite de la date sur le portail, et « Du Jour #*N* » dans la ligne à partager. La journée n° 1 est le **23 octobre 2026** (ouverture publique) ; avant, aucun numéro n'est affiché.
- **Accueil d'un jeu qui a une scène** (Track) : l'étiquette opaque est posée **sur la scène du jeu**, derrière un **voile à rayures** (motif net, ni flou ni transparence), avec la barre des jeux en plaque crème. Raison : on voit le jeu dès l'accueil sans casser la règle des surfaces nettes.
- **Surimpressions en partie (Track et Jump) : compactes.** Le jeu se lit d'abord ; l'interface se fait petite.
  - **Une seule bande** au centre en haut, **30 px de haut** (téléphone en paysage) : chronomètre · point de contrôle / de passage · écart signé (`+` / `−`), collés en une plaque. Rien d'empilé dessous en permanence.
  - En haut à gauche : pause (44 px), et pour Track les deux actions de course (dernier point de contrôle, recommencer) en boutons de 44 px. En haut à droite : objectif de médaille (pastille + seuil, sans le mot « Objectif ») ; Track : le rang du jour en pastille qui s'ouvre au toucher ; Jump : l'autocollant des morts.
  - **Le centre de l'écran reste libre** pendant la partie : aucune plaque permanente, aucun panneau. Le titre du circuit ou du niveau ne s'affiche qu'au départ, quelques secondes. Une aide s'affiche en une ligne courte sous la bande, puis disparaît.
  - Commandes tactiles **aux bords** de l'écran (direction en bas à gauche, frein et gaz / saut en bas à droite), jamais devant le véhicule ou le personnage ; par défaut, les **boutons** (pas de joystick).
  - Les actions rares (caméra, graphismes, plein écran, son, fantôme) vont dans la pause.
  - Bordures de 2 px, ombre nette de 2 px. Maquettes : `track-hud-paysage.html` (compact, retenu), `jump-hud.html`.
- **Quand on entre dans un jeu, on y reste tant qu'on ne choisit pas de le quitter** (règle de Nathan). **Tous les écrans d'un jeu** — accueil, « Comment jouer », pause, arrivée, carnage, classement du jeu, archives, réglages — sont **posés sur la scène du jeu** sous le voile à rayures : barre des jeux en plaque crème, étiquette du jeu dans sa coque ; l'écran du dessous s'efface pendant ce temps (un seul voile). « Jeu suivant du jour » et « ‹ DU JOUR » sont les seules portes de sortie, et ce sont des choix du joueur.
- Exceptions : la **pause** et **« Comment jouer »** sont des **dialogues** posés sur le voile, sans barre des jeux (une seule façon de les fermer). L'étiquette de **Track** n'a pas de coque (place et poids) ; celle de **Jump** garde sa coque moutarde.
- **Le cadre crème pleine page** est réservé aux écrans **Du Jour** : portail, profil commun, classement du jour, mentions légales.
- **« Comment jouer »** : dans le jeu, trois points courts, schéma des commandes, « C'est parti » ; montré une seule fois au premier lancement, puis depuis la pause et l'accueil.
- **Classements** (portail et jeux) : **ta ligne** sur fond `--dj-moutarde`, bordure 3 px encre et ombre nette ; visible même hors du haut, après « … », à sa vraie place. **Sur l'étiquette jaune de Jump**, ta ligne est en **encre** (texte jaune, ombre papier) : la moutarde ne s'y distinguerait pas.
- **Profil commun** : une étiquette par jeu (la cartouche agrandie, § 1) porte ses statistiques ; médailles en cases, deux par ligne.

## 10. Accessibilité

- Contrastes : 4,5:1 pour tout texte, y compris les petites légendes ; 3:1 pour le texte de 24 px et plus. Les paires de couleurs de ce document sont choisies pour passer ; toute nouvelle paire est vérifiée par un test.
- Cibles tactiles de 44 px minimum.
- **Focus visible** : contour 3 px `--dj-encre` décalé de 2 px sur fond clair ; contour 3 px `--dj-ambre` sur fond sombre (asphalte, afficheur).
- Vrais éléments (`button`, `a`, `input` + `label`) ; langue du document (`lang`) suivie au changement de langue.

## 11. Ce qui est interdit (le « générique »)

- dégradés de fond (bleu-violet ou autres) ; seuls les motifs (rayures, stries) sont permis ;
- cartes translucides, flou d'arrière-plan, ombres floues ;
- police système ; coins arrondis identiques partout ;
- émojis comme icônes ;
- mises en page centrées sans hiérarchie ;
- animations décoratives sans raison ;
- couleurs ou chaînes d'interface écrites en dur dans les applications.

## 12. Ce que la charte ne touche pas

- Le **rendu en jeu** (monde, personnage, voitures, effets) : procédural, inchangé. La charte s'applique à l'interface hors partie et aux surimpressions (chronomètre, compteurs) seulement quand un lot de jeu le prévoit (I4, I5).
- Les règles des jeux, les classements, les rediffusions.
