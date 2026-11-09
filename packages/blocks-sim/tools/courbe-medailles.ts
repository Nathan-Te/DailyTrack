import { dailyBlocks, Partie } from "../src/index";
import { LARGEUR_FAISCEAU, planDuDiamant } from "../src/diamant";
import { coupGlouton } from "../src/glouton";
import { arg, nombre, premierJour } from "./aide";

// `npm run courbe:medailles -w @cdj/blocks-sim -- [--graines=1000] [--du=AAAA-MM-JJ] [--moyen=20,30,…] [--fort=60,90,…]` (lot B8c) : la médiane du score d'un bot (moyen, fort) aux nombres de pièces donnés, sur N jours, et la part
// des jours où il est mort avant. Sert à CHOISIR les nombres de pièces de `BOTS_DE_REFERENCE` (rapports entre médailles de 1,5 à 2,5) ; `calibrer:medailles` mesure ensuite ceux qu'on a choisis.
const N = nombre("graines", 1000);
const depart = premierJour();
const liste = (n: string, d: string): number[] => (arg(n) ?? d).split(",").map(Number);
const nM = liste("moyen", "20,30,36,40,45,50,60,75");
const nF = liste("fort", "45,60,75,90,105,120,150,180");
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const bilan = (nombres: number[], scores: Record<number, number[]>, morts: Record<number, number>) => Object.fromEntries(nombres.map((n) => [n, { mediane: q(scores[n]!, 50), q1: q(scores[n]!, 25), q3: q(scores[n]!, 75), mortPct: +((100 * morts[n]!) / N).toFixed(1) }]));
const sM: Record<number, number[]> = Object.fromEntries(nM.map((n) => [n, []]));
const sF: Record<number, number[]> = Object.fromEntries(nF.map((n) => [n, []]));
const mM: Record<number, number> = Object.fromEntries(nM.map((n) => [n, 0]));
const mF: Record<number, number> = Object.fromEntries(nF.map((n) => [n, 0]));
for (let i = 0; i < N; i++) {
  const c = dailyBlocks(depart + i);
  const pm = new Partie(c);
  const vuM = new Set<number>();
  while (!pm.finie) {
    const a = coupGlouton(pm)!;
    pm.poser(a.emplacement, a.col, a.ligne);
    for (const n of nM) if (!vuM.has(n) && pm.poses >= n) (vuM.add(n), sM[n]!.push(pm.score));
  }
  for (const n of nM) if (!vuM.has(n)) (sM[n]!.push(pm.score), mM[n]!++);
  const pf = new Partie(c);
  const vuF = new Set<number>();
  while (!pf.finie) {
    for (const a of planDuDiamant(pf, LARGEUR_FAISCEAU)) {
      pf.jouerAction(a);
      for (const n of nF) if (!vuF.has(n) && pf.poses >= n) (vuF.add(n), sF[n]!.push(pf.score));
      if (pf.poses >= 400) break;
    }
    if (pf.poses >= 400) break;
  }
  for (const n of nF) if (!vuF.has(n)) (sF[n]!.push(pf.score), mF[n]!++);
}
console.log(JSON.stringify({ jours: N, moyen: bilan(nM, sM, mM), fort: bilan(nF, sF, mF) }, null, 1));
