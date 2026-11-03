import { describe, expect, it } from "vitest";
import { ATTENTE_ENVOI_MS, DELAI_ENVOI_MS, TIMEOUT_MS, avecAttente, estEchecPassager, estOngletPerime, versionsDeReponse, versionsDifferent } from "../src";
import { DELAI_SIMULE_MS, lireSimuler, simulerFetch } from "../src/simuler";

describe("lot D2 — le délai d'un envoi", () => {
  it("20 s : deux fois le pire envoi mesuré en production (10,9 s), sous les 30 s de Cloud Run", () => {
    expect(DELAI_ENVOI_MS).toBe(20_000);
    expect(DELAI_ENVOI_MS).toBeGreaterThanOrEqual(2 * 10_900 - 1_800);
    expect(DELAI_ENVOI_MS).toBeLessThan(30_000);
    expect(DELAI_ENVOI_MS).toBeGreaterThan(TIMEOUT_MS);
  });
});

describe("lot D2 — un échec passager n'est jamais « indisponible »", () => {
  it("coupure, délai dépassé, 429, 5xx et route inconnue sont passagers ; un refus ne l'est pas", () => {
    for (const r of [{ status: 0 }, { status: 0, code: "timeout" }, { status: 429 }, { status: 500 }, { status: 503 }, { status: 404, code: "not_found" }]) expect(estEchecPassager(r)).toBe(true);
    for (const r of [{ status: 409, code: "version" }, { status: 409, code: "replay_copy" }, { status: 400, code: "invalid_replay" }, { status: 410, code: "code_revoked" }]) expect(estEchecPassager(r)).toBe(false);
  });
});

describe("lot D2 — « Envoi en cours » après 3 s", () => {
  const fausse = () => {
    const taches: { fn: () => void; ms: number; vivante: boolean }[] = [];
    return {
      taches,
      set: (fn: () => void, ms: number) => {
        const t = { fn, ms, vivante: true };
        taches.push(t);
        return t;
      },
      clear: (h: unknown) => void ((h as { vivante: boolean }).vivante = false),
    };
  };
  it("la minuterie est de 3 s, déclenche l'avis si la réponse tarde, et est nettoyée", async () => {
    expect(ATTENTE_ENVOI_MS).toBe(3_000);
    const m = fausse();
    let lent = 0;
    let fin!: (v: string) => void;
    const p = avecAttente(new Promise<string>((r) => (fin = r)), () => lent++, 3_000, m);
    expect(m.taches[0]!.ms).toBe(3_000);
    m.taches[0]!.fn(); // 3 s passent
    expect(lent).toBe(1);
    fin("ok");
    expect(await p).toBe("ok");
    expect(m.taches[0]!.vivante).toBe(false);
  });
  it("une réponse rapide ne déclenche rien", async () => {
    const m = fausse();
    let lent = 0;
    expect(await avecAttente(Promise.resolve(1), () => lent++, 3_000, m)).toBe(1);
    expect(m.taches[0]!.vivante).toBe(false);
    expect(lent).toBe(0);
  });
});

describe("lot D2 — onglet périmé", () => {
  it("version, sim_version et track_mismatch seulement", () => {
    for (const c of ["version", "sim_version", "track_mismatch"]) expect(estOngletPerime(c)).toBe(true);
    for (const c of ["replay_copy", "invalid_replay", "day_closed", "not_finished", undefined]) expect(estOngletPerime(c)).toBe(false);
  });
  it("détecte une version différente, ignore un serveur muet ou une clé inconnue", () => {
    const moi = { simVersion: 5, generatorVersion: 3 };
    expect(versionsDifferent(moi, { simVersion: 5, generatorVersion: 3 })).toBe(false);
    expect(versionsDifferent(moi, { simVersion: 6, generatorVersion: 3 })).toBe(true);
    expect(versionsDifferent(moi, { simVersion: 5, generatorVersion: 4 })).toBe(true);
    expect(versionsDifferent(moi, null)).toBe(false);
    expect(versionsDifferent(moi, { autre: 9 })).toBe(false);
  });
  it("lit les versions d'une réponse d'info", () => {
    expect(versionsDeReponse({ ok: true, data: { simVersion: 5, generatorVersion: 3, today: "x" } })).toEqual({ simVersion: 5, generatorVersion: 3 });
    expect(versionsDeReponse({ ok: false, status: 0, code: "timeout", message: "" })).toBeNull();
    expect(versionsDeReponse({ ok: true, data: { today: "x" } })).toBeNull();
  });
});

describe("lot D2 — ?debug&simuler=", () => {
  it("n'existe pas en production ni sans ?debug", () => {
    expect(lireSimuler("?debug&simuler=lent", true)).toBeNull();
    expect(lireSimuler("?simuler=lent", false)).toBeNull();
    expect(lireSimuler("?debug&simuler=lent", false)).toBe("lent");
    expect(lireSimuler("?debug&simuler=perime", false)).toBe("perime");
    expect(lireSimuler("?debug&simuler=autre", false)).toBeNull();
  });
  it("lent retarde de 12 s le seul POST …/submit", async () => {
    const vu: string[] = [];
    const vrai = async (u: string) => (vu.push(u), new Response("{}"));
    const attentes: number[] = [];
    const f = simulerFetch(vrai, "lent", async (ms) => void attentes.push(ms));
    await f("/api/jump/submit", { method: "POST" });
    await f("/api/jump/info");
    expect(attentes).toEqual([DELAI_SIMULE_MS]);
    expect(vu).toHaveLength(2);
  });
  it("perime annonce une version de plus pour info et health seulement", async () => {
    const vrai = async (u: string) => new Response(JSON.stringify({ simVersion: 5, generatorVersion: 3, u }));
    const f = simulerFetch(vrai, "perime");
    expect(await (await f("/api/tower/info")).json()).toMatchObject({ simVersion: 6, generatorVersion: 4 });
    expect(await (await f("/api/health")).json()).toMatchObject({ simVersion: 6 });
    expect(await (await f("/api/jump/day/2026-01-01")).json()).toMatchObject({ simVersion: 5 });
  });
});
