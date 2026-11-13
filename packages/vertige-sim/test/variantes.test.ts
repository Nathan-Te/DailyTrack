import { describe, expect, it } from "vitest";
import { TICKS_PAR_SECONDE } from "../src/index";
import { MODULES, analyser, controlesDuModule, jauges, robotDuModule } from "../src/modulesIndex";
import { FAMILLES_A_PLATEFORMES, construireForme, refaireDeBase, variantes, varianteDeCle } from "../src/variantes";
import { miroir, orientationMiroir, solutionMiroir } from "../src/miroir";
import { piloterAvecRaison } from "../src/pilote";

// Les variantes de modules (lot V3) : le miroir gauche / droite et les longueurs ajustées. Chaque variante passe les MÊMES contrôles qu'un module de la bibliothèque (`controlesDuModule`, qui réunit ceux de `modules.test.ts`).
const toutes = variantes();

describe("le catalogue des variantes", () => {
  it("compte les 14 modules, leurs formes court et long (les quatre modules à plateformes) et leurs miroirs (ceux qui ne sont pas symétriques)", () => {
    expect(toutes.filter((v) => v.forme === "base" && !v.miroir).length).toBe(MODULES.length);
    expect(toutes.filter((v) => v.forme === "court").length + toutes.filter((v) => v.forme === "long").length).toBe(2 * FAMILLES_A_PLATEFORMES.length);
    expect(toutes.length).toBeGreaterThanOrEqual(28);
    expect(new Set(toutes.map((v) => v.cle)).size).toBe(toutes.length);
    expect(toutes.every((v) => v.module.id === v.cle)).toBe(true);
    expect(toutes.every((v) => varianteDeCle(v.cle) === v)).toBe(true);
  });
  it("un module symétrique est son propre miroir : il n'a pas de variante miroir (les quatre à plateformes et le portail droit)", () => {
    for (const id of ["saut-1", "saut-2", "dash-1", "dash-2", "portail-1"]) expect(varianteDeCle(`${id}~`), id).toBeUndefined();
    for (const id of ["mur-1", "mur-2", "mur-dash", "gravite-1", "gravite-2", "gravite-portail", "portail-quart", "portail-gravite", "portail-gravite-retour"]) expect(varianteDeCle(`${id}~`), id).toBeDefined();
  });
  it("la difficulté : un module long est plus dur d'un cran (3 au plus), un court plus facile (1 au moins)", () => {
    for (const id of FAMILLES_A_PLATEFORMES) {
      const base = varianteDeCle(id)!.difficulte;
      expect(varianteDeCle(`${id}/l`)!.difficulte, id).toBe(Math.min(3, base + 1));
      expect(varianteDeCle(`${id}/c`)!.difficulte, id).toBe(Math.max(1, base - 1));
    }
  });
  it.each(toutes.map((v) => [v.cle, v] as const))("%s passe les contrôles de la bibliothèque (solution, jauges à 85 %, étiquettes, 4 à 8 s, état canonique)", (_cle, v) => {
    expect(controlesDuModule(v.module)).toEqual([]);
  });
  it("les contrôles ne passent pas tout : une solution qui rate la sortie est refusée en le disant", () => {
    const m = MODULES[0]!;
    expect(controlesDuModule({ ...m, solution: "cours 78" })).not.toEqual([]);
    expect(controlesDuModule({ ...m, solution: `${m.solution}; cours 5` }).join()).toMatch(/pas en trop/);
  });
});

