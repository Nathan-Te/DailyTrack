/** Fréquence de simulation, en pas par seconde (pas fixe : jamais de `dt` variable). */
export const TICK_RATE = 120;

/**
 * Version de la simulation du saut. À incrémenter dès que la physique, un élément de niveau ou un niveau d'essai change le résultat d'un essai
 * (même règle que `SIM_VERSION` de DailyTrack) : les rediffusions d'une autre version ne sont plus rejouables.
 */
export const JUMP_SIM_VERSION = 11;

/**
 * Lot 15 : **la version de la simulation est inscrite dans chaque niveau** (`Level.simVersion`, ligne `version 4` du bloc annexe ; absente : 3).
 * Le code sait jouer les deux, chacune exactement comme elle a été écrite :
 *   - **3** (`SECTION_CLOCK_VERSION`) : chaque section a son horloge, mise en marche à l'entrée du personnage, remise à l'arrêt à la mort ; le
 *     monde attend la première commande ; une mort sans point de passage termine l'essai. Les niveaux d'essai, les morceaux joués seuls (et le
 *     solveur) et les jours figés jusqu'au 22/10/2026 sont en v3 : leurs rediffusions, leurs solutions et leurs références n'ont pas changé ;
 *   - **4** (`SINGLE_CLOCK_VERSION`) : **une seule horloge de course** — tout élément cyclique vaut `f(t + phase)` (`t` : le chrono, `phase` :
 *     celle de sa section, choisie par le générateur), rien ne s'active à l'approche, rien ne revient à zéro à la mort ; le chrono part à heure
 *     fixe (à la fin du « Prêt… », que le joueur bouge ou non) ; une mort avant le premier point de passage fait reprendre au départ, chrono qui
 *     continue. Les niveaux du jour depuis le générateur g10.
 * Une rediffusion porte la version de son niveau ; elle ne se rejoue que sur un niveau de la même version (`JumpReplayError` `version`).
 */
export const SECTION_CLOCK_VERSION = 3;
export const SINGLE_CLOCK_VERSION = 4;
/**
 * Lot 20 : **version 5 = version 4 + plateformes mobiles** (`plateforme` du bloc annexe, `Level.platforms`). Une plateforme est une rangée de 2 à 4
 * tuiles qui fait un aller-retour (horizontal ou vertical) sur l'horloge de sa section (`f(t + phase)`, entière, ralentie à ses deux extrémités par
 * une table entière) ; le personnage posé dessus est porté, garde sa vitesse horizontale au saut, la traverse par-dessous et par les côtés. Un niveau
 * sans plateforme se joue **exactement** comme en v4 (ou en v3) : les golden v3 et v4 n'ont pas bougé. Les niveaux du jour depuis le générateur g15 sont en
 * v5 ; les morceaux joués seuls restent en v3 (`MODULE_SIM_VERSION`), leurs plateformes suivent l'horloge de leur section comme les scies.
 */
export const PLATFORM_VERSION = 5;
/**
 * Lot 22 : **version 6 = version 5 + presses** (`presse` du bloc annexe, `Level.presses`). Une presse est un bloc de 2 ou 3 tuiles de large qui descend
 * et remonte à la verticale sur l'horloge de sa section (`f(t + phase)`, entière, par des tables entières) : attente en haut, chute rapide, pause en
 * bas, remontée lente. **Toute la presse tue au contact** (on ne monte pas dessus, rien ne pousse ni n'écrase physiquement). Un niveau sans presse se
 * joue **exactement** comme en v3, v4 ou v5 : les golden n'ont pas bougé. Les niveaux du jour depuis le générateur g16 sont en v6 ; les morceaux joués
 * seuls restent en v3 (`MODULE_SIM_VERSION`), leurs presses suivent l'horloge de leur section comme les scies.
 */
export const PRESS_VERSION = 6;
/**
 * Lot 23 : **version 7 = version 6 + champignons rebonds** (`m` `w` `(` `)` de la grille, `Level.mushrooms`). Un champignon est une tuile traversable posée sur
 * un sol, un plafond ou un mur : au contact de son chapeau il donne une impulsion fixe et entière dans la direction du chapeau (vers le haut, le bas, ou
 * l'opposé du mur avec une légère montée), la vitesse parallèle à sa surface est conservée, et un saut **tenu** au contact renforce le rebond (×1,3).
 * Ce n'est ni une tuile solide ni un danger, et il n'a ni horloge ni état. Un niveau sans champignon se joue **exactement** comme en v3, v4, v5 ou v6 : les
 * golden n'ont pas bougé. Les niveaux du jour depuis le générateur g17 sont en v7 ; les morceaux joués seuls restent en v3 (`MODULE_SIM_VERSION`).
 */
