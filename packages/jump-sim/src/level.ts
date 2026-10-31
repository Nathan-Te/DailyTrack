import { JUMP_MICRO_MAX, JUMP_MIN_HOLD, JUMP_SIM_VERSION, MIN_HOLD_VERSION, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, UNITS_PER_TILE } from "./constants";
import { idiv } from "./idiv";

// Un niveau est une grille ASCII, une ligne de texte par rangée de tuiles, la rangée 0 en haut, suivie (après une ligne vide) d'un
// **bloc annexe** facultatif qui déclare les sections et les scies mobiles. `parseLevel` ne fait que lire le texte ; les règles de jeu
// sont dans `player.ts` (le personnage) et `attempt.ts` (dangers, essais, chrono, arrivée).
//
// Légende de la grille (lot 2) :
//   `#` bloc plein · `.` vide · `S` départ · `F` arrivée (ces deux-là sont des tuiles vides repérées)
//   `^` `v` `<` `>` pics, pointe vers le haut / le bas / la gauche / la droite (tuile traversable, boîte mortelle réduite)
//   `o` petite scie fixe (rayon ≈ ½ tuile) · `O` grande scie fixe (rayon ≈ 1,5 tuile), centrées sur leur tuile (traversable)
//   `x` bloc friable (plein, cède `crumbleDelay` pas après le premier contact) · `*` ressort (plein, lance vers le haut qui s'y pose)
//   `[` tapis roulant vers la gauche · `]` tapis roulant vers la droite · `~` glace (lot 11) : blocs pleins dont seule la **face du dessus**
//       agit (le tapis fait avancer, la glace fait glisser) ; leurs murs et leur dessous sont ceux d'un bloc ordinaire
//   `b` `d` **blocs clignotants** (lot 12, thème nuit) : blocs pleins qui apparaissent et disparaissent en rythme. Le cycle est déclaré dans
//       le bloc annexe (`clignote`, ci-dessous) ; `b` est solide pendant la fenêtre déclarée, `d` (le second groupe) **en opposition de
//       phase** : solide pendant le reste du cycle. Un bloc qui devrait devenir solide pendant que le personnage le chevauche **reste
//       traversable jusqu'à ce que le personnage en sorte** : on ne meurt jamais écrasé ni coincé
//   `A` `B` **blocs alternés** (lot 12, thème néon) : deux jeux de blocs pleins dont **exactement un est solide à la fois**. **Chaque saut qui
//       part** (sol, coyote, saut mural, saut gardé dans le tampon qui part vraiment — pas un ressort, pas un simple appui) inverse les deux
//       jeux. Au départ de l'essai, **A est solide** ; **franchir un point de passage** remet A solide, et la mort ramène l'état du point de
//       reprise (donc A). Même règle de sortie que les clignotants
//   `m` `w` `(` `)` **champignons rebonds** (lot 23, thème forêt) : tuiles **traversables** (ni un bloc, ni un danger) posées contre un bloc plein — `m` sur un
//       sol (le chapeau regarde vers le haut), `w` sous un plafond (vers le bas), `)` contre un mur à sa gauche (le chapeau regarde vers la droite), `(` contre un mur
//       à sa droite (vers la gauche) : le renflement du signe est du côté du chapeau. **Au contact** de son chapeau (la moitié de la tuile du côté du chapeau, `mushroomPad`),
//       quand la boîte du personnage commence à la chevaucher, il donne une impulsion entière dans la direction du chapeau (`mushroomBounce`, constantes `MUSHROOM_*`)
//   `C` point de passage (tuile vide repérée, posée sur un sol sûr ; un seul par colonne) : le centre du personnage qui **franchit sa colonne**
//       vers la droite, vivant, à n'importe quelle hauteur, l'active (lot 4) ; à la mort, on reprend sur lui, au sol, chrono qui continue
//
// Bloc annexe (une déclaration par ligne, `//` commente la ligne) :
//   maintien <pas>
//       (lot 30) le maintien minimal du saut du niveau (0 à `MAX_MIN_HOLD`) ; absent : `JUMP_MIN_HOLD` (10) depuis la version 13, 0 avant. Les morceaux joués seuls le
//       déclarent (ils restent en version 3 : une horloge par section) ; un niveau du jour n'a pas besoin de la ligne.
//   version <3|4|5|6|7|8|9>
//       (lot 15) la version de la simulation du niveau (`Level.simVersion`) ; absente : 3. **En v3**, chaque section a son horloge, mise en
//       marche la première fois que le personnage y entre (« phase » d'un élément = pas écoulés depuis, 0 avant) ; **en v4, une seule horloge** :
//       la phase d'un élément vaut `t + phase de sa section` (`t` : le chrono de l'essai), dès avant le départ et sans jamais revenir à zéro.
//   section <nom> <col0>-<col1> [phase <p>]
//       plage de colonnes (bornes comprises), sans chevauchement ; un élément mobile appartient à la section de son premier point. En v3 son
//       cycle démarre la première fois que le personnage y entre ; en v4 (lot 15) il tourne toujours, décalé de `p` pas (0 à `MAX_PHASE`,
//       défaut 0 ; seulement en v4).
//   scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>…
//       rayon : `o`, `O` ou un nombre de tuiles (`0.75`) ; cycle : durée d'un tour complet, en pas (120 = 1 s) ; points de passage : centres
//       de tuiles. `boucle` revient du dernier point au premier ; `aller-retour` repart en sens inverse.
//   clignote <section> <cycle> <solide> <décalage>
//       (lot 12) le cycle des blocs clignotants `b` et `d` de la section : `cycle` pas en tout, `solide` pas où `b` est solide (1 à cycle − 1),
//       `décalage` : position dans le cycle au pas 0 (0 à cycle − 1). Au pas de phase `p` (pas écoulés depuis que le personnage est entré dans
//       la section ; 0 avant), `q = (p + décalage) mod cycle` : `b` est solide si `q < solide`, `d` si `q ≥ solide`. Un bloc `b` ou `d` doit
//       être dans une section qui déclare son cycle.
//   plateforme <id> <largeur> <h|v> <cycle> <col,rangée> <col,rangée>
//       (lot 20, version 5) une **plateforme mobile** : une rangée de `largeur` (2 à 4) tuiles qui fait un aller-retour entre deux positions (le coin
//       haut-gauche de sa première tuile : `col,rangée` du départ, puis de l'autre extrémité), horizontal (`h`, même rangée) ou vertical (`v`, même
//       colonne), en `cycle` pas (pair, 120 à 1 200) : position = `f(phase)` entière, la phase de sa section (comme une scie), **ralentie aux deux
//       extrémités** par une table entière (`PLATFORM_EASE`). **À sens unique** : on se pose dessus par le haut ; on la traverse par-dessous et
//       par les côtés, sans saut mural, sans jamais être écrasé. Posé dessus, le personnage est porté (il reçoit son déplacement à chaque pas) ;
//       au saut il garde sa vitesse horizontale (pas la verticale). Elle n'est pas dans la grille : toutes les tuiles de son trajet sont vides.
//   presse <id> <largeur> <col,rangée> <course> <attente> <chute> <pause> <remontée>
//       (lot 22, version 6, thème usine) une **presse** : un bloc de `largeur` (2 ou 3) tuiles sur `PRESS_HEIGHT_TILES` (2) de haut, qui descend et remonte à la
//       verticale dans une colonne libre. `col,rangée` : le coin haut-gauche de sa position **haute** ; `course` : de combien de tuiles elle descend. Son cycle,
//       en pas, est `attente` (en haut, au moins 120 : 1 s) + `chute` (rapide, table `PRESS_FALL`) + `pause` (en bas) + `remontée` (lente, au moins
//       `PRESS_RISE_FACTOR` fois la chute, table de ralenti `PLATFORM_EASE`). Position = `f(phase)` de sa section, **entière et pure**, exactement en haut à la
//       phase 0 de chaque cycle. **Toute la presse tue au contact** (`DEATH_PRESS`) : on ne monte pas dessus, elle ne pousse ni n'écrase physiquement, elle
//       n'est pas dans la grille (toute la colonne de sa course est vide). Le sol sous sa position basse est une règle du générateur (`presses.ts`).
//   stalactite <id> <col,rangée> <avant> <après>
//       (lot 24, version 8, thème glace) une **stalactite** : un pic de glace de `STALACTITE_TILES` (2) tuiles de haut accroché à un plafond plein (la tuile au-dessus de
//       `col,rangée` est un bloc plein, les deux tuiles du corps sont vides). **Elle se déclenche** quand le centre du personnage entre dans sa **zone** : les colonnes
//       `col − avant` à `col + après` (1 à `STALACTITE_MAX_REACH` de chaque côté), à hauteur de son corps ou plus bas. Déclenchée, elle **tremble**
//       `STALACTITE_SHAKE_TICKS` pas (0,5 s, sans bouger), **tombe** en accélérant (`STALACTITE_DROP`, table entière) puis **se brise** au premier contact avec un bloc
//       plein (ou en sortant de la grille) et disparaît. **Elle tue au contact tant qu'elle tremble ou tombe** (`DEATH_STALACTITE`) ; intacte ou brisée, elle ne tue pas.
//       Elle n'est pas sur l'horloge : son état (`AttemptState.stalactites`) revient à intact à la reprise, comme les blocs friables. Rien n'est dans la grille.
//   laser <id> <h|v> <col,rangée> <longueur> <cycle> <allumé> <décalage>
//       (lot 25, version 9, thème néon) un **laser fixe** : un rayon horizontal (`h`) ou vertical (`v`) de `longueur` (1 à `LASER_MAX_LENGTH`) tuiles dont la première est
//       `col,rangée`, **entre deux émetteurs posés sur des pleins** : les deux tuiles qui le bornent (avant la première, après la dernière) sont des blocs pleins `#`, les tuiles
//       du rayon sont vides. Allumé ou éteint selon l'horloge de sa section (`f(t + phase)`, entière) : au chrono de section `p`, `q = (p + décalage) mod cycle`, il est
//       **allumé pour `q < allumé`**. Chaque phase dure au moins `LASER_MIN_OFF` (1 s) éteinte et `LASER_MIN_ON` (0,75 s) allumée. **Allumé, le rayon tue au contact**
//       (`DEATH_LASER`, une bande de `LASER_THICKNESS` au milieu de ses tuiles) ; éteint, on le traverse. Les émetteurs sont des pleins inoffensifs.
//   barre <id> <h|v> <longueur> <cycle> <col,rangée> <col,rangée>
//       (lot 25, version 9, thème néon) une **barre laser coulissante** : un rayon toujours allumé de `longueur` (2 à `LASER_BAR_MAX_LENGTH`) tuiles, horizontal (`h`) ou vertical
//       (`v`), dont les deux émetteurs glissent **en parallèle** (le rayon reste parallèle à lui-même) perpendiculairement à sa longueur, d'une position à l'autre (le coin
//       haut-gauche de sa première tuile : `col,rangée` du départ, puis de l'autre extrémité — même colonne pour `h`, même rangée pour `v`), en aller-retour de `cycle` pas (pair,
//       `LASER_BAR_MIN_CYCLE` à `LASER_BAR_MAX_CYCLE`) : position = `f(phase)` entière, **ralentie aux deux extrémités** par `PLATFORM_EASE`, vitesse de pointe sous `MAX_LASER_STEP`.
//       Toutes les tuiles de son trajet sont vides. **Seul le rayon tue** ; les émetteurs, dessinés aux deux bouts, ne bloquent ni ne tuent (aucun plein mobile).
//   pont <id> <délai> <col,rangée> <tuiles>…
//       (lot 26, version 10, thème nuit) un **pont à interrupteur** : `col,rangée` est l'**interrupteur**, une tuile au sol (un bloc plein `#`) ; `tuiles` sont les tuiles du pont **dans
//       l'ordre où il s'éteint**, en partant de l'interrupteur : `c,r` une tuile, `c0-c1,r` une rangée (de `c0` à `c1`, dans ce sens), `c,r0-r1` une colonne (de `r0` à `r1`) ; droit,
//       en marches ou coudé selon ce qu'on écrit (au plus `BRIDGE_MAX_TILES`). Toutes sont **vides** dans la grille : éteint, le pont se traverse comme du vide. Quand le personnage
//       **se pose** sur l'interrupteur (il y arrive au sol alors qu'il n'y était pas au pas d'avant), tout le pont s'allume : ses tuiles deviennent pleines. Après `délai` pas
//       (`BRIDGE_MIN_DELAY` : 1 s au moins), elles s'éteignent **une à une** : la tuile de rang `k` reste pleine `délai + k × BRIDGE_STEP` pas depuis l'allumage. Se poser de nouveau
//       sur l'interrupteur rallume tout le pont et relance le délai. Une tuile qui s'éteint sous le personnage le laisse tomber. Pas sur l'horloge : son état (`AttemptState.bridges`)
//       revient à éteint à la reprise, comme les blocs friables.
//   vent <col0>-<col1> <rang0>-<rang1> <haut|gauche|droite> <force> [rafale <cycle> <actif> <décalage>]
//       (lot 13, thème forêt) une **zone de vent** : un rectangle de tuiles (bornes comprises), **traversable** (ce n'est pas un bloc), qui
//       pousse le personnage tant que **le centre** de sa boîte y est, au sol comme en l'air. `haut` : une accélération verticale qui compense
//       la gravité et au-delà, jusqu'à une vitesse de montée `windRise` (on plane, on se fait porter) ; `gauche` / `droite` : une accélération
//       horizontale jusqu'à une vitesse de dérive `windDrift`, qui s'ajoute à la commande (comme un tapis). `force` : en pourcentage des
//       réglages (`WIND_MIN_FORCE` à `WIND_MAX_FORCE`, 100 = les réglages tels quels). En sortant de la zone, la vitesse acquise est gardée et la
//       physique ordinaire reprend. Sans `rafale`, la zone souffle toujours ; avec, elle souffle `actif` pas sur `cycle`, décalée de
//       `décalage` : au pas de phase `p` de la section de sa première colonne (pas écoulés depuis que le personnage y est entré ; 0 avant),
//       `q = (p + décalage) mod cycle`, elle souffle si `q < actif`. La mort et la reprise remettent l'horloge à zéro (comme les scies). Deux
//       zones ne se chevauchent pas ; une zone en rafale doit être dans une section.

