import { describe, expect, it } from "vitest";
import { Matrix4, Vector3 } from "three";
import { AXE, REGLAGES, THEMES_PINBALL, UNITE, construireTable, toutesLesTables, type ThemePinball } from "@cdj/pinball-sim";
import { ENCRE as ENCRE_DESSIN, MOUTARDE as MOUTARDE_DESSIN, PAPIER as PAPIER_DESSIN } from "../src/dessin";
import { MODELES } from "../src/modeles/index";
import { placements, type Instance } from "../src/modeles/placements";
import { modele3D } from "../src/modeles/trois";
import { ENCRE, MOUTARDE, PAPIER, REFERENCE, TYPES_COMMUNS, type Modele3D } from "../src/modeles/types";

// Lot PBV4 : chaque module commun a un vrai modèle par thème, et **ce modèle a l'emprise de sa collision** — sur les 500 tables que le générateur peut tirer (444 avant les plans du lot PBG1) (`toutesLesTables`), chaque modèle posé
// (`placements`, la mise en place que les deux rendus utilisent) reste dans l'emprise de collision de son module, à une marge fixée près, et ne paraît jamais plus petit qu'elle. Les poses animées comptent :
// le bumper enfoncé (son haut s'élargit de 12 %) et le spinner à plusieurs angles.

/** Les marges fixées : de combien un modèle peut dépasser l'emprise de collision de son module (part de la taille de collision). */
const MARGES = {
  /** Bumper : le rayon vu (jupe ou socle compris) entre le rayon de collision et 1,3 fois lui (l'ancien modèle : 1,22). */
  bumper: 0.3,
  /** Cible : sa longueur au plus 15 % de plus que le segment ; au plus 6 px devant lui, et derrière jamais au-delà du mur de fond (à 9 px). */
  cible: 0.15,
  /** Spinner : entre ses deux murs (± 24 px), 5 % près. */
  spinner: 0.05,
  /** Trou : le décor tient dans 1,75 fois le rayon du trou (l'ancien anneau : 1,5). */
  trou: 0.75,
} as const;
const DEVANT_CIBLE = 6;
const DERRIERE_CIBLE = 9;
const MUR_SPINNER = 24;

/** Les sommets d'une pièce, transformés. */
function sommets(m: Modele3D, pose: (role: string | undefined) => Matrix4): Vector3[] {
  const r: Vector3[] = [];
  for (const p of m.pieces) {
    const pos = p.geo.getAttribute("position");
    const mat = pose(p.role);
    for (let k = 0; k < pos.count; k++) r.push(new Vector3().fromBufferAttribute(pos, k).applyMatrix4(mat));
  }
  return r;
}
const ID = new Matrix4();
/** Le bumper enfoncé : comme `trois.ts`, le haut écrasé au-dessus du pivot et élargi de 12 %. */
function enfonce(m: Modele3D): Matrix4 {
  const y = m.pivot?.[1] ?? 3;
  return new Matrix4().makeTranslation(0, y, 0).multiply(new Matrix4().makeScale(1.12, 0.72, 1.12)).multiply(new Matrix4().makeTranslation(0, -y, 0));
}
function tourne(m: Modele3D, a: number): Matrix4 {
  const p = m.pivot ?? [0, 0, 0];
  const x = m.axe ?? [1, 0, 0];
  return new Matrix4().makeTranslation(p[0], p[1], p[2]).multiply(new Matrix4().makeRotationAxis(new Vector3(...x).normalize(), a)).multiply(new Matrix4().makeTranslation(-p[0], -p[1], -p[2]));
}
const rayon = (v: Vector3[]): number => Math.max(...v.map((p) => Math.hypot(p.x, p.z)));
/** Le rectangle (x, z) du modèle de référence, toutes poses comprises. */
const rectangle = (v: Vector3[]): { x0: number; x1: number; z0: number; z1: number } => ({ x0: Math.min(...v.map((p) => p.x)), x1: Math.max(...v.map((p) => p.x)), z0: Math.min(...v.map((p) => p.z)), z1: Math.max(...v.map((p) => p.z)) });

