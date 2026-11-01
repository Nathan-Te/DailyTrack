// Lot T2 — le golden de Tower (`test/fixtures/golden-tower.json`) : l'empreinte de `dailyTower` sur dix dates et trois rediffusions de référence, avec leur `Resultat` et l'empreinte
// de l'état final. **On ne le régénère jamais sans monter la version concernée** (`TOWER_SIM_VERSION` pour une rediffusion, `TOWER_GENERATOR_VERSION` pour le contenu du jour).
//   npm run golden:tower -w @cdj/tower-sim                recalcule les empreintes du générateur courant et VÉRIFIE les rediffusions gardées (leurs codes ne changent jamais ; un résultat qui change arrête l'outil)
//   npm run golden:tower -w @cdj/tower-sim -- --chercher   cherche aussi les parties ABSENTES du golden (≈ 1 min chacune) : un joueur glouton les joue, sur la simulation du code courant
// Lot T3b : le générateur 3 s'ajoute (empreintes du tirage 0 sur dix dates, quelques tirages 1 à 3, deux rediffusions en plus) ; les versions 1 et 2 passent sous `anciennes`, intactes ; les trois
// rediffusions du lot T2 sont gardées telles quelles (elles nomment leur version de générateur, g = 2).
// Les parties sont des rediffusions ordinaires, enregistrées sur le jeu : ce joueur n'est PAS le bot de l'auteur (lot T3), seulement de quoi produire des fixtures — pour chaque pièce il
// essaie une douzaine de placements en rejouant le début de la partie, et garde celui qui perd le moins de vies puis monte le plus haut.
import { readFileSync, writeFileSync } from "node:fs";
import { formatDay, parseDay } from "@cdj/core";
import {
  COMMANDE,
  scenarioNomme,
  SCENARIO_ALIGNEMENT,
  type Contenu,
  dailyTower,
  empreinteContenu,
  empreinteVue,
  encoderRediffusion,
  enregistrer,
  aDoublon,
  aEcartMaximal,
  Partie,
  REGLAGES_DEFAUT,
  rejouerComplet,
  type Rapier,
  type Reglages,
  type Scenario,
  SCENARIO_ESSAI,
  TOWER_GENERATOR_VERSION,
  TOWER_SIM_VERSION,
} from "../src";
import { chargerRapier } from "../src/rapier";

const FICHIER = new URL("../test/fixtures/golden-tower.json", import.meta.url);

interface GoldenContenu {
  date: string;
  empreinte: string;
}
interface GoldenRediffusion {
  nom: string;
  /** Ce que la rediffusion rejoue : un scénario nommé (`essai`) ou un jour (AAAA-MM-JJ) avec la version du générateur (`g`) et, dès la version 3, le tirage (0 par défaut). */
  contenu: { scenario: string } | { date: string; g: number; tirage?: number };
  /** La rediffusion encodée (base64url) : la preuve, telle que le serveur la recevrait. */
  code: string;
  resultat: unknown;
  empreinteFinale: string;
  /** Les ticks de la phase de jeu et le nombre de paliers déclenchés (pour lire le golden). */
  ticks: number;
  paliers: number;
}
interface GoldenTower {
  versions: { sim: number; g: number };
  contenus: GoldenContenu[];
  /** Lot T3b : quelques contenus à un tirage non nul (le tirage 0 est dans `contenus`). */
  tirages?: (GoldenContenu & { tirage: number })[];
  /** Lot T3 : les mêmes dates sous la version 1 du générateur (tout `port`), qui reste appelable et ne change jamais. */
  anciennes?: { g: number; contenus: GoldenContenu[] }[];
  /** Lot T6 : les rediffusions des simulations PASSÉES (la 3), gardées telles quelles : elles se rejouent à jamais, au bit près, par la version qu'elles nomment. */
  anciennesSim?: { sim: number; rediffusions: GoldenRediffusion[] }[];
  rediffusions: GoldenRediffusion[];
}

// ---- les dix dates ----

const PREMIER = parseDay("2026-11-02")!;

