import { formatDay, parseDay } from "@cdj/core";
import { apiFromAddress } from "@cdj/profile";
import { BUILD_API_URL, BUILD_RESTRICTED } from "../stockage";
import { SAME_ORIGIN_API } from "./source";

// Les options d'adresse d'un jeu neuf et l'adresse de son serveur. **Règle R7** : sur la production (`VITE_PRODUCTION=1`) `?api=` ne vise que `/`, la page elle-même ou la machine locale
// (`apiFromAddress`) ; les options d'essai (`?debug`, `?simuler=`, `?seed=` à venir) y sont fermées (règle R9). L'identifiant secret et la clé d'aperçu ne vont jamais dans une adresse.

export interface OptionsUrl {
  /** `?api=` lu tel quel (la règle R7 s'applique à `baseApi`). */
  api: string | null;
  /** `?apercu=` présent : l'interrupteur attend la clé avant de laisser le jeu appeler le serveur. */
  apercu: boolean;
  debug: boolean;
  /** `?debug&manuel` : la partie ne joue que pas à pas (`window.__jeu.avancer`), dès le premier tick : les tests ne dépendent d'aucune horloge. */
  manuel: boolean;
  /** `?debug&simuler=lent|perime` (lot D2) : la réponse d'un envoi retardée ; un serveur qui annonce une autre version. */
  simuler: "lent" | "perime" | null;
  tactile: "1" | "0" | null;
  /** `?seed=AAAA-MM-JJ` : jouer un jour passé (archive, jamais classé). Sur la production, une date future est refusée. */
  seed: number | null;
}

export function lireOptions(search: string, restreint: boolean = BUILD_RESTRICTED): OptionsUrl {
  const q = new URLSearchParams(search);
  const tactile = q.get("tactile");
  const simuler = q.get("simuler");
  return {
    api: q.get("api"),
    apercu: q.has("apercu"),
    debug: !restreint && q.has("debug"),
    manuel: !restreint && q.has("debug") && q.has("manuel"),
    simuler: !restreint && q.has("debug") && (simuler === "lent" || simuler === "perime") ? simuler : null,
    tactile: tactile === "1" || tactile === "0" ? tactile : null,
    seed: parseDay(q.get("seed") ?? ""),
  };
}

/** L'adresse de l'API : `?api=` (essais), sinon `VITE_API_URL` (fixée à la construction), sinon rien : pas de classement, le jeu marche hors ligne. */
export function baseApi(deLAdresse: string | null, deLaConstruction: string | undefined, origine: string | undefined, restreint: boolean): string | null {
  const base = apiFromAddress(deLAdresse, restreint, origine) || deLaConstruction || "";
  if (base === SAME_ORIGIN_API) return origine ? origine.replace(/\/+$/, "") : null;
  return base && base !== "demo" ? base.replace(/\/+$/, "") : null;
}

export const baseDeLaPage = (o: OptionsUrl): string | null => baseApi(o.api, BUILD_API_URL, typeof location === "undefined" ? undefined : location.origin, BUILD_RESTRICTED);

/** Le jour à jouer : `seed` s'il est lisible (sur la production : pas dans le futur), sinon aujourd'hui. `archive` : un jour passé, jamais classé. */
export function choisirJour(seed: number | null, aujourdhui: number, restreint: boolean = BUILD_RESTRICTED): { jour: number; archive: boolean; refuse: boolean } {
  if (seed === null) return { jour: aujourdhui, archive: false, refuse: false };
  if (seed > aujourdhui && restreint) return { jour: aujourdhui, archive: false, refuse: true };
  return { jour: seed, archive: seed < aujourdhui, refuse: false };
}

/** La série des parties jouées sur ce navigateur : les jours consécutifs jusqu'à aujourd'hui (ou hier), d'après les records gardés. */
export function serieLocale(dates: readonly string[], aujourdhui: number): number {
  const jours = new Set(dates);
  let n = 0;
  let d = jours.has(formatDay(aujourdhui)) ? aujourdhui : aujourdhui - 1;
  while (jours.has(formatDay(d))) {
    n++;
    d--;
  }
  return n;
}
