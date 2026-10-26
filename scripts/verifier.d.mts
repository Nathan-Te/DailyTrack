import type { Decision } from "./ci-zones.mjs";
export const LIGNES_D_ECHEC: number;
export function fichiersModifies(base: string, cwd?: string): string[];
export function etapes(d: Decision, options?: { sansE2e?: boolean; extra?: { web: string[]; jump: string[] } | null }): { nom: string; cmd: string; args: string[]; env?: Record<string, string> }[];
export function finDuJournal(texte: string, n?: number): string;
