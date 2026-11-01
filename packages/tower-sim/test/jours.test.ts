import { existsSync, readdirSync, readFileSync } from "node:fs";
import { formatDay, parseDay } from "@cdj/core";
import { beforeAll, describe, expect, it } from "vitest";
import { dailyTower, empreinteContenu, figerJour, FORMAT_JOUR_FIGE, type JourFige, jsonJourFige, lireJour, lireJourFige, type Rapier, TOWER_GENERATOR_VERSION, TOWER_SIM_VERSION } from "../src";
import { verifierJourPrepare } from "../src/bot";
import { chargerRapier } from "../src/rapier";

// Lot T2 — les jours figés : le format d'un fichier, sa relecture (rien n'est cru sur parole) et le garde-fou — chaque fichier figé présent dans le dépôt se régénère à l'identique
// avec sa version `g`. L'écriture (`npm run figer:tower`) est tools/figer.ts ; le branchement à « Mettre en production » est un lot de plateforme (T4).
const DOSSIER = new URL("../../../apps/tower/public/jours/", import.meta.url).pathname;
const JOUR = parseDay("2026-11-02")!;
const clone = (f: JourFige): JourFige => JSON.parse(jsonJourFige(f)) as JourFige;

describe("le format d'un jour figé", () => {
  it("garde le format, g, le tirage, sim, le contenu du jour et un champ medailles à null (le lot T3 le remplira)", () => {
    const f = figerJour(JOUR);
    expect(f).toMatchObject({ format: FORMAT_JOUR_FIGE, jeu: "tower", date: "2026-11-02", g: TOWER_GENERATOR_VERSION, tirage: 0, sim: TOWER_SIM_VERSION, medailles: null });
    expect(f.contenu.pieces).toHaveLength(40);
    expect(f.contenu.paliers).toHaveLength(6);
    expect(Object.keys(f)).toEqual(["format", "jeu", "date", "g", "tirage", "sim", "contenu", "medailles"]);
  });

  it("lot T3b — les fichiers des générateurs 1 et 2 n'ont pas de champ tirage : leur texte ne change pas", () => {
    for (const g of [1, 2]) {
      const f = figerJour(JOUR, g);
      expect(Object.keys(f)).toEqual(["format", "jeu", "date", "g", "sim", "contenu", "medailles"]);
      expect(jsonJourFige(f)).not.toContain("tirage");
      expect(jsonJourFige(f).startsWith(`{\n  "format": 1,\n  "jeu": "tower",\n  "date": "2026-11-02",\n  "g": ${g},\n  "sim": ${TOWER_SIM_VERSION},\n`)).toBe(true);
      expect(lireJourFige(clone(f), JOUR)).toEqual(dailyTower(JOUR, g));
    }
    expect(() => figerJour(JOUR, 2, 1)).toThrow(/tirage invalide/);
  });

  it("lot T3b — le tirage est lu DANS le fichier (le contenu relu est celui de ce tirage), et un tirage illisible est refusé", () => {
    for (const t of [0, 1, 2, 3]) {
      const f = figerJour(JOUR, 3, t);
      expect(f.tirage).toBe(t);
      const texte = jsonJourFige(f);
      expect(texte).toContain(`"tirage": ${t},`);
      const relu = lireJourFige(JSON.parse(texte) as unknown, JOUR);
      expect(relu).toEqual(dailyTower(JOUR, 3, t));
      expect(empreinteContenu(relu as ReturnType<typeof dailyTower>)).toBe(empreinteContenu(dailyTower(JOUR, 3, t)));
    }
    expect(empreinteContenu(dailyTower(JOUR, 3, 1))).not.toBe(empreinteContenu(dailyTower(JOUR, 3, 0)));
    const modifie = (tirage: unknown): unknown => ({ ...JSON.parse(jsonJourFige(figerJour(JOUR))), tirage });
    for (const mauvais of [4, 99, -1, 1.5, "1", null]) expect(lireJourFige(modifie(mauvais), JOUR), String(mauvais)).toMatch(/tirage/);
    const sans = JSON.parse(jsonJourFige(figerJour(JOUR))) as Record<string, unknown>;
    delete sans.tirage;
    expect(lireJourFige(sans, JOUR)).toMatch(/tirage/); // dès le générateur 3, le fichier nomme son tirage
    const ancien = JSON.parse(jsonJourFige(figerJour(JOUR, 2))) as Record<string, unknown>;
    ancien.tirage = 1;
    expect(lireJourFige(ancien, JOUR)).toEqual(dailyTower(JOUR, 2)); // les générateurs 1 et 2 n'ont pas de tirage : le champ est ignoré (le contenu relu n'en a pas)
  });

  it("le texte est stable, lisible, JSON valide, et se relit en exactement le contenu du générateur", () => {
    for (let j = JOUR; j < JOUR + 30; j++) {
      const texte = jsonJourFige(figerJour(j));
      expect(texte.endsWith("}\n")).toBe(true);
      expect(texte).toBe(jsonJourFige(figerJour(j)));
      const relu = lireJourFige(JSON.parse(texte) as unknown, j);
      expect(relu).toEqual(dailyTower(j));
    }
  });

  it("un fichier figé sous une ancienne version du générateur se régénère avec CETTE version, pas avec la courante", () => {
    const f = figerJour(JOUR, 1);
    const relu = lireJourFige(clone(f), JOUR);
    expect(typeof relu).toBe("object");
    if (typeof relu === "string") return;
    expect(empreinteContenu(relu)).toBe(empreinteContenu(dailyTower(JOUR, f.g)));
  });
});

