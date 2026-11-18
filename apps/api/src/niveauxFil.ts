import { declareFrozenGenerators } from "@cdj/jump-sim";
import { dailyCircuit, replayTicks, type PaletteName, type ThemeName } from "@cdj/sim";
import { trackInputs } from "./copies";
import { computeJumpDay } from "./jump";
import type { GameDefinition } from "./games";
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

// Lot D4 — **le niveau du jour d'un jeu du kit, dans le même fil de calcul, sans nommer aucun jeu.** Le robot qui donne les seuils des médailles d'un jeu coûte des secondes (Pinball : 17 à 28 s par table, mesuré au README
// du lot D4) : dans le fil principal il figeait toute l'instance (l'accueil, le classement, `/api/jeux` tombaient en délai dépassé). Un jeu du kit (`definirJeuNeuf`) expose `niveauDuJour(options, jour)` sur sa
// `GameDefinition` ; le fil l'appelle par le code du jeu, avec **pour seul état les options de la demande** (le fichier figé de ce jour). Le résultat traverse le fil : des données seulement (clone structuré), le
// module des jeux le garde en base en JSON (`defauts.ts`). Un fil **à part** de celui de Jump et Track (même script, `server.ts` en lance un second) : 28 s de robot ne font jamais attendre Jump ni Track.

/** Ce que demande le serveur : le niveau du jour du jeu `code`, avec le seul fichier figé de ce jour (date → contenu) s'il y en a un. */
export interface DemandeKit {
  jeu: "kit";
  code: string;
  day: number;
  frozen: Readonly<Record<string, unknown>>;
}
/** Ce que le fil rend : le niveau tel que le contrat du jeu le calcule et les seuils de ses médailles, calculés avec lui (des données). */
export interface ReponseKit {
  niveau: unknown;
  seuils: unknown;
}
export type ExecuteurKit = ExecuteurRejeu<DemandeKit, ReponseKit>;

/**
 * Le délai d'un calcul de niveau d'un jeu du kit dans le fil : le robot de Pinball met 17 à 28 s par table en local, 3 à 5 fois plus sur Cloud Run (D1) — et un calcul de fond n'a le processeur que pendant une
 * requête (Cloud Run) : le délai est une garde contre un calcul qui ne finit jamais, pas une durée attendue.
 */
export const DELAI_NIVEAU_KIT_MS = 300_000;
/** La file du fil des jeux du kit : au démarrage chaque jeu ouvert demande aujourd'hui puis demain (`preparerLesNiveaux`) ; au-delà, `503 busy`. */
export const FILE_NIVEAU_KIT = 32;

/** Le calcul d'un jeu du kit : le même qu'ailleurs, fait par le fil (ou, en repli, sur place). */
export async function calculerNiveauKit(d: DemandeKit, jeux: readonly Pick<GameDefinition<never>, "code" | "niveauDuJour">[]): Promise<ReponseKit> {
  const jeu = jeux.find((j) => j.code === d.code);
  if (!jeu?.niveauDuJour) throw new Error(`le jeu ${d.code} ne calcule pas son niveau hors du fil principal`);
  return await jeu.niveauDuJour({ frozen: d.frozen } as never, d.day);
}

/** Le repli : le calcul des jeux du kit dans le fil principal (tests qui comparent le fil et la place). */
export function executeurKitPrincipal(jeux: readonly Pick<GameDefinition<never>, "code" | "niveauDuJour">[]): ExecuteurKit {
  return { nom: "principal" as const, rejouer: (d) => calculerNiveauKit(d, jeux) };
}

/** Le port d'un fil (`parentPort` de `worker_threads`), tel que `servirNiveaux` s'en sert. */
export interface PortDuFil {
  on(evenement: "message", fn: (m: { id: number } & (DemandeNiveau | DemandeKit)) => void): unknown;
  postMessage(m: unknown): void;
}

/**
 * La boucle du fil de calcul des niveaux (`niveauxFilTravail.ts`) : reçoit `{ id, ...demande }`, répond `{ id, resultat }` ou `{ id, panne }` (protocole de `jeux/fil.ts`). `jeux` : les jeux dont le fil sait calculer
 * le niveau (le registre ; un test passe un jeu fictif). Les demandes se font l'une après l'autre (le fil les enchaîne : un seul à la fois, `executeurFil`).
 */
export function servirNiveaux(port: PortDuFil, jeux: readonly Pick<GameDefinition<never>, "code" | "niveauDuJour">[]): void {
  port.on("message", (m) => {
    const { id, ...demande } = m;
    const calcul = (async () => (demande.jeu === "kit" ? await calculerNiveauKit(demande as DemandeKit, jeux) : calculerNiveau(demande as DemandeNiveau)))();
    calcul.then(
      (resultat) => port.postMessage({ id, resultat }),
      () => port.postMessage({ id, panne: true }),
    );
  });
}
