import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PREMIER_JOUR_TEXTE, premierJourDuJour } from "@cdj/core/lancement";
import { circuitNumber, parseDay } from "@cdj/sim";
import { levelNumber } from "@cdj/jump-sim";
import { PREMIER_JOUR_DU_JOUR, cartes, numeroDeJournee } from "../src/jours";

// Lot R4 : le portail recopie les deux premiers jours (il n'importe aucun jeu) ; ses numéros doivent être ceux des jeux, jour après jour.
describe("portail : numéro du jour de chaque jeu", () => {
  it("le même que DailyTrack (`circuitNumber`) et DailyJump (`levelNumber`), sur deux ans", () => {
    const start = parseDay("2026-10-01")!;
    for (let day = start; day < start + 730; day++) {
      const [track, jump] = cartes(day);
      expect(track!.numero, String(day)).toBe(circuitNumber(day));
      expect(jump!.numero, String(day)).toBe(levelNumber(day));
    }
  });

  it("une cartouche par jeu, avec son lien relatif (lot I1 : les textes viennent des catalogues)", () => {
    const [track, jump] = cartes(parseDay("2026-10-20")!);
    expect(track).toEqual({ code: "track", jeu: "cdj", lien: "track/", numero: 8 });
    expect(jump).toEqual({ code: "jump", jeu: "jump", lien: "jump/", numero: 5 });
    expect(cartes(parseDay("2026-10-01")!)[0]!.numero).toBeLessThanOrEqual(0);
  });
});

// Lot I3 : la journée commune (« Du Jour #1 » = le jour de config/lancement.json, lot R8) — la même constante que le serveur, le même numéro jour après jour.
describe("portail : numéro de journée commun", () => {
  it("la même constante et le même numéro que le serveur ; rien avant la journée n° 1 (config/lancement.json, lot R8)", async () => {
    const { PREMIER_JOUR_DU_JOUR: serveur, numeroDeJournee: numeroServeur } = await import("../../api/src/portail");
    expect(PREMIER_JOUR_DU_JOUR).toBe(serveur);
    expect(PREMIER_JOUR_DU_JOUR).toBe(parseDay(PREMIER_JOUR_TEXTE)!);
    const start = parseDay("2026-10-01")!;
    for (let day = start; day < start + 730; day++) expect(numeroDeJournee(day), String(day)).toBe(numeroServeur(day));
    expect(numeroDeJournee(PREMIER_JOUR_DU_JOUR - 1)).toBeNull();
    expect(numeroDeJournee(PREMIER_JOUR_DU_JOUR)).toBe(1);
    expect(numeroDeJournee(PREMIER_JOUR_DU_JOUR + 1)).toBe(2);
  });
});

// Lot R8 : une seule source pour la date du lancement (`config/lancement.json`), lue par le serveur, le portail et les deux jeux.
describe("date du lancement : une seule source", () => {
  it("le fichier est une date valide, posée par le lot R8 (le lundi 26/10/2026) ; la surcharge ne vaut que si elle est une date", () => {
    expect(PREMIER_JOUR_TEXTE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseDay(PREMIER_JOUR_TEXTE)).not.toBeNull();
    expect(PREMIER_JOUR_TEXTE).toBe("2026-10-26");
    expect(premierJourDuJour("2026-11-02")).toBe(parseDay("2026-11-02")!);
    expect(premierJourDuJour("demain")).toBe(parseDay(PREMIER_JOUR_TEXTE)!); // illisible : ignorée
    expect(premierJourDuJour("")).toBe(parseDay(PREMIER_JOUR_TEXTE)!);
    expect(premierJourDuJour(undefined)).toBe(parseDay(PREMIER_JOUR_TEXTE)!);
    expect(premierJourDuJour("2026-02-30")).toBe(parseDay(PREMIER_JOUR_TEXTE)!);
  });

  it("aucune autre copie de la date : ni le portail, ni le serveur, ni un jeu ne l'écrivent en dur", () => {
    const racine = new URL("../../..", import.meta.url).pathname;
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) return ["node_modules", "dist", "public"].includes(f) ? [] : sources(p);
        return /\.ts$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
      });
    const fautes: string[] = [];
    for (const dir of ["apps/api/src", "apps/portail/src", "apps/web/src", "apps/jump/src", "packages/profile/src", "packages/core/src"]) {
      for (const f of sources(join(racine, dir))) {
        const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
        if (/daysFromCivil\(\s*2026\s*,\s*10\s*,\s*(23|26)\s*\)|["']2026-10-(23|26)["']/.test(code)) fautes.push(f.slice(racine.length));
      }
    }
    expect(fautes).toEqual([]);
  });
});
