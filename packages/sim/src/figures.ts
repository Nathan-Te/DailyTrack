import { exitDelta, parseToken, type BlockSurface, type WidthLetter } from "./track";

// Bibliothèque de figures (lot 20). Une figure est une courte suite de blocs avec une intention, un nom et une catégorie ;
// le générateur (generator.ts) assemble 5 à 7 figures par circuit, jamais deux fois la même. Chaque figure a des variantes :
// miroir (gauche / droite, tiré à la pose), largeur de la route (la figure s'y adapte), revêtement, niveau, longueur.
//
// Règles d'écriture d'une figure (elle se valide par le pilote — `figures.test.ts` — et par `npm run measure:generator`) :
// - elle commence par une ligne droite (de quoi se placer) et garde derrière elle assez de lignes droites pour freiner avant la
//   suivante : 2 derrière une plaque (`PAD_RUNOUT`), 5 derrière un super turbo (`TURBO_RUNOUT`), 3 derrière un saut court, 5 derrière
//   un saut long ou une cuve ;
// - un virage serré (1 cellule) ne se pose que sur une route étroite ou normale (la figure se rétrécit d'elle-même si besoin),
//   et jamais deux de suite ;
// - `build` renvoie `null` quand la variante demandée est impossible (largeur incompatible…) : le générateur en essaie une autre.

export type FigureCategory = "technique" | "saut" | "rapide" | "combo" | "cuve" | "relief";
export const FIGURE_CATEGORIES: readonly FigureCategory[] = ["technique", "saut", "rapide", "combo", "cuve", "relief"];

export interface FigureContext {
  /** Sens des virages de la figure : `L` est le premier virage, `R` l'autre (échangés par le miroir). */
  L: "L" | "R";
  R: "L" | "R";
  /** Mur latéral du même côté que `L` (« ML » si `L` est à gauche). */
  wall: "ML" | "MR";
  /** Largeur de la route à l'entrée de la figure. */
  width: WidthLetter;
  /** Numéro de variante, de 0 à `variants - 1`. */
  variant: number;
}

export interface Figure {
  /** Nom court, sans espace : celui de `?scenario=figure&f=…`. */
  name: string;
  label: string;
  category: FigureCategory;
  /** Une phrase : ce que la figure demande au joueur. */
  intent: string;
  variants: number;
  /** Contient un vrai saut (vide), une cuve, un moteur coupé : plafonds de composition. */
  jump?: boolean;
  cuve?: boolean;
  cut?: boolean;
  /** Contient un super turbo / un virage relevé : le thème règle leur fréquence (`turboChance`, `bankChance`). */
  turbo?: boolean;
  banked?: boolean;
  /** Fait du dénivelé : le circuit en exige au moins une (et son premier relief fait au moins `MIN_RELIEF`), voir generator.ts. */
  relief?: boolean;
  /** Finit par un freinage franc : le virage suit un élan de plus de 60 m/s (plaque, super turbo, descente). Le circuit en exige deux (generator.ts). */
  braking?: boolean;
  /** Secondes hors plein gaz par passage, mesurées dans les circuits du jour (`npm run measure:generator`, § rythme par figure) : sert à préférer, à durée égale, les circuits où l'on lâche le gaz. */
  off: number;
  /** Poids de tirage (10 par défaut) : une figure qu'on veut moins souvent, ou qui ne sert que de complément. */
  weight?: number;
  /** Figure propre à des thèmes (lot 22) : elle ne sort que chez eux. */
  only?: readonly string[];
  build(c: FigureContext): string[] | null;
}

// --- Outils de notation -----------------------------------------------------------------------

/** Ajoute un modificateur (`g`, `t`, `h`, `b`) à un bloc de la notation, avant son repère éventuel. */
export function withMod(token: string, mod: string): string {
  if (!mod) return token;
  const [body, mark] = token.split("@");
  const next = body!.includes("/") ? body + mod : `${body}/${mod}`;
  return mark === undefined ? next : `${next}@${mark}`;
}

/** Bloc de transition de largeur (une ligne droite de 32 m dont les rebords s'écartent ou se resserrent en douceur). */
export const transition = (from: WidthLetter, to: WidthLetter) => `S/${from}>${to}`;

const WIDTH_ORDER: readonly WidthLetter[] = ["e", "n", "l"];

/** Blocs de transition pour passer d'une largeur à une autre, un cran à la fois (aucun si elles sont égales). */
export function reach(from: WidthLetter, to: WidthLetter): string[] {
  const out: string[] = [];
  let i = WIDTH_ORDER.indexOf(from);
  const j = WIDTH_ORDER.indexOf(to);
  while (i !== j) {
    const next = i < j ? i + 1 : i - 1;
    out.push(transition(WIDTH_ORDER[i]!, WIDTH_ORDER[next]!));
    i = next;
  }
  return out;
}

/** Largeur de la route à la fin d'une suite de blocs (les seuls blocs qui écrivent une largeur sont les transitions). */
export function widthAfter(tokens: readonly string[], width: WidthLetter): WidthLetter {
  let w = width;
  for (const t of tokens) {
    const m = /\/[^@]*?[enl]>([enl])/.exec(t);
    if (m) w = m[1] as WidthLetter;
  }
  return w;
}

const SURFACE_MOD: Record<BlockSurface, string> = { road: "", dirt: "t", ice: "g", grass: "h", sand: "s" };
export const surfaceMod = (s: BlockSurface) => SURFACE_MOD[s];
const on = (tokens: string[], mod: string) => tokens.map((t) => withMod(t, mod));
const rep = (token: string, n: number) => Array<string>(n).fill(token);

