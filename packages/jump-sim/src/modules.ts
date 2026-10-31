import { ATTEMPT_DEAD, ATTEMPT_FINISHED, boxesOverlap, circleHitsBox, stepAttempt, type AttemptState } from "./attempt";
import { tileOf } from "./collide";
import { idiv } from "./idiv";
import { COUNTER_CAP, DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_RIGHT, PLAYER_WIDTH, type PlayerState } from "./player";
import { START_AT_SPAWN, decodeReplay, encodeReplay, fromRuns, replayStartState, toRuns } from "./replay";
import { MODULE_PACKED, MODULE_TEXTS } from "./catalog";
import { textHash } from "./texthash";
import { fromBase64Url, pushVarint, toBase64Url } from "@cdj/core";
import { JUMP_MIN_HOLD, MODULE_ENTRIES, PALIER_LENGTH, SECTION_CLOCK_VERSION, UNITS_PER_TILE, type ModuleEntry } from "./constants";
import { legacyCatalog } from "./legacyRegistry";
import { JUMP_THEME_NAMES, MECHANIC_THEMES, type JumpThemeName } from "./themes";
import { LevelError, MAX_SAW_CYCLE, TILE_EMPTY, TILE_SOLID, isSolidTile, parseLevel, laserBarBox, laserBox, platformPos, pressBox, sawCenter, type Level } from "./level";

// Les morceaux (lot 4) : des portions de niveau écrites en texte qui **portent leur solution**, matière première du niveau du jour (lot 5).
// La source est un fichier texte par morceau (`packages/jump-sim/modules/<id>.txt`) ; le solveur hors ligne (`npm run solve:modules -w
// @cdj/jump-sim`) recopie ces textes et les solutions trouvées dans `catalog.ts` (généré : la simulation reste pure, sans lecture de fichier).
//
// Format d'un fichier, **version 3** (lot 7 ; une ligne `clé: valeur` par métadonnée, `//` commente une ligne) :
//   id: cheminee                                  minuscules, chiffres, tirets ; le nom du fichier
//   intention: Monter une cheminée …              une phrase en français (lot 20 : absente du catalogue embarqué, `apps/jump/public/outils/intentions.json`)
//   etiquettes: mural vertical                    parmi MODULE_TAGS (lot 20 : `plateforme` pour un morceau à plateforme mobile ; lot 22 : `presse` ; lot 23 : `champignon`,
//                                                 un morceau dont la grille a des champignons `m` `w` `(` `)` ; lot 24 : `stalactite`, une ligne `stalactite` du bloc annexe)
//   theme: usine                                  (lot 11, facultatif) le morceau d'une mécanique : il ne sort que dans ce thème (`usine` : étiquette
//                                                 `tapis` ; `glace` : `glace` ; lot 12 : `nuit` : `clignotant` ; `neon` : `alterne` ; lot 13 :
//                                                 `foret` : `vent`) ; sans cette
//                                                 ligne, il sort dans tous les thèmes
//   famille: cheminee                             (lot 7) les morceaux de même intention ; une seule famille de chaque par niveau
//   enchainement: long                            (lot 7, facultatif) un enchaînement long : deux intentions sans palier, 5 à 8 s
//   elan: oui                                     (lot 7, facultatif) l'élan est le défi : un plat sans défi va jusqu'à 9 tuiles (6 sinon)
//   mutateurs: plafond fosse                      (lot 7, facultatif) les mutateurs acceptés, chacun avec sa zone dans le bloc annexe
//   format: 3                                     la version du format (v1 aux paliers dessinés, v2 sans famille : refusés)
//   paliers: 17 6                                 rangées (de la grille) du **sol** à l'entrée, puis à la sortie
//   repeter: haut rangees 6-7                     un paramètre nommé et une plage de rangées (ou de `colonnes`) de la grille
//   variante: haut=2 cycle=180 +plafond:pics      une valeur pour chaque paramètre, et jusqu'à deux mutateurs (`+nom` ou `+nom:argument`) ;
//                                                 de 1 à `MAX_VARIANTS` (10) variantes
//   grille:                                       puis la grille (caractères de `level.ts`, sans `S`, `F` ni `C`), une ligne vide,
//   scie <id> <rayon> <cycle> <mode> <c,r>…       puis le bloc annexe : des scies (la section est implicite)
//   clignote <cycle> <solide> <décalage>          (lot 12) le cycle des blocs clignotants `b` `d` du morceau (la section est implicite ; `{param}` permis)
//   vent <c0>-<c1> <r0>-<r1> <sens> <force> [rafale <cycle> <actif> <décalage>]
//                                                 (lot 13) une zone de vent (syntaxe de `level.ts`) ; colonnes et rangées du gabarit (de la
//                                                 première copie de `c0`/`r0` à la dernière de `c1`/`r1`), section implicite, `{param}` permis ;
//                                                 lot 27 : si la variante donne `cycle=0` (avec `rafale {cycle} …` au gabarit), la clause de rafale est
//                                                 retirée et la zone souffle **en continu** (les variantes à vent continu du générateur g21)
//   plateforme <id> <largeur> <h|v> <cycle> <c,r> <c,r>
//                                                 (lot 20) une plateforme mobile (syntaxe de `level.ts`) : ses deux extrémités (coin haut-gauche), en
//                                                 coordonnées du gabarit (la première copie d'une plage répétée, ou la dernière avec une apostrophe),
//                                                 la section est implicite, `{param}` permis ; au niveau du jour l'identifiant prend le nom du morceau
//   presse <id> <largeur> <c,r> <course> <attente> <chute> <pause> <remontée>
//                                                 (lot 22) une presse (syntaxe de `level.ts`) : le coin haut-gauche de sa position haute en
//                                                 coordonnées du gabarit (la première copie d'une plage répétée, ou la dernière avec une apostrophe),
//                                                 la section est implicite, `{param}` permis ; au niveau du jour l'identifiant prend le nom du morceau
//   stalactite <id> <c,r> <avant> <après>
//                                                 (lot 24) une stalactite (syntaxe de `level.ts`) : la tuile de la pointe haute de son corps (sous un plafond plein), en
//                                                 coordonnées du gabarit (la première copie d'une plage répétée, ou la dernière avec une apostrophe), et sa zone de
//                                                 déclenchement en colonnes de chaque côté ; section implicite, `{param}` permis ; au niveau du jour l'identifiant prend le nom du morceau
//   laser <id> <h|v> <c,r> <long> <cycle> <allumé> <décalage>
//                                                 (lot 25) un laser fixe (syntaxe de `level.ts`) : la première tuile de son rayon en coordonnées du gabarit
//                                                 (première copie d'une plage répétée, ou dernière avec une apostrophe) ; ses deux émetteurs sont les `#` qui le bornent
//   barre <id> <h|v> <long> <cycle> <c,r> <c,r>
//                                                 (lot 25) une barre laser coulissante (syntaxe de `level.ts`) : ses deux positions extrêmes en coordonnées du gabarit
//   pont <id> <délai> <c,r> <tuiles>…
//                                                 (lot 26) un pont à interrupteur (syntaxe de `level.ts`) : l'interrupteur `c,r` (un `#` de la grille) puis les tuiles du pont
//                                                 dans l'ordre où il s'éteint (`c,r`, `c0-c1,r`, `c,r0-r1`), en coordonnées du gabarit (première copie d'une plage répétée, ou
//                                                 dernière avec une apostrophe) ; pas de section (hors horloge), `{param}` permis
//   zone <mutateur> …                             et les zones de mutation (ci-dessous)
//
// **Mutateurs (lot 7).** Une transformation déclarative du **gabarit** (avant le déroulé des plages répétées : une zone posée sur une plage
// est recopiée avec elle), appliquée dans l'ordre de la variante. Zones (coordonnées du gabarit ; `a-b` ou `a` seul) :
//   zone plafond <colonnes> <rangée>              `+plafond` (ou `:nu`) : du haut jusqu'à la rangée, tout devient plein ; `+plafond:pics` :
//                                                 plein jusqu'à la rangée d'au-dessus, la rangée elle-même garnie de pics `v`
//   zone fosse <colonnes> <rangée>                `+fosse` : un fond vide (aucun sol jusqu'en bas) devient un fond de pics `^` posé sur du
//                                                 plein ; un fond de pics devient vide jusqu'en bas (on peut s'y rattraper à un mur)
//   zone sol-friable <colonnes> <rangée>          `+sol-friable` : ces tuiles de sol (`#`) deviennent friables (`x`)
//   zone patrouille <rayon> <cycle> <mode> <c,r>… `+patrouille` : ajoute cette scie mobile ; `+patrouille:<cycle>` change son cycle
//   zone garde <colonnes> <rangées> <pic>         `+garde` : ces tuiles vides, contre un mur, prennent ce pic (`<` `>` `^` `v`)
//   zone ressort <colonnes> <rangée>              `+ressort` : ces tuiles de marche (`#`) deviennent des ressorts (`*`)
//   zone surface <colonnes> <rangée>              `+surface:glace` (`~`), `+surface:tapis:gauche` (`[`) ou `+surface:tapis:droite` (`]`) (lot 11) :
//                                                 ces tuiles de sol (`#`) changent de surface ; la variante n'est permise que dans le thème de
//                                                 sa mécanique (glace : `glace` ; usine : `tapis`)
//   zone clignotant <colonnes> <rangées> <b|d>    `+clignotant:<profil>` (lot 12) : ces tuiles de sol (`#`) deviennent des blocs clignotants du groupe
//                                                 `b` ou `d` ; le profil (`BLINK_PROFILES` : `lent`, `moyen`, `vif`, `decale`) fixe le cycle ; la
//                                                 variante n'est permise que dans le thème nuit
//   zone alterne <colonnes> <rangées> <A|B>       `+alterne` (lot 12) : ces tuiles de sol (`#`) deviennent des blocs alternés `A` ou `B` ; la
//                                                 variante n'est permise que dans le thème néon
//   zone vent <colonnes> <rangées>                `+vent:<haut|gauche|droite>` (lot 13) : une zone de vent de force 100 sur ce rectangle ;
//                                                 `+vent:<sens>:rafale` : en rafales (`WIND_GUST_PROFILE`) ; la variante n'est permise qu'en forêt
//   zone denivele <colonnes>                      `+denivele:<k>` : les colonnes de la zone (jusqu'au bout de la grille) descendent de k
//                                                 rangées (k < 0 : montent) ; la sortie aussi (« finit plus bas » ou plus haut)
// Lot 19, **mutateurs de silhouette** (ce que l'œil reconnaît d'un passage) :
//   zone hausse <colonnes> <rangée>               `+hausse:<k>` (k de −3 à 3) : le haut de ces colonnes pleines, à la rangée, monte de k rangées
//                                                 (les k cases vides au-dessus deviennent pleines) ou descend de −k (les −k premières cases
//                                                 pleines se vident) : une marche, un mur plus haut ou plus bas
//   zone ecart <colonnes>                         `+ecart:<k>` (k : −1, 1, 2 ou 3) : ces colonnes (un trou, un fossé, un écart entre deux
//                                                 murs) sont recopiées 1 + k fois, comme une plage `repeter` (elle ne doit en chevaucher aucune)
//   zone decale <colonnes> <rangées>              `+decale:<dc>` ou `+decale:<dc>:<dr>` : les dangers du rectangle (pics, scies fixes `o` `O`,
//                                                 points des scies mobiles) se déplacent de dc colonnes et dr rangées ; un pic arrive sur un
//                                                 support du même côté (sol sous `^`, plafond sur `v`, mur derrière `<` `>`)
//   zone echange <colonnes> <rangées>             `+echange:scies` : les pics du rectangle deviennent de petites scies fixes `o` ;
//                                                 `+echange:pics` : ses petites scies fixes deviennent des pics tournés vers leur support. Une
//                                                 variante échangée n'est gardée que si sa note est celle de la variante d'origine (même exigence)
// Le résultat est un morceau ordinaire, vérifié comme les autres (paliers, hauteur, plats), résolu par le solveur ; une variante mutée au
// pas près, au raccord sous 90 % ou sans solution est retirée du fichier.
//
// **Variantes déclaratives.** Une plage `repeter` est dessinée **une fois** dans la grille ; dans une variante, elle apparaît autant de
// fois que la valeur du paramètre (0 la retire) : `repeter: trou colonnes 12-12` avec `trou=3` donne un trou de trois colonnes. Deux plages
// d'un même axe ne se chevauchent pas. Dans le bloc annexe, `{nom}` est remplacé par la valeur du paramètre (cycle, rayon d'une scie…), et
// les coordonnées `col,rangée` sont celles de la grille : elles désignent la **première** copie d'une plage répétée, ou la **dernière** avec
// une apostrophe (`14',3`).
//
// **Paliers (lot 6).** Les paliers **ne sont plus dessinés** : la grille commence à la première colonne du défi et finit à la dernière.
// `buildModule` pose de chaque côté le **palier standard** : `PALIER_LENGTH` colonnes de sol plein à la rangée déclarée, du plein dessous,
// **du vide au-dessus jusqu'en haut de la grille** (un rebord, pas un couloir). Le même palier sert dans le niveau du jour, où le palier de
// sortie d'un morceau **est** le palier d'entrée du suivant (les mêmes tuiles). Le morceau forme **une seule section** : ses scies mobiles
// démarrent quand le centre du personnage passe le bord droit du palier d'entrée.
//
// **Le point canonique est le bord droit d'un palier.** Une solution **sort** au premier pas où le centre du personnage franchit le bord
// droit du palier de sortie, au sol, à `runSpeed`, en course « propre » (`isCleanRun` : bouton relâché, rien en attente) ; le morceau
// suivant **entre en élan** exactement là. L'entrée *arrêt* se fait immobile au début du palier d'entrée (premier morceau du niveau,
// reprise sur un point de passage). Le niveau d'un morceau seul : palier d'entrée (départ `S` sur sa première colonne) · grille · palier
// de sortie · une colonne de piste et la colonne d'arrivée `F` (seulement pour finir le morceau joué seul : la solution est déjà sortie) ;
// devant le palier d'entrée, une colonne de garde (`PALIER_GUARD`) l'écarte du bord du niveau, et la solution ne repasse jamais à gauche du
// début du palier d'entrée (une reprise sur un point de passage a, à sa gauche, le morceau précédent).
// L'entrée *élan* d'un morceau seul part du même départ, au sol, à pleine vitesse (drapeau « élan » de la rediffusion) : elle court jusqu'au
// bord du palier (`entryTick` pas, droite tenue) puis joue.

