import { describe, expect, it } from "vitest";
import { MODE_AVION, MODE_GRAVITE, MODE_ONDE, MODE_RESSORT } from "@cdj/gravity-sim";
import { couleursGravity } from "../src/couleurs";
import { COMPRESSION_ATTERRISSAGE, Heros, PART_INCLINAISON_AVION, angleDeTrajectoire, hauteurDuRessort, type PoseHeros } from "../src/heros";

// Lot GR6 — le héros de chaque mode : l'avion s'incline avec sa montée, l'onde est penchée à 45° dans le sens de sa trajectoire avec sa traînée d'encre, le ressort se comprime au bond et à l'atterrissage ; les transitions sont douces.
// Rien n'est dessiné ici (pas de moteur de rendu) : on lit la pose que le dessin donne aux groupes de Three.js.
const pose = (p: Partial<PoseHeros> = {}): PoseHeros => ({ x: 10, y: -6, g: 1, sol: false, vx: 10, chute: 0, tick: 0, temps: 0, dt: 1 / 60, invuln: 0, bouclier: false, aimant: 0, mort: false, reduit: false, mode: MODE_GRAVITE, vyUp: 0, ...p });
/** Joue `n` images de la même pose. */
const jouer = (h: Heros, n: number, p: Partial<PoseHeros>): void => {
  for (let i = 0; i < n; i++) h.poser(pose({ ...p, tick: i, temps: i / 60 }));
};
// le groupe qui penche le héros est le deuxième enfant du groupe (cercle de l'aimant, `incl`, aura) ; l'avion et le ressort sont les enfants de son enfant `flip`
const incl = (h: Heros) => h.groupe.children[1]!;
const flip = (h: Heros) => incl(h).children[0]!;
const avion = (h: Heros) => flip(h).children[1]!;
const ressort = (h: Heros) => flip(h).children[2]!;

describe("les angles et le ressort", () => {
  it("l'angle de la trajectoire est celui de la montée par rapport à la course (45° pour l'onde)", () => {
    expect(angleDeTrajectoire(10, 10)).toBeCloseTo(Math.PI / 4, 6);
    expect(angleDeTrajectoire(10, -10)).toBeCloseTo(-Math.PI / 4, 6);
    expect(angleDeTrajectoire(10, 0)).toBe(0);
  });
  it("le ressort est plus court écrasé que détendu, et reste borné", () => {
    expect(hauteurDuRessort(1)).toBeLessThan(hauteurDuRessort(0));
    expect(hauteurDuRessort(0)).toBeLessThan(hauteurDuRessort(-0.4));
    expect(hauteurDuRessort(50)).toBe(hauteurDuRessort(1));
    expect(hauteurDuRessort(1)).toBeGreaterThan(0);
  });
});

