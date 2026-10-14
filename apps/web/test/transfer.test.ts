import { describe, expect, it } from "vitest";
import { encodeReplay, runPilot, dailyCircuit, daysFromCivil } from "@cdj/sim";
import { TRANSFER_PREFIX, applyIdentity, crc32, decodeTransfer, encodeTransfer, legacyReplays, pendingTrackIds, readPlayerId } from "../src/transfer";

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

// Une vraie rediffusion (le pilote, sur le circuit du 14/10/2026) pour vérifier qu'elle voyage intacte dans un ancien code.
const REPLAY = (() => {
  const c = dailyCircuit(daysFromCivil(2026, 10, 14));
  return encodeReplay(runPilot(c.track, { grip: 0.9 }).replay);
})();

/** Un ancien code (lot 28, `CDJ1`) fabriqué à la main. */
function legacyCode(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return `CDJ1.${btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${crc32(bytes)}`;
}

describe("somme de contrôle", () => {
  it("CRC-32 usuel", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe("cbf43926");
    expect(crc32(new Uint8Array())).toBe("00000000");
  });
});

describe("le code de transfert ne contient que l'identifiant", () => {
  it("a la forme CDJ2.<identifiant>.<somme de contrôle> et fait l'aller-retour", () => {
    const code = encodeTransfer(ID);
    expect(code).toBe(`${TRANSFER_PREFIX}.${ID}.${crc32(new TextEncoder().encode(ID))}`);
    expect(code).toMatch(/^CDJ2\.[0-9a-f]{32}\.[0-9a-f]{8}$/);
    expect(code.length).toBe(46);
    const back = decodeTransfer(code);
    expect(back).toEqual({ ok: true, data: { version: 2, id: ID, name: null, best: {}, sub: {} } });
  });

  it("ne dit rien des records ni du pseudo (le serveur les connaît)", () => {
    expect(encodeTransfer(ID)).not.toMatch(/Alice|jour-|ms/);
  });

  it("ignore les espaces, les retours à la ligne et la casse ajoutés en copiant", () => {
    const code = encodeTransfer(ID);
    expect(decodeTransfer(` ${code.slice(0, 20)}\n  ${code.slice(20)}\n`).ok).toBe(true);
    expect(decodeTransfer(code.toUpperCase().replace("CDJ2", "CDJ2")).ok).toBe(true);
  });

  it("refuse un code tronqué, modifié ou qui n'en est pas un", () => {
    const code = encodeTransfer(ID);
    const flipped = code.slice(0, 10) + (code[10] === "a" ? "b" : "a") + code.slice(11);
    for (const bad of [code.slice(0, -3), code.slice(0, 20) + code.slice(24), flipped, "", "   ", "bonjour", "CDJ3.abc.00000000", `${code}.x`, `CDJ2.${"z".repeat(32)}.00000000`, "CDJ2.abc.00000000"]) {
      expect(decodeTransfer(bad).ok, bad.slice(0, 24)).toBe(false);
    }
    const r = decodeTransfer(flipped);
    expect(!r.ok && r.reason).toContain("somme de contrôle");
  });
});

