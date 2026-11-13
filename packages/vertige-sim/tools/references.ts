import { writeFileSync } from "node:fs";
import { Rng, daysFromCivil, formatDay } from "@cdj/core";
import { CUBE_ORDRE, NOMS_NIVEAUX, T_REPRISE, VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, empreinteContenu, empreinteNiveau, enregistrer, enregistrerScenario, niveau, niveauDuContenu, Partie, verifier, type Commande, type Contenu, type NomNiveau } from "../src/index";
import { assemblerCles, dailyVertige, enchainement, robotDuJour } from "../src/modulesIndex";
import { ETAPES_PARCOURS, jouerCibles, jouerEtapes, marcheVersDesCibles } from "./robot";

// Le golden de Vertige : `npm run golden:vertige -w @cdj/vertige-sim`. Dix jours (l'empreinte de leur contenu), les niveaux (l'empreinte de leurs boîtes) et des rediffusions de référence : le parcours
// par le joueur scripté, le même avec une souris qui tremble, deux marches au hasard semé (le bac à sable et le mur : toutes les touches, tous les contacts), une partie vide, et (lot V1) la GRAVITÉ ET LES PORTAILS : le cube
// (cinq faces à la suite : les six directions de la gravité), le parcours des portails (trois paires et une plaque de sol marquée) joué par le joueur scripté, un va-et-vient entre deux portails, et des marches au hasard dans la salle de
// la gravité, celle des portails et le cube. Chacune porte ses
// empreintes d'état tous les 600 pas. Il ne se régénère jamais sans monter la version concernée (`VERTIGE_SIM_VERSION` pour les rediffusions, `VERTIGE_GENERATOR_VERSION` pour le contenu).
// (Lot V2 : l'enchaînement fixe de modules, son robot et une reprise au palier.)
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);
const jourRef = jours[0]!;
// Le parcours de la maquette (le contenu de la version 1 du générateur) : les références du lot V0 le rejouent par leur scénario « parcours ».
const contenu: Contenu = { jour: jourRef, g: VERTIGE_GENERATOR_VERSION, niveau: "parcours" };

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

/** Les commandes jusqu'au dernier pas joué : une rediffusion qui continue après l'arrivée est refusée. */
function jusquaLaFin(nom: NomNiveau, commandes: Commande[]): Commande[] {
  const r = rejouerCommandesJusqua(nom, commandes);
  return commandes.slice(0, r);
}
function rejouerCommandesJusqua(nom: NomNiveau, commandes: readonly Commande[]): number {
  const p = new Partie(niveau(nom));
  for (let i = 0; i < commandes.length && !p.finie; i++) p.avancer(commandes[i]!);
  return p.tick;
}
const facesCube = CUBE_ORDRE.map((p): [number, number, number] => [...p]);
const cubeRobot = jouerCibles("cube", facesCube, { apres: 240 });
const portailsRobot = jouerCibles("portails", [[-6, 1.2, -6], [14, 1.2, -10], [34, 1.2, -10], [42, 0, -3.5], [43.5, 0, -3.5]], { apres: 10, maxPas: 3000 });
const vaEtVient = jouerCibles("portails", Array.from({ length: 40 }, (_, i): [number, number, number] => (i % 2 === 0 ? [-6, 1.2, -6] : [14, 1.2, -20])), { maxPas: 3000 });
/** Les points que les marches au hasard visent : sous le plafond marqué, contre les murs marqués, aux plaques de sol ; aux portails et à la plaque de l'arrivée. */
const POINTS = {
  gravite: [[-12, 0, 0], [-20.5, 1, 0], [-14, 0, -9.5], [19.5, 1, 0], [12, 7, 0], [-17, 0, 0], [17, 0, 0], [0, 0, 12]] as [number, number, number][],
  portails: [[-6, 1.2, -6], [14, 1.2, -20], [14, 1.2, -10], [26, 1.2, -10], [34, 1.2, -10], [43.5, 0, -3.5], [0, 0, 10]] as [number, number, number][],
};
const robot = jouerEtapes("parcours", ETAPES_PARCOURS);
const robotSouris = jouerEtapes("parcours", ETAPES_PARCOURS, { tremblement: (n) => [Math.round(22 * Math.sin(n / 7)), Math.round(14 * Math.sin(n / 11))] });
const refs: { nom: string; scenario: string | null; commandes: Commande[] }[] = [
  { nom: "parcours-robot", scenario: "parcours", commandes: robot.commandes },
  { nom: "parcours-souris", scenario: "parcours", commandes: robotSouris.commandes },
  { nom: "bac-a-sable-hasard", scenario: "bac-a-sable", commandes: marcheAuHasard(7, 6000) },
  { nom: "mur-hasard", scenario: "mur", commandes: marcheAuHasard(11, 6000) },
  { nom: "vide", scenario: "parcours", commandes: [] },
  { nom: "cube-six-directions", scenario: "cube", commandes: jusquaLaFin("cube", cubeRobot.commandes) },
  { nom: "portails-parcours", scenario: "portails", commandes: jusquaLaFin("portails", portailsRobot.commandes) },
  { nom: "portails-va-et-vient", scenario: "portails", commandes: jusquaLaFin("portails", vaEtVient.commandes) },
  { nom: "gravite-hasard", scenario: "gravite", commandes: marcheVersDesCibles("gravite", 23, POINTS.gravite, 9000) },
  { nom: "portails-hasard", scenario: "portails", commandes: marcheVersDesCibles("portails", 11, POINTS.portails, 9000) },
  { nom: "cube-hasard", scenario: "cube", commandes: marcheVersDesCibles("cube", 31, [...facesCube, [0, 0, 0]], 9000) },
];
// Lot V2 : l'enchaînement fixe (le robot, qui rejoue sa solution entière et arrive), une marche au hasard semé dessus, et le robot avec une reprise au palier demandée à mi-chemin puis jouée jusqu'au bout du temps.
const chaine = enchainement();
refs.push(
  { nom: "enchainement-robot", scenario: "enchainement", commandes: chaine.solution },
  { nom: "enchainement-hasard", scenario: "enchainement", commandes: marcheAuHasard(41, 9000) },
  { nom: "enchainement-reprise", scenario: "enchainement", commandes: chaine.solution.map((c, i) => (i === 1800 ? { ...c, k: c.k | T_REPRISE } : c)).slice(0, 9000) },
);
// Lot V3 : le niveau du jour assemblé de modules. Le robot de quatre jours (sa solution entière, rejouée par le navigateur au bit près), une reprise au palier demandée à mi-chemin sur l'un d'eux, et une marche au hasard semé.
const joursDuRobot = [jours[0]!, jours[3]!, jours[6]!, jours[9]!];
const rediffusions: { nom: string; scenario: string | null; date: string; g: number; code: string; resultat: ReturnType<typeof verifier>["resultat"]; empreintes: string[] }[] = refs.map((r) => {
  const v = verifier({ niveau: r.scenario as NomNiveau }, r.commandes);
  return { nom: r.nom, scenario: r.scenario, date: formatDay(jourRef), g: contenu.g, code: enregistrerScenario(r.scenario!, r.commandes), resultat: v.resultat, empreintes: v.empreintes };
});
for (const j of joursDuRobot) {
  const c = dailyVertige(j);
  const robotCommandes = robotDuJour(c);
  const ajouter = (nom: string, commandes: Commande[]): void => {
    const v = verifier(c, commandes);
    rediffusions.push({ nom, scenario: null, date: formatDay(j), g: c.g, code: enregistrer(c, commandes), resultat: v.resultat, empreintes: v.empreintes });
  };
  ajouter(`jour-robot-${formatDay(j)}`, robotCommandes);
  if (j === joursDuRobot[1]) {
    ajouter(`jour-reprise-${formatDay(j)}`, jusquaLaFinDuJour(c, robotCommandes.map((x, i) => (i === 1800 ? { ...x, k: x.k | T_REPRISE } : x)).slice(0, 9000)));
    ajouter(`jour-hasard-${formatDay(j)}`, jusquaLaFinDuJour(c, marcheAuHasard(53, 9000)));
  }
}
function jusquaLaFinDuJour(c: Contenu, commandes: Commande[]): Commande[] {
  const p = new Partie(niveauDuContenu(c));
  for (let i = 0; i < commandes.length && !p.finie; i++) p.avancer(commandes[i]!);
  return commandes.slice(0, p.tick);
}

