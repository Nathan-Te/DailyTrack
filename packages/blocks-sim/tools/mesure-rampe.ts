import { daysFromCivil } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, RAMPE_PAR_DEFAUT, type Rampe } from "../src/index";
import { jouerGlouton } from "../src/glouton";

// `npm run mesure:rampe -w @cdj/blocks-sim -- [--graines=200] [--pente=4] [--rangmax=80]` : la durée (en pièces) des parties du glouton simple sur N jours, pour calibrer la rampe. Écrit médiane, quartiles, extrêmes.
const arg = (n: string, d: number): number => Number(process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const N = arg("graines", 200);
const rampe: Rampe = { pente: arg("pente", RAMPE_PAR_DEFAUT.pente), rangMax: arg("rangmax", RAMPE_PAR_DEFAUT.rangMax) };
const depart = daysFromCivil(2026, 11, 2);
const durees: number[] = [];
const scores: number[] = [];
for (let i = 0; i < N; i++) {
  const r = jouerGlouton(dailyBlocks(depart + i, BLOCKS_GENERATOR_VERSION, rampe)).resultat;
  durees.push(r.poses);
  scores.push(r.score);
}
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
console.log(JSON.stringify({ rampe, parties: N, pieces: { min: q(durees, 0), q1: q(durees, 25), mediane: q(durees, 50), q3: q(durees, 75), max: q(durees, 100) }, score: { mediane: q(scores, 50), max: q(scores, 100) } }));
