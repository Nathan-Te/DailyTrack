import { daysFromCivil, formatDay } from "@cdj/core";
import * as sim from "../src/index";
import { JUMP_GENERATOR_VERSION, JUMP_THEME_NAMES, MODULES as ALL_MODULES, PLATFORM_VERSION, platformModuleIds, SINGLE_CLOCK_GENERATOR, SINGLE_CLOCK_VERSION, dailyLevel, jumpThemeForDay, type JumpThemeName } from "../src/index";

// `npm run variete:jump -w @cdj/jump-sim` (lot 19) — **répétition des morceaux de base** d'un jour à l'autre (toutes variantes confondues) :
// morceaux de base disponibles par thème, fréquence de chacun (les dix plus fréquents), écart moyen et minimal entre deux apparitions du même
// morceau, morceaux distincts sur 7 et 30 jours glissants. Par défaut 365 dates à partir du 27/10/2026 (J + 2 de la PR du lot 19).
// `-- --depuis=AAAA-MM-JJ --jours=N --froid=N` (N dates tirées à intervalle régulier, générées « à froid », dépendances de variété comprises :
// le temps qu'attend un joueur dont l'appareil n'a encore rien calculé). Mesure seulement : la règle est vérifiée par `test/variete.test.ts`.

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const [y, m, d] = (opt("depuis") ?? "2026-10-27").split("-").map(Number);
const FROM = daysFromCivil(y!, m!, d!);
const DAYS = Number(opt("jours") ?? 365);
// Lot 20 : `--generateur=14` mesure la référence v4 (g14, sans plateformes) au lieu du générateur en vigueur : le comparatif du README.
const G14 = opt("generateur") === "14";
const SIM_VERSION = G14 ? SINGLE_CLOCK_VERSION : PLATFORM_VERSION;
const GEN = G14 ? SINGLE_CLOCK_GENERATOR : JUMP_GENERATOR_VERSION;
// Les morceaux que le générateur mesuré connaît (la référence g14 ne connaît pas ceux à plateformes).
const MODULES = G14 ? ALL_MODULES.filter((def) => !platformModuleIds().has(def.id)) : ALL_MODULES;
const num = (v: number, k = 1) => v.toFixed(k).replace(".", ",");

const t0 = performance.now();
const days: { day: number; theme: JumpThemeName; ids: string[]; fallback: boolean }[] = [];
for (let k = 0; k < DAYS; k++) {
  const L = dailyLevel(FROM + k, null, SIM_VERSION);
  days.push({ day: FROM + k, theme: L.theme, ids: L.pieces.map((p) => p.id), fallback: L.fallback });
}
const ms = performance.now() - t0;

const out: string[] = [];
const line = (s = "") => out.push(s);
line(`## Variété des morceaux de base — g${GEN}, ${DAYS} dates (du ${formatDay(FROM)} au ${formatDay(FROM + DAYS - 1)})`);
line();
line(`Génération : ${num(ms / DAYS / 1000, 2)} s par niveau en moyenne (avec ses dépendances) ; secours : ${days.filter((x) => x.fallback).length}.`);
line();

// ——— Catalogue par thème ———
line("### Morceaux de base par thème");
line("| thème | jours | morceaux de base permis (communs + du thème) | dont du thème | employés sur la période | morceaux par niveau (moyenne) |");
line("|---|---|---|---|---|---|");
for (const theme of JUMP_THEME_NAMES) {
  const mine = days.filter((x) => x.theme === theme);
  const allowed = MODULES.filter((def) => def.theme === null || def.theme === theme);
  const own = allowed.filter((def) => def.theme === theme).length;
  const used = new Set(mine.flatMap((x) => x.ids)).size;
  const per = mine.reduce((n, x) => n + x.ids.length, 0) / (mine.length || 1);
  line(`| ${theme} | ${mine.length} | ${allowed.length} | ${own} | ${used} | ${num(per)} |`);
}
line();

