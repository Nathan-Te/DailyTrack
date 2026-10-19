import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAMESPACE_PREFIX, PREVIEW_PREFIX, STORAGE_PREFIX, gameStorage, namespacePrefix, prefixedStorage, storageKey } from "../src/storage";

// Lot R1 (plateforme) : les aperçus de branche ont leur propre stockage. Même règle que DailyTrack (apps/web/test/storage.test.ts).

function memoryStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("préfixe du stockage de DailyJump", () => {
  it("les clés logiques restent `jump:*`", () => {
    expect(STORAGE_PREFIX).toBe("jump:");
    expect(storageKey("historique")).toBe("jump:historique");
  });

  it("production : aucun préfixe ; aperçu et développement : `apercu:` (le même que DailyTrack)", () => {
    expect(PREVIEW_PREFIX).toBe("apercu:");
    expect(namespacePrefix("production", "production")).toBe("");
    expect(namespacePrefix("apercu", "production")).toBe("apercu:");
    expect(namespacePrefix(undefined, "development")).toBe("apercu:");
    expect(namespacePrefix("prod", "production")).toBe("apercu:"); // faute de frappe : jamais les clés de la production
    expect(namespacePrefix(undefined, "production")).toBe(""); // `vite build` des tests e2e
    expect(NAMESPACE_PREFIX).toBe(""); // ici : Vitest
  });

  it("un aperçu lit et écrit `apercu:jump:*` et ne voit jamais `jump:*` de la production", () => {
    const backing = memoryStorage({ "jump:historique": "prod", "apercu:jump:settings": "a", "cdj:player": "p" });
    const s = prefixedStorage(backing, "apercu:");
    expect(s.getItem("jump:historique")).toBeNull();
    s.setItem("jump:historique", "apercu");
    expect(backing.map.get("jump:historique")).toBe("prod");
    expect(backing.map.get("apercu:jump:historique")).toBe("apercu");
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) keys.push(s.key(i)!);
    expect(keys).toEqual(["jump:settings", "jump:historique"]);
    s.clear();
    expect([...backing.map.keys()]).toEqual(["jump:historique", "cdj:player"]);
  });

  it("`gameStorage()` : null sans stockage lisible, sinon `localStorage` lui-même en production", () => {
    const g = globalThis as { localStorage?: unknown };
    const saved = g.localStorage;
    try {
      delete g.localStorage;
      expect(gameStorage()).toBeNull();
      g.localStorage = {
        get length(): number {
          throw new Error("SecurityError");
        },
      };
      expect(gameStorage()).toBeNull();
      const a = memoryStorage();
      g.localStorage = a;
      expect(gameStorage()).toBe(a);
    } finally {
      g.localStorage = saved;
    }
  });
});

describe("un seul point d'accès au stockage", () => {
  it("aucun fichier de src/ ni page HTML n'appelle `localStorage` ni `sessionStorage` directement", () => {
    const root = join(__dirname, "..");
    const files: string[] = readdirSync(root).filter((f) => f.endsWith(".html")).map((f) => join(root, f));
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && e.name !== "storage.ts") files.push(p);
      }
    };
    walk(join(root, "src"));
    const offenders = files.filter((p) => {
      const code = readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      return /\b(localStorage|sessionStorage)\b/.test(code);
    });
    expect(files.length).toBeGreaterThan(10);
    expect(offenders.map((p) => p.slice(root.length + 1))).toEqual([]);
  });
});
