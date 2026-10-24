import { formatDay } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { BASCULE_LOT_35, DEBLOCAGES, encodeReplay, medalFor, medalsFor, dailyCircuit, runPilot } from "@cdj/sim";
import type { Medal } from "@cdj/sim";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PREMIER_JOUR_JUMP, demoAttempts, encodeReplay as encodeJump, lifeReplay, replayAttempt } from "@cdj/jump-sim";
import { createApi } from "./api";
import type { SqlDb } from "./db";
import { crc32Hex } from "./identity";
import { jumpDailyOf } from "./jump";

// Lot I2 (plateforme) : le **joueur de démonstration du portail**, « Démo », pour juger le portail plein en deux clics (`/?demo=joueur` sur la
// recette et les aperçus). **Recette seulement** : il n'est créé que par `recette:seed` (garde `recetteSeedTarget` : ENVIRONMENT=recette et
// une base dont le nom contient « recette »), par le **vrai `createApi`** (rejeu serveur de chaque course, de chaque essai et de chaque vie,
// horloge injectée sur chaque jour) avec `demoPlayers: true` (joueur marqué `demo`), une option que le serveur de production ne règle jamais.
//
// Son historique, chaque fois le même quel que soit le jour : **série de 5 jours** (Track fini les 5 derniers jours), **2 journées parfaites**
// (Jump fini avant-hier et hier), et **aujourd'hui Track fini avec la médaille d'or, Jump en cours** (des morts envoyées, aucun essai classé). **Depuis la bascule des médailles
// (28/10/2026, lot 35) le pilote ne peut plus atteindre une médaille** (seuils sous son temps) : Track est fini sans médaille, avec la course la plus rapide du pilote.
// **Son Garage (lot de plateforme « suites de Track 2 »)** : il garde, quelle que soit la date, **la Sparrow, la Pelican, la Weasel et la Badger débloquées et le reste en
// progression** (`planGarage`, `DEMO_GARAGE`). Les ors qui débloquent la Weasel ne peuvent plus venir des cinq jours de la série dès la bascule des médailles : il rejoue donc,
// **de vraies rediffusions du pilote, rejouées par le serveur**, des jours d'avant la bascule (leurs seuils d'alors, où le pilote a l'or) — hors de la série, séparés d'elle par
// un jour sans course — et quelques jours sans or (argent ou bronze) pour le nombre de jours joués de la Badger. Aucun résultat n'est posé à la main.
// Pour que la série reste de 5 jours quand le script repasse chaque jour (`recette-seed.yml`), le joueur est d'abord **effacé** par la route
// d'admin de la plateforme (`POST /api/admin/effacer`, lot R5), puis recréé.

/** Le pseudo du joueur de démonstration. */
export const DEMO_JOUEUR_NOM = "Démo";
/**
 * Son identifiant (fixe, connu : c'est un compte de démonstration de la recette, son code n'est pas un secret). Le portail l'installe par
 * `/?demo=joueur` (`apps/portail/src/demo.ts`, absent de la construction de production) ; un test vérifie que les deux sont le même.
 */
export const DEMO_JOUEUR_ID = "de30de30de30de30de30de30de30de30";
/** Son code de transfert (`CDJ2.<identifiant>.<CRC-32>`, la forme de `@cdj/profile`). */
export const DEMO_JOUEUR_CODE = `CDJ2.${DEMO_JOUEUR_ID}.${crc32Hex(new TextEncoder().encode(DEMO_JOUEUR_ID))}`;
/** Jours finis dans Track (aujourd'hui compris) et dans Jump (avant aujourd'hui). */
export const DEMO_JOURS_TRACK = 5;
export const DEMO_JOURS_JUMP = 2;
/** Morts envoyées aujourd'hui dans Jump (en cours). */
export const DEMO_MORTS = 12;

/**
 * Ce que le Garage de « Démo » doit montrer, lu dans la table des règles (`DEBLOCAGES`, `packages/sim/src/garage.ts`) : la Weasel (`evolution`, des ors) et la Badger (`rallye`, des jours
 * joués) débloquées, la Pelican (`fourgon`, moins de jours) avec elles, et **aucune autre** : ni le pick-up (ors), ni la Moray (jours), ni le proto (auteur).
 */
export const DEMO_GARAGE = {
  ors: DEBLOCAGES.evolution.type === "medailles" ? DEBLOCAGES.evolution.nombre : 3,
  jours: DEBLOCAGES.rallye.type === "jours" ? DEBLOCAGES.rallye.nombre : 7,
};

/**
 * Les jours de Track **en plus de la série** qui donnent à « Démo » le Garage voulu à la date `today`. Les cinq jours de la série ont l'or tant qu'ils sont avant la bascule des médailles
 * (28/10/2026) : il manque des ors (`ors`) quand la série les a perdus, et des jours joués (`sansOr`) quand la série ne suffit pas. Les jours en plus sont **d'avant la bascule** (le pilote
 * y a l'or), pris en descendant à partir de `depart`, **jamais collés à la série** (un jour sans course entre les deux : la série reste de cinq jours) et jamais avant le premier niveau de
 * DailyJump (16/10/2026 : un jour de Track seul compterait comme une journée parfaite). Sur la recette, la date est toujours assez loin de là.
 */
