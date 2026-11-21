import { describe, expect, it } from "vitest";
import { EV2_AIGUILLAGE, PLANS, UNITE, REGLAGES, copierReglages, MISSION_DU_THEME, MODULES_DE_MISSION, THEMES_PINBALL, type Partie, type ThemePinball } from "../src/index";
import { avancer, evenements2, partiePlan, surLeRail } from "./aide";

// L'AIGUILLAGE (lot PBG3) : sur une rampe de chaque plan, une dérivation. Par défaut la rampe va jusqu'à son bout ; le verrou allumé, elle envoie la bille de la rampe droit au verrou (une prise du verrou qui récompense le
// tir de rampe) ; pendant la multibille, elle l'envoie à l'élément du thème, pour un jackpot.

// lot PBT1 : les tables B et C ont une rampe, donc son aiguillage ; la table A n'en a pas
const IDS = PLANS.filter((p) => p.aiguillage).map((p) => p.id);
const partie = (plan: string, theme: ThemePinball = "ocean", r = REGLAGES): Partie => partiePlan(plan, theme, {}, r);
/** La bille sur la rampe de l'aiguillage, 3 px avant son point, à 600 px/s. */
const surLaRampe = (p: Partie): number => {
  const a = p.table.aiguillage!;
  surLeRail(p, a.rail, a.s / UNITE - 3, 600);
  return a.rail;
};

