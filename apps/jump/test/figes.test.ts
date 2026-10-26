import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, PLATFORM_GENERATOR, PLATFORM_VERSION, PREMIER_JOUR_JUMP, SECTION_CLOCK_GENERATOR, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, decodeReplay, replayAttempt, type JumpReplay } from "@cdj/jump-sim";
import { thawLevel } from "../src/frozen";

// Lot 11 : **les jours figés ne changent jamais**. Une mécanique s'ajoute (tapis, glace), le générateur passe en g6, mais chaque fichier de
// `public/levels/` doit toujours se recharger (`thawLevel` : forme, date, versions, identifiant, empreinte, médailles) et **se rejouer** (la
// preuve de l'auteur, arrivée sans mort au temps annoncé) avec le code d'aujourd'hui.
// Lot 15 : le code joue la version 3 **et** la version 4 ; un jour figé garde la sienne (v3 jusqu'au 22/10/2026, g4 à g9 ; v4 avec g10 et après).

const DIR = join(import.meta.dirname, "../public/levels");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

describe("niveaux figés (public/levels)", () => {
  it("il y en a au moins un, un par date depuis le premier jour, sans trou", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
    FILES.forEach((f, k) => expect(parseDay(f.replace(".json", "")), f).toBe(PREMIER_JOUR_JUMP + k));
  });

  for (const file of FILES) {
    it(`${file} : se recharge et se rejoue avec le code actuel (qui joue les physiques v${SECTION_CLOCK_VERSION} à v${JUMP_SIM_VERSION}), sans toucher au fichier`, () => {
      const raw = JSON.parse(readFileSync(join(DIR, file), "utf8")) as { generatorVersion: number; simVersion: number };
      const day = parseDay(file.replace(".json", ""))!;
      const level = thawLevel(raw, day);
      expect(typeof level, `${file} : ${String(level)}`).not.toBe("string");
      if (typeof level === "string") return;
      // Figé sous une version du générateur d'avant (ou la même), jamais d'après ; la physique est celle du niveau (lot 15), que le code joue.
      expect(raw.simVersion).toBe(level.level.simVersion);
      // v3 jusqu'à g9, v4 de g10 à g14 (une seule horloge), v5 depuis g15 (plateformes mobiles, lot 20).
      expect(raw.simVersion).toBe(raw.generatorVersion >= PLATFORM_GENERATOR ? PLATFORM_VERSION : raw.generatorVersion > SECTION_CLOCK_GENERATOR ? SINGLE_CLOCK_VERSION : SECTION_CLOCK_VERSION);
      expect(raw.simVersion).toBeLessThanOrEqual(JUMP_SIM_VERSION);
      expect(raw.generatorVersion).toBeLessThanOrEqual(JUMP_GENERATOR_VERSION);
      // Un niveau figé est celui de son thème naturel, jamais un essai.
      expect(level.forcedTheme).toBe(false);
      expect(level.id).toBe(`jour-${level.date}-g${raw.generatorVersion}`);
      // La preuve, rejouée à part : arrivée sans mort, au temps de l'auteur.
      const replay: JumpReplay = decodeReplay(level.code);
      const r = replayAttempt(level.level, replay, level.id);
      expect(r.finished).toBe(true);
      expect(r.deaths).toHaveLength(0);
      expect(r.time).toBe(level.authorTicks);
    });
  }
});
