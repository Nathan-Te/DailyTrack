import { BLINK_PHASE_MIN, MODULES, PHASE_REFUSED, TICK_RATE, V4_ONLY_VARIANTS, blinkPhases, buildModuleDef, moduleSolutions, variantExigence } from "../src/index";

// Lot 18 — la liste des variantes à clignotants (nuit) avec leurs durées de phase et le verdict de la règle des 1,5 s (`BLINK_PHASE_MIN`).
// Ne modifie rien : sert à décider quelles variantes sont refusées avant de rien régénérer. `npm run rythme:modules -w @cdj/jump-sim`.

const s = (ticks: number) => (ticks / TICK_RATE).toFixed(2).replace(".", ",");
const rows: string[] = ["| morceau | variante | cycle · décalage | présent | absent | note | état actuel | règle 1,5 s |", "|---|---|---|---|---|---|---|---|"];
let blinking = 0;
let refused = 0;
for (const def of MODULES) {
  for (let v = 0; v < def.variants.length; v++) {
    const built = buildModuleDef(def, v);
    const phases = blinkPhases(built.level);
    if (phases.length === 0) continue;
    blinking++;
    const c = built.level.blinkCycles.find(Boolean)!;
    const present = Math.min(...phases.map((p) => p.present));
    const absent = Math.min(...phases.map((p) => p.absent));
    const ok = present >= BLINK_PHASE_MIN && absent >= BLINK_PHASE_MIN;
    if (!ok) refused++;
    const sol = moduleSolutions(def.id, v);
    const state = PHASE_REFUSED[def.id]?.includes(v) ? "refusée (toutes phases)" : V4_ONLY_VARIANTS[def.id]?.includes(v) ? "ajoutée (v4)" : sol ? "posée" : "inutilisable";
    rows.push(`| ${def.id} | v${v} ${Object.entries(def.variants[v]!).map(([k, x]) => `${k}=${x}`).join(" ")}${(def.mutations[v] ?? []).length ? " +" + def.mutations[v]!.map((m) => m.name + (m.arg ? ":" + m.arg : "")).join("+") : ""} | ${c.cycle} · ${c.shift} | ${present} pas (${s(present)} s) | ${absent} pas (${s(absent)} s) | ${sol ? variantExigence(sol) : "—"} | ${state} | ${ok ? "ok" : "**refusée**"} |`);
  }
}
console.log(rows.join("\n"));
console.log(`\n${blinking} variantes à clignotants, ${refused} refusées par la règle (${BLINK_PHASE_MIN} pas = ${s(BLINK_PHASE_MIN)} s).`);
