import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { extraireWasm, RAPIER_WASM_SHA256 } from "../rapierWasm";

// Lot T1 : le `.wasm` que le navigateur télécharge (sorti du paquet `-compat` à la construction) est EXACTEMENT celui que Node décode du même paquet, et celui du paquet
// `@dimforge/rapier2d-deterministic` 0.21.0 (non « compat ») : même SHA-256. Un autre binaire ferait diverger les rediffusions (le serveur du lot T2 rejoue sur Node).
const paquet = createRequire(import.meta.url).resolve("@dimforge/rapier2d-deterministic-compat").replace(/rapier\.cjs$/, "rapier.mjs");

describe("le WebAssembly de Rapier servi comme un fichier", () => {
  const code = readFileSync(paquet, "utf8");

  it("le paquet -compat embarque un seul binaire, d'empreinte connue (celle du binaire déterministe 0.21.0)", () => {
    const { octets, texte } = extraireWasm(code);
    expect(createHash("sha256").update(octets).digest("hex")).toBe(RAPIER_WASM_SHA256);
    expect(octets.subarray(0, 4).toString("latin1")).toBe("\0asm");
    expect(texte.startsWith("Vg.toByteArray(") || /^\w+\.toByteArray\(/.test(texte)).toBe(true);
  });

  it("le littéral est remplacé en entier : plus aucun octet du binaire dans le JavaScript", () => {
    const { texte } = extraireWasm(code);
    const remplace = code.replace(texte, 'new URL("x.wasm", import.meta.url).href');
    expect(remplace.length).toBeLessThan(code.length - 3_000_000);
    expect(remplace).not.toContain("AGFzbQ");
    expect(remplace).toContain('{module_or_path:new URL("x.wasm", import.meta.url).href}');
  });

  it("un paquet sans binaire (ou avec deux) est refusé : la construction échoue au lieu de publier autre chose", () => {
    expect(() => extraireWasm("rien")).toThrow(/un seul attendu/);
  });
});
