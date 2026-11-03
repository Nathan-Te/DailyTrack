// Lot K4c — **les records locaux d'un jeu neuf** : par jour, la meilleure partie gardée dans le navigateur (son score, sa médaille, sa **rediffusion**, et si le serveur l'a rejouée). Modèle : `apps/tower/src/records.ts`,
// rendu générique : le score est la suite des **colonnes de classement de la fiche** (dans leur ordre) et le sens de chacune (`asc` : la plus petite valeur d'abord). Le serveur fait foi ; ceci n'est qu'un
// cache et la file d'attente de l'envoi (`envoye`). Pur : le stockage est injecté, une lecture ou une écriture qui échoue est sans suite (le jeu reste jouable, sans mémoire). **À la demande** : un jeu
// n'importe cette brique que depuis le module de son envoi, jamais depuis son premier chargement.

export type Sens = "asc" | "desc";
type Magasin = Pick<Storage, "getItem" | "setItem"> | null;
type MagasinEfface = Magasin & Partial<Pick<Storage, "removeItem">>;

/** Les jours gardés (les plus récents) : une rediffusion fait quelques ko, trente jours restent très en deçà du quota du navigateur. */
export const JOURS_GARDES = 30;

export interface RecordLocal {
  /** Les colonnes de classement de la fiche, dans l'ordre (des entiers ≥ 0). */
  score: number[];
  /** Le code commun de la médaille (`author`, `gold`, `silver`, `bronze`) ou `null`. */
  medaille: string | null;
  /** La rediffusion de cette partie, que le serveur rejoue. */
  rediffusion: string;
  /** Le serveur a rejoué et classé cette partie. */
  envoye: boolean;
}
export type Records = Record<string, RecordLocal>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MEDAILLES = ["author", "gold", "silver", "bronze"];
const entier = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0;

/** `b` passe-t-elle strictement devant `a` ? La première colonne qui diffère décide, dans le sens de la fiche. `a` absente : toute partie bat « rien ». */
export function bat(a: readonly number[] | null | undefined, b: readonly number[], sens: readonly Sens[]): boolean {
  if (!a) return true;
  for (let i = 0; i < sens.length; i++) {
    if (b[i] === a[i]) continue;
    return sens[i] === "desc" ? b[i]! > a[i]! : b[i]! < a[i]!;
  }
  return false;
}

export interface OptionsRecords {
  /** La clé de stockage (préfixée du jeu : `cibles:records`). */
  cle: string;
  /** Le sens de chaque colonne de classement, dans l'ordre de la fiche. */
  sens: readonly Sens[];
  joursGardes?: number;
}

export interface MagasinRecords {
  lire(stockage: Magasin): Records;
  effacer(stockage: MagasinEfface): void;
  /** Propose la partie qui vient de finir : elle devient le record du jour si elle bat celui qui est gardé (`nouveau`), non envoyée. */
  proposer(stockage: Magasin, date: string, partie: Omit<RecordLocal, "envoye">): { nouveau: boolean; record: RecordLocal };
  /** Note que le serveur a rejoué le record du jour ; sans effet si un meilleur record a été gardé depuis. */
  noterEnvoye(stockage: Magasin, date: string, score: readonly number[]): void;
  /** Les jours dont le record attend d'être envoyé, du plus récent au plus ancien. */
  enAttente(records: Records): string[];
}

export function creerRecords(o: OptionsRecords): MagasinRecords {
  const n = o.sens.length;
  const gardes = o.joursGardes ?? JOURS_GARDES;

  function lireUn(x: unknown): RecordLocal | null {
    if (typeof x !== "object" || x === null) return null;
    const v = x as Record<string, unknown>;
    if (!Array.isArray(v.s) || v.s.length !== n || !v.s.every(entier) || typeof v.r !== "string" || v.r.length === 0) return null;
    const m = v.m === null || v.m === undefined ? null : typeof v.m === "string" && MEDAILLES.includes(v.m) ? v.m : undefined;
    if (m === undefined) return null;
    return { score: v.s as number[], medaille: m, rediffusion: v.r, envoye: v.e === 1 };
  }

  function lire(stockage: Magasin): Records {
    try {
      const brut = stockage?.getItem(o.cle);
      if (!brut) return {};
      const json = JSON.parse(brut) as { jours?: unknown };
      if (typeof json.jours !== "object" || json.jours === null) return {};
      const out: Records = {};
      for (const [date, v] of Object.entries(json.jours)) {
        const r = DATE.test(date) ? lireUn(v) : null;
        if (r) out[date] = r;
      }
      return out;
    } catch {
      return {};
    }
  }

  function ecrire(stockage: Magasin, records: Records): void {
    try {
      const dates = Object.keys(records).sort().slice(-gardes);
      const jours = Object.fromEntries(dates.map((d) => [d, { s: records[d]!.score, m: records[d]!.medaille, r: records[d]!.rediffusion, e: records[d]!.envoye ? 1 : 0 }]));
      stockage?.setItem(o.cle, JSON.stringify({ v: 1, jours }));
    } catch {
      /* quota ou stockage refusé : pas de mémoire entre deux visites */
    }
  }

  return {
    lire,
    effacer(stockage) {
      try {
        stockage?.removeItem?.(o.cle);
      } catch {
        /* stockage refusé : rien à effacer */
      }
    },
    proposer(stockage, date, partie) {
      const records = lire(stockage);
      const avant = records[date];
      if (!bat(avant?.score, partie.score, o.sens)) return { nouveau: false, record: avant! };
      const record: RecordLocal = { ...partie, envoye: false };
      records[date] = record;
      ecrire(stockage, records);
      return { nouveau: true, record };
    },
    noterEnvoye(stockage, date, score) {
      const records = lire(stockage);
      const r = records[date];
      if (!r || r.score.length !== score.length || r.score.some((v, i) => v !== score[i])) return;
      records[date] = { ...r, envoye: true };
      ecrire(stockage, records);
    },
    enAttente: (records) => Object.keys(records).filter((d) => !records[d]!.envoye).sort().reverse(),
  };
}
