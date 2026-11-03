import { afterEach, describe, expect, it, vi } from "vitest";
import { dateDemandable, lireFichierDeJour } from "../src/jour";

afterEach(() => vi.unstubAllGlobals());

describe("la lecture d'un jour figé", () => {
  it("en production, seule la liste écrite à la construction décide ; ailleurs on essaie toujours", () => {
    expect(dateDemandable("2026-11-03", true, ["2026-11-02"])).toBe(false);
    expect(dateDemandable("2026-11-02", true, ["2026-11-02"])).toBe(true);
    expect(dateDemandable("2026-11-03", false, [])).toBe(true);
  });
  it("lit <dossier>/<date>.json à côté de la page, sans cache", async () => {
    const appels: { url: string; cache?: string }[] = [];
    vi.stubGlobal("fetch", async (u: URL, init: RequestInit) => {
      appels.push({ url: u.href, cache: init.cache });
      return { ok: true, json: async () => ({ a: 1 }) };
    });
    expect(await lireFichierDeJour("jours", "2026-11-02", "https://playdujour.com/tower/", 4000)).toEqual({ a: 1 });
    expect(appels).toEqual([{ url: "https://playdujour.com/tower/jours/2026-11-02.json", cache: "no-cache" }]);
  });
  it("null s'il manque, n'est pas du JSON ou si le réseau échoue", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false }));
    expect(await lireFichierDeJour("levels", "2026-11-02", "https://x/", 10)).toBeNull();
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => { throw new Error("pas du JSON"); } }));
    expect(await lireFichierDeJour("levels", "2026-11-02", "https://x/", 10)).toBeNull();
    vi.stubGlobal("fetch", async () => { throw new Error("réseau"); });
    expect(await lireFichierDeJour("levels", "2026-11-02", "https://x/", 10)).toBeNull();
  });
  it("null si le fichier tarde plus que le délai", async () => {
    vi.stubGlobal("fetch", (_u: URL, init: RequestInit) => new Promise((_ok, ko) => init.signal?.addEventListener("abort", () => ko(new Error("abandon")))));
    expect(await lireFichierDeJour("levels", "2026-11-02", "https://x/", 5)).toBeNull();
  });
});