export const MODULE_TAGS = ["mural", "precision", "vertical", "scie", "friable", "ressort", "respiration", "tapis", "glace", "clignotant", "alterne", "vent", "plateforme", "presse", "champignon", "stalactite", "laser", "pont"] as const;
/** Les mutateurs (lot 7 ; `surface` : lot 11 ; `clignotant` et `alterne` : lot 12 ; `vent` : lot 13 ; lot 19, silhouette : `hausse`, `ecart`, `decale`, `echange`). */
export const MUTATORS = ["plafond", "fosse", "sol-friable", "patrouille", "garde", "ressort", "denivele", "surface", "clignotant", "alterne", "vent", "hausse", "ecart", "decale", "echange"] as const;
export type MutatorName = (typeof MUTATORS)[number];
/** Au plus ce nombre de mutateurs par variante, et de variantes par morceau (lot 7). */
export const MAX_MUTATIONS = 2;
export const MAX_VARIANTS = 10;
export type ModuleTag = (typeof MODULE_TAGS)[number];
// Lot 21 : `MODULE_ENTRIES` et `PALIER_LENGTH` sont dans `constants.ts` (lus au premier chargement du jeu, sans le catalogue) ; ré-exportés ici.
export { MODULE_ENTRIES, PALIER_LENGTH, type ModuleEntry };

/** Hauteur maximale d'un morceau construit, en rangées. */
export const MODULE_MAX_HEIGHT = 30;
/** Version du format des fichiers de morceaux (lot 6 : paliers posés, plus dessinés ; lot 7 : famille, mutateurs). */
export const MODULE_FORMAT = 3;
/**
 * Colonne de garde devant le palier d'entrée (morceau seul, et début du niveau du jour) : une colonne comme un palier, pour que le départ ne
 * soit jamais à portée de saut mural du bord gauche du niveau. Une reprise sur un point de passage a, à sa gauche, le morceau précédent :
 * une solution ne doit rien devoir au bord du niveau (et ne repasse jamais à gauche du palier d'entrée : `moduleSpan`).
 */
export const PALIER_GUARD = 1;
/** Rangées libres au-dessus du sol d'un palier, au moins (la rangée du sol déclarée est au moins celle-ci). */
export const PALIER_HEADROOM = 4;
/** Durée d'une solution entre son entrée et sa sortie canoniques (`ModuleSolution.exitTick − entryTick`) : entre 1 et 6 s… */
export const MODULE_MIN_TICKS = 120;
export const MODULE_MAX_TICKS = 720;
/** … et de 5 à 8 s pour un enchaînement long (lot 7). */
export const LONG_MIN_TICKS = 600;
export const LONG_MAX_TICKS = 960;
/** Copies d'une plage répétée : de 0 à 40 (un paramètre du bloc annexe, comme un cycle, va jusqu'à `MAX_SAW_CYCLE`). */
export const MAX_PARAM = 40;

export class ModuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModuleError";
  }
}

export interface ModuleRepeat {
  param: string;
  axis: "colonnes" | "rangees";
  from: number;
  to: number;
}

/** Un mutateur d'une variante : son nom et son argument (`pics`, `-2`, `240`… ; vide sans argument). */
export interface Mutation {
  name: MutatorName;
  arg: string;
}

/** Une zone de mutation (bloc annexe), en coordonnées du gabarit. */
export interface MutationZone {
  name: MutatorName;
  /** Colonnes et rangées (bornes comprises) ; pour `patrouille`, la déclaration de la scie (rayon, cycle, mode, points). */
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  /** `garde` : le pic posé ; `patrouille` : les mots de la scie (après `scie <id>`). */
  extra: string;
}

/** Un morceau tel qu'écrit (gabarit + métadonnées). */
export interface ModuleDef {
  id: string;
  intention: string;
  tags: readonly ModuleTag[];
  /** Famille (lot 7) : les morceaux de même intention ; une seule de chaque par niveau. */
  family: string;
  /** Lot 11 : le thème d'une mécanique (`usine`, `glace`) auquel le morceau est réservé ; null : tous les thèmes. */
  theme: JumpThemeName | null;
  /** Enchaînement long (lot 7) : deux intentions sans palier au milieu, solution de 5 à 8 s. */
  long: boolean;
  /** L'élan est le défi (lot 7) : un plat sans défi peut aller jusqu'à `ELAN_FLAT_MAX` tuiles. */
  elan: boolean;
  /** Mutateurs acceptés, et leurs zones. */
  mutators: readonly MutatorName[];
  zones: readonly MutationZone[];
  /** Mutateurs de chaque variante (dans l'ordre d'application). */
  mutations: readonly (readonly Mutation[])[];
  /** Rangées de la grille du sol à l'entrée et à la sortie (celles des paliers posés). */
  entryRow: number;
  exitRow: number;
  repeats: readonly ModuleRepeat[];
  /** Paramètres (dans l'ordre de leur première mention) et valeurs de chaque variante. */
  params: readonly string[];
  variants: readonly Readonly<Record<string, number>>[];
  grid: readonly string[];
  annex: readonly string[];
  /** Texte du fichier. */
  text: string;
}

const KEYS = new Set(["id", "intention", "etiquettes", "famille", "theme", "enchainement", "elan", "mutateurs", "format", "paliers", "repeter", "variante"]);
const SPIKES = "<>^v";

/** `a-b` ou `a` → [a, b]. */
function span(text: string): [number, number] | null {
  const m = /^(\d+)(?:-(\d+))?$/.exec(text);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] === undefined ? a : Number(m[2]);
  return a <= b ? [a, b] : null;
}

