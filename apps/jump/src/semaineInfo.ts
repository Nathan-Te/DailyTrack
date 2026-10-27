import { rleRow, unrleRow, type DailyLevel } from "@cdj/jump-sim";

// Lot 19 — la logique pure de l'outil `?semaine=` (aucun DOM) : ce qu'on montre d'un niveau du jour (sa grille, ses scies, ses morceaux de base) et
// quels morceaux reviennent dans la semaine. Le fichier de comparaison g13 (`public/outils/semaine-g13.json`) a exactement cette forme, ses rangées
// codées comme celles des niveaux figés (`rleRow`).

/** Un morceau d'un jour : son identifiant de base, sa variante et ses colonnes dans le niveau. */
export interface SemainePiece {
  id: string;
  variant: number;
  col0: number;
  col1: number;
}

/** Lot 20 : une plateforme mobile de la miniature : sa largeur et ses deux extrémités (tuiles). */
export interface SemainePlatform {
  width: number;
  from: [number, number];
  to: [number, number];
}

/** Lot 22 : une presse de la miniature : colonne, rangée haute, largeur et course (tuiles). */
export interface SemainePress {
  col: number;
  row: number;
  width: number;
  travel: number;
}

/** Lot 24 : une stalactite de la miniature : colonne, rangée de son corps, et sa zone de déclenchement (colonnes de chaque côté). */
export interface SemaineStalactite {
  col: number;
  row: number;
  before: number;
  after: number;
}

/** Lot 25 : un laser fixe de la miniature : axe, première tuile du rayon et longueur (tuiles). */
export interface SemaineLaser {
  axis: "h" | "v";
  col: number;
  row: number;
  length: number;
}

/** Lot 25 : une barre laser coulissante de la miniature : axe, longueur et les deux positions extrêmes (coin haut-gauche de la première tuile du rayon). */
export interface SemaineBarre {
  axis: "h" | "v";
  length: number;
  from: [number, number];
  to: [number, number];
}

/** Un jour de la semaine, tel que l'outil le montre. */
export interface SemaineDay {
  date: string;
  theme: string;
  id: string;
  /** Les rangées de la grille (caractères de `level.ts`, `S`, `F` et `C` compris). */
  rows: string[];
  /** Le premier point de chaque scie mobile (colonne, rangée), pour la miniature. */
  saws: [number, number][];
  /** Lot 20 : les plateformes mobiles (largeur, extrémités : coin haut-gauche), pour la miniature ; absent des fichiers d'avant le lot. */
  platforms?: SemainePlatform[];
  /** Lot 22 : les presses (colonne, rangée haute, largeur, course), pour la miniature ; absent des fichiers d'avant le lot. */
  presses?: SemainePress[];
  /** Lot 24 : les stalactites (tuile du corps, zone), pour la miniature ; absent des fichiers d'avant le lot. */
  stalactites?: SemaineStalactite[];
  /** Lot 25 : les lasers fixes et les barres coulissantes, pour la miniature ; absents des fichiers d'avant le lot. */
  lasers?: SemaineLaser[];
  barres?: SemaineBarre[];
  pieces: SemainePiece[];
  fallback: boolean;
}

/** Le fichier de comparaison (`semaine-g13.json`) : les mêmes jours, rangées codées par `rleRow`. */
export interface SemaineFile {
  generateur: number;
  jours: (Omit<SemaineDay, "rows"> & { grille: string[] })[];
}

