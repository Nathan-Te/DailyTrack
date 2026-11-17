import { describe, expect, it } from "vitest";
import { LANCEUR, REGLAGES, copierReglages } from "../src/index";
import { avancer, enJeu, partiePlan } from "./aide";

// LE LANCEUR AUTOMATIQUE EN MULTIBILLE (lot PBL1) : pendant la multibille, toute bille qui attend dans le couloir du lanceur — celle qu'amène le verrou au départ, ou une bille revenue par le couloir — se charge toute seule
// et part à pleine puissance. Le joueur n'a rien à tenir (la commande du lanceur n'y change rien) ; hors multibille, le lanceur ne change pas (il attend le joueur).
const partie = () => partiePlan("doublette", "foire", { 3: "mini", 4: "mini" });
/** Pas pour charger à fond : `lanceurCharge` par seconde, 1 000 de charge. */
const PAS_CHARGE = Math.ceil((1000 * 600) / REGLAGES.lanceurCharge) + 5;

describe("le lanceur part tout seul pendant la multibille", () => {
  it("au départ de la multibille, la bille du lanceur part sans que le joueur touche à rien", () => {
    const p = partie();
    p.lancerLaMultibille();
    expect(p.dansLanceur).toBe(true);
    avancer(p, PAS_CHARGE + 10);
    expect(p.dansLanceur).toBe(false);
    // elle monte le couloir : elle a quitté le bas de la table
    expect(p.y).toBeLessThan(700 * 4096);
  });

  it("une bille revenue dans le couloir en repart toute seule, à pleine puissance", () => {
    const p = partie();
    p.lancerLaMultibille();
    avancer(p, 2000); // le départ et les deux billes lâchées
    // la bille principale est posée dans le couloir du lanceur, à l'arrêt (comme une bille qui y est revenue)
    enJeu(p, 360.5, 718, 0, 0);
    p.dansLanceur = true;
    p.charge = 0;
    avancer(p, 2);
    expect(p.dansLanceur).toBe(true); // elle se charge
    expect(p.charge).toBeGreaterThan(0);
    avancer(p, PAS_CHARGE);
    expect(p.dansLanceur).toBe(false);
  });

  it("hors multibille, rien ne change : la bille attend le joueur, aussi longtemps qu'il le faut", () => {
    const p = partie();
    avancer(p, 6000);
    expect(p.dansLanceur).toBe(true);
    expect(p.charge).toBe(0);
    // et le lanceur tenu puis relâché la lance, comme avant
    p.regler(LANCEUR, true);
    avancer(p, 300);
    p.regler(LANCEUR, false);
    avancer(p, 5);
    expect(p.dansLanceur).toBe(false);
  });

  it("la commande du lanceur n'y change rien : tenue ou non, le départ a lieu au même pas", () => {
    const sans = partie();
    sans.lancerLaMultibille();
    const avec = partie();
    avec.lancerLaMultibille();
    avec.regler(LANCEUR, true);
    let pasSans = -1;
    let pasAvec = -1;
    for (let i = 0; i < 3000; i++) {
      sans.avancer();
      avec.avancer();
      if (pasSans < 0 && !sans.dansLanceur) pasSans = i;
      if (pasAvec < 0 && !avec.dansLanceur) pasAvec = i;
    }
    expect(pasSans).toBeGreaterThan(0);
    expect(pasAvec).toBe(pasSans);
  });

  it("pendant toute une multibille sans toucher à rien, aucune bille ne reste au lanceur plus de deux temps de charge (la file des billes qui y attendent)", () => {
    const p = partie();
    p.lancerLaMultibille();
    let attente = 0;
    let pire = 0;
    for (let i = 0; i < 20000 && p.multibille; i++) {
      p.avancer();
      const enAttente = (!p.vide && p.dansLanceur) || p.autres.some((b) => b.dansLanceur);
      attente = enAttente ? attente + 1 : 0;
      pire = Math.max(pire, attente);
    }
    expect(pire).toBeLessThanOrEqual(2 * PAS_CHARGE + 20);
  });

  it("quand la multibille finit, une bille que le lanceur chargeait attend de nouveau le joueur (jamais un départ à demi-puissance)", () => {
    const r = copierReglages();
    const p = partiePlan("doublette", "foire", { 3: "mini", 4: "mini" }, r);
    p.lancerLaMultibille();
    avancer(p, 200); // la charge est à moitié
    expect(p.dansLanceur).toBe(true);
    expect(p.charge).toBeGreaterThan(0);
    // la multibille se termine (le test la termine d'autorité, comme quand il ne reste qu'une bille)
    (p as unknown as { finMultibille(): void }).finMultibille();
    expect(p.multibille).toBe(false);
    expect(p.charge).toBe(0);
    avancer(p, 3000);
    expect(p.dansLanceur).toBe(true);
  });
});