export function planGarage(today: number): { serie: number[]; orsDeLaSerie: number; ors: number; sansOr: number; depart: number } {
  const serie = Array.from({ length: DEMO_JOURS_TRACK }, (_, i) => today - DEMO_JOURS_TRACK + 1 + i);
  const orsDeLaSerie = serie.filter((d) => d < BASCULE_LOT_35).length;
  const ors = Math.max(0, DEMO_GARAGE.ors - orsDeLaSerie);
  const sansOr = Math.max(0, DEMO_GARAGE.jours - DEMO_JOURS_TRACK - ors);
  return { serie, orsDeLaSerie, ors, sansOr, depart: Math.min(serie[0]! - 2, BASCULE_LOT_35 - 1) };
}

/**
 * Une vraie course du pilote pour un jour d'avant la bascule : `"or"` = une médaille d'or exactement (ni l'argent, ni **l'auteur**, qui débloquerait le proto), `"sans-or"` = argent, bronze
 * ou rien (le pilote ralenti : l'adhérence baisse jusqu'à sortir de l'or). `null` si ce jour-là aucun réglage ne le fait (le jour est sauté).
 */
function courseGarage(day: number, voulu: "or" | "sans-or"): { code: string; ms: number } | null {
  const circuit = dailyCircuit(day);
  const medals = medalsFor(circuit.authorMs, day);
  for (let grip = 0.98; grip >= 0.3; grip = Math.round((grip - 0.02) * 100) / 100) {
    const run = runPilot(circuit.track, { grip });
    if (!run.valid) continue;
    const medal: Medal | null = medalFor(run.finishMs, medals);
    if (voulu === "or" ? medal === "gold" : medal !== "gold" && medal !== "author") return { code: encodeReplay(run.replay), ms: run.finishMs };
  }
  return null;
}

const ADMIN = "jeton-du-joueur-de-demonstration-0123456789";

export interface DemoReport {
  track: { date: string; ms: number; medal: string | null }[];
  /** Les jours de Track en plus de la série (le Garage) : leur médaille est « gold » pour les jours en or, jamais l'or pour les autres. */
  garage: { date: string; ms: number; medal: string | null }[];
  jump: { date: string; ticks: number }[];
  morts: number;
}

