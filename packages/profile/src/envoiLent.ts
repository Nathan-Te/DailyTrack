import type { ApiResult } from "./client";
import { ATTENTE_ENVOI_MS } from "./client";

// Lot D2 — des envois sans faux « serveur indisponible » : la logique pure que partagent les trois jeux (aucun DOM, aucune horloge globale : les minuteries sont injectables). Le délai d'un envoi
// (`DELAI_ENVOI_MS`, 20 s) est dans `client.ts`. Ici : (1) **quand un échec est passager** (la partie reste en file et repartira : jamais « indisponible »), (2) **« Envoi en cours… » après 3 s**,
// (3) **les refus qui veulent dire « cet onglet est périmé »**, (4) **la comparaison des versions** du jeu et du serveur, (5) **les essais `?debug&simuler=`** (jamais en production).

/**
 * Un échec qui n'est pas un refus : la partie n'est pas perdue, elle repartira (coupure, délai dépassé, trop de requêtes, serveur en panne, route inconnue d'un serveur plus ancien). Les trois
 * jeux en faisaient la même liste ; le joueur lit alors « Envoi en attente », jamais « indisponible ».
 */
export function estEchecPassager(r: { status: number; code?: string }): boolean {
  return r.status === 0 || r.status === 429 || r.status >= 500 || r.code === "not_found";
}

/**
 * Appelle `surLent` si `promesse` n'est pas réglée au bout de `ms` (3 s par défaut) : l'envoi est dit « en cours ». La promesse est rendue telle quelle ; la minuterie est toujours nettoyée.
 */
export async function avecAttente<T>(promesse: Promise<T>, surLent: () => void, ms = ATTENTE_ENVOI_MS, minuterie: { set(fn: () => void, ms: number): unknown; clear(h: unknown): void } = { set: (fn, d) => setTimeout(fn, d), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }): Promise<T> {
  const h = minuterie.set(surLent, ms);
  try {
    return await promesse;
  } finally {
    minuterie.clear(h);
  }
}

/** Les codes d'un serveur qui dit « ta version du jeu n'est plus la bonne » : un onglet resté ouvert pendant une mise en production. */
export const CODES_ONGLET_PERIME: readonly string[] = ["version", "sim_version", "track_mismatch"];

export const estOngletPerime = (code: string | undefined): boolean => code !== undefined && CODES_ONGLET_PERIME.includes(code);

/** Les versions annoncées par un serveur ou un jeu (`{ simVersion, generatorVersion }`). */
export type Versions = Readonly<Record<string, number>>;

/** Lit les versions du serveur (ses `info` ou `health`) : `null` si on ne peut pas les lire (hors ligne : on ne dit rien). */
export type LireVersions = () => Promise<Versions | null>;

/** Vrai si une version que les deux côtés annoncent diffère. Une clé absente d'un côté, ou un serveur muet, ne dit rien. */
export function versionsDifferent(locales: Versions, serveur: Versions | null): boolean {
  if (!serveur) return false;
  return Object.keys(locales).some((k) => typeof serveur[k] === "number" && serveur[k] !== locales[k]);
}

/** Les `info` / `health` d'un serveur en versions (garde les nombres seulement). */
export function versionsDeReponse(r: ApiResult<Record<string, unknown>>, cles: readonly string[] = ["simVersion", "generatorVersion"]): Versions | null {
  if (!r.ok) return null;
  const out: Record<string, number> = {};
  for (const k of cles) if (typeof r.data[k] === "number") out[k] = r.data[k] as number;
  return Object.keys(out).length ? out : null;
}
