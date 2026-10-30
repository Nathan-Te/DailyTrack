import { beforeAll, describe, expect, it } from "vitest";
import { type Scenario, COMMANDE, Partie, REGLAGES_DEFAUT, SCENARIO_ESSAI, STABILISATION_MAX_TICKS, TOWER_SIM_VERSION, empreinteVue, sommetPiece, type Rapier } from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T1 — la partie de Tower (src/) : chaque règle du lot, sur Rapier 2D déterministe, en Node. Aucun test de navigateur ici (règle R13) : l'unique parcours de joueur
// est `apps/tower/e2e/partie.spec.ts`.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const O = (n: number, demi8 = 28): Scenario => ({ nom: `${n} carrés`, pieces: Array.from({ length: n }, () => "O" as const), plateformeDemi8: demi8 });

/** Avance jusqu'à ce que `cond` soit vraie (au plus `max` ticks) avec les commandes `cmd(tick)`. */
function jusqua(p: Partie, cond: () => boolean, cmd: (k: number) => number = () => 0, max = 4000): number {
  let k = 0;
  while (!cond() && k < max) p.avancer(cmd(k++));
  return k;
}

/** Le numéro de la pièce en main change : on compte les ticks depuis son apparition (pour piloter chaque pièce de la même façon). */
function partieScriptee(p: Partie, script: (id: number, k: number) => number, max = 12000): { transitions: number[]; ticks: number } {
  const transitions: number[] = [];
  const vu = new Map<number, string>();
  let id = -1;
  let k = 0;
  let t = 0;
  while (p.etape !== "fini" && t < max) {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
    }
    p.avancer(v.active >= 0 ? script(v.active, k++) : 0);
    t++;
    for (const q of p.vue().pieces) {
      if (q.etat === "perdue" && vu.get(q.id) !== "perdue") transitions.push(q.id);
      vu.set(q.id, q.etat);
    }
  }
  return { transitions, ticks: t };
}

describe("la pièce active", () => {
  it("naît centrée au-dessus de la plateforme et tombe à vitesse constante", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    const v0 = p.vue();
    expect(v0.active).toBe(0);
    expect(v0.phase).toBe("jeu");
    expect(v0.suivante).toBe("O");
    expect(v0.pieces[0]!.y).toBeGreaterThan(7);
    const y0 = v0.pieces[0]!.y;
    for (let i = 0; i < 60; i++) p.avancer(0);
    const y1 = p.vue().pieces[0]!.y;
    expect(y0 - y1).toBeCloseTo(REGLAGES_DEFAUT.vitesseChute8 / 8, 1); // 2,5 m en 1 s
    for (let i = 0; i < 60; i++) p.avancer(0);
    expect(y1 - p.vue().pieces[0]!.y).toBeCloseTo(2.5, 1); // constante
    p.dispose();
  });

  it("descendre, tant que le bit est levé, multiplie la vitesse de chute ; relâché, elle revient à la normale", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    const y0 = p.vue().pieces[0]!.y;
    for (let i = 0; i < 30; i++) p.avancer(COMMANDE.DESCENDRE);
    const y1 = p.vue().pieces[0]!.y;
    expect(y0 - y1).toBeCloseTo((REGLAGES_DEFAUT.vitesseChute8 * REGLAGES_DEFAUT.facteurDescente) / 8 / 2, 1);
    for (let i = 0; i < 30; i++) p.avancer(0);
    expect(y1 - p.vue().pieces[0]!.y).toBeCloseTo(REGLAGES_DEFAUT.vitesseChute8 / 8 / 2, 1);
    p.dispose();
  });

  it("gauche et droite déplacent d'une demi-case par ordre, exactement", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    const x0 = p.vue().pieces[0]!.x;
    p.avancer(COMMANDE.GAUCHE);
    expect(p.vue().pieces[0]!.x).toBe(x0 - 0.5);
    p.avancer(COMMANDE.GAUCHE);
    p.avancer(0);
    expect(p.vue().pieces[0]!.x).toBe(x0 - 1);
    p.avancer(COMMANDE.DROITE);
    expect(p.vue().pieces[0]!.x).toBe(x0 - 0.5);
    p.avancer(COMMANDE.GAUCHE | COMMANDE.DROITE); // l'un annule l'autre
    expect(p.vue().pieces[0]!.x).toBe(x0 - 0.5);
    p.dispose();
  });

  it("tourner pivote d'un quart de tour (4 ordres = la forme de départ) et change la hauteur de la pièce", () => {
    const p = new Partie(R, { nom: "bâtons", pieces: ["I", "I"], plateformeDemi8: 28 });
    const haut = (): number => sommetPiece("I", p.vue().pieces[0]!.rot, p.vue().pieces[0]!.y, 0) - p.vue().pieces[0]!.y;
    expect(p.vue().pieces[0]!.rot).toBe(0);
    expect(haut()).toBeCloseTo(0.5, 5); // bâton couché : 1 m de haut
    p.avancer(COMMANDE.TOURNER);
    expect(p.vue().pieces[0]!.rot).toBe(3); // sens des aiguilles d'une montre
    expect(haut()).toBeCloseTo(2, 5); // debout : 4 m de haut, le centre de masse est au milieu
    for (let i = 0; i < 3; i++) p.avancer(COMMANDE.TOURNER);
    expect(p.vue().pieces[0]!.rot).toBe(0);
    p.dispose();
  });

  it("un quart de tour qui enfoncerait la pièce dans la plateforme est refusé", () => {
    const p = new Partie(R, { nom: "bâtons", pieces: ["I", "I"], plateformeDemi8: 28 });
    // On lâche le bâton couché jusqu'à ce que son centre soit à 1,2 m : 0,7 m au-dessus de la plateforme, pas encore en contact.
    jusqua(p, () => p.vue().pieces[0]!.y <= 1.2);
    expect(p.vue().active).toBe(0);
    p.avancer(COMMANDE.TOURNER); // debout, il descendrait à −1,3 m : refusé
    expect(p.vue().pieces[0]!.rot).toBe(0);
    p.dispose();
  });

  it("la pièce ne s'éloigne jamais de plus de 16 m de l'axe de la plateforme", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    for (let i = 0; i < 60; i++) p.avancer(COMMANDE.DROITE);
    expect(p.vue().pieces[0]!.x).toBeLessThanOrEqual(16);
    expect(p.vue().pieces[0]!.x).toBeGreaterThan(15);
    p.dispose();
  });
});

