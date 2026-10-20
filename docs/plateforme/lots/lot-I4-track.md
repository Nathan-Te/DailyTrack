# Lot I4 (plateforme, phase 3) — Track : nouvelle interface et anglais

Aucun changement de `packages/sim`, `packages/core`, `packages/clock`, de la physique, du générateur, d'un classement, d'une rediffusion ni du Salon (règles) : **golden des deux jeux inchangés**. Le rendu 3D, les voitures, les effets et les sons ne changent pas. **Aucune dépendance npm ajoutée** (le verrou ne gagne qu'une ligne : `@cdj/ui` déclaré dans `apps/web/package.json`, un espace de travail déjà là). Vision : `docs/plateforme/seed-phase-3.md` ; charte : `docs/plateforme/identite.md` (**révision 5**, placée par ce lot) ; consignes : `apps/web/CLAUDE.md` (« Interface Du Jour (lot I4) »).

## 0. Préalables
- **Charte révision 5** : `docs/plateforme/identite.md` remplacée par le fichier joint (surimpressions de course de Track, § 9). **Sept maquettes** placées dans `docs/plateforme/maquettes/cartouches/` : `track-hud.html`, `track-hud-paysage.html`, `track-arrivee.html`, `track-pause.html`, `track-classement.html`, `track-salon.html`, `track-reglages.html` (références : jamais construites ni servies ; la charte prime en cas d'écart).
- **`jeuSuivant.ts` remonté dans `@cdj/profile`** : la logique pure (`suiteDuJour`) et la lecture (`lireSuite`, une requête vers `GET /api/portail/jour`) sont dans `packages/profile/src/jeuSuivant.ts` ; **tests déplacés sans changement** dans `packages/profile/test/jeuSuivant.test.ts` (les deux séries — Track puis Jump — dans un seul fichier, une boucle par jeu) ; les deux jeux importent depuis `@cdj/profile`. Le DOM (le bouton, « Journée parfaite ! ») reste dans chaque jeu : Track le compose avec le socle (`apps/web/src/jeuSuivant.ts`), Jump garde le sien jusqu'au lot I5. Aucun DOM dans le module (test `purete.test.ts`).
- **Nom anglais du Salon : “Room”** (décision de Nathan) : dans les codes d'erreur du Salon du catalogue commun (« Invalid Room session. »…) et dans tout le catalogue de Track. Test : `apps/web/test/catalogue.test.ts` (aucun « Lounge » nulle part).

## 1. Inventaire des écrans et des surimpressions
| Écran / surimpression | Avant (lots 29 à 31) | Après (lot I4) | Fichiers |
|---|---|---|---|
| **Accueil** `#home` | panneau bleu nuit translucide sur la vue 3D du départ, titre « Circuit du Jour », cartes, carte du profil | **la vue 3D autour du point de départ reste visible** (retour de Nathan : pas de fond crème plein écran) ; la barre des jeux (« ‹ DU JOUR », date, n° du circuit) est une plaque crème nette et l'étiquette Track, opaque, s'arrête à la hauteur de son contenu : à gauche (500 px) sur grand écran et en paysage téléphone, sous une fenêtre de scène (40 % de la hauteur) en portrait, deux colonnes sur tablette. L'étiquette : « TRACK », « Circuit du jour · Canyon », aperçu du tracé (miniature du lot 13), meilleur temps en grand et « 14e sur 212 », quatre médailles en cases, fantôme à battre, **« Courir »** (principal Track), « Revoir le meilleur tour », Salon (“Room”), archives, réglages, aide, « Mon profil Du Jour › » | `homeUi.ts`, `homeLogic.ts`, `accueil.css` |
| **Classement du jour** | 10 lignes dans la carte de l'accueil, coin de la course | page `#board-screen` (maquette `track-classement.html`, ta ligne en moutarde, médaille en pastille et en toutes lettres), cinq lignes à l'accueil, coin compact de la course | `boardScreen.ts`, `boardView.ts`, `boardPanel.ts` |
| **Archives** `#archive` | fenêtre translucide | cadre « ‹ TRACK » : dé, thèmes, jours avec miniatures (inchangées), seuils, « Revoir le meilleur tour » | `archive.ts`, `archiveExtras.ts` |
| **Réglages** `#settings` | fenêtre à onglets (Graphismes, Son, Jeu, Commandes, **Profil**) | cadre « ‹ TRACK » (maquette `track-reglages.html`), mêmes onglets **sans Profil**, curseurs et choix de la charte, **langue** (`choixLangue`), liens « Mon profil Du Jour › » et « Mentions légales » | `settingsUi.ts`, `settings.ts`, `reglages.css` |
| **Aide** `#howto` | fenêtre | cadre « ‹ TRACK », conseils en cartes, schéma des zones tactiles, touches en `kbd` | `howto.ts`, `howtoUi.ts` |
| **Profil** | carte (accueil) et onglet (Réglages) : pseudo, statistiques, copier / charger un code | **supprimé** : lien vers le profil commun du portail `/profil/?retour=<chemin du jeu>` (le profil y met « ‹ TRACK ») | `profilLien.ts`, `apps/portail/src/{profil,retour}.ts` |
| **Pause** `#pause` | fenêtre translucide, bouton ⏸ dans une barre de quatre boutons | dialogue asphalte sur un voile à rayures (maquette `track-pause.html`) : Reprendre, Recommencer, Dernier point de contrôle, Fantôme, Son, Réglages, Comment jouer, Archives, Accueil de Track, « ‹ DU JOUR », Mentions | `index.html`, `arrivee.css` |
| **Arrivée** `#finish` | panneau translucide au milieu de la scène | cadre crème pleine page (maquette `track-arrivee.html`) : « ARRIVÉE », temps en grand, badge de record et écart, autocollant de médaille, rang et « +9 places », envoi et pseudo, ligne à partager, « Recourir » / « Revoir le tour » / « Partager mon temps » / « Accueil de Track », puis sous l'étiquette « Il te reste aujourd'hui » et **« Jeu suivant du jour : Jump › »** (`bouton({ href })`) | `arriveeUi.ts`, `arrivee.css`, `jeuSuivant.ts` |
| **Salon, finale, podium, arrivée de session** | panneaux translucides, compte à rebours dans `#medals` | HUD de course dans la plaque `#medals` (compte à rebours), finale `#finale` en plaque nette, classement de la session, podium et arrivée en cadre ; **« Room »** en anglais | `salonUi.ts`, `salonArrivee.ts`, `salonMode.ts`, `salon.css` |
| **Revoir le meilleur tour** | barre de lecture translucide | plaque asphalte, boutons de 44 px, icônes SVG, textes traduits | `watchUi.ts`, `watch.ts` |
| **Commandes tactiles** | boutons translucides, barre d'actions avec émojis | **même disposition et même comportement** (zones de `touch.ts` inchangées) ; plaques asphalte, « GAZ » en livrée, icônes SVG | `touchUi.ts`, `tactile.css` |
| **HUD** (chrono, point de contrôle, objectif, annonces, vitesse, effets, titre) | texte blanc sur le décor, bandeau de médailles, liste de tous les points de contrôle | **variante A « Plaques en haut »** : voir § 2 | `index.html`, `hud.css`, `main.ts` |
| **Outils internes** | `?debug&tune`, administration et planning (lot 14) | **inchangés** (français), exemptés du test des chaînes en dur ; seul l'habillage du panneau de réglage suit les jetons | voir § 6 |
Chaînes : **450 clés** par langue (base 26, accueil 61 + classement, course et pause et arrivée 129, réglages 152, Salon 82), dont les pluriels ; plus le catalogue commun du socle (composants, erreurs du serveur).

## 2. Les surimpressions de course (variante A « Plaques en haut »)
**Mise en page** (`hud.css`, `index.html`, `main.ts` ; maquettes `track-hud.html` et `track-hud-paysage.html`) : la pause en haut à gauche (`#btn-pause`, 44 px) ; une **colonne centrale** (`#hud-centre`) : le chrono (Barlow Condensed 800 italique, liseré de livrée à droite), la plaque **« PC 3/5 »** collée à l'écart signé (**`+` sur livrée orange** derrière, **`−` sur `--dj-auteur`** devant, temps intermédiaire sur fond route quand il n'y a pas de référence), « vs ton record » (ou le nom du fantôme), puis le titre du circuit ; l'**objectif de médaille** en haut à droite (la première médaille que tu n'as pas : bronze si tu n'as rien, l'auteur si tu les as toutes). Plaques asphalte à bords nets et ombre dure, **ni transparence ni ombre floue**, JetBrains Mono pour les chiffres secondaires ; en pause tout est masqué. Une seule plaque de point de contrôle (le dernier) remplace la liste de tous les points.
- **Lisible sur tous les thèmes** : une plaque opaque ne dépend pas du décor. Captures des **huit thèmes** (stade, rallye, campagne, nuit, ville, canyon, col alpin, banquise), alternées portrait FR / paysage EN : `img/lot-I4-hud-<thème>-portrait-fr.png`, `…-paysage-en.png`.
- **Étroit** : à 360 px, le chrono passe à 24 px et la plaque du point de contrôle commence sous l'objectif (`min-height: 42px` du chrono, `gap: 8px`) ; sous 480 px le mot « Objectif » disparaît. En paysage, le classement du coin descend à 84 px sous le titre. Le Salon (compte à rebours plus large dans `#medals`) range son titre sous la plaque (`body.salon`). Tests de chevauchement en portrait, paysage et 360×640 : `mobile.spec.ts`, `accueil.spec.ts`, `salon.spec.ts`, `watch.spec.ts`, avec la **police large de la CI** (DejaVu Sans) imposée.
- **Pas de perte de fluidité.** Mesure `mesure-lot23.spec.ts` (outil des lots 9 et 23 : temps de fil principal par image, CDP `Performance.getMetrics`, profil mobile 844×390 @2, rendu logiciel SwiftShader, 4 cœurs au repos, 5 min par série) : « avant » = build de `main` (`23b826a`) servi à côté, « après » = ce lot. En ms par image (script entre parenthèses), `×1` = processeur normal, `×4` = ralenti quatre fois ; q0 / q1 / q2 = niveaux de qualité.

