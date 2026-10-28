import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, echantillonnerTrajectoire, encoderTrajectoire } from "@cdj/jump-sim";
import type { ApiResult } from "@cdj/profile";
import { DIAMOND_GHOST_COLOR, DiamondReader, checkDiamond, type DiamondData } from "../src/diamond";
import { GHOST_CHOICES, loadGhostChoice, nextChoice, parseChoice, saveGhostChoice, serializeChoice, shown, startChoice, type GhostChoice } from "../src/ghostChoice";
import { HttpRankSource } from "../src/rankApi";
import { DemoRankSource } from "../src/demoRank";
import type { KeyValue } from "../src/memory";
import "./francais";

// Lot G1 (plateforme) : le fantôme Diamant de Jump vu du jeu — le choix qui tourne (et saute ce qui n'existe pas), sa mémorisation sous la clé d'avant (`jump:fantome`),
// la lecture du Diamant (validation, déblocage, panne), le client HTTP. La trajectoire elle-même (échantillonnage, interpolation) : `packages/jump-sim/test/trajectoire.test.ts`.

class MemStore implements KeyValue {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}
const BROKEN: KeyValue = {
  getItem: () => {
    throw new Error("indisponible");
  },
  setItem: () => {
    throw new Error("indisponible");
  },
  removeItem: () => {
    throw new Error("indisponible");
  },
  key: () => {
    throw new Error("indisponible");
  },
  length: 0,
};

const ALL = { premier: true, diamant: true };
const NONE = { premier: false, diamant: false };

describe("le choix du fantôme tourne et saute ce qui n'existe pas", () => {
  it("l'ordre : le tien → le premier → le Diamant → aucun → le tien", () => {
    expect(GHOST_CHOICES).toEqual(["mien", "premier", "diamant", "aucun"]);
    let c: GhostChoice = "mien";
    const seen: GhostChoice[] = [];
    for (let i = 0; i < 5; i++) seen.push((c = nextChoice(c, ALL)));
    expect(seen).toEqual(["premier", "diamant", "aucun", "mien", "premier"]);
  });
  it("avant le déblocage, le Diamant n'est pas dans le cycle (ni le premier quand personne n'est lu ou que c'est toi)", () => {
    expect(nextChoice("premier", { premier: true, diamant: false })).toBe("aucun");
    expect(nextChoice("mien", { premier: false, diamant: true })).toBe("diamant");
    expect(nextChoice("mien", NONE)).toBe("aucun");
    expect(nextChoice("aucun", NONE)).toBe("mien");
  });
  it("un choix courant qui n'existe plus mène au suivant possible ; « le tien » et « aucun » existent toujours", () => {
    expect(nextChoice("diamant", NONE)).toBe("aucun");
    expect(nextChoice("premier", NONE)).toBe("aucun");
    for (const c of GHOST_CHOICES) expect(["mien", "aucun"]).toContain(nextChoice(c, NONE));
  });
  it("ce que chaque choix montre : le tien avec le premier à côté (réglage), le premier seul, le Diamant seul, rien", () => {
    expect(shown("mien", true)).toEqual({ own: true, first: true, diamond: false });
    expect(shown("mien", false)).toEqual({ own: true, first: false, diamond: false });
    expect(shown("premier", false)).toEqual({ own: false, first: true, diamond: false });
    expect(shown("diamant", true)).toEqual({ own: false, first: false, diamond: true });
    expect(shown("aucun", true)).toEqual({ own: false, first: false, diamond: false });
  });
});

