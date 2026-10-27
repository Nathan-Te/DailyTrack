export interface WorkflowRun {
  id: number;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_attempt?: number;
}
export interface Job {
  name: string;
  status: string;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}
export interface JobCourt extends Job {
  court: string;
}
export interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at?: string | null;
}
export const CI_WORKFLOW: string;
export const PRODUCTION_WORKFLOW: string;
export const JOB_APPELANT: string;
export const EVENEMENTS_COMPLETS: string[];
export function jobsDeCi(jobs: Job[], appele: boolean): JobCourt[];
export function jugerJobs(jobs: JobCourt[]): { state: "attendre" | "vert" | "rouge" | "incomplet"; rouges: string[] };
export function candidats(runsCi: WorkflowRun[], runsProd: WorkflowRun[], sha: string): (WorkflowRun & { appele: boolean })[];
export function dureeMin(jobs: Job[]): number | null;
export function resumeVerdict(v: { state: string; rouges?: string[]; echecsE2e?: string[]; url: string; duree: number | null; reprise: boolean; sha: string }): string;
export function jugerStatuts(checkRuns: CheckRun[], noms: string[]): { state: "attendre" | "vert" | "rouge"; detail: string };
