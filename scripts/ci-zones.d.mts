export interface Table { fumee: Record<"web" | "jump", string[]>; zones: Record<string, { globs: string[]; sauf?: string[] }>; specs: Record<string, string[]>; compilees: Record<string, { globs: RegExp[]; sauf: RegExp[] }> }
export interface Graphe { noeuds: Map<string, { imports: Set<string>; cites: Set<string> }>; tests: string[]; atteint: Map<string, unknown> }
export interface Choix { web: string[]; jump: string[]; raisons: string[]; reportes?: string[] }
export interface PartUnitaire { part: string; fichiers: string[]; secondes: number }
export interface PartE2e { part: string; web: string[]; jump: string[]; secondes: number }
export interface Decision {
  mode: string;
  docsSeuls: boolean;
  unit: { fichiers: string[]; tous: boolean; docsSeuls: boolean; raisons: string[] };
  unitParts: PartUnitaire[];
  e2e: Choix;
  e2eParts: PartE2e[];
}
export const E2E_DIRS: { web: string; jump: string };
export const PARTS_E2E_MAX: number;
export const PARTS_UNITAIRES_MAX: number;
export const CIBLE_PART_E2E_S: number;
export const CIBLE_PART_UNITAIRE_S: number;
export const DEFAUT_UNITAIRE_S: number;
export const MAX_IMPORTEURS: number;
export const BUDGET_E2E_S: number;
export function lister(racine: string, dir: string, filtre?: (f: string) => boolean): string[];
export function chargerTable(racine?: string): Table;
export function zonesDuFichier(fichier: string, table: Table): string[];
export function specsDuJeu(jeu: "web" | "jump", racine?: string): string[];
export function importeursDe(jeu: "web" | "jump", utilitaire: string, racine?: string): string[];
export function specsPour(files: string[], table: Table, racine?: string, options?: { budget?: number }): Choix;
export function specsDesZones(zones: string[], table: Table): { web: string[]; jump: string[]; inconnues: string[] };
export function dossiersDeCode(racine?: string): string[];
export function chemins(texte: string): string[];
export function resoudre(racine: string, fichier: string, cite: string): string | null;
export function fichierImporte(racine: string, fichier: string, spec: string): string | null;
export function graphe(racine?: string): Graphe;
export function atteint(g: Graphe, test: string): { fichiers: Set<string>; citees: Set<string> };
export function touche(g: Graphe, test: string, f: string): boolean;
export function docsLusParLesTests(g: Graphe): Map<string, string[]>;
export function testsPour(files: string[], g: Graphe, options?: { complet?: boolean }): { fichiers: string[]; tous: boolean; docsSeuls: boolean; raisons: string[] };
export function dureesUnitaires(racine?: string): Record<string, number>;
export function nombreDeParts(charge: number, cible: number, max: number): number;
export function partsUnitaires(fichiers: string[], durees: Record<string, number>, options?: { max?: number; cible?: number }): PartUnitaire[];
export function partsE2e(choix: { web: string[]; jump: string[] }, racine?: string, options?: { max?: number; cible?: number }): PartE2e[];
export function decider(files: string[], options?: { mode?: string; racine?: string }): Decision;
export function sorties(d: Decision): string;
export function resume(d: Decision): string;
export function dureesDepuisVitest(rapport: unknown, racine?: string): Record<string, number>;
