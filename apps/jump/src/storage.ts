/** Préfixe de tout ce que DailyJump garde dans `localStorage` (DailyTrack utilise `cdj:`) : les deux jeux partagent l'origine, jamais les clés. */
export const STORAGE_PREFIX = "jump:";

/** Nom complet d'une clé de stockage local : `storageKey("settings")` → `jump:settings`. */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

// Seul point d'accès au stockage local de DailyJump (lot R1 de la plateforme) : `gameStorage()` ci-dessous. Un test (`test/storage.test.ts`)
// vérifie qu'aucun autre fichier de `src/` ne touche `localStorage` directement.
//
// Les aperçus de branche sont servis par la MÊME origine que le jeu publié (`nathan-te.github.io`) : sans préfixe, jouer sur un aperçu
// écrivait l'historique, la série et les réglages de la production. Le préfixe physique est fixé À LA CONSTRUCTION (`VITE_STORAGE`, posée
// par `.github/workflows/pages.yml`), avec la même règle que DailyTrack (`apps/web/src/storage.ts`) :
//   - `production` (construction de `main`)  → aucun préfixe : les clés restent `jump:*` ;
//   - `apercu` (aperçu de branche)           → `apercu:jump:*` ;
//   - absente : serveur de développement → `apercu:` ; `vite build` sans variable (tests e2e, CI) et Vitest → aucun préfixe.
// Le reste du code ne voit que les clés logiques (`jump:*`) ; sans préfixe, `gameStorage()` rend `localStorage` lui-même.

/** Préfixe physique des aperçus et du développement local (le même que DailyTrack : `apercu:cdj:*`). */
export const PREVIEW_PREFIX = "apercu:";

/** Le préfixe physique d'après la variable de construction et le mode de Vite. Pure (testée). */
export function namespacePrefix(flag: string | undefined, mode: string | undefined): string {
  if (flag === "production") return "";
  // Toute autre valeur (faute de frappe comprise) : le préfixe. Une erreur ne doit jamais faire écrire un aperçu dans la production.
  if (flag) return PREVIEW_PREFIX;
  return mode === "development" ? PREVIEW_PREFIX : "";
}

// `import.meta.env` n'existe que sous Vite et Vitest. Vite remplace `import.meta.env.VITE_STORAGE` et `import.meta.env.MODE` par leur
// valeur à la construction ; sous Node, l'accès lève.
type Env = { env: Record<string, string | undefined> };
function buildFlags(): { flag?: string; mode?: string; api?: string } {
  try {
    // Accès écrits en entier (`import.meta.env.X`) : Vite ne remplace que cette forme à la construction (jamais un `env` rangé dans une variable).
    return {
      flag: (import.meta as unknown as Env).env.VITE_STORAGE,
      mode: (import.meta as unknown as Env).env.MODE,
      api: (import.meta as unknown as Env).env.VITE_API_URL,
    };
  } catch {
    return {};
  }
}
const flags = buildFlags();
/**
 * Lot P1 (plateforme) : l'adresse du serveur du classement fixée à la construction (`VITE_API_URL`, posée par `pages.yml` : la production pour
 * `main`, la recette pour un aperçu de branche ; absente : pas de classement, sauf `?api=`).
 */
export const BUILD_API_URL: string | undefined = flags.api || undefined;
/** Préfixe physique de cette construction (`""` en production). */
export const NAMESPACE_PREFIX = namespacePrefix(flags.flag, flags.mode);

/** Le sous-ensemble de `Storage` qu'un stockage préfixé exige de celui qu'il enveloppe. */
export type BackingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/**
 * Un stockage vu à travers un préfixe : `getItem("jump:x")` lit `<préfixe>jump:x` ; `key(i)` et `length` ne voient que les clés préfixées,
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

/**
 * Le stockage local du jeu (clés logiques), ou null s'il est illisible (navigation privée stricte, iframe isolée, Node…). Relu à chaque appel.
 */
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

/** Lot P1 : préfixe du mode démo (`?api=demo`) : tout ce que le jeu y garde est à part (`demo:jump:*`, `demo:cdj:*`), jamais les vraies données. */
export const DEMO_PREFIX = "demo:";

/** Le stockage du mode démo : le stockage du jeu vu à travers `demo:` (rien du vrai jeu n'est lu ni écrit, sauf ce que le jeu y copie). */
export function demoStorage(backing: BackingStorage | null): Storage | null {
  return backing ? prefixedStorage(backing, DEMO_PREFIX) : null;
}
