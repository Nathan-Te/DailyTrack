# DailyJump — `packages/jump-sim` : consignes de la simulation, des morceaux et du générateur

Chargé quand on lit un fichier de `packages/jump-sim`. Physique entière, niveaux, morceaux, solveur, générateur, versions, jours figés. **Partir de la synthèse `docs/jump/synthese.md`** (un point = un renvoi vers le README du lot) ; n'ouvrir un README de `docs/jump/lots/` que pour un détail vision et plan : `docs/jump/seed-dailyjump.md` (**ne pas modifier**, c'est Nathan qui le fait). Réponses et docs en français. Les règles du jeu (rendu, interface, tactile, thèmes visuels, stockage) sont dans `apps/jump/CLAUDE.md`.

> **Renvois « voir <rubrique> »** : une rubrique citée mais absente de ce fichier est dans un autre `CLAUDE.md` ou dans `docs/regles/` : `CLAUDE.md` racine, « Où sont les rubriques ».

## Règle du socle (`core`)
- `core` ne contient **aucune logique de jeu**. Tout ce qui y entre doit laisser **inchangés les golden des deux jeux**.
- On n'y déplace un module que lorsque le **deuxième** jeu en a besoin (lot V1 : `sacThemes.ts`, la règle des thèmes, commune à DailyTrack et à DailyJump). `PREMIER_JOUR` reste propre à chaque jeu. Le format d'une rediffusion (champs d'une série, bornes, version) reste propre à chaque jeu ; seul le codage d'octets est commun. `math.ts` n'est pas dans `core` (le saut n'a pas besoin de trigonométrie).

## Règles de `jump-sim`
- **État entièrement en entiers** : 1 tuile = 4 096 unités (`UNITS_PER_TILE` : 16 px × 256 sous-pixels), vitesses en unités par tick, minuteries en ticks. Pas fixe à 120 Hz (`TICK_RATE`), jamais de `dt` variable.
- **`idiv(a, b)` pour toute division** : tronque vers zéro, ne renvoie jamais `-0`. Jamais de `/` sur l'état, jamais de `Math.floor` d'un quotient pour couper.
- **Mêmes interdits que `sim`** (pas de `Math.random`, `Date`, `performance`, `**`, fonctions transcendantes, imports extérieurs ; seul `@cdj/core` est permis), vérifiés par `test/purete.test.ts` qui utilise la liste commune de `@cdj/core/testing`.
- **`JUMP_SIM_VERSION`** +1 dès que la physique, un élément de niveau ou un niveau d'essai change le résultat d'un essai ; **`JUMP_GENERATOR_VERSION`** +1 dès que le niveau d'une date change **et une entrée de plus au calendrier des bascules** (`src/bascules.json`, voir « Jours servis immuables (lot 33) »). Puis régénérer les références (golden), comme pour DailyTrack. Valent 1 au lot 0.
- Un niveau est une grille ASCII (`parseLevel`, `level.ts`) : `#` bloc, `.` vide, `S` départ, `F` arrivée (les autres éléments entrent avec leurs lots).

