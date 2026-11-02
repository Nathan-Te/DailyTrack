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
