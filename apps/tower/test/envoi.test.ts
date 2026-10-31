import { createIdentity, type ApiResult } from "@cdj/profile";
import { describe, expect, it } from "vitest";
import type { ClassementTower, EnvoiTower, SourceTower } from "../src/apiTower";
import { Envoi, peutClasser } from "../src/envoi";
import { lireRecords, proposerRecord } from "../src/records";

// Lot T4 — l'envoi des parties au classement, sans DOM ni réseau : un faux serveur, un stockage en mémoire, des minuteries injectées. Le jeu ne bloque jamais sur le réseau ; un échec est un état.
function memoire(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
  } as Storage;
}
const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
const ko = <T>(status: number, code: string, suggestions?: string[]): ApiResult<T> => ({ ok: false, status, code, message: "", ...(suggestions ? { suggestions } : {}) });
const tableau = (): ClassementTower => ({ date: "2026-11-06", open: true, participants: 1, top: [], me: null });
const reponse = (h: number, improved = true): EnvoiTower => ({
  accepted: true,
  date: "2026-11-06",
  resultat: { hauteurMm: h, hauteurMaxMm: h, vies: 3, ticks: 5000, posees: 40, tombees: 0, motif: "pieces" },
  medal: null,
  improved,
  best: { hauteurMm: h, vies: 3, ticks: 5000, medal: null },
  rank: 1,
  participants: 1,
  board: tableau(),
});

interface Appel {
  playerId: string;
  name: string | null;
  replay: string;
}
function faux(reponses: ApiResult<EnvoiTower>[], noms: { available: boolean; suggestions?: string[] } = { available: true }) {
  const appels: Appel[] = [];
  const source = {
    submit: async (playerId: string, name: string | null, replay: string) => {
      appels.push({ playerId, name, replay });
      return reponses.shift() ?? ko(500, "internal");
    },
    checkName: async () => ok(noms.available ? { available: true as const } : { available: false as const, suggestions: noms.suggestions ?? [] }),
    rename: async (_id: string, name: string) => ok({ name }),
    board: async () => ok(tableau()),
    diamant: async () => ko(403, "not_ranked"),
    towerMe: async () => ko(404, "unknown_player"),
    me: async () => ko(404, "unknown_player"),
    rotateCode: async () => ok({ rotated: true as const }),
  } as unknown as SourceTower;
  return { source, appels };
}

function monter(source: SourceTower | null) {
  const stockage = memoire();
  const identity = createIdentity(() => stockage);
  const minuteries: { fn: () => void; ms: number }[] = [];
  const envoi = new Envoi({
    source,
    identity,
    stockage: () => stockage,
    aujourdhui: () => "2026-11-06",
    setTimer: (fn, ms) => {
      minuteries.push({ fn, ms });
      return minuteries.length;
    },
    clearTimer: () => {},
  });
  const record = (h = 12_000) => proposerRecord(stockage, "2026-11-06", { hauteurMm: h, vies: 3, ticks: 5000, medaille: null, rediffusion: "AAAAAAAAAAAAAAAAAAAA" });
  return { envoi, stockage, identity, minuteries, record };
}

describe("ce qui peut être classé", () => {
  const base = { scenario: "jour", jour: 20_000, aujourdhui: 20_000, bot: false, reglagesModifies: false, tireForce: false };
  it("le jour d'aujourd'hui joué normalement, et rien d'autre", () => {
    expect(peutClasser(base)).toBe(true);
    expect(peutClasser({ ...base, scenario: "essai" })).toBe(false);
    expect(peutClasser({ ...base, scenario: "paliers" })).toBe(false);
    expect(peutClasser({ ...base, jour: 19_999 })).toBe(false); // une archive ou ?seed= : jamais classé
    expect(peutClasser({ ...base, bot: true })).toBe(false);
    expect(peutClasser({ ...base, reglagesModifies: true })).toBe(false);
    expect(peutClasser({ ...base, tireForce: true })).toBe(false);
  });
});

