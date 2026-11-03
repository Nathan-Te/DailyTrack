import { Profile, isValidName, normalizeName, type Identity, type KeyValueStore, type ProfileApi, type RenameResult, type SyncView } from "@cdj/profile";
import type { MagasinRecords, RecordLocal } from "./records";

// Lot K4c — **la file d'envoi hors ligne d'un jeu neuf**, sans DOM (testée sous Node). Modèle : `apps/tower/src/envoi.ts`, rendue générique : le serveur est une `SourceEnvoi` (une fonction `submit`), le record
// local est celui de `records.ts`. Le record du jour part au serveur, qui le **rejoue** et garde son propre score ; le jeu affiche ce que le serveur a rejoué. **Le jeu ne bloque jamais sur le réseau** : un échec
// est un état (« hors ligne, non classé »), la partie continue, le record reste « non envoyé » dans le navigateur.
//   - Échec réseau (ou 429, 5xx, route inconnue) : nouvel essai plus tard (délai qui s'allonge, 15 s à 5 min), tout de suite au retour du réseau (`reveiller`). Autre version : « recharge la page », l'envoi est oublié.
//     Refus définitif (jour figé, copie, partie refusée par le rejeu) : oublié.
//   - Premier envoi : `name_required` arrive AVANT le rejeu ; l'envoi attend (`statut: "name"`) que le joueur choisisse un pseudo (`choisirPseudo`, suggestions si pris). L'identifiant n'est créé qu'au premier envoi.
// **À la demande** : chargée par le module d'envoi du jeu, jamais par son premier chargement.

export type ReponseSource<T> = { ok: true; data: T } | { ok: false; status: number; code?: string; suggestions?: string[] };

/** Le serveur d'un jeu neuf vu du jeu : un seul appel, un échec est une valeur (jamais une exception). */
export interface SourceEnvoi<T extends { date: string }> {
  submit(playerId: string, name: string | null, rediffusion: string): Promise<ReponseSource<T>>;
}

export type StatutEnvoi = "off" | "idle" | "sending" | "ranked" | "offline" | "version" | "name" | "revoked" | "refused";

export interface EtatEnvoi {
  statut: StatutEnvoi;
  /** Ce qui s'est passé, en **code** (celui du serveur ou un code local : `reseau`, `trop_envois`) ; le texte vient du catalogue à l'affichage. */
  code: string;
  suggestions: string[];
}

export interface DepsEnvoi<T extends { date: string }> {
  /** Le serveur, ou `null` : pas de classement, rien n'est envoyé. */
  source: SourceEnvoi<T> | null;
  identity: Identity;
  /** Le stockage de l'identité et des records, relu à chaque appel. */
  stockage: () => (Pick<Storage, "getItem" | "setItem"> & KeyValueStore) | null;
  /** Les records du jeu (`creerRecords`). */
  records: MagasinRecords;
  /** Minuterie injectée : les tests avancent l'horloge eux-mêmes. */
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  sync?: SyncView;
  /** Le client du profil commun (vérification d'un pseudo : libre ou non, suggestions) ; le client du jeu (`ProfileClient`) est ce qu'on lui donne d'ordinaire. Absent : le pseudo n'est vérifié qu'à l'envoi. */
  api?: ProfileApi | null;
  /** Un envoi vient d'être accepté (la réponse du serveur : son classement est dedans, rien à relire). */
  surAccepte?(r: T): void;
}

const SANS_SYNC: SyncView = { state: { known: null }, noteRenamed() {}, noteServerKnows() {}, reset() {} };
export const DELAI_BASE_MS = 15_000;
export const DELAI_MAX_MS = 300_000;

export class FileEnvoi<T extends { date: string }> {
  state: EtatEnvoi;
  /** La dernière réponse du serveur par jour : ce que l'écran d'arrivée affiche. */
  readonly resultats = new Map<string, T>();
  readonly profile: Profile;
  private enCours: Promise<void> | null = null;
  private minuterie: unknown = null;
  private essais = 0;
  private readonly ecouteurs = new Set<() => void>();

  constructor(private readonly deps: DepsEnvoi<T>) {
    this.state = { statut: deps.source ? "idle" : "off", code: "", suggestions: [] };
    this.profile = new Profile({ api: deps.api ?? null, demo: false, identity: deps.identity, sync: deps.sync ?? SANS_SYNC });
  }

  get actif(): boolean {
    return this.deps.source !== null;
  }

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

  private dus(): string[] {
    return this.deps.records.enAttente(this.deps.records.lire(this.deps.stockage())).slice(0, 3);
  }

  /** Le record du jour vient de changer : ce qui est dû part, sans bloquer. */
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
    if (this.state.statut !== "offline" || this.dus().length === 0) return;
    const delai = Math.min(DELAI_MAX_MS, DELAI_BASE_MS * 2 ** Math.min(this.essais, 5));
    this.minuterie = this.deps.setTimer(() => {
      this.minuterie = null;
      void this.flush();
    }, delai);
  }

  private async vider(): Promise<void> {
    const source = this.deps.source!;
    const { records } = this.deps;
    for (let date = this.dus()[0]; date !== undefined; date = this.dus()[0]) {
      const record: RecordLocal = records.lire(this.deps.stockage())[date]!;
      this.poser({ statut: "sending", code: "", suggestions: [] });
      const playerId = this.deps.identity.getPlayerId(); // créé ici, au premier envoi, s'il n'existait pas
      const r = await source.submit(playerId, this.pseudo, record.rediffusion);
      if (r.ok) {
        records.noterEnvoye(this.deps.stockage(), date, record.score);
        this.resultats.set(r.data.date, r.data);
        this.essais = 0;
        this.poser({ statut: "ranked", code: "", suggestions: [] });
        this.deps.sync?.noteServerKnows(true);
        this.deps.surAccepte?.(r.data);
        continue;
      }
      const code = r.code ?? "";
      if (r.status === 0 || r.status === 429 || r.status >= 500 || code === "not_found") {
        this.essais++;
        this.poser({ statut: "offline", code: r.status === 429 ? "trop_envois" : "reseau", suggestions: [] });
        return;
      }
      if (code === "version") {
        records.noterEnvoye(this.deps.stockage(), date, record.score); // il ne passera jamais : on ne le renvoie plus
        this.poser({ statut: "version", code: "version", suggestions: [] });
        continue;
      }
      if (code === "name_taken" || code === "name_required" || code === "invalid_name" || code === "name_forbidden") {
        this.poser({ statut: "name", code: code === "name_required" ? "" : code, suggestions: r.suggestions ?? [] });
        return;
      }
      if (code === "code_revoked") {
        this.poser({ statut: "revoked", code, suggestions: [] });
        return;
      }
      // Refus définitif (jour figé, partie refusée par le rejeu, copie…) : l'envoi ne passera jamais.
      records.noterEnvoye(this.deps.stockage(), date, record.score);
      this.poser({ statut: "refused", code, suggestions: [] });
    }
  }

  /** Le premier pseudo (ou un autre, après un refus) : le serveur dit s'il est libre, puis l'envoi en attente part avec lui. */
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
