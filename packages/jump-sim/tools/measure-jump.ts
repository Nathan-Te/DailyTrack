import { formatDay } from "@cdj/core";
import {
  AUTHOR_MAX_TICKS,
  AUTHOR_MIN_TICKS,
  DAILY_DRAWS,
  DAILY_MAX_ATTEMPTS,
  DAILY_MAX_ATTEMPTS_V4,
  EXIGENCE_RATE_MAX,
  EXIGENCE_RATE_MIN,
  JOINT_TICKS,
  MAX_DAILY_HEIGHT,
  MODULES,
  MODULE_TAGS,
  MUTATORS,
  PREMIER_JOUR_JUMP,
  TICK_RATE,
  dailyLevel,
  decodeReplay,
  fromRuns,
  initialAttempt,
  isRestedModule,
  varietyExcluded,
  PLATFORM_VERSION,
  PRESS_VERSION,
  SINGLE_CLOCK_VERSION,
  replayAttempt,
  JUMP_THEME_NAMES,
  mechanicOf,
  type DailyLevel,
  type JumpThemeName,
} from "../src/index";
import { emptyRun, secs, tiles } from "./vide";

// `npm run measure:jump -w @cdj/jump-sim` — mesures du niveau du jour (lot 5) sur 120 dates à partir de `PREMIER_JOUR_JUMP` : taux de
// validation des tirages, tirage retenu, secours, temps de l'auteur (et sa répartition par tranches de 2 s), morceaux par niveau, exigence
// (somme, par minute, profil par tiers), étiquettes, emploi de chaque morceau, morceaux en commun d'un jour au suivant, hauteur, temps de
// génération et coût d'un rejeu ; **course à vide** (lot 6) : temps au sol sans appui de saut sur les paliers (par raccord, au total) et plus
// longue course au sol sans saut ; **voies lentes** (lot 16) : nombre, surcoût, médailles ajustées. **Toute règle du générateur se juge à ces mesures.** `-- --jours=N` pour un autre nombre de dates.

