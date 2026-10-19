// Lot P4 (plateforme) : les en-têtes de cache des lectures d'un jeu. Par défaut toute réponse de l'API porte `Cache-Control: no-store`
// (`api.ts`) : DailyTrack n'en change aucune. Un jeu qui veut qu'une lecture soit gardée par le navigateur (ou, demain, par un cache partagé
// devant Cloud Run) rend `new WithHeaders(corps, cacheHeaders(…))` au lieu du corps seul.
//
// **Règle : une réponse qui dépend de l'identifiant du joueur (`X-Player-Id`) n'est jamais mise en cache partagé.** Elle porte `private`
// (seul le navigateur du joueur la garde ; un proxy, un CDN ou le cache d'un hébergeur ne la gardent jamais, même si un jour on en met un
// devant Cloud Run) **et** `Vary: X-Player-Id` (le navigateur lui-même ne la ressert pas à une autre identité : un code chargé sur cet
// appareil change l'en-tête, donc l'entrée du cache). `private` seul laisserait le navigateur resservir la ligne de l'ancienne identité ;
// `Vary` seul laisserait un cache partagé garder une réponse personnelle par identifiant (l'identifiant secret deviendrait une clé de cache
// chez un tiers). Les deux ensemble. Une réponse qui ne dépend pas du joueur (niveau, carte des morts, échantillon du carnage) est `public`.
//
// Durées : un **jour fermé** (après la grâce de minuit) ne change plus — classement, fantôme, carte et échantillon figés — : un jour
// (`CACHE_CLOSED_S`) ; seul un pseudo changé ou une nouvelle version du jeu le feraient bouger, d'où un jour et non un an. Un **jour ouvert**
// change à chaque envoi : 30 s (`CACHE_OPEN_S`, l'écart minimal entre deux relectures du jeu). Une erreur reste `no-store`.

/** Durée de cache d'une lecture d'un jour fermé (figé), en secondes. */
export const CACHE_CLOSED_S = 86_400;
/** Durée de cache d'une lecture du jour en cours (ou d'hier pendant la grâce), en secondes. */
export const CACHE_OPEN_S = 30;

/** Une réponse 200 avec ses propres en-têtes (fusionnés par `api.ts` avec ceux de CORS). */
export class WithHeaders {
  constructor(
    readonly body: unknown,
    readonly headers: Record<string, string>,
  ) {}
}

/**
 * Les en-têtes de cache d'une lecture : `open` = le jour accepte encore des envois ; `perPlayer` = la réponse dépend de `X-Player-Id` (alors
 * `private` + `Vary`, jamais un cache partagé) ; `noCache` = à revalider à chaque fois (le profil du joueur : un code changé ailleurs doit se voir
 * au premier chargement).
 */
export function cacheHeaders(o: { open: boolean; perPlayer: boolean; noCache?: boolean }): Record<string, string> {
  const scope = o.perPlayer ? "private" : "public";
  const control = o.noCache ? `${scope}, no-cache` : `${scope}, max-age=${o.open ? CACHE_OPEN_S : CACHE_CLOSED_S}`;
  return o.perPlayer ? { "Cache-Control": control, Vary: "X-Player-Id" } : { "Cache-Control": control };
}

/** Fusionne deux valeurs de `Vary` (CORS ajoute `Origin`) sans doublon. */
export function mergeVary(a: string | undefined, b: string | undefined): string | undefined {
  const parts = [...(a ?? "").split(","), ...(b ?? "").split(",")].map((s) => s.trim()).filter(Boolean);
  const seen = new Map<string, string>();
  for (const p of parts) if (!seen.has(p.toLowerCase())) seen.set(p.toLowerCase(), p);
  return seen.size ? [...seen.values()].join(", ") : undefined;
}
