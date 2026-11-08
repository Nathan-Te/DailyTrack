// Lot 57 (Track) : l'état des lieux des sauts et des transitions. Hors CI (≈ 1 min) :
//   npx esbuild packages/sim/scripts/mesure-sauts.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/cdj/mesure-sauts.mjs && node node_modules/.cache/cdj/mesure-sauts.mjs [--depuis AAAA-MM-JJ] [--par-theme 25] [--version 21]
// Pour 25 circuits de chaque thème (les jours à venir, dans l'ordre du calendrier), chaque saut est rangé selon ses cinq parties et la source de sa
// vitesse (`classerSauts`), et chaque raccord entre deux blocs selon ce qui change (`classerTransitions`). Un raccord « demande un geste » si le
// pilote d'auteur y lâche l'accélérateur, freine, braque nettement (> 0,3 en ligne droite) ou quitte le sol (≥ 6 sous-pas), à moins de 16 m du
// raccord (le long de sa trajectoire) ; une transition de largeur se lit sur tout son bloc.
import { CELL, GENERATOR_VERSION, THEME_NAMES, TICK_RATE, ReplayPlayer, cellKey, combinaison, createRace, classerSauts, classerTransitions, dailyCircuit, isCurve, figureByName, FIGURES_LOT49, parseDay, sautDansLAxe, sautDansLAxeStrict, stepRace, AXIS_MAX, type SautClasse, type ThemeName, type Transition } from "../src/index";

const argv = process.argv.slice(2);
const opt = (nom: string): string | undefined => {
  const i = argv.indexOf(`--${nom}`);
  return i < 0 ? undefined : argv[i + 1];
};
const DEPUIS = parseDay(opt("depuis") ?? "2026-11-10")!;
const PAR_THEME = Number(opt("par-theme") ?? 25);
const VERSION = Number(opt("version") ?? GENERATOR_VERSION);

interface Raccord {
  kind: Transition;
  /** Le pilote lâche, freine ou braque nettement à moins de 16 m. */
  geste: boolean;
  /** La voiture quitte le sol (≥ 6 sous-pas) à moins de 16 m : allégée, elle décolle. */
  vol: boolean;
  /** Un des deux blocs est un virage : le geste peut être celui du virage, pas du raccord. */
  virage: boolean;
}
const sauts: (SautClasse & { theme: ThemeName; consecutifMeme: boolean })[] = [];
const raccords: (Raccord & { theme: ThemeName })[] = [];
const vus = new Map<ThemeName, number>(THEME_NAMES.map((t) => [t, 0]));
let circuits = 0;
const figuresSaut = new Map<string, number>();
let axeParCircuitMax = 0;
let circuitsAvecPlusDUnAxe = 0;
const t0 = performance.now();

for (let day = DEPUIS; [...vus.values()].some((n) => n < PAR_THEME); day++) {
  const c = dailyCircuit(day, 0, null, VERSION);
  if ((vus.get(c.theme) ?? 0) >= PAR_THEME) continue;
  vus.set(c.theme, (vus.get(c.theme) ?? 0) + 1);
  circuits++;
  const track = c.track;
  // Gestes du pilote d'auteur : à chaque pas, la distance parcourue, le bloc, et s'il lâche l'accélérateur, freine, vole (≥ 6 sous-pas) ou braque
  // nettement en ligne droite. Le raccord i | i + 1 est au premier pas passé sur un bloc d'indice ≥ i + 1.
  const race = createRace(track);
  const player = new ReplayPlayer(c.authorReplay);
  const dist: number[] = [];
  const blocs: number[] = [];
  const gestes: boolean[] = [];
  const vols: boolean[] = [];
  let sCum = 0;
  for (let t = 0; t < 120 * TICK_RATE && race.finishMs < 0; t++) {
    const input = player.next();
    const car = race.car;
    const b = track.cells.get(cellKey(Math.floor(car.x / CELL), Math.floor(car.z / CELL)));
    const straight = !!b && !isCurve(b.kind);
    dist.push(sCum);
    blocs.push(b ? b.index : -1);
    gestes.push(input.throttle < AXIS_MAX || input.brake > 0 || (straight && Math.abs(input.steer) > 0.3 * AXIS_MAX));
    vols.push(car.air >= 6);
    const x = car.x;
    const z = car.z;
    stepRace(race, input);
    sCum += Math.hypot(race.car.x - x, race.car.z - z);
  }
  const a = (bloc: number, quoi: boolean[] = gestes): boolean => {
    const k = blocs.findIndex((x) => x >= bloc + 1);
    if (k < 0) return false;
    for (let j = 0; j < dist.length; j++) if (Math.abs(dist[j]! - dist[k]!) <= 16 && quoi[j]) return true;
    return false;
  };
  for (const tr of classerTransitions(track)) raccords.push({
    kind: tr.kind,
    geste: a(tr.kind === "largeur" ? tr.bloc - 1 : tr.bloc) || (tr.kind === "largeur" && a(tr.bloc)),
    vol: a(tr.kind === "largeur" ? tr.bloc - 1 : tr.bloc, vols),
    virage: isCurve(track.blocks[tr.bloc]!.kind) || isCurve(track.blocks[tr.bloc + 1]?.kind ?? "straight"),
    theme: c.theme,
  });
  for (const f of c.figures) if (figureByName(f.name)?.jump) figuresSaut.set(f.name, (figuresSaut.get(f.name) ?? 0) + 1);
  const ss = classerSauts(track);
  const axes = ss.filter(sautDansLAxe).length;
  axeParCircuitMax = Math.max(axeParCircuitMax, axes);
  if (axes > 1) circuitsAvecPlusDUnAxe++;
  ss.forEach((s, i) => sauts.push({ ...s, theme: c.theme, consecutifMeme: i > 0 && combinaison(ss[i - 1]!) === combinaison(s) }));
}

