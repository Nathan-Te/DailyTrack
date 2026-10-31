import { beforeAll, describe, expect, it } from "vitest";
import { boitesE as boites, TOUR_DEPART, type PieceKind, COMMANDE, EFFETS, empreinteVue, FROTTEMENT_GLISSANT, MARGE_CONTACT, DISTANCE_SOUDURE, Partie, PHYSIQUE, PHYSIQUE_REGLEE_DEFAUT, physiqueEstDEssai, physiqueResolue, type Rapier, SCENARIO_ESSAI, scenarioPaliers, VENT_PERIODE_TICKS } from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T5 — les réglages d'ESSAI de la physique (`?debug&tune`) : sans option, la partie est exactement celle d'avant ; un réglage change la partie et la marque « d'essai » ; `effetSuivant` est
// l'effet que prend vraiment la prochaine pièce. Node seulement (règle R13).
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** Une partie scriptée : un déplacement à gauche puis à droite, un quart de tour tous les 40 ticks, 900 ticks. */
function jouer(p: Partie, n = 900): string {
  for (let k = 0; k < n && p.etape !== "fini"; k++) p.avancer(k % 17 === 0 ? COMMANDE.GAUCHE : k % 29 === 0 ? COMMANDE.DROITE : k % 40 === 0 ? COMMANDE.TOURNER : k % 3 === 0 ? COMMANDE.DESCENDRE : 0);
  return empreinteVue(p.vue());
}

