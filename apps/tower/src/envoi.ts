import { Profile, isValidName, normalizeName, type Identity, type KeyValueStore, type RenameResult, type SyncView } from "@cdj/profile";
import type { EnvoiTower, SourceTower } from "./apiTower";
import { enAttente, lireRecords, noterEnvoye, type Records } from "./records";

// L'envoi des parties au classement du jour (lot T4), **sans DOM** (testé sous Node) : le record du jour (`records.ts`) part au serveur, qui le **rejoue** et garde sa propre hauteur ; le jeu
// affiche ce que le serveur a rejoué (rang, médaille, « nouveau record »). Le jeu ne bloque **jamais** sur une requête : tout est asynchrone, un échec est un état (« hors ligne, non classé »),
// et la partie continue.
//
//   - `offrir()` : le record vient de changer ; ce qui n'a pas été envoyé part tout de suite (`flush`). Le jeu décide de ce qui peut être offert (`peutClasser`, jamais un scénario d'essai,
//     une lecture du bot, un jour qui n'est pas celui d'aujourd'hui, des réglages de sensation modifiés).
//   - Échec réseau (ou serveur qui ne répond pas, trop de requêtes, route inconnue) : le record reste « non envoyé » dans le navigateur, nouvel essai plus tard (délai qui s'allonge) et tout
//     de suite au retour du réseau (`reveiller`). Autre version : « Une nouvelle version du jeu est disponible » (`version`), l'envoi est oublié. Refus définitif (jour figé, partie refusée) : oublié.
//   - **Premier envoi et pseudo** (par `@cdj/profile`) : l'envoi part sans pseudo ; un serveur qui ne connaît pas le joueur répond `name_required` AVANT le rejeu (vérification bon marché) et l'envoi
//     attend (`statut: "name"`) ; le joueur en choisit un (`choisirPseudo` : le serveur dit s'il est libre, suggestions sinon), puis l'envoi part avec lui. Hors ligne on n'a rien à demander :
//     « hors ligne, non classé ». L'identité de la plateforme déjà créée par un autre jeu dans ce navigateur est réutilisée telle quelle ; l'identifiant n'est **créé qu'au premier envoi**
//     (jamais à la lecture d'un classement).

/** Un jour accepte-t-il encore des envois ? Seulement aujourd'hui (et hier pendant la grâce de 10 minutes, que le serveur applique : un refus `day_closed` oublie l'envoi). */
export function peutClasser(o: { scenario: string; jour: number; aujourdhui: number; bot: boolean; reglagesModifies: boolean; tireForce: boolean }): boolean {
  return o.scenario === "jour" && o.jour === o.aujourdhui && !o.bot && !o.reglagesModifies && !o.tireForce;
}

export type StatutEnvoi = "off" | "idle" | "sending" | "ranked" | "offline" | "version" | "name" | "revoked" | "refused";

export interface EtatEnvoi {
  statut: StatutEnvoi;
  /** Ce qui s'est passé, en **code** (celui du serveur — `name_taken`, `day_closed`… — ou un code local : `reseau`, `trop_envois`) ; le texte vient du catalogue à l'affichage. */
  code: string;
  /** Pseudo refusé : des pseudos libres à toucher. */
  suggestions: string[];
}

export interface DepsEnvoi {
  /** Le serveur, ou `null` : pas de classement, rien n'est envoyé. */
  source: SourceTower | null;
  identity: Identity;
  /** Le stockage de l'identité et des records (`gameStorage`), relu à chaque appel. */
  stockage: () => (Pick<Storage, "getItem" | "setItem"> & KeyValueStore) | null;
  /** La date de Paris d'aujourd'hui (AAAA-MM-JJ). */
  aujourdhui(): string;
  /** Minuterie et horloge injectées : les tests avancent l'horloge eux-mêmes. */
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Le profil Tower (ce que le pseudo demande de la synchronisation) ; sans lui, le pseudo ne passe que par la vérification « libre ou non ». */
  sync?: SyncView;
  /** Un envoi vient d'être accepté (la réponse du serveur : son classement est dedans, rien à relire). */
  surAccepte?(r: EnvoiTower): void;
}

const SANS_SYNC: SyncView = { state: { known: null }, noteRenamed() {}, noteServerKnows() {}, reset() {} };
const DELAI_BASE_MS = 15_000;
const DELAI_MAX_MS = 300_000;

export class Envoi {
  state: EtatEnvoi;
  /** La dernière réponse du serveur par jour : ce que l'écran d'arrivée affiche. */
  readonly resultats = new Map<string, EnvoiTower>();
  readonly profile: Profile;
  private enCours: Promise<void> | null = null;
  private minuterie: unknown = null;
  private essais = 0;
  private readonly ecouteurs = new Set<() => void>();

  constructor(private readonly deps: DepsEnvoi) {
    this.state = { statut: deps.source ? "idle" : "off", code: "", suggestions: [] };
    this.profile = new Profile({ api: deps.source, demo: false, identity: deps.identity, sync: deps.sync ?? SANS_SYNC });
  }

