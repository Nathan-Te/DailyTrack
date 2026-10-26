// Lot 21 : l'empreinte d'un texte (FNV-1a sur 32 bits), seule dans son fichier : le jeu en a besoin au premier chargement (preuve d'un niveau figé, d'un cache),
// sans le catalogue des morceaux ni le générateur (qui vivent, eux, dans `modules.ts` et `daily.ts`). `modules.ts` la réexporte, rien d'autre n'a changé.

export function textHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}
