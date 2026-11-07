import { daysFromCivil } from "@cdj/core";
import { arrondir, dailyBlocks, medailleDe, Partie, PLAFOND_PIECES, REFERENCES_MEDAILLES, seuilsDepuis, TAILLE_SERIE, type Medaille } from "../src/index";
import { jouerDiamant, LARGEUR_FAISCEAU } from "../src/diamant";
import { coupFaible, jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";

// `npm run calibrer:medailles -w @cdj/blocks-sim -- [--graines=1000] [--du=2026-11-02] [--rythme=4]` : le calibrage des médailles (lot B8). Sur N jours, les trois bots de référence jouent la suite du jour (faible, moyen, Diamant) ; l'outil écrit
//   1. pour chaque bot : le score et la durée (en séries) — minimum, quartiles, médiane, maximum —, la part des parties qui atteignent le plafond de pièces, le temps du Diamant ;
//   2. les références PROPOSÉES (médiane du faible → bronze, médiane du moyen → argent, 3ᵉ quartile du moyen ou mi-chemin avec le Diamant → or, arrondies) et celles EN VIGUEUR (`REFERENCES_MEDAILLES`) ;
//   3. le tableau par médaille : valeur médiane, minimale et maximale du seuil servi sur ces jours, et la part des jours où chaque bot l'obtient ;
//   4. le garde-fou humain : le plus haut bronze servi rapporté à la médiane du bot faible (défaut au-delà de 2) ;
//   5. ce que rapporte une partie attentive de 5 minutes (le bot faible arrêté après autant de poses qu'on en joue à `--rythme` secondes par pose, 4 par défaut), et les corrélations jour par jour entre les trois bots (Spearman).
const arg = (n: string, d: string): string => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const N = Number(arg("graines", "1000"));
const du = arg("du", "2026-11-02");
const depart = daysFromCivil(Number(du.slice(0, 4)), Number(du.slice(5, 7)), Number(du.slice(8, 10)));
const rythme = Number(arg("rythme", "4"));
const q = (a: readonly number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const resume = (a: readonly number[]) => ({ min: q(a, 0), q1: q(a, 25), mediane: q(a, 50), q3: q(a, 75), max: q(a, 100) });
const rangs = (a: readonly number[]): number[] => {
  const idx = a.map((_, i) => i).sort((x, y) => a[x]! - a[y]!);
  const r = new Array<number>(a.length);
  idx.forEach((i, k) => (r[i] = k));
  return r;
};
const spearman = (a: readonly number[], b: readonly number[]): number => {
  const x = rangs(a);
  const y = rangs(b);
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i]! - mx) * (y[i]! - my);
    dx += (x[i]! - mx) ** 2;
    dy += (y[i]! - my) ** 2;
  }
  return +(num / Math.sqrt(dx * dy)).toFixed(2);
};

const faible: number[] = [], moyen: number[] = [], diamant: number[] = [];
const sFaible: number[] = [], sMoyen: number[] = [], sDiamant: number[] = [];
const temps: number[] = [];
let plafond = 0;
for (let i = 0; i < N; i++) {
  const c = dailyBlocks(depart + i);
  const f = jouerFaible(c).resultat, m = jouerGlouton(c).resultat;
  const t0 = performance.now();
  const d = jouerDiamant(c).resultat;
  temps.push(performance.now() - t0);
  faible.push(f.score), moyen.push(m.score), diamant.push(d.score);
  sFaible.push(Math.round(f.poses / TAILLE_SERIE)), sMoyen.push(Math.round(m.poses / TAILLE_SERIE)), sDiamant.push(Math.round(d.poses / TAILLE_SERIE));
  if (d.poses >= PLAFOND_PIECES) plafond++;
}
console.log(JSON.stringify({ jours: N, du, largeurFaisceau: LARGEUR_FAISCEAU, faible: { score: resume(faible), series: resume(sFaible) }, moyen: { score: resume(moyen), series: resume(sMoyen) }, diamant: { score: resume(diamant), series: resume(sDiamant), plafond: `${plafond}/${N}`, ms: { mediane: +q(temps, 50).toFixed(1), p95: +q(temps, 95).toFixed(1), pire: +q(temps, 100).toFixed(1) } } }));

// 2. Les références proposées.
const mediane = q(diamant, 50);
const rond = (n: number): number => (n <= 2000 ? Math.round(n / 100) * 100 : Math.round(n / 500) * 500);
const q3Moyen = q(moyen, 75);
const miChemin = (q(moyen, 50) + mediane) / 2;
console.log(JSON.stringify({ referencesProposees: { bronze: rond(q(faible, 50)), silver: rond(q(moyen, 50)), gold: rond(Math.min(q3Moyen, miChemin)) }, enVigueur: REFERENCES_MEDAILLES, q3Moyen, miCheminMoyenDiamant: Math.round(miChemin) }));

// 3. Le tableau par médaille, 4. le garde-fou.
const noms: Medaille[] = ["bronze", "silver", "gold", "author"];
const seuils = diamant.map((d) => seuilsDepuis(d));
const parts = (scores: readonly number[]): Record<string, number> => {
  const out: Record<string, number> = { bronze: 0, silver: 0, gold: 0, author: 0 };
  scores.forEach((s, i) => {
    const m = medailleDe([s, 0], seuils[i]!);
    if (m === null) return;
    const rang = noms.indexOf(m);
    for (let k = 0; k <= rang; k++) out[noms[k]!]!++;
  });
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, +((100 * v) / N).toFixed(1)]));
};
const tableau = Object.fromEntries(noms.map((m) => [m, { ...resume(seuils.map((s) => s[m])) }]));
console.log(JSON.stringify({ tableau, partDesJoursOuLeBotObtient_pourcent: { faible: parts(faible), moyen: parts(moyen), diamant: parts(diamant) } }));
const bronzeMax = Math.max(...seuils.map((s) => s.bronze));
console.log(JSON.stringify({ joursOuLeDiamantNeBatPasLeMoyen: diamant.filter((d, i) => d <= moyen[i]!).length, gardeFou: { medianeFaible: q(faible, 50), bronzeMaxServi: bronzeMax, rapport: +(bronzeMax / q(faible, 50)).toFixed(2), defaut: bronzeMax > 2 * q(faible, 50) }, joursOuLeDiamantEstSousLor: seuils.filter((s) => s.gold < REFERENCES_MEDAILLES.gold).length }));

// 5. Une partie attentive de 5 minutes, et les corrélations.
const poses = Math.round((5 * 60) / rythme);
const apres: number[] = [];
for (let i = 0; i < N; i++) {
  const p = new Partie(dailyBlocks(depart + i));
  for (let k = 0; k < poses && !p.finie; k++) {
    const a = coupFaible(p)!;
    p.poser(a.emplacement, a.col, a.ligne);
  }
  apres.push(p.score);
}
console.log(JSON.stringify({ partieDeCinqMinutes: { secondesParPose: rythme, poses, scoreDuBotFaible: resume(apres) }, correlationsSpearman: { faibleMoyen: spearman(faible, moyen), faibleDiamant: spearman(faible, diamant), moyenDiamant: spearman(moyen, diamant) }, arrondiDeTest: arrondir(1234) }));
