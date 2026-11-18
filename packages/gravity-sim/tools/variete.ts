import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { MORCEAUX_PAR_BOUCLE, MORCEAUX_PAR_THEME, dailyGravity, mesurerLeJour, motifsParBoucle, partPassive, repetitionsProches, variantesRepetees } from "../src/index";

// `npm run variete:gravity -w @cdj/gravity-sim -- [--du AAAA-MM-JJ] [--jours 30] [--distance 3040]` (lot GR7) : la variété des jours, mesurée sur le terrain et sur le robot.
const arg = (nom: string): string | undefined => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const du = parseDay(arg("du") ?? "") ?? daysFromCivil(2026, 11, 17);
const jours = Number(arg("jours") ?? 30);
const distance = Number(arg("distance") ?? MORCEAUX_PAR_BOUCLE * 16 * 2);
let nbMotifs: number[][] = [];
let rep = 0;
let repVar = 0;
let passifs = 0;
let total = 0;
const diffParTheme: number[][] = Array.from({ length: 10 }, () => []);
const tousMotifs = new Set<string>();
const dangers = new Map<string, number>();
const parMotif = new Map<string, [number, number]>();
for (let j = du; j < du + jours; j++) {
  const mes = mesurerLeJour(dailyGravity(j), distance);
  nbMotifs.push(motifsParBoucle(mes.morceaux));
  rep += repetitionsProches(mes.morceaux);
  repVar += variantesRepetees(mes.morceaux);
  const comptes = mes.morceaux.filter((x) => x.m >= MORCEAUX_PAR_THEME && !x.souffle && !x.suite);
  passifs += comptes.filter((x) => x.passif).length;
  total += comptes.length;
  for (const x of mes.morceaux) {
    if (!x.suite && !x.souffle && x.m >= MORCEAUX_PAR_THEME) {
      const e = parMotif.get(x.motif) ?? parMotif.set(x.motif, [0, 0]).get(x.motif)!;
      e[0]++;
      if (x.passif) e[1]++;
    }
    tousMotifs.add(x.motif);
    diffParTheme[Math.trunc(x.m / MORCEAUX_PAR_THEME)]?.push(x.difficulte);
    if (/scie|fragile|laser/.test(x.motif)) dangers.set(x.motif, (dangers.get(x.motif) ?? 0) + 1);
  }
  const part = partPassive(mes.morceaux, MORCEAUX_PAR_THEME);
  console.log(`${formatDay(j)} ${mes.vivant ? "vivant" : "MORT  "} motifs/boucle ${motifsParBoucle(mes.morceaux).join(" / ")}  répétitions<6 ${repetitionsProches(mes.morceaux)}  variantes répétées ${variantesRepetees(mes.morceaux)}  part passive ${(part * 100).toFixed(0)} %`);
}
const moy = (a: number[]): number => (a.length === 0 ? 0 : a.reduce((x, y) => x + y, 0) / a.length);
console.log(`\n${jours} jours à partir de ${formatDay(du)}, ${distance} m`);
console.log(`motifs distincts par boucle (moyenne) : ${[0, 1].map((b) => moy(nbMotifs.map((v) => v[b] ?? 0)).toFixed(1)).join(" / ")} ; sur tous les jours : ${tousMotifs.size}`);
console.log(`répétitions à moins de 6 morceaux : ${(rep / jours).toFixed(1)} par jour ; variantes répétées dans une boucle : ${(repVar / jours).toFixed(1)} par jour`);
console.log(`part passive après le 1er thème, hors repos : ${((passifs / Math.max(1, total)) * 100).toFixed(1)} % (${passifs}/${total})`);
console.log(`difficulté moyenne par thème : ${diffParTheme.map((a, i) => (a.length ? `T${i + 1} ${moy(a).toFixed(2)}` : "")).filter(Boolean).join(", ")}`);
console.log(`motifs : ${[...tousMotifs].sort().join(", ")}`);
console.log(`passifs par motif (passifs/total) : ${[...parMotif].filter(([, v]) => v[1] > 0).sort((a, b) => b[1][1] - a[1][1]).map(([k, v]) => `${k} ${v[1]}/${v[0]}`).join(", ")}`);
if (dangers.size > 0) console.log(`morceaux à danger : ${[...dangers].map(([k, v]) => `${k} ${v}`).join(", ")}`);
