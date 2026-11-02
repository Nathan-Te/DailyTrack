import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, COMMANDES_CONNUES, COMMANDES_CONNUES_V4, decoderRediffusion, encoderRediffusion, enregistrer, ErreurRediffusion, Partie, PARAMS_STABILITE, type PieceDepart, type Rapier, REGLAGES_DEFAUT, rejouer, type Scenario, SCENARIO_EMBOITEMENT } from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T8 — le taquet (simulation 5) : en main, un pas fin d'un huitième de mètre ; juste après le lâcher, une poussée physique latérale (fenêtre, vitesse, nombre de poussées). Et les deux bits sont
// nouveaux de la simulation 5 : les versions 3 et 4 les refusent.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const plate = (pieces: Scenario["pieces"], depart: readonly PieceDepart[] = [], demi8 = 64): Scenario => ({ nom: "taquet", pieces, plateformeDemi8: demi8, depart });

describe("le taquet en main : un pas fin d'un huitième de mètre, hors de la grille", () => {
  it("TAQUET_DROITE déplace la pièce en main de 12,5 cm (un huitième), TAQUET_GAUCHE de même vers la gauche ; un déplacement ordinaire reste une demi-case, à partir de la position courante", () => {
    const p = new Partie(R, plate(["O", "O"]));
    const x0 = p.vue().pieces[0]!.x;
    p.avancer(COMMANDE.TAQUET_DROITE);
    expect(p.vue().pieces[0]!.x - x0).toBeCloseTo(0.125, 6);
    p.avancer(COMMANDE.TAQUET_GAUCHE);
    p.avancer(COMMANDE.TAQUET_GAUCHE);
    expect(p.vue().pieces[0]!.x - x0).toBeCloseTo(-0.125, 6);
    p.avancer(COMMANDE.DROITE); // une demi-case à partir de −0,125
    expect(p.vue().pieces[0]!.x - x0).toBeCloseTo(0.375, 6);
    p.dispose();
  });

  it("le pas fin est soumis à la tolérance d'emboîtement : collée contre un carré posé, la pièce en main ne peut pas être poussée de 12,5 cm dedans (2 cm toléré) ; elle peut s'en écarter", () => {
    // Un carré posé d'avance (x de 0 à 2) ; la pièce en main, un carré, descend le long de lui, collée à sa gauche (x de −2 à 0).
    const p = new Partie(R, plate(["O"], [{ kind: "O", rot: 0, x8: 8, y8: 8 }]));
    p.avancer(COMMANDE.GAUCHE);
    p.avancer(COMMANDE.GAUCHE);
    let k = 0;
    while (p.vue().pieces[1]!.y > 1.6 && k++ < 800) p.avancer(COMMANDE.DESCENDRE);
    expect(p.vue().active).toBe(1);
    const avant = p.vue().pieces[1]!.x;
    expect(avant).toBeCloseTo(-1, 6);
    p.avancer(COMMANDE.TAQUET_DROITE);
    expect(p.vue().pieces[1]!.x).toBeCloseTo(avant, 6);
    p.avancer(COMMANDE.TAQUET_GAUCHE);
    expect(p.vue().pieces[1]!.x).toBeCloseTo(avant - 0.125, 6);
    p.dispose();
  });
});