  get actif(): boolean {
    return this.deps.source !== null;
  }

  /** Le pseudo de la plateforme (celui d'un autre jeu s'il existe), sans rien créer. */
  get pseudo(): string | null {
    return this.deps.identity.getName();
  }

  surChangement(ecouteur: () => void): () => void {
    this.ecouteurs.add(ecouteur);
    return () => this.ecouteurs.delete(ecouteur);
  }

  private poser(suivant: Partial<EtatEnvoi>): void {
    this.state = { ...this.state, ...suivant };
    for (const e of this.ecouteurs) e();
  }

  private records(): Records {
    return lireRecords(this.deps.stockage());
  }

  /** Des records attendent d'être envoyés (les trois jours les plus récents au plus). */
  private dus(): string[] {
    return enAttente(this.records()).slice(0, 3);
  }

  /** Le record du jour vient de changer (ou on se réveille) : ce qui est dû part, sans bloquer. */
  offrir(): void {
    if (this.actif && this.dus().length > 0) void this.flush();
  }

  /** Le réseau est revenu, ou la page redevient visible : ce qui attend repart tout de suite. */
  reveiller(): void {
    if (!this.actif || this.dus().length === 0 || this.state.statut === "name" || this.state.statut === "revoked") return;
    this.essais = 0;
    void this.flush();
  }

  flush(): Promise<void> {
    if (!this.actif) return Promise.resolve();
    if (this.enCours) return this.enCours;
    this.enCours = this.vider().finally(() => {
      this.enCours = null;
      this.programmer();
    });
    return this.enCours;
  }

  private programmer(): void {
    if (this.minuterie !== null) this.deps.clearTimer(this.minuterie);
    this.minuterie = null;
    const s = this.state.statut;
    if (s !== "offline" || this.dus().length === 0) return;
    const delai = Math.min(DELAI_MAX_MS, DELAI_BASE_MS * 2 ** Math.min(this.essais, 5));
    this.minuterie = this.deps.setTimer(() => {
      this.minuterie = null;
      void this.flush();
    }, delai);
  }

  private async vider(): Promise<void> {
    const source = this.deps.source!;
    for (let date = this.dus()[0]; date !== undefined; date = this.dus()[0]) {
      const record = this.records()[date]!;
      const nom = this.pseudo;
      this.poser({ statut: "sending", code: "", suggestions: [] });
      const playerId = this.deps.identity.getPlayerId(); // créé ici, au premier envoi, s'il n'existait pas
      const r = await source.submit(playerId, nom, record.rediffusion);
      if (r.ok) {
        const d = r.data;
        noterEnvoye(this.deps.stockage(), date, record);
        this.resultats.set(d.date, d);
        this.essais = 0;
        this.poser({ statut: "ranked", code: "", suggestions: [] });
        this.deps.sync?.noteServerKnows(true);
        this.deps.surAccepte?.(d);
        continue;
      }
      if (r.status === 0 || r.status === 429 || r.status >= 500 || r.code === "not_found") {
        this.essais++;
        this.poser({ statut: "offline", code: r.status === 429 ? "trop_envois" : "reseau", suggestions: [] });
        return;
      }
      if (r.code === "version") {
        noterEnvoye(this.deps.stockage(), date, record); // il ne passera jamais : on ne le renvoie plus
        this.poser({ statut: "version", code: "version", suggestions: [] });
        continue;
      }
      if (r.code === "name_taken" || r.code === "name_required" || r.code === "invalid_name" || r.code === "name_forbidden") {
        this.poser({ statut: "name", code: r.code === "name_required" ? "" : r.code, suggestions: r.suggestions ?? [] });
        return;
      }
      if (r.code === "code_revoked") {
        this.poser({ statut: "revoked", code: "code_revoked", suggestions: [] });
        return;
      }
      // Refus définitif (jour figé, partie refusée par le rejeu, copie…) : l'envoi ne passera jamais.
      noterEnvoye(this.deps.stockage(), date, record);
      this.poser({ statut: "refused", code: r.code, suggestions: [] });
    }
  }

  /** Le premier pseudo (ou un autre, après un refus) : le serveur dit s'il est libre, puis l'envoi en attente part avec lui. Hors ligne, le pseudo est gardé et vérifié à l'envoi. */
  async choisirPseudo(brut: string): Promise<RenameResult> {
    const nom = normalizeName(brut);
    if (!isValidName(nom)) {
      this.poser({ statut: "name", code: "invalid_name", suggestions: [] });
      return { ok: false, code: "invalid_name", message: "" };
    }
    const r = await this.profile.rename(nom, { viaSubmit: true });
    if (!r.ok) {
      this.poser({ statut: "name", code: r.code, suggestions: r.suggestions ?? [] });
      return r;
    }
    this.poser({ statut: "idle", code: "", suggestions: [] });
    await this.flush();
    return r;
  }
}