export const TILE_EMPTY = 0;
export const TILE_SOLID = 1;
/** Bloc friable `x` : plein tant qu'il n'est pas tombé. */
export const TILE_CRUMBLE = 2;
/** Ressort `*` : plein ; s'y poser lance vers le haut. */
export const TILE_SPRING = 3;
/** Pics : la pointe vers le haut `^`, le bas `v`, la gauche `<`, la droite `>`. */
export const TILE_SPIKE_UP = 4;
export const TILE_SPIKE_DOWN = 5;
export const TILE_SPIKE_LEFT = 6;
export const TILE_SPIKE_RIGHT = 7;
/** Lot 11 : tapis roulant vers la gauche `[`, vers la droite `]`, glace `~` (blocs pleins à face du dessus particulière). */
export const TILE_BELT_LEFT = 8;
export const TILE_BELT_RIGHT = 9;
export const TILE_ICE = 10;
/**
 * Lot 12 : blocs clignotants (`b`, `d`) et alternés (`A`, `B`). Le code d'une tuile de `Level.tiles` et de `AttemptState.tiles` est son **état
 * actuel** : plein (`…_ON`) ou absent (`…_OFF`, traversable) ; à quel groupe elle appartient se lit dans `Level.blinks` / `Level.alts`.
 */
export const TILE_BLINK_ON = 11;
export const TILE_BLINK_OFF = 12;
export const TILE_ALT_ON = 13;
export const TILE_ALT_OFF = 14;
/**
 * Lot 26 : une tuile de pont allumée (pleine). Éteinte, c'est `TILE_EMPTY` : dans `Level.tiles` (et pour le dessin des blocs) les tuiles d'un pont sont toujours vides ; `AttemptState.tiles`
 * y met `TILE_BRIDGE_ON` tant que la tuile est allumée (`settleBridges`).
 */
export const TILE_BRIDGE_ON = 15;
export type Tile = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/** Vrai pour une tuile qui arrête le personnage : bloc plein, bloc friable (pas encore tombé), ressort, tapis, glace, bloc clignotant ou alterné présent. */
export function isSolidTile(t: number): boolean {
  return (t >= TILE_SOLID && t <= TILE_SPRING) || (t >= TILE_BELT_LEFT && t <= TILE_ICE) || t === TILE_BLINK_ON || t === TILE_ALT_ON || t === TILE_BRIDGE_ON;
}

/** Vrai pour un bloc clignotant ou alterné (présent ou absent). */
export function isDynamicTile(t: number): boolean {
  return t >= TILE_BLINK_ON && t <= TILE_ALT_OFF;
}

/** Vrai pour un tapis roulant (l'un ou l'autre sens). */
export function isBeltTile(t: number): boolean {
  return t === TILE_BELT_LEFT || t === TILE_BELT_RIGHT;
}

/** Vrai pour un pic (n'importe quelle orientation). */
export function isSpikeTile(t: number): boolean {
  return t >= TILE_SPIKE_UP && t <= TILE_SPIKE_RIGHT;
}

/**
 * Taille maximale d'un niveau, en tuiles. Bornes choisies pour que tous les calculs entiers restent exacts : coordonnées sur 32 bits
 * (`tileOf`), distances au carré des scies et interpolations des trajets sous `Number.MAX_SAFE_INTEGER` (test « bornes »).
 */
export const MAX_LEVEL_WIDTH = 2048;
export const MAX_LEVEL_HEIGHT = 512;
/** Au plus ce nombre de points de passage par scie mobile, et ce cycle (10 minutes). */
export const MAX_SAW_POINTS = 32;
export const MAX_SAW_CYCLE = 72_000;
/** Rayon maximal d'une scie : 4 tuiles. */
export const MAX_SAW_RADIUS = 4 * UNITS_PER_TILE;
/** Lot 12 : cycle d'un bloc clignotant, en pas : de 2 à 1 200 (10 s). */
export const MIN_BLINK_CYCLE = 2;
export const MAX_BLINK_CYCLE = 1200;
/** Lot 13 : force d'une zone de vent, en % des réglages (`windAccel`, `windRise`, `windDrift`), et cycle d'une rafale (de 2 pas à 10 s). */
export const WIND_MIN_FORCE = 25;
export const WIND_MAX_FORCE = 200;
export const MIN_GUST_CYCLE = 2;
export const MAX_GUST_CYCLE = 1200;

/**
 * Rayon **mortel** des scies fixes, en unités. Un peu moins que le dessin : le disque plein a ce rayon, les dents le dépassent
 * (`o` : 7/16 de tuile, dents jusqu'à ½ ; `O` : 11/8, dents jusqu'à 1,5). Toucher une dent ne tue pas, toucher le disque tue.
 */
export const SAW_SMALL_RADIUS = 1792;
export const SAW_BIG_RADIUS = 5632;