const arg = process.argv.find((a) => a.startsWith("--jours="));
const DAYS = arg ? Number(arg.slice(8)) : 120;
// Lot 20 : `-- --generateur=14` mesure la référence v4 (g14, le catalogue sans plateformes) au lieu du générateur en vigueur (g15) : le comparatif du README.
// Lot 22 : `-- --generateur=15` mesure la référence v5 (g15, le catalogue sans presses) : le comparatif du README du lot 22 ; sans option, le générateur en vigueur (g16).
const SIM_VERSION = process.argv.includes("--generateur=14") ? SINGLE_CLOCK_VERSION : process.argv.includes("--generateur=15") ? PLATFORM_VERSION : PRESS_VERSION;
const sec = (t: number) => (t / TICK_RATE).toFixed(2).replace(".", ",");
const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const stats = (xs: number[]) => ({ min: Math.min(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length, max: Math.max(...xs) });

// Chauffe : le catalogue (variantes utilisables, morceaux construits) se calcule au premier appel ; on ne le compte pas.
dailyLevel(PREMIER_JOUR_JUMP - 1000, null, SIM_VERSION);

const levels: DailyLevel[] = [];
const genMs: number[] = [];
for (let k = 0; k < DAYS; k++) {
  const t0 = performance.now();
  levels.push(dailyLevel(PREMIER_JOUR_JUMP + k, null, SIM_VERSION));
  genMs.push(performance.now() - t0);
}

const out: string[] = [];
const line = (s = "") => out.push(s);
line(`## Niveau du jour — ${DAYS} dates (du ${formatDay(PREMIER_JOUR_JUMP)} au ${formatDay(PREMIER_JOUR_JUMP + DAYS - 1)})`);
line();

// ——— Tirages ———
const all = levels.flatMap((L) => L.attempts);
const impasses = all.filter((a) => a.status === "impasse").length;
const composed = all.length - impasses;
const valid = all.filter((a) => a.status === "valide").length;
const reasons = new Map<string, number>();
for (const a of all) {
  if (a.status === "valide") continue;
  const key = a.status === "impasse" ? `impasse (${a.reason.replace(/\d+/g, "n")})` : a.reason.split(" ; ").map((r) => r.replace(/-?\d+/g, "n")).join(" ; ");
  reasons.set(key, (reasons.get(key) ?? 0) + 1);
}
const chosen = levels.map((L) => L.chosen);
const fallbacks = levels.filter((L) => L.fallback).length;
line("### Tirages");
line(`| mesure | valeur |`);
line(`|---|---|`);
line(`| tirages essayés (${DAILY_DRAWS} par jour, jusqu'à ${(levels[0]?.level.simVersion ?? 0) >= SINGLE_CLOCK_VERSION ? DAILY_MAX_ATTEMPTS_V4 : DAILY_MAX_ATTEMPTS} sans tirage valide) | ${all.length} |`);
line(`| composés (sans impasse) | ${composed} (${num((100 * composed) / all.length)} %) |`);
// Lot 19 (v4) : les tirages sont prouvés dans l'ordre de leur score estimé ; un tirage composé peut être écarté sans rejeu (un mieux estimé est
// valide) ou refusé sur l'estimation (exigence, tension, respiration) : le taux qui compte est celui des tirages **rejoués**.
const spared = all.filter((a) => a.status === "écarté").length;
const estimated = all.filter((a) => a.status === "refusé" && /estimée/.test(a.reason)).length;
const replayed = composed - spared - estimated;
line(`| lot 19 : écartés sans rejeu (un mieux estimé est valide) · refusés sur l'estimation | ${spared} · ${estimated} |`);
line(`| lot 19 : **rejoués** (prouvés) · validés parmi les rejoués | ${replayed} · ${num((100 * valid) / (replayed || 1))} % |`);
line(`| **validés** (rejeu sans mort, toutes les règles) | **${valid}** (${num((100 * valid) / all.length)} % des tirages, ${num((100 * valid) / composed)} % des composés) |`);
line(`| tirage retenu (indice) : moyenne · maximum | ${num(stats(chosen).mean, 2)} · ${stats(chosen).max} |`);
line(`| jours sans tirage valide parmi les ${DAILY_DRAWS} premiers | ${levels.filter((L) => L.attempts.length > DAILY_DRAWS).length} |`);
line(`| **niveau de secours utilisé** | **${fallbacks}** |`);
line();
line("Refus et impasses :");
line();
for (const [k, n] of [...reasons].sort((a, b) => b[1] - a[1])) line(`- ${n} × ${k}`);
line();

// ——— Temps de l'auteur ———
const times = levels.map((L) => L.authorTicks);
const t = stats(times);
line("### Temps de l'auteur");
line(`min **${sec(t.min)} s** · moyenne **${sec(t.mean)} s** · max **${sec(t.max)} s** (permis : ${sec(AUTHOR_MIN_TICKS)}–${sec(AUTHOR_MAX_TICKS)} s, centre 30 s)`);
line();
line("| tranche | niveaux |");
line("|---|---|");
for (let lo = 24; lo < 42; lo += 2) {
  const n = times.filter((v) => v >= lo * TICK_RATE && v < (lo + 2) * TICK_RATE).length;
  if (n > 0 || (lo >= 26 && lo <= 38)) line(`| ${lo}–${lo + 2} s | ${n} ${"█".repeat(n)} |`);
}
const estimates = levels.map((L) => L.pieces.reduce((s, p) => s + p.solutionTicks, 0) + JOINT_TICKS * (L.pieces.length - 1));
const gap = levels.map((L, k) => L.authorTicks - estimates[k]!);
line();
line(`Écart temps de l'auteur − estimation (somme des solutions de l'entrée à la sortie${JOINT_TICKS ? ` + ${JOINT_TICKS} pas par raccord` : ", aucune course entre deux"}) : min ${stats(gap).min} · moyenne ${num(stats(gap).mean)} · max ${stats(gap).max} pas.`);
line();

// ——— Course à vide (lot 6) ———
const perJoint: number[] = [];
const jointShare: number[] = [];
const departs: number[] = [];
const arrivals: number[] = [];
const longT: number[] = [];
const longU: number[] = [];
for (const L of levels) {
  const zones = L.paliers.map((p, k) => ({ c0: p.col0, c1: k === L.paliers.length - 1 ? p.col1 + 1 : p.col1 }));
  const r = emptyRun(L.level, initialAttempt(L.level), fromRuns(decodeReplay(L.code).runs), zones);
  const joints = r.zones.slice(1, -1);
  perJoint.push(...joints);
  jointShare.push(joints.reduce((a, b) => a + b, 0) / L.authorTicks);
  departs.push(r.zones[0]!);
  arrivals.push(r.zones[r.zones.length - 1]!);
  longT.push(r.longestTicks);
  longU.push(r.longestUnits);
}
const pj = stats(perJoint);
const js = stats(jointShare);
line("### Course à vide (rediffusion de l'auteur)");
line("Temps **au sol sans appui de saut**, centre du personnage au-dessus d'un palier ; plus longue course au sol sans saut du niveau.");
line();
line(`| mesure | moyenne | max |`);
line(`|---|---|---|`);
line(`| par raccord (${perJoint.length} raccords) | ${secs(pj.mean)} s | ${secs(pj.max)} s |`);
line(`| total des raccords, en % du temps de l'auteur | ${num(100 * js.mean)} % | ${num(100 * js.max)} % |`);
line(`| palier de départ (accélération comprise) | ${secs(stats(departs).mean)} s | ${secs(stats(departs).max)} s |`);
line(`| palier d'arrivée (jusqu'à \`F\`) | ${secs(stats(arrivals).mean)} s | ${secs(stats(arrivals).max)} s |`);
line(`| plus longue course au sol sans saut (cible : moyenne ≤ 1,2 s, max ≤ 2 s) | ${secs(stats(longT).mean)} s · ${tiles(stats(longU).mean)} tuiles | ${secs(stats(longT).max)} s · ${tiles(stats(longU).max)} tuiles |`);
line();

// ——— Lot 16 : voies lentes ———
{
  const routes = levels.flatMap((L) => L.slowRoutes.map((r) => ({ L, r })));
  const perDay = levels.map((L) => L.slowRoutes.length);
  const extra = routes.map(({ r }) => r.slowTicks - r.fastTicks);
  const ratio = routes.map(({ r }) => (r.slowTicks - r.fastTicks) / r.fastTicks);
  const raised = routes.filter(({ r }) => r.extra > 0).length;
  const goldCut = levels.filter((L) => L.slowRoutes.length > 0 && L.medals.gold < Math.ceil((L.authorTicks * 110) / 100)).length;
  const bronzeUp = levels.filter((L) => L.medals.bronze > Math.ceil((L.authorTicks * 160) / 100)).length;
  const allSlow = levels.map((L) => L.slowTicks / L.authorTicks);
  line("### Voies lentes (lot 16)");
  line(`| mesure | min | moyenne | max |`);
  line(`|---|---|---|---|`);
  line(`| voies lentes par niveau | ${stats(perDay).min} | ${num(stats(perDay).mean)} | ${stats(perDay).max} |`);
  line(`| surcoût d'une voie lente (s ; règle : ≥ max(50 %, 3 s)) | ${sec(stats(extra).min)} | ${sec(stats(extra).mean)} | ${sec(stats(extra).max)} |`);
  line(`| surcoût ÷ temps de la portion | ${num(100 * stats(ratio).min)} % | ${num(100 * stats(ratio).mean)} % | ${num(100 * stats(ratio).max)} % |`);
  line(`| « toutes voies lentes » ÷ temps de l'auteur | ${num(stats(allSlow).min, 3)} | ${num(stats(allSlow).mean, 3)} | ${num(stats(allSlow).max, 3)} |`);
  line();
  line(`Cages montées pour tenir le coût : ${raised} voies sur ${routes.length}. Or abaissé sous ×1,10 : ${goldCut} niveaux ; bronze relevé au-dessus de ×1,60 : ${bronzeUp} niveaux.`);
  line();
}

// ——— Morceaux, hauteur ———
const counts = levels.map((L) => L.pieces.length);
const heights = levels.map((L) => L.level.height);
const widths = levels.map((L) => L.level.width);
line("### Forme");
line(`| mesure | min | moyenne | max |`);
line(`|---|---|---|---|`);
line(`| morceaux par niveau | ${stats(counts).min} | ${num(stats(counts).mean)} | ${stats(counts).max} |`);
line(`| hauteur (rangées, ≤ ${MAX_DAILY_HEIGHT}) | ${stats(heights).min} | ${num(stats(heights).mean)} | ${stats(heights).max} |`);
line(`| largeur (colonnes) | ${stats(widths).min} | ${num(stats(widths).mean)} | ${stats(widths).max} |`);
line();

// ——— Exigence ———
const sums = levels.map((L) => L.exigence.sum);
const rates = levels.map((L) => L.exigence.rate);
const peaks = levels.map((L) => Math.max(...L.pieces.map((p) => p.exigence)));
line("### Exigence");
line(`| mesure | min | moyenne | max |`);
line(`|---|---|---|---|`);
line(`| somme des exigences | ${stats(sums).min} | ${num(stats(sums).mean)} | ${stats(sums).max} |`);
line(`| par minute (dixièmes de point ; fenêtre ${EXIGENCE_RATE_MIN}–${EXIGENCE_RATE_MAX}) | ${stats(rates).min} | ${num(stats(rates).mean)} | ${stats(rates).max} |`);
line(`| exigence du morceau le plus exigeant | ${stats(peaks).min} | ${num(stats(peaks).mean)} | ${stats(peaks).max} |`);
for (const [k, name] of ["premier tiers", "deuxième tiers", "dernier tiers"].entries()) {
  const th = levels.map((L) => L.exigence.thirds[k]!);
  line(`| ${name} (moyenne pondérée, dixièmes) | ${stats(th).min} | ${num(stats(th).mean)} | ${stats(th).max} |`);
}
const weekdays = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const byDay = weekdays.map((_, w) => levels.filter((L) => (((L.day + 3) % 7) + 7) % 7 === w).map((L) => L.exigence.rate));
line();
line(`Par jour de la semaine (exigence par minute, moyenne) : ${weekdays.map((w, k) => `${w} ${num(stats(byDay[k]!).mean, 0)}`).join(" · ")}.`);
line();

// ——— Étiquettes, emploi des morceaux ———
line("### Étiquettes (morceaux par niveau, moyenne ; niveaux qui en ont)");
line(`| étiquette | par niveau | niveaux |`);
line(`|---|---|---|`);
for (const tag of MODULE_TAGS) {
  const per = levels.map((L) => L.pieces.filter((p) => p.tags.includes(tag)).length);
  line(`| ${tag} | ${num(stats(per).mean, 2)} | ${per.filter((n) => n > 0).length}/${DAYS} |`);
}
line();
const used = new Map<string, number>();
const variants = new Map<string, number>();
for (const L of levels) {
  for (const p of L.pieces) {
    used.set(p.id, (used.get(p.id) ?? 0) + 1);
    variants.set(`${p.id}:${p.variant}`, (variants.get(`${p.id}:${p.variant}`) ?? 0) + 1);
  }
}
line("### Emploi des morceaux (niveaux qui le contiennent ; jours où il est disponible ; variantes)");
line(`| morceau | niveaux | disponible | variantes (emplois) |`);
line(`|---|---|---|---|`);
for (const m of [...MODULES].sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0))) {
  // Lot 19 : en v4, un morceau est disponible quand la règle de variété ne l'écarte pas ; la référence v3 garde le repos par groupes.
  const avail = levels.filter((L) => (L.level.simVersion >= SINGLE_CLOCK_VERSION ? !varietyExcluded(L.day, SIM_VERSION).has(m.id) : !isRestedModule(m.id, L.day))).length;
  const vs = m.variants.map((_, v) => `${v}:${variants.get(`${m.id}:${v}`) ?? 0}`).join(" ");
  line(`| ${m.id} | ${used.get(m.id) ?? 0} | ${avail} | ${vs} |`);
}
const never = MODULES.filter((m) => !used.has(m.id)).map((m) => m.id);
const neverVariants = MODULES.flatMap((m) => m.variants.map((_, v) => `${m.id}:${v}`)).filter((k) => !variants.has(k));
line();
line(`Morceaux qui ne sortent jamais : ${never.length ? never.join(", ") : "aucun"}.`);
line(`Variantes qui ne sortent jamais : ${neverVariants.length ? neverVariants.join(", ") : "aucune"}.`);
line();

