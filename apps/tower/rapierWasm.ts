import { createHash } from "node:crypto";
import type { Plugin } from "vite";

// Lot T1 — le WebAssembly de Rapier **servi comme un fichier** au lieu d'être inclus en base64 dans le JavaScript (−30 % de poids transféré : le `.wasm` seul compresse mieux que son
// texte en base64). Le paquet `@dimforge/rapier2d-deterministic` (non « compat ») sert lui aussi le `.wasm` comme un fichier, mais il demande à l'outil de construction **et** à Vitest
// de charger un module WebAssembly par `import` (un greffon et un changement de la configuration racine, zone partagée) ; ce greffon-ci fait la même chose pour la **seule construction
// du jeu**, sans nouvelle dépendance : il sort du JavaScript du paquet `-compat` le `.wasm` embarqué, le publie en fichier à côté, et le chargeur de Rapier (`init`) le demande par son adresse.
// Node (les tests, le serveur du lot T2) lit toujours le `-compat` tel quel. **Le binaire est le même octet pour octet** : ce SHA-256 est celui du `rapier_wasm2d_bg.wasm` de
// `@dimforge/rapier2d-deterministic@0.21.0` ET celui de l'octet décodé du `-compat` (vérifié par `test/rapierWasm.test.ts` et à chaque construction : une autre empreinte la fait échouer).
export const RAPIER_WASM_SHA256 = "0570d5c822275fbadbbfe4bda0c589b039c2f41259676dc53f6679085601155d";

/** Le littéral base64 (un seul, des centaines de Ko) que le chargeur du paquet `-compat` décode : `Vg.toByteArray("AGFzbQ…").buffer`. */
const LITTERAL = /\b\w+\.toByteArray\("([A-Za-z0-9+/=]{100000,})"\)\.buffer/g;

export function extraireWasm(code: string): { octets: Buffer; texte: string } {
  const trouves = [...code.matchAll(LITTERAL)];
  if (trouves.length !== 1) throw new Error(`Rapier : ${trouves.length} binaire(s) WebAssembly en base64 trouvé(s), un seul attendu (le paquet a changé : relire rapierWasm.ts)`);
  const octets = Buffer.from(trouves[0]![1]!, "base64");
  const empreinte = createHash("sha256").update(octets).digest("hex");
  if (empreinte !== RAPIER_WASM_SHA256) throw new Error(`Rapier : le WebAssembly du paquet a l'empreinte ${empreinte}, pas celle du binaire de la version 0.21.0 déterministe`);
  return { octets, texte: trouves[0]![0] };
}

export function rapierWasmServi(): Plugin {
  return {
    name: "tower-rapier-wasm-servi",
    apply: "build",
    transform(code, id) {
      if (!/@dimforge[\\/]rapier2d-deterministic-compat[\\/]dist[\\/]rapier\.mjs$/.test(id.split("?")[0]!)) return null;
      const { octets, texte } = extraireWasm(code);
      const ref = this.emitFile({ type: "asset", name: "rapier.wasm", source: octets });
      return { code: code.replace(texte, `new URL(import.meta.ROLLUP_FILE_URL_${ref}, import.meta.url).href`), map: null };
    },
  };
}
