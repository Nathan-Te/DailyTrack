import { describe, expect, it } from "vitest";
import { IDENTITY_CODE_REV_KEY, collectMigration, migrationFragment } from "@cdj/profile";
import { SEEN_IDENTITY_KEY } from "../src/transfer";
import { importFromOldAddress, type MigrationPage } from "../src/migration";

// Lot R4 (plateforme) : DailyTrack à l'arrivée depuis l'ancienne adresse (GitHub Pages) — le fragment est effacé de l'adresse aussitôt, puis
// importé (règles de `@cdj/profile`, testées dans packages/profile/test/migration.test.ts). Ici : le branchement sur les règles de DailyTrack.

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
  };
}

const OLD = "0123456789abcdef0123456789abcdef";
const HERE = "ffffffffffffffffffffffffffffffff";
const fragment = migrationFragment(collectMigration(memory({ "cdj:player": OLD, "cdj:name": "Pilote" }))!);

function page(hash: string, answer: boolean): MigrationPage & { urls: string[]; questions: string[] } {
  const p = {
    urls: [] as string[],
    questions: [] as string[],
    address: { pathname: "/track/", search: "?seed=2026-10-20", hash },
    replaceUrl: (u: string) => void p.urls.push(u),
    ask: (q: string) => (p.questions.push(q), answer),
  };
  return p;
}

describe("DailyTrack : import depuis l'ancienne adresse", () => {
  it("pas d'identité : importée sans question, fragment effacé (paramètres gardés)", () => {
    const s = memory();
    const p = page(fragment, false);
    expect(importFromOldAddress(s, "2026-10-20", p)).toBe("importe");
    expect(s.getItem("cdj:player")).toBe(OLD);
    expect(p.urls).toEqual(["/track/?seed=2026-10-20"]);
    expect(p.questions).toEqual([]);
  });

  it("autre identité, prise : la règle d'un code chargé ici (cache des records vidé, révision « code » avancée et vue)", () => {
    const s = memory({ "cdj:player": HERE, "cdj:name": "Ici", "cdj:best:jour-2026-10-13-g15": "{}", "cdj:audio": "{}" });
    const p = page(fragment, true);
    expect(importFromOldAddress(s, "2026-10-20", p)).toBe("importe");
    expect(p.questions[0]).toContain("« Ici »");
    expect(s.getItem("cdj:player")).toBe(OLD);
    expect(s.getItem("cdj:name")).toBe("Pilote");
    expect(s.getItem("cdj:best:jour-2026-10-13-g15")).toBeNull();
    expect(s.getItem("cdj:audio")).toBe("{}");
    expect(s.getItem(IDENTITY_CODE_REV_KEY)).toBe(s.getItem(SEEN_IDENTITY_KEY));
  });

  it("autre identité, gardée : rien ne bouge", () => {
    const s = memory({ "cdj:player": HERE, "cdj:best:jour-2026-10-13-g15": "{}" });
    expect(importFromOldAddress(s, "2026-10-20", page(fragment, false))).toBe("garde");
    expect(s.getItem("cdj:player")).toBe(HERE);
    expect(s.getItem("cdj:best:jour-2026-10-13-g15")).toBe("{}");
  });

  it("sans fragment : rien, l'adresse n'est pas touchée", () => {
    const p = page("", true);
    expect(importFromOldAddress(memory(), "2026-10-20", p)).toBe("absent");
    expect(p.urls).toEqual([]);
  });
});
