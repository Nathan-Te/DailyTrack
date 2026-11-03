import { BUILD_API_URL, BUILD_RESTRICTED, DEMO_PREFIX, demoStorage, gameStorage, NAMESPACE_PREFIX, namespacePrefix, PREVIEW_PREFIX, prefixedStorage, type BackingStorage } from "@cdj/kit/stockage";

// Seul point d'accès au stockage local de DailyJump (lot R1 de la plateforme) : `gameStorage()`. Un test (`test/storage.test.ts`) vérifie qu'aucun autre fichier de `src/` ne touche `localStorage`
// directement. **Lot K3 : le stockage préfixé, le préfixe physique (`apercu:` en développement local seulement) et les drapeaux de construction sont ceux de `@cdj/kit/stockage`**, communs aux trois
// jeux ; il ne reste ici que le préfixe logique de Jump.

/** Préfixe de tout ce que DailyJump garde dans `localStorage` (DailyTrack utilise `cdj:`) : les jeux partagent l'origine, jamais les clés. */
export const STORAGE_PREFIX = "jump:";

/** Nom complet d'une clé de stockage local : `storageKey("settings")` → `jump:settings`. */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

export { BUILD_API_URL, BUILD_RESTRICTED, DEMO_PREFIX, demoStorage, gameStorage, NAMESPACE_PREFIX, namespacePrefix, PREVIEW_PREFIX, prefixedStorage, type BackingStorage };
