import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";
import { BOUTON_FIXE, TOUCHE_FIXE } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { commandes } from "./commandes";

// Entrées de DailyJump : clavier (par `KeyboardEvent.code`, donc QZSD et WASD au même endroit) et manette, fusionnés en 3 bits par pas.
// Lot 27 : les mêmes touches que DailyTrack (`apps/web/src/input.ts`) — **R : reprendre au dernier point de passage**, **Entrée : recommencer à zéro** ; à la manette Y et X ;
// aux doigts, deux plaques à côté de la pause (touchUi.ts, main.ts). « Recommencer » n'est pas une commande de la simulation : c'est un événement de la session ; « reprendre au point de
// passage » est enregistrée dans la rediffusion (quatrième bit, `INPUT_RESPAWN`, niveaux en version 11) et, avant le premier point, fait comme « recommencer ».
// Lot 8 : le menu ⏸ (Échap ou P, Start à la manette) met la partie en pause ; menu ouvert, le clavier ne commande plus rien (les flèches et
// Espace servent aux curseurs et aux boutons du menu).

/** Menu ⏸ (lot 8) : Échap est fixe (`TOUCHE_FIXE`), P (ou la touche choisie) est l'action « pause » (lot M2). */
const estMenu = (code: string): boolean => code === TOUCHE_FIXE || commandes.actionDeTouche(code) === "pause";

/** Lot 27 : Entrée sur un bouton, un lien ou un champ est l'affaire de cet élément (il l'active), pas une commande de jeu. */
function onControl(e: KeyboardEvent): boolean {
  return typeof HTMLElement !== "undefined" && e.target instanceof HTMLElement && e.target.closest("button, a[href], input, select, textarea, [role=button]") !== null;
}

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
  private padRespawnDown = false;
  private padMenuDown = false;
  private restartLatch = false;
  private respawnLatch = false;
  private menuLatch = false;
  /** Menu ouvert : le clavier ne commande plus le personnage (lot 8). */
  private suspended = false;
  private padDir = 0;
  private touchDir = 0;
  private touchJump = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (estMenu(e.code)) {
        if (!e.repeat) this.menuLatch = true;
        return;
      }
      if (this.suspended) return; // menu ouvert : flèches et Espace vont au menu
      if (e.code === "Enter" && onControl(e)) return; // lot 27 : Entrée active le bouton qui a le focus
      if (commandes.actionDeTouche(e.code) !== null) e.preventDefault(); // Espace et flèches ne font pas défiler la page
      if (e.repeat) return;
      this.down.add(e.code);
      const action = commandes.actionDeTouche(e.code);
      if (action === "recommencer") this.restartLatch = true;
      if (action === "reprendre") this.respawnLatch = true;
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

  private has(id: string): boolean {
    return commandes.enfoncee(id, this.down);
  }

  private syncJump(): void {
    this.keyJump = this.has("sauter");
    if (this.keyJump || this.padJumpDown || this.touchJump) this.latch.press();
    else this.latch.release();
  }

  /** Lit la manette (une fois par image : elle ne prévient pas). */
  pollPad(): void {
    // Lot M1 : un menu ouvert prend la manette (un appui ne sert jamais deux fois : le A qui ferme la pause ne fait pas sauter) ; Start reste au jeu.
    const pad = padPourLeJeu(navigator.getGamepads?.().find((p): p is Gamepad => !!p && p.connected));
    this.padDir = pad ? padDirection(pad) : 0;
    const jump = pad ? commandes.enfonceeManette("sauter", pad) : false;
    if (jump !== this.padJumpDown) {
      this.padJumpDown = jump;
      this.syncJump();
    }
    const restart = pad ? commandes.enfonceeManette("recommencer", pad) : false;
    if (restart && !this.padRestartDown && !this.suspended) this.restartLatch = true;
    this.padRestartDown = restart;
    const respawn = pad ? commandes.enfonceeManette("reprendre", pad) : false;
    if (respawn && !this.padRespawnDown && !this.suspended) this.respawnLatch = true;
    this.padRespawnDown = respawn;
    const menu = !!pad && !!pad.buttons[BOUTON_FIXE]?.pressed; // Start : fixe
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
    this.respawnLatch = false;
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

  /** Demande « recommencer à zéro » (bouton tactile, pause, écran d'arrivée) : même événement que la touche Entrée. */
  requestRestart(): void {
    this.restartLatch = true;
  }

  /** Lot 27 : demande « reprendre au dernier point de passage » (bouton tactile, pause) : même événement que la touche R. */
  requestRespawn(): void {
    this.respawnLatch = true;
  }

  /** Les 3 bits du prochain pas de simulation. */
  sample(): number {
    const left = this.has("gauche") || this.padDir < 0 || this.touchDir < 0;
    const right = this.has("droite") || this.padDir > 0 || this.touchDir > 0;
    return directionBits(left, right) | (this.latch.sample() ? INPUT_JUMP : 0);
  }

  /** Vrai une fois après un appui sur Entrée (ou X à la manette). */
  takeRestart(): boolean {
    const r = this.restartLatch;
    this.restartLatch = false;
    return r;
  }

  /** Lot 27 : vrai une fois après un appui sur R (ou Y à la manette). */
  takeRespawn(): boolean {
    const r = this.respawnLatch;
    this.respawnLatch = false;
    return r;
  }

  /** Après « recommencer » : un bouton tenu ne compte pas comme un nouvel appui. */
  resetLatch(): void {
    this.latch.reset();
  }
}
