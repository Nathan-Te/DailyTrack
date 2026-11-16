import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Object3D, Vector3, type BufferGeometry, type Float32BufferAttribute } from "three";
import {
  BELT_FLOW,
  BELT_PERIOD,
  BLOC_FORME,
  PIQUE,
  STEP,
  ajouterFlecheDeVent,
  beltTime,
  chevronAt,
  restLook,
  squashScale,
  trianglesDePiques,
  type Grille,
  type SensPique,
} from "../src/plateformes";
import { BELT_FRAGMENT, buildBeltArt, creerBloc, creerPersonnage, creerPiques, geometriesDeBloc, geometrieDePiques } from "../src/plateformesThree";

// Lot PG1 — ce que le jeu de plateformes d'origine dessinait seul (piques avec cerne, blocs qui changent, chevrons du tapis, flèches du vent) est un dessin commun, et le personnage a un point d'accroche pour un accessoire.
// **Les empreintes ci-dessous sont celles du dessin d'avant l'extraction** (le code du jeu d'origine, calculé avant de le déplacer) : le dessin commun est le même au bit près, donc le jeu qui s'y branche ne change pas
// d'un pixel (le jeu d'origine garde l'empreinte de ses propres niveaux : `apps/jump/test/dessinFige.test.ts`).
const h = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex");
const f32 = (a: ArrayLike<number>) => Array.from(new Float32Array(a));
const pos = (g: BufferGeometry) => Array.from((g.getAttribute("position") as Float32BufferAttribute).array);

// Un jeu imaginaire : 4 = pique vers le haut, 5 vers le bas, 6 vers la gauche, 7 vers la droite, 1 = plein.
const SENS: Record<number, SensPique> = { 4: "haut", 5: "bas", 6: "gauche", 7: "droite" };
const sensDe = (t: number): SensPique | null => SENS[t] ?? null;
const GRILLE: Grille = { width: 8, height: 4, tiles: Uint8Array.from([0, 4, 5, 6, 7, 0, 0, 0, 7, 0, 6, 0, 5, 0, 4, 0, 1, 1, 1, 4, 5, 6, 7, 1, 0, 0, 0, 0, 0, 0, 0, 0]) };

describe("les piques avec cerne", () => {
  it("un triangle franc par case, le cerne agrandi autour : la géométrie du jeu d'origine, au bit près", () => {
    expect(trianglesDePiques(GRILLE, sensDe).length / 9).toBe(12);
    expect(h([f32(trianglesDePiques(GRILLE, sensDe)), f32(trianglesDePiques(GRILLE, sensDe, PIQUE.cerne))])).toBe("538bdbee4d5c96fe7cd6e4e21d0da2d685b85614");
    expect(pos(geometrieDePiques(GRILLE, sensDe))).toEqual(f32(trianglesDePiques(GRILLE, sensDe)));
  });
  it("la pointe suit le sens, dans l'espace du monde (y vers le haut) ; une grille sans pique n'a rien", () => {
    const un = (code: number): number[] => trianglesDePiques({ width: 1, height: 1, tiles: [code] }, sensDe).map((v) => v + 0); // `+ 0` : pas de zéro négatif
    expect(un(4)).toEqual([0, -1, 0, 1, -1, 0, 0.5, 0, 0]); // vers le haut : la base en bas de la case
    expect(un(5)).toEqual([0, 0, 0, 0.5, -1, 0, 1, 0, 0]);
    expect(un(6)).toEqual([1, 0, 0, 0, -0.5, 0, 1, -1, 0]);
    expect(un(7)).toEqual([0, -1, 0, 1, -0.5, 0, 0, 0, 0]);
    expect(un(1)).toEqual([]);
  });
  it("le cerne est plus grand que le pique et derrière lui ; le jeu donne le rouge, le cerne est toujours le sombre commun", () => {
    const p = creerPiques(GRILLE, sensDe, 0xff3b3b);
    expect(p.cerne.position.z).toBe(PIQUE.zCerne);
    expect(p.piques.position.z).toBe(PIQUE.z);
    expect(p.cerne.position.z).toBeLessThan(p.piques.position.z);
    expect(p.groupe.children).toEqual([p.piques, p.cerne]);
    expect((p.piques.material as unknown as { color: { getHex(): number } }).color.getHex()).toBe(0xff3b3b);
    expect((p.cerne.material as unknown as { color: { getHex(): number } }).color.getHex()).toBe(0x1a0408);
    // chaque triangle de cerne contient le pique de la même case : ses trois sommets sont plus loin du centre
    const a = trianglesDePiques(GRILLE, sensDe);
    const c = trianglesDePiques(GRILLE, sensDe, PIQUE.cerne);
    expect(c.length).toBe(a.length);
    for (let k = 0; k < a.length; k += 9) {
      const centre = (t: number[]): [number, number] => [(t[k]! + t[k + 3]! + t[k + 6]!) / 3, (t[k + 1]! + t[k + 4]! + t[k + 7]!) / 3];
      const [cx, cy] = centre(a);
      for (let v = 0; v < 3; v++) expect(Math.hypot(c[k + v * 3]! - cx, c[k + v * 3 + 1]! - cy)).toBeGreaterThan(Math.hypot(a[k + v * 3]! - cx, a[k + v * 3 + 1]! - cy));
    }
  });
});

