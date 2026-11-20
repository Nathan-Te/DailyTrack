import { describe, expect, it } from "vitest";
import { ECART_BOUCHE_MAX, POINT_DES_BATTEURS, DENSITE_MAX, FENETRE_MIN_MS, PLANS, PLANS_ESSAI, THEMES_PINBALL, Partie, TIRS_MAX, TIRS_MIN, dailyPinball, defautsDeConception, densite, nombreDeTirs, obstaclesDansLaZone, planDe, miroirDePlan } from "../src/index";

// Lot PBT0 — les règles de conception (`conception.ts`) sur les plans d'essai, dans les deux sens et les quatre thèmes. Les fenêtres de tir (une simulation par table) sont dans `conception-tirs.test.ts`.
const IDS = PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`]);
const table = (id: string, theme: (typeof THEMES_PINBALL)[number]) => new Partie(dailyPinball(0, undefined, theme, id)).table;

describe("les plans d'essai e1 à e4 (lots PBT0 et PBT0b)", () => {
  it("il y en a trois, jamais tirés par le générateur, et chacun a une idée", () => {
    expect(PLANS_ESSAI.map((p) => p.id)).toEqual(["e1", "e2", "e3"]);
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
    expect(() => planDe("e9")).toThrow();
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

  it("lot PBT0b : les bouches regardent les batteurs (25° au plus) et sont libres — le test voit les plans du jour, dessinés à la main, qui ne le sont pas", () => {
    const anciens = PLANS.flatMap((p) => THEMES_PINBALL.map((th) => defautsDeConception(table(p.id, th)).filter((d) => d.includes("ne regarde pas") || d.includes("n'est pas libre"))));
    expect(anciens.some((d) => d.length > 0)).toBe(true);
    // chaque bouche des variantes en éventail est dans son éventail : le test passe sans défaut sur les trois plans et leurs miroirs (ci-dessus) ; ici, leurs angles
    for (const id of IDS) {
      const t = table(id, "foire");
      for (const g of t.portes) {
        const vx = g.x / 4096 - POINT_DES_BATTEURS.x;
        const vy = g.y / 4096 - POINT_DES_BATTEURS.y;
        const angle = Math.abs(Math.atan2(g.ux * vy - g.uy * vx, g.ux * vx + g.uy * vy)) * (180 / Math.PI);
        expect(angle, `${id} bouche (${Math.round(g.x / 4096)}, ${Math.round(g.y / 4096)})`).toBeLessThanOrEqual(ECART_BOUCHE_MAX);
      }
    }
  });

  it("le test voit les défauts : un rail qui croise un module, deux rampes, un bumper hors de la poche, une table trop dense", () => {
    const t = table("e1", "foire");
    // un bumper au milieu de la table, sous la rampe : la poche et le rail le disent
    const pose = t.poses.find((q) => q.type === "bumpers")!;
    const bas = { ...t, poses: t.poses.map((q) => (q === pose ? { ...q, y: 400 * 4096 } : q)) };
    expect(defautsDeConception(bas).some((d) => d.includes("trop bas"))).toBe(true);
    expect(defautsDeConception({ ...t, rails: [...t.rails, t.rails[0]!] }).some((d) => d.includes("2 rampes"))).toBe(true);
    expect(defautsDeConception(t, 10).some((d) => d.includes("densité"))).toBe(true);
  });
});
