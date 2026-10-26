import { INPUT_RIGHT, TICK_RATE, UNITS_PER_TILE, buildModule, initialAttempt, parseLevel, platformAt, platformPos, stepAttempt, dailyLevel, DEFAULT_JUMP_PARAMS, type AttemptState } from "@cdj/jump-sim";
import { Group, LineDashedMaterial, Mesh, MeshBasicMaterial } from "three";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { FLICKER_MAX_HZ, platformLook, platformPeak } from "../src/announce";
import { contrastRatio, hueDistance, hueOf } from "../src/contrast";
import { PLATFORM_LOOK, createPlatformArt } from "../src/platformArt";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";
import { miniKind, semaineDayOf } from "../src/semaineInfo";
import { galleryOrder, TAG_LABELS } from "../src/modulesInfo";
import { MODULE_TAGS } from "@cdj/jump-sim";

// Lot 20 — les plateformes mobiles vues par le jeu : une dalle crème cernée d'encre (jamais rouge, jamais jaune), des chevrons qui s'effacent avec la vitesse
// (le ralenti annonce le demi-tour), un trajet en pointillés neutres, estompée dans le carnage comme les autres éléments à horloge.

const T = UNITS_PER_TILE;
const ROWS = [
  "######################",
  "#....................#",
  "#....................#",
  "#....................#",
  "#....................#",
  "#....................#",
  "#....................#",
  "#....................#",
  "#....................#",
  "#S..................F#",
  "######################",
];
const level = parseLevel(ROWS.join("\n") + "\n\nversion 5\nsection a 1-20\nplateforme h 3 h 480 4,9 12,9\nplateforme v 2 v 360 17,3 17,8\n");
const [horizontal, vertical] = level.platforms as [(typeof level.platforms)[number], (typeof level.platforms)[number]];

