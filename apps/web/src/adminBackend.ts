import { PREMIER_JOUR, circuitNumber, formatDay, parseDay, type ThemeName } from "@cdj/sim";
import { apiCall, type ApiResult } from "./api";
import { DemoApi, DEMO_TODAY } from "./demo";
import { replaceProblem } from "./adminPlan";
import { isReplaced, loadDemoPlan, parsePlanEntry, saveDemoPlan, type PlanEntry } from "./planning";
import { gameStorage } from "./storage";

// Ce que le panneau d'admin demande à un serveur (lot 14) : l'API réelle (session du panneau) ou, en `?api=demo`, un faux local qui garde
// les remplacements dans ce navigateur seulement.

export interface PlanRow extends PlanEntry {
  date: string;
  chosenAt: number | null;
}

export interface DayRow extends PlanEntry {
  date: string;
  number: number;
  participants: number;
  bestMs: number | null;
  authorMs: number | null;
  trackId: string | null;
}

export interface AdminOverview {
  /** « Aujourd'hui » du serveur (date de Paris), ou celui de la démo. */
  today: string;
  /** Remplacements enregistrés (futurs et passés). */
  plan: PlanRow[];
  /** Aujourd'hui puis les quatorze jours passés, du plus récent au plus ancien. */
  days: DayRow[];
  /** Temps de tous les joueurs d'aujourd'hui (ms, du plus rapide au plus lent). */
  times: number[];
}

export interface AdminBackend {
  readonly kind: "api" | "demo";
  readonly label: string;
  overview(): Promise<ApiResult<AdminOverview>>;
  replace(date: string, entry: PlanEntry): Promise<ApiResult<unknown>>;
  revert(date: string): Promise<ApiResult<unknown>>;
}

const fail = (code: string, message: string, status = 0): ApiResult<never> => ({ ok: false, status, code, message });

// --- API réelle -------------------------------------------------------------------------------------------------

/**
 * Les outils d'administration de Track s'ouvrent par **la session du panneau de la plateforme** (`/admin/`, connexion Google ; cookie `__session` HttpOnly posé par le
 * serveur) : il n'y a plus de jeton à saisir ni à garder dans le navigateur (`adminAcces.ts`). L'en-tête `X-Cdj-Admin: 1` est celui que le serveur exige d'une requête qui
 * modifie quelque chose avec la session (une lecture n'en a pas besoin, mais il ne gêne pas).
 */
export const adminHeaders = (): Record<string, string> => ({ "X-Cdj-Admin": "1" });

/** L'ancienne clé du jeton d'admin (avant la connexion Google) : plus lue, effacée à chaque ouverture de la page. */
export const ANCIENNE_CLE_JETON = "cdj:admin-token";

export function oublierAncienJeton(): void {
  try {
    gameStorage().removeItem(ANCIENNE_CLE_JETON);
  } catch {
    /* stockage indisponible : rien à oublier */
  }
}

