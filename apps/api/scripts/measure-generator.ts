import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  FAST_PEAK,
  GENERATOR_VERSION,
  MAX_ATTEMPTS,
  SIM_VERSION,
  THEME_NAMES,
  DEFAULT_CAR_PARAMS,
  bestPilotRun,
  composeSpec,
  longestPlainStraight,
  estimateSeconds,
  CELL,
  cellKey,
  createAutopilot,
  createRace,
  stepRace,
  AXIS_MAX,
  FIGURES,
  FIGURE_CATEGORIES,
  figureByName,
  dailyCircuit,
  daysFromCivil,
  isCurve,
  isWide,
  MIN_RELIEF,
  parseTrack,
  reliefOf,
  trackJumps,
  replayRace,
  themeByName,
  type Block,
  type DailyCircuit,
} from "@cdj/sim";

// `npm run measure:generator` : mesure le générateur de circuits (lot 12). À relancer après toute règle de
// générateur, toute modification du pilote ou de la physique : « toute règle de générateur se valide par ce script
// (durées, taux de validation par thème), pas seulement par les tests ».
//   - durées d'auteur, largeurs, virages serrés, temps de génération, coût d'un rejeu : 60 dates consécutives ;
//   - taux de validation par thème : 12 dates × 6 tentatives, chaque thème forcé.
// Variables : `RHYTHM=1` (ajoute le rythme par figure), `DAYS` (60), `FROM` (« 2026-10-06 »), `VALIDATION_DAYS` (12), `VALIDATION_ATTEMPTS` (6), `FAST=1` (n'exécute que les 20 premières dates).

