import { createIdentity } from "@cdj/profile";
import { describe, expect, it } from "vitest";
import { DELAI_BASE_MS, FileEnvoi, type ReponseSource } from "../src/envoi";
import { creerRecords } from "../src/records";

// Lot K4c — la file d'envoi hors ligne d'un jeu neuf, sans DOM ni réseau : un faux serveur, un stockage en mémoire, des minuteries injectées. Le jeu ne bloque jamais sur le réseau ; un échec est un état.
function memoire(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: () => null, length: 0, clear: () => m.clear() } as Storage;
}
interface Rep {
  date: string;
  rank: number;
}
const ok = (rank = 1): ReponseSource<Rep> => ({ ok: true, data: { date: "2026-11-10", rank } });
const ko = (status: number, code = "", suggestions?: string[]): ReponseSource<Rep> => ({ ok: false, status, code, ...(suggestions ? { suggestions } : {}) });
const R = creerRecords({ cle: "essai:records", sens: ["desc"] });

function monter(reponses: ReponseSource<Rep>[] | null) {
  const stockage = memoire();
  const appels: { playerId: string; name: string | null; replay: string }[] = [];
  const source = reponses && { submit: async (playerId: string, name: string | null, replay: string) => (appels.push({ playerId, name, replay }), reponses.shift() ?? ko(500, "internal")) };
  const minuteries: { fn: () => void; ms: number }[] = [];
  const acceptes: Rep[] = [];
  const envoi = new FileEnvoi<Rep>({
    source,
    identity: createIdentity(() => stockage),
    stockage: () => stockage,
    records: R,
    setTimer: (fn, ms) => (minuteries.push({ fn, ms }), minuteries.length),
    clearTimer: () => {},
    surAccepte: (r) => acceptes.push(r),
  });
  const record = (v = 10, rediffusion = "AAAA") => R.proposer(stockage, "2026-11-10", { score: [v], medaille: null, rediffusion });
  return { envoi, stockage, appels, minuteries, record, acceptes };
}

describe("la file d'envoi d'un jeu neuf (lot K4c)", () => {
  it("sans serveur : rien ne part, l'état est « off »", async () => {
    const m = monter(null);
    m.record();
    m.envoi.offrir();
    await m.envoi.flush();
    expect(m.envoi.state.statut).toBe("off");
    expect(m.envoi.actif).toBe(false);
  });
  it("envoie le record du jour, garde la réponse du serveur et note l'envoi", async () => {
    const m = monter([ok(3)]);
    m.record();
    await m.envoi.flush();
    expect(m.envoi.state.statut).toBe("ranked");
    expect(m.envoi.resultats.get("2026-11-10")).toMatchObject({ rank: 3 });
    expect(m.acceptes).toHaveLength(1);
    expect(m.appels).toHaveLength(1);
    expect(R.enAttente(R.lire(m.stockage))).toEqual([]);
    await m.envoi.flush();
    expect(m.appels).toHaveLength(1); // rien de dû : rien ne repart
  });
  it("hors ligne : le record reste dû, le délai s'allonge, et le retour du réseau relance tout de suite", async () => {
    const m = monter([ko(0), ko(503), ok()]);
    m.record();
    await m.envoi.flush();
    expect(m.envoi.state).toMatchObject({ statut: "offline", code: "reseau" });
    expect(m.minuteries.at(-1)!.ms).toBe(DELAI_BASE_MS * 2);
    expect(R.enAttente(R.lire(m.stockage))).toHaveLength(1);
    m.minuteries.at(-1)!.fn();
    await m.envoi.flush();
    expect(m.envoi.state.statut).toBe("offline");
    expect(m.minuteries.at(-1)!.ms).toBe(DELAI_BASE_MS * 4);
    m.envoi.reveiller();
    await m.envoi.flush();
    expect(m.envoi.state.statut).toBe("ranked");
  });
  it("trop de requêtes (429) et route inconnue : « hors ligne », jamais un refus définitif", async () => {
    const m = monter([ko(429, "rate_limited"), ko(404, "not_found")]);
    m.record();
    await m.envoi.flush();
    expect(m.envoi.state).toMatchObject({ statut: "offline", code: "trop_envois" });
    await m.envoi.flush();
    expect(m.envoi.state).toMatchObject({ statut: "offline", code: "reseau" });
    expect(R.enAttente(R.lire(m.stockage))).toHaveLength(1);
  });
  it("une autre version ou un refus définitif : l'envoi est oublié, le jeu le dit", async () => {
    const v = monter([ko(409, "version")]);
    v.record();
    await v.envoi.flush();
    expect(v.envoi.state.statut).toBe("version");
    expect(R.enAttente(R.lire(v.stockage))).toEqual([]);
    const c = monter([ko(409, "replay_copy")]);
    c.record();
    await c.envoi.flush();
    expect(c.envoi.state).toMatchObject({ statut: "refused", code: "replay_copy" });
    expect(R.enAttente(R.lire(c.stockage))).toEqual([]);
  });
  it("premier envoi : le pseudo manque, l'envoi attend ; un code révoqué s'arrête sans rien oublier", async () => {
    const n = monter([ko(400, "name_required"), ko(409, "name_taken", ["Nowy2"])]);
    n.record();
    await n.envoi.flush();
    expect(n.envoi.state).toMatchObject({ statut: "name", code: "" });
    n.envoi.reveiller();
    expect(n.appels).toHaveLength(1); // en attente du pseudo : le réveil ne renvoie pas
    expect((await n.envoi.choisirPseudo("<script>")).ok).toBe(false);
    expect(n.envoi.state).toMatchObject({ statut: "name", code: "invalid_name" });
    const r = monter([ko(410, "code_revoked")]);
    r.record();
    await r.envoi.flush();
    expect(r.envoi.state.statut).toBe("revoked");
    expect(R.enAttente(R.lire(r.stockage))).toHaveLength(1);
    r.envoi.reveiller();
    expect(r.appels).toHaveLength(1);
  });
  it("n'envoie que les trois jours les plus récents qui attendent, du plus récent au plus ancien", async () => {
    const m = monter([ok(), ok(), ok(), ok()]);
    for (const d of ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]) R.proposer(m.stockage, d, { score: [1], medaille: null, rediffusion: `R${d}` });
    await m.envoi.flush();
    expect(m.appels.map((a) => a.replay)).toEqual(["R2026-11-09", "R2026-11-08", "R2026-11-07", "R2026-11-06"]);
  });
});