/** La session du panneau est un cookie : elle ne vaut que pour la même origine (jamais pour une API visée par `?api=`). */
export function memeOrigine(base: string): boolean {
  try {
    return new URL(base, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

const ADMIN_TIMEOUT_MS = 20_000; // remplacer un circuit fait générer et valider un circuit côté serveur

export class HttpAdmin implements AdminBackend {
  readonly kind = "api" as const;

  constructor(private readonly base: string) {}

  get label(): string {
    return this.base;
  }

  private call<T>(method: string, path: string, body?: unknown) {
    return apiCall<T>(this.base, method, path, body, ADMIN_TIMEOUT_MS, adminHeaders());
  }

  async overview(): Promise<ApiResult<AdminOverview>> {
    const r = await this.call<Record<string, unknown>>("GET", "/api/admin/overview");
    if (!r.ok) return r;
    const o = parseOverview(r.data);
    return o ? { ok: true, data: o } : fail("invalid", "Réponse du serveur illisible");
  }

  replace(date: string, entry: PlanEntry) {
    return this.call<unknown>("PUT", `/api/admin/planning/${date}`, { variant: entry.variant, theme: entry.theme });
  }

  revert(date: string) {
    return this.call<unknown>("DELETE", `/api/admin/planning/${date}`);
  }
}

/** Lecture prudente de la vue d'ensemble du serveur. */
export function parseOverview(raw: Record<string, unknown>): AdminOverview | null {
  if (typeof raw.today !== "string" || !Array.isArray(raw.plan) || !Array.isArray(raw.days) || !Array.isArray(raw.times)) return null;
  const plan: PlanRow[] = [];
  for (const p of raw.plan as Record<string, unknown>[]) {
    const e = parsePlanEntry(p);
    if (e && typeof p.date === "string") plan.push({ ...e, date: p.date, chosenAt: typeof p.chosenAt === "number" ? p.chosenAt : null });
  }
  const days: DayRow[] = [];
  for (const d of raw.days as Record<string, unknown>[]) {
    const e = parsePlanEntry(d);
    if (!e || typeof d.date !== "string") continue;
    days.push({
      ...e,
      date: d.date,
      number: typeof d.number === "number" ? d.number : 0,
      participants: typeof d.participants === "number" ? d.participants : 0,
      bestMs: typeof d.bestMs === "number" ? d.bestMs : null,
      authorMs: typeof d.authorMs === "number" ? d.authorMs : null,
      trackId: typeof d.trackId === "string" ? d.trackId : null,
    });
  }
  return { today: raw.today, plan, days, times: (raw.times as unknown[]).filter((t): t is number => typeof t === "number") };
}

// --- Démonstration ----------------------------------------------------------------------------------------------

/**
 * `?api=demo` : pas de serveur. « Aujourd'hui » est celui de la démo (le lendemain de l'historique) ; les remplacements sont
 * gardés dans ce navigateur (`cdj:demo-plan`) et le jeu en `?api=demo` les respecte. Rien n'est envoyé nulle part.
 */
export class DemoAdmin implements AdminBackend {
  readonly kind = "demo" as const;
  readonly label = "démonstration (ce navigateur seulement)";
  private readonly demo = new DemoApi();

  constructor(private readonly today = DEMO_TODAY) {}

  async overview(): Promise<ApiResult<AdminOverview>> {
    const plan = loadDemoPlan();
    const rows: PlanRow[] = [...plan].map(([date, e]) => ({ ...e, date, chosenAt: null }));
    const days: DayRow[] = [];
    const index = await this.demo.loadIndex();
    const byDate = new Map(index.ok ? index.data.days.map((d) => [d.date, d]) : []);
    for (let day = this.today; day >= this.today - 14 && day >= PREMIER_JOUR; day--) {
      const date = formatDay(day);
      const d = byDate.get(date);
      const e = plan.get(date);
      days.push({ date, number: circuitNumber(day), participants: d?.participants ?? 0, bestMs: d?.firstMs ?? null, authorMs: d?.authorMs ?? null, trackId: null, variant: e?.variant ?? 0, theme: e?.theme ?? null });
    }
    return { ok: true, data: { today: formatDay(this.today), plan: rows, days, times: [] } };
  }

  async replace(date: string, entry: PlanEntry): Promise<ApiResult<unknown>> {
    const day = parseDay(date);
    if (day === null) return fail("invalid_date", "Date attendue au format AAAA-MM-JJ", 400);
    const problem = replaceProblem(this.today, day, entry);
    if (problem) return fail("refused", problem, 409);
    const plan = loadDemoPlan();
    if (isReplaced(entry)) plan.set(date, entry);
    else plan.delete(date);
    saveDemoPlan(plan);
    return { ok: true, data: { date, ...entry } };
  }

  async revert(date: string): Promise<ApiResult<unknown>> {
    return this.replace(date, { variant: 0, theme: null as ThemeName | null });
  }
}
