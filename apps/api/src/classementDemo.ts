import { formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { Rng, dailyCircuit, mixSeed, runFictional, styleFor, PREMIER_JOUR } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, demoAttempts, encodeReplay as encodeJump, replayAttempt } from "@cdj/jump-sim";
import { createApi } from "./api";
import type { SqlDb } from "./db";
import { fictionalId } from "./history";
import { crc32Hex } from "./identity";
import { jumpDailyOf } from "./jump";

// Lot I3 (plateforme) : **une vingtaine de joueurs de démonstration pour le classement du jour** de la recette (`/classement/`, la tuile « Classement du
// jour »), en plus du joueur « Démo » du lot I2 : pour que la page et la tuile aient l'air réelles. **Recette seulement** : ils ne sont créés que par
// `recette:seed` (garde `recetteSeedTarget` : ENVIRONMENT=recette et une base dont le nom contient « recette »), par le **vrai `createApi`** (rejeu serveur de
// chaque course et de chaque essai, horloge injectée sur chaque jour) avec `demoPlayers: true`, une option que le serveur de production ne règle jamais.
//
// Leurs résultats sont variés : des niveaux de pilotage étalés dans Track, des essais plus ou moins réussis dans Jump, quelques joueurs qui n'ont fini
// qu'un seul des deux jeux (le classement montre alors une case vide) ; trois jours (aujourd'hui, hier, avant-hier) pour que le choix d'un jour passé
// montre un vrai classement. Comme « Démo », ils sont **effacés puis recréés** à chaque passage du script (route d'admin de la plateforme) : ce qu'on voit
// ne dépend pas des passages précédents.

/** Leurs pseudos (distincts de ceux de l'historique de démonstration : un pseudo n'appartient qu'à un joueur). */
export const CLASSEMENT_DEMO_NOMS = [
  "Démo Abricot", "Démo Bambou", "Démo Cerise", "Démo Dahlia", "Démo Écume", "Démo Fjord", "Démo Givre", "Démo Hibou", "Démo Iris", "Démo Jade",
  "Démo Kiwi", "Démo Lagune", "Démo Mirage", "Démo Nacre", "Démo Opale", "Démo Pivoine", "Démo Quartz", "Démo Ronce", "Démo Safran", "Démo Tilleul",
] as const;
/** Jours remplis (aujourd'hui compris). */
export const CLASSEMENT_DEMO_JOURS = 3;

const ADMIN = "jeton-des-joueurs-du-classement-de-demonstration-0123456789";
const code = (id: string) => `CDJ2.${id}.${crc32Hex(new TextEncoder().encode(id))}`;

export interface ClassementDemoReport {
  joueurs: number;
  effaces: number;
  track: number;
  jump: number;
  refus: string[];
}

/** Crée (ou recrée) les joueurs du classement dans la base donnée, jusqu'au jour `today` (numéro de jour de Paris). */
export async function seedClassementDemo(o: { db: SqlDb; frozen: Readonly<Record<string, unknown>>; today: number; jours?: number }): Promise<ClassementDemoReport> {
  let clock = parisDayStart(o.today) + 12 * 3_600_000;
  const api = createApi({ db: o.db, now: () => clock, demoPlayers: true, allowCopies: true, jumpFrozen: o.frozen, adminToken: ADMIN, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const call = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const res = await api.handle(new Request(`http://recette.local${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }), { clientKey: "192.0.2.11" });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as Record<string, any> };
  };
  const report: ClassementDemoReport = { joueurs: CLASSEMENT_DEMO_NOMS.length, effaces: 0, track: 0, jump: 0, refus: [] };

  // 1. Repartir de zéro : effacés par la route d'admin (rien s'ils n'existent pas encore).
  for (const name of CLASSEMENT_DEMO_NOMS) {
    const r = await call("/api/admin/effacer", { code: code(fictionalId(name)), confirmer: true }, { Authorization: `Bearer ${ADMIN}` });
    if (r.status === 200) report.effaces++;
    else if (r.body?.error !== "unknown_player") throw new Error(`joueurs du classement : effacement de ${name} refusé (${r.status} ${String(r.body?.error ?? "")})`);
  }

  const jours = o.jours ?? CLASSEMENT_DEMO_JOURS;
  for (let day = o.today - jours + 1; day <= o.today; day++) {
    const rng = new Rng(mixSeed(day, 0xc1a5));
    const circuit = day >= PREMIER_JOUR ? dailyCircuit(day) : null;
    const level = day >= PREMIER_JOUR_JUMP ? jumpDailyOf(day, o.frozen) : null;
    // Essais de Jump du jour, étalés du plus rapide au plus lent (un lot par jour : leur préparation coûte cher).
    const essais = level
      ? demoAttempts(level.level, level.replay, mixSeed(day, 0x51c), { attempts: 60 })
          .filter((a) => a.end === "arrivée")
          .map((a) => ({ replay: a.replay, r: replayAttempt(level.level, a.replay, level.id) }))
          .filter((a) => a.r.finished && a.r.deaths.length > 0)
          .sort((a, b) => a.r.time - b.r.time)
      : [];
    const names = rng.shuffle([...CLASSEMENT_DEMO_NOMS]);
    for (let p = 0; p < names.length; p++) {
      const name = names[p]!;
      const id = fictionalId(name);
      // Quelques joueurs n'ont fini qu'un seul jeu (cases vides du classement), jamais aucun.
      const sansJump = p % 5 === 3 || essais.length === 0;
      const sansTrack = p % 7 === 5 && !sansJump;
      if (circuit && !sansTrack) {
        const skill = ((p * 7 + 3) % names.length) / names.length;
        let run: { code: string; finishMs: number } | null = null;
        for (let attempt = 0; attempt < 4 && !run; attempt++) {
          const style = styleFor(Math.min(1, skill + attempt * 0.12));
          run = runFictional(circuit.track, { ...style, wobble: style.wobble / (1 + attempt) }, mixSeed(day, 0xd0 + p * 31 + attempt));
        }
        if (run) {
          clock = parisDayStart(day) + 9 * 3_600_000 + (p + 1) * 60_000;
          const r = await call("/api/submit", { playerId: id, name, date: formatDay(day), replay: run.code });
          if (r.status === 200) report.track++;
          else report.refus.push(`Track ${formatDay(day)} ${name} : ${r.status} ${String(r.body?.error ?? "")}`);
        }
      }
      if (level && !sansJump) {
        // Le joueur d'indice p prend l'essai de rang proportionnel (les meilleurs d'abord), pour étaler les temps et les médailles.
        const pick = essais[Math.min(essais.length - 1, Math.floor((p / names.length) * essais.length))]!;
        clock = parisDayStart(day) + 10 * 3_600_000 + (p + 1) * 60_000;
        const r = await call("/api/jump/submit", { levelId: level.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: encodeJump(pick.replay), name }, { "X-Player-Id": id });
        if (r.status === 200) report.jump++;
        else report.refus.push(`Jump ${formatDay(day)} ${name} : ${r.status} ${String(r.body?.error ?? "")}`);
      }
    }
  }
  return report;
}
