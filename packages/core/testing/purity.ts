import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Test de pureté générique, partagé par `core`, `sim` et `jump-sim` : une simulation ne doit utiliser aucune fonction dont le résultat peut
// varier selon le moteur JS, ni source de hasard ou de temps (voir CLAUDE.md). Une seule liste d'interdits pour tous les paquets.
export const FORBIDDEN: readonly RegExp[] = [
  /Math\.(sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log|log1p|log2|log10|pow|sinh|cosh|tanh|cbrt|hypot|random)\b/,
  /\*\*/,
  /Date\./,
  /performance\./,
  /\bimport\b.*from\s+["'](?!\.)/,
];

export interface PurityOptions {
  /** Paquets du dépôt qu'on a le droit d'importer (ex. `["@cdj/core"]`) : seule exception à l'interdit d'importer de l'extérieur. */
  allowedImports?: readonly string[];
}

/** Retire commentaires et lignes d'import d'un paquet autorisé, puis renvoie le code à scanner. */
export function scannable(source: string, allowedImports: readonly string[] = []): string {
  return source
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .filter((l) => !(/\bimport\b.*from\s+["']/.test(l) && allowedImports.some((p) => l.includes(`"${p}"`) || l.includes(`'${p}'`))))
    .join("\n");
}

/** Enregistre un test par fichier `.ts` du dossier `srcDir` : aucun des `FORBIDDEN` n'y apparaît. */
export function describePurity(label: string, srcDir: string, options: PurityOptions = {}): void {
  describe(`pureté de ${label}`, () => {
    const files = readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
    it("contient des sources à vérifier", () => {
      expect(files.length).toBeGreaterThan(0);
    });
    for (const file of files) {
      it(`${file} n'utilise aucune API non déterministe`, () => {
        const code = scannable(readFileSync(join(srcDir, file), "utf8"), options.allowedImports);
        for (const re of FORBIDDEN) expect(code, String(re)).not.toMatch(re);
      });
    }
  });
}