describe("le taquet après le lâcher : une poussée physique latérale, dans une fenêtre, en nombre limité", () => {
  /** Pose un carré sur la plateforme (descendre) et rend la partie à l'instant juste après son lâcher. */
  function apresLacher(): Partie {
    const p = new Partie(R, plate(["O", "O", "O"]));
    let k = 0;
    while (p.vue().active === 0 && k++ < 2000) p.avancer(COMMANDE.DESCENDRE);
    return p;
  }

  it("une poussée ajoute 1,5 m/s (12 huitièmes) à la vitesse horizontale de la pièce lâchée ; la pièce en main n'est pas touchée", () => {
    const p = apresLacher();
    const xMain = p.vue().pieces[1]!.x;
    expect(p.vitesseDe(0)!.x).toBe(0);
    p.avancer(COMMANDE.TAQUET_DROITE);
    expect(p.vitesseDe(0)!.x).toBeGreaterThan(1.2); // 1,5 m/s moins le frottement d'un tick
    expect(p.vue().pieces[1]!.x).toBeCloseTo(xMain, 6);
    p.dispose();
  });

  it("au plus `taquetMax` poussées par pièce (trois) : la quatrième est sans effet, et ne déplace pas non plus la pièce en main", () => {
    const p = apresLacher();
    const xMain = p.vue().pieces[1]!.x;
    for (let i = 0; i < 3; i++) p.avancer(COMMANDE.TAQUET_DROITE);
    const v3 = p.vitesseDe(0)!.x;
    p.avancer(COMMANDE.TAQUET_DROITE);
    expect(p.vitesseDe(0)!.x).toBeLessThanOrEqual(v3 + 1e-9);
    expect(p.vue().pieces[1]!.x).toBeCloseTo(xMain, 6);
    p.dispose();
  });

  it("la fenêtre dure `taquetFenetre` ticks (15) : au-delà, le taquet déplace de nouveau la pièce en main d'un pas fin", () => {
    const p = apresLacher();
    for (let i = 0; i < PARAMS_STABILITE.taquetFenetre; i++) p.avancer(0);
    const xMain = p.vue().pieces[1]!.x;
    p.avancer(COMMANDE.TAQUET_GAUCHE);
    expect(p.vue().pieces[1]!.x).toBeCloseTo(xMain - 0.125, 6);
    p.dispose();
  });

  it("deux poussées dans la fenêtre font glisser la pièce plus loin qu'une seule (à partir de la même pose)", () => {
    const glisse = (n: number): number => {
      const p = apresLacher();
      const x0 = p.vue().pieces[0]!.x;
      for (let i = 0; i < n; i++) p.avancer(COMMANDE.TAQUET_DROITE);
      for (let i = 0; i < 120; i++) p.avancer(0);
      const d = p.vue().pieces[0]!.x - x0;
      p.dispose();
      return d;
    };
    expect(glisse(2)).toBeGreaterThan(glisse(1) + 0.05);
    expect(glisse(1)).toBeGreaterThan(0.05);
  });
});

describe("les deux bits du taquet sont nouveaux de la simulation 5", () => {
  it("COMMANDES_CONNUES porte les six bits, COMMANDES_CONNUES_V4 les quatre anciens", () => {
    expect(COMMANDES_CONNUES).toBe(63);
    expect(COMMANDES_CONNUES_V4).toBe(15);
  });

  const rediff = (sim: number, masque: number): string =>
    encoderRediffusion({ sim, g: 0, contenu: { scenario: "essai" }, reglages: { ...REGLAGES_DEFAUT }, plages: [{ masque, ticks: 5 }] });

  it("une rediffusion des simulations 3 et 4 qui contient un bit du taquet est refusée (commandes_inconnues) ; en simulation 5 elle se décode", () => {
    for (const sim of [3, 4]) {
      for (const bit of [COMMANDE.TAQUET_GAUCHE, COMMANDE.TAQUET_DROITE]) {
        expect(() => decoderRediffusion(rediff(sim, bit | COMMANDE.DESCENDRE))).toThrowError(ErreurRediffusion);
        try {
          decoderRediffusion(rediff(sim, bit));
        } catch (e) {
          expect((e as ErreurRediffusion).code).toBe("commandes_inconnues");
        }
      }
    }
    expect(decoderRediffusion(rediff(5, COMMANDE.TAQUET_GAUCHE | COMMANDE.TAQUET_DROITE)).plages[0]!.masque).toBe(48);
  });

  it("une partie des simulations 3 et 4 ignore les bits du taquet (et ne les enregistre pas) : la rediffusion qu'elle produit se rejoue", () => {
    for (const version of [3, 4]) {
      const p = new Partie(R, SCENARIO_EMBOITEMENT, REGLAGES_DEFAUT, { version });
      p.avancer(COMMANDE.TAQUET_DROITE | COMMANDE.DESCENDRE);
      expect(p.commandesJouees()[0]).toBe(COMMANDE.DESCENDRE);
      p.dispose();
    }
  });

  it("une partie rejouée en simulation 5 avec des taquets donne le même résultat que la partie jouée (la rediffusion porte les bits)", () => {
    const p = new Partie(R, SCENARIO_EMBOITEMENT, REGLAGES_DEFAUT, { version: 5 });
    let k = 0;
    while (p.etape !== "fini" && k < 20000) p.avancer(k++ % 40 === 3 ? COMMANDE.TAQUET_DROITE | COMMANDE.DESCENDRE : COMMANDE.DESCENDRE);
    const r = enregistrer(p);
    expect(r.sim).toBe(5);
    expect(r.plages.some((x) => x.masque & COMMANDE.TAQUET_DROITE)).toBe(true);
    const texte = encoderRediffusion(r);
    expect(rejouer(R, SCENARIO_EMBOITEMENT, texte)).toEqual(p.resultat());
    p.dispose();
  });
});