| scène | qualité | ×1 avant → après | ×4 avant → après |
|---|---|---|---|
| pilotage | q0 | 3,56 → 3,28 | 11,49 → 12,63 |
| pilotage | q1 | 4,36 → 4,85 | 13,10 → 17,24 |
| pilotage | q2 | 4,22 → 4,37 | 11,83 → 15,08 |
| nuit | q0 | 5,95 → 12,89 (rejoué : 14,78 avant, 13,81 après) | 24,11 → 10,91 |
| nuit | q1 | 4,32 → 5,21 | 14,24 → 15,31 |
| nuit | q2 | 4,93 → 5,32 | 17,12 → 15,54 |
| ville | q0 | 3,96 → 3,26 | 12,40 → 10,79 |
| ville | q1 | 4,37 → 4,44 | 15,97 → 15,27 |
| ville | q2 | 5,69 → 4,02 | 11,42 → 15,30 |

  **Lecture honnête** : à ×1 la différence est de l'ordre de la mesure (moyenne ≈ −0,1 ms hors nuit q0, qui vaut ≈ 14 ms **dans les deux builds** quand on le rejoue : le 5,95 de la première série était un faux départ). À ×4, avec 8 à 29 images par fenêtre de 4,5 s en rendu logiciel, la dispersion d'une série à l'autre est du même ordre que les écarts. Mais **onze cas sur dix-huit montent contre sept qui descendent**, et la scène « pilotage » monte dans cinq cas sur six (jusqu'à +4,1 ms par image à ×4, q1) : **je ne peux pas affirmer, avec cette méthode, qu'il n'y a aucune perte**, seulement qu'elle reste de quelques millisecondes à ×4 et sous le bruit à ×1. Ce qui est garanti par le code : le HUD **n'écrit le DOM que si le texte change** (`setTimerText`, `renderHudTitle`, `renderSplits`), comme avant, et les plaques sont opaques (pas de flou ni de transparence à composer). **À confirmer sur un vrai téléphone** (non fait ici) ; Nathan tranche si l'écart de « pilotage » à ×4 compte.

