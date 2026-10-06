import { SIM_VERSION } from "@cdj/sim";
import { LeaderboardApi, apiBase, type ApiResult, type GhostData, type Leaderboard, type SubmitResult } from "./api";
import { getName, getPlayerId, getSubmittedBest, normalizeName, setName, setSubmittedBest } from "./identity";
import type { BestRun } from "./records";

export type GhostMode = "mine" | "first" | "ahead" | "off";

/** Un fantôme prêt à rejouer, avec de quoi l'étiqueter. */
export interface GhostChoice {
  mode: GhostMode;
  label: string;
  source: BestRun | null;
}

/**
 * Tout ce qui parle au classement : identité, envoi du meilleur temps, classement du jour, fantômes des autres.
 * Sans adresse d'API (ou hors circuit du jour), `enabled` est faux et rien n'est jamais envoyé.
 */
export class Online {
  readonly api: LeaderboardApi | null;
  readonly playerId = getPlayerId();

  constructor(
    readonly trackId: string | null,
    /** Date « AAAA-MM-JJ » du circuit du jour ; `null` pour les circuits d'essai, qui n'ont pas de classement. */
    readonly date: string | null,
    base = apiBase(),
  ) {
    this.api = base && date && trackId ? new LeaderboardApi(base) : null;
  }

  get enabled(): boolean {
    return this.api !== null;
  }

  get name(): string | null {
    return getName();
  }

  /** Le meilleur temps local est-il déjà classé sur le serveur ? */
  needsSubmit(best: BestRun | null): boolean {
    if (!best?.replay || !this.trackId) return false;
    return (getSubmittedBest(this.trackId) ?? Infinity) > best.ms;
  }

  /** Envoie le meilleur temps (sa rediffusion) ; le serveur le rejoue et répond avec SON temps et le rang. */
  async submit(best: BestRun, name: string): Promise<ApiResult<SubmitResult>> {
    if (!this.api || !this.date || !this.trackId || !best.replay) return { ok: false, status: 0, code: "disabled", message: "Classement désactivé" };
    const r = await this.api.submit(this.playerId, name, this.date, best.replay);
    if (r.ok) setSubmittedBest(this.trackId, r.data.bestMs);
    return r;
  }

  /**
   * Retient le pseudo en local ; avec `server`, le change aussi sur le serveur (réservé aux joueurs déjà classés :
   * pour les autres, le pseudo part avec leur première course). Renvoie le pseudo retenu.
   */
  async rename(raw: string, server = false): Promise<string> {
    const name = normalizeName(raw);
    setName(name);
    if (server && this.api) await this.api.rename(this.playerId, name);
    return name;
  }

  leaderboard(limit = 10): Promise<ApiResult<Leaderboard>> {
    if (!this.api || !this.date) return Promise.resolve({ ok: false, status: 0, code: "disabled", message: "Classement désactivé" });
    return this.api.leaderboard(this.date, this.playerId, limit);
  }

  /** Fantôme du premier ou du joueur juste devant ; `null` s'il n'y en a pas (ou version de simulation différente). */
  async remoteGhost(kind: "first" | "ahead"): Promise<GhostChoice | null> {
    if (!this.api || !this.date) return null;
    const r = await this.api.ghost(this.date, kind, this.playerId);
    if (!r.ok || r.data.simVersion !== SIM_VERSION) return null;
    return ghostChoice(kind, r.data);
  }
}

function ghostChoice(kind: "first" | "ahead", g: GhostData): GhostChoice {
  const who = kind === "first" ? `premier : ${g.name}` : `devant toi : ${g.name}`;
  return { mode: kind, label: who, source: { ms: g.ms, splits: g.splits, replay: g.replay, simVersion: g.simVersion } };
}

/** Modes de fantôme proposés, dans l'ordre où `G` les parcourt. */
export function ghostModes(hasMine: boolean, online: boolean): GhostMode[] {
  const modes: GhostMode[] = [];
  if (hasMine) modes.push("mine");
  if (online) modes.push("first", "ahead");
  modes.push("off");
  return modes;
}

/** Mode suivant, en bouclant. */
export function nextGhostMode(current: GhostMode, modes: GhostMode[]): GhostMode {
  const i = modes.indexOf(current);
  return modes[(i + 1) % modes.length]!;
}