describe("les blocs qui changent", () => {
  it("les neuf géométries partagées : la même forme que le jeu d'origine, au bit près", () => {
    const g = geometriesDeBloc();
    expect(h([g.thin, g.thick, g.dashed, g.losange, g.pastilleLosange, g.face, g.ligne, g.barre, g.pastilleBarre].map(pos))).toBe("e8bd1ecea826f8a8a703526fbedfd16e56276915");
  });
  it("le clignotant a un contour pointillé et un trait de niveau, pas de repère ; un alterné a son repère et sa pastille, pas de pointillé", () => {
    const g = geometriesDeBloc();
    const b = creerBloc("blink", 3, 2, g);
    expect([b.frameDash, b.line].every((m) => m && !m.visible)).toBe(true);
    expect([b.mark, b.markMat, b.pip, b.pipMat]).toEqual([null, null, null, null]);
    expect(b.g.position.toArray()).toEqual([3.5, -2.5, BLOC_FORME.z.bloc]);
    expect(b.g.children).toHaveLength(5); // face, deux liserés, pointillé, trait de niveau
    const a = creerBloc("A", 0, 0, g);
    const bb = creerBloc("B", 0, 0, g);
    expect([a.frameDash, a.line]).toEqual([null, null]);
    expect(a.g.children).toHaveLength(5); // face, deux liserés, repère, pastille
    // le repère est la barre pour A et le losange pour B ; la pastille est l'autre jeu (le losange pour A, la barre pour B), et de la couleur de l'autre jeu
    expect(a.mark!.geometry).toBe(g.barre);
    expect(bb.mark!.geometry).toBe(g.losange);
    expect(a.pip!.geometry).toBe(g.pastilleLosange);
    expect(bb.pip!.geometry).toBe(g.pastilleBarre);
    expect(a.pip!.visible).toBe(false);
    expect(a.pipMat!.color.getHex()).not.toBe(a.markMat!.color.getHex());
    // un matériau par bloc : l'opacité varie bloc par bloc
    expect(creerBloc("blink", 0, 0, g).faceMat).not.toBe(b.faceMat);
  });
});

describe("les chevrons du tapis", () => {
  const CODES = { sensTapis: (t: number) => (t === 2 ? 1 : t === 3 ? -1 : 0), vide: 0 };
  const TAPIS: Grille = { width: 6, height: 3, tiles: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 3, 1]) };
  it("une bande par tuile de tapis exposée, avec son sens ; un tapis sous un plein n'a rien ; un tronçon par `chunkColumns`", () => {
    const a = buildBeltArt(TAPIS, CODES, 32);
    expect(a.tiles).toBe(4);
    expect(a.chunks).toHaveLength(1);
    expect(a.chunks[0]!.dir.filter((d) => d === 1)).toHaveLength(8);
    expect(a.chunks[0]!.dir.filter((d) => d === -1)).toHaveLength(8);
    expect(a.chunks[0]!.triangles).toBe(8);
    expect(buildBeltArt(TAPIS, CODES, 3).chunks.map((c) => [c.col0, c.col1])).toEqual([[0, 3], [3, 6]]);
    const couvert: Grille = { width: 1, height: 2, tiles: [1, 2] };
    expect(buildBeltArt(couvert, CODES, 32).tiles).toBe(0);
  });
  it("le défilement : figé sans mouvement, dans le sens du tapis avec ; le shader porte la période", () => {
    expect(beltTime(10, false)).toBe(0);
    expect(beltTime(1, true)).toBeCloseTo(BELT_FLOW / BELT_PERIOD);
    expect(chevronAt(0, 1, 0.2)).toBeGreaterThan(chevronAt(0, 1, 0.1)); // vers la droite : le chevron avance avec le temps
    expect(chevronAt(0, -1, 0.2)).toBeLessThan(chevronAt(0, -1, 0.1)); // vers la gauche : il recule
    expect(BELT_FRAGMENT).toContain(BELT_PERIOD.toFixed(3));
  });
});

