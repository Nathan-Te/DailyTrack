import { describe, expect, it } from "vitest";
import {
  BLOCS_LOT58,
  CROWN_SLOPE,
  DEFAULT_CAR_PARAMS as P,
  FX_BROKEN,
  FX_CRUISE,
  FX_FRAGILE,
  FX_NO_BRAKE,
  FX_NO_STEER,
  TICK_RATE,
  CELL,
  bankAt,
  bestPilotRun,
  cellKey,
  trackCenterline,
  buildFigure,
  carSpeed,
  createFigureTrack,
  createRace,
  decodeReplay,
  encodeReplay,
  liftAt,
  makeInput,
  parseTrack,
  replayRace,
  stepRace,
  type RaceState,
  type WidthLetter,
} from "../src/index";

// Lot 58 : tests chiffrés des familles de blocs nouvelles (comme au lot 7) — chaque effet appliqué puis retiré, la glisse sur la route bombée, la
// tenue dans le virage très relevé — et les prototypes finis par le pilote. Les seuils sont recopiés dans le README du lot
// (`docs/lots/lot-58-blocs-complexes.md`) : s'ils changent, la sensation a changé.

const GAS = makeInput(0, 1, 0);
const BRAKE = makeInput(0, 0, 1);
const LEFT = makeInput(-1, 1, 0);

/** Une course lancée à `v` m/s dans l'axe du premier bloc (cap +z). */
function lance(spec: string, v: number): RaceState {
  const race = createRace(parseTrack("lot58", spec));
  race.car.vz = v;
  return race;
}
const roule = (race: RaceState, input = GAS, ticks = 1) => {
  for (let i = 0; i < ticks; i++) stepRace(race, input);
};
/** Roule à plein gaz jusqu'à l'avance `z` (m). */
const jusqua = (race: RaceState, z: number, input = GAS) => {
  for (let i = 0; i < 20 * TICK_RATE && race.car.z < z; i++) stepRace(race, input);
};
/** La bande de l'effet au bloc `k` (cap +z) finit à z = 32 k + 18. */
const apres = (k: number) => 32 * k + 19;

