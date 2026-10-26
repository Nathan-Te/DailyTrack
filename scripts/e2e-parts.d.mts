export const DEFAULT_S: number;
export function specFiles(dir?: string): string[];
export function assignParts(files: string[], durations: Record<string, number>, total: number): { files: string[]; load: number }[];
export function testList(files: string[], project: string): string;
export function gameOf(project: string): { dir: string; name: "web" | "jump" };