// Les parties d'essai du serveur (`apps/api/scripts/vertige-essais.ts`) : douze façons de finir le parcours (le même joueur scripté, un regard de plus en plus tremblant), qui n'ont pas toutes le même temps.
const essais: { code: string; temps: number }[] = [];
for (let v = 0; v < 12; v++) {
  const amp = v * 9;
  const s = jouerEtapes("parcours", ETAPES_PARCOURS, { tremblement: (n) => [Math.round(amp * Math.sin(n / (5 + v))), Math.round(0.6 * amp * Math.sin(n / (9 + v)))] });
  if (!s.partie.resultat().arrive) throw new Error(`la partie d'essai ${v} n'arrive pas`);
  essais.push({ code: enregistrer(contenu, s.commandes), temps: s.partie.resultat().ticks });
}
writeFileSync(
  new URL("../src/partiesEssais.ts", import.meta.url),
  `// Produit par tools/references.ts (npm run golden:vertige) : ne se modifie pas à la main. Douze parties d'essai du parcours (le joueur scripté, un regard de plus en plus tremblant), pour le module d'essais du serveur.
// Une partie est la rediffusion d'un jour quelconque : le serveur la réécrit pour le jour qu'il joue (les commandes ne dépendent pas du jour).
export const PARTIES_ESSAIS: readonly { readonly code: string; readonly temps: number }[] = ${JSON.stringify(essais, null, 2)};
`,
);

const sortie = {
  _: "Golden de Vertige (lots V0 à V3). Régénérer : npm run golden:vertige -w @cdj/vertige-sim, seulement en montant la version concernée.",
  sim: VERTIGE_SIM_VERSION,
  generateur: VERTIGE_GENERATOR_VERSION,
  jours: jours.map((j) => {
    const c = dailyVertige(j);
    return { date: formatDay(j), empreinte: empreinteContenu(c), modules: c.modules, ticksRobot: c.ticksRobot, niveau: empreinteNiveau(assemblerCles(c.modules!).niveau) };
  }),
  niveaux: NOMS_NIVEAUX.map((n) => ({ nom: n, empreinte: empreinteNiveau(niveau(n)) })),
  rediffusions,
};
writeFileSync(new URL("../test/fixtures/golden-vertige.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("temps des parties d'essai :", essais.map((e) => e.temps).join(" "));
console.log("golden écrit :", rediffusions.map((r) => `${r.nom}=${r.resultat.arrive ? r.resultat.ticks : "–"}`).join(" "));
console.log("bascules / traversées :", rediffusions.map((r) => `${r.nom}=${r.resultat.bascules}/${r.resultat.traversees}`).join(" "));
console.log("orientations du cube :", cubeRobot.orientations.join(","));
