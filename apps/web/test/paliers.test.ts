import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, MeshStandardMaterial, ShaderLib, Vector3, type ShaderMaterial } from "three";
import { CELL, bestPilotRun, isCurve, parseTrack, type PaletteName } from "@cdj/sim";
import { Builder, seeded } from "../src/meshKit";
import { PALETTE_DEFS } from "../src/trackMesh";
import { PAS, PAS_IDS, avecPas, avecPost, lireReglages, palierDe, reglagesDuPalier, texteReglages } from "../src/scene/paliers";
import { Affiches } from "../src/scene/outils";
import { Drapeaux, marque, varierInstance, varierParPosition } from "../src/scene/finition";
import { PERIODE_TEINTE, TRACES_SOMBRE, matiereAsphalte, matiereBeton, matiereDecor, matiereMetal, teinteLarge, tracesEtMarquages } from "../src/scene/matiere";
import { brumeDeProfondeur, uniformesBrume } from "../src/scene/lumiere3";
import { THEMES_3 } from "../src/scene/themes3";
import { verserDrapeaux } from "../src/scene/drapeaux";
import { ROUTE_SOUS_LUMIERE_CHAUDE, paletteP1, portiqueDepartP } from "../src/scene/palier1";
import { DECOR as DECOR_CAMPAGNE } from "../src/scene/decor/campagne";
import { THEMES_C } from "../src/scene/lumiere";
import { rebordB } from "../src/scene/rebordsComplets";
import { C, CHAMPS, enregistrer, fenetre, lire } from "../src/vitrine/parcours";
import { lineariser, lineariserHalos } from "../src/scene/composerPalier";
import { buildHalos } from "../src/halo";
import type { Calques, Contexte } from "../src/scene/types";
import type { TronconRebord } from "../src/scene/route";

// Retouche 38b : les paliers de qualité de la scène (src/scene : paliers.ts, palier1.ts, finition.ts, matiere.ts, lumiere3.ts ; src/vitrine/parcours.ts).
// Ce qui se teste sans carte graphique : les réglages, les règles du palier 1 (route grise, rien en l'air, mur de pneus allégé), la variété qui ne
// déplace pas le décor, les textures calculées, les retouches des nuanceurs (elles cassent si three.js change ses morceaux), la course enregistrée de
// la vue en mouvement. Le rendu de chaque palier se vérifie dans la vitrine (e2e/vitrine.spec.ts).

const PISTE = "S/n@start S S L2 S S R S S L S S R3 S S S@finish";

/** Des calques vides (vue aérienne : aucun bandeau de texte, donc aucun canvas). */
function calques(): Calques {
  return { route: new Builder(), solide: new Builder(), lumineux: new Builder(), decor: new Builder(), decorLumineux: new Builder(), dense: new Builder(), rideau: new Builder(), affiches: new Affiches(), bandeaux: [], aerien: true, rebords: new Builder() };
}

function contexte(palette: PaletteName, reglages = reglagesDuPalier(1)): Contexte {
  const track = parseTrack("paliers-test", PISTE);
  return { palette, pal: paletteP1(palette, PALETTE_DEFS[palette]), look: { exposure: 1, haze: 1, halo: 0, headlights: 0, shadow: 1 }, track, floorY: track.voidY - 4, reglages, varie: seeded("paliers-test:variete") };
}