/** Une tuile, par colonne (de gauche à droite) et rangée (de haut en bas). */
export interface Cell {
  col: number;
  row: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Section {
  name: string;
  /** Colonnes couvertes, bornes comprises. */
  c0: number;
  c1: number;
  /** Lot 15, niveau v4 : décalage de l'horloge de la section, en pas (phase d'un élément = `t + phase`) ; toujours 0 en v3. */
  phase: number;
}

/** Lot 15 : plus grand décalage d'une section (en pas) : le chrono plus la phase restent des entiers exacts. */
export const MAX_PHASE = 1_000_000_000;
/** Lot 30 : le plus grand maintien minimal déclarable (`maintien <n>`). */
export const MAX_MIN_HOLD = 60;

/** Lot 15 : `v mod n` toujours dans [0, n) (aussi pour `v` négatif : l'affichage avant le départ), entier, jamais −0. */
export function cycleMod(v: number, n: number): number {
  const r = v % n;
  return r < 0 ? r + n : r + 0;
}

export type SawMode = "fixe" | "aller-retour" | "boucle";

export interface Saw {
  /** Identifiant (`o3`, `O7` pour une scie fixe : sa lettre et son rang dans la grille). */
  id: string;
  /** Rayon mortel, unités. */
  radius: number;
  mode: SawMode;
  /** Points de passage déclarés (centres, unités). */
  points: readonly Point[];
  /** Durée d'un cycle, en pas (0 pour une scie fixe). */
  cycle: number;
  /** Section qui la met en marche (indice dans `Level.sections`), −1 pour une scie fixe. */
  section: number;
  /** Trajet fermé parcouru en un cycle : `nodes[0] … nodes[n−1]` puis retour à `nodes[0]` ; `times[k]` = pas où l'on passe au nœud k. */
  nodes: readonly Point[];
  times: readonly number[];
}

/** Lot 12 : le cycle des blocs clignotants d'une section (`clignote`, voir l'en-tête). */
export interface BlinkCycle {
  cycle: number;
  solid: number;
  shift: number;
}

/** Lot 12 : un bloc clignotant. `group` : 0 pour `b`, 1 pour `d` (en opposition de phase) ; `section` : indice dans `Level.sections`. */
export interface BlinkBlock {
  col: number;
  row: number;
  group: number;
  section: number;
}

/** Lot 12 : un bloc alterné. `set` : 0 pour `A` (solide au départ), 1 pour `B`. */
export interface AltBlock {
  col: number;
  row: number;
  set: number;
}

/** Lot 13 : sens d'une zone de vent. */
export const WIND_UP = 1;
export const WIND_LEFT = 2;
export const WIND_RIGHT = 3;
export const WIND_DIR_NAMES = ["", "haut", "gauche", "droite"] as const;

/** Lot 13 : une rafale (`rafale <cycle> <actif> <décalage>`, voir l'en-tête). */
export interface Gust {
  cycle: number;
  active: number;
  shift: number;
}

/** Lot 13 : une zone de vent (traversable). Colonnes et rangées bornes comprises ; `section` : celle de sa première colonne (−1 : aucune). */
export interface WindZone {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  /** `WIND_UP`, `WIND_LEFT` ou `WIND_RIGHT`. */
  dir: number;
  /** En % des réglages. */
  force: number;
  /** null : souffle toujours. */
  gust: Gust | null;
  section: number;
}

/** Lot 20 : largeur d'une plateforme mobile, en tuiles ; cycle d'un aller-retour (pas, pair) ; trajet (tuiles) ; déplacement maximal par pas (unités). */
export const PLATFORM_MIN_WIDTH = 2;
export const PLATFORM_MAX_WIDTH = 4;
export const MIN_PLATFORM_CYCLE = 120;
export const MAX_PLATFORM_CYCLE = 1200;
export const MAX_PLATFORM_TRAVEL = 12;
export const MAX_PLATFORM_STEP = 256;

/** Lot 20 : le nombre d'intervalles de la table de ralenti, et la valeur d'arrivée (le trajet entier). */
export const PLATFORM_EASE_STEPS = 64;
export const PLATFORM_EASE_ONE = 4096;

/**
 * Lot 20 : la **table de ralenti** d'une plateforme (entiers, 65 valeurs de 0 à 4 096) : `3k² − k³/32` tronqué, soit la courbe 3u² − 2u³ (u = k/64) :
 * elle démarre et finit presque à l'arrêt (2, 11, 26, 46… sur 4 096 pour les premiers intervalles) et va vite au milieu (environ 96 par intervalle).
 * Écrite en dur, aucun calcul à virgule ; `test/plateformes.test.ts` vérifie la formule.
 */
export const PLATFORM_EASE: readonly number[] = Object.freeze([
  0, 2, 11, 26, 46, 71, 101, 136, 176, 220, 268, 321, 378, 438, 502, 569,
  640, 713, 789, 868, 950, 1033, 1119, 1206, 1296, 1386, 1478, 1571, 1666, 1760, 1856, 1952,
  2048, 2143, 2239, 2335, 2430, 2524, 2617, 2709, 2800, 2889, 2976, 3062, 3146, 3227, 3306, 3382,
  3456, 3526, 3593, 3657, 3718, 3774, 3827, 3875, 3920, 3959, 3994, 4024, 4050, 4069, 4084, 4093,
  4096,
]);

/** Lot 20 : une plateforme mobile (voir l'en-tête). `a` et `b` : les deux positions extrêmes (coin haut-gauche de sa première tuile, en tuiles). */
export interface Platform {
  id: string;
  /** Largeur en tuiles (2 à 4). */
  width: number;
  /** `h` : va et vient sur sa rangée ; `v` : sur sa colonne. */
  axis: "h" | "v";
  /** Un aller-retour, en pas (pair). */
  cycle: number;
  a: Cell;
  b: Cell;
  /** Section dont elle suit l'horloge (indice dans `Level.sections`). */
  section: number;
}

/** Lot 22 : largeur d'une presse (tuiles), hauteur (tuiles), course (tuiles), durées (pas) et pas maximal de la chute (unités). */
export const PRESS_MIN_WIDTH = 2;
export const PRESS_MAX_WIDTH = 3;
export const PRESS_HEIGHT_TILES = 2;
export const PRESS_MIN_TRAVEL = 2;
export const PRESS_MAX_TRAVEL = 8;
/** Attente en haut : au moins 1 s (le joueur lit l'annonce et passe), au plus 5 s. */
export const PRESS_MIN_HOLD = 120;
export const PRESS_MAX_HOLD = 600;
/** Chute : de 0,15 s à 0,5 s ; pause en bas : de 0,25 s à 2 s ; remontée : au moins `PRESS_RISE_FACTOR` fois la chute (nettement plus lente), au plus 5 s. */
export const PRESS_MIN_FALL = 18;
export const PRESS_MAX_FALL = 60;
export const PRESS_MIN_REST = 30;
export const PRESS_MAX_REST = 240;
export const PRESS_RISE_FACTOR = 3;
export const PRESS_MAX_RISE = 600;
export const PRESS_MAX_CYCLE = 1200;
/** Déplacement maximal par pas à la fin de la chute : trois quarts de tuile (la presse, haute de 2 tuiles, n'enjambe jamais le personnage entre deux pas). */
export const MAX_PRESS_STEP = 3 * (UNITS_PER_TILE / 4);

/** Lot 23 : orientation d'un champignon = la direction de son chapeau (il y envoie le personnage). */
export const MUSHROOM_UP = 1;
export const MUSHROOM_DOWN = 2;
export const MUSHROOM_RIGHT = 3;
export const MUSHROOM_LEFT = 4;
/** Caractère de la grille de chaque orientation (`m` sol, `w` plafond, `)` mur à gauche, `(` mur à droite) et nom pour l'affichage et les outils. */
export const MUSHROOM_CHARS = ["", "m", "w", ")", "("] as const;
export const MUSHROOM_NAMES = ["", "sol", "plafond", "mur gauche", "mur droit"] as const;
/**
 * Lot 23 : les impulsions (unités/pas), **fixes et entières**. Au sol : 900 vers le haut (≈ 5,2 tuiles, un saut normal en fait 800 : ≈ 4,2) ; au plafond : 700 vers
 * le bas ; au mur : 460 à l'opposé du mur (13,5 tuiles/s, au-dessus de la course) et une légère montée de 420 (≈ 1,1 tuile). Un saut **tenu** au contact (le bit de saut
 * de la commande, à ce pas) multiplie le tout par `MUSHROOM_BOOST_PERCENT` / 100 (×1,3 : 1 170 vers le haut, ≈ 8,8 tuiles, mais la courbe se lit avant tout comme une
 * hauteur nettement plus grande que celle du rebond simple). Tous restent sous `MAX_SPEED`.
 */
export const MUSHROOM_UP_SPEED = 900;
export const MUSHROOM_DOWN_SPEED = 700;
export const MUSHROOM_SIDE_SPEED = 460;
export const MUSHROOM_RISE_SPEED = 420;
export const MUSHROOM_BOOST_PERCENT = 130;
/** Lot 23 : le chapeau est la moitié de la tuile du côté de sa direction : c'est là que le contact compte. */
export const MUSHROOM_PAD = UNITS_PER_TILE / 2;

/** Lot 23 : un champignon (tuile de la grille). `dir` : `MUSHROOM_UP`, `_DOWN`, `_RIGHT` ou `_LEFT`. */
export interface Mushroom {
  col: number;
  row: number;
  dir: number;
}

/**
 * Lot 23 : la zone de contact d'un champignon (unités) : la moitié de sa tuile du côté du chapeau, sur toute la largeur de la tuile. Un champignon de sol est
 * touché par le haut (on s'y pose) ou en y entrant de côté ; un champignon de mur, en s'en approchant.
 */
export function mushroomPad(m: Mushroom): { x: number; y: number; w: number; h: number } {
  const T = UNITS_PER_TILE;
  const x = m.col * T;
  const y = m.row * T;
  switch (m.dir) {
    case MUSHROOM_UP:
      return { x, y, w: T, h: MUSHROOM_PAD };
    case MUSHROOM_DOWN:
      return { x, y: y + T - MUSHROOM_PAD, w: T, h: MUSHROOM_PAD };
    case MUSHROOM_RIGHT:
      return { x: x + T - MUSHROOM_PAD, y, w: MUSHROOM_PAD, h: T };
    case MUSHROOM_LEFT:
      return { x, y, w: MUSHROOM_PAD, h: T };
    default:
      throw new RangeError(`mushroomPad : l'orientation ${m.dir} n'existe pas`);
  }
}

/** Lot 24 : hauteur du corps d'une stalactite (tuiles), retrait de chaque côté de sa boîte mortelle (unités : elle est plus étroite que la tuile) et portée maximale de la zone de chaque côté (colonnes). */
export const STALACTITE_TILES = 2;
export const STALACTITE_INSET = 1024;
export const STALACTITE_MAX_REACH = 8;
/** Lot 24 : le tremblement d'une stalactite déclenchée dure 60 pas (0,5 s) avant qu'elle ne tombe : le point de départ du lot, une constante de la simulation. */
export const STALACTITE_SHAKE_TICKS = 60;
/** Lot 24 : vitesse de chute maximale (unités/pas, un quart de tuile : le corps, haut de 2 tuiles, n'enjambe jamais un bloc ni le personnage entre deux pas). */
export const STALACTITE_MAX_STEP = 1024;
/** Lot 24 : accélération de la chute (unités/pas²). */
export const STALACTITE_ACCEL = 24;
/**
 * Lot 24 : la **table de chute** d'une stalactite (entiers) : `STALACTITE_DROP[k]` = de combien elle est descendue (unités) `k` pas après le début de la chute. La vitesse
 * du pas `i` est `min(i × STALACTITE_ACCEL, STALACTITE_MAX_STEP)` : elle part presque à l'arrêt et accélère jusqu'à 30 tuiles/s. Au-delà de la table, 1 024 par pas.
 * Calculée par des additions d'entiers : aucun flottant.
 */
export const STALACTITE_DROP: readonly number[] = Object.freeze(
  (() => {
    const out = [0];
    for (let i = 1; i * STALACTITE_ACCEL < STALACTITE_MAX_STEP + STALACTITE_ACCEL; i++) out.push(out[i - 1]! + Math.min(i * STALACTITE_ACCEL, STALACTITE_MAX_STEP));
    return out;
  })(),
);

/** Lot 24 : une stalactite (voir l'en-tête). `col`, `row` : la tuile de la pointe haute du corps (sous le plafond) ; zone de déclenchement : `col − before` à `col + after`. */
export interface Stalactite {
  id: string;
  col: number;
  row: number;
  before: number;
  after: number;
}

/**
 * Lot 24 : de combien une stalactite d'âge `age` est descendue (unités). `age` : pas écoulés depuis son déclenchement (1 au pas du déclenchement). Elle ne bouge pas
 * pendant les `STALACTITE_SHAKE_TICKS` premiers pas, puis tombe selon `STALACTITE_DROP`. Entière et pure.
 */
export function stalactiteOffset(age: number): number {
  const k = age - STALACTITE_SHAKE_TICKS;
  if (k <= 0) return 0;
  const last = STALACTITE_DROP.length - 1;
  return k <= last ? STALACTITE_DROP[k]! : STALACTITE_DROP[last]! + (k - last) * STALACTITE_MAX_STEP;
}

/** Lot 24 : la boîte mortelle d'une stalactite descendue de `offset` unités : le corps entier (2 tuiles de haut), retiré de `STALACTITE_INSET` de chaque côté. */
export function stalactiteBox(s: Pick<Stalactite, "col" | "row">, offset: number): { x: number; y: number; w: number; h: number } {
  return { x: s.col * UNITS_PER_TILE + STALACTITE_INSET, y: s.row * UNITS_PER_TILE + offset, w: UNITS_PER_TILE - 2 * STALACTITE_INSET, h: STALACTITE_TILES * UNITS_PER_TILE };
}

/**
 * Lot 25 : lasers. L'épaisseur de la bande mortelle d'un rayon (unités : un quart de tuile, centrée sur la rangée ou la colonne de ses tuiles), la longueur d'un laser fixe
 * (tuiles), ses durées minimales (pas : 0,75 s allumé, 1 s éteint) et son cycle maximal ; pour la barre coulissante : longueur, trajet (tuiles), cycle (pair) et déplacement
 * maximal par pas à la pointe de sa vitesse (160 unités = 4,7 tuiles/s, moins de la moitié de la course à 11 tuiles/s et sous le plafond des plateformes, 256 : un rayon qui tue
 * ne doit pas rattraper un joueur qui s'écarte).
 */
export const LASER_THICKNESS = 1024;
export const LASER_MIN_LENGTH = 1;
export const LASER_MAX_LENGTH = 12;
export const LASER_MIN_ON = 90;
export const LASER_MIN_OFF = 120;
export const LASER_MAX_CYCLE = 1200;
export const LASER_BAR_MIN_LENGTH = 2;
export const LASER_BAR_MAX_LENGTH = 8;
export const LASER_BAR_MAX_TRAVEL = 8;
export const LASER_BAR_MIN_CYCLE = 240;
export const LASER_BAR_MAX_CYCLE = 1200;
export const MAX_LASER_STEP = 160;

/** Lot 25 : un laser fixe (voir l'en-tête). `col`, `row` : la première tuile du rayon ; `on` : pas allumés par cycle ; `shift` : position dans le cycle à la phase 0. */
export interface Laser {
  id: string;
  axis: "h" | "v";
  col: number;
  row: number;
  length: number;
  cycle: number;
  on: number;
  shift: number;
  /** Section dont il suit l'horloge (indice dans `Level.sections`). */
  section: number;
}

/** Lot 25 : une barre laser coulissante (voir l'en-tête). `a` et `b` : les deux positions extrêmes (coin haut-gauche de la première tuile du rayon). */
export interface LaserBar {
  id: string;
  axis: "h" | "v";
  length: number;
  cycle: number;
  a: Cell;
  b: Cell;
  section: number;
}

/**
 * Lot 26 : ponts à interrupteur. Délai minimal avant la première extinction (pas : 1 s), pas entre deux extinctions (pas par tuile : 16 pas = 7,5 tuiles/s, soit 68 % de la
 * vitesse de course de 11 tuiles/s — « environ 70 % », point de départ du lot, une constante de la simulation), longueur et délai maximaux.
 */
export const BRIDGE_MIN_DELAY = 120;
export const BRIDGE_MAX_DELAY = 1200;
export const BRIDGE_STEP = 16;
export const BRIDGE_MAX_TILES = 24;

/** Lot 26 : un pont à interrupteur (voir l'en-tête). `tiles` : dans l'ordre où le pont s'éteint, en partant de l'interrupteur ; `delay` : pas avant la première extinction. */
export interface Bridge {
  id: string;
  switchCol: number;
  switchRow: number;
  delay: number;
  tiles: readonly Cell[];
}

/**
 * Lot 26 : la tuile de rang `k` d'un pont allumé depuis `age` pas est-elle pleine ? `age` : 1 au pas où il s'allume, 0 : éteint (jamais allumé, ou tout éteint). Pleine pour
 * `age` de 1 à `délai + k × BRIDGE_STEP`. Pure, entière.
 */
export function bridgeTileLit(b: Pick<Bridge, "delay">, age: number, k: number): boolean {
  return age > 0 && age <= b.delay + k * BRIDGE_STEP;
}

/** Lot 26 : l'âge à partir duquel tout le pont est éteint (la dernière tuile s'éteint juste après) : `délai + (longueur − 1) × BRIDGE_STEP`. */
export function bridgeLastLit(b: Pick<Bridge, "delay" | "tiles">): number {
  return b.delay + (b.tiles.length - 1) * BRIDGE_STEP;
}

/**
 * Lot 22 : la **table de chute** d'une presse (entiers, 65 valeurs de 0 à 4 096) : `k²` pour `k` de 0 à 64, la chute libre — la presse part presque à
 * l'arrêt et frappe à pleine vitesse (127 sur 4 096 pour le dernier intervalle, soit 2 fois la moyenne). Écrite par `k * k` : aucun flottant,
 * `test/presses.test.ts` la compare à la formule. La remontée lit `PLATFORM_EASE` (démarrage doux, fin douce), à l'envers.
 */
export const PRESS_FALL: readonly number[] = Object.freeze(Array.from({ length: PLATFORM_EASE_STEPS + 1 }, (_, k) => k * k));

/** Lot 22 : une presse (voir l'en-tête). Colonnes et rangées en tuiles (coin haut-gauche de la position haute) ; durées en pas. */
export interface Press {
  id: string;
  /** Largeur en tuiles (2 ou 3). */
  width: number;
  col: number;
  row: number;
  /** Tuiles de descente. */
  travel: number;
  /** Attente en haut, chute, pause en bas, remontée (pas). */
  hold: number;
  fall: number;
  rest: number;
  rise: number;
  /** `hold + fall + rest + rise`. */
  cycle: number;
  /** Section dont elle suit l'horloge (indice dans `Level.sections`). */
  section: number;
}

export interface Level {
  /** Lot 15 : la version de la simulation du niveau (3 : une horloge par section ; 4 : une seule horloge de course). */
  simVersion: number;
  /**
   * Lot 30 : le **maintien minimal du saut** du niveau (pas) : un saut relâché avant ce nombre de pas continue comme s'il était tenu jusque-là (`stepPlayerJump`).
   * 0 avant la version 13 ; `JUMP_MIN_HOLD` depuis, sauf déclaration `maintien <n>` du bloc annexe (les morceaux joués seuls, qui restent en version 3).
   */
  minHold: number;
  /** Lot 30 : le micro-saut du niveau (pas) : un appui de ce nombre de pas ou moins n'est pas prolongé par le maintien minimal. `JUMP_MICRO_MAX` avec un maintien, 0 sans. */
  microMax: number;
  width: number;
  height: number;
  /** Rangée par rangée, la rangée 0 en haut : `tiles[row * width + col]`, codes `TILE_*` (l'état initial des blocs friables). */
  tiles: readonly number[];
  start: Cell;
  finish: Cell;
  sections: readonly Section[];
  /** Scies fixes (dans l'ordre de lecture de la grille) puis mobiles (dans l'ordre du bloc annexe). */
  saws: readonly Saw[];
  /** Blocs friables, dans l'ordre de lecture ; `crumbleIndex[row * width + col]` = leur rang, −1 ailleurs. */
  crumbles: readonly Cell[];
  crumbleIndex: readonly number[];
  /** Points de passage `C` (lot 2b), de gauche à droite (ordre du parcours), un par colonne au plus (lot 4). */
  checkpoints: readonly Cell[];
  /** Lot 12 : blocs clignotants (ordre de lecture) et le cycle déclaré de chaque section (`null` : aucun) ; vides sans ces blocs. */
  blinks: readonly BlinkBlock[];
  blinkCycles: readonly (BlinkCycle | null)[];
  /** Lot 12 : blocs alternés (ordre de lecture). */
  alts: readonly AltBlock[];
  /** Lot 13 : zones de vent (ordre du bloc annexe) ; vide sans vent. */
  winds: readonly WindZone[];
  /** Lot 20 : plateformes mobiles (ordre du bloc annexe) ; vide sans plateforme. */
  platforms: readonly Platform[];
  /** Lot 22 : presses (ordre du bloc annexe) ; vide sans presse. */
  presses: readonly Press[];
  /** Lot 23 : champignons (ordre de lecture de la grille) ; vide sans champignon. Leur tuile est vide dans `tiles`. */
  mushrooms: readonly Mushroom[];
  /** Lot 24 : stalactites (ordre du bloc annexe) ; vide sans stalactite. */
  stalactites: readonly Stalactite[];
  /** Lot 25 : lasers fixes (ordre du bloc annexe) ; vide sans laser. Leurs tuiles sont vides dans `tiles` ; leurs émetteurs sont des blocs pleins. */
  lasers: readonly Laser[];
  /** Lot 25 : barres laser coulissantes (ordre du bloc annexe) ; vide sans barre. */
  laserBars: readonly LaserBar[];
  /** Lot 26 : ponts à interrupteur (ordre du bloc annexe) ; vide sans pont. Leurs tuiles sont vides dans `tiles` ; leur interrupteur est un bloc plein. */
  bridges: readonly Bridge[];
}

export class LevelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LevelError";
  }
}

