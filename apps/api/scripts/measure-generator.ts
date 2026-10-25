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
  choiceMoments,
  runPilot,
  turnReports,
  humanRun,
  composeFigures,
  generatorVersionOf,
  BASCULE_LOT_34,
  BASCULE_LOT_48,
  themeForDay,
  medalsFor,
  type BlockSurface,
  type Track,
  formatDay,
  TRAP_SLACK,
  type ChoiceMoments,
  type ThemeName,
  type Block,
  type DailyCircuit,
} from "@cdj/sim";

// `npm run measure:generator` : mesure le générateur de circuits (lot 12). À relancer après toute règle de
// générateur, toute modification du pilote ou de la physique : « toute règle de générateur se valide par ce script
// (durées, taux de validation par thème), pas seulement par les tests ».
//   - durées d'auteur, largeurs, virages serrés, temps de génération, coût d'un rejeu : 60 dates consécutives ;
//   - taux de validation par thème : 12 dates × 6 tentatives, chaque thème forcé.
//   - lot 34 : virages-pièges et contacts du pilote « humain correct », générateur d'avant (v15) et d'après (v16) sur les mêmes dates.
// Variables : `RHYTHM=1` (ajoute le rythme par figure), `DAYS` (60), `FROM` (« 2026-10-06 »), `VALIDATION_DAYS` (12), `VALIDATION_ATTEMPTS` (6), `FAST=1` (n'exécute que les 20 premières dates).
// Lot 34 : `GENERATOR` (version imposée aux sections 1 et 2, la dernière par défaut, quelle que soit la date), `COMPARE` (« 15,16 » : versions
// comparées par la section 3 et la section 2), `TRAP_DAYS` (60) et `TRAP_THEME_DAYS` (12) : dates de la section 3 (à partir de `FROM`).
// Lot 48 : section 4 (herbe de course), à la fin ; `HERBE=1` ne lance qu'elle (≈ 20 s).

const DAYS = Number(process.env.DAYS ?? (process.env.FAST ? 20 : 60));
const VALIDATION_DAYS = Number(process.env.VALIDATION_DAYS ?? (process.env.FAST ? 6 : 12));
const VALIDATION_ATTEMPTS = Number(process.env.VALIDATION_ATTEMPTS ?? 6);
const [fy = 2026, fm = 10, fd = 6] = (process.env.FROM ?? "2026-10-06").split("-").map(Number);
const FIRST_DAY = daysFromCivil(fy, fm, fd);
const GENERATOR = Number(process.env.GENERATOR ?? GENERATOR_VERSION);
const COMPARE = (process.env.COMPARE ?? "15,16").split(",").map(Number);
const TRAP_DAYS = Number(process.env.TRAP_DAYS ?? (process.env.FAST ? 20 : 60));
const TRAP_THEME_DAYS = Number(process.env.TRAP_THEME_DAYS ?? (process.env.FAST ? 4 : 12));

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

