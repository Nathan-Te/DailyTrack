import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { medalsFor } from "@cdj/sim";
import { seedHistory } from "../src/history";

// `npm run history:seed` : fabrique le jeu de données du mode `?api=demo` (classements figés et fantômes des premiers).
// À relancer après tout changement de SIM_VERSION ou GENERATOR_VERSION (un test le rappelle). Le script travaille dans
// sa propre base en mémoire : il ne peut pas toucher une base de production (et refuse toute base contenant de vrais joueurs).
if (process.env.DB_PATH || process.env.NODE_ENV === "production") {
  console.error("history:seed refuse de tourner avec DB_PATH ou NODE_ENV=production : il fabrique sa propre base de démonstration.");
  process.exit(1);
}

const out = join(import.meta.dirname, "..", "..", "web", "public", "demo");
const started = Date.now();
const data = await seedHistory({
  onDay: (d) => console.log(`${d.date} : ${d.pilots} pilotes classés${d.rejected ? `, ${d.rejected} écartés` : ""} (auteur ${(d.authorMs / 1000).toFixed(1)} s)`),
});
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "index.json"), JSON.stringify(data.index) + "\n");
let bytes = 0;
for (const day of data.days) {
  const text = JSON.stringify(day) + "\n";
  bytes += text.length;
  writeFileSync(join(out, `${day.date}.json`), text);
}
const medals = data.days.map((d, i) => {
  const m = medalsFor(data.index.days[i]!.authorMs);
  const ratios = d.top.map((r) => r.ms / m.author);
  return `${d.date}  ${d.top.map((r) => (r.ms <= m.author ? "A" : r.ms <= m.gold ? "G" : r.ms <= m.silver ? "S" : r.ms <= m.bronze ? "B" : "·")).join("").padEnd(15)}  temps / auteur : ${ratios[0]!.toFixed(2)} → ${ratios.at(-1)!.toFixed(2)}`;
});
console.log(`\n${data.days.length} jours (${data.index.days[0]!.date} → ${data.index.days.at(-1)!.date}) écrits dans ${out}`);
console.log(`taille : ${(bytes / 1024).toFixed(0)} ko (hors index) ; médailles du classement de chaque jour (A auteur, G or, S argent, B bronze, · rien) :\n${medals.join("\n")}`);
console.log(`durée : ${((Date.now() - started) / 1000).toFixed(0)} s`);