/** Lit une zone de mutation (`zone <mutateur> …`) ; `fail` lève l'erreur. */
function parseZone(words: readonly string[], width: number, height: number, fail: (s: string) => never): MutationZone {
  const name = words[1] as MutatorName;
  if (!(MUTATORS as readonly string[]).includes(name)) fail(`zone « ${words[1]} » : mutateur inconnu (${MUTATORS.join(", ")})`);
  const cols = (w: string | undefined) => {
    const v = w === undefined ? null : span(w);
    if (!v || v[1] >= width) fail(`zone ${name} : colonnes « ${w} » hors du gabarit`);
    return v!;
  };
  const rows = (w: string | undefined) => {
    const v = w === undefined ? null : span(w);
    if (!v || v[1] >= height) fail(`zone ${name} : rangées « ${w} » hors du gabarit`);
    return v!;
  };
  const zone = (c: [number, number], r: [number, number], extra = ""): MutationZone => ({ name, c0: c[0], c1: c[1], r0: r[0], r1: r[1], extra });
  switch (name) {
    case "plafond":
    case "fosse":
    case "sol-friable":
    case "ressort":
    case "surface":
      if (words.length !== 4) fail(`« zone ${name} <colonnes> <rangée> » attendu`);
      return zone(cols(words[2]), rows(words[3]));
    case "garde":
      if (words.length !== 5 || words[4]!.length !== 1 || !SPIKES.includes(words[4]!)) fail("« zone garde <colonnes> <rangées> <pic : < > ^ v> » attendu");
      return zone(cols(words[2]), rows(words[3]), words[4]);
    case "vent":
      if (words.length !== 4) fail("« zone vent <colonnes> <rangées> » attendu");
      return zone(cols(words[2]), rows(words[3]));
    case "clignotant":
    case "alterne": {
      const groups = name === "clignotant" ? "bd" : "AB";
      if (words.length !== 5 || words[4]!.length !== 1 || !groups.includes(words[4]!)) fail(`« zone ${name} <colonnes> <rangées> <${groups.split("").join("|")}> » attendu`);
      return zone(cols(words[2]), rows(words[3]), words[4]);
    }
    case "hausse":
      if (words.length !== 4) fail("« zone hausse <colonnes> <rangée> » attendu");
      return zone(cols(words[2]), rows(words[3]));
    case "ecart":
      if (words.length !== 3) fail("« zone ecart <colonnes> » attendu");
      return zone(cols(words[2]), [0, height - 1]);
    case "decale":
    case "echange":
      if (words.length !== 4) fail(`« zone ${name} <colonnes> <rangées> » attendu`);
      return zone(cols(words[2]), rows(words[3]));
    case "denivele": {
      if (words.length !== 3) fail("« zone denivele <colonnes> » attendu");
      const c = cols(words[2]);
      if (c[1] !== width - 1) fail("zone denivele : elle va jusqu'à la dernière colonne (la sortie)");
      return zone(c, [0, height - 1]);
    }
    case "patrouille":
      if (words.length < 7) fail("« zone patrouille <rayon> <cycle> <mode> <c,r> <c,r>… » attendu");
      return zone([0, width - 1], [0, height - 1], words.slice(2).join(" "));
  }
}
const MODULE_GRID = /^[#.^v<>oOx*[\]~bdABmw()]+$/;

/**
 * Lot 12 : les profils de clignotement des mutations `+clignotant:<profil>` — cycle, pas solides de `b`, décalage (pas). `lent` : 3 s, solide
 * 1,8 s ; `moyen` : 2,25 s, 1,25 s ; `vif` : 1,75 s, 0,9 s ; `decale` : 2,5 s, `b` absent au pas 0 (on attend qu'il apparaisse).
 */
/** Lot 13 : la rafale des mutations `+vent:<sens>:rafale` — 2 s de cycle, souffle 1 s, sans décalage (souffle à l'entrée). */
export const WIND_GUST_PROFILE = Object.freeze({ cycle: 240, active: 120, shift: 0 });

export const BLINK_PROFILES: Readonly<Record<string, { cycle: number; solid: number; shift: number }>> = Object.freeze({
  lent: { cycle: 360, solid: 216, shift: 0 },
  moyen: { cycle: 270, solid: 150, shift: 0 },
  vif: { cycle: 210, solid: 108, shift: 0 },
  decale: { cycle: 300, solid: 170, shift: 200 },
  // Lot 18 : `lent` a une phase absente de 1,2 s (< 1,5 s, `BLINK_PHASE_MIN`) ; `calme` la remplace dans le générateur à une seule horloge
  // (phase présente 1,8 s, absente 1,5 s). `lent` reste pour la référence v3.
  calme: { cycle: 396, solid: 216, shift: 0 },
});

/**
 * Lot 18 (g13) : **chaque phase d'un bloc clignotant, présente ou absente, dure au moins 1,5 s** (180 pas) — sinon le joueur n'a pas le temps de
 * lire l'annonce (jauge de 0,6 s à la disparition, contour de 0,4 s avant la réapparition) ni de réagir. Une variante dont un cycle a une phase plus
 * courte est refusée par le générateur à une seule horloge (`BLINK_TOO_FAST`, `daily.ts`) ; la référence v3 la connaît telle quelle.
 */
export const BLINK_PHASE_MIN = 180;

/** Les phases de chaque cycle de clignotement d'un niveau (`présent` = `solid`, `absent` = le reste du cycle), en pas. */
export function blinkPhases(level: Pick<Level, "blinkCycles">): { present: number; absent: number }[] {
  const out: { present: number; absent: number }[] = [];
  for (const c of level.blinkCycles) if (c) out.push({ present: c.solid, absent: c.cycle - c.solid });
  return out;
}

/** Les phases trop courtes de ce niveau (lot 18) : vide si toutes durent au moins `BLINK_PHASE_MIN` pas. */
export function blinkRhythmProblems(level: Pick<Level, "blinkCycles">): string[] {
  const out: string[] = [];
  for (const p of blinkPhases(level)) {
    if (p.present < BLINK_PHASE_MIN) out.push(`phase présente de ${p.present} pas (au moins ${BLINK_PHASE_MIN})`);
    if (p.absent < BLINK_PHASE_MIN) out.push(`phase absente de ${p.absent} pas (au moins ${BLINK_PHASE_MIN})`);
  }
  return out;
}

/** Lit le texte d'un morceau. Refuse tout ce qui est mal formé (clé inconnue, étiquette inconnue, variante incomplète…). */
export function parseModule(text: string): ModuleDef {
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  const meta: Record<string, string[]> = {};
  for (; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (raw === "" || raw.startsWith("//")) continue;
    if (raw === "grille:") break;
    const m = /^([a-z]+):\s*(.*)$/.exec(raw);
    if (!m || !KEYS.has(m[1]!)) throw new ModuleError(`Ligne ${i + 1} : « clé: valeur » attendu (${[...KEYS].join(", ")}, puis « grille: »)`);
    (meta[m[1]!] ??= []).push(m[2]!.trim());
  }
  if (i >= lines.length) throw new ModuleError("« grille: » manquant");
  const one = (k: string) => {
    const v = meta[k];
    if (!v || v.length !== 1 || v[0] === "") throw new ModuleError(`« ${k}: » attendu une fois`);
    return v[0]!;
  };
  const id = one("id");
  if (!/^[a-z0-9-]{1,24}$/.test(id)) throw new ModuleError(`id « ${id} » invalide (minuscules, chiffres, tirets, 24 au plus)`);
  const where = (s: string) => `Morceau « ${id} » : ${s}`;
  // Lot 20 : le catalogue embarqué n'a plus la ligne `intention:` (poids du jeu) ; un fichier de morceau, lui, l'a toujours (`tools/files.ts`, `intentions.json`).
  const intention = meta.intention === undefined ? "" : one("intention");
  const tags = one("etiquettes").split(/\s+/);
  for (const t of tags) if (!(MODULE_TAGS as readonly string[]).includes(t)) throw new ModuleError(where(`étiquette « ${t} » inconnue (${MODULE_TAGS.join(", ")})`));
  if (new Set(tags).size !== tags.length) throw new ModuleError(where("étiquette en double"));
  if (one("format") !== String(MODULE_FORMAT)) throw new ModuleError(where(`format ${one("format")} : seul le format ${MODULE_FORMAT} (paliers posés, famille et mutateurs, lot 7) est lu`));
  const family = one("famille");
  if (!/^[a-z0-9-]{1,24}$/.test(family)) throw new ModuleError(where(`famille « ${family} » invalide (minuscules, chiffres, tirets)`));
  const themeText = meta.theme === undefined ? null : one("theme");
  if (themeText !== null && !(MECHANIC_THEMES as readonly string[]).includes(themeText)) throw new ModuleError(where(`theme « ${themeText} » inconnu (${MECHANIC_THEMES.join(", ")})`));
  const theme = themeText as JumpThemeName | null;
  // Lot 11 : l'étiquette d'une mécanique et le thème vont ensemble (un morceau `tapis` est de l'usine, un morceau `glace` de la glace).
  for (const [tag, th] of [["tapis", "usine"], ["glace", "glace"], ["clignotant", "nuit"], ["alterne", "neon"], ["vent", "foret"]] as const) {
    // Lot 22 : les presses sont la seconde mécanique de l'usine : un morceau `presse` est de l'usine, avec ou sans tapis.
    // Lot 23 : les champignons sont la seconde mécanique de la forêt : un morceau `champignon` est de la forêt, avec ou sans vent.
    // Lot 24 : les stalactites sont la seconde mécanique de la glace : un morceau `stalactite` est de la glace, avec ou sans glace au sol.
    const mine = tags.includes(tag) || (th === "usine" && tags.includes("presse")) || (th === "foret" && tags.includes("champignon")) || (th === "glace" && tags.includes("stalactite")) || (th === "neon" && tags.includes("laser")) || (th === "nuit" && tags.includes("pont"));
    if (mine !== (theme === th)) throw new ModuleError(where(`l'étiquette « ${tag} »${th === "usine" ? " (ou « presse »)" : th === "foret" ? " (ou « champignon »)" : th === "glace" ? " (ou « stalactite »)" : th === "neon" ? " (ou « laser »)" : th === "nuit" ? " (ou « pont »)" : ""} et « theme: ${th} » vont ensemble`));
  }
  const optional = (k: string, value: string) => {
    const v = meta[k];
    if (!v) return false;
    if (v.length !== 1 || v[0] !== value) throw new ModuleError(where(`« ${k}: ${value} » attendu (ou rien)`));
    return true;
  };
  const long = optional("enchainement", "long");
  const elan = optional("elan", "oui");
  const mutators = (meta.mutateurs ?? []).flatMap((l) => l.split(/\s+/)).filter(Boolean) as MutatorName[];
  for (const m of mutators) if (!(MUTATORS as readonly string[]).includes(m)) throw new ModuleError(where(`mutateur « ${m} » inconnu (${MUTATORS.join(", ")})`));
  if (new Set(mutators).size !== mutators.length) throw new ModuleError(where("mutateur en double"));
  const paliers = /^(\d+)\s+(\d+)$/.exec(one("paliers"));
  if (!paliers) throw new ModuleError(where("« paliers: <rangée du sol à l'entrée> <rangée du sol à la sortie> » attendu"));

  // ——— Grille, puis bloc annexe ———
  i++;
  const grid: string[] = [];
  for (; i < lines.length && lines[i]!.trim() !== ""; i++) grid.push(lines[i]!.trim());
  const annexAll = lines.slice(i).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("//"));
  const annex = annexAll.filter((l) => !l.startsWith("zone "));
  // Lot 20 : l'étiquette `plateforme` et une ligne `plateforme` du bloc annexe vont ensemble (comme une mécanique et son thème).
  if (tags.includes("plateforme") !== annex.some((l) => l.startsWith("plateforme "))) throw new ModuleError(where("l'étiquette « plateforme » et une ligne « plateforme » du bloc annexe vont ensemble"));
  // Lot 22 : de même pour les presses.
  if (tags.includes("presse") !== annex.some((l) => l.startsWith("presse "))) throw new ModuleError(where("l'étiquette « presse » et une ligne « presse » du bloc annexe vont ensemble"));
  // Lot 24 : de même pour les stalactites.
  if (tags.includes("stalactite") !== annex.some((l) => l.startsWith("stalactite "))) throw new ModuleError(where("l'étiquette « stalactite » et une ligne « stalactite » du bloc annexe vont ensemble"));
  // Lot 25 : de même pour les lasers (une ligne « laser » ou « barre » du bloc annexe).
  if (tags.includes("laser") !== annex.some((l) => l.startsWith("laser ") || l.startsWith("barre "))) throw new ModuleError(where("l'étiquette « laser » et une ligne « laser » ou « barre » du bloc annexe vont ensemble"));
  // Lot 26 : de même pour les ponts à interrupteur (une ligne « pont » du bloc annexe).
  if (tags.includes("pont") !== annex.some((l) => l.startsWith("pont "))) throw new ModuleError(where("l'étiquette « pont » et une ligne « pont » du bloc annexe vont ensemble"));
  if (grid.length === 0) throw new ModuleError(where("grille vide"));
  // Lot 23 : l'étiquette `champignon` et des champignons dans la grille vont ensemble.
  if (tags.includes("champignon") !== grid.some((row) => /[mw()]/.test(row))) throw new ModuleError(where("l'étiquette « champignon » et des champignons « m w ( ) » dans la grille vont ensemble"));
  const width = grid[0]!.length;
  grid.forEach((row, r) => {
    if (row.length !== width) throw new ModuleError(where(`rangée ${r} : ${row.length} colonnes au lieu de ${width}`));
    if (!MODULE_GRID.test(row)) throw new ModuleError(where(`rangée ${r} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`));
  });
  const entryRow = Number(paliers[1]);
  const exitRow = Number(paliers[2]);
  if (entryRow >= grid.length || exitRow >= grid.length) throw new ModuleError(where("rangée de palier hors de la grille"));
  if (entryRow < PALIER_HEADROOM || exitRow < PALIER_HEADROOM) throw new ModuleError(where(`rangée de palier sous la ${PALIER_HEADROOM}e : moins de ${PALIER_HEADROOM} rangées libres au-dessus`));

  // ——— Plages répétées ———
  const params: string[] = [];
  const repeats: ModuleRepeat[] = (meta.repeter ?? []).map((spec) => {
    const m = /^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(spec);
    if (!m) throw new ModuleError(where(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${spec} »)`));
    const rep: ModuleRepeat = { param: m[1]!, axis: m[2] as ModuleRepeat["axis"], from: Number(m[3]), to: Number(m[4]) };
    const size = rep.axis === "colonnes" ? width : grid.length;
    if (rep.from > rep.to || rep.to >= size) throw new ModuleError(where(`plage ${rep.from}-${rep.to} hors du gabarit`));
    if (!params.includes(rep.param)) params.push(rep.param);
    return rep;
  });
  for (const a of repeats) {
    for (const b of repeats) {
      if (a !== b && a.axis === b.axis && a.from <= b.to && b.from <= a.to) throw new ModuleError(where(`les plages ${a.from}-${a.to} et ${b.from}-${b.to} se chevauchent`));
    }
  }
  for (const line of annexAll) for (const m of line.matchAll(/\{([a-z][a-z0-9]*)\}/g)) if (!params.includes(m[1]!)) params.push(m[1]!);
  const fail = (msg: string): never => {
    throw new ModuleError(where(msg));
  };
  const zones = annexAll.filter((l) => l.startsWith("zone ")).map((l) => parseZone(l.split(/\s+/), width, grid.length, fail));
  for (const m of mutators) if (!zones.some((z) => z.name === m)) fail(`mutateur « ${m} » sans zone`);
  for (const z of zones) if (!mutators.includes(z.name)) fail(`zone ${z.name} : mutateur absent de « mutateurs: »`);
  for (const r of [entryRow, exitRow]) if (repeats.some((p) => p.axis === "rangees" && r >= p.from && r <= p.to)) throw new ModuleError(where("une rangée de palier ne se répète pas"));

  // ——— Variantes ———
  const mutations: Mutation[][] = [];
  const variants = (meta.variante ?? []).map((spec, k) => {
    const values: Record<string, number> = {};
    const muts: Mutation[] = [];
    mutations.push(muts);
    for (const w of spec.split(/\s+/).filter(Boolean)) {
      if (w.startsWith("+")) {
        const mm = /^\+([a-z-]+)(?::(-?[a-z0-9:-]+))?$/.exec(w);
        if (!mm || !mutators.includes(mm[1] as MutatorName)) fail(`variante ${k} : mutateur « ${w} » non accepté (${mutators.join(", ") || "aucun"})`);
        const name = mm![1] as MutatorName;
        const arg = mm![2] ?? "";
        const okArg =
          name === "clignotant" ? arg in BLINK_PROFILES : name === "vent" ? /^(haut|gauche|droite)(:rafale)?$/.test(arg) : name === "alterne" ? arg === "" : name === "plafond" ? arg === "" || arg === "nu" || arg === "pics" : name === "denivele" ? /^-?[1-9]\d?$/.test(arg) : name === "patrouille" ? arg === "" || /^[1-9]\d{0,4}$/.test(arg) : name === "surface" ? (SURFACE_ARGS as readonly string[]).includes(arg) : name === "hausse" ? /^-?[1-3]$/.test(arg) : name === "ecart" ? /^(-1|[1-3])$/.test(arg) : name === "decale" ? /^-?\d(:-?\d)?$/.test(arg) && arg !== "0" && arg !== "0:0" : name === "echange" ? arg === "scies" || arg === "pics" : arg === "";
        if (!okArg) fail(`variante ${k} : argument « ${arg} » de ${name} invalide`);
        if (muts.some((x) => x.name === name)) fail(`variante ${k} : ${name} deux fois`);
        muts.push({ name, arg });
        continue;
      }
      const m = /^([a-z][a-z0-9]*)=(\d+)$/.exec(w);
      if (!m) throw new ModuleError(where(`variante ${k} : « nom=valeur » attendu (« ${w} »)`));
      if (!params.includes(m[1]!)) throw new ModuleError(where(`variante ${k} : paramètre « ${m[1]} » inconnu`));
      const v = Number(m[2]);
      const max = repeats.some((r) => r.param === m[1]) ? MAX_PARAM : MAX_SAW_CYCLE;
      if (v > max) throw new ModuleError(where(`variante ${k} : ${m[1]} = ${v} (au plus ${max})`));
      values[m[1]!] = v;
    }
    for (const p of params) if (values[p] === undefined) throw new ModuleError(where(`variante ${k} : « ${p} » manque`));
    if (muts.length > MAX_MUTATIONS) fail(`variante ${k} : au plus ${MAX_MUTATIONS} mutateurs`);
    return values;
  });
  if (variants.length === 0) throw new ModuleError(where("au moins une « variante: » (même sans paramètre)"));
  if (variants.length > MAX_VARIANTS) fail(`${variants.length} variantes (au plus ${MAX_VARIANTS})`);
  const seen = new Set(variants.map((v, k) => JSON.stringify([v, mutations[k]])));
  if (seen.size !== variants.length) fail("deux variantes identiques");
  return { id, intention, tags: tags as ModuleTag[], family, theme, long, elan, mutators, zones, mutations, entryRow, exitRow, repeats, params, variants, grid, annex, text };
}

/** Lot 11 : les arguments de `+surface` et le caractère de grille qu'ils posent. */
export const SURFACE_ARGS = ["glace", "tapis:gauche", "tapis:droite"] as const;
const SURFACE_CHARS: Readonly<Record<string, string>> = { glace: "~", "tapis:gauche": "[", "tapis:droite": "]" };

/**
 * Lot 11 : le thème auquel une variante est réservée : celui du morceau (`theme:`), sinon celui de sa mutation de surface (`+surface:glace`
 * → glace, `+surface:tapis:…` → usine), sinon null (tous les thèmes). Un morceau d'un thème ne mute pas vers l'autre.
 */
export function variantTheme(def: Pick<ModuleDef, "theme" | "mutations">, variant: number): JumpThemeName | null {
  const muts = def.mutations[variant] ?? [];
  const surface = muts.find((m) => m.name === "surface");
  const fromSurface: JumpThemeName | null = muts.some((m) => m.name === "clignotant")
    ? "nuit"
    : muts.some((m) => m.name === "alterne")
      ? "neon"
      : muts.some((m) => m.name === "vent")
        ? "foret"
        : !surface
          ? null
          : surface.arg === "glace"
            ? "glace"
            : "usine";
  return def.theme ?? fromSurface;
}

/** Un gabarit muté : grille, scies ajoutées (lignes du bloc annexe), et le dénivelé à appliquer après le déroulé (colonne du gabarit, k). */
export interface MutatedTemplate {
  grid: string[];
  annex: string[];
  denivele: { from: number; k: number } | null;
  /** Lot 19 : les écarts élargis (`+ecart`), des plages de colonnes du gabarit recopiées `copies` fois au déroulé. */
  ecarts: { from: number; to: number; copies: number }[];
}

/** Lot 19 : les tuiles sur lesquelles un pic peut être posé (pleines, quelle que soit leur surface). */
const SUPPORTS = "#x*[]~bdAB";

/**
 * Applique les mutateurs d'une variante au **gabarit** d'un morceau (avant le déroulé des plages répétées), dans l'ordre. Fonction pure : le
 * gabarit ne bouge pas. Lève `ModuleError` si une zone ne s'y prête pas (une tuile qui n'est pas ce que le mutateur attend).
 */
export function mutateTemplate(def: ModuleDef, mutations: readonly Mutation[]): MutatedTemplate {
  const grid = def.grid.map((r) => r.split(""));
  const annex = [...def.annex];
  let denivele: MutatedTemplate["denivele"] = null;
  const ecarts: MutatedTemplate["ecarts"] = [];
  const fail = (s: string): never => {
    throw new ModuleError(`Morceau « ${def.id} » : ${s}`);
  };
  const cell = (c: number, r: number) => grid[r]![c]!;
  const H = grid.length;
  const W = grid[0]!.length;
  const supported = (c: number, r: number) => c >= 0 && r >= 0 && c < W && r < H && SUPPORTS.includes(grid[r]![c]!);
  /** Le pic qui tient sur la case (c, r) : sol dessous, plafond dessus, mur à droite, mur à gauche ; vide s'il n'y a aucun support. */
  const spikeFor = (c: number, r: number) => (supported(c, r + 1) ? "^" : supported(c, r - 1) ? "v" : supported(c + 1, r) ? "<" : supported(c - 1, r) ? ">" : "");
  const holds = (t: string, c: number, r: number) => (t === "^" ? supported(c, r + 1) : t === "v" ? supported(c, r - 1) : t === "<" ? supported(c + 1, r) : t === ">" ? supported(c - 1, r) : true);
  const set = (c: number, r: number, v: string) => {
    grid[r]![c] = v;
  };
  let patrol = 0;
  for (const m of mutations) {
    const zones = def.zones.filter((z) => z.name === m.name);
    if (m.name === "clignotant") {
      // Lot 12 : le cycle du profil, déclaré une fois (une section, un cycle) ; un morceau qui en a déjà un n'est pas mutable ainsi.
      if (annex.some((l) => l.startsWith("clignote "))) fail("clignotant : le morceau déclare déjà un cycle");
      const prof = BLINK_PROFILES[m.arg]!;
      annex.push(`clignote ${prof.cycle} ${prof.solid} ${prof.shift}`);
    }
    // Lot 19 : `decale` et `echange` doivent toucher au moins un danger, toutes zones du mutateur réunies.
    let touched = 0;
    for (const z of zones) {
      const where = `${m.name} (colonnes ${z.c0}-${z.c1})`;
      switch (m.name) {
        case "plafond":
          for (let c = z.c0; c <= z.c1; c++) {
            for (let r = 0; r <= z.r0; r++) {
              if (cell(c, r) !== "." && cell(c, r) !== "#") fail(`${where} : tuile (${c}, ${r}) « ${cell(c, r)} » sous le plafond`);
              set(c, r, r === z.r0 && m.arg === "pics" ? "v" : "#");
            }
          }
          break;
        case "fosse": {
          const spiked = [];
          for (let c = z.c0; c <= z.c1; c++) spiked.push(cell(c, z.r0) === "^");
          if (spiked.every(Boolean)) {
            for (let c = z.c0; c <= z.c1; c++) for (let r = z.r0; r < grid.length; r++) set(c, r, ".");
          } else {
            for (let c = z.c0; c <= z.c1; c++) {
              for (let r = z.r0; r < grid.length; r++) if (cell(c, r) !== ".") fail(`${where} : ni fond de pics ni fond vide (tuile (${c}, ${r}))`);
              set(c, z.r0, "^");
              for (let r = z.r0 + 1; r < grid.length; r++) set(c, r, "#");
            }
          }
          break;
        }
        case "sol-friable":
        case "ressort":
        case "surface":
          for (let c = z.c0; c <= z.c1; c++) {
            if (cell(c, z.r0) !== "#") fail(`${where} : tuile (${c}, ${z.r0}) « ${cell(c, z.r0)} » au lieu d'un bloc`);
            set(c, z.r0, m.name === "ressort" ? "*" : m.name === "surface" ? SURFACE_CHARS[m.arg]! : "x");
          }
          break;
        case "garde":
          for (let c = z.c0; c <= z.c1; c++) {
            for (let r = z.r0; r <= z.r1; r++) {
              if (cell(c, r) !== ".") fail(`${where} : tuile (${c}, ${r}) occupée`);
              set(c, r, z.extra);
            }
          }
          break;
        case "clignotant":
        case "alterne":
          for (let c = z.c0; c <= z.c1; c++) {
            for (let r = z.r0; r <= z.r1; r++) {
              if (cell(c, r) !== "#") fail(`${where} : tuile (${c}, ${r}) « ${cell(c, r)} » au lieu d'un bloc`);
              set(c, r, z.extra);
            }
          }
          break;
        case "vent": {
          // Lot 13 : une zone de vent (coordonnées du gabarit, traduites au déroulé comme celles des scies).
          const [dir, gust] = m.arg.split(":");
          const g = WIND_GUST_PROFILE;
          annex.push(`vent ${z.c0}-${z.c1} ${z.r0}-${z.r1} ${dir} 100${gust ? ` rafale ${g.cycle} ${g.active} ${g.shift}` : ""}`);
          break;
        }
        case "patrouille": {
          const words = z.extra.split(" ");
          if (m.arg) words[1] = m.arg;
          annex.push(`scie mutee${patrol++ || ""} ${words.join(" ")}`);
          break;
        }
        case "hausse": {
          // Lot 19 : le haut de ces colonnes (plein à la rangée) monte ou descend de k rangées.
          const k = Number(m.arg);
          for (let c = z.c0; c <= z.c1; c++) {
            if (!SUPPORTS.includes(cell(c, z.r0)) || (z.r0 > 0 && cell(c, z.r0 - 1) !== ".")) fail(`${where} : (${c}, ${z.r0}) n'est pas le haut d'une colonne pleine`);
            if (k > 0) {
              for (let r = z.r0 - k; r < z.r0; r++) {
                if (r < 0 || cell(c, r) !== ".") fail(`${where} : pas de place pour monter de ${k} en colonne ${c}`);
                set(c, r, cell(c, z.r0));
              }
            } else {
              for (let r = z.r0; r < z.r0 - k; r++) {
                if (r >= H - 1 || !SUPPORTS.includes(cell(c, r)) || !SUPPORTS.includes(cell(c, r + 1))) fail(`${where} : la colonne ${c} n'est pas assez pleine pour descendre de ${-k}`);
              }
              const top = cell(c, z.r0);
              for (let r = z.r0; r < z.r0 - k; r++) set(c, r, ".");
              set(c, z.r0 - k, top);
            }
          }
          break;
        }
        case "ecart":
          // Lot 19 : recopié au déroulé, comme une plage `repeter` (`buildModuleDef`).
          ecarts.push({ from: z.c0, to: z.c1, copies: 1 + Number(m.arg) });
          break;
        case "decale": {
          // Lot 19 : les dangers du rectangle se déplacent d'un bloc (tous retirés, puis posés à leur nouvelle place).
          const [dc, dr = 0] = m.arg.split(":").map(Number) as [number, number?];
          const moved: { c: number; r: number; t: string }[] = [];
          for (let c = z.c0; c <= z.c1; c++) {
            for (let r = z.r0; r <= z.r1; r++) {
              if (!"^v<>oO".includes(cell(c, r))) continue;
              moved.push({ c: c + dc, r: r + dr!, t: cell(c, r) });
              set(c, r, ".");
            }
          }
          for (const h of moved) {
            if (h.c < 0 || h.r < 0 || h.c >= W || h.r >= H || cell(h.c, h.r) !== ".") fail(`${where} : (${h.c}, ${h.r}) n'est pas libre pour « ${h.t} »`);
            if (!holds(h.t, h.c, h.r)) fail(`${where} : « ${h.t} » sans support en (${h.c}, ${h.r})`);
            set(h.c, h.r, h.t);
          }
          touched += moved.length;
          for (let i = 0; i < annex.length; i++) {
            const words = annex[i]!.split(/\s+/);
            if (words[0] !== "scie") continue;
            annex[i] = words
              .map((w, k) => {
                const pm = k >= 5 ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
                if (!pm) return w;
                const c = Number(pm[1]);
                const r = Number(pm[3]);
                if (c < z.c0 || c > z.c1 || r < z.r0 || r > z.r1) return w;
                if (c + dc < 0 || c + dc >= W || r + dr! < 0 || r + dr! >= H) fail(`${where} : le point ${w} sort du gabarit`);
                touched++;
                return `${c + dc}${pm[2]},${r + dr!}${pm[4]}`;
              })
              .join(" ");
          }
          break;
        }
        case "echange": {
          // Lot 19 : pics ↔ petites scies fixes, à la même place.
          for (let c = z.c0; c <= z.c1; c++) {
            for (let r = z.r0; r <= z.r1; r++) {
              const t = cell(c, r);
              if (m.arg === "scies" && "^v<>".includes(t)) {
                set(c, r, "o");
                touched++;
              } else if (m.arg === "pics" && t === "o") {
                const spike = spikeFor(c, r);
                if (!spike) fail(`${where} : la scie (${c}, ${r}) n'a aucun support pour un pic`);
                set(c, r, spike);
                touched++;
              }
            }
          }
          break;
        }
        case "denivele":
          denivele = { from: z.c0, k: Number(m.arg) };
          // Appliqué après le déroulé des plages (`buildModuleDef`) : seulement vérifié ici (aucune scie dans la zone).
          for (const line of annex) {
            const vm = /^vent (\d+)-(\d+) /.exec(line);
            if (vm && Number(vm[2]) >= z.c0) fail(`${where} : une zone de vent y passe`);
            if (vm) continue;
            // Lot 22 : une presse (colonne du coin haut-gauche en 4e mot, largeur en 3e) ne traverse pas non plus la zone.
            const pm = /^presse \S+ (\d+) (\d+)(?:'?),/.exec(line);
            if (pm) {
              if (Number(pm[2]) + Number(pm[1]) - 1 >= z.c0) fail(`${where} : une presse y passe`);
              continue;
            }
            // Lot 24 : ni une stalactite (colonne en 3e mot).
            const sm = /^stalactite \S+ (\d+)(?:'?),/.exec(line);
            if (sm) {
              if (Number(sm[1]) + 8 >= z.c0) fail(`${where} : une stalactite y passe`);
              continue;
            }
            // Lot 25 : ni un laser fixe (colonne en 4e mot, au plus LASER_MAX_LENGTH colonnes de long) ni une barre coulissante (deux positions, mots 6 et 7).
            const lm = /^laser \S+ [hv] (\d+)(?:'?),/.exec(line);
            if (lm) {
              if (Number(lm[1]) + 13 >= z.c0) fail(`${where} : un laser y passe`);
              continue;
            }
            if (line.startsWith("barre ")) {
              for (const w of line.split(/\s+/).slice(5)) if (Number(/^(\d+)/.exec(w)?.[1] ?? -1) + 8 >= z.c0) fail(`${where} : une barre laser y passe`);
              continue;
            }
            // Lot 26 : ni un pont (l'interrupteur en 4e mot, puis les tuiles : toute colonne citée).
            if (line.startsWith("pont ")) {
              for (const w of line.split(/\s+/).slice(3)) for (const n of w.split(",")[0]!.split("-")) if (Number(/^(\d+)/.exec(n)?.[1] ?? -1) >= z.c0) fail(`${where} : un pont y passe`);
              continue;
            }
            for (const w of line.split(/\s+/).slice(5)) {
              const c = Number(/^(\d+)/.exec(w)?.[1] ?? -1);
              if (c >= z.c0) fail(`${where} : une scie y passe`);
            }
          }
          break;
      }
    }
    if (m.name === "decale" && touched === 0) fail(`decale : aucun danger à déplacer`);
    if (m.name === "echange" && touched === 0) fail(`echange : rien à échanger`);
  }
  return { grid: grid.map((r) => r.join("")), annex, denivele, ecarts };
}

/** Les mutateurs d'une variante, écrits comme dans le fichier (`+plafond:pics +denivele:2`), vide sans mutateur. */
export function mutationLabel(mutations: readonly Mutation[]): string {
  return mutations.map((m) => `+${m.name}${m.arg ? `:${m.arg}` : ""}`).join(" ");
}

/** Une plage d'un axe, déroulée : pour chaque index du gabarit, l'index de sa première et de sa dernière copie (−1 si retirée). */
function unroll(size: number, repeats: readonly ModuleRepeat[], values: Readonly<Record<string, number>>): { src: number[]; first: number[]; last: number[] } {
  const src: number[] = [];
  const first: number[] = new Array(size).fill(-1);
  const last: number[] = new Array(size).fill(-1);
  for (let k = 0; k < size; ) {
    const rep = repeats.find((r) => r.from === k);
    const to = rep ? rep.to : k;
    const copies = rep ? values[rep.param]! : 1;
    for (let c = 0; c < copies; c++) {
      for (let j = k; j <= to; j++) {
        if (c === 0) first[j] = src.length;
        last[j] = src.length;
        src.push(j);
      }
    }
    k = to + 1;
  }
  return { src, first, last };
}

/** Un palier posé : ses colonnes (bornes comprises) et la rangée de son sol. */
export interface Palier {
  col0: number;
  col1: number;
  row: number;
}

/** Un morceau construit : le niveau jouable (palier d'entrée, morceau, palier de sortie, arrivée) et ce qu'il faut pour l'enchaîner. */
export interface BuiltModule {
  id: string;
  variant: number;
  values: Readonly<Record<string, number>>;
  /** Mutateurs de la variante (lot 7), dans l'ordre d'application. */
  mutations: readonly Mutation[];
  /** Identifiant de niveau des rediffusions : `module:<id>:<variante>`. */
  levelId: string;
  level: Level;
  /** Texte complet du niveau (grille et bloc annexe). */
  ascii: string;
  /** Empreinte FNV-1a du texte : une solution stockée l'est pour cette grille. */
  hash: string;
  /** Colonnes avant le morceau (couloir de lancement s'il y en a un, garde, palier d'entrée) : la première colonne du morceau. */
  lead: number;
  /** Largeur du morceau seul (sa grille, sans paliers), hauteur. */
  width: number;
  height: number;
  /** Rangées du sol des paliers d'entrée et de sortie (dans le niveau construit). */
  entryRow: number;
  exitRow: number;
  /** Les paliers posés. Le bord droit du palier d'entrée est la colonne `lead`, celui du palier de sortie la colonne `exitCol`. */
  palierIn: Palier;
  palierOut: Palier;
  /** Première colonne après le palier de sortie : la solution sort quand le centre du personnage y entre (point canonique). */
  exitCol: number;
}

export interface BuildOptions {
  /** Couloir de lancement (jeu humain, entrée en élan) : colonnes ajoutées devant le palier d'entrée, départ au bout. 0 par défaut. */
  lancement?: number;
}

// Lot 21 : `textHash` vit dans `texthash.ts` (le premier chargement du jeu l'utilise sans le catalogue) ; ré-exportée ici, pour tous les importeurs d'avant.
export { textHash };

/** Une colonne de palier standard : du vide au-dessus du sol (jusqu'en haut), le sol à la rangée `floor`, du plein dessous. */
const palierCell = (r: number, floor: number) => (r < floor ? "." : "#");

/** Construit une variante d'un morceau écrit (`parseModule`) : fonction pure, mêmes entrées, même niveau. */
export function buildModuleDef(def: ModuleDef, variant: number, options: BuildOptions = {}): BuiltModule {
  const values = def.variants[variant];
  if (!values) throw new ModuleError(`Morceau « ${def.id} » : pas de variante ${variant} (0 à ${def.variants.length - 1})`);
  const launch = options.lancement ?? 0;
  if (!Number.isInteger(launch) || launch < 0 || launch > 40) throw new ModuleError("lancement : de 0 à 40 colonnes");
  const where = (s: string) => `Morceau « ${def.id} », variante ${variant} : ${s}`;
  const mutations = def.mutations[variant] ?? [];
  let tpl: MutatedTemplate;
  try {
    tpl = mutateTemplate(def, mutations);
  } catch (e) {
    if (e instanceof ModuleError) throw new ModuleError(where(e.message));
    throw e;
  }
  // Lot 19 : un écart élargi (`+ecart`) se déroule comme une plage `repeter` de plus (paramètre interne `~ecart<n>`).
  const colRepeats: ModuleRepeat[] = def.repeats.filter((r) => r.axis === "colonnes");
  const unrollValues: Record<string, number> = { ...values };
  tpl.ecarts.forEach((e, n) => {
    if (colRepeats.some((r) => r.from <= e.to && e.from <= r.to)) throw new ModuleError(where(`ecart ${e.from}-${e.to} : chevauche une plage répétée`));
    colRepeats.push({ param: `~ecart${n}`, axis: "colonnes", from: e.from, to: e.to });
    unrollValues[`~ecart${n}`] = e.copies;
  });
  const cols = unroll(tpl.grid[0]!.length, colRepeats, unrollValues);
  const rows = unroll(tpl.grid.length, def.repeats.filter((r) => r.axis === "rangees"), values);
  const width = cols.src.length;
  if (width < 1) throw new ModuleError(where("grille vide"));
  const entryRow = rows.first[def.entryRow]!;
  let exitRow = rows.first[def.exitRow]!;
  const L = PALIER_LENGTH;
  const lead = launch + PALIER_GUARD + L;
  const exitCol = lead + width + L;
  // Le départ : au début du palier d'entrée, ou au bout du couloir de lancement s'il y en a un.
  const start = launch > 0 ? 0 : PALIER_GUARD;

  // Couloir de lancement, garde et palier d'entrée · grille · palier de sortie · piste · arrivée.
  const cells = rows.src.map((r) => cols.src.map((c) => tpl.grid[r]![c]!));
  // Dénivelé (lot 7) : les colonnes de la zone (toutes leurs copies) descendent de k rangées (la grille s'allonge, recopie de sa dernière
  // rangée), ou montent de −k (le bas se remplit de la dernière tuile de chaque colonne) ; la sortie suit.
  if (tpl.denivele) {
    const { from, k } = tpl.denivele;
    const zone = cols.src.map((c) => c >= from);
    if (k > 0) {
      const last = cells[cells.length - 1]!;
      for (let i = 0; i < k; i++) cells.push([...last]);
    } else if (exitRow + k < PALIER_HEADROOM) throw new ModuleError(where(`dénivelé ${k} : moins de ${PALIER_HEADROOM} rangées au-dessus de la sortie`));
    const H = cells.length;
    for (let c = 0; c < zone.length; c++) {
      if (!zone[c]) continue;
      const col = cells.map((row) => row[c]!);
      for (let r = 0; r < H; r++) cells[r]![c] = k > 0 ? (r >= k ? col[r - k]! : ".") : r - k < H ? col[r - k]! : col[H - 1]!;
    }
    exitRow += k;
  }
  const grid = cells.map((row) => row.join(""));
  const height = grid.length;
  if (height > MODULE_MAX_HEIGHT) throw new ModuleError(where(`${height} rangées (au plus ${MODULE_MAX_HEIGHT})`));
  const lines = grid.map((row, r) => {
    const cells = palierCell(r, entryRow).repeat(lead);
    const left = r === entryRow - 1 ? cells.slice(0, start) + "S" + cells.slice(start + 1) : cells;
    const right = palierCell(r, exitRow).repeat(L + 1) + (r === exitRow - 1 ? "F" : palierCell(r, exitRow));
    return left + row + right;
  });

  // ——— Bloc annexe : la section du morceau, ses scies (paramètres remplacés, coordonnées de la grille traduites) ———
  const annex = [`section ${def.id} ${lead}-${lead + width - 1}`];
  for (const line of tpl.annex) {
    const filled = line.replace(/\{([a-z][a-z0-9]*)\}/g, (_, p: string) => String(values[p]));
    const words = filled.split(/\s+/);
    if (words[0] === "clignote") {
      // Lot 12 : le cycle des blocs clignotants, rattaché à la section du morceau.
      annex.push(`clignote ${def.id} ${words.slice(1).join(" ")}`);
      continue;
    }
    if (words[0] === "vent") {
      // Lot 13 : une zone de vent, de la première copie de c0 (r0) à la dernière de c1 (r1).
      const cm = /^(\d+)-(\d+)$/.exec(words[1] ?? "");
      const rm = /^(\d+)-(\d+)$/.exec(words[2] ?? "");
      if (!cm || !rm) throw new ModuleError(where(`zone de vent mal écrite (« ${filled} »)`));
      const c0 = cols.first[Number(cm[1])];
      const c1 = cols.last[Number(cm[2])];
      const r0 = rows.first[Number(rm[1])];
      const r1 = rows.last[Number(rm[2])];
      if ([c0, c1, r0, r1].some((v) => v === undefined || v < 0)) throw new ModuleError(where(`zone de vent « ${filled} » hors de la grille ou retirée par la variante`));
      // Lot 27 : `rafale 0 …` (un paramètre `cycle=0`) = le vent souffle en continu : la clause de rafale est retirée (les niveaux du jour g21 n'ont plus de rafales).
      const rest = words[5] === "rafale" && words[6] === "0" ? words.slice(3, 5) : words.slice(3);
      annex.push(["vent", `${c0! + lead}-${c1! + lead}`, `${r0}-${r1}`, ...rest].join(" "));
      continue;
    }
    if (words[0] === "plateforme") {
      // Lot 20 : une plateforme mobile, ses deux extrémités traduites comme les points d'une scie (première copie, ou dernière avec une apostrophe).
      annex.push(
        words
          .map((w, k) => {
            const m = k >= 5 ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
            if (!m) return w;
            const col = (m[2] ? cols.last : cols.first)[Number(m[1])];
            const row = (m[4] ? rows.last : rows.first)[Number(m[3])];
            if (col === undefined || row === undefined || col < 0 || row < 0) throw new ModuleError(where(`point ${w} hors de la grille ou retiré par la variante`));
            return `${col + lead},${row}`;
          })
          .join(" "),
      );
      continue;
    }
    if (words[0] === "presse") {
      // Lot 22 : une presse, son coin haut-gauche (4e mot) traduit comme un point de scie (première copie, ou dernière avec une apostrophe).
      annex.push(
        words
          .map((w, k) => {
            const m = k === 3 ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
            if (!m) return w;
            const col = (m[2] ? cols.last : cols.first)[Number(m[1])];
            const row = (m[4] ? rows.last : rows.first)[Number(m[3])];
            if (col === undefined || row === undefined || col < 0 || row < 0) throw new ModuleError(where(`point ${w} hors de la grille ou retiré par la variante`));
            return `${col + lead},${row}`;
          })
          .join(" "),
      );
      continue;
    }
    if (words[0] === "stalactite") {
      // Lot 24 : une stalactite, sa tuile (3e mot) traduite comme un point de scie (première copie, ou dernière avec une apostrophe).
      annex.push(
        words
          .map((w, k) => {
            const m = k === 2 ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
            if (!m) return w;
            const col = (m[2] ? cols.last : cols.first)[Number(m[1])];
            const row = (m[4] ? rows.last : rows.first)[Number(m[3])];
            if (col === undefined || row === undefined || col < 0 || row < 0) throw new ModuleError(where(`point ${w} hors de la grille ou retiré par la variante`));
            return `${col + lead},${row}`;
          })
          .join(" "),
      );
      continue;
    }
    if (words[0] === "pont") {
      // Lot 26 : un pont à interrupteur — l'interrupteur (4e mot) puis les tuiles : `c,r`, `c0-c1,r` ou `c,r0-r1`, chaque nombre traduit comme un point de scie (première copie d'une plage
      // répétée, ou dernière avec une apostrophe).
      const colOf = (n: string, q: string) => (q ? cols.last : cols.first)[Number(n)];
      const rowOf = (n: string, q: string) => (q ? rows.last : rows.first)[Number(n)];
      annex.push(
        words
          .map((w, k) => {
            if (k < 3) return w;
            const m = /^(\d+)('?)(?:-(\d+)('?))?,(\d+)('?)(?:-(\d+)('?))?$/.exec(w);
            if (!m) return w;
            const c0 = colOf(m[1]!, m[2]!);
            const c1 = m[3] !== undefined ? colOf(m[3], m[4]!) : undefined;
            const r0 = rowOf(m[5]!, m[6]!);
            const r1 = m[7] !== undefined ? rowOf(m[7], m[8]!) : undefined;
            if (c0 === undefined || r0 === undefined || c1 === undefined && m[3] !== undefined || r1 === undefined && m[7] !== undefined || c0 < 0 || r0 < 0) throw new ModuleError(where(`point ${w} hors de la grille ou retiré par la variante`));
            return `${c0 + lead}${c1 !== undefined ? `-${c1 + lead}` : ""},${r0}${r1 !== undefined ? `-${r1}` : ""}`;
          })
          .join(" "),
      );
      continue;
    }
    if (words[0] === "laser" || words[0] === "barre") {
      // Lot 25 : un laser fixe (`laser <id> <h|v> <c,r> …` : la première tuile du rayon, 4e mot) ou une barre coulissante (`barre <id> <h|v> <long> <cycle> <c,r> <c,r>` : ses deux
      // positions, mots 6 et 7) : les points traduits comme ceux d'une scie (première copie, ou dernière avec une apostrophe).
      const first = words[0] === "laser" ? 3 : 5;
      const last = words[0] === "laser" ? 3 : 6;
      annex.push(
        words
          .map((w, k) => {
            const m = k >= first && k <= last ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
            if (!m) return w;
            const col = (m[2] ? cols.last : cols.first)[Number(m[1])];
            const row = (m[4] ? rows.last : rows.first)[Number(m[3])];
            if (col === undefined || row === undefined || col < 0 || row < 0) throw new ModuleError(where(`point ${w} hors de la grille ou retiré par la variante`));
            return `${col + lead},${row}`;
          })
          .join(" "),
      );
      continue;
    }
    if (words[0] !== "scie") throw new ModuleError(where(`bloc annexe : seules les scies, « clignote », « vent », « plateforme », « presse », « stalactite », « laser », « barre » et « pont » sont permis (« ${words[0]} »)`));
    annex.push(
      words
        .map((w, k) => {
          const m = k >= 5 ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
          if (!m) return w;
          const c = Number(m[1]);
          const r = Number(m[3]);
          const col = (m[2] ? cols.last : cols.first)[c];
          const row = (m[4] ? rows.last : rows.first)[r];
          if (col === undefined || row === undefined || col < 0 || row < 0) throw new ModuleError(where(`point ${w} hors de la grille ou retiré par la variante`));
          return `${col + lead},${row}`;
        })
        .join(" "),
    );
  }
  // Lot 30 : un morceau joué seul a le maintien minimal du saut (il reste en version 3, une horloge par section : la ligne `maintien` le dit).
  annex.push(`maintien ${JUMP_MIN_HOLD}`);
  const ascii = lines.join("\n") + "\n\n" + annex.join("\n") + "\n";
  let level: Level;
  try {
    level = parseLevel(ascii);
  } catch (e) {
    if (e instanceof LevelError) throw new ModuleError(where(e.message));
    throw e;
  }
  const built: BuiltModule = {
    id: def.id,
    variant,
    values,
    mutations,
    levelId: `module:${def.id}:${variant}`,
    level,
    ascii,
    hash: textHash(ascii),
    lead,
    width,
    height,
    entryRow,
    exitRow,
    palierIn: { col0: lead - L, col1: lead - 1, row: entryRow },
    palierOut: { col0: lead + width, col1: lead + width + L - 1, row: exitRow },
    exitCol,
  };
  const problems = palierProblems(built);
  if (problems.length > 0) throw new ModuleError(where(problems.join(" ; ")));
  return built;
}

