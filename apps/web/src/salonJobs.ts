import { decodeReplay, parseTrack, replayRace, runFictional, salonCircuit, styleFor, mixSeed, type PaletteName, type ThemeName, type Track } from "@cdj/sim";
import { demoPlan, pilotRef } from "./salonPlan";

// Les deux tâches lourdes du Salon, partagées par le fil de travail (`salonWorker.ts`) et le repli sur le fil principal
// (`salonEngine.ts`) : générer le circuit d'une session (≈ 0,5 s), et faire rouler un pilote fictif (≈ 0,1 s la course).

export interface CircuitData {
  session: number;
  id: string;
  spec: string;
  palette: PaletteName;
  theme: ThemeName;
  authorMs: number;
  fallback: boolean;
  /** Noms des figures du circuit, dans l'ordre. */
  figures: string[];
}

export interface PilotRunData {
  ref: string;
  name: string;
  /** Temps **recalculé** par un rejeu de la rediffusion (jamais celui annoncé par le pilote). */
  ms: number;
  splits: number[];
  replay: string;
  /** Instant prévu de l'envoi (ms depuis le début de la session). */
  at: number;
}

/** Circuits déjà construits dans ce contexte (le fil de travail garde les derniers : les pilotes fictifs roulent dessus). */
const tracks = new Map<number, { track: Track; data: CircuitData }>();

export function computeCircuit(session: number): CircuitData {
  const known = tracks.get(session);
  if (known) return known.data;
  const c = salonCircuit(session);
  const data: CircuitData = { session, id: c.id, spec: c.spec, palette: c.palette, theme: c.theme, authorMs: c.authorMs, fallback: c.fallback, figures: c.figures.map((f) => f.name) };
  if (!c.fallback) {
    tracks.set(session, { track: c.track, data });
    while (tracks.size > 3) tracks.delete(tracks.keys().next().value!);
  }
  return data;
}

function trackOf(session: number): Track | null {
  const data = computeCircuit(session);
  if (data.fallback) return null;
  return tracks.get(session)?.track ?? parseTrack(data.id, data.spec);
}

/**
 * Un envoi d'un pilote fictif : le pilote automatique roule (un échec le refait en plus sage, comme l'historique du lot 11), puis la
 * rediffusion est **rejouée** et c'est ce rejeu qui donne le temps : même chemin de validation qu'une vraie course.
 */
export function computePilotRun(session: number, sessionMs: number, pilot: number, attempt: number): PilotRunData | null {
  const plan = demoPlan(session, sessionMs).find((p) => p.index === pilot);
  const a = plan?.attempts[attempt];
  const track = trackOf(session);
  if (!plan || !a || !track) return null;
  for (let retry = 0; retry < 4; retry++) {
    const style = styleFor(Math.min(1, a.skill + retry * 0.12));
    const run = runFictional(track, { ...style, wobble: style.wobble / (1 + retry) }, mixSeed(a.seed, retry));
    if (!run) continue;
    const verdict = replayRace(track, decodeReplay(run.code));
    if (!verdict.finished || verdict.respawns > 0) continue;
    return { ref: plan.ref, name: plan.name, ms: verdict.finishMs, splits: verdict.splits, replay: run.code, at: a.at };
  }
  return null;
}

export { pilotRef };
