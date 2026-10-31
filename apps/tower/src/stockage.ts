// Seul point d'accès au stockage local de Tower (lot T4), sur le modèle de `apps/jump/src/storage.ts` : `gameStorage()`. Un test (`test/stockage.test.ts`) vérifie qu'aucun autre fichier de
// `src/` ne touche `localStorage` directement.
//
// Les clés de Tower portent le préfixe `tower:` (DailyTrack `cdj:`, DailyJump `jump:`) ; l'identité de la plateforme (`cdj:player`, `cdj:name`…) est partagée avec les autres jeux de la
// même origine. Depuis le lot R4 (playdujour.com) production, recette et chaque aperçu sont des ORIGINES distinctes : le navigateur sépare leur stockage. Le préfixe physique `apercu:`
// ne sert plus qu'au serveur de développement (`apercu:tower:*`), même règle que les deux autres jeux :
//   - `VITE_STORAGE=production` → aucun préfixe ; toute autre valeur → `apercu:` ; absente : serveur de développement → `apercu:`, `vite build` et Vitest → aucun préfixe.
// Le reste du code ne voit que les clés logiques (`tower:*`, `cdj:*`).

/** Préfixe de tout ce que Tower garde dans `localStorage`. */
export const STORAGE_PREFIX = "tower:";

/** Nom complet d'une clé de stockage local : `storageKey("records")` → `tower:records`. */
export const storageKey = (name: string): string => `${STORAGE_PREFIX}${name}`;

/** La dernière révision d'identité de la plateforme que Tower a vue (`identityRevisionSeen` de `@cdj/profile`, lot P4) : `<jeu>:identite:vue`. */
export const CLE_IDENTITE_VUE = storageKey("identite:vue");

/** Préfixe physique du développement local (le même que les autres jeux : `apercu:tower:*`). */
export const PREVIEW_PREFIX = "apercu:";

/** Le préfixe physique d'après la variable de construction et le mode de Vite. Pure (testée). */
export function namespacePrefix(flag: string | undefined, mode: string | undefined): string {
  if (flag === "production") return "";
  // Toute autre valeur (faute de frappe comprise) : le préfixe. Une erreur ne doit jamais faire écrire un aperçu dans la production.
  if (flag) return PREVIEW_PREFIX;
  return mode === "development" ? PREVIEW_PREFIX : "";
}

type Env = { env: Record<string, string | undefined> };
function buildFlags(): { flag?: string; mode?: string; api?: string } {
  try {
    // Accès écrits en entier (`import.meta.env.X`) : Vite ne remplace que cette forme à la construction.
    return { flag: (import.meta as unknown as Env).env.VITE_STORAGE, mode: (import.meta as unknown as Env).env.MODE, api: (import.meta as unknown as Env).env.VITE_API_URL };
  } catch {
    return {};
  }
}
const flags = buildFlags();
/** L'adresse du serveur fixée à la construction (`VITE_API_URL` : `/`, la même origine, sur la production, la recette et les aperçus ; absente : pas de classement, sauf `?api=`). */
export const BUILD_API_URL: string | undefined = flags.api || undefined;
/** Le préfixe physique de cette construction (`""` en production). */
export const NAMESPACE_PREFIX = namespacePrefix(flags.flag, flags.mode);

/** Le sous-ensemble de `Storage` qu'un stockage préfixé exige de celui qu'il enveloppe. */
export type BackingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** Un stockage vu à travers un préfixe : les autres clés de l'origine sont invisibles et jamais modifiées. */
export function prefixedStorage(backing: BackingStorage, prefix: string): Storage {
  if (!prefix) return backing as Storage;
  const own = (): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < backing.length; i++) {
      const k = backing.key(i);
      if (k !== null && k.startsWith(prefix)) keys.push(k.slice(prefix.length));
    }
    return keys;
  };
  return {
    getItem: (key: string) => backing.getItem(prefix + key),
    setItem: (key: string, value: string) => backing.setItem(prefix + key, value),
    removeItem: (key: string) => backing.removeItem(prefix + key),
    key: (index: number) => own()[index] ?? null,
    get length() {
      return own().length;
    },
    clear: () => {
      for (const k of own()) backing.removeItem(prefix + k);
    },
  } as Storage;
}

let wrapped: { backing: BackingStorage; storage: Storage } | null = null;

/** Le stockage local du jeu (clés logiques), ou null s'il est illisible (navigation privée stricte, iframe isolée, Node…). Relu à chaque appel. */
export function gameStorage(): Storage | null {
  try {
    const backing = (globalThis as { localStorage?: Storage }).localStorage;
    if (!backing) return null;
    void backing.length;
    if (!NAMESPACE_PREFIX) return backing;
    if (wrapped?.backing !== backing) wrapped = { backing, storage: prefixedStorage(backing, NAMESPACE_PREFIX) };
    return wrapped.storage;
  } catch {
    return null;
  }
}