## 3. L'anglais
- **Catalogues** : `catalogue.<zone>.fr.ts` + `.en.ts` (base, accueil, course, réglages, Salon) — 450 clés par langue, parité vérifiée (`packages/ui/test/catalogues.test.ts`), aucune clé en double avec le catalogue commun. **Nom anglais du Salon : “Room”.** Le catalogue anglais est un **module à part chargé par `import()`** (`i18n.ts`, `chargerLangue`) pour tenir le budget : un joueur en français ne le charge jamais (+6,6 ko compressés, une requête de plus, pour un joueur en anglais seulement).
- **Langue** : lue par `lireLangue` de `@cdj/profile` sur la clé commune `cdj:langue` (langue du navigateur sinon) ; **Réglages › Langue** (`choixLangue` du socle) l'écrit pour toute la plateforme et change tout **sans recharger** (le HTML porte `data-t`, chaque écran construit en JavaScript s'abonne par `onLangue`) ; `<html lang>` et le titre « **Track — Du Jour** » suivent. Test : `langue.spec.ts` (détection et choix, bascule FR ↔ EN sans recharger — un témoin posé sur `window` prouve l'absence de rechargement —, arrivée en anglais).
- **Erreurs du serveur** : `t("erreur." + code)` (catalogue commun du socle), `erreur.local.*` pour le réseau et les délais ; le `message` du serveur n'est plus lu (`messageErreur`). **Formats du socle partout** : `formatTemps`, `formatRang`, `formatDate`, `formatNumeroJour` (`n° 8` / `#8`, `14e` / `14th`, `31,402 s` / `31.402 s`), plus de pluriel ni de date écrits à la main — **sauf** `mmss` / `hhmmss` (décomptes) restés à la main (voir § 8).
- **Ligne à partager** : `lignePartage.*`, mêmes émojis (🥇 🏆 🥈 🥉 ⬜), « Circuit du Jour #8 — … » / « Daily Track #8 — … » ; `share.test.ts` (fr + en, espaces insécables `\u00a0`).
- **Un piège** : `Intl` met des espaces insécables dans les temps (« 31,402 s ») ; les tests les comparent avec `\s` ou `\u00a0`.

## 4. Construction, poids et polices
- **`pagesDuSocle`** (`vite.config.ts`) : `data-t`, `data-t-<attr>`, `data-jeton-*`, préchargement ; option **`absolues`** ajoutée à `packages/ui/outils/vite.ts` pour que les polices soient servies par `/assets/<nom>-<empreinte>.woff2` (`renderBuiltUrl`).
- **Polices partagées avec le portail** : mêmes fichiers à empreinte, un seul chemin `/assets/` pour tout le site ; `partagerPolices` (`scripts/site.mjs`) copie dans `assets/` du portail celles qu'il n'a pas, vérifie qu'un fichier de même nom est identique (sinon l'assemblage échoue) et **retire les copies sous `track/assets/`**. Tests : `apps/portail/test/site.test.ts` (3), `domaine.spec.ts` (le HTML de Track ne référence que `/assets/…`), `perf.spec.ts`.
  - **Aperçu de PR vérifié** (`playdujour-recette--pr-94-…web.app`) : le HTML de Track précharge `/assets/barlow-condensed-latin-800-italic-….woff2` et `/assets/archivo-latin-400-normal-….woff2` ; les sept faces répondent 200 sous `/assets/` avec `cache-control: public, max-age=31536000, immutable` ; `/track/assets/` n'existe pas (404, aucune copie) ; **Archivo 400 a la même empreinte (`C81ewxNO`) dans le portail et dans Track**, donc un joueur venu du portail la trouve en cache. Le second chargement lui-même n'a pas été observé dans un navigateur (en-têtes seulement).
