import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import { MODULES, dailyLevel, freezeLevel, frozenJson } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { generatePayload } from "../src/dailyGen";
import { originLine } from "../src/dailyInfo";
import { loadDaily, type LoaderOptions, type WorkerLike } from "../src/dailyLoader";
import type { KeyValue } from "../src/memory";
import { MODULE_INDEX } from "../src/moduleIndex";
import { URL_OPTIONS, readUrlOptions } from "../src/urlOptions";
import type { WorkerReply, WorkerRequest } from "../src/dailyWorker";

// Lot 21 : le catalogue des morceaux et le générateur ne sont pas dans le premier chargement. Avec un niveau figé, la partie ne les charge pas ; sinon ils sont
// chargés à la demande (par le worker, ou à son défaut sur le fil principal) et le niveau est exactement celui d'avant. La construction elle-même (que le premier
// chargement ne contient pas le catalogue) est vérifiée par `e2e/poids.spec.ts`.

class MemStore implements KeyValue {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

const GOLDEN = JSON.parse(readFileSync(join(import.meta.dirname, "../../../packages/jump-sim/test/fixtures/daily-golden-v13.json"), "utf8")) as {
  days: Record<string, { id: string; hash: string; code: string; authorTicks: number; medals: Record<string, number> }>;
};
const DATE = "2026-11-03";
const DAY = parseDay(DATE)!;
const TODAY = "2026-10-20";

/** Un worker qui compte ses appels et répond comme le vrai (la charge de `generatePayload`), ou échoue. */
class CountingWorker implements WorkerLike {
  static created = 0;
  static asked = 0;
  onmessage: ((e: { data: WorkerReply }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: ((e: unknown) => void) | null = null;
  constructor(private readonly fails = false) {
    CountingWorker.created++;
  }
  postMessage(m: WorkerRequest) {
    CountingWorker.asked++;
    queueMicrotask(() => (this.fails ? this.onerror?.(new Error("script non chargé")) : this.onmessage?.({ data: structuredClone({ ok: true, payload: generatePayload(m.day, m.theme ?? null) } satisfies WorkerReply) })));
  }
  terminate() {}
}

const options = (extra: Partial<LoaderOptions> = {}): LoaderOptions => ({ store: new MemStore(), today: TODAY, ...extra });

describe("avec un fichier figé, ni catalogue ni générateur", () => {
  const frozen = JSON.parse(frozenJson(freezeLevel(dailyLevel(DAY)))) as unknown;

  it("le fichier est lu et sa preuve rejouée ; le worker n'est pas créé, le générateur n'est pas appelé, le catalogue n'est pas chargé", async () => {
    let generated = 0;
    CountingWorker.created = 0;
    const load = await loadDaily(DAY, options({
      frozen: { days: [DATE], read: async () => frozen },
      makeWorker: () => new CountingWorker(),
      generate: async () => {
        generated++;
        throw new Error("le générateur ne doit pas être demandé");
      },
    }));
    expect(load).toMatchObject({ source: "fige", generated: false, catalog: "non", frozenMiss: "" });
    expect(CountingWorker.created).toBe(0);
    expect(generated).toBe(0);
    expect(load.level.hash).toBe(GOLDEN.days[DATE]!.hash);
  });

  it("le cache valide non plus ne charge rien : le catalogue reste « non »", async () => {
    const store = new MemStore();
    const first = await loadDaily(DAY, options({ store, makeWorker: () => new CountingWorker() }));
    expect(first).toMatchObject({ source: "worker", catalog: "worker" });
    CountingWorker.created = 0;
    const second = await loadDaily(DAY, options({ store, makeWorker: () => new CountingWorker() }));
    expect(second).toMatchObject({ source: "cache", generated: false, catalog: "non" });
    expect(CountingWorker.created).toBe(0);
  });
});

describe("sans fichier figé, le niveau est celui d'avant le lot, au bit près", () => {
  for (const date of ["2026-11-03", "2027-03-28"]) {
    const day = parseDay(date)!;
    const g = GOLDEN.days[date]!;
    const same = (load: Awaited<ReturnType<typeof loadDaily>>) => {
      expect(load.level.id).toBe(g.id);
      expect(load.level.hash).toBe(g.hash);
      expect(load.level.code).toBe(g.code);
      expect(load.level.authorTicks).toBe(g.authorTicks);
      expect(load.level.medals).toEqual(g.medals);
    };

    it(`${date} : par le worker (le catalogue est chargé dans le worker) = la référence`, async () => {
      same(await loadDaily(day, options({ makeWorker: () => new CountingWorker() })).then((l) => (expect(l).toMatchObject({ source: "worker", catalog: "worker", generated: true }), l)));
    });

    it(`${date} : sans worker, le générateur est chargé à la demande puis calculé sur le fil principal = la référence`, async () => {
      let asked = 0;
      const load = await loadDaily(day, options({ generate: async (d, t) => (asked++, generatePayload(d, t)) }));
      expect(asked).toBe(1);
      expect(load).toMatchObject({ source: "principal", catalog: "principal", generated: true });
      same(load);
    });

    it(`${date} : sans rien d'injecté, le repli charge lui-même le générateur (import à la demande) = la référence`, async () => {
      const load = await loadDaily(day, options());
      expect(load).toMatchObject({ source: "principal", catalog: "principal" });
      same(load);
    });
  }
});

describe("le repli reste fiable", () => {
  it("le fichier figé n'arrive pas (absent, illisible, réseau muet) : le niveau est généré, avec la raison", async () => {
    for (const read of [async () => null, async () => "<!doctype html>", async () => { throw new Error("réseau"); }]) {
      const load = await loadDaily(DAY, options({ frozen: { days: [DATE], read }, makeWorker: () => new CountingWorker() }));
      expect(load.source).toBe("worker");
      expect(load.catalog).toBe("worker");
      expect(load.frozenMiss).not.toBe("");
      expect(load.level.hash).toBe(GOLDEN.days[DATE]!.hash);
    }
  });

  it("le worker échoue : le repli charge le générateur sur le fil principal, même niveau", async () => {
    const load = await loadDaily(DAY, options({ frozen: { days: [DATE], read: async () => null }, makeWorker: () => new CountingWorker(true) }));
    expect(load).toMatchObject({ source: "principal", catalog: "principal", frozenMiss: "fichier absent" });
    expect(load.level.hash).toBe(GOLDEN.days[DATE]!.hash);
  });
});

describe("la ligne « origine » de ?debug", () => {
  it("dit d'où vient le niveau et si le catalogue a été chargé", () => {
    expect(originLine({ source: "fige", catalog: "non" }, false)).toBe("origine   fichier figé, catalogue non chargé");
    expect(originLine({ source: "cache", catalog: "non" }, false)).toBe("origine   cache, catalogue non chargé");
    expect(originLine({ source: "worker", catalog: "worker" }, false)).toBe("origine   généré (worker), catalogue chargé (worker)");
    expect(originLine({ source: "principal", catalog: "principal" }, false)).toBe("origine   généré (fil principal), catalogue chargé");
    expect(originLine(null, false)).toBe("origine   scénario, catalogue non chargé");
    expect(originLine(null, true)).toBe("origine   morceau du catalogue, catalogue chargé");
  });
});

describe("l'index léger des morceaux (lire l'adresse ne charge pas le catalogue)", () => {
  it("il a les mêmes morceaux, dans le même ordre, avec le même nombre de variantes que le catalogue", () => {
    expect(MODULE_INDEX.map(([id, n]) => [id, n])).toEqual(MODULES.map((m) => [m.id, m.variants.length]));
  });

  it("`?module=` et `?variante=` se lisent comme avec le catalogue", () => {
    const [id, n] = MODULE_INDEX[0]!;
    expect(readUrlOptions(`?module=${id}&variante=${n - 1}`).module).toMatchObject({ id, variant: n - 1 });
    expect(readUrlOptions(`?module=${id}&variante=${n}`).module!.variant).toBe(0);
    expect(readUrlOptions("?module=inconnu").module).toBeNull();
    expect(URL_OPTIONS.find((o) => o.name === "module")!.values).toEqual(MODULE_INDEX.map(([i]) => i));
  });
});