const DAYS = Number(process.env.DAYS ?? (process.env.FAST ? 20 : 60));
const VALIDATION_DAYS = Number(process.env.VALIDATION_DAYS ?? (process.env.FAST ? 6 : 12));
const VALIDATION_ATTEMPTS = Number(process.env.VALIDATION_ATTEMPTS ?? 6);
const [fy = 2026, fm = 10, fd = 6] = (process.env.FROM ?? "2026-10-06").split("-").map(Number);
const FIRST_DAY = daysFromCivil(fy, fm, fd);

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)} %` : "—");
const sec = (ms: number) => (ms / 1000).toFixed(1);

/** Largeurs (m) distinctes d'un circuit : avant le lot 12, une seule (14 m). */
function widthsOf(blocks: Block[]): number[] {
  const set = new Set<number>();
  for (const b of blocks) {
    const w = b as Block & { w0?: number; w1?: number };
    set.add(w.w0 ?? 14);
    set.add(w.w1 ?? 14);
  }
  return [...set].sort((a, b) => a - b);
}

/** Virages serrés (rayon d'une cellule, hors virages larges) : total et plus longue suite d'affilée. */
function tightTurns(blocks: Block[]): { total: number; run: number } {
  let total = 0;
  let run = 0;
  let best = 0;
  for (const b of blocks) {
    if (isCurve(b.kind) && !isWide(b.kind)) {
      total++;
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return { total, run: best };
}

console.log(`SIM_VERSION ${SIM_VERSION} · GENERATOR_VERSION ${GENERATOR_VERSION} · fenêtre ${AUTHOR_MIN_MS / 1000}–${AUTHOR_MAX_MS / 1000} s\n`);

// --- 1. Soixante dates -------------------------------------------------------------------------

const rows: { c: DailyCircuit; genMs: number; tight: { total: number; run: number }; widths: number[]; replayMs: number; maxSpeed: number; fastShare: number }[] = [];
for (let i = 0; i < DAYS; i++) {
  const t0 = performance.now();
  const c = dailyCircuit(FIRST_DAY + i);
  const genMs = performance.now() - t0;
  const t1 = performance.now();
  const pilot = c.fallback ? null : bestPilotRun(c.track);
  const reps = pilot ? 3 : 0;
  for (let k = 0; k < reps; k++) replayRace(c.track, pilot!.replay);
  const replayMs = reps ? (performance.now() - t1 - 0) / reps : 0;
  rows.push({
    c,
    genMs,
    tight: tightTurns(c.track.blocks),
    widths: widthsOf(c.track.blocks),
    replayMs,
    maxSpeed: pilot?.maxSpeed ?? 0,
    fastShare: pilot ? pilot.fastTicks / pilot.ticks : 0,
  });
}
const times = rows.map((r) => r.c.authorMs);
const inWindow = times.filter((t) => t >= 30_000 && t <= 40_000).length;
console.log(`## ${DAYS} dates à partir du ${rows[0]!.c.date}`);
console.log(`temps d'auteur : min ${sec(Math.min(...times))} s · moyen ${sec(mean(times))} s · max ${sec(Math.max(...times))} s ; dans [30 ; 40] s : ${inWindow}/${rows.length}`);
const hist = new Map<number, number>();
for (const t of times) hist.set(Math.floor(t / 2000) * 2, (hist.get(Math.floor(t / 2000) * 2) ?? 0) + 1);
console.log(`répartition (tranches de 2 s) : ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}–${k + 2} s : ${n}`).join(" · ")}`);
console.log(`circuits de secours (aucune tentative n'a abouti) : ${rows.filter((r) => r.c.fallback).length}`);
console.log(`tentative retenue : moyenne ${mean(rows.map((r) => r.c.attempt)).toFixed(1)} · max ${Math.max(...rows.map((r) => r.c.attempt))}`);
console.log(`blocs : moyenne ${mean(rows.map((r) => r.c.track.blocks.length)).toFixed(1)} · virages larges (L2/R2) : ${mean(rows.map((r) => r.c.track.blocks.filter((b) => isWide(b.kind)).length)).toFixed(1)} par circuit`);
// Relief et sauts (lot 17).
const reliefs = rows.map((r) => (r.c.fallback ? 0 : reliefOf(r.c.spec.split(" "))));
console.log(`dénivelé (point le plus haut − le plus bas de la route) : min ${Math.min(...reliefs)} · moyen ${mean(reliefs).toFixed(1)} · max ${Math.max(...reliefs)} m ; au moins ${MIN_RELIEF} m : ${reliefs.filter((x) => x >= MIN_RELIEF).length}/${rows.length}`);
const slopeBlocks = rows.map((r) => r.c.track.blocks.filter((b) => b.kind === "up" || b.kind === "down").length);
const steepBlocks = rows.map((r) => r.c.track.blocks.filter((b) => (b.kind === "up" || b.kind === "down") && Math.abs(b.rise) > 4).length);
console.log(`pentes : ${mean(slopeBlocks).toFixed(1)} blocs par circuit dont ${mean(steepBlocks).toFixed(1)} raides (2 ou 3 niveaux) ; circuits avec un dos d'âne (montée raide puis descente raide) : ${rows.filter((r) => /\b[UD][23] [UD][23]\b/.test(r.c.spec)).length}/${rows.length}`);
const jumpsBy = (name: string) => rows.filter((r) => r.c.theme === name);
console.log(`sauts : ${THEME_NAMES.map((n) => `${n} ${jumpsBy(n).filter((r) => trackJumps(r.c.track).length > 0).length}/${jumpsBy(n).length}`).join(" · ")} circuits avec au moins un vrai saut`);
const jumpKinds = new Map<string, number>();
for (const r of rows) for (const j of trackJumps(r.c.track)) jumpKinds.set(`${j.gapCells * 32} m, bord ${j.rise >= 0 ? "+" : ""}${j.rise} m`, (jumpKinds.get(`${j.gapCells * 32} m, bord ${j.rise >= 0 ? "+" : ""}${j.rise} m`) ?? 0) + 1);
console.log(`types de saut : ${[...jumpKinds.entries()].sort().map(([k, n]) => `${k} × ${n}`).join(" · ")}`);
const pilots = rows.map((r) => (r.c.fallback ? null : bestPilotRun(r.c.track)));
const margins = pilots.flatMap((p) => (p ? p.jumps.map((j) => j.speed / j.jump.minSpeed) : []));
console.log(`vitesse du pilote au bord de la rampe, en multiple du plancher de la fenêtre : min ${margins.length ? Math.min(...margins).toFixed(2) : "—"} · moyenne ${margins.length ? mean(margins).toFixed(2) : "—"} (exigé ≥ 1,08)`);
console.log(`sections sans rebords : ${rows.filter((r) => r.c.track.blocks.some((b) => b.open)).length}/${rows.length} circuits (${THEME_NAMES.map((n) => `${n} ${jumpsBy(n).filter((r) => r.c.track.blocks.some((b) => b.open)).length}/${jumpsBy(n).length}`).join(" · ")}) ; chutes du pilote : ${pilots.filter((p) => p && p.respawns > 0).length}`);
// Cuves (lot 18).
const cuveKind = (r: { c: DailyCircuit }) => {
  const bs = r.c.track.blocks.filter((b) => b.cuve);
  return { bowl: bs.some((b) => !isCurve(b.kind) && b.cuve === 3), wall: bs.some((b) => !isCurve(b.kind) && b.cuve !== 3), turn: bs.some((b) => isCurve(b.kind)) };
};
const withCuve = rows.filter((r) => r.c.track.blocks.some((b) => b.cuve));
console.log(`cuves : ${THEME_NAMES.map((n) => `${n} ${jumpsBy(n).filter((r) => r.c.track.blocks.some((b) => b.cuve)).length}/${jumpsBy(n).length}`).join(" · ")} circuits avec une cuve ; types : cuve droite × ${withCuve.filter((r) => cuveKind(r).bowl).length} · mur latéral × ${withCuve.filter((r) => cuveKind(r).wall).length} · virage en cuve × ${withCuve.filter((r) => cuveKind(r).turn).length}`);
const turnRows = rows.filter((r) => cuveKind(r).turn);
const straightRows = rows.filter((r) => cuveKind(r).bowl || cuveKind(r).wall);
const onWall = (list: typeof rows) => list.filter((r) => pilots[rows.indexOf(r)]?.wall).length;
console.log(`cuves : prises sur la paroi par le pilote d'auteur (le plus rapide des deux) : virages ${onWall(turnRows)}/${turnRows.length} · droites ${onWall(straightRows)}/${straightRows.length} · ensemble ${onWall([...turnRows, ...straightRows])}/${turnRows.length + straightRows.length}`);
console.log(`largeurs : au moins deux par circuit : ${rows.filter((r) => r.widths.length >= 2).length}/${rows.length} ; largeurs vues : ${[...new Set(rows.flatMap((r) => r.widths))].sort((a, b) => a - b).join(", ")} m`);
console.log(`virages serrés : moyenne ${mean(rows.map((r) => r.tight.total)).toFixed(1)} · max ${Math.max(...rows.map((r) => r.tight.total))} ; deux d'affilée : ${rows.filter((r) => r.tight.run >= 2).length} circuit(s)`);
const peaks = rows.map((r) => r.maxSpeed);
const flat = DEFAULT_CAR_PARAMS.maxSpeed;
console.log(`vitesse maximale du pilote : min ${Math.min(...peaks).toFixed(1)} · moyenne ${mean(peaks).toFixed(1)} · max ${Math.max(...peaks).toFixed(1)} m/s (pointe du plat ${flat} m/s) ; ≥ +30 % (${FAST_PEAK.toFixed(1)} m/s) : ${peaks.filter((v) => v >= FAST_PEAK).length}/${rows.length}`);
const shares = rows.map((r) => r.fastShare);
console.log(`part du temps au-delà de la pointe du plat : moyenne ${(100 * mean(shares)).toFixed(0)} % · min ${(100 * Math.min(...shares)).toFixed(0)} % · max ${(100 * Math.max(...shares)).toFixed(0)} %`);
// Lot 20 : rythme. Part du temps à plein gaz, freinages ou relâchements, plus longue ligne droite sans rien.
const fullShares = pilots.map((p) => (p ? p.fullThrottleTicks / p.ticks : 0));
console.log(`part du temps à plein gaz (sans frein) : moyenne ${(100 * mean(fullShares)).toFixed(0)} % · min ${(100 * Math.min(...fullShares)).toFixed(0)} % · max ${(100 * Math.max(...fullShares)).toFixed(0)} %`);
const lifts = pilots.map((p) => p?.liftEvents ?? 0);
console.log(`freinages ou relâchements par circuit (≥ 0,1 s, > 10 m/s) : moyenne ${mean(lifts).toFixed(1)} · min ${Math.min(...lifts)} · max ${Math.max(...lifts)}`);
const plainRuns = rows.map((r) => (r.c.fallback ? 0 : longestPlainStraight(r.c.spec.split(" "))));
console.log(`plus longue ligne droite sans rien (blocs « S » consécutifs, revêtement et largeur sans effet) : moyenne ${mean(plainRuns).toFixed(1)} · max ${Math.max(...plainRuns)} blocs (${Math.max(...plainRuns) * 32} m)`);
// Lot 20 : figures.
const figNames = rows.map((r) => r.c.figures.map((f) => f.name));
const perCircuit = figNames.map((f) => f.length);
console.log(`figures par circuit : moyenne ${mean(perCircuit).toFixed(1)} · min ${Math.min(...perCircuit)} · max ${Math.max(...perCircuit)} ; répétition d'une figure dans un circuit : ${figNames.filter((f) => new Set(f).size !== f.length).length} circuit(s)`);
const usedFigs = new Map<string, number>();
for (const f of figNames.flat()) usedFigs.set(f, (usedFigs.get(f) ?? 0) + 1);
console.log(`figures utilisées sur ${DAYS} dates : ${usedFigs.size}/${FIGURES.length} (jamais : ${FIGURES.filter((f) => !usedFigs.has(f.name)).map((f) => f.name).join(", ") || "—"})`);
console.log(`  emplois : ${[...usedFigs.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
const catCount = (r: string[], cat: string) => r.filter((n) => figureByName(n)!.category === cat).length;
console.log(`répartition par catégorie (moyenne par circuit) : ${FIGURE_CATEGORIES.map((c) => `${c} ${mean(figNames.map((r) => catCount(r, c))).toFixed(1)}`).join(" · ")}`);
const techniques = figNames.map((r) => catCount(r, "technique"));
console.log(`techniques par circuit : min ${Math.min(...techniques)} · moyenne ${mean(techniques).toFixed(1)} ; circuits à moins de deux : ${techniques.filter((t) => t < 2).length}`);
const common: number[] = [];
for (let i = 1; i < figNames.length; i++) common.push(figNames[i]!.filter((n) => figNames[i - 1]!.includes(n)).length);
console.log(`figures en commun entre deux jours consécutifs : moyenne ${mean(common).toFixed(2)} · max ${Math.max(...common)} (${common.filter((c) => c === 0).length} paires sans aucune)`);
// Estimation de durée (`estimateSeconds`) : sert à refuser un circuit trop long avant de faire rouler le pilote, et à choisir les figures.
const estErr = rows.filter((r) => !r.c.fallback).map((r) => 0.95 * estimateSeconds(r.c.spec.split(" ")) - r.c.authorMs / 1000);
console.log(`estimation de durée (0,95 × estimateSeconds − temps d'auteur) : écart moyen ${mean(estErr.map(Math.abs)).toFixed(1)} s · biais ${mean(estErr).toFixed(1)} s · pire ${Math.max(...estErr.map(Math.abs)).toFixed(1)} s`);
// Rythme par figure (`RHYTHM=1`, plus long) : secondes hors plein gaz par passage, dans les circuits mesurés. Ces nombres sont le champ `off` de chaque figure.
if (process.env.RHYTHM) {
  const acc = new Map<string, { n: number; t: number; off: number }>();
  for (const r of rows) {
    if (r.c.fallback) continue;
    const best = bestPilotRun(r.c.track)!;
    const race = createRace(r.c.track);
    const drive = createAutopilot(r.c.track, { grip: best.grip, wall: best.wall });
    const owner = (bi: number) => r.c.figures.find((f) => bi >= f.from && bi < f.to)?.name ?? "(liaison)";
    const seen = new Set<string>();
    for (let g = 0; race.finishMs < 0 && g < 120 * 120; g++) {
      const input = drive(race);
      const b = r.c.track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
      const name = b ? owner(b.index) : "hors";
      const e = acc.get(name) ?? { n: 0, t: 0, off: 0 };
      if (!seen.has(name)) {
        seen.add(name);
        e.n++;
      }
      e.t++;
      if (!(input.throttle >= AXIS_MAX && input.brake === 0 && !race.car.cut)) e.off++;
      acc.set(name, e);
      stepRace(race, input);
    }
  }
  console.log("rythme par figure (passages · durée · hors plein gaz par passage) :");
  for (const [k, e] of [...acc].sort((a, b) => b[1].off / b[1].n - a[1].off / a[1].n)) console.log(`  ${k.padEnd(24)} ${String(e.n).padStart(3)} · ${(e.t / e.n / 120).toFixed(1).padStart(5)} s · ${(e.off / e.n / 120).toFixed(2)} s`);
}
const gen = rows.map((r) => r.genMs);
console.log(`génération : moyenne ${mean(gen).toFixed(0)} ms · max ${Math.max(...gen).toFixed(0)} ms`);
const rep = rows.map((r) => r.replayMs).filter((x) => x > 0);
console.log(`rejeu d'une course d'auteur : moyenne ${mean(rep).toFixed(1)} ms · max ${Math.max(...rep).toFixed(1)} ms`);
console.log(`médailles : bronze (×1,40 de l'auteur) : ${sec(Math.min(...times) * 1.4)} s (min) → ${sec(Math.max(...times) * 1.4)} s (max) ; au-dessus de 45 s : ${times.filter((t) => t * 1.4 > 45_000).length}/${times.length}`);
console.log(`facteurs candidats (non appliqués) : part des circuits dont la médaille tient en 45 s — ${[1.4, 1.3, 1.25, 1.2, 1.15, 1.1, 1.08].map((f) => `×${f.toFixed(2).replace(".", ",")} : ${pct(times.filter((t) => t * f <= 45_000).length, times.length)}`).join(" · ")}`);

const byTheme = new Map<string, number[]>();
for (const r of rows) byTheme.set(r.c.theme, [...(byTheme.get(r.c.theme) ?? []), r.c.authorMs]);
console.log(`par thème (du jour) : ${THEME_NAMES.map((n) => `${n} ${byTheme.get(n)?.length ?? 0} jours, ${byTheme.get(n) ? sec(mean(byTheme.get(n)!)) : "—"} s`).join(" · ")}`);
console.log(`plein gaz par thème (du jour) : ${THEME_NAMES.map((n) => { const ix = rows.map((r, i) => (r.c.theme === n ? i : -1)).filter((i) => i >= 0); return `${n} ${ix.length ? (100 * mean(ix.map((i) => fullShares[i]!))).toFixed(0) : "—"} % (${ix.length ? mean(ix.map((i) => lifts[i]!)).toFixed(1) : "—"} relâchements)`; }).join(" · ")}`);

// --- 2. Taux de validation par thème -----------------------------------------------------------

console.log(`\n## Taux de validation par thème (${VALIDATION_DAYS} dates × ${VALIDATION_ATTEMPTS} tentatives, thème forcé)`);
console.log("thème      | construit | pilote finit | dans la fenêtre | portion rapide | durée moyenne | vitesse max | génération/tentative");
for (const name of THEME_NAMES) {
  const theme = themeByName(name)!;
  let total = 0;
  let composed = 0;
  let finished = 0;
  let accepted = 0;
  const durations: number[] = [];
  const peaksTheme: number[] = [];
  let accepted2 = 0; // dans la fenêtre ET au moins une portion rapide
  const t0 = performance.now();
  for (let d = 0; d < VALIDATION_DAYS; d++) {
    for (let a = 0; a < VALIDATION_ATTEMPTS; a++) {
      total++;
      const spec = composeSpec(FIRST_DAY + d, a, theme);
      if (!spec) continue;
      composed++;
      const pilot = bestPilotRun(parseTrack("mesure", spec));
      if (!pilot) continue;
      finished++;
      durations.push(pilot.finishMs);
      peaksTheme.push(pilot.maxSpeed);
      if (pilot.finishMs >= AUTHOR_MIN_MS && pilot.finishMs <= AUTHOR_MAX_MS) {
        accepted++;
        if (pilot.maxSpeed >= FAST_PEAK) accepted2++;
      }
    }
  }
  const per = (performance.now() - t0) / total;
  console.log(
    `${name.padEnd(10)} | ${pct(composed, total).padStart(9)} | ${pct(finished, composed).padStart(12)} | ${pct(accepted, composed).padStart(15)} | ${pct(accepted2, composed).padStart(14)} | ${durations.length ? sec(mean(durations)).padStart(10) + " s" : "—".padStart(12)} | ${peaksTheme.length ? mean(peaksTheme).toFixed(0).padStart(7) + " m/s" : "—".padStart(11)} | ${per.toFixed(0)} ms`,
  );
}
console.log(`\n(MAX_ATTEMPTS = ${MAX_ATTEMPTS}. « construit » : le générateur a posé tous les blocs ; « pilote finit » : sur les circuits construits ; « fenêtre » : sur les circuits construits ; « portion rapide » : dans la fenêtre ET pilote ≥ +30 % de la pointe du plat, sur les circuits construits.)`);
