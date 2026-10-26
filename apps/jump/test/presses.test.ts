import { DEFAULT_JUMP_PARAMS, INPUT_RIGHT, TICK_RATE, UNITS_PER_TILE, dailyLevel, initialAttempt, parseLevel, pressAt, pressPart, stepAttempt, buildModule, MODULE_TAGS, type AttemptState } from "@cdj/jump-sim";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { FLICKER_MAX_HZ, PRESS_DUST_TICKS, PRESS_WARN_TICKS, pressLook } from "../src/announce";
import { contrastRatio } from "../src/contrast";
import { FOOTPRINT_FULL, FOOTPRINT_REST, PRESS_LOOK, TREMBLE, TREMBLE_HZ, createPressArt } from "../src/pressArt";
import { galleryOrder, TAG_LABELS } from "../src/modulesInfo";
import { HAZARD, THEMES, THEME_NAMES, backdropColors } from "../src/themes";
import { semaineDayOf } from "../src/semaineInfo";

// Lot 22 — les presses vues par le jeu : un bloc sombre à la face basse rouge, qui frémit 0,5 s avant de tomber pendant que son empreinte s'assombrit (signe continu,
// jamais un clignotement), quelques poussières à l'impact (aucune secousse de caméra), estompée dans le carnage comme les autres éléments à horloge.

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
// Deux presses : `p` (2 colonnes, de la colonne 10) tombe de la rangée 2 (position haute) de 6 tuiles, `q` (3 colonnes, de la colonne 4) de la rangée 3 de 5 tuiles :
// leur bord bas touche le sol (rangée 10) en bas de leur course.
const level = parseLevel(ROWS.join("\n") + "\n\nversion 6\nsection a 1-20\npresse p 2 10,2 6 180 30 60 150\npresse q 3 4,3 5 240 24 90 120\n");
const [press, other] = level.presses as [(typeof level.presses)[number], (typeof level.presses)[number]];

describe("l'annonce (pressLook, pur) : exacte, au pas près", () => {
  it("rien tant que l'attente n'est pas dans ses 0,5 dernières secondes : annonce exactement 0 jusqu'au pas `attente − 60`", () => {
    expect(PRESS_WARN_TICKS).toBe(TICK_RATE / 2);
    for (let t = 0; t <= press.hold - PRESS_WARN_TICKS; t++) expect(pressLook(press, t).warn, `pas ${t}`).toBe(0);
  });

  it("elle commence au bon pas : le premier pas annoncé est `attente − 60 + 1`, puis elle croît strictement jusqu'à 1 au pas où la chute part", () => {
    const first = press.hold - PRESS_WARN_TICKS + 1;
    expect(pressLook(press, first - 1).warn).toBe(0);
    expect(pressLook(press, first).warn).toBeGreaterThan(0);
    for (let t = first + 1; t <= press.hold; t++) expect(pressLook(press, t).warn, `pas ${t}`).toBeGreaterThan(pressLook(press, t - 1).warn);
    expect(pressLook(press, press.hold).warn).toBe(1);
  });

  it("la chute part au pas prévu : la presse est encore en haut au pas où l'annonce est pleine, et bouge au pas qui suit", () => {
    expect(pressPart(press, press.hold)).toBe(0);
    expect(pressPart(press, press.hold + 1)).toBeGreaterThan(0);
    // Une fois la chute partie, plus d'annonce.
    for (let t = press.hold + 1; t < press.cycle; t++) expect(pressLook(press, t).warn).toBe(0);
    // Même chose pour chaque cycle suivant et pour une phase négative.
    expect(pressLook(press, press.hold - 10 + 5 * press.cycle).warn).toBe(pressLook(press, press.hold - 10).warn);
    expect(pressLook(press, press.hold - 10 - 3 * press.cycle).warn).toBe(pressLook(press, press.hold - 10).warn);
  });

  it("la part de la course est celle de la simulation ; la poussière suit l'impact : âge 0 au pas où la presse touche le sol, puis 0,5 s", () => {
    for (let t = 0; t < press.cycle; t++) expect(pressLook(press, t).part).toBe(pressPart(press, t) / 4096);
    const impact = press.hold + press.fall;
    expect(pressLook(press, impact - 1).dustAge).toBe(-1);
    expect(pressLook(press, impact).dustAge).toBe(0);
    expect(pressLook(press, impact + PRESS_DUST_TICKS - 1).dustAge).toBe(PRESS_DUST_TICKS - 1);
    expect(pressLook(press, impact + PRESS_DUST_TICKS).dustAge).toBe(-1);
    expect(pressLook(press, impact).part).toBe(1);
  });

  it("une attente plus courte que l'annonce n'est pas possible (au moins 1 s) : l'annonce tient toujours dans l'attente", () => {
    expect(press.hold).toBeGreaterThanOrEqual(PRESS_WARN_TICKS * 2);
    expect(other.hold).toBeGreaterThanOrEqual(PRESS_WARN_TICKS * 2);
  });

  it("jamais de clignotement : l'annonce ne varie pas de plus de 3 % d'un pas à l'autre, un seul pic par cycle, fréquence du frémissement sous 3 Hz", () => {
    const series = Array.from({ length: press.cycle * 3 }, (_, t) => pressLook(press, t).warn);
    // L'annonce monte de 1/60 par pas puis retombe à 0 au pas où la chute part (la presse bouge : le signe a fait son travail) ; jamais d'autre saut.
    for (let t = 1; t < series.length; t++) {
      const up = series[t]! - series[t - 1]!;
      if (up < 0) expect(series[t]!, `pas ${t}`).toBe(0);
      else expect(up, `pas ${t}`).toBeLessThan(1 / (PRESS_WARN_TICKS - 1));
    }
    let peaks = 0;
    for (let t = 1; t < series.length - 1; t++) if (series[t]! > series[t - 1]! && series[t]! >= series[t + 1]!) peaks++;
    expect(peaks / (series.length / TICK_RATE)).toBeLessThanOrEqual(FLICKER_MAX_HZ);
    expect(TREMBLE_HZ).toBeLessThan(FLICKER_MAX_HZ);
  });
});

