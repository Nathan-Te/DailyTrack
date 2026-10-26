export const DEPOT_PAR_DEFAUT: string;
export function relancerAvecProxy(argv?: string[], env?: Record<string, string | undefined>): boolean;
export function jeton(env?: Record<string, string | undefined>): string;
export function depotPar(argv?: string[], env?: Record<string, string | undefined>): string;
export function api(chemin: string, token: string, options?: { texte?: boolean }): Promise<any>;
