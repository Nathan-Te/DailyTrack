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
export interface CiVerdict {
  state: "attendre" | "vert" | "rouge";
  reason: string;
  url: string | null;
}
export const CI_WORKFLOW: string;
export function fullRuns(runs: WorkflowRun[], sha: string): WorkflowRun[];
export function verdict(runs: WorkflowRun[], sha: string): CiVerdict;
export function summary(v: CiVerdict, sha: string): string;
