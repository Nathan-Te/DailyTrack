import { writeFileSync } from "node:fs";
import { Rng, daysFromCivil, formatDay } from "@cdj/core";
import { NOMS_NIVEAUX, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, dailyVertige, empreinteContenu, empreinteNiveau, enregistrer, enregistrerScenario, niveau, verifier, type Commande } from "../src/index";
import { ETAPES_PARCOURS, jouerEtapes } from "./robot";

// Le golden de Vertige : `npm run golden:vertige -w @cdj/vertige-sim`. Dix jours (l'empreinte de leur contenu), les niveaux (l'empreinte de leurs boîtes) et des rediffusions de référence : le parcours
// par le joueur scripté, le même avec une souris qui tremble, deux marches au hasard semé (le bac à sable et le mur : toutes les touches, tous les contacts), une partie vide. Chacune porte ses
// empreintes d'état tous les 600 pas. Il ne se régénère jamais sans monter la version concernée (`VERTIGE_SIM_VERSION` pour les rediffusions, `VERTIGE_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);
const jourRef = jours[0]!;
const contenu = dailyVertige(jourRef);

/** Une marche au hasard semé : les touches changent de temps en temps, le regard bouge, on saute et on dashe. */
function marcheAuHasard(graine: number, pas: number): Commande[] {
  const rng = new Rng(graine);
  const out: Commande[] = [];
  let k = T_AVANT;
  for (let i = 0; i < pas; i++) {
    if (rng.int(30) === 0) k = [T_AVANT, T_AVANT | T_DROITE, T_AVANT | T_GAUCHE, T_DROITE, T_GAUCHE, T_ARRIERE, T_AVANT][rng.int(7)]!;
    let c = k;
    if (rng.int(45) === 0) c |= T_SAUT;
    if (rng.int(150) === 0) c |= T_DASH;
    out.push({ k: c, dl: rng.int(61) - 30 + (rng.int(200) === 0 ? 4000 : 0), dt: rng.int(21) - 10 });
  }
  return out;
}

const robot = jouerEtapes("parcours", ETAPES_PARCOURS);
const robotSouris = jouerEtapes("parcours", ETAPES_PARCOURS, { tremblement: (n) => [Math.round(22 * Math.sin(n / 7)), Math.round(14 * Math.sin(n / 11))] });
const refs: { nom: string; scenario: string | null; commandes: Commande[] }[] = [
  { nom: "parcours-robot", scenario: null, commandes: robot.commandes },
  { nom: "parcours-souris", scenario: null, commandes: robotSouris.commandes },
  { nom: "bac-a-sable-hasard", scenario: "bac-a-sable", commandes: marcheAuHasard(7, 6000) },
  { nom: "mur-hasard", scenario: "mur", commandes: marcheAuHasard(11, 6000) },
  { nom: "vide", scenario: null, commandes: [] },
];
const rediffusions = refs.map((r) => {
  const c = r.scenario ? { jour: 0, g: contenu.g, niveau: r.scenario as never } : contenu;
  const v = verifier(c, r.commandes);
  return { nom: r.nom, scenario: r.scenario, date: formatDay(jourRef), g: contenu.g, code: r.scenario ? enregistrerScenario(r.scenario, r.commandes) : enregistrer(contenu, r.commandes), resultat: v.resultat, empreintes: v.empreintes };
});

const sortie = {
  _: "Golden de Vertige (lot V0). Régénérer : npm run golden:vertige -w @cdj/vertige-sim, seulement en montant la version concernée.",
  sim: 1,
  generateur: 1,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyVertige(j)) })),
  niveaux: NOMS_NIVEAUX.map((n) => ({ nom: n, empreinte: empreinteNiveau(niveau(n)) })),
  rediffusions,
};
writeFileSync(new URL("../test/fixtures/golden-vertige.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", rediffusions.map((r) => `${r.nom}=${r.resultat.arrive ? r.resultat.ticks : "–"}`).join(" "));
