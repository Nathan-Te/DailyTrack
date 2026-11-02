import { formatNombre } from "./formats";

// Le moteur de traduction (lot I1, phase 3) : quelques dizaines de lignes, sans bibliothèque. Des catalogues `fr` et `en` par application
// (plus le catalogue commun de `packages/ui` : composants et codes d'erreur du serveur), des clés stables et lisibles (`portail.jeux.titre`),
// des paramètres nommés (`{temps}`) et des pluriels choisis par `Intl.PluralRules` sur le paramètre `n`. Les nombres passés en paramètre sont
// écrits au format de la langue (`1 284` / `1,284`). Parité des catalogues (mêmes clés, mêmes paramètres, aucune valeur vide) :
// `packages/ui/test/catalogues.test.ts`.

export type Langue = "fr" | "en";
export const LANGUES: readonly Langue[] = ["fr", "en"];

/** Une valeur de catalogue : un texte, ou ses formes plurielles (`other` obligatoire), choisies par le paramètre `n`. */
export type Valeur = string | ({ other: string } & Partial<Record<Intl.LDMLPluralRule, string>>);
export type Catalogue = Readonly<Record<string, Valeur>>;
/** Un catalogue dans les deux langues : `en` doit avoir exactement les clés de `fr`. */
export type Catalogues<C extends Catalogue> = { fr: C; en: { readonly [K in keyof C]: Valeur } };
export type Parametres = Readonly<Record<string, string | number>>;

export interface Traducteur<K extends string = string> {
  readonly langue: Langue;
  /** Le texte de `cle` dans la langue, paramètres remplacés. Une clé absente rend la clé elle-même (les tests de parité l'empêchent). */
  t(cle: K, params?: Parametres): string;
}

const LOCALES: Record<Langue, string> = { fr: "fr-FR", en: "en-US" };
/** La locale `Intl` d'une langue (`fr-FR`, `en-US`). */
export function locale(langue: Langue): string {
  return LOCALES[langue];
}

const pluriels = new Map<Langue, Intl.PluralRules>();
function forme(valeur: Valeur, langue: Langue, n: unknown): string {
  if (typeof valeur === "string") return valeur;
  let regles = pluriels.get(langue);
  if (!regles) pluriels.set(langue, (regles = new Intl.PluralRules(LOCALES[langue])));
  const cat = typeof n === "number" ? regles.select(n) : "other";
  return valeur[cat] ?? valeur.other;
}

/** Remplace `{nom}` par le paramètre (un nombre est écrit au format de la langue) ; un paramètre absent laisse `{nom}`. */
export function remplir(texte: string, params: Parametres | undefined, langue: Langue): string {
  if (!params) return texte;
  return texte.replace(/\{(\w+)\}/g, (tout, nom: string) => {
    const v = params[nom];
    return v === undefined ? tout : typeof v === "number" ? formatNombre(v, langue) : v;
  });
}

/** Les clés d'une liste de catalogues. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClesDe<T extends readonly Catalogues<any>[]> = { [I in keyof T]: T[I] extends Catalogues<infer C> ? keyof C & string : never }[number];

/** Un traducteur pour une langue, sur un ou plusieurs catalogues (le premier qui a la clé gagne). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function traducteur<T extends readonly Catalogues<any>[]>(langue: Langue, ...catalogues: T): Traducteur<ClesDe<T>> {
  const tables = catalogues.map((c) => c[langue] as Catalogue);
  return {
    langue,
    t(cle, params) {
      for (const table of tables) {
        const v = table[cle];
        if (v !== undefined) return remplir(forme(v, langue, params?.n), params, langue);
      }
      return cle;
    },
  };
}

/** Les noms des paramètres d'une valeur (toutes formes plurielles confondues), triés : la parité les compare entre langues. */
export function parametresDe(valeur: Valeur): string[] {
  const textes = typeof valeur === "string" ? [valeur] : Object.values(valeur).filter((v): v is string => typeof v === "string");
  return [...new Set(textes.flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)))].sort();
}

// ESSAI R17 (à annuler) : +1 Ko dans le socle.
(globalThis as Record<string, unknown>).__essaiR17 = "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";
