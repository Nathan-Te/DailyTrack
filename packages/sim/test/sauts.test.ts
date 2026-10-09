import { describe, expect, it } from "vitest";
import {
  parseToken,
  CELL,
  MIN_RELIEF,
  THEME_NAMES,
  bestPilotRun,
  blockPoint,
  carSpeed,
  createRace,
  daysFromCivil,
  dailyCircuit,
  dirX,
  dirZ,
  jumpLandingDistance,
  jumpMinSpeed,
  makeInput,
  needsFreeze,
  parseTrack,
  reliefOf,
  stepRace,
  trackJumps,
  type DailyCircuit,
} from "../src/index";

// Les sauts du lot 17 : rampe K, vide G, réception. La fenêtre de vitesse (`trackJumps`) se vérifie contre la vraie
// simulation, puis sur les circuits du jour.

/** Les cinq types de saut du générateur (voir `jumpCalm`), chacun précédé d'une longue ligne droite et suivi de lignes droites. */
const SPECS: Record<string, string> = {
  court: "S@start S S S S S K GD S S S S S S S@finish",
  plat: "S@start S S S S S K G D S S S S S S S@finish",
  long: "S@start S S S S S K G G D S S S S S S S S@finish",
  "long bas": "S@start S S S S S K G GD D S S S S S S S S@finish",
  haut: "S@start S S S S S K GU S S S S S S S S S@finish",
};
const KICK = 6;

interface Flight {
  fell: boolean;
  /** Vitesse au passage du bord de la rampe. */
  lip: number;
  /** Vitesse 40 m après la réception. */
  after: number;
  respawned: boolean;
}

/**
 * Lance la voiture sur la rampe du saut : à `entry` m/s au début de la rampe, accélérateur à fond, volant droit.
 * `ticks` pas au plus.
 */
function fly(spec: string, entry: number, throttle = 1, freeze = true): Flight {
  const track = parseTrack("saut", spec);
  const race = createRace(track);
  const k = track.blocks[KICK]!;
  const lip = { x: 0, z: 0 };
  blockPoint(k, CELL / 2, CELL, lip);
  race.car.x = k.cx * CELL + CELL / 2;
  race.car.z = k.cz * CELL + 0.5;
  race.car.y = k.y0;
  race.car.vz = entry;
  let lipSpeed = 0;
  const past = (b: { cz: number }, z: number) => z - b.cz * CELL;
  const end = track.blocks.length * CELL;
  let after = 0;
  let landedZ = Infinity;
  for (let i = 0; i < 20 * 120; i++) {
    // Lot 19 : la caisse garde sa rotation en l'air ; un bon joueur la fige au frein (`freeze`), comme le pilote.
    stepRace(race, makeInput(0, throttle, freeze && needsFreeze(race.car) ? 1 : 0));
    const c = race.car;
    if (lipSpeed === 0 && (c.x - lip.x) * dirX(k.dir) + (c.z - lip.z) * dirZ(k.dir) >= 0) lipSpeed = carSpeed(c);
    if (race.fallTicks > 0 || race.respawns > 0) return { fell: true, lip: lipSpeed, after: 0, respawned: race.respawns > 0 };
    if (c.grounded && lipSpeed > 0 && past(k, c.z) > 2 * CELL && landedZ === Infinity) landedZ = past(k, c.z);
    if (landedZ !== Infinity && past(k, c.z) > landedZ + 40) {
      after = carSpeed(c);
      break;
    }
    if (c.z > end) break;
  }
  return { fell: false, lip: lipSpeed, after, respawned: false };
}

/** Vitesse d'entrée minimale (bissection) qui franchit le saut, et la vitesse au bord de la rampe qui en résulte. */
function threshold(spec: string): number {
  let lo = 15;
  let hi = 100;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (fly(spec, mid).fell) lo = mid;
    else hi = mid;
  }
  return fly(spec, hi).lip;
}