export const MUSHROOM_VERSION = 7;
/**
 * Lot 24 : **version 8 = version 7 + stalactites** (`Level.stalactites`, annexe `stalactite`, thème glace). Une stalactite est accrochée à un plafond plein ; elle se déclenche
 * quand le centre du personnage entre dans sa zone, tremble 0,5 s, tombe (table entière) et se brise au contact d'un plein ; elle tue au contact tant qu'elle tremble ou
 * tombe. Son état (`AttemptState.stalactites`, absent sans stalactite) revient à intact à la reprise, comme les blocs friables ; elle n'est pas sur l'horloge. Un niveau
 * sans stalactite se joue **exactement** comme en v3 à v7 : les golden n'ont pas bougé. Les niveaux du jour depuis le générateur g18 sont en v8 ; les morceaux seuls restent en v3.
 */
export const STALACTITE_VERSION = 8;
/**
 * Lot 25 : **version 9 = version 8 + lasers** (`Level.lasers`, `Level.laserBars`, annexes `laser` et `barre`, thème néon). Un **laser fixe** est un rayon horizontal ou vertical
 * entre deux émetteurs posés sur des pleins, allumé ou éteint selon l'horloge (`f(t + phase)`, entière) ; une **barre laser coulissante** est un rayon toujours allumé dont les
 * émetteurs glissent en parallèle sur un trajet en aller-retour (table de ralenti `PLATFORM_EASE`, vitesse plafonnée). Seul le rayon tue. Un niveau sans laser se joue
 * **exactement** comme en v3 à v8 : les golden n'ont pas bougé. Les niveaux du jour depuis le générateur g19 sont en v9 ; les morceaux seuls restent en v3.
 */
export const LASER_VERSION = 9;
/**
 * Lot 26 : **version 10 = version 9 + ponts à interrupteur** (`Level.bridges`, annexe `pont`, thème nuit). Un **interrupteur** (un plein) est relié à un **pont**, une suite de tuiles
 * éteintes (traversables) : quand le personnage se **pose** sur l'interrupteur, tout le pont s'allume (ses tuiles deviennent pleines) ; après un délai d'au moins 1 s, elles
 * **s'éteignent une à une** dans l'ordre du pont, en partant de l'interrupteur, à `BRIDGE_STEP` pas par tuile (≈ 70 % de la vitesse de course) ; se poser de nouveau sur l'interrupteur
 * rallume tout et relance le délai. Son état (`AttemptState.bridges`, absent sans pont) revient à éteint à la reprise, comme les blocs friables ; il n'est pas sur l'horloge. Un niveau
 * sans pont se joue **exactement** comme en v3 à v9 : les golden n'ont pas bougé. Les niveaux du jour depuis le générateur g20 sont en v10 ; les morceaux seuls restent en v3.
 */
export const BRIDGE_VERSION = 10;
/**
 * Lot 27 : **version 11 = version 10 + un nouvel essai à zéro avant le premier point de passage, et la reprise volontaire**. (1) Une mort **avant** le premier point de passage ne fait plus
 * reprendre au départ avec un chrono qui continue (lot 15) : après l'attente (`RESPAWN_TICKS`, pendant laquelle le décor continue de tourner, ce qui masque le changement), l'essai **recommence à
 * zéro** — chrono à 0, horloge des dangers à leur phase de départ, immédiatement, sans décompte. L'essai qui a fini par cette mort est clos (rediffusion, vie). Après le premier point, rien ne change :
 * on reprend au dernier point et le chrono continue. (2) Une **commande de plus**, `INPUT_RESPAWN` (bit 8) : au pas où elle est donnée, un personnage vivant reprend **tout de suite** au dernier
 * point de passage franchi, chrono qui continue (ce pas compris) ; sans point franchi elle est sans effet (le jeu fait alors « recommencer à zéro », qui n'est pas une commande). Ce n'est pas
 * une mort. Dans une rediffusion de version 11, une série est codée `count × 16 + bits` (les rediffusions des versions d'avant gardent `count × 8 + bits`). Les niveaux du jour depuis le générateur g21 sont en v11 ;
 * un niveau sans point de passage ni commande de reprise se joue comme avant, mais ses morts ne reprennent plus au départ : les golden v3 à v10 n'ont pas bougé.
 */
