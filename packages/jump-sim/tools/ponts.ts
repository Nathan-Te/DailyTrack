import { BRIDGE_CHASE_MARGIN, bridgeNeededProblems, INPUT_JUMP, MODULES, bridgeChaseProblems, bridgeProblems, buildModule, decodeReplay, fromRuns, moduleSolutions, replayAttempt, variantExigence, withBridgeAdvance } from "../src/index";

// Outil d'écriture (lot 26) : pour chaque variante de chaque morceau à ponts, ce que fait la solution gardée (durée, appuis de saut), les notes de jouabilité, **l'avance réelle sur
// l'extinction** (le plus grand nombre de pas dont on peut avancer les extinctions sans que la solution cesse d'arriver : la règle de la poursuite franche en exige
// `BRIDGE_CHASE_MARGIN`) et le verdict des règles du générateur. `node dist/ponts.mjs [id…]`. Ne tourne jamais en production ni dans `npm test`.
const only = process.argv.slice(2);
for (const def of MODULES.filter((m) => m.tags.includes("pont") && (only.length === 0 || only.includes(m.id)))) {
  for (let v = 0; v < def.variants.length; v++) {
    const built = buildModule(def.id, v);
    const problems = [...bridgeProblems(built.level)];
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
      // L'avance réelle : la plus grande avance (pas) pour laquelle la rediffusion arrive encore au même pas.
      let advance = 0;
      for (let a = 1; a <= 400; a++) {
        let ok = false;
        try {
          const r = replayAttempt(withBridgeAdvance(built.level, a), replay, built.levelId);
          ok = r.finished && r.deaths.length === 0 && r.ticks === s.ticks;
        } catch {
          ok = false;
        }
        if (!ok) break;
        advance = a;
      }
      const chase = bridgeChaseProblems(built.level, replay, built.levelId, s.ticks);
      if (chase.length > 0) problems.push(`${e} : ${chase[0]}`);
      for (const p of bridgeNeededProblems(built.level, replay, built.levelId)) problems.push(`${e} : ${p}`);
      cells.push(`${e} ${((s.exitTick - s.entryTick) / 120).toFixed(2)} s · note ${s.exigence} · ${presses} sauts · avance ${advance} pas (${(advance / 120).toFixed(2)} s, exigé ${BRIDGE_CHASE_MARGIN})`);
    }
    console.log(`${def.id} v${v} ${Object.entries(def.variants[v]!).map(([k, x]) => `${k}=${x}`).join(" ")} · ${built.width}×${built.height} · ${sol ? `exigence ${variantExigence(sol)}` : "SANS SOLUTION"} · ${cells.join(" | ")}${problems.length > 0 ? ` · RÈGLES : ${problems.join(" ; ")}` : ""}`);
  }
}
