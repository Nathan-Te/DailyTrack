import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION, PREMIER_JOUR, SIM_VERSION, parseTrack } from "@cdj/sim";
import { ThumbnailService, thumbKey, thumbScale, type ThumbDeps, type ThumbStore } from "../src/thumbnails";
import type { ThumbnailCircuit } from "../src/thumbnail";

const circuit: ThumbnailCircuit = { track: parseTrack("t", "S@start S S@finish"), palette: "desert", theme: "rallye" };
const blob = (n = 3) => new Blob([new Uint8Array(n)]);

function setup(over: Partial<ThumbDeps> = {}, store: ThumbStore | null = null) {
  const log: string[] = [];
  let urls = 0;
  const service = new ThumbnailService({
    canRun: () => true,
    idle: async () => {},
    retryMs: 1,
    store,
    make: async (day) => {
      log.push(`make ${day}`);
      return circuit;
    },
    draw: async () => {
      log.push("draw");
      return { blob: blob(), renderMs: 5, encodeMs: 2 };
    },
    toUrl: () => `blob:${++urls}`,
    ...over,
  });
  return { service, log };
}

describe("clé de cache", () => {
  it("l'id du circuit (version du générateur), les versions et la taille", () => {
    const key = thumbKey(PREMIER_JOUR, null, 2);
    expect(key).toContain(`g${GENERATOR_VERSION}`);
    expect(key).toContain(`s${SIM_VERSION}`);
    expect(key.endsWith("x2")).toBe(true);
    expect(thumbKey(PREMIER_JOUR, null, 1)).not.toBe(key);
    expect(thumbKey(PREMIER_JOUR + 1, null, 2)).not.toBe(key);
    expect(thumbKey(PREMIER_JOUR, "nuit", 2)).not.toBe(key); // un thème forcé est un autre circuit
  });
  it("densité : 2 à partir de 1,5", () => {
    expect([1, 1.25, 1.5, 2, 3].map(thumbScale)).toEqual([1, 1, 2, 2, 2]);
  });
});