/** Dix dates : les trois dates à essayer à la main, puis de quoi couvrir les deux bornes d'un sac de sept, chaque bonus en premier palier, chaque malus en deuxième, les deux sens du vent et les quatre plateformes. */
export function choisirDates(g: number = TOWER_GENERATOR_VERSION): number[] {
  const choisies: number[] = [PREMIER, PREMIER + 1, PREMIER + 2];
  const exigences: ((c: Contenu) => boolean)[] = [
    (c) => aDoublon(c.pieces),
    (c) => aEcartMaximal(c.pieces),
    ...(["lierre", "figee", "petite"] as const).map((e) => (c: Contenu) => c.paliers[0]!.effet === e),
    ...(["geante", "vent", "glissante"] as const).map((e) => (c: Contenu) => c.paliers[1]!.effet === e),
    (c) => c.ventSens === -1,
    (c) => c.ventSens === 1,
    ...[20, 24, 28, 32].map((w) => (c: Contenu) => c.plateformeDemi8 === w),
  ];
  const satisfaite = (e: (c: Contenu) => boolean) => choisies.some((j) => e(dailyTower(j, g)));
  for (let j = PREMIER + 3; choisies.length < 10 && j < PREMIER + 400; j++) {
    if (exigences.some((e) => !satisfaite(e) && e(dailyTower(j, g)))) choisies.push(j);
  }
  for (let j = PREMIER + 3; choisies.length < 10; j++) if (!choisies.includes(j)) choisies.push(j);
  return choisies.sort((a, b) => a - b);
}

import { chercher, perdreTout } from "./joueur";
import { decoderRediffusion } from "../src";

function enGolden(R: Rapier, nom: string, contenu: Scenario, code: string, id: GoldenRediffusion["contenu"]): GoldenRediffusion {
  const r = rejouerComplet(R, contenu, code);
  return { nom, contenu: id, code, resultat: r.resultat, empreinteFinale: empreinteVue(r.vue), ticks: r.resultat.ticks, paliers: r.vue.declenches };
}

const R = await chargerRapier();
const chercherParties = process.argv.includes("--chercher");
const ancien: GoldenTower | null = (() => {
  try {
    return JSON.parse(readFileSync(FICHIER, "utf8")) as GoldenTower;
  } catch {
    return null;
  }
})();
if (!chercherParties && !ancien) throw new Error("pas de golden à recalculer : lancer avec --chercher");

const dates = choisirDates();
const contenus: GoldenContenu[] = dates.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyTower(j)) }));
// Lot T3b : le tirage 0 est dans `contenus` ; quelques tirages 1 à 3 en plus (le tirage est dans l'empreinte dès la version 3).
const tirages = [
  { jour: dates[0]!, tirage: 1 },
  { jour: dates[0]!, tirage: 2 },
  { jour: dates[1]!, tirage: 3 },
  { jour: dates[2]!, tirage: 1 },
  { jour: dates[5]!, tirage: 2 },
  { jour: dates[9]!, tirage: 3 },
].map(({ jour, tirage }) => ({ date: formatDay(jour), tirage, empreinte: empreinteContenu(dailyTower(jour, TOWER_GENERATOR_VERSION, tirage)) }));
// Les versions passées du générateur : leurs empreintes ne changent JAMAIS (une version passée gardée dans le golden est reprise telle quelle, sinon calculée une fois). Lot T3 : la version 1.
const anciennes: NonNullable<GoldenTower["anciennes"]> = [...(ancien?.anciennes ?? [])];
if (ancien && ancien.versions.g < TOWER_GENERATOR_VERSION && !anciennes.some((a) => a.g === ancien.versions.g)) anciennes.push({ g: ancien.versions.g, contenus: ancien.contenus });
for (const a of anciennes) {
  const recalcul = a.contenus.map((c) => empreinteContenu(dailyTower(parseDay(c.date)!, a.g)));
  if (recalcul.some((e, i) => e !== a.contenus[i]!.empreinte)) throw new Error(`le générateur g${a.g} ne donne plus ses empreintes : une version passée ne change jamais`);
}
const contenuDe = (id: GoldenRediffusion["contenu"]): Scenario => ("scenario" in id ? scenarioNomme(id.scenario)! : dailyTower(parseDay(id.date)!, id.g, id.tirage ?? 0));