describe("mémorisé sous `jump:fantome`, la clé d'avant le lot", () => {
  it("les valeurs d'avant se lisent : « 1 » le tien, « 0 » aucun ; les nouvelles : premier, diamant ; le reste : le tien", () => {
    expect(parseChoice("1")).toBe("mien");
    expect(parseChoice("0")).toBe("aucun");
    expect(parseChoice("premier")).toBe("premier");
    expect(parseChoice("diamant")).toBe("diamant");
    expect(parseChoice(null)).toBe("mien");
    expect(parseChoice("n'importe quoi")).toBe("mien");
    for (const c of GHOST_CHOICES) expect(parseChoice(serializeChoice(c))).toBe(c);
    expect(serializeChoice("mien")).toBe("1");
    expect(serializeChoice("aucun")).toBe("0");
  });
  it("écrit et relu dans la même clé, sans clé nouvelle", () => {
    const store = new MemStore();
    expect(loadGhostChoice(store)).toBe("mien");
    saveGhostChoice(store, "diamant");
    expect([...store.data.keys()]).toEqual(["jump:fantome"]);
    expect(loadGhostChoice(store)).toBe("diamant");
    store.setItem("jump:fantome", "0"); // un joueur d'avant le lot qui l'avait caché
    expect(loadGhostChoice(store)).toBe("aucun");
  });
  it("marche sans stockage et avec un stockage qui lève", () => {
    for (const store of [null, BROKEN]) {
      expect(loadGhostChoice(store)).toBe("mien");
      expect(() => saveGhostChoice(store, "premier")).not.toThrow();
    }
  });
  it("?ghost= impose le choix de départ sans toucher à ce qui est mémorisé", () => {
    expect(startChoice(null, "diamant")).toBe("diamant");
    expect(startChoice("off", "diamant")).toBe("aucun");
    expect(startChoice("first", "mien")).toBe("premier");
    expect(startChoice("best", "aucun")).toBe("mien");
  });
});

// Un jour du jeu de données de la démonstration : un vrai niveau, la vraie trajectoire de son auteur.
const D = dailyLevel(daysFromCivil(2026, 10, 30));
const TRAJ = encoderTrajectoire(echantillonnerTrajectoire(D.level, D.replay));
const data = (extra: Partial<DiamondData> = {}): DiamondData => ({ date: D.date, levelId: D.id, ticks: D.authorTicks, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, trajectoire: TRAJ, ...extra });

describe("la lecture du Diamant est vérifiée (rien n'est pris sur parole)", () => {
  it("une réponse valide : la trajectoire et le temps de l'auteur", () => {
    const r = checkDiamond(data(), D.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.diamond.ticks).toBe(D.authorTicks);
    expect(r.diamond.traj.x.length).toBeGreaterThan(100);
  });
  it("un autre niveau, une autre version (serveur plus récent), une réponse incomplète, une trajectoire illisible ou d'une autre durée : ignorée", () => {
    expect(checkDiamond(data({ levelId: `jour-${D.date}-g${JUMP_GENERATOR_VERSION - 1}` }), D.id)).toMatchObject({ ok: false, reason: "autre niveau" });
    expect(checkDiamond(data({ simVersion: JUMP_SIM_VERSION + 1 }), D.id)).toMatchObject({ ok: false, reason: "autre version du jeu" });
    expect(checkDiamond(data({ generatorVersion: JUMP_GENERATOR_VERSION + 1 }), D.id).ok).toBe(false);
    expect(checkDiamond(null, D.id).ok).toBe(false);
    expect(checkDiamond({ levelId: D.id }, D.id).ok).toBe(false);
    expect(checkDiamond(data({ trajectoire: "pas-une-trajectoire!" }), D.id).ok).toBe(false);
    expect(checkDiamond(data({ trajectoire: TRAJ.slice(0, 20) }), D.id).ok).toBe(false);
    expect(checkDiamond(data({ ticks: D.authorTicks + 500 }), D.id)).toMatchObject({ ok: false, reason: "trajectoire d'une autre durée" });
  });
  it("sa couleur : un vert menthe, loin du cyan du tien et du mauve du premier (teinte à ≥ 60°), détail dans test/fantomes.test.ts", () => {
    expect(DIAMOND_GHOST_COLOR).toBe(0x8dff80);
  });
});

/** Une source qui note ses appels et rend ce qu'on lui dit. */
function source(answer: (date: string, id: string | null) => ApiResult<DiamondData>) {
  const calls: { date: string; id: string | null }[] = [];
  return { calls, diamond: async (date: string, id: string | null) => (calls.push({ date, id }), answer(date, id)) };
}
const ok = (): ApiResult<DiamondData> => ({ ok: true, data: data() });
const locked = (): ApiResult<DiamondData> => ({ ok: false, status: 403, code: "ghost_locked", message: "" });
const down = (): ApiResult<DiamondData> => ({ ok: false, status: 0, code: "network", message: "" });
const reader = (src: ReturnType<typeof source> | null, o: { date?: string | null; free?: boolean; id?: string | null } = {}) =>
  new DiamondReader({ source: src, date: o.date === undefined ? D.date : o.date, levelId: D.id, free: o.free ?? false, playerId: () => (o.id === undefined ? "id-secret" : o.id) });

