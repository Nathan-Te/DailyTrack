import { MODULES, MODULE_TAGS, textHash } from "../src/index";

// `npm run repos:modules -w @cdj/jump-sim -- [--groupes=7] [--ouverts=4] [--sels=20000]` — cherche le sel des groupes de repos (`REST_SALT`,
// daily.ts ; lots 5 et 7) : parmi `repos<n>:`, celui qui range le catalogue en groupes de tailles égales (à un près) et dont **chaque jour**
// (une fenêtre de `ouverts` groupes consécutifs, `isOpenGroup`) a ses étiquettes, ses enchaînements longs et ses morceaux qui finissent plus
// bas répartis (le moins d'écart possible d'une fenêtre à l'autre, jamais aucun mural, scie, respiration ni enchaînement long), et où les
// morceaux d'une même famille tombent le plus possible dans des groupes différents. Outil seulement (Node) : le résultat est recopié à la
// main dans `daily.ts`.

const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const G = arg("groupes", 7);
const K = arg("ouverts", 4);
const THEMES_ONLY = process.argv.includes("--themes");
const SALTS = THEMES_ONLY ? 0 : arg("sels", 20000);

const lower = new Set(MODULES.filter((d) => d.exitRow > d.entryRow).map((d) => d.id));
const traits: [string, (d: (typeof MODULES)[number]) => boolean][] = [
  ...MODULE_TAGS.map((t) => [t, (d: (typeof MODULES)[number]) => d.tags.includes(t)] as [string, (d: (typeof MODULES)[number]) => boolean]),
  ["long", (d) => d.long],
  ["plus bas", (d) => lower.has(d.id)],
];

function evaluate(salt: string): { spread: number; clash: number; size: number; groups: number[] } {
  const groups = MODULES.map((d) => Number.parseInt(textHash(`${salt}${d.id}`), 16) % G);
  const sizes = new Array<number>(G).fill(0);
  for (const g of groups) sizes[g]!++;
  // Les fenêtres : les groupes ouverts un jour donné (K consécutifs, toutes les positions de départ).
  const windows = Array.from({ length: G }, (_, w) => Array.from({ length: K }, (_, i) => (w + i) % G));
  let spread = 0;
  for (const [name, f] of traits) {
    const n = windows.map((win) => MODULES.filter((d, k) => win.includes(groups[k]!) && f(d)).length);
    spread += Math.max(...n) - Math.min(...n);
    if (["mural", "scie", "respiration", "long"].includes(name) && Math.min(...n) === 0) spread += 1000;
  }
  // Familles : paires de morceaux d'une même famille rangés dans le même groupe.
  let clash = 0;
  for (let a = 0; a < MODULES.length; a++) for (let b = a + 1; b < MODULES.length; b++) if (MODULES[a]!.family === MODULES[b]!.family && groups[a] === groups[b]) clash++;
  return { spread, clash, size: Math.max(...sizes) - Math.min(...sizes), groups };
}

let best: { salt: string; spread: number; clash: number; size: number; groups: number[] } | null = null;
for (let n = 0; n < SALTS; n++) {
  const salt = `repos${n}:`;
  const e = evaluate(salt);
  const key = (x: { spread: number; clash: number; size: number }) => x.size * 1e6 + x.spread * 1e3 + x.clash;
  if (!best || key(e) < key(best)) best = { salt, ...e };
}
const b = best!;
if (!THEMES_ONLY) {
console.log(`${G} groupes, ${K} ouverts par jour, ${SALTS} sels essayés : meilleur « ${b.salt} » (tailles à ${b.size} près, somme des écarts entre jours : ${b.spread}, paires d'une même famille dans un même groupe : ${b.clash})`);
for (let g = 0; g < G; g++) {
  const ids = MODULES.filter((_, k) => b.groups[k] === g);
  console.log(`groupe ${g} (${ids.length}) : ${ids.map((d) => d.id).join(", ")}`);
  console.log(`   ${traits.map(([t, f]) => `${t} ${ids.filter(f).length}`).join(" · ")}`);
}
for (let w = 0; w < G; w++) {
  const ids = MODULES.filter((_, k) => Array.from({ length: K }, (_, i) => (w + i) % G).includes(b.groups[k]!));
  console.log(`jour ouvrant ${Array.from({ length: K }, (_, i) => (w + i) % G).join(",")} (${ids.length}) : ${traits.map(([t, f]) => `${t} ${ids.filter(f).length}`).join(" · ")}`);
}
}

// ——— Lot 11 : les morceaux d'une mécanique (`theme:`) ———
// Le sel des groupes ne change pas (les niveaux des thèmes sans mécanique restent ceux d'avant) : les morceaux d'un thème sont rangés à la
// main (`THEMED_REST_GROUPS`, daily.ts) pour que les groupes gardent la même taille à un près et que **chaque jour** ouvre au moins
// `MIN_PER_DAY` morceaux (ou variantes à mutateur `surface`) de chaque mécanique : sans cela, un jour d'usine ou de glace pourrait n'avoir
// presque rien de sa mécanique. `--themes` lance la recherche (aléatoire, graine fixe) et imprime la table.
if (process.argv.includes("--themes")) {
  const { Rng } = await import("@cdj/core");
  const themed = MODULES.filter((d) => d.theme !== null);
  const base = MODULES.filter((d) => d.theme === null);
  const baseGroups = base.map((d) => Number.parseInt(textHash(`repos2527:${d.id}`), 16) % G);
  const windows = Array.from({ length: G }, (_, w) => Array.from({ length: K }, (_, i) => (w + i) % G));
  const surf = (d: (typeof MODULES)[number], what: "glace" | "tapis") => d.mutations.some((ms) => ms.some((m) => m.name === "surface" && (what === "glace" ? m.arg === "glace" : m.arg.startsWith("tapis"))));
  const MIN_PER_DAY = 3;
  const rng = new Rng(11);
  const score = (assign: number[]) => {
    const sizes = new Array<number>(G).fill(0);
    for (const g of baseGroups) sizes[g]!++;
    for (const g of assign) sizes[g]!++;
    const size = Math.max(...sizes) - Math.min(...sizes);
    let bad = 0;
    let spread = 0;
    for (const [theme, what] of [["usine", "tapis"], ["glace", "glace"]] as const) {
      const per = windows.map((win) => {
        const own = themed.filter((d, k) => d.theme === theme && win.includes(assign[k]!)).length;
        const mut = base.filter((d, k) => surf(d, what) && win.includes(baseGroups[k]!)).length;
        return own + mut;
      });
      if (Math.min(...per) < MIN_PER_DAY) bad += MIN_PER_DAY - Math.min(...per);
      spread += Math.max(...per) - Math.min(...per);
    }
    return { size, bad, spread };
  };
  let best: { assign: number[]; s: ReturnType<typeof score> } | null = null;
  for (let n = 0; n < 300000; n++) {
    const assign = themed.map(() => rng.int(G));
    const s = score(assign);
    const key = (x: ReturnType<typeof score>) => (x.size > 1 ? 1e9 : 0) + x.bad * 1e4 + x.spread;
    if (!best || key(s) < key(best.s)) best = { assign, s };
  }
  console.log(`\n${themed.length} morceaux d'une mécanique : tailles à ${best!.s.size} près, manques ${best!.s.bad}, écart ${best!.s.spread}`);
  console.log("export const THEMED_REST_GROUPS: Readonly<Record<string, number>> = {");
  themed.forEach((d, k) => console.log(`  "${d.id}": ${best!.assign[k]},`));
  console.log("};");
}
