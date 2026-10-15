# Lot 4 — Les morceaux et le solveur (DailyJump)

## À tester
- **La galerie : `https://nathan-te.github.io/DailyTrack/b/claude-dailyjump-modules-solver-5zpx98/jump/?modules`** (au téléphone aussi : la page défile). Pour chaque morceau : intention, étiquettes, et pour chaque variante l'exigence (●○○○○ 1/5 … 5/5), les durées de la solution (départ arrêté / lancé), **Jouer** et **Regarder**. « Entrée : À l'arrêt / En élan » change les liens (en élan, un couloir de lancement de 5 tuiles est ajouté devant le palier).
- Trois morceaux à essayer d'abord : **`?module=cheminee&variante=1`** (le mural de base), **`?module=ressorts-trous&variante=0`** (les ressorts enchaînés au-dessus des pics), **`?module=cheminee-scie&variante=0`** (le plus exigeant : 5/5). Ajouter **`&solution`** pour regarder la solution stockée (R la relance), **`&entree=elan`** pour l'entrée lancée.
- À l'arrivée d'un morceau : bandeau avec ton temps, celui de la solution (« couloir compris » en élan), le meilleur du jour, les morts, **Recommencer** et **Morceau suivant** (ordre de la galerie). Mémoire, fantôme, carnage et taches marchent par morceau.
- § 0 : `?scenario=essai` — **sauter par-dessus un fanion le prend** maintenant (le fanion a une porte pâle sur toute la hauteur libre de sa colonne) ; mourir juste après fait reprendre dessus, au sol.

