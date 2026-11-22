import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyPilepoil, empreinteContenu, enregistrer, jouer, VARIANTE, type Touche } from "../src/index";

// Le golden de Pilepoil : `npm run golden:pilepoil -w @cdj/pilepoil-sim`. Dix jours (l'empreinte de leur contenu) et trois rediffusions de référence : un joueur vif, un joueur qui rate et tarde, une partie vide.
// Il ne se régénère jamais sans monter la version concernée (`PILEPOIL_SIM_VERSION` pour les rediffusions, `PILEPOIL_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const jourRef = jours[0]!;
const contenu = dailyPilepoil(jourRef);
const reds = [
  { nom: "joueur-vif", touches: VARIANTE.joueur(contenu, () => 12) }, // le joueur scripté de la variante (un jeu Party n'a pas de bot)
  { nom: "joueur-lent", touches: VARIANTE.joueurLent(contenu) }, // le joueur lent de la variante (variante.ts)
  { nom: "vide", touches: [] as Touche[] },
].map((r) => ({ nom: r.nom, date: formatDay(jourRef), g: contenu.g, code: enregistrer(contenu, r.touches), resultat: jouer(contenu, r.touches) }));

const sortie = {
  _: "Golden de Pilepoil (lot K4f). Régénérer : npm run golden:pilepoil -w @cdj/pilepoil-sim, seulement en montant la version concernée.",
  sim: 1,
  generateur: 1,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyPilepoil(j)) })),
  rediffusions: reds,
};
writeFileSync(new URL("../test/fixtures/golden-pilepoil.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.touches}`).join(" "));