/**
 * Ce qui ne va pas dans les paliers d'un morceau construit (vide : conformes) : forme standard (sol plein, plein dessous, vide au-dessus
 * jusqu'en haut), au moins `PALIER_HEADROOM` rangées libres, aucune scie (fixe ou mobile, sur tout son cycle) dans la boîte libre au-dessus
 * du palier, et un passage au bord droit du palier d'entrée (la première colonne du morceau est libre au ras du sol : on y entre en élan).
 */
export function palierProblems(m: BuiltModule): string[] {
  const out: string[] = [];
  const L = m.level;
  const T = UNITS_PER_TILE;
  const at = (c: number, r: number) => L.tiles[r * L.width + c];
  for (const [name, z] of [
    ["entrée", m.palierIn],
    ["sortie", m.palierOut],
  ] as const) {
    if (z.row < PALIER_HEADROOM) out.push(`palier d'${name} : moins de ${PALIER_HEADROOM} rangées au-dessus`);
    for (let c = z.col0; c <= z.col1; c++) {
      for (let r = 0; r < L.height; r++) {
        const want = r < z.row ? TILE_EMPTY : TILE_SOLID;
        if (at(c, r) !== want) out.push(`palier d'${name} : tuile (${c}, ${r}) ${want === TILE_SOLID ? "vide" : "occupée"}`);
      }
    }
    const box = { x: z.col0 * T, y: (z.row - PALIER_HEADROOM) * T, w: (z.col1 - z.col0 + 1) * T, h: PALIER_HEADROOM * T };
    for (const saw of L.saws) {
      const n = saw.cycle === 0 ? 1 : saw.cycle;
      for (let t = 0; t < n; t++) {
        const p = sawCenter(saw, t);
        if (circleHitsBox(p.x, p.y, saw.radius, box)) {
          out.push(`palier d'${name} : la scie ${saw.id} y passe`);
          break;
        }
      }
    }
    // Lot 20 : ni une plateforme mobile (sur tout son cycle) : le palier est un rebord où l'on entre, repart et reprend, jamais un lieu de passage.
    for (const plat of L.platforms) {
      for (let t = 0; t < plat.cycle; t++) {
        const p = platformPos(plat, t);
        if (boxesOverlap(box, { x: p.x, y: p.y, w: plat.width * T, h: T })) {
          out.push(`palier d'${name} : la plateforme ${plat.id} y passe`);
          break;
        }
      }
    }
    // Lot 22 : ni une presse, à aucun pas de son cycle (la boîte de sa course entière : un palier n'est jamais traversé par une presse).
    for (const press of L.presses) {
      for (let t = 0; t < press.cycle; t++) {
        const b = pressBox(press, t);
        if (boxesOverlap(box, b)) {
          out.push(`palier d'${name} : la presse ${press.id} y passe`);
          break;
        }
      }
    }
    // Lot 25 : ni un rayon (laser fixe, allumé ou non ; barre, à aucun pas de son cycle) : un palier n'est jamais dans la course d'un rayon.
    for (const l of L.lasers) {
      if (boxesOverlap(box, laserBox(l))) out.push(`palier d'${name} : le laser ${l.id} y passe`);
    }
    for (const b of L.laserBars) {
      for (let t = 0; t < b.cycle; t++) {
        if (boxesOverlap(box, laserBarBox(b, t))) {
          out.push(`palier d'${name} : la barre ${b.id} y passe`);
          break;
        }
      }
    }
    // Lot 26 : ni un pont (aucune de ses tuiles) ni un interrupteur : un palier est un rebord où l'on entre et repart, on n'y allume ni n'y éteint rien.
    for (const br of L.bridges) {
      for (const c of [{ col: br.switchCol, row: br.switchRow }, ...br.tiles]) {
        if (boxesOverlap(box, { x: c.col * T, y: c.row * T, w: T, h: T })) {
          out.push(`palier d'${name} : le pont ${br.id} y passe`);
          break;
        }
      }
    }
  }
  if (isSolidTile(at(m.lead, m.entryRow - 1)!)) out.push("première colonne du morceau pleine au ras du sol : on n'y entre pas en courant");
  return out;
}

