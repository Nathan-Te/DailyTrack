import "./figesDepot";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, demoAttempts, encodeReplay, replayAttempt } from "@cdj/jump-sim";
import { contrastRatio, hueDistance } from "../src/contrast";
import { thawLevel } from "../src/frozen";
import { DemoRankSource, DEMO_TODAY } from "../src/demoRank";
import { FIRST_GHOST_COLOR, OWN_GHOST_COLOR, checkFirstGhost, firstGhostLabel, showFirstGhost, type FirstGhostData } from "../src/firstGhost";
import { BLOCK_STYLE } from "../src/blocks";
import { defaultSettings, parseSettings } from "../src/settings";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";
import { archiveHref, dailyHref, readUrlOptions, watchFirstHref } from "../src/urlOptions";
import { wantsHome } from "../src/homeLogic";
import "./francais";

// Lot P2 (plateforme) : le fantôme du premier vu par le jeu — couleurs des deux fantômes, validation à la lecture, pas de doublon quand on est
// premier, réglage et paramètres d'adresse, démonstration.

const D = dailyLevel(DEMO_TODAY - 10);
const data = (extra: Partial<FirstGhostData> = {}): FirstGhostData => ({
  date: D.date,
  levelId: D.id,
  name: "Démo Nitro",
  ticks: 1,
  deaths: 7,
  replay: D.code,
  simVersion: JUMP_SIM_VERSION,
  generatorVersion: JUMP_GENERATOR_VERSION,
  mine: false,
  ...extra,
});

