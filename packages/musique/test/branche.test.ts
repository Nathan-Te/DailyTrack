import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le branchement d'un jeu : il n'écoute que le premier geste ; rien n'est chargé ni demandé avant. Le lecteur (`demarrage.ts`) est remplacé par un faux qui compte.
const demarrer = vi.fn((_jeu: string, _stockage: unknown, init: { baisse: number; sourdine: boolean }) => ({ baisser: vi.fn(), sourdine: vi.fn(), init }));
vi.mock("../src/demarrage", () => ({ demarrer }));

const ecouteurs = new Map<string, (() => void)[]>();
beforeEach(() => {
  demarrer.mockClear();
  ecouteurs.clear();
  vi.stubGlobal("addEventListener", (type: string, fn: () => void) => ecouteurs.set(type, [...(ecouteurs.get(type) ?? []), fn]));
  vi.stubGlobal("removeEventListener", (type: string, fn: () => void) => ecouteurs.set(type, (ecouteurs.get(type) ?? []).filter((f) => f !== fn)));
});
afterEach(() => vi.unstubAllGlobals());

const geste = (type: string) => (ecouteurs.get(type) ?? []).slice().forEach((f) => f());
const nombre = () => [...ecouteurs.values()].reduce((s, l) => s + l.length, 0);

describe("brancherMusique : la musique ne démarre qu'au premier geste", () => {
  it("brancher ne charge rien : le lecteur n'est pas demandé, seuls des écouteurs de geste sont posés", async () => {
    const { brancherMusique } = await import("../src/branche");
    brancherMusique("track");
    expect(demarrer).not.toHaveBeenCalled();
    for (const g of ["pointerdown", "keydown", "touchend", "click"]) expect(ecouteurs.get(g)?.length, g).toBe(1);
  });

  it("le premier geste charge le lecteur une seule fois, puis retire tous les écouteurs", async () => {
    const { brancherMusique } = await import("../src/branche");
    brancherMusique("jump");
    geste("click");
    geste("keydown");
    await vi.waitFor(() => expect(demarrer).toHaveBeenCalledTimes(1));
    expect(demarrer.mock.calls[0]![0]).toBe("jump");
    expect(nombre()).toBe(0);
  });

  it("ce que le jeu a demandé avant le chargement (baisser, sourdine) est donné au lecteur à son démarrage, puis transmis en direct", async () => {
    const { brancherMusique } = await import("../src/branche");
    const m = brancherMusique("track");
    m.baisser(0.4);
    m.sourdine(true);
    geste("pointerdown");
    await vi.waitFor(() => expect(demarrer).toHaveBeenCalled());
    expect(demarrer.mock.calls[0]![2]).toEqual({ baisse: 0.4, sourdine: true });
    const lecteur = demarrer.mock.results[0]!.value as { baisser: ReturnType<typeof vi.fn> };
    m.baisser(1);
    expect(lecteur.baisser).toHaveBeenCalledWith(1);
  });

  it("ouvrir les réglages (`lecteur()`) charge le lecteur s'il ne l'est pas, sans en créer un second", async () => {
    const { brancherMusique } = await import("../src/branche");
    const m = brancherMusique("tower");
    const a = await m.lecteur();
    const b = await m.lecteur();
    expect(a).toBe(b);
    expect(demarrer).toHaveBeenCalledTimes(1);
  });
});
