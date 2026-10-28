import { lirePourLesJoueurs, type SectionLue } from "@cdj/core/nouveautes";

// Lot N2 (plateforme) — le panneau lit les PR fusionnées **depuis le navigateur de l'éditeur**, sur l'API publique de GitHub : aucun secret, aucun travail pour le serveur. La CSP de
// `/admin/` autorise `api.github.com` en `connect-src`, et seulement là (`firebase.json`, test `site.test.ts`). Le dépôt est public.
//
//   - `GET /repos/<dépôt>/git/matching-refs/tags/prod-` : les étiquettes de mise en production (`prod-AAAA-MM-JJ-HHMM`, **heure de Paris**) ;
//   - `GET /search/issues?q=repo:<dépôt> is:pr is:merged merged:>=<instant>` : les PR fusionnées depuis la mise en production d'avant (le corps, donc « ## Pour les joueurs », y est) ;
//   - le nombre de PR depuis la mise en production en cours (tableau de bord) : la même recherche, `per_page=1`, on ne lit que `total_count`.
//
// **Limites** : l'API publique, sans identifiant, laisse **60 requêtes par heure et par adresse** (lecture) et **10 recherches par minute**. Une visite du panneau en coûte 3 (étiquettes,
// une ou deux recherches) ; les résultats sont gardés en mémoire de la page (jamais dans le navigateur) et rien ne boucle. Au-delà : le message dit à quelle heure ça reprend.
// **Le texte de GitHub n'est jamais interprété comme du HTML** : titres, corps et noms se posent en `textContent` ; une ligne mal formée est montrée telle quelle, à retoucher.
// Pur (le réseau est passé) : testé dans `test/adminGithub.test.ts`.

export const DEPOT_GITHUB = "Nathan-Te/DailyTrack";
const API = "https://api.github.com";
export const DELAI_GITHUB_MS = 10_000;
/** Les PR lues au plus : 2 pages de 100 (une mise en production en compte quelques dizaines). */
export const PR_MAX_PAGES = 2;

// --- L'étiquette de mise en production ---------------------------------------------------------------------------------------------------
const ETIQUETTE = /^prod-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/;

/** Le décalage de Paris sur UTC à cet instant (ms : +1 h l'hiver, +2 h l'été). */
export function decalageDeParis(ms: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(ms / 1000) * 1000;
}

/** L'instant (ms depuis 1970, UTC) d'une date et d'une heure **de Paris** (heure d'été comprise ; le jour d'un changement d'heure aussi). */
export function instantDeParis(annee: number, mois: number, jour: number, heure: number, minute: number): number {
  const comme = Date.UTC(annee, mois - 1, jour, heure, minute);
  const essai = comme - decalageDeParis(comme);
  return comme - decalageDeParis(essai);
}

