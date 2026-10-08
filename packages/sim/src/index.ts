// Simulation pure : aucune dépendance au rendu, au DOM ni à Node.
// Déterminisme : pas fixe, pas de Math.sin/cos/exp (voir docs/seed.md § 7 et CLAUDE.md).

export * from "./constants";
export * from "./math";
export * from "./car";
export * from "./track";
export * from "./world";
export { cuveAmplitude, cuveHeight, cuveRadius, cuveTop, shellAt } from "./cuve";
export * from "./race";
export * from "./jump";
export * from "./circuits";
export * from "./replay";
export * from "./rng";
export * from "./calendar";
export * from "./autopilot";
export * from "./themes";
export * from "./generator";
export * from "./figures";
