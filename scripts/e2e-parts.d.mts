export const DEFAULT_S: number;
export function estOutil(f: string): boolean;
export function specFiles(dir?: string): string[];
export function assignParts(files: string[], durations: Record<string, number>, total: number): { files: string[]; load: number }[];
export function testList(files: string[], project: string): string;
export function gameOf(project: string): { dir: string; name: "web" | "jump" };
export function durees(dir?: string, options?: { essentiel?: boolean }): Record<string, number>;
export function specsRegression(jeu: "web" | "jump"): string[];
