import { daysFromCivil, Rng } from "@cdj/core";
import { T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, TICKS_PAR_SECONDE, chargeDe, enregistrer, rejouer, type Commande } from "../src/index";
import { assemblerCles, dailyVertige, distanceMinimaleCm, genererNiveau, groupesDeBlocs, passagesTournes, robotDuJour, variantes, varianteDeCle, viderCachesDuGenerateur } from "../src/modulesIndex";

// Les mesures du lot V3 (`npm run niveaux:vertige -w @cdj/vertige-sim`) : sur 365 jours à partir du premier jour, l'histogramme des temps du robot, la fréquence de chaque module, de chaque forme et de chaque miroir, les tirages
// refusés, le temps de génération d'un niveau (Node), et le coût du rejeu d'une partie de 45 s sur un niveau du jour. Elles s'écrivent en Markdown sur la sortie standard (le README du lot les recopie).
const JOURS = 365;
const PREMIER = daysFromCivil(2026, 11, 2);
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const f1 = (v: number): string => v.toFixed(1);

// La bibliothèque se construit une fois : sa construction (les variantes pilotées) est mesurée à part.
let t0 = performance.now();
variantes();
const tCatalogue = performance.now() - t0;

// Les 365 jours, à froid (aucun niveau en mémoire) : le temps de génération de chacun.
viderCachesDuGenerateur();
const ms: number[] = [];
const generations = Array.from({ length: JOURS }, (_, i) => {
  t0 = performance.now();
  const g = genererNiveau(PREMIER + i);
  ms.push(performance.now() - t0);
  return g;
});

console.log(`# Mesures du lot V3 (${JOURS} jours à partir du ${new Date(PREMIER * 86_400_000).toISOString().slice(0, 10)})\n`);
console.log(`## Temps de génération (Node ${process.version}, un niveau à froid, tirages refusés compris)`);
console.log(`- le catalogue de variantes (14 modules, miroirs, 8 formes pilotées) : ${f1(tCatalogue)} ms, une fois ;`);
console.log(`- un niveau : médiane ${f1(mediane(ms))} ms, moyenne ${f1(ms.reduce((s, x) => s + x, 0) / ms.length)} ms, pire ${f1(Math.max(...ms))} ms ; les ${JOURS} niveaux : ${f1(ms.reduce((s, x) => s + x, 0) / 1000)} s.\n`);

console.log("## Histogramme des temps du robot (secondes, de son premier mouvement à l'arrivée)");
const histo = new Map<number, number>();
for (const g of generations) {
  const s = Math.floor(g.contenu.ticksRobot! / TICKS_PAR_SECONDE);
  histo.set(s, (histo.get(s) ?? 0) + 1);
}
const ticks = generations.map((g) => g.contenu.ticksRobot! / TICKS_PAR_SECONDE);
console.log(`mini ${f1(Math.min(...ticks))} s · médiane ${f1(mediane(ticks))} s · maxi ${f1(Math.max(...ticks))} s\n`);
console.log("| temps | niveaux | |\n|---|---|---|");
for (const [s, n] of [...histo.entries()].sort((a, b) => a[0] - b[0])) console.log(`| ${s} – ${s + 1} s | ${n} | ${"█".repeat(Math.round(n / 2))} |`);