// ——— Le catalogue ———

/** Les morceaux du catalogue, dans l'ordre des fichiers (`catalog.ts`, généré par `solve:modules`). */
export const MODULES: readonly ModuleDef[] = /* @__PURE__ */ MODULE_TEXTS.map(parseModule);

export function moduleDef(id: string): ModuleDef {
  const def = MODULES.find((m) => m.id === id);
  if (!def) throw new ModuleError(`Morceau « ${id} » inconnu`);
  return def;
}

/** **La** fonction qui construit un morceau du catalogue (solveur, tests, galerie, assemblage). Pure et déterministe. */
const built = new Map<string, BuiltModule>();

/** Lot 19 : sans couloir de lancement, une variante construite est gardée (fonction pure : le générateur en construit des milliers par jour). */
export function buildModule(id: string, variant: number, options: BuildOptions = {}): BuiltModule {
  if (options.lancement) return buildModuleDef(moduleDef(id), variant, options);
  const key = `${id}:${variant}`;
  let m = built.get(key);
  if (!m) built.set(key, (m = buildModuleDef(moduleDef(id), variant)));
  return m;
}

// ——— Solutions et exigence ———

/** Une solution stockée (une variante, un état d'entrée) : une rediffusion du lot 3 et sa marge. */
export interface ModuleSolution {
  /**
   * Rediffusion (base64url) du morceau joué seul, du départ à l'arrivée `F` ; départ lancé pour l'entrée élan. Elle contient l'entrée et la
   * sortie canoniques (`entryTick`, `exitTick`) ; après la sortie, droite tenue jusqu'à l'arrivée.
   */
  code: string;
  /** Durée (pas) de toute la rediffusion (jusqu'à l'arrivée du morceau seul). */
  ticks: number;
  /**
   * Pas joués quand le centre du personnage passe le bord droit du palier d'entrée (0 à l'arrêt : la solution part de là où elle est ;
   * en élan, ce que coûte la course jusqu'au bord, droite tenue) et quand il passe le bord droit du palier de sortie (la sortie). Dans le
   * niveau du jour, un morceau compte `exitTick − entryTick` pas.
   */
  entryTick: number;
  exitTick: number;
  /**
   * Durée entre l'entrée et la sortie de la plus rapide trouvée avant durcissement (égale ou à peine plus courte). Après un repli robuste
   * (lot 8c), la plus rapide **jouable par un humain** : c'est la référence de la règle des 2 %.
   */
  fastest: number;
  /**
   * Lot 8c, seulement après un repli robuste : la plus rapide trouvée, qui n'était pas jouable par un humain (gigue ±3 sous `HUMAIN_MIN`).
   * La solution gardée en est au plus à 25 % au-dessus.
   */
  rapide?: number;
  /** Taux de réussite (‰) quand chaque changement de commande est décalé au hasard de ±1, ±2, ±3 pas (`GIGUE_DRAWS` tirages chacun). */
  gigue: readonly [number, number, number];
  /**
   * Taux de réussite (‰) rejouée en élan depuis chacune des positions d'entrée possibles (`RACCORD_POSITIONS` : le centre franchit le bord
   * n'importe où dans un pas de course) jusqu'à une sortie propre ; null à l'arrêt.
   */
  raccord: number | null;
  /** Note d'exigence (1 facile … 5 exigeant), 0 = refusée (pas jouable par un humain, ou raccord < 90 %). */
  exigence: number;
  /** Lot 11 : le plus court appui de saut de la solution, en pas (0 : aucun saut) ; jamais sous `PRESS_MIN`. */
  press: number;
}