describe("les réglages d'essai de la physique", () => {
  it("les défauts sont les constantes de la simulation", () => {
    expect(PHYSIQUE_REGLEE_DEFAUT).toEqual({ frottement: PHYSIQUE.frottement, rebond: PHYSIQUE.rebond, ventPeriodeTicks: VENT_PERIODE_TICKS, ventPas8: 1, frottementGlissant: FROTTEMENT_GLISSANT, echellePetite4: 2, echelleGeante4: 8, margeContact: MARGE_CONTACT, distanceSoudure: DISTANCE_SOUDURE });
    expect(physiqueEstDEssai(physiqueResolue(undefined))).toBe(false);
    expect(physiqueEstDEssai(physiqueResolue({ frottement: 0.6 }))).toBe(false);
  });

  it("sans option, ou avec les défauts écrits, la partie est la même au bit près ; un réglage d'essai la change", () => {
    const a = new Partie(R, SCENARIO_ESSAI);
    const b = new Partie(R, SCENARIO_ESSAI, undefined, { physique: { ...PHYSIQUE_REGLEE_DEFAUT } });
    const c = new Partie(R, SCENARIO_ESSAI, undefined, { physique: { frottement: 0.1 } });
    const ea = jouer(a);
    expect(jouer(b)).toBe(ea);
    expect(jouer(c)).not.toBe(ea);
    expect(a.physiqueDEssai).toBe(false);
    expect(b.physiqueDEssai).toBe(false);
    expect(c.physiqueDEssai).toBe(true);
    for (const p of [a, b, c]) p.dispose();
  });

  it("chaque réglage d'essai change la partie (frottement, rebond, marges) et marque la partie", () => {
    const base = new Partie(R, scenarioPaliers("glissante"));
    const e0 = jouer(base, 1500);
    for (const [nom, valeur] of Object.entries({ frottement: 0.2, rebond: 0.5, margeContact: 0.12, frottementGlissant: 0.5, echellePetite4: 3, echelleGeante4: 10, ventPas8: 3, ventPeriodeTicks: 4, distanceSoudure: 0.09 })) {
      const p = new Partie(R, scenarioPaliers("glissante"), undefined, { physique: { [nom]: valeur } });
      expect(p.physiqueDEssai, nom).toBe(true);
      // Une partie sur le défaut ne bouge jamais ; les réglages qui ne touchent rien dans ce scénario (vent, petite, géante, soudure) peuvent donner la même empreinte : on ne l'exige que des autres.
      if (["frottement", "rebond", "margeContact", "frottementGlissant"].includes(nom)) expect(jouer(p, 1500), nom).not.toBe(e0);
      p.dispose();
    }
    base.dispose();
  });

  it("le coup de vent suit la force et la période d'essai (même mise en place que le test des paliers)", () => {
    const decalage = (physique: Partial<typeof PHYSIQUE_REGLEE_DEFAUT>, ticks: number): number => {
      const p = new Partie(R, { nom: "vent", pieces: [..."OOOOOOO"] as PieceKind[], plateformeDemi8: 28, depart: TOUR_DEPART, paliers: [{ metres: 10, effet: "vent" }], ventSens: 1 }, undefined, { physique });
      let guard = 0;
      while (p.vue().active !== TOUR_DEPART.length + 2 && p.etape !== "fini" && guard++ < 6000) p.avancer(COMMANDE.DESCENDRE);
      expect(p.vue().active).toBe(TOUR_DEPART.length + 2);
      const x0 = p.vue().pieces[TOUR_DEPART.length + 2]!.x;
      for (let i = 0; i < ticks; i++) p.avancer(0);
      const dx = p.vue().pieces[TOUR_DEPART.length + 2]!.x - x0;
      p.dispose();
      return dx;
    };
    expect(decalage({}, 60)).toBeCloseTo(6 / 8, 10); // six poussées d'un huitième
    expect(decalage({ ventPas8: 3 }, 60)).toBeCloseTo(18 / 8, 10);
    expect(decalage({ ventPeriodeTicks: 5 }, 60)).toBeCloseTo(12 / 8, 10);
  });

  it("une taille d'essai met les pièces à l'échelle (la moitié et le double restent exactement ce qu'ils étaient)", () => {
    const echelles = { petite4: 2, geante4: 8 };
    expect(boites("T", 0, "petite", echelles)).toEqual(boites("T", 0, "petite"));
    expect(boites("T", 0, "geante", echelles)).toEqual(boites("T", 0, "geante"));
    const trois = boites("T", 0, "petite", { petite4: 3, geante4: 8 });
    const deux = boites("T", 0, "petite");
    const aire = (bs: readonly { hw: number; hh: number }[]): number => bs.reduce((s, b) => s + 4 * b.hw * b.hh, 0);
    expect(aire(trois)).toBeGreaterThan(aire(deux));
    expect(aire(boites("T", 0, "geante", { petite4: 2, geante4: 12 }))).toBeGreaterThan(aire(boites("T", 0, "geante")));
    // Les boîtes d'une pièce gardent leurs arêtes communes (aucun trou entre deux boîtes de la même pièce).
    const bs = boites("T", 0, "petite", { petite4: 3, geante4: 8 });
    const bas = bs[0]!;
    const haut = bs[1]!;
    expect(haut.cy - haut.hh).toBe(bas.cy + bas.hh);
  });

  it("`effetSuivant` est l'effet que prend vraiment la prochaine pièce, pour les six effets (et deux paliers franchis d'un coup)", () => {
    for (const effet of EFFETS) {
      const p = new Partie(R, scenarioPaliers(effet));
      const vus: (string | null)[] = [];
      let attendu: string | null = p.vue().effetSuivant;
      let nbPieces = p.vue().pieces.length;
      for (let k = 0; k < 6000 && p.etape !== "fini"; k++) {
        p.avancer(COMMANDE.DESCENDRE);
        const v = p.vue();
        if (v.pieces.length > nbPieces) {
          // une pièce vient de naître : elle a pris l'effet annoncé AVANT sa naissance
          expect(v.pieces[v.pieces.length - 1]!.effet, `${effet} piece ${v.pieces.length}`).toBe(attendu);
          vus.push(attendu);
          nbPieces = v.pieces.length;
        }
        attendu = v.effetSuivant;
      }
      expect(vus.length).toBeGreaterThan(1);
      p.dispose();
    }
  });
});
