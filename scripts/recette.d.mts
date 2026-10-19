export const SERVER_PATHS: string[];
export const TAG_MAX: number;
export function shortHash(text: string): string;
export function recetteTag(branch: string): string;
export function previewSlug(branch: string): string;
export function taggedUrl(serviceUrl: string, tag: string): string;
export function touchesServer(files: string[]): boolean;