/** L'empreinte de référence de chaque modèle, mesurée une fois. */
function empreintes(theme: ThemePinball) {
  const b = modele3D(theme, "bumper");
  const a = modele3D(theme, "asteroide");
  const s = modele3D(theme, "spinner");
  const tourner = (m: Modele3D) => Array.from({ length: 12 }, (_, k) => sommets(m, (r) => (r === "tourne" ? tourne(m, (k * Math.PI) / 6) : ID))).flat();
  return {
    bumper: { repos: rayon(sommets(b, () => ID)), enfonce: rayon(sommets(b, (r) => (r === "haut" ? enfonce(b) : ID))) },
    asteroide: { repos: rayon(sommets(a, () => ID)), enfonce: rayon(sommets(a, (r) => (r === "haut" ? enfonce(a) : ID))) },
    cible: rectangle(sommets(modele3D(theme, "cible"), () => ID)),
    spinner: rectangle(tourner(s)),
    trou: rayon(sommets(modele3D(theme, "trou"), () => ID)),
  };
}
/** Un point (x, z) du modèle de référence, posé par l'instance (comme `trois.ts` : échelle, cap, puis la place sur la table). */
function poser(ins: Instance, x: number, z: number): [number, number] {
  return [ins.x + (x * Math.cos(ins.a) + z * Math.sin(ins.a)) * ins.s, ins.y + (-x * Math.sin(ins.a) + z * Math.cos(ins.a)) * ins.s];
}

