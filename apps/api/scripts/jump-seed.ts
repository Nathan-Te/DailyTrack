import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useLegacyCatalog } from "../../../packages/jump-sim/src/legacy";
import { seedJumpDemo } from "../src/jumpHistory";
import { openSqlite } from "../src/node-sqlite";

// `npm run jump:seed -w @cdj/api` (lot P1 de la plateforme) : fabrique le jeu de données du mode `?api=demo` de DailyJump (classements figés de
// 14 jours depuis le premier niveau, puis « aujourd'hui » avec toutes ses lignes), dans `apps/jump/public/demo/`. Les essais sont de vraies
// rediffusions validées par le vrai `createApi` dans une base **en mémoire** : le script ne peut pas toucher une base réelle (il refuse `DB_PATH`
// et `NODE_ENV=production`). À relancer après tout changement de `JUMP_SIM_VERSION` ou de `JUMP_GENERATOR_VERSION` (un test le rappelle).
if (process.env.DB_PATH || process.env.NODE_ENV === "production" || process.env.TURSO_DATABASE_URL) {
  console.error("jump:seed refuse de tourner avec DB_PATH, TURSO_DATABASE_URL ou NODE_ENV=production : il fabrique sa propre base de démonstration.");
  process.exit(1);
}

// Lot 30 : les jours figés d'avant la version 13 se jouent (joueurs fictifs) avec les solutions d'avant le maintien minimal du saut : outil seulement, le serveur ne les charge pas.
useLegacyCatalog();

const root = join(import.meta.dirname, "..", "..", "jump", "public");
const frozen: Record<string, unknown> = {};
for (const f of readdirSync(join(root, "levels")).sort()) {
  const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (date) frozen[date] = JSON.parse(readFileSync(join(root, "levels", f), "utf8"));
}
const out = join(root, "demo");
const started = Date.now();
const data = await seedJumpDemo({
  db: openSqlite(":memory:"),
  frozen,
  onDay: (d) => console.log(`${d.date} : ${d.accepted} joueurs classés, ${d.lives} vies gardées${d.refused || d.firstError ? `, ${d.refused} refus (${d.firstError})` : ""}`),
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
console.log(`\n${data.days.length} jours (${data.index.days[0]!.date} → ${data.index.demoToday}, « aujourd'hui » de la démo) écrits dans ${out}`);
console.log(`taille : ${(bytes / 1024).toFixed(0)} ko ; durée : ${((Date.now() - started) / 1000).toFixed(0)} s`);
