import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parisDay } from "@cdj/clock";
import { formatDay, parseDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, dailyLevel } from "@cdj/jump-sim";
import { freezeLevel, frozenJson, thawLevel } from "../src/frozen";

// Fige les niveaux du jour (lot 10) : écrit `public/levels/AAAA-MM-JJ.json` pour chaque date de `PREMIER_JOUR_JUMP` jusqu'à la date donnée
// (comprise). **Un fichier déjà écrit n'est jamais réécrit** : un jour figé ne change plus ; s'il ne se relit plus (autre physique), le
// script le signale et s'arrête en erreur, sans y toucher.
//
//   npm run freeze:days -w @cdj/jump -- 2026-11-30      jusqu'au 30/11/2026 compris
//   npm run freeze:days -w @cdj/jump -- demain          jusqu'à demain (date de Paris) compris : la règle avant un changement de version
//   … -- demain --dir=/tmp/essai                         ailleurs que dans public/levels (essais)

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const dirArg = args.find((a) => a.startsWith("--dir="))?.slice("--dir=".length);
// `npm run -w @cdj/jump` lance le script depuis apps/jump.
const dir = resolve(dirArg ?? join(process.cwd(), "public", "levels"));

if (!target) {
  console.error("Usage : npm run freeze:days -w @cdj/jump -- <AAAA-MM-JJ | demain> [--dir=<dossier>]");
  process.exit(2);
}
const today = parisDay(Date.now());
const last = target === "demain" ? today + 1 : target === "aujourdhui" ? today : parseDay(target);
if (last === null) {
  console.error(`Date illisible : ${target}`);
  process.exit(2);
}

mkdirSync(dir, { recursive: true });
console.log(`Niveaux figés dans ${dir} (sim v${JUMP_SIM_VERSION}, générateur g${JUMP_GENERATOR_VERSION}), du ${formatDay(PREMIER_JOUR_JUMP)} au ${formatDay(last)}.`);
let written = 0;
let kept = 0;
const broken: string[] = [];
for (let day = PREMIER_JOUR_JUMP; day <= last; day++) {
  const date = formatDay(day);
  const file = join(dir, `${date}.json`);
  if (existsSync(file)) {
    const back = thawLevel(JSON.parse(readFileSync(file, "utf8")) as unknown, day);
    if (typeof back === "string") broken.push(`${date} : ${back}`);
    else kept++;
    continue;
  }
  const level = dailyLevel(day);
  const frozen = freezeLevel(level);
  const back = thawLevel(JSON.parse(frozenJson(frozen)) as unknown, day);
  if (typeof back === "string") throw new Error(`${date} : le fichier écrit ne se relit pas (${back})`);
  writeFileSync(file, frozenJson(frozen));
  written++;
  console.log(`  ${date}  ${frozen.id}  auteur ${(frozen.auteur / 120).toFixed(3)} s  ${frozenJson(frozen).length} octets`);
}
console.log(`${written} écrit(s), ${kept} déjà figé(s) et relu(s).`);
if (broken.length > 0) {
  console.error(`${broken.length} fichier(s) figé(s) ne se relisent plus (gardés tels quels) :\n  ${broken.join("\n  ")}`);
  process.exit(1);
}
