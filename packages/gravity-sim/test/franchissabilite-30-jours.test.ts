import { describe, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { verifierLeJour } from "./aideRobot";

// Les trente jours du lot GR2 (du 02/11/2026 au 01/12/2026) : le robot, strict, passe toute la première boucle et la moitié de la seconde. Une trentaine de secondes : c'est le test long de la franchissabilité
// (la zone `e2e/zones.json` des tests « Régression » est une zone partagée : ce fichier y est proposé dans le README du lot ; en attendant il tourne avec les unitaires). Corriger le générateur, jamais le robot.
describe("trente jours de franchissabilité", () => {
  const PREMIER = daysFromCivil(2026, 11, 2);
  it.each(Array.from({ length: 30 }, (_, i) => PREMIER + i))("jour %i", (jour) => verifierLeJour(jour), 60000);
});
