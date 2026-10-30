// Lot T0 — le poids ajouté au chargement : octets compressés (gzip -9 et brotli -11, ce que sert Firebase Hosting) des morceaux construits de apps/tower/dist, par moteur.
//   npm run build -w @cdj/tower && npm run poids:tower -w @cdj/tower-sim
import { readFileSync, readdirSync } from "node:fs";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const dist = new URL("../../../apps/tower/dist/assets/", import.meta.url);
const ko = (n: number): string => `${(n / 1024).toFixed(1)} Ko`;
const taille = (b: Buffer): string => `${ko(b.length)} brut · ${ko(gzipSync(b, { level: 9 }).length)} gzip · ${ko(brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length)} brotli`;

for (const f of readdirSync(dist).filter((x) => x.endsWith(".js")).sort()) {
  const b = readFileSync(new URL(f, dist));
  const t = b.toString("utf8");
  const quoi = t.includes("data:application/wasm;base64") || t.includes("AGFzbQ") ? "moteur B (Rapier + WebAssembly en base64)" : t.includes("SIN_QUART") || t.includes("createWorldA") || /1024/.test(f) ? "moteur A" : "";
  console.log(`${f.padEnd(34)} ${taille(b)}${quoi ? `  ← ${quoi}` : ""}`);
}
const wasm = readFileSync(new URL("../../../node_modules/@dimforge/rapier2d-deterministic-compat/dist/rapier_wasm2d_bg.wasm", import.meta.url));
console.log(`\nLe WebAssembly de Rapier seul (sans le surcoût du base64) : ${taille(wasm)}`);
