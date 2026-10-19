import { SIM_VERSION } from "@cdj/sim";
import { DEMO_BASE, LeaderboardApi, apiBase, type ApiResult, type GhostData, type Leaderboard, type LeaderboardSource, type SubmitResult } from "./api";
import { DemoApi } from "./demo";
import { clearNextId, getName, getPlayerId, getSubmittedBest, normalizeName, setName, setPlayerId, setSubmittedBest, takeNextId } from "./identity";
import { ProfileSync } from "./profileSync";
import { listDayBests, type BestRun } from "./records";
import { gameStorage } from "./storage";

export type GhostMode = "mine" | "first" | "ahead" | "off";

/** Le message du serveur quand un pseudo est déjà à quelqu'un d'autre (repris tel quel pour les vérifications faites avant l'envoi). */
export const NAME_TAKEN_MESSAGE = "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.";

export type RenameResult = { ok: true; name: string } | { ok: false; code: string; message: string; suggestions?: string[] };
export type ChangeCodeResult = { ok: true } | { ok: false; code: string; message: string };

/** Un fantôme prêt à rejouer, avec de quoi l'étiqueter. */
export interface GhostChoice {
  mode: GhostMode;
  label: string;
  source: BestRun | null;
  /** Pseudo du joueur dont c'est la rediffusion (pour la revoir : « Rediffusion de … »). */
  name?: string;
}

/**
 * Tout ce qui parle au classement : identité, envoi du meilleur temps, classement du jour, fantômes des autres.
 * Sans adresse d'API (ou hors circuit du jour), `enabled` est faux et rien n'est jamais envoyé.
 */
export class Online {
  readonly api: LeaderboardSource | null;
  /** Mode démo (`?api=demo`) : classements figés lus dans un jeu de données statique, rien n'est envoyé. */
  readonly demo: boolean;
  /** Profil, pseudo, code : parle au serveur même hors circuit du jour (Salon). `null` sans serveur ; en démonstration, un faux qui refuse tout. */
  readonly profileApi: LeaderboardSource | null;
  /** Synchronisation du profil (lot 30) : le serveur fait foi, le stockage du navigateur n'est qu'un cache. */
  readonly sync: ProfileSync;

  /** Identifiant secret du joueur : lu à chaque fois (il change avec « Changer mon code » ou un code chargé). */
  get playerId(): string {
    return getPlayerId();
  }

  constructor(
    readonly trackId: string | null,
    /** Date « AAAA-MM-JJ » du circuit du jour ; `null` pour les circuits d'essai, qui n'ont pas de classement. */
    readonly date: string | null,
    base = apiBase(),
  ) {
    this.demo = base === DEMO_BASE;
    this.api = base && date && trackId ? (this.demo ? new DemoApi((d) => listDayBests().get(d) ?? null) : new LeaderboardApi(base)) : null;
    this.profileApi = this.api ?? (base && !this.demo ? new LeaderboardApi(base) : null);
    // Rien à synchroniser en démonstration (lecture seule) ni sans serveur.
    this.sync = new ProfileSync({ api: () => (this.demo ? null : this.profileApi), playerId: () => this.playerId, adopt: setPlayerId, storage: gameStorage() });
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
    if (r.ok) {
      setSubmittedBest(this.trackId, r.data.bestMs);
      this.sync.noteServerKnows();
    }
    return r;
  }

  /**
   * Choisit un pseudo (lot 30 : un pseudo appartient à son premier propriétaire). Le serveur dit s'il est libre :
   *   - joueur déjà classé : le serveur le change (et les autres appareils le voient à leur prochaine synchronisation) ;
   *   - pas encore classé, ou `viaSubmit` (le pseudo part avec la course qu'on s'apprête à envoyer) : le serveur vérifie seulement qu'il est libre ;
   *   - sans réseau : retenu en local, vérifié à l'envoi (jamais pour un joueur que le serveur connaît : son pseudo ne change pas hors ligne).
   */
  async rename(raw: string, options: { viaSubmit?: boolean } = {}): Promise<RenameResult> {
    const name = normalizeName(raw);
    const api = this.profileApi;
    if (!api || this.demo) {
      setName(name);
      return { ok: true, name };
    }
    const keep = (): RenameResult => {
      setName(name);
      return { ok: true, name };
    };
    const check = async (): Promise<RenameResult> => {
      const c = await api.checkName(name, this.playerId);
      if (c.ok) return c.data.available ? keep() : { ok: false, code: "name_taken", message: NAME_TAKEN_MESSAGE, suggestions: c.data.suggestions };
      return c.status === 0 ? keep() : { ok: false, code: c.code, message: c.message };
    };
    if (options.viaSubmit || this.sync.state.known === false) return check();
    const r = await api.rename(this.playerId, name);
    if (r.ok) {
      setName(r.data.name);
      this.sync.noteRenamed();
      return { ok: true, name: r.data.name };
    }
    if (r.code === "unknown_player") {
      this.sync.noteServerKnows(false);
      return check();
    }
    if (r.status === 0) {
      return this.sync.state.known === true ? { ok: false, code: r.code, message: "Hors ligne : ton pseudo ne peut pas changer sans le serveur. Réessaie en ligne." } : keep();
    }
    return { ok: false, code: r.code, message: r.message, ...(r.suggestions ? { suggestions: r.suggestions } : {}) };
  }

  /**
   * « Changer mon code » : le serveur associe le profil à un nouvel identifiant secret, l'ancien devient inutilisable. Le nouvel identifiant est tiré ici et
   * gardé jusqu'à la réponse : si elle se perd, la même demande rejouée réussit. Un profil que le serveur ne connaît pas encore reçoit simplement un
   * nouvel identifiant local.
   */
  async changeCode(): Promise<ChangeCodeResult> {
    const api = this.profileApi;
    if (!api || this.demo) return { ok: false, code: "disabled", message: "Pas de serveur ici : le code ne peut pas être changé." };
    const next = takeNextId();
    const r = await api.rotateCode(this.playerId, next);
    if (r.ok || r.code === "unknown_player") {
      setPlayerId(next);
      clearNextId();
      this.sync.reset();
      return { ok: true };
    }
    if (r.code === "code_revoked") clearNextId();
    return { ok: false, code: r.code, message: r.status === 0 ? "Impossible de joindre le serveur : réessaie dans un moment." : r.message };
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
  return { mode: kind, label: who, name: g.name, source: { ms: g.ms, splits: g.splits, replay: g.replay, simVersion: g.simVersion } };
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
