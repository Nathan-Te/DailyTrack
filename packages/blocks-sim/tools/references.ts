import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, BOTS_DE_REFERENCE, contenuDeScenario, dailyBlocks, empreinteContenu, enregistrer, jouer, seuils } from "../src/index";
import { jouerDiamant } from "../src/diamant";
import { jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";

const arrets = (c: ReturnType<typeof dailyBlocks>): Record<string, number> => Object.fromEntries((["bronze", "silver", "gold", "author"] as const).map((m) => [m, (BOTS_DE_REFERENCE[m].bot === "moyen" ? jouerGlouton(c, BOTS_DE_REFERENCE[m].pieces) : jouerDiamant(c, undefined, BOTS_DE_REFERENCE[m].pieces)).resultat.score]));

// Le golden de Blocks : `npm run golden:blocks -w @cdj/blocks-sim`. Dix jours (l'empreinte de leur suite, les seuils des médailles — des constantes — et le score de chaque bot de référence arrêté après son nombre de pièces) et des rediffusions de référence : les bots faible et moyen sur deux jours et sur
// un scénario, les trois scénarios qui se jouent (« blocage » : fin immédiate, aucune pose), et **le bot Diamant** sur deux jours et sur « presque-plein » et « ordre ». Il ne se régénère jamais sans monter la version concernée
// (`BLOCKS_SIM_VERSION` pour les règles, `BLOCKS_GENERATOR_VERSION` pour la suite, `BLOCKS_BOT_VERSION` pour les bots et les références des médailles).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const bots = { faible: jouerFaible, moyen: jouerGlouton, diamant: jouerDiamant } as const;
const parties = [
  { nom: "faible-jour-1", jour: jours[0]!, bot: "faible" as const },
  { nom: "moyen-jour-1", jour: jours[0]!, bot: "moyen" as const },
  { nom: "moyen-jour-4", jour: jours[3]!, bot: "moyen" as const },
  { nom: "moyen-presque-plein", jour: 0, scenario: "presque-plein" as const, bot: "moyen" as const },
  { nom: "blocage", jour: 0, scenario: "blocage" as const, bot: null },
  { nom: "diamant-jour-1", jour: jours[0]!, bot: "diamant" as const },
  { nom: "diamant-jour-4", jour: jours[3]!, bot: "diamant" as const },
  { nom: "diamant-presque-plein", jour: 0, scenario: "presque-plein" as const, bot: "diamant" as const },
  { nom: "diamant-ordre", jour: 0, scenario: "ordre" as const, bot: "diamant" as const },
].map((p) => {
  const scenario = "scenario" in p ? p.scenario : undefined;
  const contenu = scenario ? contenuDeScenario(scenario) : dailyBlocks(p.jour);
  const actions = p.bot === null ? [] : bots[p.bot](contenu).actions;
  return { nom: p.nom, date: formatDay(p.jour), ...(scenario ? { scenario } : {}), g: contenu.g, code: enregistrer(contenu, actions), resultat: jouer(contenu, actions) };
});

const sortie = {
  _: "Golden de Blocks (lots B1, B3 et B8). Régénérer : npm run golden:blocks -w @cdj/blocks-sim, seulement en montant la version concernée.",
  sim: BLOCKS_SIM_VERSION,
  generateur: BLOCKS_GENERATOR_VERSION,
  bot: BLOCKS_BOT_VERSION,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyBlocks(j)), seuils: seuils(), arrets: arrets(dailyBlocks(j)) })),
  rediffusions: parties,
};
writeFileSync(new URL("../test/fixtures/golden-blocks.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", parties.map((r) => `${r.nom}=${r.resultat.score}/${r.resultat.poses}`).join(" "));
