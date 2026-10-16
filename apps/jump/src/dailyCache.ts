import { isPayload, type DailyPayload } from "./dailyWork";
import { STORAGE_PREFIX, storageKey } from "./storage";
import type { KeyValue } from "./memory";

// Cache du niveau du jour (lot 7b) : la charge générée (`DailyPayload`) rangée sous `jump:niveau:<identifiant>`. L'identifiant porte déjà
// `JUMP_GENERATOR_VERSION` (`…-g4`) ; la charge garde `JUMP_SIM_VERSION` et `JUMP_GENERATOR_VERSION`, comparés à la lecture (`fromPayload`).
// La preuve est **rejouée** à la relecture (loader) : ce qui est lu ici n'est qu'un candidat. Tout accès est protégé : sans stockage (ou
// stockage qui lève), le jeu régénère simplement.
//
// Purge : chaque entrée garde la date de Paris de son écriture ; toute entrée d'un autre jour est retirée à la lecture comme à l'écriture
// (le stockage ne grossit pas de jour en jour), et la mémoire du jour (`memory.ts`) retire aussi la clé `niveau:` d'un niveau qui change de jour.

const PREFIX = `${STORAGE_PREFIX}niveau:`;

interface Entry {
  /** Date de Paris (AAAA-MM-JJ) de l'écriture. */
  stored: string;
  payload: DailyPayload;
}

export const cacheKey = (id: string): string => storageKey(`niveau:${id}`);

/** Retire les entrées écrites un autre jour que `today`. */
export function sweepCache(store: KeyValue | null, today: string): void {
  if (!store) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      let day = "";
      try {
        day = (JSON.parse(store.getItem(k) ?? "{}") as Partial<Entry>).stored ?? "";
      } catch {
        day = "";
      }
      if (day !== today) stale.push(k);
    }
    for (const k of stale) store.removeItem(k);
  } catch {
    /* rien */
  }
}

/** La charge gardée pour ce niveau (candidate : à vérifier), ou null. */
export function readCache(store: KeyValue | null, id: string, today: string): DailyPayload | null {
  if (!store) return null;
  try {
    sweepCache(store, today);
    const raw = store.getItem(cacheKey(id));
    if (!raw) return null;
    const e = JSON.parse(raw) as Partial<Entry>;
    return e.stored === today && isPayload(e.payload) ? e.payload : null;
  } catch {
    return null;
  }
}

/** Garde la charge (sans erreur si le stockage refuse). Rend vrai si elle est écrite. */
export function writeCache(store: KeyValue | null, payload: DailyPayload, today: string): boolean {
  if (!store) return false;
  try {
    sweepCache(store, today);
    store.setItem(cacheKey(payload.id), JSON.stringify({ stored: today, payload } satisfies Entry));
    return true;
  } catch {
    return false;
  }
}

/** Oublie la charge d'un niveau (preuve qui ne se rejoue pas). */
export function dropCache(store: KeyValue | null, id: string): void {
  try {
    store?.removeItem(cacheKey(id));
  } catch {
    /* rien */
  }
}
