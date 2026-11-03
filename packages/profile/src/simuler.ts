
// Lot D2 — les essais `?debug&simuler=lent|perime`, **chargés à la demande** (un `import()` de `main`, seulement quand l'adresse les demande hors production) : jamais dans le premier chargement.

export type ModeSimuler = "lent" | "perime";

/**
 * `?debug&simuler=lent|perime` : pour voir les messages sans attendre un vrai incident. **Fermé en production** (`restreint`, règle R9) et sans `?debug`. `lent` : la réponse d'un envoi est
 * retardée de 12 s côté jeu ; `perime` : le serveur annonce une version différente.
 */
export function lireSimuler(search: string, restreint: boolean): ModeSimuler | null {
  if (restreint) return null;
  const p = new URLSearchParams(search);
  if (!p.has("debug")) return null;
  const v = p.get("simuler");
  return v === "lent" || v === "perime" ? v : null;
}

/** Le délai ajouté à un envoi par `simuler=lent`. */
export const DELAI_SIMULE_MS = 12_000;

type FetchGlobal = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Habille un `fetch` pour l'essai : `lent` retarde de 12 s la réponse d'un `POST …/submit` ; `perime` ajoute 1 aux numéros de version de `…/info` et `/api/health`. Le reste passe tel quel.
 * `attendre` est injectable (les tests ne dorment pas).
 */
export function simulerFetch(vrai: FetchGlobal, mode: ModeSimuler, attendre: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): FetchGlobal {
  return async (input, init) => {
    const url = String(input);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (mode === "lent" && methode === "POST" && /\/submit$/.test(url.split("?")[0]!)) {
      await attendre(DELAI_SIMULE_MS);
      return vrai(input, init);
    }
    if (mode === "perime" && methode === "GET" && /(\/info|\/api\/health)$/.test(url.split("?")[0]!)) {
      const res = await vrai(input, init);
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json) return res;
      for (const k of ["simVersion", "generatorVersion"]) if (typeof json[k] === "number") json[k] = (json[k] as number) + 1;
      return new Response(JSON.stringify(json), { status: res.status, headers: res.headers });
    }
    return vrai(input, init);
  };
}

/** Installe l'essai sur le `fetch` de la page (une seule fois). Appelé en tête de `main` de chaque jeu, hors production. */
export function installerSimulation(mode: ModeSimuler | null, cible: { fetch: FetchGlobal } = globalThis as unknown as { fetch: FetchGlobal }): void {
  if (!mode) return;
  const f = cible.fetch.bind(cible);
  cible.fetch = simulerFetch(f, mode);
}
