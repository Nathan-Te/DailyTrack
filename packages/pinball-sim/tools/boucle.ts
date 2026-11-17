import { TICKS_PAR_SECONDE, copierReglages, dailyPinball, graineDuRobot, jouerRobot } from "../src/index";

// `npm run boucle:pinball -w @cdj/pinball-sim -- [--jours 8] [--minutes 15] [--graines 1] [--du 20800]` (lot PBG2) : **les parties entières du robot** — combien de temps elles durent, ce qu'elles rapportent, combien de multibilles et de jackpots,
// et ce que coûte leur calcul. Sert à choisir la durée des parties du robot pour les seuils (`seuils.ts`, `DUREE_PARTIE_ROBOT`). Aucune base, aucun réseau.
const arg = (nom: string, defaut: number): number => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? Number(process.argv[i + 1]) : defaut;
};
const jours = arg("jours", 8);
const minutes = arg("minutes", 15);
const graines = arg("graines", 1);
const du = arg("du", 20800);
/** `--sansmult 1` : le jackpot ne prend pas le multiplicateur (la mesure de la décision du lot PBG2). */
const reglages = copierReglages();
if (arg("sansmult", 0) === 1) reglages.jackpotMultiplie = 0;
let total = 0;
const lignes: string[] = [];
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const scores: number[] = [];
const fins: number[] = [];
/** Le score de chaque partie à 2, 4, 6, 8, 10, 12 et 15 minutes : une partie coupée à D minutes est le début de la partie de 15 minutes (le robot est déterministe). */
const JALONS = [2, 4, 6, 8, 10, 12, 15];
const aux: number[][] = JALONS.map(() => []);
for (let j = 0; j < jours; j++) {
  const c = dailyPinball(du + j * 7 + 1);
  for (let g = 0; g < graines; g++) {
    const t0 = Date.now();
    const marques: number[] = [];
    const r = jouerRobot(c, graineDuRobot(g), {
      maxTicks: minutes * 60 * TICKS_PAR_SECONDE,
      reglages,
      surPas: (q) => {
        if (q.tick % (60 * TICKS_PAR_SECONDE) === 0 && JALONS.includes(q.tick / (60 * TICKS_PAR_SECONDE))) marques.push(q.score);
      },
    });
    JALONS.forEach((_, i) => aux[i]!.push(marques[i] ?? r.partie.score));
    const p = r.partie;
    const dt = Date.now() - t0;
    total += dt;
    scores.push(p.score);
    fins.push(p.tick);
    lignes.push(`${c.theme}:${c.plan} g${g} fin ${(p.tick / TICKS_PAR_SECONDE / 60).toFixed(1)} min  score ${p.score}  billes ${p.billes}  niveau ${p.niveau}  multibilles ${p.multibilles}  jackpots ${p.jackpotsPartie} (${Math.round((100 * p.jackpotPoints) / Math.max(1, p.score))} % du score)  verrous ${p.verrouTotal}  perdues en multibille ${p.perduesMulti}  mult max ${p.multMax}  ${dt} ms`);
  }
}
console.log(lignes.join("\n"));
console.log(`\nscore médian à ${JALONS.map((m, i) => `${m} min : ${mediane(aux[i]!)}`).join(" · ")}`);
console.log(`${scores.length} parties de ${minutes} min au plus : score médian ${mediane(scores)}, fin médiane ${(mediane(fins) / TICKS_PAR_SECONDE / 60).toFixed(1)} min, calcul moyen ${Math.round(total / scores.length)} ms`);