/** Ce que l'outil montre d'un niveau du jour. */
export function semaineDayOf(d: Pick<DailyLevel, "date" | "theme" | "id" | "ascii" | "pieces" | "fallback">): SemaineDay {
  const [grid = "", annex = ""] = d.ascii.split("\n\n");
  const saws: [number, number][] = [];
  const platforms: SemainePlatform[] = [];
  const presses: SemainePress[] = [];
  const stalactites: SemaineStalactite[] = [];
  const lasers: SemaineLaser[] = [];
  const barres: SemaineBarre[] = [];
  for (const line of annex.split("\n")) {
    const words = line.trim().split(/\s+/);
    if (words[0] === "laser") {
      const at = /^(\d+),(\d+)$/.exec(words[3] ?? "");
      if (at && (words[2] === "h" || words[2] === "v")) lasers.push({ axis: words[2], col: Number(at[1]), row: Number(at[2]), length: Number(words[4]) });
      continue;
    }
    if (words[0] === "barre") {
      const a = /^(\d+),(\d+)$/.exec(words[5] ?? "");
      const b = /^(\d+),(\d+)$/.exec(words[6] ?? "");
      if (a && b && (words[2] === "h" || words[2] === "v")) barres.push({ axis: words[2], length: Number(words[3]), from: [Number(a[1]), Number(a[2])], to: [Number(b[1]), Number(b[2])] });
      continue;
    }
    if (words[0] === "stalactite") {
      const at = /^(\d+),(\d+)$/.exec(words[2] ?? "");
      if (at) stalactites.push({ col: Number(at[1]), row: Number(at[2]), before: Number(words[3]), after: Number(words[4]) });
      continue;
    }
    if (words[0] === "presse") {
      const at = /^(\d+),(\d+)$/.exec(words[3] ?? "");
      if (at) presses.push({ col: Number(at[1]), row: Number(at[2]), width: Number(words[2]), travel: Number(words[4]) });
      continue;
    }
    if (words[0] === "plateforme") {
      const a = /^(\d+),(\d+)$/.exec(words[5] ?? "");
      const b = /^(\d+),(\d+)$/.exec(words[6] ?? "");
      if (a && b) platforms.push({ width: Number(words[2]), from: [Number(a[1]), Number(a[2])], to: [Number(b[1]), Number(b[2])] });
      continue;
    }
    if (words[0] !== "scie") continue;
    const m = /^(\d+),(\d+)$/.exec(words[5] ?? "");
    if (m) saws.push([Number(m[1]), Number(m[2])]);
  }
  return {
    date: d.date,
    theme: d.theme,
    id: d.id,
    rows: grid.split("\n"),
    saws,
    platforms,
    ...(presses.length > 0 ? { presses } : {}),
    ...(stalactites.length > 0 ? { stalactites } : {}),
    ...(lasers.length > 0 ? { lasers } : {}),
    ...(barres.length > 0 ? { barres } : {}),
    pieces: d.pieces.map((p) => ({ id: p.id, variant: p.variant, col0: p.col0, col1: p.col1 })),
    fallback: d.fallback,
  };
}

/** Un jour pour le fichier de comparaison. */
export function semaineEntry(day: SemaineDay): SemaineFile["jours"][number] {
  const { rows, ...rest } = day;
  return { ...rest, grille: rows.map(rleRow) };
}

/** L'inverse de `semaineEntry`. */
export function semaineFromEntry(entry: SemaineFile["jours"][number]): SemaineDay {
  const { grille, ...rest } = entry;
  return { ...rest, rows: grille.map(unrleRow) };
}

/** Les morceaux de base présents dans au moins deux jours de la liste, et les dates où ils sont. */
export function repeatedPieces(days: readonly Pick<SemaineDay, "date" | "pieces">[]): Map<string, string[]> {
  const where = new Map<string, string[]>();
  for (const d of days) {
    for (const id of new Set(d.pieces.map((p) => p.id))) where.set(id, [...(where.get(id) ?? []), d.date]);
  }
  for (const [id, dates] of where) if (dates.length < 2) where.delete(id);
  return where;
}

/** Les sept dates à partir d'un numéro de jour (`formatDay` de `@cdj/core` passé en argument pour rester sans dépendance d'horloge). */
export function semaineDays(from: number, n = 7): number[] {
  return Array.from({ length: n }, (_, k) => from + k);
}

/** La famille de couleur d'une tuile dans la miniature : vide, plein, mécanique (surface, bloc à horloge, lot 23 : champignon), danger, repère (départ, arrivée, point). */
export type MiniKind = "vide" | "plein" | "meca" | "danger" | "repere";

export function miniKind(ch: string): MiniKind {
  if (ch === "#" || ch === "x" || ch === "*") return "plein";
  // Lot 23 : un champignon (`m` sol, `w` plafond, `)` mur à gauche, `(` mur à droite) est une mécanique : en crème comme les surfaces, jamais le rouge des dangers.
  if ("[]~bdABmw()".includes(ch)) return "meca";
  if ("^v<>oO".includes(ch)) return "danger";
  if (ch === "S" || ch === "F" || ch === "C") return "repere";
  return "vide";
}
