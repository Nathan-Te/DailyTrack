import { EFFETS, estBonus } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { CATALOGUE_TOWER } from "../src/catalogue";
import { plaqueDe, tamponDe } from "../src/tampon";

// Lot T9 — la plaque « Suivante » marquée et l'annonce du palier en tampon : un bonus est vert, penché à gauche, avec un point d'exclamation ; un malus est encre, penché à droite, ombré terre cuite, avec des points de suspension.
describe("le tampon d'un palier", () => {
  it("un bonus : vert, penché à gauche, point d'exclamation ; un malus : encre, penché à droite, points de suspension", () => {
    for (const e of EFFETS) {
      const t = tamponDe(e);
      expect(t.bonus, e).toBe(estBonus(e));
      expect(t.classe, e).toBe(estBonus(e) ? "tampon--bonus" : "tampon--malus");
      expect(t.penche, e).toBe(estBonus(e) ? -1 : 1);
      expect(t.ponctuation, e).toBe(estBonus(e) ? "!" : "…");
    }
  });

  it("les six textes sont dans les catalogues français et anglais, en majuscules, avec la bonne ponctuation (la clé du tampon en dérive)", () => {
    const fr: Record<string, string> = { lierre: "LIERRE !", figee: "FIGÉE !", petite: "MINI !", geante: "GÉANTE…", vent: "COUP DE VENT…", glissante: "GLISSANTE…" };
    const en: Record<string, string> = { lierre: "IVY!", figee: "BOLTED!", petite: "MINI!", geante: "GIANT…", vent: "GUST…", glissante: "SLIPPERY…" };
    for (const e of EFFETS) {
      const t = tamponDe(e);
      expect(CATALOGUE_TOWER.fr[t.cle], `fr ${e}`).toBe(fr[e]);
      expect(CATALOGUE_TOWER.en[t.cle], `en ${e}`).toBe(en[e]);
      for (const langue of ["fr", "en"] as const) {
        const texte = CATALOGUE_TOWER[langue][t.cle] as string;
        expect(texte, `${langue} ${e}`).toBe(texte.toUpperCase());
        expect(texte.endsWith(t.ponctuation), `${langue} ${e} finit par ${t.ponctuation}`).toBe(true);
      }
    }
  });
});

describe("la plaque « Suivante »", () => {
  it("un bonus a un cadre vert épais, un malus un cadre d'encre et une bande rayée en haut ; sans effet, rien", () => {
    for (const e of EFFETS) {
      const p = plaqueDe(e);
      expect(p.cadre, e).toBe(estBonus(e) ? "vert" : "encre");
      expect(p.bandeRayee, e).toBe(!estBonus(e));
      expect(p.macaron, `le macaron porte l'icône de ${e}`).toBe(e);
    }
    expect(plaqueDe(null)).toMatchObject({ cadre: null, bandeRayee: false, macaron: null });
  });

  it("la pièce dessinée prend la couleur ou la taille de l'effet : petite à la moitié, géante au trait épais, glissante givrée, figée rayée, lierre à liane", () => {
    expect(plaqueDe("petite").piece).toMatchObject({ echelle: 0.5, bordEpais: false });
    expect(plaqueDe("geante").piece).toMatchObject({ echelle: 1, bordEpais: true });
    expect(plaqueDe("glissante").piece.givre).toBe(true);
    expect(plaqueDe("figee").piece.bande).toBe(true);
    expect(plaqueDe("lierre").piece.liane).toBe(true);
    expect(plaqueDe("vent").piece).toEqual({ echelle: 1, bordEpais: false, givre: false, bande: false, liane: false });
    expect(plaqueDe(null).piece).toEqual({ echelle: 1, bordEpais: false, givre: false, bande: false, liane: false });
  });
});
