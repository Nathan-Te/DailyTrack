import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gameStorage, namespacePrefix, PREVIEW_PREFIX, prefixedStorage, STORAGE_PREFIX, storageKey } from "../src/stockage";

// Lot T4 — le seul point d'accès au stockage du navigateur : `gameStorage()`, préfixe `tower:` (et `apercu:tower:` en développement local), sur le modèle de Jump.
const SRC = join(__dirname, "../src");

function memoire(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
  } as Storage;
}

describe("le stockage de Tower", () => {
  it("les clés de Tower portent le préfixe tower: ; l'aperçu local ajoute apercu:", () => {
    expect(STORAGE_PREFIX).toBe("tower:");
    expect(storageKey("records")).toBe("tower:records");
    expect(PREVIEW_PREFIX).toBe("apercu:");
  });

  it("le préfixe physique : production = aucun ; toute autre valeur (faute de frappe comprise) = apercu: ; serveur de développement = apercu: ; construction et Vitest = aucun", () => {
    expect(namespacePrefix("production", "production")).toBe("");
    expect(namespacePrefix("apercu", "production")).toBe("apercu:");
    expect(namespacePrefix("prodution", "production")).toBe("apercu:");
    expect(namespacePrefix(undefined, "development")).toBe("apercu:");
    expect(namespacePrefix(undefined, "production")).toBe("");
    expect(namespacePrefix(undefined, "test")).toBe("");
  });

  it("un stockage préfixé ne voit et ne touche que ses clés (celles de la production restent intactes)", () => {
    const dur = memoire();
    dur.setItem("tower:records", "prod");
    const apercu = prefixedStorage(dur, "apercu:");
    apercu.setItem("tower:records", "essai");
    expect(dur.getItem("tower:records")).toBe("prod");
    expect(dur.getItem("apercu:tower:records")).toBe("essai");
    expect(apercu.getItem("tower:records")).toBe("essai");
    expect(apercu.length).toBe(1);
    expect(apercu.key(0)).toBe("tower:records");
    apercu.clear();
    expect(dur.getItem("tower:records")).toBe("prod");
    expect(dur.getItem("apercu:tower:records")).toBeNull();
  });

  it("sans stockage (Node, navigation privée stricte) gameStorage() rend null, jamais une exception", () => {
    expect(gameStorage()).toBeNull();
  });

  it("aucun autre fichier de src/ ne touche localStorage, sessionStorage ni indexedDB directement", () => {
    for (const f of readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((x) => x.endsWith(".ts") && x !== "stockage.ts" && !x.startsWith("banc/"))) {
      const code = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, f).not.toMatch(/\b(localStorage|sessionStorage|indexedDB)\b/);
    }
  });
});
