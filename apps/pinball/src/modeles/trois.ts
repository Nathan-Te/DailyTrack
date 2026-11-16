import { MeshPhongMaterial, BackSide, BoxGeometry, DoubleSide, FrontSide, Color, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type BufferGeometry, type Group, type Material } from "three";
import { HAUTEUR, LARGEUR, UNITE, type Partie, type ThemePinball } from "@cdj/pinball-sim";
import { MODELES } from "./index";
import { coque, OUTILS } from "./outils";
import { placements, type Instance } from "./placements";
import { ENCRE, type Matiere, type Modele3D, type Piece } from "./types";

// Lot PBV4 : les modules communs du rendu three.js, **partagés et instanciés** : un modèle par type et par thème (`MODELES`), construit une fois, et une `InstancedMesh` par pièce pour tous les modules de ce type sur
// la table (trois bumpers et deux mini-bumpers = un seul appel de dessin par pièce). **Le retour au contact est ici, commun à tous les thèmes**, et passe par le rôle des pièces : le haut d'un bumper s'enfonce et
// son socle s'allume (`haut`, `lumiere`), une cible touchée bascule en arrière et s'enfonce dans le sol (tout le modèle), un spinner tourne autour de son axe (`tourne`), un trou s'allume quand il garde la bille
// (`lumiere`). Une lumière se règle par la couleur de son instance (au-delà de 1 : elle éclaire). `corps.ts` n'en connaît que `creerModules` et `maj`.

const X = (x: number): number => x - LARGEUR / 2;
const Z = (y: number): number => y - HAUTEUR / 2;
const M = new Matrix4();
const A = new Matrix4();
const B = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s3 = new Vector3();
const axe = new Vector3();
const teinte = new Color();
const ZERO = new Matrix4().makeScale(0, 0, 0);
/** La part de lumière que renvoient les modules (Phong, sans reflets de la pièce) sous la lumière et l'exposition du lot PBV3 : comme `GAIN_SOL` pour le sol, réglée à l'œil pour que les modules restent les objets les plus vifs. */
const GAIN_MODULES = 3.4;

/** Les modèles d'un thème, construits une fois (la page ne joue qu'un thème à la fois). */
const construits = new Map<string, Modele3D>();
export function modele3D(theme: ThemePinball, type: "bumper" | "asteroide" | "cible" | "spinner" | "trou"): Modele3D {
  const cle = `${theme}|${type}`;
  let m = construits.get(cle);
  if (!m) {
    const f = MODELES[theme].trois[type] ?? MODELES[theme].trois.bumper;
    m = f(OUTILS);
    construits.set(cle, m);
  }
  return m;
}

interface Maillage {
  piece: Piece;
  mesh: InstancedMesh;
  coque?: InstancedMesh;
}
interface Groupe {
  modele: Modele3D;
  instances: Instance[];
  maillages: Maillage[];
}

export interface Modules {
  /** Une image : la partie au pas courant, le temps écoulé (s) et le temps de la partie (s). */
  maj(partie: Partie, dt: number, sec: number): void;
  /** Ce qui reste à libérer (géométries des coques, matériaux) ; les modèles, partagés, restent. */
  detruire(): void;
}

