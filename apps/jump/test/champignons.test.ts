import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
  MODULE_TAGS,
  MUSHROOM_DOWN,
  MUSHROOM_LEFT,
  MUSHROOM_RIGHT,
  MUSHROOM_UP,
  UNITS_PER_TILE,
  initialAttempt,
  mushroomModuleIds,
  parseLevel,
  stepAttempt,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { parseDay } from "@cdj/core";
import { dailyLevel } from "@cdj/jump-sim";
import { contrastRatio, hueDistance } from "../src/contrast";
import { soundFor } from "../src/audioLogic";
import { EVENT_KINDS, eventsBetween, type GameEvent } from "../src/events";
import { Particles, feelColors, feelEvent, vibrationFor } from "../src/feel";
import { feelLevels, defaultSettings } from "../src/settings";
import { TAG_LABELS } from "../src/modulesInfo";
import {
  MUSHROOM_LOOK,
  SQUASH_DEPTH,
  SQUASH_DEPTH_BOOST,
  SQUASH_IN,
  SQUASH_SECONDS,
  SQUASH_STILL_SECONDS,
  buildMushroomArt,
  mushroomFacing,
  mushroomPose,
  mushroomSquash,
} from "../src/mushroom";
import { PALETTES } from "../src/palette";
import { miniKind, semaineDayOf } from "../src/semaineInfo";
import { HAZARD, PLAYER, THEMES, backdropColors } from "../src/themes";

// Lot 23 — les champignons rebonds vus par le jeu : un dôme violet (ni rouge, ni jaune) tourné vers où il lance, qui s'écrase au contact (plus fort sur un rebond renforcé),
// des spores, un « boup » doux, **aucune secousse de caméra** ; visible dans `?modules` (étiquette « champignon ») et `?semaine`.

const T = UNITS_PER_TILE;
const ROOM = (extra: [number, number, string][] = []): Level => {
  const rows: string[][] = [];
  for (let r = 0; r < 12; r++) rows.push(("#" + ".".repeat(18) + "#").split(""));
  rows[0] = "#".repeat(20).split("");
  rows[10] = "#".repeat(20).split("");
  rows[11] = "#".repeat(20).split("");
  rows[9]![1] = "S";
  rows[9]![18] = "F";
  for (const [c, r, ch] of extra) rows[r]![c] = ch;
  return parseLevel(rows.map((r) => r.join("")).join("\n") + "\n");
};

describe("lot 23 — la couleur : ni le rouge des dangers, ni le jaune du personnage", () => {
  const colors = [MUSHROOM_LOOK.cap, MUSHROOM_LOOK.capLight, MUSHROOM_LOOK.capDark, MUSHROOM_LOOK.spot];

  it("le chapeau est violet : loin en teinte du rouge (dangers), du jaune (personnage) et du bleu clair des ressorts de la forêt", () => {
    for (const c of [MUSHROOM_LOOK.cap, MUSHROOM_LOOK.capLight, MUSHROOM_LOOK.capDark]) {
      expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThanOrEqual(60);
      expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThanOrEqual(60);
      expect(hueDistance(c, THEMES.foret.palette.spring), c.toString(16)).toBeGreaterThanOrEqual(40);
    }
    expect(colors.length).toBe(4);
  });

  it("lisible sur le ciel et chaque plan de la forêt : le chapeau ou son cerne à 3:1 au moins", () => {
    for (const b of backdropColors(THEMES.foret)) {
      const best = Math.max(contrastRatio(MUSHROOM_LOOK.cap, b), contrastRatio(MUSHROOM_LOOK.outline, b));
      expect(best, b.toString(16)).toBeGreaterThanOrEqual(3);
    }
    // Les taches se détachent du chapeau.
    expect(contrastRatio(MUSHROOM_LOOK.spot, MUSHROOM_LOOK.cap)).toBeGreaterThanOrEqual(2);
  });

  it("la géométrie tient dans la tuile : du support (y = 0) jusqu'au bout du chapeau (y = 1), largeur au plus 1", () => {
    const b = buildMushroomArt().bounds();
    expect(b.minY).toBeGreaterThanOrEqual(-0.001);
    expect(b.maxY).toBeLessThanOrEqual(1.045); // le cerne dépasse un peu du chapeau
    expect(b.maxX - b.minX).toBeLessThanOrEqual(1.1);
  });
});