/** L'instant d'une étiquette `prod-AAAA-MM-JJ-HHMM` (heure de Paris), ou `null` si ce n'en est pas une. */
export function instantDeEtiquette(etiquette: string): number | null {
  const m = ETIQUETTE.exec(etiquette);
  return m ? instantDeParis(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** L'étiquette qui précède `courante` (les noms se trient comme les dates), ou `null` (la première mise en production). */
export function etiquettePrecedente(etiquettes: readonly string[], courante: string): string | null {
  const avant = etiquettes.filter((e) => ETIQUETTE.test(e) && e < courante).sort();
  return avant.at(-1) ?? null;
}

// --- Les PR ---------------------------------------------------------------------------------------------------------------------------------
export interface PrLue {
  numero: number;
  titre: string;
  url: string;
  /** Fusionnée à (ms). */
  fusionneLe: number;
  /** La zone de la PR d'après ses étiquettes (`jeu:track`, `jeu:jump`) ; sinon la plateforme. */
  zone: "Track" | "Jump" | "Plateforme";
  section: SectionLue;
  /** Fusionnée après la mise en production en cours : pas encore chez les joueurs. */
  pasEncoreEnProduction: boolean;
}

/** Une PR « robot » du workflow de mise en production (« Jours figés — <étiquette> ») : jamais proposée. */
export const estPrRobot = (titre: string): boolean => /^jours figés\b/i.test(titre.trim());

interface ItemGithub {
  number?: unknown;
  title?: unknown;
  html_url?: unknown;
  body?: unknown;
  labels?: unknown;
  pull_request?: { merged_at?: unknown } | null;
  closed_at?: unknown;
}

/** Une PR lue d'une réponse de GitHub (`null` : pas une PR fusionnée lisible). Rien n'est interprété : les textes restent des textes. */
export function prDe(item: unknown, enProduction: number | null): PrLue | null {
  const o = item as ItemGithub | null;
  if (!o || typeof o.number !== "number" || typeof o.title !== "string") return null;
  const fusion = typeof o.pull_request?.merged_at === "string" ? Date.parse(o.pull_request.merged_at) : typeof o.closed_at === "string" ? Date.parse(o.closed_at) : Number.NaN;
  if (!Number.isFinite(fusion)) return null;
  const noms = Array.isArray(o.labels) ? o.labels.map((l) => (l && typeof (l as { name?: unknown }).name === "string" ? (l as { name: string }).name : "")) : [];
  const zone = noms.includes("jeu:track") ? "Track" : noms.includes("jeu:jump") ? "Jump" : "Plateforme";
  // L'adresse est toujours celle de GitHub : une adresse autre ne devient jamais un lien.
  const url = typeof o.html_url === "string" && o.html_url.startsWith(`https://github.com/${DEPOT_GITHUB}/`) ? o.html_url : `https://github.com/${DEPOT_GITHUB}/pull/${o.number}`;
  return { numero: o.number, titre: o.title, url, fusionneLe: fusion, zone, section: lirePourLesJoueurs(typeof o.body === "string" ? o.body : ""), pasEncoreEnProduction: enProduction !== null && fusion > enProduction };
}

export class ErreurGithub extends Error {
  constructor(
    readonly statut: number,
    /** `limite` (débit de l'API publique), `reseau`, `refuse`, `inconnu`. */
    readonly genre: "limite" | "reseau" | "refuse" | "inconnu",
    /** À quelle heure ça reprend (ms), pour une limite. */
    readonly reprise: number | null = null,
  ) {
    super(genre);
  }
}

/** Le message pour l'éditeur (français : outil interne). */
export function texteErreurGithub(e: unknown): string {
  if (!(e instanceof ErreurGithub)) return "Lecture de GitHub impossible.";
  if (e.genre === "limite") {
    const heure = e.reprise !== null ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(e.reprise)) : null;
    return `Limite de l'API publique de GitHub atteinte (60 requêtes par heure et par adresse, 10 recherches par minute)${heure ? ` : ça reprend vers ${heure}` : ""}. Tu peux écrire les lignes à la main.`;
  }
  if (e.genre === "reseau") return "GitHub ne répond pas (réseau). Tu peux écrire les lignes à la main.";
  return `GitHub a répondu une erreur (${e.statut}). Tu peux écrire les lignes à la main.`;
}

type Fetch = typeof fetch;

async function lire(fetchImpl: Fetch, chemin: string): Promise<{ json: unknown; entetes: Headers }> {
  let res: Response;
  // Dix secondes au plus : une lecture qui ne répond pas ne laisse pas la rubrique « en lecture » pour toujours (l'éditeur peut écrire à la main).
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), DELAI_GITHUB_MS);
  try {
    res = await fetchImpl(`${API}${chemin}`, { headers: { Accept: "application/vnd.github+json" }, credentials: "omit", cache: "no-store", signal: controle.signal });
  } catch {
    throw new ErreurGithub(0, "reseau");
  } finally {
    clearTimeout(minuterie);
  }
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const retry = Number(res.headers.get("retry-after"));
    const reprise = Number.isFinite(reset) && reset > 0 ? reset * 1000 : Number.isFinite(retry) && retry > 0 ? Date.now() + retry * 1000 : null;
    throw new ErreurGithub(res.status, res.headers.get("x-ratelimit-remaining") === "0" || res.status === 429 || reprise !== null ? "limite" : "refuse", reprise);
  }
  if (!res.ok) throw new ErreurGithub(res.status, "inconnu");
  return { json: await res.json().catch(() => null), entetes: res.headers };
}

