import { PREMIER_JOUR, SIM_VERSION, GENERATOR_VERSION } from "@cdj/sim";
import type { ApiResult, BoardRow, GhostData, Leaderboard, LeaderboardSource, SubmitResult } from "./api";
import { getName } from "./identity";

// Mode démo (`?api=demo`, lot 11) : un jeu de données statique (`public/demo/`, fabriqué par `npm run history:seed`) tient
// lieu d'API : classements figés de quatorze jours passés et fantôme du premier de chaque jour. Il est en lecture seule :
// rien n'est jamais envoyé, donc rien ne peut polluer un vrai classement. Le jeu marche sans lui.

/** Nombre de jours d'historique du jeu de données (le script en fabrique autant). */
export const DEMO_DAYS = 14;
/** « Aujourd'hui » du mode démo : le lendemain du dernier jour de l'historique (figé, pour des archives stables). */
export const DEMO_TODAY = PREMIER_JOUR + DEMO_DAYS;

export interface DemoDayData {
  date: string;
  participants: number;
  top: BoardRow[];
  ghost: GhostData | null;
}

export interface DemoIndexDay {
  date: string;
  number: number;
  authorMs: number;
  participants: number;
  firstMs: number;
}

export interface DemoIndex {
  simVersion: number;
  generatorVersion: number;
  premierJour: string;
  demoToday: string;
  days: DemoIndexDay[];
}

export const STALE_MESSAGE = "Jeu de données de démonstration périmé : relancer « npm run history:seed »";

/** Le jeu de données correspond-il aux versions du jeu ? Renvoie le message à montrer, ou `null` si tout va bien. */
export function demoProblem(index: DemoIndex): string | null {
  if (index.simVersion !== SIM_VERSION || index.generatorVersion !== GENERATOR_VERSION) {
    return `${STALE_MESSAGE} (données : simulation v${index.simVersion}, générateur v${index.generatorVersion} ; jeu : v${SIM_VERSION}, v${GENERATOR_VERSION})`;
  }
  return null;
}

/** Classement d'un jour avec, si le joueur a un temps ce jour-là, sa place parmi les pilotes de démonstration. */
export function withMe(day: DemoDayData, limit: number, mine: { ms: number; name: string; medal: BoardRow["medal"] } | null): Leaderboard {
  if (!mine) return { date: day.date, participants: day.participants, top: day.top.slice(0, limit), me: null };
  // Égalité : le joueur passe derrière (il est arrivé après les pilotes de démonstration).
  const others = day.top.map((r) => ({ ...r }));
  const ahead = others.filter((r) => r.ms <= mine.ms).length;
  const mineRow = { rank: 0, name: mine.name, ms: mine.ms, medal: mine.medal };
  const rows = [...others.slice(0, ahead), mineRow, ...others.slice(ahead)];
  rows.forEach((r, i) => (r.rank = i + 1));
  return { date: day.date, participants: rows.length, top: rows.slice(0, limit), me: mineRow };
}

/** Rang qu'aurait `ms` parmi les pilotes de démonstration du jour (1 = devant tout le monde) et nombre de participants. */
export function rankAmong(day: Pick<DemoDayData, "top">, ms: number): { rank: number; participants: number } {
  return { rank: day.top.filter((r) => r.ms <= ms).length + 1, participants: day.top.length + 1 };
}

const fail = <T>(code: string, message: string, status = 404): ApiResult<T> => ({ ok: false, status, code, message });

/** Adresse d'un fichier du jeu de données, relative à la page (le jeu est servi à la racine comme sous `/b/<branche>/`). */
const fileUrl = (name: string) => new URL(`demo/${name}`, globalThis.document?.baseURI ?? "http://localhost/").href;

export class DemoApi implements LeaderboardSource {
  private index: Promise<ApiResult<DemoIndex>> | null = null;
  private readonly days = new Map<string, Promise<ApiResult<DemoDayData>>>();

  /** `bestOf(date)` : meilleur temps du joueur ce jour-là (stockage local), pour le placer dans le classement figé. */
  constructor(private readonly bestOf: (date: string) => { ms: number; medal: BoardRow["medal"] } | null = () => null) {}

  private async getJson<T>(name: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(fileUrl(name));
      if (!res.ok) return fail("no_demo", `Pas de données de démonstration pour ${name.replace(".json", "")}`, res.status);
      return { ok: true, data: (await res.json()) as T };
    } catch {
      return fail("network", "Données de démonstration injoignables", 0);
    }
  }

  loadIndex(): Promise<ApiResult<DemoIndex>> {
    return (this.index ??= this.getJson<DemoIndex>("index.json").then((r) => {
      if (!r.ok) return r;
      const problem = demoProblem(r.data);
      return problem ? fail<DemoIndex>("demo_stale", problem, 409) : r;
    }));
  }

  async day(date: string): Promise<ApiResult<DemoDayData>> {
    const index = await this.loadIndex();
    if (!index.ok) return index;
    let p = this.days.get(date);
    if (!p) {
      p = index.data.days.some((d) => d.date === date) ? this.getJson<DemoDayData>(`${date}.json`) : Promise.resolve(fail<DemoDayData>("no_demo", "Ce jour n'a pas de classement de démonstration"));
      this.days.set(date, p);
    }
    return p;
  }

  async submit(): Promise<ApiResult<SubmitResult>> {
    return fail("demo", "Mode démonstration : rien n'est envoyé", 0);
  }

  async rename(_playerId: string, name: string): Promise<ApiResult<{ name: string }>> {
    return { ok: true, data: { name } };
  }

  async leaderboard(date: string, _playerId: string, limit = 10): Promise<ApiResult<Leaderboard>> {
    const day = await this.day(date);
    if (!day.ok) {
      // Un jour sans données (« aujourd'hui » de la démo) : classement vide, comme un vrai jour où personne n'a joué.
      if (day.code === "no_demo") return { ok: true, data: { date, participants: 0, top: [], me: null } };
      return day;
    }
    const best = this.bestOf(date);
    return { ok: true, data: withMe(day.data, limit, best ? { ms: best.ms, medal: best.medal, name: getName() ?? "Toi" } : null) };
  }

  async ghost(date: string, kind: "first" | "ahead", _playerId?: string): Promise<ApiResult<GhostData>> {
    // Seule la rediffusion du premier est dans le jeu de données : « le joueur devant » n'existe pas en démo.
    if (kind === "ahead") return fail("no_ghost", "Pas de fantôme « devant toi » en mode démonstration");
    const day = await this.day(date);
    if (!day.ok) return day;
    return day.data.ghost ? { ok: true, data: day.data.ghost } : fail("no_ghost", "Aucun temps enregistré pour ce jour");
  }
}
