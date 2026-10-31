# Lot M1 — Les menus à la manette (plateforme)

Charte : `docs/plateforme/identite.md` § 10 (révision 14). Moteur et règles : `packages/ui/CLAUDE.md`, « La manette dans les menus ». Les commandes réglables sont le lot M2 ; ce lot fait la navigation.

## Pour les joueurs
- [Du Jour] Tout le site se joue à la manette, menus compris. // The whole site now works with a gamepad, menus included.

## Le module et ses règles
`packages/ui/src/manetteLogique.ts` (pur, testé), `manette.ts` + `manette.css` + `catalogue.manette.ts` (le moteur), `manetteLien.ts` (le seul morceau du premier chargement). **Une seule logique pour le portail, Track, Jump et Tower.**
- **Zéro coût sans manette** : le moteur n'est chargé (`import()`) qu'à la première manette (`gamepadconnected`) ; sa boucle `requestAnimationFrame` ne tourne que manette « standard » branchée et page visible.
- Croix et stick gauche (zone morte 0,5), répétition (immédiat, 300 ms, puis 120 ms), navigation spatiale (le plus proche dans la direction ; dans un dialogue, jamais hors de lui ; un curseur se règle à gauche / droite ; sans plus loin, haut / bas défile). **A** active (champ de texte : prend la saisie) ; **B** active le « retour » déclaré, sinon la flèche « ‹ » qui ferme l'écran (sur l'accueil du portail et des jeux : rien) ; **LB / RB** : onglet précédent / suivant ; **Start** reste au jeu (la pause).
- **Un appui ne sert jamais deux fois** : tout bouton tenu pendant un menu est « consommé » ; le jeu le lit levé jusqu'à son relâchement.
- Focus : sur l'action principale à l'ouverture (déclarée, une ligne par écran) ; rendu à sa place par `suivreDialogue` (déjà là) ; anneau + liseré moutarde à la manette ; le défilement suit le focus.
- Bande d'aide (bas à droite) : « A Valider · B Retour » et « LB RB Onglets » s'il y a des onglets ; seulement si la dernière entrée vient d'une manette et qu'un menu est ouvert ; disparaît au toucher, à la souris, au clavier ; jamais en partie. Lettres Xbox par défaut, croix / rond dessinés si l'identifiant est celui de Sony (`054c`). FR et EN.

## Comment chaque jeu lisait la manette, et ce qui a été branché
- **Track** : `Controls.poll()` (`apps/web/src/input.ts`) lisait `navigator.getGamepads()` à chaque image (stick / croix, A et RT gaz, B et LT frein, Y point de contrôle, X recommencer, Start pause, Select caméra), **sans savoir si un menu était ouvert** : X dans la pause recommençait. Branché : `padPourLeJeu(pad)` ; menu ouvert, tout est levé sauf Start.
- **Jump** : `Controls.pollPad()` (`apps/jump/src/input.ts`) : croix / stick, A ou B saut, X, Y, Start menu. `setSuspended` ne protégeait que le clavier et X / Y. Branché de la même façon.
- **Tower** : ne lit aucune manette (clavier, boutons). Le menu seul est branché ; la règle est dans `docs/tower/consignes.md`.
- **Portail** : rien avant.

