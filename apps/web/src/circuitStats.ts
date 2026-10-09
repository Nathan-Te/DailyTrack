import { ROAD_WIDTHS, figureByName, isCurve, isWide, type SurfaceKind, type Track } from "@cdj/sim";

// Chiffres d'un circuit pour le panneau d'admin (lot 14) : tout se lit sur la piste construite, sans rien simuler.

export interface CircuitStats {
  /** Largeurs de route rencontrées (m), de la plus étroite à la plus large. */
  widths: number[];
  /** Revêtements présents, route comprise si elle apparaît. */
  surfaces: SurfaceKind[];
  /** Blocs à effet : plaques d'accélération, super turbos, moteurs coupés. */
  pads: number;
  turbos: number;
  cuts: number;
  /** Virages serrés (une cellule) et virages relevés. */
  tight: number;
  banked: number;
  /** Tremplins (J) et vrais sauts (rampe K suivie d'un vide, lot 17). */
  jumps: number;
  /** Dénivelé du circuit (m), du point le plus bas au plus haut de la route (lot 17), et nombre de blocs sans rebords. */
  relief: number;
  open: number;
  /** Blocs de cuve (lot 18) : cuve droite (deux parois), mur latéral (une paroi) et virage en cuve. */
  cuves: number;
  walls: number;
  cuveTurns: number;
  /** Bas-côtés (lot 21) : blocs bordés de chaque revêtement, virages bordés (on peut les couper), blocs de route bosselée. */
  shoulders: Partial<Record<"grass" | "gravel" | "snow" | "sand", number>>;
  cuttable: number;
  bumpy: number;
  /** Nombre de blocs et de points de contrôle (arrivée non comprise). */
  blocks: number;
  checkpoints: number;
}

export const SURFACE_LABEL: Record<SurfaceKind, string> = { road: "route", dirt: "terre", ice: "glace", grass: "herbe", sand: "sable", gravel: "terre et gravier", snow: "neige poudreuse", kerb: "vibreur" };

const SURFACE_ORDER: SurfaceKind[] = ["road", "dirt", "ice", "grass", "sand"];

export function circuitStats(track: Track): CircuitStats {
  const widths = new Set<number>();
  const surfaces = new Set<SurfaceKind>();
  let lo = 0;
  let hi = 0;
  const s: CircuitStats = { widths: [], surfaces: [], pads: 0, turbos: 0, cuts: 0, tight: 0, banked: 0, jumps: 0, relief: 0, open: 0, cuves: 0, walls: 0, cuveTurns: 0, shoulders: {}, cuttable: 0, bumpy: 0, blocks: track.blocks.length, checkpoints: track.gates.filter((g) => g.kind === "checkpoint").length };
  for (const b of track.blocks) {
    widths.add(b.w0);
    widths.add(b.w1);
    surfaces.add(b.surface);
    if (b.kind === "boost") s.pads++;
    else if (b.kind === "turbo") s.turbos++;
    else if (b.kind === "cut") s.cuts++;
    else if (b.kind === "jump" || b.kind === "kick") s.jumps++;
    if (b.open) s.open++;
    if (b.shoulder) {
      s.shoulders[b.shoulder] = (s.shoulders[b.shoulder] ?? 0) + 1;
      if (isCurve(b.kind)) s.cuttable++;
    }
    if (b.bumpy) s.bumpy++;
    if (b.cuve) {
      if (isCurve(b.kind)) s.cuveTurns++;
      else if (b.cuve === 3) s.cuves++;
      else s.walls++;
    }
    lo = Math.min(lo, b.y0, b.y0 + b.rise);
    hi = Math.max(hi, b.y0, b.y0 + b.rise);
    if (isCurve(b.kind)) {
      if (!isWide(b.kind)) s.tight++;
      if (b.banked) s.banked++;
    }
  }
  s.relief = hi - lo;
  s.widths = [...widths].sort((a, b) => a - b);
  s.surfaces = SURFACE_ORDER.filter((k) => surfaces.has(k));
  return s;
}

/** « 14 · 20 m », « 26 m ». */
export function widthsText(widths: readonly number[]): string {
  return widths.length ? `${widths.join(" · ")} m` : "—";
}

/** Une ligne de texte pour les effets : « 2 plaques · 1 super turbo », ou « aucun ». */
export function effectsText(s: Pick<CircuitStats, "pads" | "turbos" | "cuts">): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n > 0 && parts.push(`${n} ${n > 1 ? many : one}`);
  add(s.pads, "plaque", "plaques");
  add(s.turbos, "super turbo", "super turbos");
  add(s.cuts, "moteur coupé", "moteurs coupés");
  return parts.length ? parts.join(" · ") : "aucun";
}

/** Une ligne de texte pour le relief : « 24 m de dénivelé · 2 sauts · 4 blocs sans rebords ». */
export function reliefText(s: Pick<CircuitStats, "relief" | "jumps" | "open">): string {
  const parts = [`${s.relief} m de dénivelé`];
  if (s.jumps > 0) parts.push(`${s.jumps} ${s.jumps > 1 ? "sauts" : "saut"}`);
  if (s.open > 0) parts.push(`${s.open} ${s.open > 1 ? "blocs sans rebords" : "bloc sans rebords"}`);
  return parts.join(" · ");
}

/** Une ligne pour les bas-côtés (lot 21) : « 18 blocs d'herbe · 4 virages à couper · 3 blocs bosselés », ou « rebords partout ». */
export function sidesText(s: Pick<CircuitStats, "shoulders" | "cuttable" | "bumpy" | "open">): string {
  const parts: string[] = [];
  for (const k of ["grass", "gravel", "snow", "sand"] as const) {
    const n = s.shoulders[k] ?? 0;
    if (n > 0) parts.push(`${n} ${n > 1 ? "blocs" : "bloc"} bordés de ${SURFACE_LABEL[k]}`);
  }
  if (s.cuttable > 0) parts.push(`${s.cuttable} ${s.cuttable > 1 ? "virages à couper" : "virage à couper"}`);
  if (s.bumpy > 0) parts.push(`${s.bumpy} ${s.bumpy > 1 ? "blocs bosselés" : "bloc bosselé"}`);
  return parts.length ? parts.join(" · ") : s.open > 0 ? "le vide (sans rebords)" : "rebords partout";
}

/** Toutes les largeurs possibles (pour vérifier qu'une valeur lue est bien l'une des trois). */
export const KNOWN_WIDTHS: readonly number[] = Object.values(ROAD_WIDTHS);

/** Une ligne de texte pour les cuves (lot 18) : « 4 blocs de cuve droite · 1 virage en cuve », ou « aucune ». */
export function cuvesText(s: Pick<CircuitStats, "cuves" | "walls" | "cuveTurns">): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n > 0 && parts.push(`${n} ${n > 1 ? many : one}`);
  add(s.cuves, "bloc de cuve droite", "blocs de cuve droite");
  add(s.walls, "bloc de mur latéral", "blocs de mur latéral");
  add(s.cuveTurns, "virage en cuve", "virages en cuve");
  return parts.length ? parts.join(" · ") : "aucune";
}

/** Les figures d'un circuit (lot 20), dans l'ordre, avec leur catégorie : « Moteur coupé avant un virage (technique) · … » (aide au remplacement). */
export function figuresText(names: readonly string[]): string {
  return names.map((n) => {
    const f = figureByName(n);
    return f ? `${f.label} (${f.category})` : n;
  }).join(" · ");
}
