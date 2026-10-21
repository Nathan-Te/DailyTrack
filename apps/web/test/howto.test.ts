import { describe, expect, it } from "vitest";
import { CATALOGUE_TRACK } from "../src/catalogue";
import { GAMEPAD_CONTROLS, HOWTO_POINTS, KEYBOARD_BASICS, KEYBOARD_CONTROLS, type Control } from "../src/howto";

// « Comment jouer » dans le jeu (retouche du lot I4, charte rév. 7) : trois points courts par appareil, les textes viennent du catalogue (fr + en).
const texte = (langue: "fr" | "en", cle: string): string | undefined => {
  const v = CATALOGUE_TRACK[langue][cle];
  return typeof v === "string" ? v : undefined; // les points et les légendes sont des textes simples (pas de pluriel)
};
const cles = (list: Control[]) => list.flatMap((c) => [c.does, ...c.keys.filter((k) => k.startsWith("aide."))]);

describe("l'aide « Comment jouer »", () => {
  it("trois points par appareil, tous traduits en français et en anglais, courts", () => {
    for (const device of ["touch", "keyboard"] as const) {
      expect(HOWTO_POINTS[device]).toHaveLength(3);
      for (const cle of HOWTO_POINTS[device])
        for (const langue of ["fr", "en"] as const) {
          const s = texte(langue, cle);
          expect(s, `${langue} ${cle}`).toBeTruthy();
          expect(s!.length, `${langue} ${cle} : « ${s} »`).toBeLessThanOrEqual(80);
        }
    }
  });

  it("le but est le même partout ; tourner et gaz / frein disent où poser les doigts ou quelles touches", () => {
    expect(HOWTO_POINTS.touch[2]).toBe(HOWTO_POINTS.keyboard[2]);
    expect(texte("fr", HOWTO_POINTS.touch[0]!)).toContain("bas à gauche");
    expect(texte("fr", HOWTO_POINTS.touch[1]!)).toContain("bas à droite");
    expect(texte("en", HOWTO_POINTS.touch[0]!)).toContain("bottom left");
    expect(texte("en", HOWTO_POINTS.touch[1]!)).toContain("bottom right");
  });

  it("les listes de commandes ne citent que des clés du catalogue (touches et actions)", () => {
    for (const k of [...cles(KEYBOARD_CONTROLS), ...cles(GAMEPAD_CONTROLS), ...cles(KEYBOARD_BASICS)])
      for (const langue of ["fr", "en"] as const) expect(texte(langue, k), `${langue} ${k}`).toBeTruthy();
  });

  it("le bouton de fin et la légende du schéma sont traduits", () => {
    for (const cle of ["aide.parti", "aide.titre", "aide.schema.legende", "aide.zone.libre", "aide.zone.frein", "aide.zone.gaz"])
      for (const langue of ["fr", "en"] as const) expect(texte(langue, cle), `${langue} ${cle}`).toBeTruthy();
    expect(texte("fr", "aide.parti")).toBe("C'est parti");
    expect(texte("en", "aide.parti")).toBe("Let's go");
  });
});