- **Poids** (compressé gzip, `perf.spec.ts`, mesuré sur le build de ce lot) :

| | avant (lot R4) | après | budget |
|---|---|---|---|
| JS du premier chargement | 260,2 ko | **271,5 ko** | — |
| CSS | 3,8 ko | **10,7 ko** | — |
| **JS + CSS** | **264,1 ko** | **282,2 ko** (+18,1) | **≤ 284,1 ko** (+20) |
| dont three.js | 133 ko | 132,8 ko | fichier à part |
| JS hors three | 123,7 ko | 138,7 ko | < 141 ko |
| catalogue anglais (à la demande) | — | 6,6 ko | < 8 ko |
| `tune` (à la demande) | (dans le JS) | 2,2 ko | — |
| polices (7 faces) | — | 139,6 ko | ≤ 150 ko |

  La marge restante est de **1,9 ko** : le lot I5 n'y touche pas (Jump a son propre budget) mais tout ajout à Track doit le savoir. Polices : Archivo Black 400, Archivo 400 et 700, JetBrains Mono 700, Barlow Condensed 600 / 700 italique / 800 italique ; **seules Barlow Condensed 800 italique et Archivo 400 sont préchargées** (le premier écran).

## 5. Garder ce qui marche
- **Golden inchangés** ; **aucun fichier de `packages/sim`, `packages/core`, `packages/clock` touché** (`git diff main --stat` le montre). Rendu 3D, voitures, effets, sons : inchangés.
- **Ids des tests e2e** : conservés quand l'élément existe encore (`#timer`, `#meta`, `#splits`, `#ghostinfo`, `#board`, `#speed`, `#fx`, `#banner`, `#finish`, `#podium`, `#archive`, `#settings`, `#howto`, `#home-*`, `.big`, `.medal`, `.rank`, `.share`, `.actions`, `.restart`, `#finish-next`, `#finish-watch`). **Changés, avec la raison** : `#btn-home` et la pause de `#tbar` supprimés (la pause est `#btn-pause` seule, variante A ; l'accueil est `#pause-home`) ; la fermeture des réglages et de l'aide est la barre de retour du cadre (`.dj-barre-jeu__retour`, `#howto-done`) au lieu de « Fermer » ; `#medals` n'est plus une liste de médailles mais la plaque d'objectif ; les libellés de revêtement et d'effet ne sont plus en capitales dans le DOM (« Herbe », « Super turbo » — la mise en capitales est du style) ; les dates d'archives s'écrivent dans la langue du joueur, les tests lisent `data-date` ; l'onglet **Profil** des réglages et la carte de profil de l'accueil n'existent plus (voir § 8).
- **Tests de chevauchement et de cibles** en portrait (390×844), paysage (844×390) et 360×640 : `accueil.spec.ts`, `mobile.spec.ts`, `salon.spec.ts`, `watch.spec.ts`, `tactile.spec.ts`. **Deux assouplissements, motivés** : l'arrivée et le Salon d'arrivée sont maintenant un cadre qui **défile dans l'étiquette** ; à 360×640 tout ne tient pas d'un coup, donc le test amène chaque bouton à l'écran (`scrollIntoViewIfNeeded`) avant de vérifier qu'il tient dans l'écran, et ne compare plus les plaques de course (cachées derrière le cadre plein écran) à l'arrivée.
- **Clavier** : focus ambre sur asphalte (classe `dj-sombre`, plaques et boutons) ; test dédié dans `accueil.spec.ts` (contour ≥ 3 px).
- **Commandes tactiles** : même disposition et même comportement (`touch.ts` inchangé) ; seules la peau (`tactile.css`, `touchUi.ts`) et les chaînes changent.
- **Captures des lots précédents** : les tests ne réécrivent plus `docs/lots/img/lot-29-*` ni `lot-30-*` (elles montreraient la nouvelle interface sous l'ancien nom) ; les originales sont restaurées.

## 6. Exemptions du test des chaînes en dur
`packages/ui/test/applications.ts` : `apps/web/src` et `apps/web/index.html` y sont (`DOSSIERS_SANS_CHAINES_EN_DUR`) ; **exemptés, chacun avec sa raison écrite** : `tune.ts` (outil de réglage de la conduite `?debug&tune`, outil interne de Nathan, en français), `admin.ts`, `adminBackend.ts`, `adminLogic.ts`, `adminPlan.ts`, `adminPlanning.ts`, `circuitStats.ts` (administration et planning, lot 14, outils internes en français), `verify.ts` (page de vérification des rediffusions, aucun texte d'interface). Seul l'**habillage** du panneau `#tune` suit les jetons (`hud.css`, devant tout, `--z-outil`) : sa mise en page avait été perdue en cours de lot et est réécrite ; il se charge **à la demande** (`import("./tune")` seulement avec `?debug&tune`). Les catalogues de Track sont dans `CATALOGUES` du même fichier (parité fr/en testée).

## 7. Captures
Chromium, **390×844 (portrait) et 844×390 (paysage)**, **français et anglais**, `CAPTURES=1 npx playwright test captures-lot-i4` (dans `apps/web`), rangées dans `docs/plateforme/lots/img/lot-I4-<écran>-<portrait|paysage>-<fr|en>.png` :
- accueil, pause, classement, archives, réglages ;
- arrivée **avec médaille**, **sans médaille**, **avec « Jeu suivant du jour »** ;
- Salon : **course**, **finale**, **résultats** ;
- HUD des huit thèmes (une capture par thème, portrait FR ou paysage EN alternés, 16 images).

**Pas de capture « Salon en attente »** : le Salon n'a pas de salle d'attente ni de statuts PRÊT / EN ATTENTE (il tourne en continu) ; la maquette `track-salon.html` en montre, ce lot ne les invente pas (voir § 8). Les captures portrait du HUD montrent la surimpression « Tourne ton téléphone » (le jeu se joue en paysage) par-dessus la scène.

## 8. Écarts à la charte et aux maquettes (à décider avec Nathan)
0. **Accueil sur la scène 3D** (retour de Nathan après la première version) : la maquette n'en parle pas ; la charte demande des plaques opaques, ce qui est respecté (la scène se voit *autour* des plaques, rien n'est translucide). En portrait téléphone la voiture au départ est à peine visible (la fenêtre de scène est de 40 % de la hauteur) ; à ajuster selon le goût de Nathan.
1. **Accueil plus chargé que la maquette** : il garde les cinq premières lignes du classement et la carte du Salon (le lot 29 les montrait à l'accueil) ; la charte n'en parle pas.
2. **« Revoir le meilleur tour »** (et non « mon ») : c'est le meilleur tour du jour, pas le tien (fantôme du premier ou record local).
3. **Perte de fonction à confirmer — « Changer mon code »** : le jeu ne le propose plus (le profil commun du portail le fait, `/profil/?retour=<chemin du jeu>`). Le **message « code révoqué »** n'existe plus dans les réglages (il reste à l'envoi d'un temps, avec le lien vers le profil). À remettre si Nathan veut les garder dans le jeu.
4. **Pause** : Fantôme et Son s'y trouvent (la barre du haut n'a plus que la pause, variante A) ; la barre du bas garde les cinq boutons tactiles (caméra, point de contrôle, recommencer, graphismes, plein écran).
5. **Salon** : ni salle d'attente ni statuts PRÊT / EN ATTENTE (le Salon n'en a pas) ; le compte à rebours occupe la plaque d'objectif.
6. **Décomptes** `mmss` / `hhmmss` écrits à la main (pas de format du socle pour une durée de décompte) : à ajouter au socle si I5 en a besoin.
7. **Abréviation anglaise du point de contrôle : « CP »** (« PC » en français) ; à valider.
8. **Premier chargement en anglais** : +6,6 ko et une requête (catalogue à la demande), pour tenir le budget de +20 ko.
9. **Marge de budget : 1,9 ko** (§ 4).
10. **Plaque « Tourne ton téléphone »** en portrait : inchangée dans sa logique, habillée aux jetons ; elle cache la scène sur les captures.