export function creerModules(theme: ThemePinball, partie: Partie, groupe: Group): Modules {
  const t = partie.table;
  const P = placements(t);
  const lum = MODELES[theme].lumieres;
  const aLiberer: { dispose(): void }[] = [];
  const encre = new MeshBasicMaterial({ color: ENCRE, side: BackSide });
  aLiberer.push(encre);
  // Lot PBV4, après PBV3 : du Phong et non du « Standard » (qui échantillonne l'environnement à chaque pixel) : le reflet du soleil suffit à des objets si petits (vernis : rugosité basse, brillance haute ;
  // métal : un reflet de sa couleur), et le rendu logiciel des essais est plus léger.
  const materiau = (m: Matiere, blanc: boolean): Material => {
    const rug = m.rug ?? 0.45;
    const x = new MeshPhongMaterial({ color: new Color(blanc ? "#ffffff" : m.c).multiplyScalar(GAIN_MODULES), emissive: m.em ?? "#000000", shininess: 4 + (1 - rug) * (1 - rug) * 90, specular: m.met ? m.c : new Color().setScalar(0.06 + (1 - rug) * 0.5 * Math.min(1.4, (m.env ?? 0.5) + 0.3)), transparent: (m.op ?? 1) < 1, opacity: m.op ?? 1, depthWrite: (m.op ?? 1) >= 1, side: m.deux ? DoubleSide : FrontSide });
    aLiberer.push(x);
    return x;
  };
  const monter = (modele: Modele3D, instances: Instance[]): Groupe => {
    const maillages: Maillage[] = [];
    if (instances.length === 0) return { modele, instances, maillages };
    // seule la plus grosse pièce opaque projette une ombre (le corps de l'objet) : les petites (rebords, bâton, nacelles, ventouses…) doublaient le coût de la carte d'ombres pour presque rien
    const ombreuse = modele.pieces.filter((p) => !p.sansOmbre && (p.m.op ?? 1) >= 1).reduce<Piece | null>((a, p) => (!a || p.geo.getAttribute("position").count > a.geo.getAttribute("position").count ? p : a), null);
    for (const piece of modele.pieces) {
      const parInstance = piece.role === "lumiere" || !!piece.m.teintes;
      const mesh = new InstancedMesh(piece.geo, materiau(piece.m, parInstance), instances.length);
      mesh.castShadow = piece === ombreuse;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      if (parInstance)
        instances.forEach((ins) => mesh.setColorAt(ins.k, teinte.set(piece.role === "lumiere" ? piece.m.c : piece.m.teintes![ins.k % piece.m.teintes!.length]!)));
      groupe.add(mesh);
      const mm: Maillage = { piece, mesh };
      if (piece.contour) {
        const g: BufferGeometry = coque(piece.geo, piece.contour);
        aLiberer.push(g);
        mm.coque = new InstancedMesh(g, encre, instances.length);
        mm.coque.frustumCulled = false;
        groupe.add(mm.coque);
      }
      maillages.push(mm);
    }
    return { modele, instances, maillages };
  };
  const bumpers = monter(modele3D(theme, "bumper"), P.bumper);
  const asteroides = monter(modele3D(theme, "asteroide"), P.asteroide);
  const cibles = monter(modele3D(theme, "cible"), P.cible);
  const spinners = monter(modele3D(theme, "spinner"), P.spinner);
  const trous = monter(modele3D(theme, "trou"), P.trou);

  /** La place d'une instance (sans animation), dans `m`. */
  const base = (m: Matrix4, ins: Instance, x = ins.x): Matrix4 => m.compose(v.set(X(x), 0, Z(ins.y)), q.setFromAxisAngle(axe.set(0, 1, 0), ins.a), s3.setScalar(ins.s));
  const m0 = new Matrix4();
  const m1 = new Matrix4();
  /** Ce qui a changé depuis la dernière image : seules ces pièces repartent vers la carte graphique. */
  const sales = new Set<InstancedMesh>();
  const poser = (mm: Maillage, k: number, m: Matrix4): void => {
    const cache = mm.piece.variante !== undefined && k % 2 !== mm.piece.variante;
    mm.mesh.setMatrixAt(k, cache ? ZERO : m);
    sales.add(mm.mesh);
    if (mm.coque) {
      mm.coque.setMatrixAt(k, cache ? ZERO : m);
      sales.add(mm.coque);
    }
  };
  const B_ = new Color();
  const allumer = (mm: Maillage, k: number, eteinte: string, allumee: string, e: number): void => {
    if (mm.piece.role !== "lumiere") return;
    mm.mesh.setColorAt(k, teinte.set(eteinte).lerp(B_.set(allumee), Math.min(1, e)).multiplyScalar(1 + e * 0.8));
    sales.add(mm.mesh);
  };

  // les cibles : leur chute (0 debout, 1 tombée) suit la partie, adoucie ; leur trace pointillée au sol quand elles sont tombées
  const chute = P.cible.map(() => -1);
  const traces = P.cible.length ? new InstancedMesh(new BoxGeometry(1, 0.4, 3), new MeshBasicMaterial({ color: ENCRE, transparent: true, opacity: 0.4 }), P.cible.length) : null;
  if (traces) {
    aLiberer.push(traces.geometry, traces.material as Material);
    traces.frustumCulled = false;
    groupe.add(traces);
  }
  const angles = P.spinner.map(() => 0);
  /** Le dernier état dessiné de chaque instance (−1 : jamais dessinée) : un bumper au repos, une cible debout, un spinner arrêté ne coûtent rien. */
  const etats = new Map<Groupe, number[]>([bumpers, asteroides, spinners, trous].map((g) => [g, g.instances.map(() => -1)]));

  function majBumpers(g: Groupe, eteinte: string, allumee: string): void {
    const pivot = g.modele.pivot?.[1] ?? 3;
    const vus = etats.get(g)!;
    for (const ins of g.instances) {
      const b = t.bumpers[ins.i]!;
      const e = partie.choc[ins.i]! / 40;
      if (e === vus[ins.k] && !b.mobile) continue;
      vus[ins.k] = e;
      base(m0, ins, b.mobile ? b.x / UNITE : ins.x);
      // le haut s'enfonce : écrasé au-dessus du pivot, élargi un peu
      m1.copy(m0).multiply(A.makeTranslation(0, pivot, 0)).multiply(B.makeScale(1 + e * 0.12, 1 - e * 0.28, 1 + e * 0.12)).multiply(M.makeTranslation(0, -pivot, 0));
      for (const mm of g.maillages) {
        poser(mm, ins.k, mm.piece.role === "haut" ? m1 : m0);
        allumer(mm, ins.k, eteinte, allumee, e);
      }
    }
  }

  return {
    maj(p: Partie, dt: number, sec: number): void {
      majBumpers(bumpers, lum.bumper[0], lum.bumper[1]);
      majBumpers(asteroides, lum.bumper[0], lum.bumper[1]);
      cibles.instances.forEach((ins, n) => {
        const bas = p.bas[ins.i]!;
        const avant = chute[n]!;
        const c = avant < 0 ? (bas ? 1 : 0) : Math.abs((bas ? 1 : 0) - avant) < 0.002 ? (bas ? 1 : 0) : avant + ((bas ? 1 : 0) - avant) * Math.min(1, dt * 14);
        if (c === avant) return;
        chute[n] = c;
        // elle bascule en arrière (autour de son arête arrière) et s'enfonce sous le sol
        base(m0, ins).multiply(A.makeTranslation(0, -20 * c, -3)).multiply(B.makeRotationX(-1.1 * c)).multiply(M.makeTranslation(0, 0, 3));
        for (const mm of cibles.maillages) poser(mm, ins.k, m0);
        traces!.setMatrixAt(n, bas ? base(m0, ins).multiply(A.makeScale(19, 1, 1)).setPosition(X(ins.x), 0.5, Z(ins.y)) : ZERO);
        sales.add(traces!);
      });
      const pv = spinners.modele.pivot ?? [0, 0, 0];
      const ax = spinners.modele.axe ?? [1, 0, 0];
      const vusS = etats.get(spinners)!;
      spinners.instances.forEach((ins, n) => {
        angles[n] = angles[n]! + (p.spin[ins.i]! / 1000) * dt * 60 * 0.016;
        if (angles[n] === vusS[n]) return;
        vusS[n] = angles[n]!;
        base(m0, ins);
        m1.copy(m0).multiply(A.makeTranslation(pv[0], pv[1], pv[2])).multiply(B.makeRotationAxis(axe.set(ax[0], ax[1], ax[2]).normalize(), angles[n]!)).multiply(M.makeTranslation(-pv[0], -pv[1], -pv[2]));
        for (const mm of spinners.maillages) poser(mm, ins.k, mm.piece.role === "tourne" ? m1 : m0);
      });
      const vusT = etats.get(trous)!;
      trous.instances.forEach((ins) => {
        const garde = p.captif > 0 && p.captifDe === ins.i ? 0.75 + 0.25 * Math.sin(sec * 14) : 0;
        if (garde === vusT[ins.k]) return;
        const premiere = vusT[ins.k]! < 0;
        vusT[ins.k] = garde;
        base(m0, ins);
        for (const mm of trous.maillages) {
          if (premiere) poser(mm, ins.k, m0);
          allumer(mm, ins.k, lum.trou[0], lum.trou[1], garde);
        }
      });
      for (const m of sales) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
      sales.clear();
    },
    detruire(): void {
      for (const x of aLiberer) x.dispose();
    },
  };
}