// --- 4. Lot 48 : l'herbe de course --------------------------------------------------------------
// 20 circuits de Campagne avant la bascule (l'herbe d'avant, `grass`, la dernière version d'avant) et 20 après (l'herbe de course, `turf`) :
// part des blocs, temps passé dessus par le pilote d'auteur (le bloc sous la voiture), temps perdu (le même circuit, ce revêtement remplacé par la
// route, refait par le pilote), durée de l'auteur et médaille d'or (la course correcte, 30–45 s visés).
function sectionHerbe() {
  const letter: Record<"grass" | "turf", string> = { grass: "h", turf: "z" };
  const surfaceOff = (spec: string, l: string) =>
    spec
      .split(" ")
      .map((t) => {
        const [b, m] = t.split("@");
        const [k, mods = ""] = b!.split("/");
        const mm = mods.replace(new RegExp(`(^|[^~])${l}`), "$1");
        return (mm ? `${k}/${mm}` : k) + (m !== undefined ? `@${m}` : "");
      })
      .join(" ");
  const onSurface = (track: Track, surface: BlockSurface, grip: number, wall: boolean): number => {
    const race = createRace(track);
    const drive = createAutopilot(track, { grip, wall });
    let on = 0;
    for (let i = 0; i < 120 * 90 && race.finishMs < 0; i++) {
      stepRace(race, drive(race));
      const b = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)));
      if (b?.surface === surface) on++;
    }
    return on / 120;
  };
  for (const [label, surface, from, step] of [["avant la bascule (herbe d'avant)", "grass", BASCULE_LOT_48 - 1, -1], ["après la bascule (herbe de course)", "turf", BASCULE_LOT_48, 1]] as const) {
    const rows: { date: string; g: number; share: number; on: number; lost: number; author: number; gold: number }[] = [];
    for (let d = from; rows.length < 20; d += step) {
      if (themeForDay(d).name !== "campagne") continue;
      const c = dailyCircuit(d);
      const n = c.track.blocks.filter((b) => b.surface === surface).length;
      const best = bestPilotRun(c.track, { cut: false })!;
      const road = n > 0 ? bestPilotRun(parseTrack("sans", surfaceOff(c.spec, letter[surface])), { cut: false }) : best;
      rows.push({ date: formatDay(d), g: generatorVersionOf(d), share: n / c.track.blocks.length, on: n > 0 ? onSurface(c.track, surface, best.grip, best.wall) : 0, lost: road ? (best.finishMs - road.finishMs) / 1000 : NaN, author: c.authorMs, gold: medalsFor(c.authorMs, d).gold });
    }
    console.log(`\n4. Lot 48 — Campagne ${label}, 20 circuits`);
    console.log("  date        v   part des blocs  temps dessus  perdu   auteur (pilote)  or");
    for (const r of rows) console.log(`  ${r.date}  ${r.g}  ${(100 * r.share).toFixed(1).padStart(5)} %        ${r.on.toFixed(1).padStart(4)} s      ${r.lost.toFixed(2).padStart(5)} s  ${sec(r.author)} s           ${sec(r.gold)} s`);
    const m = (f: (r: (typeof rows)[number]) => number) => mean(rows.map(f));
    console.log(`  moyenne : ${(100 * m((r) => r.share)).toFixed(1)} % des blocs · ${m((r) => r.on).toFixed(1)} s dessus · ${m((r) => r.lost).toFixed(2)} s perdues · auteur ${sec(m((r) => r.author))} s · or ${sec(m((r) => r.gold))} s · circuits qui en ont : ${rows.filter((r) => r.share > 0).length}/20 · or dans 30–45 s : ${rows.filter((r) => r.gold >= 30_000 && r.gold <= 45_000).length}/20`);
  }
}
if (process.env.HERBE) {
  sectionHerbe();
  process.exit(0);
}

console.log(`SIM_VERSION ${SIM_VERSION} · GENERATOR_VERSION ${GENERATOR_VERSION} (sections 1 et 2 : v${GENERATOR} imposée ; bascule du lot 34 : ${formatDay(BASCULE_LOT_34)}, v${generatorVersionOf(BASCULE_LOT_34 - 1)} avant) · fenêtre ${AUTHOR_MIN_MS / 1000}–${AUTHOR_MAX_MS / 1000} s\n`);

// --- 1. Soixante dates -------------------------------------------------------------------------