## Lot 1 — personnage
- **Simulation** (`packages/jump-sim`) : `stepPlayer(état, commande, niveau, réglages) → état`, pur, 120 Hz (`player.ts`) ; collisions boîte contre grille axe par axe, en ne parcourant que les tuiles nouvellement couvertes (`collide.ts` : `sweep`, `boxHits`, `floorDiv`) ; bac à sable écrit en ASCII (`sandbox.ts` : `SANDBOX_LEVEL`, repères `SANDBOX_MARKS`). Boîte de collision constante 3/4 × 3/4 de tuile (`PLAYER_WIDTH`, `PLAYER_HEIGHT`) ; le rendu dessine exactement cette boîte.
- **État 100 % entier** (drapeaux 0/1, côtés −1/0/1), divisions par `idiv` uniquement (`floorDiv` est bâtie dessus), jamais de `-0` (les vitesses rendues passent par `+ 0`). **`MAX_SPEED`** (2 048 unités/pas, une demi-tuile) < 1 tuile/pas, appliqué **à chaque pas** sur les deux axes quels que soient les réglages. **Toute nouvelle mécanique rejoint le fuzz d'intégrité** (`test/player.test.ts`, « intégrité (fuzz) » : commandes aléatoires du PRNG de `core`, graine fixe, réglages par défaut et au hasard ; tout reste `Number.isInteger`, sans `-0`, sous `MAX_SPEED`, hors des murs).
- **Commandes = 3 bits** (`INPUT_LEFT` 1, `INPUT_RIGHT` 2, `INPUT_JUMP` 4 = saut *tenu*) ; gauche + droite = neutre ; l'**appui** (front montant) est déduit dans la sim (`PlayerState.held`). **« Recommencer » n'est pas une commande de la sim** : c'est un événement de la session (`JumpSession.restart`, touche R, Start/Select).
- **Réglages** `JumpParams` (entiers, `DEFAULT_JUMP_PARAMS`). **Tout changement de réglage par défaut, de physique ou du bac à sable ⇒ `JUMP_SIM_VERSION` +1** et golden régénérés **en comprenant pourquoi** : `UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden.test.ts` (le test vérifie la version, les réglages et l'empreinte du bac à sable, puis rejoue les suites au pas près). Mesures : `MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts`.

## Lot 1b — mobile
- **`tileOf` est le seul décalage permis dans la sim** (`v >> 12`, `collide.ts`, testé contre `Math.floor(v / 4096)` négatifs compris, jamais `-0`) ; **toute autre division passe par `idiv`**. Les golden et `JUMP_SIM_VERSION` n'ont pas bougé : c'est la preuve d'un calcul identique.

## Lot 2 — dangers et mort
- **Chaque élément de niveau a son caractère documenté** (légende et format du bloc annexe en tête de `packages/jump-sim/src/level.ts`), **sa boîte « juste »** (plus petite que le visuel quand c'est mortel : pics = moitié côté base, retrait de ¼ sur les flancs, dans le triangle ; scies = disque plein, les dents dessinées le dépassent), **ses tests** (`test/dangers.test.ts`) et **sa place dans `?scenario=dangers`** (galerie `DANGERS_LEVEL`, `levels.ts`). Un nouvel élément rejoint aussi le fuzz d'intégrité de l'essai.
- **Les éléments mobiles démarrent à l'entrée de leur section** (`section <nom> <col0>-<col1>` dans le bloc annexe ; un élément appartient à la section de son premier point ; avant, il attend à son départ et tue quand même). Position = fonction **entière et pure** des pas écoulés (`sawCenter`, `idiv`), exactement au départ à chaque cycle. La rotation des scies est un effet d'affichage.
- **Tout l'état du niveau est entier** (`AttemptState`, `attempt.ts` : scies par sections, blocs friables, ressort, chrono) **et revient à zéro à la mort** (égalité profonde avec `initialAttempt`, testée). `stepPlayer` (lot 1) ne connaît que la grille ; `stepAttempt` l'enveloppe.
- **Le monde attend la première commande** (une direction, ou un saut appuyé) : rien ne bouge, le chrono reste à 0. **(Niveaux v3 ; le niveau du jour en v4 part à heure fixe depuis le lot 15 : voir « Horloge unique (lot 15) ».)**
- **Le temps est en pas** (`AttemptState.time`, du premier pas commandé au contact de `F` compris) ; l'affichage en secondes à 3 décimales (`formatTicks`) n'est que de l'affichage.
- **L'arrivée l'emporte sur la mort au même pas** (vérifiée d'abord, testée).
- **Pas de saut automatique à la réapparition** : un saut tenu depuis l'essai précédent ne compte qu'après avoir été relâché ; une direction tenue compte tout de suite. Réapparition `RESPAWN_TICKS` (18 pas = 0,15 s ; jamais plus de 24) après la mort, commandes ignorées entre-temps.
- **Les distances au carré restent sous `Number.MAX_SAFE_INTEGER`** : bornes `MAX_LEVEL_WIDTH` / `MAX_LEVEL_HEIGHT` / `MAX_SAW_*` refusées par `parseLevel`, test « bornes » sur la plus grande carte possible. Toute nouvelle grandeur multipliée rejoint ce test.
- Bas de la grille **ouvert** (on en meurt), les trois autres bords restent pleins (`tileAt`).
- **Preuve de faisabilité** : `test/fixtures/essai-solution.json` (et `dangers-solution.json`), rejouées par `essai-solution.test.ts` et le golden ; trouvées par le chercheur hors simulation `test/solver.ts` (`SOLVE=1 npx vitest run packages/jump-sim/test/essai-solution.test.ts`). **Modifier le niveau d'essai ou la physique ⇒ `JUMP_SIM_VERSION` +1, `SOLVE=1`, puis `UPDATE_GOLDEN=1`.**
- Mesures : `MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts --silent=false`. Outils tactiles des e2e communs : `apps/jump/e2e/phone.ts`.

## Lot 2b — points de passage
- **`C`** = point de passage (tuile vide repérée, posée sur un sol sûr, `Level.checkpoints` rangés de gauche à droite). Le toucher **vivant à la fin du pas** le retient (`AttemptState.checkpoint`) — **depuis le lot 4 : le franchir** (voir « Lot 4 — morceaux ») ; un point touché au pas d'une mort ne compte pas.
- **Mort après un point** : l'essai **continue** — le chrono tourne pendant l'attente (`RESPAWN_TICKS`) et après ; reprise posée sur le point, sans attendre de commande ; friables reposés, ressort au repos, sections du point et d'après remises à l'arrêt (elles repartent à leur entrée), sections d'avant inchangées (`checkpointAttempt`). **Sans point**, la mort termine l'essai comme au lot 2. **Recommencer (R) oublie le point** : départ, chrono à zéro. Un temps d'arrivée peut donc contenir des morts : le bandeau le dit (« essai sans faute » ou « N dans cet essai », `JumpSession.attemptDeaths`).
- Un niveau écrit à la main en met au début de chaque section et avant les passages longs ; jamais dans un danger. Un nouveau point dans un niveau d'essai change le niveau : **`JUMP_SIM_VERSION` +1**, solutions et golden régénérés (`JUMP_SIM_VERSION` vaut **2** depuis le lot 2b).

## Lot 3 — rediffusion
- **Le rejeu est la seule source de vérité de tout temps conservé** : un essai clos est rejoué (`replayAttempt`, `packages/jump-sim/src/replay.ts`) avant que la mémoire du jour (`apps/jump/src/memory.ts`) en garde quoi que ce soit ; le meilleur temps gardé (et affiché « Meilleur du jour ») est celui du rejeu, jamais celui du HUD ; au chargement, le meilleur essai est rejoué de nouveau.
- **Format** : séries `{ count, bits }` codées par `@cdj/core` (`varint(count × 8 + bits)`) ; en-tête = `JUMP_REPLAY_FORMAT`, `JUMP_SIM_VERSION`, identifiant du niveau (le scénario aujourd'hui, la date plus tard), départ (saut tenu ; point de passage, chrono et sections pour une vie) ; borne `MAX_ATTEMPT_TICKS` (10 min). Un essai commence au **premier pas commandé** : son chrono vaut le nombre de pas rejoués. Les reprises aux points de passage ne sont pas enregistrées (la sim les refait) — **sauf, en version 11 (lot 27), la reprise volontaire** (quatrième bit de la commande : « Ajustements (lot 27) »).
- **Une rediffusion d'une autre version est ignorée** (`JumpReplayError` de code `version` au rejeu ; la mémoire l'écarte sans bruit) ; trop longue ou mal formée : erreur claire (`length`, `format`).
- **Tout nouvel effet de la sim garde l'égalité entre jeu et rejeu** : `packages/jump-sim/test/replay.test.ts` (« rejeu = ce qui a été vécu », essai par essai, et chaque vie rejouée seule) doit rester vert ; un nouvel élément rejoint aussi ses sessions jouées et les essais fictifs de `replay-golden.test.ts` (empreintes comparées dans Chromium, Firefox et WebKit par `apps/jump/e2e/replay.spec.ts` sur `verify.html`). Changer le format ou les essais fictifs : `UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/replay-golden.test.ts` ; après `SOLVE=1`, recopier le texte de la solution dans `src/solutions.ts`.
- **Vocabulaire** : un *essai* va du départ à l'arrivée, à une mort sans point de passage, ou à « recommencer » ; une *vie* est un tronçon d'essai entre deux réapparitions (sa rediffusion part de son point de départ).

## Lot 4 — morceaux
**Un morceau = un fichier texte** `packages/jump-sim/modules/<id>.txt` (l'id est le nom du fichier) : métadonnées `id`, `intention` (une phrase), `etiquettes` (`mural`, `precision`, […] **→ Détail : [docs/regles/jump-sim/lot-4-morceaux.md](../../docs/regles/jump-sim/lot-4-morceaux.md)**

## Lot 5 — niveau du jour
- **`dailyLevel(jour)`** (`packages/jump-sim/src/daily.ts`, pur ; `jour` = numéro de jour de `@cdj/core`) assemble des morceaux du catalogue et rend le niveau, la preuve (rediffusion de l'auteur), le temps de l'auteur, les médailles, l'exigence et les tirages essayés. **`PREMIER_JOUR_JUMP`** = 16/10/2026 (niveau n° 1, `levelNumber`). Graine : `Rng(mixSeed(mixSeed(jour, sel), tirage))`. **« Aujourd'hui » se lit par `@cdj/clock` (`parisDay`) dans le jeu, jamais dans la sim** (ni `Date` ni heure dans `jump-sim`).
- **Assemblage (lot 6)** : garde · palier de départ `S` · morceau 1 · **palier partagé** `C` · morceau 2 · … · morceau n · palier d'arrivée · `F`. Le palier de sortie d'un morceau **est** le palier d'entrée du suivant (les mêmes tuiles, **aucune colonne de raccord**), aligné par sa rangée, son vide montant jusqu'en haut du plus haut des deux voisins (`DailyLevel.paliers`) ; **le premier morceau part à l'arrêt, tous les suivants en élan** ; **hors des morceaux et des paliers tout est plein** (une rangée de blocs ferme le haut ; sous un morceau, le vide continue jusqu'en bas là où sa dernière rangée n'est pas un bloc) ; un point de passage `C` par morceau (sauf le premier, qui a le départ), **au début du palier qui le précède** (y reprendre = exactement l'entrée « arrêt » du morceau seul, testé) ; **chaque morceau est une section**. Hauteur totale ≤ **56** rangées (`MAX_DAILY_HEIGHT`, 48 au lot 5), 6 à 13 morceaux.
- **Durée** : on ajoute des morceaux tant que l'estimation (somme des durées des solutions de leur entrée à leur sortie ; `JOINT_TICKS` = **0** depuis le lot 6, 9 au lot 5) est sous `ESTIMATE_MIN_TICKS` (28 s), sans dépasser `ESTIMATE_MAX_TICKS` (32 s) ; **temps de l'auteur dans [25 ; 40] s** (`AUTHOR_MIN/MAX_TICKS`), centre 30 s (`AUTHOR_TARGET_TICKS`).
- **Course à vide (lot 6)** : temps au sol sans appui de saut, centre au-dessus d'un palier de raccord, sur la rediffusion de l'auteur (`palierTicksOf`, `DailyLevel.palierTicks`) : **cibles moins de 0,25 s par raccord en moyenne et moins de 6 % du temps de l'auteur au total** ; la seconde est une règle (`EMPTY_RUN_MAX` = 60 ‰, `dailyProblems`) ; les deux sont vérifiées par les tests sur 60 dates et mesurées par `measure:jump` (avec la plus longue course au sol sans saut).
- **Quotas** : au moins un `mural`, au moins une `scie`, jamais plus de **deux `precision` d'affilée**, **un seul `respiration`, au milieu** (son milieu entre 35 et 65 % du temps ; imposé seulement quand il ne pourrait plus y tomber, `FORCE_REST_SLACK`), jamais deux fois le même morceau.
- **Budget d'exigence** (la même exigence chaque jour, aucune difficulté selon le jour de la semaine) : somme des exigences ramenée à la durée, en dixièmes de point par minute, dans **[`EXIGENCE_RATE_MIN` 445 ; `EXIGENCE_RATE_MAX` 570]** (centre 505 depuis le lot 8c : notes lues sur ±3, un peu plus hautes ; 445–540 au lot 7b, 430–520 au lot 6, centre 475 ; 380–460 au lot 5 : sans course à vide, la même suite de morceaux tient en moins de temps) ; au moins un morceau d'exigence **≥ 4** (`EXIGENCE_PEAK`) ; **dernier tiers ≥ premier tiers** (moyenne pondérée par la durée) ; la variante de chaque morceau est la plus proche du profil visé `PROFILE_START` 1,3 → `PROFILE_END` 3,3. `dailyProblems(niveau)` liste ce qui ne va pas (les tests l'appliquent à 60 dates).
- **Repos sans historique** : trois groupes (`restGroup`, empreinte de l'identifiant avec `REST_SALT`, choisi pour des groupes de 9 aux étiquettes réparties) ; le jour `d` laisse au repos le groupe `d mod 3`. Le secours l'ignore.
- **Validation par rejeu** : les solutions sont mises bout à bout **sans course entre deux** : chacune jouée jusqu'à sa sortie canonique (le centre passe le bord droit du palier partagé, en course propre), la suivante reprend au pas d'après depuis son `entryTick` (une seule possibilité : le repli « l'autre pas » du lot 5 est retiré, le raccord strict l'a rendu inutile, mesuré) ; si la sortie vient un peu plus tard que dans la solution stockée, droite tenue (au plus `RACCORD_TAIL` pas, comme le test de raccord). **La rediffusion complète est rejouée par `replayAttempt`** : arrivée sans mort, toutes les règles, sinon tirage suivant. **`DAILY_DRAWS` = 6 tirages** par jour, on garde le meilleur valide (durée et exigence les plus proches du centre) ; sans tirage valide, jusqu'à `DAILY_MAX_ATTEMPTS` = 40, puis le **niveau de secours** (`FALLBACK_PIECES`, assemblé et validé de la même façon ; **jamais utilisé sur 120 dates**, mesuré).
- **Temps de l'auteur** = temps de la preuve rejouée, en pas. **Médailles en pas entiers** (`jumpMedalsFor`, `idiv`, arrondies au pas supérieur) : or ×1,10, argent ×1,30, bronze ×1,60 (`MEDAL_PERCENT`, à calibrer) ; l'auteur est le palier au-dessus de l'or. **Lot G1 : pour les niveaux de la version 12 et suivantes (`MEDAILLES_ASSOUPLIES_VERSION`), le seuil du Diamant (`medals.author`) est à 105 % du temps de l'auteur (la preuve, que personne ne bat), l'or à 115 %, l'argent à 137 %, le bronze à 170 %** (`MEDAL_PERCENT_G1`, `jumpMedalsFor(ticks, version)` : les références des versions d'avant gardent leurs seuils). **Aucune date** : un jour servi garde ses médailles parce que « Mettre en production » le fige (`medailles` du fichier, `medailles.author ≥ auteur`) avec le code en production. `medals.author` n'est donc plus le temps de la preuve : c'est `authorTicks`.
- **Identifiant** : `jour-AAAA-MM-JJ-g<JUMP_GENERATOR_VERSION>` (`dailyLevelId` ; rediffusions, mémoire, fantôme, carnage, taches).
- **Tout changement qui modifie le niveau d'une date** (règles, seuils, sel, catalogue, solutions, assemblage) ⇒ **`JUMP_GENERATOR_VERSION` +1**, `UPDATE_GOLDEN=1 npx vitest run packages/jump-sim/test/golden-daily.test.ts`, puis **`npm run measure:jump -w @cdj/jump-sim`** (toute règle se juge à ses mesures : taux de validation, secours, durées, exigence, étiquettes, emploi des morceaux, jours consécutifs, hauteur, coûts).
- **Tests à dates fixes** : jamais « aujourd'hui » dans un test Vitest (60 dates depuis `PREMIER_JOUR_JUMP`, golden sur 6 dates fixes) ; en e2e, **horloge maîtrisée par décalage de `Date`** (`apps/jump/e2e/clock.ts` : `FIXED_NOW` = midi UTC le 20/10/2026, `atInstant`), **jamais `page.clock.install`**. Le site publié se simule en servant `https://nathan-te.github.io/DailyTrack/jump/…` par le serveur de test (`servePublished`).

## Lot 7 — variété
**Format 3** (`format: 3`, `MODULE_FORMAT`) : en plus du lot 6, **`famille:`** (obligatoire), **`enchainement: long`** et **`elan: oui`** (facultatifs), **`mutateurs:`** (liste) ; un fichier v2 est refusé. **→ Détail : [docs/regles/jump-sim/lot-7-variete.md](../../docs/regles/jump-sim/lot-7-variete.md)**

## Lot 7b — chargement rapide, respirations, tension
**Une respiration n'est jamais exigeante** : toute variante d'un morceau étiqueté `respiration` a une exigence de **2 au plus aux deux entrées** (`MAX_REST_EXIGENCE`, `modules.ts` ; test […] **→ Détail : [docs/regles/jump-sim/lot-7b-chargement-rapide-respirations-tension.md](../../docs/regles/jump-sim/lot-7b-chargement-rapide-respirations-tension.md)**

## Lot 8b — animation du personnage, essai d'élan progressif
**L'élan progressif est un essai, désactivé par défaut, réservé aux sessions `tuned`** : réglages `sprintMode`, `sprintSpeed`, `sprintDelay`, `sprintAccel` de `JumpParams`, **absents de […] **→ Détail : [docs/regles/jump-sim/lot-8b-animation-du-personnage-essai-d-elan-progressif.md](../../docs/regles/jump-sim/lot-8b-animation-du-personnage-essai-d-elan-progressif.md)**

## Lot 8c — jouable par un humain
- **L'élan n'est pas la physique par défaut** (voir « Lot 8b ») ; une reprise éventuelle (bouton dédié, tapis d'élan) passera par son propre lot, mesuré sur la largeur des niveaux et la part de technique, pas seulement sur le taux de validation.
- **Règle de jouabilité humaine** (voir « Lot 4 — morceaux ») : ±3 pas ≥ 50 % à chaque entrée, note sur ±3, repli robuste du solveur. Tests : `modules.test.ts` (règle, toutes les solutions au-dessus du seuil, repli à 25 % au plus de la plus rapide).
- **Une respiration reste notée 2 au plus** avec la nouvelle échelle (85 % à ±3) : `tunnel` et `escalier` ont été adoucis.
- **Jours figés avant le changement de générateur** (règle du lot 10) : `apps/jump/public/levels/2026-10-16.json` et `2026-10-17.json`, en g4.

## Lot 10 — arrivée, partage, archives
**Règle, une fois le jeu lancé : figer avant de changer de version.** **Depuis le lot R6, c'est « Mettre en production » qui fige** (`freeze:days` jusqu'à la veille du jour de bascule, avec […] **→ Détail : [docs/regles/jump-sim/lot-10-arrivee-partage-archives.md](../../docs/regles/jump-sim/lot-10-arrivee-partage-archives.md)**

## Lot 11 — thèmes jouables
**Le thème est une donnée du générateur** (`packages/jump-sim/src/themes.ts`, pur) : `jumpThemeForDay(jour)` (tirage et résultats identiques à ceux du lot 9 : test sur 400 dates, […] **→ Détail : [docs/regles/jump-sim/lot-11-themes-jouables.md](../../docs/regles/jump-sim/lot-11-themes-jouables.md)**

## Lot 12 — nuit et néon
**Deux mécaniques, deux thèmes** (`nuit` : blocs clignotants ; `neon` : blocs alternés) qui s'ajoutent à celles du lot 11, **sans rien changer à la physique** : `JUMP_SIM_VERSION` reste […] **→ Détail : [docs/regles/jump-sim/lot-12-nuit-et-neon.md](../../docs/regles/jump-sim/lot-12-nuit-et-neon.md)**

## Lot 13 — forêt
**Les cinq thèmes ont leur mécanique** (usine : tapis ; glace : glace ; nuit : blocs clignotants ; néon : blocs alternés ; forêt : courants d'air). **→ Détail : [docs/regles/jump-sim/lot-13-foret.md](../../docs/regles/jump-sim/lot-13-foret.md)**

## Sac de thèmes : jamais deux jours de suite le même thème (lot V1)
**`JUMP_GENERATOR_VERSION` 23** (`JUMP_GENERATOR_SAC`, themes.ts) ; **`JUMP_SIM_VERSION` reste 12** (aucune physique, aucun morceau : un niveau g22 se rejoue tel quel) ; golden v3 à v11 […] **→ Détail : [docs/regles/jump-sim/sac-de-themes-jamais-deux-jours-de-suite-le-meme-theme-l.md](../../docs/regles/jump-sim/sac-de-themes-jamais-deux-jours-de-suite-le-meme-theme-l.md)**

## Plateforme (lot P3) — la validation des vies
**Une aide pure, la même pour le serveur et le jeu** (`packages/jump-sim/src/lives.ts`, ajout pur : aucune version, aucun golden ne change) : `lifeStartProblem(niveau, départ)` dit si […] **→ Détail : [docs/regles/jump-sim/plateforme-lot-p3-la-validation-des-vies.md](../../docs/regles/jump-sim/plateforme-lot-p3-la-validation-des-vies.md)**

## Horloge unique (lot 15)
Décision de Nathan : **une seule horloge de course**, qui ne s'arrête jamais (sauf en pause) ; à la mort, les dangers **continuent leur course** (rien n'est remis à zéro, comme dans Super Meat Boy). **→ Détail : [docs/regles/jump-sim/horloge-unique-lot-15.md](../../docs/regles/jump-sim/horloge-unique-lot-15.md)**

## Seconde voie (lot 16)
Règles de Nathan : seconde voie **seulement sur les portions notées 4 ou 5**, coût **≥ max(+50 % du temps de la portion, +3 s)** entre les solutions enregistrées rapide et lente, **or** par […] **→ Détail : [docs/regles/jump-sim/seconde-voie-lot-16.md](../../docs/regles/jump-sim/seconde-voie-lot-16.md)**

## Ajustements (lot 17)
`JUMP_GENERATOR_VERSION` **12** (identifiants `…-g12`), `JUMP_SIM_VERSION` 4 inchangée, golden v3 identiques. **→ Détail : [docs/regles/jump-sim/ajustements-lot-17.md](../../docs/regles/jump-sim/ajustements-lot-17.md)**

## Rythme de la nuit (lot 18)
`JUMP_GENERATOR_VERSION` **13** (identifiants `…-g13`), `JUMP_SIM_VERSION` 4 inchangée, **golden v3 identiques**. **→ Détail : [docs/regles/jump-sim/rythme-de-la-nuit-lot-18.md](../../docs/regles/jump-sim/rythme-de-la-nuit-lot-18.md)**

## Variété (lot 19)
`JUMP_GENERATOR_VERSION` **14** (identifiants `…-g14`), `JUMP_SIM_VERSION` 4 inchangée, **golden v3 identiques**. **→ Détail : [docs/regles/jump-sim/variete-lot-19.md](../../docs/regles/jump-sim/variete-lot-19.md)**

## Plateformes mobiles (lot 20)
`JUMP_SIM_VERSION` **5**, `JUMP_GENERATOR_VERSION` **15** (identifiants `…-g15`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/plateformes-mobiles-lot-20.md](../../docs/regles/jump-sim/plateformes-mobiles-lot-20.md)**

## Joueurs fictifs qui reprennent bien (lot 21)
**Aucune version ni aucun golden ne change** (`JUMP_SIM_VERSION` 5, `JUMP_GENERATOR_VERSION` 15) : l'option est facultative et sans elle `demoAttempts` rend exactement les essais d'avant (`replay-golden*.json`, `horloge.test.ts`). **→ Détail : [docs/regles/jump-sim/joueurs-fictifs-qui-reprennent-bien-lot-21.md](../../docs/regles/jump-sim/joueurs-fictifs-qui-reprennent-bien-lot-21.md)**

## Presses (lot 22)
`JUMP_SIM_VERSION` **6** (`PRESS_VERSION`), `JUMP_GENERATOR_VERSION` **16** (identifiants `…-g16`, `PRESS_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/presses-lot-22.md](../../docs/regles/jump-sim/presses-lot-22.md)**

## Champignons (lot 23)
`JUMP_SIM_VERSION` **7** (`MUSHROOM_VERSION`), `JUMP_GENERATOR_VERSION` **17** (identifiants `…-g17`, `MUSHROOM_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/champignons-lot-23.md](../../docs/regles/jump-sim/champignons-lot-23.md)**

## Stalactites (lot 24)
`JUMP_SIM_VERSION` **8** (`STALACTITE_VERSION`), `JUMP_GENERATOR_VERSION` **18** (identifiants `…-g18`, `STALACTITE_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/stalactites-lot-24.md](../../docs/regles/jump-sim/stalactites-lot-24.md)**

## Lasers (lot 25)
`JUMP_SIM_VERSION` **9** (`LASER_VERSION`), `JUMP_GENERATOR_VERSION` **19** (identifiants `…-g19`, `LASER_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/lasers-lot-25.md](../../docs/regles/jump-sim/lasers-lot-25.md)**

## Ponts à interrupteur (lot 26)
`JUMP_SIM_VERSION` **10** (`BRIDGE_VERSION`), `JUMP_GENERATOR_VERSION` **20** (identifiants `…-g20`, `BRIDGE_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/ponts-a-interrupteur-lot-26.md](../../docs/regles/jump-sim/ponts-a-interrupteur-lot-26.md)**

## Ajustements (lot 27)
`JUMP_SIM_VERSION` **11** (`RESTART_VERSION`), `JUMP_GENERATOR_VERSION` **21** (identifiants `…-g21`, `RESTART_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/ajustements-lot-27.md](../../docs/regles/jump-sim/ajustements-lot-27.md)**

## Blocs alternés persistants (lot 28)
`JUMP_SIM_VERSION` **12** (`ALT_KEPT_VERSION`), `JUMP_GENERATOR_VERSION` **22** (identifiants `…-g22`, `ALT_KEPT_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/blocs-alternes-persistants-lot-28.md](../../docs/regles/jump-sim/blocs-alternes-persistants-lot-28.md)**

## Saut moins sensible (lot 30)
`JUMP_SIM_VERSION` **13** (`MIN_HOLD_VERSION`), `JUMP_GENERATOR_VERSION` **24** (identifiants `…-g24`, `MIN_HOLD_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/saut-moins-sensible-lot-30.md](../../docs/regles/jump-sim/saut-moins-sensible-lot-30.md)**

## Place autour de la lame et portion dure (lot 31)
`JUMP_GENERATOR_VERSION` **25** (identifiants `…-g25`), `JUMP_SIM_VERSION` 13 inchangée, `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/place-autour-de-la-lame-et-portion-dure-lot-31.md](../../docs/regles/jump-sim/place-autour-de-la-lame-et-portion-dure-lot-31.md)**

## Points de passage sur leur palier (lot 32)
`JUMP_SIM_VERSION` **14** (`CHECKPOINT_ZONE_VERSION`), `JUMP_GENERATOR_VERSION` **26** (identifiants `…-g26`, `CHECKPOINT_ZONE_GENERATOR`), `MODULE_SIM_VERSION` 3 inchangée. **→ Détail : [docs/regles/jump-sim/points-de-passage-sur-leur-palier-lot-32.md](../../docs/regles/jump-sim/points-de-passage-sur-leur-palier-lot-32.md)**

## Jours servis immuables (lot 33)
Incident du 06/11/2026 : la mise en production a changé le niveau du jour et trois archives de Jump alors que des temps étaient enregistrés (cause : `freeze:days` ne déclarait pas les niveaux déjà figés d'un ancien générateur — `declareFrozenGenerators`, `themes.ts` — donc le thème et la variété des jours suivants étaient calculés sans eux ; les fichiers n'étaient pas les niveaux servis). **Règle absolue : un jour déjà servi ne change jamais.**
- **Calendrier des bascules du générateur** : `src/bascules.json` (`{ bascules: [{ depuis: "AAAA-MM-JJ", generateur: N }] }`, croissant, la dernière entrée est `JUMP_GENERATOR_VERSION` ; `bascules.ts` : `generateurDuJour`, `problemesDuCalendrier`, testé par `test/bascules.test.ts`). **Un jour se génère toujours avec le générateur actif à sa date** : `dailyLevel` (version de simulation ≥ 14) lève `GenerateurDuJourError` pour un jour dont la date est d'un générateur que ce code n'est pas, au lieu de servir en silence un autre niveau — ce jour doit venir de son **fichier figé**. Le serveur répond alors `503 level_unavailable` (journalisé) pour un jour sans fichier. La règle de variété lit les niveaux voisins sans ce garde (`calculerNiveau`) : c'est la définition du niveau d'un jour de ce générateur.
- **Changer le générateur** : monter `JUMP_GENERATOR_VERSION`, **ajouter l'entrée `{ depuis, generateur }` avec `depuis` = demain au plus tôt** (le jour de bascule de la mise en production, jusqu'à 14 jours après). **Une bascule fixée à aujourd'hui ou avant est refusée** par « Mettre en production » (`verifierBascules`, `scripts/mise-en-production.mjs`), qui fige avec le code en production tous les jours jusqu'à la veille de la nouvelle entrée. Jamais d'autre date dans le code.
- **Les jours servis sont des fichiers** (`apps/jump/public/levels/`) : voir `apps/jump/CLAUDE.md`, « Jours servis immuables (lot 33) » (chaîne de mise en production, outil de figeage, tests).
