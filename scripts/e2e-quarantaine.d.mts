export const MAX_ENTRIES: number;
export const MAX_DAYS: number;
export const BROWSERS: string[];
export const DEBT_DOCS: Record<"web" | "jump", string>;
export const QUARANTINE_FILE: string;
export interface QuarantineEntry {
  test: string;
  navigateur: string;
  depuis: string;
  dette: string;
  responsable: string;
  project: string;
  age: number;
}
export interface Quarantine {
  entries: QuarantineEntry[];
  errors: string[];
  expired: QuarantineEntry[];
}
export function dayOf(text: unknown): number | null;
export function projectFor(test: string, browser: string): string;
export function matches(entry: QuarantineEntry, t: { project: string; file: string; title: string; path?: string[] }): boolean;
export function checkQuarantine(data: unknown, options: { today: number; readDoc: (path: string) => string | null }): Quarantine;
export function repoDoc(path: string): string | null;
export function todayUtc(now?: number): number;
export function loadQuarantine(file?: string, options?: { today?: number; readDoc?: (path: string) => string | null }): Quarantine;