## Les écrans et leur action principale (une ligne par écran, dans le `manette.ts` de chaque application)
- **Portail** (`PAGES_MANETTE`) : accueil → « Jouer » de Track ; `/classement/` → l'onglet ouvert (LB / RB) ; `/profil/` → le champ du pseudo ; `/nouveautes/` → la flèche « ‹ ». Tuiles, partage et langue se rejoignent à la croix.
- **Track** : accueil `#home-daily` · Comment jouer `#howto-done` (B aussi) · pause `#pause-resume` (B aussi ; `#pause-stay` à la confirmation) · arrivée / Salon / rediffusion le bouton principal, **B : `#finish-home`** · classement · réglages (l'onglet ouvert, LB / RB) · archives · podium · Garage.
- **Jump** : accueil `#home-play` · Comment jouer `#help-close` (B aussi) · pause `#menu-resume` (B aussi) · arrivée `#arrival-replay`, **B : `#arrival-home`** · bandeau d'un morceau · carnage `#carnage-pause` (B : `#carnage-close`) · classement · archives · réglages.
- **Tower** : pause `#pause-reprendre` (B aussi) · fin de partie `#fin-rejouer`.
- Hors périmètre : l'administration (`/admin/`, `/track/admin/`, `/jump/admin/`).

## Limites
- **Champs de texte** : le focus y arrive, A ouvre la saisie, au clavier du système quand il existe (Steam Deck, télévision) ; sinon au clavier. **Aucun clavier virtuel n'est dessiné** ; un navigateur qui n'ouvre pas son clavier sur un focus donné par programme n'en ouvrira pas.
- **Les pages des mentions légales** (`/mentions-legales/`, `/legal/`) restent **sans script** (règle de fidélité, test de `mentions.test.ts`) : elles ne se pilotent pas à la manette. **Décision de Nathan** : accepter un script de quelques lignes (et corriger la phrase « sans script » des deux pages), ou garder.
- Disposition « standard » seulement (une manette en disposition libre est ignorée) ; le navigateur ne montre la manette qu'après un premier bouton. Dialogues repérés par `role="dialog"` : un écran sans ce rôle se déclare comme surimpression (le carnage de Jump).
- Les commandes en partie, la vibration, les touches réglables : hors lot.

## Budgets (`docs/plateforme/budgets.md`, mesuré contre `main` reconstruit à part)
Track +110 o (293 473 pour 294 712 : **aucun relèvement**) · portail +151 o (31 590 pour 32 768) · Jump +89 o (372 941 pour 378 490) · **Tower +43 o (167 999 pour 168 000 : 1 o de marge)**. Pour tenir, le moteur démarre en se chargeant (sans filtre : Tower ne lit pas la manette) et sa feuille est posée en `<link>` (un `import()` sans dépendance n'a pas de liste à précharger). **À décider par Nathan** : (1) Tower est au plafond, le moindre octet demandera un relèvement ; (2) le test de poids de Jump (`apps/jump/e2e/poids.spec.ts`, et `mesureJump`) compte tout le JS hors quelques préfixes : le moteur (≈ 4,8 ko, à la demande) l'aurait fait dépasser de 1 166 o ; je l'ai **classé « à la demande » par son préfixe `manette-`**, comme `catalogue.en-` et `interrupteur-` — sans cette exclusion, relever le plafond de Jump ou alléger le moteur.

## Vérifié / non vérifié
- Vérifié : 23 tests unitaires du moteur (croix, stick, zone morte, répétition, appui consommé, navigation spatiale, lettres, aucune lecture sans manette) et les tables d'écrans (chaque écran déclare un principal, ce qu'il nomme existe) ; **un seul test navigateur** (`e2e/manette.spec.ts`, Régression : le budget de 900 s de la CI de PR n'a plus de marge, comme au lot 52) : portail › bande et focus sur Jouer › croix › A sur Jump › Start › A sur « Reprendre » sans saut › nouvel appui qui saute ; axe sans violation grave ; captures `lot-M1-*.png` (844 × 390).
- **Non vérifié** : manette physique, Steam Deck, télévision, Firefox et WebKit, les écrans de réglages, d'archives, de classement, de Salon et de Garage (déclarés et existants, pas parcourus à la manette), l'anglais de la bande en navigateur.
- Maquette `manette-et-commandes.html` : **absente de la pièce jointe, donc non recopiée** ; la bande suit le texte de la charte. La charte du dépôt (révision 13 de Tower) étant plus récente que celle envoyée, seul le § 10 a été fusionné, en **révision 14**.
- Runs de CI : voir la PR.
