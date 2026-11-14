import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyGravity, empreinteContenu, enregistrer, jouer, seuilsSurLePapier, terrainDuJour, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION } from "../src/index";
import { piloter } from "../src/pilote";

// Le golden de Gravity : `npm run golden:gravity -w @cdj/gravity-sim`. Dix jours (l'ordre des thèmes, l'empreinte de leur contenu — deux tours des cinq thèmes — et leurs seuils) et des rediffusions de référence :
// une partie vide, des appuis réguliers et **le pilote d'essai** (`pilote.ts`) sur le meilleur des dix jours, qui traverse les cinq thèmes et rejoue chaque mécanique. Il ne se régénère jamais sans monter la version
// concernée (`GRAVITY_SIM_VERSION` pour les rediffusions, `GRAVITY_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);
const PAS_DU_PILOTE = 30000;

const pilotes = jours.map((j) => ({ jour: j, ...piloter(terrainDuJour(dailyGravity(j)), PAS_DU_PILOTE) }));
const meilleur = pilotes.reduce((a, b) => (b.partie.distance > a.partie.distance ? b : a));
const jourRef = jours[0]!;

const reds = [
  { nom: "vide", jour: jourRef, appuis: [] as number[] },
  { nom: "reguliere", jour: jourRef, appuis: Array.from({ length: 200 }, (_, i) => 60 + i * 90) },
  { nom: "pilote", jour: meilleur.jour, appuis: meilleur.appuis },
].map((r) => {
  const contenu = dailyGravity(r.jour);
  return { nom: r.nom, date: formatDay(r.jour), g: contenu.g, code: enregistrer(contenu, r.appuis), resultat: jouer(terrainDuJour(contenu), r.appuis) };
});

const sortie = {
  _: "Golden de Gravity (lot GR1). Régénérer : npm run golden:gravity -w @cdj/gravity-sim, seulement en montant la version concernée.",
  sim: GRAVITY_SIM_VERSION,
  generateur: GRAVITY_GENERATOR_VERSION,
  jours: jours.map((j) => {
    const c = dailyGravity(j);
    return { date: formatDay(j), ordre: c.ordre, empreinte: empreinteContenu(c), seuils: seuilsSurLePapier(c) };
  }),
  rediffusions: reds,
};
writeFileSync(new URL("../test/fixtures/golden-gravity.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.score}/${r.resultat.ticks}`).join(" "));
