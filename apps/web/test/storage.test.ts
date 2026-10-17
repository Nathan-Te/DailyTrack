import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PREVIEW_PREFIX, STORAGE_PREFIX, gameStorage, prefixedStorage, storageKeys, storagePrefix } from "../src/storage";

// Lot R1 (plateforme) : les aperçus de branche ont leur propre stockage. Voir src/storage.ts.

/** Un `localStorage` en mémoire, dans l'ordre d'insertion. */
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

describe("préfixe du stockage, fixé à la construction", () => {
  it("production : aucun préfixe (les clés des joueurs ne changent pas)", () => {
    expect(storagePrefix("production", "production")).toBe("");
  });

  it("aperçu de branche et serveur de développement : `apercu:`", () => {
    expect(PREVIEW_PREFIX).toBe("apercu:");
    expect(storagePrefix("apercu", "production")).toBe("apercu:");
    expect(storagePrefix(undefined, "development")).toBe("apercu:");
    expect(storagePrefix("", "development")).toBe("apercu:");
  });

  it("une valeur inconnue (faute de frappe) donne le préfixe, jamais les clés de la production", () => {
    expect(storagePrefix("prod", "production")).toBe("apercu:");
    expect(storagePrefix("Production", "production")).toBe("apercu:");
  });

  it("sans variable, une construction (`vite build` des tests e2e) et Vitest gardent les clés de la production", () => {
    expect(storagePrefix(undefined, "production")).toBe("");
    expect(storagePrefix(undefined, "test")).toBe("");
    expect(storagePrefix(undefined, undefined)).toBe("");
    expect(STORAGE_PREFIX).toBe(""); // ici : Vitest
  });
});

describe("stockage préfixé", () => {
  it("lit et écrit sous le préfixe, sans jamais toucher aux clés de la production", () => {
    const backing = memoryStorage({ "cdj:player": "id-de-production", "cdj:best:x": "1", autre: "z" });
    const s = prefixedStorage(backing, "apercu:");
    expect(s.getItem("cdj:player")).toBeNull();
    s.setItem("cdj:player", "id-d-apercu");
    expect(s.getItem("cdj:player")).toBe("id-d-apercu");
    expect(backing.map.get("cdj:player")).toBe("id-de-production");
    expect(backing.map.get("apercu:cdj:player")).toBe("id-d-apercu");
    s.removeItem("cdj:best:x");
    expect(backing.map.get("cdj:best:x")).toBe("1");
  });

  it("`key` et `length` ne voient que ses propres clés, sans le préfixe", () => {
    const backing = memoryStorage({ "cdj:player": "p", "apercu:cdj:a": "1", "jump:x": "2", "apercu:jump:y": "3" });
    const s = prefixedStorage(backing, "apercu:");
    expect(s.length).toBe(2);
    expect(storageKeys(s)).toEqual(["cdj:a", "jump:y"]);
    expect(s.key(5)).toBeNull();
    s.clear();
    expect([...backing.map.keys()]).toEqual(["cdj:player", "jump:x"]);
  });

  it("sans préfixe, c'est le stockage lui-même", () => {
    const backing = memoryStorage();
    expect(prefixedStorage(backing, "")).toBe(backing);
  });

  it("`gameStorage()` relit `localStorage` à chaque appel (les tests le remplacent)", () => {
    const g = globalThis as { localStorage?: unknown };
    const saved = g.localStorage;
    const a = memoryStorage();
    g.localStorage = a;
    try {
      expect(gameStorage()).toBe(a);
    } finally {
      g.localStorage = saved;
    }
  });
});

describe("un seul point d'accès au stockage", () => {
  // Tout fichier de src/ (sauf storage.ts) qui écrirait `localStorage` contournerait le préfixe des aperçus : il écrirait dans le stockage
  // de la production depuis un aperçu de branche. Les commentaires ne comptent pas.
  it("aucun fichier de src/ n'appelle `localStorage` ni `sessionStorage` directement", () => {
    const dir = join(__dirname, "../src");
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs|html)$/.test(e.name) && e.name !== "storage.ts") {
          const code = readFileSync(p, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1");
          if (/\b(localStorage|sessionStorage)\b/.test(code)) offenders.push(p.slice(dir.length + 1));
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });

  it("les pages HTML du jeu n'y touchent pas non plus", () => {
    const root = join(__dirname, "..");
    const pages = readdirSync(root).filter((f) => f.endsWith(".html")).map((f) => join(root, f));
    for (const sub of ["admin"]) {
      try {
        pages.push(...readdirSync(join(root, sub)).filter((f) => f.endsWith(".html")).map((f) => join(root, sub, f)));
      } catch {
        /* pas de sous-page */
      }
    }
    expect(pages.length).toBeGreaterThan(0);
    for (const p of pages) expect(readFileSync(p, "utf8"), p).not.toMatch(/\b(localStorage|sessionStorage)\b/);
  });
});
