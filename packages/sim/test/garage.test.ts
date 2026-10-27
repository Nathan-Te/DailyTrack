import { describe, expect, it } from "vitest";
import { BASCULE_LOT_35, COULEURS_VOITURE, DEBLOCAGES, TEINTES_VOITURE, VOITURES_GARAGE, VOITURE_PAR_DEFAUT, avancement, coderVoiture, decoderVoiture, estDebloquee, etatGarage, medalsFor, nouvellesVoitures, progresGarage, voitureAutorisee, voitureLue, type ResultatDuJour } from "../src";

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
  it("une ligne par voiture : civile dès le départ, A 3 ors, B 10 jours, C 1 auteur ; lot 42 (24/10) : fourgon 3 jours, rallye 7, roadster 14, pick-up 6 ors, muscle car 30 jours, monoplace 3 auteurs ; une seule voiture par défaut, aucune par abonnement", () => {
    expect(VOITURES_GARAGE).toEqual(["civile", "fourgon", "evolution", "rallye", "gt", "roadster", "pickup", "proto", "muscle", "monoplace"]);
    expect(DEBLOCAGES).toEqual({
      civile: { type: "defaut" },
      fourgon: { type: "jours", nombre: 3 },
      evolution: { type: "medailles", medaille: "or", nombre: 3 },
      rallye: { type: "jours", nombre: 7 },
      gt: { type: "jours", nombre: 10 },
      roadster: { type: "jours", nombre: 14 },
      pickup: { type: "medailles", medaille: "or", nombre: 6 },
      proto: { type: "medailles", medaille: "auteur", nombre: 1 },
      muscle: { type: "jours", nombre: 30 },
      monoplace: { type: "medailles", medaille: "auteur", nombre: 3 },
    });
    expect(Object.keys(DEBLOCAGES)).toEqual([...VOITURES_GARAGE]);
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
    expect(etatGarage({ jours: 2, or: 2, auteur: 0 })).toEqual([
      { id: "civile", debloquee: true, progres: null },
      { id: "fourgon", debloquee: false, progres: { fait: 2, nombre: 3 } },
      { id: "evolution", debloquee: false, progres: { fait: 2, nombre: 3 } },
      { id: "rallye", debloquee: false, progres: { fait: 2, nombre: 7 } },
      { id: "gt", debloquee: false, progres: { fait: 2, nombre: 10 } },
      { id: "roadster", debloquee: false, progres: { fait: 2, nombre: 14 } },
      { id: "pickup", debloquee: false, progres: { fait: 2, nombre: 6 } },
      { id: "proto", debloquee: false, progres: { fait: 0, nombre: 1 } },
      { id: "muscle", debloquee: false, progres: { fait: 2, nombre: 30 } },
      { id: "monoplace", debloquee: false, progres: { fait: 0, nombre: 3 } },
    ]);
  });

  it("au seuil, la voiture se débloque ; la progression ne dépasse jamais le nombre demandé", () => {
    const e = etatGarage({ jours: 31, or: 6, auteur: 4 });
    expect(e.every((v) => v.debloquee)).toBe(true);
    expect(e.find((v) => v.id === "muscle")!.progres).toEqual({ fait: 30, nombre: 30 });
    expect(e.find((v) => v.id === "monoplace")!.progres).toEqual({ fait: 3, nombre: 3 });
    expect(e.find((v) => v.id === "gt")!.progres).toEqual({ fait: 10, nombre: 10 });
    expect(e.find((v) => v.id === "proto")!.progres).toEqual({ fait: 1, nombre: 1 });
  });

  it("les nouvelles voitures : débloquées après, pas avant", () => {
    expect(nouvellesVoitures({ jours: 9, or: 2, auteur: 0 }, { jours: 10, or: 3, auteur: 1 })).toEqual(["evolution", "gt", "proto"]);
    expect(nouvellesVoitures({ jours: 10, or: 3, auteur: 1 }, { jours: 11, or: 4, auteur: 2 })).toEqual([]);
    // Lot 42 : chaque seuil des nouvelles voitures.
    expect(nouvellesVoitures({ jours: 2, or: 0, auteur: 0 }, { jours: 3, or: 0, auteur: 0 })).toEqual(["fourgon"]);
    expect(nouvellesVoitures({ jours: 6, or: 0, auteur: 0 }, { jours: 7, or: 0, auteur: 0 })).toEqual(["rallye"]);
    expect(nouvellesVoitures({ jours: 13, or: 0, auteur: 0 }, { jours: 14, or: 0, auteur: 0 })).toEqual(["roadster"]);
    expect(nouvellesVoitures({ jours: 20, or: 5, auteur: 1 }, { jours: 20, or: 6, auteur: 1 })).toEqual(["pickup"]);
    expect(nouvellesVoitures({ jours: 29, or: 0, auteur: 0 }, { jours: 30, or: 0, auteur: 0 })).toEqual(["muscle"]);
    expect(nouvellesVoitures({ jours: 30, or: 6, auteur: 2 }, { jours: 30, or: 6, auteur: 3 })).toEqual(["monoplace"]);
    expect(nouvellesVoitures({ jours: 0, or: 0, auteur: 0 }, { jours: 0, or: 0, auteur: 0 })).toEqual([]);
  });
});

