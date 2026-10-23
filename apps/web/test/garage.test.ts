import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEBLOCAGES, etatGarage } from "@cdj/sim";
import { LeaderboardApi } from "../src/api";
import { Online } from "../src/online";
import { VOITURES } from "../src/voiture/catalogue";
import { CLE_GARAGE, choisirVoiture, marquerVues, noterDeblocages, voitureChoisie, voituresDebloquees, voituresNouvelles } from "../src/voiture/choix";

// Lot 41 : le Garage côté jeu — les déblocages viennent du serveur (jamais d'un calcul du jeu), gardés dans le navigateur pour le repli hors
// connexion ; le choix est enregistré et relu ; une voiture verrouillée est refusée ; la pastille « Nouveau ».

/** Un `localStorage` en mémoire (le jeu le relit à chaque appel : `gameStorage`). */
function memoire(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    m,
  };
}

let stockage: ReturnType<typeof memoire>;
beforeEach(() => {
  stockage = memoire({ "cdj:player": "0123456789abcdef0123456789abcdef" });
  vi.stubGlobal("localStorage", stockage);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status });
const statut = (debloquees: string[]) => ({ progres: { jours: 4, or: 3, auteur: 0 }, voitures: etatGarage({ jours: 4, or: 3, auteur: 0 }).map((v) => ({ ...v, debloquee: v.id === "civile" || debloquees.includes(v.id) })) });

describe("le catalogue suit la table des règles du serveur", () => {
  it("chaque fiche porte le déblocage de DEBLOCAGES (packages/sim/src/garage.ts), le même que le serveur", () => {
    for (const v of VOITURES) expect(v.deblocage).toEqual(DEBLOCAGES[v.id as keyof typeof DEBLOCAGES]);
  });
});

describe("les déblocages viennent du serveur, gardés dans le navigateur", () => {
  it("sans rien du serveur : la civile seulement (le jeu ne compte jamais ses records)", () => {
    stockage.setItem("cdj:best:jour-2026-10-13-g15", JSON.stringify({ ms: 1, splits: [], simVersion: 14, medal: "author" }));
    expect([...voituresDebloquees()]).toEqual(["civile"]);
  });

  it("GET /api/garage (identifiant dans l'en-tête) : la réponse est gardée ; la voiture devient choisissable", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => reponse(statut(["evolution"])));
    const online = new Online("jour-2026-10-23-g16", "2026-10-23", "https://api.test");
    const r = await online.profileApi!.garage!(online.playerId);
    expect(r.ok && r.data.voitures.find((v) => v.id === "evolution")?.debloquee).toBe(true);
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/garage");
    expect(String(url)).not.toContain("0123456789abcdef");
    expect((init!.headers as Record<string, string>)["X-Player-Id"]).toBe("0123456789abcdef0123456789abcdef");
    if (r.ok) noterDeblocages(r.data.voitures.filter((v) => v.debloquee).map((v) => v.id)); // ce que fait le Garage (garage.ts)
    expect([...voituresDebloquees()]).toEqual(["civile", "evolution"]);
    expect(choisirVoiture({ id: "evolution", couleur: 4, motif: "flancs", teinteMotif: 0 })).toBe(true);
    expect(voitureChoisie()).toEqual({ id: "evolution", couleur: 4, motif: "flancs", teinteMotif: 0 }); // relu à la construction suivante
  });

  it("hors connexion ou serveur en panne : rien n'est perdu (la civile et ce que le dernier appel réussi avait débloqué)", async () => {
    noterDeblocages(["gt"]);
    choisirVoiture({ id: "gt", couleur: 1, motif: "unie", teinteMotif: 0 });
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    const online = new Online("jour-2026-10-23-g16", "2026-10-23", "https://api.test");
    expect(await online.profileApi!.garage!(online.playerId)).toMatchObject({ ok: false, code: "network" });
    expect([...voituresDebloquees()]).toEqual(["civile", "gt"]);
    expect(voitureChoisie().id).toBe("gt");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => reponse({ error: "busy" }, 503));
    expect(await online.profileApi!.garage!(online.playerId)).toMatchObject({ ok: false, status: 503 });
    expect(voitureChoisie().id).toBe("gt");
  });

  it("sans serveur du tout (pas d'API) : rien à demander, la civile", async () => {
    const online = new Online("jour-2026-10-23-g16", "2026-10-23", null);
    expect(online.profileApi).toBeNull();
    expect(voitureChoisie()).toEqual({ id: "civile", couleur: 0, motif: "course", teinteMotif: 0 });
  });

  it("le serveur fait foi : une voiture qu'il ne compte plus (un autre code chargé) n'est plus choisie", () => {
    noterDeblocages(["proto"]);
    choisirVoiture({ id: "proto", couleur: 2, motif: "course", teinteMotif: 0 });
    noterDeblocages([]);
    expect(voitureChoisie()).toEqual({ id: "civile", couleur: 0, motif: "course", teinteMotif: 0 });
  });

  it("une voiture verrouillée ne peut pas être choisie ; une liste illisible ou inconnue est ignorée", () => {
    expect(choisirVoiture({ id: "proto", couleur: 0, motif: "course", teinteMotif: 0 })).toBe(false);
    expect(stockage.getItem(CLE_GARAGE)).toBeNull();
    stockage.setItem(CLE_GARAGE, JSON.stringify({ debloquees: ["fusee", 42, "gt"] }));
    expect([...voituresDebloquees()]).toEqual(["civile", "gt"]);
    stockage.setItem(CLE_GARAGE, "{");
    expect([...voituresDebloquees()]).toEqual(["civile"]);
  });

  it("l'envoi d'un temps rend le statut du Garage : il est gardé aussitôt (aucune requête de plus)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      reponse({ accepted: true, improved: true, ms: 40_000, splits: [], respawns: 0, bestMs: 40_000, rank: 1, participants: 1, medal: "gold", garage: { ...statut(["gt"]), nouvelles: ["gt"] } }),
    );
    const online = new Online("jour-2026-10-23-g16", "2026-10-23", "https://api.test");
    const r = await online.submit({ ms: 40_000, splits: [], replay: "AAAA", simVersion: 1 } as never, "Garage");
    expect(r.ok && r.data.garage?.nouvelles).toEqual(["gt"]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect([...voituresDebloquees()]).toEqual(["civile", "gt"]);
  });
});

