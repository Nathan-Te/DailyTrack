// Lot T1 — le chargement de Rapier 2D déterministe (WebAssembly), un seul endroit. Dépendance externe permise dans `src/` et `lab/` (docs/tower/consignes.md) :
// `@dimforge/rapier2d-deterministic-compat` 0.21.0, version exacte. `-compat` : le même JavaScript sur Node et dans les navigateurs ; en construction du jeu, le
// `.wasm` est servi comme un fichier (apps/tower/vite.config.ts, plugin `rapierWasmServi`), le même binaire (même SHA-256) que celui que Node lit ici.
import RAPIER from "@dimforge/rapier2d-deterministic-compat";

export type Rapier = typeof RAPIER;

let pret: Promise<Rapier> | null = null;

/** Charge le WebAssembly (une seule fois) et rend le module. */
export function chargerRapier(): Promise<Rapier> {
  pret ??= RAPIER.init().then(() => RAPIER);
  return pret;
}
