import { PIECE_KINDS, boites, boitesE, type Taille } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { BORD, colliderDe, couchesDe, interieur, LISERE, type Rect } from "../src/dessinPiece";

// Lot T6 — le dessin est égal au collider. Avant ce lot le trait d'encre dépassait la boîte de Rapier de 7 cm de chaque côté (deux pièces qui se touchaient se recouvraient à l'écran). Maintenant :
// l'encre est la forme physique elle-même, la couleur de la pièce et le liseré d'un effet sont EN RETRAIT, tout à l'intérieur. Vérifié « au pixel près à l'échelle de référence » : 20 pixels par mètre
// (la maquette : 390 px pour 19,5 m), en rastérisant le dessin et le collider.
const PX = 20;
const TAILLES: Taille[] = ["normale", "petite", "geante"];

/** Le pixel (centre en (px + 0,5) / PX) est-il dans l'un des rectangles ? */
const dans = (rs: readonly Rect[], x: number, y: number): boolean => rs.some((r) => Math.abs(x - r.cx) <= r.w / 2 + 1e-9 && Math.abs(y - r.cy) <= r.h / 2 + 1e-9);

/** Rastérise un ensemble de rectangles sur la grille de pixels de la zone [-5 ; 5]² : l'ensemble des pixels allumés. */
function trame(rs: readonly Rect[]): Set<string> {
  const out = new Set<string>();
  for (let i = -5 * PX; i < 5 * PX; i++) for (let j = -5 * PX; j < 5 * PX; j++) if (dans(rs, (i + 0.5) / PX, (j + 0.5) / PX)) out.add(`${i},${j}`);
  return out;
}

describe("le dessin d'une pièce est égal à son collider", () => {
  for (const taille of TAILLES) {
    for (const kind of PIECE_KINDS) {
      for (let rot = 0; rot < 4; rot++) {
        it(`${kind}, ${rot} quart(s) de tour, ${taille} : l'encre est exactement le collider, la couleur et le liseré sont à l'intérieur, au pixel près`, () => {
          const bs = boites(kind, rot, taille);
          const collider = trame(colliderDe(bs));
          const c = couchesDe(bs, true);
          const encre = trame(c.encre);
          // L'encre ET le collider : le même ensemble de pixels (aucun pixel d'encre hors de la forme physique, aucun pixel de la forme sans encre).
          expect(encre.size).toBe(collider.size);
          for (const p of collider) expect(encre.has(p), `pixel ${p} du collider sans encre`).toBe(true);
          // La couleur de la pièce et le liseré sont dans le collider : le trait d'encre ne déborde nulle part, ni le liseré.
          for (const p of trame(c.couleur)) expect(collider.has(p), `pixel ${p} de couleur hors du collider`).toBe(true);
          for (const p of trame(c.lisere)) expect(collider.has(p), `pixel ${p} de liseré hors du collider`).toBe(true);
          // Exactitude géométrique (pas seulement les pixels) : chaque rectangle de couleur ou de liseré est dans l'union des boîtes du collider (ses 4 coins le sont).
          const boitesM = colliderDe(bs);
          for (const r of [...c.couleur, ...c.lisere]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) expect(dans(boitesM, r.cx + (sx * r.w) / 2, r.cy + (sy * r.h) / 2), `coin d'un rectangle hors du collider`).toBe(true);
        });
      }
    }
  }

  it("avec les tailles d'essai de ?debug&tune (mises à l'échelle des arêtes) le dessin reste égal au collider", () => {
    for (const kind of PIECE_KINDS) {
      for (const [taille, echelles] of [["petite", { petite4: 3, geante4: 8 }], ["geante", { petite4: 2, geante4: 11 }]] as const) {
        const bs = boitesE(kind, 1, taille, echelles);
        const c = couchesDe(bs, true);
        const collider = trame(colliderDe(bs));
        expect(trame(c.encre).size).toBe(collider.size);
        for (const p of trame(c.couleur)) expect(collider.has(p)).toBe(true);
      }
    }
  });
});