## Le format en bref
Un fichier texte par morceau, `packages/jump-sim/modules/<id>.txt` (format complet en tête de `src/modules.ts`). Exemple :
```
id: cheminee-scie
intention: Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment.
etiquettes: mural scie vertical
paliers: 17 6                       ← rangées du sol des paliers d'entrée et de sortie (gabarit)
repeter: haut rangees 10-10         ← la rangée 10, dessinée une fois, apparaît `haut` fois
variante: haut=1 cycle=360
variante: haut=1 cycle=480
variante: haut=1 cycle=420
variante: haut=2 cycle=480
grille:
#########.............
… (20 rangées)
######################

scie va-et-vient o {cycle} aller-retour 10,2 10,8      ← `{cycle}` vient de la variante ; `c',r` = dernière copie d'une plage
```
**Variantes déclaratives** : une plage `repeter` (colonnes ou rangées) est dessinée une fois, la variante donne son nombre de copies (0 la retire) ; `{nom}` dans le bloc annexe. **`buildModule(id, variante)`** (pur) construit le niveau : une colonne d'appel (départ `S`), le morceau (**une section** : ses scies démarrent à l'entrée), une colonne de sortie (arrivée `F` au sol) ; identifiant `module:<id>:<variante>`. Paliers vérifiés (≥ 3 tuiles de sol plein au bord, 4 rangées libres, aucune scie), hauteur ≤ 30. **Entrée arrêt** = immobile au départ ; **entrée élan** = au départ, au sol, à pleine vitesse (drapeau « élan », bit 2 des drapeaux de départ de la rediffusion du lot 3). **Sortie toujours en élan** : au sol, à `runSpeed`, en franchissant le bord droit du palier de sortie (vérifié pour chaque solution).

## Le catalogue : 27 morceaux, 74 variantes, 148 solutions
| id | intention | étiquettes | variantes | durée arrêt/élan (s) | exigence |
|---|---|---|---|---|---|
| `ascenseur` | Franchir un fossé où une scie monte et descend : sauter quand elle est en bas. | scie | trou=1 cycle=240 · trou=1 cycle=180 · trou=2 cycle=240 | 2,60/2,57 · 2,59/2,57 · 2,69/2,66 | 2 · 1 · 1 |
| `cheminee-pics` | Monter une cheminée dont chaque mur porte une plaque de pics : choisir le bon mur à chaque hauteur. | mural precision vertical | plaque=1 · plaque=2 | 2,87/2,77 · 3,10/3,06 | 4 · 4 |
| `cheminee-scie` | Monter une cheminée large pendant qu'une scie va et vient dans sa partie haute : la croiser au bon moment. | mural scie vertical | haut=1 cycle=360 · haut=1 cycle=480 · haut=1 cycle=420 · haut=2 cycle=480 | 2,72/2,62 · 2,80/2,71 · 2,74/2,67 · 2,88/2,82 | 5 · 4 · 4 · 4 |
| `cheminee` | Monter une cheminée en sautant d'un mur à l'autre, puis sortir par le haut. | mural vertical | large=1 haut=1 · large=2 haut=3 · large=2 haut=6 | 2,64/2,58 · 3,02/2,96 · 3,21/3,13 | 5 · 4 · 4 |
| `demi-tour` | Sauter contre le bas d'un mur hérissé, rebondir en arrière sur une corniche, puis repartir par-dessus le mur. | mural | ecart=1 · ecart=2 · ecart=3 | 2,84/2,83 · 2,99/3,13 · 3,33/3,05 | 2 · 3 · 5 |
| `descente` | Se laisser tomber de corniche en corniche jusqu'en bas, sans freiner. | respiration | large=1 · large=2 · large=4 | 2,42/2,38 · 2,88/2,83 · 3,78/3,75 | 1 · 1 · 1 |
| `escalier-friable` | Gravir un escalier de blocs friables suspendu au-dessus du vide, d'une seule traite. | friable vertical | large=1 · large=2 | 2,87/2,75 · 3,20/3,11 | 4 · 1 |
| `escalier` | Gravir un escalier de grandes marches, un bond par marche, sans casser son élan. | respiration vertical | large=1 · large=2 · large=3 | 2,65/2,57 · 2,98/2,92 · 3,38/3,29 | 3 · 2 · 2 |
| `grande-scie` | Sauter un trou sous une grande scie : un petit saut passe, un grand s'y jette. | scie precision | trou=1 · trou=2 · trou=3 | 2,65/2,57 · 2,70/2,66 · 2,78/2,75 | 2 · 2 · 5 |
| `iles-friables` | Sauter d'îlot friable en îlot friable, chacun un peu plus haut, sans jamais s'y poser longtemps. | friable precision | ecart=1 · ecart=2 | 2,78/2,75 · 3,27/3,20 | 2 · 2 |
| `lucarne` | Passer d'un saut par la petite fenêtre de deux murs minces. | precision | fenetre=2 · fenetre=1 | 2,98/2,92 · 2,97/2,92 | 1 · 2 |
| `mur-friable` | Monter une cheminée au-dessus d'un puits de pics : son mur gauche s'effrite, pas question de traîner. | mural friable vertical | haut=1 · haut=3 · haut=5 | 2,40/2,40 · 2,58/2,51 · 2,63/2,66 | 2 · 3 · 4 |
| `mur-seul` | Remonter un grand mur tout seul, saut mural après saut mural, en revenant vers lui. | mural vertical | haut=1 · haut=3 · haut=5 | 2,05/2,01 · 2,51/2,45 · 2,98/2,90 | 1 · 1 · 1 |
| `petits-trous` | Sauter trois petits trous en courant, sans lever le pied de l'accélérateur. | respiration | trou=1 · trou=2 · trou=3 | 2,95/2,92 · 3,22/3,20 · 3,50/3,48 | 2 · 1 · 2 |
| `piliers` | Bondir de pilier en pilier, chacun large d'une seule tuile, au-dessus du vide. | precision | ecart=1 · ecart=2 | 2,77/2,75 · 3,29/3,20 | 1 · 2 |
| `plafond-pics` | Courir sous un plafond hérissé et enjamber les pics du sol par petits sauts : un grand saut s'y empale. | precision | pics=1 · pics=2 · pics=3 | 3,15/3,11 · 3,42/3,38 · 3,67/3,66 | 2 · 2 · 3 |
| `plaine` | Courir sur un plat et monter une marche basse : de quoi reprendre son souffle. | respiration | long=6 · long=12 · long=18 | 2,69/2,66 · 3,24/3,20 · 3,78/3,75 | 1 · 1 · 1 |
| `pont-friable` | Traverser un pont qui s'effondre derrière soi, sans jamais s'arrêter. | friable | long=1 · long=5 · long=9 | 2,60/2,57 · 2,97/2,92 · 3,33/3,29 | 1 · 1 · 1 |
| `puits` | Se laisser glisser contre le mur d'un puits pour ne pas manquer la porte de sortie, au-dessus des pics du fond. | mural vertical | large=1 prof=1 · large=2 prof=4 · large=1 prof=7 | 2,36/2,23 · 2,48/2,37 · 2,62/2,55 | 1 · 1 · 1 |
| `quinconce` | Passer entre des scies en quinconce : sauter celles du sol, rester sous celles du haut. | scie precision | ecart=2 · ecart=3 | 3,42/3,38 · 3,88/3,84 | 1 · 2 |
| `ressort-mur` | Prendre le ressort au pied d'un mur hérissé et retomber sur son sommet, sans frôler les pics. | ressort vertical | ecart=1 · ecart=2 | 2,07/2,02 · 2,16/2,11 | 1 · 1 |
| `ressort-plafond` | Le ressort lance sous un plafond à pics : arriver assez vite pour le dépasser et se poser sur la corniche. | ressort precision | bord=1 · bord=2 · bord=3 | 2,45/2,38 · 2,56/2,77 · 3,09/3,01 | 1 · 1 · 2 |
| `ressorts-trous` | Rebondir de ressort en ressort au-dessus d'une fosse à pics, sans lâcher la course. | ressort precision | ecart=1 · ecart=2 | 4,24/4,20 · 4,52/4,47 | 1 · 5 |
| `saut-long` | Prendre tout son élan et franchir un grand trou d'un seul saut. | precision | trou=5 · trou=6 · trou=7 | 2,97/2,92 · 3,06/3,02 · 3,15/3,11 | 1 · 1 · 2 |
| `scie-ronde` | Passer sous un bloc suspendu pendant que la scie qui en fait le tour est au-dessus. | scie | cycle=240 · cycle=180 · cycle=150 | 2,83/2,75 · 2,86/2,80 · 2,78/2,73 | 2 · 3 · 1 |
| `scie-sol` | Sauter au bon moment par-dessus deux scies qui font l'aller-retour au sol d'un couloir bas, en sens contraires. | scie | cycle=300 · cycle=240 · cycle=180 | 2,77/2,75 · 2,78/2,75 · 2,77/2,75 | 2 · 1 · 1 |
| `tunnel` | Traverser un tunnel bas en courant : un saut s'y cognerait la tête. | respiration | long=4 · long=10 · long=16 | 2,67/2,64 · 3,23/3,18 · 3,77/3,74 | 1 · 1 · 1 |

Étiquettes : mural 7 · précision 10 · vertical 9 · scie 6 · friable 4 · ressort 3 · respiration 5 (4 « respiration » toutes variantes ≤ 2 : `plaine`, `petits-trous`, `descente`, `tunnel` ; `escalier` monte à 3). Exigence des variantes : **1 → 35 · 2 → 20 · 3 → 5 · 4 → 9 · 5 → 5**. Durées des solutions : 2,01 à 4,52 s (moyenne 2,93 s). Rejeu : ≈ 750 ns par pas. Table détaillée (gigue et raccord par entrée) : `npm run measure:modules -w @cdj/jump-sim`.

## Le solveur
`npm run solve:modules -w @cdj/jump-sim` (`tools/`, hors de `src/`, jamais en production ni dans `npm test`). Repris du chercheur du lot 2 : faisceau sur des actions grossières (direction × relâché / tenu / réappuyé), mais **guidé par une carte de distances** (parcours en largeur depuis l'arrivée : plus de points de passage écrits à la main), but = arrivée au sol à pleine vitesse. Trois recherches par solution (paquets de 4, 6 et 8 pas, à progression égale la suite la plus simple d'abord), puis **durcissement** : parmi les solutions **au plus 2 % plus lentes** que la plus rapide trouvée, retouches (décaler un changement de commande, une commande entière, en supprimer une inutile) gardées si elles résistent mieux à la gigue (48 tirages propres). **Incrémental** : chaque solution porte l'empreinte de sa grille ; `JUMP_SIM_VERSION` et `EXIGENCE_VERSION` dans le fichier. Solutions : `modules/solutions.json` (rediffusions base64url) ; `src/catalog.ts` est généré (textes et solutions ; test « relancer solve:modules »).
**Temps du catalogue complet : 264 s** sur 4 fils (1 051 s de calcul, Node 22, 2,8 GHz) ; une retouche d'un morceau : 10 à 40 s.

## L'exigence
Pour chaque solution : **gigue** — chaque changement de commande décalé au hasard de −k à +k pas (k = 1, 2, 3 ; indépendamment ; l'ordre des commandes est gardé, chacune dure au moins un pas ; 200 tirages à graine fixe par k ; la dernière commande tenue 2 s de plus ; réussite = arriver sans mourir) ; **raccord** (élan) — la solution rejouée depuis 24 départs décalés de −192 à +192 unités. **Note** (`exigenceOf`) : 0 = **« au pas près »** si ±1 réussit moins d'une fois sur deux (ou le raccord) ; sinon 1 si ±3 ≥ 90 %, 2 si ±3 ≥ 60 %, 3 si ±2 ≥ 60 %, 4 si ±1 ≥ 80 %, 5 sinon ; +1 si le raccord échoue plus d'une fois sur dix. Exigence d'une variante = la plus haute de ses deux entrées. **Aucune variante retenue n'est au pas près** (test).
**Adoucis ou retirés** en cours de route (mesures du solveur) : `escalier` (contremarches de 2 au lieu de 7 marches de 1 : au pas près), les **cheminées** (`cheminee`, `cheminee-pics`, `cheminee-scie`, `mur-friable` : couloir d'entrée bas, le mur gauche commence juste au-dessus, sinon il fallait remonter seul le mur droit), `plafond-pics` (plafond relevé d'une rangée), `ressorts-trous` (ressorts de 3 tuiles, espacés de 11–12), `cheminee-scie` (scie dans le haut, cycles 360–480 au lieu de 180–300), `demi-tour` (sommet plus bas, pics sur 3 rangées), `ascenseur` (scie qui monte plus haut : elle ne gênait jamais) ; **retirés** : `lucarne` fenêtre d'une rangée, `cheminee-pics` plaque de 3, `ressorts-trous` écart 0 et 3, `mur-friable` cheminée de 3 de large.

## § 0 : un point de passage se prend en franchissant sa colonne
Le centre du personnage, vivant à la fin du pas, qui passe la colonne d'un `C` vers la droite le prend, à n'importe quelle hauteur (le dernier franchi l'emporte ; un seul `C` par colonne, `parseLevel` refuse le reste). Reprise sur le fanion, au sol ; les vagues du carnage partent au même pas. **`JUMP_SIM_VERSION` = 3.** **Essai : temps de l'auteur inchangé, 2 595 pas = 21,625 s** — re-résolu (`SOLVE=1`) : mêmes commandes au pas près (la solution ne meurt jamais, la règle ne change que le point de reprise). Golden régénérés et pourquoi : la référence de l'essai change d'empreinte (le champ `checkpoint` des états : deux fanions sautés sont maintenant pris), les rediffusions de référence changent d'octet de version (2 → 3) et les essais fictifs qui meurent reprennent ailleurs (empreintes, et `ESSAI_SOLUTION_CODE`) ; **les trajectoires du lot 1 n'ont pas bougé** (mêmes empreintes). Une mémoire de la version 2 (meilleur essai, vies, morts) est purgée au chargement (test avec une vraie rediffusion v2). La démo du carnage change aussi : le test e2e regarde ses premières morts au pas 1 600 au lieu de 1 500 (9 morts à 1 500, 11 à 1 600 ; même seuil de 10).

## Vérifié / non vérifié / décisions
**Vérifié** : typecheck ; Vitest (`jump-sim` + `apps/jump` : 293 tests, dont le format, `buildModule` pur, les paliers de chaque variante, **chaque solution rejouée** (sortie en élan au bord droit, 2–6 s), aucune au pas près, empreinte périmée → « relancer solve:modules », `catalog.ts` à jour, franchissement de colonne (sauté = pris, mort au franchissement = non pris, n'importe quelle hauteur, retour en arrière), départ lancé dans le format, fuzz d'intégrité étendu à six morceaux) ; e2e **Chromium** (DailyJump : 53 tests, dont la galerie en portrait et paysage (44 px, pas de débordement), une solution qui finit en pas à pas au temps stocké, un morceau joué au doigt en paysage) ; le solveur complet relancé à blanc retrouve exactement les solutions stockées (déterministe). Aucune zone partagée, aucun fichier de DailyTrack, aucune dépendance ajoutée.
**Non vérifié** : Firefox et WebKit (la CI tranche) ; vrai téléphone ; **le ressenti** : l'exigence mesure la marge d'une suite de commandes jouée « à l'aveugle » ; un joueur corrige en route, donc les notes classent les morceaux entre eux plus qu'elles ne mesurent la difficulté humaine.

**Décisions pour Nathan**
1. **Solution gardée = la plus tolérante à 2 % près de la plus rapide** (`SLOWER`, `fastest` reste stocké) : sans cela, la plus rapide colle aux dangers et presque tout sortait « au pas près ». Le temps de l'auteur du lot 5 sera donc un peu au-dessus de l'optimum.
2. **Entrée élan = un drapeau de la rediffusion** (pas de changement de format sinon) ; le départ est dans la colonne d'appel, une tuile avant le palier, pour que la scie démarre comme dans l'assemblage (quand le centre entre dans le morceau).
3. **Point de passage** : le dernier franchi vers la droite l'emporte, même un point d'avant qu'on repasse après être revenu en arrière.
4. **Répartition** : beaucoup de 1 (35 variantes sur 74) ; les plus exigeants sont les murs avec scies ou pics et les ressorts enchaînés. Les seuils de la note (`exigenceOf`) sont à régler sur tes parties.
5. **Mémoire d'un morceau** rangée par entrée (`jump:*:module:<id>:<n>:arret|elan`) : le niveau à couloir n'est pas le même ; les rediffusions portent bien `module:<id>:<n>`. Galerie triée par exigence ; « Morceau suivant » suit cet ordre, variante 0, même entrée.
6. Les grilles ont été écrites avec un petit générateur hors dépôt ; la source est le fichier `.txt` (à modifier à la main, puis `solve:modules`).
7. Branche imposée par la session : `claude/dailyjump-modules-solver-5zpx98`.