// ——— D'un jour au suivant ———
const common: number[] = [];
for (let k = 1; k < levels.length; k++) {
  const a = new Set(levels[k - 1]!.pieces.map((p) => p.id));
  common.push(levels[k]!.pieces.filter((p) => a.has(p.id)).length);
}
const c = stats(common);
line("### D'un jour au suivant");
line(`Morceaux en commun entre deux jours consécutifs : min ${c.min} · moyenne ${num(c.mean, 2)} · max ${c.max} (répartition : ${[0, 1, 2, 3, 4, 5, 6].map((n) => `${n}→${common.filter((v) => v === n).length}`).join(" ")}).`);
// Lot 7 : répétition sur 7 jours glissants (mesure seulement ; cible : un même morceau au plus 3 fois).
const weekMax = new Map<string, number>();
for (let k = 0; k + 7 <= levels.length; k++) {
  const n = new Map<string, number>();
  for (const L of levels.slice(k, k + 7)) for (const p of L.pieces) n.set(p.id, (n.get(p.id) ?? 0) + 1);
  for (const [id, v] of n) weekMax.set(id, Math.max(weekMax.get(id) ?? 0, v));
}
const over = [...weekMax].filter(([, v]) => v > 3).sort((a, b) => b[1] - a[1]);
const hist = [1, 2, 3, 4, 5, 6, 7].map((n) => `${n}→${[...weekMax.values()].filter((v) => v === n).length}`).join(" ");
line(`Sur 7 jours glissants, nombre maximal d'apparitions d'un même morceau : ${Math.max(...weekMax.values())} (morceaux par maximum : ${hist}) ; au-delà de 3 : ${over.length ? over.map(([id, v]) => `${id} (${v})`).join(", ") : "aucun"}.`);
line();