export const RESTART_VERSION = 11;

/**
 * Version du générateur de niveaux du jour. À incrémenter dès que le niveau d'une date change (morceaux, assemblage, règles, solveur) :
 * même règle que `GENERATOR_VERSION` de DailyTrack. 5 depuis le lot 8c (règle de jouabilité humaine : catalogue remesuré et adouci) ;
 * 6 depuis le lot 11 (le thème entre dans le générateur : morceaux des mécaniques tapis et glace, quota de signature, identifiants `-t<thème>`) ;
 * 7 depuis la retouche du lot 11 (jouable au clavier : appui de saut d'au moins `PRESS_MIN` pas, catalogue re-résolu, repos recalculé) ;
 * 8 depuis le lot 12 (nuit et néon ont leur mécanique : morceaux et mutateurs clignotants et alternés, quota de signature, repos, secours) ;
 * 9 depuis le lot 13 (la forêt a ses courants d'air : morceaux et mutateur de vent, quota de signature, repos, secours) ;
 * 10 depuis le lot 15 (horloge unique : niveaux en sim v4, phases des sections calculées sur la référence, validation toutes phases, point de
 * passage sûr à toute phase) ;
 * 11 depuis le lot 16 (seconde voie : zone de bifurcation, cage et galerie de la voie lente sur chaque portion notée 4 ou 5, voies parasites
 * fermées, médailles or / bronze ajustées aux temps rapide et lent) ;
 * 12 depuis le lot 17 (attente maximale de 12 s sur le palier dans la validation toutes phases ; `scie-sol` v3, `cheminee-scie` v3 et
 * `nuit-opposition` v4 corrigées et réadmises) ;
 * 13 depuis le lot 18 (chaque phase d'un bloc clignotant, présente ou absente, dure au moins 1,5 s : les variantes de nuit plus rapides sont
 * refusées et remplacées par des variantes plus lentes ; suite de secours de la nuit) ;
 * 14 depuis le lot 19 (variété : un morceau de base ne revient pas avant `VARIETY_DAYS` jours, par époques bornées, à la place du repos par
 * groupes ; tirages prouvés dans l'ordre de leur score estimé ; mutateurs de silhouette et 37 variantes ajoutées au bout de leurs morceaux) ;
 * 15 depuis le lot 20 (plateformes mobiles : niveaux en sim v5, morceaux à plateformes, règles de trajet) ;
 * 16 depuis le lot 22 (presses : niveaux en sim v6, morceaux de l'usine à presses, règles du générateur) ;
 * 17 depuis le lot 23 (champignons : niveaux en sim v7, morceaux de la forêt à champignons, règles du générateur) ;
 * 18 depuis le lot 24 (stalactites : niveaux en sim v8, morceaux de la glace à stalactites, règles du générateur) ;
 * 19 depuis le lot 25 (lasers : niveaux en sim v9, morceaux du néon à lasers, règles du générateur ; variété `VARIETY_DAYS` = 4) ;
 * 20 depuis le lot 26 (ponts à interrupteur : niveaux en sim v10, morceaux de la nuit à ponts, règles du générateur ; équilibre des mécaniques de chaque thème) ;
 * 21 depuis le lot 27 (niveaux en sim v11 : un nouvel essai à zéro avant le premier point de passage, reprise volontaire ; forêt : le vent souffle en continu, plus de rafales).
 */
export const JUMP_GENERATOR_VERSION = 21;

/** Unités entières par tuile : 16 px × 256 sous-pixels. Tout l'état de la simulation (positions, vitesses par tick) est en unités. */
export const UNITS_PER_TILE = 4096;

/** Les deux entrées d'un morceau (lot 4) : à l'arrêt, ou en élan. Lot 21 : ici (et non dans `modules.ts`) pour que lire l'adresse du jeu ne charge pas le catalogue. */
export const MODULE_ENTRIES = ["arret", "elan"] as const;
export type ModuleEntry = (typeof MODULE_ENTRIES)[number];
/** Longueur du palier standard (lot 6), en tuiles : celle d'un raccord du niveau du jour. Lot 21 : ici, lue par les joueurs fictifs (`demo.ts`) sans le catalogue. */
export const PALIER_LENGTH = 2;