const GRID_CODES: Record<string, number> = {
  "#": TILE_SOLID,
  ".": TILE_EMPTY,
  S: TILE_EMPTY,
  F: TILE_EMPTY,
  C: TILE_EMPTY,
  m: TILE_EMPTY,
  w: TILE_EMPTY,
  ")": TILE_EMPTY,
  "(": TILE_EMPTY,
  o: TILE_EMPTY,
  O: TILE_EMPTY,
  x: TILE_CRUMBLE,
  "*": TILE_SPRING,
  "[": TILE_BELT_LEFT,
  "]": TILE_BELT_RIGHT,
  "~": TILE_ICE,
  b: TILE_BLINK_ON,
  d: TILE_BLINK_ON,
  A: TILE_ALT_ON,
  B: TILE_ALT_OFF,
  "^": TILE_SPIKE_UP,
  v: TILE_SPIKE_DOWN,
  "<": TILE_SPIKE_LEFT,
  ">": TILE_SPIKE_RIGHT,
};

const half = idiv(UNITS_PER_TILE, 2);
const centerOf = (col: number, row: number): Point => ({ x: col * UNITS_PER_TILE + half, y: row * UNITS_PER_TILE + half });

/** Nombre de tuiles écrit en décimal (`1.5`, `0.4375`) → unités, arrondi au plus proche, sans flottant. */
function tilesToUnits(text: string, where: string): number {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text);
  if (!m) throw new LevelError(`${where} : « ${text} » n'est pas un nombre de tuiles`);
  const frac = m[2] ?? "";
  let den = 1;
  for (let i = 0; i < frac.length; i++) den *= 10;
  const num = Number(m[1]) * den + (frac ? Number(frac) : 0);
  return idiv(num * UNITS_PER_TILE * 2 + den, den * 2);
}

/** Trajet fermé d'une scie mobile et pas de passage à chaque nœud (temps proportionnels aux longueurs, en distance de Manhattan). */
function sawPath(points: readonly Point[], mode: SawMode, cycle: number): { nodes: Point[]; times: number[] } {
  const nodes = mode === "aller-retour" ? [...points, ...points.slice(1, -1).reverse()] : [...points];
  const lengths: number[] = [];
  let total = 0;
  for (let k = 0; k < nodes.length; k++) {
    const a = nodes[k]!;
    const b = nodes[(k + 1) % nodes.length]!;
    const len = (a.x > b.x ? a.x - b.x : b.x - a.x) + (a.y > b.y ? a.y - b.y : b.y - a.y);
    lengths.push(len);
    total += len;
  }
  const times = [0];
  let cum = 0;
  for (let k = 0; k < nodes.length; k++) {
    cum += lengths[k]!;
    times.push(total === 0 ? cycle : idiv(cycle * cum, total));
  }
  return { nodes, times };
}

/**
 * Lit un niveau : la grille, puis le bloc annexe. Refuse tout ce qui est mal formé (lignes de longueurs différentes, caractère inconnu,
 * pas exactement un `S` et un `F`, niveau trop grand, déclaration inconnue, section qui chevauche, scie hors section…).
 */
