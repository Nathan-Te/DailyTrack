import { makeInput, type CarInput } from "@cdj/sim";
import { BOUTON_FIXE, liaisonTenue } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { commandes } from "./commandes";
import type { TouchPad } from "./touch";

/** Axes bruts du joueur (flottants), avant quantification en commandes de simulation. */
export interface Axes {
  steer: number; // [-1, 1], positif = droite
  throttle: number; // [0, 1]
  brake: number; // [0, 1]
}

// Lot M2 : les touches viennent des commandes (`commandes.ts`, réglables) ; `event.code` désigne la touche physique : KeyW/KeyA/KeyS/KeyD sont aussi ZQSD sur un clavier AZERTY.

/** Vrai si la touche est tapée dans un champ de saisie (le pseudo). */
export function isTyping(e: Event): boolean {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}

export function keyboardAxes(down: ReadonlySet<string>): Axes {
  return {
    steer: (commandes.enfoncee("droite", down) ? 1 : 0) - (commandes.enfoncee("gauche", down) ? 1 : 0),
    throttle: commandes.enfoncee("accelerer", down) ? 1 : 0,
    brake: commandes.enfoncee("freiner", down) ? 1 : 0,
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

/** Une action tenue à la manette : un bouton (une gâchette compte dès `TRIGGER_ON`) ou un axe au-delà de son seuil (lot M2 : le bouton est celui que le joueur a choisi). */
function padTenu(id: string, pad: Pick<Gamepad, "axes" | "buttons">): boolean {
  const l = commandes.liaison(id);
  if (!l) return false;
  return l[0] === "b" ? (pad.buttons[Number(l.slice(1))]?.value ?? 0) > TRIGGER_ON : liaisonTenue(l, pad);
}

/** Manette « standard » : stick gauche (analogique) ou croix pour tourner (fixes) ; l'accélérateur et le frein sont les boutons choisis (d'origine RT et LT). */
export function gamepadAxes(pad: Pick<Gamepad, "axes" | "buttons">): Axes {
  const btn = (i: number) => pad.buttons[i]?.value ?? 0;
  const dpad = btn(15) - btn(14);
  const stick = deadzone(pad.axes[0] ?? 0);
  return {
    steer: Math.abs(dpad) > Math.abs(stick) ? dpad : stick,
    throttle: padTenu("accelerer", pad) ? 1 : 0,
    brake: padTenu("freiner", pad) ? 1 : 0,
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
  private padPauseHeld = false;
  private padCameraHeld = false;

  /** `touch` : l'interface tactile, si elle est active — ses axes s'ajoutent à ceux du clavier et de la manette. */
  constructor(
    target: Window = window,
    private readonly touch: TouchPad | null = null,
  ) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat || isTyping(e)) return; // on tape son pseudo : les touches ne sont pas des commandes
      const action = commandes.actionDeTouche(e.code);
      if (action !== null && ["gauche", "droite", "accelerer", "freiner", "point", "recommencer", "camera", "pause"].includes(action)) e.preventDefault();
      this.down.add(e.code);
      if (action === "point") this.respawnLatch = true;
      if (action === "recommencer") this.restartLatch = true;
      if (action === "camera") this.cameraLatch = true;
      if (action === "pause") this.pauseLatch = true;
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
    // Lot M1 : un menu ouvert prend la manette (un appui ne sert jamais deux fois) ; `padPourLeJeu` rend la manette inchangée sans le module des menus.
    const pad = padPourLeJeu(navigator.getGamepads?.().find((p): p is Gamepad => !!p && p.connected));
    const g = pad ? gamepadAxes(pad) : { steer: 0, throttle: 0, brake: 0 };

    // Manette : Y = dernier point de contrôle, X = depuis le départ, Start = pause (sur front montant). Avant le lot 29, Start recommençait :
    // il ouvre maintenant le menu de pause, qui propose « Recommencer ».
    const padRespawn = !!pad && commandes.enfonceeManette("point", pad);
    const padRestart = !!pad && commandes.enfonceeManette("recommencer", pad);
    const padPause = !!pad && (pad.buttons[BOUTON_FIXE]?.pressed ?? false); // Start : fixe
    if (padRespawn && !this.padRespawnHeld) this.respawnLatch = true;
    if (padRestart && !this.padRestartHeld) this.restartLatch = true;
    if (padPause && !this.padPauseHeld) this.pauseLatch = true;
    this.padRespawnHeld = padRespawn;
    this.padRestartHeld = padRestart;
    this.padPauseHeld = padPause;
    // Vue/Select (bouton 8) : caméra suivante.
    const padCamera = !!pad && commandes.enfonceeManette("camera", pad);
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
