import { daysFromCivil } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, JUMP_THEME_NAMES, dailyLevel, dailyLevelId, jumpThemeForDay, replayAttempt } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { cacheKey, readCache, sweepCache, writeCache } from "../src/dailyCache";
import { loadDaily, type LoaderOptions, type WorkerLike } from "../src/dailyLoader";
import { fromPayload, toPayload } from "../src/dailyWork";
import { generatePayload } from "../src/dailyGen";
import type { KeyValue } from "../src/memory";
import type { WorkerReply, WorkerRequest } from "../src/dailyWorker";

// Lot 7b : le niveau du jour hors du fil principal (charge transportable, worker, cache à preuve rejouée, repli).

const DAYS = [daysFromCivil(2026, 10, 16), daysFromCivil(2026, 11, 2), daysFromCivil(2026, 12, 25), daysFromCivil(2027, 1, 19)];
const DAY = DAYS[0]!;
const TODAY = "2026-10-20";

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

const BROKEN: KeyValue = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
  key() {
    throw new Error("SecurityError");
  },
  get length(): number {
    throw new Error("SecurityError");
  },
};

/** Un faux worker : calcule la charge comme le vrai (`generatePayload`) et la renvoie par un clonage structuré, comme `postMessage`. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: WorkerReply }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessageerror: ((e: unknown) => void) | null = null;
  terminated = false;
  /** Lot 11 : les demandes reçues (jour, thème forcé). */
  readonly requests: WorkerRequest[] = [];
  constructor(private readonly mode: "ok" | "erreur" | "muet" | "echec" = "ok") {}
  postMessage(m: WorkerRequest): void {
    this.requests.push(m);
    if (this.mode === "muet") return;
    queueMicrotask(() => {
      if (this.mode === "erreur") this.onerror?.(new Error("script introuvable"));
      else if (this.mode === "echec") this.onmessage?.({ data: { ok: false, error: "boum" } });
      else this.onmessage?.({ data: structuredClone({ ok: true, payload: generatePayload(m.day, m.theme ?? null) } satisfies WorkerReply) });
    });
  }
  terminate(): void {
    this.terminated = true;
  }
}

function options(store: KeyValue | null, mode: ConstructorParameters<typeof FakeWorker>[0] | "aucun" = "ok", extra: Partial<LoaderOptions> = {}) {
  const made: FakeWorker[] = [];
  const shown: boolean[] = [];
  const opts: LoaderOptions = {
    store,
    today: TODAY,
    makeWorker: mode === "aucun" ? undefined : () => (made.push(new FakeWorker(mode)), made[made.length - 1]!),
    showProgress: (on) => shown.push(on),
    workerTimeoutMs: 50,
    ...extra,
  };
  return { opts, made, shown };
}

