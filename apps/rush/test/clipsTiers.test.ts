import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ANNONCE, ANNONCE_PLONGEON, CHAUVE, COMPETENCE, COUP, ESQUIVE, GELEE, LIBRE, MARCHE, PLONGEON, RECUPERE, REPOS } from "@cdj/rush-sim";
import { CLIPS_REQUIS, IMPACT, clipChevalier, clipGolem, clipMonstre, type Clip } from "../src/clipsTiers";
import { demiLargeurContour, traitContour } from "../src/rendu";

// Lot BR-A3 : la table « état de la sim → clip » des modèles tiers, sans navigateur.
const ici = dirname(fileURLToPath(import.meta.url));
const tempsDuClip = (c: Clip): number => (c.de ?? 0) + ((c.a ?? 1) - (c.de ?? 0)) * (c.p ?? 0);
const base = { duree: 30, dureeEsquive: 12, course: 0, touche: false, perdue: false, gagnee: false };
const chev = (e: Partial<{ etat: number; t: number; combo: number; marche: boolean }>) => ({ etat: LIBRE, t: 0, combo: 0, marche: false, ...e });

describe("la table des clips (lot BR-A3)", () => {
  it("chaque clip demandé par la table existe dans la liste des clips requis du modèle, et chaque script de conversion les écrit tous", () => {
    const demandes = {
      chevalier: [
        clipChevalier(chev({}), base),
        clipChevalier(chev({ marche: true }), base),
        clipChevalier(chev({ marche: true }), { ...base, course: 1 }),
        ...[0, 1, 2].map((combo) => clipChevalier(chev({ etat: COUP, combo }), base)),
        clipChevalier(chev({ etat: ESQUIVE }), base),
        clipChevalier(chev({ etat: COMPETENCE }), base),
        clipChevalier(chev({}), { ...base, touche: true }),
        clipChevalier(chev({}), { ...base, perdue: true }),
        clipChevalier(chev({}), { ...base, gagnee: true }),
      ],
      golem: [
        clipGolem({ etat: MARCHE, t: 0, duree: 70, t1: 70, hp: 10 }, { marche: false, dort: false }),
        clipGolem({ etat: MARCHE, t: 0, duree: 70, t1: 70, hp: 10 }, { marche: true, dort: false }),
        clipGolem({ etat: ANNONCE, t: 10, duree: 70, t1: 70, hp: 10 }, { marche: false, dort: false }),
        clipGolem({ etat: RECUPERE, t: 0, duree: 70, t1: 70, hp: 10 }, { marche: false, dort: false }),
        clipGolem({ etat: MARCHE, t: 0, duree: 70, t1: 70, hp: 0 }, { marche: false, dort: false }),
        clipGolem({ etat: MARCHE, t: 0, duree: 70, t1: 70, hp: 10 }, { marche: false, dort: true }),
      ],
    };
    for (const [nom, clips] of Object.entries(demandes)) for (const c of clips) expect(CLIPS_REQUIS[nom as keyof typeof CLIPS_REQUIS], `${nom} : ${c.nom}`).toContain(c.nom);
    for (const [nom, requis] of Object.entries(CLIPS_REQUIS)) {
      const script = readFileSync(join(ici, "..", "modeles-tiers", `${nom.replace("-", "_")}.py`), "utf8");
      for (const c of requis) expect(script, `${nom} : le script de conversion écrit le clip ${c}`).toContain(`"${c}": {"fbx"`);
    }
  });

  it("le coup suit la simulation : son temps avance avec c.t (jamais avec l'horloge), un clip par coup de l'enchaînement", () => {
    const a = clipChevalier(chev({ etat: COUP, t: 6, combo: 1 }), base);
    const b = clipChevalier(chev({ etat: COUP, t: 24, combo: 1 }), base);
    expect(a.nom).toBe("coup2");
    expect(a.mode).toBe("progression");
    expect(tempsDuClip(b)).toBeGreaterThan(tempsDuClip(a));
    expect(clipChevalier(chev({ etat: COUP, combo: 2 }), base).nom).toBe("coup3");
    expect(clipChevalier(chev({ etat: COUP, t: 999 }), base).p).toBe(1);
  });

  it("l'annonce du golem finit EXACTEMENT sur l'impact du clip quand la sim frappe (le poing tombe quand le cercle frappe)", () => {
    const debut = clipGolem({ etat: ANNONCE, t: 0, duree: 70, t1: 70, hp: 10 }, { marche: false, dort: false });
    const impact = clipGolem({ etat: ANNONCE, t: 70, duree: 70, t1: 70, hp: 10 }, { marche: false, dort: false });
    expect(tempsDuClip(debut)).toBe(0);
    expect(tempsDuClip(impact)).toBeCloseTo(IMPACT.golem, 6);
    // phase 2 : deux coups dans la même annonce, le second rejoue la montée jusqu'à son impact
    const second = clipGolem({ etat: ANNONCE, t: 100, duree: 100, t1: 50, hp: 10 }, { marche: false, dort: false });
    expect(tempsDuClip(second)).toBeCloseTo(IMPACT.golem, 6);
  });

  it("le bond de la gelée : l'écrasement monte jusqu'à l'impact du clip, le saut le termine", () => {
    const d = { geleeAnnonce: 30, geleeBond: 24, chauvePlongeon: 34 };
    const m = (t: number, gel = 0) => ({ type: GELEE, etat: 0, t, gel });
    expect(tempsDuClip(clipMonstre(m(30 - 0.001), d, { marche: false, touche: false })!)).toBeCloseTo(IMPACT.gelee, 3);
    expect(tempsDuClip(clipMonstre(m(30), d, { marche: false, touche: false })!)).toBeCloseTo(IMPACT.gelee, 6);
    expect(clipMonstre(m(60), d, { marche: true, touche: false })!.nom).toBe("marche");
    expect(clipMonstre(m(60, 5), d, { marche: false, touche: false })!.nom).toBe("repos");
    expect(clipMonstre(m(10), d, { marche: false, touche: true })!.nom).toBe("touche");
  });

  it("la chauve-souris : orbite, annonce, plongeon (sur la durée de la sim), repos ; un monstre sans modèle tiers n'a pas de clip", () => {
    const d = { geleeAnnonce: 30, geleeBond: 24, chauvePlongeon: 34 };
    const m = (etat: number, t = 0) => ({ type: CHAUVE, etat, t, gel: 0 });
    expect(clipMonstre(m(0), d, { marche: true, touche: false })!.nom).toBe("marche");
    expect(clipMonstre(m(ANNONCE_PLONGEON), d, { marche: true, touche: false })!.nom).toBe("annonce");
    expect(clipMonstre(m(PLONGEON, 17), d, { marche: true, touche: false })!.p).toBeCloseTo(0.5, 6);
    expect(clipMonstre(m(REPOS), d, { marche: false, touche: false })!.nom).toBe("repos");
    expect(clipMonstre({ type: 99, etat: 0, t: 0, gel: 0 }, d, { marche: false, touche: false })).toBeNull();
  });
});

describe("le contour indépendant de la définition et de la densité de pixels (lot BR-A3)", () => {
  it("le trait fait toujours la même part de la hauteur de l'image : 1280 × 720 (DPR 2), 1920 × 1080 (DPR 1 et 2), 2560 × 1440 (DPR 1 et 2), plein écran 4K", () => {
    const part = (hCss: number, dpr: number): number => traitContour(hCss * dpr) / (hCss * dpr);
    const ref = part(1080, 1);
    expect(traitContour(1080)).toBeCloseTo(2.5, 9);
    for (const [h, dpr] of [[720, 1], [720, 2], [1080, 2], [1440, 1], [1440, 2], [2160, 1], [2160, 2]] as const) expect(part(h, dpr)).toBeCloseTo(ref, 9);
  });
  it("aucun arrondi au pixel : des demi-largeurs non entières (la profondeur est interpolée entre texels)", () => {
    expect(demiLargeurContour(720)).toBeCloseTo(0.3333, 4);
    expect(demiLargeurContour(1080)).toBeCloseTo(0.75, 9);
    expect(demiLargeurContour(1440)).toBeCloseTo(1.1667, 4);
  });
});