describe("fenêtre de vitesse d'un saut", () => {
  for (const [name, spec] of Object.entries(SPECS)) {
    const track = parseTrack(name, spec);
    const [jump] = trackJumps(track);

    it(`${name} : le bas de la fenêtre prévu par jumpMinSpeed colle à la simulation (entre −3 % et +10 %)`, () => {
      expect(jump).toBeDefined();
      expect(jump!.kick).toBe(KICK);
      const real = threshold(spec);
      expect(jump!.minSpeed, `${name} : simulé ${real.toFixed(1)} m/s`).toBeGreaterThan(real * 0.97);
      expect(jump!.minSpeed, `${name} : simulé ${real.toFixed(1)} m/s`).toBeLessThan(real * 1.1);
    });

    it(`${name} : dans la fenêtre on atterrit sans fautes ni perte de vitesse, en dessous on tombe`, () => {
      // Dans la fenêtre : 10 % au-dessus du plancher, jusqu'à la vitesse maximale du circuit (88 m/s au super turbo).
      for (const lip of [jump!.minSpeed * 1.1, Math.min(jump!.maxSpeed * 0.9, 80)]) {
        const entry = lip - 1.5; // la rampe accélère un peu (l'accélérateur est à fond)
        const ok = fly(spec, entry);
        expect(ok.fell, `${name} à ${lip.toFixed(0)} m/s`).toBe(false);
        // Réception à plat ou en descente : la vitesse de la réception se garde (aucune perte hors tolérance).
        expect(ok.after, `${name} à ${lip.toFixed(0)} m/s`).toBeGreaterThan(ok.lip * 0.93);
      }
      // En dessous : la voiture retombe dans le vide, puis reprend.
      for (const share of [0.85, 0.6]) {
        const bad = fly(spec, jump!.minSpeed * share, 0);
        // Trop lente, la voiture tombe dans le vide, ou cale sur la rampe (60 % : elle ne passe même pas le bord).
        expect(bad.fell || bad.lip < 12, `${name} à ${(share * 100).toFixed(0)} % du plancher`).toBe(true);
        expect(bad.after, `${name} à ${(share * 100).toFixed(0)} % du plancher`).toBe(0);
      }
    });
  }

  it("le plafond (jumpMaxSpeed) est la vitesse qui ferait retomber la voiture après la ligne droite de réception", () => {
    for (const [name, spec] of Object.entries(SPECS)) {
      const [jump] = trackJumps(parseTrack(name, spec));
      expect(jump!.maxSpeed, name).toBeGreaterThan(jump!.minSpeed * 1.5);
      expect(jumpLandingDistance(jump!.maxSpeed, jump!.rise) * 1.12, name).toBeLessThanOrEqual(jump!.gap + jump!.runout);
    }
  });

  it("deux cellules de vide demandent plus de vitesse qu'une seule ; un bord plus bas en demande moins", () => {
    expect(jumpMinSpeed(64, 0)).toBeGreaterThan(jumpMinSpeed(32, 0));
    expect(jumpMinSpeed(32, -4)).toBeLessThan(jumpMinSpeed(32, 0));
    expect(jumpMinSpeed(32, 4)).toBeGreaterThan(jumpMinSpeed(32, 0));
    expect(jumpMinSpeed(32, 12)).toBe(Infinity); // hors de portée de la rampe
  });
});

// --- Circuits du jour ----------------------------------------------------------------------

const FROM = daysFromCivil(2026, 10, 6);
const DAYS = Array.from({ length: 60 }, (_, i) => FROM + i);
const circuits = new Map<number, DailyCircuit>();
const circuit = (d: number) => {
  let c = circuits.get(d);
  if (!c) circuits.set(d, (c = dailyCircuit(d)));
  return c;
};

describe("sauts et reliefs des circuits du jour (60 dates)", () => {
  it("le dénivelé de chaque circuit atteint au moins MIN_RELIEF", { timeout: 120_000 }, () => {
    for (const d of DAYS) {
      const c = circuit(d);
      expect(reliefOf(c.spec.split(" ")), c.spec).toBeGreaterThanOrEqual(MIN_RELIEF);
    }
  });

  it("le pilote franchit chaque saut dans sa fenêtre (avec marge), sans chute ni reprise", { timeout: 120_000 }, () => {
    let jumps = 0;
    for (const d of DAYS) {
      const c = circuit(d);
      const run = bestPilotRun(c.track)!;
      expect(run.respawns, c.spec).toBe(0);
      expect(run.jumpsOk, c.spec).toBe(true);
      for (const j of run.jumps) {
        jumps++;
        expect(j.speed, `${c.date} saut @${j.jump.kick}`).toBeGreaterThanOrEqual(j.jump.minSpeed * 1.08);
        expect(j.speed, `${c.date} saut @${j.jump.kick}`).toBeLessThanOrEqual(j.jump.maxSpeed);
      }
    }
    expect(jumps).toBeGreaterThan(30); // huit thèmes depuis le lot 22 : Col alpin et Ville ont peu de sauts
  });

  it("Stade, Nuit et Rallye ont toujours au moins un vrai saut ; Banquise et Campagne en ont parfois", { timeout: 120_000 }, () => {
    const share: Record<string, number> = {};
    for (const name of THEME_NAMES) {
      const days = DAYS.map(circuit).filter((c) => c.theme === name);
      const withJump = days.filter((c) => trackJumps(c.track).length > 0).length;
      share[name] = days.length ? withJump / days.length : 1;
      console.info(`[sauts] ${name} : ${withJump}/${days.length} circuits avec un vrai saut`);
    }
    expect(share.stade).toBe(1);
    expect(share.canyon).toBe(1); // longs sauts au-dessus des ravins (lot 22)
    expect(share.nuit).toBe(1);
    expect(share.rallye).toBe(1);
    expect(share.banquise).toBeLessThan(1);
    expect(share.campagne).toBeLessThan(1);
  });

  it("une section sans rebords (`o`) est surélevée d'au moins 6 m, hors départ, arrivée, rampes et vides ; le vide en bas-côté (`~v`, lot 21) aussi hors de ces blocs", { timeout: 120_000 }, () => {
    let sections = 0;
    for (const d of DAYS) {
      const c = circuit(d);
      const blocks = c.track.blocks;
      const tokens = c.spec.split(" ");
      const low = Math.min(...blocks.flatMap((b) => [b.y0, b.y0 + b.rise]));
      for (const b of blocks.filter((x) => x.open)) {
        expect(["kick", "gap", "jump"]).not.toContain(b.kind);
        expect(b.mark).not.toBe("start");
        expect(b.mark).not.toBe("finish");
        if (!parseToken(tokens[b.index]!).open) continue; // bas-côté vide d'un thème (Nuit) : à toute hauteur
        sections++;
        expect(Math.min(b.y0, b.y0 + b.rise) - low, c.spec).toBeGreaterThanOrEqual(6);
        expect(["kick", "gap", "jump"]).not.toContain(b.kind);
        expect(b.mark).not.toBe("start");
        expect(b.mark).not.toBe("finish");
      }
    }
    expect(sections).toBeGreaterThan(0);
  });
});
