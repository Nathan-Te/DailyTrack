import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { boitesDeForme, BORD, centreDesYeux, couchesDe, decrirePiece, disposerYeux, ENCRE, expressionDe, FORMES, interieur, LISERE, melanger, PALETTE_PORT, PAPIER, THEMES_BLOCS } from "../src/blocs";
import { PALETTES } from "../src/blocs/themes";

// Lot DA1 — la DESCRIPTION des blocs : aucun moteur de rendu (ni Three.js, ni DOM, ni Canvas), des palettes bien formées, des formes exactes, un relief à l'intérieur de la forme, des yeux dont la géométrie est une fonction pure.
const DESCRIPTION = ["couleurs", "formes", "palettes", "themes", "relief", "expression", "yeux", "index"];
const source = (f: string): string => readFileSync(new URL(`../src/blocs/${f}.ts`, import.meta.url), "utf8");

describe("la description ne dépend d'aucun moteur de rendu", () => {
  it("aucun import de Three.js, du socle ou d'un jeu ; rien du navigateur", () => {
    for (const f of DESCRIPTION) {
      const s = source(f);
      for (const m of s.matchAll(/^(?:import|export)[^\n]*from "([^"]+)"/gm)) expect(m[1], `${f} : ${m[0]}`).toMatch(/^\.\//);
      expect(s, f).not.toMatch(/\b(document|window|navigator|HTMLCanvasElement|CanvasRenderingContext2D|WebGL)\b|Math\.random|Date\.now|performance\.now/);
    }
  });
  it("chaque fichier du module est soit de la description, soit un dessinateur", () => {
    const tous = readdirSync(new URL("../src/blocs/", import.meta.url)).map((f) => f.replace(/\.ts$/, "")).sort();
    expect(tous).toEqual([...DESCRIPTION, "canvas", "three"].sort());
  });
});

