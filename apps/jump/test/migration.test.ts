import { describe, expect, it } from "vitest";
import { IDENTITY_CODE_REV_KEY, NAME_KEY, PLAYER_KEY, collectMigration, migrationFragment } from "@cdj/profile";
import { History, readHistory, type DayRecord } from "../src/history";
import { JUMP_SEEN_IDENTITY_KEY } from "../src/jumpProfile";
import { importFromOldAddress, type MigrationPage } from "../src/migration";
import { QUEUE_KEY, RANKS_KEY } from "../src/rankQueue";

// Lot R4 (plateforme) : DailyJump à l'arrivée depuis l'ancienne adresse — fragment effacé aussitôt, identité et données locales du jour importées
// (règles de `@cdj/profile`, testées dans packages/profile/test/migration.test.ts). Ici : le branchement sur les règles de DailyJump.

class Mem {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

const OLD = "0123456789abcdef0123456789abcdef";
const old = new Mem();
old.setItem(PLAYER_KEY, OLD);
old.setItem(NAME_KEY, "Sauteur");
old.setItem(QUEUE_KEY, '{"date":"2026-10-20","ticks":4321}');
const fragment = migrationFragment(collectMigration(old)!);

function page(answer: boolean): MigrationPage & { urls: string[] } {
  const p = { urls: [] as string[], address: { pathname: "/jump/", search: "", hash: fragment }, replaceUrl: (u: string) => void p.urls.push(u), ask: () => answer };
  return p;
}
const rec = (d: string): DayRecord => ({ id: `jour-${d}-g9`, date: d, best: 3700, medal: "bronze", deaths: 3, attempts: 2 });

describe("DailyJump : import depuis l'ancienne adresse", () => {
  it("pas d'identité : identité et envoi en attente importés, fragment effacé", () => {
    const s = new Mem();
    const p = page(false);
    expect(importFromOldAddress(s, [], "2026-10-20", p)).toBe("importe");
    expect(s.getItem(PLAYER_KEY)).toBe(OLD);
    expect(s.getItem(QUEUE_KEY)).toContain("4321");
    expect(p.urls).toEqual(["/jump/"]);
  });

  it("autre identité, prise : la règle d'un code chargé ici (rangs et jours passés oubliés, aujourd'hui gardé)", () => {
    const s = new Mem();
    s.setItem(PLAYER_KEY, "1".repeat(32));
    s.setItem(RANKS_KEY, "{}");
    const h = new History(s);
    h.put(rec("2026-10-19"));
    h.put(rec("2026-10-20"));
    expect(importFromOldAddress(s, h.entries, "2026-10-20", page(true))).toBe("importe");
    expect(s.getItem(PLAYER_KEY)).toBe(OLD);
    expect(s.getItem(RANKS_KEY)).toBeNull();
    expect(readHistory(s).map((r) => r.date)).toEqual(["2026-10-20"]);
    expect(s.getItem(IDENTITY_CODE_REV_KEY)).toBe(s.getItem(JUMP_SEEN_IDENTITY_KEY));
  });
});