describe("réglages des paliers", () => {
  it("palier 1 : aucun pas ; palier 2 : la finition ; palier 3 : tout", () => {
    expect(PAS_IDS.filter((id) => reglagesDuPalier(1)[id])).toEqual([]);
    expect(PAS_IDS.filter((id) => reglagesDuPalier(2)[id])).toEqual(["geometrie", "variete", "matiere", "traces", "reflets"]);
    // Lot 45 : l'ancienne matière (« détaillée », comparaison du 38c) est retirée : le palier 3 a tous les pas.
    expect(PAS_IDS.filter((id) => !reglagesDuPalier(3)[id])).toEqual([]);
    expect(PAS_IDS).not.toContain("detaillee");
    for (const p of [1, 2, 3] as const) expect(palierDe(reglagesDuPalier(p))).toBe(p);
    expect(palierDe(avecPas(reglagesDuPalier(2), "halo", true))).toBeNull();
  });

  it("chaque pas est commutable seul, et les réglages se lisent dans l'adresse comme ils s'écrivent", () => {
    const r = seeded("reglages");
    for (let k = 0; k < 60; k++) {
      let x = reglagesDuPalier((1 + Math.floor(r() * 3)) as 1 | 2 | 3);
      for (const id of PAS_IDS) if (r() < 0.25) x = avecPas(x, id, !x[id]);
      expect(lireReglages(texteReglages(x))).toEqual(x);
    }
    expect(texteReglages(avecPas(reglagesDuPalier(3), "halo", false))).toBe("3-halo");
    expect(lireReglages("n'importe quoi")).toEqual(reglagesDuPalier(1));
  });

  it("seuls les pas de post-traitement demandent une chaîne de passes ; les paliers 1 et 2 dessinent comme le jeu", () => {
    expect(avecPost(reglagesDuPalier(1))).toBe(false);
    expect(avecPost(reglagesDuPalier(2))).toBe(false);
    for (const p of PAS) expect(avecPost(avecPas(reglagesDuPalier(1), p.id, true)), p.id).toBe(!!p.passe);
  });

  it("chaque palette a son palier 3 (brume, nuages, particules, étalonnage, halo)", () => {
    for (const nom of Object.keys(PALETTE_DEFS)) expect(THEMES_3, nom).toHaveProperty(nom);
  });
});

describe("palier 1 : le mélange du lot 38, nettoyé", () => {
  it("la route reste un gris sous une lumière chaude (jamais brune : on ne la confond pas avec la terre ou le sable)", () => {
    for (const [nom, route] of Object.entries(ROUTE_SOUS_LUMIERE_CHAUDE)) {
      for (const c of route!) {
        const r = (c >> 16) & 255;
        const g = (c >> 8) & 255;
        const b = c & 255;
        expect(r - b, `${nom} ${c.toString(16)} : brun`).toBeLessThan(0);
        expect(g - (r + b) / 2, `${nom} ${c.toString(16)} : vert`).toBeLessThan(15);
      }
      // Et c'est bien la route du palier pour ce thème, sous la lumière chaude de C.
      expect(paletteP1(nom as PaletteName, PALETTE_DEFS[nom as PaletteName]).road).toEqual(route);
      const soleil = THEMES_C[nom as PaletteName].soleil[0];
      expect(((soleil >> 16) & 255) - (soleil & 255), `${nom} : un soleil chaud`).toBeGreaterThan(40);
    }
  });

  it("rien en l'air : les socles du portique de départ descendent jusqu'au sol lointain", () => {
    const x = contexte("stade");
    const c = calques();
    portiqueDepartP(c, x, x.track.blocks[0]!, 26);
    let bas = Infinity;
    for (let i = 1; i < c.solide.pos.length; i += 3) bas = Math.min(bas, c.solide.pos[i]!);
    expect(bas).toBeCloseTo(x.floorY, 3);
  });

  it("le mur de pneus léger coûte au plus le quart des triangles de celui du lot 38 (lot 43 : les rebords du palier 1, `rebordLeger`)", () => {
    const t: TronconRebord = { a: [0, 0, 0], b: [0, 0, 32], dehors: [1, 0], cote: "left", s: 0, longueur: 32, couleurs: [0x1e1b19, 0xf4f1e6], bande: false, hauteur: 1.4 };
    const lourd = new Builder();
    const leger = new Builder();
    rebordB("desert", "pneus")(lourd, t);
    rebordB("desert", "pneus", { leger: true })(leger, t);
    const tris = (g: Builder) => g.pos.length / 9;
    // Lot 43 : le palier 1 est la scène de tout le monde, ses rebords ne coûtent pas plus que les murs de l'existant (voir aussi `palier1.test.ts`).
    expect(tris(leger)).toBeLessThan(tris(lourd) * 0.25);
    expect(tris(leger)).toBeGreaterThan(0);
  });
});

