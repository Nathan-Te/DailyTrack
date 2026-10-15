import { formatDay } from "@cdj/core";
import {
  AUTHOR_MAX_TICKS,
  AUTHOR_MIN_TICKS,
  DAILY_DRAWS,
  DAILY_MAX_ATTEMPTS,
  EXIGENCE_RATE_MAX,
  EXIGENCE_RATE_MIN,
  MODULES,
  MODULE_TAGS,
  PREMIER_JOUR_JUMP,
  TICK_RATE,
  dailyLevel,
  decodeReplay,
  isRestedModule,
  replayAttempt,
  type DailyLevel,
} from "../src/index";

// `npm run measure:jump -w @cdj/jump-sim` — mesures du niveau du jour (lot 5) sur 120 dates à partir de `PREMIER_JOUR_JUMP` : taux de
// validation des tirages, tirage retenu, secours, temps de l'auteur (et sa répartition par tranches de 2 s), morceaux par niveau, exigence
// (somme, par minute, profil par tiers), étiquettes, emploi de chaque morceau, morceaux en commun d'un jour au suivant, hauteur, temps de
// génération et coût d'un rejeu. **Toute règle du générateur se juge à ces mesures.** `-- --jours=N` pour un autre nombre de dates.

const arg = process.argv.find((a) => a.startsWith("--jours="));
const DAYS = arg ? Number(arg.slice(8)) : 120;
const sec = (t: number) => (t / TICK_RATE).toFixed(2).replace(".", ",");
const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const stats = (xs: number[]) => ({ min: Math.min(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length, max: Math.max(...xs) });

// Chauffe : le catalogue (variantes utilisables, morceaux construits) se calcule au premier appel ; on ne le compte pas.
dailyLevel(PREMIER_JOUR_JUMP - 1000);

const levels: DailyLevel[] = [];
const genMs: number[] = [];
for (let k = 0; k < DAYS; k++) {
  const t0 = performance.now();
  levels.push(dailyLevel(PREMIER_JOUR_JUMP + k));
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
line(`| tirages essayés (${DAILY_DRAWS} par jour, jusqu'à ${DAILY_MAX_ATTEMPTS} sans tirage valide) | ${all.length} |`);
line(`| composés (sans impasse) | ${composed} (${num((100 * composed) / all.length)} %) |`);
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
const estimates = levels.map((L) => L.pieces.reduce((s, p) => s + p.solutionTicks, 0) + 9 * (L.pieces.length - 1));
const gap = levels.map((L, k) => L.authorTicks - estimates[k]!);
line();
line(`Écart temps de l'auteur − estimation (somme des solutions + 9 pas par raccord) : min ${stats(gap).min} · moyenne ${num(stats(gap).mean)} · max ${stats(gap).max} pas.`);
line();

// ——— Morceaux, hauteur ———
const counts = levels.map((L) => L.pieces.length);
const heights = levels.map((L) => L.level.height);
const widths = levels.map((L) => L.level.width);
line("### Forme");
line(`| mesure | min | moyenne | max |`);
line(`|---|---|---|---|`);
line(`| morceaux par niveau | ${stats(counts).min} | ${num(stats(counts).mean)} | ${stats(counts).max} |`);
line(`| hauteur (rangées, ≤ 48) | ${stats(heights).min} | ${num(stats(heights).mean)} | ${stats(heights).max} |`);
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
  const avail = levels.filter((L) => !isRestedModule(m.id, L.day)).length;
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

console.log(out.join("\n"));
