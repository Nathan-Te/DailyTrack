// `npm run secours:jump -w @cdj/jump-sim` — outil (lot 8c) : choisit le niveau de secours (`FALLBACK_PIECES`) — le tirage valide le plus central (durée et exigence) de 400 dates.
import { PREMIER_JOUR_JUMP, dailyLevel } from "../src/index";
let best: { score: number; pieces: string[]; ticks: number; rate: number; date: string } | null = null;
for (let k = 0; k < 400; k++) {
  let L;
  try {
    L = dailyLevel(PREMIER_JOUR_JUMP + k);
  } catch {
    console.log(`jour ${k} : aucun tirage valide (secours invalide)`);
    continue;
  }
  for (const a of L.attempts) {
    if (a.status !== "valide") continue;
    if (!best || a.score < best.score) best = { score: a.score, pieces: a.pieces, ticks: a.ticks, rate: a.rate, date: L.date };
  }
}
console.log(JSON.stringify(best));
console.log(best!.pieces.map((p) => { const [id, v] = p.split(":"); return `  { id: "${id}", variant: ${v} },`; }).join("\n"));
