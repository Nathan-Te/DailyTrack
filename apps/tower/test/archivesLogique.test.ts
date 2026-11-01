import { readFileSync } from "node:fs";
import { join } from "node:path";
import { daysFromCivil, formatDay } from "@cdj/core";
import { PREMIER_JOUR_TOWER, numeroTower } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import type { JourMoiTower } from "../src/apiTower";
import { JOURS_ARCHIVES, archiveHref, joursDArchives, ligneArchive } from "../src/archivesLogique";
import { adresseAccueil, estArchive } from "../src/jourPasse";
import { peutClasser } from "../src/envoi";
import type { Records } from "../src/records";

// Lot T7 : les archives de Tower — les jours passés depuis le premier jour (30 au plus) avec ta meilleure hauteur et ta médaille, et un jour passé joué n'est JAMAIS classé.
const J = (d: number): number => daysFromCivil(2026, 11, d);
const rec = (h: number, medaille: "bronze" | "or" | null = null) => ({ hauteurMm: h, vies: 3, ticks: 5000, medaille, rediffusion: "AAAA", envoye: true });
const loin = (date: string, h: number, medal: JourMoiTower["medal"] = null): JourMoiTower => ({ date, hauteurMm: h, vies: 3, ticks: 5000, medal });

describe("les jours à lister", () => {
  it("de la veille d'aujourd'hui au premier jour de Tower, du plus récent au plus ancien", () => {
    expect(joursDArchives(J(6)).map(formatDay)).toEqual(["2026-11-05", "2026-11-04", "2026-11-03", "2026-11-02"]);
    expect(joursDArchives(J(6))[3]).toBe(PREMIER_JOUR_TOWER);
  });

  it("avant ou le jour même du premier jour : aucune archive", () => {
    expect(joursDArchives(PREMIER_JOUR_TOWER)).toEqual([]);
    expect(joursDArchives(PREMIER_JOUR_TOWER - 20)).toEqual([]);
  });

  it(`au plus les ${JOURS_ARCHIVES} derniers jours`, () => {
    const premier = J(2);
    const liste = joursDArchives(J(2) + 100, premier);
    expect(liste).toHaveLength(JOURS_ARCHIVES);
    expect(liste[0]).toBe(J(2) + 99);
    expect(liste[JOURS_ARCHIVES - 1]).toBe(J(2) + 100 - JOURS_ARCHIVES);
  });
});

describe("une ligne d'archive", () => {
  it("pas jouée : sans hauteur ni médaille, avec le numéro de la tour", () => {
    expect(ligneArchive(J(3), {}, new Map())).toEqual({ date: "2026-11-03", numero: numeroTower(J(3)), hauteurMm: null, medaille: null });
  });

  it("jouée dans ce navigateur : la meilleure hauteur et sa médaille", () => {
    const records: Records = { "2026-11-03": rec(31_250, "bronze") };
    expect(ligneArchive(J(3), records, new Map())).toMatchObject({ hauteurMm: 31_250, medaille: "bronze" });
  });

  it("connue du serveur : sa médaille (code de la plateforme) ; la meilleure des deux l'emporte, le serveur à égalité", () => {
    const serveur = new Map([["2026-11-03", loin("2026-11-03", 40_000, "gold")]]);
    expect(ligneArchive(J(3), {}, serveur)).toMatchObject({ hauteurMm: 40_000, medaille: "or" });
    expect(ligneArchive(J(3), { "2026-11-03": rec(45_000, "or") }, serveur)).toMatchObject({ hauteurMm: 45_000 });
    expect(ligneArchive(J(3), { "2026-11-03": rec(40_000, "bronze") }, serveur)).toMatchObject({ hauteurMm: 40_000, medaille: "or" });
  });
});

describe("ouvrir un jour passé le joue en archive : jamais classé", () => {
  it("l'adresse garde les paramètres d'essai utiles et remplace la date (jamais un scénario)", () => {
    expect(archiveHref("", "2026-11-03")).toBe("?seed=2026-11-03");
    expect(archiveHref("?seed=2026-11-05&api=%2F&tactile=1", "2026-11-03")).toBe("?seed=2026-11-03&api=%2F&tactile=1");
    expect(archiveHref("?scenario=essai", "2026-11-03")).toBe("?seed=2026-11-03");
  });

  it("une tour passée est une archive ; aujourd'hui, le futur et un scénario d'essai non", () => {
    expect(estArchive(J(3), J(6))).toBe(true);
    expect(estArchive(J(6), J(6))).toBe(false);
    expect(estArchive(J(9), J(6))).toBe(false);
    expect(estArchive(null, J(6))).toBe(false);
  });

  it("une partie d'archive ne peut jamais être classée (la règle du jeu : seul le jour d'aujourd'hui, joué normalement)", () => {
    const base = { scenario: "jour" as const, aujourdhui: J(6), bot: false, reglagesModifies: false, tireForce: false };
    expect(peutClasser({ ...base, jour: J(6) })).toBe(true);
    expect(peutClasser({ ...base, jour: J(5) })).toBe(false);
  });
});

describe("« Accueil de Tower » : une partie abandonnée n'est jamais envoyée", () => {
  it("l'adresse de l'accueil garde le jour et le serveur, retire les outils d'essai", () => {
    expect(adresseAccueil("/tower/", "")).toBe("/tower/");
    expect(adresseAccueil("/tower/", "?seed=2026-11-05&api=%2F")).toBe("/tower/?seed=2026-11-05&api=%2F");
    expect(adresseAccueil("/tower/", "?scenario=essai&effet=vent&debug")).toBe("/tower/?debug=");
  });

  it("l'abandon ne touche ni l'envoi ni le record : seul `terminer()` (la fin d'une partie) les appelle", () => {
    const source = readFileSync(join(__dirname, "../src/jeu.ts"), "utf8");
    const corps = (nom: string): string => {
      const debut = source.indexOf(`function ${nom}(`);
      expect(debut, nom).toBeGreaterThan(0);
      return source.slice(debut, source.indexOf("\n  }\n", debut));
    };
    const abandon = corps("allerAccueil");
    for (const interdit of ["envoi", "proposerRecord", "terminer", "offrir", "submit", "rediffusion"]) expect(abandon, interdit).not.toContain(interdit);
    // Et seul `terminer` propose un record et lance l'envoi.
    expect(corps("terminer")).toContain("proposerRecord");
    expect(source.match(/proposerRecord\(/g)).toHaveLength(1);
    expect(source.match(/session\.envoi\.offrir\(\)/g)).toHaveLength(1);
  });
});
