export interface JobCi { conclusion: string | null; started_at: string | null; completed_at: string | null; [k: string]: unknown }
export interface RunCi { id: number; event: string; status: string; head_branch: string; created_at: string; run_started_at?: string; updated_at: string; pull_requests?: { number: number }[]; [k: string]: unknown }
export interface Groupe { runs: number; prs: number; runsParPr: number | null; minutes: number; minutesParRun: number | null; murMedianMin: number | null; murP90Min: number | null; fileJobMedianeS: number | null; fileJobP90S: number | null; filePremierJobMedianeS: number | null }
export interface Analyse { semaines: (Groupe & { semaine: string })[]; total: Groupe }
export const ANNULE_MAX_MS: number;
export function minutesDuJob(job: JobCi): number;
export function percentile(values: number[], p: number): number;
export function mediane(values: number[]): number;
export function lundiDe(iso: string): string;
export function cleDePr(run: RunCi): number | string | null;
export function mesureDuRun(run: RunCi, jobs: JobCi[]): { minutes: number; murMin: number; files: number[] };
export function analyser(runs: { run: RunCi; jobs: JobCi[] }[]): Analyse;
export function specsLesPlusLongs(durees: Record<string, number>, n?: number): { spec: string; secondes: number }[];
export function dureesDuDepot(racine?: string): Record<string, number>;
export function dureesDuRapport(rapport: unknown): Record<string, number>;
export function tableau(a: Analyse): string;
export function tableauSpecs(liste: { spec: string; secondes: number }[]): string;
