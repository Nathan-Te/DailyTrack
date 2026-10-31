import type { NomMedaille } from "@cdj/tower-sim";
import { storageKey } from "./stockage";

// (Pas d'import de valeur depuis `@cdj/tower-sim` : ce module est dans le premier chargement, l'accueil, qui n'embarque pas la simulation.)
const NOMS_MEDAILLES: readonly NomMedaille[] = ["bronze", "argent", "or", "auteur"];

// Les records de Tower gardés dans le navigateur (lot T4) : **par jour, ta meilleure partie** — la hauteur finale stable, les vies, le temps, la médaille et la **rediffusion** (le texte
// `base64url` que le serveur rejoue ; c'est aussi d'elle que dérive le fantôme « Ma meilleure »). Une seule clé, `tower:records` (une donnée de jeu, effacée au « Nouveau départ » une fois le
// préfixe `tower:` branché par la plateforme). Le serveur fait foi ; ceci n'est qu'un cache et la file d'attente de l'envoi (`envoye` : le serveur a rejoué cette partie).
// Pur : le stockage est injecté, une lecture ou une écriture qui échoue est sans suite (le jeu reste jouable, sans mémoire).

export const CLE_RECORDS = storageKey("records");
/** Les jours gardés (les plus récents) : une rediffusion fait quelques ko, trente jours restent très en deçà du quota du navigateur. */
export const JOURS_GARDES = 30;

export interface Record1 {
  hauteurMm: number;
  vies: number;
  ticks: number;
  medaille: NomMedaille | null;
  /** La rediffusion de cette partie (`encoderRediffusion`). */
  rediffusion: string;
  /** Le serveur a rejoué et classé cette partie. */
  envoye: boolean;
}

export type Records = Record<string, Record1>;

type Magasin = Pick<Storage, "getItem" | "setItem"> | null;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const entier = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0;

/** Un enregistrement lu du stockage, ou `null` s'il n'a pas la forme attendue (il est alors ignoré). */
function lire(x: unknown): Record1 | null {
  if (typeof x !== "object" || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!entier(o.h) || !entier(o.v) || !entier(o.t) || typeof o.r !== "string" || o.r.length === 0) return null;
  const m = o.m === null || o.m === undefined ? null : (NOMS_MEDAILLES as readonly unknown[]).includes(o.m) ? (o.m as NomMedaille) : undefined;
  if (m === undefined) return null;
  return { hauteurMm: o.h, vies: o.v, ticks: o.t, medaille: m, rediffusion: o.r, envoye: o.e === 1 };
}

/** Tous les records gardés (`{}` si rien, si le stockage est refusé ou si le texte est abîmé). */
export function lireRecords(stockage: Magasin): Records {
  try {
    const brut = stockage?.getItem(CLE_RECORDS);
    if (!brut) return {};
    const json = JSON.parse(brut) as { jours?: unknown };
    if (typeof json.jours !== "object" || json.jours === null) return {};
    const out: Records = {};
    for (const [date, v] of Object.entries(json.jours)) {
      const r = DATE.test(date) ? lire(v) : null;
      if (r) out[date] = r;
    }
    return out;
  } catch {
    return {};
  }
}

function ecrire(stockage: Magasin, records: Records): void {
  try {
    const dates = Object.keys(records).sort().slice(-JOURS_GARDES);
    const jours = Object.fromEntries(dates.map((d) => {
      const r = records[d]!;
      return [d, { h: r.hauteurMm, v: r.vies, t: r.ticks, m: r.medaille, r: r.rediffusion, e: r.envoye ? 1 : 0 }];
    }));
    stockage?.setItem(CLE_RECORDS, JSON.stringify({ v: 1, jours }));
  } catch {
    /* quota ou stockage refusé : pas de mémoire entre deux visites */
  }
}

/** Efface les records du navigateur (ils appartenaient à l'ancienne identité : un code a été chargé ailleurs). */
export function effacerRecords(stockage: Magasin & Partial<Pick<Storage, "removeItem">>): void {
  try {
    stockage?.removeItem?.(CLE_RECORDS);
  } catch {
    /* stockage refusé : rien à effacer */
  }
}

/** La partie `b` bat-elle `a` ? Hauteur, puis vies, puis moins de temps (le départage du classement). */
export function bat(a: Pick<Record1, "hauteurMm" | "vies" | "ticks"> | null | undefined, b: Pick<Record1, "hauteurMm" | "vies" | "ticks">): boolean {
  if (!a) return true;
  if (b.hauteurMm !== a.hauteurMm) return b.hauteurMm > a.hauteurMm;
  if (b.vies !== a.vies) return b.vies > a.vies;
  return b.ticks < a.ticks;
}

/**
 * Propose la partie qui vient de finir pour ce jour. Elle devient le record si elle bat celui qui est gardé (`nouveau`), et le garde ALORS non envoyé. Rend le record du jour après coup.
 */
export function proposerRecord(stockage: Magasin, date: string, partie: Omit<Record1, "envoye">): { nouveau: boolean; record: Record1 } {
  const records = lireRecords(stockage);
  const avant = records[date];
  if (!bat(avant, partie)) return { nouveau: false, record: avant! };
  const record: Record1 = { ...partie, envoye: false };
  records[date] = record;
  ecrire(stockage, records);
  return { nouveau: true, record };
}

/** Note que le serveur a rejoué le record du jour (`hauteurMm`, `vies`, `ticks` : celui qui est parti) ; sans effet si un meilleur record a été gardé depuis. */
export function noterEnvoye(stockage: Magasin, date: string, partie: Pick<Record1, "hauteurMm" | "vies" | "ticks">): void {
  const records = lireRecords(stockage);
  const r = records[date];
  if (!r || r.hauteurMm !== partie.hauteurMm || r.vies !== partie.vies || r.ticks !== partie.ticks) return;
  records[date] = { ...r, envoye: true };
  ecrire(stockage, records);
}

/** Les jours (AAAA-MM-JJ) dont le record attend d'être envoyé, du plus récent au plus ancien. */
export function enAttente(records: Records): string[] {
  return Object.keys(records).filter((d) => !records[d]!.envoye).sort().reverse();
}

/** La série locale : les jours de suite jusqu'à `aujourdhui` (ou `aujourdhui − 1` si aujourd'hui n'est pas encore joué) où un record existe. `dateDe` donne la date d'un numéro de jour. */
export function serieLocale(records: Records, aujourdhui: number, dateDe: (jour: number) => string): number {
  let n = 0;
  for (let j = records[dateDe(aujourdhui)] ? aujourdhui : aujourdhui - 1; records[dateDe(j)]; j--) n++;
  return n;
}
