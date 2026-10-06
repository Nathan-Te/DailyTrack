import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// La simulation ne doit utiliser aucune fonction dont le résultat peut varier selon le moteur JS,
// ni source de hasard/temps (voir CLAUDE.md).
const INTERDITS = [
  /Math\.(sin|cos|tan|asin|acos|atan|atan2|exp|expm1|log|log1p|log2|log10|pow|sinh|cosh|tanh|cbrt|hypot|random)\b/,
  /\*\*/,
  /Date\./,
  /performance\./,
  /\bimport\b.*from\s+["'](?!\.)/,
];

describe("pureté de packages/sim/src", () => {
  const dir = join(import.meta.dirname, "../src");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    it(`${file} n'utilise aucune API non déterministe`, () => {
      const code = readFileSync(join(dir, file), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      for (const re of INTERDITS) expect(code, String(re)).not.toMatch(re);
    });
  }
});