/** Lignes droites obligatoires après une plaque (poussée 30 m/s² pendant 0,9 s contre un frein de 40) : voir lot 7b. */
export const PAD_RUNOUT = 2;
/** Idem derrière un super turbo (poussée 42 m/s² pendant 1,5 s, jusqu'à 68 m/s). */
export const TURBO_RUNOUT = 5;
/** Lignes droites derrière un dos d'âne (la caisse décolle, le frein ne sert plus). */
export const CREST_RUNOUT = 3;
/** Lignes droites derrière une cuve : on en sort à plus de 55 m/s (retouche 18b). */
export const CUVE_RUNOUT = 4;
const JUMP_LANDING = 3;
const JUMP_LANDING_LONG = 5;

/**
 * Virage large derrière un saut ou une cuve (lot 20) : on les quitte à plus de 55 m/s, et sans virage ces figures se prendraient à plein
 * gaz du début à la fin. Il force un vrai freinage (mesuré : 1 à 2 s hors plein gaz au lieu de 0,2 s).
 */
const turned = (c: FigureContext): string[] => [`${c.L}2`, "S"];

const crest = (up: string, down: string) => [up, down, ...rep("S", CREST_RUNOUT)];

/**
 * Reliefs (lot 17), du plus doux au plus raide. `U` / `D` : un niveau (4 m) sur une cellule ; `U2` / `D2` et `U3` / `D3` : deux et trois
 * niveaux (pente 0,25 et 0,375). Un dos d'âne (`U2 D2`) fait décoller à haute vitesse : trois lignes droites derrière lui pour atterrir.
 */
export const HILLS_GENTLE: readonly (readonly string[])[] = [
  ["U", "U", "S", "D", "D"], // montée de deux niveaux, crête, descente
  ["U", "S", "D"],
  ["D", "S", "U"], // creux
  ["D", "D", "S", "U", "U"],
  ["U", "U", "U", "S", "D", "D", "D"], // trois niveaux, long
];
export const HILLS_STEEP: readonly (readonly string[])[] = [
  ["U2", "S", "D2"],
  ["U3", "S", "D3"],
  ["U2", "S", "D", "D", "D"], // montée raide, longue descente (rend un niveau de moins)
  ["U", "U", "S", "D2", "D"],
  ["D2", "S", "U2"],
  crest("U2", "D2"),
  crest("U3", "D3"),
  ["U3", "S", "D2", "D"],
  ["U2", "S", "S", "S", "D2"], // plateau surélevé : de la place pour une section sans rebords
  ["U3", "S", "S", "S", "D3"],
];

/** Hauteurs extrêmes atteintes par une suite de blocs partie de 0 (m), et son dénivelé net. */
export function extent(seg: readonly string[]): { hi: number; lo: number; net: number } {
  let y = 0;
  let hi = 0;
  let lo = 0;
  for (const t of seg) {
    const p = parseToken(t);
    y += exitDelta(p.kind, p.rise);
    if (y > hi) hi = y;
    if (y < lo) lo = y;
  }
  return { hi, lo, net: y };
}
/** Dénivelé d'un relief (m) : sa hauteur la plus haute moins la plus basse. */
export const hillRise = (seg: readonly string[]): number => {
  const e = extent(seg);
  return e.hi - e.lo;
};

// --- Sauts (lot 17) ---------------------------------------------------------------------------

/**
 * Sauts : rampe `K`, vide `G` (32 m par cellule), réception. La voiture doit atteindre une vitesse minimale au bord de la rampe (voir
 * `jumpMinSpeed`, jump.ts), faute de quoi elle tombe ; les sauts longs partent d'une plaque (66 m/s) ou d'un super turbo (88 m/s).
 * - court : de la rampe au vide, atterrissage un niveau plus bas (fenêtre ≥ 33 m/s) ;
 * - plat : vide au niveau de la rampe, réception en descente, après une plaque (≥ 40 m/s) ;
 * - long : deux cellules de vide après un super turbo (≥ 58 m/s) ;
 * - long bas : deux cellules, atterrissage plus bas, après une plaque (≥ 52 m/s) ;
 * - haut : le bord d'en face est un niveau plus haut, après un super turbo (≥ 54 m/s).
 */
export type JumpKind = "short" | "flat" | "long" | "longDown" | "up";
export const JUMP_KINDS: readonly JumpKind[] = ["short", "flat", "long", "longDown", "up"];

/** Rampe, vide et réception d'un saut, sans la ligne droite d'élan ni le dégagement : `[élan, rampe + vide + réception]`. */
function jumpParts(kind: JumpKind, mod = ""): { run: string[]; air: string[] } {
  const s = (t: string) => withMod(t, mod);
  switch (kind) {
    case "short":
      return { run: ["S", "S", "S"].map(s), air: [s("K"), "GD"] };
    case "flat":
      return { run: [s("S"), "P", s("S")], air: [s("K"), "G", s("D")] };
    case "long":
      return { run: ["S", "T", "S", "S"], air: ["K", "G", "G", s("D")] };
    case "longDown":
      return { run: ["S", "P", "S"], air: ["K", "G", "GD", s("D")] };
    case "up":
      return { run: ["S", "T", "S", "S"], air: ["K", "GU"] };
  }
}
const landing = (kind: JumpKind) => (kind === "short" || kind === "flat" ? JUMP_LANDING : kind === "longDown" ? JUMP_LANDING_LONG - 1 : JUMP_LANDING_LONG);

/** Un saut complet avec son dégagement derrière (voir les fenêtres de vitesse ci-dessus). */
export function jumpCalm(kind: JumpKind, mod = ""): string[] {
  const { run, air } = jumpParts(kind, mod);
  return [...run, ...air, ...rep(withMod("S", mod), landing(kind))];
}

