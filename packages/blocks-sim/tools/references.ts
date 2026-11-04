import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, contenuDeScenario, dailyBlocks, empreinteContenu, enregistrer, jouer } from "../src/index";
import { jouerGlouton } from "../src/glouton";

// Le golden de Blocks : `npm run golden:blocks -w @cdj/blocks-sim`. Dix jours (l'empreinte de leur suite) et quatre rediffusions de référence : le glouton sur deux jours, le glouton sur le scénario « presque-plein »,
// et le scénario « blocage » (fin immédiate, aucune pose). Il ne se régénère jamais sans monter la version concernée (`BLOCKS_SIM_VERSION` pour les règles, `BLOCKS_GENERATOR_VERSION` pour la suite).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const parties = [
  { nom: "glouton-jour-1", jour: jours[0]!, scenario: undefined },
  { nom: "glouton-jour-4", jour: jours[3]!, scenario: undefined },
  { nom: "glouton-presque-plein", jour: 0, scenario: "presque-plein" as const },
  { nom: "blocage", jour: 0, scenario: "blocage" as const },
].map((p) => {
  const contenu = p.scenario ? contenuDeScenario(p.scenario) : dailyBlocks(p.jour);
  const actions = p.nom === "blocage" ? [] : jouerGlouton(contenu).actions;
  return { nom: p.nom, date: formatDay(p.jour), ...(p.scenario ? { scenario: p.scenario } : {}), g: contenu.g, code: enregistrer(contenu, actions), resultat: jouer(contenu, actions) };
});

const sortie = {
  _: "Golden de Blocks (lot B1). Régénérer : npm run golden:blocks -w @cdj/blocks-sim, seulement en montant la version concernée.",
  sim: BLOCKS_SIM_VERSION,
  generateur: BLOCKS_GENERATOR_VERSION,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyBlocks(j)) })),
  rediffusions: parties,
};
writeFileSync(new URL("../test/fixtures/golden-blocks.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", parties.map((r) => `${r.nom}=${r.resultat.score}/${r.resultat.poses}`).join(" "));
