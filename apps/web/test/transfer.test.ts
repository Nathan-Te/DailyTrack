import { describe, expect, it } from "vitest";
import { encodeReplay, runPilot, dailyCircuit, daysFromCivil } from "@cdj/sim";
import { KEEP_REPLAYS, TRANSFER_PREFIX, applyTransfer, collectTransfer, crc32, decodeTransfer, describeTransfer, encodeTransfer } from "../src/transfer";

/** Un `localStorage` en mémoire. */
function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const ID = "0123456789abcdef0123456789abcdef";
const OTHER_ID = "ffffffffffffffffffffffffffffffff";
const rec = (ms: number, extra: object = {}) => JSON.stringify({ ms, splits: [10_000, 20_000], simVersion: 14, medal: "silver", ...extra });

// Une vraie rediffusion (le pilote, sur un circuit d'essai court : celui du jour est trop long à générer ici) pour vérifier qu'elle voyage intacte.
const REPLAY = (() => {
  const c = dailyCircuit(daysFromCivil(2026, 10, 14));
  return encodeReplay(runPilot(c.track, { grip: 0.9 }).replay);
})();

const sample = () =>
  memory({
    "cdj:player": ID,
    "cdj:name": "Alice",
    "cdj:best:jour-2026-10-13-g15": rec(41_000),
    "cdj:best:jour-2026-10-14-g15": rec(40_500, { replay: REPLAY }),
    "cdj:best:jour-2026-10-15-g15-banquise": rec(39_000),
    "cdj:best:essai": rec(5_000), // un essai : ne voyage pas
    "cdj:sub:jour-2026-10-13-g15": "41000",
    "cdj:sub:jour-2026-10-14-g15": "40500",
    "cdj:touch": "{}", // un réglage : ne voyage pas
  });

describe("somme de contrôle", () => {
  it("CRC-32 usuel", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe("cbf43926");
    expect(crc32(new Uint8Array())).toBe("00000000");
  });
});

describe("collectTransfer", () => {
  it("emporte identité, records des circuits du jour et temps confirmés — pas les essais ni les réglages", () => {
    const data = collectTransfer(sample())!;
    expect(data.id).toBe(ID);
    expect(data.name).toBe("Alice");
    expect(Object.keys(data.best).sort()).toEqual(["jour-2026-10-13-g15", "jour-2026-10-14-g15", "jour-2026-10-15-g15-banquise"]);
    expect(data.sub).toEqual({ "jour-2026-10-13-g15": 41_000, "jour-2026-10-14-g15": 40_500 });
  });

  it("sans identité (jamais joué en ligne), rien à emporter", () => {
    expect(collectTransfer(memory({ "cdj:best:jour-2026-10-13-g15": rec(1) }))).toBeNull();
    expect(collectTransfer(memory({ "cdj:player": "pas-un-identifiant" }))).toBeNull();
  });

  it("garde la rediffusion des derniers jours et des courses pas encore confirmées, pas des autres", () => {
    const store: Record<string, string> = { "cdj:player": ID };
    for (let d = 1; d <= KEEP_REPLAYS + 2; d++) {
      const day = String(d).padStart(2, "0");
      store[`cdj:best:jour-2026-11-${day}-g15`] = rec(40_000 + d, { replay: REPLAY });
      store[`cdj:sub:jour-2026-11-${day}-g15`] = String(40_000 + d); // confirmés par le serveur
    }
    store["cdj:best:jour-2026-10-01-g15"] = rec(50_000, { replay: REPLAY }); // vieux, confirmé
    store["cdj:sub:jour-2026-10-01-g15"] = "50000";
    store["cdj:best:jour-2026-10-02-g15"] = rec(51_000, { replay: REPLAY }); // vieux mais jamais envoyé : sa rediffusion est la seule trace
    const data = collectTransfer(memory(store))!;
    const withReplay = Object.entries(data.best).filter(([, r]) => r.replay).map(([k]) => k).sort();
    expect(withReplay).toEqual([...["2026-11-05", "2026-11-04", "2026-11-03"].map((d) => `jour-${d}-g15`), "jour-2026-10-02-g15"].sort());
  });
});

