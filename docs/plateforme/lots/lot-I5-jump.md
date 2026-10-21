# Lot I5 (plateforme, phase 3) — Jump : nouvelle interface et anglais

Aucun changement de `packages/jump-sim`, `packages/core`, `packages/clock`, de la physique, du générateur, des morceaux, du classement, d'une rediffusion ni des mécaniques de thème : **golden inchangés** (`git diff main --stat -- packages/jump-sim packages/core packages/clock` est vide). Le rendu du niveau, le personnage, les effets et les sons ne changent pas. **Aucune dépendance npm ajoutée** (le verrou ne gagne qu'une ligne : `@cdj/ui` déclaré dans `apps/jump/package.json`, un espace de travail déjà là). Vision : `docs/plateforme/seed-phase-3.md` ; charte : `docs/plateforme/identite.md` (**révision 7**, déjà dans le dépôt au début du lot) ; consignes : `apps/jump/CLAUDE.md` (« Interface Du Jour (lot I5) »). Nom affiché **« Jump »** partout ; titre de la page « Jump — Du Jour ».

## 0. Préalables
- **Charte révision 7** : celle du dépôt (placée au lot I4) est la révision jointe au brief : rien à remplacer.
- **Sept maquettes placées** dans `docs/plateforme/maquettes/cartouches/` : `jump-hud.html`, `jump-pause.html`, `jump-carnage.html`, `jump-accueil.html`, `jump-arrivee.html`, `jump-classement.html`, `jump-reglages.html` (références : jamais construites ni servies ; la charte prime). `jump.html` (lot I1) reste.
- **Budget remesuré sur `main`** au début du lot (`4c57c67`) : JS du premier chargement **352 866 o** compressés (les neuf fichiers de la construction hors `verify.html`, worker du générateur et galerie compris) + CSS **5 624 o** (la feuille écrite dans `index.html`) = **358 490 o** (le « 355 ko » du lot R4 comptait la même chose avant les lots P3 et P4).

