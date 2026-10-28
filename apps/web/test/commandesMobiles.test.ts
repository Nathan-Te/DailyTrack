import { createAutopilot, createRace, decodeReplay, encodeReplay, makeInput, parseTrack, replayRace, ReplayRecorder, stepRace } from "@cdj/sim";
import { describe, expect, it } from "vitest";
import { GyroSteerer } from "../src/steerGyro";
import { SliderSteerer, sliderCourse } from "../src/steerSlider";
import { WheelSteerer } from "../src/steerWheel";
import { DEFAULT_TOUCH_SETTINGS, TouchPad, type TouchSettings } from "../src/touch";

// Lot 52 : « la simulation, la rediffusion et le classement ne changent pas ». Chaque façon de tourner (glissière, volant, gyroscope, et les boutons) conduit un vrai tour
// (le pilote automatique lit la route et « pousse le pouce »), les commandes entières passent par `makeInput`, sont enregistrées, encodées en texte comme pour l'envoi, puis
// rejouées par `replayRace` — le code du serveur (`apps/api/src/cdj.ts`) : le même temps, les mêmes points de contrôle. La version de bout en bout, avec le vrai serveur et le
// vrai navigateur : `e2e/tactile.spec.ts` (« jouée au volant, rejouée par le serveur »).
const SPEC = "S@start S S S L2 S S@cp S R2 S S S@finish";
const track = parseTrack("lot52", SPEC);
const DZ = 0.08;

type Commande = (veut: number) => void;
function banc(steerMode: TouchSettings["steerMode"]): { pad: TouchPad; commande: Commande; tick(): void } {
  const pad = new TouchPad({ ...DEFAULT_TOUCH_SETTINGS, steerMode, autoThrottle: true });
  pad.setGeometry(844, 390);
  let t = 1000;
  if (steerMode === "slider") {
    pad.steerer = new SliderSteerer(pad);
    const r = pad.rect("steer")!;
    pad.down(1, r.x + r.w / 2, 300);
    return { pad, tick: () => undefined, commande: (v) => pad.move(1, r.x + r.w / 2 + (v === 0 ? 0 : Math.sign(v) * sliderCourse(r.w) * (DZ + Math.abs(v) * (1 - DZ))), 300) };
  }
  if (steerMode === "wheel") {
    const w = new WheelSteerer(pad);
    pad.steerer = w;
    const r = pad.rect("steer")!;
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const sur = (deg: number) => [c.x + 50 * Math.sin((deg * Math.PI) / 180), c.y - 50 * Math.cos((deg * Math.PI) / 180)] as const;
    pad.down(1, ...sur(0));
    let angle = 0;
    return {
      pad,
      tick: () => undefined,
      commande: (v) => {
        const voulu = v === 0 ? 0 : Math.sign(v) * 90 * (0.06 + Math.abs(v) * (1 - 0.06));
        // le doigt balaie l'angle voulu par petits pas (jamais plus de 60° d'un coup)
        while (Math.abs(voulu - angle) > 0.01) {
          angle += Math.max(-60, Math.min(60, voulu - angle));
          pad.move(1, ...sur(angle));
        }
      },
    };
  }
  if (steerMode === "gyro") {
    const g = new GyroSteerer(pad.settings);
    pad.steerer = g;
    let roll = 0;
    for (let i = 0; i < 90; i++, t += 1000 / 120) g.feed(0, t); // le téléphone est tenu droit : le neutre
    g.go();
    return {
      pad,
      commande: (v) => (roll = v === 0 ? 0 : Math.sign(v) * 35 * (pad.settings.gyroDeadzone + Math.abs(v) * (1 - pad.settings.gyroDeadzone))),
      tick: () => {
        g.feed(roll, t);
        t += 1000 / 120;
      },
    };
  }
  const gauche = pad.rect("left")!;
  const droite = pad.rect("right")!;
  pad.down(1, gauche.x + 4, gauche.y + 4);
  return { pad, tick: () => undefined, commande: (v) => (Math.abs(v) < 0.3 ? pad.up(1) : (pad.up(1), pad.down(1, (v < 0 ? gauche : droite).x + 4, gauche.y + 4))) };
}

function conduire(steerMode: TouchSettings["steerMode"]) {
  const { pad, commande, tick } = banc(steerMode);
  const race = createRace(track);
  const pilote = createAutopilot(track);
  const enregistreur = new ReplayRecorder();
  const entiers = new Set<number>();
  for (let i = 0; i < 120 * 90 && race.finishMs < 0; i++) {
    commande(pilote(race).steer / 64);
    tick();
    const axes = pad.axes();
    const entree = makeInput(axes.steer, axes.throttle, axes.brake);
    entiers.add(entree.steer);
    enregistreur.record(entree);
    stepRace(race, entree);
  }
  return { race, replay: enregistreur.toReplay(track.id), entiers };
}

describe("lot 52 : chaque façon de tourner donne des commandes que le serveur rejoue au même temps", () => {
  for (const [mode, nom] of [["slider", "glissière"], ["wheel", "volant"], ["gyro", "gyroscope"], ["buttons", "boutons"]] as const) {
    it(`${nom} : le tour est fini, et la rediffusion encodée donne exactement le même temps`, () => {
      const { race, replay, entiers } = conduire(mode);
      expect(race.finishMs, `${nom} : le tour doit finir`).toBeGreaterThan(0);
      for (const s of entiers) {
        expect(Number.isInteger(s)).toBe(true); // des commandes entières, comme le clavier et la manette
        expect(Math.abs(s)).toBeLessThanOrEqual(64);
      }
      if (mode !== "buttons") expect(entiers.size, `${nom} : une direction analogique, pas seulement −64, 0 et 64`).toBeGreaterThan(3);
      const rejoue = replayRace(track, decodeReplay(encodeReplay(replay)));
      expect(rejoue.finished).toBe(true);
      expect(rejoue.finishMs).toBe(race.finishMs);
      expect(rejoue.splits).toEqual(race.splits);
      expect(rejoue.respawns).toBe(race.respawns);
    });
  }
});