console.log("\n## Nombre de modules par niveau et tirages refusés");
const nb = new Map<number, number>();
for (const g of generations) nb.set(g.contenu.modules!.length, (nb.get(g.contenu.modules!.length) ?? 0) + 1);
console.log([...nb.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} modules : ${v}`).join(" · "));
const refuses = generations.reduce((s, g) => s + g.refuses, 0);
console.log(`\n${refuses} tirages refusés pour ${JOURS} niveaux (pire jour : ${Math.max(...generations.map((g) => g.refuses))}), secours (cycles ignorés) : ${generations.filter((g) => g.secours).length}.`);
const motifs = new Map<string, number>();
for (const g of generations) for (const m of g.motifs) motifs.set(m, (motifs.get(m) ?? 0) + 1);
console.log("\n| motif du refus | fois |\n|---|---|");
for (const [m, n] of [...motifs.entries()].sort((a, b) => b[1] - a[1])) console.log(`| ${m} | ${n} |`);

console.log("\n## Fréquence de chaque module (nombre de niveaux qui le contiennent, sur 365)");
const parBase = new Map<string, number>();
const parCle = new Map<string, number>();
for (const g of generations) {
  const cles = g.contenu.modules!;
  for (const b of new Set(cles.map((c) => varianteDeCle(c)!.base))) parBase.set(b, (parBase.get(b) ?? 0) + 1);
  for (const c of new Set(cles)) parCle.set(c, (parCle.get(c) ?? 0) + 1);
}
console.log("| module de base | niveaux |\n|---|---|");
for (const [b, n] of [...parBase.entries()].sort((a, b) => b[1] - a[1])) console.log(`| ${b} | ${n} |`);
console.log("\n## Fréquence de chaque variante (nombre de modules posés, sur l'ensemble des niveaux)");
console.log("| variante | posée | forme | miroir |\n|---|---|---|---|");
for (const v of variantes()) console.log(`| ${v.cle} | ${generations.reduce((s, g) => s + g.contenu.modules!.filter((c) => c === v.cle).length, 0)} | ${v.forme} | ${v.miroir ? "oui" : "non"} |`);
const formes = new Map<string, number>();
let posees = 0;
for (const g of generations) for (const c of g.contenu.modules!) {
  const v = varianteDeCle(c)!;
  const k = `${v.forme}${v.miroir ? " + miroir" : ""}`;
  formes.set(k, (formes.get(k) ?? 0) + 1);
  posees++;
}
console.log(`\n${posees} modules posés : ${[...formes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}.`);

console.log("\n## Placement et monde tourné");
let tournes = 0;
let passages2 = 0;
let proche = Infinity;
const distances: number[] = [];
for (const g of generations) {
  const m = g.contenu.modules!.map((c) => varianteDeCle(c)!.module);
  const p = passagesTournes(m);
  if (p.length > 0) tournes++;
  if (p.length === 2) passages2++;
  const e = assemblerCles(g.contenu.modules!);
  const groupes = groupesDeBlocs(e.niveau, m);
  let mini = Infinity;
  for (let a = 0; a < groupes.length; a++) for (let b = a + 2; b < groupes.length; b++) mini = Math.min(mini, distanceMinimaleCm(groupes[a]!, groupes[b]!));
  distances.push(mini / 100);
  proche = Math.min(proche, mini / 100);
}
console.log(`- ${tournes} niveaux passent par un monde tourné (dont ${passages2} avec deux passages) ;`);
console.log(`- distance minimale entre deux modules non voisins : ${f1(proche)} m au plus bas, médiane ${f1(mediane(distances))} m (seuil : 30 m).`);

console.log("\n## Rejeu serveur d'une partie de 45 s sur un niveau du jour");
function marche(graine: number, pas: number): Commande[] {
  const rng = new Rng(graine);
  const out: Commande[] = [];
  let k = T_AVANT;
  for (let i = 0; i < pas; i++) {
    if (rng.int(30) === 0) k = [T_AVANT, T_AVANT | T_DROITE, T_AVANT | T_GAUCHE, T_DROITE, T_GAUCHE, T_AVANT][rng.int(6)]!;
    let c = k;
    if (rng.int(45) === 0) c |= T_SAUT;
    if (rng.int(150) === 0) c |= T_DASH;
    out.push({ k: c, dl: rng.int(61) - 30, dt: rng.int(21) - 10 });
  }
  return out;
}
const jour = PREMIER + 100;
const contenu = dailyVertige(jour);
const partie = marche(5, 45 * TICKS_PAR_SECONDE); // 5 400 pas, la souris comprise : une partie qui ne finit pas en 45 s
const code = enregistrer(contenu, partie);
const robot = enregistrer(contenu, robotDuJour(contenu));
const chrono = (f: () => void, n: number): number[] => Array.from({ length: n }, () => {
  const t = performance.now();
  f();
  return performance.now() - t;
});
viderCachesDuGenerateur();
const froid = chrono(() => rejouer(dailyVertige(jour), code), 1)[0]!;
const chaud = chrono(() => rejouer(contenu, code), 30);
const chaudRobot = chrono(() => rejouer(contenu, robot), 30);
console.log(`- partie de ${partie.length} pas (45 s), rediffusion de ${code.length} caractères (${chargeDe(partie).length} octets) : **${f1(mediane(chaud))} ms** (médiane de 30, niveau déjà assemblé), pire ${f1(Math.max(...chaud))} ms ;`);
console.log(`- le robot (${contenu.ticksRobot} pas, ${f1(contenu.ticksRobot! / TICKS_PAR_SECONDE)} s, rediffusion de ${robot.length} caractères) : ${f1(mediane(chaudRobot))} ms ;`);
console.log(`- le tout premier envoi d'un jour, à froid (niveau à générer, assembler et rejouer) : ${f1(froid)} ms.`);
