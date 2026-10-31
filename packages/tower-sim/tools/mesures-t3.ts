// Lot T3 (prolongé au lot T3b) — les mesures du bot sur 30 jours : le tirage du contenu (combien d'essais, quels jours restent hors de la plage), la hauteur du bot avant et après le plafond,
// le temps de préparation, la hauteur de deux joueurs simulés en pourcentage du Diamant (le glouton du lot T2, et le bot « imparfait » : un décalage d'une demi-case tiré à la graine sur une pièce
// sur quatre), la part qui atteint chaque médaille (15, 30, 50 %), les paliers vus, le coefficient de l'estimation géométrique contre le bot. Hors simulation : un outil de lecture (Math.* permis).
//   npm run mesures-t3:tower -w @cdj/tower-sim -- [--du 2026-11-05] [--jours 30] [--cout=N] [--sans-joueurs] [--fils=N]
// Phase 1 : `preparerJour` sur chaque jour (un `worker_threads` par cœur : tirages 0, 1, 2… jusqu'à la plage). Phase 2 : les deux joueurs simulés, sur le contenu du tirage retenu. Le coût d'une
// journée sur UN cœur se mesure à part (`--cout=N` jours, 0 par défaut : opt-in, plusieurs minutes), un jour après l'autre dans le fil principal.
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { formatDay, mixSeed, parseDay } from "@cdj/core";
import {
  dailyTower,
  diamantDe,
  estimationGeometrique,
  medaillesDe,
  medailleObtenue,
  PLAGE_DIAMANT_MM,
  type Rapier,
  REGLAGES_DEFAUT,
  rejouerComplet,
  dansLaPlage,
  TIRAGES_MAX,
  TOWER_GENERATOR_VERSION,
} from "../src";
import { bot, jouerBot, jouerBotRobuste, OPTIONS_BOT, preparerJour } from "../src/bot";
import { chargerRapier } from "../src/rapier";
import { chercher } from "./joueur";

type Tache = { genre: "preparer"; jour: number } | { genre: "glouton" | "imparfait"; jour: number; tirage: number };
interface Mesure {
  genre: Tache["genre"];
  jour: number;
  tirage: number;
  plateforme: number;
  /** La hauteur de la vraie partie (le bot, ou le joueur simulé), avant tout plafond. */
  hauteurMm: number;
  /** Le Diamant du jour (bot) : la hauteur plafonnée. */
  diamantMm: number;
  hauteurMaxMm: number;
  vies: number;
  posees: number;
  tombees: number;
  /** Les paliers déclenchés dans la partie. */
  paliers: number;
  variante: number;
  secondes: number;
  /** Le bot : un essai par tirage joué (hauteur du bot avant plafond) ; vide pour un joueur simulé. */
  essais: { tirage: number; hauteurMm: number; variante: number }[];
  dedans: boolean;
  /** L'estimation géométrique à 100 % du TIRAGE 0 (le contenu servi sans fichier), en millimètres. */
  geoMm: number;
}

