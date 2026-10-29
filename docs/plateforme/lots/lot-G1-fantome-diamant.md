# Lot G1 (plateforme) — le fantôme Diamant, et le bouton fantôme en vue

Branche `ccr-1979a954-nmkwuq`, PR brouillon. Charte `docs/plateforme/identite.md`, **révision 12** (§ 9). Consignes : `apps/api/CLAUDE.md` (« Le fantôme Diamant (lot G1) »), `apps/web/CLAUDE.md`, `apps/jump/CLAUDE.md` (« Plateforme (lot G1) »), `packages/ui/CLAUDE.md`.

## 1. D'où vient le Diamant, et sous quelle forme
| | Track | Jump |
|---|---|---|
| **Source** | la course du **pilote automatique** (`runPilot`), temps de l'auteur du circuit | la rediffusion de **l'auteur** du niveau (la preuve du fichier figé) |
| **Calculable par n'importe quel visiteur ?** | **Oui** : le circuit et le pilote se calculent dans le navigateur (fil de travail, `computeDaily`) ; Track n'a jamais servi la rediffusion de l'auteur | **Le niveau du jour généré par la page : oui** (sa preuve est dans le navigateur) ; **un niveau figé publié : non** (la preuve ne quitte pas le serveur, lot R9) |
| **Forme choisie** | la **rediffusion** du pilote, calculée dans la page, **rejouée plus vite** pour arriver au temps du Diamant (`vitesse` ≈ 1,09) ; **aucune route** | une **trajectoire** (positions, **jamais** des entrées) **étirée** jusqu'au temps du Diamant ; calculée dans la page quand elle a la preuve, sinon `GET /api/jump/fantome-diamant?date=` |
| **Poids** | rien à transférer ; encodage de la rediffusion seulement quand on choisit le Diamant | 30 points/s, 1/64 de tuile, différences en varint signé + base64url : **≈ 2,4 ko pour 30 s** (< 8 000 car. testé) |

Pourquoi pas une route pour Track : exposer la course du pilote par le serveur n'apprendrait rien que la page ne sache déjà calculer. **Dans les deux jeux, le fantôme Diamant finit au seuil de la médaille Diamant** (retour de Nathan : « en finissant en même temps que lui, aucune médaille ») : le suivre jusqu'au bout, c'est le Diamant. Affichage seul : la course du joueur n'en voit rien.

## 2. Déblocage et serveur (Jump)
- **Dans la page (Jump et Track)** : débloqué **dès l'arrivée sur cet appareil** (un meilleur temps du jour), sans pseudo ni classement (retour de Nathan : le Diamant de Jump restait verrouillé après une arrivée non envoyée). Un jour passé est libre.
- **Par le serveur (Jump, niveau figé sans preuve)** : le **jour même**, un joueur actif avec un **résultat classé** ce jour-là, sinon **`403 ghost_locked`** (liste unique `codesErreur.ts`, `codes-erreur.md`, catalogue commun : « Finis le niveau pour débloquer le fantôme Diamant. » / “Finish the level to unlock the Diamond ghost.”). Un **jour passé** est libre.
- **Cache** : trajectoire calculée une fois par instance, jour et règle (version de simulation et de générateur), jamais écrite ; réponse `Cache-Control: private` + `Vary: X-Player-Id` le jour même. Lectures plafonnées par adresse et par joueur.
- **Track** : même règle côté jeu (`diamantOuvert` : jour passé libre, jour même après un meilleur temps local) ; elle n'a pas de contrepartie serveur (rien n'est servi).
- Coût : **aucune requête de plus dans le cas courant** (le Diamant de Jump se calcule dans la page quand elle a généré le niveau du jour) ; la route ne sert qu'un niveau figé publié sans preuve (archive, ou le jour même après une mise en production ce jour-là). `JUMP_PLAYER` reste à 13. Track : 0.

## 3. Dans les jeux
- **Choix « Diamant »** : pastille et teinte `--dj-diamant` (`#4FC3DC`). Teinte du fantôme : **Track** menthe `0x3de8c8` (la voiture fantôme, translucide, nette) ; **Jump** vert `0x8dff80` (le bleu Diamant à 190° était trop proche du cyan du fantôme de ton essai, 196°). Aucun dégradé.
- **Cycle** : Track ton record → premier → joueur devant → **Diamant** → aucun ; Jump le tien → premier → **Diamant** → aucun. Un choix absent (pas de premier, Diamant verrouillé) est sauté. Même cycle, même ordre pour la touche **G**, le bouton en partie, l'entrée de la pause et l'accueil ; mémorisation : celle de la pause de chaque jeu (Track : la page ; Jump : `jump:fantome`, valeurs `1` / `0` / `premier` / `diamant`).
- **Avant le déblocage** : « Finis le niveau pour le débloquer » grisé sur l'accueil et dans la pause ; le bouton saute le Diamant. **Première arrivée du jour** qui le débloque : « Fantôme Diamant débloqué ».
- **Revoir** : Track le garde où il existe un lecteur (spectateur, rien de plus) ; Jump n'a pas de lecteur : le fantôme suffit.
- **Un fantôme ne touche jamais la simulation** : Track le rejoue avec `replayRace` ; Jump interpole la trajectoire (`trajectoirePose`, linéaire) et ne fait que dessiner. Golden et rediffusions inchangés.

