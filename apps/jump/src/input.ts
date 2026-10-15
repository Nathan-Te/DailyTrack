import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";

// Entrées de DailyJump : clavier (par `KeyboardEvent.code`, donc QZSD et WASD au même endroit) et manette, fusionnés en 3 bits par pas.
// « Recommencer » (R, Select) n'est pas une commande de la simulation : c'est un événement de la session.
// Lot 8 : le menu ⏸ (Échap ou P, Start à la manette) met la partie en pause ; menu ouvert, le clavier ne commande plus rien (les flèches et
// Espace servent aux curseurs et aux boutons du menu).

/** Touches physiques. `KeyA` = Q et `KeyW` = Z sur un clavier AZERTY. */
export const KEYS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["Space", "ArrowUp", "KeyW"],
  restart: ["KeyR"],
  /** Menu ⏸ (lot 8). */
  menu: ["Escape", "KeyP"],
} as const;

const GAME_CODES = new Set<string>([...KEYS.left, ...KEYS.right, ...KEYS.jump, ...KEYS.restart]);

/**
 * Le bouton de saut entre deux pas : **aucun appui n'est perdu**. Un appui puis un relâchement entre deux pas compte pour un pas tenu ;
 * un relâchement puis un nouvel appui entre deux pas (bouton déjà tenu au pas précédent) donne un pas relâché puis un pas tenu.
 */
export class JumpLatch {
  private held = false;
  private pressed = false;
  private released = false;
  private pending = false;
  private suppressed = false;
  private last = 0;

  press(): void {
    if (this.held) return;
    this.held = true;
    this.pressed = true;
  }

  release(): void {
    if (!this.held) return;
    this.held = false;
    this.released = true;
  }

  /** Le bit de saut du prochain pas (à appeler une fois par pas). */
  sample(): number {
    let bit: number;
    if (this.suppressed) {
      // Bouton tenu pendant « recommencer » : il ne compte qu'après avoir été relâché.
      if (!this.held || this.released) this.suppressed = false;
      bit = !this.suppressed && (this.held || this.pressed) ? 1 : 0;
    } else if (this.pending) {
      bit = 1;
      this.pending = false;
    } else if (this.pressed && this.released && this.last === 1) {
      bit = 0; // relâché puis réappuyé entre deux pas : un pas relâché d'abord, l'appui au pas suivant
      this.pending = true;
    } else bit = this.held || this.pressed ? 1 : 0;
    this.pressed = false;
    this.released = false;
    this.last = bit;
    return bit;
  }

  /** Après « recommencer » : un bouton tenu à ce moment ne compte pas comme un appui. */
  reset(): void {
    this.pressed = this.released = this.pending = false;
    this.suppressed = this.held;
    this.last = 0;
  }
}

/** Zone morte du stick : en dessous, neutre ; au-delà, une direction pleine (la simulation ne connaît que des bits). */
export const STICK_DEADZONE = 0.35;

/** Directions d'une manette « standard » : stick gauche ou croix. */
export function padDirection(pad: Pick<Gamepad, "axes" | "buttons">): number {
  const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
  const dpad = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
  if (dpad !== 0) return dpad;
  const x = pad.axes[0] ?? 0;
  return x > STICK_DEADZONE ? 1 : x < -STICK_DEADZONE ? -1 : 0;
}

/** A (0) ou B (1) = saut. */
export const padJump = (pad: Pick<Gamepad, "buttons">): boolean => !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
/** Select (8) = recommencer (lot 8 : Start ouvre le menu). */
export const padRestart = (pad: Pick<Gamepad, "buttons">): boolean => !!pad.buttons[8]?.pressed;
/** Start (9) = menu ⏸ (lot 8). */
export const padMenu = (pad: Pick<Gamepad, "buttons">): boolean => !!pad.buttons[9]?.pressed;