describe("l'encre est un trait de BORD à l'intérieur de la forme, sans jour ni coutures", () => {
  it("un carré : la couleur est en retrait de BORD de chaque côté ; entre la couleur et le bord de la forme, il n'y a que de l'encre", () => {
    const bs = boites("O", 0);
    const [r] = couchesDe(bs, false).couleur;
    expect(r!.w).toBeCloseTo(2 - 2 * BORD, 9);
    expect(r!.h).toBeCloseTo(2 - 2 * BORD, 9);
  });

  it("une pièce de plusieurs boîtes n'a pas de couture d'encre à l'intérieur : la couleur d'un T couvre la jonction de la tête et de la queue", () => {
    const bs = boites("T", 0);
    const couleur = interieur(bs, BORD);
    // Sur l'arête partagée (la queue repose sur la tête, à y = 0,25 m du centre de masse), au milieu de la queue : de la couleur, pas de l'encre.
    const yJonction = (bs[0]!.cy + bs[0]!.hh) / 8;
    const xQueue = bs[1]!.cx / 8;
    expect(dans(couleur, xQueue, yJonction)).toBe(true);
    expect(dans(couleur, xQueue, yJonction + 0.03)).toBe(true);
    expect(dans(couleur, xQueue, yJonction - 0.03)).toBe(true);
    // Aux coins rentrants le trait tourne : le point de la tête collé contre le flanc de la queue, au ras de la jonction, est de l'encre.
    const flanc = bs[1]!.cx / 8 - bs[1]!.hw / 8;
    expect(dans(couleur, flanc + BORD / 2, yJonction - BORD / 2)).toBe(false);
    expect(dans(couleur, flanc - BORD / 2, yJonction - BORD / 2)).toBe(false);
  });

  it("deux pièces qui se touchent montrent un seul trait double : sur une ligne qui traverse deux carrés collés, la suite est couleur, encre (BORD), encre (BORD), couleur — sans recouvrement ni jour", () => {
    // Deux carrés de 2 m collés : A sur [−2 ; 0], B sur [0 ; 2], même hauteur. Une ligne horizontale à y = 0, échantillonnée au millimètre.
    const A = couchesDe(boites("O", 0), false);
    const decale = (rs: Rect[], dx: number): Rect[] => rs.map((r) => ({ ...r, cx: r.cx + dx }));
    const couches = [
      { encre: decale(A.encre, -1), couleur: decale(A.couleur, -1) },
      { encre: decale(A.encre, 1), couleur: decale(A.couleur, 1) },
    ];
    const suite: ("vide" | "encre" | "couleur")[] = [];
    for (let i = -2200; i <= 2200; i++) {
      const x = i / 1000;
      // Ordre de peinture : l'encre de chaque pièce, puis sa couleur par-dessus.
      let v: "vide" | "encre" | "couleur" = "vide";
      for (const c of couches) {
        if (dans(c.encre, x, 0)) v = "encre";
        if (dans(c.couleur, x, 0)) v = "couleur";
      }
      suite.push(v);
    }
    const runs: { v: string; n: number }[] = [];
    for (const v of suite) {
      const dernier = runs[runs.length - 1];
      if (dernier && dernier.v === v) dernier.n++;
      else runs.push({ v, n: 1 });
    }
    // vide, encre (le bord extérieur de A), couleur de A, UN seul trait double (le bord droit de A contre le bord gauche de B), couleur de B, encre (le bord extérieur de B), vide.
    expect(runs.map((r) => r.v)).toEqual(["vide", "encre", "couleur", "encre", "couleur", "encre", "vide"]);
    expect(Math.abs(runs[1]!.n - BORD * 1000)).toBeLessThanOrEqual(2);
    expect(Math.abs(runs[3]!.n - 2 * BORD * 1000)).toBeLessThanOrEqual(2); // le trait double : deux fois BORD, d'un seul tenant, sans recouvrement ni jour
    expect(Math.abs(runs[5]!.n - BORD * 1000)).toBeLessThanOrEqual(2);
  });

  it("le liseré d'un effet est entre l'encre et la couleur, à l'intérieur de la forme : son épaisseur est LISERE", () => {
    const bs = boites("O", 0);
    const c = couchesDe(bs, true);
    expect(c.lisere[0]!.w).toBeCloseTo(2 - 2 * BORD, 9);
    expect(c.couleur[0]!.w).toBeCloseTo(2 - 2 * (BORD + LISERE), 9);
  });
});