describe("la flèche du courant d'air", () => {
  it("deux branches, douze sommets, dans le sens du vent : la géométrie du jeu d'origine, au bit près", () => {
    const fleches = [[1, 0], [-1, 0], [0, 1]].map(([dx, dy]) => {
      const p: number[] = [];
      ajouterFlecheDeVent(p, 3.5, -2.25, dx!, dy!);
      expect(p).toHaveLength(36);
      return f32(p);
    });
    expect(h(fleches)).toBe("c324468519a619f59c1b304363a2788cf36bbdff");
    // elle s'ajoute à ce qui existe sans le toucher
    const p = [9, 9, 9];
    ajouterFlecheDeVent(p, 0, 0, 1, 0);
    expect(p.slice(0, 3)).toEqual([9, 9, 9]);
    expect(p).toHaveLength(39);
  });
});

describe("l'accroche d'un accessoire sur le personnage", () => {
  /** La position dans le monde d'un point posé dans l'accroche en (x, y), après la pose. */
  const monde = (p: ReturnType<typeof creerPersonnage>, x: number, y: number): Vector3 => {
    const point = new Object3D();
    point.position.set(x, y, 0);
    p.accessoire.add(point);
    p.groupe.updateMatrixWorld(true);
    return point.getWorldPosition(new Vector3());
  };
  const perso = () => creerPersonnage({ couleur: 0xffd23f, largeur: 0.8, hauteur: 0.8 });

  it("au repos, son origine est celle du personnage (bas-milieu de la boîte) : rien ne bouge, rien ne se voit", () => {
    const p = perso();
    p.poser({ look: restLook() });
    const w = monde(p, 0.1, 0.7);
    expect(w.x).toBeCloseTo(0.1, 6);
    expect(w.y).toBeCloseTo(0.7, 6);
    expect(p.groupe.children[0]!.children).toHaveLength(3); // les pieds : le corps et deux pieds (l'accroche est dans le corps)
  });

  it("il suit l'écrasement (ancré en bas) : écrasé, un point haut descend et s'élargit ; étiré, il monte", () => {
    const p = perso();
    const look = { ...restLook(), squash: 0.3 };
    p.poser({ look });
    const { sx, sy } = squashScale(0.3);
    const w = monde(p, 0.2, 0.7);
    expect(w.y).toBeCloseTo(0.7 * sy, 6);
    expect(w.x).toBeCloseTo(0.2 * sx, 6);
    expect(w.y).toBeLessThan(0.7);
    const q = perso();
    q.poser({ look: { ...restLook(), squash: -0.25 } });
    expect(monde(q, 0, 0.7).y).toBeGreaterThan(0.7);
  });

  it("il suit le penché (autour du bas du corps), le rebond et la respiration", () => {
    const p = perso();
    p.poser({ look: { ...restLook(), lean: 0.2 } });
    const w = monde(p, 0, 0.7); // le penché est `-lean` autour du bas du corps, à STEP.leg du bas
    const dy = 0.7 - STEP.leg;
    expect(w.x).toBeCloseTo(dy * Math.sin(0.2), 6);
    expect(w.y).toBeCloseTo(STEP.leg + dy * Math.cos(0.2), 6);
    const r = perso();
    r.poser({ look: { ...restLook(), bob: 0.05 } });
    expect(monde(r, 0, 0.7).y).toBeCloseTo(0.75, 6);
    const s = perso();
    s.poser({ look: { ...restLook(), breath: 1.1 } });
    expect(monde(s, 0, 0.7).y).toBeCloseTo(STEP.leg + (0.7 - STEP.leg) * 1.1, 6);
  });

  it("il suit le retournement que le jeu donne au personnage (la tête en bas) et son déplacement", () => {
    const p = perso();
    p.groupe.position.set(5, -3, 0);
    p.groupe.scale.y = -1;
    p.poser({ look: restLook() });
    const w = monde(p, 0.1, 0.7);
    expect(w.x).toBeCloseTo(5.1, 6);
    expect(w.y).toBeCloseTo(-3.7, 6); // le point haut est maintenant sous le personnage
  });
});
