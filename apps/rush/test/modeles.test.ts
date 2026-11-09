import { readFileSync } from "node:fs";
import { Box3, BufferGeometry, Color, Mesh, Vector3, type Object3D } from "three";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BOSS, BOSS_IDS, CHAUVE, RAYON_TYPE, dailyRush, type Golem } from "@cdj/rush-sim";
import { RAYON_CHEVALIER } from "@cdj/rush-sim/constantes";
import { RAYON_VASE } from "@cdj/rush-sim/niveau";
import { animerChevalier, creerChevalier, creerGolem } from "../src/acteurs";
import { animerBoss, bossFictif, creerBoss, type EntreeBoss } from "../src/bosses";
import { MonstresVus, RAYON_PROJECTILE } from "../src/ennemisVue";
import { chargerModeles, MODELE_BOSS, MODELE_MONSTRE, MODELE_VASE, modelesDuContenu, NOMS_MODELES, oublierModeles, PIECES, pieceDe, type Modele, type NomModele, type PieceModele } from "../src/modeles";
import { monterVases } from "../src/vasesVue";
import { PALETTES } from "../src/palette";
import { chargerTousDuDisque, DOSSIER_MODELES } from "./modelesDisque";

// LES MODÈLES (lot BR-A1), sans navigateur : les fichiers publiés (`public/modeles/*.glb`) se lisent avec le lecteur du jeu ; chaque modèle a ses pièces nommées, ses pivots sont ceux du code, ses triangles tiennent dans
// leur budget, son empreinte au sol suit le rayon de collision de la simulation, sa couleur dominante tranche sur chaque sol ; le jeu ne charge que les modèles du jour ; les acteurs prennent les modèles et s'animent.
let tous: Map<NomModele, Modele>;
beforeAll(async () => {
  tous = await chargerTousDuDisque();
});
afterAll(() => oublierModeles());

/** Les budgets de triangles du lot (au plus). */
const BUDGET: Record<NomModele, number> = {
  chevalier: 3000,
  golem: 8000,
  reine: 8000,
  "grand-duc": 8000,
  belier: 8000,
  chene: 8000,
  gelee: 1500,
  gelaton: 1500,
  "chauve-souris": 1500,
  cracheur: 1500,
  chaman: 1500,
  totem: 1500,
  "porte-bouclier": 1500,
  couronne: 1500,
  projectile: 1500,
  bouclier: 1500,
  jarre: 300 + 4 * 60,
  tonneau: 300 + 4 * 60,
  caisse: 300 + 4 * 60,
};
const triangles = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute("position").count) / 3;

