// Figé au lot 30 : les listes de variantes refusées du catalogue de la version 12 (`PHASE_REFUSED`, `ALT_B_REFUSED`, `PARASITE_CLOSED` d'avant le lot) : voir `catalogue.ts`. NE SE RÉGÉNÈRE JAMAIS.
export const LEGACY_PHASE_REFUSED: Readonly<Record<string, readonly number[]>> = {"cheminee-scie":[3],"nuit-opposition":[4],"scie-sol":[3]};
export const LEGACY_ALT_B_REFUSED: Readonly<Record<string, readonly number[]>> = {"laser-alterne-portes":[6]};
export const LEGACY_PARASITE_CLOSED: Readonly<Record<string, readonly number[]>> = {};
