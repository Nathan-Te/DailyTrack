// Seul point d'accès au stockage local du jeu (lot R1 de la plateforme). Le reste du code parle de clés logiques (`cdj:player`,
// `cdj:best:…`) et passe toujours par `gameStorage()` ; un test (`test/storage.test.ts`) vérifie qu'aucun autre fichier de `src/` ne
// touche `localStorage` directement.
//
// Pourquoi : les aperçus de branche sont servis par la MÊME origine que le jeu publié (`nathan-te.github.io`), donc par le même
// `localStorage`. Sans préfixe, jouer sur un aperçu écrivait l'identité, les records, l'historique et la série de la production.
//
// Le préfixe est fixé À LA CONSTRUCTION (`VITE_STORAGE`, posée par `.github/workflows/pages.yml`) :
//   - `production` (construction de `main`)  → aucun préfixe : les clés restent `cdj:*`, rien ne change pour les joueurs ;
//   - `apercu` (aperçu de branche)           → `apercu:cdj:*` ;
//   - absente : serveur de développement (`npm run dev`) → `apercu:` ; `vite build` sans variable (tests e2e, CI) et Vitest → aucun préfixe,
//     pour que les tests portent sur les clés de la production.
// Sans préfixe, `gameStorage()` rend `localStorage` lui-même : en production le comportement est exactement celui d'avant.

/** Préfixe physique des aperçus et du développement local (le même pour DailyJump : `apercu:jump:*`). */
export const PREVIEW_PREFIX = "apercu:";

/** Le préfixe physique d'après la variable de construction et le mode de Vite. Pure (testée). */
export function storagePrefix(flag: string | undefined, mode: string | undefined): string {
  if (flag === "production") return "";
  // Toute autre valeur (faute de frappe comprise) : le préfixe. Une erreur ne doit jamais faire écrire un aperçu dans la production.
  if (flag) return PREVIEW_PREFIX;
  return mode === "development" ? PREVIEW_PREFIX : "";
}

// `import.meta.env` n'existe que sous Vite et Vitest : les specs Playwright (Node) importent aussi des modules qui passent par ici. Vite
// remplace `import.meta.env.VITE_STORAGE` et `import.meta.env.MODE` par leur valeur à la construction ; sous Node, l'accès lève.
type Env = { env: Record<string, string | undefined> };
function buildFlags(): { flag?: string; mode?: string } {
  try {
    return { flag: (import.meta as unknown as Env).env.VITE_STORAGE, mode: (import.meta as unknown as Env).env.MODE };
  } catch {
    return {};
  }
}
const flags = buildFlags();
export const STORAGE_PREFIX = storagePrefix(flags.flag, flags.mode);

/** Le sous-ensemble de `Storage` qu'un stockage préfixé exige de celui qu'il enveloppe. */
export type BackingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/**
 * Un stockage vu à travers un préfixe : `getItem("cdj:x")` lit `<préfixe>cdj:x` ; `key(i)` et `length` ne voient que les clés préfixées,
 * rendues sans le préfixe. Les autres clés de l'origine (celles de la production) sont invisibles et jamais modifiées.
 */
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
    getItem: (key) => backing.getItem(prefix + key),
    setItem: (key, value) => backing.setItem(prefix + key, value),
    removeItem: (key) => backing.removeItem(prefix + key),
    key: (index) => own()[index] ?? null,
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

/**
 * Le stockage local du jeu (clés logiques). Peut lever comme `localStorage` (navigation privée stricte, stockage bloqué) : les appelants
 * gardent leur `try/catch`. Relu à chaque appel (les tests remplacent `globalThis.localStorage`).
 */
export function gameStorage(): Storage {
  const backing = (globalThis as { localStorage: Storage }).localStorage;
  if (!STORAGE_PREFIX) return backing;
  if (wrapped?.backing !== backing) wrapped = { backing, storage: prefixedStorage(backing, STORAGE_PREFIX) };
  return wrapped.storage;
}

/** Toutes les clés (logiques) d'un stockage, dans l'ordre de `key(i)`. */
export function storageKeys(storage: Pick<Storage, "key" | "length">): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}
