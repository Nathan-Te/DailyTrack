import { BUILD_API_URL, gameStorage, NAMESPACE_PREFIX, namespacePrefix, PREVIEW_PREFIX, prefixedStorage, type BackingStorage } from "@cdj/kit/stockage";

// Seul point d'accès au stockage local de Tower (lot T4) : `gameStorage()`. Un test (`test/stockage.test.ts`) vérifie qu'aucun autre fichier de `src/` ne touche `localStorage` directement.
// **Lot K3 : le stockage préfixé, le préfixe physique (`apercu:` en développement local seulement, règle des trois jeux) et les drapeaux de construction sont ceux de `@cdj/kit/stockage`** ; il ne
// reste ici que le préfixe logique de Tower. Les clés de Tower portent `tower:` (DailyTrack `cdj:`, DailyJump `jump:`) ; l'identité de la plateforme (`cdj:player`, `cdj:name`…) est partagée avec les
// autres jeux de la même origine.

/** Préfixe de tout ce que Tower garde dans `localStorage`. */
export const STORAGE_PREFIX = "tower:";

/** Nom complet d'une clé de stockage local : `storageKey("records")` → `tower:records`. */
export const storageKey = (name: string): string => `${STORAGE_PREFIX}${name}`;

/** La dernière révision d'identité de la plateforme que Tower a vue (`identityRevisionSeen` de `@cdj/profile`, lot P4) : `<jeu>:identite:vue`. */
export const CLE_IDENTITE_VUE = storageKey("identite:vue");

export { BUILD_API_URL, gameStorage, NAMESPACE_PREFIX, namespacePrefix, PREVIEW_PREFIX, prefixedStorage, type BackingStorage };
