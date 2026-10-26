import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dailyCircuit, encodeReplay, parseDay, runPilot } from "@cdj/sim";
import { dailyLevel, demoAttempts, encodeReplay as encodeJump, jumpMedalFor, repriseParPhase, replayAttempt, thawLevel, type DailyLevel, type JumpMedal } from "@cdj/jump-sim";

// Lot R9 (plateforme) : **le serveur refuse les copies** (409 `replay_copy` : les entrées de la rediffusion de l'auteur du niveau, ou d'une course déjà classée
// d'un autre joueur ce jour-là). Un spec qui envoie « une course valide » à un vrai serveur ne peut donc plus jouer la rediffusion du pilote de Track ni la
// preuve de l'auteur de Jump, ni envoyer deux fois la même course sous deux pseudos. Ces deux fonctions donnent une course **valide, différente de celle de
// l'auteur et différente d'un appel à l'autre** (adhérence ou graine tirée au hasard : un essai relancé sur la même base en mémoire n'envoie pas, sous un autre
// pseudo, la course du premier essai). Elles se calculent **avant** d'ouvrir la page (le jeu tourne en temps réel dès qu'il est prêt).

/**
 * DailyTrack : la rediffusion d'un pilote d'une adhérence tirée au hasard sur le circuit de `day` (un numéro de jour), qui finit et n'est pas celle de l'auteur.
 * `grips` borne l'adhérence (plus bas = plus lent : `[0.72, 0.8]` pour une course « lente », `[0.97, 1.03]` pour une « rapide ») : l'ordre de deux joueurs d'un test se garde.
 */
export function courseTrack(day: number, grips: readonly [number, number] = [0.55, 0.95]): { code: string; ms: number } {
  const circuit = dailyCircuit(day);
  const auteur = encodeReplay(circuit.authorReplay);
  for (let essai = 0; essai < 40; essai++) {
    const grip = Math.round((grips[0] + (randomBytes(2).readUInt16BE() / 65_535) * (grips[1] - grips[0])) * 10_000) / 10_000;
    const run = runPilot(circuit.track, { grip });
    if (!run.valid) continue;
    const code = encodeReplay(run.replay);
    if (code !== auteur) return { code, ms: run.finishMs };
  }
  throw new Error(`aucun pilote ne finit le circuit du ${day} d'une autre façon que l'auteur`);
}

const LEVELS = new URL("../../jump/public/levels/", import.meta.url);

/** Le niveau que la page de DailyJump joue pour `date` : son fichier figé (preuve rejouée) s'il existe, sinon le générateur. */
function niveauJump(date: string): DailyLevel {
  const day = parseDay(date)!;
  try {
    const thawed = thawLevel(JSON.parse(readFileSync(new URL(`${date}.json`, LEVELS), "utf8")), day);
    if (typeof thawed !== "string") return thawed;
  } catch {
    /* pas de fichier figé : le niveau généré */
  }
  return dailyLevel(day);
}

/** DailyJump : la plus rapide de 40 courses fictives qui arrivent (graine tirée au hasard), jamais la preuve de l'auteur ; `medal` : celle que le serveur rend. */
export function courseJump(date: string): { code: string; ticks: number; medal: JumpMedal | null } {
  const level = niveauJump(date);
  const seed = randomBytes(4).readUInt32BE();
  let best: { code: string; ticks: number } | null = null;
  for (const a of demoAttempts(level.level, level.replay, seed, { attempts: 40, reprise: repriseParPhase(level) })) {
    if (a.end !== "arrivée") continue;
    const code = encodeJump(a.replay);
    const r = replayAttempt(level.level, a.replay, level.id);
    if (!r.finished || code === level.code || (best && r.time >= best.ticks)) continue;
    best = { code, ticks: r.time };
  }
  if (!best) throw new Error(`aucune course fictive de DailyJump n'arrive sur ${date}`);
  return { ...best, medal: jumpMedalFor(best.ticks, level.medals) };
}
