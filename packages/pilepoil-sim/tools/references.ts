import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyPilepoil, empreinteContenu, enregistrer, jouer, joueurScripte } from "../src/index";

// Le golden de « Pile poil » : `npm run golden:pilepoil -w @cdj/pilepoil-sim`. Dix jours (l'empreinte de leur contenu) et trois rediffusions de référence : un joueur précis, un joueur qui laisse filer des jauges, une partie vide.
// Il ne se régénère jamais sans monter la version concernée (`PILEPOIL_SIM_VERSION` pour les rediffusions, `PILEPOIL_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const jourRef = jours[0]!;
const contenu = dailyPilepoil(jourRef);
const reds = [
  { nom: "joueur-precis", appuis: joueurScripte(contenu.jauges, () => 9000) },
  { nom: "joueur-distrait", appuis: joueurScripte(contenu.jauges, (i) => (i % 3 === 2 ? null : 20000 + 5000 * i)) },
  { nom: "vide", appuis: [] as number[] },
].map((r) => ({ nom: r.nom, date: formatDay(jourRef), g: contenu.g, code: enregistrer(contenu, r.appuis), resultat: jouer(contenu.jauges, r.appuis) }));

const sortie = {
  _: "Golden de Pile poil (lot PA2). Régénérer : npm run golden:pilepoil -w @cdj/pilepoil-sim, seulement en montant la version concernée.",
  sim: 1,
  generateur: 1,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyPilepoil(j)) })),
  rediffusions: reds,
};
writeFileSync(new URL("../test/fixtures/golden-pilepoil.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.score}`).join(" "));