describe("lot 23 — l'orientation se lit : le chapeau est du côté où le champignon lance", () => {
  it("la pose : origine sur la face du support, rotation qui tourne le haut du dessin vers le chapeau", () => {
    expect(mushroomPose({ col: 3, row: 5, dir: MUSHROOM_UP })).toEqual({ x: 3.5, y: -6, rotation: 0 }); // sur le sol : le bas de la tuile
    expect(mushroomPose({ col: 3, row: 5, dir: MUSHROOM_DOWN })).toEqual({ x: 3.5, y: -5, rotation: Math.PI }); // sous le plafond : le haut de la tuile
    expect(mushroomPose({ col: 3, row: 5, dir: MUSHROOM_RIGHT })).toEqual({ x: 3, y: -5.5, rotation: -Math.PI / 2 }); // contre le mur de gauche : son bord gauche
    expect(mushroomPose({ col: 3, row: 5, dir: MUSHROOM_LEFT })).toEqual({ x: 4, y: -5.5, rotation: Math.PI / 2 }); // contre le mur de droite : son bord droit
  });

  it("le chapeau regarde vers le haut (sol), le bas (plafond), la droite (mur de gauche), la gauche (mur de droite) — comme l'impulsion de la simulation", () => {
    expect(mushroomFacing({ col: 0, row: 0, dir: MUSHROOM_UP })).toMatchObject({ x: 0 + 0, y: 1 + 0 });
    expect(mushroomFacing({ col: 0, row: 0, dir: MUSHROOM_DOWN })).toMatchObject({ x: 0 + 0, y: -1 + 0 });
    expect(mushroomFacing({ col: 0, row: 0, dir: MUSHROOM_RIGHT })).toMatchObject({ x: 1 + 0, y: 0 + 0 });
    expect(mushroomFacing({ col: 0, row: 0, dir: MUSHROOM_LEFT })).toMatchObject({ x: -1 + 0, y: 0 + 0 });
    // Et le rebond réel part bien de ce côté : on le joue dans la simulation.
    const cases: [number, [number, number, string], (p: AttemptState["player"]) => number][] = [
      [MUSHROOM_UP, [8, 9, "m"], (p) => -p.vy],
      [MUSHROOM_DOWN, [8, 1, "w"], (p) => p.vy],
      [MUSHROOM_RIGHT, [1, 5, ")"], (p) => p.vx],
      [MUSHROOM_LEFT, [18, 5, "("], (p) => -p.vx],
    ];
    for (const [dir, cell, speed] of cases) {
      const level = ROOM([cell]);
      const m = level.mushrooms[0]!;
      const f = mushroomFacing(m);
      expect(m.dir).toBe(dir);
      // Le personnage arrive sur le chapeau (en l'air, au pas qui précède le contact).
      const s = initialAttempt(level);
      const pad = (c: number, r: number) => ({ x: c * T, y: r * T });
      const start = pad(m.col, m.row);
      const player =
        dir === MUSHROOM_UP
          ? { x: start.x + 500, y: start.y - 3072 - 10, vy: 100, vx: 0 }
          : dir === MUSHROOM_DOWN
            ? { x: start.x + 500, y: start.y + T + 100, vy: -300, vx: 0 }
            : dir === MUSHROOM_RIGHT
              ? { x: start.x + T + 100, y: start.y, vy: 0, vx: -300 }
              : { x: start.x - 3072 - 100, y: start.y, vy: 0, vx: 300 };
      const run: AttemptState = { ...s, status: 1, time: 3, player: { ...s.player, ...player, ground: 0, air: 255, held: 0 } };
      const after = stepAttempt(run, 0, level, DEFAULT_JUMP_PARAMS).player;
      expect(speed(after), `dir ${dir}`).toBeGreaterThan(300);
      // Le sens de l'impulsion est celui du chapeau.
      const impulse = { x: dir === MUSHROOM_RIGHT || dir === MUSHROOM_LEFT ? Math.sign(after.vx) : 0, y: dir === MUSHROOM_UP || dir === MUSHROOM_DOWN ? -Math.sign(after.vy) : 0 };
      expect(impulse.x, `dir ${dir}`).toBe(f.x);
      expect(impulse.y, `dir ${dir}`).toBe(f.y);
    }
  });
});

