import { describe, expect, it } from "vitest";
import { bat, creerRecords } from "../src/records";

function memoire(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: () => null, length: 0, clear: () => m.clear() } as Storage;
}
const R = creerRecords({ cle: "essai:records", sens: ["desc", "asc"] });
const partie = (a: number, b: number) => ({ score: [a, b], medaille: null, rediffusion: "AAAA" });

describe("records locaux d'un jeu neuf (lot K4c)", () => {
  it("compare dans le sens de chaque colonne, la première qui diffère décide", () => {
    expect(bat([10, 5], [11, 9], ["desc", "asc"])).toBe(true);
    expect(bat([10, 5], [10, 4], ["desc", "asc"])).toBe(true);
    expect(bat([10, 5], [10, 5], ["desc", "asc"])).toBe(false);
    expect(bat([10, 5], [9, 1], ["desc", "asc"])).toBe(false);
    expect(bat(null, [0, 0], ["desc", "asc"])).toBe(true);
  });
  it("garde le meilleur du jour, non envoyé, et ignore une partie moins bonne", () => {
    const s = memoire();
    expect(R.proposer(s, "2026-11-10", partie(10, 5)).nouveau).toBe(true);
    expect(R.proposer(s, "2026-11-10", partie(9, 5))).toMatchObject({ nouveau: false, record: { score: [10, 5] } });
    expect(R.proposer(s, "2026-11-10", partie(10, 4)).nouveau).toBe(true);
    expect(R.enAttente(R.lire(s))).toEqual(["2026-11-10"]);
  });
  it("note l'envoi seulement si le record est celui qui est parti", () => {
    const s = memoire();
    R.proposer(s, "2026-11-10", partie(10, 5));
    R.noterEnvoye(s, "2026-11-10", [9, 5]);
    expect(R.enAttente(R.lire(s))).toHaveLength(1);
    R.noterEnvoye(s, "2026-11-10", [10, 5]);
    expect(R.enAttente(R.lire(s))).toEqual([]);
    // un record meilleur remplace l'envoyé et attend de nouveau
    R.proposer(s, "2026-11-10", partie(11, 5));
    expect(R.enAttente(R.lire(s))).toEqual(["2026-11-10"]);
  });
  it("ne garde que les trente derniers jours", () => {
    const s = memoire();
    for (let j = 1; j <= 31; j++) R.proposer(s, `2026-10-${String(j).padStart(2, "0")}`, partie(j, 1));
    const jours = Object.keys(R.lire(s)).sort();
    expect(jours).toHaveLength(30);
    expect(jours[0]).toBe("2026-10-02");
  });
  it("lit sans casser un stockage abîmé, refusé, d'un autre nombre de colonnes ou d'une médaille inconnue", () => {
    const s = memoire();
    s.setItem("essai:records", "{pas du json");
    expect(R.lire(s)).toEqual({});
    s.setItem("essai:records", JSON.stringify({ jours: { "2026-11-10": { s: [1], r: "A" }, "2026-11-11": { s: [1, 2], r: "A", m: "diamant" }, "pas-une-date": { s: [1, 2], r: "A" }, "2026-11-12": { s: [1, 2], r: "A", m: "gold", e: 1 } } }));
    expect(Object.keys(R.lire(s))).toEqual(["2026-11-12"]);
    expect(R.lire(null)).toEqual({});
    const refuse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } } as unknown as Storage;
    expect(R.proposer(refuse, "2026-11-10", partie(1, 1)).nouveau).toBe(true);
    R.effacer(s);
    expect(R.lire(s)).toEqual({});
  });
});
