import { daysFromCivil, formatDay, parseDay } from "@cdj/core";
import { MORCEAUX_PAR_BOUCLE, ROBOT_FENETRE_MIN, dailyGravity, jouerRobot, terrainDuJour } from "../src/index";

// `npm run robot:gravity -w @cdj/gravity-sim -- [--du AAAA-MM-JJ] [--jours 30] [--distance 2280] [--serres 5] [--strict]` (lot GR2) : le rapport du robot, **une ligne par jour**.
// Par jour : la distance atteinte (le robot joue par défaut la première boucle des cinq thèmes et la moitié de la seconde, 2 280 m), les pièces prises et lâchées (celles du chemin sûr qu'il a laissées pour survivre),
// le nombre d'appuis, la fenêtre la plus étroite, et les passages les plus serrés (morceau, motif, fenêtre en pas) ; un passage sans fenêtre suffisante ou une mort est un ÉCHEC — le générateur à corriger, jamais le robot.
// `--liens <base>` (une adresse du jeu, ex. https://…/gravity/) ajoute pour chaque jour les liens de recette des passages les plus serrés (`?jour=…&morceau=<n>` : on commence juste avant le morceau et on le joue soi-même) et celui du robot (`?jour=…&robot`).
// Sans `--strict` le robot essaie des fenêtres plus étroites quand il n'en a pas (le diagnostic : il montre tous les passages à corriger d'un jour, pas seulement le premier). Sortie courte ; `--serres 0` n'en liste aucun.
const arg = (nom: string): string | undefined => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const du = parseDay(arg("du") ?? "") ?? daysFromCivil(2026, 11, 2);
const jours = Number(arg("jours") ?? 30);
const distance = Number(arg("distance") ?? Math.trunc(MORCEAUX_PAR_BOUCLE * 16 * 1.5));
const nbSerres = Number(arg("serres") ?? 5);
const strict = process.argv.includes("--strict");
const base = arg("liens");

const echecs = new Map<string, number>();
const parMotif = new Map<string, number[]>();
let ok = 0;
let ms = 0;
let pire = 0;
for (let j = du; j < du + jours; j++) {
  const contenu = dailyGravity(j);
  const terrain = terrainDuJour(contenu);
  const t0 = performance.now();
  const r = jouerRobot(terrain, { maxDistance: distance, strict });
  const dt = performance.now() - t0;
  ms += dt;
  pire = Math.max(pire, dt);
  const p = r.partie;
  const mort = p.finie && p.distance < distance;
  const entorses = r.rapport.entorses;
  const bon = !mort && entorses.length === 0;
  if (bon) ok++;
  for (const a of r.rapport.appuis) (parMotif.get(a.motif) ?? parMotif.set(a.motif, []).get(a.motif)!).push(a.fenetre);
  const serres = [...r.rapport.appuis].sort((a, b) => a.fenetre - b.fenetre).slice(0, nbSerres);
  const total = r.rapport.piecesPrises + r.rapport.piecesLachees;
  const motifMort = mort ? terrain.morceau(Math.trunc((p.x - 0) / (16 * 4096))).motif : "";
  let ligne = `${formatDay(j)} ${bon ? "OK    " : "ÉCHEC "} ${String(p.distance).padStart(4)} m  score ${String(p.score).padStart(6)}  pièces ${r.rapport.piecesPrises}/${total}  appuis ${String(r.appuis.length).padStart(3)}  ${(dt / 1000).toFixed(2)} s`;
  if (nbSerres > 0 && serres.length > 0) ligne += `  serrés ${serres.map((a) => `m${a.morceau} ${a.motif} ${a.fenetre}`).join(" · ")}`;
  console.log(ligne);
  if (base) {
    const lien = (suite: string): string => `${base}?jour=${formatDay(j)}${suite}`;
    for (const a of serres) console.log(`    morceau ${a.morceau} (${a.motif}, fenêtre ${a.fenetre} pas) : ${lien(`&morceau=${a.morceau}`)}`);
    console.log(`    le robot : ${lien("&robot")}`);
  }
  if (!bon) {
    const detail = [...entorses.map((e) => `sans fenêtre m${e.morceau} ${e.motif} (pas ${e.tick})`), ...(mort ? [`mort à ${p.distance} m, morceau ${Math.trunc(p.x / (16 * 4096))} ${motifMort}`] : [])];
    console.log(`          ${detail.join(" ; ")}`);
    for (const e of entorses) echecs.set(e.motif, (echecs.get(e.motif) ?? 0) + 1);
    if (mort) echecs.set(`mort:${motifMort}`, (echecs.get(`mort:${motifMort}`) ?? 0) + 1);
  }
}
console.log(`${ok}/${jours} jours sans entorse (fenêtre ≥ ${ROBOT_FENETRE_MIN} pas) ; ${(ms / jours / 1000).toFixed(2)} s par jour en moyenne, ${(pire / 1000).toFixed(2)} s au plus`);
if (process.argv.includes("--motifs")) {
  const lignes = [...parMotif].map(([m, v]) => { const t = [...v].sort((a, b) => a - b); return `${m} : ${t.length} appuis, fenêtre min ${t[0]}, 10 % ${t[Math.trunc(t.length / 10)]}, médiane ${t[t.length >> 1]}`; });
  console.log(`fenêtres par motif :\n  ${lignes.sort().join("\n  ")}`);
}
if (echecs.size > 0) console.log(`échecs par motif : ${[...echecs].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
if (ok < jours) process.exitCode = 1;