## 9. Vérifié / non vérifié
**Vérifié ici (Chromium, `--workers=1`, machine à 4 cœurs)** :
- `npm run typecheck` ; `npm test` : **171 fichiers / 2 252 tests** (sqlite) et **26 fichiers / 364 tests** (libsql) verts, dont golden, catalogues (parité, aucun doublon), chaînes en dur, contrastes, jetons, `construction.test.ts`, `site.test.ts`, `jeuSuivant.test.ts` (profil).
- e2e Chromium : toutes les séries de `apps/web/e2e` lancées une à une après corrections (`accueil`, `mobile`, `share`, `leaderboard`, `demo`, `juice`, `daily`, `conduite`, `tactile`, `cameras`, `futur`, `profil`, `identite-plateforme`, `perf`, `langue`, `domaine`, `salon`, `salon-serveur`, `watch`, `watch-serveur`, `portail*`, `thumbnails`, `planning`, `admin`, `graphismes`, `ghost`, `replay`, `air`, `bas-cotes`, `cuves`, `figures`, `glace`, `largeurs`, `relief`, `surfaces`, `vitesse`) : **verts au dernier passage** de chacune ; une série groupée finale **n'a pas été relancée d'un bloc** après la dernière correction CSS (tout ne tient pas dans une session) : la CI complète le fait.
- Mesures de poids et de fluidité (§ 2 et § 4), captures (§ 7).

