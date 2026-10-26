import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector2, type WebGLRenderer } from "three";
import { dailyCircuit, daysFromCivil, type PaletteName } from "@cdj/sim";
import { buildHalos } from "../src/halo";
import { LOOKS } from "../src/trackMesh";
import { geometrieP1 } from "../src/scene/composerP1";
import { PAS, PAS_IDS } from "../src/scene/paliers";
import { adapter, restituer } from "../src/scene/lineaire";
import { POST_3 } from "../src/scene/themesPost";
import { THEMES_3 } from "../src/scene/themes3";
import { PIXELS_MSAA, octetsParPixel } from "../src/scene/post";
import { GardePost, PostJeu } from "../src/scene/postJeu";
import { NIVEAU_DU_CHOIX, palierAuChargement, passesPermises, type Appareil } from "../src/qualite";
import { apresCoupure } from "../src/qualiteMesure";
import { DECORS_TEST } from "./decorChecks";

// Lot 47 : le post-traitement du palier 3, sur ordinateur seulement — halo, étalonnage, FXAA (ni occlusion GTAO ni SMAA). Sans carte graphique : les garde-fous (la
// perte de contexte, deux images ratées), qui peut avoir la chaîne (jamais un téléphone), la linéarisation des nuanceurs d'écran (les halos de la Nuit), les
// nombres de la mémoire. Dans le vrai jeu (rendu logiciel, `?appareil=ordinateur`) : `e2e/post.spec.ts`.

const SRC = new URL("../src/", import.meta.url).pathname;
const sources = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? sources(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));

describe("lot 47 : FXAA seul — ni occlusion GTAO ni SMAA", () => {
  it("aucun module du jeu ni de la vitrine n'importe GTAO ou SMAA ; la chaîne prend FXAA", () => {
    for (const f of sources(SRC)) expect(readFileSync(f, "utf8"), f.replace(SRC, "src/")).not.toMatch(/GTAOPass|GTAOShader|SMAAPass|SMAAShader/);
    const post = readFileSync(join(SRC, "scene/post.ts"), "utf8");
    expect(post).toContain("FXAAPass");
    expect(post).toContain("OutputPass");
    expect(post).toContain("UnrealBloomPass");
  });

  it("le pas « occlusion » n'existe plus ; la famille post est l'étalonnage, l'anticrénelage et le halo", () => {
    expect(PAS_IDS).not.toContain("occlusion");
    expect(PAS.filter((p) => p.famille === "post").map((p) => p.id)).toEqual(["etalonnage", "anticrenelage", "halo"]);
    expect(PAS.filter((p) => p.passe).map((p) => p.id)).toEqual(["etalonnage", "anticrenelage", "halo"]);
  });

  it("chaque thème a son étalonnage et son halo : fort la Nuit et le Néon, discret le jour (seuil haut)", () => {
    for (const k of Object.keys(POST_3) as PaletteName[]) {
      expect(THEMES_3[k].halo, k).toEqual(POST_3[k].halo);
      expect(POST_3[k].etalonnage.contraste, k).toBeGreaterThan(1);
    }
    for (const nuit of ["nuit", "neon"] as const) {
      expect(POST_3[nuit].halo.force, nuit).toBeGreaterThan(0.5);
      expect(POST_3[nuit].halo.seuil, nuit).toBeLessThan(1);
    }
    // Le jour : le seuil du halo (lumière linéaire) est au-dessus de la peinture claire éclairée (≈ 1,65 au plus mesuré, voiture claire comprise : README du lot 47).
    for (const jour of ["stade", "desert", "neige", "campagne", "canyon", "alpin", "ville"] as const) {
      expect(POST_3[jour].halo.seuil, jour).toBeGreaterThanOrEqual(2);
      expect(POST_3[jour].halo.force, jour).toBeLessThan(0.2);
    }
  });
});

describe("lot 47 : la mémoire des cibles", () => {
  it("1920 × 1080 : le multi-échantillonnage ×4 y est, 1440p et au-delà non ; les octets par pixel", () => {
    expect(1920 * 1080).toBeLessThan(PIXELS_MSAA);
    expect(2560 * 1440).toBeGreaterThan(PIXELS_MSAA);
    // Scène résolue 8 + 4 × (8 + 4) (sans multi-échantillonnage : 8 + profondeur 4), deux cibles de passes 2 × 8, halo ≈ 7,6.
    expect(octetsParPixel(4)).toBeCloseTo(8 + 48 + 16 + 7.6, 5);
    expect(octetsParPixel(0)).toBeCloseTo(8 + 4 + 16 + 7.6, 5);
    const mo = (n: number) => (n * 1920 * 1080) / 1024 / 1024;
    expect(mo(octetsParPixel(4))).toBeCloseTo(157.5, 0); // le chiffre du README
    expect(mo(octetsParPixel(0))).toBeCloseTo(70.4, 0);
  });
});