function mesurer(R: Rapier, t: Tache): Mesure {
  const t0 = performance.now();
  if (t.genre === "preparer") {
    const p = preparerJour(R, t.jour);
    const c = dailyTower(t.jour, TOWER_GENERATOR_VERSION, p.tirage);
    const rj = rejouerComplet(R, c, p.fichier.preuve!);
    return {
      genre: "preparer",
      jour: t.jour,
      tirage: p.tirage,
      plateforme: c.plateformeDemi8 / 4,
      hauteurMm: p.hauteurMm,
      diamantMm: p.diamantMm,
      hauteurMaxMm: rj.resultat.hauteurMaxMm,
      vies: rj.resultat.vies,
      posees: rj.resultat.posees,
      tombees: rj.resultat.tombees,
      paliers: rj.vue.declenches,
      variante: p.variante,
      secondes: (performance.now() - t0) / 1000,
      essais: p.essais.map(({ tirage, hauteurMm, variante }) => ({ tirage, hauteurMm, variante })),
      dedans: p.dedans,
      geoMm: estimationGeometrique(dailyTower(t.jour), 100).auteur, // à 100 % : 32 m au plus, le plafond du Diamant n'y joue pas
    };
  }
  const c = dailyTower(t.jour, TOWER_GENERATOR_VERSION, t.tirage);
  let res;
  let vue;
  if (t.genre === "glouton") {
    const p = chercher(R, c, REGLAGES_DEFAUT);
    res = p.resultat()!;
    vue = p.vue();
    p.dispose();
  } else {
    const options = { ...OPTIONS_BOT, decalage: (n: number) => (mixSeed(t.jour, 0x1a7e + n) % 4 === 0 ? (mixSeed(t.jour, 0x2b + n) % 2 === 0 ? -1 : 1) : 0) };
    const r = jouerBot(R, c, options);
    const rj = rejouerComplet(R, c, r.rediffusion);
    res = rj.resultat;
    vue = rj.vue;
  }
  return {
    genre: t.genre,
    jour: t.jour,
    tirage: t.tirage,
    plateforme: c.plateformeDemi8 / 4,
    hauteurMm: res.hauteurMm,
    diamantMm: res.hauteurMm,
    hauteurMaxMm: res.hauteurMaxMm,
    vies: res.vies,
    posees: res.posees,
    tombees: res.tombees,
    paliers: vue.declenches,
    variante: 0,
    secondes: (performance.now() - t0) / 1000,
    essais: [],
    dedans: true,
    geoMm: 0,
  };
}