export function parseLevel(text: string): Level {
  const all = text.replace(/\r/g, "").split("\n");
  while (all.length > 0 && all[0]!.trim() === "") all.shift();
  while (all.length > 0 && all[all.length - 1]!.trim() === "") all.pop();
  if (all.length === 0) throw new LevelError("Niveau vide");
  let end = all.findIndex((l) => l.trim() === "");
  if (end < 0) end = all.length;
  const lines = all.slice(0, end);
  const annex = all.slice(end);

  const width = lines[0]!.length;
  const height = lines.length;
  if (width > MAX_LEVEL_WIDTH || height > MAX_LEVEL_HEIGHT) throw new LevelError(`Niveau trop grand (${width} × ${height}, au plus ${MAX_LEVEL_WIDTH} × ${MAX_LEVEL_HEIGHT})`);
  const tiles: number[] = [];
  const starts: Cell[] = [];
  const finishes: Cell[] = [];
  const saws: Saw[] = [];
  const crumbles: Cell[] = [];
  const crumbleIndex: number[] = [];
  const checkpoints: Cell[] = [];
  const blinkCells: { col: number; row: number; group: number }[] = [];
  const alts: AltBlock[] = [];
  const mushrooms: Mushroom[] = [];
  for (let row = 0; row < height; row++) {
    const line = lines[row]!;
    if (line.length !== width) throw new LevelError(`Ligne ${row + 1} : ${line.length} colonnes au lieu de ${width}`);
    for (let col = 0; col < width; col++) {
      const c = line[col]!;
      const code = GRID_CODES[c];
      if (code === undefined) throw new LevelError(`Ligne ${row + 1}, colonne ${col + 1} : caractère « ${c} » inconnu`);
      tiles.push(code);
      crumbleIndex.push(code === TILE_CRUMBLE ? crumbles.length : -1);
      if (code === TILE_CRUMBLE) crumbles.push({ col, row });
      if (c === "S") starts.push({ col, row });
      if (c === "F") finishes.push({ col, row });
      if (c === "C") checkpoints.push({ col, row });
      if (c === "b" || c === "d") blinkCells.push({ col, row, group: c === "b" ? 0 : 1 });
      if (c === "A" || c === "B") alts.push({ col, row, set: c === "A" ? 0 : 1 });
      if (c === "m" || c === "w" || c === ")" || c === "(") mushrooms.push({ col, row, dir: MUSHROOM_CHARS.indexOf(c) });
      if (c === "o" || c === "O") {
        const p = centerOf(col, row);
        saws.push({ id: `${c}${saws.length}`, radius: c === "o" ? SAW_SMALL_RADIUS : SAW_BIG_RADIUS, mode: "fixe", points: [p], cycle: 0, section: -1, nodes: [p], times: [0, 0] });
      }
    }
  }
  checkpoints.sort((a, b) => a.col - b.col || a.row - b.row);
  // Un point se prend en franchissant sa colonne (lot 4) : deux points dans la même colonne seraient pris ensemble.
  for (let i = 1; i < checkpoints.length; i++) {
    if (checkpoints[i]!.col === checkpoints[i - 1]!.col) throw new LevelError(`Deux points de passage « C » dans la colonne ${checkpoints[i]!.col + 1} (un seul par colonne)`);
  }
  if (starts.length !== 1) throw new LevelError(`Il faut exactement un départ « S » (${starts.length} trouvés)`);
  if (finishes.length !== 1) throw new LevelError(`Il faut exactement une arrivée « F » (${finishes.length} trouvées)`);

  // ——— Bloc annexe ———
  const sections: Section[] = [];
  let simVersion = SECTION_CLOCK_VERSION;
  let versionLine = 0;
  let holdDeclared = -1;
  const pending: { line: number; words: string[] }[] = [];
  const blinkLines: { line: number; words: string[] }[] = [];
  const windLines: { line: number; words: string[] }[] = [];
  const platformLines: { line: number; words: string[] }[] = [];
  const pressLines: { line: number; words: string[] }[] = [];
  const stalactiteLines: { line: number; words: string[] }[] = [];
  const laserLines: { line: number; words: string[] }[] = [];
  const barLines: { line: number; words: string[] }[] = [];
  const bridgeLines: { line: number; words: string[] }[] = [];
  for (let i = 0; i < annex.length; i++) {
    const raw = annex[i]!.trim();
    if (raw === "" || raw.startsWith("//")) continue;
    const words = raw.split(/\s+/);
    const where = `Annexe, ligne ${end + i + 1}`;
    if (words[0] === "version") {
      const v = words.length === 2 && /^\d+$/.test(words[1]!) ? Number(words[1]) : -1;
      if (v < SECTION_CLOCK_VERSION || v > JUMP_SIM_VERSION) throw new LevelError(`${where} : « version ${SECTION_CLOCK_VERSION} » à « version ${JUMP_SIM_VERSION} » attendu`);
      if (versionLine) throw new LevelError(`${where} : version déjà déclarée`);
      versionLine = end + i + 1;
      simVersion = v;
    } else if (words[0] === "maintien") {
      const h = words.length === 2 && /^\d+$/.test(words[1]!) ? Number(words[1]) : -1;
      if (h < 0 || h > MAX_MIN_HOLD) throw new LevelError(`${where} : « maintien <0 à ${MAX_MIN_HOLD}> » attendu`);
      if (holdDeclared >= 0) throw new LevelError(`${where} : maintien déjà déclaré`);
      holdDeclared = h;
    } else if (words[0] === "section") {
      const m = (words.length === 3 || (words.length === 5 && words[3] === "phase" && /^\d+$/.test(words[4]!))) ? /^(\d+)-(\d+)$/.exec(words[2]!) : null;
      if (!m) throw new LevelError(`${where} : « section <nom> <col0>-<col1> [phase <p>] » attendu`);
      const phase = words.length === 5 ? Number(words[4]) : 0;
      if (phase > MAX_PHASE) throw new LevelError(`${where} : phase au plus ${MAX_PHASE}`);
      const c0 = Number(m[1]);
      const c1 = Number(m[2]);
      if (c0 > c1 || c1 >= width) throw new LevelError(`${where} : colonnes ${c0}-${c1} hors de la grille (0-${width - 1})`);
      if (sections.some((s) => s.name === words[1])) throw new LevelError(`${where} : section « ${words[1]} » déjà déclarée`);
      const clash = sections.find((s) => c0 <= s.c1 && s.c0 <= c1);
      if (clash) throw new LevelError(`${where} : chevauche la section « ${clash.name} »`);
      sections.push({ name: words[1]!, c0, c1, phase });
    } else if (words[0] === "scie") pending.push({ line: end + i + 1, words });
    else if (words[0] === "clignote") blinkLines.push({ line: end + i + 1, words });
    else if (words[0] === "vent") windLines.push({ line: end + i + 1, words });
    else if (words[0] === "plateforme") platformLines.push({ line: end + i + 1, words });
    else if (words[0] === "presse") pressLines.push({ line: end + i + 1, words });
    else if (words[0] === "stalactite") stalactiteLines.push({ line: end + i + 1, words });
    else if (words[0] === "laser") laserLines.push({ line: end + i + 1, words });
    else if (words[0] === "barre") barLines.push({ line: end + i + 1, words });
    else if (words[0] === "pont") bridgeLines.push({ line: end + i + 1, words });
    else throw new LevelError(`${where} : déclaration « ${words[0]} » inconnue (version, maintien, section, scie, clignote, vent, plateforme, presse, stalactite, laser, barre, pont)`);
  }
  if (simVersion < SINGLE_CLOCK_VERSION && sections.some((s) => s.phase !== 0)) throw new LevelError("Une phase de section n'existe qu'en version 4 (une seule horloge)");
  // ——— Lot 12 : les cycles des blocs clignotants, par section ———
  const blinkCycles: (BlinkCycle | null)[] = sections.map(() => null);
  for (const { line, words } of blinkLines) {
    const where = `Annexe, ligne ${line}`;
    const section = words.length === 5 ? sections.findIndex((s) => s.name === words[1]) : -1;
    if (words.length !== 5) throw new LevelError(`${where} : « clignote <section> <cycle> <solide> <décalage> » attendu`);
    if (section < 0) throw new LevelError(`${where} : section « ${words[1]} » inconnue`);
    if (blinkCycles[section] !== null) throw new LevelError(`${where} : cycle de la section « ${words[1]} » déjà déclaré`);
    if (!words.slice(2).every((w) => /^\d+$/.test(w))) throw new LevelError(`${where} : cycle, solide et décalage sont des nombres de pas`);
    const [cycle, solid, shift] = words.slice(2).map(Number) as [number, number, number];
    if (cycle < MIN_BLINK_CYCLE || cycle > MAX_BLINK_CYCLE) throw new LevelError(`${where} : cycle de ${cycle} pas hors de ${MIN_BLINK_CYCLE}–${MAX_BLINK_CYCLE}`);
    if (solid < 1 || solid >= cycle) throw new LevelError(`${where} : « solide » vaut de 1 à cycle − 1 (${cycle - 1})`);
    if (shift >= cycle) throw new LevelError(`${where} : « décalage » vaut de 0 à cycle − 1 (${cycle - 1})`);
    blinkCycles[section] = { cycle, solid, shift };
  }
  const blinks: BlinkBlock[] = blinkCells.map((b) => {
    const section = sections.findIndex((s) => b.col >= s.c0 && b.col <= s.c1);
    if (section < 0) throw new LevelError(`Bloc clignotant (colonne ${b.col}, rangée ${b.row}) dans aucune section`);
    const cycle = blinkCycles[section];
    if (!cycle) throw new LevelError(`Bloc clignotant (colonne ${b.col}, rangée ${b.row}) : la section « ${sections[section]!.name} » ne déclare pas de « clignote »`);
    // L'état initial : celui du pas de phase 0 (v3) ; v4 (lot 15) : celui du chrono 0, donc de la phase de la section.
    tiles[b.row * width + b.col] = blinkIsSolid(cycle, b.group, sections[section]!.phase) ? TILE_BLINK_ON : TILE_BLINK_OFF;
    return { ...b, section };
  });
  for (const { line, words } of pending) {
    const where = `Annexe, ligne ${line}`;
    if (words.length < 7) throw new LevelError(`${where} : « scie <id> <rayon> <cycle> <aller-retour|boucle> <col,rangée> <col,rangée>… » attendu`);
    const [, id, r, cycleText, mode] = words as [string, string, string, string, string];
    if (saws.some((s) => s.id === id)) throw new LevelError(`${where} : scie « ${id} » déjà déclarée`);
    const radius = r === "o" ? SAW_SMALL_RADIUS : r === "O" ? SAW_BIG_RADIUS : tilesToUnits(r, where);
    if (radius <= 0 || radius > MAX_SAW_RADIUS) throw new LevelError(`${where} : rayon hors bornes (au plus 4 tuiles)`);
    if (!/^\d+$/.test(cycleText) || Number(cycleText) < 1 || Number(cycleText) > MAX_SAW_CYCLE) throw new LevelError(`${where} : cycle en pas attendu (1 à ${MAX_SAW_CYCLE})`);
    if (mode !== "aller-retour" && mode !== "boucle") throw new LevelError(`${where} : mode « ${mode} » inconnu (aller-retour, boucle)`);
    const cells: Cell[] = words.slice(5).map((w) => {
      const m = /^(\d+),(\d+)$/.exec(w);
      if (!m) throw new LevelError(`${where} : point « ${w} » (col,rangée) attendu`);
      const cell = { col: Number(m[1]), row: Number(m[2]) };
      if (cell.col >= width || cell.row >= height) throw new LevelError(`${where} : point ${w} hors de la grille`);
      return cell;
    });
    if (cells.length > MAX_SAW_POINTS) throw new LevelError(`${where} : au plus ${MAX_SAW_POINTS} points`);
    const section = sections.findIndex((s) => cells[0]!.col >= s.c0 && cells[0]!.col <= s.c1);
    if (section < 0) throw new LevelError(`${where} : le premier point (colonne ${cells[0]!.col}) n'est dans aucune section`);
    const points = cells.map((c) => centerOf(c.col, c.row));
    const cycle = Number(cycleText);
    saws.push({ id, radius, mode, points, cycle, section, ...sawPath(points, mode, cycle) });
  }
  // ——— Lot 13 : les zones de vent ———
  const winds: WindZone[] = [];
  for (const { line, words } of windLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« vent <col0>-<col1> <rang0>-<rang1> <haut|gauche|droite> <force> [rafale <cycle> <actif> <décalage>] » attendu";
    if (words.length !== 5 && words.length !== 9) throw new LevelError(`${where} : ${usage}`);
    const cm = /^(\d+)-(\d+)$/.exec(words[1]!);
    const rm = /^(\d+)-(\d+)$/.exec(words[2]!);
    if (!cm || !rm) throw new LevelError(`${where} : ${usage}`);
    const [c0, c1, r0, r1] = [cm[1], cm[2], rm[1], rm[2]].map(Number) as [number, number, number, number];
    if (c0 > c1 || c1 >= width || r0 > r1 || r1 >= height) throw new LevelError(`${where} : zone ${c0}-${c1} × ${r0}-${r1} hors de la grille`);
    const dir = WIND_DIR_NAMES.indexOf(words[3] as (typeof WIND_DIR_NAMES)[number]);
    if (dir < 1) throw new LevelError(`${where} : sens « ${words[3]} » inconnu (haut, gauche, droite)`);
    if (!/^\d+$/.test(words[4]!) || Number(words[4]) < WIND_MIN_FORCE || Number(words[4]) > WIND_MAX_FORCE) throw new LevelError(`${where} : force en % de ${WIND_MIN_FORCE} à ${WIND_MAX_FORCE}`);
    const section = sections.findIndex((s) => c0 >= s.c0 && c0 <= s.c1);
    let gust: Gust | null = null;
    if (words.length === 9) {
      if (words[5] !== "rafale" || !words.slice(6).every((w) => /^\d+$/.test(w))) throw new LevelError(`${where} : ${usage}`);
      const [cycle, active, shift] = words.slice(6).map(Number) as [number, number, number];
      if (cycle < MIN_GUST_CYCLE || cycle > MAX_GUST_CYCLE) throw new LevelError(`${where} : rafale de ${cycle} pas hors de ${MIN_GUST_CYCLE}–${MAX_GUST_CYCLE}`);
      if (active < 1 || active >= cycle) throw new LevelError(`${where} : « actif » vaut de 1 à cycle − 1 (${cycle - 1})`);
      if (shift >= cycle) throw new LevelError(`${where} : « décalage » vaut de 0 à cycle − 1 (${cycle - 1})`);
      if (section < 0) throw new LevelError(`${where} : une zone en rafale doit être dans une section (colonne ${c0})`);
      gust = { cycle, active, shift };
    }
    const clash = winds.find((w) => c0 <= w.c1 && w.c0 <= c1 && r0 <= w.r1 && w.r0 <= r1);
    if (clash) throw new LevelError(`${where} : chevauche la zone de vent ${clash.c0}-${clash.c1} × ${clash.r0}-${clash.r1}`);
    winds.push({ c0, c1, r0, r1, dir, force: Number(words[4]), gust, section });
  }
  // ——— Lot 20 : les plateformes mobiles ———
  const platforms: Platform[] = [];
  for (const { line, words } of platformLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« plateforme <id> <largeur> <h|v> <cycle> <col,rangée> <col,rangée> » attendu";
    if (words.length !== 7) throw new LevelError(`${where} : ${usage}`);
    const [, id, w, axis, cycleText] = words as [string, string, string, string, string];
    if (platforms.some((q) => q.id === id)) throw new LevelError(`${where} : plateforme « ${id} » déjà déclarée`);
    if (!/^\d+$/.test(w) || Number(w) < PLATFORM_MIN_WIDTH || Number(w) > PLATFORM_MAX_WIDTH) throw new LevelError(`${where} : largeur de ${PLATFORM_MIN_WIDTH} à ${PLATFORM_MAX_WIDTH} tuiles`);
    if (axis !== "h" && axis !== "v") throw new LevelError(`${where} : axe « ${axis} » inconnu (h, v)`);
    const cycle = /^\d+$/.test(cycleText) ? Number(cycleText) : -1;
    if (cycle < MIN_PLATFORM_CYCLE || cycle > MAX_PLATFORM_CYCLE || cycle % 2 !== 0) throw new LevelError(`${where} : cycle pair de ${MIN_PLATFORM_CYCLE} à ${MAX_PLATFORM_CYCLE} pas`);
    const cells: Cell[] = words.slice(5).map((word) => {
      const m = /^(\d+),(\d+)$/.exec(word);
      if (!m) throw new LevelError(`${where} : point « ${word} » (col,rangée) attendu`);
      return { col: Number(m[1]), row: Number(m[2]) };
    });
    const [a, b] = cells as [Cell, Cell];
    const pw = Number(w);
    if (axis === "h" ? a.row !== b.row || a.col === b.col : a.col !== b.col || a.row === b.row) throw new LevelError(`${where} : deux points distincts sur ${axis === "h" ? "la même rangée" : "la même colonne"} attendus`);
    const travel = axis === "h" ? Math.abs(b.col - a.col) : Math.abs(b.row - a.row);
    if (travel > MAX_PLATFORM_TRAVEL) throw new LevelError(`${where} : trajet de ${travel} tuiles (au plus ${MAX_PLATFORM_TRAVEL})`);
    const c0 = Math.min(a.col, b.col);
    const c1 = Math.max(a.col, b.col) + pw - 1;
    const r0 = Math.min(a.row, b.row);
    const r1 = Math.max(a.row, b.row);
    if (c1 >= width || r1 >= height) throw new LevelError(`${where} : trajet hors de la grille`);
    const section = sections.findIndex((q) => c0 >= q.c0 && c1 <= q.c1);
    if (section < 0) throw new LevelError(`${where} : le trajet (colonnes ${c0}-${c1}) n'est pas dans une seule section`);
    // La vitesse de pointe (table de ralenti : 96 / 4 096 de trajet par intervalle de `cycle / 128` pas) reste sous un pas de `MAX_PLATFORM_STEP`.
    if (idiv(travel * UNITS_PER_TILE * 3, cycle) + 1 > MAX_PLATFORM_STEP) throw new LevelError(`${where} : trop rapide (${travel} tuiles en ${cycle} pas)`);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (tiles[r * width + c] !== TILE_EMPTY) throw new LevelError(`${where} : la tuile (${c}, ${r}) de son trajet n'est pas vide`);
    }
    platforms.push({ id, width: pw, axis, cycle, a, b, section });
  }
  // ——— Lot 22 : les presses ———
  const presses: Press[] = [];
  for (const { line, words } of pressLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« presse <id> <largeur> <col,rangée> <course> <attente> <chute> <pause> <remontée> » attendu";
    if (words.length !== 9) throw new LevelError(`${where} : ${usage}`);
    const [, id, w, at] = words as [string, string, string, string];
    if (presses.some((q) => q.id === id)) throw new LevelError(`${where} : presse « ${id} » déjà déclarée`);
    if (!/^\d+$/.test(w) || Number(w) < PRESS_MIN_WIDTH || Number(w) > PRESS_MAX_WIDTH) throw new LevelError(`${where} : largeur de ${PRESS_MIN_WIDTH} à ${PRESS_MAX_WIDTH} tuiles`);
    const cm = /^(\d+),(\d+)$/.exec(at);
    if (!cm) throw new LevelError(`${where} : point « ${at} » (col,rangée) attendu`);
    if (!words.slice(4).every((n) => /^\d+$/.test(n))) throw new LevelError(`${where} : ${usage}`);
    const [travel, hold, fall, rest, rise] = words.slice(4).map(Number) as [number, number, number, number, number];
    if (travel < PRESS_MIN_TRAVEL || travel > PRESS_MAX_TRAVEL) throw new LevelError(`${where} : course de ${PRESS_MIN_TRAVEL} à ${PRESS_MAX_TRAVEL} tuiles`);
    if (hold < PRESS_MIN_HOLD || hold > PRESS_MAX_HOLD) throw new LevelError(`${where} : attente en haut de ${PRESS_MIN_HOLD} à ${PRESS_MAX_HOLD} pas (au moins 1 s)`);
    if (fall < PRESS_MIN_FALL || fall > PRESS_MAX_FALL) throw new LevelError(`${where} : chute de ${PRESS_MIN_FALL} à ${PRESS_MAX_FALL} pas`);
    if (rest < PRESS_MIN_REST || rest > PRESS_MAX_REST) throw new LevelError(`${where} : pause en bas de ${PRESS_MIN_REST} à ${PRESS_MAX_REST} pas`);
    if (rise < PRESS_RISE_FACTOR * fall || rise > PRESS_MAX_RISE) throw new LevelError(`${where} : remontée de ${PRESS_RISE_FACTOR} fois la chute (${PRESS_RISE_FACTOR * fall}) à ${PRESS_MAX_RISE} pas`);
    const cycle = hold + fall + rest + rise;
    if (cycle > PRESS_MAX_CYCLE) throw new LevelError(`${where} : cycle de ${cycle} pas (au plus ${PRESS_MAX_CYCLE})`);
    // La vitesse à la fin de la chute (dernier intervalle de `PRESS_FALL` : 127 / 4 096 de la course en `fall / 64` pas) reste sous `MAX_PRESS_STEP`.
    if (idiv(travel * UNITS_PER_TILE * (PRESS_FALL[PLATFORM_EASE_STEPS]! - PRESS_FALL[PLATFORM_EASE_STEPS - 1]!) * PLATFORM_EASE_STEPS, PLATFORM_EASE_ONE * fall) + 1 > MAX_PRESS_STEP) {
      throw new LevelError(`${where} : trop rapide (${travel} tuiles en ${fall} pas)`);
    }
    const pw = Number(w);
    const col = Number(cm[1]);
    const row = Number(cm[2]);
    const c1 = col + pw - 1;
    const r1 = row + travel + PRESS_HEIGHT_TILES - 1;
    if (c1 >= width || r1 >= height) throw new LevelError(`${where} : sa course sort de la grille`);
    const section = sections.findIndex((q) => col >= q.c0 && c1 <= q.c1);
    if (section < 0) throw new LevelError(`${where} : la presse (colonnes ${col}-${c1}) n'est pas dans une seule section`);
    for (let r = row; r <= r1; r++) {
      for (let c = col; c <= c1; c++) if (tiles[r * width + c] !== TILE_EMPTY) throw new LevelError(`${where} : la tuile (${c}, ${r}) de sa course n'est pas vide`);
    }
    presses.push({ id, width: pw, col, row, travel, hold, fall, rest, rise, cycle, section });
  }
  const clashing = presses.find((p, k) => presses.some((q, j) => j < k && p.col <= q.col + q.width - 1 && q.col <= p.col + p.width - 1 && p.row <= q.row + q.travel + PRESS_HEIGHT_TILES - 1 && q.row <= p.row + p.travel + PRESS_HEIGHT_TILES - 1));
  if (clashing) throw new LevelError(`Annexe : la course de la presse « ${clashing.id} » en recoupe une autre`);
  // ——— Lot 24 : les stalactites ———
  const stalactites: Stalactite[] = [];
  for (const { line, words } of stalactiteLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« stalactite <id> <col,rangée> <avant> <après> » attendu";
    if (words.length !== 5) throw new LevelError(`${where} : ${usage}`);
    const [, id, at, b, a] = words as [string, string, string, string, string];
    const m = /^(\d+),(\d+)$/.exec(at);
    if (!m || !/^\d+$/.test(b) || !/^\d+$/.test(a)) throw new LevelError(`${where} : ${usage}`);
    if (stalactites.some((q) => q.id === id)) throw new LevelError(`${where} : stalactite « ${id} » déjà déclarée`);
    const col = Number(m[1]);
    const row = Number(m[2]);
    const before = Number(b);
    const after = Number(a);
    if (before < 1 || before > STALACTITE_MAX_REACH || after < 1 || after > STALACTITE_MAX_REACH) throw new LevelError(`${where} : la zone vaut de 1 à ${STALACTITE_MAX_REACH} colonnes de chaque côté`);
    if (col >= width || row < 1 || row + STALACTITE_TILES > height) throw new LevelError(`${where} : la stalactite (${col},${row}) sort de la grille`);
    if (tiles[(row - 1) * width + col] !== TILE_SOLID) throw new LevelError(`${where} : la stalactite (${col},${row}) n'est pas accrochée à un bloc plein`);
    for (let r = row; r < row + STALACTITE_TILES; r++) if (tiles[r * width + col] !== TILE_EMPTY) throw new LevelError(`${where} : le corps de la stalactite (${col},${r}) n'est pas vide`);
    if (stalactites.some((q) => q.col === col)) throw new LevelError(`${where} : une autre stalactite pend déjà dans la colonne ${col}`);
    stalactites.push({ id, col, row, before, after });
  }
  // ——— Lot 25 : les lasers fixes ———
  const lasers: Laser[] = [];
  for (const { line, words } of laserLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« laser <id> <h|v> <col,rangée> <longueur> <cycle> <allumé> <décalage> » attendu";
    if (words.length !== 8) throw new LevelError(`${where} : ${usage}`);
    const [, id, axis, at] = words as [string, string, string, string];
    if (lasers.some((q) => q.id === id)) throw new LevelError(`${where} : laser « ${id} » déjà déclaré`);
    if (axis !== "h" && axis !== "v") throw new LevelError(`${where} : axe « ${axis} » inconnu (h, v)`);
    const m = /^(\d+),(\d+)$/.exec(at);
    if (!m || !words.slice(4).every((n) => /^\d+$/.test(n))) throw new LevelError(`${where} : ${usage}`);
    const [length, cycle, on, shift] = words.slice(4).map(Number) as [number, number, number, number];
    if (length < LASER_MIN_LENGTH || length > LASER_MAX_LENGTH) throw new LevelError(`${where} : longueur de ${LASER_MIN_LENGTH} à ${LASER_MAX_LENGTH} tuiles`);
    if (cycle > LASER_MAX_CYCLE) throw new LevelError(`${where} : cycle de ${cycle} pas (au plus ${LASER_MAX_CYCLE})`);
    if (on < LASER_MIN_ON) throw new LevelError(`${where} : allumé ${on} pas (au moins ${LASER_MIN_ON} : 0,75 s)`);
    if (cycle - on < LASER_MIN_OFF) throw new LevelError(`${where} : éteint ${cycle - on} pas (au moins ${LASER_MIN_OFF} : 1 s)`);
    if (shift >= cycle) throw new LevelError(`${where} : « décalage » vaut de 0 à cycle − 1 (${cycle - 1})`);
    const col = Number(m[1]);
    const row = Number(m[2]);
    const c1 = axis === "h" ? col + length - 1 : col;
    const r1 = axis === "v" ? row + length - 1 : row;
    // Les deux émetteurs : les tuiles qui bornent le rayon, des blocs pleins (ils tiennent dans la grille).
    const ca = axis === "h" ? col - 1 : col;
    const ra = axis === "v" ? row - 1 : row;
    const cb = axis === "h" ? c1 + 1 : col;
    const rb = axis === "v" ? r1 + 1 : row;
    if (ca < 0 || ra < 0 || cb >= width || rb >= height) throw new LevelError(`${where} : le laser et ses émetteurs sortent de la grille`);
    if (tiles[ra * width + ca] !== TILE_SOLID || tiles[rb * width + cb] !== TILE_SOLID) throw new LevelError(`${where} : un émetteur doit être posé sur un bloc plein « # » (${ca},${ra}) et (${cb},${rb})`);
    for (let r = row; r <= r1; r++) {
      for (let c = col; c <= c1; c++) if (tiles[r * width + c] !== TILE_EMPTY) throw new LevelError(`${where} : la tuile (${c}, ${r}) du rayon n'est pas vide`);
    }
    const section = sections.findIndex((q) => col >= q.c0 && c1 <= q.c1);
    if (section < 0) throw new LevelError(`${where} : le rayon (colonnes ${col}-${c1}) n'est pas dans une seule section`);
    lasers.push({ id, axis, col, row, length, cycle, on, shift, section });
  }
  // ——— Lot 25 : les barres laser coulissantes ———
  const laserBars: LaserBar[] = [];
  for (const { line, words } of barLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« barre <id> <h|v> <longueur> <cycle> <col,rangée> <col,rangée> » attendu";
    if (words.length !== 7) throw new LevelError(`${where} : ${usage}`);
    const [, id, axis, lengthText, cycleText] = words as [string, string, string, string, string];
    if (laserBars.some((q) => q.id === id)) throw new LevelError(`${where} : barre « ${id} » déjà déclarée`);
    if (axis !== "h" && axis !== "v") throw new LevelError(`${where} : axe « ${axis} » inconnu (h, v)`);
    const length = /^\d+$/.test(lengthText) ? Number(lengthText) : -1;
    if (length < LASER_BAR_MIN_LENGTH || length > LASER_BAR_MAX_LENGTH) throw new LevelError(`${where} : longueur de ${LASER_BAR_MIN_LENGTH} à ${LASER_BAR_MAX_LENGTH} tuiles`);
    const cycle = /^\d+$/.test(cycleText) ? Number(cycleText) : -1;
    if (cycle < LASER_BAR_MIN_CYCLE || cycle > LASER_BAR_MAX_CYCLE || cycle % 2 !== 0) throw new LevelError(`${where} : cycle pair de ${LASER_BAR_MIN_CYCLE} à ${LASER_BAR_MAX_CYCLE} pas`);
    const cells: Cell[] = words.slice(5).map((word) => {
      const m = /^(\d+),(\d+)$/.exec(word);
      if (!m) throw new LevelError(`${where} : point « ${word} » (col,rangée) attendu`);
      return { col: Number(m[1]), row: Number(m[2]) };
    });
    const [a, b] = cells as [Cell, Cell];
    // Le rayon glisse perpendiculairement à sa longueur : un rayon horizontal monte et descend (même colonne), un rayon vertical va et vient (même rangée).
    if (axis === "h" ? a.col !== b.col || a.row === b.row : a.row !== b.row || a.col === b.col) throw new LevelError(`${where} : deux points distincts sur ${axis === "h" ? "la même colonne" : "la même rangée"} attendus`);
    const travel = axis === "h" ? Math.abs(b.row - a.row) : Math.abs(b.col - a.col);
    if (travel > LASER_BAR_MAX_TRAVEL) throw new LevelError(`${where} : trajet de ${travel} tuiles (au plus ${LASER_BAR_MAX_TRAVEL})`);
    const c0 = Math.min(a.col, b.col);
    const c1 = Math.max(a.col, b.col) + (axis === "h" ? length - 1 : 0);
    const r0 = Math.min(a.row, b.row);
    const r1 = Math.max(a.row, b.row) + (axis === "v" ? length - 1 : 0);
    if (c1 >= width || r1 >= height) throw new LevelError(`${where} : trajet hors de la grille`);
    const section = sections.findIndex((q) => c0 >= q.c0 && c1 <= q.c1);
    if (section < 0) throw new LevelError(`${where} : le trajet (colonnes ${c0}-${c1}) n'est pas dans une seule section`);
    // La vitesse de pointe (table de ralenti : 96 / 4 096 de trajet par intervalle de `cycle / 128` pas) reste sous `MAX_LASER_STEP`.
    if (idiv(travel * UNITS_PER_TILE * 3, cycle) + 1 > MAX_LASER_STEP) throw new LevelError(`${where} : trop rapide (${travel} tuiles en ${cycle} pas)`);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) if (tiles[r * width + c] !== TILE_EMPTY) throw new LevelError(`${where} : la tuile (${c}, ${r}) de son trajet n'est pas vide`);
    }
    laserBars.push({ id, axis, length, cycle, a, b, section });
  }
  // ——— Lot 26 : les ponts à interrupteur ———
  const bridges: Bridge[] = [];
  const bridgeCells = new Set<number>();
  for (const { line, words } of bridgeLines) {
    const where = `Annexe, ligne ${line}`;
    const usage = "« pont <id> <délai> <col,rangée> <tuiles : c,r | c0-c1,r | c,r0-r1>… » attendu";
    if (words.length < 5) throw new LevelError(`${where} : ${usage}`);
    const [, id, delayText, at] = words as [string, string, string, string];
    if (bridges.some((q) => q.id === id)) throw new LevelError(`${where} : pont « ${id} » déjà déclaré`);
    const delay = /^\d+$/.test(delayText) ? Number(delayText) : -1;
    if (delay < BRIDGE_MIN_DELAY || delay > BRIDGE_MAX_DELAY) throw new LevelError(`${where} : délai de ${BRIDGE_MIN_DELAY} à ${BRIDGE_MAX_DELAY} pas (au moins 1 s)`);
    const sm = /^(\d+),(\d+)$/.exec(at);
    if (!sm) throw new LevelError(`${where} : ${usage}`);
    const switchCol = Number(sm[1]);
    const switchRow = Number(sm[2]);
    if (switchCol >= width || switchRow >= height) throw new LevelError(`${where} : l'interrupteur (${switchCol},${switchRow}) sort de la grille`);
    if (tiles[switchRow * width + switchCol] !== TILE_SOLID) throw new LevelError(`${where} : l'interrupteur (${switchCol},${switchRow}) doit être un bloc plein « # »`);
    const cells: Cell[] = [];
    for (const word of words.slice(4)) {
      const m = /^(\d+)(?:-(\d+))?,(\d+)(?:-(\d+))?$/.exec(word);
      if (!m || (m[2] !== undefined && m[4] !== undefined)) throw new LevelError(`${where} : tuiles « ${word} » : ${usage}`);
      const col = Number(m[1]);
      const row = Number(m[3]);
      if (m[2] !== undefined) {
        const to = Number(m[2]);
        const step = to >= col ? 1 : -1;
        for (let c = col; c !== to + step; c += step) cells.push({ col: c, row });
      } else if (m[4] !== undefined) {
        const to = Number(m[4]);
        const step = to >= row ? 1 : -1;
        for (let r = row; r !== to + step; r += step) cells.push({ col, row: r });
      } else cells.push({ col, row });
    }
    if (cells.length < 1 || cells.length > BRIDGE_MAX_TILES) throw new LevelError(`${where} : un pont a de 1 à ${BRIDGE_MAX_TILES} tuiles (${cells.length})`);
    for (const c of cells) {
      if (c.col >= width || c.row >= height) throw new LevelError(`${where} : la tuile (${c.col},${c.row}) du pont sort de la grille`);
      const k = c.row * width + c.col;
      if (tiles[k] !== TILE_EMPTY) throw new LevelError(`${where} : la tuile (${c.col},${c.row}) du pont n'est pas vide`);
      if (bridgeCells.has(k)) throw new LevelError(`${where} : la tuile (${c.col},${c.row}) est déjà dans un pont`);
      bridgeCells.add(k);
    }
    if (bridges.some((q) => q.switchCol === switchCol && q.switchRow === switchRow)) throw new LevelError(`${where} : l'interrupteur (${switchCol},${switchRow}) a déjà un pont`);
    bridges.push({ id, switchCol, switchRow, delay, tiles: cells });
  }
  const minHold = holdDeclared >= 0 ? holdDeclared : simVersion >= MIN_HOLD_VERSION ? JUMP_MIN_HOLD : 0;
  const microMax = minHold > 0 ? JUMP_MICRO_MAX : 0;
  return { simVersion, minHold, microMax, width, height, tiles, start: starts[0]!, finish: finishes[0]!, sections, saws, crumbles, crumbleIndex, checkpoints, blinks, blinkCycles, alts, winds, platforms, presses, mushrooms, stalactites, lasers, laserBars, bridges };
}

