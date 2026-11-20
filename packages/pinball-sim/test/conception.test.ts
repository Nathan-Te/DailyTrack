import { describe, expect, it } from "vitest";
import { DENSITE_MAX, FENETRE_MIN_MS, PLANS, PLANS_ESSAI, THEMES_PINBALL, Partie, TIRS_MAX, TIRS_MIN, dailyPinball, defautsDeConception, densite, nombreDeTirs, obstaclesDansLaZone, planDe, miroirDePlan } from "../src/index";

// Lot PBT0 — les règles de conception (`conception.ts`) sur les six plans d'essai, dans les deux sens et les quatre thèmes. Les fenêtres de tir (une simulation par table) sont dans `conception-tirs.test.ts`.
const IDS = PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`]);
const table = (id: string, theme: (typeof THEMES_PINBALL)[number]) => new Partie(dailyPinball(0, undefined, theme, id)).table;

describe("les plans d'essai t1 à t6 (lot PBT0)", () => {
  it("il y en a six, jamais tirés par le générateur, et chacun a une idée", () => {
    expect(PLANS_ESSAI.map((p) => p.id)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6"]);
    for (const p of PLANS_ESSAI) {
      expect(p.idee, p.id).toBeTruthy();
      expect(PLANS.some((q) => q.id === p.id), p.id).toBe(false);
    }
    for (let jour = 20000; jour < 20400; jour++) expect(PLANS_ESSAI.some((p) => p.id === dailyPinball(jour).plan)).toBe(false);
  });

  it("le miroir est l'image du plan dans l'axe : deux miroirs font le plan, les emplacements, les rampes et la porte s'échangent de côté", () => {
    for (const p of [...PLANS_ESSAI, ...PLANS]) {
      const m = planDe(`${p.id}m`);
      expect(m.id).toBe(`${p.id}m`);
      expect(m.emplacements.map((e) => [368 - e.x, e.y])).toEqual(p.emplacements.map((e) => [e.x, e.y]));
      if (p.mini) expect(m.mini!.cote).toBe(1 - p.mini.cote);
      if (p.porte) expect([m.porte!.x, m.porte!.angle]).toEqual([368 - p.porte.x, -p.porte.angle]);
      const mm = miroirDePlan(m, p.id);
      expect(mm.emplacements).toEqual(p.emplacements);
      expect(mm.rampes).toEqual(p.rampes);
      expect(mm.orbite?.orb).toEqual(p.orbite?.orb);
    }
    expect(() => planDe("t9")).toThrow();
  });

  it("la table d'un plan retourné est celle du plan, gauche et droite échangées : mêmes modules, mêmes nombres de murs et de rails", () => {
    for (const p of PLANS_ESSAI) {
      for (const theme of THEMES_PINBALL) {
        const a = table(p.id, theme);
        const b = table(`${p.id}m`, theme);
        expect(b.poses.map((q) => q.type)).toEqual(a.poses.map((q) => q.type));
        expect(b.murs.length).toBe(a.murs.length);
        expect(b.rails.length).toBe(a.rails.length);
        expect(b.mini === null).toBe(a.mini === null);
        expect(b.passage === null).toBe(a.passage === null);
        a.poses.forEach((q, i) => expect(Math.abs(q.x / 4096 + b.poses[i]!.x / 4096 - 368)).toBeLessThan(1));
      }
    }
  });
});

describe("les règles de conception : un plan dessiné d'un seul tenant", () => {
  for (const id of IDS) {
    for (const theme of THEMES_PINBALL) {
      it(`${id}, ${theme} : au plus une rampe et une orbite, des rails qui ne gênent rien, les bumpers en poche hors de la zone de tir, aucun mur dans la zone de tir, densité sous ${DENSITE_MAX} ‰`, () => {
        const t = table(id, theme);
        expect(defautsDeConception(t)).toEqual([]);
        expect(obstaclesDansLaZone(t)).toEqual([]);
        expect(densite(t).total).toBeLessThanOrEqual(DENSITE_MAX);
      });
    }
    it(`${id} : de ${TIRS_MIN} à ${TIRS_MAX} tirs`, () => {
      const n = nombreDeTirs(id);
      expect(n).toBeGreaterThanOrEqual(TIRS_MIN);
      expect(n).toBeLessThanOrEqual(TIRS_MAX);
    });
  }

  it("le test voit les défauts : un rail qui croise un module, deux rampes, un bumper hors de la poche, une table trop dense", () => {
    const t = table("t1", "foire");
    // un bumper au milieu de la table, sous la rampe : la poche et le rail le disent
    const pose = t.poses.find((q) => q.type === "bumpers")!;
    const bas = { ...t, poses: t.poses.map((q) => (q === pose ? { ...q, y: 400 * 4096 } : q)) };
    expect(defautsDeConception(bas).some((d) => d.includes("trop bas"))).toBe(true);
    expect(defautsDeConception({ ...t, rails: [...t.rails, t.rails[0]!] }).some((d) => d.includes("2 rampes"))).toBe(true);
    expect(defautsDeConception(t, 10).some((d) => d.includes("densité"))).toBe(true);
  });
});