// ——— Fréquences ———
const freq = new Map<string, number>();
for (const x of days) for (const id of x.ids) freq.set(id, (freq.get(id) ?? 0) + 1);
const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
line(`### Fréquence (${freq.size} morceaux de base employés sur ${MODULES.length})`);
line("| rang | morceau | apparitions | un jour sur |");
line("|---|---|---|---|");
sorted.slice(0, 10).forEach(([id, n], k) => line(`| ${k + 1} | ${id} | ${n} | ${num(DAYS / n)} |`));
const never = MODULES.filter((def) => !freq.has(def.id)).map((def) => def.id);
line();
line(`Jamais employés : ${never.length ? never.join(", ") : "aucun"}.`);
line();

// ——— Écarts ———
const gaps: number[] = [];
const minGapOf = new Map<string, number>();
const last = new Map<string, number>();
for (const x of days) {
  for (const id of new Set(x.ids)) {
    const prev = last.get(id);
    if (prev !== undefined) {
      const g = x.day - prev;
      gaps.push(g);
      if (g < (minGapOf.get(id) ?? Infinity)) minGapOf.set(id, g);
    }
    last.set(id, x.day);
  }
}
const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
const minGap = Math.min(...gaps);
line("### Écart entre deux apparitions du même morceau de base (jours)");
line(`Moyenne ${num(mean, 2)} · minimum **${minGap}** · médiane ${[...gaps].sort((a, b) => a - b)[gaps.length >> 1]}.`);
line();
line("| écart (jours) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8–14 | > 14 |");
line("|---|---|---|---|---|---|---|---|---|---|");
const bucket = (lo: number, hi: number) => gaps.filter((g) => g >= lo && g <= hi).length;
line(`| retours | ${[1, 2, 3, 4, 5, 6, 7].map((g) => bucket(g, g)).join(" | ")} | ${bucket(8, 14)} | ${bucket(15, Infinity)} |`);
line();
for (const W of [3, 4, 5, 6, 7]) {
  const bad = gaps.filter((g) => g < W).length;
  line(`- règle W = ${W} (aucun retour avant ${W} jours) : ${bad} retours trop tôt sur ${gaps.length} (${num((100 * bad) / (gaps.length || 1))} %).`);
}
line();

// ——— Distincts sur 7 et 30 jours ———
line("### Morceaux de base distincts sur une fenêtre glissante");
line("| fenêtre | min | moyenne | max | apparitions (moyenne) |");
line("|---|---|---|---|---|");
for (const n of [7, 30]) {
  const counts: number[] = [];
  const total: number[] = [];
  for (let k = 0; k + n <= days.length; k++) {
    const win = days.slice(k, k + n).flatMap((x) => x.ids);
    counts.push(new Set(win).size);
    total.push(win.length);
  }
  line(`| ${n} jours | ${Math.min(...counts)} | ${num(counts.reduce((a, b) => a + b, 0) / counts.length)} | ${Math.max(...counts)} | ${num(total.reduce((a, b) => a + b, 0) / total.length)} |`);
}
line();

// ——— Exemples ———
line("### Exemples de retours rapides (écart ≤ 2 jours, 12 premiers)");
const quick: string[] = [];
const seen = new Map<string, number>();
for (const x of days) {
  for (const id of new Set(x.ids)) {
    const p = seen.get(id);
    if (p !== undefined && x.day - p <= 2 && quick.length < 12) quick.push(`${id} (${formatDay(p)} → ${formatDay(x.day)}, ${jumpThemeForDay(p)} → ${x.theme})`);
    seen.set(id, x.day);
  }
}
line(quick.length ? quick.map((s) => `- ${s}`).join("\n") : "aucun");

