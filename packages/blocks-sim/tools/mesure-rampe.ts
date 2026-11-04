import { daysFromCivil } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, PIECES, RAMPE_PAR_DEFAUT, type Rampe } from "../src/index";
import { jouerDiamant, POIDS_DIAMANT } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";

// `npm run mesure:rampe -w @cdj/blocks-sim -- [--graines=200] [--pente=4] [--rangmax=80] [--bot=glouton|diamant|les-deux] [--poids=<json>] [--poidsbase=<json>]` : la durée (en pièces) et le score des parties du glouton
// simple et du bot Diamant sur N jours, pour calibrer la rampe et les médailles. Écrit minimum, quartiles, médiane, maximum, la part des jours où le bot meurt avant 25 pièces, et le temps du Diamant (ms par partie).
const arg = (n: string, d: number): number => Number(process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const choix = process.argv.find((a) => a.startsWith("--bot="))?.slice(6) ?? "les-deux";
// `--poids='{"isolees":-50}'` essaie d'autres poids du Diamant le temps de la mesure (réglage ; rien n'est écrit).
const poids = process.argv.find((a) => a.startsWith("--poids="))?.slice(8);
if (poids) Object.assign(POIDS_DIAMANT, JSON.parse(poids));
// `--poidsbase='{"coin":14,"l":4}'` essaie d'autres poids de base du tirage (par nom de forme : domino, barre3, barre4, barre5, carre2, carre3, coin, l, grandl, t, grandt, s, z, rect) ; réglage seulement, rien n'est écrit.
const poidsBase = process.argv.find((a) => a.startsWith("--poidsbase="))?.slice(12);
if (poidsBase) {
  const base = JSON.parse(poidsBase) as Record<string, number>;
  for (const p of PIECES) {
    const k = p.nom.split("-")[0]!;
    if (k in base) (p as { poids: number }).poids = base[k]!;
  }
}
const N = arg("graines", 200);
const rampe: Rampe = { pente: arg("pente", RAMPE_PAR_DEFAUT.pente), rangMax: arg("rangmax", RAMPE_PAR_DEFAUT.rangMax) };
const depart = daysFromCivil(2026, 11, 2);
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const resume = (a: number[]) => ({ min: q(a, 0), q1: q(a, 25), mediane: q(a, 50), q3: q(a, 75), max: q(a, 100) });

function mesurer(nom: string, jouer: typeof jouerGlouton): void {
  const durees: number[] = [];
  const scores: number[] = [];
  const temps: number[] = [];
  for (let i = 0; i < N; i++) {
    const contenu = dailyBlocks(depart + i, BLOCKS_GENERATOR_VERSION, rampe);
    const t0 = performance.now();
    const r = jouer(contenu).resultat;
    temps.push(performance.now() - t0);
    durees.push(r.poses);
    scores.push(r.score);
  }
  console.log(JSON.stringify({ bot: nom, rampe, parties: N, ...(poids ? { poids: POIDS_DIAMANT } : {}), ...(poidsBase ? { poidsBase: JSON.parse(poidsBase) } : {}), pieces: resume(durees), score: resume(scores), avant25: durees.filter((d) => d < 25).length, ms: { mediane: +q(temps, 50).toFixed(1), pire: +q(temps, 100).toFixed(1) } }));
}
if (choix !== "diamant") mesurer("glouton", jouerGlouton);
if (choix !== "glouton") mesurer("diamant", jouerDiamant);