## 1. Inventaire des écrans et des surimpressions
| Écran / surimpression | Avant (lots 1 à I3) | Après (lot I5) | Fichiers |
|---|---|---|---|
| **HUD** | bande haute de boutons au téléphone (recommencer, 👻, ⚙, plein écran), chrono + « Meilleur » + « Morts » empilés dessous, ligne du jour permanente avec la médaille visée en émoji, version dans un coin | **compact** (maquette `jump-hud.html`, charte § 9) : une bande de 30 px au centre en haut (chrono Lilita One à cases de largeur fixe · fanion « 2/4 » · écart signé au record), la pause de 44 px en haut à gauche, l'objectif de médaille compact et l'autocollant des morts (crâne, nombre, jaune, penché de 3°) en haut à droite ; le titre du niveau au départ seulement ; la version avec `?debug` seulement (sinon petite, dans la pause) ; aucun émoji | `index.html`, `hud.ts`, `hud.css` |
| **Commandes tactiles** | boutons ←, →, saut dessinés au milieu de leurs zones ; bande haute de boutons | **mêmes zones et même comportement (lot 1b)** ; les boutons dessinés aux bords : ← → en bas à gauche (collés à la frontière des deux zones), **SAUT** gros et jaune en bas à droite ; plaques papier ; plus de bande haute : recommencer, fantôme, plein écran, réglages sont dans la pause | `touch.ts` (`buttonRects`), `touchUi.ts`, `hud.css` |
| **Pause** `#menu` | menu ⏸ : réglages complets, profil, fantômes, taches, commandes | **sur la scène sous le voile à rayures** (maquette `jump-pause.html`) : état de l'essai et réplique du thème, **REPRENDRE**, Tout recommencer, Fantôme oui / non, Son oui / non, Réglages, Comment jouer, Plein écran (si possible), Accueil de Jump, « ‹ DU JOUR », Mentions légales, version | `pauseMenu.ts`, `ecrans.css` |
| **Comment jouer** `#help` | fenêtre de texte (accueil) | **dans le jeu**, dialogue sur le voile : trois points, le schéma des zones tactiles (au doigt) ou les touches, « C'est parti » ; seul **une fois** au premier lancement, puis par la pause et l'accueil | `howtoUi.ts` |
| **Carnage** | compteur en surimpression | **habillé** (maquette `jump-carnage.html`) : titre en autocollant et total, « Vague 3 / 12 », barre de lecture (précédente, pause, suivante, avancement), Fermer ; un appui ailleurs le passe toujours | `hud.ts`, `carnage.ts` (`waveStarts`, `waveAt`), `main.ts` |
| **Accueil** `#home` | panneau translucide, « DailyJump #5 », carte du profil | **sur la scène sous les rayures** (maquette `jump-accueil.html`) : barre des jeux dans une plaque crème, étiquette jaune dans la coque moutarde ; « JUMP », « Niveau n° 5 · Forêt », la réplique du thème, tuiles record et série, **JOUER / CONTINUER / REJOUER** selon l'état du jour, Archives, Comment jouer, Réglages ; le carnage du jour (morts de tout le monde, « Voir le carnage »), les cinq premiers du classement (« Tout le classement › »), le compte à rebours, « Mon profil Du Jour › » ; deux colonnes sur ordinateur, une sur téléphone | `home.ts`, `homeLogic.ts`, `ecrans.css` |
| **Arrivée** `#arrival` | carte translucide : seuils des quatre médailles, statistiques, top 10 | **cadre crème** (maquette `jump-arrivee.html`) : « ARRIVÉE ! », le temps en grand, l'autocollant des morts, le bandeau de la médaille et l'écart à la suivante, le rang, **une phrase selon les morts** (paliers 0 / 1–5 / 6–20 / 21–50 / > 50), REJOUER, Voir le carnage, Partager ; le classement (ta ligne en encre), Regarder le premier, le carnage de tout le monde, Accueil de Jump, statistiques et compte à rebours ; **sous l'étiquette** « Jeu suivant du jour : Track › » ou « Journée parfaite ! » + « DU JOUR » (`bouton({ href })`) | `arrival.ts`, `jeuSuivant.ts` |
| **Classement du jour** `#leaderboard` | (seulement à l'arrivée) | page du cadre « ‹ JUMP » (maquette `jump-classement.html`) : rang, pseudo et morts dessous, médaille en pastille et en toutes lettres, temps ; ta ligne en encre, visible même hors du haut | `screensUi.ts` |
| **Archives** `#archives` | liste dans l'accueil | page du cadre « ‹ JUMP » : n°, date et thème, ton résultat (pastille et temps) | `screensUi.ts` |
| **Réglages** `#settings` | dans le menu ⏸ | page du cadre « ‹ JUMP » (maquette `jump-reglages.html`), au-dessus de la pause et de l'accueil : son (trois curseurs), sensations (vibrations, tremblement, mouvement réduit, effets), fantôme du premier, taches de tout le monde, commandes (clavier, manette, tactile), **langue** (`choixLangue`), « Mon profil Du Jour › », Mentions légales | `settingsUi.ts` |
| **Profil** | Réglages › Profil (pseudo, copier / charger / changer le code), carte de l'accueil | **supprimé** : lien vers le profil commun `/profil/?retour=<chemin>` (« ‹ JUMP » au retour) ; un code révoqué ailleurs se dit à l'accueil (`#home-revoked`) | `profilLien.ts` ; `profileUi.ts` retiré |
| **Bandeau** `#finish` (morceaux, scénarios, lectures, essais) | bandeau du lot 2 | le même, habillé aux jetons, textes du catalogue | `hud.ts` |
| **Outils** (`?debug`, `?debug&tune`, `?modules`, `?zones=1`) | — | **inchangés**, en français, exemptés (§ 6) ; habillage aux jetons (`outils.css`) | `tune.ts`, `gallery.ts`, `outils.css` |

Chaînes : **279 clés** par langue (base 27, partie 105, accueil 47, arrivée 59, réglages 41), dont les pluriels ; plus le catalogue commun du socle.

## 2. Le HUD compact
- **Une bande** (`#chrono`, 30 px, bordure et ombre nettes) : le chrono `.time` (Lilita One, **cases de largeur fixe** : Lilita n'a pas de chiffres tabulaires — mesuré : « 0 » fait 0,64 em, « 1 » 0,41 em —, donc chaque chiffre a sa case de 0,64 em et la virgule la sienne, `chiffresFixes`) ; le fanion des points de passage « 2/4 » (dès le départ, « 0/10 », quand le niveau en a) ; **l'écart signé au record** (« +0,412 » sur jaune derrière, « −0,388 » devant, signe écrit, U+2212), au point de passage, contre les temps de passage de ton meilleur essai du jour (`checkpointTimes`, `ghost.ts`) ; la bande **ne change jamais de taille** (vérifié).
- **En haut à gauche** la pause (44 px ; ⚙ seulement en `?debug&tune`) ; **en haut à droite** l'objectif (`#objectif` : pastille de la prochaine médaille et son seuil ; « auteur battu » : la pastille auteur seule) et **l'autocollant des morts** (`#morts`) ; sur un écran étroit (< 600 px) l'objectif passe sous l'autocollant.
- **Le titre du niveau** (`#dayline`, « Jump n° 5 · Forêt », archive, aperçu…) s'affiche au départ et s'efface 2,5 s après la première commande ; les messages courts (`#toast`) prennent sa place ; les notes du jour (date refusée, nouveau niveau) sont en haut à gauche sous la pause.
- **Le centre reste libre.** **Zone du personnage** retenue et vérifiée : **30–70 % de la largeur, 20–64 % de la hauteur** (la caméra tient le personnage au centre, avance d'au plus 4 tuiles dans le sens de la course ≈ 15 % de la largeur en paysage, sol à 1,5 tuile sous le centre ≈ 61 % de la hauteur, zone morte verticale de 2,5 tuiles) : `e2e/layout.ts` (`zoneCentrale`, `expectCentreLibre`), `e2e/hud-compact.spec.ts` (844 × 390, 740 × 360, 390 × 844, 360 × 640 : aucune plaque ni aucun bouton n'y entre, rien ne se chevauche, cibles de 44 px), `test/touch.test.ts` (les boutons dessinés hors de la zone, encoches comprises).
- **Fluidité** : le DOM du HUD n'est écrit **que quand un texte change** (clés mémorisées par plaque dans `mountHud`, le chrono écrit case par case) ; bande et plaques en `contain: layout paint style` ; vérifié par un `MutationObserver` (aucune écriture pendant une seconde sans changement).
- **Mesure avant / après** (`e2e/mesure-lot-i5.spec.ts`, outil) : temps de fil principal par image (CDP `Performance.getMetrics` `TaskDuration` / images comptées par `requestAnimationFrame`), téléphone 844 × 390 @2 au doigt, rendu logiciel, **×4**, la rediffusion de l'auteur d'un jour figé (chrono, points de passage, plaques comme en partie), **trois séries par thème, entrelacées, médiane** ; « avant » = la construction de `main` (`4c57c67`), servie à part. Médianes en ms par image :

| Thème | Avant (séries) | Après (séries) | Médiane avant | Médiane après | Écart |
|---|---|---|---|---|---|
| forêt | 13,98 / 15,83 / 14,67 | 14,33 / 14,40 / 15,35 | 14,67 ms | 14,40 ms | **−0,27 ms** |
| usine | 11,91 / 13,70 / 12,04 | 12,13 / 12,14 / 13,12 | 12,04 ms | 12,14 ms | **+0,10 ms** |
| glace | 25,30 / 23,65 / 25,65 | 23,23 / 24,98 / 21,73 | 25,30 ms | 23,23 ms | **−2,08 ms** |
| nuit | 12,21 / 12,13 / 13,39 | 13,87 / 12,05 / 14,66 | 12,21 ms | 13,87 ms | **+1,66 ms** |
| néon | 25,00 / 25,80 / 31,09 | 27,75 / 25,10 / 26,14 | 25,80 ms | 26,14 ms | **+0,34 ms** |

  **Objectif (≤ +1 ms par image, médiane, à ×4) : atteint sur 4 thèmes sur 5 avec trois séries ; pas pour la nuit (+1,66 ms).** Comme au lot I4, pour ne pas conclure sur du bruit, **la nuit a été refaite sur huit séries** (avant et après entrelacés) : avant 11,68 / 12,09 / 12,02 / 12,60 / 11,48 / 12,52 / 12,77 / 14,67, après 12,46 / 12,24 / 10,88 / 11,50 / 14,53 / 12,45 / 13,10 / 13,63 — **médianes 12,52 ms et 12,46 ms, soit −0,06 ms** : l'écart des trois séries était la dispersion de la mesure (de 10,9 à 14,7 ms dans les deux constructions), pas un élément du HUD. Fenêtres de 31 à 39 images (rendu logiciel). **À confirmer sur un vrai téléphone** (non fait ici).

## 3. L'anglais
- **Catalogues** `catalogue.<zone>.fr.ts` / `.en.ts` (base, partie, accueil, arrivée, réglages), parité vérifiée (`packages/ui/test/catalogues.test.ts`) ; les clés appelées par le code existent (`test/interface.test.ts`). **Le catalogue anglais est un fichier à part, chargé par `import()`** pour un joueur en anglais (4,2 ko compressés, une requête de plus) : un joueur en français ne le charge jamais.
- **Langue** : `lireLangue` de `@cdj/profile` (`cdj:langue`, sinon le navigateur) ; Réglages › Langue (`choixLangue` du socle) l'écrit pour toute la plateforme et change tout **sans recharger** (`<html lang>`, titre, `data-t`, chaque écran se redessine). `e2e/langue.spec.ts` : un navigateur `en-US` ouvre en anglais (accueil, « How to play », titre), bascule en français sans recharger (un témoin sur `window` le prouve), `cdj:langue` écrit ; l'arrivée en anglais (« FINISH! », phrase, partage).
- **Répliques des thèmes** : une seule source, **le catalogue commun** (`jump.replique.<thème>` de `@cdj/ui`, déplacées sans changement depuis le catalogue du portail), lues par le portail et par le jeu (accueil, pause) ; `catalogues.test.ts` refuse toute clé d'application contenant « replique » et toute copie mot pour mot.
- **Erreurs du serveur** : `t("erreur." + code)` (catalogue commun), `erreur.local.*` pour le réseau ; `RankState.message` est devenu `code` (le texte se calcule à l'affichage, dans la langue du moment).
- **Formats du socle partout** (`formatTemps`, `formatRang` « 2e » / « 2nd », `formatNombre`, `formatDate`, `formatDateCourte`, `formatNumeroJour`) ; **`formatDecompte` ajouté au socle** (« 07:42:09 », sans les heures « 42:09 », arrondi à la seconde au-dessus, jamais négatif ; testé dans `packages/ui/test/formats.test.ts`, où ont été déplacés les cas de `mmss` / `hhmmss`) et **utilisé par Track** à la place de `mmss` / `hhmmss` (retirés de `apps/web/src/homeLogic.ts`).
- **Ligne à partager** : `Du Jour · Jump #5 — 31,402 s — 🥇 — 47 💀 — 3e/128` (`lignePartage.*`), la même forme en français et en anglais (`Du Jour · Jump #5 — 31.402 s — …`), mêmes émojis ; « (archive) » / « (à venir) » traduits.
- **Le texte des répliques et phrases à relire par Nathan** (nouveau ton, charte § 7) :

| Clé | Français | Anglais |
|---|---|---|
| `arrivee.phrase.zero` (0 mort) | Zéro mort. On va vérifier que tu n'as pas triché. | Zero deaths. We'll be checking for cheats. |
| `arrivee.phrase.peu` (1) | Une seule mort. Les pics sont vexés. | One death. The spikes are offended. |
| `arrivee.phrase.peu` (2–5) | {morts} morts. Presque propre. Presque. | {morts} deaths. Almost clean. Almost. |
| `arrivee.phrase.moyen` (6–20) | {morts} morts. Le niveau commence à te connaître. | {morts} deaths. The level is starting to know you. |
| `arrivee.phrase.beaucoup` (21–50) | {morts} morts. La scie te remercie pour ta fidélité. | {morts} deaths. The saw thanks you for your loyalty. |
| `arrivee.phrase.carnage` (> 50) | {morts} morts. À ce stade, c'est toi le décor. | {morts} deaths. At this point, you're part of the scenery. |
| `accueil.carnage.aucun` | Personne n'est encore mort aujourd'hui. Ça ne va pas durer. | Nobody has died yet today. That won't last. |
| `accueil.classement.vide` | Personne n'est encore classé. La place est chaude. | Nobody's ranked yet. The seat is warm. |
| `aide.point2` | Tu vas mourir. C'est gratuit : on repart aussitôt, depuis le dernier fanion. | You'll die. It's free: you're back at once, at the last checkpoint flag. |

  Les répliques des cinq thèmes (`jump.replique.*`) sont celles du portail (lot I2), inchangées.

## 4. Construction, poids et polices
- **`pagesDuSocle`** (`vite.config.ts`) avec `absolues: true` : le HTML n'a aucun texte en dur (`data-t` pré-remplis en français), titre « Jump — Du Jour » ; polices servies par `/assets/<nom>-<empreinte>.woff2` (`renderBuiltUrl`).
- **Polices partagées** : six faces (Lilita One 400, Archivo Black 400, Archivo 400 / 600 / 700, JetBrains Mono 700), **toutes déjà dans le jeu du portail** (mêmes fichiers, mêmes empreintes) ; `partagerPolices` (`scripts/site.mjs`) traite maintenant `track` **et** `jump` : plus aucune copie sous `jump/assets/` (tests `apps/portail/test/site.test.ts`, deux cas Jump). **Seules Lilita One et Archivo 400 sont préchargées** (premier écran).
- **Poids** (gzip, `e2e/poids.spec.ts`, construction de ce lot) :

| | avant (`main`, `4c57c67`) | après | budget |
|---|---|---|---|
| JS du premier chargement (hors `verify`, catalogue anglais) | 352,9 ko | **365,0 ko** | — |
| CSS | 5,6 ko | **9,9 ko** | — |
| **JS + CSS** | **358,5 ko** | **374,9 ko** (+16,4) | **≤ 378,5 ko** (+20) |
| dont three.js | 139,5 ko | 139,5 ko | fichier à part |
| catalogue anglais (à la demande) | — | 4,2 ko | < 8 ko |
| polices (6 faces) | — | 92,0 ko | ≤ 150 ko |

  Marge restante : **3,6 ko**.

## 5. Garder ce qui marche
- **Golden inchangés** ; ni `packages/jump-sim` ni `packages/core` touchés.
- **Ids des tests e2e** : conservés quand l'élément existe encore (`#home`, `#home-play`, `#home-archives`, `#home-help`, `#home-settings`, `#home-rank`, `#home-portail`, `#help`, `#help-close`, `#menu`, `#menu-resume`, `#menu-restart`, `#menu-home`, `#menu-portail`, `#menu-mentions`, `#arrival`, `#arrival-*` (replay, share, carnage, home, rank, name, name-ok, first, everyone, next, next-game, perfect, portail), `#finish`, `#chrono .time`, `#dayline`, `#daynote`, `#toast`, `#modetag`, `#carnage`, `#archives`, `#rotate`, `#gear`, `#tune`, `#touch`, `.tbtn`, `#zones`, `#stamp`, `#debug`). **Changés, avec la raison** (specs mis à jour, aucune assertion retirée sans son équivalent) :
  - `#restart`, `#ghost` / `#ghostbtn`, `#pause`, `#tbar` : plus de bande de boutons (charte § 9) → `#pausebtn`, et recommencer / fantôme dans la pause (`#menu-restart`, `#menu-ghost`) ; la touche G le dit par `#toast` ;
  - `#chrono .deaths`, `#chrono .best` : l'autocollant `#morts .count` ; le meilleur temps n'est plus affiché en partie (l'écart au record le remplace), les tests lisent `__jump.attempt.bestText` ;
  - le chrono de la bande s'écrit **sans unité** (« 0,000 », maquette) ; les temps des écrans ont l'espace insécable du socle (« 21,625 s ») ;
  - les réglages du menu ⏸ (`#menu [data-setting=…]`, `#menu-first-ghost`, `#menu-others-stains`) sont dans `#settings` (`#reglages-premier`, `#reglages-taches` : choix « Montrer / Cacher », `aria-pressed`) ;
  - `#home-profile`, `#profile-*` : plus de profil dans le jeu (`#home-profil`, `#settings-profil` vers `/profil/`) ; `profil-commun.spec.ts` charge le code **comme le portail** (`writeIdentity` + `noteIdentityChange` de `@cdj/profile` dans le stockage de l'autre appareil) et change le code par `POST /api/me/code` ; `#home-revoked` dit le code révoqué ;
  - `#archives-close` : la barre du cadre (`.dj-barre-jeu__retour`) ; `.arow`, `.anum`, `.ares` → `.archive`, `.archive__numero`, `.archive__resultat` ;
  - l'arrivée : `.atime`, `.amedal`, `.amedaltext`, `.abest`, `.astats`, `.arun`, `.astreak`, `.acount`, `.amessage`, `.arklist li.mine .kname / .krank`, `.arkerror`, `.arksuggestion`, `.arktitle` → `#arrival-time`, `#arrival-medal` (`data-medal`), `.arrivee__*`, `.ligne--moi .ligne__nom / .ligne__rang` ; la liste des quatre seuils (`.athresholds`) est remplacée par le bandeau de la médaille (maquette) ;
  - textes : « DailyJump #5 » → « Jump n° 5 » (titre) et `Du Jour · Jump #5` (partage) ; rangs « 2ᵉ » → « 2e » (`formatRang`) ; dates « 18 oct. 2026 » → « dim. 18 oct. » (`formatDateCourte`) ; l'étiquette du premier « Nom · 1er » ; l'invitation à tourner le téléphone et « Comment jouer » ont leurs nouveaux textes ; `#stamp` seulement avec `?debug` ; « Comment jouer » est monté partout (caché) car la pause l'ouvre.
  - `apps/web/e2e/domaine.spec.ts` (mentions depuis les Réglages et la pause, retour au portail « DU JOUR ») et `portail-journee.spec.ts` (« DU JOUR » au lieu de « ‹ Du Jour », le cadre qui défile ; « Jeu suivant du jour » est le bouton de marque du socle, 46 px comme dans Track, au lieu des 48 px du lot I3) suivent.
- **Clavier** : focus visible (contour 3 px ; ambre sur les plaques sombres) ; Échap ferme l'écran du dessus (réglages, archives, classement, aide), sinon la pause.

## 6. Exemptions du test des chaînes en dur
`packages/ui/test/applications.ts` : `apps/jump/src` et `apps/jump/index.html` sont dans `DOSSIERS_SANS_CHAINES_EN_DUR`, les catalogues de Jump dans `CATALOGUES`. **Exemptés, chacun avec sa raison écrite** : `tune.ts` (`?debug&tune`, outil de réglage du personnage, en français), `gallery.ts` (`?modules`, galerie des morceaux, outil), `verify.ts` (page de vérification, aucun texte), `themes.ts` (données des thèmes : noms internes, pas de texte affiché), `audioLogic.ts` (noms des voix). Leur habillage suit les jetons (`outils.css`).

## 7. Captures
`CAPTURES=1 npx playwright test captures-lot-i5 --project=chromium` (dans `apps/jump`), Chromium, **français et anglais**, `docs/plateforme/lots/img/lot-I5-<écran>-<format>-<fr|en>.png` :
- **accueil** : portrait, paysage, **1440 × 900** (`lot-I5-accueil-<portrait|paysage|bureau>-…`), et après une arrivée (`lot-I5-accueil-fini-…` : REJOUER, record, rang) ;
- **« Comment jouer »** dans le jeu, à la première visite, au doigt (`lot-I5-aide-<paysage|portrait>-…`) ;
- **HUD en partie sur chaque thème**, paysage (`lot-I5-hud-<foret|usine|glace|nuit|neon>-paysage-…`) ; le thème est imposé par `?theme=`, donc la partie est un « essai de thème » (l'étiquette « ESSAI · FORÊT » à côté de la pause) ;
- **pause** (`lot-I5-pause-paysage-…`) et **réglages** (`lot-I5-reglages-<paysage|portrait>-…`) ;
- **arrivée** avec médaille, sans médaille, avec « Jeu suivant du jour : Track › », avec « Journée parfaite ! » (`lot-I5-arrivee-<medaille|sans-medaille|jeu-suivant|journee-parfaite>-<portrait|paysage>-…`) ;
- **carnage** (`lot-I5-carnage-…`), **classement du jour** (`lot-I5-classement-…`), **archives** (`lot-I5-archives-…`).

58 images (≈ 3,2 Mo). La démonstration (`?api=demo`, son « aujourd'hui » est le 30/10/2026, n° 15) donne le classement, le carnage du jour et ses morts ; « Jeu suivant du jour » et « Journée parfaite ! » viennent du serveur en vrai : ici `__jump.showSuite` les pose (outil de `?debug`) — le vrai parcours est testé par `apps/web/e2e/portail-journee.spec.ts`. `?pieces=off` (ajouté à `urlOptions.ts`) cache les limites des morceaux que `?debug` dessine sur le niveau.

## 8. Écarts à la charte et aux maquettes — à trancher par Nathan
1. **« Depuis le point de passage »** (pause) : **pas fait** — la simulation n'a pas de réapparition volontaire (seule une mort ramène au point de passage) ; l'ajouter toucherait `packages/jump-sim` (hors périmètre). La pause propose « Tout recommencer ».
2. **« Disposition des commandes »** (réglages) : **pas fait** — les zones du lot 1b sont gardées telles quelles (le brief : « mêmes zones, même comportement ») ; Réglages › Commandes décrit les commandes de chaque appareil.
3. **Boutons tactiles** : ← et → sont collés à la frontière de leurs deux zones (au quart de la largeur), pas tout contre le bord gauche, pour que le bouton dessiné soit dans sa zone ; SAUT est contre le bord droit.
4. **Recommencer au doigt** : seulement dans la pause (plus de bouton dans la bande ; Track a ce bouton en haut à gauche, Jump n'a que la pause, comme la maquette).
5. **L'arrivée** garde le haut du classement, Regarder le premier, le carnage de tout le monde et l'accueil (ce que montraient les lots P1 à P3) sous les actions de la maquette ; le temps s'écrit avec son unité (« 31,402 s »).
6. **« Voir le carnage » à l'accueil** joue ton carnage du jour puis revient à l'accueil (le carnage de tout le monde reste à l'arrivée) ; sans essai du jour, la tuile montre seulement le total.
7. **JOUER / CONTINUER / REJOUER** : « REJOUER » quand le niveau du jour est fini (la maquette ne montre que JOUER / CONTINUER).
8. **L'écart au record** n'apparaît qu'à partir du premier point de passage, contre ton meilleur essai du jour (sans essai : pas d'écart).
9. **Portrait** : toléré (le jeu se joue en paysage) ; l'objectif passe sous l'autocollant des morts, le titre du niveau sous l'objectif.

## 9. Vérifié / non vérifié
**Vérifié ici (Chromium, machine à 4 cœurs)** :
- `npm run typecheck` ; `npm test` : sqlite **173 fichiers / 2 291 tests** verts (golden, catalogues — parité, doublons par application, répliques en un seul endroit —, chaînes en dur, contrastes, jetons, `formatDecompte`, `apps/jump/test/interface.test.ts`, `touch.test.ts` (zone du personnage), `ciE2e.test.ts`, `site.test.ts`) ; libsql **26 fichiers / 364 tests** verts ; `npm run build`.
- e2e Chromium de `apps/jump`, toute la suite (143 tests dont 6 sautés : outils et navigateur sans WebGL) : verte au dernier passage après les corrections (specs relancés un à un : `arrivee`, `carnage`, `dangers`, `classement`, `fantome-premier`, `tout-le-monde`, `jour`, `mobile`, `profil-commun`, `sensations`, `smoke`, `hud-compact`, `langue`, `poids`) ; e2e Chromium de `apps/web` touchés : `domaine.spec.ts` et `portail-journee.spec.ts` verts.
- Mesures de poids (§ 4), de fluidité (§ 2), captures (§ 7).

RUNS_ICI

**Non vérifié** :
- **Firefox et WebKit en local** (non installés ici) : la CI les exécute (sous-ensemble multi-navigateurs de Jump sur une PR : `replay.spec.ts`).
- **Second chargement des polices dans un navigateur sur l'aperçu** (mêmes fichiers que le portail : vérifié sur la construction, pas observé en cache).
- **Fluidité et lisibilité sur un vrai téléphone** : mes mesures sont en rendu logiciel à ×4, mes captures sont celles de Chromium. **Rendu à valider par Nathan sur son téléphone** (aperçu de la PR).
- La suite e2e complète de `apps/web` (Track) n'a pas été relancée en local : seuls `domaine` et `portail-journee` touchent Jump ; le changement de Track (`formatDecompte` à la place de `mmss` / `hhmmss`) rend les mêmes textes (cas déplacés dans `packages/ui/test/formats.test.ts`) — la CI le vérifie.

## 10. Pour le lot I6
- Les mentions légales en anglais et les aperçus de partage restent à faire (I6) ; la page `mentions-legales/` est liée depuis la pause (`#menu-mentions`) et les Réglages (`#settings-mentions`) de Jump.
- Les deux jeux et le portail partagent maintenant les mêmes polices (`/assets/`), le même patron d'interface (`cadre.ts`, `i18n.ts`, catalogues par zone, anglais à la demande) et `formatDecompte`.
- Marge de budget de Jump : 3,6 ko (§ 4) ; celle de Track : 1,4 ko (lot I4).
