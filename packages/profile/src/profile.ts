import type { ProfileApi } from "./client";
import { normalizeName, type Identity } from "./identity";
import type { ProfileSync } from "./sync";

// Le pseudo et le code d'un joueur de la plateforme (lot 30 de DailyTrack : `Online.rename` et `Online.changeCode`, extraits au lot P0 sans
// changement). Un pseudo appartient à son premier propriétaire, sur toute la base et pour tous les jeux : le serveur dit s'il est libre et
// propose des pseudos libres quand il est pris (`suggestions`).

/** Le message du serveur quand un pseudo est déjà à quelqu'un d'autre (repris tel quel pour les vérifications faites avant l'envoi). */
export const NAME_TAKEN_MESSAGE = "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.";

export type RenameResult = { ok: true; name: string } | { ok: false; code: string; message: string; suggestions?: string[] };
export type ChangeCodeResult = { ok: true } | { ok: false; code: string; message: string };

/** Ce que le pseudo et le code demandent de la synchronisation (ce que le serveur sait de ce profil). */
export type SyncView = Pick<ProfileSync<unknown>, "state" | "noteRenamed" | "noteServerKnows" | "reset">;

export interface ProfileDeps<S extends SyncView> {
  /** L'API du profil, ou `null` sans serveur. */
  api: ProfileApi | null;
  /** Démonstration (lecture seule) : rien n'est envoyé, le pseudo reste local. */
  demo: boolean;
  identity: Identity;
  sync: S;
}

export class Profile<S extends SyncView = SyncView> {
  readonly sync: S;

  constructor(private readonly deps: ProfileDeps<S>) {
    this.sync = deps.sync;
  }

  /** Identifiant secret du joueur : lu à chaque fois (il change avec « Changer mon code » ou un code chargé). */
  get playerId(): string {
    return this.deps.identity.getPlayerId();
  }

  get name(): string | null {
    return this.deps.identity.getName();
  }

  /**
   * Choisit un pseudo. Le serveur dit s'il est libre :
   *   - joueur déjà classé : le serveur le change (et les autres appareils le voient à leur prochaine synchronisation) ;
   *   - pas encore classé, ou `viaSubmit` (le pseudo part avec la course qu'on s'apprête à envoyer) : le serveur vérifie seulement qu'il est libre ;
   *   - sans réseau : retenu en local, vérifié à l'envoi (jamais pour un joueur que le serveur connaît : son pseudo ne change pas hors ligne).
   */
  async rename(raw: string, options: { viaSubmit?: boolean } = {}): Promise<RenameResult> {
    const { identity } = this.deps;
    const name = normalizeName(raw);
    const api = this.deps.api;
    if (!api || this.deps.demo) {
      identity.setName(name);
      return { ok: true, name };
    }
    const keep = (): RenameResult => {
      identity.setName(name);
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
      identity.setName(r.data.name);
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
   * « Changer mon code » : le serveur associe le profil à un nouvel identifiant secret, l'ancien devient inutilisable (révoqué). Le nouvel
   * identifiant est tiré ici et gardé jusqu'à la réponse : si elle se perd, la même demande rejouée réussit. Un profil que le serveur ne connaît
   * pas encore reçoit simplement un nouvel identifiant local.
   */
  async changeCode(): Promise<ChangeCodeResult> {
    const { identity } = this.deps;
    const api = this.deps.api;
    if (!api || this.deps.demo) return { ok: false, code: "disabled", message: "Pas de serveur ici : le code ne peut pas être changé." };
    const next = identity.takeNextId();
    const r = await api.rotateCode(this.playerId, next);
    if (r.ok || r.code === "unknown_player") {
      identity.setPlayerId(next);
      identity.clearNextId();
      this.sync.reset();
      return { ok: true };
    }
    if (r.code === "code_revoked") identity.clearNextId();
    return { ok: false, code: r.code, message: r.status === 0 ? "Impossible de joindre le serveur : réessaie dans un moment." : r.message };
  }
}
