// Seul point d'accès au stockage local du jeu (lot R1 de la plateforme). Le reste du code parle de clés logiques (`cdj:player`,
// `cdj:best:…`) et passe toujours par `gameStorage()` ; un test (`test/storage.test.ts`) vérifie qu'aucun autre fichier de `src/` ne
// touche `localStorage` directement.
//
// Pourquoi (lot R1) : les aperçus de branche étaient servis par la MÊME origine que le jeu publié (`nathan-te.github.io`), donc par le même
// `localStorage` ; un préfixe les séparait. Depuis le lot R4 (playdujour.com, Firebase Hosting), la production, la recette et chaque canal
// d'aperçu sont des ORIGINES distinctes : le navigateur sépare leur stockage, et aucun déploiement ne pose plus `VITE_STORAGE` (les clés
// restent `cdj:*` partout, la production garde exactement les siennes). Test : apps/portail/test/domaine.test.ts.
//
// Le préfixe reste pour le développement local et les essais (`VITE_STORAGE`, à la construction) :
//   - `production` → aucun préfixe ;
//   - toute autre valeur (`apercu`) → `apercu:cdj:*` ;
//   - absente : serveur de développement (`npm run dev`) → `apercu:` ; `vite build` sans variable (déploiements, tests e2e, CI) et Vitest →
//     aucun préfixe.
// Sans préfixe, `gameStorage()` rend `localStorage` lui-même : en production le comportement est exactement celui d'avant.

// **Lot K3 : le stockage préfixé, le préfixe physique et son calcul sont ceux de `@cdj/kit/stockage`**, communs aux trois jeux ; il ne reste ici que ce qui est propre à Track — ses noms (`storagePrefix`,
// `STORAGE_PREFIX`) et `gameStorage()` qui, comme avant, ne rend jamais `null` (il lève si le stockage est refusé : les appelants gardent leur `try/catch`).
import { gameStorage as stockageDuKit, NAMESPACE_PREFIX, namespacePrefix, PREVIEW_PREFIX, prefixedStorage, type BackingStorage } from "@cdj/kit/stockage";

/** Le préfixe physique d'après la variable de construction et le mode de Vite. Pure (testée). */
export const storagePrefix = namespacePrefix;
/** Le préfixe physique de cette construction (`""` en production). */
export const STORAGE_PREFIX = NAMESPACE_PREFIX;
export { PREVIEW_PREFIX, prefixedStorage, type BackingStorage };

/**
 * Le stockage local du jeu (clés logiques) : celui du kit, typé comme avant (jamais `null` pour l'appelant). S'il est refusé (navigation privée stricte, stockage bloqué) l'accès à ses méthodes lève,
 * comme `localStorage` avant le lot K3 : les appelants gardent leur `try/catch`. Relu à chaque appel.
 */
export const gameStorage = stockageDuKit as () => Storage;

/** Toutes les clés (logiques) d'un stockage, dans l'ordre de `key(i)`. */
export function storageKeys(storage: Pick<Storage, "key" | "length">): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}
