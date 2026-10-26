import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector2, type WebGLRenderer } from "three";
import { dailyCircuit, daysFromCivil, type PaletteName } from "@cdj/sim";
import { buildHalos } from "../src/halo";
import { LOOKS } from "../src/trackMesh";
import { geometrieP1 } from "../src/scene/composerP1";
import { PAS, PAS_IDS } from "../src/scene/paliers";
import { POST_3 } from "../src/scene/themesPost";
import { THEMES_3 } from "../src/scene/themes3";
import { FORME_JEU, PIXELS_MSAA, SEUIL_HALO_NUIT, avecHalo, echelleScene, formeDuJeu, noyau, octetsParPixel } from "../src/scene/post";
import { SORTIE_LINEAIRE } from "../src/scene/socle";
import { GardePost, PostJeu } from "../src/scene/postJeu";
import { NIVEAU_DU_CHOIX, chaineAuChargement, palierAuChargement, passesPermises, type Appareil } from "../src/qualite";
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

describe("lot 50 : la mémoire des cibles", () => {
  it("1920 × 1080 : le multi-échantillonnage ×4 y est, 1440p et au-delà non ; 4 octets par pixel au lieu de 8, plus de cibles de passes, le halo la Nuit seulement", () => {
    expect(1920 * 1080).toBeLessThan(PIXELS_MSAA);
    expect(2560 * 1440).toBeGreaterThan(PIXELS_MSAA);
    // Scène résolue 4 + 4 × (4 + 4) (R11F_G11F_B10F et profondeur) ; sans multi-échantillonnage 4 + 4 ; le halo : la moitié de la résolution et ses niveaux.
    expect(octetsParPixel(4, false)).toBe(36);
    expect(octetsParPixel(0, false)).toBe(8);
    expect(octetsParPixel(4, true)).toBeCloseTo(36 + 8 * (2 / 3 + 1 / 4), 5);
    expect(octetsParPixel(4, false, "demi"), "en demi-flottants (repli)").toBe(8 + 4 * 12);
    const mo = (n: number) => (n * 1920 * 1080) / 1024 / 1024;
    expect(mo(octetsParPixel(4, false))).toBeCloseTo(71.2, 0); // le jour (le chiffre du README ; 157,5 au lot 47)
    expect(mo(octetsParPixel(4, true))).toBeCloseTo(85.7, 0); // la Nuit
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

  it("une perte de contexte WebGL coupe la chaîne à l'instant, laisse les nuanceurs d'écran tels quels et le dit une seule fois", () => {
    const { renderer, toile } = fauxRenderer();
    const coupures: string[] = [];
    const post = new PostJeu(renderer, { halo: true, etalonnage: true, anticrenelage: true }, (r) => coupures.push(r));
    const scene = new Scene();
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffb347, size: 6 }], 1)!;
    scene.add(halos.points);
    const avant = (halos.points.material as ShaderMaterial).fragmentShader;
    post.forcerEchec = 1;
    expect(post.dessiner(scene, unCamera, "nuit", 1)).toBe(false);
    expect(coupures).toEqual([]);
    toile.dispatchEvent(new Event("webglcontextlost"));
    expect(coupures).toEqual(["contexte"]);
    expect(post.active).toBe(false);
    expect((halos.points.material as ShaderMaterial).fragmentShader, "lot 50 : rien n'a été réécrit (un uniforme partagé, à 0 hors de la chaîne)").toBe(avant);
    expect(SORTIE_LINEAIRE.value).toBe(0);
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
  it("main.ts ne demande la chaîne qu'avec le palier 3 et passesPermises (un seul endroit, sans autre chemin) ; le mode copie, seulement sur un moteur créé pour la chaîne", () => {
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    expect(main).toContain('PAS_DU_JEU.post = () => import("./scene/postJeu")');
    expect(main).toContain('postDemande && postPermis() ? "chaine" : ecranSansMsaa && appareil.demiFlottants');
    expect(main).toContain('plus: postPermis() && postVoulu(choix, appareil, memoireQualite) ? ["post"] : []');
    expect(main).toContain("const postPermis = () => passesPermises(appareil)");
    expect(main.match(/"post"/g)!.length, "les endroits où « post » est nommé").toBeLessThanOrEqual(8);
  });
});

describe("lot 50 : les nuanceurs d'écran dans la chaîne (halos, particules des effets) — un uniforme, aucun parcours des matériaux", () => {
  it("les halos et les particules des effets lisent l'uniforme partagé ; plus de module qui réécrit les nuanceurs (lineaire.ts) ; la chaîne ne parcourt pas la scène", () => {
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffa94d, size: 6 }], LOOKS.nuit.halo)!;
    expect((halos.points.material as ShaderMaterial).uniforms.uLineaire).toBe(SORTIE_LINEAIRE);
    expect(readFileSync(join(SRC, "fx.ts"), "utf8")).toContain("uLineaire: SORTIE_LINEAIRE");
    expect(sources(SRC).some((f) => f.endsWith("scene/lineaire.ts"))).toBe(false);
    for (const f of ["scene/post.ts", "scene/postJeu.ts"]) {
      const code = readFileSync(join(SRC, f), "utf8");
      expect(code, `${f} : rien qui parcourt les objets ou les matériaux`).not.toMatch(/\.traverse\(|adapter\(|lineariser\(/);
    }
    // La chaîne le met à 1 le temps de la scène, puis à 0 (même si le dessin échoue : `finally`).
    const post = readFileSync(join(SRC, "scene/post.ts"), "utf8");
    expect(post).toMatch(/SORTIE_LINEAIRE\.value = 1;\s*renderer\.render\(scene, camera\);\s*SORTIE_LINEAIRE\.value = 0;/);
    expect(post).toMatch(/finally \{\s*SORTIE_LINEAIRE\.value = 0;/);
  });

  it("la Nuit a ses halos de lampadaires (le nuanceur écrit des couleurs d'écran, donc adapté) ; le jour les a discrets (et le halo de la chaîne y est au seuil haut)", () => {
    const jour = (d: [number, number, number], theme: string | null) => dailyCircuit(daysFromCivil(...d), 0, theme as never);
    const nuit = jour([2026, 10, 14], null);
    const geo = geometrieP1(nuit.track, nuit.palette, { headless: true, decor: DECORS_TEST[nuit.palette] });
    const specs = [geo.calques.route, geo.calques.solide, geo.calques.lumineux, geo.decor!.decor].flatMap((b) => b.halos);
    expect(nuit.palette).toBe("nuit");
    expect(specs.length, "lampadaires, plaques et portes de la Nuit").toBeGreaterThan(0);
    const points = buildHalos(specs, LOOKS[nuit.palette].halo)!;
    expect((points.points.material as ShaderMaterial).uniforms.uLineaire).toBe(SORTIE_LINEAIRE);
    // Le jour, les halos en points sont discrets (0 à 0,2 : plaques, turbos, portes) ; la Nuit et le Néon les ont entiers.
    for (const p of ["stade", "desert", "neige", "campagne", "canyon", "alpin", "ville"] as const) expect(LOOKS[p].halo, `${p} : halo en points discret le jour`).toBeLessThanOrEqual(0.2);
    for (const p of ["nuit", "neon"] as const) expect(LOOKS[p].halo, p).toBeGreaterThanOrEqual(1);
  });
});

describe("lot 50 : une seule passe de fin, pas de halo le jour, jamais deux multi-échantillonnages", () => {
  const post = readFileSync(join(SRC, "scene/post.ts"), "utf8");
  it("la chaîne n'a plus les passes de three.js : la sortie, l'étalonnage et le FXAA sont un seul nuanceur, dessiné une fois à l'écran", () => {
    expect(post, "aucune passe de three.js importée").not.toMatch(/from "three\/examples\/jsm\/(postprocessing|shaders)\//);
    expect(post.match(/setRenderTarget\(null\);\s*renderer\.render\(this\.quad, camera\);/g), "un seul dessin à l'écran").toHaveLength(1);
    const fin = /const FIN = \/\* glsl \*\/ `([\s\S]*?)`;/.exec(post)![1]!;
    for (const morceau of ["toneMapping(c)", "linearToOutputTexel", "#ifdef ETALONNAGE", "#ifdef FXAA", "#ifdef HALO"]) expect(fin, morceau).toContain(morceau);
  });
  it("le halo seulement la Nuit et au Néon : le jour il ne touchait que le disque du soleil", () => {
    for (const p of Object.keys(POST_3) as PaletteName[]) expect(avecHalo(POST_3[p]), p).toBe(p === "nuit" || p === "neon");
    expect(SEUIL_HALO_NUIT).toBeLessThan(2);
  });
  it("le flou du halo est celui d'UnrealBloomPass (gaussienne normalisée, prises voisines fusionnées)", () => {
    for (const [k, paires] of [[6, 3], [10, 5], [14, 7], [18, 9], [22, 11]] as const) {
      const n = noyau(k);
      expect(n.decalages.filter((d) => d > 0)).toHaveLength(paires);
      expect(n.centre + 2 * n.poids.reduce((a, b) => a + b, 0), `noyau ${k}`).toBeCloseTo(1, 1);
    }
  });
  it("jamais deux multi-échantillonnages : un moteur sans le sien quand la chaîne est voulue au chargement ; sinon la scène de la chaîne n'en fait pas", () => {
    expect(formeDuJeu(false)).toEqual(FORME_JEU);
    expect(FORME_JEU.echantillons, "rapport 2 du banc : la scène de la chaîne sans multi-échantillonnage (le FXAA lisse)").toBe(0);
    expect(formeDuJeu(true).echantillons, "écran déjà multi-échantillonné").toBe(0);
    const o = { adresse: null, choix: "maximale" as const, ordinateur: true };
    expect(chaineAuChargement(o)).toBe(true);
    expect(chaineAuChargement({ ...o, choix: "auto", dansAuto: false }), "Auto sans le post-traitement (47b)").toBe(false);
    expect(chaineAuChargement({ ...o, choix: "auto" }), "lot 50 : Auto l'a (un ordinateur part du palier 3)").toBe(true);
    expect(chaineAuChargement({ ...o, ordinateur: false }), "jamais un téléphone").toBe(false);
    expect(chaineAuChargement({ ...o, choix: "auto", adresse: { palier: "P3", coupes: [] } }), "?palier=3").toBe(true);
    expect(chaineAuChargement({ ...o, adresse: { palier: "P3", coupes: ["post"] } }), "?reglages=3-post").toBe(false);
    expect(chaineAuChargement({ ...o, adresse: { palier: "P2", coupes: [] } }), "?palier=2 l'emporte sur Maximale").toBe(false);
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    expect(main).toContain("new WebGLRenderer({ antialias: !ecranSansMsaa })");
    expect(main).toContain("const forme = m.formeDuJeu(!ecranSansMsaa);");
  });
});

describe("lot 50 : ce que le premier rapport du banc a changé (Iris Xe, 2560 × 1440)", () => {
  const post = readFileSync(join(SRC, "scene/post.ts"), "utf8");
  it("le FXAA juge les bords sur une luminance approchée (une lecture) : la couleur finale n'est calculée que pour les deux pixels mêlés (12 ms → mesuré à nouveau)", () => {
    const lum = /float lum\(vec2 uv\) \{([\s\S]*?)\n\}/.exec(post)![1]!;
    expect(lum, "pas la couleur finale de chaque voisin").not.toContain("ecran(");
    expect(lum.match(/texture2D/g)).toHaveLength(1);
    const fin = /const FIN = \/\* glsl \*\/ `([\s\S]*?)`;/.exec(post)![1]!;
    expect(fin.match(/ecran\(/g)!.length, "la définition, le pixel, son voisin").toBe(3);
  });
  it("le halo reprend la composition d'UnrealBloomPass de three.js r186 : ×3, et pesé par sa composante la plus forte", () => {
    expect(post).toContain("3 * t.halo.force * (x + (1.2 - 2 * x) * t.halo.rayon)");
    expect(post).toContain("gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));");
    expect(post).toContain("c += h.rgb * h.a;");
    const unreal = readFileSync(new URL("../../../node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js", import.meta.url), "utf8");
    expect(unreal, "si three.js change sa composition, celle-ci est à revoir").toContain("vec3 bloom = 3.0 * bloomStrength * (");
    expect(unreal).toContain("float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );");
  });
  it("le plafond de pixels de la scène : une échelle, 1 sous le plafond", () => {
    expect(echelleScene(1920, 1080, 0)).toBe(1);
    expect(echelleScene(1920, 1080, 2_073_600)).toBe(1);
    expect(echelleScene(2560, 1440, 2_073_600)).toBeCloseTo(0.75, 5);
    expect(FORME_JEU.pixelsMax, "rapport 2 du banc : un 1080p").toBe(1920 * 1080);
  });
});
