export const RACINE: string;
export const VARIABLE_FICHES_SUPPLEMENTAIRES: string;
export function estUnEssai(env?: Record<string, string | undefined>): boolean;
export function dossiersSupplementaires(env?: Record<string, string | undefined>): string[];
export function lireFichesBrutes(racine?: string, env?: Record<string, string | undefined>): { id: string; brut: unknown; fichier: string }[];
