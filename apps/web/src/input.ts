import { makeInput, type CarInput } from "@cdj/sim";
import type { TouchPad } from "./touch";

/** Axes bruts du joueur (flottants), avant quantification en commandes de simulation. */
export interface Axes {
  steer: number; // [-1, 1], positif = droite
  throttle: number; // [0, 1]
  brake: number; // [0, 1]
}

// `event.code` désigne la touche physique : KeyW/KeyA/KeyS/KeyD sont aussi ZQSD sur un clavier AZERTY.
const KEYS = {
  throttle: ["ArrowUp", "KeyW"],
  brake: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  respawn: ["KeyR"], // dernier point de contrôle
  restart: ["Enter"], // depuis le départ
  camera: ["KeyC"], // caméra proche / loin
  pause: ["KeyP"],
};

/** Vrai si la touche est tapée dans un champ de saisie (le pseudo). */
export function isTyping(e: Event): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}

const anyDown = (down: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => down.has(c));

export function keyboardAxes(down: ReadonlySet<string>): Axes {
  return {
    steer: (anyDown(down, KEYS.right) ? 1 : 0) - (anyDown(down, KEYS.left) ? 1 : 0),
    throttle: anyDown(down, KEYS.throttle) ? 1 : 0,
    brake: anyDown(down, KEYS.brake) ? 1 : 0,
  };
}

const DEADZONE = 0.12;

function deadzone(v: number): number {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  return Math.sign(v) * Math.min(1, (a - DEADZONE) / (1 - DEADZONE));
}

/** Gâchette enfoncée au-delà de ce seuil = appuyée : accélérateur et frein sont tout-ou-rien. */
const TRIGGER_ON = 0.3;

/** Manette « standard » : stick gauche (analogique) ou croix pour tourner, RT/A accélère, LT/B freine. */
export function gamepadAxes(pad: Pick<Gamepad, "axes" | "buttons">): Axes {
  const btn = (i: number) => pad.buttons[i]?.value ?? 0;
  const dpad = btn(15) - btn(14);
  const stick = deadzone(pad.axes[0] ?? 0);
  return {
    steer: Math.abs(dpad) > Math.abs(stick) ? dpad : stick,
    throttle: Math.max(btn(7), btn(0)) > TRIGGER_ON ? 1 : 0,
    brake: Math.max(btn(6), btn(1)) > TRIGGER_ON ? 1 : 0,
  };
}

export interface ControlsState {
  /** Commande à appliquer à chaque pas de simulation de cette image (`respawn` n'est vrai qu'une fois). */
  input: CarInput;
  /** Vrai une fois quand le joueur demande à recommencer depuis le départ. */
  restart: boolean;
  /** Vrai une fois quand le joueur change de caméra (C, ou bouton Vue/Select de la manette). */
  camera: boolean;
  /** Vrai une fois quand le joueur demande la pause (P). */
  pause: boolean;
}

export class Controls {
  private readonly down = new Set<string>();
  private respawnLatch = false;
  private restartLatch = false;
  private cameraLatch = false;
  private pauseLatch = false;
  private padRespawnHeld = false;
  private padRestartHeld = false;
  private padCameraHeld = false;

  /** `touch` : l'interface tactile, si elle est active — ses axes s'ajoutent à ceux du clavier et de la manette. */
  constructor(
    target: Window = window,
    private readonly touch: TouchPad | null = null,
  ) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat || isTyping(e)) return; // on tape son pseudo : les touches ne sont pas des commandes
      if (Object.values(KEYS).some((codes) => codes.includes(e.code))) e.preventDefault();
      this.down.add(e.code);
      if (KEYS.respawn.includes(e.code)) this.respawnLatch = true;
      if (KEYS.restart.includes(e.code)) this.restartLatch = true;
      if (KEYS.camera.includes(e.code)) this.cameraLatch = true;
      if (KEYS.pause.includes(e.code)) this.pauseLatch = true;
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    target.addEventListener("blur", () => this.down.clear());
  }

  /** Boutons tactiles : mêmes demandes que les touches R et Entrée. */
  requestRespawn(): void {
    this.respawnLatch = true;
  }

  requestRestart(): void {
    this.restartLatch = true;
  }

  poll(): ControlsState {
    const k = keyboardAxes(this.down);
    const pad = navigator.getGamepads?.().find((p): p is Gamepad => !!p && p.connected);
    const g = pad ? gamepadAxes(pad) : { steer: 0, throttle: 0, brake: 0 };

    // Manette : Y = dernier point de contrôle, Start = depuis le départ (sur front montant).
    const padRespawn = !!pad && (pad.buttons[3]?.pressed ?? false);
    const padRestart = !!pad && (pad.buttons[9]?.pressed ?? false);
    if (padRespawn && !this.padRespawnHeld) this.respawnLatch = true;
    if (padRestart && !this.padRestartHeld) this.restartLatch = true;
    this.padRespawnHeld = padRespawn;
    this.padRestartHeld = padRestart;
    // Vue/Select (bouton 8) : caméra suivante.
    const padCamera = !!pad && (pad.buttons[8]?.pressed ?? false);
    if (padCamera && !this.padCameraHeld) this.cameraLatch = true;
    this.padCameraHeld = padCamera;

    const respawn = this.respawnLatch;
    const restart = this.restartLatch;
    const camera = this.cameraLatch;
    const pause = this.pauseLatch;
    this.pauseLatch = false;
    this.respawnLatch = false;
    this.restartLatch = false;
    this.cameraLatch = false;

    // Le clavier gagne s'il est utilisé ; sinon la manette (analogique), puis le doigt (analogique aussi).
    // Même chaîne pour tous : des axes flottants, quantifiés en commandes entières par `makeInput`.
    const t = this.touch?.axes() ?? { steer: 0, throttle: 0, brake: 0 };
    const steer = k.steer !== 0 ? k.steer : g.steer !== 0 ? g.steer : t.steer;
    return {
      input: makeInput(steer, Math.max(k.throttle, g.throttle, t.throttle), Math.max(k.brake, g.brake, t.brake), respawn),
      restart,
      camera,
      pause,
    };
  }
}
