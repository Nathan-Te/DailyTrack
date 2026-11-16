import { afterEach, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BLOC, ErreurDePreparation, GENERATEURS, GRAVITY_GENERATOR_VERSION, LARGEUR_MORCEAU, LIGNES, dailyGravity, distanceDeLaPreuve, genererMorceau, lireJourFige, phraseDuDefaut, preparerJour, seuilsDuRobot, verifierFranchissable } from "../src/index";

// Lot GR5 — **la préparation des jours à l'avance** : `preparerJour` fait passer le robot (contraintes d'humain) sur le jour, puis le fige avec ses seuils ; **un jour infranchissable fait échouer la préparation** et le dit
// (jour, morceau, motif). Le jour infranchissable est fabriqué : un générateur piégé (version 9, posée dans le registre le temps du test) dont le morceau 6 est un mur plein, de haut en bas.
const JOUR = daysFromCivil(2026, 11, 9);
const MORCEAU_PIEGE = 6;
afterEach(() => {
  delete GENERATEURS[9];
  delete GENERATEURS[8];
});
/** Un générateur qui est celui de la version 3 sauf au morceau `MORCEAU_PIEGE` : une colonne de blocs sur 16 colonnes, du plafond au sol — aucun humain ne passe. */
const poserGenerateurPiege = (): void => {
  GENERATEURS[9] = {
    ...GENERATEURS[3]!,
    morceau: (j, m, ordre, entree, precedent, regles) => {
      const sain = genererMorceau(j, m, ordre, entree, precedent, regles);
      if (m !== MORCEAU_PIEGE) return sain;
      return { ...sain, motif: "zigzag", cases: new Uint8Array(LARGEUR_MORCEAU * LIGNES).fill(BLOC), pieces: [], gemmes: [], bonus: [] };
    },
  };
};

describe("preparerJour", () => {
  it("un jour franchissable : le robot le prouve, le fichier porte les seuils du robot, il se relit", () => {
    const f = preparerJour(JOUR);
    expect(f).toMatchObject({ jeu: "gravity", date: formatDay(JOUR), g: GRAVITY_GENERATOR_VERSION });
    expect(f.seuils).toEqual(seuilsDuRobot(dailyGravity(JOUR)));
    expect(lireJourFige(JSON.parse(JSON.stringify(f)))).not.toBeNull();
    expect(distanceDeLaPreuve(19)).toBe(2280);
  });

  it("un jour infranchissable (un générateur piégé) fait échouer la préparation, et la sortie dit le jour, le morceau et le motif", () => {
    poserGenerateurPiege();
    let erreur: unknown;
    try {
      preparerJour(JOUR, { version: 9, distance: 400 });
    } catch (e) {
      erreur = e;
    }
    expect(erreur).toBeInstanceOf(ErreurDePreparation);
    const e = erreur as ErreurDePreparation;
    expect(e.verdict.ok).toBe(false);
    // le robot meurt contre le mur : il est au bout du morceau d'avant, le morceau piégé est celui qui est devant lui
    const mort = e.verdict.defauts.find((d) => d.raison === "mort");
    expect(mort).toMatchObject({ morceau: MORCEAU_PIEGE - 1, devant: { morceau: MORCEAU_PIEGE, motif: "zigzag" } });
    expect(e.message).toContain(formatDay(JOUR)); // le jour
    expect(e.message).toContain(`devant le morceau ${MORCEAU_PIEGE} (zigzag)`); // le morceau et le motif
    expect(e.message).toMatch(/infranchissable/);
    expect(e.verdict.defauts.map(phraseDuDefaut).join(" ")).toContain(`devant le morceau ${MORCEAU_PIEGE} (zigzag)`);
  });

  it("le même générateur sans le piège passe : c'est bien le mur qui fait échouer, pas la distance demandée", () => {
    GENERATEURS[8] = { ...GENERATEURS[3]! }; // (un autre numéro : le terrain d'une version est gardé en mémoire, celui du piège ne doit pas servir ici)
    expect(verifierFranchissable(dailyGravity(JOUR, 8), 400).ok).toBe(true);
  });
});
