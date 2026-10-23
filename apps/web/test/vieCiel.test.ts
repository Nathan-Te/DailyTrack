import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Points, Scene, Vector3, type Mesh } from "three";
import { NO_GROUND, createSurface, dailyCircuit, daysFromCivil, trackWorld, type PaletteName, type Track } from "@cdj/sim";
import { sceneDemandee } from "../src/access";
import { DEFAULT_ADMIN, SCENES_ADMIN, buildQuery } from "../src/adminLogic";
import { geometrieP1 } from "../src/scene/composerP1";
import { pasVoulus, PAS_DU_PALIER } from "../src/scene/socle";
import { VIE, SALVE_S, appelsParFamille } from "../src/scene/vieJeu";
import { CIEL } from "../src/scene/cielJeu";
import { OMBRES } from "../src/scene/ombres3";
import type { AnimationPas, PasScene } from "../src/scene/types";
import { resserrerGlsl, resserrerModule } from "../outils/glsl";

// Lot 46 : la vie et le ciel du palier 3 en jeu (et le groupe « vie et ciel » des téléphones récents). Sans carte graphique : la pose des pièces
// (`geometrieP1` avec les pas, sans DOM), les maillages posés (un par famille), l'animation (un temps d'affichage), les adresses. Dans le vrai jeu :
// `e2e/vie-ciel.spec.ts` (le chargement à la demande hors course, les confettis du Stade à l'arrivée).

/** Un circuit du jour par thème joué (Stade, Nuit, Banquise imposée, Ville), comme les planches du lot. */
function circuit(jour: [number, number, number], theme: string | null = null): { track: Track; palette: PaletteName } {
  const c = dailyCircuit(daysFromCivil(...jour), 0, theme as never);
  return { track: c.track, palette: c.palette };
}
const CIRCUITS = [circuit([2026, 10, 8]), circuit([2026, 10, 14]), circuit([2026, 10, 10], "banquise"), circuit([2026, 10, 16])];

/** La scène d'un circuit avec les pas, sans DOM : les formes posées, puis les maillages de chaque pas dans une scène vide. */
function scenePas(c: { track: Track; palette: PaletteName }, pas: readonly PasScene[], coupes: readonly string[] = []) {
  const geo = geometrieP1(c.track, c.palette, { headless: true, pas, coupes });
  const scene = new Scene();
  const animations = pas.map((p) => p.poser?.({ scene, calques: geo.calques, x: geo.x, decor: geo.decor, soleil: new Vector3(0.3, 0.9, -0.2).normalize(), coupes: new Set(coupes), sansDom: true }) as AnimationPas);
  return { geo, scene, animations };
}

describe("lot 46 : où la vie et le ciel s'activent", () => {
  it("?palier=1|2|3 et ?reglages= (un palier, des pas en plus ou coupés), hors production seulement ; illisible : ignoré", () => {
    expect(sceneDemandee("?palier=3", false)).toEqual({ palier: "P3", plus: [], coupes: [] });
    expect(sceneDemandee("?reglages=2+vie+ciel", false)).toEqual({ palier: "P2", plus: ["vie", "ciel"], coupes: [] });
    expect(sceneDemandee("?reglages=3-particules-ombres", false)).toEqual({ palier: "P3", plus: [], coupes: ["particules", "ombres"] });
    expect(sceneDemandee("?palier=1&reglages=3", false)?.palier).toBe("P3"); // `reglages` l'emporte
    expect(sceneDemandee("?palier=3", true)).toBeNull(); // la production : jamais
    for (const q of ["?palier=4", "?reglages=3+", "?reglages=deux", ""]) expect(sceneDemandee(q, false), q).toBeNull();
    expect(pasVoulus("P3", [], ["ombres"])).toEqual(["vie", "ciel"]);
  });

  it("la page d'admin propose le palier 3 et le palier 2 + vie et ciel (`?reglages=`), que le jeu sait lire", () => {
    for (const r of SCENES_ADMIN) {
      const q = buildQuery({ ...DEFAULT_ADMIN, scene: r });
      expect(q).toContain(`reglages=${encodeURIComponent(r)}`);
      expect(sceneDemandee(`?${q}`, false), r).not.toBeNull();
    }
  });

  it("les ombres fines sont un pas du palier 3 seulement (ordinateur), pas du groupe des téléphones", () => {
    expect(OMBRES.ombres).toEqual({ carte: 2048, demi: 60, avant: 34, normalBias: 0.04 });
    expect(PAS_DU_PALIER.P3).toContain("ombres");
    expect(PAS_DU_PALIER.P2).not.toContain("ombres");
  });
});

