export const PREFIXE_ARTEFACT: string;
export const HORS_JOB: Record<string, string>;
export const nomArtefact: (sha: string) => string;
export interface Ligne { cle: string; plafond: number; mesure: number; marge: number; ok: boolean }
export interface Resultat { lignes: Ligne[]; depassements: Ligne[]; sansMesure: string[]; sansPlafond: string[] }
export interface MesuresDeMain { sha: string; mesures: Record<string, number> }
export function lirePlafonds(texte: string): Record<string, number>;
export function controler(plafonds: Record<string, number>, mesures: Record<string, number>): Resultat;
export function fmt(n: number): string;
export function ecart(mesure: number, ancien: number | undefined, avecMain?: boolean): string;
export function tableau(res: Resultat, main?: MesuresDeMain | null, options?: { exact?: boolean }): string;
export function validerMesures(brut: unknown): MesuresDeMain | null;
export function choisirArtefact(artefacts: unknown[] | undefined, sha?: string): { run: string; nom: string; exact: boolean } | null;
export function artefactDeMain(depot: string, sha: string, token: string, lire?: (chemin: string, token: string) => Promise<unknown>): Promise<{ run: string; nom: string; exact: boolean } | null>;