// ——— Génération à froid ———
// ——— Réserve : combien de morceaux de base manquent pour tenir un W plus grand (lot 19, méthode gardée au lot 20) ———
// Sous la règle bornée, le niveau d'un jour écarte les morceaux de ses voisins à moins de W − 1 jours **de chaque côté** (le dernier jour d'une époque
// écarte jusqu'à 2 × (W − 1) jours). Réserve d'un jour = morceaux permis à son thème − morceaux écartés. Seuil = la plus petite réserve vue à W = 3 (la règle
// en vigueur, 0 secours) pour ce thème ; manque d'un jour à W = max(0, seuil − sa réserve). Les voisins sont ceux du générateur mesuré (W = 3) : une estimation.
// **Lot 20 : le seuil est celui de g14** (`G14_THRESHOLD`, mesuré par `--generateur=14` : le catalogue d'avant, 0 secours), pour que g15 se compare à g14 : ajouter des
// morceaux relève la réserve de tous les jours, donc le manque ; un seuil recalculé sur g15 monterait avec le catalogue et ne dirait rien. (La méthode du lot 19 donnait
// des seuils de 20 à 25 : son script n'a pas été gardé, celui-ci est gardé ; les chiffres de g14 sont recalculés ici, pas repris.)
line();
line("### Réserve : morceaux de base à ajouter pour tenir un W plus grand (jour moyen · pire jour)");
line("| thème | seuil (réserve minimale de g14 à W = 3) | W = 4 | W = 5 | W = 7 |");
line("|---|---|---|---|---|");
const idsOf = new Map(days.map((x) => [x.day, x.ids]));
/** La plus petite réserve vue à W = 3 par g14 (365 dates à partir du 27/10/2026, 0 secours), par thème : `npm run variete:jump -w @cdj/jump-sim -- --generateur=14`. */
const G14_THRESHOLD: Readonly<Record<string, number>> = { foret: 17, usine: 12, glace: 14, nuit: 13, neon: 11 };
const shortage: Record<number, number[]> = { 4: [], 5: [], 7: [] };
for (const theme of JUMP_THEME_NAMES) {
  const allowed = MODULES.filter((def) => def.theme === null || def.theme === theme).length;
  const mine = days.filter((x) => x.theme === theme && x.day >= FROM + 6 && x.day <= FROM + DAYS - 7);
  const reserve = (day: number, w: number) => {
    const excluded = new Set<string>();
    for (let k = 1; k < w; k++) for (const d of [day - k, day + k]) for (const id of idsOf.get(d) ?? []) excluded.add(id);
    return allowed - excluded.size;
  };
  const threshold = G14 ? Math.min(...mine.map((x) => reserve(x.day, 3))) : G14_THRESHOLD[theme]!;
  const cells = [4, 5, 7].map((w) => {
    const need = mine.map((x) => Math.max(0, threshold - reserve(x.day, w)));
    shortage[w]!.push(Math.max(...need));
    return `${num(need.reduce((a, b) => a + b, 0) / need.length, 0)} · ${Math.max(...need)}`;
  });
  line(`| ${theme} | ${threshold} | ${cells.join(" | ")} |`);
}
line();
line(`Un morceau **commun** compte pour tous les thèmes : pour **W = 5**, il manque environ **${Math.max(...shortage[5]!)} morceaux communs** (le pire jour du pire thème ; W = 4 : ${Math.max(...shortage[4]!)}, W = 7 : ${Math.max(...shortage[7]!)}).`);

const COLD = Number(opt("froid") ?? 48);
const forget = (sim as { forgetDailyLevels?: () => void }).forgetDailyLevels;
if (COLD > 0 && forget) {
  const ms: { day: number; ms: number }[] = [];
  for (let k = 0; k < COLD; k++) {
    const day = FROM + Math.floor((k * DAYS) / COLD);
    forget();
    const t = performance.now();
    dailyLevel(day, null, SIM_VERSION);
    ms.push({ day, ms: performance.now() - t });
  }
  const sorted = [...ms].sort((a, b) => b.ms - a.ms);
  line();
  line(`### Génération à froid (${COLD} dates, dépendances comprises)`);
  line(`Moyenne ${num(ms.reduce((n, x) => n + x.ms, 0) / ms.length / 1000, 2)} s · maximum ${num(sorted[0]!.ms / 1000, 2)} s (${formatDay(sorted[0]!.day)}) · au-dessus de 2 s : ${ms.filter((x) => x.ms > 2000).length}.`);
} else if (COLD > 0) {
  line();
  line("### Génération à froid");
  line(`Pas de dépendance entre les jours (g${GEN}) : ${num(ms / DAYS / 1000, 2)} s par niveau en moyenne (ci-dessus).`);
}

console.log(out.join("\n"));
