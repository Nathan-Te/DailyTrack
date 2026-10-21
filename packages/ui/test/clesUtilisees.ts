// Lot I6 : le détecteur des clés lues (clesUtilisees.test.ts). Pur.

/** Les clés nommées en clair dans un texte source, et les préfixes de clés calculées (`\`theme.${x}\``, `"erreur." + x`). */
export function clesLues(source: string): { cles: Set<string>; prefixes: string[] } {
  const cles = new Set([...source.matchAll(/["'`]([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)+)["'`]/g)].map((m) => m[1]!));
  const prefixes = new Set([...source.matchAll(/`([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)*\.)\$\{/g)].map((m) => m[1]!));
  for (const m of source.matchAll(/["']([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)*\.)["']\s*\+/g)) prefixes.add(m[1]!);
  return { cles, prefixes: [...prefixes] };
}

/** La clé est-elle lue (nommée, ou sous un préfixe calculé) ? */
export function estLue(cle: string, lues: { cles: Set<string>; prefixes: string[] }): boolean {
  return lues.cles.has(cle) || lues.prefixes.some((p) => cle.startsWith(p));
}
