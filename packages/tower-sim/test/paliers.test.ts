import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, DUREE_EFFET, EFFETS, type Effet, estBonus, FIGEE_TICKS, FROTTEMENT_GLISSANT, Partie, type PieceKind, problemePaliers, type Rapier, type Scenario, scenarioPaliers, TOUR_DEPART, VENT_PERIODE_TICKS, HAUTEUR_TOUR_DEPART_MM } from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T2 — les paliers : la règle de déclenchement, puis UN test par effet (lierre, pièce figée, petite, géante, coup de vent, glissante). Node seulement (règle R13).
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const PREMIERE = TOUR_DEPART.length; // l'id de la première pièce jouée (la tour de départ en a pris les premiers)

/** La tour de départ, puis `pieces` ; un seul palier à 10 m (ou ceux donnés). */
const scenario = (pieces: string, paliers: Scenario["paliers"], extra: Partial<Scenario> = {}): Scenario => ({
  nom: "essai-paliers",
  pieces: [...pieces] as PieceKind[],
  plateformeDemi8: 28,
  depart: TOUR_DEPART,
  paliers,
  ventSens: 1,
  ...extra,
});

/** Avance, avec `cmd(id, k)` (k = ticks depuis que la pièce `id` est en main), jusqu'à ce que `cond` soit vraie. */
function jusqua(p: Partie, cond: () => boolean, cmd: (id: number, k: number) => number = () => COMMANDE.DESCENDRE, max = 6000): number {
  let id = -1;
  let k = 0;
  while (!cond() && p.etape !== "fini" && p.tick < max) {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
    }
    p.avancer(cmd(id, k++));
  }
  expect(cond()).toBe(true);
  return p.tick;
}
const reposer = (p: Partie, n = 300): void => {
  for (let i = 0; i < n && p.etape === "jeu"; i++) p.avancer(0);
};
const piece = (p: Partie, id: number) => p.vue().pieces.find((x) => x.id === id)!;

describe("les paliers : le déclenchement", () => {
  it("la tour de départ est à 9 m : rien ne se déclenche avant la première pièce posée, le prochain palier est celui de 10 m", () => {
    const p = new Partie(R, scenario("OOOOOO", [{ metres: 10, effet: "lierre" }, { metres: 20, effet: "geante" }]));
    for (let i = 0; i < 3; i++) p.avancer(0);
    const v = p.vue();
    expect(v.hauteurMm).toBeGreaterThan(HAUTEUR_TOUR_DEPART_MM - 50);
    expect(v.hauteurMm).toBeLessThan(10_000);
    expect(v.declenches).toBe(0);
    expect(v.palier).toEqual({ metres: 10, effet: "lierre", bonus: true });
    p.dispose();
  });

  it("la hauteur stable franchit 10 m : le palier se déclenche une fois, l'annonce nomme l'effet, le suivant est le palier de 20 m", () => {
    const p = new Partie(R, scenario("OOOOOOO", [{ metres: 10, effet: "lierre" }, { metres: 20, effet: "geante" }]));
    jusqua(p, () => p.vue().declenches === 1);
    const v = p.vue();
    expect(v.hauteurMm).toBeGreaterThanOrEqual(10_000);
    expect(v.dernierEffet).toBe("lierre");
    expect(v.palier).toEqual({ metres: 20, effet: "geante", bonus: false });
    p.dispose();
  });

  it("l'effet s'applique à la pièce qui naît APRÈS le franchissement (celle de la plaque « Suivante »), pas à celle qui tombe déjà, et à elle seule", () => {
    const p = new Partie(R, scenario("OOOOOOOO", [{ metres: 10, effet: "petite" }]));
    jusqua(p, () => p.vue().declenches === 1);
    expect(p.vue().active).toBe(PREMIERE + 1);
    expect(piece(p, PREMIERE + 1).effet).toBeNull(); // déjà en main
    jusqua(p, () => p.vue().pieces.length === PREMIERE + 3);
    expect(piece(p, PREMIERE + 2).effet).toBe("petite");
    jusqua(p, () => p.vue().pieces.length === PREMIERE + 4);
    expect(piece(p, PREMIERE + 3).effet).toBeNull();
    p.dispose();
  });

  it("deux paliers franchis d'un coup s'appliquent dans l'ordre, l'un après l'autre : le coup de vent (trois pièces) finit avant que le suivant commence", () => {
    // 11 carrés = 22 m : au premier tick la hauteur a déjà franchi 10 m et 20 m.
    const tour = Array.from({ length: 11 }, (_, i) => ({ kind: "O" as const, rot: 0, x8: 0, y8: 8 + 16 * i }));
    const p = new Partie(R, scenario("OOOOOOOOO", [{ metres: 10, effet: "vent" }, { metres: 20, effet: "petite" }], { depart: tour }));
    p.avancer(0);
    expect(p.vue().declenches).toBe(2);
    expect(p.vue().dernierEffet).toBe("petite");
    const premiere = tour.length;
    expect(piece(p, premiere).effet).toBeNull(); // née avant le franchissement
    jusqua(p, () => p.vue().pieces.length === premiere + 5, () => COMMANDE.DESCENDRE, 20_000);
    expect([1, 2, 3, 4].map((i) => piece(p, premiere + i).effet)).toEqual(["vent", "vent", "vent", "petite"]);
    p.dispose();
  });

  it("les effets sont rangés en bonus et malus comme le seed le dit, et un effet couvre une pièce (le coup de vent, trois)", () => {
    expect(EFFETS.filter(estBonus).sort()).toEqual(["figee", "lierre", "petite"]);
    expect(EFFETS.filter((e) => !estBonus(e)).sort()).toEqual(["geante", "glissante", "vent"]);
    expect(DUREE_EFFET).toEqual({ lierre: 1, figee: 1, petite: 1, geante: 1, vent: 3, glissante: 1 });
    expect(problemePaliers(["lierre", "geante", "figee", "vent", "petite", "glissante"])).toBeNull();
    expect(problemePaliers(["geante", "lierre"])).toMatch(/premier palier/);
    expect(problemePaliers(["lierre", "geante", "vent"])).toMatch(/deux malus/);
    expect(problemePaliers(["lierre", "geante", "lierre"])).toMatch(/revient/);
    expect(problemePaliers(["lierre", "geante", "figee", "vent", "petite", "glissante", "figee"])).toBeNull(); // un deuxième cycle recommence
  });
});

