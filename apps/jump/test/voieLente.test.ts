import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { dailyLevel, type DailyLevel } from "@cdj/jump-sim";
import { contrastRatio, hueDistance, hueOf } from "../src/contrast";
import { SLOW_DEBUG, SLOW_MARK, slowDebugPaths, slowMarkQuads } from "../src/slowRoute";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";
import { toPayload, fromPayload } from "../src/dailyWork";
import "./francais";

// Lot 16 — la seconde voie vue par le jeu : le repère d'entrée (neutre, de la charte, jamais rouge) et la surimpression `?debug`.

const FIRST = parseDay("2026-10-23")!;
const DAY: DailyLevel = (() => {
  for (let d = FIRST; ; d++) if (dailyLevel(d).slowRoutes.length > 0) return dailyLevel(d);
})();

describe("lot 16 — repère d'entrée de la voie lente", () => {
  it("couleurs de la charte (`--dj-papier` cerné de `--dj-encre`) : ni le rouge des dangers, ni le jaune du personnage", () => {
    expect(SLOW_MARK).toEqual({ face: 0xfff6e0, edge: 0x2a1e16 });
    for (const c of [SLOW_MARK.face, SLOW_MARK.edge, SLOW_DEBUG.fast, SLOW_DEBUG.slow]) {
      // Une couleur neutre (presque sans teinte), ou une teinte loin du rouge des dangers.
      const neutral = hueOf(c).chroma <= 0.15;
      expect(neutral || hueDistance(c, HAZARD) >= 30, c.toString(16)).toBe(true);
      // Le jaune du personnage est saturé ; le repère ne l'est pas.
      expect(hueOf(c).chroma, c.toString(16)).toBeLessThan(hueOf(PLAYER).chroma / 2 + 0.2);
    }
    expect(contrastRatio(SLOW_MARK.face, SLOW_MARK.edge)).toBeGreaterThanOrEqual(7);
  });

  it("lisible sur le ciel et chaque plan de chaque thème : la face ou son cerne à 3:1 au moins", () => {
    for (const name of THEME_NAMES) {
      for (const b of backdropColors(THEMES[name])) {
        const best = Math.max(contrastRatio(SLOW_MARK.face, b), contrastRatio(SLOW_MARK.edge, b));
        expect(best, `${name} ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("dessiné dans l'ouverture du mur gauche de la cage (trois rangées au-dessus du toit de la piste), sans texte", () => {
    for (const r of DAY.slowRoutes) {
      for (const q of slowMarkQuads(r)) {
        expect(q.x, "colonne").toBeGreaterThanOrEqual(r.zone);
        expect(q.x, "colonne").toBeLessThanOrEqual(r.zone + 1);
        expect(q.y, "rangées").toBeGreaterThanOrEqual(r.entryRow - 5);
        expect(q.y, "rangées").toBeLessThanOrEqual(r.entryRow - 2);
      }
      // L'ouverture est bien vide dans le niveau (le repère ne cache rien de plein).
      for (let row = r.entryRow - 5; row <= r.entryRow - 3; row++) expect(DAY.level.tiles[row * DAY.level.width + r.zone], `${r.zone},${row}`).toBe(0);
    }
  });
});

describe("lot 16 — `?debug` et transport du niveau", () => {
  it("les deux trajets de chaque portion dure et leurs temps", () => {
    const paths = slowDebugPaths(DAY);
    expect(paths).toHaveLength(DAY.slowRoutes.length);
    paths.forEach((p, i) => {
      const r = DAY.slowRoutes[i]!;
      expect(p.fast.length).toBeGreaterThan(10);
      expect(p.slow.length).toBeGreaterThan(p.fast.length);
      expect(p.label).toContain(`rapide ${(r.fastTicks / 120).toFixed(2)} s`);
      expect(p.label).toContain(`lente ${(r.slowTicks / 120).toFixed(2)} s`);
      // Le trajet lent monte au-dessus du morceau contourné ; le rapide reste dedans.
      expect(Math.min(...p.slow.map((q) => q.y))).toBeLessThan(DAY.pieces[r.piece]!.top);
    });
  });

  it("la charge du worker et du cache porte les voies lentes, et les médailles qui en dépendent", () => {
    const back = fromPayload(JSON.parse(JSON.stringify(toPayload(DAY))), DAY.day, { proof: true });
    expect(typeof back).not.toBe("string");
    if (typeof back === "string") return;
    expect(back.slowRoutes).toEqual(DAY.slowRoutes);
    expect(back.slowTicks).toBe(DAY.slowTicks);
    expect(back.medals).toEqual(DAY.medals);
  });
});