describe("blocs à effet (lot 58) : chaque effet appliqué puis retiré", () => {
  it("direction bloquée : le volant n'agit plus 1,5 s, puis il revient", () => {
    const race = lance("S@start S S Ed S S S S S S S S S@finish", 30);
    jusqua(race, apres(3));
    expect(race.car.fx).toBe(FX_NO_STEER);
    expect(race.car.fxTicks).toBeGreaterThan(P.fxSteerTicks - 10);
    const cap = race.car.yaw;
    roule(race, LEFT, TICK_RATE / 2);
    expect(Math.abs(race.car.yaw - cap)).toBeLessThan(0.01);
    while (race.car.fx) roule(race, GAS);
    expect(race.car.tick).toBeGreaterThan(P.fxSteerTicks);
    const cap2 = race.car.yaw;
    roule(race, LEFT, TICK_RATE / 4);
    expect(Math.abs(race.car.yaw - cap2)).toBeGreaterThan(0.1);
  });

  it("freins coupés : 1 s de frein à 40 m/s ne retire que la roue libre (≈ 3 m/s), contre plus de 30 m/s sans l'effet", () => {
    const race = lance("S@start S S Ef S S S S S S S S S@finish", 40);
    jusqua(race, apres(3));
    expect(race.car.fx).toBe(FX_NO_BRAKE);
    const v0 = carSpeed(race.car);
    roule(race, BRAKE, TICK_RATE);
    expect(v0 - carSpeed(race.car)).toBeLessThan(P.coast + 1);
    const libre = lance("S@start S S S S S S S S S S S S@finish", 40);
    jusqua(libre, apres(3));
    const w0 = carSpeed(libre.car);
    roule(libre, BRAKE, TICK_RATE);
    expect(w0 - carSpeed(libre.car)).toBeGreaterThan(30);
  });

  it("régulateur : la vitesse d'entrée tenue à 0,3 m/s près, gaz, frein et montée sans effet ; puis l'accélérateur revient", () => {
    // Lancée à 12 m/s : le régulateur tient une vitesse moyenne, où l'accélérateur se sent aussitôt après lui.
    const race = lance("S@start S S Er S U U D D S S S S S S S S@finish", 12);
    jusqua(race, apres(3));
    expect(race.car.fx).toBe(FX_CRUISE);
    const v0 = race.car.fxSpeed;
    expect(v0).toBeGreaterThan(10);
    for (const input of [GAS, BRAKE, GAS]) {
      for (let i = 0; i < TICK_RATE; i++) {
        stepRace(race, input);
        if (race.car.grounded) expect(Math.abs(carSpeed(race.car) - v0), `t=${race.car.tick}`).toBeLessThan(0.3 + Math.abs(race.car.vy));
      }
    }
    while (race.car.fx) roule(race, GAS);
    const v1 = carSpeed(race.car);
    roule(race, GAS, TICK_RATE / 2);
    expect(carSpeed(race.car) - v1).toBeGreaterThan(1);
  });

  it("voiture fragile : un saut à plat se pose, une chute de deux niveaux casse la voiture (retour au point de contrôle)", () => {
    const pose = lance("S@start S S Ex S S K GD S S S S S@finish", 44);
    jusqua(pose, 32 * 11);
    expect(pose.respawns).toBe(0);
    expect(pose.car.fx).toBe(FX_FRAGILE);
    const casse = lance("S@start S S Ex S S K GD2 S S S S S S@finish", 44);
    let cassee = false;
    for (let i = 0; i < 10 * TICK_RATE && casse.respawns === 0; i++) {
      stepRace(casse, GAS);
      if (casse.car.fx === FX_BROKEN) cassee = true;
    }
    expect(cassee).toBe(true);
    expect(casse.respawns).toBe(1);
    expect(casse.car.fx).toBe(0);
    // La même chute, voiture ordinaire : rien ne casse.
    const sans = lance("S@start S S S S S K GD2 S S S S S S@finish", 44);
    jusqua(sans, 32 * 12);
    expect(sans.respawns).toBe(0);
  });

  it("voiture fragile : une réception de travers (tangage 0,7) la casse aussi", () => {
    const race = lance("S@start S S Ex S S S S S S S@finish", 30);
    jusqua(race, apres(3));
    race.car.y = 2;
    race.car.vy = 0;
    race.car.pitch = 0.7;
    race.car.grounded = 0;
    race.car.air = 100;
    let cassee = false;
    for (let i = 0; i < TICK_RATE && !cassee; i++) {
      stepRace(race, GAS);
      cassee = race.car.fx === FX_BROKEN;
    }
    expect(cassee).toBe(true);
  });

  it("voiture fragile : un rebord pris de face casse la voiture ; la même voiture sans l'effet repart", () => {
    // Tout droit, sans braquer, dans le mur extérieur d'un virage serré.
    const avec = lance("S@start S S Ex S S L S S@finish", 30);
    let cassee = false;
    for (let i = 0; i < 8 * TICK_RATE && !cassee; i++) {
      stepRace(avec, GAS);
      cassee = avec.car.fx === FX_BROKEN;
    }
    expect(cassee).toBe(true);
    const sans = lance("S@start S S S S S L S S@finish", 30);
    roule(sans, GAS, 8 * TICK_RATE);
    expect(sans.respawns).toBe(0);
    expect(sans.fallTicks).toBe(0);
  });

  it("un seul effet à la fois : le dernier franchi remplace l'autre ; la remise à zéro les éteint tous, moteur coupé compris", () => {
    const race = lance("S@start S S Ed Ef C S E0 S S S S@finish", 40);
    jusqua(race, apres(4));
    expect(race.car.fx).toBe(FX_NO_BRAKE);
    jusqua(race, apres(5));
    expect(race.car.cut).toBe(1);
    expect(race.car.fx).toBe(FX_NO_BRAKE);
    jusqua(race, apres(7));
    expect(race.car.fx).toBe(0);
    expect(race.car.cut).toBe(0);
  });

  it("un point de contrôle et l'arrivée éteignent l'effet", () => {
    const race = lance("S@start S S Ef S S@cp S S Er S S@finish", 40);
    jusqua(race, apres(3));
    expect(race.car.fx).toBe(FX_NO_BRAKE);
    jusqua(race, 32 * 6);
    expect(race.car.fx).toBe(0);
    jusqua(race, apres(8));
    expect(race.car.fx).toBe(FX_CRUISE);
    jusqua(race, 32 * 11);
    expect(race.finishMs).toBeGreaterThan(0);
    expect(race.car.fx).toBe(0);
    roule(race, GAS, 3 * TICK_RATE);
    expect(carSpeed(race.car)).toBeLessThan(1); // elle freine après la ligne
  });
});

