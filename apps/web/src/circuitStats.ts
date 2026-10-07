import { ROAD_WIDTHS, isCurve, isWide, type SurfaceKind, type Track } from "@cdj/sim";

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
  /** Tremplins. */
  jumps: number;
  /** Nombre de blocs et de points de contrôle (arrivée non comprise). */
  blocks: number;
  checkpoints: number;
}

export const SURFACE_LABEL: Record<SurfaceKind, string> = { road: "route", dirt: "terre", ice: "glace", grass: "herbe" };

const SURFACE_ORDER: SurfaceKind[] = ["road", "dirt", "ice", "grass"];

export function circuitStats(track: Track): CircuitStats {
  const widths = new Set<number>();
  const surfaces = new Set<SurfaceKind>();
  const s: CircuitStats = { widths: [], surfaces: [], pads: 0, turbos: 0, cuts: 0, tight: 0, banked: 0, jumps: 0, blocks: track.blocks.length, checkpoints: track.gates.filter((g) => g.kind === "checkpoint").length };
  for (const b of track.blocks) {
    widths.add(b.w0);
    widths.add(b.w1);
    surfaces.add(b.surface);
    if (b.kind === "boost") s.pads++;
    else if (b.kind === "turbo") s.turbos++;
    else if (b.kind === "cut") s.cuts++;
    else if (b.kind === "jump") s.jumps++;
    if (isCurve(b.kind)) {
      if (!isWide(b.kind)) s.tight++;
      if (b.banked) s.banked++;
    }
  }
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

/** Toutes les largeurs possibles (pour vérifier qu'une valeur lue est bien l'une des trois). */
export const KNOWN_WIDTHS: readonly number[] = Object.values(ROAD_WIDTHS);
