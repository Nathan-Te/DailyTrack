import { describe, expect, it } from "vitest";
import { BASCULE_LOT_35, DEBLOCAGES, VOITURES_GARAGE, avancement, estDebloquee, etatGarage, medalsFor, nouvellesVoitures, progresGarage, type ResultatDuJour } from "../src";

// Lot 41 : les règles du Garage (une seule table, lue par le serveur et par le jeu) et le calcul de la progression.

const PILOTE = 40_000;
const AVANT = BASCULE_LOT_35 - 1; // un jour d'avant la bascule des médailles (lot 35)
/** Un résultat du jour avec la médaille voulue, selon les seuils de ce jour. */
function resultat(day: number, medaille: "author" | "gold" | "silver" | null): ResultatDuJour {
  const m = medalsFor(PILOTE, day);
  const ms = medaille === "author" ? m.author : medaille === "gold" ? m.gold : medaille === "silver" ? m.silver : m.bronze + 1000;
  return { day, ms, authorMs: PILOTE };
}

describe("les règles (décision du 23/10/2026)", () => {
  it("une ligne par voiture : civile dès le départ, A 3 ors, B 10 jours, C 1 auteur ; une seule voiture par défaut, aucune par abonnement", () => {
    expect(VOITURES_GARAGE).toEqual(["civile", "evolution", "gt", "proto"]);
    expect(DEBLOCAGES).toEqual({
      civile: { type: "defaut" },
      evolution: { type: "medailles", medaille: "or", nombre: 3 },
      gt: { type: "jours", nombre: 10 },
      proto: { type: "medailles", medaille: "auteur", nombre: 1 },
    });
    expect(Object.values(DEBLOCAGES).filter((d) => d.type === "defaut")).toHaveLength(1);
    expect(Object.values(DEBLOCAGES).some((d) => d.type === "abonnement")).toBe(false);
  });

  it("un abonnement ne débloque jamais rien (réservé)", () => {
    expect(estDebloquee({ type: "abonnement" }, { jours: 999, or: 999, auteur: 999 })).toBe(false);
    expect(avancement({ type: "abonnement" }, { jours: 1, or: 1, auteur: 1 })).toBeNull();
  });
});

describe("progresGarage", () => {
  it("compte les jours joués, l'or (l'auteur compris) et l'auteur", () => {
    const p = progresGarage([resultat(AVANT - 5, "author"), resultat(AVANT - 4, "gold"), resultat(AVANT - 3, "silver"), resultat(AVANT - 2, null)]);
    expect(p).toEqual({ jours: 4, or: 2, auteur: 1 });
  });

  it("une médaille compte avec les seuils de SON jour (bascule du 28/10)", () => {
    // Le même temps (1,05 × pilote) : or avant la bascule (or = 1,08 × pilote), rien après (or = 0,84 × 1,045 × pilote ≈ 0,88 × pilote).
    const ms = Math.round(PILOTE * 1.05);
    expect(progresGarage([{ day: BASCULE_LOT_35 - 1, ms, authorMs: PILOTE }])).toEqual({ jours: 1, or: 1, auteur: 0 });
    expect(progresGarage([{ day: BASCULE_LOT_35, ms, authorMs: PILOTE }])).toEqual({ jours: 1, or: 0, auteur: 0 });
    // Après la bascule, l'auteur est à 0,84 × pilote : le temps du pilote n'a même plus l'or.
    expect(progresGarage([{ day: BASCULE_LOT_35 + 3, ms: PILOTE, authorMs: PILOTE }]).or).toBe(0);
    expect(progresGarage([resultat(BASCULE_LOT_35 + 3, "author")])).toEqual({ jours: 1, or: 1, auteur: 1 });
  });

  it("un jour ne compte qu'une fois ; un circuit inconnu compte comme joué, sans médaille", () => {
    expect(progresGarage([resultat(AVANT, "author"), resultat(AVANT, "author")])).toEqual({ jours: 1, or: 1, auteur: 1 });
    expect(progresGarage([{ day: AVANT, ms: 1, authorMs: null }])).toEqual({ jours: 1, or: 0, auteur: 0 });
    expect(progresGarage([])).toEqual({ jours: 0, or: 0, auteur: 0 });
  });
});

describe("etatGarage et nouvellesVoitures", () => {
  it("rien gagné : la civile seulement, la progression de chaque voiture verrouillée", () => {
    expect(etatGarage({ jours: 4, or: 2, auteur: 0 })).toEqual([
      { id: "civile", debloquee: true, progres: null },
      { id: "evolution", debloquee: false, progres: { fait: 2, nombre: 3 } },
      { id: "gt", debloquee: false, progres: { fait: 4, nombre: 10 } },
      { id: "proto", debloquee: false, progres: { fait: 0, nombre: 1 } },
    ]);
  });

  it("au seuil, la voiture se débloque ; la progression ne dépasse jamais le nombre demandé", () => {
    const e = etatGarage({ jours: 25, or: 3, auteur: 4 });
    expect(e.every((v) => v.debloquee)).toBe(true);
    expect(e.find((v) => v.id === "gt")!.progres).toEqual({ fait: 10, nombre: 10 });
    expect(e.find((v) => v.id === "proto")!.progres).toEqual({ fait: 1, nombre: 1 });
  });

  it("les nouvelles voitures : débloquées après, pas avant", () => {
    expect(nouvellesVoitures({ jours: 9, or: 2, auteur: 0 }, { jours: 10, or: 3, auteur: 1 })).toEqual(["evolution", "gt", "proto"]);
    expect(nouvellesVoitures({ jours: 10, or: 3, auteur: 1 }, { jours: 11, or: 4, auteur: 2 })).toEqual([]);
    expect(nouvellesVoitures({ jours: 0, or: 0, auteur: 0 }, { jours: 0, or: 0, auteur: 0 })).toEqual([]);
  });
});