describe("lot 46 : la vie et le ciel posés", () => {
  it("un appel de rendu au plus par famille (drapeaux, foule, écrans, particules, nuages), sur chaque thème joué", () => {
    for (const c of CIRCUITS) {
      const { scene } = scenePas(c, [VIE, CIEL, OMBRES]);
      const appels = appelsParFamille(scene);
      expect(Object.keys(appels).sort(), c.palette).toEqual(["drapeaux", "ecrans", "foule", "nuages", "particules"]);
      for (const [famille, n] of Object.entries(appels)) expect(n, `${c.palette} : ${famille}`).toBe(1);
    }
  });

  it("une partie coupée n'est pas posée (`?reglages=3-foule-particules`) ; la foule coupée reste dans le décor, dessinée comme avant", () => {
    const c = CIRCUITS[0]!;
    const avec = scenePas(c, [VIE, CIEL]);
    const sans = scenePas(c, [VIE, CIEL], ["foule", "particules", "nuages"]);
    expect(Object.keys(appelsParFamille(sans.scene)).sort()).toEqual(["drapeaux", "ecrans"]);
    expect(sans.geo.decor.vie.foule).toBeNull();
    // Les spectateurs confiés à la foule animée ne sont plus dans le décor ; coupée, la foule y revient (les mêmes tirages : le reste du décor ne bouge pas).
    expect(avec.geo.decor.vie.foule!.length).toBeGreaterThan(50);
    expect(sans.geo.decor.decorG.pos.length - avec.geo.decor.decorG.pos.length).toBeGreaterThan(50 * 36 * 3 - 1);
    const p1 = geometrieP1(c.track, c.palette, { headless: true });
    expect(p1.decor.decorG.pos.length).toBe(sans.geo.decor.decorG.pos.length - 3 * 36 * 3); // + les trois mâts du toit (des boîtes) : le reste est le même décor
  });

  it("rien ne bouge dans le champ de la piste : drapeaux, écrans, chronomètre et foule sont à côté de ce que roule la voiture, ou bien au-dessus (≥ 8 m)", () => {
    const sol = createSurface();
    for (const c of CIRCUITS) {
      const { geo } = scenePas(c, [VIE]);
      const monde = trackWorld(c.track);
      const pieces: [string, number[]][] = [
        ["drapeaux", geo.calques.drapeaux!.pos],
        ["écrans", geo.calques.ecrans!.pos],
        ["chronomètre", geo.calques.chrono!.pos],
        ["foule", geo.decor.vie.foule!.flatMap((p) => [p.x, p.y, p.z])],
      ];
      for (const [nom, pos] of pieces) {
        expect(pos.length, `${c.palette} : ${nom}`).toBeGreaterThan(0);
        for (let i = 0; i < pos.length; i += 3) {
          monde.sample(pos[i]!, pos[i + 2]!, sol);
          if (sol.height === NO_GROUND) continue;
          expect(pos[i + 1]! - sol.height, `${c.palette} : ${nom} au-dessus de la piste`).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it("l'animation suit un temps d'affichage : la même image pour le même temps, et rien d'autre n'est lu", () => {
    const c = CIRCUITS[3]!;
    const { scene, animations } = scenePas(c, [VIE, CIEL]);
    const camera = new PerspectiveCamera(60, 2, 0.1, 2000);
    camera.position.set(10, 3, -4);
    camera.lookAt(10, 2, 20);
    const etat = () => {
      const u: unknown[] = [];
      scene.traverse((o) => {
        const m = (o as Mesh).material as { uniforms?: Record<string, { value: unknown }> } | undefined;
        if (m?.uniforms) u.push(JSON.stringify(Object.fromEntries(Object.entries(m.uniforms).filter(([k]) => k !== "uNuages" && k !== "uRuban" && k !== "uCadran").map(([k, v]) => [k, v.value]))));
      });
      return u.join("|");
    };
    for (const a of animations) a.animer?.(12.5, camera, 780);
    const une = etat();
    for (const a of animations) a.animer?.(40, camera, 780);
    expect(etat()).not.toBe(une);
    for (const a of animations) a.animer?.(12.5, camera, 780);
    expect(etat()).toBe(une);
  });

  it("au Stade, des confettis à l'arrivée seulement : invisibles avant, une salve de 8 s au passage de la ligne ; ailleurs, l'ambiance du thème", () => {
    const camera = new PerspectiveCamera();
    const stade = scenePas(CIRCUITS[0]!, [VIE]);
    expect(CIRCUITS[0]!.palette).toBe("stade");
    const vie = stade.animations[0]!;
    const points = () => {
      let p: Points | null = null;
      stade.scene.traverse((o) => (o instanceof Points ? (p = o) : null));
      return p! as Points;
    };
    for (const t of [0, 30, 300]) {
      vie.animer!(t, camera, 780);
      expect(points().visible, `avant l'arrivée (${t} s)`).toBe(false);
    }
    vie.arrivee!(400);
    for (const [t, vu] of [[400.1, true], [405, true], [400 + SALVE_S + 0.1, false]] as const) {
      vie.animer!(t, camera, 780);
      expect(points().visible, `${t - 400} s après la ligne`).toBe(vu);
    }
    expect(vie.stats!()).toMatchObject({ salves: 1 });
    // La Ville : sa poussière, toujours là ; pas de salve.
    const ville = scenePas(CIRCUITS[3]!, [VIE]);
    ville.animations[0]!.animer!(3, camera, 780);
    let visible = false;
    ville.scene.traverse((o) => (o instanceof Points ? (visible = o.visible) : null));
    expect(visible).toBe(true);
  });

  it("la Nuit garde son ciel de nuit : nuages sombres sur son dôme (la lune et les étoiles du palier 1 sont dessinées après lui)", () => {
    const { scene } = scenePas(CIRCUITS[1]!, [CIEL]);
    expect(CIRCUITS[1]!.palette).toBe("nuit");
    let dome: Mesh | null = null;
    scene.traverse((o) => (o.userData.vie === "nuages" ? (dome = o as Mesh) : null));
    const d = dome! as Mesh;
    expect(d.renderOrder).toBeLessThan(-2); // derrière le disque et les étoiles (renderOrder −2, transparents)
    const u = (d.material as unknown as { uniforms: Record<string, { value: { getHSL(o: { h: number; s: number; l: number }): { l: number } } }> }).uniforms;
    expect(u.uZenith!.value.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.15);
    expect(u.uClair!.value.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.3);
  });
});

describe("lot 46 : les nuanceurs resserrés à la construction", () => {
  it("commentaires, indentation et lignes vides retirés ; les directives gardent leur ligne, un saut de ligne au début et à la fin", () => {
    expect(resserrerGlsl("\n  // un commentaire\n  #ifdef X\n    float a = 1.0; // fin\n  /* bloc */\n  #endif\n")).toBe("\n#ifdef X\nfloat a = 1.0;\n#endif\n");
    expect("#include <begin_vertex>" + resserrerGlsl("\n#ifdef Y\nx;\n#endif")).toBe("#include <begin_vertex>\n#ifdef Y\nx;\n#endif\n");
  });

  it("seuls les gabarits marqués `/* glsl */` (sans `${…}`) sont touchés", () => {
    const code = "const A = /* glsl */ `\n  a;   // x\n`;\nconst B = `\n  b;   // y\n`;\nconst C = /* glsl */ `\n ${z}\n`;";
    expect(resserrerModule(code)).toBe("const A = `\na;\n`;\nconst B = `\n  b;   // y\n`;\nconst C = /* glsl */ `\n ${z}\n`;");
  });
});
