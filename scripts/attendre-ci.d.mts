export const LIGNES_D_ERREUR: number;
export const ATTENTE_MAX_MIN: number;
export const PAS_S: number;
export function choisirRun<T extends { head_sha: string; event: string; created_at: string; id: number }>(runs: T[] | undefined, sha: string): T | null;
export function verdictParJob(jobs: { name: string; conclusion: string | null; started_at?: string | null; completed_at?: string | null }[]): string[];
export function extraireEchecs(journal: string, n?: number): { tests: string[]; erreur: string[]; autres: number };
