import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, TrajectoireError, decoderTrajectoire, echantillonnerTrajectoire, encoderTrajectoire, trajectoireDuree, type JumpReplay, type Level, type Trajectoire } from "@cdj/jump-sim";
import type { ApiResult } from "@cdj/profile";
import type { RankSource } from "./rankApi";

// Le fantôme Diamant de Jump (lot G1 de la plateforme), **logique seule** (testée sous Node, avec une fausse source) : ce que le serveur rend
// (`GET /api/jump/fantome-diamant?date=`), sa validation à la lecture, et son chargement.
//
//   - **Une trajectoire, jamais des entrées** : le serveur rejoue la preuve de l'auteur et ne rend que des positions échantillonnées (30 par seconde) ; le jeu
//     l'affiche en l'interpolant (`trajectoirePose`, `@cdj/jump-sim`) et ne la simule pas : un fantôme à trajectoire ne touche jamais la simulation du joueur.
//   - **Déblocage** : un jour passé (archive) est libre ; le jour même, le serveur refuse (403 `ghost_locked`) tant que le joueur n'a pas un résultat classé
//     — le jeu n'essaie donc qu'avec une identité, et retente après chaque envoi accepté. Un refus ou une panne n'est jamais une erreur affichée : « verrouillé »
//     ou « indisponible », et le jeu continue.
//   - **Calculé dans la page quand elle a la preuve** (le niveau du jour qu'elle a généré elle-même : rien de plus que ce qu'un visiteur calcule déjà) : débloqué
//     dès l'arrivée **locale** du jour (pas besoin d'un résultat classé, ni d'un pseudo) ; sinon (niveau figé publié sans preuve, archive), la lecture du serveur.
//   - **Jamais pour** une démonstration, un essai de thème forcé, un morceau, un scénario ou un jour à venir (même règle que le fantôme du premier : `date` nulle).

/** La couleur du fantôme Diamant : un vert menthe vif (teinte ≈ 114°). Le tien est cyan clair (196°), le premier mauve (292°), le personnage jaune, les dangers rouges : celui-ci en est à ≥ 60° et se lit sur tous les ciels (`test/fantomes.test.ts`). La pastille du Diamant dans l'interface reste `--dj-diamant` (la médaille). */
export const DIAMOND_GHOST_COLOR = 0x8dff80;

/** Ce que rend `GET /api/jump/fantome-diamant`. */
export interface DiamondData {
  date: string;
  levelId: string;
  /** Le temps du Diamant (le seuil de la médaille : le temps de l'auteur jusqu'à la bascule du lot G1, 105 % après), en pas. */
  ticks: number;
  simVersion: number;
  generatorVersion: number;
  /** Les positions échantillonnées (base64url, `decoderTrajectoire`). */
  trajectoire: string;
}

/** Un fantôme Diamant accepté. */
export interface Diamond {
  traj: Trajectoire;
  /** Le temps du Diamant, en pas (ce que dure la trajectoire à un échantillon près). */
  ticks: number;
}

/** Vérifie une réponse du serveur (rien n'est pris sur parole) : forme, niveau, versions, trajectoire lisible et de la durée annoncée. */
export function checkDiamond(data: unknown, levelId: string): { ok: true; diamond: Diamond } | { ok: false; reason: string } {
  if (typeof data !== "object" || data === null) return { ok: false, reason: "réponse illisible" };
  const d = data as Partial<DiamondData>;
  if (typeof d.trajectoire !== "string" || typeof d.ticks !== "number" || !Number.isFinite(d.ticks)) return { ok: false, reason: "réponse incomplète" };
  // Un serveur plus récent que le jeu est « une autre version » ; la trajectoire d'un autre niveau n'est pas la nôtre.
  if (typeof d.simVersion !== "number" || typeof d.generatorVersion !== "number" || d.simVersion > JUMP_SIM_VERSION || d.generatorVersion > JUMP_GENERATOR_VERSION) return { ok: false, reason: "autre version du jeu" };
  if (d.levelId !== levelId) return { ok: false, reason: "autre niveau" };
  let traj: Trajectoire;
  try {
    traj = decoderTrajectoire(d.trajectoire);
  } catch (e) {
    return { ok: false, reason: e instanceof TrajectoireError ? e.message : "trajectoire illisible" };
  }
  // La trajectoire dure le temps du Diamant (à un échantillon près) : sinon ce n'est pas la sienne.
  if (Math.abs(trajectoireDuree(traj) - d.ticks) > traj.pas) return { ok: false, reason: "trajectoire d'une autre durée" };
  return { ok: true, diamond: { traj, ticks: d.ticks } };
}