describe("la perte de la main", () => {
  it("au premier contact avec la plateforme la pièce lâche : elle devient un corps libre, la suivante apparaît, les ordres ne la concernent plus", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    jusqua(p, () => p.vue().active !== 0, () => COMMANDE.DESCENDRE);
    const v = p.vue();
    expect(v.active).toBe(1);
    expect(v.pieces[0]!.etat).toBe("libre");
    expect(v.posees).toBe(1);
    expect(v.numero).toBe(2);
    // Elle a lâché au contact, sans s'enfoncer : le T posé à plat a son centre de masse à 0,75 m (un rebond de 2 mm au plus).
    const x0 = v.pieces[0]!.x;
    for (let i = 0; i < 60; i++) p.avancer(0);
    expect(p.vue().pieces[0]!.y).toBeGreaterThan(0.74);
    expect(p.vue().pieces[0]!.y).toBeLessThan(0.76);
    // Les ordres suivants vont à la pièce 1 : la pièce 0 ne bouge pas de côté.
    for (let i = 0; i < 10; i++) p.avancer(COMMANDE.GAUCHE);
    const w = p.vue();
    expect(w.pieces[0]!.x).toBeCloseTo(x0, 1);
    expect(w.pieces[1]!.x).toBeCloseTo(-5, 5); // dix demi-cases à gauche : les ordres vont à la pièce active
    p.dispose();
  });

  it("la pièce qui touche une pièce posée lâche aussi, et la suivante naît au-dessus du point le plus haut de la tour", () => {
    const p = new Partie(R, O(4));
    jusqua(p, () => p.vue().active === 2, () => COMMANDE.DESCENDRE);
    const v = p.vue();
    expect(v.pieces.slice(0, 2).every((q) => q.etat === "libre")).toBe(true);
    // Deux carrés empilés : ~4 m. La troisième pièce naît 7 m au-dessus de ce sommet (pied du carré), donc son centre à 8 m plus haut que le sommet moins un peu.
    const top = Math.max(...v.pieces.slice(0, 2).map((q) => q.y)) + 1;
    expect(top).toBeGreaterThan(3.5);
    expect(v.pieces[2]!.y).toBeGreaterThan(top + REGLAGES_DEFAUT.hauteurApparition8 / 8);
    p.dispose();
  });
});

