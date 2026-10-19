import { describe, expect, it } from "vitest";
import { isValidName, normalizeName } from "../src/index";

// « pseudo » : déplacé d'`apps/web/test/api.test.ts` au lot P0 (plateforme), assertions inchangées.

describe("pseudo", () => {
  it("applique les mêmes règles que le serveur", () => {
    for (const ok of ["Alice", "Zoé d'Arc-2", "a", "x".repeat(20), "  Bob  ", "Léa_B.", "日本語"]) expect(isValidName(ok), ok).toBe(true);
    for (const bad of ["", "   ", "x".repeat(21), "<script>", "-Alice", "A\u0000B", "😀", "a/b"]) expect(isValidName(bad), bad).toBe(false);
  });

  it("normalise les espaces", () => {
    expect(normalizeName("  Zoé    d'Arc ")).toBe("Zoé d'Arc");
  });
});

// --- Lot P0 : l'identité de la plateforme, stockage injecté ----------------------------------------------------------------------
import { NAME_KEY, NEXT_KEY, PLAYER_KEY, createIdentity, readIdentity, writeIdentity } from "../src/index";

function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
const ID = "0123456789abcdef0123456789abcdef";

describe("identité de la plateforme (clés cdj:*, stockage injecté)", () => {
  it("garde les clés de DailyTrack : cdj:player, cdj:name, cdj:player:next", () => {
    expect([PLAYER_KEY, NAME_KEY, NEXT_KEY]).toEqual(["cdj:player", "cdj:name", "cdj:player:next"]);
  });

  it("crée l'identifiant au premier appel, puis le relit", () => {
    const s = memory();
    const id = createIdentity(() => s);
    const first = id.getPlayerId();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(s.getItem("cdj:player")).toBe(first);
    expect(createIdentity(() => s).getPlayerId()).toBe(first);
  });

  it("sans stockage (navigation privée stricte), l'identifiant vit en mémoire le temps de la page", () => {
    const id = createIdentity(() => {
      throw new Error("bloqué");
    });
    const first = id.getPlayerId();
    expect(id.getPlayerId()).toBe(first);
    expect(id.getName()).toBeNull();
    expect(() => id.setName("A")).not.toThrow();
  });

  it("un « Changer mon code » en cours garde le même nouvel identifiant jusqu'à la réponse", () => {
    const s = memory();
    const id = createIdentity(() => s);
    const next = id.takeNextId();
    expect(id.takeNextId()).toBe(next);
    expect(id.pendingNextId()).toBe(next);
    id.clearNextId();
    expect(id.pendingNextId()).toBeNull();
  });

  it("readIdentity dit seulement s'il existe une identité et son pseudo, sans rien créer", () => {
    expect(readIdentity(memory())).toEqual({ exists: false, name: null });
    expect(readIdentity(null)).toEqual({ exists: false, name: null });
    const s = memory({ "cdj:player": ID, "cdj:name": "Nowy" });
    expect(readIdentity(s)).toEqual({ exists: true, name: "Nowy" });
    expect(readIdentity(memory({ "cdj:player": "pas-un-id" }))).toEqual({ exists: false, name: null });
    expect(readIdentity({ getItem: () => { throw new Error("bloqué"); } })).toEqual({ exists: false, name: null });
    expect(Object.keys(s.dump())).toEqual(["cdj:player", "cdj:name"]);
  });

  it("writeIdentity remplace identifiant et pseudo, oublie le code en cours et les avis, ne touche à rien d'autre", () => {
    const s = memory({ "cdj:player": "f".repeat(32), "cdj:name": "Bob", "cdj:player:next": "e".repeat(32), "cdj:notice:rename": "x", "jump:settings": "{}", "cdj:best:jour-2026-10-20-g15": "{}" });
    writeIdentity({ id: ID, name: null }, s);
    expect(s.dump()).toEqual({ "cdj:player": ID, "jump:settings": "{}", "cdj:best:jour-2026-10-20-g15": "{}" });
    writeIdentity({ id: ID, name: "Alice" }, s);
    expect(s.getItem("cdj:name")).toBe("Alice");
  });
});
