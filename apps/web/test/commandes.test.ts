import { makeInput } from "@cdj/sim";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { definirLiaison, definirTouche, retablir } from "@cdj/ui/src/commandesEdition";
import { ACTIONS_TRACK, commandes } from "../src/commandes";
import { Controls, gamepadAxes, keyboardAxes } from "../src/input";

// Lot M2 : les commandes réglables de Track ne changent rien pour la simulation : mêmes axes, mêmes `CarInput` (donc mêmes rediffusions) avec d'autres touches.
const pad = (axes: number[], pressed: Record<number, number> = {}) =>
  ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ value: pressed[i] ?? 0, pressed: !!pressed[i], touched: false })) }) as unknown as Pick<Gamepad, "axes" | "buttons">;

describe("commandes réglables de Track (lot M2)", () => {
  beforeAll(() => {
    vi.stubGlobal("HTMLInputElement", class {}); // `isTyping` (Node n'a pas de DOM)
    vi.stubGlobal("HTMLTextAreaElement", class {});
  });
  afterEach(() => retablir(commandes));

  it("les actions et leurs touches d'origine", () => {
    expect(Object.fromEntries(ACTIONS_TRACK.map((a) => [a.id, [a.clavier, a.manette]]))).toEqual({
      gauche: [["ArrowLeft", "KeyA"], null],
      droite: [["ArrowRight", "KeyD"], null],
      accelerer: [["ArrowUp", "KeyW"], "b7"],
      freiner: [["ArrowDown", "KeyS", "Space"], "b6"],
      point: [["KeyR"], "b3"],
      recommencer: [["Enter"], "b2"],
      camera: [["KeyC"], "b8"],
      pause: [["KeyP"], null],
      classement: [["KeyL"], null],
      fantome: [["KeyG"], null],
      son: [["KeyM"], null],
    });
  });

  it("des touches changées : mêmes axes, donc les mêmes commandes entières de la simulation", () => {
    const avant = [keyboardAxes(new Set(["KeyW", "KeyD"])), keyboardAxes(new Set(["Space", "KeyA"]))];
    definirTouche(commandes, "accelerer", 1, "KeyI");
    definirTouche(commandes, "droite", 1, "KeyL"); // KeyL était « classement » : elle reçoit KeyD
    definirTouche(commandes, "freiner", 2, "KeyK");
    definirTouche(commandes, "gauche", 1, "KeyJ");
    const apres = [keyboardAxes(new Set(["KeyI", "KeyL"])), keyboardAxes(new Set(["KeyK", "KeyJ"]))];
    expect(apres).toEqual(avant);
    for (let i = 0; i < avant.length; i++) expect(makeInput(apres[i]!.steer, apres[i]!.throttle, apres[i]!.brake)).toEqual(makeInput(avant[i]!.steer, avant[i]!.throttle, avant[i]!.brake));
    expect(keyboardAxes(new Set(["KeyW"])).throttle).toBe(0); // l'ancienne touche ne commande plus
  });

  it("à la manette : l'accélérateur et le frein suivent les boutons choisis (seuil 0,3), le stick tourne toujours", () => {
    expect(gamepadAxes(pad([0], { 7: 0.6 })).throttle).toBe(1);
    definirLiaison(commandes, "accelerer", "b0");
    definirLiaison(commandes, "freiner", "b1");
    expect(gamepadAxes(pad([0], { 7: 0.6 })).throttle).toBe(0); // RT n'accélère plus
    expect(gamepadAxes(pad([0.8], { 0: 1, 1: 1 }))).toMatchObject({ throttle: 1, brake: 1 });
    expect(gamepadAxes(pad([0.8], { 0: 1 })).steer).toBeGreaterThan(0.5);
  });

  it("la touche choisie d'une action sert (R devient « point de contrôle » sur une autre touche), Échap reste fixe", () => {
    definirTouche(commandes, "point", 0, "KeyU");
    const cible = new EventTarget();
    const c = new Controls(cible as unknown as Window);
    const bas = (code: string) => cible.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code, repeat: false }));
    bas("KeyR");
    expect(c.poll().input.respawn).toBeFalsy();
    bas("KeyU");
    expect(c.poll().input.respawn).toBeTruthy();
    expect(definirTouche(commandes, "point", 0, "Escape")).toEqual({ ok: false, raison: "fixe" });
  });
});
