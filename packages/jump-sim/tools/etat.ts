// `npm run etat:modules -w @cdj/jump-sim` — outil d'écriture (lot 8c) : par morceau, ses variantes utilisables (trois solutions, exigence
// ≥ 1) et non banales (`banal.ts`), et ce qui manque à chacune (entrée sans solution, au pas près, raccord sous 90 %).
import { MODULES, MODULE_ENTRIES, moduleSolutions, variantExigence } from "../src/index";
import { banalReasons } from "./banal";
let usable = 0;
let total = 0;
for (const def of MODULES) {
  const parts: string[] = [];
  let ok = 0;
  def.variants.forEach((_, v) => {
    total++;
    const s = moduleSolutions(def.id, v);
    const ex = variantExigence(s);
    const bad = MODULE_ENTRIES.filter((e) => !s?.[e] || s[e]!.exigence === 0).map((e) => (s?.[e] ? `${e}:0(g${s[e]!.gigue[0] / 10}/r${s[e]!.raccord === null ? "-" : s[e]!.raccord! / 10})` : `${e}:∅`));
    const banal = banalReasons(def, v).length > 0;
    if (ex >= 1 && !banal) ok++;
    parts.push(`v${v}=${ex}${banal ? "B" : ""}${bad.length ? `[${bad.join(",")}]` : ""}`);
  });
  usable += ok;
  console.log(`${ok === 0 ? "!!" : ok < 2 ? "! " : "  "} ${def.id.padEnd(20)} ${ok}/${def.variants.length}  ${parts.join(" ")}`);
}
console.log(`utilisables et non banales : ${usable}/${total}`);
