export const CATEGORIES: string[];
export const RULES: { glob: string; cats: string[] }[];
export function categoriesOf(path: string): string[];
export interface CiScope { full: boolean; track: boolean; jump: boolean; plateforme: boolean; server: boolean; reason: string }
export function scopeOf(files: string[], options?: { full?: boolean }): CiScope;
export function toOutputs(scope: CiScope): string;