describe("route bombée (lot 58)", () => {
  it("le profil : pente au bord `CROWN_SLOPE`, nulle sur l'axe, et chute de k × hw ÷ 2 au bord ; elle naît de la route plate", () => {
    const t = parseTrack("bombee", "S/n@start S S S/a S/a S S@finish");
    const b = t.blocks[4]!;
    expect(b.open).toBe(true);
    const out = { h: 0, gp: 0, gq: 0 };
    liftAt(b, 16 + 10, 16, out);
    expect(out.gp).toBeCloseTo(-CROWN_SLOPE, 9);
    expect(out.h).toBeCloseTo((-CROWN_SLOPE * 10) / 2, 9);
    liftAt(b, 16, 16, out);
    expect(out.h).toBeCloseTo(0, 12);
    // Le premier bloc bombé naît de la route plate : à son entrée il n'y a aucune marche ; à son milieu, la moitié de la pente.
    liftAt(t.blocks[3]!, 16 + 10, 0, out);
    expect(out.h).toBeCloseTo(0, 9);
    liftAt(t.blocks[3]!, 16 + 10, 16, out);
    expect(out.gp).toBeCloseTo(-CROWN_SLOPE / 2, 9);
  });

  it("sur l'axe on reste dessus ; à 4 m de l'axe sans braquer, on dérive vers le bord (≥ 1 m en 2 s à 30 m/s) ; à 8 m, on tombe", () => {
    const spec = "S/n@start S S/a S/a S/a S/a S/a S/a S/a S/a S S@finish";
    const depuis = (ecart: number) => {
      const race = lance(spec, 30);
      race.car.z = 32 * 2.2;
      race.car.x = 16 + ecart;
      let tombe = false;
      for (let i = 0; i < 2 * TICK_RATE; i++) {
        stepRace(race, makeInput(0, 0.5, 0));
        tombe ||= race.fallTicks > 0;
      }
      return { derive: race.car.x - 16 - ecart, tombe };
    };
    expect(Math.abs(depuis(0).derive)).toBeLessThan(0.01);
    const quatre = depuis(4);
    expect(quatre.derive).toBeGreaterThan(1);
    expect(quatre.tombe).toBe(false);
    expect(depuis(8).tombe).toBe(true);
  });
});

