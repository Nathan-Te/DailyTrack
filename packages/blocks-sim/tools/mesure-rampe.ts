import { daysFromCivil } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, PIECES, TAILLE_SERIE } from "../src/index";
import { reglageDesArguments } from "./aide";
import { jouerDiamant, LARGEUR_FAISCEAU, POIDS_DIAMANT } from "../src/diamant";
import { jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";

// `npm run mesure:rampe -w @cdj/blocks-sim -- [--graines=200] [--pente=1] [--rangmax=140] [--bot=faible|moyen|diamant|tous] [--k=24] [--poids=<json>] [--poidsbase=<json>] [--du=AAAA-MM-JJ]` : la durée (en SÉRIES de trois pièces) et le score
// des trois bots de référence (faible, moyen, Diamant) sur N jours, pour calibrer la rampe (lot B8). Lot B8c : prend aussi le réglage du tirage adapté (`--essais`, `--apres`, `--posable=jusqua,rang,pct`, `--pouce=pct,pctFin,rang` ; voir `mesure:tirage`). Écrit minimum, quartiles, médiane, maximum, la part des parties qui atteignent le plafond de pièces, et le temps de chaque bot.
const arg = (n: string, d: number): number => Number(process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const choix = process.argv.find((a) => a.startsWith("--bot="))?.slice(6) ?? "tous";
// `--poids='{"isolees":-50}'` essaie d'autres poids du Diamant le temps de la mesure (réglage ; rien n'est écrit).
const poids = process.argv.find((a) => a.startsWith("--poids="))?.slice(8);
if (poids) Object.assign(POIDS_DIAMANT, JSON.parse(poids));
// `--poidsbase='{"coin":14,"l":4}'` essaie d'autres poids de base du tirage (par nom de forme : domino, barre3, barre4, barre5, carre2, carre3, coin, l, grandl, t, grandt, s, z, rect) ; réglage seulement, rien n'est écrit.
const poidsBase = process.argv.find((a) => a.startsWith("--poidsbase="))?.slice(12);
if (poidsBase) {
  const base = JSON.parse(poidsBase) as Record<string, number>;
  for (const p of PIECES) {
    const k = p.nom.replace(/-\d+$/, "");
    if (k in base) (p as { poids: number }).poids = base[k]!;
  }
}
const N = arg("graines", 200);
const K = arg("k", LARGEUR_FAISCEAU);
const reglage = reglageDesArguments();
const du = process.argv.find((a) => a.startsWith("--du="))?.slice(5);
const depart = du ? daysFromCivil(Number(du.slice(0, 4)), Number(du.slice(5, 7)), Number(du.slice(8, 10))) : daysFromCivil(2026, 11, 2);
const q = (a: number[], p: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))]!;
const resume = (a: number[]) => ({ min: q(a, 0), q1: q(a, 25), mediane: q(a, 50), q3: q(a, 75), max: q(a, 100) });

function mesurer(nom: string, jouer: typeof jouerGlouton): void {
  const series: number[] = [];
  const scores: number[] = [];
  const temps: number[] = [];
  let plafond = 0;
  for (let i = 0; i < N; i++) {
    const contenu = dailyBlocks(depart + i, BLOCKS_GENERATOR_VERSION, reglage);
    const t0 = performance.now();
    const r = jouer(contenu).resultat;
    temps.push(performance.now() - t0);
    series.push(Math.round(r.poses / TAILLE_SERIE));
    scores.push(r.score);
    if (r.raison === "plafond") plafond++;
  }
  console.log(JSON.stringify({ bot: nom, reglage, parties: N, ...(nom === "diamant" ? { k: K } : {}), ...(poids ? { poids: POIDS_DIAMANT } : {}), ...(poidsBase ? { poidsBase: JSON.parse(poidsBase) } : {}), series: resume(series), score: resume(scores), plafond: `${plafond}/${N}`, ms: { mediane: +q(temps, 50).toFixed(1), pire: +q(temps, 100).toFixed(1) } }));
}
if (choix === "faible" || choix === "tous") mesurer("faible", jouerFaible);
if (choix === "moyen" || choix === "tous") mesurer("moyen", jouerGlouton);
if (choix === "diamant" || choix === "tous") mesurer("diamant", (c) => jouerDiamant(c, K));