const rows: { c: DailyCircuit; genMs: number; tight: { total: number; run: number }; widths: number[]; replayMs: number; maxSpeed: number; fastShare: number }[] = [];
for (let i = 0; i < DAYS; i++) {
  const t0 = performance.now();
  const c = dailyCircuit(FIRST_DAY + i, 0, null, GENERATOR);
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

// Lot 21 : identité des thèmes (bas-côtés, route bosselée, règle propre) et moments de choix.
const SHOULDER_LABEL: Record<string, string> = { grass: "herbe", gravel: "terre et gravier", snow: "neige poudreuse" };
console.log("bas-côtés par thème (du jour) : " + THEME_NAMES.map((n) => {
  const list = jumpsBy(n);
  if (!list.length) return `${n} —`;
  const kinds = new Map<string, number>();
  for (const r of list) for (const b of r.c.track.blocks) {
    const k = b.shoulder ?? (b.open ? "vide" : null);
    if (k) kinds.set(k, (kinds.get(k) ?? 0) + 1);
  }
  const share = mean(list.map((r) => r.c.track.blocks.filter((b) => b.shoulder || b.open).length / r.c.track.blocks.length));
  return `${n} ${[...kinds.keys()].map((k) => SHOULDER_LABEL[k] ?? k).join("+") || "aucun"} (${(100 * share).toFixed(0)} % des blocs)`;
}).join(" · "));
console.log(`route bosselée : ${THEME_NAMES.map((n) => `${n} ${jumpsBy(n).filter((r) => r.c.track.blocks.some((b) => b.bumpy)).length}/${jumpsBy(n).length}`).join(" · ")} circuits`);
const REQUIRED: Record<string, string[]> = {};
for (const n of THEME_NAMES) REQUIRED[n] = [...(themeByName(n)!.figures.require ?? [])];
console.log(`règle propre (figure obligatoire) : ${THEME_NAMES.filter((n) => REQUIRED[n]!.length).map((n) => `${n} ${jumpsBy(n).filter((r) => r.c.figures.some((f) => REQUIRED[n]!.includes(f.name))).length}/${jumpsBy(n).length} (${REQUIRED[n]!.join(" ou ")})`).join(" · ")}`);
const choices: (ChoiceMoments | null)[] = rows.map((r, i) => (pilots[i] ? choiceMoments(r.c.track, pilots[i]!) : null));
const choiceKeys = ["brakes", "coasts", "cuves", "cuttable", "freezes", "total"] as const;
const CHOICE_LABEL: Record<(typeof choiceKeys)[number], string> = { brakes: "freinages", coasts: "roue libre", cuves: "paroi/fond", cuttable: "virages coupables", freezes: "sauts figés", total: "total" };
console.log("moments de choix par thème (du jour, moyenne par circuit) :");
console.log("  thème      | " + choiceKeys.map((k) => CHOICE_LABEL[k].padStart(17)).join(" | "));
for (const n of [...THEME_NAMES, "ensemble"]) {
  const list = choices.filter((c, i) => c && (n === "ensemble" || rows[i]!.c.theme === n)) as ChoiceMoments[];
  if (!list.length) continue;
  console.log(`  ${n.padEnd(10)} | ` + choiceKeys.map((k) => mean(list.map((c) => c[k])).toFixed(1).padStart(17)).join(" | ") + (n !== "ensemble" ? `   (min total ${Math.min(...list.map((c) => c.total))})` : ""));
}
// Couper par le bas-côté (mesure, le pilote d'auteur ne coupe pas) : même pilote, avec 0,5 / 1 / 3 m de plus vers l'intérieur des virages bordés.
const cutGain: { cut: number; faster: number; slower: number; best: number }[] = [0.5, 1, 3].map((cut) => ({ cut, faster: 0, slower: 0, best: 0 }));
let cutCircuits = 0;
for (let i = 0; i < rows.length; i++) {
  const author = pilots[i];
  if (!author || !rows[i]!.c.track.blocks.some((b) => b.shoulder)) continue;
  const p = author.cut ? runPilot(rows[i]!.c.track, { grip: author.grip, wall: author.wall }) : author;
  cutCircuits++;
  for (const g of cutGain) {
    const run = runPilot(rows[i]!.c.track, { grip: p.grip, wall: p.wall, cut: g.cut });
    if (!run.valid) {
      g.slower++;
      continue;
    }
    if (run.finishMs < p.finishMs) g.faster++;
    else if (run.finishMs > p.finishMs) g.slower++;
    g.best = Math.min(g.best, run.finishMs - p.finishMs);
  }
}
console.log(`couper par le bas-côté (même pilote sans / avec coupe, ${cutCircuits} circuits à bas-côtés ; le pilote d'auteur garde la coupe de 0,5 m sur ${pilots.filter((p) => p?.cut).length}) : ${cutGain.map((g) => `${g.cut} m → plus rapide ${g.faster}, plus lent ${g.slower} (meilleur gain ${(-g.best / 1000).toFixed(2)} s)`).join(" · ")}`);

const byTheme = new Map<string, number[]>();
for (const r of rows) byTheme.set(r.c.theme, [...(byTheme.get(r.c.theme) ?? []), r.c.authorMs]);
console.log(`par thème (du jour) : ${THEME_NAMES.map((n) => `${n} ${byTheme.get(n)?.length ?? 0} jours, ${byTheme.get(n) ? sec(mean(byTheme.get(n)!)) : "—"} s`).join(" · ")}`);
console.log(`plein gaz par thème (du jour) : ${THEME_NAMES.map((n) => { const ix = rows.map((r, i) => (r.c.theme === n ? i : -1)).filter((i) => i >= 0); return `${n} ${ix.length ? (100 * mean(ix.map((i) => fullShares[i]!))).toFixed(0) : "—"} % (${ix.length ? mean(ix.map((i) => lifts[i]!)).toFixed(1) : "—"} relâchements)`; }).join(" · ")}`);

// --- 2. Taux de validation par thème -----------------------------------------------------------

for (const G of COMPARE) {
console.log(`\n## Taux de validation par thème (${VALIDATION_DAYS} dates × ${VALIDATION_ATTEMPTS} tentatives, thème forcé, générateur v${G})`);
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
      const spec = composeSpec(FIRST_DAY + d, a, theme, 0, G);
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
}
console.log(`\n(MAX_ATTEMPTS = ${MAX_ATTEMPTS}. « construit » : le générateur a posé tous les blocs ; « pilote finit » : sur les circuits construits ; « fenêtre » : sur les circuits construits ; « portion rapide » : dans la fenêtre ET pilote ≥ +30 % de la pointe du plat, sur les circuits construits.)`);

// --- 3. Lot 34 : virages-pièges après les boosts ------------------------------------------------
// Pour chaque virage (`turnReports`, traps.ts) : point libre (fin de la dernière poussée, ou sortie du virage précédent), vitesse d'arrivée
// possible (plein gaz depuis ce point), vitesse de passage du pilote d'auteur, distance de freinage nécessaire contre distance disponible.
// Virage-piège : une approche rapide (poussée ou > 52,8 m/s), un vrai freinage, une marge sous 0,3 s et un mur à l'extérieur ; « techniques » :
// les mêmes marges courtes sans approche rapide (un large puis un serré), hors de la définition, comptées à part. Pilote « humain correct » (`humanRun`) : l'auteur, qui ne freine
// ni pendant une poussée ni dans les 0,3 s qui suivent sa fin, la sortie d'un virage ou une réception ; on compte ses contacts avec un rebord.

interface TrapRow { theme: ThemeName; traps: number; technical: number; contacts: number; boosted: number; authorContacts: number; ms: number; fallback: boolean; braking: { kept: number; added: number; escapes: number }; turns: ReturnType<typeof turnReports> }
function trapRow(day: number, theme: ThemeName | null, G: number): TrapRow {
  const c = dailyCircuit(day, 0, theme, G);
  const empty = { kept: 0, added: 0, escapes: 0 };
  if (c.fallback) return { theme: c.theme, traps: 0, technical: 0, contacts: 0, boosted: 0, authorContacts: 0, ms: c.authorMs, fallback: true, braking: empty, turns: [] };
  const run = bestPilotRun(c.track)!;
  const turns = turnReports(c.track, run);
  const human = humanRun(c.track, run);
  const author = humanRun(c.track, run, 0);
  const braking = composeFigures(day, c.attempt, themeByName(c.theme)!, 0, G)?.braking ?? empty;
  // Hors de la définition (approche sous la pointe, sans poussée) : les enchaînements techniques à marge courte, comptés à part.
  const technical = turns.filter((t) => !t.fast && t.wall && t.slack < TRAP_SLACK && t.free - t.turn >= 8).length;
  return { theme: c.theme, traps: turns.filter((t) => t.trap).length, technical, contacts: human.contacts, boosted: human.boostedContacts, authorContacts: author.contacts, ms: c.authorMs, fallback: false, braking, turns };
}
const trapSummary = (label: string, list: TrapRow[]) => {
  const ok = list.filter((r) => !r.fallback);
  if (!ok.length) return `  ${label.padEnd(10)} | —`;
  const traps = ok.map((r) => r.traps);
  const ms = ok.map((r) => r.ms);
  return `  ${label.padEnd(10)} | ${String(ok.length).padStart(3)} | ${mean(traps).toFixed(2).padStart(6)} | ${String(Math.max(...traps)).padStart(3)} | ${String(traps.filter((t) => t > 1).length).padStart(4)} | ${mean(ok.map((r) => r.technical)).toFixed(2).padStart(10)} | ${mean(ok.map((r) => r.contacts)).toFixed(2).padStart(8)} | ${mean(ok.map((r) => r.boosted)).toFixed(2).padStart(13)} | ${mean(ok.map((r) => r.authorContacts)).toFixed(2).padStart(6)} | ${sec(mean(ms)).padStart(5)} s [${sec(Math.min(...ms))}–${sec(Math.max(...ms))}] | ${String(list.length - ok.length).padStart(7)}`;
};
for (const G of COMPARE) {
  const t0 = performance.now();
  const daily: TrapRow[] = [];
  for (let i = 0; i < TRAP_DAYS; i++) daily.push(trapRow(FIRST_DAY + i, null, G));
  const themed = new Map<ThemeName, TrapRow[]>();
  for (const name of THEME_NAMES) {
    const list: TrapRow[] = [];
    for (let i = 0; i < TRAP_THEME_DAYS; i++) list.push(trapRow(FIRST_DAY + i, name, G));
    themed.set(name, list);
  }
  console.log(`\n## Lot 34 : virages-pièges et contacts, générateur v${G} (${TRAP_DAYS} dates du jour, puis ${TRAP_THEME_DAYS} circuits par thème forcé, à partir du ${formatDay(FIRST_DAY)})`);
  console.log("  circuits   |   n | pièges | max | > 1 | techniques | contacts | après poussée | auteur | durée de l'auteur      | secours");
  console.log(trapSummary("du jour", daily));
  for (const name of THEME_NAMES) console.log(trapSummary(name, themed.get(name)!));
  const all = [...daily, ...[...themed.values()].flat()].filter((r) => !r.fallback);
  console.log(trapSummary("ensemble", all));
  const b = (k: keyof TrapRow["braking"]) => mean(all.map((r) => r.braking[k])).toFixed(2);
  console.log(`  règle du lot 34 (par circuit, ${all.length} circuits) : droites de freinage ajoutées ${b("added")} · bas-côtés imposés ${b("escapes")} · pièges gardés (signature, Ville) ${b("kept")}`);
  const turns = all.flatMap((r) => r.turns);
  const fast = turns.filter((t) => t.fast);
  const short = fast.filter((t) => t.slack < TRAP_SLACK);
  console.log(`  virages : ${turns.length} (${(turns.length / all.length).toFixed(1)} par circuit), abordés vite (poussée ou > 52,8 m/s) ${fast.length} ; parmi eux : arrivée possible ${mean(fast.map((t) => t.arrive)).toFixed(0)} m/s (max ${Math.max(...fast.map((t) => t.arrive)).toFixed(0)}), passage ${mean(fast.map((t) => t.turn)).toFixed(0)} m/s, freinage nécessaire ${mean(fast.map((t) => t.needed)).toFixed(0)} m pour ${mean(fast.map((t) => t.available)).toFixed(0)} m disponibles, marge < 0,3 s : ${short.length} (dont mur à l'extérieur : ${short.filter((t) => t.wall).length}) ; marge médiane ${fast.length ? [...fast.map((t) => t.slack)].sort((x, y) => x - y)[Math.floor(fast.length / 2)]!.toFixed(2) : "—"} s`);
  console.log(`  (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
}

sectionHerbe();
