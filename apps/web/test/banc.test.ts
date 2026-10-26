import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANC_JOUR, DUREES, THEMES_BANC, VERSION_RAPPORT, centile, configurations, plan, rapportValide, resumer, type RapportBanc } from "../src/banc/bancLogique";
import { isRestricted } from "../src/access";

// Lot 50 : le banc d'essai du rendu (`?banc`) — la liste des mesures, les statistiques, le rapport. Le banc lui-même tourne dans `e2e/post.spec.ts` (rendu logiciel).

describe("lot 50 : le banc d'essai", () => {
  it("toutes les parties de la chaîne mesurées, avant et après ; les plafonds de pixels seulement s'ils réduisent l'image ; ≤ 2 min", () => {
    expect(configurations(1, "normal", 1920 * 1080).map((x) => x.id), "un écran 1080p : rien à plafonner à 2,07 millions").not.toContain("50-plafond-2073600");
    expect(configurations(1, "normal", 2560 * 1440).map((x) => x.id)).toEqual(expect.arrayContaining(["50-plafond-2073600", "50-plafond-2073600-msaa0", "50-plafond-2800000", "50-plafond-2800000-msaa0"]));
    for (const dpr of [1, 1.25, 2]) {
      const c = configurations(dpr);
      const ids = c.map((x) => x.id);
      for (const id of ["p1", "p2", "p3", "p3-47", "p3-50", "50-sans-halo", "50-sans-etalonnage", "50-sans-fxaa", "50-copie", "50-msaa0", "50-demi", "50-halo-quart"]) expect(ids, id).toContain(id);
      expect(ids.includes("p3-d1"), "densité 1 seulement si l'écran en a une autre").toBe(dpr !== 1);
      const p = plan(c);
      expect(p.length).toBe(c.reduce((n, x) => n + x.themes.length, 0));
      // Les trois thèmes pour les paliers 3 avec et sans les chaînes.
      for (const id of ["p3", "p3-47", "p3-50"]) expect(p.filter((x) => x.config.id === id).map((x) => x.theme).sort(), id).toEqual([...THEMES_BANC].sort());
      const secondes = (p.length * (DUREES.normal.chauffe + DUREES.normal.mesure)) / 1000;
      expect(secondes, "les mesures elles-mêmes, sans la préparation des scènes").toBeLessThan(115);
      // Un moteur puis l'autre (deux contextes) : les mesures d'un même écran se suivent.
      const ecrans = p.map((x) => x.config.ecran);
      expect(ecrans.indexOf("sans")).toBe(ecrans.lastIndexOf("msaa") + 1);
      // La chaîne du lot 50 ne tourne que sur un écran sans multi-échantillonnage (jamais deux).
      for (const x of c) if (x.chaine?.version === 50) expect(x.ecran, x.id).toBe("sans");
    }
    expect(configurations(1, "court").map((x) => x.id)).toEqual(["p1", "p3-47", "p3-50"]);
    expect(BANC_JOUR).toBe("2026-10-20");
  });

  it("centiles et résumé d'une mesure", () => {
    expect(centile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(centile([5, 1, 3, 2, 4], 99)).toBe(5);
    expect(centile([], 50)).toBe(0);
    const iv = [...Array(98).fill(16.7), 33.4, 50];
    const r = resumer({ intervalles: iv, fil: [1, 2, 3], appels: [100, 101, 100], gpu: [{ scene: 4, fin: 1 }, { scene: 6, fin: 1 }, { scene: 5, fin: 2 }] });
    expect(r.image).toEqual({ mediane: 16.7, p95: 16.7, p99: 33.4, pire: 50 });
    expect(r.ips).toBeCloseTo((100 * 1000) / iv.reduce((a, b) => a + b, 0), 1);
    expect(r.gpu).toEqual({ total: 7, passes: { scene: 5, fin: 1 } });
    expect(r.appels).toBe(100);
    expect(resumer({ intervalles: iv, fil: [], appels: [], gpu: null }).gpu, "sans minuteur").toBeNull();
  });

  it("un rapport valide, et ce qui le rend invalide", () => {
    const m = { config: "p1", libelle: "Palier 1", theme: "stade" as const, ...resumer({ intervalles: [16, 17, 18], fil: [1], appels: [10], gpu: null }), programmes: 30, compilations: 0, tachesLongues: 0, tampon: [800, 450] as [number, number], densite: 1 };
    const r: RapportBanc = {
      version: VERSION_RAPPORT,
      date: "2026-10-26T12:00:00.000Z",
      mode: "normal",
      circuit: { jour: BANC_JOUR, id: "x", debut: 2 },
      durees: { ...DUREES.normal },
      entete: { carteGraphique: "Iris Xe", navigateur: "x", canevas: [800, 450], densite: 1, pleinEcran: true, frequence: 60, palierAuto: 3, passesPermises: true, minuteurGpu: false },
      mesures: [m, { ...m, config: "p3-50", echec: "cible refusée : dessin direct" }],
      dureeS: 110,
    };
    expect(rapportValide(r)).toBe(true);
    expect(rapportValide(JSON.parse(JSON.stringify(r))), "après un aller-retour en JSON (« Copier le rapport »)").toBe(true);
    expect(rapportValide({ ...r, mesures: [] })).toBe(false);
    expect(rapportValide({ ...r, version: 0 })).toBe(false);
    expect(rapportValide({ ...r, mesures: [{ ...m, image: { ...m.image, p99: 1 } }] }), "centiles désordonnés").toBe(false);
  });

  it("recette et aperçus seulement : jamais en production, et le jeu ne démarre pas derrière lui", () => {
    const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
    expect(main).toContain('if (params.has("banc") && !isRestricted(location.search)) {');
    expect(main).toContain('import("./banc/banc")');
    expect(isRestricted("?banc", "1")).toBe(true);
    // Rien d'écrit : ni stockage, ni serveur.
    for (const f of ["banc.ts", "bancLogique.ts"]) expect(readFileSync(new URL(`../src/banc/${f}`, import.meta.url), "utf8"), f).not.toMatch(/setItem|fetch\(|sendBeacon/);
  });
});
