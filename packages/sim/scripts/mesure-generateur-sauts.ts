// Lot 57b (Track) : ce que le générateur donne, thème par thème — présence des figures nouvelles (lots 57 et 58), sauts « droite → tremplin → axe », sauts de
// même combinaison, durée d'auteur, tentative retenue, temps de génération. Hors CI (quelques minutes) :
//   npx esbuild packages/sim/scripts/mesure-generateur-sauts.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/cdj/mesure-gen-sauts.mjs && node node_modules/.cache/cdj/mesure-gen-sauts.mjs [--version 22] [--par-theme 60] [--json sortie.json]
// Les jours sont les `--par-theme` premiers jours de chaque thème à partir du premier jour que le registre ne fige pas, le thème de chaque jour étant celui de la version demandée.
import { writeFileSync } from "node:fs";
import {
  GENERATOR_VERSION, THEME_NAMES, classerSauts, combinaison, dailyCircuit, figureByName, formatDay, parseDay, resumeRegistreTrack, sautDansLAxe, themeForDay, parseTrack,
  type ThemeName,
} from "../src/index";
import { elementGrammaire } from "../src/grammaire";

const argv = process.argv.slice(2);
const opt = (nom: string): string | undefined => {
  const i = argv.indexOf(`--${nom}`);
  return i < 0 ? undefined : argv[i + 1];
};
const VERSION = Number(opt("version") ?? GENERATOR_VERSION);
const PAR_THEME = Number(opt("par-theme") ?? 60);
const JSON_OUT = opt("json");
const DEPUIS = parseDay(opt("depuis") ?? resumeRegistreTrack().jusqua)! + 1;

const jours = new Map<ThemeName, number[]>(THEME_NAMES.map((t) => [t, []]));
for (let d = DEPUIS; [...jours.values()].some((l) => l.length < PAR_THEME); d++) {
  const l = jours.get(themeForDay(d, VERSION).name)!;
  if (l.length < PAR_THEME) l.push(d);
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const rows: Record<string, unknown>[] = [];
const out: string[] = [];
const total = { n: 0, ms: 0, max: 0, axe: 0, sauts: 0, axeMax: 0, doublons: 0, nouveau: 0, secours: 0 };
for (const theme of THEME_NAMES) {
  const days = jours.get(theme)!;
  let nouveau = 0;
  let nouveau57 = 0;
  let nouveau58 = 0;
  let secours = 0;
  let doublons = 0;
  let axe = 0;
  let sauts = 0;
  let axeMax = 0;
  let circuitsAxe2 = 0;
  const ms: number[] = [];
  const dur: number[] = [];
  for (const d of days) {
    const t0 = performance.now();
    const c = dailyCircuit(d, 0, null, VERSION);
    const t = performance.now() - t0;
    ms.push(t);
    dur.push(c.authorMs);
    if (c.fallback) secours++;
    const noms = c.figures.map((f) => f.name);
    const is57 = noms.some((n) => !!elementGrammaire(n));
    const is58 = noms.some((n) => !!figureByName(n)?.bloc);
    if (is57 || is58) nouveau++;
    if (is57) nouveau57++;
    if (is58) nouveau58++;
    const cl = c.fallback ? [] : classerSauts(parseTrack("m", c.spec));
    sauts += cl.length;
    const a = cl.filter(sautDansLAxe).length;
    axe += a;
    axeMax = Math.max(axeMax, a);
    if (a > 1) circuitsAxe2++;
    const cles = cl.map(combinaison);
    doublons += cles.length - new Set(cles).size;
    rows.push({ jour: formatDay(d), theme, ms: Math.round(t), authorMs: c.authorMs, attempt: c.attempt, fallback: c.fallback, figures: noms, axe: a, sauts: cl.length });
  }
  const n = days.length;
  out.push(
    `${theme.padEnd(9)} n=${n} présence ${(100 * nouveau / n).toFixed(0)} % (57: ${(100 * nouveau57 / n).toFixed(0)}, 58: ${(100 * nouveau58 / n).toFixed(0)}) | secours ${secours} | durée ${(mean(dur) / 1000).toFixed(1)} s (${(Math.min(...dur) / 1000).toFixed(1)}–${(Math.max(...dur) / 1000).toFixed(1)}) | sauts ${(sauts / n).toFixed(2)}/circ, axe ${axe} (${sauts ? (100 * axe / sauts).toFixed(0) : 0} %), >1 axe: ${circuitsAxe2} | doublons ${doublons} | gen ${mean(ms).toFixed(0)} ms (max ${Math.max(...ms).toFixed(0)})`,
  );
  total.n += n; total.ms += ms.reduce((x, y) => x + y, 0); total.max = Math.max(total.max, ...ms); total.axe += axe; total.sauts += sauts; total.axeMax = Math.max(total.axeMax, axeMax); total.doublons += doublons; total.nouveau += nouveau; total.secours += secours;
}
out.push(`TOTAL v${VERSION} n=${total.n} gen moyen ${(total.ms / total.n).toFixed(0)} ms, pire ${total.max.toFixed(0)} ms | présence ${(100 * total.nouveau / total.n).toFixed(0)} % | secours ${total.secours} | sauts ${total.sauts} dont axe ${total.axe} (${(100 * total.axe / Math.max(1, total.sauts)).toFixed(0)} %) | doublons ${total.doublons}`);
console.log(out.join("\n"));
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(rows));
