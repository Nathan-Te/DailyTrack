import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { UNITS_PER_TILE, bladeEnvelopes, bladeRoomProblems, buildModuleDef, tightestLine, variantTheme, variantUsable } from "../src/index";
import { packageDir, readModules } from "./files";

/** Le texte de `src/lameTable.ts` : les variantes (par morceau) qui ne tiennent pas la règle, d'après les textes des morceaux. */
export function lameTableSource(): string {
  const out: Record<string, number[]> = {};
  for (const { def } of readModules()) {
    for (let v = 0; v < def.variants.length; v++) {
      const saws = def.tags.includes("scie") || (def.mutations[v] ?? []).some((m) => m.name === "patrouille");
      if (saws && bladeRoomProblems(buildModuleDef(def, v).level).length > 0) (out[def.id] ??= []).push(v);
    }
  }
  return [
    "// Généré par `npm run lame:modules -w @cdj/jump-sim -- --ecrire` (lot 31) d'après les textes des morceaux : ne pas modifier à la main.",
    "// Un test vérifie que ce fichier est exactement celui que l'outil écrirait (sinon : relancer la commande).",
    "",
    "/** Lot 31 : les variantes dont une scie mobile ne laisse pas 2 tuiles libres entre la lame et la paroi d'une cheminée (`lame.ts`) : le générateur g25 ne les pose jamais. */",
    `export const BLADE_TIGHT: Readonly<Record<string, readonly number[]>> = ${JSON.stringify(out)};`,
    "",
  ].join("\n");
}
export const lameTablePath = () => join(packageDir(), "src", "lameTable.ts");


// `npm run lame:modules -w @cdj/jump-sim` (lot 31) — la **place autour de la lame** de chaque variante à scie mobile du catalogue : pour chaque scie, la rangée de sa course qui laisse le moins
// de place entre l'enveloppe balayée et une paroi (la plus grande des deux places libres), et le verdict de la règle (`bladeRoomProblems`, `BLADE_ROOM_TILES` tuiles). Outil de lecture : ne
// modifie rien. `--tout` : aussi les variantes que le solveur n'utilise pas ; `--etroites` : seulement les variantes qui ne tiennent pas la règle.
if (process.argv[1]?.endsWith("lame.mjs")) {
  if (process.argv.includes("--ecrire")) {
    writeFileSync(lameTablePath(), lameTableSource());
    console.log("Écrit : src/lameTable.ts");
    process.exit(0);
  }
  const tout = process.argv.includes("--tout");
  const etroites = process.argv.includes("--etroites");
  // `--portes` : lit aussi l'axe en travers (la scie qui barre un puits d'une paroi à l'autre : une porte qu'on passe au bon moment, que la règle ne demande pas de contourner).
  const portes = process.argv.includes("--portes");
  let n = 0;
  let refusees = 0;
  for (const { def } of readModules()) {
    for (let v = 0; v < def.variants.length; v++) {
      const usable = variantUsable(def.id, v);
      if (!usable && !tout) continue;
      const level = buildModuleDef(def, v).level;
      const envs = bladeEnvelopes(level);
      if (envs.length === 0) continue;
      n++;
      const problems = portes ? envs.filter((e) => { const t = tightestLine(level, e, "x"); return t !== null && t.room < 2 * UNITS_PER_TILE; }).map((e) => e.id) : bladeRoomProblems(level);
      if (problems.length > 0) refusees++;
      if (etroites && problems.length === 0) continue;
      const info = envs.map((e) => {
        const t = tightestLine(level, e, portes ? "x" : undefined);
        return t ? `${e.id}: ${t.axis === "x" ? "rangée" : "colonne"} ${t.at} libre ${(t.before / UNITS_PER_TILE).toFixed(2)} | ${(t.after / UNITS_PER_TILE).toFixed(2)}` : `${e.id}: air libre`;
      });
      console.log(`${problems.length > 0 ? "REFUSÉE" : "ok     "} ${def.id} v${v} [${variantTheme(def, v) ?? "-"}]${usable ? "" : " (non utilisable)"} ${info.join(" ; ")}`);
    }
  }
  console.log(`\n${n} variantes à scie mobile, ${refusees} qui ne tiennent pas la règle.`);
}