describe("virage très relevé (lot 58)", () => {
  it("pente 1 (45°) au milieu de l'arc ; le pilote prend l'ample plus vite que relevé (0,22) ou à plat", () => {
    const t = parseTrack("releve", "S@start S S L3/f S S@finish");
    const b = t.blocks[3]!;
    expect(b.steep).toBe(true);
    const bank = { h: 0, gp: 0, gq: 0 };
    // Milieu de l'arc, 4 m à l'extérieur de l'axe (rayon 80 m, centre en p = 16 + 80).
    const a = Math.PI / 4;
    bankAt(b, 16 + 80 - 84 * Math.cos(a), 84 * Math.sin(a), bank);
    expect(Math.hypot(bank.gp, bank.gq)).toBeCloseTo(1, 2);
    expect(bank.h).toBeCloseTo(4, 2);
    // Le bord intérieur descend 7 m sous la route (route étroite) : la voiture n'y est perdue que 4 m plus bas (`fallY`) ; le sol lointain du rendu ne bouge pas.
    expect(t.voidY).toBe(-4);
    expect(t.fallY).toBe(-11);
    expect(parseTrack("plat", "S@start S S L3/b S S@finish").fallY).toBeUndefined();
    const temps = (v: string) => bestPilotRun(parseTrack(v, `S@start S S S S L3${v} S S S@finish`), { cut: false })!.finishMs;
    const fort = temps("/f");
    expect(fort).toBeLessThan(temps("/b"));
    expect(fort).toBeLessThan(temps(""));
  });

  it("seulement sur un ample : un large ou un serré très relevé est refusé", () => {
    expect(() => parseTrack("x", "S@start L2/f S@finish")).toThrow();
    expect(() => parseTrack("x", "S@start L/f S@finish")).toThrow();
  });

  it("la caisse suit le relevé (retour de Nathan, 08/11/2026) : de 8 m à gauche à 8 m à droite de l'axe, roulis jamais au-delà de 1,15 (la pente du sol vaut 1 ; jusqu'à 1,5 sur l'ample et 8,4 sur un large avant la correction) posée (en l'air : moins de 2 % à l'intérieur, de 16 % vers l'extérieur, à la sortie)", () => {
    for (const ecart of [-8, -5, 0, 5, 8]) {
      const track = parseTrack("releve", "S/n@start S S S L3/f S S S S@finish");
      const cl = trackCenterline(track);
      const race = createRace(track);
      race.car.vz = 44;
      let pire = 0;
      let enLAir = 0;
      let dans = 0;
      for (let t = 0; t < 8 * TICK_RATE && race.finishMs < 0; t++) {
        const c = race.car;
        // Un conducteur simple : il vise la ligne médiane décalée de `ecart` m, 4 points devant.
        let k = 0;
        let d = Infinity;
        for (let i = 0; i < cl.x.length; i++) {
          const e = (cl.x[i]! - c.x) ** 2 + (cl.z[i]! - c.z) ** 2;
          if (e < d) [d, k] = [e, i];
        }
        const j = Math.min(cl.x.length - 1, k + 4);
        const tx = cl.x[j]! - cl.x[k]!;
        const tz = cl.z[j]! - cl.z[k]!;
        const tl = Math.hypot(tx, tz) || 1;
        let e = Math.atan2(cl.x[j]! + (ecart * tz) / tl - c.x, cl.z[j]! - (ecart * tx) / tl - c.z) - c.yaw;
        while (e > Math.PI) e -= 2 * Math.PI;
        while (e < -Math.PI) e += 2 * Math.PI;
        stepRace(race, makeInput(Math.max(-1, Math.min(1, -3 * e)), 1, 0));
        if (track.cells.get(cellKey(Math.floor(c.x / CELL), Math.floor(c.z / CELL)))?.index !== 4) continue;
        dans++;
        if (!c.grounded) enLAir++;
        pire = Math.max(pire, Math.abs(c.roll));
      }
      expect(dans, `écart ${ecart}`).toBeGreaterThan(200);
      expect(pire, `écart ${ecart}`).toBeLessThan(1.15);
      // Mesuré : 14 % à 8 m vers l'extérieur (un petit envol à la sortie, quand le relevé retombe) ; sur l'axe et à l'intérieur, sous 2 %.
      expect(enLAir / dans, `écart ${ecart}`).toBeLessThan(ecart > 0 ? 0.16 : 0.02);
    }
  });
});

