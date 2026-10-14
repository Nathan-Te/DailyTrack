import { describe, expect, it } from "vitest";
import { CodecError, fromBase64Url, pushVarint, readVarint, toBase64Url } from "../src/index";

describe("base64url", () => {
  it("valeurs connues (RFC 4648, sans remplissage)", () => {
    const enc = (s: string) => toBase64Url([...s].map((c) => c.charCodeAt(0)));
    expect(enc("")).toBe("");
    expect(enc("f")).toBe("Zg");
    expect(enc("fo")).toBe("Zm8");
    expect(enc("foo")).toBe("Zm9v");
    expect(toBase64Url([0xfb, 0xff, 0xbf])).toBe("-_-_");
  });

  it("aller-retour sur tous les octets et toutes les longueurs", () => {
    const all = Array.from({ length: 256 }, (_, i) => i);
    for (let n = 0; n <= 20; n++) {
      const bytes = all.slice(n, 2 * n);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
    expect(fromBase64Url(toBase64Url(all))).toEqual(all);
  });

  it("refuse un caractère invalide ou une longueur impossible", () => {
    expect(() => fromBase64Url("ab$c")).toThrow(CodecError);
    expect(() => fromBase64Url("ab$c")).toThrow("caractère invalide");
    expect(() => fromBase64Url("A")).toThrow("longueur invalide");
    expect(() => fromBase64Url("Zm9vY")).toThrow("longueur invalide");
  });
});

describe("entiers de longueur variable", () => {
  const roundTrip = (n: number) => {
    const bytes: number[] = [];
    pushVarint(bytes, n);
    let i = 0;
    return { bytes, value: readVarint(() => bytes[i++]!) };
  };

  it("aller-retour, avec la bonne longueur", () => {
    for (const [n, len] of [[0, 1], [1, 1], [127, 1], [128, 2], [300, 2], [16383, 2], [16384, 3], [72000, 3], [2097151, 3]] as const) {
      const r = roundTrip(n);
      expect(r.value).toBe(n);
      expect(r.bytes.length, String(n)).toBe(len);
    }
  });

  it("refuse un entier trop long", () => {
    const bytes = [0x80, 0x80, 0x80, 0x80, 0x01];
    let i = 0;
    expect(() => readVarint(() => bytes[i++]!)).toThrow(CodecError);
  });
});
