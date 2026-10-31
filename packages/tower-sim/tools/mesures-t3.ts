// Lot T3 — les mesures du bot sur 30 jours (rapport du lot T3) : le coût (par jour sur UN cœur, par pièce selon la hauteur de la tour), la hauteur du bot (médiane, minimum, maximum, pièces perdues,
// paliers atteints), la hauteur de deux joueurs simulés en pourcentage du Diamant (le glouton du lot T2, et le bot « imparfait » : un décalage d'une demi-case tiré à la graine sur une pièce sur
// quatre), le coefficient de l'estimation géométrique contre le bot. Hors simulation : un outil de lecture (Math.* permis).
//   npm run mesures-t3:tower -w @cdj/tower-sim -- [--du 2026-11-05] [--jours 30] [--cout=N] [--sans-joueurs] [--fils=N]
// Les 30 jours se calculent en parallèle (un `worker_threads` par cœur) ; le coût d'une journée se mesure À PART, un jour après l'autre dans le fil principal (un seul cœur, rien d'autre
// en route) : `--cout=N` jours (6 par défaut).
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { formatDay, mixSeed, parseDay } from "@cdj/core";
import { COMMANDE, dailyTower, estimationGeometrique, Partie, type Rapier, rejouerComplet } from "../src";
import { BUDGET_TICKS, bot, jouerBot, jouerBotRobuste, OPTIONS_BOT } from "../src/bot";
import { chargerRapier } from "../src/rapier";
import { chercher } from "./joueur";
import { REGLAGES_DEFAUT } from "../src";

type Tache = { genre: "bot" | "glouton" | "imparfait"; jour: number };
interface Mesure {
  genre: Tache["genre"];
  jour: number;
  plateforme: number;
  hauteurMm: number;
  hauteurMaxMm: number;
  vies: number;
  posees: number;
  tombees: number;
  paliers: number;
  banque: number;
  variante: number;
  secondes: number;
  /** Aire géométrique à 100 % (millimètres), pour le coefficient. */
  geoMm: number;
}

