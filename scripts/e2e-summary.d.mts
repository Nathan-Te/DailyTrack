export interface FlatTest {
  file: string;
  title: string;
  project: string;
  status: "expected" | "unexpected" | "flaky" | "skipped";
  attempts: number;
  errors: string[];
  ms: number;
}
export function collectTests(report: unknown): FlatTest[];
export function summarize(
  report: unknown,
  options?: { failOnFlaky?: boolean },
): { markdown: string; warnings: string[]; flaky: FlatTest[]; failed: FlatTest[]; exitCode: number };
