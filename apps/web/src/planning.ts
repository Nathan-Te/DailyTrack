import { isVariant, themeByName, type ThemeName } from "@cdj/sim";
import { apiCall, type ApiResult } from "./api";

// Planning des circuits (lot 14) : l'admin peut remplacer à l'avance le circuit d'un jour à venir. Le circuit en vigueur d'un
// jour = (variante, thème imposé). Variante 0 sans thème : le circuit d'origine (celui d'avant le lot 14).

export interface PlanEntry {
  variant: number;
  /** Thème imposé, ou `null` pour celui de la date. */
  theme: ThemeName | null;
}

/** Jours d'avance au plus pour remplacer un circuit (le serveur applique la même limite). */
export const PLAN_HORIZON = 60;

export const NO_PLAN: Readonly<PlanEntry> = Object.freeze({ variant: 0, theme: null });

/** Lecture prudente d'une entrée reçue d'une API ou du stockage : toute valeur invalide donne `null`. */
export function parsePlanEntry(raw: unknown): PlanEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isVariant(o.variant)) return null;
  const theme = o.theme === null || o.theme === undefined ? null : typeof o.theme === "string" ? themeByName(o.theme)?.name ?? undefined : undefined;
  if (theme === undefined) return null;
  return { variant: o.variant, theme };
}

/** Un circuit remplacé ? (variante ≠ 0 ou thème imposé) */
export const isReplaced = (p: PlanEntry) => p.variant !== 0 || p.theme !== null;

// --- Mode démo : planning gardé dans ce navigateur -------------------------------------------------------------

/** Clé de stockage du planning de démonstration (`?api=demo`) : propre à ce navigateur, jamais envoyé nulle part. */
export const DEMO_PLAN_KEY = "cdj:demo-plan";

export function parseDemoPlan(raw: string | null): Map<string, PlanEntry> {
  const out = new Map<string, PlanEntry>();
  if (!raw) return out;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return out;
    for (const [date, v] of Object.entries(o)) {
      const e = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parsePlanEntry(v) : null;
      if (e && isReplaced(e)) out.set(date, e);
    }
  } catch {
    /* illisible : pas de planning */
  }
  return out;
}

export function loadDemoPlan(storage: Pick<Storage, "getItem"> | null = safeStorage()): Map<string, PlanEntry> {
  try {
    return parseDemoPlan(storage?.getItem(DEMO_PLAN_KEY) ?? null);
  } catch {
    return new Map();
  }
}

export function saveDemoPlan(plan: Map<string, PlanEntry>, storage: Pick<Storage, "setItem" | "removeItem"> | null = safeStorage()): void {
  try {
    if (plan.size === 0) storage?.removeItem(DEMO_PLAN_KEY);
    else storage?.setItem(DEMO_PLAN_KEY, JSON.stringify(Object.fromEntries([...plan].sort(([a], [b]) => (a < b ? -1 : 1)))));
  } catch {
    /* stockage indisponible */
  }
}

function safeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

// --- API -----------------------------------------------------------------------------------------------------------

/** Délai court : le jeu ne doit pas attendre une API lente pour démarrer (puis course non classée). */
export const PLAN_TIMEOUT_MS = 2500;

export interface DayPlan extends PlanEntry {
  /** Identifiant du circuit en vigueur ce jour-là, tel que le serveur le rejouera. */
  trackId: string;
}

/** Variante en vigueur un jour, demandée à l'API (`GET /api/day/AAAA-MM-JJ`). */
export async function fetchDayPlan(base: string, date: string, timeoutMs = PLAN_TIMEOUT_MS): Promise<ApiResult<DayPlan>> {
  const r = await apiCall<Record<string, unknown>>(base, "GET", `/api/day/${date}`, undefined, timeoutMs);
  if (!r.ok) return r;
  const e = parsePlanEntry(r.data);
  if (!e || typeof r.data.trackId !== "string") return { ok: false, status: 0, code: "invalid", message: "Réponse du serveur illisible" };
  return { ok: true, data: { ...e, trackId: r.data.trackId } };
}

/** Jours remplacés connus du public (jusqu'à aujourd'hui), pour les miniatures des archives. */
export async function fetchPlanning(base: string): Promise<Map<string, PlanEntry> | null> {
  const r = await apiCall<{ days?: unknown }>(base, "GET", "/api/planning");
  if (!r.ok || !Array.isArray(r.data.days)) return null;
  const out = new Map<string, PlanEntry>();
  for (const d of r.data.days as Record<string, unknown>[]) {
    const e = parsePlanEntry(d);
    if (e && typeof d.date === "string") out.set(d.date, e);
  }
  return out;
}
