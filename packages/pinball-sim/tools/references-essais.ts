import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { PINBALL_BOT_VERSION, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, PLANS_ESSAI, THEMES_PINBALL, dailyPinball, enregistrer, graineDuRobot, jouer, jouerRobot, empreinteContenu } from "../src/index";

// Le golden des plans d'essai (lot PBT0) : `npm run golden-essais:pinball -w @cdj/pinball-sim`. **Une partie du robot (1 minute 20) sur chacun des douze plans** (`t1` à `t6` et leurs miroirs, un thème qui tourne), rejouée au bit près
// par `test/golden-essais.test.ts` — c'est ce que fait le serveur d'un jour servi (`rejouer`). Ce fichier est à part : **les tables du jour ne bougent pas** (`golden-pinball.json`, la liste des tables refusées et les seuils sont inchangés).
// Il ne se régénère qu'en montant la version concernée.
const jour = daysFromCivil(2026, 11, 20);
const ids = PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`]);
const rediffusions = ids.map((id, i) => {
  const contenu = dailyPinball(jour, undefined, THEMES_PINBALL[i % THEMES_PINBALL.length], id);
  const evenements = jouerRobot(contenu, graineDuRobot(i % 4), { maxTicks: 48000 }).evenements;
  return { nom: `robot-${id}-${contenu.theme}`, plan: id, theme: contenu.theme, date: formatDay(jour), g: contenu.g, empreinte: empreinteContenu(contenu), code: enregistrer(contenu, evenements), resultat: jouer(contenu, evenements) };
});
const sortie = {
  _: "Golden des plans d'essai de Pinball (lot PBT0) : npm run golden-essais:pinball -w @cdj/pinball-sim, seulement en montant la version concernée.",
  sim: PINBALL_SIM_VERSION,
  generateur: PINBALL_GENERATOR_VERSION,
  bot: PINBALL_BOT_VERSION,
  rediffusions,
};
writeFileSync(new URL("../test/fixtures/golden-essais.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden des essais écrit :", rediffusions.map((r) => `${r.nom}=${r.resultat.score}/${r.resultat.ticks}`).join(" "));
