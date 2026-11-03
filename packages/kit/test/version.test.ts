import { describe, expect, it } from "vitest";
import { SUIVI_MS, VERIFICATION_MIN_MS, creerVersion } from "../src/version";

// Lot D2 — l'onglet périmé : la version du jeu comparée à celle du serveur avant la partie, un refus de version qui allume le bandeau, et jamais un bandeau ni une lecture pendant une partie.

function monter(serveur: Record<string, number> | null, locales = { simVersion: 5, generatorVersion: 3 }) {
  const e = { now: 1_000_000, partie: false, lectures: 0, affiche: 0, cache: 0, rappel: null as null | (() => void), taches: [] as { fn: () => void; ms: number; vivante: boolean }[] };
  const v = creerVersion({
    locales,
    lire: async () => (e.lectures++, serveur),
    enPartie: () => e.partie,
    bandeau: { montrer: () => void e.affiche++, cacher: () => void e.cache++ },
    ecoute: (r) => ((e.rappel = r), () => void (e.rappel = null)),
    now: () => e.now,
    setTimer: (fn, ms) => {
      const t = { fn: () => ((t.vivante = false), fn()), ms, vivante: true };
      e.taches.push(t);
      return t;
    },
    clearTimer: (h) => void ((h as { vivante: boolean }).vivante = false),
  });
  return { e, v };
}

describe("lot D2 — détection d'une version différente", () => {
  it("même version : rien ; version du serveur différente : le bandeau, avant la partie", async () => {
    const m = monter({ simVersion: 5, generatorVersion: 3 });
    expect(await m.v.verifier()).toBe(false);
    expect(m.e.affiche).toBe(0);
    const n = monter({ simVersion: 5, generatorVersion: 4 });
    expect(await n.v.verifier()).toBe(true);
    expect(n.v.perime).toBe(true);
    expect(n.e.affiche).toBe(1);
  });

  it("un serveur muet (hors ligne) ne dit rien", async () => {
    const m = monter(null);
    expect(await m.v.verifier()).toBe(false);
    expect(m.e.affiche).toBe(0);
  });

  it("au retour sur l'onglet, au plus une lecture toutes les 30 s", async () => {
    const m = monter({ simVersion: 5, generatorVersion: 3 });
    await m.v.verifier();
    m.e.rappel!();
    m.e.rappel!();
    await Promise.resolve();
    expect(m.e.lectures).toBe(1);
    m.e.now += VERIFICATION_MIN_MS;
    m.e.rappel!();
    await Promise.resolve();
    expect(m.e.lectures).toBe(2);
  });
});

describe("lot D2 — après un refus", () => {
  it("version, sim_version et track_mismatch allument le bandeau ; un autre refus non", () => {
    for (const code of ["version", "sim_version", "track_mismatch"]) {
      const m = monter(null);
      expect(m.v.noterRefus(code)).toBe(true);
      expect(m.e.affiche).toBe(1);
    }
    const m = monter(null);
    expect(m.v.noterRefus("replay_copy")).toBe(false);
    expect(m.v.noterRefus(undefined)).toBe(false);
    expect(m.e.affiche).toBe(0);
  });
});

describe("lot D2 — jamais pendant une partie", () => {
  it("en partie : aucune lecture, aucun bandeau, même après un refus ; il paraît à la fin de la partie", async () => {
    const m = monter({ simVersion: 6, generatorVersion: 3 });
    m.e.partie = true;
    expect(await m.v.verifier()).toBe(false);
    expect(m.e.lectures).toBe(0);
    expect(m.v.noterRefus("sim_version")).toBe(true);
    expect(m.e.affiche).toBe(0); // périmé, mais en partie : rien ne s'affiche
    m.e.partie = false;
    m.v.actualiser();
    expect(m.e.affiche).toBe(1);
  });

  it("le bandeau disparaît quand une partie commence, revient à son arrêt (suivi toutes les 500 ms)", async () => {
    const m = monter({ simVersion: 6, generatorVersion: 3 });
    await m.v.verifier();
    expect(m.e.affiche).toBe(1);
    const tache = m.e.taches.filter((t) => t.vivante).at(-1)!;
    expect(tache.ms).toBe(SUIVI_MS);
    m.e.partie = true;
    tache.fn();
    expect(m.e.cache).toBe(1);
    m.e.partie = false;
    m.e.taches.filter((t) => t.vivante).at(-1)!.fn();
    expect(m.e.affiche).toBe(2);
    m.v.arreter();
    expect(m.e.taches.every((t) => !t.vivante)).toBe(true);
  });
});
