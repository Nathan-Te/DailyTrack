import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDay } from "@cdj/core";
import {
  ATTEMPT_RUNNING,
  DEATH_LASER,
  DEATH_NONE,
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  LASER_THICKNESS,
  MODULES,
  MODULE_TAGS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TICK_RATE,
  UNITS_PER_TILE,
  buildModule,
  cycleMod,
  deathAt,
  initialAttempt,
  laserBarAt,
  laserBarBox,
  laserBarPos,
  laserBox,
  laserBoxes,
  laserIsOn,
  laserOn,
  parseLevel,
  stepAttempt,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { Box3, Group, Line, LineDashedMaterial, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { FLICKER_MAX_HZ, LASER_BAR_SMOOTH, LASER_WARN_TICKS, laserBarLook, laserBarPeak, laserBarSpeed, laserLook } from "../src/announce";
import { soundFor } from "../src/audioLogic";
import { SHAKES } from "../src/camera";
import { contrastRatio, hueDistance, hueOf } from "../src/contrast";
import { EVENT_KINDS, causeName, eventsBetween, type GameEvent } from "../src/events";
import { Particles, feelColors, feelEvent } from "../src/feel";
import {
  AIM,
  AIM_OPACITY,
  BAR_GLOW_REST,
  CORE,
  LASER_LOOK,
  LENS_DIM,
  NOSE,
  NOSE_HALF,
  RAY,
  barGlow,
  barTrack,
  buildAimArt,
  buildEmitterArt,
  buildLensArt,
  buildRayArt,
  coreColor,
  lensColor,
  rayLayout,
} from "../src/laser";
import { createLaserArt } from "../src/laserArt";
import { MODULE_INDEX } from "../src/moduleIndex";
import { TAG_LABELS, galleryOrder, matchesFilter } from "../src/modulesInfo";
import { PALETTES } from "../src/palette";
import { semaineDayOf } from "../src/semaineInfo";
import { defaultSettings, feelLevels } from "../src/settings";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";

// Lot 25 — les lasers vus par le jeu : le rayon allumé porte le rouge des dangers (cœur clair, exactement la bande mortelle), une visée neutre s'intensifie pendant les 0,5 s qui
// précèdent l'allumage (signe continu, jamais un clignotement), les émetteurs suivent le style du néon, une barre coulissante montre son trajet en pointillés neutres et son ralenti ;
// aucune secousse de caméra ; estompé à 35 % dans le carnage, en pièces qui ne se recouvrent pas.

const T = UNITS_PER_TILE;
/** Une salle de 28 colonnes sur 14 rangées : plafond à la rangée 0, sol aux rangées 12-13 (on y marche rangée 11). */
function roomRows(): string[] {
  const rows: string[] = [];
  for (let r = 0; r < 14; r++) rows.push("#" + ".".repeat(26) + "#");
  rows[0] = "#".repeat(28);
  rows[12] = rows[13] = "#".repeat(28);
  rows[11] = "#S" + ".".repeat(24) + "F#";
  return rows;
}
/** La salle avec les deux émetteurs du rayon horizontal « trait » (colonnes 2 et 9, rangée 5). */
function roomWithTrait(): string[] {
  const rows = roomRows();
  for (const col of [2, 9]) rows[5] = rows[5]!.slice(0, col) + "#" + rows[5]!.slice(col + 1);
  return rows;
}
const text = (annex: string[], rows = roomRows()) => rows.join("\n") + "\n\n" + annex.join("\n") + "\n";
/** Portail vertical (cycle 360, 150 allumés, décalage 7) et rayon horizontal à travers la salle (cycle 300, 100 allumés) ; deux barres : l'une glisse en hauteur, l'autre en largeur. */
const level: Level = parseLevel(
  text(
    [
      "version 9",
      "section salle 0-27",
      "laser portail v 14,1 11 360 150 7",
      "laser trait h 3,5 6 300 100 0",
      "barre balai h 4 480 18,3 18,8",
      "barre rail v 3 600 5,2 12,2",
    ],
    roomWithTrait(),
  ),
);
const [portail, trait] = level.lasers as [(typeof level.lasers)[number], (typeof level.lasers)[number]];
const [balai, rail] = level.laserBars as [(typeof level.laserBars)[number], (typeof level.laserBars)[number]];
const at = (time: number): AttemptState => ({ ...initialAttempt(level), status: ATTEMPT_RUNNING, time });
/** La phase d'un élément de la section unique : le chrono (le niveau n'a pas de phase de section). */
const phaseAt = (time: number) => time;

const meshes = (g: Group) => g.children.filter((c): c is Mesh => (c as Mesh).isMesh);

/** Pics par seconde d'une série (une remontée d'au moins 10 % après une descente d'au moins 10 % ; l'entier du pas ajoute un bruit de l'ordre du centième). */
function peaksPerSecond(series: readonly number[]): number {
  let peaks = 0;
  let low = series[0]!;
  let high = series[0]!;
  let rising = false;
  for (const v of series) {
    if (rising) {
      if (v > high) high = v;
      else if (high - v >= 0.1) {
        peaks++;
        rising = false;
        low = v;
      }
    } else if (v < low) low = v;
    else if (v - low >= 0.1) {
      rising = true;
      high = v;
    }
  }
  return peaks / (series.length / TICK_RATE);
}

describe("l'annonce (laserLook, pur) : 0,5 s de visée avant l'allumage, au pas près", () => {
  it("la durée est 60 pas (0,5 s)", () => {
    expect(LASER_WARN_TICKS).toBe(60);
    expect(LASER_WARN_TICKS).toBe(TICK_RATE / 2);
  });

  for (const l of [portail, trait, { cycle: 210, on: 90, shift: 0 }, { cycle: 1200, on: 90, shift: 311 }]) {
    it(`exactement 0 jusqu'à q = cycle − 60, strictement croissante ensuite, 1 au dernier pas éteint, allumé au pas d'après (cycle ${l.cycle}, allumé ${l.on}, décalage ${l.shift})`, () => {
      let announced = 0;
      for (let phase = -l.cycle; phase < 3 * l.cycle; phase++) {
        const q = cycleMod(phase + l.shift, l.cycle);
        const look = laserLook(l, phase);
        expect(look.on, `phase ${phase}`).toBe(laserOn(l, phase));
        if (look.on) {
          expect(q).toBeLessThan(l.on);
          expect(look.warn, `phase ${phase} : allumé, aucune annonce`).toBe(0);
        } else if (q <= l.cycle - LASER_WARN_TICKS) {
          expect(look.warn, `phase ${phase} (q ${q})`).toBe(0);
        } else {
          announced++;
          const before = laserLook(l, phase - 1);
          expect(look.warn, `phase ${phase} (q ${q})`).toBeGreaterThan(before.warn);
          expect(look.warn).toBeGreaterThan(0);
          expect(look.warn).toBeLessThanOrEqual(1);
          if (q === l.cycle - LASER_WARN_TICKS + 1) expect(look.warn, "premier pas annoncé").toBeCloseTo(1 / 59, 12);
          if (q === l.cycle - 1) {
            expect(look.warn, "dernier pas éteint").toBe(1);
            expect(laserLook(l, phase + 1), "le rayon est allumé au pas d'après").toEqual({ on: true, warn: 0 });
          }
        }
      }
      expect(announced, "59 pas annoncés par cycle").toBe(4 * 59);
    });
  }

  it("aucune annonce pour l'extinction : le rayon allumé passe à éteint sans signe, la visée repart de 0", () => {
    const l = portail;
    for (let phase = 0; phase < 2 * l.cycle; phase++) {
      const was = laserLook(l, phase - 1);
      const now = laserLook(l, phase);
      if (was.on && !now.on) expect(now.warn, `phase ${phase}`).toBe(0);
      // Allumé, jamais d'annonce (le rayon dit lui-même qu'il est là).
      if (now.on) expect(now.warn).toBe(0);
    }
  });

  it("l'annonce tient toujours dans la phase éteinte (au moins 120 pas : LASER_MIN_OFF) ; plus courte, elle la couvre sans toucher l'allumé", () => {
    const short = { cycle: 100, on: 70, shift: 0 }; // 30 pas éteints : jamais produit, mais l'annonce ne déborde pas
    for (let phase = 0; phase < 200; phase++) {
      const look = laserLook(short, phase);
      if (look.on) expect(look.warn).toBe(0);
      else expect(look.warn).toBeGreaterThanOrEqual(0);
    }
    expect(laserLook(short, 99).warn).toBe(1);
    expect(laserLook(short, 70).warn).toBe(0);
  });
});

describe("l'affichage ne ment pas : le rayon rouge est dessiné aux pas exacts où la simulation le dit allumé", () => {
  it("laserBoxes de la simulation ↔ rayon dessiné, sur deux cycles complets, pour les deux lasers", () => {
    const world = new Group();
    const art = createLaserArt(world, level, { hazard: HAZARD })!;
    for (let t = 0; t < 2 * 360 + 300; t++) {
      const s = at(t);
      art.update(s, s, 1, 1);
      level.lasers.forEach((l, i) => {
        expect(art.stats.on[i], `t ${t} laser ${i}`).toBe(laserIsOn(level, s.sections, s.time, i));
        expect(art.units[i]!.ray.visible, `t ${t} laser ${i}`).toBe(laserIsOn(level, s.sections, s.time, i));
        expect(art.stats.rayOpacity[i]).toBe(art.stats.on[i] ? 1 : 0);
        expect(art.stats.on[i], "la simulation et le dessin disent la même chose").toBe(laserLook(l, phaseAt(t)).on);
      });
      // Autant de rayons dessinés que de lasers allumés dans la simulation (plus les deux barres, toujours allumées).
      expect(laserBoxes(level, s)).toHaveLength(art.stats.on.filter(Boolean).length + level.laserBars.length);
    }
  });

  it("le rayon dessiné occupe exactement la bande mortelle de la simulation (horizontal et vertical)", () => {
    const world = new Group();
    const art = createLaserArt(world, level, { hazard: HAZARD })!;
    // Un moment où les deux sont allumés : portail à q = 7 + t, trait à q = t.
    const s = at(20);
    art.update(s, s, 1, 1);
    expect(art.stats.on).toEqual([true, true]);
    level.lasers.forEach((l, i) => {
      art.units[i]!.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(art.units[i]!.ray);
      const sim = laserBox(l);
      expect(box.min.x).toBeCloseTo(sim.x / T, 6);
      expect(box.max.x).toBeCloseTo((sim.x + sim.w) / T, 6);
      expect(box.min.y).toBeCloseTo(-(sim.y + sim.h) / T, 6);
      expect(box.max.y).toBeCloseTo(-sim.y / T, 6);
    });
    // L'épaisseur est exactement la bande mortelle.
    expect(RAY).toBe(LASER_THICKNESS / T);
    expect(RAY).toBe(0.25);
  });
});

describe("la visée : neutre, fine, croissante, jamais rouge", () => {
  it("cachée tant que l'annonce vaut 0 et quand le rayon est allumé ; son opacité croît strictement avec l'annonce jusqu'à AIM_OPACITY", () => {
    const world = new Group();
    const art = createLaserArt(world, level, { hazard: HAZARD })!;
    const aim = art.units[1]!.aim!;
    let last = 0;
    let shown = 0;
    for (let t = 0; t < 300; t++) {
      const s = at(t);
      art.update(s, s, 1, 1);
      const look = laserLook(trait, phaseAt(t));
      expect(art.stats.warn[1]).toBe(look.warn);
      expect(art.stats.aimOpacity[1]).toBeCloseTo(look.warn * AIM_OPACITY, 12);
      expect(aim.visible, `t ${t}`).toBe(look.warn > 0);
      if (look.on) expect(art.stats.aimOpacity[1]).toBe(0);
      if (look.warn > 0) {
        shown++;
        expect(art.stats.aimOpacity[1]).toBeGreaterThan(last);
        last = art.stats.aimOpacity[1]!;
      } else last = 0;
    }
    expect(shown).toBe(59);
    // Le dernier pas éteint avant l'allumage : pleine.
    const s = at(299);
    art.update(s, s, 1, 1);
    expect(art.stats.aimOpacity[1]).toBe(AIM_OPACITY);
    expect(art.stats.glow[1]).toBe(1);
  });

  it("identique avec ou sans mouvement réduit : le dessin ne dépend que de la simulation (aucun paramètre d'animation, aucune horloge de scène)", () => {
    const a = createLaserArt(new Group(), level, { hazard: HAZARD })!;
    const b = createLaserArt(new Group(), level, { hazard: HAZARD })!;
    for (const t of [0, 100, 250, 290, 299, 300, 359]) {
      a.update(at(t), at(t), 1, 1);
      b.update(at(t), at(t), 1, 1);
      expect(a.stats).toEqual(b.stats);
    }
    // La signature de `update` n'a aucune horloge : (prev, state, alpha, fade).
    expect(a.update.length).toBe(4);
  });

  it("plus fine que le rayon, de la couleur neutre de la charte, jamais le rouge des dangers ni le jaune du personnage", () => {
    expect(AIM).toBeLessThan(RAY);
    expect(LASER_LOOK.aim).toBe(0xfff6e0);
    expect(hueOf(LASER_LOOK.aim).chroma <= 0.15 || hueDistance(LASER_LOOK.aim, HAZARD) >= 30).toBe(true);
    expect(LASER_LOOK.aim).not.toBe(HAZARD);
    const art = buildAimArt(5);
    expect(Math.max(...art.pos.filter((_, i) => i % 3 === 1)) - Math.min(...art.pos.filter((_, i) => i % 3 === 1))).toBeCloseTo(AIM, 9);
  });

  it("lisible sur le ciel et chaque plan de chaque thème : 3:1 au moins", () => {
    for (const name of THEME_NAMES) {
      for (const b of backdropColors(THEMES[name])) {
        expect(contrastRatio(LASER_LOOK.aim, b), `visée ${name} ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(HAZARD, b), `rayon ${name} ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("aucun clignotement : les séries dessinées restent sous 3 Hz", () => {
  it("rayon, visée, lueur d'un laser fixe aux durées les plus courtes (90 allumés, 120 éteints) et dans la salle", () => {
    const quick = parseLevel(text(["version 9", "section salle 0-27", "laser vif v 14,1 11 210 90 0"]));
    for (const lvl of [quick, level]) {
      const art = createLaserArt(new Group(), lvl, { hazard: HAZARD })!;
      const state = (t: number): AttemptState => ({ ...initialAttempt(lvl), status: ATTEMPT_RUNNING, time: t });
      const series = { ray: [] as number[], aim: [] as number[], glow: [] as number[] };
      for (let t = 0; t < 210 * 12; t++) {
        art.update(state(t), state(t), 1, 1);
        series.ray.push(art.stats.rayOpacity[0]!);
        series.aim.push(art.stats.aimOpacity[0]!);
        series.glow.push(art.stats.glow[0]!);
      }
      for (const [name, s] of Object.entries(series)) expect(peaksPerSecond(s), name).toBeLessThanOrEqual(FLICKER_MAX_HZ);
      // Le pire cas : un cycle de 210 pas = 0,57 cycle par seconde, loin des 3 Hz.
      expect(peaksPerSecond(series.ray)).toBeLessThan(1);
    }
  });

  it("garde-fou sur les sources : aucune horloge de scène dans les fichiers des lasers (rien n'oscille)", () => {
    for (const file of ["laser.ts", "laserArt.ts"]) {
      const src = readFileSync(join(import.meta.dirname, "../src", file), "utf8");
      expect(src, file).not.toMatch(/Math\.sin\(/);
      expect(src, file).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    }
  });
});

describe("couleurs : le rayon est rouge, les émetteurs suivent le néon, rien d'autre n'est rouge ni jaune", () => {
  const redArt = buildRayArt(4, HAZARD);
  const lin = (c: number) => {
    const f = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return [f((c >> 16) & 255), f((c >> 8) & 255), f(c & 255)];
  };
  const isColor = (art: { col: number[] }, i: number, c: number) => lin(c).every((v, k) => Math.abs(art.col[i * 3 + k]! - v) < 1e-6);

  it("le rayon : le rouge du thème en haut et en bas, un cœur clair (le rouge éclairci) au milieu", () => {
    const count = (c: number) => [...Array(redArt.vertexCount).keys()].filter((i) => isColor(redArt, i, c)).length;
    expect(count(HAZARD)).toBe(8); // deux bandes de quatre sommets
    expect(count(coreColor(HAZARD))).toBe(4);
    expect(coreColor(HAZARD)).not.toBe(HAZARD);
    expect(contrastRatio(coreColor(HAZARD), HAZARD)).toBeGreaterThan(1.5);
    // Il est clair : plus lumineux que le rouge.
    expect(contrastRatio(coreColor(HAZARD), 0x000000)).toBeGreaterThan(contrastRatio(HAZARD, 0x000000));
    // Le cœur est plus fin que le rayon et centré.
    expect(CORE).toBeLessThan(RAY);
    const ys = redArt.pos.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(RAY / 2, 9);
    expect(Math.min(...ys)).toBeCloseTo(-RAY / 2, 9);
  });

  it("le rouge du thème est celui qu'on passe (jamais écrit dans le fichier du rayon) : un autre rouge donne un autre rayon", () => {
    const other = buildRayArt(4, 0xaa1111);
    expect([...Array(other.vertexCount).keys()].filter((i) => isColor(other, i, 0xaa1111))).toHaveLength(8);
  });

  it("les émetteurs : boîtier violet sombre, liseré rose, lentille cyan (le style du thème néon) ; ni rouge ni jaune ; la lentille se lit sur le boîtier (3:1)", () => {
    const neon = THEMES.neon.tiles;
    expect(LASER_LOOK.lens).toBe(neon.trimA);
    expect(LASER_LOOK.trim).toBe(neon.trimB);
    for (const c of [LASER_LOOK.body, LASER_LOOK.trim, LASER_LOOK.lens, LENS_DIM]) {
      expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThan(30);
      expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThan(30);
    }
    expect(contrastRatio(LASER_LOOK.lens, LASER_LOOK.body)).toBeGreaterThanOrEqual(3);
    // La lueur va de la lentille éteinte à la lentille allumée, en gardant le sens (plus claire = plus allumée).
    expect(lensColor(0)).toBe(LENS_DIM);
    expect(lensColor(1)).toBe(LASER_LOOK.lens);
    expect(contrastRatio(lensColor(1), LASER_LOOK.body)).toBeGreaterThan(contrastRatio(lensColor(0), LASER_LOOK.body));
    // Le liseré et le boîtier sont visibles sur les pleins du néon (face et remplissage).
    expect(contrastRatio(LASER_LOOK.trim, neon.face)).toBeGreaterThan(2);
  });
});

describe("pièces qui ne se recouvrent pas (l'estompage du carnage ne s'additionne pas)", () => {
  const triangles = (art: { pos: number[]; idx: number[] }): [number, number][][] => {
    const tris: [number, number][][] = [];
    for (let t = 0; t < art.idx.length; t += 3) tris.push([0, 1, 2].map((k) => [art.pos[art.idx[t + k]! * 3]!, art.pos[art.idx[t + k]! * 3 + 1]!] as [number, number]));
    return tris;
  };
  const separated = (a: [number, number][], b: [number, number][]): boolean => {
    for (const tri of [a, b]) {
      for (let i = 0; i < 3; i++) {
        const p = tri[i]!;
        const q = tri[(i + 1) % 3]!;
        const ax = -(q[1] - p[1]);
        const ay = q[0] - p[0];
        const proj = (t: [number, number][]) => t.map((v) => v[0] * ax + v[1] * ay);
        const pa = proj(a);
        const pb = proj(b);
        if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return true;
      }
    }
    return false;
  };
  const disjoint = (tris: [number, number][][]) => {
    for (let i = 0; i < tris.length; i++) for (let j = i + 1; j < tris.length; j++) expect(separated(tris[i]!, tris[j]!), `triangles ${i} et ${j}`).toBe(true);
  };

  it("le rayon : trois bandes", () => disjoint(triangles(buildRayArt(6, HAZARD))));
  it("le boîtier de l'émetteur et sa lentille : aucun couple de triangles n'a d'intérieur commun", () => {
    const emitter = triangles(buildEmitterArt());
    const lens = triangles(buildLensArt());
    disjoint([...emitter, ...lens]);
    // Le museau a la profondeur et la hauteur annoncées ; la lentille est de la hauteur du rayon.
    const xs = buildEmitterArt().pos.filter((_, i) => i % 3 === 0);
    const ys = buildEmitterArt().pos.filter((_, i) => i % 3 === 1);
    expect(Math.max(...xs)).toBeCloseTo(NOSE, 9);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...ys)).toBeCloseTo(NOSE_HALF, 9);
    expect(Math.min(...ys)).toBeCloseTo(-NOSE_HALF, 9);
    const lensYs = buildLensArt().pos.filter((_, i) => i % 3 === 1);
    expect(Math.max(...lensYs) - Math.min(...lensYs)).toBeCloseTo(RAY, 9);
  });
});

describe("le dessin des émetteurs : posés sur les tuiles pleines qui bornent le rayon", () => {
  it("laser fixe : un museau contre chaque bout du rayon, côté de la tuile pleine (début puis fin)", () => {
    const art = createLaserArt(new Group(), level, { hazard: HAZARD })!;
    // Le portail (vertical, colonne 14, rangées 1 à 11) : ses émetteurs sont les pleins des rangées 0 et 12 (le plafond et le sol de la salle).
    expect(level.tiles[0 * level.width + 14]).toBeDefined();
    const lay = rayLayout("v", 11);
    art.units[0]!.group.updateMatrixWorld(true);
    const pods = art.units[0]!.group.children.slice(0, 2);
    pods.forEach((pod, k) => {
      pod.updateMatrixWorld(true);
      const e = lay.emitters[k]!;
      // Repère du monde : l'origine du groupe est la première tuile du rayon (colonne 14, rangée 1).
      expect(pod.getWorldPosition(new Group().position).x).toBeCloseTo(14 + e.x, 9);
      expect(pod.getWorldPosition(new Group().position).y).toBeCloseTo(-1 + e.y, 9);
    });
    // Le museau du début monte dans la tuile du haut (rangée 0), celui de la fin descend dans celle du bas (rangée 12).
    expect(lay.emitters[0]!.y).toBe(0);
    expect(lay.emitters[1]!.y).toBe(-11);
    // Le portail se pose sur sa propre tuile : aucune barre, aucun plein ajouté par le dessin.
    expect(art.stats.barSpeed).toHaveLength(2);
  });

  it("rien ne bloque ni ne tue autour d'un émetteur de barre : un personnage dans le museau, hors du rayon, vit", () => {
    // Balai : horizontal, colonnes 18 à 21, glisse entre les rangées 3 et 8 ; le museau droit est dans la colonne 22 (0,3 tuile), le gauche dans la colonne 17.
    const s = at(0);
    const box = laserBarBox(balai, 0);
    const probe = (x: number): AttemptState => ({ ...s, player: { ...s.player, x, y: box.y + box.h / 2 - PLAYER_HEIGHT / 2, vx: 0, vy: 0, ground: 0 } });
    const right = probe((balai.a.col + balai.length) * T + 100);
    const left = probe(balai.a.col * T - PLAYER_WIDTH - 100);
    expect(deathAt(level, right)).toBe(DEATH_NONE);
    expect(deathAt(level, left)).toBe(DEATH_NONE);
    // Dans le rayon, il meurt (le museau n'y change rien).
    expect(deathAt(level, probe(balai.a.col * T + 2 * T))).toBe(DEATH_LASER);
  });
});

describe("barre coulissante : vitesse de la simulation, ralenti qui se voit, trajet en pointillés neutres", () => {
  it("la vitesse affichée est celle de la simulation en part de sa pointe ; presque nulle aux extrémités, pleine au milieu ; le sens se retourne au demi-cycle", () => {
    for (const b of [balai, rail]) {
      const half = b.cycle / 2;
      expect(laserBarLook(b, 0).speed).toBeLessThan(0.1);
      expect(laserBarLook(b, half - 1).speed).toBeLessThan(0.1);
      expect(laserBarLook(b, half + 1).speed).toBeLessThan(0.1);
      expect(laserBarLook(b, half / 2).speed).toBeGreaterThan(0.95);
      expect(laserBarLook(b, 10).dir).toBe(1);
      expect(laserBarLook(b, half + 10).dir).toBe(-1);
      const slide = (p: number) => (b.axis === "h" ? laserBarPos(b, p).y : laserBarPos(b, p).x);
      for (let t = 0; t < b.cycle; t++) {
        const look = laserBarLook(b, t);
        expect(look.speed).toBeGreaterThanOrEqual(0);
        expect(look.speed).toBeLessThanOrEqual(1);
        // La vitesse de la simulation : l'avance moyenne des 9 pas autour de celui-ci (75 ms), en part de la pointe.
        let sum = 0;
        for (let j = -LASER_BAR_SMOOTH; j <= LASER_BAR_SMOOTH; j++) sum += Math.abs(slide(t + j + 1) - slide(t + j));
        expect(sum / (2 * LASER_BAR_SMOOTH + 1)).toBeCloseTo(laserBarSpeed(b, t), 9);
        expect(sum / (2 * LASER_BAR_SMOOTH + 1) / laserBarPeak(b)).toBeCloseTo(look.speed, 9);
        // Et le sens est celui du pas.
        expect(look.dir).toBe(Math.sign(slide(t + 1) - slide(t)));
      }
    }
  });

  it("aucune variation brusque (au plus 15 % de la pointe d'un pas à l'autre), jamais plus de 3 pics par seconde, pour toutes les barres des morceaux du catalogue", () => {
    const bars = [balai, rail];
    for (const m of MODULES.filter((d) => d.tags.includes("laser"))) {
      for (let v = 0; v < m.variants.length; v++) bars.push(...buildModule(m.id, v).level.laserBars);
    }
    expect(bars.length).toBeGreaterThan(10);
    for (const b of bars) {
      const series = Array.from({ length: b.cycle * 3 }, (_, t) => laserBarLook(b, t).speed);
      for (let t = 1; t < series.length; t++) expect(Math.abs(series[t]! - series[t - 1]!), `${b.id} cycle ${b.cycle} pas ${t}`).toBeLessThan(0.15);
      expect(peaksPerSecond(series), b.id).toBeLessThanOrEqual(FLICKER_MAX_HZ);
      const glow = series.map(barGlow);
      expect(peaksPerSecond(glow), `${b.id} lueur`).toBeLessThanOrEqual(FLICKER_MAX_HZ);
    }
  });

  it("la lueur des lentilles : jamais éteinte, proportionnelle à la vitesse, pleine à pleine vitesse", () => {
    expect(barGlow(0)).toBe(BAR_GLOW_REST);
    expect(barGlow(1)).toBe(1);
    expect(barGlow(0.5)).toBeGreaterThan(barGlow(0.25));
    const art = createLaserArt(new Group(), level, { hazard: HAZARD })!;
    art.update(at(0), at(0), 1, 1);
    expect(art.stats.barGlow[0]).toBeCloseTo(barGlow(laserBarLook(balai, 0).speed), 12);
    art.update(at(120), at(120), 1, 1);
    expect(art.stats.barSpeed[0]).toBeGreaterThan(0.95);
    expect(art.stats.barGlow[0]).toBeGreaterThan(0.95);
    expect(art.units[2]!.lensMat.color.getHex()).toBe(lensColor(art.stats.barGlow[0]!));
  });

  it("le rayon dessiné est la bande mortelle de la simulation, interpolée entre deux pas (horizontale et verticale)", () => {
    const world = new Group();
    const art = createLaserArt(world, level, { hazard: HAZARD })!;
    level.laserBars.forEach((b, i) => {
      const unit = art.units[level.lasers.length + i]!;
      for (const t of [0, 1, 50, 119, 120, 239, 240, 300, 479]) {
        const prev = at(t);
        const next = at(t + 1);
        for (const alpha of [0, 1]) {
          art.update(prev, next, alpha, 1);
          unit.group.updateMatrixWorld(true);
          const box = new Box3().setFromObject(unit.ray);
          const sim = laserBarAt(level, alpha === 0 ? prev.sections : next.sections, alpha === 0 ? prev.time : next.time, i);
          expect(box.min.x, `${b.id} t ${t} alpha ${alpha}`).toBeCloseTo(sim.x / T, 6);
          expect(box.max.x).toBeCloseTo((sim.x + sim.w) / T, 6);
          expect(box.min.y).toBeCloseTo(-(sim.y + sim.h) / T, 6);
          expect(box.max.y).toBeCloseTo(-sim.y / T, 6);
          // Les statistiques disent le coin haut-gauche de la première tuile du rayon.
          const at0 = laserBarPos(b, alpha === 0 ? prev.time : next.time);
          expect(art.stats.barX[i]).toBeCloseTo(at0.x / T, 9);
          expect(art.stats.barY[i]).toBeCloseTo(at0.y / T, 9);
        }
      }
    });
  });

  it("une barre est toujours dessinée, sans visée (toujours allumée)", () => {
    const art = createLaserArt(new Group(), level, { hazard: HAZARD })!;
    for (const t of [0, 77, 250]) {
      art.update(at(t), at(t), 1, 1);
      for (const k of [2, 3]) {
        expect(art.units[k]!.ray.visible).toBe(true);
        expect(art.units[k]!.aim).toBeNull();
      }
    }
  });

  it("le trajet : deux rails et l'empreinte de chaque extrémité, en deux pointillés neutres qui alternent (crème et encre), jamais la couleur des dangers", () => {
    const world = new Group();
    createLaserArt(world, level, { hazard: HAZARD });
    const lines = world.children.filter((c): c is Line => (c as { isLine?: boolean }).isLine === true);
    // Par barre : 2 rails + 2 empreintes, chacun en deux pointillés.
    expect(lines).toHaveLength(level.laserBars.length * 4 * 2);
    for (const l of lines) {
      const m = l.material as LineDashedMaterial;
      expect([LASER_LOOK.rail, LASER_LOOK.railInk]).toContain(m.color.getHex());
      expect(m.color.getHex()).not.toBe(HAZARD);
      expect(m.transparent).toBe(true);
    }
    expect(new Set(lines.map((l) => (l.material as LineDashedMaterial).color.getHex())).size).toBe(2);
    // Les rails vont du bout du rayon à l'extrémité `a` jusqu'à l'extrémité `b`.
    const track = barTrack(balai);
    const first = lines[0]!.geometry.getAttribute("position");
    expect([first.getX(0), first.getY(0)]).toEqual(track.rails[0]![0]);
    expect([first.getX(1), first.getY(1)]).toEqual(track.rails[0]![1]);
    // Balai (h) : les rails sont les deux bouts verticaux du rayon, de la rangée 3 à la rangée 8.
    expect(track.rails[0]).toEqual([[18, -3.5], [18, -8.5]]);
    expect(track.rails[1]).toEqual([[22, -3.5], [22, -8.5]]);
    // Rail (v) : les deux bouts du rayon vertical, de la colonne 5 à la colonne 12.
    expect(barTrack(rail).rails[0]).toEqual([[5.5, -2], [12.5, -2]]);
  });
});

describe("carnage (lot 17) : estompé à 35 %, opaque et sans mélange hors carnage", () => {
  it("toutes les pièces à 35 % pendant le carnage (rayons, boîtiers, lentilles, visée, trajet), 100 % opaques et sans mélange ensuite", () => {
    const world = new Group();
    const art = createLaserArt(world, level, { hazard: HAZARD })!;
    const solid = () => {
      const out: MeshBasicMaterial[] = [];
      for (const u of art.units) {
        u.group.traverse((o) => {
          const m = (o as Mesh).material as MeshBasicMaterial | undefined;
          if ((o as Mesh).isMesh && m && o !== u.aim) out.push(m);
        });
      }
      return out;
    };
    const lines = () => world.children.filter((c): c is Line => (c as { isLine?: boolean }).isLine === true).map((l) => l.material as LineDashedMaterial);
    // Un instant où les deux lasers sont allumés et un autre où l'un est en visée.
    art.update(at(20), at(20), 1, 1);
    expect(solid().length).toBeGreaterThan(8);
    for (const m of solid()) expect([m.opacity, m.transparent]).toEqual([1, false]);
    for (const m of lines()) expect(m.opacity).toBeCloseTo(0.6, 12);
    art.update(at(20), at(20), 1, 0.35);
    for (const m of solid()) expect([m.opacity, m.transparent]).toEqual([0.35, true]);
    for (const m of lines()) expect(m.opacity).toBeCloseTo(0.6 * 0.35, 12);
    expect(art.stats.opacity).toBe(0.35);
    expect(art.stats.rayOpacity).toEqual([0.35, 0.35]);
    // La visée : son opacité est celle de l'annonce, ×0,35.
    art.update(at(299), at(299), 1, 0.35);
    expect(art.stats.aimOpacity[1]).toBeCloseTo(AIM_OPACITY * 0.35, 12);
    art.update(at(20), at(20), 1, 1);
    for (const m of solid()) expect([m.opacity, m.transparent]).toEqual([1, false]);
    for (const m of lines()) expect(m.opacity).toBeCloseTo(0.6, 12);
    expect(art.stats.opacity).toBe(1);
  });
});

describe("événements, secousse, particules, son", () => {
  const colors = feelColors(PALETTES[0]!);
  const levels = feelLevels(defaultSettings());

  it("les lasers n'ajoutent aucun évènement (la liste est celle du lot 24) : seule la mort dit « laser »", () => {
    expect(EVENT_KINDS).toHaveLength(31);
    expect(EVENT_KINDS.some((k) => /laser/i.test(k))).toBe(false);
    expect(causeName(DEATH_LASER)).toBe("laser");
  });

  it("traverser un rayon éteint ne produit aucun évènement de secousse ; la mort au contact d'un rayon allumé a la cause « laser » et la secousse de la mort, rien de plus", () => {
    const p = DEFAULT_JUMP_PARAMS;
    const portal = parseLevel(text(["version 9", "section salle 0-27", "laser g v 14,1 11 360 150 0"]));
    const standing = (time: number): AttemptState => {
      const s = initialAttempt(portal);
      return { ...s, status: ATTEMPT_RUNNING, time, player: { ...s.player, x: 12 * T + (T - PLAYER_WIDTH) / 2, y: 12 * T - PLAYER_HEIGHT, ground: 1, air: 0, vx: 375 } };
    };
    // Éteint (phase 200 à 359) : on passe la colonne 14 sans mourir ; aucun évènement ne secoue.
    let s = standing(200);
    for (let t = 1; t <= 60; t++) {
      const next = stepAttempt(s, INPUT_RIGHT, portal, p);
      for (const e of eventsBetween(s, next, portal, p, t)) {
        const out = feelEvent(e, new Particles(), colors, levels);
        expect(out.shake, e.kind).toBe(0);
        expect(e.kind).not.toBe("mort");
      }
      expect(next.status).toBe(ATTEMPT_RUNNING);
      s = next;
    }
    // Allumé (phase 0 à 149) : on y entre et on meurt.
    s = standing(0);
    let cause = "";
    let mort: GameEvent | null = null;
    for (let t = 1; t <= 80 && !cause; t++) {
      const next = stepAttempt(s, INPUT_RIGHT, portal, p);
      const e = eventsBetween(s, next, portal, p, t).find((x) => x.kind === "mort");
      if (e && e.kind === "mort") (cause = e.cause), (mort = e);
      s = next;
    }
    expect(cause).toBe("laser");
    const out = feelEvent(mort!, new Particles(), colors, levels);
    const plain = feelEvent({ ...mort!, cause: "pic" } as GameEvent, new Particles(), colors, levels);
    expect([out.shake, out.shakeDuration]).toEqual([plain.shake, plain.shakeDuration]);
    expect(out.shake).toBeCloseTo(SHAKES.mortAmp * levels.shake, 12);
  });

  it("des étincelles du néon à la mort au contact d'un rayon (aucune pour une autre cause, ni pour les autres vies du carnage) ; un seul son discret, à la mort", () => {
    const at0 = { tick: 0, x: 14.5, y: 6 };
    const burst = (cause: "laser" | "pic", source: "jeu" | "heros" | "vie") => {
      const pool = new Particles();
      feelEvent({ ...at0, kind: "mort", cause, source } as GameEvent, pool, colors, levels);
      return pool;
    };
    expect(burst("laser", "jeu").emitted).toBeGreaterThan(0);
    expect(burst("laser", "heros").emitted).toBeGreaterThan(0);
    expect(burst("laser", "vie").emitted).toBe(0);
    expect(burst("pic", "jeu").emitted).toBe(0);
    for (const p of burst("laser", "jeu").items.filter((q) => q.age < q.life)) {
      expect(Math.abs(p.x - 14.5)).toBeLessThan(0.5);
      expect(Math.abs(p.y + 6)).toBeLessThan(0.5);
    }
    expect(colors.arc).toContain(LASER_LOOK.lens);
    const laser = soundFor({ kind: "mort", cause: "laser", tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent)!;
    const plain = soundFor({ kind: "mort", cause: "pic", tick: 0, source: "jeu", x: 0, y: 0 } as GameEvent)!;
    expect(laser.id).toBe("mort");
    expect(laser.layers.length).toBe(plain.layers.length + 1);
    // Un bourdonnement qui retombe : pas de son continu (durée finie, courte).
    expect(laser.duration).toBeLessThan(0.5);
  });
});

describe("la galerie `?modules` et `?semaine`", () => {
  it("l'étiquette « laser » existe ; au moins six morceaux la portent, tous du néon, tous dans l'index léger", () => {
    expect(MODULE_TAGS).toContain("laser");
    expect(TAG_LABELS.laser).toBe("laser");
    const mine = MODULES.filter((m) => m.tags.includes("laser"));
    expect(mine.length).toBeGreaterThanOrEqual(6);
    for (const m of mine) {
      expect(m.theme, m.id).toBe("neon");
      expect(MODULE_INDEX.find(([id]) => id === m.id)?.[1], m.id).toBe(m.variants.length);
    }
  });

  it("filtrer par « laser » dans la galerie rend ces morceaux, ouverts dans le thème néon", () => {
    const order = galleryOrder();
    const filtered = order.filter((m) => matchesFilter(m, { tag: "laser", family: null, theme: null }));
    expect(filtered.map((m) => m.id).sort()).toEqual(MODULES.filter((m) => m.tags.includes("laser")).map((m) => m.id).sort());
    expect(filtered.length).toBeGreaterThanOrEqual(6);
    for (const m of filtered) {
      expect(m.theme).toBe("neon");
      expect(m.variants.every((v) => v.theme === "neon"), m.id).toBe(true);
    }
    // Les autres étiquettes n'attrapent pas les lasers.
    expect(order.filter((m) => matchesFilter(m, { tag: "presse", family: null, theme: null })).some((m) => m.tags.includes("laser"))).toBe(false);
  });

  it("chaque morceau à lasers se construit et porte des lasers ou des barres, chaque variante", () => {
    for (const m of MODULES.filter((d) => d.tags.includes("laser"))) {
      for (let v = 0; v < m.variants.length; v++) {
        const lvl = buildModule(m.id, v).level;
        expect(lvl.lasers.length + lvl.laserBars.length, `${m.id} v${v}`).toBeGreaterThan(0);
        expect(createLaserArt(new Group(), lvl, { hazard: HAZARD }), `${m.id} v${v}`).not.toBeNull();
      }
    }
  });

  it("un niveau sans laser n'en dessine pas", () => {
    expect(createLaserArt(new Group(), parseLevel(roomRows().join("\n") + "\n"), { hazard: HAZARD })).toBeNull();
  });

  it("la miniature de `?semaine` connaît les rayons fixes et les barres (axe, tuile, longueur, extrémités) ; un jour sans laser n'a pas ces champs", () => {
    const ascii = text(
      ["version 9", "section salle 0-27", "laser portail v 14,1 11 360 150 7", "laser trait h 3,5 6 300 100 0", "barre balai h 4 480 18,3 18,8", "barre rail v 3 600 5,2 12,2"],
      roomWithTrait(),
    );
    const day = semaineDayOf({ date: "2026-11-09", theme: "neon", id: "jour-2026-11-09-g19", ascii, pieces: [], fallback: false } as never);
    expect(day.lasers).toEqual([
      { axis: "v", col: 14, row: 1, length: 11 },
      { axis: "h", col: 3, row: 5, length: 6 },
    ]);
    expect(day.barres).toEqual([
      { axis: "h", length: 4, from: [18, 3], to: [18, 8] },
      { axis: "v", length: 3, from: [5, 2], to: [12, 2] },
    ]);
    const plain = semaineDayOf({ date: "2026-10-27", theme: "foret", id: "x", ascii: roomRows().join("\n") + "\n", pieces: [], fallback: false } as never);
    expect(plain.lasers).toBeUndefined();
    expect(plain.barres).toBeUndefined();
    expect(parseDay("2026-11-09")).not.toBeNull();
  });
});