describe("charge transportable (worker et cache)", () => {
  it("le résultat du worker est identique à l'appel direct : même empreinte, même preuve, même composition", () => {
    for (const day of DAYS) {
      const direct = dailyLevel(day);
      const viaWorker = fromPayload(structuredClone(generatePayload(day)), day, { proof: true });
      expect(typeof viaWorker, `${day}`).not.toBe("string");
      const l = viaWorker as ReturnType<typeof dailyLevel>;
      expect(l.hash).toBe(direct.hash);
      expect(l.id).toBe(direct.id);
      expect(l.code).toBe(direct.code);
      expect(l.authorTicks).toBe(direct.authorTicks);
      expect(l.medals).toEqual(direct.medals);
      expect(l.level.tiles).toEqual(direct.level.tiles);
      expect(l.level.saws).toEqual(direct.level.saws);
      expect(l.level.checkpoints).toEqual(direct.level.checkpoints);
      expect(l.replay).toEqual(direct.replay);
      expect(toPayload(l)).toEqual(toPayload(direct));
      expect(l.pieces).toEqual(direct.pieces);
      expect(l.exigence).toEqual(direct.exigence);
      expect(l.number).toBe(direct.number);
      expect(l.date).toBe(direct.date);
    }
  }, 30_000); // lot 19 : le premier niveau se calcule à froid avec ses voisins de variété (jusqu'à 8 niveaux) ; 5,7 s mesuré sous charge

  it("la charge survit au JSON (c'est ce que le stockage garde) et la preuve se rejoue", () => {
    const p = JSON.parse(JSON.stringify(generatePayload(DAY)));
    const l = fromPayload(p, DAY, { proof: true });
    expect(typeof l).not.toBe("string");
    const level = l as ReturnType<typeof dailyLevel>;
    const r = replayAttempt(level.level, level.replay, level.id);
    expect(r.finished).toBe(true);
    expect(r.time).toBe(level.authorTicks);
  });

  it("une charge périmée, d'un autre jour, tronquée ou corrompue est refusée", () => {
    const p = generatePayload(DAY);
    expect(fromPayload({ ...p, generatorVersion: JUMP_GENERATOR_VERSION - 1 }, DAY, { proof: true })).toBe("autre version");
    expect(fromPayload({ ...p, simVersion: JUMP_SIM_VERSION + 1 }, DAY, { proof: true })).toBe("autre version");
    expect(fromPayload(p, DAY + 1, { proof: true })).toBe("autre niveau");
    expect(fromPayload({ ...p, ascii: p.ascii.replace("#", ".") }, DAY, { proof: true })).toBe("empreinte du niveau");
    expect(fromPayload({ ...p, code: p.code.slice(0, p.code.length >> 1) }, DAY, { proof: true })).toMatch(/preuve|illisible/);
    expect(fromPayload({ ...p, authorTicks: p.authorTicks - 1 }, DAY, { proof: true })).toBe("la preuve ne se rejoue pas");
    expect(fromPayload(null, DAY, { proof: true })).toBe("charge illisible");
    expect(fromPayload({ ...p, pieces: "x" }, DAY, { proof: true })).toBe("charge illisible");
  });
});

describe("cache du niveau du jour", () => {
  it("absence : le worker génère, le niveau est gardé ; lecture réussie ensuite sans nouvelle génération", async () => {
    const store = new MemStore();
    const a = options(store);
    const first = await loadDaily(DAY, a.opts);
    expect(first.source).toBe("worker");
    expect(first.generated).toBe(true);
    expect(a.made).toHaveLength(1);
    expect(a.made[0]!.terminated).toBe(true);
    expect(a.shown).toEqual([true, false]);
    expect(store.map.has(cacheKey(dailyLevelId(DAY)))).toBe(true);

    const b = options(store);
    const second = await loadDaily(DAY, b.opts);
    expect(second.source).toBe("cache");
    expect(second.generated).toBe(false);
    expect(b.made).toHaveLength(0);
    expect(b.shown).toEqual([]); // pas de « Préparation du niveau… » quand le cache sert
    expect(second.level.hash).toBe(first.level.hash);
    expect(second.level.hash).toBe(dailyLevel(DAY).hash);
  });

  it("version périmée : le cache est écarté et le niveau régénéré", async () => {
    const store = new MemStore();
    await loadDaily(DAY, options(store).opts);
    const key = cacheKey(dailyLevelId(DAY));
    const entry = JSON.parse(store.map.get(key)!);
    entry.payload.simVersion = JUMP_SIM_VERSION - 1;
    store.map.set(key, JSON.stringify(entry));
    const r = await loadDaily(DAY, options(store).opts);
    expect(r.source).toBe("worker");
    expect(r.cacheMiss).toBe("autre version");
    expect(JSON.parse(store.map.get(key)!).payload.simVersion).toBe(JUMP_SIM_VERSION);
  });

  it("preuve corrompue : elle est rejouée, échoue, et le niveau est régénéré (cache réécrit sain)", async () => {
    const store = new MemStore();
    await loadDaily(DAY, options(store).opts);
    const key = cacheKey(dailyLevelId(DAY));
    const entry = JSON.parse(store.map.get(key)!);
    entry.payload.authorTicks += 1; // une preuve qui ne donne plus le temps annoncé
    store.map.set(key, JSON.stringify(entry));
    const a = options(store);
    const r = await loadDaily(DAY, a.opts);
    expect(r.source).toBe("worker");
    expect(r.cacheMiss).toBe("la preuve ne se rejoue pas");
    expect(r.level.authorTicks).toBe(dailyLevel(DAY).authorTicks);
    const again = await loadDaily(DAY, options(store).opts);
    expect(again.source).toBe("cache");
  });

  it("contenu illisible ou inattendu dans le stockage : ignoré, niveau régénéré", async () => {
    for (const junk of ["{pas du json", "null", '{"stored":"2026-10-20","payload":{"format":1}}', '"texte"']) {
      const store = new MemStore();
      store.map.set(cacheKey(dailyLevelId(DAY)), junk);
      const r = await loadDaily(DAY, options(store).opts);
      expect(r.source, junk).toBe("worker");
      expect(r.level.hash).toBe(dailyLevel(DAY).hash);
    }
  });

  it("un stockage qui lève (lecture, écriture, énumération) ne casse pas le jeu ; sans stockage non plus", async () => {
    for (const store of [BROKEN, null]) {
      const r = await loadDaily(DAY, options(store).opts);
      expect(r.source).toBe("worker");
      expect(r.level.hash).toBe(dailyLevel(DAY).hash);
    }
    expect(readCache(BROKEN, "x", TODAY)).toBeNull();
    expect(writeCache(BROKEN, generatePayload(DAY), TODAY)).toBe(false);
    expect(() => sweepCache(BROKEN, TODAY)).not.toThrow();
  });

  it("purge : les entrées écrites un autre jour disparaissent, celles du jour restent ; la mémoire du jour retire aussi la sienne", async () => {
    const store = new MemStore();
    writeCache(store, generatePayload(DAYS[1]!), "2026-10-19");
    expect(store.length).toBe(1);
    await loadDaily(DAY, options(store).opts); // aujourd'hui = 2026-10-20 : l'entrée d'hier est balayée
    expect([...store.map.keys()]).toEqual([cacheKey(dailyLevelId(DAY))]);
    sweepCache(store, "2026-10-21");
    expect(store.length).toBe(0);
  });
});

