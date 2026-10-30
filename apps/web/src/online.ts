import { SIM_VERSION } from "@cdj/sim";
import { DEMO_BASE, LeaderboardApi, apiBase, type ApiResult, type GhostData, type Leaderboard, type LeaderboardSource, type SubmitResult } from "./api";
import { DemoApi } from "./demo";
import { Profile, type ChangeCodeResult, type RenameResult } from "@cdj/profile";
import { getName, getPlayerId, getSubmittedBest, identity, setPlayerId, setSubmittedBest } from "./identity";
import { ProfileSync } from "./profileSync";
import { listDayBests, type BestRun } from "./records";
import { gameStorage } from "./storage";
import { lireChoix, noterDeblocages } from "./voiture/choix";

export type GhostMode = "mine" | "first" | "ahead" | "selection" | "off";

// Lot P0 (plateforme) : le pseudo (propriété du premier, suggestions) et « Changer mon code » sont ceux du module de profil commun.
export { NAME_TAKEN_MESSAGE, type ChangeCodeResult, type RenameResult } from "@cdj/profile";

/** Un fantôme prêt à rejouer, avec de quoi l'étiqueter. */
export interface GhostChoice {
  mode: GhostMode;
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
  /** Pseudo et code (`@cdj/profile`), sur l'identité et l'API du profil de ce jeu. */
  private readonly profile: Profile<ProfileSync>;

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
    this.profile = new Profile({ api: this.profileApi, demo: this.demo, identity, sync: this.sync });
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
    const r = await this.api.submit(this.playerId, name, this.date, best.replay, best.voiture); // lot 51 : la voiture de ce record, pas celle d'aujourd'hui
    if (r.ok) {
      setSubmittedBest(this.trackId, r.data.bestMs);
      this.sync.noteServerKnows();
      if (r.data.garage) noterDeblocages(r.data.garage.voitures.filter((v) => v.debloquee).map((v) => v.id)); // lot 41 : le Garage arrive avec la réponse de l'envoi
      void import("./voiture/synchro").then((m) => m.envoyerChoix(this.profileApi, this.playerId)).catch(() => undefined); // lot 51 : le joueur est connu du serveur : son choix de voiture, fait avant, part
    }
    return r;
  }

  /**
   * Choisit un pseudo (lot 30 : un pseudo appartient à son premier propriétaire) : voir `Profile.rename` (`@cdj/profile`). Joueur classé : le
   * serveur le change ; pas encore classé ou `viaSubmit` : vérifié seulement ; sans réseau : local (jamais pour un joueur que le serveur connaît).
   */
  rename(raw: string, options: { viaSubmit?: boolean } = {}): Promise<RenameResult> {
    return this.profile.rename(raw, options);
  }

  /** « Changer mon code » : voir `Profile.changeCode` (`@cdj/profile`) ; l'ancien identifiant devient inutilisable. */
  changeCode(): Promise<ChangeCodeResult> {
    return this.profile.changeCode();
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
  // Lot 51 : la voiture de sa course (illisible ou absente : la Sparrow en orange, côté affichage).
  const voiture = lireChoix(g.voiture);
  return { mode: kind, name: g.name, source: { ms: g.ms, splits: g.splits, replay: g.replay, simVersion: g.simVersion, ...(voiture ? { voiture } : {}) } };
}

