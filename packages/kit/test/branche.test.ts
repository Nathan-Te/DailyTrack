import { afterEach, describe, expect, it, vi } from "vitest";
import { messageALaDemande, noterGeneration } from "../src/branche";
import type { MessageEnDirect } from "../src/message";

class Faux {
  m = new Map<string, string>();
  get length(): number { return this.m.size; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.m.get(k) ?? null; }
  setItem(k: string, v: string): void { this.m.set(k, v); }
  removeItem(k: string): void { this.m.delete(k); }
}
afterEach(() => vi.unstubAllGlobals());

describe("la génération de données (lot R8)", () => {
  it("note qu'un navigateur sans donnée est neuf ; la démonstration n'écrit rien", () => {
    const f = new Faux();
    vi.stubGlobal("localStorage", f);
    noterGeneration(() => true);
    expect(f.m.size).toBe(0);
    noterGeneration(() => false);
    expect(f.m.size).toBeGreaterThan(0);
  });
  it("ne lève jamais (adresse ou stockage refusés)", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => noterGeneration(() => false)).not.toThrow();
    expect(() => noterGeneration(() => { throw new Error("adresse illisible"); })).not.toThrow();
  });
});

describe("le message en direct à la demande", () => {
  const faux = () => {
    const appels: (string | null)[] = [];
    const vrai: MessageEnDirect = { montrer: (e) => void appels.push(e), etat: () => ({ ecran: "accueil", id: 7, ton: "info", dessine: true, lectures: 2 }) };
    return { vrai, appels };
  };
  it("ne charge rien tant qu'aucun écran n'a le droit d'afficher le bandeau", () => {
    const charger = vi.fn();
    const m = messageALaDemande(charger);
    m.montrer(null);
    expect(charger).not.toHaveBeenCalled();
    expect(m.etat()).toEqual({ ecran: null, id: null, ton: null, dessine: false, lectures: 0 });
  });
  it("charge une fois au premier écran, puis rejoue le dernier écran demandé", async () => {
    const { vrai, appels } = faux();
    const charger = vi.fn(async () => vrai);
    const m = messageALaDemande(charger);
    m.montrer("accueil");
    m.montrer("pause"); // demandé avant l'arrivée du module : c'est lui qui sera rejoué
    expect(m.etat().ecran).toBe("pause");
    await Promise.resolve();
    await Promise.resolve();
    expect(charger).toHaveBeenCalledTimes(1);
    expect(appels).toEqual(["pause"]);
    m.montrer(null);
    expect(appels).toEqual(["pause", null]);
    expect(m.etat().id).toBe(7);
    expect(charger).toHaveBeenCalledTimes(1);
  });
});
