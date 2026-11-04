export const PREFIXE_ARTEFACT: string;
export const HORS_JOB: Record<string, string>;
export const nomArtefact: (sha: string) => string;
export interface Ligne { cle: string; plafond: number; mesure: number; marge: number; ok: boolean }
export interface Resultat { lignes: Ligne[]; depassements: Ligne[]; sansMesure: string[]; sansPlafond: string[] }
export interface MesuresDeMain { sha: string; mesures: Record<string, number> }
/** Lot B1 : la règle des plafonds. */
export type Famille = "premier" | "demande" | "police";
export const KO: number;
export const FAMILLES: Record<Famille, { pct: number; plancherKo: number; nom: string }>;
export const AVERTIR: { ko: number; pct: number; plancher: number };
export function margeRegle(famille: Famille, mesure: number): number;
export function plafondKo(famille: Famille, mesure: number): number;
export interface LigneDuTableau { plafond: number; plafondKo: number; famille: Famille; mesure: number }
export function lireLignes(texte: string): Record<string, LigneDuTableau>;
export function lireReleves(texte: string): Record<string, { date: string; de: number; a: number; raison: string }[]>;
export function lirePlafonds(texte: string): Record<string, number>;
export function controler(plafonds: Record<string, number>, mesures: Record<string, number>): Resultat;
export function fmt(n: number): string;
export function fmtKo(octets: number): string;
export function ecart(mesure: number, ancien: number | undefined, avecMain?: boolean): string;
export interface Avertissement { cle: string; mesure: number; ancien: number; ecart: number; pct: number }
export function avertissements(res: Resultat, main?: MesuresDeMain | null): Avertissement[];
export function tableau(res: Resultat, main?: MesuresDeMain | null, options?: { exact?: boolean }): string;
export interface Proposition { cle: string; famille: Famille; mesure: number; plafondKo: number; propose: number }
export function proposerRecalage(lignes: Record<string, LigneDuTableau>, mesures: Record<string, number>): Proposition[];
export function texteRecalage(propositions: Proposition[]): string;
export function recalerCli(mesures?: Record<string, number>): Promise<void>;
export function validerMesures(brut: unknown): MesuresDeMain | null;
export function choisirArtefact(artefacts: unknown[] | undefined, sha?: string): { run: string; nom: string; exact: boolean } | null;
export function artefactDeMain(depot: string, sha: string, token: string, lire?: (chemin: string, token: string) => Promise<unknown>): Promise<{ run: string; nom: string; exact: boolean } | null>;