// Lot T6 : les rediffusions d'une simulation passée (la 3) sont reprises telles quelles sous `anciennesSim` et vérifiées à chaque passage (leur résultat ne change jamais) ; celles de la simulation
// courante sont les `rediffusions`. Un golden d'une simulation plus ancienne que le code déplace ses rediffusions sous `anciennesSim`, une fois.
const anciennesSim: NonNullable<GoldenTower["anciennesSim"]> = [...(ancien?.anciennesSim ?? [])];
if (ancien && ancien.versions.sim < TOWER_SIM_VERSION && !anciennesSim.some((a) => a.sim === ancien.versions.sim)) anciennesSim.push({ sim: ancien.versions.sim, rediffusions: ancien.rediffusions });
const courantes = ancien && ancien.versions.sim === TOWER_SIM_VERSION ? ancien.rediffusions : [];
for (const a of anciennesSim) {
  for (const r of a.rediffusions) {
    const rejeu = rejouerComplet(R, contenuDe(r.contenu), r.code);
    if (JSON.stringify(rejeu.resultat) !== JSON.stringify(r.resultat) || empreinteVue(rejeu.vue) !== r.empreinteFinale) throw new Error(`« ${r.nom} » (simulation ${a.sim}) ne donne plus son résultat : la version ${a.sim} reste rejouable au bit près`);
  }
}

const rediffusions: GoldenRediffusion[] = [];
const sources: { nom: string; id: GoldenRediffusion["contenu"]; trouver(): Partie }[] = [
  // Neuf vies (un réglage du joueur, dans l'en-tête de la rediffusion) : la partie va jusqu'au bout des 40 pièces.
  { nom: "essai", id: { scenario: "essai" }, trouver: () => chercher(R, SCENARIO_ESSAI, { ...REGLAGES_DEFAUT, vies: 9 }) },
  // Lot T6 : la suite pour essayer de poser juste (O, O, I, J, L, T, T, S, Z, O, I, T) — des quarts de tour, des pivots, des pièces posées contre d'autres.
  { nom: "alignement", id: { scenario: "alignement" }, trouver: () => chercher(R, SCENARIO_ALIGNEMENT, { ...REGLAGES_DEFAUT, vies: 9 }) },
  // Un jour de la version 3 du générateur (paliers tous les 8 m, tirage 0), une partie à 0 vie, un tirage non nul (le genre 2 de la rediffusion).
  { nom: "jour-avec-paliers", id: { date: "2026-11-02", g: 3 }, trouver: () => chercher(R, dailyTower(PREMIER, 3), REGLAGES_DEFAUT) },
  { nom: "zero-vie", id: { date: "2026-11-03", g: 3 }, trouver: () => perdreTout(R, dailyTower(PREMIER + 1, 3)) },
  { nom: "tirage", id: { date: "2026-11-02", g: 3, tirage: 2 }, trouver: () => chercher(R, dailyTower(PREMIER, 3, 2), REGLAGES_DEFAUT) },
];
for (const s of sources) {
  const contenu = contenuDe(s.id);
  const gardee = courantes.find((r) => r.nom === s.nom);
  let code: string;
  if (gardee) {
    // Une partie gardée ne change JAMAIS : son code reste, et son résultat doit être exactement celui du golden (sinon une version a bougé sans être montée).
    code = gardee.code;
  } else if (chercherParties) {
    const p = s.trouver();
    code = encoderRediffusion(enregistrer(p));
    p.dispose();
  } else throw new Error(`la rediffusion « ${s.nom} » n'est pas dans le golden : lancer avec --chercher`);
  const g = enGolden(R, s.nom, contenu, code, s.id);
  if (gardee && (JSON.stringify(g.resultat) !== JSON.stringify(gardee.resultat) || g.empreinteFinale !== gardee.empreinteFinale)) {
    throw new Error(`« ${s.nom} » ne donne plus le résultat du golden : monter TOWER_SIM_VERSION avant de le régénérer`);
  }
  console.log(`${s.nom} : ${(g.resultat as { hauteurMm: number }).hauteurMm} mm, ${g.paliers} palier(s), ${g.ticks} ticks, ${code.length} caractères${gardee ? " (gardée)" : ""}`);
  rediffusions.push(g);
}

const golden: GoldenTower = { versions: { sim: TOWER_SIM_VERSION, g: TOWER_GENERATOR_VERSION }, contenus, tirages, anciennes, anciennesSim, rediffusions };
writeFileSync(FICHIER, `${JSON.stringify(golden, null, 2)}\n`);
console.log(`golden-tower.json écrit : ${contenus.length} contenus, ${rediffusions.length} rediffusions.`);
