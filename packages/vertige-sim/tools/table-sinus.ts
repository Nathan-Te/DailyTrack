import { writeFileSync } from "node:fs";

// Génère `src/tableSinus.ts` : le quart de période du sinus, 257 entrées (un pas de 64 sur 16 384), à l'échelle 65 536. **Seul cet outil emploie `Math.sin`** : la simulation ne lit qu'une table d'entiers.
// `npm run table:vertige -w @cdj/vertige-sim`. Le test `trigo.test.ts` refait le calcul et compare : la table ne se modifie pas à la main.
const valeurs = Array.from({ length: 257 }, (_, i) => Math.round(65536 * Math.sin((i / 256) * (Math.PI / 2))));
const lignes: string[] = [];
for (let i = 0; i < valeurs.length; i += 16) lignes.push("  " + valeurs.slice(i, i + 16).join(", ") + ",");
writeFileSync(
  new URL("../src/tableSinus.ts", import.meta.url),
  `// Produit par tools/table-sinus.ts (npm run table:vertige) : ne se modifie pas à la main.\n// Le sinus d'un quart de tour, en 257 entiers à l'échelle 65 536 (l'entrée i est sin(i × 90° / 256)).\nexport const SINUS_QUART: readonly number[] = [\n${lignes.join("\n")}\n];\n`,
);
console.log("table écrite :", valeurs.length, "entrées");