/** Les étiquettes de mise en production du dépôt (une requête). */
export async function etiquettesDeProduction(fetchImpl: Fetch): Promise<string[]> {
  const { json } = await lire(fetchImpl, `/repos/${DEPOT_GITHUB}/git/matching-refs/tags/prod-`);
  if (!Array.isArray(json)) return [];
  return json.map((r) => (r && typeof (r as { ref?: unknown }).ref === "string" ? (r as { ref: string }).ref.replace(/^refs\/tags\//, "") : "")).filter((e) => ETIQUETTE.test(e));
}

const rechercheDe = (depuis: number, page: number, parPage: number) =>
  `/search/issues?q=${encodeURIComponent(`repo:${DEPOT_GITHUB} is:pr is:merged merged:>=${new Date(depuis).toISOString().replace(/\.\d{3}Z$/, "Z")}`)}&sort=updated&order=desc&per_page=${parPage}&page=${page}`;

/** Le nombre de PR fusionnées depuis cet instant (le tableau de bord : une requête, `total_count`), hors PR « robot » de la mise en production (au plus 100 lues pour les retrancher). */
export async function compterPrDepuis(fetchImpl: Fetch, depuis: number): Promise<number> {
  const { json } = await lire(fetchImpl, rechercheDe(depuis, 1, 100));
  const o = json as { total_count?: unknown; items?: unknown } | null;
  const items = Array.isArray(o?.items) ? o!.items : [];
  const total = typeof o?.total_count === "number" ? o.total_count : items.length;
  const robots = items.filter((i) => typeof (i as { title?: unknown })?.title === "string" && estPrRobot((i as { title: string }).title)).length;
  return Math.max(0, total - robots);
}

export interface LecturePr {
  prs: PrLue[];
  /** La mise en production en cours (celle du serveur) et celle d'avant : la fenêtre lue va de la seconde à aujourd'hui. */
  courante: string | null;
  precedente: string | null;
  /** Le début de la fenêtre (ms) et ce qui est « en production » (ms) ; `null` : étiquette inconnue (tout est lu depuis `depuis`). */
  depuis: number;
  enProduction: number | null;
  /** Plus de PR que ce qu'on lit : la liste est tronquée. */
  tronquee: boolean;
}

/** Combien de jours on remonte quand l'étiquette est inconnue (serveur local, recette sans étiquette). */
export const JOURS_PAR_DEFAUT = 14;

/**
 * Les PR fusionnées **depuis la mise en production d'avant** (celles de la mise en production en cours, puis celles qui n'y sont pas encore, marquées
 * `pasEncoreEnProduction`) ; sans PR « robot ». `courante` : l'étiquette que le serveur annonce (tableau de bord). Étiquette inconnue : les 14 derniers jours.
 */
export async function lirePrs(fetchImpl: Fetch, courante: string | null, maintenant: number = Date.now()): Promise<LecturePr> {
  const enProduction = courante ? instantDeEtiquette(courante) : null;
  let precedente: string | null = null;
  let depuis = maintenant - JOURS_PAR_DEFAUT * 86_400_000;
  if (courante && enProduction !== null) {
    precedente = etiquettePrecedente(await etiquettesDeProduction(fetchImpl), courante);
    depuis = (precedente ? instantDeEtiquette(precedente) : null) ?? enProduction - JOURS_PAR_DEFAUT * 86_400_000;
  }
  const prs: PrLue[] = [];
  let tronquee = false;
  for (let page = 1; page <= PR_MAX_PAGES; page++) {
    const { json } = await lire(fetchImpl, rechercheDe(depuis, page, 100));
    const o = json as { items?: unknown; total_count?: unknown } | null;
    const items = Array.isArray(o?.items) ? o!.items : [];
    for (const i of items) {
      const pr = prDe(i, enProduction);
      if (pr && !estPrRobot(pr.titre)) prs.push(pr);
    }
    if (items.length < 100) break;
    if (page === PR_MAX_PAGES) tronquee = true;
  }
  prs.sort((a, b) => b.fusionneLe - a.fusionneLe);
  return { prs, courante, precedente, depuis, enProduction, tronquee };
}
