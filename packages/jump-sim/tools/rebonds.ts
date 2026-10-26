import { INPUT_JUMP, MODULES, buildModule, decodeReplay, fromRuns, moduleSolutions, mushroomContacts, mushroomProblems, mushroomSweepProblems, replayStartState, variantExigence, MUSHROOM_CHARS } from "../src/index";

// Outil d'écriture (lot 23) : pour chaque variante de chaque morceau à champignons, ce que fait la solution gardée (rebonds simples et renforcés, appuis de saut, durée), les notes
// de jouabilité, et le verdict des règles du générateur (pose, 0,3 s de trajectoire). `node dist/rebonds.mjs [id…]`. Ne tourne jamais en production ni dans `npm test`.
const only = process.argv.slice(2);
for (const def of MODULES.filter((m) => m.tags.includes("champignon") && (only.length === 0 || only.includes(m.id)))) {
  for (let v = 0; v < def.variants.length; v++) {
    const built = buildModule(def.id, v);
    const problems = [...mushroomProblems(built.level), ...mushroomSweepProblems(built.level)];
    const sol = moduleSolutions(def.id, v);
    const cells: string[] = [];
    for (const e of ["arret", "elan"] as const) {
      const s = sol?.[e];
      if (!s) {
        cells.push(`${e} —`);
        continue;
      }
      const replay = decodeReplay(s.code);
      const bits = fromRuns(replay.runs);
      const presses = bits.filter((b, t) => (b & INPUT_JUMP) !== 0 && (t === 0 || (bits[t - 1]! & INPUT_JUMP) === 0)).length;
      const contacts = mushroomContacts(built.level, replayStartState(built.level, replay.start), bits);
      const list = contacts.map((c) => `${MUSHROOM_CHARS[c.dir]}${c.boost ? "+" : ""}`).join("");
      cells.push(`${e} ${((s.exitTick - s.entryTick) / 120).toFixed(2)} s · note ${s.exigence} · ${presses} sauts · rebonds [${list}]`);
    }
    console.log(`${def.id} v${v} ${Object.entries(def.variants[v]!).map(([k, x]) => `${k}=${x}`).join(" ")} · ${built.width}×${built.height} · ${sol ? `exigence ${variantExigence(sol)}` : "SANS SOLUTION"} · ${cells.join(" | ")}${problems.length > 0 ? ` · RÈGLES : ${problems.join(" ; ")}` : ""}`);
  }
}