describe("repli sans worker", () => {
  it("worker indisponible, qui lève, en erreur, qui échoue ou qui ne répond pas : la génération se fait sur le fil principal", async () => {
    const direct = dailyLevel(DAY);
    const cases: [string, LoaderOptions][] = [
      ["aucun", options(null, "aucun").opts],
      ["lève", { ...options(null).opts, makeWorker: () => { throw new Error("Worker is not defined"); } }],
      ["erreur", options(null, "erreur").opts],
      ["échec", options(null, "echec").opts],
      ["muet", options(null, "muet").opts],
    ];
    for (const [name, opts] of cases) {
      let painted = 0;
      const r = await loadDaily(DAY, { ...opts, yieldToPaint: async () => void painted++ });
      expect(r.source, name).toBe("principal");
      expect(r.generated, name).toBe(true);
      expect(r.level.hash, name).toBe(direct.hash);
      expect(painted, name).toBe(1); // le message a eu son image avant le calcul
      expect(r.blockedMs, name).toBeGreaterThanOrEqual(0);
    }
  });

  it("le fil principal travaille bien moins quand le worker génère (reconstruction seule) que quand il génère lui-même", async () => {
    // Deux dates encore jamais générées dans ce processus (`dailyLevel` garde ses résultats en mémoire : une date déjà calculée ne coûterait rien).
    const worker = await loadDaily(daysFromCivil(2027, 2, 1), options(null).opts);
    const main = await loadDaily(daysFromCivil(2027, 2, 2), options(null, "aucun").opts);
    expect(worker.source).toBe("worker");
    expect(main.source).toBe("principal");
    expect(worker.blockedMs).toBeLessThan(main.blockedMs / 2);
  });
});

