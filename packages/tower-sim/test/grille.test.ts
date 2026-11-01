import { beforeAll, describe, expect, it } from "vitest";
import {
  boites,
  boitesE,
  type Cadre,
  cadreDe,
  COMMANDE,
  DECALAGES_SECOURS,
  departGauche8,
  type PieceKind,
  PIECE_KINDS,
  Partie,
  pivoter,
  type Rapier,
  ROTATION_SECOURS,
  type Scenario,
  type Taille,
} from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T6 — la grille de la pièce active (simulation 4) : les bords restent sur la grille des demi-cases quelle que soit la forme et le quart de tour ; le quart de tour pivote autour d'un point de la
// grille ; un quart de tour refusé essaie un décalage de secours (gauche, droite, haut) avant de refuser — débrayable.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const TAILLES: Taille[] = ["normale", "petite", "geante"];
const mod4 = (v: number): number => ((Math.round(v) % 4) + 4) % 4;

const actif = (p: Partie) => p.vue().pieces[p.vue().active]!;

/** Les bords gauche et droit (huitièmes de mètre) de la pièce en main. */
function bords8(p: Partie): { gauche: number; droite: number; bas: number; haut: number; y: number } {
  const v = p.vue();
  const a = v.pieces[v.active]!;
  const c = cadreDe(boitesE(a.kind, a.rot, a.taille, p.taillesDEssai));
  return { gauche: a.x * 8 + c.gauche, droite: a.x * 8 + c.droite, bas: a.y * 8 + c.bas, haut: a.y * 8 + c.haut, y: a.y };
}

/** Une pièce `kind` de taille `taille` qui vient de naître, sur une plateforme de 7 m (une petite ou une géante naît par l'effet de palier : on la fait naître par un scénario de départ simple). */
function pieceDe(kind: PieceKind, taille: Taille, extra: Partial<Scenario> = {}, options: ConstructorParameters<typeof Partie>[3] = {}): Partie {
  const effet = taille === "petite" ? "petite" : taille === "geante" ? "geante" : null;
  // Un palier à 1 mm : franchi par la tour de départ (une pièce posée d'avance, 1 m de haut), l'effet est celui de la première pièce jouée.
  const sc: Scenario = effet
    ? { nom: "grille", pieces: [kind], plateformeDemi8: 28, depart: [{ kind: "O", rot: 0, x8: 0, y8: 8 }], paliers: [{ metres: 1, effet }], ...extra }
    : { nom: "grille", pieces: [kind], plateformeDemi8: 28, ...extra };
  return new Partie(R, sc, undefined, options);
}

describe("la pièce naît sur la grille, centrée", () => {
  it("chaque forme, chaque taille : ses bords gauche et droit sont sur la grille des demi-cases et la boîte englobante est centrée sur l'axe à une demi-case près", () => {
    for (const taille of TAILLES) {
      for (const kind of PIECE_KINDS) {
        const p = pieceDe(kind, taille);
        const b = bords8(p);
        expect(mod4(b.gauche), `${kind} ${taille} gauche`).toBe(0);
        expect(mod4(b.droite), `${kind} ${taille} droite`).toBe(0);
        expect(Math.abs(b.gauche + b.droite)).toBeLessThanOrEqual(4);
        p.dispose();
      }
    }
  });
});