describe("lot 23 — l'écrasement au contact", () => {
  it("au repos avant et longtemps après le rebond ; jamais NaN ni hors bornes", () => {
    expect(mushroomSquash(-1, false, true)).toBe(1);
    expect(mushroomSquash(Number.NaN, true, true)).toBe(1);
    expect(mushroomSquash(SQUASH_SECONDS, false, true)).toBe(1);
    expect(mushroomSquash(5, true, false)).toBe(1);
    for (const boost of [false, true]) {
      for (const animate of [false, true]) {
        for (let k = 0; k <= 80; k++) {
          const f = mushroomSquash(k / 100, boost, animate);
          expect(Number.isFinite(f)).toBe(true);
          expect(f).toBeGreaterThanOrEqual(1 - SQUASH_DEPTH_BOOST - 1e-9);
          expect(f).toBeLessThanOrEqual(1.2);
        }
      }
    }
  });

  it("il s'écrase plus fort sur un rebond renforcé : 0,32 de sa hauteur, 0,5 pour le renforcé, atteints à la fin de la compression", () => {
    expect(mushroomSquash(SQUASH_IN, false, true)).toBeCloseTo(1 - SQUASH_DEPTH, 9);
    expect(mushroomSquash(SQUASH_IN, true, true)).toBeCloseTo(1 - SQUASH_DEPTH_BOOST, 9);
    expect(SQUASH_DEPTH_BOOST).toBeGreaterThan(SQUASH_DEPTH);
    // À chaque instant de la compression, le renforcé est plus écrasé.
    for (let k = 1; k < 8; k++) expect(mushroomSquash((k * SQUASH_IN) / 8, true, true)).toBeLessThan(mushroomSquash((k * SQUASH_IN) / 8, false, true));
  });

  it("avec mouvement il revient en dépassant son repos puis s'amortit ; sans mouvement il revient tout droit, sans dépassement", () => {
    let over = 0;
    for (let k = 0; k < 600; k++) over = Math.max(over, mushroomSquash(k / 1000, true, true) - 1);
    expect(over).toBeGreaterThan(0.02);
    let prev = mushroomSquash(0, true, false);
    for (let k = 1; k <= 200; k++) {
      const f = mushroomSquash(k / 1000, true, false);
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12); // monte tout droit
      expect(f).toBeLessThanOrEqual(1);
      prev = f;
    }
    expect(mushroomSquash(SQUASH_STILL_SECONDS, true, false)).toBe(1);
  });
});

