import { createTestTrack, dailyCircuit, decodeReplay, parseDay, replayRace } from "@cdj/sim";

// Page de test sans rendu 3D : rejoue une rediffusion avec le même code de simulation que le jeu et que
// le serveur, et renvoie ce que le navigateur a calculé. Les tests de navigateur (apps/web/e2e) la
// comparent au résultat de Node, au bit près, dans Chromium, Firefox et WebKit.
export interface VerifyResult {
  finishMs: number;
  splits: number[];
  respawns: number;
  ticks: number;
  final: { x: number; y: number; z: number; yaw: number; vx: number; vy: number; vz: number };
}

export interface DailyResult {
  number: number;
  attempt: number;
  spec: string;
  authorMs: number;
  palette: string;
}

declare global {
  interface Window {
    __verify: (code: string) => VerifyResult;
    /** Régénère le circuit du jour d'une date « AAAA-MM-JJ » (générateur + pilote de validation). */
    __daily: (date: string) => DailyResult;
  }
}

window.__verify = (code) => {
  const r = replayRace(createTestTrack(), decodeReplay(code));
  const c = r.finalCar;
  return {
    finishMs: r.finishMs,
    splits: r.splits,
    respawns: r.respawns,
    ticks: r.ticks,
    final: { x: c.x, y: c.y, z: c.z, yaw: c.yaw, vx: c.vx, vy: c.vy, vz: c.vz },
  };
};

window.__daily = (date) => {
  const day = parseDay(date);
  if (day === null) throw new Error(`Date invalide : ${date}`);
  const c = dailyCircuit(day);
  return { number: c.number, attempt: c.attempt, spec: c.spec, authorMs: c.authorMs, palette: c.palette };
};

document.documentElement.dataset.ready = "true";
