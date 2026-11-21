import { describe, expect, it } from "vitest";
import { IDS_PLANS, NORME, Partie, THEMES_PINBALL, UNITE, dailyPinball } from "@cdj/pinball-sim";
import { couleurDeBouche, dessinerRails, disquesDesRails, disquesDuMini, flechesDesRails, largeurDuRail, lampesDecor } from "../src/dessin";
import { echantillons } from "../src/rails";

// Lot PBG1 : les rails (rampes et orbite) du rendu à plat — leurs flèches de tir, leurs obstacles pour les plaques, le dessin par thème (cuit une fois), la place du mini-batteur.
const table = (plan: string, theme: (typeof THEMES_PINBALL)[number] = "foire", jour = 20800) => new Partie(dailyPinball(jour, undefined, theme, plan)).table;

describe("les flèches et les obstacles des rails (lot PBG1)", () => {
  it("une flèche de tir par bouche, tournée dans le sens de l'entrée, devant la bouche (pas sur le rail)", () => {
    for (const plan of IDS_PLANS) {
      const t = table(plan);
      const f = flechesDesRails(t);
      expect(f, plan).toHaveLength(t.portes.length);
      f.forEach((fl, i) => {
        const g = t.portes[i]!;
        expect(fl.rail).toBe(g.rail);
        expect(fl.bout).toBe(g.bout);
        expect(Math.cos(fl.a)).toBeCloseTo(g.ux / NORME, 3);
        expect(Math.sin(fl.a)).toBeCloseTo(g.uy / NORME, 3);
        // devant la bouche : de l'autre côté de la bouche que le rail
        expect(Math.hypot(fl.x - g.x / UNITE, fl.y - g.y / UNITE), plan).toBeCloseTo(26, 1);
        expect((fl.x - g.x / UNITE) * (g.ux / NORME) + (fl.y - g.y / UNITE) * (g.uy / NORME), plan).toBeLessThan(0);
      });
      // une rampe n'a qu'une bouche ; lot PBT1 : l'orbite d'une table dessinée n'en a qu'une aussi (large, au pied du couloir) — la table C n'a pas d'orbite
      expect(f.filter((x) => t.rails[x.rail]!.genre === "rampe")).toHaveLength(t.rails.filter((r) => r.genre === "rampe").length);
      expect(f.filter((x) => t.rails[x.rail]!.genre === "orbite")).toHaveLength(plan === "C" ? 0 : 1);
    }
  });

  it("les obstacles couvrent tout le ruban de chaque rail : chaque point du tracé, et de chaque côté, est dans un disque", () => {
    for (const plan of IDS_PLANS) {
      const t = table(plan);
      const disques = disquesDesRails(t);
      for (const rail of t.rails) {
        for (const p of echantillons(rail, 3)) {
          for (const cote of [-1, 0, 1]) {
            const x = p.x - p.dy * cote * (largeurDuRail(rail) / 2);
            const y = p.y + p.dx * cote * (largeurDuRail(rail) / 2);
            expect(disques.some((d) => Math.hypot(x - d.x, y - d.y) <= d.r), `${plan} ${rail.genre} (${x.toFixed(0)}, ${y.toFixed(0)})`).toBe(true);
          }
        }
      }
    }
  });

  it("le mini-batteur : de la place à balayer seulement pour les plans qui en ont un", () => {
    const avec = IDS_PLANS.filter((p) => table(p).mini !== null);
    expect(avec.length).toBeGreaterThan(0);
    expect(avec.length).toBeLessThan(IDS_PLANS.length);
    for (const plan of IDS_PLANS) {
      const t = table(plan);
      const d = disquesDuMini(t);
      if (!t.mini) expect(d, plan).toEqual([]);
      else {
        expect(d.length, plan).toBeGreaterThan(10);
        // le pivot est dans la place balayée, du bon côté de la table
        const x0 = (t.mini.cote === 0 ? t.mini.x : 2 * 184 * UNITE - t.mini.x) / UNITE;
        expect(d.some((q) => Math.hypot(q.x - x0, q.y - t.mini!.y / UNITE) < 1), plan).toBe(true);
      }
    }
  });

  it("les petites lampes de l'arc ne sont jamais recouvertes par un rail (l'orbite longe l'arc)", () => {
    for (const plan of IDS_PLANS) {
      for (const theme of THEMES_PINBALL) {
        const t = table(plan, theme);
        // lot PBT1 : les lampes du flanc que suit l'orbite s'éteignent (`lampesDecor(table)`), celles de l'autre flanc restent
        const arc = lampesDecor(t).filter((l) => !l.pierre);
        expect(arc.length, `${plan} : des lampes restent sur l'arc`).toBeGreaterThanOrEqual(5);
        for (const rail of t.rails) {
          const pts = echantillons(rail, 2);
          for (const l of arc) {
            // le ruban (la moitié de sa largeur), son cerne d'encre (2,5 px) et la lampe (3,2 px)
            const d = Math.min(...pts.map((p) => Math.hypot(l.x - p.x, l.y - p.y)));
            expect(d, `${plan} ${theme} ${rail.genre}`).toBeGreaterThan(largeurDuRail(rail) / 2 + 2.5 + 3.2);
          }
        }
      }
    }
  });
});

describe("le dessin des rails à plat (lot PBG1)", () => {
  /** Un faux contexte qui accepte tout et compte les traits et les remplissages. */
  function faux(): { c: CanvasRenderingContext2D; traits: () => number; formes: () => number } {
    let traits = 0;
    let formes = 0;
    const c = new Proxy({} as Record<string, unknown>, {
      get: (o, k) => (k in o ? o[k as string] : k === "stroke" ? () => void traits++ : k === "fill" ? () => void formes++ : () => undefined),
      set: (o, k, v) => ((o[k as string] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { c, traits: () => traits, formes: () => formes };
  }

  it("chaque thème habille chaque plan sans rien lire que la table : des traits pour les rubans, une forme par bouche", () => {
    for (const theme of THEMES_PINBALL) {
      for (const plan of IDS_PLANS) {
        const t = table(plan, theme);
        const { c, traits, formes } = faux();
        dessinerRails(c, t, theme);
        expect(traits(), `${theme} ${plan}`).toBeGreaterThan(t.rails.length * 5);
        expect(formes(), `${theme} ${plan}`).toBe(t.portes.length);
      }
    }
  });

  it("la table d'essai (sans rail) ne dessine rien", () => {
    const t = new Partie(dailyPinball(20800, undefined, "foire", "classique")).table;
    expect(t.rails).toHaveLength(0);
    const { c, traits, formes } = faux();
    dessinerRails(c, t, "foire");
    expect(traits() + formes()).toBe(0);
  });

  it("le dessin ne dépend que de la table : deux appels, mêmes traits", () => {
    const t = table("B", "espace");
    const a = faux();
    const b = faux();
    dessinerRails(a.c, t, "espace");
    dessinerRails(b.c, t, "espace");
    expect([a.traits(), a.formes()]).toEqual([b.traits(), b.formes()]);
  });

  it("chaque thème a la couleur de la bouche de ses rails, dans le même ton que ses bandes lumineuses (un code hexadécimal)", () => {
    for (const theme of THEMES_PINBALL) expect(couleurDeBouche(theme)).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
