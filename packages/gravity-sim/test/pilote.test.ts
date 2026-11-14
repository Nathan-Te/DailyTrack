import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { Partie, dailyGravity, decoderRediffusion, enregistrer, rejouer, terrainDuJour } from "../src/index";
import { piloter } from "../src/pilote";

// Le chemin sûr du générateur est franchissable avec la vraie simulation : un pilote d'essai (`tools/pilote.ts`), qui ne connaît que le chemin sûr de chaque morceau et essaie ses coups sur des copies de la partie,
// traverse des centaines de mètres des cinq thèmes. **Ce n'est pas le robot des médailles** (lot GR2) : c'est la preuve que le générateur ne pose pas de piège sans issue. Les défauts connus (îlots et étages à
// 12 m/s, certains battements) sont dans le README du lot GR1.
const JOURS = [0, 3, 6, 9].map((i) => daysFromCivil(2026, 11, 2) + i);

describe("le pilote d'essai suit le chemin sûr", () => {
  it.each(JOURS)("jour %i : plus de 400 m, et la partie rejouée par le serveur donne le même résultat", (jour) => {
    const c = dailyGravity(jour);
    const { appuis, partie } = piloter(terrainDuJour(c), 15000);
    expect(partie.distance).toBeGreaterThan(400);
    expect(partie.rangDuTheme).toBeGreaterThanOrEqual(1);
    // Le serveur rejoue la rediffusion encodée : au pas où le pilote s'est arrêté, il est exactement dans le même état.
    const rejeu = new Partie(terrainDuJour(c));
    const lus = decoderRediffusion(enregistrer(c, appuis)).appuis;
    expect(lus).toEqual(appuis);
    for (let k = 0; rejeu.tick < partie.tick; ) {
      if (lus[k] === rejeu.tick) {
        rejeu.appuyer();
        k++;
      }
      rejeu.avancer();
    }
    expect(rejeu.resultat()).toEqual(partie.resultat());
    expect(rejouer(c, enregistrer(c, appuis)).score).toBeGreaterThanOrEqual(partie.score); // le serveur va jusqu'à la mort
  });
  it("ramasse des pièces, des gemmes et monte le multiplicateur (le score n'est pas que de la distance)", () => {
    const c = dailyGravity(JOURS[1]!);
    const { partie } = piloter(terrainDuJour(c), 15000);
    expect(partie.pieces).toBeGreaterThan(40);
    expect(partie.multMax).toBeGreaterThanOrEqual(2);
    expect(partie.score).toBeGreaterThan(partie.distance);
  });
});
