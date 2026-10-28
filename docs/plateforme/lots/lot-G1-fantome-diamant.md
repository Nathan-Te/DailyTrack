# Lot G1 (plateforme) — le fantôme Diamant, et le bouton fantôme en vue

Branche `ccr-1979a954-nmkwuq`, PR brouillon. Charte `docs/plateforme/identite.md`, **révision 12** (§ 9). Consignes : `apps/api/CLAUDE.md` (« Le fantôme Diamant (lot G1) »), `apps/web/CLAUDE.md`, `apps/jump/CLAUDE.md` (« Plateforme (lot G1) »), `packages/ui/CLAUDE.md`.

## 1. D'où vient le Diamant, et sous quelle forme
| | Track | Jump |
|---|---|---|
| **Source** | la course du **pilote automatique** (`runPilot`), temps de l'auteur du circuit | la rediffusion de **l'auteur** du niveau (la preuve du fichier figé) |
| **Calculable par n'importe quel visiteur ?** | **Oui** : le circuit et le pilote se calculent dans le navigateur (fil de travail, `computeDaily`) ; Track n'a jamais servi la rediffusion de l'auteur | **Non** : la preuve ne quitte pas le serveur (lot R9) |
| **Forme choisie** | la **rediffusion**, calculée dans la page (`CircuitData.diamant`, rejouée par `replayRace` comme tout fantôme) ; **aucune route** | une **trajectoire** : positions échantillonnées, **jamais** des entrées ; `GET /api/jump/fantome-diamant?date=` |
| **Poids** | rien à transférer ; encodage de la rediffusion seulement quand on choisit le Diamant | 30 points/s, 1/64 de tuile, différences en varint signé + base64url : **≈ 2,4 ko pour 30 s** (< 8 000 car. testé) |

Pourquoi pas une route pour Track : exposer la course du pilote par le serveur n'apprendrait rien que la page ne sache déjà calculer, et ajouterait une requête par joueur. **Écart à connaître (décision pour Nathan)** : depuis la bascule du 28/10/2026 (`BASCULE_LOT_35`) le seuil de la médaille Diamant de Track est 0,84 × le temps du pilote, alors que le fantôme est le pilote lui-même : le suivre ne donne donc pas la médaille. Avant le 28/10 les deux coïncidaient. Je n'y ai pas touché (le fantôme « Diamant » est le meilleur tour de référence, pas le seuil).

## 2. Déblocage et serveur (Jump)
- Le **jour même** : il faut un joueur actif avec un **résultat classé** ce jour-là, sinon **`403 ghost_locked`** (liste unique `codesErreur.ts`, `codes-erreur.md`, catalogue commun : « Finis le niveau pour débloquer le fantôme Diamant. » / “Finish the level to unlock the Diamond ghost.”). Un **jour passé** est libre.
- **Cache** : trajectoire calculée une fois par instance, jour et règle (version de simulation et de générateur), jamais écrite ; réponse `Cache-Control: private` + `Vary: X-Player-Id` le jour même. Lectures plafonnées par adresse et par joueur.
- **Track** : même règle côté jeu (`diamantOuvert` : jour passé libre, jour même après un meilleur temps local) ; elle n'a pas de contrepartie serveur (rien n'est servi).
- Coût : **+1 requête par joueur Jump et par jour** (`JUMP_PLAYER` 14 requêtes, 1 293 lignes lues ; `platformBudget.test.ts` passe de 13 à 14 — le cas du lot I3, le comptage est celui du nouvel appel). Track : 0.

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
| Track JS + CSS | 293 581 | 294 480 | 294 000 → **295 024** (+1 024, sur les 2 048 autorisés) |
| Track JS / hors three.js | 281 823 / 148 166 | 282 610 / 148 953 | 282 200 → **283 224** / 148 500 → **149 524** |
| Track anglais · fil des circuits | 7 935 · 29 422 | 7 996 · 29 810 | 8 000 · 30 000 (inchangés) |
| Jump JS + CSS | non remesuré (364 021 avant le lot 53) | 372 676 | 378 490 (inchangé, marge 5 814) |
| Portail, premier chargement | 32 210 | 32 281 | 32 768 (inchangé, marge 487) |

Les textes `fantome.*`, l'icône et le bouton sont **hors** du portail (icône à part de `TRACES`, bouton dans `fantome.ts`, textes dans les catalogues des jeux) : dans le socle commun, le portail dépassait son plafond (30 799). Track n'a pas eu besoin des 2 048 o entiers.

