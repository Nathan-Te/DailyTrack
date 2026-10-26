import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { decodeReplay, fromRuns, packRuns, parseModule, type CatalogFile, type CatalogSolution, type ModuleDef, type ModuleSolution, type ModuleSolutionsFile, type PackedCatalog, type PackedSolution } from "../src/index";

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

/**
 * Lot 20 (budget de poids) : ce que le jeu **embarque** d'un morceau est son texte **sans la ligne `intention:`** (une phrase de 100 à 150 octets par morceau,
 * 11 ko pour le catalogue, ≈ 4 ko compressés **dans chacune des deux copies** du jeu : la page et le fil du générateur). Les intentions ne servent qu'à la
 * galerie (`?modules`) : elles sont écrites à part, dans `apps/jump/public/outils/intentions.json`, que la galerie lit à la demande.
 */
export function embeddedText(text: string): string {
  return text.replace(/^intention:.*\n/m, "");
}

export const intentionsPath = () => join(packageDir(), "..", "..", "apps", "jump", "public", "outils", "intentions.json");

/**
 * Lot 21 (le catalogue hors du premier chargement) : l'**index léger** du catalogue — l'identifiant et le nombre de variantes de chaque morceau — que lit
 * `apps/jump/src/urlOptions.ts` (qui valide `?module=` et `?variante=` sans embarquer les morceaux ni leurs solutions : ≈ 100 ko de texte). Écrit avec le catalogue.
 */
export const moduleIndexPath = () => join(packageDir(), "..", "..", "apps", "jump", "src", "moduleIndex.ts");

/** Le texte de `apps/jump/src/moduleIndex.ts` : un morceau = `[identifiant, nombre de variantes]`, dans l'ordre des fichiers. */
export function moduleIndexSource(texts: readonly string[]): string {
  return [
    "// Généré par `npm run solve:modules -w @cdj/jump-sim` avec le catalogue : ne pas modifier à la main (un test vérifie qu'il est à jour).",
    "// Lot 21 : l'identifiant et le nombre de variantes de chaque morceau, de quoi lire `?module=` et `?variante=` (`urlOptions.ts`) sans charger le catalogue.",
    "",
    "export const MODULE_INDEX: readonly (readonly [id: string, variantes: number])[] = [",
    ...texts.map((t) => {
      const def = parseModule(t);
      return `  [${JSON.stringify(def.id)}, ${def.variants.length}],`;
    }),
    "];",
    "",
  ].join("\n");
}

/** Le texte de `intentions.json` : l'intention de chaque morceau, par identifiant (ordre des fichiers). */
export function intentionsSource(texts: readonly string[]): string {
  const out: Record<string, string> = {};
  for (const t of texts) {
    const def = parseModule(t);
    if (def.intention === "") throw new Error(`Morceau « ${def.id} » : « intention: » manquante`);
    out[def.id] = def.intention;
  }
  return JSON.stringify(out, null, 1) + "\n";
}

export function readSolutions(): ModuleSolutionsFile | null {
  try {
    return JSON.parse(readFileSync(solutionsPath(), "utf8")) as ModuleSolutionsFile;
  } catch {
    return null;
  }
}

/**
 * Lot 15 : ce que le jeu embarque des solutions (`CatalogFile`) : la rediffusion, ses pas et la note ; le détail reste dans `solutions.json`.
 * Lot 18 : sans l'empreinte de la grille (`grid`, 8 caractères hexadécimaux par variante, incompressibles : ≈ 1,7 ko compressés par copie, deux copies dans
 * le jeu) — personne ne la lit à l'exécution ; la péremption d'une solution se vérifie sur `solutions.json` (test `modules.test.ts`), dont le catalogue embarqué est
 * exactement la projection (test).
 */
export function catalogOf(file: ModuleSolutionsFile): CatalogFile {
  const slim = (s: ModuleSolution | null): CatalogSolution | null => (s ? { code: s.code, ticks: s.ticks, entryTick: s.entryTick, exitTick: s.exitTick, exigence: s.exigence } : null);
  const modules = Object.fromEntries(Object.entries(file.modules).map(([id, m]) => [id, { variants: m.variants.map((v) => ({ arret: slim(v.arret), elan: slim(v.elan) })) }]));
  return { jumpSimVersion: file.jumpSimVersion, exigenceVersion: file.exigenceVersion, modules };
}

/** Lot 19 : `catalogOf` sous sa forme embarquée (`PackedCatalog`) : les séries de chaque solution, ses pas d'entrée et de sortie et sa note. */
export function packCatalog(file: ModuleSolutionsFile): PackedCatalog {
  const one = (s: ModuleSolution | null): PackedSolution => (s ? [packRuns(fromRuns(decodeReplay(s.code).runs)), s.entryTick, s.exitTick, s.exigence] : 0);
  const m = Object.fromEntries(Object.entries(file.modules).map(([id, mod]) => [id, mod.variants.map((v) => [one(v.arret), one(v.elan)] as const)]));
  return { v: file.jumpSimVersion, x: file.exigenceVersion, m };
}

/** Le texte de `src/catalog.ts` pour ces morceaux et ces solutions (lot 15 : allégées, `catalogOf`). */
export function catalogSource(texts: readonly string[], solutions: ModuleSolutionsFile): string {
  return [
    "// Généré par `npm run solve:modules -w @cdj/jump-sim` à partir de `modules/*.txt` et `modules/solutions.json` : ne pas modifier à la main.",
    "// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer solve:modules »).",
    'import type { PackedCatalog } from "./modules";',
    "",
    "export const MODULE_TEXTS: readonly string[] = [",
    // `*` (ressort) écrit `\u002a` : le test de pureté refuse `**` (puissance) dans les sources de la simulation, même dans une chaîne.
    ...texts.map((t) => `  ${JSON.stringify(embeddedText(t)).replace(/\*/g, "\\u002a")},`),
    "];",
    "",
    `export const MODULE_PACKED: PackedCatalog = ${JSON.stringify(packCatalog(solutions))};`,
    "",
  ].join("\n");
}

export function writeCatalog(texts: readonly string[], solutions: ModuleSolutionsFile): void {
  writeFileSync(solutionsPath(), JSON.stringify(solutions, null, 1) + "\n");
  writeFileSync(catalogPath(), catalogSource(texts, solutions));
  writeFileSync(intentionsPath(), intentionsSource(texts));
  writeFileSync(moduleIndexPath(), moduleIndexSource(texts));
}