/** `off` : rien à lire ici ; `locked` : le niveau du jour n'est pas fini ; `loading` ; `ready` ; `missing` : indisponible (réseau, autre version…). */
export type DiamondStatus = "off" | "locked" | "loading" | "ready" | "missing";

export interface DiamondOptions {
  /** `null` : pas de serveur (ou démonstration : sa source n'a pas `diamond`). */
  source: RankSource | { diamond?: RankSource["diamond"] } | null;
  /** La date du niveau (jour ou archive), `null` : jamais (essai, morceau, scénario, jour à venir). */
  date: string | null;
  levelId: string;
  /** Un jour passé : libre, sans identité. */
  free: boolean;
  /** L'identifiant secret de la plateforme s'il existe (jamais créé ici). */
  playerId(): string | null;
  /** Lot G1 : le niveau, la preuve de l'auteur et le temps du Diamant quand la page les a (niveau généré par elle) ; `null` : seul le serveur peut le rendre. */
  local?(): { level: Level; replay: JumpReplay; ticks: number } | null;
  /** Lot G1 : le niveau du jour est fini sur cet appareil (une arrivée enregistrée) : débloque le Diamant calculé dans la page. */
  finished?(): boolean;
}

/** Le Diamant calculé dans la page : la trajectoire de la preuve, étirée jusqu'au temps du Diamant (comme le serveur), ou `null` si elle ne se lit pas. */
export function diamondLocal(level: Level, replay: JumpReplay, ticks: number): Diamond | null {
  try {
    const traj = decoderTrajectoire(encoderTrajectoire(echantillonnerTrajectoire(level, replay, ticks)));
    return Math.abs(trajectoireDuree(traj) - ticks) > traj.pas ? null : { traj, ticks };
  } catch {
    return null;
  }
}

/** Le chargement du Diamant d'un niveau : une lecture à la fois, gardée en mémoire dès qu'elle a réussi ; un refus ou une panne se retente à l'appel suivant. */
export class DiamondReader {
  status: DiamondStatus;
  diamond: Diamond | null = null;
  /** Pourquoi il n'y en a pas (« ghost_locked », « no_player », « network », « autre version du jeu »… : `__jump.diamond`). */
  miss = "";
  private pending: Promise<DiamondStatus> | null = null;

  constructor(private readonly o: DiamondOptions) {
    const usable = o.date !== null && (!!o.source?.diamond || !!o.local?.());
    this.status = usable ? "locked" : "off";
    this.miss = usable ? "" : "aucun serveur";
  }

  /** Outils d'essai (`__jump.diamond.inject`, jamais en production) : pose un Diamant sans serveur. */
  inject(d: Diamond): void {
    this.diamond = d;
    this.status = "ready";
    this.miss = "";
  }

  get date(): string | null {
    return this.o.date;
  }

  /** Lit le Diamant (rien de plus s'il est déjà là ou s'il n'y a rien à lire). */
  load(): Promise<DiamondStatus> {
    if (this.status === "off" || this.status === "ready") return Promise.resolve(this.status);
    this.pending ??= this.read().finally(() => (this.pending = null));
    return this.pending;
  }

  private async read(): Promise<DiamondStatus> {
    const { source, date, levelId, free } = this.o;
    // Lot G1 : la page a la preuve (niveau généré par elle) : le Diamant se calcule ici, débloqué par l'arrivée locale (ou libre pour un jour passé).
    const loc = this.o.local?.() ?? null;
    if (loc) {
      if (!free && !this.o.finished?.()) {
        this.miss = "pas fini";
        return (this.status = "locked");
      }
      const d = diamondLocal(loc.level, loc.replay, loc.ticks);
      if (d) {
        this.diamond = d;
        this.miss = "";
        return (this.status = "ready");
      }
    }
    if (!source?.diamond) {
      this.miss = "aucun serveur";
      return (this.status = "missing");
    }
    const id = this.o.playerId();
    // Le jour même, sans identité, le serveur ne peut que refuser : aucune requête.
    if (!free && id === null) {
      this.miss = "no_player";
      return (this.status = "locked");
    }
    this.status = "loading";
    const r = await source!.diamond!(date!, id);
    if (!r.ok) {
      this.miss = r.code;
      return (this.status = r.code === "ghost_locked" ? "locked" : "missing");
    }
    const c = checkDiamond(r.data, levelId);
    if (!c.ok) {
      this.miss = c.reason;
      return (this.status = "missing");
    }
    this.diamond = c.diamond;
    this.miss = "";
    return (this.status = "ready");
  }
}