describe("les fichiers des modèles (lot BR-A1)", () => {
  it("chaque modèle se lit et porte TOUTES ses pièces nommées, chacune avec ses positions, ses normales et ses couleurs par sommet", () => {
    expect(tous.size).toBe(NOMS_MODELES.length);
    for (const n of NOMS_MODELES) {
      const m = tous.get(n)!;
      for (const p of PIECES[n]) {
        const pc = m.pieces.get(p);
        expect(pc, `${n} : la pièce ${p}`).toBeDefined();
        expect(pc!.geo.getAttribute("position").count, `${n}/${p}`).toBeGreaterThan(3);
        expect(pc!.geo.getAttribute("normal"), `${n}/${p} : normales`).toBeDefined();
        expect(pc!.geo.getAttribute("color"), `${n}/${p} : couleurs`).toBeDefined();
        const pos = pc!.geo.getAttribute("position").array as Float32Array;
        for (const v of pos) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
  it("les budgets de triangles : chevalier 3 000, monstre 1 500, boss 8 000, vase 300 et chaque éclat 60", () => {
    for (const n of NOMS_MODELES) {
      const m = tous.get(n)!;
      expect(m.triangles, n).toBeLessThanOrEqual(BUDGET[n]);
      if (MODELE_VASE.includes(n)) {
        expect(triangles(m.pieces.get("corps")!.geo), `${n} : le vase`).toBeLessThanOrEqual(300);
        for (const [cle, pc] of m.pieces) if (cle.startsWith("eclat_")) expect(triangles(pc.geo), `${n} : ${cle}`).toBeLessThanOrEqual(60);
        expect([...m.pieces.keys()].filter((k) => k.startsWith("eclat_")).length, `${n} : 3 à 5 éclats`).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it("les fichiers sont compressés (meshopt) et légers : moins de 400 Ko gzip pour tous, et une journée type bien en dessous", async () => {
    const { gzipSync } = await import("node:zlib");
    let total = 0;
    const poids = new Map<NomModele, number>();
    for (const n of NOMS_MODELES) {
      const b = readFileSync(new URL(`${n}.glb`, DOSSIER_MODELES));
      expect(b.toString("latin1"), `${n} : EXT_meshopt_compression`).toContain("EXT_meshopt_compression");
      const g = gzipSync(b, { level: 9 }).length;
      poids.set(n, g);
      total += g;
    }
    expect(total).toBeLessThan(400 * 1024);
    const jour = modelesDuContenu(dailyRush(20398));
    const duJour = jour.reduce((s, n) => s + poids.get(n)!, 0);
    expect(duJour).toBeLessThan(total);
  });
});

describe("les pivots des pièces sont ceux des groupes que le code anime", () => {
  /** La position (repère de la racine, avant son échelle) du groupe qui porte la géométrie `geo` dans l'acteur. */
  const lieuDe = (racine: Object3D, geo: BufferGeometry): Vector3 | null => {
    racine.updateMatrixWorld(true);
    let trouve: Vector3 | null = null;
    racine.traverse((o) => {
      if (!trouve && (o as Mesh).isMesh && (o as Mesh).geometry === geo) {
        // le maillage est dans un groupe-pièce posé à l'origine du groupe animé : on ramène sa position monde dans le repère de la racine
        const w = new Vector3().setFromMatrixPosition(o.matrixWorld);
        trouve = racine.worldToLocal(w);
      }
    });
    return trouve;
  };
  /** La position d'une pièce dans le repère du modèle (la chaîne des pivots jusqu'à la racine). */
  const lieuModele = (m: Modele, piece: string): Vector3 => {
    const v = new Vector3();
    let p: string | null = piece;
    while (p) {
      const pc: PieceModele = m.pieces.get(p)!;
      v.add(new Vector3(...pc.pivot));
      p = pc.parent;
    }
    return v;
  };
  const verifier = (nom: NomModele, racine: Object3D, sauf: string[] = []): void => {
    const m = tous.get(nom)!;
    for (const p of PIECES[nom]) {
      if (sauf.includes(p)) continue;
      const ici = lieuDe(racine, m.pieces.get(p)!.geo);
      expect(ici, `${nom} : la pièce ${p} est utilisée par l'acteur`).not.toBeNull();
      expect(ici!.distanceTo(lieuModele(m, p)), `${nom} : le pivot de ${p}`).toBeLessThan(0.02);
    }
  };
  it("le chevalier : corps, tête, yeux, plume, arme, bouclier, pieds", () => verifier("chevalier", creerChevalier().racine));
  it("le golem : tronc, tête, bras, avant-bras, jambes", () => verifier("golem", creerGolem().racine));
  BOSS_IDS.forEach((id, kind) => {
    if (kind === 0) return;
    it(`le boss ${id}`, () => verifier(MODELE_BOSS[kind]!, creerBoss(kind).racine));
  });
});

describe("la taille : l'empreinte au sol suit le rayon de collision de la simulation", () => {
  /** L'empreinte d'une forme : la moyenne des demi-largeurs de sa boîte en x et en z (mètres). */
  const empreinte = (g: BufferGeometry, echelle = 1): number => {
    g.computeBoundingBox();
    const t = g.boundingBox!.getSize(new Vector3());
    return ((t.x + t.z) / 4) * echelle;
  };
  /** Le rapport empreinte / rayon de collision, et ce qui est permis (un corps qui porte un bâton, des bras, des racines dépasse un peu ; aucun n'est plus petit que les 4/5 de sa collision). */
  const RAPPORT_MIN = 0.8;
  const RAPPORT_MAX = 1.35;
  it("les monstres (leur corps, à l'échelle du code)", () => {
    MODELE_MONSTRE.forEach((nom, type) => {
      const r = RAYON_TYPE[type]! / 4096;
      const e = empreinte(pieceDe(nom, "corps")!);
      expect(e / r, `${nom} : empreinte ${e.toFixed(2)} m pour une collision de ${r.toFixed(2)} m`).toBeGreaterThanOrEqual(type === CHAUVE ? 0.75 : RAPPORT_MIN);
      expect(e / r, `${nom} : empreinte ${e.toFixed(2)} m pour une collision de ${r.toFixed(2)} m`).toBeLessThanOrEqual(RAPPORT_MAX);
    });
  });
  it("les boss (leur corps et leur tête ; ni les bras, ni les ailes)", () => {
    BOSS.forEach((b, kind) => {
      const nom = MODELE_BOSS[kind]!;
      const echelle = nom === "chene" ? 0.8 : 1;
      const e = empreinte(pieceDe(nom, "corps")!, echelle);
      const r = b.rayon / 4096;
      expect(e / r, `${nom} : empreinte ${e.toFixed(2)} m pour une collision de ${r.toFixed(2)} m`).toBeGreaterThanOrEqual(RAPPORT_MIN);
      expect(e / r, `${nom} : empreinte ${e.toFixed(2)} m pour une collision de ${r.toFixed(2)} m`).toBeLessThanOrEqual(RAPPORT_MAX);
    });
  });
  it("le chevalier (son corps, à l'échelle 0,88), les vases et le projectile", () => {
    const e = empreinte(pieceDe("chevalier", "corps")!, 0.88);
    expect(e / (RAYON_CHEVALIER / 4096)).toBeGreaterThanOrEqual(RAPPORT_MIN);
    expect(e / (RAYON_CHEVALIER / 4096)).toBeLessThanOrEqual(RAPPORT_MAX);
    MODELE_VASE.forEach((nom, genre) => {
      const r = RAYON_VASE[genre]! / 4096;
      const ev = empreinte(pieceDe(nom, "corps")!);
      expect(ev / r, nom).toBeGreaterThanOrEqual(RAPPORT_MIN);
      expect(ev / r, nom).toBeLessThanOrEqual(RAPPORT_MAX);
    });
    expect(empreinte(pieceDe("projectile", "corps")!, RAYON_PROJECTILE) / RAYON_PROJECTILE).toBeLessThanOrEqual(RAPPORT_MAX); // dessiné au rayon 1, mis à l'échelle de sa collision
  });
  it("les gabarits du lot BR0b tiennent avec les modèles : le golem 4,5 à 7,4 m de haut, bien plus grand que le chevalier (1,1 à 1,8 m)", () => {
    const taille = (o: Object3D): Vector3 => {
      o.updateMatrixWorld(true);
      return new Box3().setFromObject(o).getSize(new Vector3());
    };
    const g = taille(creerGolem().racine);
    const c = taille(creerChevalier().racine);
    expect(g.y).toBeGreaterThan(4.5);
    expect(g.y).toBeLessThan(7.4);
    expect(g.x).toBeLessThan(8.6);
    expect(c.y).toBeGreaterThan(1.1);
    expect(c.y).toBeLessThan(1.8);
    expect(g.y).toBeGreaterThan(3 * c.y);
    // les poings ÉNORMES : l'avant-bras et son poing sont plus gros que la tête
    const golem = creerGolem();
    const boite = (o: Object3D): number => {
      const t = taille(o);
      return t.x * t.y * t.z;
    };
    expect(boite(golem.coudes[0])).toBeGreaterThan(boite(golem.tete));
  });
});

// La lisibilité (règle du lot BR6) sur le modèle LUI-MÊME : sa couleur dominante — celle de la plus grande surface de son corps, par paliers de couleur — tranche sur les deux tons du sol de chaque thème (ΔE76 ≥ 40).
describe("la lisibilité des modèles sur chaque thème : couleur dominante, ΔE ≥ 40", () => {
  const versSrgb = (l: number): number => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055));
  /** La couleur dominante d'une géométrie (sRGB, 0xRRGGBB) : chaque triangle vote pour sa couleur (arrondie à 16 niveaux) au poids de son aire. */
  const dominante = (g: BufferGeometry): number => {
    const p = g.getAttribute("position");
    const c = g.getAttribute("color");
    const idx = g.index;
    const votes = new Map<number, { aire: number; r: number; v: number; b: number }>();
    const a = new Vector3();
    const b = new Vector3();
    const d = new Vector3();
    const n = idx ? idx.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t;
      const i1 = idx ? idx.getX(t + 1) : t + 1;
      const i2 = idx ? idx.getX(t + 2) : t + 2;
      a.fromBufferAttribute(p, i0);
      b.fromBufferAttribute(p, i1).sub(a);
      d.fromBufferAttribute(p, i2).sub(a);
      const aire = b.cross(d).length() / 2;
      const col = new Color(c.getX(i0), c.getY(i0), c.getZ(i0));
      const cle = (Math.round(col.r * 15) << 8) | (Math.round(col.g * 15) << 4) | Math.round(col.b * 15);
      const v = votes.get(cle) ?? { aire: 0, r: 0, v: 0, b: 0 };
      v.aire += aire;
      v.r += col.r * aire;
      v.v += col.g * aire;
      v.b += col.b * aire;
      votes.set(cle, v);
    }
    const meilleur = [...votes.values()].sort((x, y) => y.aire - x.aire)[0]!;
    return (versSrgb(meilleur.r / meilleur.aire) << 16) | (versSrgb(meilleur.v / meilleur.aire) << 8) | versSrgb(meilleur.b / meilleur.aire);
  };
  // l'écart CIELAB (ΔE76), comme `test/lisibilite.test.ts`
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lab = (hex: number): [number, number, number] => {
    const r = lin((hex >> 16) & 255);
    const g = lin((hex >> 8) & 255);
    const b = lin(hex & 255);
    const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const ecart = (x: number, y: number): number => {
    const p = lab(x);
    const q = lab(y);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  };
  const LISIBLES: NomModele[] = ["chevalier", ...MODELE_BOSS, ...MODELE_MONSTRE];
  for (const [theme, pal] of Object.entries(PALETTES)) {
    it(`${theme} : chaque personnage et chaque monstre tranche sur les deux tons du sol`, () => {
      for (const nom of LISIBLES) {
        const piece = nom === "chene" ? "cime" : "corps"; // le chêne se voit d'en haut par sa cime
        const dom = dominante(pieceDe(nom, piece)!);
        for (const sol of [pal.sol, pal.sol2]) expect(ecart(dom, sol), `${nom} (#${dom.toString(16)}) sur ${theme}`).toBeGreaterThanOrEqual(40);
      }
    });
  }
});

describe("le chargement : seulement le boss du jour et les monstres présents", () => {
  it("un jour : le chevalier, les vases, le boss DU JOUR (pas les quatre autres), les monstres de son niveau", () => {
    for (let jour = 20395; jour < 20402; jour++) {
      const c = dailyRush(jour);
      const noms = modelesDuContenu(c);
      expect(noms).toContain("chevalier");
      for (const v of MODELE_VASE) expect(noms).toContain(v);
      expect(noms).toContain(MODELE_BOSS[c.boss]);
      for (const b of MODELE_BOSS) if (b !== MODELE_BOSS[c.boss]) expect(noms, `jour ${jour}`).not.toContain(b);
      const types = new Set(c.niveau!.monstres.map((m) => m.type));
      for (const v of c.niveau!.epreuve.vagues) for (const m of v) types.add(m.type);
      MODELE_MONSTRE.forEach((n, t) => {
        if (types.has(t)) expect(noms, `${n} présent le jour ${jour}`).toContain(n);
      });
    }
  });
  it("chargerModeles va chercher `modeles/<nom>.glb` à côté de la page, une seule fois par modèle, et laisse la forme procédurale à un modèle absent", async () => {
    oublierModeles();
    const demandes: string[] = [];
    const reel = globalThis.fetch;
    globalThis.fetch = vi.fn(async (u: string | URL) => {
      const url = String(u);
      demandes.push(url);
      const nom = url.split("/").pop()!;
      if (nom === "gelee.glb") return new Response(null, { status: 404 });
      const b = readFileSync(new URL(nom, DOSSIER_MODELES));
      return new Response(b);
    }) as typeof fetch;
    try {
      const r = await Promise.all([chargerModeles(["chevalier", "golem", "gelee"], "http://jeu.test/rush/"), chargerModeles(["golem"], "http://jeu.test/rush/")]);
      expect(r[0].charges.sort()).toEqual(["chevalier", "golem"]);
      expect(r[0].manques).toEqual(["gelee"]);
      expect(demandes.filter((d) => d.endsWith("golem.glb"))).toHaveLength(1);
      expect(demandes[0]).toBe("http://jeu.test/rush/modeles/chevalier.glb");
      expect(pieceDe("golem", "tete")).not.toBeNull();
      expect(pieceDe("gelee", "corps")).toBeNull(); // la gelée garde sa forme d'avant
    } finally {
      globalThis.fetch = reel;
      tous = await chargerTousDuDisque();
    }
  });
});

describe("les acteurs prennent les modèles et l'animation existante les pose sans valeur folle", () => {
  const fini = (o: Object3D): boolean => {
    let ok = true;
    o.updateMatrixWorld(true);
    o.traverse((n) => {
      for (const v of n.matrixWorld.elements) if (!Number.isFinite(v)) ok = false;
    });
    return ok;
  };
  it("le chevalier, dans chaque geste (marche, coup, coup final, compétences, esquive)", () => {
    const a = creerChevalier();
    expect([...a.racine.children]).not.toHaveLength(0);
    for (const etat of [0, 1, 2, 3, 4, 5]) {
      for (const combo of [0, 1, 2]) {
        for (const comp of [0, 1, 2]) {
          animerChevalier(a, { etat, combo, comp, t: 6, marche: true } as never, { dt: 1 / 60, temps: 1, duree: 30, impact: 6, ticks: 12, cache: false, course: 0.5 });
          expect(fini(a.racine)).toBe(true);
        }
      }
    }
  });
  it("chaque boss, dans chaque état", () => {
    const e: EntreeBoss = { dt: 1 / 60, temps: 1.3, t: 20, vivant: true, mort: 0, marche: true, sursaut: 0.5, tick: 10, zones: [], elan: 24, dort: false };
    BOSS_IDS.forEach((_, kind) => {
      const a = creerBoss(kind);
      for (const etat of [0, 1, 2, 3, 4, 5, 6]) {
        for (const attaque of [0, 1, 2, 3, 4, 5]) {
          animerBoss(a, { ...bossFictif(kind), etat, attaque, t1: 30, duree: 60 } as Golem, e);
          expect(fini(a.racine), `${BOSS_IDS[kind]} état ${etat} attaque ${attaque}`).toBe(true);
        }
      }
      animerBoss(a, bossFictif(kind), { ...e, vivant: false, mort: 45 });
      expect(fini(a.racine)).toBe(true);
    });
  });
  it("les tas de monstres portent les géométries des modèles (un appel de dessin par type et par pièce, comme avant)", () => {
    const v = new MonstresVus();
    const geos = new Set<BufferGeometry>();
    v.groupe.traverse((o) => {
      if ((o as Mesh).isMesh) geos.add((o as Mesh).geometry);
    });
    for (const n of MODELE_MONSTRE) for (const p of PIECES[n]) expect(geos.has(pieceDe(n, p)!), `${n}/${p}`).toBe(true);
    expect(geos.has(pieceDe("couronne", "corps")!)).toBe(true);
    expect(geos.has(pieceDe("projectile", "corps")!)).toBe(true);
  });
  it("les vases : les modèles, et la casse lance leurs éclats modélisés qui retombent puis disparaissent", () => {
    const vv = monterVases();
    expect(vv.briser(0, 1, 2, 1, 0, 10)).toBe(true);
    expect(vv.eclatsEnVol()).toBe(4);
    vv.maj([], 10);
    for (let t = 0; t < 120; t++) vv.maj([], 10 + t / 60);
    expect(vv.eclatsEnVol()).toBe(0);
    vv.detruire();
  });
});
