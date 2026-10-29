import { JUMP_THEME_NAMES } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { CIBLES, DEFAULT_ADMIN, FERME_EN_PRODUCTION, MORCEAUX, NOMS_THEMES, PRESETS, SCENARIOS_ADMIN, buildQuery, cibleDe, gameHref, gameKeys, parseAdmin, type AdminJumpState, type ContexteAdmin } from "../src/adminLogic";
import { MODULE_INDEX } from "../src/moduleIndex";
import { SCENARIOS, URL_OPTIONS, readUrlOptions } from "../src/urlOptions";

// La page /jump/admin/ ne fait que construire l'adresse du jeu : chaque adresse construite est relue avec `readUrlOptions`, le seul lecteur du jeu.

const hors: ContexteAdmin = { restreint: false, aujourdhui: "2026-10-29" };
const prod: ContexteAdmin = { restreint: true, aujourdhui: "2026-10-29" };
const etat = (patch: Partial<AdminJumpState>): AdminJumpState => ({ ...DEFAULT_ADMIN, ...patch });
const lire = (patch: Partial<AdminJumpState>, c = hors) => readUrlOptions(`?${buildQuery(etat(patch), c)}`, c.restreint);

describe("les listes recopiées sont celles du jeu", () => {
  it("scénarios, thèmes et morceaux", () => {
    expect([...SCENARIOS_ADMIN]).toEqual([...SCENARIOS]);
    expect(Object.keys(NOMS_THEMES)).toEqual([...JUMP_THEME_NAMES]);
    expect(MORCEAUX).toBe(MODULE_INDEX);
  });
  it("chaque paramètre que la page écrit existe dans URL_OPTIONS", () => {
    const connus = new Set(URL_OPTIONS.map((o) => o.name));
    const tout = etat({ cible: "semaine", date: "2026-10-20", generateur: "13", theme: "neon", solution: true, debug: true, tune: true, sprint: true, hitbox: true, piecesOff: true, fxOff: true, metronomeOff: true, touch: "1", zones: true, ghost: "first", watch: "best", carnageDemo: true, archives: true, accueil: "0", api: "demo" });
    for (const c of CIBLES) {
      const q = new URLSearchParams(buildQuery({ ...tout, cible: c, morceau: MORCEAUX[0]![0], variante: "1", entree: "elan" }, hors));
      for (const nom of q.keys()) expect(connus.has(nom), `${c}: ${nom}`).toBe(true);
    }
  });
});

describe("l'adresse construite est celle que le jeu lit", () => {
  it("le niveau du jour sans rien : `../`", () => {
    expect(buildQuery(DEFAULT_ADMIN, hors)).toBe("");
    expect(gameHref(DEFAULT_ADMIN, hors)).toBe("../");
    expect(gameHref(etat({ debug: true }), hors)).toBe("../?debug");
  });
  it("une date, un thème imposé, une lecture, les archives", () => {
    const o = lire({ date: "2026-10-20", theme: "usine", watch: "first" });
    expect(o.daily).toBe(true);
    expect(o.seed).not.toBeNull();
    expect(o.theme).toBe("usine");
    expect(o.watchFirst).toBe(true);
    expect(lire({ archives: true }).archives).toBe(true);
    expect(lire({ accueil: "0" }).home).toBe(false);
    expect(lire({ accueil: "1" }).home).toBe(true);
  });
  it("chaque niveau écrit à la main", () => {
    for (const s of SCENARIOS) expect(lire({ cible: s }).scenario, s).toBe(s);
  });
  it("un morceau, sa variante, son entrée ; une variante hors de l'index revient au morceau seul", () => {
    const [id, n] = MORCEAUX.find(([, v]) => v > 2)!;
    expect(lire({ cible: "morceau", morceau: id, variante: "2", entree: "elan" }).module).toEqual({ id, variant: 2, entry: "elan", solution: false });
    expect(lire({ cible: "morceau", morceau: id, variante: String(n) }).module).toMatchObject({ id, variant: 0 });
    expect(lire({ cible: "morceau", morceau: id, theme: "glace" }).theme).toBe("glace");
    // un morceau absent ouvre la galerie, comme le jeu
    expect(lire({ cible: "morceau", morceau: "" }).gallery).toBe(true);
    expect(lire({ cible: "galerie" }).gallery).toBe(true);
  });
  it("l'outil de la variété : la date vaut aujourd'hui sans autre choix", () => {
    expect(lire({ cible: "semaine" }).semaine).not.toBeNull();
    expect(buildQuery(etat({ cible: "semaine" }), hors)).toBe("semaine=2026-10-29");
    expect(lire({ cible: "semaine", date: "2026-11-02", generateur: "13" })).toMatchObject({ semaineG13: true });
    expect(lire({ cible: "semaine", generateur: "14" }).semaineG14).toBe(true);
  });
  it("`tune`, `sprint`, `hitbox` et `pieces` sous-entendent `debug`", () => {
    expect(lire({ tune: true })).toMatchObject({ debug: true, tune: true });
    expect(lire({ sprint: true })).toMatchObject({ debug: true, tune: true, sprint: true });
    expect(lire({ hitbox: true })).toMatchObject({ debug: true, hitbox: true });
    expect(lire({ piecesOff: true })).toMatchObject({ debug: true, pieces: false });
  });
  it("effets, métronome, tactile, zones, fantômes, API", () => {
    expect(lire({ fxOff: true }).fx).toBe(false);
    expect(lire({ metronomeOff: true }).metronome).toBe(false);
    expect(lire({ touch: "0" }).touch).toBe("0");
    expect(lire({ touch: "1", zones: true })).toMatchObject({ touch: "1", zones: true });
    expect(lire({ ghost: "first" }).ghost).toBe("first");
    expect(lire({ api: " demo " }).api).toBe("demo");
  });
  it("la lecture du meilleur essai marche sur un scénario, celle du premier seulement sur le niveau du jour", () => {
    expect(lire({ cible: "essai", watch: "best" })).toMatchObject({ scenario: "essai", watchBest: true });
    expect(lire({ cible: "essai", watch: "first" }).watchFirst).toBe(false);
  });
});

