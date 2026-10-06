import { makeInput, type CarInput } from "@cdj/sim";

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
};

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

/** Manette « standard » : stick gauche ou croix pour tourner, RT/A accélère, LT/B freine. */
export function gamepadAxes(pad: Pick<Gamepad, "axes" | "buttons">): Axes {
  const btn = (i: number) => pad.buttons[i]?.value ?? 0;
  const dpad = btn(15) - btn(14);
  const stick = deadzone(pad.axes[0] ?? 0);
  return {
    steer: Math.abs(dpad) > Math.abs(stick) ? dpad : stick,
    throttle: Math.max(btn(7), btn(0)),
    brake: Math.max(btn(6), btn(1)),
  };
}

export interface ControlsState {
  /** Commande à appliquer à chaque pas de simulation de cette image (`respawn` n'est vrai qu'une fois). */
  input: CarInput;
  /** Vrai une fois quand le joueur demande à recommencer depuis le départ. */
  restart: boolean;
}

export class Controls {
  private readonly down = new Set<string>();
  private respawnLatch = false;
  private restartLatch = false;
  private padRespawnHeld = false;
  private padRestartHeld = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (Object.values(KEYS).some((codes) => codes.includes(e.code))) e.preventDefault();
      this.down.add(e.code);
      if (KEYS.respawn.includes(e.code)) this.respawnLatch = true;
      if (KEYS.restart.includes(e.code)) this.restartLatch = true;
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    target.addEventListener("blur", () => this.down.clear());
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

    const respawn = this.respawnLatch;
    const restart = this.restartLatch;
    this.respawnLatch = false;
    this.restartLatch = false;

    // Le clavier gagne s'il est utilisé ; sinon la manette (analogique).
    const steer = k.steer !== 0 ? k.steer : g.steer;
    return {
      input: makeInput(steer, Math.max(k.throttle, g.throttle), Math.max(k.brake, g.brake), respawn),
      restart,
    };
  }
}