## 4. Le bouton fantôme en vue (révision 12)
Icône `fantome` au trait dans le socle (`iconeFantome`, `boutonFantome`), 44 px, nom lu « Fantôme : {nom} » / “Ghost: {name}” mis à jour à chaque appui.
- **Jump** : en haut à gauche, juste après le plein écran (`#ghostbtn`) — `img/lot-G1-jump-hud-{fr,en}.png`, course avec le Diamant `img/lot-G1-jump-diamant-{fr,en}.png`.
- **Track** : dans le groupe de droite, devant l'objectif de médaille (`#btn-ghost`) ; à 740 × 360 la caméra et le fantôme sont côte à côte — `img/lot-G1-track-hud-paysage-{fr,en}.png` (844 × 390), `img/lot-G1-track-hud-compact-{fr,en}.png` (740 × 360), course avec le Diamant `img/lot-G1-track-diamant-{fr,en}.png`, accueil `img/lot-G1-track-accueil-{fr,en}.png`.
- Caché en petit portrait (comme le plein écran) et, pour Track, en spectateur. Centre libre, bande du haut inchangée.

## 5. Budgets (`docs/plateforme/budgets.md`, « Lot G1 »)
| | avant (`main`, lot 53 compris) | après (fusion) | plafond |
|---|---|---|---|
| Track JS + CSS | 293 581 | 294 553 | 294 000 → **295 024** (+1 024, sur les 2 048 autorisés) |
| Track JS / hors three.js | 281 823 / 148 166 | 282 683 / 149 026 | 282 200 → **283 224** / 148 500 → **149 524** |
| Track anglais · fil des circuits | 7 935 · 29 422 | 7 993 · 29 833 | 8 000 · 30 000 (inchangés) |
| Jump JS + CSS | 371 110 (lot 28 compris) | 374 103 | 378 490 (inchangé, marge 4 387) |
| Portail, premier chargement | 32 210 | 32 281 | 32 768 (inchangé, marge 487) |

Les textes `fantome.*`, l'icône et le bouton sont **hors** du portail (icône à part de `TRACES`, bouton dans `fantome.ts`, textes dans les catalogues des jeux) : dans le socle commun, le portail dépassait son plafond (30 799). Track n'a pas eu besoin des 2 048 o entiers.

## 6. Vérifié / non vérifié
**Vérifié** : tests unitaires de la trajectoire (échantillonnage, aller-retour, interpolation, refus des entrées mal formées) ; tests d'API sur SQLite et libSQL (refusé avant d'avoir fini, accepté après, libre un jour passé, ni entrées ni preuve ni `replay`, cache privé, dates et méthode, `codesErreur`) ; `productionSite.test.ts` (R9) ; cycle et déblocage (Track et Jump) ; `smoke` contre un serveur local (ligne Diamant) ; e2e étendus (**aucun spec nouveau**) : `plein-ecran`, `hud-compact`, `mobile` (Track) ; `plein-ecran`, `hud-compact`, `carnage`, `profil-commun` (Jump) — bouton visible, 44 px, sans chevauchement, hors zone centrale à 844 × 390 et 740 × 360, chaque appui passe au fantôme suivant, FR et EN ; captures paysage FR et EN (outils `captures-lot-g1`, `CAPTURES=1`).
**Non vérifié** : le Diamant de Jump contre le **vrai** Turso (pas de `sqld` ici) ; le rendu sur un téléphone réel ; la répartition réelle des nouvelles médailles (aucun export de joueurs). **Reproduit puis corrigé** (29/10) : le Diamant de Jump restait verrouillé après une arrivée non classée (essai local refusé en 409 par le serveur de recette local) — il se débloque maintenant à l'arrivée ; la médaille de Track ratée en finissant avec le fantôme (le 29/10 avait les seuils du lot 35, fantôme = pilote) — le fantôme finit maintenant au seuil. `npm run verifier` (après fusion de `main`, lots 53 et 28 compris) : typecheck, unitaires (SQLite 228 fichiers, libSQL 40), e2e Track (31 specs) verts ; e2e Jump : deux attentes changées par le nouveau comportement (`hud-compact` : la ligne « Finis le niveau » existe sans serveur ; `profil-commun` : plus de lecture du Diamant), relancées vertes.

