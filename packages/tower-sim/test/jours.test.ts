import { existsSync, readdirSync, readFileSync } from "node:fs";
import { formatDay, parseDay } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { dailyTower, empreinteContenu, figerJour, FORMAT_JOUR_FIGE, type JourFige, jsonJourFige, lireJourFige, TOWER_GENERATOR_VERSION, TOWER_SIM_VERSION } from "../src";

// Lot T2 — les jours figés : le format d'un fichier, sa relecture (rien n'est cru sur parole) et le garde-fou — chaque fichier figé présent dans le dépôt se régénère à l'identique
// avec sa version `g`. L'écriture (`npm run figer:tower`) est tools/figer.ts ; le branchement à « Mettre en production » est un lot de plateforme (T4).
const DOSSIER = new URL("../../../apps/tower/public/jours/", import.meta.url).pathname;
const JOUR = parseDay("2026-11-02")!;
const clone = (f: JourFige): JourFige => JSON.parse(jsonJourFige(f)) as JourFige;

describe("le format d'un jour figé", () => {
  it("garde le format, g, sim, le contenu du jour et un champ medailles à null (le lot T3 le remplira)", () => {
    const f = figerJour(JOUR);
    expect(f).toMatchObject({ format: FORMAT_JOUR_FIGE, jeu: "tower", date: "2026-11-02", g: TOWER_GENERATOR_VERSION, sim: TOWER_SIM_VERSION, medailles: null });
    expect(f.contenu.pieces).toHaveLength(40);
    expect(f.contenu.paliers).toHaveLength(6);
    expect(Object.keys(f)).toEqual(["format", "jeu", "date", "g", "sim", "contenu", "medailles"]);
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
    refuse((f) => (f.sim = TOWER_SIM_VERSION - 1), /simulation/);
  });
  it("contenu : suite, plateforme, vent, thème, paliers", () => {
    refuse((f) => (f.contenu.pieces = ""), /pièces/);
    refuse((f) => (f.contenu.pieces = "OLJSITX"), /pièces/);
    refuse((f) => (f.contenu.plateformeDemi8 = 3), /plateforme/);
    refuse((f) => (f.contenu.plateformeDemi8 = 24.5), /plateforme/);
    refuse((f) => ((f.contenu as unknown as { ventSens: number }).ventSens = 0), /vent/);
    refuse((f) => ((f.contenu as unknown as { theme: string }).theme = "nuit"), /thème/);
    refuse((f) => ((f.contenu as unknown as { paliers: unknown }).paliers = [{ metres: 10, effet: "pluie" }]), /paliers/);
    refuse((f) => ((f.contenu as unknown as { paliers: unknown }).paliers = "x"), /paliers/);
    refuse((f) => ((f as unknown as { contenu: unknown }).contenu = undefined), /contenu/);
  });
});

describe("le garde-fou : chaque fichier figé présent se régénère à l'identique avec sa version g", () => {
  const fichiers = existsSync(DOSSIER) ? readdirSync(DOSSIER).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : [];
  it(`les ${fichiers.length} fichier(s) de apps/tower/public/jours/ se relisent et se régénèrent`, () => {
    for (const nom of fichiers) {
      const date = nom.slice(0, 10);
      const jour = parseDay(date)!;
      const brut = readFileSync(DOSSIER + nom, "utf8");
      const lu = lireJourFige(JSON.parse(brut) as unknown, jour);
      expect(typeof lu, `${nom} : ${String(lu)}`).toBe("object");
      if (typeof lu === "string") continue;
      expect(formatDay(lu.jour)).toBe(date);
      expect(empreinteContenu(lu), `${nom} ne se régénère plus à l'identique avec g${lu.g} : un jour figé ne change jamais`).toBe(empreinteContenu(dailyTower(jour, lu.g)));
      expect(brut, `${nom} n'est pas le texte canonique`).toBe(jsonJourFige(figerJour(jour, lu.g)));
    }
  });

  it("le garde-fou voit un fichier modifié à la main", () => {
    const f = clone(figerJour(JOUR));
    f.contenu.pieces = f.contenu.pieces.slice(1) + f.contenu.pieces[0];
    const lu = lireJourFige(f, JOUR);
    expect(typeof lu).toBe("object");
    if (typeof lu !== "string") expect(empreinteContenu(lu)).not.toBe(empreinteContenu(dailyTower(JOUR, lu.g)));
  });
});