describe("anciens codes (CDJ1) : toujours acceptés", () => {
  it("lisent identifiant, pseudo et rediffusions ; les records seront envoyés puis ignorés", () => {
    const r = decodeTransfer(
      legacyCode({
        v: 1,
        id: ID,
        name: "Alice",
        best: {
          "jour-2026-10-13-g15": { ms: 41_000, splits: [1, 2], medal: "silver", simVersion: 14 },
          "jour-2026-10-14-g15": { ms: 40_500, splits: [1, 2], simVersion: 14, replay: REPLAY },
        },
        sub: { "jour-2026-10-13-g15": 41_000 },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ version: 1, id: ID, name: "Alice" });
    expect(legacyReplays(r.data)).toEqual([{ date: "2026-10-14", replay: REPLAY }]); // seules les rediffusions partent au serveur
  });

  it("refusent tronqués ou abîmés, et valident chaque champ : un code piégé n'écrit que du propre", () => {
    const code = legacyCode({ v: 1, id: ID, name: "A", best: {}, sub: {} });
    expect(decodeTransfer(code.slice(0, -10)).ok).toBe(false);
    expect(decodeTransfer("CDJ1.abc").ok).toBe(false);
    expect(decodeTransfer("CDJ1.!!!.00000000").ok).toBe(false);
    expect(decodeTransfer(legacyCode({ v: 1, id: "court", best: {}, sub: {} })).ok).toBe(false);
    expect(decodeTransfer(legacyCode({ v: 2, id: ID })).ok).toBe(false);
    const r = decodeTransfer(
      legacyCode({
        v: 1,
        id: ID,
        name: "A".repeat(500),
        best: {
          "jour-2026-10-13-g15": { ms: 41_000, splits: [1, 2], medal: "diamant", simVersion: 14, replay: "pas une rediffusion !" },
          "cdj:tune": { ms: 1, splits: [] },
          "../../x": { ms: 1, splits: [] },
          "jour-2026-10-14-g15": { ms: -5, splits: [] },
          "jour-2026-10-17-g15": { ms: 40_000, splits: [1], replay: "A".repeat(50) },
        },
        sub: { "jour-2026-10-13-g15": 41_000, "autre": 5, "jour-2026-10-14-g15": "texte" },
        __proto__: { admin: true },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBeNull(); // pseudo trop long : ignoré
    expect(Object.keys(r.data.best).sort()).toEqual(["jour-2026-10-13-g15", "jour-2026-10-17-g15"]);
    expect(r.data.best["jour-2026-10-13-g15"]).toEqual({ ms: 41_000, splits: [1, 2], simVersion: 14 });
    expect(r.data.sub).toEqual({ "jour-2026-10-13-g15": 41_000 });
  });
});

describe("readPlayerId", () => {
  it("lit l'identifiant du navigateur, ou rien", () => {
    expect(readPlayerId(memory({ "cdj:player": ID }))).toBe(ID);
    expect(readPlayerId(memory())).toBeNull();
    expect(readPlayerId(memory({ "cdj:player": "pas-un-identifiant" }))).toBeNull();
  });
});

describe("applyIdentity", () => {
  const target = () =>
    memory({
      "cdj:player": OTHER_ID,
      "cdj:name": "Bob",
      "cdj:best:jour-2026-10-13-g15": rec(60_000),
      "cdj:best:jour-2026-10-20-g15": rec(61_000, { replay: REPLAY }),
      "cdj:sub:jour-2026-10-20-g15": "62000", // confirmé par l'ancien identifiant (62 000 > 61 000 : le record local est meilleur, donc à envoyer) : effacé
      "cdj:rank:2026-10-13": JSON.stringify({ rank: 1, participants: 2 }),
      "cdj:player:next": OTHER_ID,
      "cdj:notice:rename": "Bob·2",
      "cdj:best:essai": rec(7_000),
      "cdj:touch": '{"a":1}',
      "cdj:audio": "{}",
    });

  it("change l'identité, vide le cache des records et des places, garde réglages et essais", () => {
    const t = target();
    expect(applyIdentity({ id: ID, name: "Alice" }, t)).toBe(true);
    const after = t.dump();
    expect(after["cdj:player"]).toBe(ID);
    expect(after["cdj:name"]).toBe("Alice");
    expect(Object.keys(after).filter((k) => /^cdj:(best:jour|sub|rank|player:next|notice)/.test(k))).toEqual([]);
    expect(after["cdj:best:essai"]).toBeDefined();
    expect(after["cdj:touch"]).toBe('{"a":1}');
    expect(after["cdj:audio"]).toBe("{}");
    // Idempotent.
    applyIdentity({ id: ID, name: "Alice" }, t);
    expect(t.dump()).toEqual(after);
  });

  it("garde le record du jour pas encore classé : il sera envoyé au nom du profil chargé", () => {
    const t = target();
    expect(pendingTrackIds(t, "2026-10-20")).toEqual(["jour-2026-10-20-g15"]);
    applyIdentity({ id: ID, name: null }, t, pendingTrackIds(t, "2026-10-20"));
    expect(t.getItem("cdj:best:jour-2026-10-20-g15")).not.toBeNull();
    expect(t.getItem("cdj:sub:jour-2026-10-20-g15")).toBeNull(); // « confirmé » par l'ancien identifiant ne vaut rien pour le nouveau
    expect(t.getItem("cdj:best:jour-2026-10-13-g15")).toBeNull();
    expect(t.getItem("cdj:name")).toBeNull(); // sans pseudo connu, l'ancien est retiré (il ne va pas avec le nouvel identifiant)
  });

  it("ne garde rien d'un record déjà confirmé par le serveur ni d'un autre jour", () => {
    const t = memory({
      "cdj:best:jour-2026-10-20-g15": rec(61_000, { replay: REPLAY }),
      "cdj:sub:jour-2026-10-20-g15": "61000", // confirmé
      "cdj:best:jour-2026-10-19-g15": rec(61_000, { replay: REPLAY }), // un autre jour
      "cdj:best:jour-2026-10-18-g15": rec(61_000), // sans rediffusion
    });
    expect(pendingTrackIds(t, "2026-10-20")).toEqual([]);
    // Un meilleur temps local que le confirmé : à envoyer.
    t.setItem("cdj:best:jour-2026-10-20-g15", rec(60_000, { replay: REPLAY }));
    expect(pendingTrackIds(t, "2026-10-20")).toEqual(["jour-2026-10-20-g15"]);
  });

  it("rend faux quand le stockage refuse (navigation privée pleine)", () => {
    const full = { ...memory(), setItem: () => { throw new Error("quota"); } };
    expect(applyIdentity({ id: ID, name: "A" }, full)).toBe(false);
  });
});
