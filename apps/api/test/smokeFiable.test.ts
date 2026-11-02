import { describe, expect, it } from "vitest";
import { ESSAIS_MAX, aReessayer, fetchFiable, lireJson, pauseAvant, type FetchLike } from "../scripts/appelFiable";

// Le smoke de la recette ne plante plus sur un refus passager de l'infrastructure (« Rate exceeded. » en texte brut, 2/11/2026) : il réessaie ce qui peut l'être, jamais un envoi
// qui aurait pu être traité, et dit la vraie réponse quand ce n'est pas du JSON. Sans réseau : `fetch` et l'attente sont des faux.
const rep = (statut: number, corps = "{}", entetes: Record<string, string> = {}) => new Response(corps, { status: statut, headers: entetes });
const sequence = (...r: (Response | Error)[]) => {
  const appels: string[] = [];
  const f: FetchLike = async (url, init) => {
    appels.push(`${init?.method ?? "GET"} ${url}`);
    const suivante = r[Math.min(appels.length - 1, r.length - 1)]!;
    if (suivante instanceof Error) throw suivante;
    return suivante.clone();
  };
  return { f, appels };
};
const pauses: number[] = [];
const dormir = async (ms: number) => void pauses.push(ms);
const U = "https://api.test/api/health";

describe("ce qui se réessaie", () => {
  it("429 pour toute méthode ; 502, 503, 504 et la coupure réseau pour un GET seulement", () => {
    for (const m of ["GET", "POST", "PUT"]) expect(aReessayer(m, 429), m).toBe(true);
    for (const s of [502, 503, 504, null]) {
      expect(aReessayer("GET", s), String(s)).toBe(true);
      expect(aReessayer("POST", s), `POST ${s}`).toBe(false); // un envoi peut avoir été traité : jamais rejoué
    }
    for (const s of [200, 400, 404, 409, 500]) expect(aReessayer("GET", s), String(s)).toBe(false);
  });
  it("la pause : celle du rang, ou Retry-After en secondes, jamais plus de 10 s", () => {
    expect([0, 1, 2, 3, 9].map((i) => pauseAvant(i, null))).toEqual([1000, 2000, 4000, 4000, 4000]);
    expect(pauseAvant(0, "3")).toBe(3000);
    expect(pauseAvant(0, "999")).toBe(10_000);
    expect(pauseAvant(1, "demain")).toBe(2000);
  });
});

describe("fetchFiable", () => {
  it("un « Rate exceeded. » (429) puis une vraie réponse : la vraie réponse est rendue, avec la pause entre les deux", async () => {
    pauses.length = 0;
    const { f, appels } = sequence(rep(429, "Rate exceeded."), rep(200, '{"ok":true}'));
    const lignes: string[] = [];
    const r = await fetchFiable(f, U, {}, { dormir, journal: (l) => lignes.push(l) });
    expect(r.status).toBe(200);
    expect(appels).toHaveLength(2);
    expect(pauses).toEqual([1000]);
    expect(lignes[0]).toContain("GET /api/health : statut 429");
  });
  it("un GET coupé par le réseau ou en 503 est réessayé ; au bout de 4 essais la dernière réponse est rendue telle quelle", async () => {
    pauses.length = 0;
    const a = sequence(new TypeError("fetch failed"), rep(503), rep(200));
    expect((await fetchFiable(a.f, U, {}, { dormir })).status).toBe(200);
    expect(a.appels).toHaveLength(3);
    pauses.length = 0;
    const b = sequence(rep(429, "Rate exceeded."));
    const r = await fetchFiable(b.f, U, {}, { dormir });
    expect(r.status).toBe(429);
    expect(b.appels).toHaveLength(ESSAIS_MAX);
    expect(pauses).toEqual([1000, 2000, 4000]);
    const c = sequence(new TypeError("fetch failed"));
    await expect(fetchFiable(c.f, U, {}, { dormir })).rejects.toThrow("fetch failed");
    expect(c.appels).toHaveLength(ESSAIS_MAX);
  });
  it("un envoi (POST) n'est réessayé que sur un 429, jamais sur un 502, 503, 504 ni une coupure", async () => {
    for (const refus of [rep(502), rep(503), rep(504), new TypeError("fetch failed")]) {
      const { f, appels } = sequence(refus, rep(200));
      if (refus instanceof Error) await expect(fetchFiable(f, U, { method: "POST" }, { dormir })).rejects.toThrow();
      else expect((await fetchFiable(f, U, { method: "POST" }, { dormir })).status).toBe(refus.status);
      expect(appels).toHaveLength(1);
    }
    const { f, appels } = sequence(rep(429, "Rate exceeded."), rep(200));
    expect((await fetchFiable(f, U, { method: "POST" }, { dormir })).status).toBe(200);
    expect(appels).toHaveLength(2);
  });
  it("un refus de notre API (400, 404, 409, 500) n'est jamais réessayé : c'est une réponse", async () => {
    for (const s of [400, 404, 409, 410, 500]) {
      const { f, appels } = sequence(rep(s));
      expect((await fetchFiable(f, U, {}, { dormir })).status).toBe(s);
      expect(appels).toHaveLength(1);
    }
  });
  it("Retry-After est honoré", async () => {
    pauses.length = 0;
    const { f } = sequence(rep(429, "x", { "Retry-After": "2" }), rep(200));
    await fetchFiable(f, U, {}, { dormir });
    expect(pauses).toEqual([2000]);
  });
});

describe("lireJson", () => {
  it("du JSON : lu", async () => {
    expect(await lireJson(rep(200, '{"a":1}'), "GET", U)).toEqual({ a: 1 });
  });
  it("« Rate exceeded. » : une erreur qui nomme la route, le statut et le début du corps, pas une SyntaxError", async () => {
    const e = await lireJson(rep(429, "Rate exceeded."), "GET", U).catch((x: Error) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(SyntaxError);
    expect((e as Error).message).toContain("GET /api/health");
    expect((e as Error).message).toContain("429");
    expect((e as Error).message).toContain("Rate exceeded.");
  });
  it("un corps énorme est coupé à 80 caractères", async () => {
    const e = (await lireJson(rep(502, "<html>" + "x".repeat(5000)), "GET", U).catch((x: Error) => x)) as Error;
    expect(e.message.length).toBeLessThan(300);
  });
});