// ——— Familles, enchaînements longs, mutateurs (lot 7) ———
const fams = levels.map((L) => new Set(L.pieces.map((p) => p.family)).size);
const longs = levels.map((L) => L.pieces.filter((p) => p.long).length);
const longShare = levels.map((L) => L.pieces.filter((p) => p.long).reduce((s, p) => s + p.end - p.start, 0) / L.authorTicks);
line("### Familles, enchaînements longs, mutateurs");
line(`| mesure | min | moyenne | max |`);
line(`|---|---|---|---|`);
line(`| familles par niveau (une seule de chaque) | ${stats(fams).min} | ${num(stats(fams).mean)} | ${stats(fams).max} |`);
line(`| enchaînements longs par niveau | ${stats(longs).min} | ${num(stats(longs).mean, 2)} | ${stats(longs).max} |`);
line(`| part du temps de l'auteur dans les enchaînements longs | ${num(100 * stats(longShare).min)} % | ${num(100 * stats(longShare).mean)} % | ${num(100 * stats(longShare).max)} % |`);
line();
const mutUse = new Map<string, number>();
let mutated = 0;
let total = 0;
for (const L of levels) {
  for (const p of L.pieces) {
    total++;
    const ms = MODULES.find((m) => m.id === p.id)!.mutations[p.variant]!;
    if (ms.length > 0) mutated++;
    for (const m of ms) mutUse.set(m.name, (mutUse.get(m.name) ?? 0) + 1);
  }
}
line(`Morceaux joués avec au moins un mutateur : ${mutated} sur ${total} (${num((100 * mutated) / total)} %) ; par mutateur : ${MUTATORS.map((m) => `${m} ${mutUse.get(m) ?? 0}`).join(" · ")}.`);
line();