/**
 * La tuile en (col, row), dans la grille `level.tiles`. Hors de la grille : plein à gauche, à droite et en haut (le monde est clos) ;
 * **vide sous la dernière rangée** (lot 2) : le personnage qui sort par le bas meurt (`attempt.ts`).
 */
export function tileAt(level: Pick<Level, "width" | "height" | "tiles">, col: number, row: number): number {
  if (row >= level.height) return TILE_EMPTY;
  if (col < 0 || row < 0 || col >= level.width) return TILE_SOLID;
  return level.tiles[row * level.width + col]!;
}

/** Coin haut-gauche d'une tuile, en unités entières (x vers la droite, y vers le bas, comme les rangées). */
export function cellOrigin(cell: Cell): { x: number; y: number } {
  return { x: cell.col * UNITS_PER_TILE, y: cell.row * UNITS_PER_TILE };
}

/**
 * Lot 12 : le groupe `group` (0 : `b`, 1 : `d`) d'un cycle de clignotement est-il solide à la phase `phase` (pas écoulés depuis l'entrée dans
 * la section, 0 avant) ? Pure, entière : `q = (phase + décalage) mod cycle` ; `b` est solide pour `q < solide`, `d` pour `q ≥ solide`.
 */
export function blinkIsSolid(c: BlinkCycle, group: number, phase: number): boolean {
  const q = cycleMod(phase + c.shift, c.cycle);
  return group === 0 ? q < c.solid : q >= c.solid;
}