export interface ModuleVariantSolutions {
  /** Empreinte de la grille construite (`BuiltModule.hash`). */
  grid: string;
  arret: ModuleSolution | null;
  elan: ModuleSolution | null;
}

export interface ModuleSolutionsFile {
  jumpSimVersion: number;
  /** Version de la règle de mesure (`EXIGENCE_VERSION`). */
  exigenceVersion: number;
  modules: Readonly<Record<string, { variants: readonly ModuleVariantSolutions[] }>>;
}

/**
 * Version de la mesure d'exigence : la changer (tirages, décalages, seuils) oblige à relancer `solve:modules`. 2 : raccord strict (lot 6) ;
 * 3 : jouable par un humain (lot 8c), la note se lit sur la gigue ±3 ; 4 : appui d'au moins 5 pas (lot 11) ; 5 : appui d'au moins 10 pas et durée d'appui variée de ±4 pas (lot 30).
 */
export const EXIGENCE_VERSION = 5;

// ——— Jouable au clavier (lot 11, retouche) ———
// La gigue (ci-dessus) décale des changements de commande mais ne dit pas **combien de temps un doigt peut tenir ou lâcher une touche** : une
// solution qui exige un appui de 1 pas (8 ms) pour un « petit saut » n'est jouable ni au clavier ni à la manette (une pression dure en
// pratique 60 à 100 ms). Mesuré sur le catalogue du lot 11 : 81 solutions sur 580 avaient un appui d'un seul pas, 118 un relâchement d'un seul
// pas entre deux appuis. Un petit saut est pourtant ce que les scies basses réclament : la hauteur d'un saut dépend de la durée de l'appui
// (0,98 tuile à 1 pas, 1,36 à 3 pas, 1,71 à 5 pas, 2,22 à 8 pas, 2,82 à 12 pas).
/**
 * Plus courte durée d'un appui de saut (pas) qu'une solution peut exiger. **Lot 30 : 10 pas (83 ms), le maintien minimal du saut** (`JUMP_MIN_HOLD`) : un tap volontaire dure 60 à 120 ms, et
 * tout appui de 1 à 10 pas donne le même petit saut (le plus petit qu'on puisse exiger). Avant le lot (sans maintien minimal, catalogue d'avant) : `PRESS_MIN_LEGACY` = 5 pas = 42 ms, qui donnait
 * un saut de 1,71 tuile et qu'un doigt ne dose pas.
 */