describe("le héros par mode", () => {
  it("en gravité : ni avion, ni ressort, ni traînée, le cube droit", () => {
    const h = new Heros(couleursGravity());
    jouer(h, 30, {});
    expect(avion(h).visible).toBe(false);
    expect(ressort(h).visible).toBe(false);
    expect(h.traine.visible).toBe(false);
    expect(incl(h).rotation.z).toBe(0);
  });
  it("en avion : l'avion en papier apparaît doucement, le cube rapetisse, et l'avion s'incline avec la montée (vers le haut en montant, vers le bas en descendant)", () => {
    const h = new Heros(couleursGravity());
    jouer(h, 1, { mode: MODE_AVION });
    expect(avion(h).scale.x).toBeLessThan(0.8); // pas d'un coup
    jouer(h, 40, { mode: MODE_AVION, vyUp: 6 });
    expect(avion(h).visible).toBe(true);
    expect(avion(h).scale.x).toBeCloseTo(1, 1);
    expect(incl(h).rotation.z).toBeCloseTo(angleDeTrajectoire(10, 6) * PART_INCLINAISON_AVION, 1);
    expect(incl(h).rotation.z).toBeGreaterThan(0.1);
    jouer(h, 60, { mode: MODE_AVION, vyUp: -6 });
    expect(incl(h).rotation.z).toBeLessThan(-0.1);
    expect(Math.abs(incl(h).rotation.z)).toBeLessThan(0.6); // jamais plus que ≈ 30°
    jouer(h, 90, { mode: MODE_GRAVITE });
    expect(avion(h).visible).toBe(false); // il s'efface en sortant du mode
    expect(incl(h).rotation.z).toBeCloseTo(0, 2);
  });
  it("« réduire les animations » : l'avion ne penche pas", () => {
    const h = new Heros(couleursGravity());
    jouer(h, 60, { mode: MODE_AVION, vyUp: 6, reduit: true });
    expect(incl(h).rotation.z).toBeCloseTo(0, 3);
  });
  it("en onde : le cube est penché à 45° vers le haut en montant, à −45° en descendant", () => {
    const h = new Heros(couleursGravity());
    jouer(h, 60, { mode: MODE_ONDE, vyUp: 10, vx: 10 });
    expect(incl(h).rotation.z).toBeCloseTo(Math.PI / 4, 1);
    jouer(h, 60, { mode: MODE_ONDE, vyUp: -10, vx: 10 });
    expect(incl(h).rotation.z).toBeCloseTo(-Math.PI / 4, 1);
    jouer(h, 60, { mode: MODE_ONDE, vyUp: 0, vx: 10 });
    expect(incl(h).rotation.z).toBeCloseTo(0, 1); // à plat contre le sol : il glisse
  });
  it("la traînée de l'onde garde un point à chaque changement de sens, suit le héros, et reste dans le monde quand le mode finit", () => {
    const h = new Heros(couleursGravity());
    // une onde de quatre pas : on monte, on descend, on monte
    const pas = (x: number, y: number, vyUp: number, mode = MODE_ONDE): void => h.avancerPas(0.08, false, mode, x, y, vyUp);
    pas(10, -6, 10);
    pas(10.1, -5.9, 10);
    pas(10.2, -5.8, -10); // virage
    pas(10.3, -5.9, -10);
    pas(10.4, -6.0, 10); // virage
    jouer(h, 1, { mode: MODE_ONDE, x: 10.4, y: -6, vyUp: 10 });
    expect(h.traine.visible).toBe(true);
    expect(h.traine.geometry.drawRange.count).toBe(3 * 6); // trois segments : départ → virage → virage → tête
    pas(10.5, -5.9, 0, MODE_GRAVITE); // il sort de l'onde : la dernière arête est posée
    jouer(h, 1, { mode: MODE_GRAVITE, x: 12, y: -6 });
    expect(h.traine.visible).toBe(true); // l'encre reste dans le monde
    expect(h.traine.geometry.drawRange.count).toBe(3 * 6);
  });
  it("la traînée s'efface à la mort et ne garde jamais plus de points que son tampon", () => {
    const h = new Heros(couleursGravity());
    for (let i = 0; i < 200; i++) h.avancerPas(0.08, false, MODE_ONDE, 10 + i * 0.1, -6, i % 2 === 0 ? 10 : -10);
    jouer(h, 1, { mode: MODE_ONDE, x: 30, y: -6, vyUp: 10 });
    expect(h.traine.geometry.drawRange.count).toBeLessThanOrEqual(24 * 6);
    h.poser(pose({ mort: true }));
    expect(h.traine.visible).toBe(false);
  });
  it("en ressort : le ressort sous le cube ; il se comprime à l'atterrissage et au bond, se détend en l'air, et la compression ne dure pas", () => {
    const h = new Heros(couleursGravity());
    jouer(h, 40, { mode: MODE_RESSORT, sol: true });
    expect(ressort(h).visible).toBe(true);
    const fil = ressort(h).children[0]!;
    const repos = fil.scale.y;
    h.atterrir();
    jouer(h, 1, { mode: MODE_RESSORT, sol: true });
    expect(fil.scale.y).toBeCloseTo(hauteurDuRessort(COMPRESSION_ATTERRISSAGE), 1);
    expect(fil.scale.y).toBeLessThan(repos); // écrasé
    for (let i = 0; i < 90; i++) h.avancerPas(0.08, true, MODE_RESSORT, 10, -6, 0); // il se détend (90 pas : 0,75 s)
    jouer(h, 1, { mode: MODE_RESSORT, sol: true });
    expect(fil.scale.y).toBeCloseTo(repos, 1);
    h.bondir();
    jouer(h, 1, { mode: MODE_RESSORT });
    expect(fil.scale.y).toBeLessThan(repos);
    for (let i = 0; i < 120; i++) h.avancerPas(0.08, false, MODE_RESSORT, 10, -6, 5); // en l'air : détendu
    jouer(h, 1, { mode: MODE_RESSORT });
    expect(fil.scale.y).toBeGreaterThan(repos);
  });
});