describe("la pastille « Nouveau »", () => {
  it("une voiture débloquée pas encore vue au Garage est nouvelle ; vue, elle ne l'est plus ; la civile ne l'est jamais", () => {
    expect(voituresNouvelles()).toEqual([]);
    noterDeblocages(["evolution", "proto"]);
    expect(voituresNouvelles()).toEqual(["evolution", "proto"]);
    marquerVues(["civile", "evolution"]);
    expect(voituresNouvelles()).toEqual(["proto"]);
    // Le choix, les déblocages et les voitures vues partagent la clé : écrire l'un ne perd pas les autres.
    choisirVoiture({ id: "evolution", couleur: 3, motif: "unie", teinteMotif: 0 });
    expect(JSON.parse(stockage.getItem(CLE_GARAGE)!)).toEqual({ id: "evolution", couleur: 3, motif: "unie", teinteMotif: 0, debloquees: ["evolution", "proto"], vues: ["civile", "evolution"] });
  });
});

describe("le joueur de démonstration (?api=demo)", () => {
  it("des voitures débloquées et d'autres à gagner, avec leur progression ; rien n'est demandé à un serveur", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const { DEMO_GARAGE, statutDemo } = await import("../src/garage");
    const s = statutDemo();
    expect(s.progres).toEqual(DEMO_GARAGE);
    const ok = s.voitures.filter((v) => v.debloquee).map((v) => v.id);
    expect(ok).toContain("civile");
    expect(ok.length).toBeGreaterThan(1);
    expect(s.voitures.some((v) => !v.debloquee && v.progres && v.progres.fait < v.progres.nombre)).toBe(true);
    expect(new Online("jour-2026-10-23-g16", "2026-10-23", "demo").profileApi?.garage).toBeUndefined(); // la démonstration ne lit pas le Garage par l'API
    expect(spy).not.toHaveBeenCalled();
  });

  it("LeaderboardApi.garage : GET /api/garage, l'identifiant dans l'en-tête", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => reponse(statut([])));
    await new LeaderboardApi("https://api.test").garage("a".repeat(32));
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://api.test/api/garage");
    expect(init!.method).toBe("GET");
    expect((init!.headers as Record<string, string>)["X-Player-Id"]).toBe("a".repeat(32));
  });
});