describe("le site publié ferme les outils du lot R9", () => {
  it("rien de fermé n'est écrit dans l'adresse, même demandé", () => {
    const [id] = MORCEAUX[0]!;
    const q = buildQuery(etat({ solution: true, carnageDemo: true, generateur: "13" }), prod);
    expect(q).toBe("");
    expect(buildQuery(etat({ cible: "morceau", morceau: id, solution: true }), prod)).toBe(`module=${id}`);
    for (const nom of FERME_EN_PRODUCTION) expect(buildQuery(etat({ cible: "semaine", solution: true, carnageDemo: true, generateur: "14" }), prod)).not.toContain(nom);
  });
  it("l'outil de la variété retombe sur le niveau du jour", () => {
    expect(cibleDe(etat({ cible: "semaine" }), prod)).toBe("jour");
    expect(gameHref(etat({ cible: "semaine", date: "2026-11-02", generateur: "13" }), prod)).toBe("../?seed=2026-11-02"); // jamais `semaine` ni `generateur`
    expect(cibleDe(etat({ cible: "semaine" }), hors)).toBe("semaine");
  });
  it("hors production ils s'écrivent, et le jeu les lit", () => {
    expect(lire({ solution: true }).solution).toBe(true);
    expect(lire({ cible: "essai", carnageDemo: true }).carnageDemo).toBe(true);
  });
  it("les raccourcis fermés sont marqués", () => {
    for (const p of PRESETS) {
      const q = buildQuery({ ...DEFAULT_ADMIN, ...p.state }, hors);
      const ferme = /(^|&)(carnage|semaine|solution|generateur)=?/.test(q);
      expect(Boolean(p.ferme), p.label).toBe(ferme);
    }
  });
});

describe("l'état mémorisé", () => {
  it("un texte illisible ou hors liste retombe sur les valeurs par défaut", () => {
    expect(parseAdmin(null)).toEqual(DEFAULT_ADMIN);
    expect(parseAdmin("pas du json")).toEqual(DEFAULT_ADMIN);
    expect(parseAdmin(JSON.stringify({ cible: "autre", theme: "lave", morceau: "inconnu", date: "demain", variante: "x", generateur: "9", ghost: "tous", touch: "2", accueil: "oui" }))).toEqual(DEFAULT_ADMIN);
  });
  it("un état valide est relu tel quel", () => {
    const s = etat({ cible: "morceau", morceau: MORCEAUX[1]![0], variante: "1", theme: "neon", date: "2026-10-20", debug: true, ghost: "off", api: "demo" });
    expect(parseAdmin(JSON.stringify(s))).toEqual(s);
  });
  it("les clés effaçables sont celles du jeu, jamais les choix de la page ni celles de Track", () => {
    expect(gameKeys(["jump:meilleur:x", "jump:admin", "cdj:player", "autre", "jump:settings"])).toEqual(["jump:meilleur:x", "jump:settings"]);
  });
});