export const PRESS_MIN = JUMP_MIN_HOLD;
/** La règle des appuis jusqu'à la version 12 (catalogue d'avant le lot 30) : 5 pas = 42 ms. */
export const PRESS_MIN_LEGACY = 5;
/** Plus court relâchement (pas) entre deux appuis de saut : 3 pas = 25 ms (un appui-relâchement complet d'au moins 8 pas, ≈ 15 par seconde). */
export const RELEASE_MIN = 3;

/**
 * Ce qui ne va pas dans la façon de tenir le bouton de saut d'une suite de commandes (null : jouable par un doigt) : un appui de moins de
 * `PRESS_MIN` pas, ou un relâchement de moins de `RELEASE_MIN` pas entre deux appuis. L'appui qui dure jusqu'à la fin des commandes n'est
 * pas jugé (il se prolonge dans le jeu).
 */
export function pressProblems(inputs: readonly number[]): string | null {
  let on = 0;
  let off = -1;
  for (let t = 0; t < inputs.length; t++) {
    if ((inputs[t]! & INPUT_JUMP) !== 0) {
      if (on === 0 && off >= 0 && off < RELEASE_MIN) return `pas ${t + 1} : relâchement de ${off} pas entre deux appuis (au moins ${RELEASE_MIN})`;
      on++;
      off = -1;
    } else {
      if (on > 0 && on < PRESS_MIN) return `pas ${t + 1} : appui de saut de ${on} pas (au moins ${PRESS_MIN})`;
      if (on > 0) off = 0;
      on = 0;
      if (off >= 0) off++;
    }
  }
  return null;
}

/** Plus courte durée d'un appui de saut (pas) d'une suite de commandes, 0 s'il n'y a aucun appui. */
export function shortestPress(inputs: readonly number[]): number {
  let on = 0;
  let min = 0;
  for (const bits of inputs) {
    if ((bits & INPUT_JUMP) !== 0) on++;
    else {
      if (on > 0 && (min === 0 || on < min)) min = on;
      on = 0;
    }
  }
  if (on > 0 && (min === 0 || on < min)) min = on;
  return min;
}
/** Tirages par amplitude de gigue (±1, ±2, ±3 pas). */
export const GIGUE_DRAWS = 200;
/**
 * Lot 30 : la **tolérance sur la durée d'un appui de saut**, ±4 pas (33 ms), qui s'ajoute à la gigue ±3 sur les instants (`jittered`, `tools/exigence.ts`) avec le même seuil de réussite que
 * le lot 8c (`HUMAIN_MIN`) : au-dessus du maintien minimal, le doigt ne tient pas un bouton au pas près. Un saut dont la hauteur exige une durée d'appui exacte fait chuter le taux sous le seuil.
 */
export const HOLD_VARIATION = 4;
/**
 * Positions d'entrée du test de raccord (lot 6) : de combien d'unités le centre du personnage a dépassé le bord droit du palier d'entrée
 * au pas où il le franchit. À pleine vitesse un pas fait `runSpeed` = 375 unités : l'entrée réelle tombe n'importe où dans [0, 375) ; on
 * en essaie 25, régulièrement espacées.
 */
export const RACCORD_POSITIONS: readonly number[] = Array.from({ length: 25 }, (_, k) => 7 + 15 * k);
/**
 * **Jouable par un humain** (lot 8c) : la solution doit réussir au moins une fois sur deux quand chaque changement de commande est décalé au
 * hasard de ±3 pas (25 ms). Avant le lot 8c le seuil portait sur ±1 pas (8 ms, `PAS_PRES`) : il laissait passer des passages que seul un
 * joueur parfait réussit (`plafond-pics` v2 : 35 % à ±3). Mesuré sur le catalogue du lot 7b : 182 variantes sur 233 tiennent ce seuil.
 */
export const HUMAIN_MIN = 500;
/** Seuils de la note sur la gigue ±3 (‰) : 1 au-dessus du premier, … 5 entre le dernier et `HUMAIN_MIN`. */
export const NOTE_SEUILS: readonly [number, number, number, number] = [950, 850, 720, 600];
/** Raccord strict (lot 6) : la solution en élan doit réussir depuis au moins 90 % des positions d'entrée, sinon la variante est refusée. */
export const RACCORD_MIN = 900;
/**
 * Selon la position d'entrée, la sortie peut venir un peu plus tard que dans la solution stockée : le test de raccord et l'assemblage du
 * niveau du jour continuent alors droite tenue, au plus ce nombre de pas après la fin de ses commandes.
 */
export const RACCORD_TAIL = 64;

/**
 * Note d'exigence d'une solution (taux en ‰). Règle (README des lots 4 et 6) :
 *   0 (refusée) si la gigue ±3 réussit moins d'une fois sur deux (pas jouable par un humain, `HUMAIN_MIN`), ou si le raccord réussit moins
 *   de 9 fois sur 10 ;
 *   sinon, selon la gigue ±3 (`NOTE_SEUILS`) : 1 si ≥ 95 % ; 2 si ≥ 85 % ; 3 si ≥ 72 % ; 4 si ≥ 60 % ; 5 sinon (≥ 50 %).
 * Lot 8c : jusque-là, 0 si ±1 < 50 % et la note mêlait ±1, ±2 et ±3 (1 si ±3 ≥ 90 % ; 2 si ±3 ≥ 60 % ; 3 si ±2 ≥ 60 % ; 4 si ±1 ≥ 80 % ;
 * 5 sinon). Les seuils de la note sont choisis pour garder une répartition proche de l'ancienne (README du lot 8c).
 */
export function exigenceOf(gigue: readonly [number, number, number], raccord: number | null): number {
  const g3 = gigue[2];
  if (g3 < HUMAIN_MIN || (raccord !== null && raccord < RACCORD_MIN)) return 0;
  const [n1, n2, n3, n4] = NOTE_SEUILS;
  return g3 >= n1 ? 1 : g3 >= n2 ? 2 : g3 >= n3 ? 3 : g3 >= n4 ? 4 : 5;
}

// ——— Le point canonique (lot 6) ———