describe("les palettes", () => {
  const TOUTES = { port: PALETTE_PORT, ...PALETTES };
  it("six thèmes, les mêmes noms que la liste des thèmes", () => {
    expect(Object.keys(TOUTES).sort()).toEqual([...THEMES_BLOCS].sort());
  });
  it("sept couleurs de pièces par thème (une par forme) et des couleurs #RRGGBB, que des aplats", () => {
    for (const [theme, p] of Object.entries(TOUTES)) {
      expect(Object.keys(p.pieces).sort(), theme).toEqual([...FORMES].sort());
      expect(Object.keys(p).sort(), theme).toEqual(["ciel", "pieces", "pilier", "plateforme", "plateformeReflet", "sol", "vague"]);
      for (const c of [...Object.values(p.pieces), p.ciel, p.sol, p.vague, p.plateforme, p.plateformeReflet, p.pilier]) expect(c, theme).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it("l'encre et le papier sont ceux de la charte ; un mélange va de la première couleur à la seconde", () => {
    expect(ENCRE).toBe("#2A1E16");
    expect(PAPIER).toBe("#FFF6E0");
    expect(melanger("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(melanger("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(melanger("#102030", "#FFFFFF", 0.5)).toBe("#889098");
  });
});

describe("les formes", () => {
  it("sept formes de quatre cases (aire 4 × 64 huitièmes carrés), le centre de masse à l'origine, quatre quarts de tour", () => {
    for (const f of FORMES) {
      for (let rot = 0; rot < 4; rot++) {
        const bs = boitesDeForme(f, rot);
        expect(bs.reduce((a, b) => a + 4 * b.hw * b.hh, 0), `${f}${rot}`).toBe(256);
        expect(bs.reduce((a, b) => a + 4 * b.hw * b.hh * b.cx, 0), `${f}${rot} x`).toBe(0);
        expect(bs.reduce((a, b) => a + 4 * b.hw * b.hh * b.cy, 0), `${f}${rot} y`).toBe(0);
      }
      expect(boitesDeForme(f, 4)).toEqual(boitesDeForme(f, 0));
    }
  });
});

describe("le relief : l'encre est la forme, le liseré et la couleur sont à l'intérieur", () => {
  const bs = boitesDeForme("T");
  it("sans effet : l'encre puis la couleur ; avec un halo : l'encre, le liseré, la couleur, de bas en haut", () => {
    const simple = decrirePiece(bs, { couleur: "#9B6BD6", encre: ENCRE });
    expect(simple.map((c) => c.couleur)).toEqual([ENCRE, "#9B6BD6"]);
    const halo = decrirePiece(bs, { couleur: "#9B6BD6", encre: ENCRE, halo: "#5DBB63" });
    expect(halo.map((c) => c.couleur)).toEqual([ENCRE, "#5DBB63", "#9B6BD6"]);
    expect(halo.map((c) => c.profondeur)).toEqual([0, 0.005, 0.01]);
    expect(halo[1]!.rects.length).toBeGreaterThan(0);
  });
  it("le trait d'encre vaut BORD (le double d'épaisseur pour une géante) ; la couleur recule du bord, et du liseré s'il y en a un", () => {
    const [encre, couleur] = decrirePiece([{ cx: 0, cy: 0, hw: 8, hh: 8 }], { couleur: "#000000", encre: ENCRE });
    expect(encre!.rects[0]!.w - couleur!.rects[0]!.w).toBeCloseTo(2 * BORD, 12);
    const [, lis, col] = decrirePiece([{ cx: 0, cy: 0, hw: 8, hh: 8 }], { couleur: "#000000", encre: ENCRE, halo: "#FFFFFF", bord: 0.1, lisere: 0.2 });
    expect(lis!.rects[0]!.w).toBeCloseTo(2 - 0.2, 12);
    expect(col!.rects[0]!.w).toBeCloseTo(2 - 0.6, 12);
    expect(LISERE).toBeGreaterThan(0);
  });
});

describe("l'intérieur d'une forme n'a pas de trou (le point d'encre au croisement de quatre cases)", () => {
  const couvert = (rs: ReturnType<typeof interieur>, x: number, y: number): boolean => rs.some((r) => Math.abs(x - r.cx) <= r.w / 2 + 1e-9 && Math.abs(y - r.cy) <= r.h / 2 + 1e-9);
  const trous = (bs: Parameters<typeof interieur>[0], vide: (x: number, y: number) => boolean, retrait = BORD): [number, number][] => {
    const rs = interieur(bs, retrait);
    const sortie: [number, number][] = [];
    // Tous les points de la forme à plus de `retrait` de son bord (échantillon de 1 cm) doivent être couverts.
    for (let x = -2; x <= 2; x += 0.01) for (let y = -2; y <= 2; y += 0.01) if (vide(x, y) && !couvert(rs, x, y)) sortie.push([x, y]);
    return sortie;
  };
  // Quatre cases d'un mètre autour de l'origine : le carré [-1, 1]², érodé de `retrait`.
  const quatre = [{ cx: -4, cy: -4, hw: 4, hh: 4 }, { cx: 4, cy: -4, hw: 4, hh: 4 }, { cx: -4, cy: 4, hw: 4, hh: 4 }, { cx: 4, cy: 4, hw: 4, hh: 4 }];
  it("quatre cases autour d'un même point : le carré du milieu est recouvert", () => {
    expect(trous(quatre, (x, y) => Math.abs(x) <= 1 - BORD && Math.abs(y) <= 1 - BORD)).toEqual([]);
  });
  it("deux cases appuyées sur une troisième (un T de trois boîtes) : le point de jonction est recouvert", () => {
    // Une barre de deux mètres (y de -1 à 0) sous deux cases (y de 0 à 1) : la jonction est en (0, 0).
    const t = [{ cx: 0, cy: -4, hw: 8, hh: 4 }, { cx: -4, cy: 4, hw: 4, hh: 4 }, { cx: 4, cy: 4, hw: 4, hh: 4 }];
    expect(trous(t, (x, y) => Math.abs(x) <= 1 - BORD && y >= -1 + BORD && y <= 1 - BORD)).toEqual([]);
  });
  it("un coin rentrant reste un coin : un L de trois cases n'y gagne aucun carré", () => {
    const l = [{ cx: -4, cy: -4, hw: 4, hh: 4 }, { cx: 4, cy: -4, hw: 4, hh: 4 }, { cx: -4, cy: 4, hw: 4, hh: 4 }];
    expect(interieur(l, BORD).filter((r) => Math.abs(r.w - 2 * BORD) < 1e-9 && Math.abs(r.h - 2 * BORD) < 1e-9)).toEqual([]);
  });
  it("les sept formes de Tower, aux quatre quarts de tour, ne reçoivent aucun carré de plus : leur rendu est inchangé", () => {
    for (const f of FORMES) {
      for (let rot = 0; rot < 4; rot++) {
        const bs = boitesDeForme(f, rot);
        // Une boîte rétrécie chacune, plus un pont par arête partagée : une seule boîte (I, O) n'a pas de pont, les autres formes en ont un.
        expect(interieur(bs, BORD), `${f}${rot}`).toHaveLength(bs.length === 1 ? 1 : bs.length + 1);
        expect(interieur(bs, BORD + LISERE), `${f}${rot} liseré`).toHaveLength(bs.length === 1 ? 1 : bs.length + 1);
      }
    }
  });
});

describe("decrirePiece dit ce que dit couchesDe", () => {
  it("les mêmes rectangles, avec et sans liseré, pour toutes les formes et toutes les tailles de trait", () => {
    for (const f of FORMES) {
      for (const [bord, lisere] of [[0.07, 0.09], [0.154, 0.2]] as const) {
        const bs = boitesDeForme(f, 1);
        const sans = decrirePiece(bs, { couleur: "#111111", encre: ENCRE, bord, lisere });
        expect(sans.map((c) => c.rects)).toEqual([couchesDe(bs, false, bord, lisere).encre, couchesDe(bs, false, bord, lisere).couleur]);
        const avec = decrirePiece(bs, { couleur: "#111111", encre: ENCRE, halo: "#222222", bord, lisere });
        const c = couchesDe(bs, true, bord, lisere);
        expect(avec.map((x) => x.rects)).toEqual([c.encre, c.lisere, c.couleur]);
      }
    }
  });
});

describe("les yeux : une géométrie pure", () => {
  const calme = expressionDe({ niveau: 0, genre: "normal", regard: { x: 0, y: -0.5 }, clignement: 0, t: 0 });
  const affole = expressionDe({ niveau: 3, genre: "normal", regard: { x: 0.3, y: -0.4 }, clignement: 0, t: 1 });
  it("deux yeux de part et d'autre du centre, droits, à l'échelle de la pièce", () => {
    const [g, d] = disposerYeux(0.5, 0.25, 2, calme, 0);
    expect(g!.cote).toBe(-1);
    expect(d!.cote).toBe(1);
    expect(d!.x - g!.x).toBeCloseTo(2 * 0.17 * 2, 12);
    expect(g!.y).toBe(0.25);
    expect(g!.sourcil.visible).toBe(false);
  });
  it("l'expression écrase l'œil quand il se ferme, agrandit l'œil et rétrécit la pupille quand la pièce panique, montre les sourcils", () => {
    const ferme = disposerYeux(0, 0, 1, { ...calme, fermeture: 1 }, 0);
    expect(ferme[0]!.sy).toBeCloseTo(0.1, 12);
    expect(ferme[0]!.sourcil.visible).toBe(false);
    const a = disposerYeux(0, 0, 1, calme, 0);
    const b = disposerYeux(0, 0, 1, affole, 0);
    expect(b[0]!.sx).toBeGreaterThan(a[0]!.sx);
    expect(b[0]!.pupille.r).toBeLessThan(a[0]!.pupille.r);
    expect(b[0]!.sourcil.visible).toBe(true);
    expect(b[0]!.sourcil.rot).toBeCloseTo(0.65, 12); // l'œil gauche : le bout intérieur monte
    expect(b[1]!.sourcil.rot).toBeCloseTo(-0.65, 12);
  });
  it("le tremblement dépend du temps et de la phase de la pièce ; sans tremblement rien ne bouge", () => {
    expect(disposerYeux(0, 0, 1, affole, 1, 0)[0]!.pupille).not.toEqual(disposerYeux(0, 0, 1, affole, 1, 5)[0]!.pupille);
    expect(disposerYeux(0, 0, 1, calme, 1, 0)).toEqual(disposerYeux(0, 0, 1, calme, 9, 5));
  });
  it("des yeux neufs à chaque appel, et le même résultat pour la même entrée", () => {
    const a = disposerYeux(0.1, 0.2, 1.5, affole, 3, 2);
    const b = disposerYeux(0.1, 0.2, 1.5, affole, 3, 2);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(a[1]);
  });
  it("les yeux se posent dans la plus grande boîte de la pièce", () => {
    expect(centreDesYeux(boitesDeForme("O"))).toEqual({ x: 0, y: 0 });
    const t = centreDesYeux(boitesDeForme("T"));
    expect(t.y).toBeCloseTo(-0.25, 12); // la barre de trois cases (la tige est une case de plus)
  });
});
