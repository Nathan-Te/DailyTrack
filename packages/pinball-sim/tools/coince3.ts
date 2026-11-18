// @ts-nocheck
import { billesCoincees, cleDeTable, toutesLesTables, PLANS } from "../src/index";
// outil du lot PBL2 : `coince3.mjs <plan> <thème> <dx3> <dx4> <dx5> <dy3> <dy4> <dy5>` : des tables du plan, emplacements décalés ; rend les tables où une bille se coince
const [idPlan, theme, ...d] = process.argv.slice(2);
const plan = PLANS.find((p) => p.id === idPlan);
const off = d.map(Number);
[2, 3, 4, 5].forEach((i, k) => { plan.emplacements[i].x += off[k] ?? 0; plan.emplacements[i].y += off[4 + k] ?? 0; });
const tables = toutesLesTables().filter((c) => c.plan === idPlan && c.theme === theme);
// les tables à spinners : tous les emplacements possibles en spinner, plus un échantillon
const choisies = [...tables.filter((c) => c.modules.filter((m) => m === "spinner").length >= 2).slice(0, 8), ...tables.filter((_, i) => i % Math.max(1, Math.floor(tables.length / 8)) === 0).slice(0, 8)];
let mauvaises = 0;
for (const c of choisies) { const r = billesCoincees(c); if (r.coincee) { mauvaises++; console.log("coincée", cleDeTable(c), r.coincee.x, r.coincee.y); } }
console.log(`${idPlan} ${theme} offsets ${off.join(",")} : ${mauvaises}/${choisies.length} tables avec une bille coincée`);
