import { describe, expect, it } from "vitest";
import { isRestricted, judgeAddress, trialKeysAllowed, withoutRefused } from "../src/access";

const TODAY = 20_746; // un jour quelconque

describe("mode restreint (production)", () => {
  it("la construction de production est toujours restreinte : aucun paramètre d'adresse ne lève la restriction, pas même ?debug", () => {
    for (const search of ["", "?debug", "?debug&prod=0", "?prod=0", "?restricted=0", "?debug&tools=1&unlock=1&dev=1", "?preview=1&debug&today=2030-01-01"]) {
      expect(isRestricted(search, "1"), search).toBe(true);
    }
  });

  it("un aperçu de branche (sans le drapeau) n'est pas restreint, sauf ?prod (qui ne sait que restreindre)", () => {
    expect(isRestricted("", undefined)).toBe(false);
    expect(isRestricted("?debug", "")).toBe(false);
    expect(isRestricted("?prod", undefined)).toBe(true);
    expect(isRestricted("?debug&prod", undefined)).toBe(true);
  });

  it("les touches N et T n'agissent qu'hors production", () => {
    expect(trialKeysAllowed(true)).toBe(false);
    expect(trialKeysAllowed(false)).toBe(true);
  });
});

describe("adresse d'un jour (judgeAddress)", () => {
  const base = { seedDay: null, trial: false, today: TODAY, restricted: true };

  it("production : un jour à venir est refusé (circuit du jour + message), aujourd'hui et les jours passés sont acceptés", () => {
    expect(judgeAddress({ ...base, seedDay: TODAY + 1 })).toMatchObject({ seedDay: null, notice: "course.notice.pasDisponible" });
    expect(judgeAddress({ ...base, seedDay: TODAY + 400 }).seedDay).toBeNull();
    expect(judgeAddress({ ...base, seedDay: TODAY })).toEqual({ seedDay: TODAY, dropTrial: false, notice: "" });
    expect(judgeAddress({ ...base, seedDay: TODAY - 5 })).toEqual({ seedDay: TODAY - 5, dropTrial: false, notice: "" });
    expect(judgeAddress(base)).toEqual({ seedDay: null, dropTrial: false, notice: "" });
  });

  it("production : thème et variante forcés refusés pour aujourd'hui et le futur, acceptés pour un jour passé", () => {
    expect(judgeAddress({ ...base, trial: true })).toMatchObject({ dropTrial: true, notice: "course.notice.essaisReserves" });
    expect(judgeAddress({ ...base, trial: true, seedDay: TODAY })).toMatchObject({ dropTrial: true });
    expect(judgeAddress({ ...base, trial: true, seedDay: TODAY + 2 })).toMatchObject({ seedDay: null, dropTrial: true });
    expect(judgeAddress({ ...base, trial: true, seedDay: TODAY - 1 })).toEqual({ seedDay: TODAY - 1, dropTrial: false, notice: "" });
  });

  it("hors production : tout passe (les outils des agents et de l'admin)", () => {
    const open = { ...base, restricted: false };
    expect(judgeAddress({ ...open, seedDay: TODAY + 30, trial: true })).toEqual({ seedDay: TODAY + 30, dropTrial: false, notice: "" });
  });

  it("l'adresse nettoyée ne garde pas ce que le jeu a refusé, mais garde le reste", () => {
    const v = judgeAddress({ ...base, seedDay: TODAY + 3, trial: true });
    expect(withoutRefused("?debug&day=2030-01-01&theme=nuit&variant=2&api=demo", v, true)).toBe("?debug=&api=demo");
    const keep = judgeAddress({ ...base, seedDay: TODAY - 3, trial: true });
    expect(withoutRefused("?day=2020-01-01&theme=nuit", keep, false)).toBe("?day=2020-01-01&theme=nuit");
  });
});

// Lot I5 : le décompte de l'accueil (« HH:MM:SS ») est `formatDecompte` du socle : ses tests sont dans packages/ui/test/formats.test.ts.