describe("thème forcé : un essai (lot 11)", () => {
  const natural = jumpThemeForDay(DAY);
  const other = JUMP_THEME_NAMES.find((n) => n !== natural)!;
  const trialId = dailyLevelId(DAY, other);

  it("l'identifiant d'un essai est suffixé `-t<thème>` ; celui du thème de la date ne l'est pas", () => {
    expect(trialId).toBe(`${dailyLevelId(DAY)}-t${other}`);
    expect(dailyLevelId(DAY, natural)).toBe(dailyLevelId(DAY));
  });

  it("la charge porte le thème : un essai se reconstruit (preuve rejouée) pour son thème, pas pour un autre, ni pour la date ordinaire", () => {
    const p = JSON.parse(JSON.stringify(generatePayload(DAY, other)));
    expect(p.theme).toBe(other);
    expect(p.forcedTheme).toBe(true);
    expect(p.id).toBe(trialId);
    const l = fromPayload(p, DAY, { proof: true, theme: other });
    expect(typeof l).not.toBe("string");
    const level = l as ReturnType<typeof dailyLevel>;
    expect(level.theme).toBe(other);
    expect(level.forcedTheme).toBe(true);
    expect(level.id).toBe(trialId);
    expect(level.hash).toBe(dailyLevel(DAY, other).hash);
    expect(fromPayload(p, DAY, { proof: true })).toBe("autre niveau"); // le niveau ordinaire n'est pas un essai
    expect(fromPayload(generatePayload(DAY), DAY, { proof: true, theme: other })).toBe("autre niveau");
    // Un ancien cache (format 1, sans thème) est refusé.
    expect(fromPayload({ ...p, format: 1 }, DAY, { proof: true, theme: other })).toBe("charge illisible");
    expect(fromPayload({ ...p, theme: "lave" }, DAY, { proof: true, theme: other })).toBe("charge illisible");
    expect(fromPayload({ ...p, forcedTheme: false }, DAY, { proof: true, theme: other })).toBe("autre niveau");
  });

  it("le chargement demande le thème au worker, garde l'essai sous son propre identifiant (celui du niveau ordinaire reste intact) et le relit du cache", async () => {
    const store = new MemStore();
    const a = options(store, "ok", { theme: other });
    const first = await loadDaily(DAY, a.opts);
    expect(first.source).toBe("worker");
    expect(first.level.forcedTheme).toBe(true);
    expect(first.level.theme).toBe(other);
    expect(first.level.id).toBe(trialId);
    expect(a.made[0]!.requests).toEqual([{ day: DAY, theme: other }]);
    expect([...store.map.keys()]).toEqual([cacheKey(trialId)]);
    expect(store.map.has(cacheKey(dailyLevelId(DAY)))).toBe(false);
    const again = await loadDaily(DAY, options(store, "ok", { theme: other }).opts);
    expect(again.source).toBe("cache");
    expect(again.level.id).toBe(trialId);
    // Le niveau ordinaire de la même date coexiste dans le cache sans le toucher.
    const plain = await loadDaily(DAY, options(store).opts);
    expect(plain.level.forcedTheme).toBe(false);
    expect(plain.level.id).toBe(dailyLevelId(DAY));
    expect(store.map.size).toBe(2);
  });

  it("le thème de la date (ou aucun) donne le niveau ordinaire : ni suffixe, ni essai, et le worker n'a pas de thème à appliquer", async () => {
    for (const theme of [natural, null, undefined]) {
      const a = options(new MemStore(), "ok", { theme });
      const r = await loadDaily(DAY, a.opts);
      expect(r.level.forcedTheme, String(theme)).toBe(false);
      expect(r.level.id).toBe(dailyLevelId(DAY));
      expect(a.made[0]!.requests[0]!.theme ?? null).toBe(null);
    }
  });

  it("un thème forcé ne lit jamais un niveau figé (ceux de public/levels/ sont ceux des thèmes naturels) ; sans worker, le repli donne le même essai", async () => {
    let asked = 0;
    const frozen = { days: ["2026-10-16"], read: async () => (asked++, null) };
    const r = await loadDaily(DAY, options(new MemStore(), "aucun", { theme: other, frozen }).opts);
    expect(asked).toBe(0);
    expect(r.source).toBe("principal");
    expect(r.level.id).toBe(trialId);
    expect(r.level.hash).toBe(dailyLevel(DAY, other).hash);
    // Le niveau ordinaire, lui, interroge le fichier figé (absent ici : on génère).
    await loadDaily(DAY, options(new MemStore(), "aucun", { frozen }).opts);
    expect(asked).toBe(1);
  });
});