describe("les vies", () => {
  it("une pièce qui passe sous la plateforme est retirée et coûte une vie, une seule fois", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    // 8 demi-cases à gauche : 4 m, au-delà du bord (3,5 m) : la pièce tombe à côté.
    jusqua(p, () => p.vue().pieces[0]!.etat === "perdue", (k) => (k < 8 ? COMMANDE.GAUCHE : COMMANDE.DESCENDRE));
    const v = p.vue();
    expect(v.pieces[0]!.etat).toBe("perdue");
    expect(v.vies).toBe(2);
    expect(v.tombees).toBe(1);
    expect(v.active).toBe(1);
    for (let i = 0; i < 300; i++) p.avancer(0); // longtemps après : toujours une seule vie perdue, la pièce 1 est encore en l'air
    expect(p.vue().tombees === 1 ? p.vue().vies : -1).toBe(2);
    p.dispose();
  });

  it("une pièce tombée de la tour (effondrement) coûte une vie, comme une pièce active ; une cascade en coûte plusieurs, jamais deux fois la même", () => {
    const p = new Partie(R, SCENARIO_ESSAI);
    // Chaque pièce est poussée à droite de 6 demi-cases : la tour se penche et s'effondre.
    const { transitions } = partieScriptee(p, (_id, k) => (k < 6 ? COMMANDE.DROITE : 0));
    const v = p.vue();
    expect(new Set(transitions).size).toBe(transitions.length); // jamais deux fois la même pièce
    expect(transitions.length).toBeGreaterThanOrEqual(4); // cascade
    expect(v.tombees).toBe(transitions.length);
    expect(v.vies).toBe(Math.max(0, REGLAGES_DEFAUT.vies - transitions.length));
    // Une pièce emportée alors qu'elle était posée (pas en l'air) : au moins deux dans la cascade.
    const tomberesPosees = transitions.filter((id) => id < v.posees && v.pieces[id]!.etat === "perdue");
    expect(tomberesPosees.length).toBeGreaterThanOrEqual(2);
    p.dispose();
  });
});

describe("la fin", () => {
  it("à la dernière pièce : la partie se fige après la stabilisation, 40 pièces posées, aucune vie perdue", () => {
    const p = new Partie(R, O(40));
    jusqua(p, () => p.etape === "fini", () => COMMANDE.DESCENDRE, 20000);
    const r = p.resultat()!;
    expect(r.motif).toBe("pieces");
    expect(r.posees).toBe(40);
    expect(r.tombees).toBe(0);
    expect(r.vies).toBe(3);
    expect(p.vue().numero).toBe(40);
    expect(p.vue().suivante).toBeNull();
    expect(r.hauteurMm).toBeGreaterThan(78_500); // 40 carrés de 2 m = 80 m, moins le tassement de la pile (mesuré : ≈ 0,5 m, voir le rapport du lot T0)
    expect(r.hauteurMm).toBeLessThan(80_100);
    p.dispose();
  });

  it("à 0 vie : la partie s'arrête, la pièce en l'air est abandonnée (ni posée ni tombée), la tour restante est mesurée", () => {
    const p = new Partie(R, { nom: "dehors", pieces: ["O", "O", "O", "O", "O"], plateformeDemi8: 28 });
    partieScriptee(p, (_id, k) => (k < 10 ? COMMANDE.GAUCHE : COMMANDE.DESCENDRE)); // chaque pièce part à 5 m à gauche : trois vies, trois pièces perdues
    const r = p.resultat()!;
    expect(r.motif).toBe("vies");
    expect(r.vies).toBe(0);
    expect(r.tombees).toBe(3);
    expect(r.posees).toBe(0);
    expect(r.hauteurMm).toBe(0);
    expect(p.vue().pieces.map((q) => q.etat)).toEqual(["perdue", "perdue", "perdue"]); // la quatrième n'est jamais née
    p.dispose();
    // La dernière vie perdue pendant qu'une pièce tombe encore (effondrement) : cette pièce est abandonnée, ni posée ni tombée.
    const q = new Partie(R, SCENARIO_ESSAI);
    partieScriptee(q, (_id, k) => (k < 6 ? COMMANDE.DROITE : 0));
    const w = q.vue();
    expect(q.resultat()!.motif).toBe("vies");
    expect(q.resultat()!.vies).toBe(0);
    expect(w.pieces.filter((x) => x.etat === "abandonnee").length).toBe(1);
    expect(w.pieces.length).toBe(q.resultat()!.posees + 1);
    expect(w.pieces.filter((x) => x.etat === "perdue").length).toBe(q.resultat()!.tombees);
    q.dispose();
  });

  it("la stabilisation dure 5 s au plus : toutes les pièces endormies, ou le délai écoulé", () => {
    const p = new Partie(R, O(3));
    jusqua(p, () => p.etape === "stabilisation", () => COMMANDE.DESCENDRE);
    const fin = p.tick;
    jusqua(p, () => p.etape === "fini");
    const r = p.resultat()!;
    expect(r.ticks).toBe(fin);
    expect(r.ticksGel - r.ticks).toBeLessThanOrEqual(STABILISATION_MAX_TICKS);
    expect(r.ticksGel - r.ticks).toBeLessThan(STABILISATION_MAX_TICKS); // la tour de carrés s'endort bien avant
    expect(p.vue().pieces.every((q) => q.endormie)).toBe(true);
    // Le délai : si les pièces ne s'endorment pas, on fige quand même (ici : 10 pas).
    const q = new Partie(R, SCENARIO_ESSAI, REGLAGES_DEFAUT, { stabilisationMaxTicks: 10 });
    partieScriptee(q, (_id, k) => (k < 6 ? COMMANDE.DROITE : 0));
    const s = q.resultat()!;
    expect(s.ticksGel - s.ticks).toBeLessThanOrEqual(10);
    p.dispose();
    q.dispose();
  });

  it("le score est la hauteur finale stable en millimètres entiers, la plus haute atteinte est gardée à part", () => {
    const p = new Partie(R, O(3));
    jusqua(p, () => p.etape === "fini", () => COMMANDE.DESCENDRE);
    const r = p.resultat()!;
    expect(Number.isInteger(r.hauteurMm)).toBe(true);
    expect(Math.abs(r.hauteurMm - 6000)).toBeLessThan(20);
    expect(r.hauteurMaxMm).toBeGreaterThanOrEqual(r.hauteurMm);
    expect(Number.isInteger(r.hauteurMaxMm)).toBe(true);
    expect(r.vies).toBe(3);
    expect(Number.isInteger(r.ticks)).toBe(true);
    // Une tour effondrée : la plus haute atteinte dépasse la hauteur finale (qui seule compte).
    const q = new Partie(R, SCENARIO_ESSAI);
    partieScriptee(q, (_id, k) => (k < 6 ? COMMANDE.DROITE : 0));
    expect(q.resultat()!.hauteurMaxMm).toBeGreaterThan(q.resultat()!.hauteurMm);
    p.dispose();
    q.dispose();
  });

  it("une fois figée, la partie n'avance plus", () => {
    const p = new Partie(R, O(2));
    jusqua(p, () => p.etape === "fini", () => COMMANDE.DESCENDRE);
    const r = p.resultat();
    const t = p.tick;
    p.avancer(COMMANDE.GAUCHE);
    expect(p.tick).toBe(t);
    expect(p.resultat()).toBe(r);
    p.dispose();
  });
});