describe("palier 2 : géométrie, variété, matière", () => {
  it("la variété ne déplace pas le décor : mêmes places, même nombre de pièces ; chaque instance reste posée au sol", () => {
    const sans = calques();
    const avec = calques();
    const xs = contexte("campagne", reglagesDuPalier(1));
    const xa = contexte("campagne", avecPas(reglagesDuPalier(1), "variete", true));
    // Lot 44 : le décor du jeu ; la variété lui arrive par le contexte (comme le fait le compositeur de la vitrine).
    xa.varierDecor = { marque: (c) => marque(c as Calques), varier: (c, m, x, sol, z) => varierInstance(c as Calques, m as ReturnType<typeof marque>, x, sol, z, xa.varie!) };
    DECOR_CAMPAGNE.construire(sans, xs);
    DECOR_CAMPAGNE.construire(avec, xa);
    expect(avec.decor.pos.length).toBe(sans.decor.pos.length);
    expect(avec.affiches.pos.length).toBe(sans.affiches.pos.length);
    let differe = 0;
    for (let i = 0; i < sans.decor.pos.length; i++) if (Math.abs(sans.decor.pos[i]! - avec.decor.pos[i]!) > 1e-6) differe++;
    expect(differe, "la variété change quelque chose").toBeGreaterThan(0);
    const bas = (g: Builder) => Math.min(...g.pos.filter((_, i) => i % 3 === 1));
    expect(bas(avec.decor)).toBeCloseTo(bas(sans.decor), 4);
  });

  it("varierInstance ne touche que l'instance qu'on vient d'ajouter, et garde son pied au sol", () => {
    const c = calques();
    c.decor.box(0, 0, 0, 1, 1, 1, 0x808080);
    const m = marque(c);
    c.decor.box(10, -3, 10, 12, 4, 12, 0x808080);
    const avant = [...c.decor.pos];
    varierInstance(c, m, 11, -3, 11, seeded("x"));
    expect(c.decor.pos.slice(0, m.decor)).toEqual(avant.slice(0, m.decor));
    expect(Math.min(...c.decor.pos.slice(m.decor).filter((_, i) => i % 3 === 1))).toBeCloseTo(-3, 6);
  });

  it("la variation par morceau est la même pour tout le monde (même graine, mêmes couleurs)", () => {
    const a = new Builder();
    const b = new Builder();
    for (const g of [a, b]) for (let k = 0; k < 20; k++) g.quad([k * 4, 0, 0], [k * 4 + 4, 0, 0], [k * 4 + 4, 1.4, 0], [k * 4, 1.4, 0], 0x2e7dff);
    varierParPosition(a, 4, 0.07, 38);
    varierParPosition(b, 4, 0.07, 38);
    expect(a.col).toEqual(b.col);
    expect(new Set(a.col.map((v) => v.toFixed(3))).size).toBeGreaterThan(3);
  });

  it("les drapeaux figés (palier 2) ont la pose de départ des drapeaux animés (palier 3, t = 0)", () => {
    const d = new Drapeaux();
    d.drapeau([0, 10, 0], [1, 0], 1.6, 1, [0xff0000, 0xffffff], 0.7);
    const g = new Builder();
    verserDrapeaux(d, g);
    expect(g.pos.length).toBe(d.pos.length);
    // Le bout libre a bougé perpendiculairement au tissu (z), la hampe non.
    expect(g.pos[1]).toBeCloseTo(d.pos[1]!, 6);
    const libre = d.flot.findIndex((f, i) => i % 3 === 0 && f === 1) / 3;
    expect(Math.abs(g.pos[libre * 3 + 2]! - d.pos[libre * 3 + 2]!)).toBeGreaterThan(0.01);
  });

  it("matière sobre (38c) : 256 px, ni normales ni rugosité, un grain moins contrasté que celui du palier 1 et rien qui imite une photo", () => {
    for (const m of [matiereAsphalte(), matiereBeton(), matiereMetal(), matiereDecor()]) {
      const img = m.map.image as { width: number; data: Uint8Array };
      expect(img.width).toBe(256);
      expect(Object.keys(m).sort(), "une texture de couleur seule (lot 45 : plus de champs de normales ni de rugosité)").toEqual(["echelle", "map", "ms", "teinte"]);
      const n = img.width;
      const v = Array.from({ length: n * n }, (_, i) => img.data[i * 4]! / 255);
      const moy = v.reduce((a, x) => a + x, 0) / v.length;
      const et = Math.sqrt(v.reduce((a, x) => a + (x - moy) ** 2, 0) / v.length);
      // Le grain du palier 1 (textures.ts) : 232 à 255, tiré au hasard par pixel, soit un écart type ≈ 0,026 autour de 0,955.
      expect(Math.abs(moy - 0.955), "même teinte moyenne que le grain du palier 1").toBeLessThan(0.01);
      expect(et, "moins contrasté que le grain du palier 1").toBeLessThan(0.026);
      // Ni rapiéçage, ni tache, ni fissure : aucun pixel ne s'écarte franchement de la moyenne.
      expect(Math.max(...v.map((x) => Math.abs(x - moy))), "aucun détail qui se remarque").toBeLessThan(0.07);
    }
    expect(matiereAsphalte()).toBe(matiereAsphalte());
  });

  it("matière sobre : la variation large (canal alpha) est douce et se répète sans couture ; la lecture de three.js est remplacée", () => {
    const img = matiereAsphalte().map.image as { width: number; data: Uint8Array };
    const n = img.width;
    const a = (x: number, y: number) => img.data[(((y + n) % n) * n + ((x + n) % n)) * 4 + 3]!;
    let saut = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) saut = Math.max(saut, Math.abs(a(x, y) - a(x + 1, y)), Math.abs(a(x, y) - a(x, y + 1)));
    expect(saut, "aucun saut entre pixels voisins, bords compris").toBeLessThan(12);
    expect(PERIODE_TEINTE * 4, "une période d'une cinquantaine de mètres").toBeGreaterThanOrEqual(40);
    const m = new MeshStandardMaterial({ map: matiereAsphalte().map });
    teinteLarge(m, matiereAsphalte().teinte);
    const sh = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, unknown> };
    expect(sh.fragmentShader).toContain("#include <map_fragment>");
    m.onBeforeCompile(sh as never, null as never);
    expect(sh.fragmentShader).not.toContain("#include <map_fragment>");
    expect(sh.fragmentShader).toContain("uTeinteEchelle");
    expect(sh.uniforms).toHaveProperty("uTeinteForce");
    expect(m.customProgramCacheKey()).toContain("teinte38c");
  });

  it("traces de pneus dans les virages sur route, pas sur les droites ordinaires ; à quelques centimètres au-dessus de la route", () => {
    const track = parseTrack("paliers-test", PISTE);
    const g = new Builder();
    tracesEtMarquages(g, track, () => 0x47464c, 0xffffff);
    expect(g.pos.length).toBeGreaterThan(0);
    const virages = track.blocks.filter((b) => isCurve(b.kind));
    expect(virages.length).toBeGreaterThan(0);
    for (let i = 1; i < g.pos.length; i += 3) expect(g.pos[i]! - track.blocks[0]!.y0).toBeLessThan(0.05);
    // 38c : discrètes (la route assombrie de 15 %, 30 % au 38b).
    expect(TRACES_SOMBRE).toBeGreaterThanOrEqual(0.85);
  });
});

