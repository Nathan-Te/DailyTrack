import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { VARIETY_DAYS, VARIETY_ORIGIN } from "../src/index";
import { formatDay, parseDay } from "@cdj/core";
import { packageDir } from "./files";

// `npm run figes:jump -w @cdj/jump-sim` (lot 20) — **les jours figés que la règle de variété lit avec leur contenu réel** (`VARIETY_FROZEN`, `daily.ts`) ne sont
// plus une table tenue à la main : cet outil la déduit des fichiers de `apps/jump/public/levels/` (les morceaux de base de chaque jour **d'avant**
// `VARIETY_ORIGIN` à moins de `VARIETY_DAYS` jours, les seuls que la règle regarde ; le poids de Jump est compté) et écrit `src/figes.ts` (généré, à commiter). Un test (`test/variete.test.ts`) vérifie que le fichier est
// exactement celui que l'outil écrirait, et que chaque jour de la jonction est présent : si les jours figés d'avant l'origine changent (ils ne changent
// jamais, ni ne s'ajoutent après elle), ou si `VARIETY_ORIGIN` bouge, relancer l'outil. `--verifier` : n'écrit rien, échoue si le fichier n'est pas à jour.
// La chaîne de figeage (`scripts/`, `freeze:days`, le robot) n'est pas touchée : les jours d'après l'origine sont calculés, jamais lus.

export function levelsDir(): string {
  return resolve(packageDir(), "../../apps/jump/public/levels");
}

export function figesPath(): string {
  return join(packageDir(), "src", "figes.ts");
}

/** Les morceaux de base de chaque jour figé d'avant `VARIETY_ORIGIN` que la règle lit (à moins de `VARIETY_DAYS` jours de l'origine), par date. */
export function frozenBaseIds(dir = levelsDir()): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const file of readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
    const date = file.slice(0, 10);
    const day = parseDay(date);
    if (day === null || day >= VARIETY_ORIGIN || day < VARIETY_ORIGIN - (VARIETY_DAYS - 1)) continue;
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as { morceaux?: { id: string }[] };
    if (!Array.isArray(raw.morceaux)) throw new Error(`${file} : pas de morceaux`);
    out[formatDay(day)] = raw.morceaux.map((m) => m.id);
  }
  return out;
}

/** Le texte de `src/figes.ts` pour ces jours. */
export function figesSource(days: Readonly<Record<string, readonly string[]>>): string {
  return [
    "// Généré par `npm run figes:jump -w @cdj/jump-sim` à partir de `apps/jump/public/levels/*.json` : ne pas modifier à la main (lot 20).",
    "// Les morceaux de base de chaque jour figé d'avant `VARIETY_ORIGIN` : la règle de variété (`daily.ts`) les lit avec leur contenu réel. Un test vérifie que ce",
    "// fichier est exactement celui que l'outil écrirait (sinon : relancer `figes:jump`).",
    "",
    "export const FROZEN_BASE_IDS: Readonly<Record<string, readonly string[]>> = {",
    ...Object.entries(days).map(([date, ids]) => `  ${JSON.stringify(date)}: ${JSON.stringify(ids)},`),
    "};",
    "",
  ].join("\n");
}

if (process.argv[1]?.endsWith("figes.mjs")) {
  const text = figesSource(frozenBaseIds());
  if (process.argv.includes("--verifier")) {
    if (readFileSync(figesPath(), "utf8") !== text) {
      console.error("src/figes.ts n'est pas à jour : relancer `npm run figes:jump -w @cdj/jump-sim`.");
      process.exit(1);
    }
    console.log("src/figes.ts est à jour.");
  } else {
    writeFileSync(figesPath(), text);
    console.log(`Écrit : src/figes.ts (${Object.keys(frozenBaseIds()).length} jours d'avant le ${formatDay(VARIETY_ORIGIN)}).`);
  }
}