describe("couleurs de la dalle", () => {
  it("celles de la charte (`--dj-papier` cernée de `--dj-encre`) : ni le rouge des dangers, ni le jaune du personnage", () => {
    expect(PLATFORM_LOOK).toEqual({ face: 0xfff6e0, edge: 0x2a1e16 });
    for (const c of [PLATFORM_LOOK.face, PLATFORM_LOOK.edge]) {
      expect(hueOf(c).chroma <= 0.15 || hueDistance(c, HAZARD) >= 30, c.toString(16)).toBe(true);
      expect(hueOf(c).chroma, c.toString(16)).toBeLessThan(hueOf(PLAYER).chroma / 2 + 0.2);
    }
    expect(contrastRatio(PLATFORM_LOOK.face, PLATFORM_LOOK.edge)).toBeGreaterThanOrEqual(7);
  });

  it("lisible sur le ciel et chaque plan de chaque thème : la face ou son cerne à 3:1 au moins (le pointillé alterne les deux)", () => {
    for (const name of THEME_NAMES) {
      for (const b of backdropColors(THEMES[name])) {
        const best = Math.max(contrastRatio(PLATFORM_LOOK.face, b), contrastRatio(PLATFORM_LOOK.edge, b));
        expect(best, `${name} ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("le ralenti annonce le demi-tour (platformLook, pur)", () => {
  it("la vitesse est celle de la simulation, en part de sa pointe : presque nulle aux extrémités, pleine au milieu, et le sens se retourne au demi-cycle", () => {
    const half = horizontal.cycle / 2;
    expect(platformLook(horizontal, 0).speed).toBeLessThan(0.05);
    expect(platformLook(horizontal, half - 1).speed).toBeLessThan(0.05);
    expect(platformLook(horizontal, half + 1).speed).toBeLessThan(0.05);
    expect(platformLook(horizontal, half / 2).speed).toBeGreaterThan(0.95);
    expect(platformLook(horizontal, 10).dir).toBe(1);
    expect(platformLook(horizontal, half + 10).dir).toBe(-1);
    expect(platformLook(vertical, 10).dir).toBe(1);
    for (let t = 0; t < horizontal.cycle; t++) {
      const look = platformLook(horizontal, t);
      expect(look.speed).toBeGreaterThanOrEqual(0);
      expect(look.speed).toBeLessThanOrEqual(1);
      const step = platformPos(horizontal, t + 1).x - platformPos(horizontal, t).x;
      expect(Math.abs(step) / platformPeak(horizontal)).toBeCloseTo(look.speed, 9);
    }
  });

  it("aucune variation brusque de la vitesse affichée d'un pas à l'autre (au plus 15 % de la pointe : la pente change à chaque intervalle de la table), et jamais plus de 3 pics par seconde (rien ne clignote)", () => {
    for (const p of [horizontal, vertical]) {
      const series = Array.from({ length: p.cycle * 3 }, (_, t) => platformLook(p, t).speed);
      for (let t = 1; t < series.length; t++) expect(Math.abs(series[t]! - series[t - 1]!), `${p.id} pas ${t}`).toBeLessThan(0.15);
      // Des pics visibles : une remontée d'au moins 10 % de la pointe après une descente d'au moins 10 % (l'entier du pas ajoute un bruit de l'ordre du centième).
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
      expect(peaks / (series.length / TICK_RATE), p.id).toBeLessThanOrEqual(FLICKER_MAX_HZ);
    }
  });
});

describe("le dessin (platformArt)", () => {
  const running: AttemptState = { ...initialAttempt(level), status: 1, time: 100 };
  const meshes = (g: Group) => g.children.filter((c): c is Mesh => (c as Mesh).isMesh);

  it("un niveau sans plateforme n'en dessine pas", () => {
    expect(createPlatformArt(new Group(), parseLevel(ROWS.join("\n") + "\n"))).toBeNull();
  });

  it("pose chaque dalle où la simulation la met (interpolée), avec la vitesse et le sens du chevron", () => {
    const world = new Group();
    const art = createPlatformArt(world, level)!;
    const next = stepAttempt(running, INPUT_RIGHT, level, DEFAULT_JUMP_PARAMS);
    art.update(running, next, 0, 1);
    level.platforms.forEach((p, i) => {
      const at = platformAt(level, running.sections, running.time, i);
      expect([art.stats.x[i], art.stats.y[i]]).toEqual([at.x / T, at.y / T]);
      expect(art.stats.speed[i]).toBeCloseTo(platformLook(p, 101).speed, 9);
      expect(art.stats.dir[i]).toBe(1);
    });
    art.update(running, next, 1, 1);
    const at1 = platformAt(level, next.sections, next.time, 0);
    expect(art.stats.x[0]).toBe(at1.x / T);
  });

  it("hors carnage (1) : toutes les pièces sont opaques et sans mélange ; pendant le carnage : 35 %, trajet compris", () => {
    const world = new Group();
    const art = createPlatformArt(world, level)!;
    art.update(running, running, 1, 1);
    const solid = world.children.flatMap((g) => (g instanceof Group ? meshes(g) : [])).map((m) => m.material as MeshBasicMaterial);
    expect(solid.length).toBeGreaterThan(0);
    for (const m of solid) expect([m.opacity, m.transparent]).toEqual([1, false]);
    art.update(running, running, 1, 0.35);
    for (const m of solid) expect([m.opacity, m.transparent]).toEqual([0.35, true]);
    expect(art.stats.opacity).toBe(0.35);
    const lines = world.children.filter((c) => (c as { isLine?: boolean }).isLine).map((c) => (c as Mesh).material as LineDashedMaterial);
    expect(lines.length).toBeGreaterThan(0);
    for (const m of lines) expect(m.opacity).toBeCloseTo(0.6 * 0.35, 9);
    art.update(running, running, 1, 1);
    for (const m of solid) expect([m.opacity, m.transparent]).toEqual([1, false]);
  });

  it("le trajet est dessiné en pointillés neutres : deux lignes (crème et encre) par trajet et par empreinte d'extrémité, jamais la couleur des dangers", () => {
    const world = new Group();
    createPlatformArt(world, level);
    const lines = world.children.filter((c) => (c as { isLine?: boolean }).isLine).map((c) => (c as Mesh).material as LineDashedMaterial);
    // Par plateforme : le trajet et deux empreintes, chacun en deux pointillés qui alternent.
    expect(lines).toHaveLength(level.platforms.length * 3 * 2);
    for (const m of lines) {
      expect([PLATFORM_LOOK.face, PLATFORM_LOOK.edge]).toContain(m.color.getHex());
      expect(m.color.getHex()).not.toBe(HAZARD);
    }
  });
});

describe("dans la galerie et l'outil de la variété", () => {
  it("l'étiquette « plateforme mobile » filtre les morceaux de la galerie (`?modules`)", () => {
    expect(MODULE_TAGS).toContain("plateforme");
    expect(TAG_LABELS.plateforme).toBe("plateforme mobile");
    const withTag = galleryOrder().filter((m) => m.tags.includes("plateforme"));
    expect(withTag.length).toBeGreaterThanOrEqual(6);
    expect(withTag.every((m) => m.variants.length > 0)).toBe(true);
  });

  it("un morceau à plateforme se construit avec sa plateforme (la galerie le joue et le montre par la scène)", () => {
    const built = buildModule("radeau", 0);
    expect(built.level.platforms).toHaveLength(1);
  });

  it("?semaine : la miniature connaît les plateformes d'un jour (largeur, extrémités) et les montre en crème", () => {
    // Un jour qui contient des morceaux à plateformes (le 28/10/2026 : va-et-vient et monte-charge, trois plateformes) ; un seul niveau est généré,
    // le test reste court même quand tous les fichiers de test tournent ensemble.
    const day = dailyLevel(parseDay("2026-10-28")!);
    expect(day.level.platforms.length).toBeGreaterThan(0);
    const info = semaineDayOf(day);
    expect(info.platforms).toHaveLength(day.level.platforms.length);
    info.platforms!.forEach((p: { width: number }, i: number) => {
      const q = day.level.platforms[i]!;
      expect(p).toEqual({ width: q.width, from: [q.a.col, q.a.row], to: [q.b.col, q.b.row] });
    });
    // La grille ne les contient pas : la miniature les dessine à part.
    expect(miniKind(".")).toBe("vide");
  });
});
