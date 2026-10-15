import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseModule, type ModuleDef, type ModuleSolutionsFile } from "../src/index";

// Fichiers du catalogue (lot 4) : les morceaux (`modules/<id>.txt`), leurs solutions (`modules/solutions.json`) et le fichier généré que
// lit la simulation (`src/catalog.ts`). Outils seulement (Node).

/** Dossier du paquet `@cdj/jump-sim` (les scripts tournent depuis lui : `npm run … -w @cdj/jump-sim`). */
export function packageDir(): string {
  const here = process.cwd();
  if (existsSync(join(here, "modules")) && existsSync(join(here, "src", "modules.ts"))) return here;
  const nested = resolve(here, "packages/jump-sim");
  if (existsSync(join(nested, "modules"))) return nested;
  throw new Error("Lancer depuis packages/jump-sim (npm run solve:modules -w @cdj/jump-sim)");
}

export const modulesDir = () => join(packageDir(), "modules");
export const solutionsPath = () => join(modulesDir(), "solutions.json");
export const catalogPath = () => join(packageDir(), "src", "catalog.ts");

/** Les morceaux, dans l'ordre alphabétique des fichiers ; l'id doit être le nom du fichier. */
export function readModules(): { file: string; text: string; def: ModuleDef }[] {
  const dir = modulesDir();
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const def = parseModule(text);
      if (`${def.id}.txt` !== file) throw new Error(`${file} : l'id « ${def.id} » doit être le nom du fichier`);
      return { file, text, def };
    });
}

export function readSolutions(): ModuleSolutionsFile | null {
  try {
    return JSON.parse(readFileSync(solutionsPath(), "utf8")) as ModuleSolutionsFile;
  } catch {
    return null;
  }
}

/** Le texte de `src/catalog.ts` pour ces morceaux et ces solutions. */
export function catalogSource(texts: readonly string[], solutions: ModuleSolutionsFile): string {
  return [
    "// Généré par `npm run solve:modules -w @cdj/jump-sim` à partir de `modules/*.txt` et `modules/solutions.json` : ne pas modifier à la main.",
    "// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer solve:modules »).",
    'import type { ModuleSolutionsFile } from "./modules";',
    "",
    "export const MODULE_TEXTS: readonly string[] = [",
    // `*` (ressort) écrit `\u002a` : le test de pureté refuse `**` (puissance) dans les sources de la simulation, même dans une chaîne.
    ...texts.map((t) => `  ${JSON.stringify(t).replace(/\*/g, "\\u002a")},`),
    "];",
    "",
    `export const MODULE_SOLUTIONS: ModuleSolutionsFile = ${JSON.stringify(solutions)};`,
    "",
  ].join("\n");
}

export function writeCatalog(texts: readonly string[], solutions: ModuleSolutionsFile): void {
  writeFileSync(solutionsPath(), JSON.stringify(solutions, null, 1) + "\n");
  writeFileSync(catalogPath(), catalogSource(texts, solutions));
}
