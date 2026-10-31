import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseDay } from "@cdj/core";
import { beforeAll, describe, expect, it } from "vitest";
import { jsonJourFige, lireJour, PLAFOND_DIAMANT_MM, type Rapier, rejouer } from "../src";
import { verifierJourPrepare } from "../src/bot";
import { chargerRapier } from "../src/rapier";
import { cheminDuJour, ecrire, planifier } from "../tools/plan";

// Lot T3 — la préparation des jours (`npm run preparer:tower`, tools/preparer.ts) : ce que l'outil décide de chaque jour (calculer, garder, refuser) et le garde-fou d'un fichier préparé. Le calcul du
// bot lui-même (une minute par jour) n'est pas rejoué ici : quatre jours déjà préparés par l'outil sont dans test/fixtures/jours/, la preuve s'y rejoue — deux du lot T3 (générateur 2, Diamant
// sans plafond : 06 et 08/11, ils restent valides) et deux du lot T3b (générateur 3 : le 07/11 dont le bot finit à 65,9 m, donc Diamant plafonné à 60 m ; le 17/11, tirage 1).
const FIXTURES = new URL("./fixtures/jours/", import.meta.url).pathname;
const J6 = parseDay("2026-11-06")!;
const J7 = parseDay("2026-11-07")!;
const J8 = parseDay("2026-11-08")!;
const J17 = parseDay("2026-11-17")!;
const lire = (j: string): Record<string, unknown> => JSON.parse(readFileSync(`${FIXTURES}${j}.json`, "utf8")) as Record<string, unknown>;
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const dossierAvec = (...jours: string[]): string => {
  const d = mkdtempSync(`${tmpdir()}/tower-jours-`);
  for (const j of jours) copyFileSync(`${FIXTURES}${j}.json`, `${d}/${j}.json`);
  return d;
};

describe("un jour préparé : format et garde-fou", () => {
  it("a ses médailles (le Diamant est la clé `auteur`) et la preuve de l'auteur", () => {
    for (const [j, g] of [["2026-11-06", 2], ["2026-11-07", 3], ["2026-11-08", 2], ["2026-11-17", 3]] as const) {
      const lu = lireJour(JSON.parse(readFileSync(`${FIXTURES}${j}.json`, "utf8")) as unknown, parseDay(j)!);
      expect(typeof lu).toBe("object");
      if (typeof lu === "string") continue;
      expect(lu.medailles).not.toBeNull();
      expect(Object.keys(lu.medailles!)).toEqual(["auteur", "or", "argent", "bronze"]);
      expect(lu.preuve).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(lu.contenu.g).toBe(g);
    }
  });

  it("la preuve rejouée donne exactement le Diamant écrit (générateur 2 : sa hauteur ; générateur 3 : min(sa hauteur, plafond))", () => {
    for (const [j, jour] of [["2026-11-06", J6], ["2026-11-08", J8], ["2026-11-07", J7], ["2026-11-17", J17]] as const) expect(verifierJourPrepare(R, lire(j), jour), j).toBeNull();
  });

  it("lot T3b — le garde-fou étendu : la preuve du 07/11 finit au-dessus du plafond, le Diamant écrit vaut min(sa hauteur, 60 m) ; ni la hauteur brute ni autre chose n'est accepté", () => {
    const f = lire("2026-11-07");
    const lu = lireJour(f, J7);
    expect(typeof lu).toBe("object");
    if (typeof lu === "string") return;
    const hauteur = rejouer(R, lu.contenu, lu.preuve!).hauteurMm;
    expect(hauteur).toBeGreaterThan(PLAFOND_DIAMANT_MM); // la preuve reste la vraie partie du bot (65,9 m)
    expect((f.medailles as { auteur: number }).auteur).toBe(PLAFOND_DIAMANT_MM);
    expect(verifierJourPrepare(R, f, J7)).toBeNull();
    for (const mauvais of [hauteur, PLAFOND_DIAMANT_MM - 1, PLAFOND_DIAMANT_MM + 1]) {
      const g = lire("2026-11-07");
      (g.medailles as { auteur: number }).auteur = mauvais;
      expect(verifierJourPrepare(R, g, J7), String(mauvais)).toMatch(/preuve rejouée donne/);
    }
    // Un jour du générateur 2 n'a pas de plafond : son Diamant est exactement la hauteur de la preuve.
    const v2 = lireJour(lire("2026-11-06"), J6);
    if (typeof v2 !== "string") expect(rejouer(R, v2.contenu, v2.preuve!).hauteurMm).toBe(v2.medailles!.auteur);
  });

  it("lot T3b — le tirage est lu dans le fichier : le 17/11 est au tirage 1, son contenu et sa preuve sont ceux de ce tirage ; un autre tirage dans le fichier est refusé", () => {
    const f = lire("2026-11-17");
    expect(f.tirage).toBe(1);
    const lu = lireJour(f, J17);
    expect(typeof lu).toBe("object");
    if (typeof lu === "string") return;
    expect(lu.contenu.tirage).toBe(1);
    expect(lu.medailles!.auteur).toBeGreaterThanOrEqual(25_000); // le tirage 0 de ce jour ne faisait que 21,8 m : écarté par la préparation
    for (const autre of [0, 2, 3]) {
      const g = lire("2026-11-17");
      g.tirage = autre;
      expect(verifierJourPrepare(R, g, J17), `tirage ${autre}`).not.toBeNull(); // le contenu régénéré n'est pas celui de la preuve : identique / contenu_different
    }
  });

  it("le garde-fou refuse un Diamant qui n'est pas celui de la preuve, une preuve absente, des médailles absentes, un autre jour, une autre version", () => {
    const f = (): Record<string, unknown> => lire("2026-11-06");
    const faux = f();
    (faux.medailles as { auteur: number }).auteur += 1;
    expect(verifierJourPrepare(R, faux, J6)).toMatch(/preuve rejouée donne/);
    const sansPreuve = f();
    delete sansPreuve.preuve;
    expect(verifierJourPrepare(R, sansPreuve, J6)).toMatch(/pas de preuve/);
    const sansMedailles = f();
    sansMedailles.medailles = null;
    expect(verifierJourPrepare(R, sansMedailles, J6)).toMatch(/pas de médailles/);
    expect(verifierJourPrepare(R, f(), J8)).toMatch(/date/);
    const autreG = f();
    autreG.g = 1;
    expect(verifierJourPrepare(R, autreG, J6)).not.toBeNull();
    const abime = f();
    abime.preuve = (abime.preuve as string).slice(0, 40);
    expect(verifierJourPrepare(R, abime, J6)).toMatch(/ne se rejoue pas|preuve/);
    const contenuChange = f();
    (contenuChange.contenu as { pieces: string }).pieces = (contenuChange.contenu as { pieces: string }).pieces.split("").reverse().join("");
    expect(verifierJourPrepare(R, contenuChange, J6)).toMatch(/identique/);
  });

  it("la relecture refuse des médailles dans le désordre ou non entières, et une preuve qui n'est pas du texte base64url", () => {
    const f = (): Record<string, unknown> => lire("2026-11-06");
    const desordre = f();
    desordre.medailles = { auteur: 10_000, or: 20_000, argent: 5_000, bronze: 1_000 };
    expect(lireJour(desordre, J6)).toMatch(/désordre/);
    const flottant = f();
    flottant.medailles = { auteur: 10_000.5, or: 9_000, argent: 7_500, bronze: 5_500 };
    expect(lireJour(flottant, J6)).toMatch(/médailles/);
    const mauvaise = f();
    mauvaise.preuve = "pas du texte !";
    expect(lireJour(mauvaise, J6)).toMatch(/preuve/);
  });
});