describe("le déblocage : le jour même demande un résultat classé, un jour passé est libre", () => {
  it("le jour même : refusé par le serveur (ghost_locked) = verrouillé, sans erreur ; après un résultat accepté, on relit et il est là", async () => {
    let finished = false;
    const src = source(() => (finished ? ok() : locked()));
    const r = reader(src);
    expect(r.status).toBe("locked");
    expect(await r.load()).toBe("locked");
    expect(r.miss).toBe("ghost_locked");
    expect(r.diamond).toBeNull();
    finished = true; // un envoi accepté
    expect(await r.load()).toBe("ready");
    expect(r.diamond?.ticks).toBe(D.authorTicks);
    expect(src.calls).toHaveLength(2);
    expect(await r.load()).toBe("ready"); // gardé : aucune lecture de plus
    expect(src.calls).toHaveLength(2);
  });
  it("le jour même sans identité : aucune requête (le serveur ne pourrait que refuser)", async () => {
    const src = source(ok);
    const r = reader(src, { id: null });
    expect(await r.load()).toBe("locked");
    expect(r.miss).toBe("no_player");
    expect(src.calls).toHaveLength(0);
  });
  it("une archive est libre : lue sans identité", async () => {
    const src = source(ok);
    const r = reader(src, { free: true, id: null });
    expect(await r.load()).toBe("ready");
    expect(src.calls).toEqual([{ date: D.date, id: null }]);
  });
  it("une panne ou une réponse d'une autre version : « indisponible », jamais un blocage ; la lecture suivante retente", async () => {
    let answer: () => ApiResult<DiamondData> = down;
    const r = reader(source(() => answer()));
    expect(await r.load()).toBe("missing");
    expect(r.miss).toBe("network");
    answer = () => ({ ok: true, data: data({ simVersion: JUMP_SIM_VERSION + 1 }) });
    expect(await r.load()).toBe("missing");
    expect(r.miss).toBe("autre version du jeu");
    answer = ok;
    expect(await r.load()).toBe("ready");
  });
  it("deux lectures ensemble n'en font qu'une", async () => {
    const src = source(ok);
    const r = reader(src);
    const [a, b] = await Promise.all([r.load(), r.load()]);
    expect([a, b]).toEqual(["ready", "ready"]);
    expect(src.calls).toHaveLength(1);
  });
  it("rien sans serveur, en démonstration (sa source n'a pas de Diamant), ni pour un essai, un morceau, un scénario ou un jour à venir (date nulle)", async () => {
    for (const r of [reader(null), reader(source(ok), { date: null }), new DiamondReader({ source: new DemoRankSource("demo/", null, async () => new Response("", { status: 404 })), date: D.date, levelId: D.id, free: true, playerId: () => null })]) {
      expect(r.status).toBe("off");
      expect(await r.load()).toBe("off");
      expect(r.miss).toBe("aucun serveur");
    }
  });
});

describe("le client HTTP : l'identifiant dans l'en-tête, jamais dans l'adresse", () => {
  it("GET /api/jump/fantome-diamant?date=, avec X-Player-Id seulement s'il y en a un", async () => {
    const seen: { url: string; headers: Record<string, string>; method: string }[] = [];
    const http = new HttpRankSource("https://exemple.test", async (url, init) => {
      seen.push({ url, headers: { ...(init.headers as Record<string, string>) }, method: init.method ?? "GET" });
      return new Response(JSON.stringify(data()), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const r = await http.diamond(D.date, "id-secret");
    expect(r.ok).toBe(true);
    await http.diamond(D.date, null);
    expect(seen[0]!.url).toBe(`https://exemple.test/api/jump/fantome-diamant?date=${formatDay(daysFromCivil(2026, 10, 30))}`);
    expect(seen[0]!.method).toBe("GET");
    expect(seen[0]!.headers["X-Player-Id"]).toBe("id-secret");
    expect(seen[0]!.url).not.toContain("id-secret");
    expect(seen[1]!.headers["X-Player-Id"]).toBeUndefined();
  });
  it("un 403 ghost_locked arrive en valeur (jamais une exception)", async () => {
    const http = new HttpRankSource("https://exemple.test", async () => new Response(JSON.stringify({ error: "ghost_locked" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const r = await http.diamond(D.date, "id");
    expect(r).toMatchObject({ ok: false, status: 403, code: "ghost_locked" });
  });
});
