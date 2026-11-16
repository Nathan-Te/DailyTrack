import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EV_BONUS, EV_BOUCLIER, EV_GEMME, EV_INVERSION, EV_MANQUEE, EV_MORT, EV_PIECE } from "@cdj/gravity-sim";
import { Sons, type ContexteAudio } from "../src/sons";
import { hauteurPalier, hauteurPiece, niveauEffets, notesDe, sonsDuPas, type Photo } from "../src/sonsLogique";

// Lot GR4 — les sons : la décision est pure (`sonsLogique.ts`), la lecture est un contexte qu'on peut remplacer ; la règle S2 (le son se mêle à celui du téléphone) tient au code, pas à l'oreille.
const base: Photo = { g: 1, mult: 1, chaine: 0, bouclier: false, aimant: 0 };

describe("« Gravity » : quel son pour quel événement", () => {
  it("une inversion, une pièce, une gemme et la mort donnent chacune leur son", () => {
    expect(sonsDuPas(EV_INVERSION, base, { ...base, g: -1 })).toEqual([{ son: "inversion", vers: "haut" }]);
    expect(sonsDuPas(EV_INVERSION, { ...base, g: -1 }, base)).toEqual([{ son: "inversion", vers: "bas" }]);
    expect(sonsDuPas(EV_PIECE, base, { ...base, chaine: 3 })).toEqual([{ son: "piece", chaine: 3 }]);
    expect(sonsDuPas(EV_GEMME, base, base)).toEqual([{ son: "gemme" }]);
    expect(sonsDuPas(EV_MORT, base, base)).toEqual([{ son: "mort" }]);
    expect(sonsDuPas(EV_BOUCLIER, { ...base, bouclier: true }, base)).toEqual([{ son: "bouclierConsomme" }]);
    expect(sonsDuPas(0, base, base)).toEqual([]);
  });
  it("un palier du multiplicateur s'entend avec la pièce qui l'a donné ; sa chute seulement s'il retombe de ×2 ou plus", () => {
    expect(sonsDuPas(EV_PIECE, { ...base, mult: 1, chaine: 9 }, { ...base, mult: 2, chaine: 10 }).map((s) => s.son)).toEqual(["piece", "palier"]);
    expect(sonsDuPas(EV_MANQUEE, { ...base, mult: 3, chaine: 25 }, base)).toEqual([{ son: "chute" }]);
    expect(sonsDuPas(EV_MANQUEE, base, base)).toEqual([]); // à ×1, une pièce ratée ne coûte rien : rien à dire
  });
  it("un bonus pris dit lequel : le bouclier s'il vient d'apparaître, l'aimant sinon", () => {
    expect(sonsDuPas(EV_BONUS, base, { ...base, bouclier: true })).toEqual([{ son: "bonus", quoi: "bouclier" }]);
    expect(sonsDuPas(EV_BONUS, base, { ...base, aimant: 960 })).toEqual([{ son: "bonus", quoi: "aimant" }]);
  });
  it("la hauteur d'une pièce monte doucement avec la série (une octave au plus) et celle d'un palier avec le multiplicateur", () => {
    const h = [0, 1, 2, 10, 24, 80].map(hauteurPiece);
    for (let i = 1; i < h.length; i++) expect(h[i]!).toBeGreaterThanOrEqual(h[i - 1]!);
    expect(h[1]! / h[0]!).toBeLessThan(1.03); // moins d'un demi-ton d'une pièce à la suivante
    expect(h[4]! / h[0]!).toBeCloseTo(2, 5);
    expect(h[5]).toBe(h[4]);
    expect(hauteurPalier(3)).toBeGreaterThan(hauteurPalier(2));
    expect(hauteurPalier(5)).toBeGreaterThan(hauteurPalier(4));
  });
  it("net mais pas punitif : jamais d'onde carrée, aucun niveau au-dessus de 0,3, et la chute descend", () => {
    const tous = [
      { son: "inversion", vers: "haut" },
      { son: "inversion", vers: "bas" },
      { son: "inverseur", vers: "haut" },
      { son: "atterrissage" },
      { son: "piece", chaine: 5 },
      { son: "palier", mult: 3 },
      { son: "chute" },
      { son: "gemme" },
      { son: "bonus", quoi: "bouclier" },
      { son: "bonus", quoi: "aimant" },
      { son: "bouclierConsomme" },
      { son: "mort" },
      { son: "theme" },
    ] as const;
    for (const e of tous) {
      const notes = notesDe(e);
      expect(notes.length, e.son).toBeGreaterThan(0);
      for (const n of notes) {
        expect(["sine", "triangle"]).toContain(n.onde);
        expect(n.g).toBeLessThanOrEqual(0.3);
        expect(n.d).toBeGreaterThan(0);
      }
    }
    const chute = notesDe({ son: "chute" });
    expect(chute[1]!.f).toBeLessThan(chute[0]!.f);
  });
  it("le volume des effets : 0 ou illisible ne joue rien, et il ne dépasse jamais 1", () => {
    expect(niveauEffets(0)).toBe(0);
    expect(niveauEffets(Number.NaN)).toBe(0);
    expect(niveauEffets(0.4)).toBe(0.4);
    expect(niveauEffets(3)).toBe(1);
  });
});

