/** Fréquence de simulation, en pas par seconde (pas fixe : jamais de `dt` variable). */
export const TICK_RATE = 120;

/**
 * Version de la simulation du saut. À incrémenter dès que la physique, un élément de niveau ou un niveau d'essai change le résultat d'un essai
 * (même règle que `SIM_VERSION` de DailyTrack) : les rediffusions d'une autre version ne sont plus rejouables.
 */
export const JUMP_SIM_VERSION = 4;

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
 * groupes ; tirages prouvés dans l'ordre de leur score estimé ; mutateurs de silhouette et 37 variantes ajoutées au bout de leurs morceaux).
 */
export const JUMP_GENERATOR_VERSION = 14;

/** Unités entières par tuile : 16 px × 256 sous-pixels. Tout l'état de la simulation (positions, vitesses par tick) est en unités. */
export const UNITS_PER_TILE = 4096;
