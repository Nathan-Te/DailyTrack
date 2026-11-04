import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyCibles, empreinteContenu, enregistrer, jouer, touchesDuBot, VARIANTE, type Touche } from "../src/index";

// Le golden de Cibles : `npm run golden:cibles -w @cdj/cibles-sim`. Dix jours (l'empreinte de leur contenu) et trois rediffusions de référence : le bot, un joueur qui rate et tarde, une partie vide.
// Il ne se régénère jamais sans monter la version concernée (`CIBLES_SIM_VERSION` pour les rediffusions, `CIBLES_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const jourRef = jours[0]!;
const contenu = dailyCibles(jourRef);
const reds = [
  { nom: "bot", touches: touchesDuBot(contenu) },
  { nom: "joueur-lent", touches: VARIANTE.joueurLent(contenu) }, // le joueur lent de la variante (variante.ts)
  { nom: "vide", touches: [] as Touche[] },
].map((r) => ({ nom: r.nom, date: formatDay(jourRef), g: contenu.g, code: enregistrer(contenu, r.touches), resultat: jouer(contenu, r.touches) }));

const sortie = {
  _: "Golden de Cibles (lot K4f). Régénérer : npm run golden:cibles -w @cdj/cibles-sim, seulement en montant la version concernée.",
  sim: 1,
  generateur: 1,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyCibles(j)) })),
  rediffusions: reds,
};
writeFileSync(new URL("../test/fixtures/golden-cibles.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.touches}`).join(" "));
