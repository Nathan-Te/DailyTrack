import { FICTIONAL_NAMES, Rng, mixSeed } from "@cdj/sim";

// Joueurs fictifs du Salon de démonstration (lot 26) : qui arrive quand, à quel niveau, avec quelles graines. Tout vient du seul
// numéro de session (et de la durée de la session) : deux navigateurs voient les mêmes joueurs, et un test peut tout vérifier sans
// faire rouler une seule voiture. Les courses elles-mêmes sont calculées dans un fil de travail (`salonJobs.ts`).

export interface PilotAttempt {
  /** Instant de l'envoi, en ms depuis le début de la session. */
  at: number;
  /** Niveau du pilote automatique pour cette course (0 à 1) : il progresse d'un essai à l'autre. */
  skill: number;
  seed: number;
}

export interface PilotPlan {
  index: number;
  name: string;
  /** Référence publique de la session (même forme que celle du vrai serveur). */
  ref: string;
  /** Arrivée dans le Salon (ms depuis le début de la session). */
  joinAt: number;
  attempts: PilotAttempt[];
}

/** Référence publique d'un pseudo fictif dans une session. */
export const pilotRef = (session: number, nameIndex: number): string => `d${mixSeed(session, 0x7000 + nameIndex).toString(16).padStart(8, "0")}`;

/**
 * 8 à 15 pilotes, arrivés au fil de la session (les derniers dans les deux tiers du temps), qui envoient chacun 1 à 3 courses de plus en
 * plus rapides, à une cadence de l'ordre de 7 à 10 % de la durée de la session (une course dure 35 à 55 s, une session 10 minutes).
 * Les envois qui tomberaient après la fin ne sont pas prévus.
 */
export function demoPlan(session: number, sessionMs: number): PilotPlan[] {
  const rng = new Rng(mixSeed(session, 0x5a50));
  const count = 8 + rng.int(8);
  const names = rng.shuffle(FICTIONAL_NAMES.map((name, i) => ({ name, i }))).slice(0, count);
  const plans: PilotPlan[] = [];
  names.forEach(({ name, i }, index) => {
    // Plutôt des pilotes moyens ou prudents que de très bons, comme l'historique du lot 11.
    const base = (rng.int(1000) / 1000) ** 1.3;
    const joinAt = Math.floor(rng.int(1000) / 1000 * sessionMs * 0.66);
    const tries = 1 + rng.int(3);
    const attempts: PilotAttempt[] = [];
    let at = joinAt;
    for (let k = 0; k < tries; k++) {
      at += Math.floor(sessionMs * 0.07) + rng.int(Math.floor(sessionMs * 0.03) + 1);
      if (at >= sessionMs) break;
      attempts.push({ at, skill: Math.min(1, base + 0.1 * k + rng.int(60) / 1000), seed: mixSeed(session, index * 31 + k + 0x100) });
    }
    if (attempts.length > 0) plans.push({ index, name, ref: pilotRef(session, i), joinAt, attempts });
  });
  return plans;
}

/** Les envois du plan dans l'ordre où ils tombent. */
export function plannedRuns(plans: readonly PilotPlan[]): { pilot: number; attempt: number; at: number }[] {
  const all: { pilot: number; attempt: number; at: number }[] = [];
  for (const p of plans) p.attempts.forEach((a, attempt) => all.push({ pilot: p.index, attempt, at: a.at }));
  return all.sort((a, b) => a.at - b.at || a.pilot - b.pilot);
}