describe("le dessin (pressArt)", () => {
  const running: AttemptState = { ...initialAttempt(level), status: 1, time: 100 };
  const meshes = (g: Group) => g.children.filter((c): c is Mesh => (c as Mesh).isMesh);

  it("un niveau sans presse n'en dessine pas", () => {
    expect(createPressArt(new Group(), parseLevel(ROWS.join("\n") + "\n"), { hazard: HAZARD })).toBeNull();
  });

  it("la face basse porte le rouge des dangers, le reste est sombre et neutre", () => {
    const world = new Group();
    createPressArt(world, level, { hazard: HAZARD });
    const group = world.children.find((c) => c instanceof Group) as Group;
    const colors = meshes(group).map((m) => (m.material as MeshBasicMaterial).color.getHex());
    expect(colors).toContain(HAZARD);
    expect(colors.filter((c) => c !== HAZARD).length).toBeGreaterThan(0);
    expect(contrastRatio(PRESS_LOOK.body, HAZARD)).toBeGreaterThan(1.5);
    // Le corps est sombre : lisible sur le ciel et chaque plan de chaque thème (3:1 au moins avec l'un d'eux au pire, le rouge de la face distingue le reste).
    for (const name of THEME_NAMES) for (const b of backdropColors(THEMES[name])) expect(Math.max(contrastRatio(PRESS_LOOK.body, b), contrastRatio(HAZARD, b)), `${name} ${b.toString(16)}`).toBeGreaterThanOrEqual(2);
  });

  it("pose chaque presse où la simulation la met (interpolée), annonce et empreinte comprises", () => {
    const world = new Group();
    const art = createPressArt(world, level, { hazard: HAZARD })!;
    const t0 = press.hold - 20; // pendant l'annonce
    const s0: AttemptState = { ...running, time: t0 };
    const s1 = stepAttempt(s0, INPUT_RIGHT, level, DEFAULT_JUMP_PARAMS);
    art.update(s0, s1, 0, 1, 0);
    level.presses.forEach((p, i) => {
      const at = pressAt(level, s0.sections, s0.time, i);
      expect(art.stats.y[i]).toBe(at.y / T);
    });
    // L'annonce de la simulation : 40 pas sur 60 ; l'empreinte s'assombrit avec elle, de façon continue.
    expect(art.stats.warn[0]).toBeCloseTo(pressLook(press, t0 + 1 - 0).warn, 1);
    expect(art.stats.footprint[0]).toBeGreaterThan(FOOTPRINT_REST);
    expect(art.stats.footprint[0]).toBeLessThan(FOOTPRINT_FULL + 1e-9);
  });

  it("l'empreinte est discrète hors annonce et pleine au pas où la chute part ; la presse frémit (amplitude croissante) et reste immobile hors annonce", () => {
    const world = new Group();
    const art = createPressArt(world, level, { hazard: HAZARD })!;
    const at = (time: number, seconds: number) => {
      const s: AttemptState = { ...running, time };
      art.update(s, s, 1, 1, seconds);
      return { x: art.stats.x[0]!, footprint: art.stats.footprint[0]! };
    };
    // Hors annonce : empreinte au repos, aucun décalage quelle que soit l'heure d'affichage.
    for (const sec of [0, 0.1, 0.17, 0.3]) expect(at(10, sec)).toEqual({ x: press.col, footprint: FOOTPRINT_REST });
    // À l'annonce pleine : l'empreinte est à son maximum et le frémissement peut atteindre son amplitude.
    expect(at(press.hold, 0).footprint).toBeCloseTo(FOOTPRINT_FULL, 9);
    const amp = Math.max(...Array.from({ length: 200 }, (_, k) => Math.abs(at(press.hold, k / 100).x - press.col)));
    expect(amp).toBeLessThanOrEqual(TREMBLE + 1e-9);
    expect(amp).toBeGreaterThan(TREMBLE * 0.9);
    // Au milieu de l'annonce, l'amplitude est à peu près moitié moindre.
    const mid = Math.max(...Array.from({ length: 200 }, (_, k) => Math.abs(at(press.hold - PRESS_WARN_TICKS / 2, k / 100).x - press.col)));
    expect(mid).toBeLessThan(amp);
  });

  it("la poussière apparaît à l'impact et s'estompe en 0,5 s ; aucune secousse de caméra (le dessin n'en demande aucune)", () => {
    const world = new Group();
    const art = createPressArt(world, level, { hazard: HAZARD })!;
    const dust = (time: number) => {
      const s: AttemptState = { ...running, time };
      art.update(s, s, 1, 1, 0);
      return art.stats.dust[0]!;
    };
    expect(dust(press.hold + press.fall - 1)).toBe(0);
    expect(dust(press.hold + press.fall)).toBeGreaterThan(0);
    expect(dust(press.hold + press.fall + PRESS_DUST_TICKS)).toBe(0);
  });

  it("hors carnage (1) : le corps, la face et la tige sont opaques et sans mélange ; pendant le carnage : 35 %", () => {
    const world = new Group();
    const art = createPressArt(world, level, { hazard: HAZARD })!;
    art.update(running, running, 1, 1, 0);
    const solid = world.children.flatMap((g) => (g instanceof Group ? meshes(g) : [])).map((m) => m.material as MeshBasicMaterial);
    expect(solid.length).toBeGreaterThan(0);
    for (const m of solid) expect([m.opacity, m.transparent]).toEqual([1, false]);
    art.update(running, running, 1, 0.35, 0);
    for (const m of solid) expect([m.opacity, m.transparent]).toEqual([0.35, true]);
    expect(art.stats.opacity).toBe(0.35);
    // L'empreinte suit l'estompage.
    expect(art.stats.footprint[0]).toBeCloseTo(FOOTPRINT_REST * 0.35, 9);
    art.update(running, running, 1, 1, 0);
    for (const m of solid) expect([m.opacity, m.transparent]).toEqual([1, false]);
  });

  it("les pièces du corps ne se recouvrent pas (l'estompage ne s'additionne pas) : le corps et la face rouge se touchent par leur bord", () => {
    const world = new Group();
    createPressArt(world, level, { hazard: HAZARD });
    const group = world.children.find((c) => c instanceof Group) as Group;
    const [body, face] = meshes(group) as [Mesh, Mesh];
    const box = (m: Mesh) => {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!;
      return { y0: m.position.y + b.min.y, y1: m.position.y + b.max.y };
    };
    expect(box(body).y0).toBeCloseTo(box(face).y1, 5);
  });
});