describe("palier 3 : les retouches des nuanceurs de three.js (elles cassent si three.js renomme ses morceaux)", () => {
  it("la brume de profondeur remplace la brume du matériau", () => {
    const m = new MeshStandardMaterial();
    brumeDeProfondeur(m, uniformesBrume(THEMES_3.alpin, -12, new Vector3(1, 1, 0)));
    const s = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} as Record<string, unknown> };
    m.onBeforeCompile(s as never, null as never);
    expect(s.vertexShader).toContain("vBrumeMonde = (modelMatrix");
    expect(s.fragmentShader).toContain("brumeHaut");
    expect(s.fragmentShader).not.toContain("#include <fog_fragment>");
    expect(s.uniforms).toHaveProperty("uBrumeDensite");
    expect(m.customProgramCacheKey()).toContain("brume38b");
  });

  it("les halos du jeu sont linéarisés pour la chaîne de post-traitement (sinon ils sortent en gros disques)", () => {
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffb347, size: 6 }], 1)!;
    const m = halos.points.material as ShaderMaterial;
    const avant = m.fragmentShader;
    lineariser(m);
    expect(m.fragmentShader).not.toBe(avant);
    expect(m.fragmentShader).toContain("vec3(2.2)");
  });

  it("les halos construits à part (éclairage de piste de la Nuit) le sont aussi, et rien d'autre n'est touché", () => {
    const halos = buildHalos([{ x: 0, y: 0, z: 0, color: 0xffa94d, size: 6 }], 1)!;
    const autre = new MeshStandardMaterial();
    const avant = autre.version;
    lineariserHalos([new Mesh(new BoxGeometry(), autre), halos.points]);
    expect((halos.points.material as ShaderMaterial).fragmentShader).toContain("vec3(2.2)");
    expect(autre.version).toBe(avant);
  });

  it("les morceaux que la foule et les drapeaux remplacent existent", () => {
    expect(ShaderLib.standard.vertexShader).toContain("#include <begin_vertex>");
    expect(ShaderLib.standard.fragmentShader).toContain("vec4 diffuseColor = vec4( diffuse, opacity );");
    expect(ShaderLib.standard.vertexShader).toContain("#include <fog_vertex>");
    expect(ShaderLib.standard.fragmentShader).toContain("#include <fog_pars_fragment>");
  });
});