if (!isMainThread) {
  const R = await chargerRapier();
  parentPort!.on("message", (t: Tache | null) => {
    if (t === null) process.exit(0);
    parentPort!.postMessage(mesurer(R, t));
  });
  parentPort!.postMessage("pret");
} else {
  const args = process.argv.slice(2);
  const valeur = (nom: string): string | undefined => {
    const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
    if (i < 0) return undefined;
    return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
  };
  const du = parseDay(valeur("du") ?? "2026-11-05")!;
  const nbJours = Number(valeur("jours") ?? 30);
  const nbCout = Number(valeur("cout") ?? 0);
  const joueurs = !args.includes("--sans-joueurs");
  const jours = Array.from({ length: nbJours }, (_, i) => du + i);
  const R = await chargerRapier();
  const trier = (v: number[]): number[] => [...v].sort((a, b) => a - b);
  const q = (v: number[], p: number): number => {
    const s = trier(v);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  };
  const med = (v: number[]): number => {
    const s = trier(v);
    return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  };
  const m = (mm: number): string => (mm / 1000).toFixed(1);
  const pct = (n: number, d: number): string => `${Math.round((100 * n) / d)} %`;

  // 0. Le coût d'une journée sur UN cœur (opt-in) : un jour après l'autre, dans ce fil, rien d'autre en route ; le réglage ordinaire du tirage 0, puis ses reprises.
  if (nbCout > 0) {
    console.log(`## Coût sur un cœur (${nbCout} jours, un à la fois, tirage 0)`);
    const secondes: number[] = [];
    for (const j of jours.slice(0, nbCout)) {
      const c = dailyTower(j);
      const t0 = performance.now();
      const g = bot(R, c, OPTIONS_BOT);
      let n = g.next();
      while (!n.done) n = g.next();
      const variante = jouerBotRobuste(R, c, n.value!).variante;
      secondes.push((performance.now() - t0) / 1000);
      console.log(`  ${formatDay(j)} : ${secondes.at(-1)!.toFixed(0)} s${variante > 0 ? ` (variante ${variante})` : ""}`);
    }
    console.log(`  médiane ${med(secondes).toFixed(0)} s, pire ${Math.max(...secondes).toFixed(0)} s par tirage`);
  }

  // 1. La préparation des jours (tirages compris), puis 2. les joueurs simulés sur le contenu retenu : en parallèle, un fil par cœur.
  const fils = Math.max(1, Math.min(Number(valeur("fils") ?? availableParallelism()), jours.length));
  const mesures: Mesure[] = [];
  const calculer = (taches: Tache[], etiquette: string): Promise<number> =>
    new Promise<number>((fin, echec) => {
      console.log(`\n${taches.length} calculs (${etiquette}) sur ${fils} fil(s)…`);
      const debut = performance.now();
      const file = [...taches];
      let actifs = Math.min(fils, taches.length);
      for (let i = 0; i < actifs; i++) {
        const w = new Worker(new URL(import.meta.url));
        const donner = (): void => {
          const t = file.shift();
          if (t === undefined) {
            w.postMessage(null);
            if (--actifs === 0) fin((performance.now() - debut) / 1000);
          } else w.postMessage(t);
        };
        w.on("message", (x: Mesure | "pret") => {
          if (x !== "pret") {
            mesures.push(x);
            process.stderr.write(`  ${x.genre} ${formatDay(x.jour)} t${x.tirage} ${m(x.hauteurMm)} m${x.genre === "preparer" ? ` (Diamant ${m(x.diamantMm)} m, ${x.essais.length} essai(s))` : ""} (${x.secondes.toFixed(0)} s)\n`);
          }
          donner();
        });
        w.on("error", echec);
      }
    });
  const secondesPrepa = await calculer(
    jours.map((jour) => ({ genre: "preparer", jour })),
    "préparation, tirages compris",
  );
  const bots = mesures.filter((x) => x.genre === "preparer").sort((a, b) => a.jour - b.jour);
  if (joueurs) {
    const taches: Tache[] = [];
    for (const b of bots) taches.push({ genre: "imparfait", jour: b.jour, tirage: b.tirage }, { genre: "glouton", jour: b.jour, tirage: b.tirage });
    await calculer(taches, "joueurs simulés");
  }
  writeFileSync(new URL("../dist/mesures-t3b.json", import.meta.url), JSON.stringify({ mesures, secondesPrepa }, null, 1));

  console.log(`\n## Préparation de ${bots.length} jours sur ${fils} fil(s) : ${Math.floor(secondesPrepa / 60)} min ${Math.round(secondesPrepa % 60)} s (tirages compris) ; par jour (un fil chacun) : médiane ${med(bots.map((x) => x.secondes)).toFixed(0)} s, pire ${Math.max(...bots.map((x) => x.secondes)).toFixed(0)} s`);

  console.log("\n## Le tirage");
  const parTirage = Array.from({ length: TIRAGES_MAX }, (_, t) => bots.filter((x) => x.tirage === t).length);
  const essaisTotal = bots.reduce((a, x) => a + x.essais.length, 0);
  console.log(`  tirage retenu : ${parTirage.map((n, t) => `t${t} ${n}`).join(" · ")} ; essais par jour : moyenne ${(essaisTotal / bots.length).toFixed(2)} (${essaisTotal} bots joués pour ${bots.length} jours)`);
  const hors = bots.filter((x) => !x.dedans);
  console.log(`  jours restés hors de la plage [${m(PLAGE_DIAMANT_MM.min)} ; ${m(PLAGE_DIAMANT_MM.max)}] m après ${TIRAGES_MAX} tirages : ${hors.length} sur ${bots.length}${hors.length ? ` (${hors.map((x) => `${formatDay(x.jour)} ${m(x.diamantMm)} m`).join(", ")})` : ""}`);
  console.log(`  tirage 0 déjà dans la plage : ${bots.filter((x) => dansLaPlage(diamantDe(x.essais[0]!.hauteurMm))).length} jours sur ${bots.length}`);

  console.log("\n## La hauteur du bot, avant et après (30 jours, mètres)");
  console.log("  | | minimum | quartile bas | médiane | quartile haut | maximum |\n  |---|---|---|---|---|---|");
  const ligne = (nom: string, v: number[]): void => console.log(`  | ${nom} | ${m(Math.min(...v))} | ${m(q(v, 0.25))} | ${m(med(v))} | ${m(q(v, 0.75))} | ${m(Math.max(...v))} |`);
  ligne("tirage 0, hauteur du bot (avant sélection, avant plafond)", bots.map((x) => x.essais[0]!.hauteurMm));
  ligne("tirage retenu, hauteur du bot (avant plafond)", bots.map((x) => x.hauteurMm));
  ligne("Diamant (tirage retenu, après plafond)", bots.map((x) => x.diamantMm));
  console.log(`  bots au-dessus du plafond de ${m(60_000)} m (tirage retenu) : ${bots.filter((x) => x.hauteurMm > 60_000).length} jours sur ${bots.length}`);
  console.log(`  variantes de reprise utilisées (retenue) : ${bots.filter((x) => x.variante > 0).length} jours ; pièces posées : médiane ${med(bots.map((x) => x.posees))} sur 40 ; ${bots.filter((x) => x.vies === 0).length} jours à 0 vie`);
  console.log(`  paliers franchis par le bot : médiane ${med(bots.map((x) => x.paliers))} sur 6`);
  for (const l of [5, 6, 7, 8]) {
    const g = bots.filter((x) => x.plateforme === l);
    if (g.length) console.log(`  plateforme ${l} m : ${g.length} jours, Diamant médian ${m(med(g.map((x) => x.diamantMm)))} m`);
  }

  if (joueurs) {
    const pl = (g: "glouton" | "imparfait"): Mesure[] => mesures.filter((x) => x.genre === g).sort((a, b) => a.jour - b.jour);
    console.log("\n## Deux joueurs simulés, sur le contenu retenu, en % du Diamant du jour (médailles à 15, 30 et 50 %)");
    console.log("  | joueur | médiane | quartile bas | quartile haut | ≥ Bronze (15 %) | ≥ Argent (30 %) | ≥ Or (50 %) | Diamant (100 %) | paliers vus (moyenne) | paliers vus (médiane) | paliers du joueur à la hauteur médiane |\n  |---|---|---|---|---|---|---|---|---|---|---|");
    for (const [nom, g] of [
      ["glouton du lot T2", "glouton"],
      ["bot imparfait", "imparfait"],
    ] as const) {
      const xs = pl(g);
      const par = xs.map((x) => ({ x, d: bots.find((b) => b.jour === x.jour)! }));
      const rs = par.map(({ x, d }) => (100 * x.hauteurMm) / d.diamantMm);
      const obtenue = par.map(({ x, d }) => medailleObtenue(x.hauteurMm, medaillesDe(d.diamantMm)));
      const part = (...noms: (string | null)[]): string => pct(obtenue.filter((o) => noms.includes(o)).length, obtenue.length);
      const paliers = xs.map((x) => x.paliers);
      const triees = [...xs].sort((a, b) => a.hauteurMm - b.hauteurMm);
      const aLaMediane = triees[Math.floor(triees.length / 2)]!;
      console.log(
        `  | ${nom} | ${med(rs).toFixed(0)} % (${m(med(xs.map((x) => x.hauteurMm)))} m) | ${q(rs, 0.25).toFixed(0)} % | ${q(rs, 0.75).toFixed(0)} % | ${part("bronze", "argent", "or", "auteur")} | ${part("argent", "or", "auteur")} | ${part("or", "auteur")} | ${part("auteur")} | ${(paliers.reduce((a, b) => a + b, 0) / paliers.length).toFixed(1)} | ${med(paliers)} | ${aLaMediane.paliers} |`,
      );
    }
  }
  console.log("\n## L'estimation géométrique (aire des 40 pièces ÷ largeur de la plateforme) contre le Diamant (contenu du tirage 0, celui qu'on sert sans fichier)");
  const rapports = bots.map((x) => (100 * diamantDe(x.essais[0]!.hauteurMm)) / x.geoMm);
  const coef = Math.round(med(rapports));
  console.log(`  rapport Diamant du tirage 0 / estimation à 100 % : médiane ${coef} %, de ${Math.min(...rapports).toFixed(0)} % à ${Math.max(...rapports).toFixed(0)} %`);
  const ecarts = bots.map((x) => (100 * Math.abs((x.geoMm * coef) / 100 - diamantDe(x.essais[0]!.hauteurMm))) / diamantDe(x.essais[0]!.hauteurMm));
  console.log(`  avec le coefficient ${coef} % : écart médian ${med(ecarts).toFixed(0)} %, ${ecarts.filter((e) => e <= 25).length} jours sur ${ecarts.length} à moins de 25 %`);
  process.exit(0);
}