const pc = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "—");
const compte = <T extends string>(xs: readonly T[]) => {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((p, q) => q[1] - p[1]);
};
const ligne = (titre: string, xs: readonly string[]) => console.log(`| ${titre} | ${compte(xs).map(([k, n]) => `${k} ${pc(n, xs.length)}`).join(" · ")} |`);

console.log(`\n## Sauts — générateur v${VERSION}, ${circuits} circuits (${PAR_THEME} par thème, à partir du ${opt("depuis") ?? "2026-11-10"}), ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
console.log(`${sauts.length} sauts (${(sauts.length / circuits).toFixed(2)} par circuit).\n`);
console.log("| partie | répartition |\n|---|---|");
ligne("approche", sauts.map((s) => s.approche));
ligne("appel", sauts.map((s) => s.appel));
ligne("vol", sauts.map((s) => s.vol));
ligne("réception", sauts.flatMap((s) => s.reception));
ligne("sortie", sauts.map((s) => s.sortie));
ligne("vitesse", sauts.map((s) => s.vitesse));
const axe = sauts.filter(sautDansLAxe).length;
const strict = sauts.filter(sautDansLAxeStrict).length;
console.log(`\n« ligne droite → tremplin → réception dans l'axe » (plus bas ou plus haut compris) : **${pc(axe, sauts.length)}** des sauts (${axe}/${sauts.length}) ; au même niveau seulement : ${pc(strict, sauts.length)}.`);
console.log(`Au plus ${axeParCircuitMax} saut(s) dans l'axe par circuit ; ${circuitsAvecPlusDUnAxe} circuits sur ${circuits} en ont plus d'un. Deux sauts consécutifs de même combinaison : ${sauts.filter((s) => s.consecutifMeme).length}.`);
console.log("\nCombinaisons les plus fréquentes (approche|appel|vol|réception|sortie) :");
for (const [k, n] of compte(sauts.map(combinaison)).slice(0, 8)) console.log(`- ${k} : ${n} (${pc(n, sauts.length)})`);
console.log("\nPar thème (sauts par circuit · part dans l'axe · élan seul) :");
for (const th of THEME_NAMES) {
  const de = sauts.filter((s) => s.theme === th);
  console.log(`- ${th} : ${(de.length / PAR_THEME).toFixed(2)} · ${pc(de.filter(sautDansLAxe).length, de.length)} · ${pc(de.filter((s) => s.vitesse === "elan").length, de.length)}`);
}

console.log("\nFigures de saut tirées (circuits qui les ont) — celles du lot 49 en gras :");
for (const [k, n] of [...figuresSaut.entries()].sort((p, q) => q[1] - p[1])) console.log(`- ${FIGURES_LOT49.includes(k) ? `**${k}**` : k} : ${n}`);
console.log(`\n## Transitions — ${raccords.length} raccords (${(raccords.length / circuits).toFixed(1)} par circuit)\n`);
console.log("| transition | nombre | par circuit | le pilote lâche, freine ou braque | la voiture décolle | dont hors virage : geste |\n|---|---:|---:|---:|---:|---:|");
for (const [k, n] of compte(raccords.map((r) => r.kind))) {
  const de = raccords.filter((r) => r.kind === k);
  const hors = de.filter((r) => !r.virage);
  console.log(`| ${k} | ${n} | ${(n / circuits).toFixed(2)} | ${pc(de.filter((r) => r.geste).length, n)} | ${pc(de.filter((r) => r.vol).length, n)} | ${hors.length ? `${pc(hors.filter((r) => r.geste).length, hors.length)} (${hors.length})` : "—"} |`);
}