/**
 * Centre d'une scie au pas `phase` de son cycle (pas écoulés depuis la mise en marche de sa section ; 0 avant). Fonction entière et pure :
 * interpolation linéaire par `idiv` entre deux nœuds du trajet ; revient exactement au départ à chaque cycle.
 */
export function sawCenter(saw: Saw, phase: number): Point {
  if (saw.cycle === 0) return saw.nodes[0]!;
  // Lot 15 : une phase négative (v4, l'affichage avant le départ) se lit dans le cycle ; en v3 elle n'est jamais négative (0 avant l'entrée).
  const t = cycleMod(phase, saw.cycle);
  const n = saw.nodes.length;
  let k = 0;
  while (k < n - 1 && t >= saw.times[k + 1]!) k++;
  const a = saw.nodes[k]!;
  const b = saw.nodes[(k + 1) % n]!;
  const t0 = saw.times[k]!;
  const span = saw.times[k + 1]! - t0;
  if (span <= 0) return a;
  return { x: a.x + idiv((b.x - a.x) * (t - t0), span), y: a.y + idiv((b.y - a.y) * (t - t0), span) };
}

/**
 * Lot 13 : la zone de vent souffle-t-elle à la phase `phase` de sa section (pas écoulés depuis l'entrée du personnage dans la section, 0 avant) ?
 * Pure, entière : toujours sans rafale ; avec, `q = (phase + décalage) mod cycle < actif`.
 */
