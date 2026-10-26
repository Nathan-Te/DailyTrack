export const ECRITURES_PERMISES: Record<string, string[]>;
export function scriptsRun(text: string): { ligne: number; texte: string }[];
export function auditerWorkflow(nom: string, text: string): string[];
export function auditerDossier(dossier: string): { fichiers: string[]; problemes: string[] };
