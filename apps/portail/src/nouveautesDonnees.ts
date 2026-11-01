import { call, type FetchLike } from "@cdj/profile";
import { estZone, type ZoneNouveaute } from "@cdj/core/zones-nouveautes";
import { baseApi } from "./jour";

// Lot N2 : les nouveautés côté joueur — la lecture de `GET /api/portail/nouveautes?avant=` (20 par page), « lue sur cet appareil » (un seul repère en `localStorage`, dans un
// try/catch : sans stockage, pas de point et rien ne casse) et le regroupement par date. Pur (réseau et stockage injectés) : testé dans `test/nouveautes.test.ts`.

/** La dernière nouveauté lue sur cet appareil : son instant de publication (ms). Réglage gardé (jamais effacé par « Nouveau départ ») : `CLES_GARDEES` de `@cdj/profile`. */
export const NOUVEAUTES_LUES_KEY = "cdj:nouveautes:lu";

export interface LigneDeNouveaute {
  zone: ZoneNouveaute | null;
  fr: string;
  en: string;
}

export interface Nouveaute {
  id: number;
  /** AAAA-MM-JJ. */
  date: string;
  titre: { fr: string; en: string };
  lignes: LigneDeNouveaute[];
  publieLe: number;
}

export interface PageDeNouveautes {
  nouveautes: Nouveaute[];
  /** Le curseur de la page d'avant (« Plus anciennes »), ou `null` : c'était la dernière. */
  suivante: string | null;
}

/** Lit une page de la réponse du serveur, avec prudence : ce qui est illisible est écarté (la page ne casse jamais). Les textes restent des textes. */
export function pageDe(brut: unknown): PageDeNouveautes | null {
  const o = brut as { nouveautes?: unknown; suivante?: unknown } | null;
  if (!o || !Array.isArray(o.nouveautes)) return null;
  const nouveautes: Nouveaute[] = [];
  for (const n of o.nouveautes) {
    const x = n as Partial<Nouveaute> | null;
    if (!x || typeof x.id !== "number" || typeof x.date !== "string" || typeof x.titre?.fr !== "string" || typeof x.titre?.en !== "string" || !Array.isArray(x.lignes)) continue;
    const lignes = x.lignes
      .map((l): LigneDeNouveaute | null => {
        const y = l as Partial<LigneDeNouveaute> | null;
        return y && typeof y.fr === "string" && typeof y.en === "string" ? { zone: estZone(y.zone) ? y.zone : null, fr: y.fr, en: y.en } : null;
      })
      .filter((l): l is LigneDeNouveaute => l !== null);
    nouveautes.push({ id: x.id, date: x.date, titre: { fr: x.titre.fr, en: x.titre.en }, lignes, publieLe: typeof x.publieLe === "number" ? x.publieLe : 0 });
  }
  return { nouveautes, suivante: typeof o.suivante === "string" ? o.suivante : null };
}

/** Lit une page (`avant` : le curseur de la page d'avant). `null` : pas de réponse (serveur injoignable, réponse illisible) ; `erreur` : le code du serveur, sinon `reseau`. */
export async function lireNouveautes(avant: string | null, fetchImpl?: FetchLike, base: string = baseApi()): Promise<{ page: PageDeNouveautes } | { erreur: string }> {
  const r = await call<unknown>(base, "GET", `/api/portail/nouveautes${avant ? `?avant=${encodeURIComponent(avant)}` : ""}`, undefined, 8000, undefined, fetchImpl);
  if (!r.ok) return { erreur: r.status === 0 ? "reseau" : r.code || "reseau" };
  const page = pageDe(r.data);
  return page ? { page } : { erreur: "reseau" };
}

export type StockageLu = Pick<Storage, "getItem" | "setItem">;

/** L'instant de publication de la dernière nouveauté lue sur cet appareil (0 : aucune, ou stockage refusé). */
export function lireNouveauteLue(stockage: StockageLu | null | undefined): number {
  try {
    const n = Number(stockage?.getItem(NOUVEAUTES_LUES_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Note que les nouveautés jusqu'à cet instant sont lues (jamais en arrière). Sans stockage : rien, et rien ne casse. */
export function noterNouveauteLue(stockage: StockageLu | null | undefined, publieLe: number): void {
  try {
    if (publieLe > lireNouveauteLue(stockage)) stockage?.setItem(NOUVEAUTES_LUES_KEY, String(publieLe));
  } catch {
    /* stockage refusé ou plein */
  }
}

/** Le point « pas lu » de l'accueil : il y a une nouveauté et elle est plus récente que la dernière lue sur cet appareil. **Sans stockage (`null`), jamais de point.** */
export function nonLue(nouveaute: { publieLe: number } | null | undefined, stockage: StockageLu | null | undefined): boolean {
  if (!nouveaute || !stockage) return false;
  try {
    stockage.getItem(NOUVEAUTES_LUES_KEY); // un stockage qui lève ne donne jamais de point
  } catch {
    return false;
  }
  return nouveaute.publieLe > lireNouveauteLue(stockage);
}

/** Les nouveautés regroupées par date (déjà dans l'ordre du serveur : la plus récente d'abord) : une section par date, dans leur ordre. */
export function parDate(nouveautes: readonly Nouveaute[]): { date: string; nouveautes: Nouveaute[] }[] {
  const groupes: { date: string; nouveautes: Nouveaute[] }[] = [];
  for (const n of nouveautes) {
    const dernier = groupes.at(-1);
    if (dernier && dernier.date === n.date) dernier.nouveautes.push(n);
    else groupes.push({ date: n.date, nouveautes: [n] });
  }
  return groupes;
}

/** Le texte d'un couple FR / EN dans la langue (le français si l'anglais manque : il ne devrait pas, la publication l'interdit). */
export const dans = (t: { fr: string; en: string }, langue: "fr" | "en"): string => (langue === "en" && t.en !== "" ? t.en : t.fr);