describe("une partie scriptée", () => {
  /** Des commandes fixes, une fonction de (pièce, pas depuis son apparition) : tantôt à droite, tantôt à gauche, un quart de tour, la descente à la fin. */
  const SCRIPT = (id: number, k: number): number => {
    const dx = ((id * 7 + 3) % 9) - 4;
    let c = 0;
    if (k < Math.abs(dx) * 3 && k % 3 === 0) c |= dx < 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE;
    else if (k >= 20 && k < 20 + (id % 3) * 3 && k % 3 === 0) c |= COMMANDE.TOURNER;
    if (k > 60) c |= COMMANDE.DESCENDRE;
    return c;
  };

  it(`TOWER_SIM_VERSION vaut 1 et l'empreinte de fin est celle de Node (le golden des quatre navigateurs viendra au lot T2)`, () => {
    expect(TOWER_SIM_VERSION).toBe(1);
    const p = new Partie(R, SCENARIO_ESSAI);
    partieScriptee(p, SCRIPT);
    const r = p.resultat()!;
    const e = empreinteVue(p.vue());
    expect({ empreinte: e, resultat: r }).toMatchInlineSnapshot(`
      {
        "empreinte": "42d2b82d50b261c2",
        "resultat": {
          "hauteurMaxMm": 2646,
          "hauteurMm": 2000,
          "motif": "vies",
          "posees": 5,
          "ticks": 495,
          "ticksGel": 591,
          "tombees": 3,
          "vies": 0,
        },
      }
    `);
    p.dispose();
  });

  it("deux rejeux des mêmes commandes donnent exactement le même état, à chaque pas", () => {
    const a = new Partie(R, SCENARIO_ESSAI);
    const b = new Partie(R, SCENARIO_ESSAI);
    let ida = -1;
    let k = 0;
    for (let t = 0; t < 1500 && a.etape !== "fini"; t++) {
      const v = a.vue();
      if (v.active !== ida) {
        ida = v.active;
        k = 0;
      }
      const c = v.active >= 0 ? SCRIPT(v.active, k++) : 0;
      a.avancer(c);
      b.avancer(c);
      if (t % 100 === 0) expect(empreinteVue(a.vue())).toBe(empreinteVue(b.vue()));
    }
    expect(empreinteVue(a.vue())).toBe(empreinteVue(b.vue()));
    a.dispose();
    b.dispose();
  });
});
