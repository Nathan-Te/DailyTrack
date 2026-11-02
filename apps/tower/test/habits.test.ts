import { boitesE, type Effet, EFFETS, type PieceKind } from "@cdj/tower-sim";
import { Group, type Mesh, type MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { habiller, type Soudure } from "../src/habits";

// Lot T9 — l'habit des effets : chaque effet produit son habit (la pièce le porte sur tout son corps, pas un liseré), les soudures du lierre sont lues dans les joints (une feuille-agrafe chacune), et avec
// `prefers-reduced-motion` rien ne bouge. Du Three.js sans WebGL : on lit les formes posées dans le groupe de la pièce.
const demande = (effet: Effet | null, kind: PieceKind = "T", fixe = false, id = 7) => ({ bs: boitesE(kind, 0, effet === "petite" ? "petite" : effet === "geante" ? "geante" : "normale"), id, effet, fixe, taille: effet === "petite" ? ("petite" as const) : effet === "geante" ? ("geante" as const) : ("normale" as const), couleur: "#9B6BD6" });
const couleurs = (g: Group): Set<string> => {
  const s = new Set<string>();
  g.traverse((o) => {
    const m = (o as Mesh).material as MeshBasicMaterial | undefined;
    if (m?.color) s.add(`#${m.color.getHexString().toUpperCase()}`);
  });
  return s;
};
const formes = (g: Group): number => {
  let n = 0;
  g.traverse((o) => {
    if ((o as Mesh).isMesh) n++;
  });
  return n;
};

describe("chaque effet produit son habit", () => {
  it("six effets, six habits : de nombreuses formes posées sur la pièce ; sans effet (ni corps fixe), aucun habit", () => {
    for (const e of EFFETS) {
      const g = new Group();
      const h = habiller(g, demande(e));
      expect(h, e).not.toBeNull();
      expect(formes(g), `${e} : un habit sur tout le corps, pas un liseré`).toBeGreaterThanOrEqual(8);
    }
    const nu = new Group();
    expect(habiller(nu, demande(null))).toBeNull();
    expect(formes(nu)).toBe(0);
  });

  it("figée : un habit de chantier — bande jaune et noire, plaques d'acier boulonnées, équerres ; un corps fixe (la pièce figée) en a le même, même sans effet", () => {
    const g = new Group();
    habiller(g, demande("figee"));
    for (const c of ["#F2B705", "#A7A9AC", "#6B6E72", "#F2B544"]) expect(couleurs(g), c).toContain(c);
    const fixe = new Group();
    habiller(fixe, demande(null, "T", true));
    expect(formes(fixe)).toBe(formes(g));
  });

  it("deux équerres : une à chaque pied (l'habit d'un carré a deux fois plus de pièces d'acier qu'avec une seule)", () => {
    const g = new Group();
    habiller(g, demande("figee", "O"));
    // Le polygone d'acier d'une équerre (6 sommets) : une encre dessous, une couleur dessus, deux équerres → quatre formes à 6 sommets.
    let equerres = 0;
    g.traverse((o) => {
      const geo = (o as Mesh).geometry;
      if (geo?.getAttribute("position")?.count === 12) equerres++; // 6 sommets en éventail : 4 triangles = 12 points
    });
    expect(equerres).toBe(4);
  });

  it("lierre : une liane et des feuilles vertes", () => {
    const g = new Group();
    habiller(g, demande("lierre"));
    for (const c of ["#2F7D3A", "#5DBB63"]) expect(couleurs(g), c).toContain(c);
  });

  it("glissante : prise dans le verglas — glace, facettes blanches, glaçons ; son bord de glace épais est posé avec ses couches", () => {
    const g = new Group();
    habiller(g, demande("glissante"));
    for (const c of ["#BFE6F5", "#FFFFFF"]) expect(couleurs(g), c).toContain(c);
  });

  it("petite : des étincelles et le contour pointillé de la taille normale, qui se resserre puis s'efface", () => {
    const g = new Group();
    const h = habiller(g, demande("petite"))!;
    expect(couleurs(g)).toContain("#F2B544");
    expect(couleurs(g)).toContain("#FFF6E0");
    const contour = g.children.find((c) => (c as Group).isGroup && c.children.length > 8)!;
    h.maj({ t: 0, age: 0, reduit: false, sensVent: 0, angle: 0, soudures: [] });
    const large = contour.scale.x;
    h.maj({ t: 0.9, age: 0.9, reduit: false, sensVent: 0, angle: 0, soudures: [] });
    expect(contour.scale.x).toBeLessThan(large);
    expect(contour.visible).toBe(true);
    h.maj({ t: 3, age: 3, reduit: false, sensVent: 0, angle: 0, soudures: [] });
    expect(contour.visible).toBe(false);
  });

  it("géante : une bande d'ombre plus sombre que la pièce, des rivets", () => {
    const g = new Group();
    habiller(g, demande("geante"));
    const cs = couleurs(g);
    expect(cs).not.toContain("#9B6BD6");
    expect([...cs].some((c) => c !== "#2A1E16" && c !== "#BFE6F5" && Number.parseInt(c.slice(1, 3), 16) < 0x9b)).toBe(true); // l'ombre : un mélange d'encre
  });

  it("coup de vent : un tourbillon et des feuilles, seulement tant que le vent souffle sur la pièce en main", () => {
    const g = new Group();
    const h = habiller(g, demande("vent"))!;
    const visibles = (): number => g.children.filter((c) => c.visible && (c as Group).isGroup).length;
    h.maj({ t: 1, age: 1, reduit: false, sensVent: 0, angle: 0, soudures: [] });
    const sans = visibles();
    h.maj({ t: 1, age: 1, reduit: false, sensVent: 1, angle: 0, soudures: [] });
    expect(visibles()).toBeGreaterThan(sans);
  });
});

describe("les agrafes du lierre sont lues dans les joints", () => {
  const joint = (id: number, vers: number, px: number, py: number): Soudure => ({ id, vers, x: 0, y: 1, px, py });

  it("une feuille-agrafe par soudure de CETTE pièce (celles des autres pièces ne comptent pas), refaites quand les soudures changent", () => {
    const g = new Group();
    const h = habiller(g, demande("lierre", "T", false, 7))!;
    const avant = formes(g);
    const liste: Soudure[] = [joint(7, 3, 0, -1), joint(7, -1, 0, 0), joint(9, 7, 4, 1)];
    h.maj({ t: 0, age: 1, reduit: false, sensVent: 0, angle: 0, soudures: liste });
    const deux = formes(g);
    expect(deux - avant, "deux soudures, deux agrafes (l'encre dessous, la feuille dessus)").toBe(2 * 2);
    h.maj({ t: 1, age: 2, reduit: false, sensVent: 0, angle: 0, soudures: liste }); // la même liste : rien à refaire
    expect(formes(g)).toBe(deux);
    h.maj({ t: 2, age: 3, reduit: false, sensVent: 0, angle: 0, soudures: [joint(7, 3, 0, -1)] });
    expect(formes(g) - avant).toBe(2);
    h.maj({ t: 3, age: 4, reduit: false, sensVent: 0, angle: 0, soudures: [] });
    expect(formes(g)).toBe(avant);
  });

  it("l'agrafe est posée du côté du corps soudé, sur le bord de la pièce", () => {
    const g = new Group();
    const h = habiller(g, demande("lierre", "O", false, 7))!;
    h.maj({ t: 0, age: 1, reduit: false, sensVent: 0, angle: 0, soudures: [{ id: 7, vers: 2, x: 0, y: 1, px: 0, py: -1 }] }); // le corps soudé est dessous
    const agrafe = g.children[g.children.length - 1]!;
    expect(agrafe.position.y).toBeLessThan(-0.5); // le bas d'un carré de 2 m
    expect(Math.abs(agrafe.position.x)).toBeLessThan(0.2);
    g.remove(agrafe);
    h.maj({ t: 1, age: 2, reduit: false, sensVent: 0, angle: 0, soudures: [{ id: 7, vers: 2, x: 0, y: 1, px: 3, py: 1 }] }); // à droite
    expect(g.children[g.children.length - 1]!.position.x).toBeGreaterThan(0.5);
  });
});

describe("le mouvement réduit coupe les animations de l'habit", () => {
  it("avec prefers-reduced-motion l'habit est à sa place de repos à tout instant ; sans, il bouge", () => {
    for (const e of EFFETS) {
      const g = new Group();
      const h = habiller(g, demande(e))!;
      const etat = (t: number, reduit: boolean): string => {
        h.maj({ t, age: 5, reduit, sensVent: 1, angle: 0, soudures: [] });
        const lignes: number[] = [];
        g.traverse((o) => lignes.push(o.position.x, o.position.y, o.scale.x, o.rotation.z, o.visible ? 1 : 0));
        return lignes.map((v) => v.toFixed(5)).join(",");
      };
      expect(etat(1.7, true), e).toBe(etat(0, true));
      expect(etat(8.3, true), e).toBe(etat(0, true));
      if (e !== "lierre" && e !== "geante" && e !== "petite") expect(etat(1.7, false), e).not.toBe(etat(0, true));
    }
  });
});
