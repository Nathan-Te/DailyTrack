import { readFileSync, writeFileSync } from "node:fs";
import { daysFromCivil, parseDay } from "@cdj/core";
import { PARTIES_DU_ROBOT, TICKS_PAR_SECONDE, dailyPinball, graineDuRobot, jouerRobot } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run jalons-robot:pinball -w @cdj/pinball-sim -- [--jours 30] [--du AAAA-MM-JJ] [--fils=N] [--parties 4] [--minutes 6] --sortie <fichier.json>` puis `-- --evaluer <fichier.json> <plan>...` (lot PBR1) : **le score de chaque
// partie du robot à chaque minute** (une partie coupée à D minutes est le début de la même partie plus longue : le robot est déterministe), pour comparer hors ligne des répartitions de parties (`4x6` = quatre parties de six
// minutes, `6,6,2,2` = deux longues et deux courtes) : le Diamant médian, la mission, la répartition « partie / Diamant » et le coût (minutes de jeu et pas simulés). Aucune base, aucun réseau.
interface Partie {
  /** Par minute entière : le score, la mission réussie, les pas simulés pour décider, la partie finie. */
  score: number[];
  mission: boolean[];
  pas: number[];
  finie: boolean[];
}
interface Table {
  date: string;
  theme: string;
  plan: string;
  parties: Partie[];
}
const travail = (e: { jour: number; parties: number; minutes: number }): Table => {
  const c = dailyPinball(e.jour);
  const parties: Partie[] = [];
  for (let k = 0; k < e.parties; k++) {
    const p: Partie = { score: [], mission: [], pas: [], finie: [] };
    // une partie jouée d'un trait jusqu'à la dernière minute, les jalons relevés au passage (le robot rend la main à chaque essai : on lit la partie à chaque pas)
    let prochain = TICKS_PAR_SECONDE * 60;
    const r = jouerRobot(c, graineDuRobot(k), {
      maxTicks: e.minutes * 60 * TICKS_PAR_SECONDE,
      surPas: (q) => {
        if (q.tick < prochain && !q.finie) return;
        p.score.push(q.score);
        p.mission.push(q.missionFaite || q.niveau > 1);
        p.finie.push(q.finie);
        prochain += TICKS_PAR_SECONDE * 60;
      },
      surCoup: () => undefined,
    });
    // les pas simulés par le robot jusqu'à chaque jalon ne sont pas séparés : on garde le total et on le répartit au prorata des minutes jouées (le coût du robot est à peu près proportionnel à la durée)
    for (let m = 0; m < p.score.length; m++) p.pas.push(Math.round((r.pasSimules * (m + 1)) / p.score.length));
    parties.push(p);
  }
  return { date: String(e.jour), theme: c.theme, plan: c.plan, parties };
};

const med = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const milliers = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** `4x6` ou `6,6,2,2` : les durées (minutes) des parties. */
const duree = (plan: string): number[] => (plan.includes("x") ? Array<number>(Number(plan.split("x")[0])).fill(Number(plan.split("x")[1])) : plan.split(",").map(Number));

if (enFil) repondre(travail);
else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => {
    const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
    if (i < 0) return undefined;
    return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
  };
  const ie = args.indexOf("--evaluer");
  if (ie >= 0) {
    const tables = JSON.parse(readFileSync(args[ie + 1]!, "utf8")) as Table[];
    const plans = args.slice(ie + 2);
    const at = (p: Partie, m: number): number => p.score[Math.min(m, p.score.length) - 1]!;
    const base = duree(plans[0]!);
    const diamantsBase = tables.map((t) => Math.max(...base.map((m, k) => at(t.parties[k]!, m))));
    for (const plan of plans) {
      const d = duree(plan);
      const diamants = tables.map((t) => Math.max(...d.map((m, k) => at(t.parties[k]!, m))));
      const ecarts = diamants.map((x, i) => x / diamantsBase[i]! - 1).sort((a, b) => a - b);
      const rap = tables.flatMap((t) => d.map((m, k) => at(t.parties[k]!, m) / Math.max(...d.map((m2, k2) => at(t.parties[k2]!, m2))))).sort((a, b) => a - b);
      const q = (x: number): number => Math.round(rap[Math.min(rap.length - 1, Math.floor((rap.length * x) / 100))]! * 100);
      const missions = tables.reduce((n, t) => n + d.filter((m, k) => t.parties[k]!.mission[Math.min(m, t.parties[k]!.mission.length) - 1]).length, 0);
      const tablesMission = tables.filter((t) => d.some((m, k) => t.parties[k]!.mission[Math.min(m, t.parties[k]!.mission.length) - 1])).length;
      console.log(`${plan.padEnd(10)} ${String(d.reduce((a, b) => a + b, 0)).padStart(3)} min de jeu · Diamant médian ${milliers(med(diamants)).padStart(9)} (${((med(diamants) / med(diamantsBase) - 1) * 100).toFixed(0).padStart(4)} %, table par table : médiane ${(ecarts[Math.floor(ecarts.length / 2)]! * 100).toFixed(0)} %) · partie/Diamant : 10 % ${q(10)} %, 25 % ${q(25)} %, médiane ${q(50)} % · mission ${missions}/${tables.length * d.length} parties, ${tablesMission}/${tables.length} tables`);
    }
    process.exit(0);
  }
  const du = parseDay(valeur("du") ?? "") ?? daysFromCivil(2026, 11, 2);
  const n = Number(valeur("jours") ?? 30);
  const parties = Number(valeur("parties") ?? PARTIES_DU_ROBOT);
  const minutes = Number(valeur("minutes") ?? 6);
  const entrees = Array.from({ length: n }, (_, i) => ({ jour: du + i, parties, minutes }));
  const tables = await enParallele<{ jour: number; parties: number; minutes: number }, Table>(new URL(import.meta.url), entrees, () => undefined, valeur("fils") ? Number(valeur("fils")) : undefined);
  const sortie = valeur("sortie");
  if (sortie) writeFileSync(sortie, JSON.stringify(tables));
  console.log(`${tables.length} tables, ${parties} parties de ${minutes} minutes : jalons écrits${sortie ? ` dans ${sortie}` : ""}.`);
  process.exit(0);
}