// --- Cuves (lot 18) ---------------------------------------------------------------------------

export function cuveCalm(kind: "bowl" | "wall", left: boolean, run = 6): string[] {
  const block = kind === "bowl" ? "V" : left ? "ML" : "MR";
  return ["S", ...rep(block, run), ...rep("S", CUVE_RUNOUT)];
}

// --- Portions rapides (lot 15) ----------------------------------------------------------------

export type Fast = "chain" | "drop" | "bank";
export function fastCalm(kind: Fast): string[] {
  switch (kind) {
    case "chain":
      return ["S", "T", "S", "S", "T", ...rep("S", TURBO_RUNOUT)];
    case "drop":
      return ["S", "P", "D", "D", "D", "D", "D", "D", ...rep("S", PAD_RUNOUT)];
    case "bank":
      return ["S", "T", ...rep("S", TURBO_RUNOUT)];
  }
}

// --- La bibliothèque --------------------------------------------------------------------------

/** Rétrécit si besoin pour qu'un virage serré tienne (la route large n'en porte pas), puis renvoie les blocs de transition. */
const toTight = (w: WidthLetter): string[] => (w === "l" ? reach("l", "n") : []);

export const FIGURES: readonly Figure[] = [
  // --- Techniques ---
  {
    name: "s-serre-large",
    label: "S serré-large",
    category: "technique",
    intent: "Un virage serré tout de suite suivi d'un large en sens inverse (ou l'inverse) : placer la voiture pour la sortie.",
    off: 0.8,
    variants: 2,
    build: (c) => [...toTight(c.width), "S", ...(c.variant === 0 ? [c.L, `${c.R}2`] : [`${c.L}2`, c.R]), "S"],
  },
  {
    name: "pincement",
    label: "Rétrécissement et virage",
    category: "technique",
    intent: "La route se resserre jusqu'à 14 m, puis un virage serré au bout de la ligne droite étroite.",
    off: 1.3,
    variants: 2,
    build: (c) => (c.width === "e" ? null : ["S", ...reach(c.width, "e"), ...rep("S", c.variant), c.L, "S"]),
  },
  {
    name: "releve-contre",
    label: "Relevé puis plat inverse",
    category: "technique",
    intent: "Un virage relevé pris à fond enchaîné sur un virage plat dans l'autre sens : la pente rejette vers l'extérieur.",
    off: 0.4,
    variants: 3,
    banked: true,
    build: (c) => ["S", ...[[`${c.L}2/b`, `${c.R}2`], [`${c.L}2/b`, `${c.R}2`, `${c.L}2`], [`${c.L}3/b`, `${c.R}2`]][c.variant]!, "S"],
  },
  {
    name: "epingle-terre",
    label: "Épingle large sur terre",
    category: "technique",
    intent: "Un demi-tour large sur la terre : freiner tôt, tourner sans glisser.",
    off: 0.6,
    variants: 3,
    build: (c) => ["S/t", "S/t", ...on([[`${c.L}2`, `${c.L}2`], [`${c.L}3`, `${c.L}2`], [`${c.L}2`, `${c.L}3`]][c.variant]!, "t"), "S/t", "S"],
  },
  {
    name: "slalom-glace",
    label: "Slalom de glace",
    category: "technique",
    intent: "Des S larges sur la glace, en roue libre : alterner gauche et droite sans gaz pour garder la voiture.",
    off: 4.2,
    variants: 2,
    build: (c) => ["S/g", ...on([`${c.L}2`, `${c.R}2`, ...(c.variant === 1 ? [`${c.L}2`] : [])], "g"), "S/g", "S"],
  },
  {
    name: "coupe-virage",
    label: "Moteur coupé avant un virage",
    category: "technique",
    intent: "Le moteur se coupe : vivre sur son élan, puis tourner sans pouvoir accélérer jusqu'au prochain point de contrôle.",
    off: 2.0,
    variants: 2,
    cut: true,
    build: (c) => ["S", "S", "C", "S", "S", ...(c.variant === 0 ? [`${c.L}2`] : [`${c.L}2`, `${c.R}2`]), "S"],
  },
  {
    name: "changement-revetement",
    label: "Changement de revêtement",
    category: "technique",
    intent: "Deux virages enchaînés qui changent de revêtement au milieu : l'adhérence n'est plus la même à la sortie.",
    off: 0.7,
    variants: 2,
    build: (c) => (c.variant === 0 ? ["S", `${c.L}2`, withMod(`${c.R}2`, "t"), "S/t", "S"] : ["S/t", "S/t", withMod(`${c.L}2`, "t"), `${c.R}2`, "S"]),
  },
  {
    name: "virage-descente",
    label: "Virage en descente",
    category: "technique",
    intent: "On prend de la vitesse dans la pente et le virage arrive au bas : freiner dans la descente.",
    off: 0.9,
    variants: 3,
    relief: true,
    build: (c) => (c.variant === 0 ? ["S", "D", "D", `${c.L}2`, "S", "U", "U"] : c.variant === 1 ? ["S", "D", "D", "D", `${c.L}2`, "S", "U", "U", "U"] : ["S", "D", `${c.L}2`, "S", "U"]),
  },
  {
    name: "virage-aveugle",
    label: "Virage aveugle en haut d'une montée",
    category: "technique",
    intent: "On monte, et le virage est juste derrière la crête : on ne le voit qu'une fois en haut.",
    off: 0.5,
    variants: 3,
    relief: true,
    build: (c) => (c.variant === 0 ? ["S", "U", "U", "S", `${c.L}2`, "D", "D", "S"] : c.variant === 1 ? ["S", "U2", "S", `${c.L}2`, "D2", "S"] : ["S", "U", "U", "U", `${c.L}2`, "D", "D", "D", "S"]),
  },
  {
    name: "crete-virage",
    label: "Crête puis virage",
    category: "technique",
    intent: "Un dos d'âne fait décoller, la réception est suivie d'un virage : on ne freine pas en l'air.",
    off: 0.4,
    variants: 2,
    relief: true,
    build: (c) => (c.variant === 0 ? ["S", ...crest("U2", "D2"), `${c.L}2`, "S"] : ["S", ...crest("U3", "D3"), `${c.L}2`, "S"]),
  },
  {
    name: "esse-relevee",
    label: "S relevé",
    category: "technique",
    intent: "Deux virages relevés dans des sens opposés : la pente change de côté au milieu.",
    off: 0.7,
    variants: 3,
    banked: true,
    build: (c) => ["S", ...(c.variant === 0 ? [`${c.L}2/b`, `${c.R}2/b`] : c.variant === 1 ? [`${c.L}2/b`, `${c.R}2`] : [`${c.L}2/b`, `${c.R}2/b`, `${c.L}2/b`]), "S"],
  },
  {
    name: "demi-tour-large",
    label: "Demi-tour large",
    category: "technique",
    intent: "Deux virages larges dans le même sens : un demi-tour à prendre sur la corde.",
    off: 0.2,
    variants: 2,
    build: (c) => ["S", ...(c.variant === 0 ? [`${c.L}2`, `${c.L}2`] : [`${c.L}2`, `${c.L}2`, `${c.R}2`]), "S"],
  },
  {
    name: "etranglement-terre",
    label: "Étranglement et virage sur terre",
    category: "technique",
    intent: "La route se resserre sur la terre, puis un virage serré au bout de la ligne droite étroite.",
    off: 1.3,
    variants: 2,
    build: (c) => ["S/t", ...on(reach(c.width, "e"), "t"), ...rep("S/t", c.variant === 0 ? 1 : 2), `${c.L}/t`, "S"],
  },
  {
    name: "chicane-glace",
    label: "Chicane sur la glace",
    category: "technique",
    intent: "Une chicane large sur la glace, après une ligne droite verglacée.",
    off: 5.1,
    variants: 2,
    build: (c) => ["S/g", ...(c.variant === 0 ? [`${c.L}2/g`, `${c.R}2/g`] : [`${c.L}2/g`, `${c.R}2/g`, `${c.L}2/g`]), "S/g", "S"],
  },
  {
    name: "freinage-epingle",
    label: "Gros freinage",
    category: "technique",
    intent: "Une longue droite, puis un virage serré : freiner le plus tard possible.",
    off: 1.7,
    variants: 2,
    build: (c) => [...toTight(c.width), "S", ...(c.variant === 0 ? ["S", "S", "S"] : ["P", "S", "S", "S"]), c.L, "S"],
  },
  {
    name: "slalom-route",
    label: "Slalom",
    category: "technique",
    intent: "Trois ou quatre virages larges qui alternent : le rythme se tient en sortie de chacun.",
    off: 0.8,
    variants: 3,
    banked: true,
    build: (c) => ["S", ...(c.variant === 0 ? [`${c.L}2`, `${c.R}2`, `${c.L}2`] : c.variant === 1 ? [`${c.L}2`, `${c.R}2`, `${c.L}2`, `${c.R}2`] : [`${c.L}2/b`, `${c.R}2/b`, `${c.L}2/b`]), "S"],
  },
  {
    name: "plaque-epingle",
    label: "Plaque puis épingle",
    category: "technique",
    intent: "Une plaque pousse à 66 m/s, trois lignes droites, puis un virage serré : le frein, pas le courage.",
    off: 1.9,
    variants: 2,
    braking: true,
    build: (c) => [...toTight(c.width), "S", "P", ...rep("S", c.variant === 0 ? 3 : 4), c.L, "S"],
  },

  // --- Figures propres aux nouveaux thèmes (lot 22) ---
  {
    name: "paroi-long-saut",
    label: "Paroi rocheuse et long saut",
    category: "saut",
    intent: "Le mur latéral donne de l'élan, une plaque ou un super turbo le complète, puis la rampe lance la voiture au-dessus du ravin.",
    off: 0.8,
    variants: 2,
    jump: true,
    cuve: true,
    only: ["canyon"],
    build: (c) => {
      const kind: JumpKind = c.variant === 0 ? "longDown" : "long";
      const { run, air } = jumpParts(kind);
      return ["S", ...rep(c.wall, 3), ...run, ...air, ...rep("S", landing(kind))];
    },
  },
  {
    name: "lacets",
    label: "Descente en lacets",
    category: "technique",
    intent: "La route descend en lacets (lot 25 : les virages descendent aussi) : courtes descentes et virages larges qui se suivent, la pente pousse dans chaque entrée.",
    // Lot 25 : chaque descente se raidit par crans (D puis D2) : un cran brutal en sortie de virage fait décoller la voiture, qui ne freine plus.
    off: 1.6,
    variants: 4,
    relief: true,
    braking: true,
    only: ["col"],
    build: (c) =>
      c.variant === 0
        ? ["S", "D", "D2", "D", `${c.L}2/d`, "D", "D2", "D", `${c.R}2/d`, "D", "D", `${c.L}2/d`, "S"]
        : c.variant === 1
          ? ["S", "D", "D2", "D2", `${c.L}2/d`, `${c.L}2/d`, "D", "D2", "D", `${c.R}2/d`, "S"]
          : c.variant === 2
            ? ["S", "D", "D2", "D3", "D", `${c.L}2/d`, "D", "D2", "D", `${c.R}2/d`, "D", `${c.L}2/d`, "S"]
            : ["S", "D", "D", "D", `${c.L}2/d`, "D", "D", "D", `${c.R}2/d`, "D", "D", "D", `${c.L}2/d`, "S"],
  },
  // --- Figures du Col alpin (lot 25) : tout descend, les virages aussi (`/d`) ---
  {
    name: "grande-descente",
    label: "Grande descente",
    category: "rapide",
    intent: "Une longue descente raide où la voiture dépasse 70 m/s sans turbo, puis une épingle large : le freinage le plus franc du circuit.",
    off: 2.0,
    variants: 3,
    relief: true,
    braking: true,
    only: ["col"],
    // Mesuré : la pente se raidit par crans (D, D2, puis D3) pour que la voiture ne s'envole pas au premier cran (en l'air, la pente ne pousse
    // plus) ; cinq blocs D3 mènent à 72–75 m/s.
    build: (c) =>
      c.variant === 0
        ? ["S", "D", "D2", "D3", "D3", "D3", "D3", "D3", "D2", "D", `${c.L}3/d`, "S"]
        : c.variant === 1
          ? ["S", "D", "D2", "D3", "D3", "D3", "D3", "D3", "D2", "D2", "D", `${c.L}2/d`, `${c.L}2/d`, "S"]
          : ["S", "D2", "D3", "D3", "D3", "D3", "D3", "D2", "D2", `${c.L}3/d`, "S"],
  },
  {
    name: "descente-epingle",
    label: "Descente et épingle",
    category: "technique",
    intent: "Une descente, puis une épingle large qui descend encore : freiner dans la pente, qui pousse.",
    off: 1.6,
    variants: 3,
    relief: true,
    braking: true,
    only: ["col"],
    build: (c) =>
      c.variant === 0
        ? ["S", "D", "D2", "D", "D", `${c.L}2/d`, `${c.L}2/d`, "S"]
        : c.variant === 1
          ? ["S", "D", "D2", "D2", "D", "D", `${c.L}2/d`, `${c.L}2/d`, "S"]
          : ["S", "D", "D", "D", "D", "D", `${c.L}2/d`, `${c.L}2/d`, "S"],
  },
  {
    name: "plongeon",
    label: "Plongeon",
    category: "rapide",
    intent: "Une plaque au sommet, puis la pente la plus raide : plus de 70 m/s, et une épingle large qui descend encore au bout.",
    off: 2.0,
    variants: 2,
    relief: true,
    braking: true,
    only: ["col"],
    build: (c) =>
      c.variant === 0
        ? ["S", "P", "D", "D2", "D3", "D3", "D3", "D3", "D2", "D", `${c.L}2/d`, `${c.L}2/d`, "S"]
        : ["S", "P", "D", "D2", "D3", "D3", "D3", "D3", "D3", "D2", "D", `${c.L}3/d`, "S"],
  },
  {
    name: "descente-releve",
    label: "Grande courbe relevée dans la descente",
    category: "technique",
    intent: "Au milieu de la descente, une grande courbe relevée qui descend aussi : la prendre vite, la pente et le relevé aident.",
    off: 0.6,
    variants: 2,
    relief: true,
    banked: true,
    only: ["col"],
    build: (c) => (c.variant === 0 ? ["S", "D", "D2", "D", `${c.L}3/bd`, "D", "D", "D", "S"] : ["S", "D", "D2", "D2", `${c.L}2/bd`, "D", "D", "S"]),
  },
  {
    name: "descente-s",
    label: "S dans la descente",
    category: "technique",
    intent: "Deux virages larges en sens contraires, en pleine pente : placer la voiture pour la sortie sans perdre l'élan.",
    off: 0.9,
    variants: 2,
    relief: true,
    only: ["col"],
    build: (c) => (c.variant === 0 ? ["S", "D", "D2", "D", `${c.L}2/d`, `${c.R}2/d`, "D", "D", "D", "S"] : ["S", "D", "D", "D", `${c.L}2/d`, "D", `${c.R}2/d`, "D", "D", "S"]),
  },
  {
    name: "corniche",
    label: "Corniche",
    category: "technique",
    intent: "La route longe la montagne en descendant, une grande courbe au milieu : souvent sans rebord, avec le vide à côté.",
    off: 0.5,
    variants: 2,
    relief: true,
    only: ["col"],
    build: (c) => (c.variant === 0 ? ["S", "D", "D", "D2", `${c.L}3/d`, "D", "D", "D", "S"] : ["S", "D", "D2", "D", `${c.L}3/d`, "D", "D2", "D", `${c.R}2/d`, "S"]),
  },
  // --- Figures du Rallye (lot 25) : la spéciale ---
  {
    name: "speciale",
    label: "Spéciale",
    category: "technique",
    intent: "Des virages enchaînés sur la terre, une bosse entre deux, jamais plus de deux lignes droites : le rythme d'une spéciale de rallye.",
    off: 1.2,
    variants: 4,
    only: ["rallye"],
    build: (c) =>
      c.variant === 0
        ? ["S/t", `${c.L}2/t`, "S/t", `${c.R}2/t`, "B", `${c.L}2/t`, "S"]
        : c.variant === 1
          ? ["S/t", `${c.L}2/t`, `${c.R}2/t`, "S/t", `${c.L}2/t`, `${c.L}2/t`, "S"]
          : c.variant === 2
            ? ["S/t", `${c.L}3/t`, `${c.R}2/t`, "B", `${c.L}2/t`, "S"]
            : ["S/t", `${c.L}2/t`, "B", `${c.R}2/t`, "S/t", `${c.R}2/t`, "S"],
  },
  {
    name: "bosse-virage",
    label: "Bosse et virage",
    category: "technique",
    intent: "Une petite crête ou une bosse fait décoller la voiture juste avant un virage : se poser, puis tourner tout de suite.",
    off: 0.6,
    variants: 3,
    relief: true,
    only: ["rallye"],
    build: (c) => (c.variant === 0 ? ["S", "U", "D", `${c.L}2`, "S"] : c.variant === 1 ? ["S", "B", "S", `${c.L}2`, "S"] : ["S", "D", "U", `${c.L}2`, "S"]),
  },
  {
    name: "petit-saut",
    label: "Petit saut et S",
    category: "technique",
    intent: "Une crête d'un niveau, et un S large juste derrière : on se pose déjà en tournant.",
    off: 0.8,
    variants: 2,
    relief: true,
    only: ["rallye"],
    build: (c) => (c.variant === 0 ? ["S", "U", "D", `${c.L}2`, `${c.R}2`, "S"] : ["S", "B", "B", `${c.L}2/t`, `${c.R}2/t`, "S"]),
  },
  {
    name: "chicane-angles",
    label: "Chicane d'angles droits",
    category: "technique",
    intent: "Des angles droits qui se suivent, une ligne droite entre chacun : freiner, tourner, relancer.",
    off: 2.0,
    variants: 2,
    only: ["ville"],
    build: (c) => [...toTight(c.width), "S", c.L, "S", c.R, ...(c.variant === 0 ? [] : ["S", c.L]), "S"],
  },
  {
    name: "u-urbain",
    label: "Demi-tour urbain",
    category: "technique",
    intent: "Deux angles droits dans le même sens, une ligne droite entre eux : un demi-tour entre deux rangées de murs.",
    off: 1.6,
    variants: 2,
    only: ["ville"],
    build: (c) => [...toTight(c.width), "S", ...(c.variant === 0 ? ["S", c.L, "S", c.L] : [c.L, "S", "S", c.L]), "S"],
  },

  // --- Sauts ---
  {
    name: "saut-simple",
    label: "Saut",
    category: "saut",
    intent: "Rampe, vide, réception : prendre assez de vitesse au bord (du saut court au saut vers le haut), puis un virage large derrière.",
    off: 1.0,
    variants: 5,
    jump: true,
    build: (c) => [...jumpCalm(JUMP_KINDS[c.variant]!), ...turned(c)],
  },
  {
    name: "saut-terre",
    label: "Saut sur la terre",
    category: "saut",
    intent: "Une rampe de terre, un vide, une réception de terre.",
    off: 0.7,
    variants: 2,
    jump: true,
    build: (c) => [...toTight(c.width), ...jumpCalm(c.variant === 0 ? "short" : "flat", "t"), ...turned(c)],
  },
  {
    name: "saut-virage",
    label: "Saut et virage",
    category: "saut",
    intent: "La réception est suivie de près d'un virage : on ne freine pas en l'air, tout se règle dès qu'on touche.",
    off: 0.6,
    variants: 3,
    jump: true,
    build: (c) =>
      c.variant === 0
        ? [...jumpParts("short").run, "K", "GD", "S", "S", "S", `${c.L}2`, "S"]
        : c.variant === 1
          ? [...toTight(c.width), ...jumpParts("flat").run, "K", "G", "D", "S", "S", `${c.L}2`, "S"]
          : [...toTight(c.width), ...jumpParts("flat").run, "K", "G", "D", "S", "S", `${c.R}2`, `${c.L}2`, "S"],
  },
  {
    name: "saut-releve",
    label: "Saut vers un virage relevé",
    category: "saut",
    intent: "On retombe, puis un virage relevé : la pente aide à tourner si la vitesse est bonne.",
    off: 0.6,
    variants: 2,
    jump: true,
    banked: true,
    build: (c) => [...jumpParts("flat").run, "K", "G", "D", "S", "S", c.variant === 0 ? `${c.L}2/b` : `${c.L}3/b`, "S"],
  },
  {
    name: "saut-cuve",
    label: "Saut dans une cuve",
    category: "saut",
    intent: "La réception se fait à l'entrée d'une cuve : la paroi se relève devant la voiture.",
    off: 0.1,
    weight: 2,
    variants: 2,
    jump: true,
    cuve: true,
    build: (c) => [...jumpParts("flat").run, "K", "G", "D", "S", ...rep("V", c.variant === 0 ? 5 : 6), ...rep("S", CUVE_RUNOUT)],
  },
  {
    name: "saut-etroit",
    label: "Saut vers une section étroite",
    category: "saut",
    intent: "On saute depuis une route large et on retombe sur une route qui se resserre.",
    off: 0.1,
    variants: 2,
    jump: true,
    build: (c) => {
      const run = c.variant === 0 ? jumpParts("short") : jumpParts("flat");
      return [...reach(c.width, "l"), ...run.run, ...run.air, "S", ...reach("l", "e"), "S"];
    },
  },
  {
    name: "saut-niveau-epingle",
    label: "Saut de niveau vers une épingle",
    category: "saut",
    intent: "On retombe deux niveaux plus bas, avec une épingle large juste derrière : réception et freinage.",
    off: 2.0,
    variants: 2,
    jump: true,
    build: (c) => [...toTight(c.width), ...jumpParts("longDown").run, "K", "GD2", "D", "S", ...(c.variant === 0 ? [`${c.L}2`, `${c.L}2`] : [`${c.L}3`, `${c.L}2`]), "S"],
  },
  {
    name: "saut-plaque",
    label: "Plaque à la réception",
    category: "saut",
    intent: "Une plaque d'accélération juste après la réception : la voiture repart plus vite qu'elle n'est tombée.",
    off: 1.2,
    variants: 2,
    jump: true,
    build: (c) => [...jumpParts("short").run, "K", "GD", ...(c.variant === 0 ? ["P"] : ["S", "P"]), ...rep("S", 3), ...turned(c)],
  },
  {
    name: "double-saut",
    label: "Double saut",
    category: "saut",
    intent: "Deux vides à la suite, avec une courte réception entre les deux.",
    off: 0.6,
    variants: 2,
    jump: true,
    build: (c) => (c.variant === 0 ? [...jumpParts("flat").run, "K", "G", "D", "S", "S", "K", "GD", ...rep("S", 3)] : [...jumpParts("longDown").run.slice(0, 3), "K", "GD", "S", "S", "S", "K", "GD", ...rep("S", 3)]).concat(turned(c)),
  },
  {
    name: "saut-paroi",
    label: "Saut en sortie de paroi",
    category: "saut",
    intent: "Le mur latéral donne de la vitesse, et le saut part tout de suite après : sortir de la paroi bien aligné.",
    off: 0.1,
    variants: 2,
    jump: true,
    cuve: true,
    build: (c) => ["S", ...rep(c.wall, c.variant === 0 ? 4 : 5), "S", "K", "GD", ...rep("S", 3)],
  },

  // --- Rapides ---
  {
    name: "chaine-turbo",
    label: "Turbos enchaînés",
    category: "rapide",
    intent: "Deux super turbos à trois blocs d'écart : le second prolonge le premier, puis un virage large, serré ou un S large au bout des cinq droites : freiner de plus de 80 m/s.",
    off: 2.9,
    variants: 3,
    turbo: true,
    braking: true,
    build: (c) => (c.variant === 0 ? [...fastCalm("chain"), `${c.L}2`, "S"] : c.variant === 1 ? (c.width === "e" ? null : [...toTight(c.width), ...fastCalm("chain"), c.L, "S"]) : [...fastCalm("chain"), `${c.L}2`, `${c.R}2`, "S"]),
  },
  {
    name: "descente-plaque",
    label: "Plaque en haut d'une descente",
    category: "rapide",
    intent: "Une plaque au sommet d'une longue descente de six blocs.",
    off: 1.4,
    variants: 3,
    relief: true,
    braking: true,
    build: (c) => (c.variant === 0 ? [...fastCalm("drop"), `${c.L}2`, "S"] : c.variant === 1 ? ["S", "P", "D", "D", "D", "D", ...rep("S", PAD_RUNOUT), `${c.L}2`, "S"] : [...fastCalm("drop"), `${c.L}2`, `${c.R}2`, "S"]),
  },
  {
    name: "turbo-courbe",
    label: "Turbo puis grande courbe relevée",
    category: "rapide",
    intent: "Un super turbo, puis une grande courbe relevée prise à fond (ou, dans une variante, un virage large à plat : il faut freiner).",
    off: 1.7,
    variants: 4,
    turbo: true,
    banked: true,
    build: (c) => [...fastCalm("bank"), c.variant === 0 ? `${c.L}2/b` : c.variant === 3 ? `${c.L}2` : `${c.L}3/b`, "S", ...(c.variant === 2 ? [`${c.R}3/b`, "S"] : [])],
  },
  {
    name: "plaque-virage",
    label: "Plaque puis virage",
    category: "rapide",
    intent: "Une plaque pousse à 66 m/s, deux lignes droites, puis un virage large (ou un S large) : le frein tout de suite.",
    off: 1.3,
    variants: 2,
    braking: true,
    build: (c) => ["S", "P", ...rep("S", PAD_RUNOUT), ...(c.variant === 0 ? [`${c.L}2`] : [`${c.L}2`, `${c.R}2`]), "S"],
  },

  // --- Combinaisons ---
  {
    name: "turbo-saut-releve",
    label: "Turbo, saut, virage relevé",
    category: "combo",
    intent: "Un super turbo lance un long saut, et la réception est suivie d'un virage relevé.",
    off: 1.0,
    variants: 2,
    jump: true,
    turbo: true,
    banked: true,
    build: (c) => [...jumpParts("long").run, ...jumpParts("long").air, ...rep("S", 4), c.variant === 0 ? `${c.L}2/b` : `${c.L}3/b`, "S"],
  },
  {
    name: "descente-cuve-saut",
    label: "Descente, cuve, saut",
    category: "combo",
    intent: "On descend, on remonte la paroi d'une cuve, et le saut part de la sortie.",
    off: 0.3,
    variants: 2,
    jump: true,
    cuve: true,
    build: (c) => ["S", "D", "S", ...rep("V", c.variant === 0 ? 5 : 6), "S", "K", "GD", ...rep("S", 3)],
  },
  {
    name: "turbo-epingle",
    label: "Turbo puis épingle",
    category: "combo",
    intent: "Un super turbo, cinq lignes droites, puis un virage serré : on arrive à plus de 70 m/s sur un virage de 16 m de rayon.",
    off: 2.1,
    variants: 2,
    turbo: true,
    braking: true,
    build: (c) => [...toTight(c.width), "S", "T", ...rep("S", c.variant === 0 ? TURBO_RUNOUT : TURBO_RUNOUT + 1), c.L, "S"],
  },
  {
    name: "glace-coupe-virage",
    label: "Glace, moteur coupé, virage",
    category: "combo",
    intent: "De la glace, puis le moteur se coupe, puis un virage sur la glace : on ne peut plus rattraper avec les gaz.",
    off: 4.0,
    variants: 2,
    cut: true,
    build: (c) => ["S/g", "S/g", "C", "S", "S", ...on(c.variant === 0 ? [`${c.L}2`] : [`${c.L}2`, `${c.R}2`], "g"), "S/g", "S"],
  },

  // --- Cuves ---
  {
    name: "cuve-droite",
    label: "Cuve",
    category: "cuve",
    intent: "Un demi-tube : monter sur les parois pour garder la vitesse.",
    off: 0.3,
    variants: 2,
    cuve: true,
    build: (c) => [...cuveCalm("bowl", c.L === "L", c.variant === 0 ? 6 : 5), ...turned(c)],
  },
  {
    name: "mur-lateral",
    label: "Mur latéral",
    category: "cuve",
    intent: "Une paroi d'un seul côté de la route.",
    off: 0.3,
    variants: 2,
    cuve: true,
    build: (c) => [...cuveCalm("wall", c.L === "L", c.variant === 0 ? 6 : 5), ...turned(c)],
  },
  {
    name: "virage-cuve",
    label: "Virage en cuve",
    category: "cuve",
    intent: "La paroi extérieure d'un virage se relève : la prendre ou passer par le fond.",
    off: 0.2,
    variants: 2,
    cuve: true,
    build: (c) => ["S", c.variant === 0 ? `${c.L}2/c` : `${c.L}3/c`, ...rep("S", CUVE_RUNOUT)],
  },

  // --- Reliefs ---
  {
    name: "colline-douce",
    label: "Colline",
    category: "relief",
    intent: "Une montée, une crête, une descente de un à trois niveaux.",
    off: 0.2,
    weight: 3,
    variants: HILLS_GENTLE.length,
    relief: true,
    build: (c) => ["S", ...HILLS_GENTLE[c.variant]!],
  },
  {
    name: "colline-raide",
    label: "Colline raide",
    category: "relief",
    intent: "Des pentes de deux ou trois niveaux : creux, dos d'âne, plateau surélevé.",
    off: 0.2,
    weight: 3,
    variants: HILLS_STEEP.length,
    relief: true,
    build: (c) => ["S", ...HILLS_STEEP[c.variant]!],
  },
];