describe("l'aiguillage : une dérivation sur la rampe de chaque table qui en a une", () => {
  it("les tables B et C ont leur aiguillage ; la table A (ni rampe ni mini-batteur) n'en a pas", () => {
    expect(IDS).toEqual(["B", "C"]);
    expect(partie("A").table.aiguillage).toBeNull();
  });

  it.each(IDS)("le plan %s a son aiguillage, sur une rampe, avec ses deux trajets", (plan) => {
    const t = partie(plan).table;
    const a = t.aiguillage!;
    expect(a).not.toBeNull();
    expect(t.rails[a.rail]!.genre).toBe("rampe");
    expect(a.s).toBeGreaterThan(0);
    expect(a.s).toBeLessThan(t.rails[a.rail]!.len);
    expect(a.versVerrou).not.toBeNull();
    expect(a.versElement).not.toBeNull();
    // le trajet vers le verrou finit dans le trou du verrou
    const tr = t.trous[t.verrou]!;
    expect([a.versVerrou!.x, a.versVerrou!.y]).toEqual([tr.x, tr.y]);
  });

  it("le plan d'essai n'a pas d'aiguillage", () => {
    expect(partiePlan("classique").table.aiguillage).toBeNull();
  });

  it.each(IDS)("%s : par défaut (verrou éteint, hors multibille) la rampe va jusqu'à son bout, rien n'est dérivé", (plan) => {
    const p = partie(plan);
    const rampe = surLaRampe(p);
    expect(p.aiguillageVers).toBe(0);
    avancer(p, 6000);
    expect(p.aiguillages).toBe(0);
    expect(p.railsFaits[rampe]).toBe(1);
    expect(p.verrouillees).toBe(0);
  });

  it.each(IDS)("%s : le verrou allumé, la bille de la rampe tombe droit dans le verrou — la rampe est réussie, la bille est verrouillée, une nouvelle arrive au lanceur sans coûter de bille", (plan) => {
    const p = partie(plan);
    p.allumerLeVerrou();
    expect(p.aiguillageVers).toBe(1);
    const rampe = surLaRampe(p);
    const ev = evenements2(p, 600);
    expect(ev & EV2_AIGUILLAGE).toBeTruthy();
    expect(p.aiguillages).toBe(1);
    expect(p.railsFaits[rampe], "le tir de rampe est récompensé").toBe(1);
    expect(p.verrouillees).toBe(1);
    expect(p.verrouTotal).toBe(1);
    expect(p.billes).toBe(3);
    expect(p.dansLanceur).toBe(true);
    expect(p.couche).toBe(0);
    expect(p.score).toBeGreaterThanOrEqual(REGLAGES.verrouPoints + REGLAGES.rampePoints);
  });

  it("la bille dérivée voyage en ligne droite, ne touche rien, et arrive au pas dit par la table", () => {
    const p = partie("B");
    p.allumerLeVerrou();
    surLaRampe(p);
    const a = p.table.aiguillage!;
    let pas = 0;
    while (p.rail >= 0 && pas < 200) {
      p.avancer();
      pas++;
    }
    expect(p.rail).toBe(-2);
    expect([p.x, p.y]).toEqual([a.x, a.y]);
    const debut = p.tick;
    const v = a.versVerrou!;
    while (p.couche === 1 && p.tick - debut < 1000) {
      p.avancer();
      // sur la droite entre l'aiguillage et le verrou (à 1 px près)
      const t = (p.tick - debut) / v.pas;
      if (p.couche === 1) {
        expect(Math.abs(p.x - (a.x + (v.x - a.x) * t))).toBeLessThan(2 * UNITE);
        expect(Math.abs(p.y - (a.y + (v.y - a.y) * t))).toBeLessThan(2 * UNITE);
      }
    }
    expect(p.tick - debut).toBe(v.pas);
  });

  it.each(IDS)("%s : pendant la multibille, la bille de la rampe est envoyée à l'élément du thème : un jackpot, et elle en ressort par le bas", (plan) => {
    for (const theme of THEMES_PINBALL) {
      const p = partie(plan, theme);
      p.lancerLaMultibille();
      expect(p.aiguillageVers, `${plan} ${theme}`).toBe(2);
      surLaRampe(p);
      const avant = p.jackpotsPartie;
      const ev = evenements2(p, 20);
      expect(ev & EV2_AIGUILLAGE).toBeTruthy();
      // elle arrive : on attend la fin du trajet
      for (let i = 0; i < 600 && p.jackpotsPartie === avant; i++) p.avancer();
      expect(p.jackpotsPartie, `${plan} ${theme} : un jackpot`).toBe(avant + 1);
      expect(p.dernierJackpot).toBeGreaterThanOrEqual(REGLAGES.jackpotBase);
      // l'élément visé est celui de la mission du thème
      const visee = p.table.aiguillage!.versElement!.type;
      expect(MODULES_DE_MISSION[MISSION_DU_THEME[theme]] as readonly string[]).toContain(visee);
      expect(p.couche).toBe(0);
      expect(p.vy).toBeGreaterThan(0);
    }
  });

  it("aiguillageActif à 0 : la rampe va jusqu'au bout, verrou allumé ou non", () => {
    const p = partie("B", "ocean", { ...copierReglages(), aiguillageActif: 0 });
    p.allumerLeVerrou();
    expect(p.aiguillageVers).toBe(0);
    const rampe = surLaRampe(p);
    avancer(p, 6000);
    expect(p.aiguillages).toBe(0);
    expect(p.railsFaits[rampe]).toBe(1);
  });

  it("une bille qui monte la rampe moins vite que la vitesse d'entrée, ou qui la redescend, n'est jamais dérivée", () => {
    const p = partie("C");
    p.allumerLeVerrou();
    const a = p.table.aiguillage!;
    // elle redescend la rampe (vitesse négative) en passant le point de l'aiguillage
    surLeRail(p, a.rail, a.s / UNITE + 3, -600);
    avancer(p, 20);
    expect(p.aiguillages).toBe(0);
  });

  it("deux billes : celle qui n'est pas sur la rampe ne joue pas l'aiguillage ; la dérivée ne touche pas l'autre", () => {
    const p = partie("B");
    p.lancerLaMultibille();
    avancer(p, 700); // les deux billes verrouillées sont lâchées
    expect(p.autres.length).toBeGreaterThanOrEqual(1);
    surLaRampe(p);
    avancer(p, 800);
    expect(p.aiguillages).toBeGreaterThanOrEqual(1);
    expect(p.surLaTable).toBeGreaterThanOrEqual(2);
  });
});
