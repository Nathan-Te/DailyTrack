export type Jeu = "web" | "jump" | "tower";
export interface DureesJeu {
  secondes: Record<string, number>;
  essentiel: Record<string, number>;
}
export type Durees = Partial<Record<Jeu, DureesJeu>>;
export const JEU_DU_PROJET: Record<string, Jeu>;
export const JEUX: Jeu[];
export const DUREE_MAX_S: number;
export const ARTEFACT: string;
export function mesurerDurees(report: unknown): Durees;
export function validerDurees(brut: unknown): Durees;
export function superposer(base: Record<string, number>, mesure: Record<string, number> | null | undefined): Record<string, number>;
export function dureesDeLEnvironnement(texte: string | undefined, jeu: Jeu, options?: { essentiel?: boolean }): Record<string, number> | null;
export function ecarts(base: Record<string, number>, mesure: Record<string, number> | null | undefined): { nom: string; depot: number | null; mesure: number }[];
export function resumeMesure(mesures: Durees, depot?: (jeu: Jeu) => Record<string, number>): string;
export function sourceDeLaNuit(depot: string, token: string, lire?: (chemin: string, token: string) => Promise<unknown>): Promise<string>;
