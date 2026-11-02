// Les appels réseau du `smoke` (essai de bout en bout après chaque déploiement de la recette, vérification de la production). Le 2/11/2026, le smoke de la recette a planté sur sa toute première
// requête : l'infrastructure de Google devant Cloud Run avait répondu `Rate exceeded.` en TEXTE BRUT (pas notre API : elle répond toujours du JSON), et `res.json()` avait levé une
// `SyntaxError` qui ne disait rien de la vraie réponse — et le site de la recette n'avait pas été mis à jour. Deux règles, ici, pour que ce ne soit plus un accident :
//   1. **Un refus passager se réessaie** (`fetchFiable`) : 429 pour toute méthode (la requête n'a pas été traitée), et pour un GET seulement 502, 503, 504 ou une coupure réseau (un envoi qui aurait
//      pu être traité n'est JAMAIS rejoué : il compterait deux fois). Pauses 1 s, 2 s, 4 s (ou `Retry-After`, plafonné à 10 s), 4 essais au plus, puis la dernière réponse est rendue telle quelle.
//   2. **Une réponse qui n'est pas du JSON est nommée** (`lireJson`) : méthode, adresse, statut et les 80 premiers caractères du corps — jamais un identifiant ni un jeton (aucun n'est dans une réponse
//      d'erreur) — au lieu d'une `SyntaxError`.
// Pur : le `fetch` et l'attente sont injectés (testé : `apps/api/test/smokeFiable.test.ts`, sans réseau).

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const ESSAIS_MAX = 4;
export const PAUSES_MS = [1000, 2000, 4000] as const;
export const PAUSE_MAX_MS = 10_000;
const attente = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Faut-il réessayer ? (`methode` en majuscules.) */
export function aReessayer(methode: string, statut: number | null): boolean {
  if (statut === 429) return true;
  if (methode !== "GET" && methode !== "HEAD") return false;
  return statut === null || statut === 502 || statut === 503 || statut === 504;
}

/** La pause avant l'essai suivant : `Retry-After` en secondes s'il est lisible, sinon la pause du rang, jamais plus de `PAUSE_MAX_MS`. */
export function pauseAvant(rang: number, retryAfter: string | null): number {
  const s = retryAfter !== null && /^\d{1,3}$/.test(retryAfter.trim()) ? Number(retryAfter) * 1000 : NaN;
  return Math.min(PAUSE_MAX_MS, Number.isFinite(s) ? s : (PAUSES_MS[Math.min(rang, PAUSES_MS.length - 1)] ?? PAUSE_MAX_MS));
}

/** `fetch`, mais un refus passager est réessayé (voir plus haut). `journal` reçoit une ligne par essai manqué (jamais le corps de la requête). */
export async function fetchFiable(fetchImpl: FetchLike, url: string, init: RequestInit = {}, options: { dormir?: (ms: number) => Promise<void>; journal?: (ligne: string) => void } = {}): Promise<Response> {
  const methode = (init.method ?? "GET").toUpperCase();
  const dormir = options.dormir ?? attente;
  for (let essai = 0; ; essai++) {
    let reponse: Response | null = null;
    let erreur: unknown = null;
    try {
      reponse = await fetchImpl(url, init);
    } catch (e) {
      erreur = e;
    }
    const statut = reponse ? reponse.status : null;
    if (essai + 1 >= ESSAIS_MAX || !aReessayer(methode, statut)) {
      if (reponse) return reponse;
      throw erreur;
    }
    const pause = pauseAvant(essai, reponse?.headers.get("Retry-After") ?? null);
    options.journal?.(`↻ ${methode} ${new URL(url, "http://x").pathname} : ${statut === null ? "coupure réseau" : `statut ${statut}`}, nouvel essai dans ${pause / 1000} s (${essai + 2}/${ESSAIS_MAX})`);
    await dormir(pause);
  }
}

/** Le JSON d'une réponse, ou une erreur qui dit ce qui est arrivé (statut et début du corps). */
export async function lireJson(reponse: Response, methode: string, url: string): Promise<any> {
  const texte = await reponse.text();
  try {
    return JSON.parse(texte);
  } catch {
    const debut = texte.replace(/\s+/g, " ").trim().slice(0, 80);
    throw new Error(`${methode} ${new URL(url, "http://x").pathname} : réponse ${reponse.status} qui n'est pas du JSON (« ${debut} ») — l'infrastructure (Google, Cloud Run, Hosting) a répondu à la place du serveur`);
  }
}