## 6. Vérifié / non vérifié
**Vérifié** : tests unitaires de la trajectoire (échantillonnage, aller-retour, interpolation, refus des entrées mal formées) ; tests d'API sur SQLite et libSQL (refusé avant d'avoir fini, accepté après, libre un jour passé, ni entrées ni preuve ni `replay`, cache privé, dates et méthode, `codesErreur`) ; `productionSite.test.ts` (R9) ; cycle et déblocage (Track et Jump) ; `smoke` contre un serveur local (ligne Diamant) ; e2e étendus (**aucun spec nouveau**) : `plein-ecran`, `hud-compact`, `mobile` (Track) ; `plein-ecran`, `hud-compact`, `carnage`, `profil-commun` (Jump) — bouton visible, 44 px, sans chevauchement, hors zone centrale à 844 × 390 et 740 × 360, chaque appui passe au fantôme suivant, FR et EN ; captures paysage FR et EN (outils `captures-lot-g1`, `CAPTURES=1`).
**Non vérifié** : le Diamant de Jump contre le **vrai** Turso (pas de `sqld` ici) ; le rendu sur un téléphone réel ; le coût réel des lectures du Diamant en production (modèle : +1 requête). `npm run verifier` : typecheck, unitaires (SQLite 164 fichiers, libSQL 39), e2e Track (26 specs) et e2e Jump (46 tests) verts, **sauf un** : `horloge.spec.ts` « mort avant le premier point de passage » (Jump) — **il échoue à l'identique sur `main` (`b4b765a`) sans ce lot** (vérifié en remettant l'arbre propre : le joueur qui tient l'entrée 3 000 pas ne meurt pas sur le niveau du 20/10/2026 : `deaths` 0 au lieu de 1) ; hors zone du lot, noté ici et laissé à Nathan (règle d'arrêt).

## 7. Décisions laissées à Nathan
1. Le fantôme Diamant de Track est la course du pilote, pas le seuil de la médaille (0,84 × pilote depuis le 28/10).
2. Teintes : menthe (Track) et vert (Jump), faute de pouvoir garder le bleu Diamant sans le confondre avec le fantôme de ton essai.
3. `JUMP_PLAYER` à 14 requêtes (plafond du test relevé de 13 à 14).
4. Modification de `docs/plateforme/identite.md` (révision 12 et § 9, ligne fournie par la demande) ; à relire. Le fichier joint à la demande portait d'autres numéros de révision (10 et 11 : nouveautés et administration) que celui du dépôt : seule la ligne 12 et la phrase du § 9 ont été reprises.
5. **« Revoir » le Diamant (Track) non fait** : le classement du jour de Track n'a pas de ligne « Diamant » à laquelle l'attacher. Un `?watch=diamant` (le lecteur existant, la course du pilote) coûterait ≈ 1 ko du premier chargement (reste 1 024 o sur les 2 048 autorisés) ; à décider.

## 8. CI
Run de la PR (`e064b8b`) : https://github.com/Nathan-Te/DailyTrack/actions/runs/40770624941 — scope, zones, unit (4/4), api-image, e2e-pr (2/4, 3/4, 4/4) verts ; e2e-pr (1/4) rouge **seulement** pour `horloge.spec.ts` « mort avant le premier point de passage » (Jump), le même test que la CI de `main` (`b4b765a`, run 40746424026, job « e2e-parts (jump chromium 1/1) ») : échec déjà là, hors de ce lot (règle d'arrêt : noté, pas corrigé, à trancher par Nathan).

## 9. Tickets à ouvrir
- **Fantôme du premier** : le servir comme une **trajectoire** (≈ 2,4 ko, sans entrées, cache privé par jour) au lieu de la rediffusion complète, sur le modèle du Diamant ; moins lourd et sans aucune entrée sur le réseau. Format à décider avec le lot du classement.
- Un lecteur de rediffusion pour Jump (aujourd'hui « Revoir » n'existe que pour Track).
- Mémoriser le choix de fantôme de Track entre deux pages (aujourd'hui : la page).

## Pour les joueurs
- [Track] Débloquez le fantôme Diamant en finissant le circuit. // Unlock the Diamond ghost by finishing the circuit.
- [Jump] Débloquez le fantôme Diamant en finissant le niveau. // Unlock the Diamond ghost by finishing the level.
