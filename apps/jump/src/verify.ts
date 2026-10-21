import { DANGERS_LEVEL, ESSAI_LEVEL, SANDBOX_LEVEL, VENT_LEVEL, decodeReplay, parseLevel, replayAttempt, replayFingerprint, type Level } from "@cdj/jump-sim";

// Page de test sans rendu (lot 3) : rejoue une rediffusion avec la même simulation que le jeu et rend l'empreinte de tous les états du
// rejeu. Le test de navigateur `e2e/replay.spec.ts` la compare à celle que Node a calculée (`packages/jump-sim/test/fixtures/replay-golden.json`),
// au bit près, dans Chromium, Firefox et WebKit. Aucun paramètre d'adresse : tout passe par `window.__verify`.
// Lot 15 : `window.__verifyOn(texte du niveau, rediffusion)` rejoue sur un niveau donné en texte (le niveau du jour en v4 de
// `packages/jump-sim/test/fixtures/replay-golden-v4.json`).

export interface VerifyResult {
  hash: string;
  finished: boolean;
  ticks: number;
  time: number;
  deaths: number;
  lives: number;
}

const LEVELS: Record<string, Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL, "bac-a-sable": SANDBOX_LEVEL, vent: VENT_LEVEL };

declare global {
  interface Window {
    __verify: (code: string) => VerifyResult;
    __verifyOn: (ascii: string, code: string) => VerifyResult;
  }
}

window.__verify = (code) => {
  const replay = decodeReplay(code);
  const level = LEVELS[replay.levelId];
  if (!level) throw new Error(`Niveau inconnu : ${replay.levelId}`);
  const fp = replayFingerprint(level, replay);
  return { ...fp, lives: replayAttempt(level, replay).lives.length };
};

window.__verifyOn = (ascii, code) => {
  const level = parseLevel(ascii);
  const replay = decodeReplay(code);
  const fp = replayFingerprint(level, replay);
  return { ...fp, lives: replayAttempt(level, replay).lives.length };
};

document.getElementById("status")!.textContent = "Prête.";
document.documentElement.dataset.ready = "true";