/** Un faux moteur de rendu : de quoi construire la chaîne et écouter la perte du contexte (le dessin n'est pas essayé). */
function fauxRenderer() {
  const toile = new EventTarget();
  return { renderer: { domElement: toile, getDrawingBufferSize: (v: Vector2) => v.set(640, 360), info: {} } as unknown as WebGLRenderer, toile };
}
const unCamera = new PerspectiveCamera();

describe("lot 47 : les garde-fous", () => {
  it("deux images ratées de suite coupent la chaîne, une image réussie remet le compte à zéro", () => {
    const g = new GardePost();
    expect(g.image(false)).toBe(false);
    expect(g.image(true)).toBe(false);
    expect(g.echecs).toBe(0);
    expect(g.image(false)).toBe(false);
    expect(g.image(false)).toBe(true);
    expect(g.raison).toBe("echecs");
    expect(g.image(false), "elle n'est coupée qu'une fois").toBe(false);
  });

  it("une perte de contexte WebGL coupe la chaîne à l'instant, rend les nuanceurs à l'écran direct et le dit une seule fois", () => {
    const { renderer, toile } = fauxRenderer();
    const coupures: string[] = [];
    const post = new PostJeu(renderer, { halo: true, etalonnage: true, anticrenelage: true }, (r) => coupures.push(r));
    const scene = new Scene();
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffb347, size: 6 }], 1)!;
    scene.add(halos.points);
    const avant = (halos.points.material as ShaderMaterial).fragmentShader;
    post.forcerEchec = 1; // une image qui échoue : le halo est tout de même passé en linéaire (la chaîne est « en route »)
    expect(post.dessiner(scene, unCamera, "nuit", 1)).toBe(false);
    expect((halos.points.material as ShaderMaterial).fragmentShader).toContain("vec3(2.2)");
    expect(coupures).toEqual([]);
    toile.dispatchEvent(new Event("webglcontextlost"));
    expect(coupures).toEqual(["contexte"]);
    expect(post.active).toBe(false);
    expect((halos.points.material as ShaderMaterial).fragmentShader, "revenu à l'écran direct").toBe(avant);
    toile.dispatchEvent(new Event("webglcontextlost"));
    expect(coupures, "l'écouteur est retiré").toEqual(["contexte"]);
    expect(post.dessiner(scene, unCamera, "nuit", 1), "coupée : on dessine directement").toBe(false);
  });

  it("deux images ratées de suite : la chaîne se coupe d'elle-même et prévient le jeu", () => {
    const { renderer, toile } = fauxRenderer();
    const coupures: string[] = [];
    const post = new PostJeu(renderer, { halo: true, etalonnage: true, anticrenelage: true }, (r) => coupures.push(r));
    post.forcerEchec = 2;
    expect(post.dessiner(new Scene(), unCamera, "stade", 1)).toBe(false);
    expect(coupures).toEqual([]);
    expect(post.dessiner(new Scene(), unCamera, "stade", 1)).toBe(false);
    expect(coupures).toEqual(["echecs"]);
    expect(post.active).toBe(false);
    toile.dispatchEvent(new Event("webglcontextlost"));
    expect(coupures, "une chaîne coupée n'écoute plus").toEqual(["echecs"]);
  });

  it("après une coupure : le palier 2, un plafond durable, jamais plus le palier 3 sur cet appareil ; la remesure part du palier 2", () => {
    const m = apresCoupure({ palier: 3, date: 1000, mediane: 9, pixels: 2_000_000, echecs: 0, plafond: null, durable: false }, 5000, 2_073_600);
    expect(m).toEqual({ palier: 2, date: 5000, mediane: null, pixels: 2_073_600, echecs: 0, plafond: 2, durable: true });
    const ordinateur: Appareil = { ordinateur: true, logiciel: false, demiFlottants: true, memoire: 8 };
    expect(palierAuChargement(ordinateur, m, 6000, 2_073_600)).toEqual({ palier: 2, mesurer: true });
    expect(palierAuChargement(ordinateur, apresCoupure(null, 5000, 1), 6000, 1).palier).toBe(2);
  });
});

describe("lot 47 : jamais de passe plein écran sur un profil téléphone", () => {
  const telephone: Appareil = { ordinateur: false, logiciel: false, demiFlottants: true, memoire: 8 };
  it("un téléphone ou une tablette n'a jamais la chaîne, quelle que soit sa carte graphique ou sa mémoire", () => {
    for (const memoire of [undefined, 2, 4, 8]) for (const demiFlottants of [true, false]) expect(passesPermises({ ...telephone, demiFlottants, memoire }), `${memoire} Go, demi-flottants ${demiFlottants}`).toBe(false);
  });
  it("le réglage « Maximale » vise le palier 3 mais ne donne pas la chaîne à un appareil qui ne l'a pas : pas de demi-flottants, peu de mémoire, rendu logiciel", () => {
    expect(NIVEAU_DU_CHOIX.maximale).toBe(3);
    const ordinateur: Appareil = { ordinateur: true, logiciel: false, demiFlottants: true, memoire: 8 };
    expect(passesPermises(ordinateur)).toBe(true);
    expect(passesPermises({ ...ordinateur, memoire: undefined }), "mémoire non annoncée : permis").toBe(true);
    expect(passesPermises({ ...ordinateur, demiFlottants: false })).toBe(false);
    expect(passesPermises({ ...ordinateur, memoire: 2 })).toBe(false);
    expect(passesPermises({ ...ordinateur, logiciel: true })).toBe(false);
  });
  it("main.ts ne demande le module du post-traitement qu'avec le palier 3 et passesPermises (un seul endroit, sans autre chemin)", () => {
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    expect(main).toContain('PAS_DU_JEU.post = () => import("./scene/postJeu")');
    expect(main).toContain('plus: postPermis() && postVoulu(choix, appareil) ? ["post"] : []');
    expect(main).toContain("const postPermis = () => passesPermises(appareil)");
    expect(main.match(/"post"/g)!.length, "les endroits où « post » est nommé").toBeLessThanOrEqual(8);
  });
});

