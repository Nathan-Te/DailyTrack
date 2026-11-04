import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, FRACTIONS_MEDAILLES, seuilsDepuis } from "../src/index";
import { jouerDiamant } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";

// `npm run calibrer:medailles -w @cdj/blocks-sim -- [--graines=1000]` : le calibrage des médailles (lot B3). Sur N jours, le score du Diamant et celui du glouton ; la part du Diamant que fait le glouton (quantiles) d'où
// se déduisent les fractions ; puis, pour les fractions en vigueur (`FRACTIONS_MEDAILLES`), la part des jours où le glouton obtient chaque médaille. Cibles : bronze ≈ médiane du glouton, argent ≈ 3ᵉ quartile, or à mi-chemin entre l'argent et le Diamant.
const N = Number(process.argv.find((a) => a.startsWith("--graines="))?.slice(10) ?? 1000);
const depart = daysFromCivil(2026, 11, 2);
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const ratios: number[] = [];
const rangs = { author: 0, gold: 0, silver: 0, bronze: 0, aucune: 0 };
const diamants: number[] = [];
for (let i = 0; i < N; i++) {
  const c = dailyBlocks(depart + i);
  const d = jouerDiamant(c).resultat.score;
  const g = jouerGlouton(c).resultat.score;
  diamants.push(d);
  ratios.push((100 * g) / d);
  const s = seuilsDepuis(d);
  rangs[g >= s.author ? "author" : g >= s.gold ? "gold" : g >= s.silver ? "silver" : g >= s.bronze ? "bronze" : "aucune"]++;
}
const med = q(ratios, 50);
const q3 = q(ratios, 75);
console.log(JSON.stringify({ jours: N, diamant: { min: q(diamants, 0), q1: q(diamants, 25), mediane: q(diamants, 50), q3: q(diamants, 75), max: q(diamants, 100) }, partDuDiamantFaiteParLeGlouton: { q1: +q(ratios, 25).toFixed(1), mediane: +med.toFixed(1), q3: +q3.toFixed(1) }, fractionsProposees: { bronze: Math.round(med), argent: Math.round(q3), or: Math.round((q3 + 100) / 2) }, fractionsEnVigueur: FRACTIONS_MEDAILLES }));
const obtient = (m: keyof typeof rangs): number => Math.round((1000 * (m === "author" ? rangs.author : m === "gold" ? rangs.author + rangs.gold : m === "silver" ? rangs.author + rangs.gold + rangs.silver : rangs.author + rangs.gold + rangs.silver + rangs.bronze)) / N) / 10;
console.log(JSON.stringify({ gloutonObtient_pourcent: { diamant: obtient("author"), or: obtient("gold"), argent: obtient("silver"), bronze: obtient("bronze") } }));