describe("service de miniatures", () => {
  it("fabrique une image, puis la sert depuis la mémoire sans recommencer", async () => {
    const { service, log } = setup();
    const url = await service.request({ day: PREMIER_JOUR });
    expect(url).toBe("blob:1");
    expect(log).toEqual([`make ${PREMIER_JOUR}`, "draw"]);
    expect(service.peek({ day: PREMIER_JOUR })).toBe("blob:1");
    expect(await service.request({ day: PREMIER_JOUR })).toBe("blob:1");
    expect(log).toHaveLength(2);
    expect(service.stats).toMatchObject({ made: 1, memoryHits: 1, storeHits: 0 });
    expect(service.stats.renderMs).toEqual([5]);
  });

  it("deux demandes pour la même image : une seule fabrication", async () => {
    const { service, log } = setup();
    const [a, b] = await Promise.all([service.request({ day: PREMIER_JOUR }), service.request({ day: PREMIER_JOUR })]);
    expect(a).toBe(b);
    expect(log.filter((l) => l === "draw")).toHaveLength(1);
  });

  it("une image déjà gardée (IndexedDB) ne coûte ni génération ni rendu", async () => {
    const saved = new Map<string, Blob>();
    const store: ThumbStore = { get: async (k) => saved.get(k) ?? null, put: async (k, b) => void saved.set(k, b) };
    const first = setup({}, store);
    await first.service.request({ day: PREMIER_JOUR });
    await Promise.resolve();
    expect(saved.size).toBe(1);
    // « autre séance » : service neuf, même cache
    const second = setup({}, store);
    expect(await second.service.request({ day: PREMIER_JOUR })).toBe("blob:1");
    expect(second.log).toEqual([]);
    expect(second.service.stats).toMatchObject({ made: 0, storeHits: 1 });
  });

  it("un cache en panne n'empêche rien", async () => {
    const store: ThumbStore = { get: async () => Promise.reject(new Error("bloqué")), put: async () => Promise.reject(new Error("bloqué")) };
    const { service } = setup({}, store);
    expect(await service.request({ day: PREMIER_JOUR })).toBe("blob:1");
  });

  it("une image à la fois, dans l'ordre des demandes", async () => {
    let active = 0;
    let maxActive = 0;
    const order: number[] = [];
    const { service } = setup({
      make: async (day) => {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(day);
        await new Promise((r) => setTimeout(r, 2));
        active--;
        return circuit;
      },
    });
    await Promise.all([0, 1, 2, 3].map((i) => service.request({ day: PREMIER_JOUR + i })));
    expect(maxActive).toBe(1);
    expect(order).toEqual([0, 1, 2, 3].map((i) => PREMIER_JOUR + i));
  });

  it("jamais de génération ni de rendu tant qu'une course tourne", async () => {
    let racing = true;
    const { service, log } = setup({ canRun: () => !racing });
    const pending = service.request({ day: PREMIER_JOUR });
    await new Promise((r) => setTimeout(r, 30));
    expect(log).toEqual([]); // rien n'a été fait pendant la course
    expect(service.pending).toBe(1);
    racing = false;
    expect(await pending).toBe("blob:1");
    expect(log).toEqual([`make ${PREMIER_JOUR}`, "draw"]);
  });

  it("une course qui démarre pendant la génération retarde le rendu", async () => {
    let racing = false;
    const { service, log } = setup({
      canRun: () => !racing,
      make: async () => {
        racing = true; // le départ est donné pendant que le fil de travail génère
        setTimeout(() => (racing = false), 20);
        return circuit;
      },
    });
    const t0 = Date.now();
    await service.request({ day: PREMIER_JOUR });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(15);
    expect(log).toEqual(["draw"]);
  });

  it("saute ce que plus personne ne veut (ligne sortie de l'écran)", async () => {
    let visible = true;
    const { service, log } = setup({
      make: async (day) => {
        log.push(`make ${day}`);
        visible = false; // pendant la première, on fait défiler la liste
        return circuit;
      },
    });
    const a = service.request({ day: PREMIER_JOUR }, () => true);
    const b = service.request({ day: PREMIER_JOUR + 1 }, () => visible);
    expect(await a).not.toBeNull();
    expect(await b).toBeNull();
    expect(log.filter((l) => l.startsWith("make"))).toEqual([`make ${PREMIER_JOUR}`]);
  });

  it("si une autre ligne veut la même image, elle est faite", async () => {
    const { service } = setup();
    const a = service.request({ day: PREMIER_JOUR }, () => false);
    const b = service.request({ day: PREMIER_JOUR }, () => true);
    expect(await a).toBe("blob:1");
    expect(await b).toBe("blob:1");
  });

  it("une image qui attendait la fin d'une course est abandonnée dès que plus personne ne la veut", async () => {
    let wanted = true;
    const { service, log } = setup({ canRun: () => false });
    const result = service.request({ day: PREMIER_JOUR }, () => wanted);
    await new Promise((r) => setTimeout(r, 10));
    expect(service.pending).toBe(1); // elle patiente : la course tourne
    wanted = false; // le panneau est fermé
    expect(await result).toBeNull();
    expect(service.pending).toBe(0);
    expect(log).toEqual([]);
  });

  it("clearQueue abandonne ce qui n'a pas commencé", async () => {
    const { service } = setup({ idle: () => new Promise((r) => setTimeout(r, 5)) });
    const results = [0, 1, 2].map((i) => service.request({ day: PREMIER_JOUR + i }));
    await new Promise((r) => setTimeout(r, 1));
    service.clearQueue();
    const urls = await Promise.all(results);
    expect(urls.filter((u) => u === null).length).toBeGreaterThanOrEqual(2);
  });

  it("un circuit de secours (null) ou un échec de rendu : pas d'image, pas d'exception", async () => {
    const none = setup({ make: async () => null });
    expect(await none.service.request({ day: PREMIER_JOUR })).toBeNull();
    const boom = setup({ draw: async () => Promise.reject(new Error("WebGL perdu")) });
    expect(await boom.service.request({ day: PREMIER_JOUR })).toBeNull();
    expect(boom.service.peek({ day: PREMIER_JOUR })).toBeNull();
  });

  it("le circuit déjà construit (jeu) évite la génération", async () => {
    const { service, log } = setup();
    await service.request({ day: PREMIER_JOUR, circuit });
    expect(log).toEqual(["draw"]);
  });

  it("une fois tout fait, prévient (libération de la mémoire graphique)", async () => {
    let settled = 0;
    const { service } = setup({ onSettled: () => settled++ });
    await Promise.all([service.request({ day: PREMIER_JOUR }), service.request({ day: PREMIER_JOUR + 1 })]);
    await new Promise((r) => setTimeout(r, 5));
    expect(settled).toBe(1);
    expect(service.pending).toBe(0);
  });
});

describe("générateur de circuits des miniatures", () => {
  it("sans fil de travail (ici : Node), repli sur le fil principal, avec le même circuit que le jeu", async () => {
    const { createCircuitMaker } = await import("../src/thumbGen");
    const { dailyCircuit } = await import("@cdj/sim");
    let main = 0;
    const make = createCircuitMaker(() => main++);
    const day = PREMIER_JOUR + 3;
    const got = await make(day);
    const real = dailyCircuit(day);
    expect(main).toBe(1);
    expect(got).not.toBeNull();
    expect(got!.track.id).toBe(real.track.id);
    expect(got!.track.blocks.map((b) => b.kind)).toEqual(real.track.blocks.map((b) => b.kind));
    expect([got!.palette, got!.theme]).toEqual([real.palette, real.theme]);
  }, 30_000);
});
