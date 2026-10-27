import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDay, parseDay } from "@cdj/core";
import { PREMIER_JOUR_DU_JOUR } from "@cdj/core/lancement";
import { empreinteJump, empreinteTrack } from "../scripts/empreintes";

// Lot R6 (le garde-fou des jours) : **un jour passé ne change jamais**. `jours-passes.json` garde, pour chaque jour de la journée n° 1 jusqu'à la veille du jour de bascule
// de la dernière mise en production, l'empreinte de ce que chaque jeu a servi ce jour-là (`scripts/empreintes.ts`). Elle est ajoutée par « Mettre en production » (la PR
// « robot » des jours figés), avec le code qui était alors en production : ce test fait échouer **dès la PR** un changement de générateur, de physique ou de thème qui
// modifierait un jour déjà joué — avant, seule la mise en production le voyait. Un lot qui change le générateur pour la suite le fait à partir d'une date de bascule
// (`generatorVersionOf`, Track ; `freeze:days`, Jump), jamais pour un jour de ce fichier.
// DailyJump : les jours sont aussi des fichiers figés (`apps/jump/public/levels/`), rejoués par `apps/jump/test/figes.test.ts` ; DailyTrack : pas de fichier, la version du
// générateur est choisie par la date — c'est ce fichier qui la protège.

const NIVEAUX = join(__dirname, "../../jump/public/levels");
type Jours = Record<string, { id: string; h: string }>;
const gardees = JSON.parse(readFileSync(join(__dirname, "jours-passes.json"), "utf8")) as { track: Jours; jump: Jours };

/** Les jours à recalculer : tout pour Jump (un fichier figé se relit vite), pour Track les 30 derniers et un sur dix avant (le générateur coûte ≈ 0,3 s par jour). */
function aVerifier(jours: string[], tout: boolean): string[] {
  if (tout) return jours;
  return jours.filter((d, i) => i >= jours.length - 30 || i % 10 === 0);
}

describe("jours passés (jours-passes.json)", () => {
  it("couvre chaque jour de la journée n° 1 à la dernière mise en production, sans trou, pour les deux jeux (vide tant qu'aucune mise en production n'a fait de jour passé)", () => {
    for (const jeu of ["track", "jump"] as const) {
      const dates = Object.keys(gardees[jeu]).sort();
      // Aucun jour n'est « passé » avant la première mise en production après le lancement : le fichier est vide. Ensuite, il commence à la journée n° 1 (config/lancement.json).
      if (dates.length > 0) expect(dates[0], jeu).toBe(formatDay(PREMIER_JOUR_DU_JOUR));
      dates.forEach((d, i) => expect(parseDay(d), `${jeu} ${d}`).toBe(PREMIER_JOUR_DU_JOUR + i));
    }
    expect(Object.keys(gardees.track)).toEqual(Object.keys(gardees.jump));
  });

  it("DailyTrack : le circuit de chaque jour passé est celui qui a été servi (identifiant, texte, temps du pilote, médailles, thème)", () => {
    for (const date of aVerifier(Object.keys(gardees.track).sort(), false)) {
      const e = empreinteTrack(parseDay(date)!);
      expect(e.ok, `Track ${date} : circuit de secours`).toBe(true);
      expect(e, `Track ${date} a changé : un jour passé ne change jamais — le nouveau générateur ne vaut qu'à partir d'une date de bascule (generatorVersionOf)`).toMatchObject({ id: gardees.track[date]!.id, h: gardees.track[date]!.h });
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