/** Le scénario des trois effets de forme : un carré qui franchit 10 m, un carré, puis un bâton (l'id PREMIERE + 2) posé au centre. */
const FORME = (effet: Effet | null): Scenario => scenario("OOIOOO", effet ? [{ metres: 10, effet }] : []);
/** Joue ce scénario jusqu'à ce que le bâton ait reposé sur le carré qui est dessous ; rend la partie. */
function posePieceEffet(effet: Effet | null, cmd?: (id: number, k: number) => number): Partie {
  const p = new Partie(R, FORME(effet));
  jusqua(p, () => p.vue().pieces.length >= PREMIERE + 4, cmd);
  reposer(p, 240);
  return p;
}
/** À quelle hauteur de son support (le dessus du carré posé juste avant) le centre de la pièce `id` repose-t-il ? */
const hauteurSurSupport = (p: Partie, id: number): number => piece(p, id).y - (piece(p, id - 1).y + 1);

describe("chaque effet", () => {
  it("petite pièce : la pièce suivante est de demi-taille (des huitièmes entiers), pose-la : son centre est à la moitié de la hauteur d'un bâton normal", () => {
    const normal = posePieceEffet(null);
    const petite = posePieceEffet("petite");
    expect(piece(petite, PREMIERE + 2).taille).toBe("petite");
    expect(piece(normal, PREMIERE + 2).taille).toBe("normale");
    expect(hauteurSurSupport(normal, PREMIERE + 2)).toBeCloseTo(0.5, 1); // un bâton couché fait 1 m de haut
    expect(hauteurSurSupport(petite, PREMIERE + 2)).toBeCloseTo(0.25, 1); // la moitié
    expect(piece(petite, PREMIERE + 3).taille).toBe("normale");
    normal.dispose();
    petite.dispose();
  });

  it("pièce géante : la pièce suivante est de double taille, pose-la : son centre est à deux fois la hauteur d'un bâton normal", () => {
    const geante = posePieceEffet("geante");
    expect(piece(geante, PREMIERE + 2).taille).toBe("geante");
    expect(hauteurSurSupport(geante, PREMIERE + 2)).toBeCloseTo(1, 1);
    expect(piece(geante, PREMIERE + 3).taille).toBe("normale");
    geante.dispose();
  });

  it("pièce glissante : la pièce suivante a un frottement très faible (règle « minimum »), les autres gardent le frottement normal", () => {
    const p = new Partie(R, FORME("glissante"));
    jusqua(p, () => p.vue().pieces.length >= PREMIERE + 3);
    expect(piece(p, PREMIERE + 2).effet).toBe("glissante");
    const glissante = p.frottementDe(PREMIERE + 2)!;
    expect(glissante.valeur).toBeCloseTo(FROTTEMENT_GLISSANT, 6); // Rapier garde le frottement en flottant 32 bits
    expect(glissante.min).toBe(true);
    const normale = p.frottementDe(PREMIERE + 1)!;
    expect(normale.valeur).toBeCloseTo(0.6, 6);
    expect(normale.min).toBe(false);
    p.dispose();
  });

  it("coup de vent : la pièce active dérive d'un huitième de mètre tous les 10 ticks, dans le sens du jour, pendant trois pièces ; lâchée, elle ne dérive plus", () => {
    for (const sens of [1, -1] as const) {
      const p = new Partie(R, scenario("OOOOOOO", [{ metres: 10, effet: "vent" }], { ventSens: sens }));
      jusqua(p, () => p.vue().active === PREMIERE + 2);
      const x0 = piece(p, PREMIERE + 2).x;
      for (let i = 0; i < VENT_PERIODE_TICKS * 6; i++) p.avancer(0);
      expect(piece(p, PREMIERE + 2).x - x0).toBeCloseTo((sens * 6) / 8, 10); // exact : six poussées d'un huitième
      // Trois pièces de suite, la quatrième n'est plus concernée.
      jusqua(p, () => p.vue().pieces.length === PREMIERE + 6);
      expect([2, 3, 4, 5].map((i) => piece(p, PREMIERE + i).effet)).toEqual(["vent", "vent", "vent", null]);
      p.dispose();
    }
  });

  it("coup de vent : les ordres du joueur s'ajoutent à la poussée, qui ne traverse pas une pièce", () => {
    const p = new Partie(R, scenario("OOOOOOO", [{ metres: 10, effet: "vent" }]));
    jusqua(p, () => p.vue().active === PREMIERE + 2);
    const x0 = piece(p, PREMIERE + 2).x;
    for (let i = 0; i < VENT_PERIODE_TICKS; i++) p.avancer(i === 0 ? COMMANDE.GAUCHE : 0);
    expect(piece(p, PREMIERE + 2).x - x0).toBeCloseTo(-0.5 + 0.125, 10);
    p.dispose();
  });

  it("pièce figée : elle devient un corps fixe AU CONTACT (quelques ticks après le lâcher), plus rien ne la déplace, ce qu'on pose dessus repose dessus", () => {
    const p = new Partie(R, FORME("figee"));
    let lache = -1;
    let fige = -1;
    jusqua(p, () => {
      const q = p.vue().pieces.find((x) => x.id === PREMIERE + 2);
      if (q && q.etat === "libre" && lache < 0) lache = p.tick;
      if (q?.fixe && fige < 0) fige = p.tick;
      return fige >= 0;
    });
    expect(piece(p, PREMIERE + 2).effet).toBe("figee");
    expect(fige - lache).toBeLessThanOrEqual(4); // au contact, pas deux secondes plus tard
    expect(fige - lache).toBeLessThan(FIGEE_TICKS);
    const avant = { x: piece(p, PREMIERE + 2).x, y: piece(p, PREMIERE + 2).y, angle: piece(p, PREMIERE + 2).angle };
    jusqua(p, () => p.vue().pieces.length >= PREMIERE + 6); // d'autres pièces tombent dessus
    reposer(p, 240);
    const apres = piece(p, PREMIERE + 2);
    expect({ x: apres.x, y: apres.y, angle: apres.angle }).toEqual(avant); // pas un bit de différence
    expect(apres.fixe).toBe(true);
    expect(apres.endormie).toBe(true);
    expect(piece(p, PREMIERE + 3).fixe).toBe(false);
    p.dispose();
  });

  it("pièce figée : en porte-à-faux elle reste là où elle a touché, quitte à flotter ; la même pièce sans effet bascule et tombe", () => {
    const cmd = (id: number, k: number): number => {
      let c = COMMANDE.DESCENDRE;
      if (id === PREMIERE + 1 && k < 40 && k % 2 === 0) c |= COMMANDE.GAUCHE; // le carré de remplissage part au loin
      if (id === PREMIERE + 2 && k < 12 && k % 2 === 0) c |= COMMANDE.DROITE; // le bâton : le centre de masse dépasse du support
      return c;
    };
    const sans = new Partie(R, FORME(null));
    const figee = new Partie(R, FORME("figee"));
    for (const p of [sans, figee]) {
      jusqua(p, () => p.vue().active >= PREMIERE + 3, cmd);
      reposer(p, 240);
    }
    expect(piece(sans, PREMIERE + 2).etat).toBe("perdue");
    expect(piece(figee, PREMIERE + 2).etat).toBe("libre");
    expect(piece(figee, PREMIERE + 2).fixe).toBe(true);
    expect(Math.abs(piece(figee, PREMIERE + 2).angle)).toBeLessThan(0.01); // elle n'a pas pivoté : figée à plat, là où elle a touché
    sans.dispose();
    figee.dispose();
  });

  it("lierre : la pièce suivante se soude, à son premier contact, aux corps qu'elle touche ; une pièce en porte-à-faux qui tombe sans lierre reste accrochée avec lui", () => {
    // Le bâton (PREMIERE + 2) est posé à 2 m du centre de la tour : son centre de masse dépasse du carré qui le porte, il bascule — sauf s'il est soudé (l'ensemble reste alors en équilibre sur le bâton de départ).
    const cmd = (id: number, k: number): number => {
      let c = COMMANDE.DESCENDRE;
      if (id === PREMIERE + 1 && k < 40 && k % 2 === 0) c |= COMMANDE.GAUCHE; // le carré de remplissage part au loin (il tombe à la mer)
      if (id === PREMIERE + 2 && k < 8 && k % 2 === 0) c |= COMMANDE.DROITE;
      return c;
    };
    const sans = new Partie(R, FORME(null));
    const avec = new Partie(R, FORME("lierre"));
    for (const p of [sans, avec]) {
      jusqua(p, () => p.vue().active >= PREMIERE + 3, cmd);
      reposer(p, 240);
    }
    expect(piece(avec, PREMIERE + 2).effet).toBe("lierre");
    expect(piece(avec, PREMIERE + 2).soudee).toBe(true);
    expect(piece(avec, PREMIERE + 2).etat).toBe("libre");
    expect(piece(sans, PREMIERE + 2).etat).toBe("perdue"); // sans lierre : tombé
    expect(piece(avec, PREMIERE + 3).soudee).toBe(false); // un effet = une pièce
    sans.dispose();
    avec.dispose();
  });

  it("lierre : la soudure se fait au PREMIER contact, quelques ticks après le lâcher", () => {
    const p = new Partie(R, FORME("lierre"));
    let lache = -1;
    let soude = -1;
    jusqua(p, () => {
      const q = p.vue().pieces.find((x) => x.id === PREMIERE + 2);
      if (q && q.etat === "libre" && lache < 0) lache = p.tick;
      if (q?.soudee && soude < 0) soude = p.tick;
      return soude >= 0;
    });
    expect(soude - lache).toBeLessThanOrEqual(4);
    p.dispose();
  });

  it("lierre : la pièce n'est pas soudée tant qu'elle n'a rien touché", () => {
    const p = new Partie(R, FORME("lierre"));
    jusqua(p, () => p.vue().active === PREMIERE + 2);
    for (let i = 0; i < 20; i++) p.avancer(0);
    expect(piece(p, PREMIERE + 2).soudee).toBe(false);
    p.dispose();
  });
});

describe("le scénario des paliers (`?scenario=paliers&effet=…`)", () => {
  it("six effets, six scénarios : le premier palier est l'effet demandé, les cinq autres suivent, tous différents", () => {
    for (const e of EFFETS) {
      const s = scenarioPaliers(e);
      expect(s.paliers![0]).toEqual({ metres: 10, effet: e });
      expect(new Set(s.paliers!.map((x) => x.effet)).size).toBe(6);
      expect(s.paliers!.map((x) => x.metres)).toEqual([10, 20, 30, 40, 50, 60]);
      expect(s.nom).toBe(`paliers-${e}`);
    }
  });

  it("la tour de départ est à 9 m, endormie, et tient", () => {
    const p = new Partie(R, scenarioPaliers("vent"));
    for (let i = 0; i < 120; i++) p.avancer(0);
    expect(p.vue().hauteurMm).toBeGreaterThan(8950);
    expect(p.vue().hauteurMm).toBeLessThan(9050);
    expect(p.vue().declenches).toBe(0);
    p.dispose();
  });
});