export const FIGURE_NAMES: readonly string[] = FIGURES.map((f) => f.name);
const BY_NAME = new Map(FIGURES.map((f) => [f.name, f] as const));
export const figureByName = (name: string | null | undefined): Figure | null => (name ? (BY_NAME.get(name) ?? null) : null);

/** Contexte d'une figure : `left` = premier virage à gauche. */
export function figureContext(left: boolean, width: WidthLetter, variant: number): FigureContext {
  return { L: left ? "L" : "R", R: left ? "R" : "L", wall: left ? "ML" : "MR", width, variant };
}

/** Blocs d'une figure (variante et miroir donnés) à partir d'une route de la largeur `width`, ou `null` si impossible. */
export function buildFigure(f: Figure, left: boolean, width: WidthLetter, variant: number): string[] | null {
  return f.build(figureContext(left, width, variant));
}

const lengths = new Map<string, number>();
/** Longueur moyenne d'une figure (blocs, sans la droite d'amorce), sur ses variantes à largeur normale : sert au budget de longueur du générateur. */
export function figureLength(f: Figure): number {
  let len = lengths.get(f.name);
  if (len === undefined) {
    const all: number[] = [];
    for (let v = 0; v < f.variants; v++) {
      const body = buildFigure(f, true, "n", v);
      if (body) all.push(body.length - 1);
    }
    len = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    lengths.set(f.name, len);
  }
  return len;
}