/** Un faux contexte audio : compte les oscillateurs lancés. */
function faux(etat: "suspended" | "running"): { ctx: ContexteAudio; oscillateurs: number; reveils: number } {
  const suivi = { oscillateurs: 0, reveils: 0 };
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const ctx = {
    state: etat,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    resume() {
      suivi.reveils++;
      (ctx as { state: string }).state = "running";
      return Promise.resolve();
    },
    createGain: () => ({ gain: param, connect() {} }) as unknown as GainNode,
    createOscillator: () => {
      suivi.oscillateurs++;
      return { type: "sine", frequency: param, connect() {}, start() {}, stop() {} } as unknown as OscillatorNode;
    },
  } as unknown as ContexteAudio;
  return Object.assign(suivi, { ctx }) as { ctx: ContexteAudio; oscillateurs: number; reveils: number };
}

describe("« Gravity » : la lecture", () => {
  it("aucun son avant le premier geste ; le geste crée le contexte et le réveille", async () => {
    const f = faux("suspended");
    let creations = 0;
    const sons = new Sons({ niveau: () => 1, creerContexte: () => (creations++, f.ctx) });
    sons.jouer({ son: "gemme" });
    expect(f.oscillateurs).toBe(0);
    expect(creations).toBe(0);
    sons.deverrouiller();
    sons.deverrouiller();
    expect(creations).toBe(1); // une seule fois
    await Promise.resolve();
    sons.jouer({ son: "gemme" });
    expect(f.oscillateurs).toBe(notesDe({ son: "gemme" }).length);
  });
  it("le volume des effets à 0 coupe tout (et rien n'est noté), et le niveau est relu à chaque son", () => {
    const f = faux("running");
    let volume = 0;
    const sons = new Sons({ niveau: () => volume, creerContexte: () => f.ctx });
    sons.deverrouiller();
    sons.jouer({ son: "mort" });
    expect(f.oscillateurs).toBe(0);
    expect(sons.joues).toEqual([]);
    volume = 0.5;
    sons.jouer({ son: "mort" });
    expect(f.oscillateurs).toBeGreaterThan(0);
    expect(sons.joues.map((s) => s.son)).toEqual(["mort"]);
  });
  it("sans Web Audio, rien ne casse", () => {
    const sons = new Sons({ niveau: () => 1, creerContexte: () => null });
    sons.deverrouiller();
    expect(() => sons.jouer({ son: "inversion", vers: "haut" })).not.toThrow();
  });
  it("règle S2 : le contexte s'ouvre par `ouvrirContexteAudio`, jamais par un élément média ni `new AudioContext`", () => {
    const code = readFileSync(new URL("../src/sons.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
    expect(code).toContain("ouvrirContexteAudio");
    expect(code).not.toMatch(/new\s+(?:Audio|AudioContext|webkitAudioContext)\s*\(|createMediaElementSource|mediaSession|["']playback["']/);
  });
});
