import { describe, expect, it } from "vitest";
import { TRANSFER_PREFIX, crc32, decodeTransfer, encodeTransfer, readPlayerId } from "../src/index";

// Déplacé d'`apps/web/test/transfer.test.ts` au lot P0 (plateforme), assertions inchangées : le code `CDJ2` est celui de la plateforme.
// Restent dans `apps/web` les anciens codes `CDJ1` (records de DailyTrack) et `applyIdentity` (cache des records de DailyTrack).

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

describe("readPlayerId", () => {
  it("lit l'identifiant du navigateur, ou rien", () => {
    expect(readPlayerId(memory({ "cdj:player": ID }))).toBe(ID);
    expect(readPlayerId(memory())).toBeNull();
    expect(readPlayerId(memory({ "cdj:player": "pas-un-identifiant" }))).toBeNull();
  });
});