## 7. Décisions laissées à Nathan
1. Le fantôme Diamant de Track est le pilote **accéléré** (≈ 1,09 ×) pour finir au seuil ; il roule donc un peu plus vite que ne le permet la physique (même trajectoire). Sinon : le retirer de Track.
2. Teintes : menthe (Track) et vert (Jump), faute de pouvoir garder le bleu Diamant sans le confondre avec le fantôme de ton essai.
3. Le Diamant de Jump calculé dans la page : rien de plus que ce qu'un visiteur calcule déjà (la preuve du niveau généré est dans le navigateur) ; la route n'est plus qu'un repli.
4. Modification de `docs/plateforme/identite.md` (révision 12 et § 9, ligne fournie par la demande) ; à relire. Le fichier joint à la demande portait d'autres numéros de révision (10 et 11 : nouveautés et administration) que celui du dépôt : seule la ligne 12 et la phrase du § 9 ont été reprises.
5. **« Revoir » le Diamant (Track) non fait** : le classement du jour de Track n'a pas de ligne « Diamant » à laquelle l'attacher. Un `?watch=diamant` (le lecteur existant, la course du pilote) coûterait ≈ 1 ko du premier chargement (reste 1 024 o sur les 2 048 autorisés) ; à décider.

## 10. Médailles assouplies, sans date (demandes de Nathan des 28 et 29/10)
- **Track** : le Diamant passe de 0,84 à **0,92 × le temps du pilote** ; or, argent et bronze gardent leurs écarts (×1,045, ×1,07, ×1,13 du Diamant) : or 0,961, argent 0,984, bronze 1,040 (rouler comme le pilote rapporte le bronze). **Liées à la version du générateur, v19** (`GENERATOR_MEDAILLES_G1` ; mêmes circuits que la v18, seuls l'identifiant `-g19` et les médailles changent : golden comparé, ids seulement).
- **Jump** : le Diamant à **105 %** du temps de l'auteur (la preuve, que personne ne bat), or 115 %, argent 137 %, bronze 170 % (avant : 100, 110, 130, 160). **Liées à la version des niveaux, v12** (`MEDAILLES_ASSOUPLIES_VERSION`, celle du lot 28, pas encore servie) ; golden v12 : **les médailles seulement** changent (6 dates : niveau, preuve et empreinte identiques) ; v3 à v11 intacts.
- **Aucune date dans le code** : à la mise en production, le registre des jours de Track et les niveaux figés de Jump gardent les médailles des jours servis ; **le lendemain** (jour de bascule) et les suivants prennent les nouvelles, tout seuls — comme les circuits et les niveaux. Recalibrer plus tard = de nouveaux facteurs pour une nouvelle version, jamais une date.
- **À savoir** : la médiane des meilleurs temps de Track du 22/10 était à 0,90 du pilote : à 0,92 le Diamant devient courant (cible du lot 35 : 5–10 %) et débloque plus vite les voitures du Garage. Les pourcentages de Jump sont choisis sans données de joueurs. Deux constantes à ajuster (`MEDAL_FACTORS_G1`, `MEDAL_PERCENT_G1`).
- Hors du périmètre d'origine, ajouté par décision de Nathan.

## 8. CI
Runs de la PR : voir le résumé de `npm run attendre-ci` dans la PR.

## 9. Tickets à ouvrir
- **Fantôme du premier** : le servir comme une **trajectoire** (≈ 2,4 ko, sans entrées, cache privé par jour) au lieu de la rediffusion complète, sur le modèle du Diamant ; moins lourd et sans aucune entrée sur le réseau. Format à décider avec le lot du classement.
- Un lecteur de rediffusion pour Jump (aujourd'hui « Revoir » n'existe que pour Track).
- Mémoriser le choix de fantôme de Track entre deux pages (aujourd'hui : la page).

## Pour les joueurs
- [Track] Débloquez le fantôme Diamant en finissant le circuit : il arrive au temps de la médaille Diamant. // Unlock the Diamond ghost by finishing the circuit: it finishes at the Diamond medal time.
- [Jump] Débloquez le fantôme Diamant en finissant le niveau : il arrive au temps de la médaille Diamant. // Unlock the Diamond ghost by finishing the level: it finishes at the Diamond medal time.
- [Track] Les médailles sont plus faciles à décrocher sur les nouveaux circuits. // Medals are easier to earn on new circuits.
- [Jump] Les médailles sont plus faciles à décrocher sur les nouveaux niveaux. // Medals are easier to earn on new levels.
