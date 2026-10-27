import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANC_JOUR, DUREES, THEMES_BANC, VERSION_RAPPORT, centile, configurations, plan, rapportValide, resolutionConforme, resumer, tamponAttendu, type MesureBanc, type RapportBanc } from "../src/banc/bancLogique";
import { isRestricted } from "../src/access";

// Lot 50 : le banc d'essai du rendu (`?banc`) — la liste des mesures, les statistiques, le rapport. Le banc lui-même tourne dans `e2e/post.spec.ts` (rendu logiciel).

describe("lot 50 : le banc d'essai", () => {
  it("toutes les parties de la chaîne mesurées, avant et après ; aucune variante de plafond de pixels (la scène est à la résolution native) ; ≤ 2 min", () => {
    expect(configurations(1).map((x) => x.id).filter((id) => /plafond/.test(id)), "lot 51 : plus de plafond").toEqual([]);
    for (const dpr of [1, 1.25, 2]) {
      const c = configurations(dpr);
      const ids = c.map((x) => x.id);
      for (const id of ["p1", "p2", "p3", "p3-50", "50-sans-halo", "50-sans-etalonnage", "50-sans-fxaa", "50-copie", "50-msaa4", "50-demi", "50-halo-quart"]) expect(ids, id).toContain(id);
      expect(ids.includes("p3-d1"), "densité 1 seulement si l'écran en a une autre").toBe(dpr !== 1);
      const p = plan(c);
      expect(p.length).toBe(c.reduce((n, x) => n + x.themes.length, 0));
      // Les trois thèmes pour les paliers 3 avec et sans les chaînes.
      for (const id of ["p3", "p3-50"]) expect(p.filter((x) => x.config.id === id).map((x) => x.theme).sort(), id).toEqual([...THEMES_BANC].sort());
      const secondes = (p.length * (DUREES.normal.chauffe + DUREES.normal.mesure)) / 1000;
      expect(secondes, "les mesures elles-mêmes, sans la préparation des scènes").toBeLessThan(115);
      // Un moteur puis l'autre (deux contextes) : les mesures d'un même écran se suivent.
      const ecrans = p.map((x) => x.config.ecran);
      expect(ecrans.indexOf("sans")).toBe(ecrans.lastIndexOf("msaa") + 1);
      // La chaîne ne tourne que sur un écran sans multi-échantillonnage (jamais deux).
      for (const x of c) if (x.chaine) expect(x.ecran, x.id).toBe("sans");
    }
    expect(configurations(1, "court").map((x) => x.id)).toEqual(["p1", "p3", "p3-50"]);
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
    const m = { config: "p1", libelle: "Palier 1", theme: "stade" as const, ...resumer({ intervalles: [16, 17, 18], fil: [1], appels: [10], gpu: null }), programmes: 30, compilations: 0, tachesLongues: 0, tampon: [800, 450] as [number, number], densite: 1, cibles: null };
    const r: RapportBanc = {
      version: VERSION_RAPPORT,
      date: "2026-10-26T12:00:00.000Z",
      mode: "normal",
      circuit: { jour: BANC_JOUR, id: "x", debut: 2 },
      durees: { ...DUREES.normal },
      entete: { carteGraphique: "Iris Xe", navigateur: "x", canevas: [800, 450], densite: 1, tampon: [800, 450] as [number, number], pleinEcran: true, frequence: 60, palierAuto: 3, passesPermises: true, minuteurGpu: false },
      mesures: [m, { ...m, config: "p3-50", echec: "cible refusée : dessin direct" }],
      dureeS: 110,
    };
    expect(rapportValide(r)).toBe(true);
    expect(rapportValide(JSON.parse(JSON.stringify(r))), "après un aller-retour en JSON (« Copier le rapport »)").toBe(true);
    expect(rapportValide({ ...r, mesures: [] })).toBe(false);
    expect(rapportValide({ ...r, version: 0 })).toBe(false);
    expect(rapportValide({ ...r, mesures: [{ ...m, image: { ...m.image, p99: 1 } }] }), "centiles désordonnés").toBe(false);
  });

  it("lot 51 : le tampon vaut la fenêtre × la densité (plafonnée à 2) ; la cible de la scène a cette taille, jamais moins ; le halo est plus petit", () => {
    // Fenêtre × densité : 1080p, 1440p, 4K à la densité 1 ; un portable 1280 × 800 à 1,5 ; un écran à 3 : plafonné à 2.
    expect(tamponAttendu(1920, 1080, 1)).toEqual([1920, 1080]);
    expect(tamponAttendu(2560, 1440, 1)).toEqual([2560, 1440]);
    expect(tamponAttendu(3840, 2160, 1)).toEqual([3840, 2160]);
    expect(tamponAttendu(1280, 800, 1.5)).toEqual([1920, 1200]);
    expect(tamponAttendu(1707, 1067, 1.5), "partie entière, comme WebGLRenderer.setSize").toEqual([2560, 1600]);
    const base = { config: "p3-50", libelle: "x", theme: "nuit" as const, ...resumer({ intervalles: [16, 17, 18], fil: [1], appels: [10], gpu: null }), programmes: 30, compilations: 0, tachesLongues: 0 };
    const mesure = (densite: number, tampon: [number, number], cibles: MesureBanc["cibles"]): MesureBanc => ({ ...base, densite, tampon, cibles });
    const halo: [number, number][] = [[1280, 720], [640, 360]];
    expect(resolutionConforme(mesure(1, [2560, 1440], { scene: [2560, 1440, 0], halo }), [2560, 1440])).toBe(true);
    expect(resolutionConforme(mesure(1, [2560, 1440], null), [2560, 1440]), "dessin direct : seul le tampon compte").toBe(true);
    expect(resolutionConforme(mesure(1, [2560, 1440], { scene: [1920, 1080, 0], halo }), [2560, 1440]), "la scène plus petite que le tampon (le lot 50 à 1440p)").toBe(false);
    expect(resolutionConforme(mesure(1, [3840, 2160], { scene: [1920, 1080, 0], halo }), [3840, 2160]), "4K : la scène à moitié").toBe(false);
    expect(resolutionConforme(mesure(1, [1920, 1080], null), [2560, 1440]), "un tampon qui n'est pas la fenêtre × la densité").toBe(false);
    expect(resolutionConforme(mesure(1.5, [1920, 1200], { scene: [1920, 1200, 0], halo }), [1280, 800])).toBe(true);
    expect(resolutionConforme(mesure(1, [2560, 1440], { scene: [2560, 1440, 0], halo: [[2561, 720]] }), [2560, 1440]), "un halo plus grand que l'écran").toBe(false);
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