describe("chaque forme et chaque quart de tour garde ses bords sur la grille", () => {
  it("pour les 7 formes × 3 tailles × 4 quarts de tour, quel que soit l'enchaînement de déplacements et de quarts de tour (hors vent)", () => {
    for (const taille of TAILLES) {
      for (const kind of PIECE_KINDS) {
        const p = pieceDe(kind, taille);
        const ordres = [COMMANDE.TOURNER, COMMANDE.GAUCHE, COMMANDE.TOURNER, COMMANDE.DROITE, COMMANDE.DROITE, COMMANDE.TOURNER, COMMANDE.GAUCHE, COMMANDE.TOURNER, COMMANDE.TOURNER | COMMANDE.GAUCHE, COMMANDE.DROITE];
        for (const c of ordres) {
          p.avancer(c);
          const b = bords8(p);
          const rot = p.vue().pieces[0]!.rot;
          expect(mod4(b.gauche), `${kind} ${taille} rot ${rot} gauche`).toBe(0);
          expect(mod4(b.droite), `${kind} ${taille} rot ${rot} droite`).toBe(0);
        }
        p.dispose();
      }
    }
  });

  it("un déplacement d'une demi-case déplace la boîte englobante d'exactement une demi-case, pour toutes les formes et tous les quarts de tour", () => {
    for (const kind of PIECE_KINDS) {
      for (let rot = 0; rot < 4; rot++) {
        const p = pieceDe(kind, "normale");
        for (let k = 0; k < rot; k++) p.avancer(COMMANDE.TOURNER);
        const avant = bords8(p).gauche;
        p.avancer(COMMANDE.DROITE);
        expect(bords8(p).gauche - avant, `${kind} ${rot}`).toBe(4);
        p.avancer(COMMANDE.GAUCHE);
        p.avancer(COMMANDE.GAUCHE);
        expect(bords8(p).gauche - avant, `${kind} ${rot}`).toBe(-4);
        p.dispose();
      }
    }
  });

  it("version 3 (pour mémoire, le relevé de Nathan) : le T couché a ses bords à un quart de case de la grille et aucun déplacement d'une demi-case ne les y ramène", () => {
    for (const rot of [1, 3]) {
      const p = pieceDe("T", "normale", {}, { version: 3 });
      for (let k = 0; k < rot; k++) p.avancer(COMMANDE.TOURNER);
      expect(mod4(bords8(p).gauche)).toBe(2);
      p.avancer(COMMANDE.DROITE);
      p.avancer(COMMANDE.DROITE);
      expect(mod4(bords8(p).gauche)).toBe(2);
      p.dispose();
    }
    // Les autres formes, elles, restent sur la grille en version 3 (le défaut était propre au T).
    for (const kind of PIECE_KINDS.filter((k) => k !== "T")) {
      for (let rot = 0; rot < 4; rot++) {
        const p = pieceDe(kind, "normale", {}, { version: 3 });
        for (let k = 0; k < rot; k++) p.avancer(COMMANDE.TOURNER);
        expect(mod4(bords8(p).gauche), `${kind} ${rot}`).toBe(0);
        p.dispose();
      }
    }
  });
});

describe("le pivot : le quart de tour se fait autour d'un point de la grille", () => {
  const cadre = (kind: PieceKind, rot: number): Cadre => cadreDe(boites(kind, rot));

  it("le centre de la boîte englobante ne bouge pas (en abscisse et en hauteur) pour toutes les formes de taille normale", () => {
    for (const kind of PIECE_KINDS) {
      for (let rot = 0; rot < 4; rot++) {
        const a = cadre(kind, rot);
        const b = cadre(kind, (rot + 3) & 3); // le quart de tour dans le sens des aiguilles d'une montre
        const bas = 100.5; // une hauteur quelconque (huitièmes)
        const r = pivoter(a, b, -24, bas);
        const L = a.droite - a.gauche;
        const Lp = b.droite - b.gauche;
        expect(r.gauche8 + Lp / 2, `${kind} ${rot} centre x`).toBe(-24 + L / 2);
        expect(r.bas8 + (b.haut - b.bas) / 2, `${kind} ${rot} centre y`).toBeCloseTo(bas + (a.haut - a.bas) / 2, 9);
        expect(mod4(r.gauche8), `${kind} ${rot} gauche sur la grille`).toBe(0);
      }
    }
  });

  it("quatre quarts de tour ramènent la pièce où elle était (formes de taille normale)", () => {
    for (const kind of PIECE_KINDS) {
      const p = pieceDe(kind, "normale");
      const avant = bords8(p);
      for (let k = 0; k < 4; k++) p.avancer(COMMANDE.TOURNER);
      const apres = bords8(p);
      expect(apres.gauche, kind).toBe(avant.gauche);
      expect(apres.droite, kind).toBe(avant.droite);
      expect(p.vue().pieces[0]!.rot, kind).toBe(0);
      p.dispose();
    }
  });

  it("une petite pièce (largeurs multiples de 4 huitièmes) pivote sur la grille en arrondissant vers la gauche", () => {
    const a = cadreDe(boites("I", 0, "petite")); // 16 huitièmes de large, 4 de haut
    const b = cadreDe(boites("I", 3, "petite"));
    expect(a.droite - a.gauche).toBe(16);
    expect(b.droite - b.gauche).toBe(4);
    const r = pivoter(a, b, 0, 0);
    expect(r.gauche8).toBe(4 * Math.floor((16 - 4) / 8)); // 4 : le demi-pas de 6 est arrondi vers la gauche
    expect(mod4(r.gauche8)).toBe(0);
  });

  it("le départ : le bord gauche d'une pièce qui naît est sur la grille et la boîte est centrée", () => {
    for (const kind of PIECE_KINDS) {
      const c = cadreDe(boites(kind, 0));
      const g = departGauche8(c);
      expect(mod4(g)).toBe(0);
      expect(g + (c.droite - c.gauche) / 2).toBe(0); // taille normale : exactement centrée
    }
  });
});

