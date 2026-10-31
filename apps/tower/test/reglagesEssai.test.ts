import { PHYSIQUE_REGLEE_DEFAUT, REGLAGES_DEFAUT } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { blocJson, CURSEURS } from "../src/curseurs";
import { peutClasser } from "../src/envoi";
import { classablePourReglages } from "../src/classable";
import { RENDU_DEFAUT, reglagesDeDepart, reglagesEssai } from "../src/reglagesEssai";

// Lot T5 — les curseurs de sensation : une partie jouée avec un réglage d'essai (groupe 1) n'est JAMAIS envoyée au classement ; le groupe 2 (rendu et son) ne change rien ; un seul bloc JSON à copier.
const jour = { scenario: "jour", jour: 20_000, aujourdhui: 20_000, bot: false, tireForce: false };

/** Un curseur déplacé de sa valeur de départ vers une autre de ses bornes. */
function deplacer(c: (typeof CURSEURS)[number], r = reglagesDeDepart()): ReturnType<typeof reglagesDeDepart> {
  const depart = c.lire(r);
  c.ecrire(r, depart === c.max ? c.min : c.max);
  return r;
}

describe("les curseurs de sensation", () => {
  it("aux valeurs de départ, la partie est celle du jour : rien d'essayé, classable", () => {
    const r = reglagesDeDepart();
    expect(reglagesEssai(r)).toBe(false);
    expect(classablePourReglages(jour, r)).toBe(true);
    expect(r.sim).toEqual(REGLAGES_DEFAUT);
    expect(r.physique).toEqual(PHYSIQUE_REGLEE_DEFAUT);
    expect(r.plateformeDemi8).toBeNull();
    expect(peutClasser({ ...jour, reglagesModifies: false })).toBe(true);
  });

  it("chaque curseur du groupe 1 (sensation et physique) marque la partie « réglage d'essai » : jamais classée", () => {
    const g1 = CURSEURS.filter((c) => c.groupe === 1);
    expect(g1.length).toBeGreaterThanOrEqual(14);
    for (const c of g1) {
      const r = deplacer(c);
      expect(reglagesEssai(r), c.cle).toBe(true);
      expect(classablePourReglages(jour, r), c.cle).toBe(false);
      // Et remis à sa valeur de départ, la partie redevient classable.
      c.ecrire(r, c.lire(reglagesDeDepart()));
      expect(reglagesEssai(r), `${c.cle} remis`).toBe(false);
      expect(classablePourReglages(jour, r), `${c.cle} remis`).toBe(true);
    }
  });

  it("la largeur de plateforme forcée est un réglage d'essai ; le réglage de rendu et de son n'en est pas un", () => {
    const r = reglagesDeDepart();
    r.plateformeDemi8 = 20;
    expect(reglagesEssai(r)).toBe(true);
    expect(classablePourReglages(jour, r)).toBe(false);
    const rendu = reglagesDeDepart();
    for (const c of CURSEURS.filter((x) => x.groupe === 2)) deplacer(c, rendu);
    expect(rendu.rendu).not.toEqual(RENDU_DEFAUT);
    expect(reglagesEssai(rendu)).toBe(false);
    expect(classablePourReglages(jour, rendu)).toBe(true);
  });

  it("les entrées (délai et cadence de répétition) comptent aussi parmi les valeurs d'essai", () => {
    const r = reglagesDeDepart();
    r.entrees.cadenceTicks = 1;
    expect(classablePourReglages(jour, r)).toBe(false);
  });

  it("les autres raisons de ne pas classer restent : scénario, bot, tirage forcé, un autre jour", () => {
    const r = reglagesDeDepart();
    expect(classablePourReglages({ ...jour, scenario: "essai" }, r)).toBe(false);
    expect(classablePourReglages({ ...jour, bot: true }, r)).toBe(false);
    expect(classablePourReglages({ ...jour, tireForce: true }, r)).toBe(false);
    expect(classablePourReglages({ ...jour, jour: 19_999 }, r)).toBe(false);
  });

  it("les bornes et les valeurs de départ : chaque curseur part dans ses bornes, ses clés sont uniques, ses valeurs écrites se relisent", () => {
    const r = reglagesDeDepart();
    expect(new Set(CURSEURS.map((c) => c.cle)).size).toBe(CURSEURS.length);
    for (const c of CURSEURS) {
      const v = c.lire(r);
      expect(v, c.cle).toBeGreaterThanOrEqual(c.min - 1e-9);
      expect(v, c.cle).toBeLessThanOrEqual(c.max + 1e-9);
      expect(c.pas, c.cle).toBeGreaterThan(0);
      for (const x of [c.min, c.max]) {
        const q = reglagesDeDepart();
        c.ecrire(q, x);
        expect(c.lire(q), `${c.cle} @ ${x}`).toBeCloseTo(x, 0);
      }
    }
  });

  it("« Copier les valeurs » : un seul bloc JSON, avec les clés du lot T1 à plat, la physique, la largeur et le rendu", () => {
    const r = reglagesDeDepart();
    const brut = blocJson(r, 28);
    const o = JSON.parse(brut) as Record<string, unknown>;
    expect(o).toMatchObject({ delaiTicks: 10, cadenceTicks: 3, vitesseChute8: 20, facteurDescente: 4, hauteurApparition8: 56, plateformeDemi8: 28, plateformeForcee: false, essai: false });
    expect(o.physique).toEqual(PHYSIQUE_REGLEE_DEFAUT);
    expect(o.rendu).toMatchObject({ panique: 1, secousse: 1, cris: 0.5 });
    expect(Object.keys((o.rendu as { volumes: object }).volumes)).toHaveLength(8);
    expect(brut).not.toContain("\n"); // un seul bloc, une ligne
    r.plateformeDemi8 = 20;
    r.physique.frottement = 0.3;
    const p = JSON.parse(blocJson(r, 28)) as { plateformeDemi8: number; plateformeForcee: boolean; essai: boolean; physique: { frottement: number } };
    expect(p).toMatchObject({ plateformeDemi8: 20, plateformeForcee: true, essai: true });
    expect(p.physique.frottement).toBe(0.3);
  });
});
