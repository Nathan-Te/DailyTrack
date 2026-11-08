import { describe, expect, it } from "vitest";
import {
  BLOCS_LOT58,
  CROWN_SLOPE,
  DEFAULT_CAR_PARAMS as P,
  FX_BROKEN,
  FX_CRUISE,
  FX_FRAGILE,
  FX_LIFT,
  FX_NO_BRAKE,
  FX_NO_STEER,
  TICK_RATE,
  bankAt,
  bestPilotRun,
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

// Lot 58 : tests chiffrés des familles de blocs nouvelles (comme au lot 7) — chaque effet appliqué puis retiré, la glisse sur la route bombée, le
// ralentissement dans l'eau, la tenue dans le virage très relevé — et les prototypes finis par le pilote. Les seuils sont recopiés dans le README du lot
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

  it("propulseur : la voiture monte d'au moins 6 m en 0,8 s, puis retombe", () => {
    const race = lance("S@start S S Ep S S S S S S S S S S@finish", 40);
    jusqua(race, apres(3));
    expect(race.car.fx).toBe(FX_LIFT);
    let haut = 0;
    for (let i = 0; i < 2 * TICK_RATE; i++) {
      stepRace(race, GAS);
      haut = Math.max(haut, race.car.y);
    }
    expect(haut).toBeGreaterThan(6);
    expect(race.car.fx).toBe(0);
    roule(race, GAS, 2 * TICK_RATE);
    expect(race.car.y).toBeLessThan(0.5);
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

describe("eau (lot 58)", () => {
  it("deux blocs d'eau ramènent de 46 à moins de 32 m/s, plein gaz ; la route garde la vitesse", () => {
    const eau = lance("S@start S S S/w S/w S S S@finish", 46);
    jusqua(eau, 32 * 3);
    const v0 = carSpeed(eau.car);
    jusqua(eau, 32 * 5);
    expect(v0).toBeGreaterThan(44);
    expect(carSpeed(eau.car)).toBeLessThan(32);
    const route = lance("S@start S S S S S S S@finish", 46);
    jusqua(route, 32 * 5);
    expect(carSpeed(route.car)).toBeGreaterThan(44);
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
    const temps = (v: string) => bestPilotRun(parseTrack(v, `S@start S S S S L3${v} S S S@finish`), { cut: false })!.finishMs;
    const fort = temps("/f");
    expect(fort).toBeLessThan(temps("/b"));
    expect(fort).toBeLessThan(temps(""));
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
    for (const nom of ["bloc-fragile", "bloc-regulateur", "bloc-propulseur", "bloc-bombee"]) {
      const track = createFigureTrack(nom)!;
      const run = bestPilotRun(track, { cut: false })!;
      const again = replayRace(track, decodeReplay(encodeReplay(run.replay)));
      expect(again.finishMs, nom).toBe(run.finishMs);
    }
  });
});