describe("couleurs des deux fantômes (règle du lot 9)", () => {
  const ghosts = [OWN_GHOST_COLOR, FIRST_GHOST_COLOR];
  it("ni le rouge des dangers ni le jaune du personnage : teinte à au moins 30° de chacun", () => {
    for (const c of ghosts) {
      expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThanOrEqual(30);
      expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThanOrEqual(30);
    }
  });
  it("deux couleurs bien distinctes : teintes à au moins 60° l'une de l'autre", () => {
    expect(hueDistance(OWN_GHOST_COLOR, FIRST_GHOST_COLOR)).toBeGreaterThanOrEqual(60);
  });
  it("lisibles : au moins 3:1 contre le ciel et chaque plan de chaque thème ; à 30° au moins des blocs clignotants et alternés", () => {
    for (const name of THEME_NAMES) {
      for (const b of backdropColors(THEMES[name])) for (const c of ghosts) expect(contrastRatio(c, b), `${name} ${c.toString(16)} / ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
    }
    for (const c of ghosts) for (const s of [BLOCK_STYLE.blink, BLOCK_STYLE.altA, BLOCK_STYLE.altB]) expect(hueDistance(c, s.fill), `${c.toString(16)} / ${s.fill.toString(16)}`).toBeGreaterThanOrEqual(20);
  });
  it("le fantôme et l'étiquette du premier : son pseudo, discret", () => {
    expect(firstGhostLabel("Démo Nitro")).toBe("Démo Nitro · 1er"); // lot I5 : le rang au format du socle
  });
});

describe("validation à la lecture (comme le lot 3)", () => {
  it("une rediffusion valide : le temps et les morts sont ceux du rejeu du jeu, jamais ceux annoncés", () => {
    const r = checkFirstGhost(data(), D.level, D.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([r.ghost.ticks, r.ghost.deaths, r.ghost.name, r.ghost.mine]).toEqual([D.authorTicks, 0, "Démo Nitro", false]);
    expect(r.ghost.code).toBe(D.code);
  });
  it("une autre version, un autre niveau, une rediffusion illisible ou qui n'arrive pas : ignorée", () => {
    expect(checkFirstGhost(data({ simVersion: JUMP_SIM_VERSION + 1 }), D.level, D.id)).toMatchObject({ ok: false, reason: "autre version du jeu" });
    expect(checkFirstGhost(data({ generatorVersion: JUMP_GENERATOR_VERSION + 1 }), D.level, D.id).ok).toBe(false);
    // Lot 15 : c'est la rediffusion qui compte (la version de son niveau, puis le rejeu) : une v3 sur un niveau v4 est d'une autre version.
    expect(checkFirstGhost(data({ replay: encodeReplay({ ...D.replay, simVersion: 3 }) }), D.level, D.id)).toMatchObject({ ok: false, reason: "rediffusion d'une autre version" });
    expect(checkFirstGhost(data({ levelId: `jour-${D.date}-g${JUMP_GENERATOR_VERSION - 1}` }), D.level, D.id)).toMatchObject({ ok: false, reason: "autre niveau" });
    expect(checkFirstGhost(data({ replay: "pas-une-rediffusion" }), D.level, D.id).ok).toBe(false);
    const other = dailyLevel(DEMO_TODAY - 11);
    expect(checkFirstGhost(data({ replay: other.code }), D.level, D.id).ok).toBe(false);
    const stuck = demoAttempts(D.level, D.replay, 3, { attempts: 30 }).find((a) => a.end !== "arrivée");
    if (stuck) expect(checkFirstGhost(data({ replay: encodeReplay(stuck.replay) }), D.level, D.id)).toMatchObject({ ok: false, reason: "la rediffusion n'arrive pas" });
    expect(checkFirstGhost(null, D.level, D.id).ok).toBe(false);
    expect(checkFirstGhost({ name: "x" }, D.level, D.id).ok).toBe(false);
  });
});

describe("pas de doublon quand on est premier", () => {
  const first = { mine: false, ticks: 4000, code: "AAA" };
  it("le premier est montré à côté de ton fantôme quand il est devant toi (ou que tu n'as pas encore de meilleur essai)", () => {
    expect(showFirstGhost(first, null)).toBe(true);
    expect(showFirstGhost(first, { ticks: 4200, code: "BBB" })).toBe(true);
    // À temps égal, le premier envoyé reste devant : son fantôme reste.
    expect(showFirstGhost(first, { ticks: 4000, code: "BBB" })).toBe(true);
  });
  it("si le premier, c'est toi (le serveur le dit, même rediffusion, ou tu es déjà plus rapide) : seulement ton fantôme", () => {
    expect(showFirstGhost({ ...first, mine: true }, null)).toBe(false);
    expect(showFirstGhost(first, { ticks: 4000, code: "AAA" })).toBe(false);
    expect(showFirstGhost(first, { ticks: 3999, code: "BBB" })).toBe(false);
    expect(showFirstGhost(null, { ticks: 3999, code: "BBB" })).toBe(false);
  });
});

describe("réglage « Fantôme du premier » et paramètres d'adresse", () => {
  it("un réglage du menu, oui par défaut, mémorisé (un ancien enregistrement le prend à oui)", () => {
    expect(defaultSettings().firstGhost).toBe(true);
    expect(parseSettings(JSON.stringify({ v: 1, firstGhost: false })).firstGhost).toBe(false);
    expect(parseSettings(JSON.stringify({ v: 1, volume: 0.5 })).firstGhost).toBe(true);
  });
  it("?ghost= étendu : off (aucun), best (le tien seulement), first (le premier seulement) ; gardé par les liens internes", () => {
    expect(readUrlOptions("")).toMatchObject({ ghost: null, ghostOff: false, firstGhostOff: false });
    expect(readUrlOptions("?ghost=off")).toMatchObject({ ghost: "off", ghostOff: true, firstGhostOff: true });
    expect(readUrlOptions("?ghost=best")).toMatchObject({ ghost: "best", ghostOff: false, firstGhostOff: true });
    expect(readUrlOptions("?ghost=first")).toMatchObject({ ghost: "first", ghostOff: true, firstGhostOff: false });
    expect(readUrlOptions("?ghost=autre").ghost).toBeNull();
    expect(dailyHref(readUrlOptions("?ghost=first&accueil=0"))).toBe("?ghost=first&accueil=0");
    expect(archiveHref("2026-10-20", readUrlOptions("?ghost=best"))).toBe("?seed=2026-10-20&ghost=best");
  });
  it("?watch=first : la lecture de l'essai du premier (niveau du jour ou archive), un lien direct (pas d'accueil)", () => {
    expect(readUrlOptions("?watch=first").watchFirst).toBe(true);
    expect(readUrlOptions("?watch=first").watchBest).toBe(false);
    expect(readUrlOptions("?scenario=essai&watch=first").watchFirst).toBe(false);
    expect(wantsHome(readUrlOptions("?watch=first"))).toBe(false);
    expect(watchFirstHref(null, readUrlOptions("?api=demo&debug"))).toBe("?watch=first&debug&api=demo");
    expect(watchFirstHref("2026-10-20", readUrlOptions(""))).toBe("?seed=2026-10-20&watch=first");
  });
});

describe("démonstration : le fantôme du premier de chaque jour", () => {
  const dir = join(__dirname, "..", "public", "demo");
  const fetchFile = async (url: string) => {
    try {
      return new Response(readFileSync(join(dir, url.replace(/^demo\//, ""))), { status: 200 });
    } catch {
      return new Response("", { status: 404 });
    }
  };
  it("lu dans le jeu de données (rediffusion validée par le vrai serveur), accepté par la validation du jeu", async () => {
    const src = new DemoRankSource("demo/", null, fetchFile);
    for (const day of [DEMO_TODAY - 10, DEMO_TODAY]) {
      // Le niveau que la page joue ce jour-là (lot 15) : son fichier figé s'il existe (en v3 jusqu'au 22/10/2026), sinon le générateur.
      const file = join(import.meta.dirname, "../public/levels", `${formatDay(day)}.json`);
      const thawed = existsSync(file) ? thawLevel(JSON.parse(readFileSync(file, "utf8")), day) : null;
      const d = thawed && typeof thawed !== "string" ? thawed : dailyLevel(day);
      const r = await src.firstGhost(formatDay(day), null);
      expect(r.ok, formatDay(day)).toBe(true);
      if (!r.ok) continue;
      expect(r.data.mine).toBe(false);
      const c = checkFirstGhost(r.data, d.level, d.id);
      expect(c.ok, formatDay(day)).toBe(true);
      if (c.ok) expect(c.ghost.ticks).toBe(replayAttempt(d.level, c.ghost.replay, d.id).time);
    }
    expect((await src.firstGhost("2026-12-31", null)).ok).toBe(false);
  });
});