describe("dans la galerie et l'outil de la variété", () => {
  it("l'étiquette « presse » filtre les morceaux de la galerie (`?modules`)", () => {
    expect(MODULE_TAGS).toContain("presse");
    expect(TAG_LABELS.presse).toBe("presse");
    const withTag = galleryOrder().filter((m) => m.tags.includes("presse"));
    expect(withTag.length).toBeGreaterThanOrEqual(6);
  });

  it("un morceau à presse se construit avec sa presse (la galerie le joue et le montre par la scène)", () => {
    expect(buildModule("presse-promenade", 0).level.presses).toHaveLength(2);
  });

  it("?semaine : la miniature connaît les presses d'un jour (colonne, rangée haute, largeur, course)", () => {
    // Le premier jour d'usine qui en contient, parmi les jours g16 (un seul niveau généré à la fois, pour rester court).
    let day: ReturnType<typeof dailyLevel> | undefined;
    for (let d = parseDay("2026-10-27")!; d < parseDay("2026-10-27")! + 40 && !day; d++) {
      const L = dailyLevel(d);
      if (L.level.presses.length > 0) day = L;
    }
    expect(day).toBeDefined();
    const info = semaineDayOf(day!);
    expect(info.presses).toHaveLength(day!.level.presses.length);
    info.presses!.forEach((p, i) => {
      const q = day!.level.presses[i]!;
      expect(p).toEqual({ col: q.col, row: q.row, width: q.width, travel: q.travel });
    });
  }, 120_000);
});
