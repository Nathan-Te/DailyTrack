export interface Etape {
  cle: string;
  titre: string;
  modes: string[];
}
export interface Besoin {
  result: string;
  outputs?: Record<string, string>;
}
export const ETAPES: Etape[];
export function phraseArret(cle: string, o: { needs: Record<string, Besoin>; runUrl: string; origine: string }): string;
export function resumeDuBouton(o: {
  mode: "production" | "essai" | "repetition";
  needs: Record<string, Besoin>;
  jobs?: { name: string; started_at?: string | null; completed_at?: string | null }[];
  runUrl: string;
  ref?: string;
  origine: string;
}): string;
