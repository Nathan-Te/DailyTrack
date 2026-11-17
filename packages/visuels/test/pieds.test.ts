import { describe, expect, it } from "vitest";
import { Group, Vector3 } from "three";
import { STEP, STRIDE_TILES, animateLook, feetTarget, restLook, stridePhase, type Motion } from "../src/plateformes";
import { creerPersonnage } from "../src/plateformesThree";

// Lot PG2 — la règle des pieds : **le pied posé recule par rapport au corps, à l'opposé de la course** ; le pied levé revient vers l'avant ; la
// cadence suit la distance parcourue au sol ; le personnage retourné a ses pieds du côté de la surface.
const course = (vx: number): Motion => ({ vx, vyUp: 0, ground: true, slide: 0, runSpeed: 11, fallSpeed: 22 });
/** Le pied `i` (0 gauche, 1 droit) à une distance au sol donnée : x et hauteur. */
const pied = (vx: number, stride: number, i: 0 | 1) => {
  const f = feetTarget(course(vx), stride).feet;
  return { x: f[i * 2]!, y: f[i * 2 + 1]! };
};
const PAS = 0.01;

describe("pieds : le pied posé recule, le pied levé revient", () => {
  for (const vx of [11, 5.5, -11, -5.5]) {
    it(`en courant à ${vx} tuiles/s, au long d'un cycle`, () => {
      const sens = Math.sign(vx); // + : vers la droite
      let posé = 0;
      let levé = 0;
      for (let i = 0; i < 2; i++) {
        const base = i === 0 ? -STEP.footX : STEP.footX;
        for (let s = 0; s < 2 * STRIDE_TILES; s += PAS) {
          const a = pied(vx, s, i as 0 | 1);
          const b = pied(vx, s + PAS, i as 0 | 1);
          const dx = (b.x - a.x) * sens; // > 0 : le pied avance dans le sens de la course
          // posé = les deux instants à hauteur 0 ; levé = les deux au-dessus
          if (a.y === 0 && b.y === 0) {
            expect(dx, `pied ${i} posé à ${s.toFixed(2)}`).toBeLessThanOrEqual(1e-12); // il ne va jamais vers l'avant
            posé++;
          } else if (a.y > 0 && b.y > 0) {
            expect(dx, `pied ${i} levé à ${s.toFixed(2)}`).toBeGreaterThanOrEqual(-1e-12);
            levé++;
          }
          expect(Math.abs(a.x - base)).toBeLessThanOrEqual(STEP.swing + 1e-9); // l'amplitude est celle d'avant
        }
      }
      expect(posé).toBeGreaterThan(100);
      expect(levé).toBeGreaterThan(100);
    });
  }

  it("le pied posé recule vraiment (de l'avant vers l'arrière) sur toute sa pose", () => {
    // pied gauche : posé quand la phase est dans [0,5 ; 1[ (sin < 0)
    const debut = pied(11, STEP.cycle * 0.5 + 0.001, 0);
    const fin = pied(11, STEP.cycle * 1 - 0.001, 0);
    expect(debut.y).toBe(0);
    expect(fin.y).toBe(0);
    expect(debut.x).toBeGreaterThan(fin.x); // course vers la droite : il part en avant, finit en arrière
    const debutG = pied(-11, STEP.cycle * 0.5 + 0.001, 0);
    const finG = pied(-11, STEP.cycle - 0.001, 0);
    expect(debutG.x).toBeLessThan(finG.x); // course vers la gauche : l'inverse
  });

  it("deux pieds en opposition : quand l'un est posé, l'autre est levé", () => {
    for (let s = 0.05; s < 2 * STRIDE_TILES; s += 0.05) {
      const a = pied(11, s, 0);
      const b = pied(11, s, 1);
      expect(a.y === 0 || b.y === 0).toBe(true);
    }
  });
});

describe("pieds : la cadence suit la vitesse au sol", () => {
  it("la phase ne dépend que de la distance : deux pas par `2 × STRIDE_TILES`, jamais du temps", () => {
    expect(stridePhase(2 * STRIDE_TILES)).toBeCloseTo(0, 9);
    expect(stridePhase(STRIDE_TILES / 2)).toBeCloseTo(0.25, 9);
    // à deux vitesses, la même distance donne la même pose (seule l'amplitude suit la vitesse) ; un pied posé reste posé
    expect(pied(11, 0.3, 0).y === 0).toBe(pied(5.5, 0.3, 0).y === 0);
  });

  it("à vitesse double, on fait deux fois plus de cycles par seconde (distance = vitesse × temps)", () => {
    const cyclesParSeconde = (v: number) => v / (2 * STRIDE_TILES);
    expect(cyclesParSeconde(11) / cyclesParSeconde(5.5)).toBeCloseTo(2, 9);
    // et animateLook ne fait avancer le cycle que par la distance donnée par le jeu : sans distance, aucun pas, même au fil des secondes
    let look = { ...restLook(), stride: 1 };
    for (let i = 0; i < 120; i++) look = animateLook(look, 1 / 60, course(11));
    expect(look.stride).toBe(1);
  });
});

describe("pieds : le personnage retourné a ses pieds du côté de la surface", () => {
  // Comme Gravity : le personnage est posé dans un pivot au centre de sa boîte, dont `scale.y = -1` retourne la boîte (la gravité inversée : on court au plafond).
  const H = 1.2;
  const monter = () => {
    const p = creerPersonnage({ couleur: 0xffd23f, largeur: 0.8, hauteur: H });
    const pivot = new Group();
    p.groupe.position.y = -H / 2;
    pivot.add(p.groupe);
    return { p, pivot, pieds: p.groupe.children[0]!.children.slice(1) };
  };
  it("debout, les pieds sont au bas de la boîte ; retourné, au haut (du côté de la surface), image miroir exacte", () => {
    const { p, pivot, pieds } = monter();
    p.poser({ look: restLook() });
    const debout = new Vector3();
    const retourne = new Vector3();
    pivot.updateMatrixWorld(true);
    pieds[0]!.getWorldPosition(debout);
    expect(debout.y).toBeLessThan(-H / 2 + 0.1); // la moitié basse de la boîte
    pivot.scale.y = -1;
    pivot.updateMatrixWorld(true);
    pieds[0]!.getWorldPosition(retourne);
    expect(retourne.y).toBeGreaterThan(H / 2 - 0.1); // la moitié haute
    expect(retourne.y + debout.y).toBeCloseTo(0, 9);
  });

  it("en course, le pied posé recule aussi retourné : le retournement ne change que la hauteur", () => {
    const { p, pivot, pieds } = monter();
    const look = animateLook({ ...restLook(), stride: STEP.cycle * 0.75 }, 1 / 60, course(11));
    p.poser({ look });
    const a = new Vector3();
    const b = new Vector3();
    pivot.updateMatrixWorld(true);
    pieds[0]!.getWorldPosition(a);
    pivot.scale.y = -1;
    pivot.updateMatrixWorld(true);
    pieds[0]!.getWorldPosition(b);
    expect(a.x).toBeCloseTo(b.x, 9);
  });
});