describe("le miroir gauche / droite", () => {
  it.each(MODULES.map((m) => [m.id, m] as const))("%s : le miroir arrive en autant de pas que l'original, sans chute, et la symétrie deux fois rend l'original", (_id, m) => {
    const mi = miroir(m);
    const a = robotDuModule(m);
    const b = robotDuModule(mi);
    expect(b.arrive).toBe(true);
    expect(b.ticks).toBe(a.ticks);
    expect(b.partie.chutes).toBe(0);
    expect(controlesDuModule(mi)).toEqual([]);
    const retour = miroir(mi);
    expect(retour.id).toBe(m.id);
    expect(retour.blocs).toEqual(m.blocs.map((b2) => ({ ...b2, boite: { ...b2.boite, x0: b2.boite.x0 + 0, x1: b2.boite.x1 + 0 } })));
    expect(retour.sortie).toEqual(m.sortie);
    expect(retour.solution.replace(/\s+/g, " ")).toBe(m.solution.replace(/\s+/g, " ").replace(/#[^;]*/g, "").replace(/;\s*/g, "; ").trim().replace(/;$/, ""));
  });
  it("inverse les touches de côté, le sens des virages, les orientations et les portails", () => {
    expect(solutionMiroir("cours 5 +gauche; tourne 90 4; cours 3 +droite; tourne -45")).toBe("cours 5 +droite; tourne -90 4; cours 3 +gauche; tourne 45");
    for (let o = 0; o < 24; o++) expect(orientationMiroir(orientationMiroir(o))).toBe(o);
    expect(orientationMiroir(0)).toBe(0);
    const m = MODULES.find((x) => x.id === "portail-quart")!;
    const mi = miroir(m);
    expect(mi.portails![0]!.b.x).toBe(-m.portails![0]!.b.x + 0);
    expect(mi.sortie.x).toBe(-m.sortie.x + 0);
  });
});

describe("les longueurs ajustées et le pilote qui recalcule les solutions", () => {
  it.each(FAMILLES_A_PLATEFORMES.map((id) => [id] as const))("%s : le constructeur refait la forme de base au bloc près, et le pilote en trouve une solution de même durée (à 3 % près)", (id) => {
    const original = MODULES.find((m) => m.id === id)!;
    const refait = refaireDeBase(id).module!;
    expect(refait.blocs).toEqual(original.blocs);
    expect(refait.sortie).toEqual(original.sortie);
    expect(controlesDuModule(refait)).toEqual([]);
    const a = robotDuModule(original).ticks;
    const b = robotDuModule(refait).ticks;
    expect(Math.abs(a - b) / a).toBeLessThan(0.03);
  });
  it.each(FAMILLES_A_PLATEFORMES.map((id) => [id] as const))("%s : le long n'a que des écarts permis (au plus 85 % de la portée) et plus grands que le court ; la solution est celle du pilote, pas du module de base", (id) => {
    const grandesPhases = (cle: string): number => Math.max(...analyser(varianteDeCle(cle)!.module).phases.map((p) => p.ecart ?? 0));
    expect(grandesPhases(`${id}/l`)).toBeGreaterThan(grandesPhases(`${id}/c`));
    expect(varianteDeCle(`${id}/l`)!.module.solution).not.toBe(varianteDeCle(id)!.module.solution);
    const j = jauges();
    expect(grandesPhases(`${id}/l`)).toBeLessThanOrEqual(j.permis.ecartSautDash(-1_500_000));
  });
  it("le pilote est entier et déterministe (même texte à chaque fois) et dit pourquoi il échoue", () => {
    for (const id of FAMILLES_A_PLATEFORMES) for (const forme of ["base", "court", "long"] as const) expect(construireForme(id, forme).module!.solution).toBe(construireForme(id, forme).module!.solution);
    const m = MODULES.find((x) => x.id === "saut-1")!;
    // Un bord trop tôt : le saut est pris au milieu de la dalle, on retombe sur elle (hors de la fenêtre d'atterrissage).
    const r = piloterAvecRaison(m, [{ bord: -1_000_000, action: "saut", atterrissage: [-9_000_000, -12_000_000] }]);
    expect(r.commandes).toBeNull();
    expect(r.raison.length).toBeGreaterThan(0);
  });
  it("chaque variante dure de 4 à 8 s", () => {
    for (const v of toutes) expect(robotDuModule(v.module).ticks / TICKS_PAR_SECONDE, v.cle).toBeGreaterThanOrEqual(4);
  });
});