describe("lot 23 — l'événement `champignon`, les spores, le son : aucune secousse", () => {
  /** Un pas qui amène le personnage sur le chapeau d'un champignon de sol : `bits` est la commande du pas du contact. */
  function bounceStep(bits: number): { prev: AttemptState; cur: AttemptState; level: Level } {
    const level = ROOM([[8, 9, "m"]]);
    const s = initialAttempt(level);
    const prev: AttemptState = { ...s, status: 1, time: 3, player: { ...s.player, x: 8 * T + 500, y: 9 * T - 3072 - 10, vy: 100, vx: 0, ground: 0, air: 255, held: bits & INPUT_JUMP ? 1 : 0 } };
    return { prev, cur: stepAttempt(prev, bits, level, DEFAULT_JUMP_PARAMS), level };
  }

  it("un rebond donne un événement (simple ou renforcé selon le saut tenu) ; jamais pour un niveau sans champignon", () => {
    for (const [bits, boost] of [[0, false], [INPUT_JUMP, true]] as const) {
      const { prev, cur, level } = bounceStep(bits);
      const events = eventsBetween(prev, cur, level, DEFAULT_JUMP_PARAMS, 7, "jeu");
      const e = events.find((x) => x.kind === "champignon");
      expect(e, `bits ${bits}`).toMatchObject({ kind: "champignon", index: 0, dir: MUSHROOM_UP, boost, tick: 7, source: "jeu" });
      // Position : le centre du chapeau (la moitié du haut de sa tuile).
      expect(e!.x).toBeCloseTo(8.5, 9);
      expect(e!.y).toBeCloseTo(9.25, 9);
    }
    const plain = ROOM();
    const s = initialAttempt(plain);
    const run: AttemptState = { ...s, status: 1, time: 3, player: { ...s.player, vx: 200 } };
    const after = stepAttempt(run, INPUT_RIGHT, plain, DEFAULT_JUMP_PARAMS);
    expect(eventsBetween(run, after, plain, DEFAULT_JUMP_PARAMS).some((x) => x.kind === "champignon")).toBe(false);
  });

  it("un seul événement par contact : les pas suivants, la boîte chevauchant encore le chapeau, n'en donnent pas", () => {
    const { prev, cur, level } = bounceStep(0);
    expect(eventsBetween(prev, cur, level, DEFAULT_JUMP_PARAMS).filter((x) => x.kind === "champignon")).toHaveLength(1);
    const next = stepAttempt(cur, 0, level, DEFAULT_JUMP_PARAMS);
    expect(eventsBetween(cur, next, level, DEFAULT_JUMP_PARAMS).filter((x) => x.kind === "champignon")).toHaveLength(0);
  });

  it("la liste des événements le connaît ; des spores partent (plus nombreuses si renforcé), aucune secousse de caméra, aucune vibration, un son doux", () => {
    expect(EVENT_KINDS).toContain("champignon");
    const colors = feelColors(PALETTES[0]!);
    const levels = feelLevels(defaultSettings());
    const count = (boost: boolean) => {
      const pool = new Particles();
      const e = { kind: "champignon", index: 0, dir: MUSHROOM_UP, boost, tick: 0, source: "jeu", x: 8.5, y: 9.25 } as GameEvent;
      const out = feelEvent(e, pool, colors, levels);
      expect(out.shake, "aucune secousse de caméra (règle du lot 14)").toBe(0);
      expect(out.shakeDuration).toBe(0);
      expect(vibrationFor(e)).toBeNull();
      return pool.emitted;
    };
    expect(count(false)).toBeGreaterThan(0);
    expect(count(true)).toBeGreaterThan(count(false));
    const sound = soundFor({ kind: "champignon", index: 0, dir: MUSHROOM_UP, boost: false, tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent);
    expect(sound?.id).toBe("champignon");
    const loud = soundFor({ kind: "champignon", index: 0, dir: MUSHROOM_UP, boost: true, tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent);
    expect(loud!.duration).toBeGreaterThanOrEqual(sound!.duration);
  });
});

describe("lot 23 — la galerie `?modules` et `?semaine`", () => {
  it("l'étiquette « champignon » existe pour chaque étiquette du catalogue ; au moins six morceaux la portent", () => {
    expect(MODULE_TAGS).toContain("champignon");
    expect(TAG_LABELS.champignon).toBe("champignon");
    expect(mushroomModuleIds().size).toBeGreaterThanOrEqual(6);
  });

  it("la miniature de `?semaine` dessine les champignons comme une mécanique (en crème), jamais comme un danger", () => {
    for (const ch of "mw()") expect(miniKind(ch), ch).toBe("meca");
    expect(miniKind("^")).toBe("danger");
    // Un jour de forêt à champignons : ses rangées contiennent leurs signes.
    let day = parseDay("2026-10-27")!;
    for (let k = 0; k < 60; k++, day++) {
      const d = dailyLevel(day);
      if (d.level.mushrooms.length === 0) continue;
      const rows = semaineDayOf(d).rows;
      for (const m of d.level.mushrooms) expect("mw()".includes(rows[m.row]![m.col]!), `${d.date} ${m.col},${m.row}`).toBe(true);
      return;
    }
    throw new Error("aucun jour à champignons sur 60");
  });
});
