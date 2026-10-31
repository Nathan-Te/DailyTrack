import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseDay } from "@cdj/core";
import { beforeAll, describe, expect, it } from "vitest";
import { jsonJourFige, lireJour, type Rapier, TOWER_GENERATOR_VERSION } from "../src";
import { verifierJourPrepare } from "../src/bot";
import { chargerRapier } from "../src/rapier";
import { cheminDuJour, ecrire, planifier } from "../tools/plan";

// Lot T3 — la préparation des jours (`npm run preparer:tower`, tools/preparer.ts) : ce que l'outil décide de chaque jour (calculer, garder, refuser) et le garde-fou d'un fichier préparé. Le calcul du
// bot lui-même (une minute par jour) n'est pas rejoué ici : deux jours déjà préparés par l'outil sont dans test/fixtures/jours/, la preuve s'y rejoue.
const FIXTURES = new URL("./fixtures/jours/", import.meta.url).pathname;
const J6 = parseDay("2026-11-06")!;
const J8 = parseDay("2026-11-08")!;
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
    for (const j of ["2026-11-06", "2026-11-08"]) {
      const lu = lireJour(JSON.parse(readFileSync(`${FIXTURES}${j}.json`, "utf8")) as unknown, parseDay(j)!);
      expect(typeof lu).toBe("object");
      if (typeof lu === "string") continue;
      expect(lu.medailles).not.toBeNull();
      expect(Object.keys(lu.medailles!)).toEqual(["auteur", "or", "argent", "bronze"]);
      expect(lu.preuve).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(lu.contenu.g).toBe(TOWER_GENERATOR_VERSION);
    }
  });

  it("la preuve rejouée donne exactement le Diamant écrit", () => {
    expect(verifierJourPrepare(R, JSON.parse(readFileSync(`${FIXTURES}2026-11-06.json`, "utf8")) as unknown, J6)).toBeNull();
    expect(verifierJourPrepare(R, JSON.parse(readFileSync(`${FIXTURES}2026-11-08.json`, "utf8")) as unknown, J8)).toBeNull();
  });

  it("le garde-fou refuse un Diamant qui n'est pas celui de la preuve, une preuve absente, des médailles absentes, un autre jour, une autre version", () => {
    const f = (): Record<string, unknown> => JSON.parse(readFileSync(`${FIXTURES}2026-11-06.json`, "utf8")) as Record<string, unknown>;
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
    const f = (): Record<string, unknown> => JSON.parse(readFileSync(`${FIXTURES}2026-11-06.json`, "utf8")) as Record<string, unknown>;
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
    const d = dossierAvec("2026-11-06");
    expect(planifier(R, d, J6, J6 + 2, false).map((x) => x.action)).toEqual(["garder", "calculer", "calculer"]);
    const avant = readFileSync(cheminDuJour(d, J6), "utf8");
    planifier(R, d, J6, J6, false);
    expect(readFileSync(cheminDuJour(d, J6), "utf8")).toBe(avant);
  });

  it("--forcer recalcule un fichier de la bonne version, mais refuse TOUJOURS un fichier d'une autre version du générateur", () => {
    const d = dossierAvec("2026-11-06", "2026-11-08");
    expect(planifier(R, d, J6, J6, true)[0]!.action).toBe("calculer");
    const ancien = JSON.parse(readFileSync(cheminDuJour(d, J8), "utf8")) as { g: number };
    ancien.g = 1;
    writeFileSync(cheminDuJour(d, J8), JSON.stringify(ancien));
    for (const forcer of [false, true]) {
      const [x] = planifier(R, d, J8, J8, forcer);
      expect(x!.action).toBe("refuser");
      expect(x!.motif).toMatch(/g1.*g2.*refusé/);
    }
  });

  it("refuse un fichier préparé qui ne passe plus le garde-fou, et un fichier qui n'est pas du JSON", () => {
    const d = dossierAvec("2026-11-06");
    const f = JSON.parse(readFileSync(cheminDuJour(d, J6), "utf8")) as { medailles: { auteur: number } };
    f.medailles.auteur += 7;
    writeFileSync(cheminDuJour(d, J6), JSON.stringify(f));
    expect(planifier(R, d, J6, J6, false)[0]).toMatchObject({ action: "refuser", motif: expect.stringMatching(/preuve rejouée/) });
    writeFileSync(cheminDuJour(d, J6), "pas du json");
    expect(planifier(R, d, J6, J6, false)[0]).toMatchObject({ action: "refuser", motif: expect.stringMatching(/JSON/) });
  });

  it("écrire crée le dossier et le fichier, au texte canonique", () => {
    const d = `${mkdtempSync(`${tmpdir()}/tower-jours-`)}/sous/dossier`;
    const texte = readFileSync(`${FIXTURES}2026-11-06.json`, "utf8");
    ecrire(d, J6, texte);
    expect(existsSync(cheminDuJour(d, J6))).toBe(true);
    expect(readFileSync(cheminDuJour(d, J6), "utf8")).toBe(texte);
    const lu = lireJour(JSON.parse(texte) as unknown, J6);
    if (typeof lu !== "string") expect(jsonJourFige({ format: 1, jeu: "tower", date: "2026-11-06", g: lu.contenu.g, sim: 3, contenu: { pieces: lu.contenu.pieces.join(""), plateformeDemi8: lu.contenu.plateformeDemi8, paliers: [...lu.contenu.paliers], ventSens: lu.contenu.ventSens, theme: lu.contenu.theme }, medailles: lu.medailles, preuve: lu.preuve! })).toBe(texte);
    mkdirSync(d, { recursive: true });
  });
});