describe("les modèles des modules (lot PBV4)", () => {
  it("chaque couple module et thème a son modèle, en volume et à plat, et ses lumières", () => {
    for (const theme of THEMES_PINBALL) {
      const m = MODELES[theme];
      for (const type of TYPES_COMMUNS) {
        expect(typeof m.trois[type], `${theme} ${type}`).toBe("function");
        expect(modele3D(theme, type).pieces.length, `${theme} ${type}`).toBeGreaterThan(0);
      }
      for (const f of ["socle", "haut", "cible", "spinnerFixe", "spinnerTourne", "trou"] as const) expect(typeof m.plat[f], `${theme} ${f}`).toBe("function");
      for (const l of [m.lumieres.bumper, m.lumieres.trou]) for (const c of l) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    // un vrai modèle par thème : aucun n'est celui d'un autre thème
    for (const type of TYPES_COMMUNS) expect(new Set(THEMES_PINBALL.map((th) => MODELES[th].trois[type])).size, type).toBe(THEMES_PINBALL.length);
    expect(MODELES.espace.trois.asteroide, "l'astéroïde de l'espace").toBeDefined();
    // le retour au contact passe par les rôles : chaque bumper a un haut qui s'enfonce et un socle qui s'allume, chaque spinner une pièce qui tourne, chaque trou une lumière
    for (const theme of THEMES_PINBALL) {
      const roles = (t: Parameters<typeof modele3D>[1]) => new Set(modele3D(theme, t).pieces.map((p) => p.role));
      expect([...roles("bumper")], theme).toEqual(expect.arrayContaining(["haut", "lumiere"]));
      expect([...roles("spinner")], theme).toContain("tourne");
      expect([...roles("trou")], theme).toContain("lumiere");
      expect(modele3D(theme, "spinner").axe, theme).toBeDefined();
    }
    // les couleurs du jeu sont celles de `dessin.ts`
    expect([ENCRE, PAPIER, MOUTARDE]).toEqual([ENCRE_DESSIN, PAPIER_DESSIN, MOUTARDE_DESSIN]);
  });

  it("sur les 24 tables (lot PBT1 ; 94 avant les tables dessinées), aucun modèle ne sort de l'emprise de collision de son module ni ne paraît plus petit qu'elle", () => {
    const tables = toutesLesTables();
    expect(tables.length).toBe(24);
    const E = Object.fromEntries(THEMES_PINBALL.map((th) => [th, empreintes(th)])) as Record<ThemePinball, ReturnType<typeof empreintes>>;
    for (const th of THEMES_PINBALL) {
      // le modèle de référence, à sa taille de collision
      for (const t of ["bumper", "asteroide"] as const) {
        expect(E[th][t].repos, `${th} ${t}`).toBeGreaterThanOrEqual(REFERENCE.bumper);
        expect(E[th][t].enfonce, `${th} ${t} enfoncé`).toBeLessThanOrEqual(REFERENCE.bumper * (1 + MARGES.bumper));
      }
      expect(E[th].trou, `${th} trou`).toBeGreaterThanOrEqual(REFERENCE.trou);
      expect(E[th].trou, `${th} trou`).toBeLessThanOrEqual(REFERENCE.trou * (1 + MARGES.trou));
    }
    let poses = 0;
    for (const contenu of tables) {
      const table = construireTable(contenu, REGLAGES);
      const th = contenu.theme;
      const P = placements(table);
      const quoi = `${th} ${contenu.modules.join(",")}`;
      // bumpers, mini-bumpers et astéroïde : centrés sur leur cercle, de son rayon à 1,3 fois lui
      for (const [l, e] of [[P.bumper, E[th].bumper], [P.asteroide, E[th].asteroide]] as const)
        for (const ins of l) {
          const b = table.bumpers[ins.i]!;
          const r = b.r / UNITE;
          expect([ins.x, ins.y], quoi).toEqual([b.x / UNITE, b.y / UNITE]);
          expect(e.repos * ins.s, `${quoi} bumper ${ins.i}`).toBeGreaterThanOrEqual(r - 1e-6);
          expect(e.enfonce * ins.s, `${quoi} bumper ${ins.i}`).toBeLessThanOrEqual(r * (1 + MARGES.bumper) + 1e-6);
          poses++;
        }
      // cibles : dans le repère du segment, la longueur et la profondeur
      for (const ins of P.cible) {
        const m = table.murs[ins.i]!;
        const ax = m.ax / UNITE;
        const ay = m.ay / UNITE;
        const bx = m.bx / UNITE;
        const by = m.by / UNITE;
        const L = Math.hypot(m.bx / UNITE - ax, m.by / UNITE - ay);
        const ux = (m.bx / UNITE - ax) / L;
        const uy = (m.by / UNITE - ay) / L;
        const R = E[th].cible;
        let long = 0;
        for (const [x, z] of [[R.x0, R.z0], [R.x0, R.z1], [R.x1, R.z0], [R.x1, R.z1]] as const) {
          const [px, py] = poser(ins, x, z);
          const le = (px - ax) * ux + (py - ay) * uy - L / 2;
          // devant (vers les batteurs) ou derrière (vers le mur de fond), compté depuis le segment
          const devant = (px - (ax + bx) / 2) * Math.sin(ins.a) + (py - (ay + by) / 2) * Math.cos(ins.a);
          long = Math.max(long, Math.abs(le));
          expect(Math.abs(le), `${quoi} cible ${ins.i}`).toBeLessThanOrEqual((L / 2) * (1 + MARGES.cible));
          expect(devant, `${quoi} cible ${ins.i}`).toBeLessThanOrEqual(DEVANT_CIBLE);
          expect(-devant, `${quoi} cible ${ins.i}`).toBeLessThanOrEqual(DERRIERE_CIBLE);
        }
        expect(long, `${quoi} cible ${ins.i}`).toBeGreaterThanOrEqual((L / 2) * (1 - MARGES.cible));
        // l'avant regarde les batteurs
        expect(Math.sin(ins.a) * (AXE - ins.x) + Math.cos(ins.a) * (640 - ins.y), quoi).toBeGreaterThan(0);
        poses++;
      }
      // spinners : entre leurs murs, et au moins aussi larges que leur capteur (à 20 % près), à tous les angles
      for (const ins of P.spinner) {
        const c = table.spinners[ins.i]!;
        const R = E[th].spinner;
        const l = c.l / UNITE;
        for (const [x, z] of [[R.x0, R.z0], [R.x0, R.z1], [R.x1, R.z0], [R.x1, R.z1]] as const) {
          const [px, py] = poser(ins, x, z);
          expect(Math.abs(px - c.x / UNITE), `${quoi} spinner`).toBeLessThanOrEqual(MUR_SPINNER * (1 + MARGES.spinner));
          expect(Math.abs(py - c.y / UNITE), `${quoi} spinner`).toBeLessThanOrEqual(30);
        }
        expect(Math.min(-R.x0, R.x1) * ins.s, `${quoi} spinner`).toBeGreaterThanOrEqual(l * 0.8);
        poses++;
      }
      // trous : centrés, du rayon du trou à 1,75 fois lui
      for (const ins of P.trou) {
        const tr = table.trous[ins.i]!;
        expect([ins.x, ins.y], quoi).toEqual([tr.x / UNITE, tr.y / UNITE]);
        expect(E[th].trou * ins.s, quoi).toBeLessThanOrEqual((tr.r / UNITE) * (1 + MARGES.trou) + 1e-6);
        poses++;
      }
    }
    expect(poses).toBeGreaterThan(150); // lot PBT1 : 184 poses sur 24 tables (plus de 800 sur 94 : le même ordre, 7 à 8 modèles par table)
  });

  it("le rendu à plat dessine chaque modèle de chaque thème", () => {
    // un faux contexte qui accepte tout et compte ce qui est peint
    let peint = 0;
    const c = new Proxy({} as Record<string, unknown>, {
      get: (o, k) => (k in o ? o[k as string] : k === "fill" || k === "stroke" ? () => void peint++ : () => undefined),
      set: (o, k, v) => ((o[k as string] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    for (const theme of THEMES_PINBALL) {
      const p = MODELES[theme].plat;
      const avant = peint;
      p.socle(c, 17, "#ffffff", 0);
      p.haut(c, 17, 1);
      p.cible(c, 20, 2);
      p.spinnerFixe(c, 22);
      p.spinnerTourne(c, 22);
      p.trou(c, 13, "#ffffff", 0);
      expect(peint - avant, theme).toBeGreaterThan(10);
    }
  });
});
