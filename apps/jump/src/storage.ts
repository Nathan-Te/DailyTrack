/** Préfixe de tout ce que DailyJump garde dans `localStorage` (DailyTrack utilise `cdj:`) : les deux jeux partagent l'origine, jamais les clés. */
export const STORAGE_PREFIX = "jump:";

/** Nom complet d'une clé de stockage local : `storageKey("settings")` → `jump:settings`. */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}
