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

/** Un jour de la semaine, tel que l'outil le montre. */
export interface SemaineDay {
  date: string;
  theme: string;
  id: string;
  /** Les rangées de la grille (caractères de `level.ts`, `S`, `F` et `C` compris). */
  rows: string[];
  /** Le premier point de chaque scie mobile (colonne, rangée), pour la miniature. */
  saws: [number, number][];
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
  for (const line of annex.split("\n")) {
    const words = line.trim().split(/\s+/);
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

/** La famille de couleur d'une tuile dans la miniature : vide, plein, mécanique (surface ou bloc à horloge), danger, repère (départ, arrivée, point). */
export type MiniKind = "vide" | "plein" | "meca" | "danger" | "repere";

export function miniKind(ch: string): MiniKind {
  if (ch === "#" || ch === "x" || ch === "*") return "plein";
  if ("[]~bdAB".includes(ch)) return "meca";
  if ("^v<>oO".includes(ch)) return "danger";
  if (ch === "S" || ch === "F" || ch === "C") return "repere";
  return "vide";
}