// ——— Coûts ———
const replayMs: number[] = [];
let ticks = 0;
for (const L of levels) {
  const r = decodeReplay(L.code);
  const t0 = performance.now();
  replayAttempt(L.level, r, L.id);
  replayMs.push(performance.now() - t0);
  ticks += L.authorTicks;
}
const g = stats(genMs);
const rp = stats(replayMs);
line("### Coûts (Node, une date à la fois)");
line(`| mesure | valeur |`);
line(`|---|---|`);
line(`| génération d'un niveau (tous ses tirages, rejeux compris) : moyenne · max | ${num(g.mean)} ms · ${num(g.max)} ms |`);
line(`| rejeu de la preuve (\`replayAttempt\`) : moyenne · max | ${num(rp.mean, 2)} ms · ${num(rp.max, 2)} ms (${num((1e6 * replayMs.reduce((a, b) => a + b, 0)) / ticks, 0)} ns par pas) |`);
line(`| taille de la preuve (base64url) : moyenne | ${num(stats(levels.map((L) => L.code.length)).mean, 0)} caractères |`);

// ——— Par thème (lot 11) ———
const mechShare = (L: DailyLevel) => L.pieces.filter((p) => p.mechanic !== null).reduce((n, p) => n + p.end - p.start, 0) / L.authorTicks;
const rows = (list: readonly DailyLevel[]) => {
  const a = list.flatMap((L) => L.attempts);
  const v = a.filter((x) => x.status === "valide").length;
  const composedN = a.filter((x) => x.status !== "impasse").length;
  const ms = list.map(mechShare);
  return { n: list.length, valid: a.length ? (100 * v) / a.length : 0, validComposed: composedN ? (100 * v) / composedN : 0, fallback: list.filter((L) => L.fallback).length, time: stats(list.map((L) => L.authorTicks)), rate: stats(list.map((L) => L.exigence.rate)), mech: stats(ms), pieces: stats(list.map((L) => L.pieces.length)), gen: stats(list.map((L) => genMs[levels.indexOf(L)] ?? 0)) };
};
line();
line("## Par thème (niveaux du jour : le thème de chaque date)");
line();
line("| thème (mécanique) | jours | tirages validés | secours | temps de l'auteur (min · moy · max) | exigence/min (min · moy · max) | part de la mécanique (min · moy · max) | morceaux en commun avec la veille |");
line("|---|---|---|---|---|---|---|---|");
for (const theme of JUMP_THEME_NAMES) {
  const list = levels.filter((L) => L.theme === theme);
  if (list.length === 0) continue;
  const r = rows(list);
  const commonT = list.flatMap((L) => {
    const k = levels.indexOf(L);
    if (k === 0) return [];
    const prev = new Set(levels[k - 1]!.pieces.map((p) => p.id));
    return [L.pieces.filter((p) => prev.has(p.id)).length];
  });
  line(`| ${theme} (${mechanicOf(theme) ?? "—"}) | ${r.n} | ${num(r.valid)} % | ${r.fallback} | ${sec(r.time.min)} · ${sec(r.time.mean)} · ${sec(r.time.max)} s | ${r.rate.min} · ${num(r.rate.mean, 0)} · ${r.rate.max} | ${num(100 * r.mech.min, 0)} · ${num(100 * r.mech.mean, 0)} · ${num(100 * r.mech.max, 0)} % | ${num(stats(commonT).mean, 2)} (max ${stats(commonT).max}) |`);
}
line();