describe("lot 47 : les nuanceurs d'écran dans la chaîne (halos, particules des effets)", () => {
  const ecran = () => new ShaderMaterial({ fragmentShader: "varying vec3 vC;\nvoid main() {\n  gl_FragColor = vec4(vC.rgb, a);\n}" });
  const avecColorimetrie = () => new ShaderMaterial({ fragmentShader: "void main() {\n  gl_FragColor = vec4(c, 1.0);\n  #include <colorspace_fragment>\n}" });

  it("un halo ou une particule passe en lumière linéaire (le halo de la Nuit ne sort pas en gros disque), une seule fois ; un nuanceur déjà colorimétrique n'est pas touché", () => {
    const scene = new Scene();
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffa94d, size: 6 }], LOOKS.nuit.halo)!;
    const particules = new Points(undefined, ecran());
    const sein = new Mesh(new BoxGeometry(), avecColorimetrie());
    const standard = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    scene.add(halos.points, particules, sein, standard);
    const avant = (sein.material as ShaderMaterial).fragmentShader;
    adapter(scene);
    adapter(scene);
    const h = (halos.points.material as ShaderMaterial).fragmentShader;
    expect(h).toContain("pow(max(vColor * a * vFade, vec3(0.0)), vec3(2.2))");
    expect(h.match(/vec3\(2\.2\)/g)).toHaveLength(1);
    expect((particules.material as ShaderMaterial).fragmentShader).toContain("gl_FragColor = vec4(pow(max(vC.rgb, vec3(0.0)), vec3(2.2)), a);");
    expect((sein.material as ShaderMaterial).fragmentShader).toBe(avant);
  });

  it("restituer rend à l'écran direct ce qui avait été adapté, au caractère près, et un effet posé après coup est repris à l'image suivante", () => {
    const scene = new Scene();
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffa94d, size: 6 }], 1)!;
    const original = (halos.points.material as ShaderMaterial).fragmentShader;
    scene.add(halos.points);
    adapter(scene);
    const tardif = new Points(undefined, ecran());
    const origineTardive = (tardif.material as ShaderMaterial).fragmentShader;
    scene.add(tardif);
    adapter(scene);
    expect((tardif.material as ShaderMaterial).fragmentShader).not.toBe(origineTardive);
    restituer(scene);
    expect((halos.points.material as ShaderMaterial).fragmentShader).toBe(original);
    expect((tardif.material as ShaderMaterial).fragmentShader).toBe(origineTardive);
    restituer(scene); // sans effet la deuxième fois
    expect((halos.points.material as ShaderMaterial).fragmentShader).toBe(original);
  });

  it("la Nuit a ses halos de lampadaires (le nuanceur écrit des couleurs d'écran, donc adapté) ; le jour les a discrets (et le halo de la chaîne y est au seuil haut)", () => {
    const jour = (d: [number, number, number], theme: string | null) => dailyCircuit(daysFromCivil(...d), 0, theme as never);
    const nuit = jour([2026, 10, 14], null);
    const geo = geometrieP1(nuit.track, nuit.palette, { headless: true, decor: DECORS_TEST[nuit.palette] });
    const specs = [geo.calques.route, geo.calques.solide, geo.calques.lumineux, geo.decor!.decor].flatMap((b) => b.halos);
    expect(nuit.palette).toBe("nuit");
    expect(specs.length, "lampadaires, plaques et portes de la Nuit").toBeGreaterThan(0);
    const points = buildHalos(specs, LOOKS[nuit.palette].halo)!;
    const scene = new Scene();
    scene.add(points.points);
    adapter(scene);
    expect((points.points.material as ShaderMaterial).fragmentShader).toContain("vec3(2.2)");
    // Le jour, les halos en points sont discrets (0 à 0,2 : plaques, turbos, portes) ; la Nuit et le Néon les ont entiers.
    for (const p of ["stade", "desert", "neige", "campagne", "canyon", "alpin", "ville"] as const) expect(LOOKS[p].halo, `${p} : halo en points discret le jour`).toBeLessThanOrEqual(0.2);
    for (const p of ["nuit", "neon"] as const) expect(LOOKS[p].halo, p).toBeGreaterThanOrEqual(1);
  });
});