describe("la voiture d'une course (lot 51)", () => {
  const GT = { id: "gt", couleur: 3, motif: "chevrons", teinteMotif: 2 };
  it("lue strictement : voiture, couleur, motif et teinte connus ; le reste est illisible", () => {
    expect(voitureLue(GT)).toEqual(GT);
    expect(voitureLue({ ...GT, teinteMotif: undefined })).toEqual({ ...GT, teinteMotif: 0 });
    for (const mauvais of [null, undefined, "gt", [], 3, { ...GT, id: "tank" }, { ...GT, id: 4 }, { ...GT, couleur: COULEURS_VOITURE }, { ...GT, couleur: -1 }, { ...GT, couleur: 1.5 }, { ...GT, motif: "zèbre" }, { ...GT, teinteMotif: TEINTES_VOITURE }, { ...GT, teinteMotif: "1" }]) {
      expect(voitureLue(mauvais), JSON.stringify(mauvais)).toBeNull();
    }
  });
  it("gardée en base sous la forme `id.couleur.motif.teinte` ; une valeur absente ou abîmée donne la Sparrow en orange", () => {
    expect(coderVoiture(voitureLue(GT)!)).toBe("gt.3.chevrons.2");
    expect(decoderVoiture("gt.3.chevrons.2")).toEqual(GT);
    for (const rien of [null, undefined, "", "gt", "gt.3.chevrons", "tank.0.course.0", "gt.9.course.0", "gt.x.course.0", "gt.3.chevrons.2.1"]) expect(decoderVoiture(rien), String(rien)).toEqual(VOITURE_PAR_DEFAUT);
    expect(VOITURE_PAR_DEFAUT).toEqual({ id: "civile", couleur: 0, motif: "course", teinteMotif: 0 });
  });
  it("autorisée seulement si elle est débloquée pour ce joueur (ou ouverte à tous : la recette) ; sinon la Sparrow en orange", () => {
    const rien = progresGarage([]);
    expect(voitureAutorisee(GT, rien)).toEqual(VOITURE_PAR_DEFAUT);
    expect(voitureAutorisee(GT, { jours: 10, or: 0, auteur: 0 })).toEqual(GT);
    expect(voitureAutorisee(GT, rien, true)).toEqual(GT);
    const civile = { id: "civile", couleur: 6, motif: "rond", teinteMotif: 1 };
    expect(voitureAutorisee(civile, rien), "la civile est toujours à lui, dans toutes les couleurs").toEqual(civile);
    expect(voitureAutorisee("n'importe quoi", rien, true)).toEqual(VOITURE_PAR_DEFAUT);
    expect(voitureAutorisee(undefined, rien)).toEqual(VOITURE_PAR_DEFAUT);
  });
});
