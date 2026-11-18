import { readFileSync, writeFileSync } from "node:fs";
import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, PINBALL_BOT_VERSION, cleDeTable, dailyPinball, graineDuRobot, jouerRobot, seuilsDesScores, toutesLesTables, type Contenu } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run mesure-robot:pinball -w @cdj/pinball-sim -- [--jours 30] [--du AAAA-MM-JJ] [--tables] [--fils=N] --sortie <fichier.json>` (lot PBR1) : **ce que coûte le robot des seuils et ce qu'il rapporte**, table par table, sur
// 30 jours (`--tables` : les 500 tables que le générateur peut tirer, pour comparer deux versions du robot partout) : le temps des 4 parties (le calcul des seuils seul, sans la validation), les pas que le robot simule pour décider, les scores, les missions, le Diamant. Le fichier JSON sert à comparer deux versions du robot :
// `-- --comparer avant.json apres.json` (Diamant médian, répartition « partie du robot / Diamant », mission, temps). Aucune base, aucun réseau. Les temps dépendent de la machine ; les pas, non.
interface Ligne {
  date: string;
  cle: string;
  theme: string;
  plan: string;
  scores: number[];
  ticks: number[];
  missions: boolean[];
  /** Les pas simulés par le robot pour décider, toutes parties. */
  pas: number;
  secondes: number;
  diamant: number;
}
const travail = (e: number | Contenu): Ligne => {
  const c = typeof e === "number" ? dailyPinball(e) : e;
  const scores: number[] = [];
  const ticks: number[] = [];
  const missions: boolean[] = [];
  let pas = 0;
  const t0 = performance.now();
  for (let k = 0; k < PARTIES_DU_ROBOT; k++) {
    const r = jouerRobot(c, graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT });
    scores.push(r.partie.score);
    ticks.push(r.partie.tick);
    missions.push(r.partie.missionFaite || r.partie.niveau > 1);
    pas += r.pasSimules;
  }
  const secondes = (performance.now() - t0) / 1000;
  return { date: typeof e === "number" ? formatDay(e) : "", cle: cleDeTable(c), theme: c.theme, plan: c.plan, scores, ticks, missions, pas, secondes, diamant: seuilsDesScores(scores).author };
};

const med = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const moy = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
const milliers = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function resume(nom: string, l: Ligne[]): string {
  const s = l.map((x) => x.secondes).sort((a, b) => a - b);
  const pas = l.map((x) => x.pas);
  const rap = l.flatMap((x) => x.scores.map((y) => y / Math.max(...x.scores))).sort((a, b) => a - b);
  const q = (p: number): number => Math.round(rap[Math.min(rap.length - 1, Math.floor((rap.length * p) / 100))]! * 100);
  const missions = l.reduce((a, x) => a + x.missions.filter(Boolean).length, 0);
  return [
    `${nom} : ${l.length} tables`,
    `  temps (les ${PARTIES_DU_ROBOT} parties) : moyenne ${moy(s).toFixed(1)} s, médiane ${med(s).toFixed(1)} s, pire ${s[s.length - 1]!.toFixed(1)} s`,
    `  pas simulés pour décider : moyenne ${milliers(moy(pas))}, pire ${milliers(Math.max(...pas))}`,
    `  Diamant : médian ${milliers(med(l.map((x) => x.diamant)))}, min ${milliers(Math.min(...l.map((x) => x.diamant)))}, max ${milliers(Math.max(...l.map((x) => x.diamant)))}`,
    `  partie du robot / Diamant : min ${q(0)} %, 10 % ${q(10)} %, 25 % ${q(25)} %, médiane ${q(50)} %, 75 % ${q(75)} %`,
    `  mission réussie : ${missions}/${l.length * PARTIES_DU_ROBOT} parties, ${l.filter((x) => x.missions.some(Boolean)).length}/${l.length} tables`,
  ].join("\n");
}

if (enFil) repondre(travail);
else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => {
    const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
    if (i < 0) return undefined;
    return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
  };
  const ic = args.indexOf("--comparer");
  if (ic >= 0) {
    const a = JSON.parse(readFileSync(args[ic + 1]!, "utf8")) as { bot: number; lignes: Ligne[] };
    const b = JSON.parse(readFileSync(args[ic + 2]!, "utf8")) as { bot: number; lignes: Ligne[] };
    console.log(resume(`avant (bot ${a.bot})`, a.lignes));
    console.log(resume(`après (bot ${b.bot})`, b.lignes));
    const memesCles = a.lignes.every((x, i) => x.cle === b.lignes[i]!.cle);
    if (!memesCles) throw new Error("les deux fichiers ne portent pas les mêmes tables");
    const memes = a.lignes.filter((x, i) => JSON.stringify(x.scores) === JSON.stringify(b.lignes[i]!.scores)).length;
    console.log(`\nTables dont les ${PARTIES_DU_ROBOT} scores sont exactement les mêmes : ${memes}/${a.lignes.length} (parties : ${a.lignes.reduce((n, x, i) => n + x.scores.filter((y, k) => y === b.lignes[i]!.scores[k]).length, 0)}/${a.lignes.length * PARTIES_DU_ROBOT})`);
    const ecarts = a.lignes.map((x, i) => (b.lignes[i]!.diamant - x.diamant) / x.diamant).sort((p, q) => p - q);
    const abs = ecarts.map(Math.abs).sort((p, q) => p - q);
    console.log(`\nDiamant, table par table (après / avant − 1) : médiane ${(ecarts[Math.floor(ecarts.length / 2)]! * 100).toFixed(1)} %, écart absolu médian ${(abs[Math.floor(abs.length / 2)]! * 100).toFixed(1)} %, pire ${(abs[abs.length - 1]! * 100).toFixed(1)} %`);
    console.log(`Diamant médian : ${milliers(med(a.lignes.map((x) => x.diamant)))} → ${milliers(med(b.lignes.map((x) => x.diamant)))} (${((med(b.lignes.map((x) => x.diamant)) / med(a.lignes.map((x) => x.diamant)) - 1) * 100).toFixed(1)} %)`);
    for (const t of [...new Set(a.lignes.map((x) => x.theme))].sort()) {
      const ia = a.lignes.filter((x) => x.theme === t);
      const ib = b.lignes.filter((x) => x.theme === t);
      console.log(`  ${t.padEnd(7)} ${ia.length} jours · Diamant médian ${milliers(med(ia.map((x) => x.diamant)))} → ${milliers(med(ib.map((x) => x.diamant)))} · temps moyen ${moy(ia.map((x) => x.secondes)).toFixed(1)} → ${moy(ib.map((x) => x.secondes)).toFixed(1)} s`);
    }
    process.exit(0);
  }
  const du = parseDay(valeur("du") ?? "") ?? daysFromCivil(2026, 11, 2);
  const n = Number(valeur("jours") ?? 30);
  const jours: (number | Contenu)[] = args.includes("--tables") ? toutesLesTables() : Array.from({ length: n }, (_, i) => du + i);
  const t0 = performance.now();
  const lignes = await enParallele<number | Contenu, Ligne>(new URL(import.meta.url), jours, () => undefined, valeur("fils") ? Number(valeur("fils")) : undefined);
  console.log(resume(`bot ${PINBALL_BOT_VERSION}`, lignes));
  console.log(`(${((performance.now() - t0) / 1000).toFixed(0)} s en tout, ${valeur("fils") ?? "un fil par cœur"})`);
  const sortie = valeur("sortie");
  if (sortie) writeFileSync(sortie, JSON.stringify({ bot: PINBALL_BOT_VERSION, lignes }));
  process.exit(0);
}
