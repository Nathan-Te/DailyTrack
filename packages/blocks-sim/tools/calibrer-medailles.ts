import { daysFromCivil } from "@cdj/core";
import { arrondir, BOTS_DE_REFERENCE, dailyBlocks, Partie, PLAFOND_PIECES, SEUILS_MEDAILLES, TAILLE_SERIE } from "../src/index";
import { LARGEUR_FAISCEAU, planDuDiamant } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";

// `npm run calibrer:medailles -w @cdj/blocks-sim -- [--graines=1000] [--du=2026-11-02]` : le calibrage des médailles (lot B8b, seed § 5). Chaque seuil est le score d'un bot de référence ARRÊTÉ APRÈS UN NOMBRE FIXE DE PIÈCES
// (`BOTS_DE_REFERENCE` : bronze = bot moyen à 45 pièces, argent = moyen à 90, or = fort à 150, Diamant = fort à 240 ; s'il meurt avant, son score final), en médiane sur N jours, arrondie. L'outil écrit
//   1. pour chaque médaille : le score du bot de référence (minimum, quartiles, médiane, maximum), la part des jours où il meurt avant son nombre de pièces, la variation d'un jour à l'autre (part des jours hors de ±25 % de
//      la médiane), la valeur PROPOSÉE (médiane arrondie) et celle EN VIGUEUR (`SEUILS_MEDAILLES`) ;
//   2. les contrôles de bon sens : les rapports argent / bronze, or / argent, Diamant / or (cible : entre 1,5 et 2,5) ; le bot moyen à 30 pièces (une première partie hésitante) rapporté au bronze ; la part des jours où le bot
//      fort, joué sans arrêt, dépasse le Diamant (cible : presque toujours).
const arg = (n: string, d: string): string => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const N = Number(arg("graines", "1000"));
const du = arg("du", "2026-11-02");
const depart = daysFromCivil(Number(du.slice(0, 4)), Number(du.slice(5, 7)), Number(du.slice(8, 10)));
const q = (a: readonly number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const resume = (a: readonly number[]) => ({ min: q(a, 0), q1: q(a, 25), mediane: q(a, 50), q3: q(a, 75), max: q(a, 100) });

// Pour chaque bot, les scores aux nombres de pièces voulus (ceux de `BOTS_DE_REFERENCE`, plus 30 pour le bot moyen) ; un bot mort avant garde son score final. Le bot fort ne planifie que série par série : son score à `n` pièces est le même
// qu'il s'arrête là ou qu'il continue.
const comptes = (bot: "moyen" | "fort"): number[] => [...new Set([...Object.values(BOTS_DE_REFERENCE).filter((r) => r.bot === bot).map((r) => r.pieces), ...(bot === "moyen" ? [30] : [])])].sort((x, y) => x - y);
const nM = comptes("moyen"), nF = comptes("fort");
const moyen: Record<number, number[]> = Object.fromEntries(nM.map((n) => [n, [] as number[]]));
const mortMoyen: Record<number, number> = Object.fromEntries(nM.map((n) => [n, 0]));
const fort: Record<number, number[]> = Object.fromEntries(nF.map((n) => [n, [] as number[]]));
const mortFort: Record<number, number> = Object.fromEntries(nF.map((n) => [n, 0]));
const finalFort: number[] = [];
const posesFort: number[] = [];
let plafond = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const c = dailyBlocks(depart + i);
  for (const n of nM) {
    const r = jouerGlouton(c, n).resultat;
    moyen[n]!.push(r.score);
    if (r.raison !== "arret") mortMoyen[n]!++;
  }
  const p = new Partie(c);
  const vu = new Set<number>();
  while (!p.finie) {
    for (const a of planDuDiamant(p, LARGEUR_FAISCEAU)) {
      p.jouerAction(a);
      for (const n of nF) if (!vu.has(n) && p.poses >= n) (vu.add(n), fort[n]!.push(p.score));
    }
  }
  for (const n of nF) if (!vu.has(n)) (fort[n]!.push(p.score), mortFort[n]!++);
  finalFort.push(p.score);
  posesFort.push(p.poses);
  if (p.poses >= PLAFOND_PIECES) plafond++;
}
const tempsMs = Math.round(performance.now() - t0);

const hors25 = (a: readonly number[]): number => {
  const m = q(a, 50);
  return +((100 * a.filter((v) => v < 0.75 * m || v > 1.25 * m).length) / a.length).toFixed(1);
};
const mesure = (nom: "bronze" | "silver" | "gold" | "author", scores: number[], morts: number) => ({
  medaille: nom,
  bot: BOTS_DE_REFERENCE[nom].bot,
  pieces: BOTS_DE_REFERENCE[nom].pieces,
  score: resume(scores),
  mortAvant_pourcent: +((100 * morts) / N).toFixed(1),
  horsDePlusOuMoins25PourcentDeLaMediane_pourcent: hors25(scores),
  q1_q3_surMediane: [+(q(scores, 25) / q(scores, 50)).toFixed(2), +(q(scores, 75) / q(scores, 50)).toFixed(2)],
  proposee: arrondir(q(scores, 50)),
  enVigueur: SEUILS_MEDAILLES[nom],
});
const donnees = (nom: "bronze" | "silver" | "gold" | "author") => {
  const { bot, pieces } = BOTS_DE_REFERENCE[nom];
  return bot === "moyen" ? mesure(nom, moyen[pieces]!, mortMoyen[pieces]!) : mesure(nom, fort[pieces]!, mortFort[pieces]!);
};
const tableau = (["bronze", "silver", "gold", "author"] as const).map(donnees);
console.log(JSON.stringify({ jours: N, du, largeurFaisceau: LARGEUR_FAISCEAU, tableau }));

const [b, s, g, a] = tableau.map((t) => t.proposee) as [number, number, number, number];
const rapports = { argentSurBronze: +(s / b).toFixed(2), orSurArgent: +(g / s).toFixed(2), diamantSurOr: +(a / g).toFixed(2) };
const dansLaCible = Object.values(rapports).every((r) => r >= 1.5 && r <= 2.5);
const m30 = resume(moyen[30]!);
const depasse = finalFort.filter((v) => v >= a).length;
console.log(JSON.stringify({ rapports, dansLaCible, moyenA30Pieces: { score: m30, mortAvant_pourcent: +((100 * mortMoyen[30]!) / N).toFixed(1), medianeSurBronze: +(m30.mediane / b).toFixed(2), partDesJoursAuDessusDuBronze_pourcent: +((100 * moyen[30]!.filter((v) => v >= b).length) / N).toFixed(1) }, botFortSansArret: { score: resume(finalFort), pieces: resume(posesFort), plafond: `${plafond}/${N}`, partDesJoursQuilDepasseLeDiamant_pourcent: +((100 * depasse) / N).toFixed(1) }, tempsMs }));