/** Colonne du centre du personnage. */
export function centerCol(p: Readonly<PlayerState>): number {
  return tileOf(p.x + idiv(PLAYER_WIDTH, 2));
}

/**
 * La course « propre » du point canonique : au sol, à `runSpeed` vers la droite, rien d'autre en cours (bouton de saut relâché, aucun saut en
 * attente dans le tampon, ni montée, ni glisse, ni mur, ni verrou). C'est l'état de quiconque court depuis un moment sur du plat, droite tenue :
 * deux personnages dans cet état ne diffèrent que par leur position, d'où des raccords exacts.
 */
export function isCleanRun(p: Readonly<PlayerState>): boolean {
  return (
    p.ground === 1 &&
    p.vx === DEFAULT_JUMP_PARAMS.runSpeed &&
    p.vy === 0 &&
    p.air === 0 &&
    p.wallSide === 0 &&
    p.wallAir === COUNTER_CAP &&
    p.slide === 0 &&
    p.buffer === 0 &&
    p.held === 0 &&
    p.jumping === 0 &&
    p.lock === 0 &&
    p.lockDir === 0
  );
}

/** L'état de départ d'un morceau seul : au départ `S` (début du palier d'entrée), à l'arrêt ou lancé (entrée élan). */
export function moduleStart(m: BuiltModule, entry: ModuleEntry): AttemptState {
  return replayStartState(m.level, { ...START_AT_SPAWN, elan: entry === "elan" ? 1 : 0 });
}

/** Ce que donne la rediffusion d'une solution de morceau rejouée sur le morceau seul (`moduleSpan`). */
export interface ModuleSpan {
  entryTick: number;
  exitTick: number;
  /** Pas joués à l'arrivée (= toute la rediffusion). */
  finishTick: number;
}

/**
 * Rejoue une solution sur le morceau seul et vérifie la **règle du point canonique** : en élan, droite tenue jusqu'à ce que le centre passe
 * le bord du palier d'entrée, en course propre ; puis la **sortie** au premier pas où le centre passe le bord du palier de sortie, vivant,
 * en course propre ; puis droite tenue jusqu'à l'arrivée, atteinte au dernier pas, sans mort. Rend les trois pas, ou ce qui ne va pas.
 * `start` : un autre départ (le test de raccord décale la position d'entrée).
 */
export function moduleSpan(m: BuiltModule, entry: ModuleEntry, inputs: readonly number[], start?: AttemptState): ModuleSpan | string {
  const level = m.level;
  let s = start ?? moduleStart(m, entry);
  let entryTick = entry === "arret" ? 0 : -1;
  let exitTick = -1;
  const hold = pressProblems(inputs);
  if (hold) return `bouton de saut injouable : ${hold}`;
  for (let t = 0; t < inputs.length; t++) {
    const bits = inputs[t]!;
    if ((entryTick < 0 || exitTick >= 0) && bits !== INPUT_RIGHT) return `pas ${t + 1} : droite seule attendue ${entryTick < 0 ? "avant l'entrée" : "après la sortie"}`;
    s = stepAttempt(s, bits, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) return `mort au pas ${t + 1}`;
    if (s.status === ATTEMPT_FINISHED) {
      if (exitTick < 0) return "arrivée avant la sortie";
      if (t + 1 !== inputs.length) return "des pas après l'arrivée";
      return { entryTick, exitTick, finishTick: t + 1 };
    }
    const col = centerCol(s.player);
    if (entryTick < 0 && col >= m.lead) {
      if (!isCleanRun(s.player)) return "entrée hors de la course propre";
      entryTick = t + 1;
    }
    if (col < m.palierIn.col0) return `pas ${t + 1} : le centre repasse à gauche du palier d'entrée`;
    if (exitTick < 0 && entryTick >= 0 && col >= m.exitCol) {
      if (!isCleanRun(s.player)) return `sortie au pas ${t + 1} hors de la course propre`;
      exitTick = t + 1;
    }
  }
  return "la rediffusion n'arrive pas";
}

/**
 * Lot 15 : ce que le jeu **embarque** d'une solution (`src/catalog.ts`, `CatalogFile`) : la rediffusion et ses pas, et la note. Le reste (gigue,
 * raccord, plus rapide, appui le plus court) ne sert qu'aux outils et aux tests, qui lisent `modules/solutions.json` (`catalogOf`, `tools/files.ts`).
 */
export type CatalogSolution = Pick<ModuleSolution, "code" | "ticks" | "entryTick" | "exitTick" | "exigence">;

export interface CatalogVariant {
  arret: CatalogSolution | null;
  elan: CatalogSolution | null;
}

export interface CatalogFile {
  jumpSimVersion: number;
  exigenceVersion: number;
  modules: Readonly<Record<string, { variants: readonly CatalogVariant[] }>>;
}

/**
 * Lot 19 : le catalogue **tel qu'il est embarqué** (`src/catalog.ts`, `MODULE_PACKED`) : pour chaque variante, ses deux solutions en
 * `[séries, entryTick, exitTick, note]` (0 : pas de solution). L'en-tête de la rediffusion (format, version, `module:<id>:<n>`, départ à
 * l'arrêt ou lancé) et le nombre de pas (la somme des séries) se déduisent : `unpackCatalog` rend exactement `CatalogFile` (test : la
 * projection de `modules/solutions.json`). Les séries sont `varint(count × 8 + bits)` en base64url, comme dans la rediffusion.
 */
export type PackedSolution = readonly [runs: string, entryTick: number, exitTick: number, exigence: number] | 0;
export interface PackedCatalog {
  v: number;
  x: number;
  m: Readonly<Record<string, readonly (readonly [PackedSolution, PackedSolution])[]>>;
}

/** Les séries d'une rediffusion (commandes pas à pas), en base64url : ce que `packCatalog` garde d'une solution. */
export function packRuns(inputs: readonly number[]): string {
  const bytes: number[] = [];
  for (const r of toRuns(inputs)) pushVarint(bytes, r.count * 8 + r.bits);
  return toBase64Url(bytes);
}

/** `PackedCatalog` → `CatalogFile` (lot 19). */
export function unpackCatalog(p: PackedCatalog): CatalogFile {
  const modules: Record<string, { variants: CatalogVariant[] }> = {};
  for (const [id, list] of Object.entries(p.m)) {
    modules[id] = {
      variants: list.map((pair, variant) => {
        const one = (s: PackedSolution, elan: number): CatalogSolution | null => {
          if (s === 0) return null;
          const bytes = fromBase64Url(s[0]);
          const runs: { count: number; bits: number }[] = [];
          for (let i = 0; i < bytes.length; ) {
            let v = 0;
            let mul = 1;
            for (;;) {
              const b = bytes[i++]!;
              v += (b & 127) * mul;
              if (b < 128) break;
              mul *= 128;
            }
            runs.push({ count: idiv(v, 8), bits: v % 8 });
          }
          const ticks = runs.reduce((n, r) => n + r.count, 0);
          const code = encodeReplay({ simVersion: p.v, levelId: `module:${id}:${variant}`, start: { checkpoint: -1, held: 0, time: 0, sections: [], elan }, runs });
          return { code, ticks, entryTick: s[1], exitTick: s[2], exigence: s[3] };
        };
        return { arret: one(pair[0], 0), elan: one(pair[1], 1) };
      }),
    };
  }
  return { jumpSimVersion: p.v, exigenceVersion: p.x, modules };
}

/** Les solutions embarquées, dépliées une fois au chargement (lot 19 : `MODULE_PACKED`). */
export const MODULE_SOLUTIONS: CatalogFile = /* @__PURE__ */ unpackCatalog(MODULE_PACKED);

/**
 * Lot 15 : la version de la simulation des **morceaux joués seuls** (`buildModule`) : 3, une horloge par section qui démarre à l'entrée du
 * personnage. Le solveur et les solutions stockées s'y rapportent ; le niveau du jour (v4) recale ses horloges sur elles (`daily.ts`).
 */
export const MODULE_SIM_VERSION = SECTION_CLOCK_VERSION;

/** Les solutions stockées d'un morceau (variante) : null si le catalogue n'en a pas (ou plus : grille ou version changée). */
export function moduleSolutions(id: string, variant: number, legacy = false): CatalogVariant | null {
  const file = legacy ? legacyCatalog().solutions : MODULE_SOLUTIONS;
  if (file.jumpSimVersion !== MODULE_SIM_VERSION) return null;
  return file.modules[id]?.variants[variant] ?? null;
}

/**
 * Lot 30 : le morceau joué seul **tel que le jouaient les solutions de l'ancien catalogue** (`legacy` : sans maintien minimal du saut, versions 3 à 12 du niveau du jour) ou tel
 * qu'il se joue aujourd'hui (avec). Un niveau d'une version d'avant la 13 (`Level.minHold` à 0) prend les solutions d'avant (`moduleSolutions(…, true)`), un niveau de la 13 les nouvelles.
 */
export function soloLevel(m: Pick<BuiltModule, "level">, legacy: boolean): Level {
  return legacy && m.level.minHold !== 0 ? { ...m.level, minHold: 0, microMax: 0 } : m.level;
}

/** Lot 7b : une respiration n'est jamais exigeante — toute variante d'un morceau étiqueté `respiration` a une exigence de 2 au plus. */
export const MAX_REST_EXIGENCE = 2;

/** Nombre d'appuis de saut (fronts montants du bouton) d'une rediffusion de solution. */
export function pressCount(code: string): number {
  const bits = fromRuns(decodeReplay(code).runs);
  return bits.filter((b, t) => (b & INPUT_JUMP) !== 0 && (t === 0 || (bits[t - 1]! & INPUT_JUMP) === 0)).length;
}

/**
 * Lot 30 : les règles du catalogue qui se lisent sur les solutions — la durée d'un morceau (lot 7) et celles des **respirations** (lot 7b : exigence de 2 au plus aux deux entrées ; lot 7 : jamais une course à plat, au moins trois sauts à faire —
 * pour les sols dynamiques de la nuit et du néon, d'une variante mutée ou d'une plateforme, comptés sur les appuis de la solution ; pour les autres, sur les plats, que lit `tools/plats.ts`). Avec le
 * maintien minimal le petit saut est plus haut : des solutions nécessitent moins de sauts ou plus d'exigence. Une variante qui ne tient plus la règle est **écartée** du catalogue de la version 13
 * (elle garde son texte et sa place), jamais la règle relâchée.
 */
export function restUsable(def: Pick<ModuleDef, "tags" | "theme" | "mutations" | "long">, variant: number, sol: CatalogVariant): boolean {
  // Lot 7 : la durée entre l'entrée et la sortie, 1 à 6 s (5 à 8 s pour un enchaînement long), à chaque entrée — plus lente avec un petit saut plus haut, une solution peut sortir de la plage.
  const [lo, hi] = def.long ? [LONG_MIN_TICKS, LONG_MAX_TICKS] : [MODULE_MIN_TICKS, MODULE_MAX_TICKS];
  for (const e of [sol.arret!, sol.elan!]) {
    const ticks = e.exitTick - e.entryTick;
    if (ticks < lo || ticks > hi) return false;
  }
  if (!def.tags.includes("respiration")) return true;
  if (variantExigence(sol) > MAX_REST_EXIGENCE) return false;
  // Au moins trois sauts à faire : sur les appuis de la solution pour les sols dynamiques (nuit, néon, plateforme, variante mutée) et les morceaux à stalactites ou à ponts (leurs tests le comptaient déjà) ; pour les autres,
  // sur les plats (`tools/plats.ts`, la grille seule).
  const dynamic = def.theme === "nuit" || def.theme === "neon" || def.tags.includes("plateforme") || def.tags.includes("stalactite") || def.tags.includes("pont") || (def.mutations[variant] ?? []).some((m) => m.name === "clignotant" || m.name === "alterne");
  if (!dynamic) return true;
  return pressCount(sol.arret!.code) >= 3 && pressCount(sol.elan!.code) >= 3;
}

/** Exigence d'une variante : la plus haute de ses deux solutions (0 s'il en manque une). */
export function variantExigence(s: CatalogVariant | null): number {
  if (!s || !s.arret || !s.elan) return 0;
  return s.arret.exigence === 0 || s.elan.exigence === 0 ? 0 : Math.max(s.arret.exigence, s.elan.exigence);
}
