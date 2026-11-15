import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { DROITE, GAUCHE, LANCEUR, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, dailyPinball, empreinteContenu, enregistrer, jouer, piloter, seuilsSurLePapier, type Evenement } from "../src/index";

// Le golden de Pinball : `npm run golden:pinball -w @cdj/pinball-sim`. Dix jours (le thème, les six modules, l'empreinte de la table et les seuils) et des rediffusions de référence : une partie vide (la bille ne part
// jamais : elle dure les 15 minutes), le lanceur relâché puis les deux batteurs tenus, et **le pilote d'essai** (`pilote.ts`) sur deux tables, 2 minutes puis 8 minutes — chaque mécanique y passe. Il ne se régénère jamais
// sans monter la version concernée (`PINBALL_SIM_VERSION` pour les rediffusions, `PINBALL_GENERATOR_VERSION` pour la table).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);
const jourRef = jours[0]!;
const tenus: Evenement[] = [
  { tick: 10, c: LANCEUR, enfonce: true },
  { tick: 300, c: LANCEUR, enfonce: false },
  { tick: 900, c: GAUCHE, enfonce: true },
  { tick: 910, c: DROITE, enfonce: true },
  { tick: 2400, c: GAUCHE, enfonce: false },
  { tick: 2400, c: DROITE, enfonce: false },
];
const pilote = (jour: number, pas: number): Evenement[] => piloter(dailyPinball(jour), pas).evenements;

const reds = [
  { nom: "vide", jour: jourRef, evenements: [] as Evenement[] },
  { nom: "batteurs-tenus", jour: jourRef, evenements: tenus },
  { nom: "pilote-2-minutes", jour: jours[1]!, evenements: pilote(jours[1]!, 72000) },
  { nom: "pilote-8-minutes", jour: jours[4]!, evenements: pilote(jours[4]!, 288000) },
].map((r) => {
  const contenu = dailyPinball(r.jour);
  return { nom: r.nom, date: formatDay(r.jour), g: contenu.g, code: enregistrer(contenu, r.evenements), resultat: jouer(contenu, r.evenements) };
});

const sortie = {
  _: "Golden de Pinball (lot PB1). Régénérer : npm run golden:pinball -w @cdj/pinball-sim, seulement en montant la version concernée.",
  sim: PINBALL_SIM_VERSION,
  generateur: PINBALL_GENERATOR_VERSION,
  jours: jours.map((j) => {
    const c = dailyPinball(j);
    return { date: formatDay(j), theme: c.theme, modules: c.modules, empreinte: empreinteContenu(c), seuils: seuilsSurLePapier(c) };
  }),
  rediffusions: reds,
};
writeFileSync(new URL("../test/fixtures/golden-pinball.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.score}/${r.resultat.ticks}`).join(" "));
