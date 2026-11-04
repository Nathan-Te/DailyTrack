import { declareFrozenGenerators } from "@cdj/jump-sim";
import { dailyCircuit, replayTicks, type PaletteName, type ThemeName } from "@cdj/sim";
import { trackInputs } from "./copies";
import { computeJumpDay } from "./jump";
import type { ExecuteurRejeu } from "./jeux/fil";

// Lot D3 (C9) — **le calcul du niveau du jour hors du fil principal.** Le niveau de Jump coûte 1,9 s et le circuit de Track 0,4 s (D1 § 6 bis) ; calculés dans le fil de Node, ils bloquaient toute l'instance
// (les 5 à 10 s de chaque minuit sur Cloud Run). Ce sont des fonctions **pures** (jour → niveau) : le même calcul, fait ailleurs, donne le même niveau (testé : `niveauxFil.test.ts`, date par date). Ce fichier est
// le calcul lui-même (`calculerNiveau`, sans état) ; `niveauxFilTravail.ts` le met dans un `worker_threads` (empaqueté à part : `dist/niveaux-fil.mjs`), `executeurNiveauxPrincipal` en est le repli
// (développement, tests, outils : le fil principal, comme avant). Le résultat traverse un fil : **des données seulement** (le circuit de Track est reconstruit par `parseTrack` à la réception, comme quand il vient de la base).

/** Ce que demande le serveur : le niveau de Jump d'un jour (avec son fichier figé s'il y en a un), ou le circuit de Track d'un jour (variante et thème du planning). */
export type DemandeNiveau =
  | { jeu: "jump"; day: number; fige: unknown; generateurs: Readonly<Record<string, number>> }
  | { jeu: "track"; day: number; variante: number; theme: ThemeName | null };

/** Le circuit de Track, sans l'objet `Track` (reconstruit par `parseTrack(trackId, spec)`) : ce qui traverse le fil. */
export interface CircuitCalcule {
  trackId: string;
  spec: string;
  authorMs: number;
  attempt: number;
  palette: PaletteName;
  /** Les entrées de l'auteur (le pilote automatique), dont le serveur ne garde que l'empreinte. */
  authorInputs: string;
  /** Le générateur n'a pas trouvé de circuit valide (repli) : le serveur refuse (`503 circuit_unavailable`). */
  repli: boolean;
}

export type ReponseNiveau = ReturnType<typeof computeJumpDay> | CircuitCalcule;

/** Le calcul, pur et synchrone (le fil l'appelle ; le repli aussi). */
export function calculerNiveau(d: DemandeNiveau): ReponseNiveau {
  if (d.jeu === "jump") {
    // Le thème d'un jour de Jump dépend de ce que le serveur a appris des niveaux figés (`declareFrozenGenerators`, un état du module : le fil n'a pas celui du fil principal) : il part avec la demande.
    declareFrozenGenerators(d.generateurs);
    return computeJumpDay(d.day, d.fige);
  }
  const c = dailyCircuit(d.day, d.variante, d.theme);
  return {
    trackId: c.track.id,
    spec: c.spec,
    authorMs: c.authorMs,
    attempt: c.attempt,
    palette: c.palette,
    authorInputs: trackInputs(c.authorReplay.runs, replayTicks(c.authorReplay)),
    repli: c.fallback === true,
  };
}

/** Ce qui calcule un niveau : le fil de calcul (`executeurFil`, `jeux/fil.ts`), ou le fil principal (repli). */
export type ExecuteurNiveaux = ExecuteurRejeu<DemandeNiveau, ReponseNiveau>;

/** Le repli : le calcul dans le fil principal, comme avant le lot D3. */
export function executeurNiveauxPrincipal(): ExecuteurNiveaux {
  return {
    nom: "principal" as const,
    async rejouer(d) {
      return calculerNiveau(d);
    },
  };
}

/** Le délai d'un calcul de niveau dans le fil : un niveau de Jump mesuré à 1,9 s en local, 3 à 5 fois plus sur Cloud Run (D1), sous les 30 s d'une requête. */
export const DELAI_NIVEAU_MS = 25_000;
