import { SIM_VERSION } from "@cdj/sim";
import { ProfileSync as PlatformSync, mergeName, type SyncDeps as PlatformSyncDeps, type SyncOutcome as PlatformOutcome } from "@cdj/profile";
import type { LeaderboardSource, MeProfile, MeTrack } from "./api";
import { clearNextId, pendingNextId } from "./identity";
import { rememberRank } from "./profile";
import type { BestRun } from "./records";
import { lireChoix } from "./voiture/choix";

// Synchronisation du profil (lot 30) : le serveur fait foi, le stockage du navigateur n'est qu'un cache.
//
//   - au lancement et au retour sur l'accueil, le jeu demande son profil au serveur (`GET /api/me`) et le fusionne avec le cache local ;
//   - fusion : le meilleur temps gagne. Un temps du serveur meilleur que le local le remplace (avec sa rediffusion : le fantôme « ton record » suit),
//     un record local meilleur que celui du serveur (fait hors ligne, jamais envoyé) reste, et le jeu l'envoie au serveur, qui le rejoue ;
//   - le pseudo du serveur remplace le pseudo local ; une place vue plus haute que celles du cache est retenue ;
//   - hors ligne, le cache local sert et le jeu le dit discrètement ; un code révoqué (« Changer mon code » fait ailleurs) est signalé.
// La fusion (`mergeProfile`) est pure : le stockage est injecté, elle se teste sans navigateur.
// Lot P0 (plateforme) : le service (`ProfileSync`) et la fusion du pseudo sont ceux du module de profil commun (`@cdj/profile`) ; restent ici
// la fusion des records de DailyTrack et le branchement du service sur l'identité du jeu.

type Store = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

const BEST = "cdj:best:";
const SUB = "cdj:sub:";
const DAY_TRACK = /^jour-\d{4}-\d{2}-\d{2}-g\d{1,3}(-v\d{1,2})?(-[a-z]{3,12})?$/;

export interface MergeResult {
  /** Le pseudo local a changé (changé sur un autre appareil, ou renommé par la migration). */
  nameChanged: boolean;
  /** Le record d'aujourd'hui est maintenant celui du serveur (meilleur que le local, ou le local n'avait pas sa rediffusion). */
  todayChanged: boolean;
  /** Jours passés écrits ou améliorés (médailles des archives). */
  pastChanged: number;
  /** Lot 51 : le choix de voiture gardé par le serveur (`null` : jamais enregistré ; `undefined` : un serveur plus ancien n'en parle pas). Recalé ensuite par `voiture/synchro.ts` (à la demande). */
  garage?: unknown;
}

function readRecord(storage: Store, trackId: string): BestRun | null {
  try {
    const r = JSON.parse(storage.getItem(BEST + trackId) ?? "null") as BestRun | null;
    return r && typeof r.ms === "number" && Number.isFinite(r.ms) ? r : null;
  } catch {
    return null;
  }
}

/**
 * Fusionne le profil du serveur dans le cache local. Écrit seulement ce qui est meilleur côté serveur ; ne supprime jamais un record local (un temps
 * fait hors ligne attend d'être envoyé). `cdj:sub:<circuit>` (« meilleur temps confirmé par le serveur ») prend la valeur du serveur : tant qu'un record local
 * lui est meilleur, `needsSubmit` reste vrai et le jeu l'envoie.
 */
export function mergeProfile(profil: MeProfile, storage: Store): MergeResult {
  const me = profil as MeTrack;
  const result: MergeResult = { nameChanged: mergeName(me, storage), todayChanged: false, pastChanged: 0, garage: me.garage };

  const t = me.best;
  if (t && t.trackId && DAY_TRACK.test(t.trackId) && Number.isFinite(t.ms) && t.ms > 0) {
    try {
      const local = readRecord(storage, t.trackId);
      const usable = t.replay !== undefined && t.simVersion === SIM_VERSION;
      const better = !local || t.ms < local.ms || (t.ms === local.ms && !local.replay && usable);
      // Lot 51 : la voiture de ce record (celle de sa course, pas celle d'aujourd'hui) vient avec lui ; un record local de même temps qui ne la connaît pas l'apprend.
      const voiture = lireChoix(t.voiture);
      if (better && (usable || !local)) {
        const rec: BestRun = { ms: t.ms, splits: t.splits, simVersion: usable ? SIM_VERSION : (t.simVersion ?? 0), medal: t.medal ?? null, ...(usable ? { replay: t.replay } : {}), ...(voiture ? { voiture } : {}) };
        storage.setItem(BEST + t.trackId, JSON.stringify(rec));
        result.todayChanged = true;
      } else if (local && voiture && t.ms === local.ms && !local.voiture) {
        storage.setItem(BEST + t.trackId, JSON.stringify({ ...local, voiture }));
        result.todayChanged = true;
      }
      storage.setItem(SUB + t.trackId, String(t.ms));
    } catch {
      /* tant pis */
    }
  }

  for (const p of me.past) {
    if (!p.trackId || !DAY_TRACK.test(p.trackId) || !Number.isFinite(p.ms) || p.ms <= 0) continue;
    try {
      const local = readRecord(storage, p.trackId);
      if (local && local.ms <= p.ms) continue;
      // Un jour passé : le temps et la médaille suffisent (les archives les montrent) ; pas de rediffusion, donc pas de fantôme « ton record ».
      const rec: BestRun = { ms: p.ms, splits: [], simVersion: SIM_VERSION, medal: p.medal ?? null };
      storage.setItem(BEST + p.trackId, JSON.stringify(rec));
      result.pastChanged++;
    } catch {
      /* tant pis */
    }
  }

  const best = me.stats.bestRank;
  if (best) rememberRank(best.date, { rank: best.rank, participants: best.participants }, storage);
  return result;
}

// --- Le service ---------------------------------------------------------------------------------------------------------
export { SYNC_GAP_MS } from "@cdj/profile";
export type { SyncState, SyncStatus } from "@cdj/profile";

export type SyncOutcome = PlatformOutcome<MergeResult>;

export interface SyncDeps extends Omit<PlatformSyncDeps<MergeResult, Store>, "api" | "merge" | "identity"> {
  /** L'API du classement, ou `null` (aucun serveur, démonstration) : rien n'est alors synchronisé. */
  api: () => LeaderboardSource | null;
}

/** Le service de la plateforme, branché sur DailyTrack : sa fusion des records (`mergeProfile`) et l'identité du jeu (`cdj:player:next`). */
export class ProfileSync extends PlatformSync<MergeResult, Store> {
  constructor(deps: SyncDeps) {
    super({ ...deps, merge: mergeProfile, identity: { pendingNextId, clearNextId } });
  }
}
