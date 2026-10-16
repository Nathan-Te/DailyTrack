import { daysFromCivil } from "@cdj/core";
import { AUTHOR_TARGET_TICKS, EXIGENCE_RATE_CENTER, JUMP_THEME_NAMES, dailyLevel, dailyProblems, mechanicOf, type DailyLevel, type JumpThemeName } from "../src/index";

// `npm run secours:modules -w @cdj/jump-sim -- [--theme=nuit] [--dates=80]` — aide à choisir la suite de **secours** d'un thème à mécanique
// (`FALLBACK_BY_THEME`, daily.ts ; lots 7 et 11, 12) : parmi les niveaux **valides** (tirages normaux, pas le secours) de `dates` dates en thème
// forcé, celui qui tombe le plus près du centre de la cible (temps de l'auteur et exigence, comme le score du générateur), puis sa suite de
// morceaux prête à recopier. Vérifie qu'elle passe comme niveau de secours (`fallbackLevel` : quota de signature compris). Outil seulement.
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const themes = (arg("theme", "") ? [arg("theme", "")] : JUMP_THEME_NAMES.filter((t) => mechanicOf(t) !== null)) as JumpThemeName[];
const dates = Number(arg("dates", "80"));
const first = daysFromCivil(2027, 8, 12);
const per = (a: number, b: number) => Math.floor((a * 1000) / b);

for (const theme of themes) {
  let best: { L: DailyLevel; score: number } | null = null;
  let valid = 0;
  for (let d = first; d < first + dates; d++) {
    let L: DailyLevel;
    try {
      L = dailyLevel(d, theme);
    } catch (e) {
      console.log(`${theme} ${d} : ${(e as Error).message}`);
      continue;
    }
    if (L.fallback || dailyProblems(L).length > 0) continue;
    valid++;
    const score = per(Math.abs(L.authorTicks - AUTHOR_TARGET_TICKS), AUTHOR_TARGET_TICKS) + per(Math.abs(L.exigence.rate - EXIGENCE_RATE_CENTER), EXIGENCE_RATE_CENTER);
    if (!best || score < best.score) best = { L, score };
  }
  if (!best) {
    console.log(`${theme} : aucun niveau valide sur ${dates} dates`);
    continue;
  }
  const L = best.L;
  console.log(`\n${theme} : ${valid} niveaux valides sur ${dates} dates ; retenu ${L.date} (${(L.authorTicks / 120).toFixed(2)} s, exigence ${L.exigence.rate}, score ${best.score})`);
  console.log(`  ${theme}: [\n${L.pieces.map((p) => `    { id: "${p.id}", variant: ${p.variant} },`).join("\n")}\n  ],`);
}