// ——— Thème forcé (lot 11) : 12 dates × 5 thèmes, comme le taux de validation par thème de DailyTrack ———
const FORCED_FROM = PREMIER_JOUR_JUMP + 300;
const FORCED_DATES = 12;
line(`## Thème forcé (${FORCED_DATES} dates × ${JUMP_THEME_NAMES.length} thèmes, du ${formatDay(FORCED_FROM)} au ${formatDay(FORCED_FROM + FORCED_DATES - 1)})`);
line();
line("| thème forcé | niveaux | tirages validés | des composés | secours | temps de l'auteur (min · moy · max) | exigence/min (moy) | part de la mécanique (moy) | génération (moy · max) |");
line("|---|---|---|---|---|---|---|---|---|");
for (const theme of JUMP_THEME_NAMES as readonly JumpThemeName[]) {
  const list: DailyLevel[] = [];
  const ms: number[] = [];
  for (let k = 0; k < FORCED_DATES; k++) {
    const t0 = performance.now();
    list.push(dailyLevel(FORCED_FROM + k, theme, SIM_VERSION));
    ms.push(performance.now() - t0);
  }
  const r = rows(list);
  line(`| ${theme} | ${r.n} | ${num(r.valid)} % | ${num(r.validComposed)} % | ${r.fallback} | ${sec(r.time.min)} · ${sec(r.time.mean)} · ${sec(r.time.max)} s | ${num(r.rate.mean, 0)} | ${num(100 * r.mech.mean, 0)} % | ${num(stats(ms).mean, 0)} · ${num(stats(ms).max, 0)} ms |`);
}

console.log(out.join("\n"));
