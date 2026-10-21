import { JUMP_SIM_VERSION, decodeReplay, lifeStartProblem, type JumpReplay, type Level } from "@cdj/jump-sim";
import { carnageSchedule } from "./carnage";
import { t } from "./i18n";
import type { CarnageSampleData } from "./rankApi";

// Le carnage de tout le monde (lot P3 de la plateforme), **logique seule** (testée) : l'échantillon du serveur (≈ 150 vies d'autres joueurs du
// jour, `GET /api/jump/day/<date>/carnage`) rejoué **avec ton essai en héros**, par les vagues du lot 3 (`Carnage` : chaque vie part quand le
// héros passe son point de départ). Rien n'y est cru sur parole : une vie d'une autre version, d'un autre niveau, illisible ou à l'en-tête
// impossible est écartée ; chacune est ensuite rejouée par la simulation du jeu, dans sa propre instance (elle meurt là où elle est morte).
// Tes propres vies (déjà dans ton carnage) sont retirées. Le compteur dit « 142 vies de 37 joueurs » : les vies qui partiront, et leurs joueurs.

export interface EveryoneLives {
  lives: JumpReplay[];
  /** Le numéro de joueur (propre à l'échantillon) de chaque vie. */
  players: number[];
  /** Vies écartées (autre version, autre niveau, illisibles, en-tête impossible) et vies à toi retirées. */
  rejected: number;
  own: number;
}

/** Les vies jouables de l'échantillon pour ce niveau : versions, identifiant du niveau, en-tête atteignable ; sans les tiennes (`ownCodes`). */
export function everyoneLives(level: Level, levelId: string, sample: CarnageSampleData, ownCodes: ReadonlySet<string>): EveryoneLives {
  const out: EveryoneLives = { lives: [], players: [], rejected: 0, own: 0 };
  if (sample.simVersion !== JUMP_SIM_VERSION || (sample.levelId !== null && sample.levelId !== levelId)) {
    out.rejected = sample.lives.length;
    return out;
  }
  for (const l of sample.lives) {
    if (ownCodes.has(l.replay)) {
      out.own++;
      continue;
    }
    try {
      const r = decodeReplay(l.replay);
      if (r.simVersion !== JUMP_SIM_VERSION || r.levelId !== levelId || lifeStartProblem(level, r.start) !== null) {
        out.rejected++;
        continue;
      }
      out.lives.push(r);
      out.players.push(l.p);
    } catch {
      out.rejected++;
    }
  }
  return out;
}

/** « 142 vies de 37 joueurs » (une vie, un joueur au singulier). */
export function everyoneLabel(lives: number, players: number): string {
  return t("carnage.toutLeMonde", { vies: t("carnage.vies", { n: lives }), joueurs: t("carnage.joueurs", { n: players }) });
}

/**
 * Le calendrier du carnage de tout le monde : quand part chaque vie (le pas du héros où il passe son point de départ, −1 : jamais) et le
 * compteur (les vies qui partiront et leurs joueurs, ceux d'une vie qui ne part jamais ne comptent pas).
 */
export function everyonePlan(level: Level, hero: JumpReplay, e: EveryoneLives): { depart: number[]; heroTicks: number; lives: number; players: number; label: string } {
  const plan = carnageSchedule(level, hero, e.lives);
  const players = new Set<number>();
  let lives = 0;
  plan.depart.forEach((d, i) => {
    if (d < 0) return;
    lives++;
    players.add(e.players[i]!);
  });
  return { ...plan, lives, players: players.size, label: everyoneLabel(lives, players.size) };
}
