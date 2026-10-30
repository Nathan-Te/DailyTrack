// Lot T2 — le golden de Tower (`test/fixtures/golden-tower.json`) : l'empreinte de `dailyTower` sur dix dates et trois rediffusions de référence, avec leur `Resultat` et l'empreinte
// de l'état final. **On ne le régénère jamais sans monter la version concernée** (`TOWER_SIM_VERSION` pour une rediffusion, `TOWER_GENERATOR_VERSION` pour le contenu du jour).
//   npm run golden:tower -w @cdj/tower-sim                recalcule les empreintes et les résultats des rediffusions GARDÉES (leurs codes ne changent pas)
//   npm run golden:tower -w @cdj/tower-sim -- --chercher   refait aussi les trois parties (≈ 3 min) : un joueur glouton les cherche, sur la simulation du code courant
// Les parties sont des rediffusions ordinaires, enregistrées sur le jeu : ce joueur n'est PAS le bot de l'auteur (lot T3), seulement de quoi produire des fixtures — pour chaque pièce il
// essaie une douzaine de placements en rejouant le début de la partie, et garde celui qui perd le moins de vies puis monte le plus haut.
import { readFileSync, writeFileSync } from "node:fs";
import { formatDay, parseDay } from "@cdj/core";
import {
  COMMANDE,
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
  /** Ce que la rediffusion rejoue : un scénario nommé (`essai`) ou un jour (AAAA-MM-JJ). */
  contenu: { scenario: string } | { date: string };
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
  rediffusions: GoldenRediffusion[];
}

// ---- les dix dates ----

const PREMIER = parseDay("2026-11-02")!;

/** Dix dates : les trois dates à essayer à la main, puis de quoi couvrir les deux bornes d'un sac de sept, chaque bonus en premier palier, chaque malus en deuxième, les deux sens du vent et les quatre plateformes. */
export function choisirDates(): number[] {
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
  const satisfaite = (e: (c: Contenu) => boolean) => choisies.some((j) => e(dailyTower(j)));
  for (let j = PREMIER + 3; choisies.length < 10 && j < PREMIER + 400; j++) {
    if (exigences.some((e) => !satisfaite(e) && e(dailyTower(j)))) choisies.push(j);
  }
  for (let j = PREMIER + 3; choisies.length < 10; j++) if (!choisies.includes(j)) choisies.push(j);
  return choisies.sort((a, b) => a - b);
}

import { chercher, perdreTout } from "./joueur";

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
const contenuDe = (id: GoldenRediffusion["contenu"]): Scenario => ("scenario" in id ? SCENARIO_ESSAI : dailyTower(parseDay(id.date)!));

const rediffusions: GoldenRediffusion[] = [];
const sources: { nom: string; id: GoldenRediffusion["contenu"]; trouver(): Partie }[] = [
  // Neuf vies (un réglage du joueur, dans l'en-tête de la rediffusion) : la partie va jusqu'au bout des 40 pièces.
  { nom: "essai", id: { scenario: "essai" }, trouver: () => chercher(R, SCENARIO_ESSAI, { ...REGLAGES_DEFAUT, vies: 9 }) },
  { nom: "jour-avec-paliers", id: { date: "2026-11-02" }, trouver: () => chercher(R, dailyTower(PREMIER), REGLAGES_DEFAUT) },
  { nom: "zero-vie", id: { date: "2026-11-03" }, trouver: () => perdreTout(R, dailyTower(PREMIER + 1)) },
];
for (const s of sources) {
  const contenu = contenuDe(s.id);
  let code: string;
  if (chercherParties) {
    const p = s.trouver();
    code = encoderRediffusion(enregistrer(p));
    p.dispose();
  } else {
    code = ancien!.rediffusions.find((r) => r.nom === s.nom)!.code;
  }
  const g = enGolden(R, s.nom, contenu, code, s.id);
  console.log(`${s.nom} : ${(g.resultat as { hauteurMm: number }).hauteurMm} mm, ${g.paliers} palier(s), ${g.ticks} ticks, ${code.length} caractères`);
  rediffusions.push(g);
}

const golden: GoldenTower = { versions: { sim: TOWER_SIM_VERSION, g: TOWER_GENERATOR_VERSION }, contenus, rediffusions };
writeFileSync(FICHIER, `${JSON.stringify(golden, null, 2)}\n`);
console.log(`golden-tower.json écrit : ${contenus.length} contenus, ${rediffusions.length} rediffusions.`);
