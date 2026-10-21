export const JEUX: ("track" | "jump")[];
export const ZONES: Record<"track" | "jump", string[]>;
export const EXCEPTIONS: string[];
export function jeuDeLaPr(pr?: { etiquettes?: string[]; branche?: string }): { jeu: "track" | "jump" | null; source: string; erreur?: string };
export function horsZones(jeu: string, fichiers: string[]): string[];
export interface VerdictZones { ok: boolean; jeu: "track" | "jump" | null; source: string; hors: string[]; texte: string }
export function verifierZones(pr?: { etiquettes?: string[]; branche?: string; fichiers?: string[] }): VerdictZones;
