import { DEFAULT_JUMP_PARAMS, INPUT_JUMP, buildModule, decodeReplay, fromRuns, initialAttempt, moduleSolutions, moduleStart, platformPositions, stepAttempt, type ModuleEntry } from "../src/index";

// Outil d'écriture (lot 20) : `node dist/trace.mjs <id> <variante> <arret|elan>` joue la solution stockée d'un morceau pas à pas et en résume le déroulé
// (colonne du centre, portage, appuis de saut) : on voit si la solution passe bien par les plateformes.
const [id, v = "0", entry = "arret"] = process.argv.slice(2);
const sol = moduleSolutions(id!, Number(v))![entry as ModuleEntry]!;
const m = buildModule(id!, Number(v));
const inputs = fromRuns(decodeReplay(sol.code).runs);
let s = moduleStart(m, entry as ModuleEntry);
let ride = -2;
let presses = 0;
console.log(`${id} v${v} ${entry} : ${inputs.length} pas, entrée ${sol.entryTick}, sortie ${sol.exitTick}`);
inputs.forEach((bits, t) => {
  const prev = inputs[t - 1] ?? 0;
  const pressed = (bits & INPUT_JUMP) !== 0 && (prev & INPUT_JUMP) === 0;
  if (pressed) presses++;
  s = stepAttempt(s, bits, m.level, DEFAULT_JUMP_PARAMS);
  const r = s.ride ?? -1;
  if (pressed || r !== ride || t % 30 === 0 || t === inputs.length - 1) {
    const plats = platformPositions(m.level, s).map((p) => `(${(p.x / 4096).toFixed(2)},${(p.y / 4096).toFixed(2)})`).join(" ");
    console.log(`t=${String(t + 1).padStart(4)} x=${(s.player.x / 4096).toFixed(2)} y=${(s.player.y / 4096).toFixed(2)} vx=${s.player.vx} ${s.player.ground ? "sol" : "air"} ride=${r}${pressed ? " SAUT" : ""} plat=${plats}`);
  }
  ride = r;
});
console.log(`appuis de saut : ${presses}`);
