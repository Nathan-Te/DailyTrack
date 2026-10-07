import {
  AXIS_MAX,
  CELL,
  GENERATOR_VERSION,
  PREMIER_JOUR,
  ReplayRecorder,
  Rng,
  SIM_VERSION,
  cellKey,
  circuitNumber,
  createAutopilot,
  createRace,
  dailyCircuit,
  encodeReplay,
  formatDay,
  makeInput,
  mixSeed,
  stepRace,
  trackJumps,
  type Track,
} from "@cdj/sim";
import { createApi } from "./api";
import type { SqlDb } from "./db";
import { openSqlite } from "./node-sqlite";

// Historique de circuits (lot 11) : pour chaque jour passé, 8 à 15 pilotes au pseudo manifestement fictif font une
// course conduite par le pilote automatique (niveaux variés : adhérence, gaz limités, petites hésitations de volant).
// Leurs courses passent par **le même chemin de validation que les vraies** : on les envoie à `createApi(...).handle`
// (rejeu côté serveur, temps recalculé, mêmes règles de jour ouvert) avec une horloge réglée sur le jour concerné. Il n'y a
// aucune écriture directe en base. Les joueurs sont marqués `demo`. Le jeu de données exporté sert le mode `?api=demo`.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const DEMO_DAYS = 14;

/** Pseudos fictifs (acceptés par `cleanName`) : un préfixe qui ne laisse aucun doute. */
const NAMES = [
  "Démo Renard", "Démo Mistral", "Démo Zéphyr", "Démo Orage", "Démo Cactus", "Démo Brume", "Démo Étincelle", "Démo Galet",
  "Démo Tonnerre", "Démo Plume", "Démo Cyclone", "Démo Marmotte", "Démo Comète", "Démo Bouchon", "Démo Fusée", "Démo Tortue",
  "Démo Rafale", "Démo Pirate", "Démo Lynx", "Démo Biscotte", "Démo Aurore", "Démo Crabe", "Démo Chicane", "Démo Nitro",
  "Démo Pétale", "Démo Vortex", "Démo Gaufre", "Démo Sirocco", "Démo Mulot", "Démo Turbine",
] as const;

export interface DemoRow {
  rank: number;
  name: string;
  ms: number;
  medal: "author" | "gold" | "silver" | "bronze" | null;
}

export interface DemoGhost {
  name: string;
  rank: number;
  ms: number;
  splits: number[];
  replay: string;
  simVersion: number;
}

/** Un jour du jeu de données : classement figé (tous les pilotes) et fantôme du premier. */
export interface DemoDayData {
  date: string;
  participants: number;
  top: DemoRow[];
  ghost: DemoGhost | null;
}

export interface DemoIndexDay {
  date: string;
  number: number;
  /** Temps de l'auteur (pour les seuils de médailles). */
  authorMs: number;
  participants: number;
  firstMs: number;
}

export interface DemoIndex {
  simVersion: number;
  generatorVersion: number;
  /** Premier jour (n° 1) quand le jeu de données a été fait. */
  premierJour: string;
  /** Jour « d'aujourd'hui » du mode démo : le lendemain du dernier jour de l'historique (figé, pour des archives stables). */
  demoToday: string;
  days: DemoIndexDay[];
}

export interface DemoDataset {
  index: DemoIndex;
  days: DemoDayData[];
}

/** Refuse de toucher une base qui contient de vrais joueurs : le script ne doit jamais tourner sur une base de production. */
export async function assertDemoOnly(db: SqlDb): Promise<void> {
  let real = 0;
  try {
    real = (await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE demo = 0"))?.n ?? 0;
  } catch {
    /* pas encore de table : base vierge */
  }
  if (real > 0) throw new Error(`Base refusée : ${real} vrai(s) joueur(s) dedans. history:seed ne tourne que sur une base vierge ou 100 % démo.`);
}

// --- Pilotes fictifs ----------------------------------------------------------------------------

export interface PilotStyle {
  /** Part de l'adhérence que le pilote automatique ose utiliser (plus bas = plus lent dans les virages). */
  grip: number;
  /** Anticipation du point visé. */
  look: number;
  /** Plafond des gaz (1 = plein gaz). */
  throttleCap: number;
  /** Vitesse au-delà de laquelle le pilote lève le pied (m/s) : un pilote prudent ne pousse pas jusqu'à la pointe. */
  topSpeed: number;
  /** Amplitude des hésitations de volant (0 = aucune). */
  wobble: number;
}

/** Style d'un pilote de niveau `skill` ∈ [0, 1] (1 = presque l'auteur, 0 = prudent et brouillon). */
export function styleFor(skill: number): PilotStyle {
  return { grip: 1.05 - 0.65 * (1 - skill), look: 0.3 + 0.12 * (1 - skill), throttleCap: 1 - 0.5 * (1 - skill), topSpeed: 24 + 40 * skill, wobble: 0.35 * (1 - skill) };
}

/** Fait rouler le pilote automatique avec ce style ; `null` s'il ne finit pas (sorti de la route, bloqué, repris). */
export function runFictional(track: Track, style: PilotStyle, seed: number, maxSeconds = 150): { code: string; finishMs: number } | null {
  const race = createRace(track);
  // Sauts (lot 17) : même un pilote prudent accélère avant une rampe, il sait qu'un saut se prend avec de la vitesse. Dans les quatre
  // blocs qui précèdent la rampe (et sur elle), il ne lève plus le pied et met plein gaz comme le pilote automatique.
  const jumps = trackJumps(track).map((j) => ({ from: j.kick - 4, to: j.kick }));
  const drive = createAutopilot(track, { grip: style.grip, look: style.look });
  const rec = new ReplayRecorder();
  const rng = new Rng(seed);
  let wob = 0;
  let stuck = 0;
  const maxTicks = maxSeconds * 120;
  for (let t = 0; t < maxTicks && race.finishMs < 0 && race.respawns === 0; t++) {
    const base = drive(race);
    wob += ((rng.int(2001) - 1000) / 1000 - wob) * 0.04; // bruit lissé
    const steer = Math.max(-1, Math.min(1, base.steer / AXIS_MAX + wob * style.wobble));
    const speed = Math.sqrt(race.car.vx * race.car.vx + race.car.vz * race.car.vz);
    const here = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)))?.index ?? -1;
    const approach = jumps.find((j) => here >= j.from && here <= j.to);
    const gas = approach ? base.throttle / AXIS_MAX : speed > style.topSpeed ? 0 : (base.throttle / AXIS_MAX) * style.throttleCap;
    const input = makeInput(steer, gas, base.brake / AXIS_MAX);
    rec.record(input);
    stepRace(race, input);
    const v2 = race.car.vx * race.car.vx + race.car.vz * race.car.vz;
    stuck = v2 < 0.25 && t > 240 ? stuck + 1 : 0;
    if (stuck > 360) return null;
  }
  if (race.finishMs < 0 || race.respawns > 0) return null;
  return { code: encodeReplay(rec.toReplay(track.id)), finishMs: race.finishMs };
}

