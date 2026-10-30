// Lot T0 — génère `lab/a/trigTable.ts` : un quart de sinus en 1024 intervalles (1025 valeurs en Q16). Hors de la simulation : il utilise Math.sin, une fois,
// et le résultat est COMMITÉ (le moteur A n'appelle jamais de transcendante). Un test vérifie que le fichier correspond à ce que ce script écrit.
export const QUART = 1024;
export function tableDeSinus(): number[] {
  const out: number[] = [];
  for (let i = 0; i <= QUART; i++) out.push(Math.round(Math.sin((i / QUART) * (Math.PI / 2)) * 65536));
  return out;
}
export function sourceTable(): string {
  const v = tableDeSinus();
  const lignes: string[] = [];
  for (let i = 0; i < v.length; i += 16) lignes.push("  " + v.slice(i, i + 16).join(", ") + ",");
  return `// GÉNÉRÉ par packages/tower-sim/tools/trig.ts (\`npm run trig:tower -w @cdj/tower-sim\`) — ne pas modifier à la main.
// Un quart de sinus en 1024 intervalles, 1025 valeurs en Q16 (sin(i × π/2 / 1024) × 65536, arrondi).
export const SIN_QUART: readonly number[] = [
${lignes.join("\n")}
];
`;
}
if (process.argv[1] && /trig\.(ts|mjs)$/.test(process.argv[1]) && process.argv.includes("--ecrire")) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(new URL("../lab/a/trigTable.ts", import.meta.url), sourceTable());
}
