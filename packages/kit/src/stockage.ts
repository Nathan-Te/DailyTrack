// Le stockage local d'un jeu — la seule copie (lot K3). Avant : `storage.ts` de Track, `storage.ts` de Jump et `stockage.ts` de Tower recopiaient le même préfixe physique, le même stockage
// préfixé et les mêmes drapeaux de construction. Le préfixe **logique** (`jump:`, `tower:`, `cdj:`) est celui du jeu (sa fiche : `prefixe`) ; le préfixe **physique** est le même partout.
//
// Depuis le lot R4 (playdujour.com) production, recette et chaque aperçu sont des ORIGINES distinctes : le navigateur sépare leur stockage. Le préfixe physique `apercu:` ne sert plus qu'au serveur
// de développement :
//   - `VITE_STORAGE=production` → aucun préfixe ; toute autre valeur → `apercu:` ; absente : serveur de développement → `apercu:`, `vite build` et Vitest → aucun préfixe.
// Le reste du code d'un jeu ne voit que les clés logiques ; sans préfixe physique, `gameStorage()` rend `localStorage` lui-même.

/** Préfixe physique des aperçus et du développement local. */
export const PREVIEW_PREFIX = "apercu:";

/** Le préfixe physique d'après la variable de construction et le mode de Vite. Pure (testée). */
export function namespacePrefix(flag: string | undefined, mode: string | undefined): string {
  if (flag === "production") return "";
  // Toute autre valeur (faute de frappe comprise) : le préfixe. Une erreur ne doit jamais faire écrire un aperçu dans la production.
  if (flag) return PREVIEW_PREFIX;
  return mode === "development" ? PREVIEW_PREFIX : "";
}

type Env = { env: Record<string, string | undefined> };
// Chaque drapeau est lu à part et marqué sans effet : un jeu qui n'utilise pas `BUILD_API_URL` ou `BUILD_RESTRICTED` ne paie pas leur lecture (Track : seul le préfixe). Accès écrits en entier
// (`import.meta.env.X`) : Vite ne remplace que cette forme à la construction (jamais un `env` rangé dans une variable) ; sous Node l'accès lève, d'où le `try`.
const lire = (f: () => string | undefined): string | undefined => {
  try {
    return f();
  } catch {
    return undefined;
  }
};
/** L'adresse du serveur fixée à la construction (`VITE_API_URL` : `/` sur la production, la recette et les aperçus ; absente : pas de classement, sauf `?api=`). */
export const BUILD_API_URL: string | undefined = /* @__PURE__ */ lire(() => (import.meta as unknown as Env).env.VITE_API_URL) || undefined;
/** Cette construction est celle de la production (`VITE_PRODUCTION=1`) : `?api=` et les options d'essai y sont restreints (règles R7 et R9). */
export const BUILD_RESTRICTED: boolean = /* @__PURE__ */ lire(() => (import.meta as unknown as Env).env.VITE_PRODUCTION) === "1";
/** Le préfixe physique de cette construction (`""` en production). */
export const NAMESPACE_PREFIX = namespacePrefix(
  /* @__PURE__ */ lire(() => (import.meta as unknown as Env).env.VITE_STORAGE),
  /* @__PURE__ */ lire(() => (import.meta as unknown as Env).env.MODE),
);

/** Le sous-ensemble de `Storage` qu'un stockage préfixé exige de celui qu'il enveloppe. */
export type BackingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** Un stockage vu à travers un préfixe : `key(i)` et `length` ne voient que les clés préfixées, rendues sans le préfixe ; les autres clés de l'origine sont invisibles et jamais modifiées. */
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
    // N'efface que les clés préfixées (jamais celles de la production).
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

/** Préfixe du mode démo (`?api=demo`) : tout ce que le jeu y garde est à part (`demo:<jeu>:*`, `demo:cdj:*`), jamais les vraies données. */
export const DEMO_PREFIX = "demo:";

/** Le stockage du mode démo : le stockage du jeu vu à travers `demo:`. */
export function demoStorage(backing: BackingStorage | null): Storage | null {
  return backing ? prefixedStorage(backing, DEMO_PREFIX) : null;
}