describe("encodeTransfer / decodeTransfer", () => {
  it("fait l'aller-retour sans rien perdre, rediffusion comprise", () => {
    const data = collectTransfer(sample())!;
    const code = encodeTransfer(data);
    expect(code.startsWith(`${TRANSFER_PREFIX}.`)).toBe(true);
    expect(code).toMatch(/^CDJ1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    const back = decodeTransfer(code);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.data.id).toBe(ID);
    expect(back.data.name).toBe("Alice");
    expect(back.data.best["jour-2026-10-14-g15"]!.replay).toBe(REPLAY);
    expect(back.data.best["jour-2026-10-13-g15"]).toMatchObject({ ms: 41_000, medal: "silver", simVersion: 14 });
    expect(back.data.sub["jour-2026-10-13-g15"]).toBe(41_000);
  });

  it("supporte un pseudo avec des accents", () => {
    const store = sample();
    store.setItem("cdj:name", "Zoë l'été");
    const back = decodeTransfer(encodeTransfer(collectTransfer(store)!));
    expect(back.ok && back.data.name).toBe("Zoë l'été");
  });

  it("ignore les espaces et retours à la ligne ajoutés en copiant", () => {
    const code = encodeTransfer(collectTransfer(sample())!);
    const wrapped = code.replace(/(.{60})/g, "$1\n  ") + "\n";
    expect(decodeTransfer(wrapped).ok).toBe(true);
  });

  it("refuse un code tronqué, modifié, ou qui n'en est pas un — avant de toucher à quoi que ce soit", () => {
    const code = encodeTransfer(collectTransfer(sample())!);
    const mid = code.length >> 1;
    const flipped = code.slice(0, mid) + (code[mid] === "A" ? "B" : "A") + code.slice(mid + 1);
    for (const bad of [code.slice(0, -10), code.slice(0, 30) + code.slice(40), flipped, "", "   ", "bonjour", "CDJ2.abc.00000000", "CDJ1.abc", `${code}.x`, "CDJ1.!!!.00000000"]) {
      const r = decodeTransfer(bad);
      expect(r.ok, bad.slice(0, 20)).toBe(false);
    }
    const r = decodeTransfer(flipped);
    expect(!r.ok && r.reason).toContain("somme de contrôle");
  });

  it("valide le contenu champ par champ : un code bien formé mais piégé n'écrit que du propre", () => {
    const hand = (payload: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      return `CDJ1.${btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${crc32(bytes)}`;
    };
    expect(decodeTransfer(hand({ v: 1, id: "court", best: {}, sub: {} })).ok).toBe(false);
    expect(decodeTransfer(hand({ v: 2, id: ID })).ok).toBe(false);
    const r = decodeTransfer(
      hand({
        v: 1,
        id: ID,
        name: "A".repeat(500),
        best: {
          "jour-2026-10-13-g15": { ms: 41_000, splits: [1, 2], medal: "diamant", simVersion: 14, replay: "pas une rediffusion !" },
          "cdj:tune": { ms: 1, splits: [] },
          "../../x": { ms: 1, splits: [] },
          "jour-2026-10-14-g15": { ms: -5, splits: [] },
          "jour-2026-10-15-g15": { ms: 40_000, splits: "oops" },
          "jour-2026-10-16-g15": { ms: 40_000, splits: [1, "x"] },
          "jour-2026-10-17-g15": { ms: 40_000, splits: [1], replay: "A".repeat(50) },
        },
        sub: { "jour-2026-10-13-g15": 41_000, "autre": 5, "jour-2026-10-14-g15": "texte", "jour-2026-10-15-g15": 0 },
        __proto__: { admin: true },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBeNull(); // pseudo trop long : ignoré, le joueur en choisira un
    expect(Object.keys(r.data.best).sort()).toEqual(["jour-2026-10-13-g15", "jour-2026-10-17-g15"]);
    expect(r.data.best["jour-2026-10-13-g15"]).toEqual({ ms: 41_000, splits: [1, 2], simVersion: 14 }); // médaille inconnue et rediffusion illisible laissées de côté
    expect(r.data.best["jour-2026-10-17-g15"]!.replay).toBeUndefined();
    expect(r.data.sub).toEqual({ "jour-2026-10-13-g15": 41_000 });
  });
});

describe("applyTransfer", () => {
  it("remplace l'identité et les records des circuits du jour, garde réglages et essais", () => {
    const target = memory({
      "cdj:player": OTHER_ID,
      "cdj:name": "Bob",
      "cdj:best:jour-2026-10-13-g15": rec(60_000),
      "cdj:best:jour-2026-10-20-g15": rec(61_000), // seulement sur cet appareil : effacé (le code remplace)
      "cdj:sub:jour-2026-10-20-g15": "61000", // appartient à l'ancien identifiant : effacé
      "cdj:best:essai": rec(7_000),
      "cdj:touch": '{"a":1}',
      "cdj:audio": "{}",
    });
    const decoded = decodeTransfer(encodeTransfer(collectTransfer(sample())!));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(applyTransfer(decoded.data, target)).toBe(true);
    const after = target.dump();
    expect(after["cdj:player"]).toBe(ID);
    expect(after["cdj:name"]).toBe("Alice");
    expect(JSON.parse(after["cdj:best:jour-2026-10-13-g15"]!).ms).toBe(41_000);
    expect(after["cdj:best:jour-2026-10-20-g15"]).toBeUndefined();
    expect(after["cdj:sub:jour-2026-10-20-g15"]).toBeUndefined();
    expect(after["cdj:sub:jour-2026-10-14-g15"]).toBe("40500");
    expect(after["cdj:best:essai"]).toBeDefined();
    expect(after["cdj:touch"]).toBe('{"a":1}');
    expect(after["cdj:audio"]).toBe("{}");
    // Idempotent : un deuxième collage donne le même état.
    applyTransfer(decoded.data, target);
    expect(target.dump()).toEqual(after);
  });

  it("sans pseudo dans le code, l'ancien pseudo est retiré (il ne va pas avec le nouvel identifiant)", () => {
    const target = memory({ "cdj:player": OTHER_ID, "cdj:name": "Bob" });
    applyTransfer({ id: ID, name: null, best: {}, sub: {} }, target);
    expect(target.getItem("cdj:name")).toBeNull();
    expect(target.getItem("cdj:player")).toBe(ID);
  });

  it("rend faux quand le stockage refuse (navigation privée pleine)", () => {
    const full = { ...memory(), setItem: () => { throw new Error("quota"); } };
    expect(applyTransfer({ id: ID, name: "A", best: {}, sub: {} }, full)).toBe(false);
  });

  it("décrit ce qu'on s'apprête à remplacer", () => {
    expect(describeTransfer({ id: ID, name: "Alice", best: { a: { ms: 1, splits: [] }, b: { ms: 1, splits: [] } }, sub: {} })).toBe("pseudo « Alice », 2 records");
    expect(describeTransfer({ id: ID, name: null, best: {}, sub: {} })).toBe("sans pseudo, 0 record");
  });
});