describe("la relecture refuse ce qui n'est pas un jour de Tower valide", () => {
  const refuse = (modifie: (f: JourFige) => void, motif: RegExp, jour = JOUR): void => {
    const f = clone(figerJour(JOUR));
    modifie(f);
    expect(lireJourFige(f, jour)).toMatch(motif);
  };
  it("format, jeu, date, versions", () => {
    expect(lireJourFige(null, JOUR)).toMatch(/objet/);
    expect(lireJourFige("texte", JOUR)).toMatch(/objet/);
    refuse((f) => (f.format = 2), /format/);
    refuse((f) => ((f as unknown as { jeu: string }).jeu = "dailyjump"), /pas un jour de Tower/);
    refuse(() => undefined, /date/, JOUR + 1); // le fichier d'un autre jour
    refuse((f) => (f.date = "2026-02-30"), /date/);
    refuse((f) => (f.g = 99), /générateur inconnu/);
    refuse((f) => (f.sim = 2), /simulation/);
    refuse((f) => (f.sim = TOWER_SIM_VERSION + 1), /simulation/);
  });
  it("contenu : suite, plateforme, vent, thème, paliers", () => {
    refuse((f) => (f.contenu.pieces = ""), /pièces/);
    refuse((f) => (f.contenu.pieces = "OLJSITX"), /pièces/);
    refuse((f) => (f.contenu.plateformeDemi8 = 3), /plateforme/);
    refuse((f) => (f.contenu.plateformeDemi8 = 24.5), /plateforme/);
    refuse((f) => ((f.contenu as unknown as { ventSens: number }).ventSens = 0), /vent/);
    refuse((f) => ((f.contenu as unknown as { theme: string }).theme = "volcan"), /thème/);
    refuse((f) => ((f.contenu as unknown as { paliers: unknown }).paliers = [{ metres: 10, effet: "pluie" }]), /paliers/);
    refuse((f) => ((f.contenu as unknown as { paliers: unknown }).paliers = "x"), /paliers/);
    refuse((f) => ((f as unknown as { contenu: unknown }).contenu = undefined), /contenu/);
  });
});

// Lot T3 : le garde-fou couvre aussi les jours PRÉPARÉS (médailles et preuve) — ceux de apps/tower/public/jours/ (aucun commité au lot T3) et deux de test/fixtures/jours/ (préparés par
// `npm run preparer:tower`). Chaque fichier se relit, se régénère à l'identique avec sa version g, et SA PREUVE REJOUÉE DONNE EXACTEMENT LE DIAMANT ÉCRIT.
const FIXTURES = new URL("./fixtures/jours/", import.meta.url).pathname;
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

describe("le garde-fou : chaque fichier figé ou préparé présent se régénère à l'identique avec sa version g, et sa preuve redonne son Diamant", () => {
  for (const dossier of [DOSSIER, FIXTURES]) {
    const fichiers = existsSync(dossier) ? readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : [];
    it(`les ${fichiers.length} fichier(s) de ${dossier.includes("fixtures") ? "test/fixtures/jours/" : "apps/tower/public/jours/"} se relisent et se régénèrent`, () => {
      for (const nom of fichiers) {
        const date = nom.slice(0, 10);
        const jour = parseDay(date)!;
        const brut = readFileSync(dossier + nom, "utf8");
        const lu = lireJour(JSON.parse(brut) as unknown, jour);
        expect(typeof lu, `${nom} : ${String(lu)}`).toBe("object");
        if (typeof lu === "string") continue;
        expect(formatDay(lu.contenu.jour)).toBe(date);
        const tirage = lu.contenu.tirage ?? 0;
        expect(empreinteContenu(lu.contenu), `${nom} ne se régénère plus à l'identique avec g${lu.contenu.g} : un jour figé ne change jamais`).toBe(empreinteContenu(dailyTower(jour, lu.contenu.g, tirage)));
        const sim = (JSON.parse(brut) as { sim: number }).sim; // lot T6 : un jour figé sous la simulation 3 reste valide (sa preuve se rejoue en version 3)
        expect(brut, `${nom} n'est pas le texte canonique`).toBe(jsonJourFige({ ...figerJour(jour, lu.contenu.g, tirage, sim), medailles: lu.medailles, ...(lu.preuve === null ? {} : { preuve: lu.preuve }) }));
        if (lu.preuve !== null) expect(verifierJourPrepare(R, JSON.parse(brut) as unknown, jour), nom).toBeNull();
      }
    });
  }

  it("le garde-fou voit un fichier modifié à la main", () => {
    const f = clone(figerJour(JOUR));
    f.contenu.pieces = f.contenu.pieces.slice(1) + f.contenu.pieces[0];
    const lu = lireJourFige(f, JOUR);
    expect(typeof lu).toBe("object");
    if (typeof lu !== "string") expect(empreinteContenu(lu)).not.toBe(empreinteContenu(dailyTower(JOUR, lu.g, lu.tirage ?? 0)));
  });
});
