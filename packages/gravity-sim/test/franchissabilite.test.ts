import { describe, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { verifierLeJour } from "./aideRobot";

// **La franchissabilité (lot GR2)** : le robot, avec ses contraintes d'humain (12 pas entre deux appuis, 8 pas de fenêtre, jamais le bouclier), passe toute la première boucle des cinq thèmes et la moitié de la
// seconde — là où le jeu est le plus dense et le plus rapide — sans un seul passage sans fenêtre. **Quand un motif échoue on corrige le générateur (écarts, hauteurs, longueurs selon la vitesse à laquelle le morceau
// est abordé), jamais le robot** ; `GRAVITY_GENERATOR_VERSION` monte, le golden est régénéré. Les trente jours du lot sont dans `franchissabilite-30-jours.test.ts` ; ici un échantillon d'autres jours (la CI de PR
// le rejoue vite) et le détail de ce qu'on exige d'un passage. Rapport par jour : `npm run robot:gravity -w @cdj/gravity-sim`.
describe("le chemin sûr du générateur se franchit comme un humain", () => {
  // Des jours qui ne sont pas ceux du lot : le générateur ne s'est pas réglé sur eux (et une dizaine de jours de plus ont été essayés à la main).
  const JOURS = [37, 52, 71, 84, 97, 113].map((i) => daysFromCivil(2026, 11, 2) + i);
  it.each(JOURS)("jour %i : la première boucle et la moitié de la seconde, sans un passage sans fenêtre", (jour) => verifierLeJour(jour), 60000);
});
