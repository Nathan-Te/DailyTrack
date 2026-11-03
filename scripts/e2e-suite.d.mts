export const PREMIER_JOUR_DES_E2E: string;
export const SUITE_DU_PETIT_ENSEMBLE: string;
export interface Commande {
  cmd: string;
  args: string[];
}
export function commandesDeConstruction(suite: string): Commande[];
export function commandesDeConstructionDePr(matrice: Record<string, string>): Commande[];
export function commandesDuPetitEnsemble(navigateur: string): (Commande & { rapport: string })[];
export function commandesDUnePart(suite: string, part: string, options?: { partsOpt?: string[]; pwOpt?: string[] }): { liste: Commande; test: (fichier: string) => Commande };
export function commandesDeLaPartDePr(matrice: Record<string, string>, indice?: string): (Commande & { suite: string; rapport: string; specs: string[] })[];
export function matriceDeStabilite(stabilite: { repetitions: number; tests: { jeu: string; fichier: string; titre?: string; navigateur: string }[] }): { matrix: { include: Record<string, unknown>[] }; repetitions: number };
export function rassemblerRapports(dest: string, racine?: string): number;
