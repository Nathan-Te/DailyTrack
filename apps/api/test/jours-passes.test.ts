import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { generatorVersionOf, type RegistreJoursTrack } from "@cdj/sim";
import { empreinteJump, empreinteTrack } from "../scripts/empreintes";

// Lot R6 (le garde-fou des jours) : **un jour passé ne change jamais**. `jours-passes.json` garde, pour chaque jour de la journée n° 1 jusqu'à la veille du jour de bascule
// de la dernière mise en production, l'empreinte de ce que chaque jeu a servi ce jour-là (`scripts/empreintes.ts`). Elle est ajoutée par « Mettre en production » (la PR
// « robot » des jours figés), avec le code qui était alors en production : ce test fait échouer **dès la PR** un changement de générateur, de physique ou de thème qui
// modifierait un jour déjà joué — avant, seule la mise en production le voyait. Un lot qui change le générateur pour la suite monte sa version (`GENERATOR_VERSION`, Track ;
// `JUMP_GENERATOR_VERSION`, Jump) : c'est la mise en production qui décide du premier jour concerné (le jour de bascule) et qui fige les jours d'avant (lot R11).
// Lot R11 (décision de Nathan) : seuls les jours **protégés** y sont (d’avant le lancement, déjà figés, ou avec au moins un résultat en production) ; un jour sans résultat est régénéré.
// DailyJump : les jours sont aussi des fichiers figés (`apps/jump/public/levels/`), rejoués par `apps/jump/test/figes.test.ts` ; DailyTrack (lot R11) : le registre des jours
// (`packages/sim/src/jours-track.json`, la version du générateur de chaque jour servi) est écrit en même temps que ces empreintes, par la même PR « robot » — ce fichier le garde accordé.

const NIVEAUX = join(__dirname, "../../jump/public/levels");
type Jours = Record<string, { id: string; h: string }>;
const gardees = JSON.parse(readFileSync(join(__dirname, "jours-passes.json"), "utf8")) as { track: Jours; jump: Jours };
const registre = JSON.parse(readFileSync(join(__dirname, "../../../packages/sim/src/jours-track.json"), "utf8")) as RegistreJoursTrack;

/** Les jours à recalculer : tout pour Jump (un fichier figé se relit vite), pour Track les 30 derniers et un sur dix avant (le générateur coûte ≈ 0,3 s par jour). */
function aVerifier(jours: string[], tout: boolean): string[] {
  if (tout) return jours;
  return jours.filter((d, i) => i >= jours.length - 30 || i % 10 === 0);
}

describe("jours passés (jours-passes.json)", () => {
  it("ne garde que des jours protégés, jusqu'à la dernière mise en production (le 26/10, d'avant le lancement du 27/10, y est resté), les mêmes pour les deux jeux (un jour sans résultat n'y est pas : il est régénéré)", () => {
    for (const jeu of ["track", "jump"] as const) {
      const dates = Object.keys(gardees[jeu]).sort();
      expect(dates.length, jeu).toBeGreaterThan(0);
      dates.forEach((d, i) => i > 0 && expect(parseDay(d), `${jeu} ${d}`).toBeGreaterThan(parseDay(dates[i - 1]!)!));
    }
    expect(Object.keys(gardees.track)).toEqual(Object.keys(gardees.jump));
  });

  it("lot R11 : chaque jour gardé ici est au registre des jours de Track (même version), et le registre n'a pas de jour au-delà de la dernière décision", () => {
    const dates = Object.keys(gardees.track).sort();
    expect(registre.jusqua >= dates.at(-1)!, "le registre et les empreintes sont écrits ensemble par « Mettre en production » (veille du jour de bascule)").toBe(true);
    for (const date of dates) {
      const plage = registre.plages.find((p) => date >= p.du && date <= p.au);
      expect(plage, `${date} : un jour passé protégé est au registre`).toBeDefined();
      expect(gardees.track[date]!.id, date).toBe(`jour-${date}-g${plage!.g}`);
      expect(generatorVersionOf(parseDay(date)!), date).toBe(plage!.g);
    }
  });

  it("DailyTrack : le circuit de chaque jour passé est celui qui a été servi (identifiant, texte, temps du pilote, médailles, thème)", () => {
    for (const date of aVerifier(Object.keys(gardees.track).sort(), false)) {
      const e = empreinteTrack(parseDay(date)!);
      expect(e.ok, `Track ${date} : circuit de secours`).toBe(true);
      expect(e, `Track ${date} a changé : un jour passé ne change jamais — le registre des jours (jours-track.json) donne à chaque jour servi sa version du générateur : monter GENERATOR_VERSION ne change que les jours qu'il ne nomme pas`).toMatchObject({ id: gardees.track[date]!.id, h: gardees.track[date]!.h });
    }
  }, 120_000);

  it("DailyJump : le niveau servi de chaque jour passé est celui qui a été servi (fichier figé qui se rejoue, sinon niveau généré)", () => {
    expect(existsSync(NIVEAUX)).toBe(true);
    for (const date of Object.keys(gardees.jump).sort()) {
      const e = empreinteJump(parseDay(date)!, NIVEAUX);
      expect(e.ok, `Jump ${date} : niveau de secours`).toBe(true);
      expect(e, `Jump ${date} a changé : figer le jour avec le code en production (freeze:days) avant de changer une version`).toMatchObject({ id: gardees.jump[date]!.id, h: gardees.jump[date]!.h });
    }
  }, 120_000);
});
