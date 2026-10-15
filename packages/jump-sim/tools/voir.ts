import { readFileSync } from "node:fs";
import { buildModuleDef, mutationLabel, parseModule } from "../src/index";
import { flatLimit, flatsOf } from "./plats";
import { readModules } from "./files";

// Outil d'écriture (lot 7) : `node dist/voir.mjs <id|fichier.txt>…` montre chaque variante construite (mutateurs compris), ses plats sans
// défi et ce qui ne va pas. Sans argument : le résumé des plats de tout le catalogue.
const args = process.argv.slice(2);
const full = args.length > 0;
const defs = full
  ? args.map((a) => parseModule(a.endsWith(".txt") ? readFileSync(a, "utf8") : readFileSync(`modules/${a}.txt`, "utf8")))
  : readModules().map((m) => m.def);
for (const def of defs) {
  for (let v = 0; v < def.variants.length; v++) {
    const label = `${def.id} v${v} ${Object.entries(def.variants[v]!).map(([k, x]) => `${k}=${x}`).join(" ")} ${mutationLabel(def.mutations[v]!)}`;
    try {
      const m = buildModuleDef(def, v);
      const flats = flatsOf(m);
      const worst = flats[0]?.length ?? 0;
      const bad = worst > flatLimit(def.elan);
      console.log(`${label} · ${m.width}×${m.height} · plat ${worst}${bad ? " ** TROP LONG **" : ""} (${flats.slice(0, 3).map((f) => `${f.length}@${f.col},${f.row}`).join(" ")})`);
      if (full) console.log(m.ascii);
    } catch (e) {
      console.log(`${label} · ERREUR ${(e as Error).message}`);
    }
  }
}