describe("tube de glace : la glace de piste (lot 58, retour de Nathan)", () => {
  // Un conducteur simple, plein gaz, qui vise la ligne médiane : sur la glace de piste il passe le tube ; sur la glace d'avant (adhérence 0,3), la voiture ne
  // tient pas la paroi et s'arrête (mesuré : 0,1 m/s au plus bas, jamais à l'arrivée en 15 s).
  const conduire = (s: string) => {
    const track = parseTrack("tube", `S/n@start S S S ${s} S S S@finish`);
    const cl = trackCenterline(track);
    const race = createRace(track);
    race.car.vz = 40;
    let vmin = Infinity;
    for (let t = 0; t < 15 * TICK_RATE && race.finishMs < 0; t++) {
      const c = race.car;
      let k = 0;
      let d = Infinity;
      for (let i = 0; i < cl.x.length; i++) {
        const e = (cl.x[i]! - c.x) ** 2 + (cl.z[i]! - c.z) ** 2;
        if (e < d) [d, k] = [e, i];
      }
      const j = Math.min(cl.x.length - 1, k + 4);
      let e = Math.atan2(cl.x[j]! - c.x, cl.z[j]! - c.z) - c.yaw;
      while (e > Math.PI) e -= 2 * Math.PI;
      while (e < -Math.PI) e += 2 * Math.PI;
      stepRace(race, makeInput(Math.max(-1, Math.min(1, -3 * e)), 1, 0));
      const b = track.cells.get(cellKey(Math.floor(c.x / CELL), Math.floor(c.z / CELL)));
      if (b?.cuve) vmin = Math.min(vmin, carSpeed(c));
    }
    return { fin: race.finishMs, vmin, reprises: race.respawns };
  };

  it("plein gaz, la glace de piste passe le tube sans reprise, sans tomber sous 40 m/s ; la glace d'avant s'y arrête", () => {
    const piste = conduire("V/q V/q L3/cq V/q R3/cq V/q");
    expect(piste.fin).toBeGreaterThan(0);
    expect(piste.reprises).toBe(0);
    expect(piste.vmin).toBeGreaterThan(40);
    const glace = conduire("V/g V/g L3/cg V/g R3/cg V/g");
    expect(glace.fin).toBe(-1);
    expect(glace.vmin).toBeLessThan(5);
  });

  it("la glace de piste glisse dans l'axe : aucun roulement (en roue libre, elle perd moins que la route)", () => {
    const perte = (sol: string) => {
      const b = sol ? `S/${sol}` : "S";
      const race = lance(`S@start S S ${b} ${b} ${b} S S@finish`, 40);
      jusqua(race, 32 * 3 + 2);
      const v0 = carSpeed(race.car);
      roule(race, makeInput(0, 0, 0), TICK_RATE);
      return v0 - carSpeed(race.car);
    };
    expect(perte("q")).toBeLessThan(perte(""));
  });
});

const WIDTHS: readonly WidthLetter[] = ["e", "n", "l"];

describe("prototypes du lot 58", () => {
  it("au moins 6 familles, dont au moins 3 blocs à effet, la route bombée et un relevé ; des noms `bloc-…`", () => {
    expect(BLOCS_LOT58.length).toBeGreaterThanOrEqual(6);
    expect(BLOCS_LOT58.filter((e) => e.famille === "effet").length).toBeGreaterThanOrEqual(3);
    expect(BLOCS_LOT58.some((e) => e.famille === "bombee")).toBe(true);
    expect(BLOCS_LOT58.some((e) => e.famille === "releve")).toBe(true);
    for (const e of BLOCS_LOT58) expect(e.name.startsWith("bloc-")).toBe(true);
  });

  for (const e of BLOCS_LOT58) {
    it(`${e.name} : le pilote finit chaque variante, deux sens, trois largeurs`, () => {
      for (let v = 0; v < e.variants; v++) {
        for (const left of [true, false]) {
          for (const w of WIDTHS) {
            const body = buildFigure(e, left, w, v)!;
            const spec = [`S/${w}@start`, "S", "S", "S", "S", "S@cp", ...body.slice(body[0] === "S" ? 1 : 0), "S", "S@finish"].join(" ");
            const run = bestPilotRun(parseTrack(`b-${e.name}`, spec), { cut: false });
            expect(run, `${e.name} v${v} ${left ? "L" : "R"} ${w}`).not.toBeNull();
          }
        }
      }
    });
  }

  it("une rediffusion d'un prototype se rejoue au temps près (déterminisme)", () => {
    for (const nom of ["bloc-fragile", "bloc-regulateur", "bloc-releve-fort", "bloc-bombee"]) {
      const track = createFigureTrack(nom)!;
      const run = bestPilotRun(track, { cut: false })!;
      const again = replayRace(track, decodeReplay(encodeReplay(run.replay)));
      expect(again.finishMs, nom).toBe(run.finishMs);
    }
  });
});
