import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, empreinteVue, encoderRediffusion, enregistrer, Partie, type PieceKind, type Rapier, type Scenario, TOUR_DEPART } from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T9 — les soudures du lierre sont une LECTURE SEULE des joints de Rapier : l'affichage y pose une feuille-agrafe par soudure ; la partie rejouée n'en dépend pas.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const PREMIERE = TOUR_DEPART.length;
const LIERRE: Scenario = { nom: "essai-soudures", pieces: [..."OOIOOO"] as PieceKind[], plateformeDemi8: 28, depart: TOUR_DEPART, paliers: [{ metres: 10, effet: "lierre" }], ventSens: 1 };

/** La partie jouée tout droit (descendre) ; `lire` : les soudures sont lues à chaque tick, deux fois. */
function jouer(lire: boolean): { code: string; empreinte: string; soudures: ReturnType<Partie["soudures"]>; lectures: number } {
  const p = new Partie(R, LIERRE);
  let lectures = 0;
  while (p.etape !== "fini" && p.tick < 6000 && p.vue().pieces.length < PREMIERE + 4) {
    if (lire) for (let n = 0; n < 2; n++) lectures += p.soudures().length;
    p.avancer(COMMANDE.DESCENDRE);
  }
  for (let i = 0; i < 240 && p.etape === "jeu"; i++) {
    if (lire) for (let n = 0; n < 2; n++) lectures += p.soudures().length;
    p.avancer(0);
  }
  const soudures = p.soudures();
  const out = { code: encoderRediffusion(enregistrer(p)), empreinte: empreinteVue(p.vue()), soudures, lectures };
  p.dispose();
  return out;
}

describe("les soudures du lierre : une lecture seule des joints", () => {
  it("la pièce qui porte le lierre a une soudure par corps qu'elle touche, avec leurs centres ; aucune avant le lierre", () => {
    const a = jouer(false);
    expect(a.soudures.length).toBeGreaterThan(0);
    for (const s of a.soudures) {
      expect(s.id).toBe(PREMIERE + 2);
      expect(s.vers).toBeGreaterThanOrEqual(-1);
      expect(Number.isFinite(s.x + s.y + s.px + s.py)).toBe(true);
    }
    const sans = new Partie(R, { ...LIERRE, paliers: [] });
    for (let i = 0; i < 600; i++) sans.avancer(COMMANDE.DESCENDRE);
    expect(sans.soudures()).toEqual([]);
    sans.dispose();
  });

  it("lire les soudures à chaque tick ne change ni la rediffusion ni l'empreinte de la partie", () => {
    const sans = jouer(false);
    const avec = jouer(true);
    expect(avec.lectures).toBeGreaterThan(0);
    expect(avec.code).toBe(sans.code);
    expect(avec.empreinte).toBe(sans.empreinte);
  });
});