**Non vérifié** :
- **Firefox et WebKit** (non installés ici) : le sous-ensemble multi-navigateurs ne s'est pas exécuté en local — la CI le fait.
- **Second chargement des polices dans un navigateur sur l'aperçu** : en-têtes et chemins vérifiés (§ 4), le chargement lui-même pas observé.
- **Fluidité sur un vrai téléphone** ; **rendu validé par Nathan** (critère d'arrêt : avant fusion).
- Les maquettes sont des références : la charte prime en cas d'écart.

**Runs de CI** : voir la PR (le lien et le verdict sont ajoutés ici et dans la description de la PR au fil des runs).
**Tests instables vus** : aucun noté dans les runs locaux (`retries` désactivé en local) ; `tactile.spec.ts` et `salon.spec.ts` sont les plus longs et les plus sensibles à la charge de la machine (un test lancé pendant que la machine était occupée par d'autres exécutions a dépassé son délai, puis passé seul).

## 10. Pour le lot I5 (Jump)
- Reprendre **le même patron** : `creerCadre` (`cadre.ts` : cadre crème, `barreJeu` avec `retour`, étiquette) ; `i18n.ts` (`t`, `lier`, `onLangue`, `setLangue`, `chargerLangue` — un seul module de langue par jeu, catalogue anglais **à la demande**) ; catalogues par zone fr / en réunis pour les tests ; `pagesDuSocle` avec `absolues: true` et `renderBuiltUrl` pour les polices partagées.
- **`jeuSuivant`** : la logique est dans `@cdj/profile` ; Jump n'a plus que son DOM (`apps/jump/src/jeuSuivant.ts`), à passer à `bouton({ href })` comme Track (`apps/web/src/jeuSuivant.ts`).
- **`barreJeu`** accepte `retour?: { texte, ariaLabel, onClick? }` (retour à l'accueil du jeu depuis un sous-écran) ; la vitrine `/ui/` montre l'état « ‹ TRACK ».
- **Profil** : un lien « Mon profil Du Jour › » vers `/profil/?retour=<chemin du jeu>` (`profilLien.ts` ; le portail n'accepte qu'un chemin du site, `apps/portail/src/retour.ts`) — plus de profil dans le jeu.
- **Pièges rencontrés** : un bloc à `overflow:hidden` s'écrase dans un conteneur flex colonne (`.etiquette__corps > * { flex-shrink: 0 }`) ; une règle d'id (`#hud-centre > .hud { position: static }`) écrase `position: relative` d'une classe et décale un `::after` ; `Intl` et les espaces insécables ; Playwright a un `navigator` côté Node (langue de la machine) : un spec qui calcule un texte avec `t()` doit fixer `setLangue("fr", { ecrire: false })` ; sans `?debug`, `window.__cdj` n'existe pas ; ne pas lancer deux exécutions e2e à la fois (ports fixes).
- Les consignes de zone sont dans `apps/web/CLAUDE.md` (« Interface Du Jour (lot I4) »), `packages/profile/CLAUDE.md` (« Jeu suivant du jour (lot I4) ») et `apps/portail/CLAUDE.md` (`?retour=`).