/** Crée (ou recrée) le joueur « Démo » dans la base donnée, jusqu'au jour `today` (numéro de jour de Paris). Lève si un envoi est refusé. `sansJump` : Track seulement (les tests du Garage, bien plus rapides). */
export async function seedPortailDemo(o: { db: SqlDb; frozen: Readonly<Record<string, unknown>>; today: number; sansJump?: boolean }): Promise<DemoReport> {
  let clock = parisDayStart(o.today) + 12 * 3_600_000;
  const api = createApi({ db: o.db, now: () => clock, demoPlayers: true, jumpFrozen: o.frozen, adminToken: ADMIN, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await api.handle(
      new Request(`http://recette.local${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }),
      { clientKey: "192.0.2.10" },
    );
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as Record<string, any> };
  };
  const must = (label: string, r: { status: number; body: Record<string, any> }) => {
    if (r.status !== 200) throw new Error(`joueur de démonstration : ${label} refusé (${r.status} ${String(r.body?.error ?? "")} ${String(r.body?.message ?? "")})`);
    return r.body;
  };

  // 1. Repartir de zéro : effacé par la route d'admin (rien s'il n'existe pas encore).
  const erased = await call("POST", "/api/admin/effacer", { code: DEMO_JOUEUR_CODE, confirmer: true }, { Authorization: `Bearer ${ADMIN}` });
  if (erased.status !== 200 && erased.body?.error !== "unknown_player") must("effacement", erased);

  const report: DemoReport = { track: [], garage: [], jump: [], morts: 0 };
  // 1b. Track, le Garage : des jours d'avant la bascule, en dehors de la série (plus anciens d'abord), chaque course rejouée par le serveur (voir `planGarage`).
  const plan = planGarage(o.today);
  const extras: { day: number; code: string; ms: number }[] = [];
  for (let day = plan.depart, or = plan.ors, sans = plan.sansOr; day >= PREMIER_JOUR_JUMP && (or > 0 || sans > 0); day--) {
    const c = courseGarage(day, or > 0 ? "or" : "sans-or");
    if (!c) continue;
    extras.push({ day, ...c });
    if (or > 0) or--;
    else sans--;
  }
  for (const e of extras.reverse()) {
    clock = parisDayStart(e.day) + 12 * 3_600_000;
    const r = must(`Track ${formatDay(e.day)} (Garage)`, await call("POST", "/api/submit", { playerId: DEMO_JOUEUR_ID, name: DEMO_JOUEUR_NOM, date: formatDay(e.day), replay: e.code }));
    report.garage.push({ date: formatDay(e.day), ms: r.ms as number, medal: (r.medal as string | null) ?? null });
  }

  // 2. Track : les 5 derniers jours (aujourd'hui compris), chaque course rejouée par le serveur. Chaque jour d'avant la bascule : la médaille d'or (le pilote,
  // de plus en plus prudent, jusqu'à passer sous le seuil de l'auteur sans dépasser celui de l'or).
  for (let day = o.today - DEMO_JOURS_TRACK + 1; day <= o.today; day++) {
    const circuit = dailyCircuit(day);
    const medals = medalsFor(circuit.authorMs, day); // les seuils du jour (bascule du lot 35 le 28/10/2026), comme le serveur
    let chosen: { code: string; ms: number } | null = null;
    for (let grip = 0.98; grip >= 0.5 && !chosen; grip -= 0.02) {
      const run = runPilot(circuit.track, { grip });
      if (!run.valid) continue;
      const medal = medalFor(run.finishMs, medals);
      if (medal === "gold") chosen = { code: encodeReplay(run.replay), ms: run.finishMs }; // l'or exactement, jamais l'auteur (qui débloquerait le proto du Garage)
    }
    if (!chosen) {
      // Aucun réglage du pilote ne tombe dans la médaille visée ce jour-là : sa course la plus rapide (le portail montre alors la médaille qu'elle vaut, ou aucune). Depuis la bascule
      // du lot 35 (28/10/2026) c'est le cas de tous les jours : les seuils sont calibrés sur de vrais joueurs (or à 0,88 fois le temps du pilote) et aucun réglage du pilote n'est plus
      // rapide que 0,97 fois son propre temps (mesuré sur trois jours, grip jusqu'à 1,5) — le joueur de démonstration n'a plus de médaille de Track tant qu'il n'a pas mieux qu'un pilote.
      let best: { run: ReturnType<typeof runPilot> } | null = null;
      for (const opts of [{ grip: 0.98 }, { grip: 1.1 }, { grip: 1.5, look: 0.45 }]) {
        const run = runPilot(circuit.track, opts);
        if (run.valid && (!best || run.finishMs < best.run.finishMs)) best = { run };
      }
      if (!best) throw new Error(`joueur de démonstration : le pilote ne finit pas le circuit du ${formatDay(day)}`);
      chosen = { code: encodeReplay(best.run.replay), ms: best.run.finishMs };
    }
    clock = parisDayStart(day) + 12 * 3_600_000;
    const r = must(`Track ${formatDay(day)}`, await call("POST", "/api/submit", { playerId: DEMO_JOUEUR_ID, name: DEMO_JOUEUR_NOM, date: formatDay(day), replay: chosen.code }));
    report.track.push({ date: formatDay(day), ms: r.ms as number, medal: (r.medal as string | null) ?? null });
  }

  // 3. Jump : avant-hier et hier, un essai qui arrive (rejoué) ; les jours d'avant le premier niveau sont sautés.
  const asDemo = { "X-Player-Id": DEMO_JOUEUR_ID };
  for (let day = o.today - DEMO_JOURS_JUMP; day < o.today && !o.sansJump; day++) {
    if (day < PREMIER_JOUR_JUMP) continue;
    const d = jumpDailyOf(day, o.frozen);
    const attempt = demoAttempts(d.level, d.replay, 0xde30 + day, { attempts: 24 }).find((a) => a.end === "arrivée" && replayAttempt(d.level, a.replay, d.id).finished);
    clock = parisDayStart(day) + 12 * 3_600_000;
    const body = { levelId: d.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: attempt ? encodeJump(attempt.replay) : d.code };
    const r = must(`Jump ${formatDay(day)}`, await call("POST", "/api/jump/submit", body, asDemo));
    report.jump.push({ date: formatDay(day), ticks: r.ticks as number });
  }

  // 4. Jump aujourd'hui : en cours — des morts (des vies rejouées qui finissent par une mort), aucun essai classé.
  if (o.today >= PREMIER_JOUR_JUMP && !o.sansJump) {
    const d = jumpDailyOf(o.today, o.frozen);
    const lives: string[] = [];
    for (const a of demoAttempts(d.level, d.replay, 0xde31, { attempts: 30, maxLives: 8 })) {
      for (const life of replayAttempt(d.level, a.replay, d.id).lives) {
        const code = encodeJump(lifeReplay(a.replay, life));
        if (life.end === "mort" && lives.length < DEMO_MORTS && !lives.includes(code)) lives.push(code);
      }
    }
    clock = parisDayStart(o.today) + 12 * 3_600_000;
    const r = must("vies de Jump", await call("POST", "/api/jump/lives", { levelId: d.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, lives }, asDemo));
    report.morts = r.dayCount as number;
  }
  return report;
}
