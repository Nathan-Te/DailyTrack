import { describe, expect, it } from "vitest";
import { bat, CLE_RECORDS, enAttente, JOURS_GARDES, lireRecords, noterEnvoye, proposerRecord, serieLocale } from "../src/records";

// Lot T4 — les records gardés dans le navigateur : par jour, la meilleure partie (hauteur, vies, temps, médaille, rediffusion).
function magasin(brut?: string): Pick<Storage, "getItem" | "setItem"> & { valeur(): string | null } {
  let v: string | null = brut ?? null;
  return { getItem: () => v, setItem: (_k: string, x: string) => void (v = x), valeur: () => v };
}
const partie = (h: number, vies = 3, ticks = 5000, rediffusion = "AAAAAAAAAAAAAAAAAAAA") => ({ hauteurMm: h, vies, ticks, medaille: null, rediffusion });
const dateDe = (j: number): string => `2026-11-${String(j).padStart(2, "0")}`;

describe("les records de Tower", () => {
  it("le départage est celui du classement : la hauteur, puis les vies, puis le temps", () => {
    expect(bat(null, partie(1))).toBe(true);
    expect(bat(partie(10_000), partie(10_001, 0, 99_999))).toBe(true);
    expect(bat(partie(10_000, 2), partie(10_000, 3, 99_999))).toBe(true);
    expect(bat(partie(10_000, 3, 5000), partie(10_000, 3, 4999))).toBe(true);
    expect(bat(partie(10_000, 3, 5000), partie(10_000, 3, 5000))).toBe(false);
    expect(bat(partie(10_000, 3), partie(9_999, 3, 1))).toBe(false);
  });

  it("une partie devient le record seulement si elle bat le précédent ; elle est gardée non envoyée", () => {
    const m = magasin();
    expect(proposerRecord(m, "2026-11-05", partie(12_000)).nouveau).toBe(true);
    expect(proposerRecord(m, "2026-11-05", partie(11_000)).nouveau).toBe(false);
    const r = proposerRecord(m, "2026-11-05", partie(13_000, 2, 100, "BBBBBBBBBBBBBBBBBBBB"));
    expect(r.nouveau).toBe(true);
    expect(lireRecords(m)["2026-11-05"]).toEqual({ hauteurMm: 13_000, vies: 2, ticks: 100, medaille: null, rediffusion: "BBBBBBBBBBBBBBBBBBBB", envoye: false });
  });

  it("noterEnvoye ne marque que le record qui est parti ; un meilleur record gardé depuis reste à envoyer", () => {
    const m = magasin();
    proposerRecord(m, "2026-11-05", partie(12_000));
    proposerRecord(m, "2026-11-05", partie(14_000));
    noterEnvoye(m, "2026-11-05", { hauteurMm: 12_000, vies: 3, ticks: 5000 });
    expect(enAttente(lireRecords(m))).toEqual(["2026-11-05"]);
    noterEnvoye(m, "2026-11-05", { hauteurMm: 14_000, vies: 3, ticks: 5000 });
    expect(enAttente(lireRecords(m))).toEqual([]);
  });

  it("les records en attente : du plus récent au plus ancien", () => {
    const m = magasin();
    for (const d of ["2026-11-03", "2026-11-05", "2026-11-04"]) proposerRecord(m, d, partie(5000));
    expect(enAttente(lireRecords(m))).toEqual(["2026-11-05", "2026-11-04", "2026-11-03"]);
  });

  it("seuls les 30 jours les plus récents sont gardés", () => {
    const m = magasin();
    for (let j = 1; j <= JOURS_GARDES + 3; j++) proposerRecord(m, `2026-12-${String(j).padStart(2, "0")}`, partie(1000 + j));
    const jours = Object.keys(lireRecords(m)).sort();
    expect(jours.length).toBe(JOURS_GARDES);
    expect(jours[0]).toBe("2026-12-04");
  });

  it("un texte abîmé, un enregistrement mal formé ou un stockage refusé donne des records vides, jamais une exception", () => {
    expect(lireRecords(magasin("pas du json"))).toEqual({});
    expect(lireRecords(magasin(JSON.stringify({ v: 1, jours: { "2026-11-05": { h: -1, v: 3, t: 1, m: null, r: "x" }, "n'importe quoi": { h: 1, v: 1, t: 1, m: null, r: "x" }, "2026-11-06": { h: 1, v: 1, t: 1, m: "platine", r: "x" } } })))).toEqual({});
    expect(lireRecords(null)).toEqual({});
    const refuse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("quota"); } };
    expect(lireRecords(refuse)).toEqual({});
    expect(proposerRecord(refuse, "2026-11-05", partie(1000)).nouveau).toBe(true); // le jeu reste jouable, sans mémoire
  });

  it("la clé de stockage est tower:records", () => {
    expect(CLE_RECORDS).toBe("tower:records");
  });

  it("la série locale : les jours de suite jusqu'à aujourd'hui, ou jusqu'à hier si aujourd'hui n'est pas encore joué", () => {
    const m = magasin();
    for (const j of [3, 4, 5, 7]) proposerRecord(m, dateDe(j), partie(1000));
    const r = lireRecords(m);
    expect(serieLocale(r, 7, dateDe)).toBe(1);
    expect(serieLocale(r, 6, dateDe)).toBe(3);
    expect(serieLocale(r, 8, dateDe)).toBe(1);
    expect(serieLocale(r, 9, dateDe)).toBe(0);
  });
});
