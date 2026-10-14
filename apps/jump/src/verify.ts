import { DANGERS_LEVEL, ESSAI_LEVEL, SANDBOX_LEVEL, decodeReplay, replayAttempt, replayFingerprint, type Level } from "@cdj/jump-sim";

// Page de test sans rendu (lot 3) : rejoue une rediffusion avec la même simulation que le jeu et rend l'empreinte de tous les états du
// rejeu. Le test de navigateur `e2e/replay.spec.ts` la compare à celle que Node a calculée (`packages/jump-sim/test/fixtures/replay-golden.json`),
// au bit près, dans Chromium, Firefox et WebKit. Aucun paramètre d'adresse : tout passe par `window.__verify`.

export interface VerifyResult {
  hash: string;
  finished: boolean;
  ticks: number;
  time: number;
  deaths: number;
  lives: number;
}

const LEVELS: Record<string, Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL, "bac-a-sable": SANDBOX_LEVEL };

declare global {
  interface Window {
    __verify: (code: string) => VerifyResult;
  }
}

window.__verify = (code) => {
  const replay = decodeReplay(code);
  const level = LEVELS[replay.levelId];
  if (!level) throw new Error(`Niveau inconnu : ${replay.levelId}`);
  const fp = replayFingerprint(level, replay);
  return { ...fp, lives: replayAttempt(level, replay).lives.length };
};

document.getElementById("status")!.textContent = "Prête.";
document.documentElement.dataset.ready = "true";
