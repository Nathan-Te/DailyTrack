import { beforeAll, describe, expect, it } from "vitest";
import { dailyCircuit, daysFromCivil, encodeReplay, runPilot } from "@cdj/sim";
import { GhostField, type GhostEntry } from "../src/salonGhosts";
import type { ChoixVoiture } from "../src/voiture/choix";

// Lot 55 : plusieurs fantômes choisis dans le classement du jour, sur le champ de fantômes du Salon : cinq en course, chacun avec la voiture de sa course et sa teinte, tous recalés au
// recommencement, un fantôme arrivé en retard qui rejoint la course à sa place. Sans navigateur : de quoi dessiner une étiquette suffit.
const GT: ChoixVoiture = { id: "gt", couleur: 3, motif: "chevrons", teinteMotif: 2 };
const jour = daysFromCivil(2026, 10, 14);
const circuit = dailyCircuit(jour);
const run = runPilot(circuit.track, { grip: 0.8 });
const replay = encodeReplay(run.replay);
const entree = (n: number, slot: number, voiture?: ChoixVoiture): GhostEntry => ({ key: `r${n}:${n}`, rank: n, name: `Joueur ${n}`, ms: run.finishMs, replay, slot, ...(voiture ? { voiture } : {}) });
type Interne = { slots: { carId: string; carVoulu: string; couleur: number }[]; active: { slot: number; race: { car: { tick: number } }; entry: GhostEntry }[] };
const interne = (f: GhostField) => f as unknown as Interne;
const attendre = async (f: () => boolean) => {
  for (let i = 0; i < 400 && !f(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(f()).toBe(true);
};

beforeAll(() => {
  (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
});

describe("cinq fantômes choisis, chacun avec sa voiture et sa teinte", () => {
  it("les cinq prennent la place (la teinte) de leur rang dans le choix, avec le modèle de leur course", async () => {
    const f = new GhostField();
    const voitures: (ChoixVoiture | undefined)[] = [{ ...GT }, { ...GT, id: "fourgon" }, undefined, { ...GT, id: "monoplace" }, { ...GT, id: "muscle" }];
    // Un choix dans un autre ordre que celui du classement : la teinte suit l'ordre du choix, pas le rang au classement.
    const rangs = [7, 2, 11, 1, 4];
    f.setEntries(voitures.map((v, i) => ({ ...entree(rangs[i]!, i, v) })));
    f.restart(circuit.track);
    expect(f.stats.rejected).toBe(0);
    expect(f.count).toBe(5);
    await attendre(() => f.stats.models === 4);
    expect(interne(f).active.map((a) => a.slot)).toEqual([0, 1, 2, 3, 4]);
    expect(interne(f).slots.slice(0, 5).map((s) => s.carId)).toEqual(["gt", "fourgon", "civile", "monoplace", "muscle"]);
    expect(f.entries.map((e) => e.rank)).toEqual(rangs);
  });

  it("une sixième course est refusée par le champ (cinq places pour les autres joueurs)", () => {
    const f = new GhostField();
    f.setEntries([0, 1, 2, 3, 4].map((i) => entree(i + 1, i)));
    f.restart(circuit.track);
    expect(f.count).toBe(5);
    expect(f.ajouter(entree(9, 5), circuit.track, 0), "la place 5 est celle de ton tour au Salon : pas pour les autres").toBe(false);
    expect(f.count).toBe(5);
  });
});

describe("recommencer recale tout le monde", () => {
  it("après N pas, un nouveau départ remet chaque fantôme au pas 0 ; les entrées choisies restent", () => {
    const f = new GhostField();
    f.setEntries([0, 1, 2].map((i) => entree(i + 1, i)));
    f.restart(circuit.track);
    for (let i = 0; i < 300; i++) f.step();
    expect(interne(f).active.map((a) => a.race.car.tick)).toEqual([300, 300, 300]);
    f.restart(circuit.track); // « recommencer » : les entrées en attente sont toujours celles du choix
    expect(interne(f).active.map((a) => a.race.car.tick)).toEqual([0, 0, 0]);
    expect(f.count).toBe(3);
  });

  it("un autre choix ne vaut qu'au départ suivant : la course en cours garde les siens", () => {
    const f = new GhostField();
    f.setEntries([entree(1, 0), entree(2, 1)]);
    f.restart(circuit.track);
    f.setEntries([entree(3, 0)]);
    expect(f.count).toBe(2);
    expect(f.differsFromActive()).toBe(true);
    f.restart(circuit.track);
    expect(f.entries.map((e) => e.rank)).toEqual([3]);
    f.setEntries([]); // « Rien » : plus aucun fantôme au départ suivant
    f.restart(circuit.track);
    expect(f.count).toBe(0);
  });
});

describe("un fantôme arrivé après le départ rejoint la course à sa place", () => {
  it("il est au pas où il devrait être, sans toucher aux autres ; un fantôme déjà là ou une place prise : refusé", () => {
    const f = new GhostField();
    f.setEntries([entree(1, 0), entree(2, 1)]);
    f.restart(circuit.track);
    for (let i = 0; i < 240; i++) f.step();
    expect(f.ajouter(entree(3, 2), circuit.track, 240)).toBe(true);
    const ticks = Object.fromEntries(interne(f).active.map((a) => [a.entry.rank, a.race.car.tick]));
    expect(ticks).toEqual({ 1: 240, 2: 240, 3: 240 });
    expect(f.ajouter(entree(3, 2), circuit.track, 240), "déjà là").toBe(false);
    expect(f.ajouter(entree(4, 0), circuit.track, 240), "place prise").toBe(false);
    f.step();
    expect(interne(f).active.every((a) => a.race.car.tick === 241)).toBe(true);
  });

  it("sans place précisée : la première libre ; une rediffusion d'un autre circuit ou d'une autre version est écartée sans casser les autres", () => {
    const f = new GhostField();
    f.setEntries([entree(1, 0)]);
    f.restart(circuit.track);
    expect(f.ajouter({ ...entree(2, 0), slot: undefined }, circuit.track, 0)).toBe(true);
    expect(interne(f).active.map((a) => a.slot)).toEqual([0, 1]);
    const autre = dailyCircuit(daysFromCivil(2026, 10, 15));
    expect(f.ajouter({ ...entree(3, 2), key: "autre" }, autre.track, 0), "autre circuit").toBe(false);
    expect(f.count).toBe(2);
  });
});