function mesurer(R: Rapier, t: Tache): Mesure {
  const c = dailyTower(t.jour);
  const t0 = performance.now();
  let rediffusion;
  let banque = 0;
  let variante = 0;
  if (t.genre === "glouton") {
    const p = chercher(R, c, REGLAGES_DEFAUT);
    rediffusion = { resultat: p.resultat()!, vue: p.vue() };
    p.dispose();
  } else {
    const options =
      t.genre === "imparfait"
        ? { ...OPTIONS_BOT, decalage: (n: number) => (mixSeed(t.jour, 0x1a7e + n) % 4 === 0 ? (mixSeed(t.jour, 0x2b + n) % 2 === 0 ? -1 : 1) : 0) }
        : OPTIONS_BOT;
    const r = t.genre === "bot" ? jouerBotRobuste(R, c) : jouerBot(R, c, options);
    banque = r.banque;
    variante = "variante" in r ? (r as { variante: number }).variante : 0;
    const rj = rejouerComplet(R, c, r.rediffusion);
    rediffusion = { resultat: rj.resultat, vue: rj.vue };
  }
  const { resultat: res, vue } = rediffusion;
  return {
    genre: t.genre,
    jour: t.jour,
    plateforme: c.plateformeDemi8 / 4,
    hauteurMm: res.hauteurMm,
    hauteurMaxMm: res.hauteurMaxMm,
    vies: res.vies,
    posees: res.posees,
    tombees: res.tombees,
    paliers: vue.declenches,
    banque,
    variante,
    secondes: (performance.now() - t0) / 1000,
    geoMm: estimationGeometrique(c, 100).auteur,
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
  const nbCout = Number(valeur("cout") ?? 6);
  const joueurs = !args.includes("--sans-joueurs");
  const jours = Array.from({ length: nbJours }, (_, i) => du + i);
  const R = await chargerRapier();
  const med = (v: number[]): number => {
    const s = [...v].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  };
  const m = (mm: number): string => (mm / 1000).toFixed(1);

  // 1. Le coût d'une journée sur UN cœur : un jour après l'autre, dans ce fil, rien d'autre en route ; par pièce selon la hauteur de la tour.
  console.log(`## Coût sur un cœur (${nbCout + 3} jours, un à la fois)`);
  const parTranche = new Map<number, { n: number; s: number }>();
  const secondes: number[] = [];
  // Les premiers jours, plus trois jours où le réglage ordinaire échoue (11, 17 et 21/11 pour la mesure du 31/10/2026) : le coût des reprises compte.
  const coutJours = [...jours.slice(0, nbCout), ...jours.filter((_, i) => i >= nbCout && [6, 12, 16].includes(i))];
  for (const j of coutJours) {
    const c = dailyTower(j);
    const suivi = new Partie(R, c);
    const g = bot(R, c, { ...OPTIONS_BOT, plafondTicks: BUDGET_TICKS });
    const t0 = performance.now();
    let dernier = t0;
    let h = 0;
    let variante = 0;
    for (;;) {
      const n = g.next();
      const t = performance.now();
      if (n.done) {
        variante = jouerBotRobuste(R, c, n.value).variante; // les reprises, si le réglage ordinaire donne moins de 30 m
        break;
      }
      const tranche = Math.floor(h / 10_000) * 10;
      const cell = parTranche.get(tranche) ?? { n: 0, s: 0 };
      cell.n++;
      cell.s += (t - dernier) / 1000;
      parTranche.set(tranche, cell);
      for (const masque of n.value) suivi.avancer(masque);
      h = suivi.vue().hauteurMm;
      dernier = performance.now();
    }
    secondes.push((performance.now() - t0) / 1000);
    suivi.dispose();
    console.log(`  ${formatDay(j)} : ${secondes.at(-1)!.toFixed(0)} s${variante > 0 ? ` (variante ${variante})` : ""}`);
  }
  console.log(`  médiane ${med(secondes).toFixed(0)} s, pire ${Math.max(...secondes).toFixed(0)} s (budget : 90 s)`);
  console.log("  | hauteur de la tour au moment de la pièce | pièces | secondes par pièce |\n  |---|---|---|");
  for (const [tr, c] of [...parTranche.entries()].sort((a, b) => a[0] - b[0])) console.log(`  | ${tr}–${tr + 10} m | ${c.n} | ${(c.s / c.n).toFixed(2)} |`);

  // 2. Les 30 jours, en parallèle.
  const taches: Tache[] = jours.map((jour) => ({ genre: "bot", jour }));
  if (joueurs) for (const jour of jours) taches.push({ genre: "imparfait", jour }, { genre: "glouton", jour });
  const fils = Math.max(1, Math.min(Number(valeur("fils") ?? availableParallelism()), taches.length));
  console.log(`\n${taches.length} calculs sur ${fils} fil(s)…`);
  const mesures: Mesure[] = [];
  const file = [...taches];
  await new Promise<void>((fin, echec) => {
    let actifs = fils;
    for (let i = 0; i < fils; i++) {
      const w = new Worker(new URL(import.meta.url));
      const donner = (): void => {
        const t = file.shift();
        if (t === undefined) {
          w.postMessage(null);
          if (--actifs === 0) fin();
        } else w.postMessage(t);
      };
      w.on("message", (x: Mesure | "pret") => {
        if (x !== "pret") {
          mesures.push(x);
          process.stderr.write(`  ${x.genre} ${formatDay(x.jour)} ${m(x.hauteurMm)} m (${x.secondes.toFixed(0)} s)\n`);
        }
        donner();
      });
      w.on("error", echec);
    }
  });
  writeFileSync(new URL("../dist/mesures-t3.json", import.meta.url), JSON.stringify({ mesures, secondes, parTranche: [...parTranche.entries()] }, null, 1));

  const de = (g: Tache["genre"]): Mesure[] => mesures.filter((x) => x.genre === g).sort((a, b) => a.jour - b.jour);
  const bots = de("bot");
  console.log(`\n## La hauteur du bot (le Diamant), ${bots.length} jours`);
  console.log(`  médiane ${m(med(bots.map((x) => x.hauteurMm)))} m · minimum ${m(Math.min(...bots.map((x) => x.hauteurMm)))} m · maximum ${m(Math.max(...bots.map((x) => x.hauteurMm)))} m`);
  console.log(`  variantes de reprise utilisées (hauteur du réglage ordinaire < 30 m) : ${bots.filter((x) => x.variante > 0).length} jours sur ${bots.length}`);
  console.log(`  pièces posées : médiane ${med(bots.map((x) => x.posees))} sur 40 ; pièces tombées : médiane ${med(bots.map((x) => x.tombees))}, ${bots.filter((x) => x.vies === 0).length} jours à 0 vie, ${bots.filter((x) => x.banque > 0).length} jours arrêtés par le bot`);
  console.log(`  paliers atteints : médiane ${med(bots.map((x) => x.paliers))} sur 6 ; plus haute tour atteinte (avant arrêt) : médiane ${m(med(bots.map((x) => x.hauteurMaxMm)))} m`);
  for (const l of [5, 6, 7, 8]) {
    const g = bots.filter((x) => x.plateforme === l);
    if (g.length) console.log(`  plateforme ${l} m : ${g.length} jours, médiane ${m(med(g.map((x) => x.hauteurMm)))} m`);
  }
  if (joueurs) {
    console.log("\n## Deux joueurs simulés, en % du Diamant du jour");
    console.log("  | joueur | médiane | quartile bas | quartile haut | ≥ 55 % | ≥ 75 % | ≥ 90 % | ≥ 100 % |\n  |---|---|---|---|---|---|---|---|");
    for (const [nom, g] of [["glouton du lot T2", "glouton"], ["bot imparfait", "imparfait"]] as const) {
      const rs = de(g).map((x) => (100 * x.hauteurMm) / bots.find((b) => b.jour === x.jour)!.hauteurMm);
      const s = [...rs].sort((a, b) => a - b);
      const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
      const part = (seuil: number): string => `${Math.round((100 * rs.filter((r) => r >= seuil).length) / rs.length)} %`;
      console.log(`  | ${nom} | ${med(rs).toFixed(0)} % | ${q(0.25).toFixed(0)} % | ${q(0.75).toFixed(0)} % | ${part(55)} | ${part(75)} | ${part(90)} | ${part(100)} |`);
    }
  }
  console.log("\n## L'estimation géométrique (aire des 40 pièces ÷ largeur de la plateforme) contre le bot");
  const rapports = bots.map((x) => (100 * x.hauteurMm) / x.geoMm);
  const coef = Math.round(med(rapports));
  console.log(`  rapport bot / estimation à 100 % : médiane ${coef} %, de ${Math.min(...rapports).toFixed(0)} % à ${Math.max(...rapports).toFixed(0)} %`);
  const ecarts = bots.map((x) => Math.abs(100 * ((x.geoMm * coef) / 100 - x.hauteurMm)) / x.hauteurMm);
  console.log(`  avec le coefficient ${coef} % : écart au bot médian ${med(ecarts).toFixed(0)} %, maximal ${Math.max(...ecarts).toFixed(0)} % (${ecarts.filter((e) => e <= 25).length} jours sur ${ecarts.length} à moins de 25 %)`);
  process.exit(0);
}