// --- Durée estimée ---------------------------------------------------------------------------

/**
 * Secondes que le pilote met en moyenne sur un bloc (mesuré lot 20 : `scripts/probe-rhythm.ts`) : de quoi estimer la durée d'une figure sans
 * la faire rouler. Un virage large est lent (arc de 75 m pris sous la pointe), un super turbo rapide.
 */
const KIND_SECONDS: Record<string, number> = {
  straight: 0.7, curveL: 0.9, curveR: 0.9, wideL: 1.75, wideR: 1.75, grandL: 2.7, grandR: 2.7,
  up: 0.7, down: 0.6, bump: 0.7, jump: 0.7, kick: 0.7, gap: 0.65, boost: 0.6, turbo: 0.45, cut: 0.7,
};
const SURFACE_FACTOR: Record<BlockSurface, number> = { road: 1, dirt: 1.1, ice: 1.6, grass: 1.4, sand: 1.3 };

/** Durée estimée (s) d'une suite de blocs. */
export function estimateSeconds(tokens: readonly string[]): number {
  let t = 0;
  for (const token of tokens) {
    const p = parseToken(token);
    t += (KIND_SECONDS[p.kind] ?? 0.7) * SURFACE_FACTOR[p.surface];
  }
  return t;
}

const seconds = new Map<string, number>();
/** Durée estimée moyenne d'une figure (s), sans sa droite d'amorce, sur ses variantes à largeur normale. */
export function figureSeconds(f: Figure): number {
  let v = seconds.get(f.name);
  if (v === undefined) {
    const all: number[] = [];
    for (let k = 0; k < f.variants; k++) {
      const body = buildFigure(f, true, "n", k);
      if (body) all.push(estimateSeconds(body.slice(1)));
    }
    v = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    seconds.set(f.name, v);
  }
  return v;
}

const tights = new Map<string, number>();
/** Virages serrés (une cellule) de la figure sur sa variante qui en a le moins, route normale : le générateur en plafonne le total par circuit (`MAX_TIGHT`). */
export function minTightTurns(f: Figure): number {
  let n = tights.get(f.name);
  if (n === undefined) {
    n = Infinity;
    for (let v = 0; v < f.variants; v++) {
      const body = buildFigure(f, true, "n", v);
      if (body) n = Math.min(n, body.filter((t) => /^[LR](\/|$)/.test(t)).length);
    }
    n = n === Infinity ? 0 : n;
    tights.set(f.name, n);
  }
  return n;
}