describe("l'envoi d'un record", () => {
  it("sans serveur : rien ne part, l'état dit « off » et le record reste à envoyer", async () => {
    const t = monter(null);
    t.record();
    t.envoi.offrir();
    await t.envoi.flush();
    expect(t.envoi.state.statut).toBe("off");
    expect(lireRecords(t.stockage)["2026-11-06"]!.envoye).toBe(false);
  });

  it("un joueur connu : le record part avec la rediffusion, le serveur répond, le record est noté envoyé ; ni la hauteur ni les vies du jeu ne partent", async () => {
    const t = monter(null);
    const f = faux([ok(reponse(12_000))]);
    const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    t.identity.setName("Pistache");
    t.record();
    e.offrir();
    await e.flush();
    expect(e.state.statut).toBe("ranked");
    expect(f.appels).toHaveLength(1);
    expect(f.appels[0]).toMatchObject({ name: "Pistache", replay: "AAAAAAAAAAAAAAAAAAAA" });
    expect(Object.keys(f.appels[0]!).sort()).toEqual(["name", "playerId", "replay"]);
    expect(e.resultats.get("2026-11-06")?.rank).toBe(1);
    expect(lireRecords(t.stockage)["2026-11-06"]!.envoye).toBe(true);
  });

  it("un seul envoi par record : une fois envoyé, rien ne repart", async () => {
    const t = monter(null);
    const f = faux([ok(reponse(12_000))]);
    const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    t.identity.setName("Pistache");
    t.record();
    await e.flush();
    await e.flush();
    expect(f.appels).toHaveLength(1);
  });

  it("hors ligne : l'état est « offline », le record reste à envoyer, un nouvel essai est programmé (délai qui s'allonge) et le réseau revenu l'envoie tout de suite", async () => {
    const t = monter(null);
    const f = faux([ko(0, "network"), ko(0, "network"), ok(reponse(12_000))]);
    const minuteries: { fn: () => void; ms: number }[] = [];
    const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: (fn, ms) => (minuteries.push({ fn, ms }), minuteries.length), clearTimer: () => {} });
    t.identity.setName("Pistache");
    t.record();
    await e.flush();
    expect(e.state).toMatchObject({ statut: "offline", code: "reseau" });
    expect(lireRecords(t.stockage)["2026-11-06"]!.envoye).toBe(false);
    expect(minuteries).toHaveLength(1);
    await minuteries[0]!.fn();
    await e.flush();
    expect(minuteries[1]!.ms).toBeGreaterThan(minuteries[0]!.ms);
    e.reveiller(); // « online »
    await e.flush();
    expect(e.state.statut).toBe("ranked");
    expect(lireRecords(t.stockage)["2026-11-06"]!.envoye).toBe(true);
  });

  it("trop de requêtes (429) ou route inconnue (serveur sans Tower) : « offline », jamais un refus définitif", async () => {
    for (const r of [ko<EnvoiTower>(429, "rate_limited"), ko<EnvoiTower>(404, "not_found"), ko<EnvoiTower>(503, "busy")]) {
      const t = monter(null);
      const f = faux([r]);
      const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
      t.identity.setName("Pistache");
      t.record();
      await e.flush();
      expect(e.state.statut, r.ok ? "" : r.code).toBe("offline");
      expect(lireRecords(t.stockage)["2026-11-06"]!.envoye).toBe(false);
    }
  });

  it("le premier envoi d'un joueur inconnu : le serveur demande un pseudo, l'envoi attend, le pseudo choisi (libre) fait partir l'envoi", async () => {
    const t = monter(null);
    const f = faux([ko(400, "name_required"), ok(reponse(12_000))]);
    const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    t.record();
    await e.flush();
    expect(e.state.statut).toBe("name");
    expect(f.appels[0]!.name).toBeNull();
    const r = await e.choisirPseudo("Kiwi");
    expect(r.ok).toBe(true);
    expect(f.appels[1]!.name).toBe("Kiwi");
    expect(e.state.statut).toBe("ranked");
  });

  it("un pseudo pris : les suggestions du serveur sont gardées ; un pseudo invalide est refusé avant tout appel", async () => {
    const t = monter(null);
    const f = faux([ko(400, "name_required")], { available: false, suggestions: ["Kiwi2", "Kiwi_FR"] });
    const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    t.record();
    await e.flush();
    const r = await e.choisirPseudo("Kiwi");
    expect(r.ok).toBe(false);
    expect(e.state).toMatchObject({ statut: "name", code: "name_taken", suggestions: ["Kiwi2", "Kiwi_FR"] });
    expect((await e.choisirPseudo("  ")).ok).toBe(false);
    expect(e.state).toMatchObject({ statut: "name", code: "invalid_name" });
    expect(f.appels).toHaveLength(1);
  });

  it("une autre version du jeu : « version », l'envoi est oublié ; un code révoqué : « revoked », l'envoi attend", async () => {
    const a = monter(null);
    const fa = faux([ko(409, "version")]);
    const ea = new Envoi({ source: fa.source, identity: a.identity, stockage: () => a.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    a.identity.setName("Pistache");
    a.record();
    await ea.flush();
    expect(ea.state).toMatchObject({ statut: "version", code: "version" });
    expect(lireRecords(a.stockage)["2026-11-06"]!.envoye).toBe(true);

    const b = monter(null);
    const fb = faux([ko(410, "code_revoked")]);
    const eb = new Envoi({ source: fb.source, identity: b.identity, stockage: () => b.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    b.identity.setName("Pistache");
    b.record();
    await eb.flush();
    expect(eb.state.statut).toBe("revoked");
    expect(lireRecords(b.stockage)["2026-11-06"]!.envoye).toBe(false);
  });

  it("un refus définitif (copie, jour figé, partie refusée) : « refused » avec son code, l'envoi n'est pas renvoyé", async () => {
    for (const code of ["replay_copy", "day_closed", "not_finished", "invalid_replay"]) {
      const t = monter(null);
      const f = faux([ko(409, code)]);
      const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
      t.identity.setName("Pistache");
      t.record();
      await e.flush();
      expect(e.state, code).toMatchObject({ statut: "refused", code });
      expect(lireRecords(t.stockage)["2026-11-06"]!.envoye).toBe(true);
      await e.flush();
      expect(f.appels).toHaveLength(1);
    }
  });

  it("l'identifiant n'est créé qu'au premier envoi : lire l'état ou offrir sans record ne crée rien", async () => {
    const t = monter(null);
    const f = faux([]);
    const e = new Envoi({ source: f.source, identity: t.identity, stockage: () => t.stockage, aujourdhui: () => "2026-11-06", setTimer: () => 0, clearTimer: () => {} });
    e.offrir();
    await e.flush();
    expect(t.stockage.getItem("cdj:player")).toBeNull();
    expect(f.appels).toHaveLength(0);
  });
});