describe("vue en mouvement : la course enregistrée", () => {
  const track = parseTrack("paliers-test", PISTE);
  const run = bestPilotRun(track)!;
  const poses = enregistrer(track, run.replay);
  const n = poses.length / CHAMPS;

  it("une pose par pas, du départ à l'arrivée, rejouée avec les commandes du pilote", () => {
    expect(run).not.toBeNull();
    expect(n).toBe(run.ticks + 1);
    expect(poses[C.x]).toBeCloseTo(track.spawn.x, 6);
    expect(poses[C.z]).toBeCloseTo(track.spawn.z, 6);
    const fin = (n - 1) * CHAMPS;
    expect(Math.hypot(poses[fin + C.vx]!, poses[fin + C.vz]!)).toBeGreaterThan(10);
  });

  it("le bout « en course » commence avant le premier virage, le bout « départ » au départ ; 12 s chacun au plus", () => {
    expect(fenetre(track, poses, "depart")).toEqual([0, Math.min(n - 1, 1440)]);
    const [a, b] = fenetre(track, poses, "course");
    expect(b - a).toBeLessThanOrEqual(1440);
    const virage = track.blocks.find((x) => x.index > 2 && isCurve(x.kind))!;
    const cellule = (i: number) => track.cells.get(((Math.floor(poses[i * CHAMPS + C.x]! / CELL) + 1024) * 4096) + (Math.floor(poses[i * CHAMPS + C.z]! / CELL) + 1024));
    expect(cellule(a)?.index ?? -1).toBeLessThan(virage.index);
  });

  it("le cap s'interpole par le plus court chemin", () => {
    const p = new Float32Array(CHAMPS * 2);
    p[C.yaw] = Math.PI - 0.1;
    p[CHAMPS + C.yaw] = -Math.PI + 0.1;
    expect(Math.abs(lire(p, 0, 0.5, C.yaw))).toBeCloseTo(Math.PI, 5);
  });
});