export function windBlows(zone: Pick<WindZone, "gust">, phase: number): boolean {
  const g = zone.gust;
  if (!g) return true;
  return cycleMod(phase + g.shift, g.cycle) < g.active;
}

/** Lot 13 : l'indice de la zone de vent qui contient la tuile (col, row), −1 aucune (les zones ne se chevauchent pas). */
export function windZoneAt(level: Pick<Level, "winds">, col: number, row: number): number {
  for (let i = 0; i < level.winds.length; i++) {
    const w = level.winds[i]!;
    if (col >= w.c0 && col <= w.c1 && row >= w.r0 && row <= w.r1) return i;
  }
  return -1;
}

/**
 * Lot 20 : la part du trajet déjà faite (0 à `PLATFORM_EASE_ONE`) après `tri` pas de l'aller (0 à `half`, le demi-cycle) : la table de ralenti
 * `PLATFORM_EASE`, interpolée linéairement entre deux valeurs par `idiv`. Entière, croissante, 0 au départ, 4 096 à `half`.
 */
export function platformEase(tri: number, half: number): number {
  const s = tri * PLATFORM_EASE_STEPS;
  const k = idiv(s, half);
  if (k >= PLATFORM_EASE_STEPS) return PLATFORM_EASE_ONE;
  const lo = PLATFORM_EASE[k]!;
  return lo + idiv((PLATFORM_EASE[k + 1]! - lo) * (s - k * half), half);
}

/**
 * Lot 20 : le coin haut-gauche d'une plateforme à la phase `phase` de sa section (comme `sawCenter` : la phase d'un élément à horloge). Position
 * `f(phase)` **entière et pure** : `a` à la phase 0, `b` au demi-cycle, retour exact à `a` à chaque cycle ; le ralenti de `PLATFORM_EASE` aux deux
 * extrémités. Une phase négative (v4, l'affichage avant le départ) se lit dans le cycle.
 */
export function platformPos(p: Platform, phase: number): Point {
  // Lot 25 (optimisation, mêmes valeurs) : la position ne dépend que de la phase dans le cycle ; une table (construite une fois par plateforme, par la fonction ci-dessous)
  // remplace le calcul à chaque pas de chaque rejeu.
  let tab = platformTables.get(p);
  if (!tab) {
    tab = new Int32Array(p.cycle * 2);
    for (let q = 0; q < p.cycle; q++) {
      const at = platformPosRaw(p, q);
      tab[2 * q] = at.x;
      tab[2 * q + 1] = at.y;
    }
    platformTables.set(p, tab);
  }
  const q = cycleMod(phase, p.cycle);
  return { x: tab[2 * q]!, y: tab[2 * q + 1]! };
}

const platformTables = new WeakMap<object, Int32Array>();

function platformPosRaw(p: Platform, phase: number): Point {
  const half = idiv(p.cycle, 2);
  const q = cycleMod(phase, p.cycle);
  const e = platformEase(q <= half ? q : p.cycle - q, half);
  const T = UNITS_PER_TILE;
  const x = p.a.col * T;
  const y = p.a.row * T;
  if (p.axis === "h") return { x: x + idiv((p.b.col - p.a.col) * T * e, PLATFORM_EASE_ONE), y };
  return { x, y: y + idiv((p.b.row - p.a.row) * T * e, PLATFORM_EASE_ONE) };
}

/**
 * Lot 22 : la part (0 à 4 096) lue dans une table de 65 valeurs après `step` pas sur `span` : l'interpolation linéaire entière de `platformEase`, pour
 * n'importe quelle table (`PRESS_FALL` pour la chute, `PLATFORM_EASE` pour la remontée).
 */
function tablePart(table: readonly number[], step: number, span: number): number {
  const s = step * PLATFORM_EASE_STEPS;
  const k = idiv(s, span);
  if (k >= PLATFORM_EASE_STEPS) return PLATFORM_EASE_ONE;
  const lo = table[k]!;
  return lo + idiv((table[k + 1]! - lo) * (s - k * span), span);
}

/**
 * Lot 22 : la part (0 à 4 096) de la course d'une presse déjà faite à la phase `phase` de sa section. Le cycle : `hold` pas en haut (0), `fall` pas de
 * chute (`PRESS_FALL`), `rest` pas en bas (4 096), `rise` pas de remontée (`PLATFORM_EASE` à l'envers). Entière et pure ; une phase négative (v4+, l'affichage
 * avant le départ) se lit dans le cycle.
 */
export function pressPart(p: Pick<Press, "hold" | "fall" | "rest" | "rise" | "cycle">, phase: number): number {
  const q = cycleMod(phase, p.cycle);
  if (q < p.hold) return 0;
  if (q < p.hold + p.fall) return tablePart(PRESS_FALL, q - p.hold, p.fall);
  if (q < p.hold + p.fall + p.rest) return PLATFORM_EASE_ONE;
  return PLATFORM_EASE_ONE - tablePart(PLATFORM_EASE, q - p.hold - p.fall - p.rest, p.rise);
}

/** Lot 22 : le coin haut-gauche d'une presse à la phase `phase` de sa section (unités) : sa colonne, et sa rangée haute plus la part de sa course. */
export function pressPos(p: Pick<Press, "col" | "row" | "travel" | "hold" | "fall" | "rest" | "rise" | "cycle">, phase: number): Point {
  const T = UNITS_PER_TILE;
  return { x: p.col * T, y: p.row * T + idiv(p.travel * T * pressPart(p, phase), PLATFORM_EASE_ONE) };
}

/** Lot 22 : le rectangle mortel d'une presse à la phase `phase` (unités) : toute la presse, largeur × `PRESS_HEIGHT_TILES`. */
export function pressBox(p: Pick<Press, "col" | "row" | "travel" | "width" | "hold" | "fall" | "rest" | "rise" | "cycle">, phase: number): { x: number; y: number; w: number; h: number } {
  const at = pressPos(p, phase);
  return { x: at.x, y: at.y, w: p.width * UNITS_PER_TILE, h: PRESS_HEIGHT_TILES * UNITS_PER_TILE };
}

/**
 * Lot 25 : le laser fixe est-il allumé à la phase `phase` de sa section ? Pure, entière : `q = (phase + décalage) mod cycle`, allumé pour `q < allumé`. Une phase
 * négative (v4+, l'affichage avant le départ) se lit dans le cycle.
 */
export function laserOn(l: Pick<Laser, "cycle" | "on" | "shift">, phase: number): boolean {
  return cycleMod(phase + l.shift, l.cycle) < l.on;
}

/** Lot 25 : la bande mortelle d'un laser fixe (unités), quand il est allumé : `LASER_THICKNESS` au milieu de ses tuiles, sur toute leur longueur. */
export function laserBox(l: Pick<Laser, "axis" | "col" | "row" | "length">): { x: number; y: number; w: number; h: number } {
  const T = UNITS_PER_TILE;
  const gap = idiv(T - LASER_THICKNESS, 2);
  return l.axis === "h" ? { x: l.col * T, y: l.row * T + gap, w: l.length * T, h: LASER_THICKNESS } : { x: l.col * T + gap, y: l.row * T, w: LASER_THICKNESS, h: l.length * T };
}

/**
 * Lot 25 : le coin haut-gauche de la première tuile du rayon d'une barre coulissante à la phase `phase` de sa section : `a` à la phase 0, `b` au demi-cycle, retour exact
 * à chaque cycle, le ralenti de `PLATFORM_EASE` aux deux extrémités (la même lecture que `platformPos`). Une phase négative se lit dans le cycle.
 */
export function laserBarPos(p: Pick<LaserBar, "cycle" | "a" | "b" | "axis">, phase: number): Point {
  const half = idiv(p.cycle, 2);
  const q = cycleMod(phase, p.cycle);
  const e = platformEase(q <= half ? q : p.cycle - q, half);
  const T = UNITS_PER_TILE;
  const x = p.a.col * T;
  const y = p.a.row * T;
  if (p.axis === "h") return { x, y: y + idiv((p.b.row - p.a.row) * T * e, PLATFORM_EASE_ONE) };
  return { x: x + idiv((p.b.col - p.a.col) * T * e, PLATFORM_EASE_ONE), y };
}

/** Lot 25 : la bande mortelle d'une barre coulissante à la phase `phase` (unités) : toujours allumée, `LASER_THICKNESS` au milieu de ses tuiles. */
export function laserBarBox(p: Pick<LaserBar, "cycle" | "a" | "b" | "axis" | "length">, phase: number): { x: number; y: number; w: number; h: number } {
  const T = UNITS_PER_TILE;
  const gap = idiv(T - LASER_THICKNESS, 2);
  const at = laserBarPos(p, phase);
  return p.axis === "h" ? { x: at.x, y: at.y + gap, w: p.length * T, h: LASER_THICKNESS } : { x: at.x + gap, y: at.y, w: LASER_THICKNESS, h: p.length * T };
}

/** Lot 15 : plus grand commun diviseur (entiers positifs). */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
}

/**
 * Lot 15 : la **période** de la section `i` : le plus petit commun multiple des cycles de ce qui y tourne (scies mobiles, clignotants, rafales),
 * en pas (lot 20 : plateformes comprises ; lot 22 : presses ; lot 25 : lasers et barres) ; 0 si rien n'y tourne (l'horloge n'y change rien). Bornée par `MAX_PHASE` (au-delà : refusé, le générateur n'en produit pas).
 */
export function sectionPeriod(level: Level, i: number): number {
  const cycles: number[] = [];
  for (const s of level.saws) if (s.section === i && s.cycle > 0) cycles.push(s.cycle);
  const blink = level.blinkCycles[i];
  if (blink) cycles.push(blink.cycle);
  for (const w of level.winds) if (w.section === i && w.gust) cycles.push(w.gust.cycle);
  for (const q of level.platforms) if (q.section === i) cycles.push(q.cycle);
  for (const q of level.presses) if (q.section === i) cycles.push(q.cycle);
  for (const q of level.lasers) if (q.section === i) cycles.push(q.cycle);
  for (const q of level.laserBars) if (q.section === i) cycles.push(q.cycle);
  let l = 0;
  for (const c of cycles) {
    l = l === 0 ? c : idiv(l * c, gcd(l, c));
    if (l > MAX_PHASE) throw new LevelError(`Section « ${level.sections[i]!.name} » : période de plus de ${MAX_PHASE} pas`);
  }
  return l;
}

/**
 * Lot 15 : le texte d'un niveau en version 3 passé en **version 4** (une seule horloge) : la ligne `version 4` en tête du bloc annexe et la
 * phase `phases[i]` sur la ligne de la section `i` (dans l'ordre des déclarations). Le reste du texte ne change pas.
 */
export function withSingleClock(ascii: string, phases: readonly number[], version = SINGLE_CLOCK_VERSION): string {
  const lines = ascii.split("\n");
  const cut = lines.indexOf("");
  if (cut < 0) throw new LevelError("Niveau sans bloc annexe : rien à mettre à l'heure");
  let k = 0;
  const annex = lines
    .slice(cut + 1)
    .map((line) => {
      const words = line.trim().split(/\s+/);
      if (words[0] === "version") throw new LevelError("Niveau déjà versionné");
      // Lot 30 : le maintien minimal d'un niveau de la version 13 est celui de sa version : la ligne `maintien 10` (posée par l'assemblage pour jouer la preuve en version 3) n'a rien à y faire.
      if (words[0] === "maintien" && version >= MIN_HOLD_VERSION && words[1] === String(JUMP_MIN_HOLD)) return null;
      if (words[0] !== "section") return line;
      const p = phases[k++];
      if (p === undefined) throw new LevelError("Une phase par section attendue");
      return p === 0 ? line : `${line} phase ${p}`;
    })
    .filter((line): line is string => line !== null);
  if (k !== phases.length) throw new LevelError("Une phase par section attendue");
  return [...lines.slice(0, cut), "", `version ${version}`, ...annex].join("\n");
}
