export const JEUX: ("track" | "jump" | "tower")[];
export const ZONES: Record<"track" | "jump" | "tower", string[]>;
export const EXCEPTIONS: string[];
export function jeuDeLaPr(pr?: { etiquettes?: string[]; branche?: string }): { jeu: "track" | "jump" | "tower" | null; source: string; erreur?: string };
export function horsZones(jeu: string, fichiers: string[]): string[];
export interface VerdictZones { ok: boolean; jeu: "track" | "jump" | "tower" | null; source: string; hors: string[]; texte: string }
export function verifierZones(pr?: { etiquettes?: string[]; branche?: string; fichiers?: string[] }): VerdictZones;