const hex32 = (rng: Rng) => Array.from({ length: 4 }, () => rng.next().toString(16).padStart(8, "0")).join("");

// --- Le jeu de données --------------------------------------------------------------------------

export interface SeedOptions {
  /** Nombre de jours d'historique (14 par défaut), à partir de `PREMIER_JOUR`. */
  days?: number;
  firstDay?: number;
  /** Pilotes par jour : entre `min` et `max`. */
  pilots?: { min: number; max: number };
  /** Appelé après chaque jour (affichage de la progression). */
  onDay?(info: { date: string; pilots: number; rejected: number; authorMs: number }): void;
  /** Base à utiliser (neuve en mémoire par défaut). */
  db?: SqlDb;
}

export async function seedHistory(options: SeedOptions = {}): Promise<DemoDataset> {
  const count = options.days ?? DEMO_DAYS;
  const firstDay = options.firstDay ?? PREMIER_JOUR;
  const minPilots = options.pilots?.min ?? 8;
  const maxPilots = options.pilots?.max ?? 15;
  const db = options.db ?? openSqlite(":memory:");
  await assertDemoOnly(db);

  let clock = firstDay * DAY_MS + 12 * HOUR_MS;
  const api = createApi({ db, now: () => clock, demoPlayers: true, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await api.handle(new Request(`http://seed.local${path}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  const index: DemoIndex = { simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, premierJour: formatDay(PREMIER_JOUR), demoToday: formatDay(firstDay + count), days: [] };
  const info = new Map<number, { authorMs: number }>();

  for (let k = 0; k < count; k++) {
    const day = firstDay + k;
    const date = formatDay(day);
    const circuit = dailyCircuit(day);
    if (circuit.fallback) throw new Error(`Circuit de secours le ${date} : le générateur n'a pas trouvé de circuit valide`);
    info.set(day, { authorMs: circuit.authorMs });
    const rng = new Rng(mixSeed(day, 0x11d3));
    const wanted = minPilots + rng.int(maxPilots - minPilots + 1);
    const names = rng.shuffle(NAMES).slice(0, wanted);
    let accepted = 0;
    let rejected = 0;
    for (let p = 0; p < names.length; p++) {
      // Niveau de 0 à 1, avec un peu plus de pilotes moyens ou prudents que de très bons.
      const skill = (rng.int(1000) / 1000) ** 1.3;
      let run: { code: string; finishMs: number } | null = null;
      for (let attempt = 0; attempt < 4 && !run; attempt++) {
        const style = styleFor(Math.min(1, skill + attempt * 0.12)); // un échec : on réessaie en plus sage
        run = runFictional(circuit.track, { ...style, wobble: style.wobble / (1 + attempt) }, mixSeed(day, p * 31 + attempt));
      }
      if (!run) {
        rejected++;
        continue;
      }
      clock = day * DAY_MS + 12 * HOUR_MS + (p + 1) * 1000;
      const res = await call("POST", "/api/submit", { playerId: hex32(rng), name: names[p]!, date, replay: run.code });
      if (res.status === 200) accepted++;
      else rejected++; // refus du serveur : la course ne compte pas (jamais de contournement)
    }
    if (accepted < 3) throw new Error(`Seulement ${accepted} pilote(s) classé(s) le ${date} : le jeu de données serait trop pauvre`);
    options.onDay?.({ date, pilots: accepted, rejected, authorMs: circuit.authorMs });
  }

  // Tous les jours sont passés : on lit les classements figés et le fantôme du premier, comme le jeu le ferait.
  clock = (firstDay + count) * DAY_MS + 12 * HOUR_MS;
  const days: DemoDayData[] = [];
  for (let k = 0; k < count; k++) {
    const day = firstDay + k;
    const date = formatDay(day);
    const board = await call("GET", `/api/day/${date}/leaderboard?limit=50`);
    const ghost = await call("GET", `/api/day/${date}/ghost?kind=first`);
    const top = board.body.top as DemoRow[];
    days.push({ date, participants: board.body.participants as number, top, ghost: ghost.status === 200 ? (ghost.body as unknown as DemoGhost) : null });
    index.days.push({ date, number: circuitNumber(day), authorMs: info.get(day)!.authorMs, participants: top.length, firstMs: top[0]?.ms ?? 0 });
  }
  return { index, days };
}
