export interface FlatTest {
  file: string;
  title: string;
  /** Titres des `describe` puis du test (lot R3). */
  path?: string[];
  project: string;
  status: "expected" | "unexpected" | "flaky" | "skipped";
  attempts: number;
  errors: string[];
  ms: number;
}
export function collectTests(report: unknown): FlatTest[];
export function summarize(
  report: unknown,
  options?: { failOnFlaky?: boolean; mode?: "pr" | "complet" | "nuit"; quarantine?: import("./e2e-quarantaine.mjs").Quarantine | null },
): { markdown: string; warnings: string[]; flaky: FlatTest[]; failed: FlatTest[]; excused: FlatTest[]; exitCode: number };
export function chromiumSeconds(tests: FlatTest[]): Record<string, number>;
