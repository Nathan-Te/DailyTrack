import { DEFAULT_JUMP_PARAMS, ESSAI_LEVEL, attemptReplay, encodeReplay } from "@cdj/jump-sim";
import { afterEach, describe, expect, it } from "vitest";
import { ACTIONS_JUMP, commandes } from "../src/commandes";
import { Controls } from "../src/input";
import { JumpSession } from "../src/session";
import "./francais";
import { definirTouche, retablir } from "@cdj/ui/src/commandesEdition";

// Lot M2 : les commandes réglables ne changent rien pour la simulation : la correspondance touche → action se fait AVANT les bits de commande. Même partie jouée avec d'autres touches = même rediffusion.
const TICKS = 240;
// Le scénario du joueur, en intentions : tenir « droite », sauter aux ticks 20 à 50 et 120 à 125, tenir « gauche » entre 150 et 200, recommencer jamais.
type Evt = { tick: number; action: "droite" | "gauche" | "sauter"; bas: boolean };
const SCENARIO: Evt[] = [
  { tick: 0, action: "droite", bas: true },
  { tick: 20, action: "sauter", bas: true },
  { tick: 50, action: "sauter", bas: false },
  { tick: 120, action: "sauter", bas: true },
  { tick: 125, action: "sauter", bas: false },
  { tick: 150, action: "droite", bas: false },
  { tick: 150, action: "gauche", bas: true },
  { tick: 200, action: "gauche", bas: false },
];

/** Joue le scénario avec les touches ACTUELLES de chaque action (la première de l'action) et rend les bits enregistrés, tick par tick. */
function bitsJoues(): number[] {
  const cible = new EventTarget();
  const c = new Controls(cible as unknown as Window);
  const bits: number[] = [];
  for (let tick = 0; tick < TICKS; tick++) {
    for (const e of SCENARIO.filter((x) => x.tick === tick)) {
      const code = commandes.touches(e.action)[0]!;
      cible.dispatchEvent(Object.assign(new Event(e.bas ? "keydown" : "keyup", { cancelable: true }), { code, repeat: false }));
    }
    bits.push(c.sample());
  }
  return bits;
}

describe("commandes réglables : la simulation ne voit rien (lot M2)", () => {
  afterEach(() => retablir(commandes));

  it("des touches changées donnent exactement les mêmes bits, la même rediffusion et le même résultat", () => {
    const origine = bitsJoues();
    expect(origine.some((b) => b !== 0)).toBe(true);
    const rediffOrigine = encodeReplay(attemptReplay("essai", origine));

    definirTouche(commandes, "sauter", 0, "KeyZ");
    definirTouche(commandes, "droite", 0, "KeyK");
    definirTouche(commandes, "gauche", 0, "KeyJ");
    expect(commandes.touches("sauter")[0]).toBe("KeyZ");
    const change = bitsJoues();
    expect(change).toEqual(origine);
    expect(encodeReplay(attemptReplay("essai", change))).toBe(rediffOrigine);

    const jouer = (bits: number[]) => {
      const s = new JumpSession(ESSAI_LEVEL, { ...DEFAULT_JUMP_PARAMS }, "essai");
      s.go();
      for (const b of bits) s.step(b);
      return { etat: s.state, deaths: s.deaths };
    };
    expect(jouer(change)).toEqual(jouer(origine));
  });

  it("une touche échangée fait agir l'ancienne action de l'autre : les bits suivent l'action, jamais la touche", () => {
    definirTouche(commandes, "sauter", 0, "KeyA"); // KeyA était « gauche » : elle reçoit Espace
    expect(commandes.touches("gauche")).toContain("Space");
    const cible = new EventTarget();
    const c = new Controls(cible as unknown as Window);
    cible.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyA", repeat: false }));
    expect(c.sample() & 4).toBe(4); // INPUT_JUMP
  });

  it("l'ancienne touche d'une action ne la commande plus", () => {
    definirTouche(commandes, "sauter", 2, "KeyZ"); // KeyW perd son rôle
    const cible = new EventTarget();
    const c = new Controls(cible as unknown as Window);
    cible.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyW", repeat: false }));
    expect(c.sample()).toBe(0);
  });

  it("Échap ouvre toujours la pause (fixe) ; la touche « pause » choisie aussi", () => {
    definirTouche(commandes, "pause", 0, "KeyO");
    const cible = new EventTarget();
    const c = new Controls(cible as unknown as Window);
    cible.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code: "Escape", repeat: false }));
    expect(c.takeMenu()).toBe(true);
    cible.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyO", repeat: false }));
    expect(c.takeMenu()).toBe(true);
    cible.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code: "KeyP", repeat: false }));
    expect(c.takeMenu()).toBe(false);
  });

  it("les actions de Jump sont déclarées avec leurs touches d'origine", () => {
    const origine = Object.fromEntries(ACTIONS_JUMP.map((a) => [a.id, [a.clavier, a.manette]]));
    expect(origine).toEqual({
      gauche: [["ArrowLeft", "KeyA"], null],
      droite: [["ArrowRight", "KeyD"], null],
      sauter: [["Space", "ArrowUp", "KeyW"], "b0"],
      reprendre: [["KeyR"], "b3"],
      recommencer: [["Enter"], "b2"],
      pause: [["KeyP"], null],
      fantome: [["KeyG"], null],
    });
  });
});
