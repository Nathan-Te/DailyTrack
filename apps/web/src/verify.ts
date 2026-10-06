import { createTestTrack, decodeReplay, replayRace } from "@cdj/sim";

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

declare global {
  interface Window {
    __verify: (code: string) => VerifyResult;
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

document.documentElement.dataset.ready = "true";