describe("l'outil décide, jour par jour : calculer, garder ou refuser", () => {
  it("un jour sans fichier est à calculer ; un fichier préparé et vérifié est gardé, jamais réécrit", () => {
    const d = dossierAvec("2026-11-07");
    expect(planifier(R, d, J7, J7 + 2, false).map((x) => x.action)).toEqual(["garder", "calculer", "calculer"]);
    const avant = readFileSync(cheminDuJour(d, J7), "utf8");
    planifier(R, d, J7, J7, false);
    expect(readFileSync(cheminDuJour(d, J7), "utf8")).toBe(avant);
  });

  it("--forcer recalcule un fichier de la bonne version, mais refuse TOUJOURS un fichier d'une autre version du générateur (les jours du lot T3, g2, restent valides mais ne se recalculent pas)", () => {
    const d = dossierAvec("2026-11-07", "2026-11-08");
    expect(planifier(R, d, J7, J7, true)[0]!.action).toBe("calculer");
    for (const forcer of [false, true]) {
      const [x] = planifier(R, d, J8, J8, forcer); // le fichier du 08/11 est en g2
      expect(x!.action).toBe("refuser");
      expect(x!.motif).toMatch(/g2.*g3.*refusé/);
    }
    const ancien = JSON.parse(readFileSync(cheminDuJour(d, J7), "utf8")) as { g: number };
    ancien.g = 1;
    writeFileSync(cheminDuJour(d, J7), JSON.stringify(ancien));
    for (const forcer of [false, true]) expect(planifier(R, d, J7, J7, forcer)[0]!.motif).toMatch(/g1.*g3.*refusé/);
  });

  it("refuse un fichier préparé qui ne passe plus le garde-fou, et un fichier qui n'est pas du JSON", () => {
    const d = dossierAvec("2026-11-17");
    const f = JSON.parse(readFileSync(cheminDuJour(d, J17), "utf8")) as { medailles: { auteur: number } };
    f.medailles.auteur += 7;
    writeFileSync(cheminDuJour(d, J17), JSON.stringify(f));
    expect(planifier(R, d, J17, J17, false)[0]).toMatchObject({ action: "refuser", motif: expect.stringMatching(/preuve rejouée/) });
    writeFileSync(cheminDuJour(d, J17), "pas du json");
    expect(planifier(R, d, J17, J17, false)[0]).toMatchObject({ action: "refuser", motif: expect.stringMatching(/JSON/) });
  });

  it("écrire crée le dossier et le fichier, au texte canonique", () => {
    const d = `${mkdtempSync(`${tmpdir()}/tower-jours-`)}/sous/dossier`;
    const texte = readFileSync(`${FIXTURES}2026-11-17.json`, "utf8");
    ecrire(d, J17, texte);
    expect(existsSync(cheminDuJour(d, J17))).toBe(true);
    expect(readFileSync(cheminDuJour(d, J17), "utf8")).toBe(texte);
    const lu = lireJour(JSON.parse(texte) as unknown, J17);
    if (typeof lu !== "string") expect(jsonJourFige({ format: 1, jeu: "tower", date: "2026-11-17", g: lu.contenu.g, tirage: lu.contenu.tirage, sim: 3, contenu: { pieces: lu.contenu.pieces.join(""), plateformeDemi8: lu.contenu.plateformeDemi8, paliers: [...lu.contenu.paliers], ventSens: lu.contenu.ventSens, theme: lu.contenu.theme }, medailles: lu.medailles, preuve: lu.preuve! })).toBe(texte);
    mkdirSync(d, { recursive: true });
  });
});
