import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILD_RESTRICTED, demoStorage, gameStorage, namespacePrefix, prefixedStorage, PREVIEW_PREFIX, type BackingStorage } from "../src/stockage";

// Le stockage préfixé des trois jeux (lot K3) : les cas qu'avaient les trois `storage.test.ts` d'avant.
class Faux implements BackingStorage {
  private m = new Map<string, string>();
  get length(): number { return this.m.size; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void { this.m.set(k, v); }
  removeItem(k: string): void { this.m.delete(k); }
}
afterEach(() => vi.unstubAllGlobals());

describe("le préfixe physique", () => {
  it("production : aucun ; une autre valeur : apercu: ; absente : développement seulement", () => {
    expect(namespacePrefix("production", "development")).toBe("");
    expect(namespacePrefix("apercu", "production")).toBe(PREVIEW_PREFIX);
    expect(namespacePrefix("faute", undefined)).toBe(PREVIEW_PREFIX); // une faute de frappe ne fait jamais écrire un aperçu dans la production
    expect(namespacePrefix(undefined, "development")).toBe(PREVIEW_PREFIX);
    expect(namespacePrefix(undefined, "production")).toBe("");
    expect(namespacePrefix(undefined, "test")).toBe("");
  });
});

describe("prefixedStorage", () => {
  it("sans préfixe, rend le stockage lui-même", () => {
    const f = new Faux();
    expect(prefixedStorage(f, "")).toBe(f);
  });
  it("ne voit que ses clés, rendues sans le préfixe, et n'efface que les siennes", () => {
    const f = new Faux();
    f.setItem("jump:x", "prod");
    const s = prefixedStorage(f, "apercu:");
    s.setItem("jump:x", "essai");
    s.setItem("jump:y", "2");
    expect(f.getItem("apercu:jump:x")).toBe("essai");
    expect(s.length).toBe(2);
    expect([s.key(0), s.key(1)]).toEqual(["jump:x", "jump:y"]);
    expect(s.key(2)).toBeNull();
    s.clear();
    expect(f.getItem("jump:x")).toBe("prod");
    expect(s.length).toBe(0);
  });
});

describe("gameStorage", () => {
  it("rend le stockage de la page, ou null s'il n'existe pas ou refuse", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(gameStorage()).toBeNull();
    const f = new Faux();
    vi.stubGlobal("localStorage", f);
    expect(gameStorage()).toBe(f); // Vitest : aucun préfixe physique
    vi.stubGlobal("localStorage", { get length(): number { throw new Error("refusé"); } });
    expect(gameStorage()).toBeNull();
  });
  it("la démonstration est à part (demo:)", () => {
    const f = new Faux();
    const d = demoStorage(f)!;
    d.setItem("jump:x", "1");
    expect(f.getItem("demo:jump:x")).toBe("1");
    expect(demoStorage(null)).toBeNull();
  });
  it("sous Vitest la construction n'est pas celle de la production", () => {
    expect(BUILD_RESTRICTED).toBe(false);
  });
});
