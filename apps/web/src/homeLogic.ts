import { SALON_SESSION_MS, formatDay, salonSessionAt, salonSessionEnd, salonSessionStart, salonTheme, type Medal, type ThemeName } from "@cdj/sim";
import { nomMedaille } from "@cdj/ui";
import { DEMO_BASE, type ApiResult } from "./api";
import { fNumero, t, traducteurDuSocle } from "./i18n";
import { HttpSalonApi, type SalonNow } from "./salonApi";
import { demoPlan } from "./salonPlan";
import { dayShort } from "./dates";

// Logique de l'écran d'accueil (lot 29), sans DOM : quand l'afficher, où mène « Accueil », l'état du Salon, les titres. Testée par Vitest.

/**
 * Réglages d'adresse qui **choisissent un circuit ou un mode** : un lien de test (ou d'archive, ou de partage d'un jour passé) qui en
 * porte un va droit en course, comme avant l'accueil. `debug` en fait partie : les tests de navigateur ouvrent le jeu avec `?debug`.
 */
export const DIRECT_KEYS = ["seed", "day", "scenario", "mode", "watch", "demo", "debug", "theme", "variant", "spec"] as const;

/** Réglages qu'on abandonne en revenant à l'accueil : ceux qui choisissent un circuit ou un mode (les autres, comme `api` ou `touch`, restent). */
const CIRCUIT_KEYS = ["mode", "scenario", "seed", "day", "theme", "variant", "spec", "f", "v", "m", "salonAt", "watch", "demo", "home"];

/** L'accueil s'affiche-t-il à l'ouverture ? `?home=1` le force, `?home=0` le coupe ; sinon, sauf lien direct, oui. */
export function wantsHome(params: URLSearchParams): boolean {
  const forced = params.get("home");
  if (forced === "1") return true;
  if (forced === "0") return false;
  return !DIRECT_KEYS.some((k) => params.has(k));
}

/** Adresse de l'accueil depuis une page de jeu : les mêmes réglages d'affichage et de test, sans le choix d'un circuit. */
export function homeHref(search: string): string {
  const p = new URLSearchParams(search);
  for (const k of CIRCUIT_KEYS) p.delete(k);
  p.set("home", "1");
  return `?${p.toString().replace(/=(?=&|$)/g, "")}`;
}

/** La même adresse sans `home` (l'accueil forcé une fois ne doit pas coller aux liens suivants). */
export function withoutHome(search: string): string {
  const p = new URLSearchParams(search);
  p.delete("home");
  const q = p.toString().replace(/=(?=&|$)/g, "");
  return q ? `?${q}` : "?";
}

/** Le nom d'une médaille dans la langue du jeu (« Auteur », « Or »…) ; le nom est toujours écrit : la couleur seule ne porte pas l'information. */
export function medalWord(m: Medal): string {
  return nomMedaille(traducteurDuSocle(), m === "author" ? "diamant" : m === "gold" ? "or" : m === "silver" ? "argent" : "bronze");
}

/** « Circuit du Jour n° 1 · mar. 13 oct. · Rallye » (le numéro manque pour les jours d'avant le premier) ; `long: false` sans « Circuit du Jour ». */
export function dailyTitle(number: number, date: string, themeLabel: string, long = true): string {
  const tete = [long ? t("accueil.circuitDuJour") : "", number >= 1 ? fNumero(number) : ""].filter(Boolean).join(" ");
  return [tete, dayShort(date), themeLabel].filter(Boolean).join(" · ");
}

// --- Le Salon vu depuis l'accueil -------------------------------------------------------------------------------------

export interface SalonStatus {
  session: number;
  /** Thème du circuit en cours (le code de `@cdj/sim`, traduit à l'affichage par `nomTheme`). */
  theme: ThemeName;
  /** Fin de la session en cours, en heure du serveur. */
  endMs: number;
  /** Joueurs présents en ce moment. */
  players: number;
  /** Décalage à ajouter à l'heure locale pour obtenir l'heure du serveur. */
  skewMs: number;
  /** Durée d'une session. */
  sessionMs: number;
}

/** Pourquoi le Salon ne se montre pas : le jeu n'est relié à aucun serveur qui en ait un, ou le serveur ne répond pas. L'écran en dit la raison (catalogue). */
export type SalonProblem = "sans_serveur" | "muet";
export type SalonLookup = { ok: true; status: SalonStatus } | { ok: false; reason: SalonProblem };

/** Temps restant (ms) avant la fin de la session, d'après l'heure locale `localMs`. */
export const remainingMs = (s: SalonStatus, localMs: number): number => Math.max(0, s.endMs - (localMs + s.skewMs));

// Lot I5 : les décomptes (« 07:42 », « 07:42:09 ») sont le format du socle `formatDecompte` (@cdj/ui), testé dans packages/ui/test/formats.test.ts.

const salonThemeOf = (session: number): ThemeName => salonTheme(session) as ThemeName;

/**
 * Salon de démonstration (`?api=demo`) : tout se déduit de l'heure et du numéro de session, sans rien faire rouler. Les joueurs présents
 * sont les pilotes fictifs du plan de la session (l'accueil n'est pas un joueur : il ne se compte pas).
 */
export function demoSalonStatus(localMs: number, sessionMs: number = SALON_SESSION_MS): SalonStatus {
  const session = salonSessionAt(localMs, sessionMs);
  const elapsed = localMs - salonSessionStart(session, sessionMs);
  const players = demoPlan(session, sessionMs).filter((p) => p.joinAt <= elapsed && elapsed <= p.attempts[p.attempts.length - 1]!.at + 60_000).length;
  return { session, theme: salonThemeOf(session), endMs: salonSessionEnd(session, sessionMs), players, skewMs: 0, sessionMs };
}

/** Réponse de `GET /api/salon/now` → état affiché. L'heure du serveur est recalée sur l'aller-retour, comme dans `SalonClock`. */
export function salonStatusFromNow(now: SalonNow, sentAt: number, receivedAt: number): SalonStatus {
  const skewMs = now.serverMs + (receivedAt - sentAt) / 2 - receivedAt;
  return { session: now.session, theme: salonThemeOf(now.session), endMs: now.endMs, players: now.players, skewMs, sessionMs: now.endMs - now.startMs };
}

/** Interroge le Salon sans être un joueur (aucun identifiant n'est envoyé : l'accueil ne compte pas dans la présence). */
export async function lookupSalon(base: string | null, sessionMs: number = SALON_SESSION_MS, api?: { now(id: string | null): Promise<ApiResult<SalonNow>> }): Promise<SalonLookup> {
  if (!base) return { ok: false, reason: "sans_serveur" };
  if (base === DEMO_BASE) return { ok: true, status: demoSalonStatus(Date.now(), sessionMs) };
  const t0 = Date.now();
  const r = await (api ?? new HttpSalonApi(base)).now(null);
  if (!r.ok) return { ok: false, reason: r.status === 404 ? "sans_serveur" : "muet" };
  return { ok: true, status: salonStatusFromNow(r.data, t0, Date.now()) };
}

/** Jour d'aujourd'hui en texte (AAAA-MM-JJ). */
export const dayText = (day: number): string => formatDay(day);