/** Bits de direction : gauche + droite ensemble = neutre (la simulation le fait aussi). */
export function directionBits(left: boolean, right: boolean): number {
  return (left ? INPUT_LEFT : 0) | (right ? INPUT_RIGHT : 0);
}

export class Controls {
  private readonly down = new Set<string>();
  private readonly latch = new JumpLatch();
  private keyJump = false;
  private padJumpDown = false;
  private padRestartDown = false;
  private padMenuDown = false;
  private restartLatch = false;
  private menuLatch = false;
  /** Menu ouvert : le clavier ne commande plus le personnage (lot 8). */
  private suspended = false;
  private padDir = 0;
  private touchDir = 0;
  private touchJump = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if ((KEYS.menu as readonly string[]).includes(e.code)) {
        if (!e.repeat) this.menuLatch = true;
        return;
      }
      if (this.suspended) return; // menu ouvert : flèches et Espace vont au menu
      if (GAME_CODES.has(e.code)) e.preventDefault(); // Espace et flèches ne font pas défiler la page
      if (e.repeat) return;
      this.down.add(e.code);
      if ((KEYS.restart as readonly string[]).includes(e.code)) this.restartLatch = true;
      this.syncJump();
    });
    target.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      this.syncJump();
    });
    target.addEventListener("blur", () => {
      this.down.clear();
      this.syncJump();
    });
  }

  private has(codes: readonly string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  private syncJump(): void {
    this.keyJump = this.has(KEYS.jump);
    if (this.keyJump || this.padJumpDown || this.touchJump) this.latch.press();
    else this.latch.release();
  }

  /** Lit la manette (une fois par image : elle ne prévient pas). */
  pollPad(): void {
    const pad = navigator.getGamepads?.().find((p): p is Gamepad => !!p && p.connected);
    this.padDir = pad ? padDirection(pad) : 0;
    const jump = pad ? padJump(pad) : false;
    if (jump !== this.padJumpDown) {
      this.padJumpDown = jump;
      this.syncJump();
    }
    const restart = pad ? padRestart(pad) : false;
    if (restart && !this.padRestartDown && !this.suspended) this.restartLatch = true;
    this.padRestartDown = restart;
    const menu = pad ? padMenu(pad) : false;
    if (menu && !this.padMenuDown) this.menuLatch = true;
    this.padMenuDown = menu;
  }

  /** Vrai une fois après Échap, P ou Start (lot 8). */
  takeMenu(): boolean {
    const m = this.menuLatch;
    this.menuLatch = false;
    return m;
  }

  /** Menu ouvert (vrai) ou refermé : le clavier lâche tout, rien de tenu ne compte comme un appui à la reprise. */
  setSuspended(on: boolean): void {
    this.suspended = on;
    this.down.clear();
    this.restartLatch = false;
    this.syncJump();
    this.latch.reset();
  }

  /** Direction (−1, 0, 1) et saut tenus par les doigts : le saut passe par la même mémorisation que le clavier, un appui bref compte. */
  setTouch(direction: number, jump: boolean): void {
    this.touchDir = direction;
    if (jump !== this.touchJump) {
      this.touchJump = jump;
      this.syncJump();
    }
  }

  /** Demande « recommencer » (bouton tactile) : même événement que la touche R. */
  requestRestart(): void {
    this.restartLatch = true;
  }

  /** Les 3 bits du prochain pas de simulation. */
  sample(): number {
    const left = this.has(KEYS.left) || this.padDir < 0 || this.touchDir < 0;
    const right = this.has(KEYS.right) || this.padDir > 0 || this.touchDir > 0;
    return directionBits(left, right) | (this.latch.sample() ? INPUT_JUMP : 0);
  }

  /** Vrai une fois après un appui sur R (ou Select). */
  takeRestart(): boolean {
    const r = this.restartLatch;
    this.restartLatch = false;
    return r;
  }

  /** Après « recommencer » : un bouton tenu ne compte pas comme un nouvel appui. */
  resetLatch(): void {
    this.latch.reset();
  }
}