describe("le décalage de secours d'un quart de tour refusé", () => {
  /** Un I horizontal descend jusqu'à ce que, tourné, il morde un obstacle de `chevauche` mètres ; rend la partie juste avant le quart de tour, et la position (bord gauche, hauteur du bas). */
  function avantLeQuartDeTour(obstacle: { x8: number; y8: number } | null, options: ConstructorParameters<typeof Partie>[3] = {}): { p: Partie; haut: number } {
    const sc: Scenario = { nom: "secours", pieces: ["I"], plateformeDemi8: 28, ...(obstacle ? { depart: [{ kind: "O", rot: 0, x8: obstacle.x8, y8: obstacle.y8 }] } : {}) };
    const p = new Partie(R, sc, undefined, options);
    const haut = obstacle ? obstacle.y8 / 8 + 1 : 0; // le dessus de l'obstacle (le niveau de la plateforme sans obstacle)
    // La pièce descend (2,5 m/s) jusqu'à ce que le bas du I tourné soit 0,1 à 0,3 m sous le dessus de l'obstacle : y − 2 ≤ haut − 0,1.
    for (let t = 0; t < 2000 && actif(p).y - 2 > haut - 0.1; t++) p.avancer(0);
    const y = actif(p).y;
    expect(y - 2).toBeLessThan(haut - 0.09);
    expect(y - 2).toBeGreaterThan(haut - 0.3);
    return { p, haut };
  }
  // L'obstacle est un carré posé d'avance (endormi, jamais réveillé : la pièce en main n'a aucun contact). Le I naît centré (x ∈ [−2 m ; 2 m]) ; tourné, il occupe x ∈ [−0,5 ; 0,5].
  const Y_OBSTACLE = 40; // le dessus de l'obstacle à 6 m : sous le I qui naît à ≥ 7 m au-dessus de lui

  it("l'ordre est fixe : une demi-case à gauche, puis à droite, puis vers le haut (et c'est la constante qui le dit)", () => {
    expect(DECALAGES_SECOURS).toEqual([[-1, 0], [1, 0], [0, 1]]);
    expect(ROTATION_SECOURS).toBe(true);
  });

  it("le quart de tour au centre est refusé : le premier essai, à gauche, est accepté", () => {
    const { p } = avantLeQuartDeTour({ x8: 8, y8: Y_OBSTACLE - 8 }); // O sur x ∈ [0 ; 2 m]
    const avant = bords8(p);
    expect(avant.gauche).toBe(-16);
    p.avancer(COMMANDE.TOURNER);
    const apres = bords8(p);
    expect(actif(p).rot).toBe(3);
    expect(apres.gauche).toBe(-4 - 4); // le centre (−4 …) décalé d'une demi-case à gauche : x ∈ [−1 ; 0]
    expect(mod4(apres.gauche)).toBe(0);
    p.dispose();
  });

  it("à gauche aussi refusé : le second essai, à droite, est accepté", () => {
    const { p } = avantLeQuartDeTour({ x8: -8, y8: Y_OBSTACLE - 8 }); // O sur x ∈ [−2 m ; 0]
    p.avancer(COMMANDE.TOURNER);
    expect(actif(p).rot).toBe(3);
    expect(bords8(p).gauche).toBe(-4 + 4); // x ∈ [0 ; 1 m]
    p.dispose();
  });

  it("à gauche et à droite aussi refusés : le troisième essai, vers le haut d'une demi-case, est accepté", () => {
    const { p } = avantLeQuartDeTour({ x8: 0, y8: Y_OBSTACLE - 8 }); // O sur x ∈ [−1 m ; 1 m]
    const yAvant = actif(p).y;
    const hautAvant = bords8(p).bas;
    p.avancer(COMMANDE.TOURNER);
    expect(actif(p).rot).toBe(3);
    expect(bords8(p).gauche).toBe(-4); // la colonne du pivot
    expect(bords8(p).bas).toBeCloseTo(hautAvant - 12 + 4 - 0.0, 0); // le bas du I tourné : 1,5 m plus bas que le bas du I couché, relevé d'une demi-case
    expect(actif(p).y).toBeGreaterThan(yAvant - 2); // elle n'est pas redescendue de plus que la chute d'un tick
    p.dispose();
  });

  it("refusé pour de bon près du sol : aucun des quatre essais ne passe, la pièce reste couchée", () => {
    const p = new Partie(R, { nom: "sol", pieces: ["I"], plateformeDemi8: 28 });
    for (let t = 0; t < 2000 && actif(p).y > 1.0; t++) p.avancer(0); // le bas du I couché à 0,5 m de la plateforme
    p.avancer(COMMANDE.TOURNER);
    expect(actif(p).rot).toBe(0);
    expect(bords8(p).gauche).toBe(-16);
    p.dispose();
  });

  it("le décalage est débrayable : sans lui, le quart de tour qui mord l'obstacle est refusé net", () => {
    const { p } = avantLeQuartDeTour({ x8: 8, y8: Y_OBSTACLE - 8 }, { secoursRotation: false });
    p.avancer(COMMANDE.TOURNER);
    expect(actif(p).rot).toBe(0);
    expect(bords8(p).gauche).toBe(-16);
    p.dispose();
  });
});
