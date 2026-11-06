import { cpus } from "node:os";
import { daysFromCivil } from "@cdj/core";
import { REGLAGES_DEFAUT, MAX_CHANGEMENTS, PAS_MIN_DIRECTION, PAS_MIN_VISEE, Partie, contenuScenario, dailyRush, encoderRediffusion, entree, etatPilote, jouer, jouerLePilote, pilote, tempsSansRencontre, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, type Changement } from "../src/index";

// Les mesures des lots BR0 à BR1b : `npm run mesures:rush -w @cdj/rush-sim` (Node seulement ; aucune base, aucun réseau). Le coût du rejeu d'une partie de 2 et de 5 minutes, la taille de la rediffusion, le coût par tick d'un jeu à
// 30 monstres. Le texte imprimé est celui que le README du lot recopie.
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
function chrono(f: () => unknown, passes = 7): number {
  f(); // chauffe
  const t: number[] = [];
  for (let i = 0; i < passes; i++) {
    const d = performance.now();
    f();
    t.push(performance.now() - d);
  }
  return mediane(t);
}
const taille = (c: Changement[], contenu: { scenario: string }): number => encoderRediffusion({ sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, contenu: { scenario: contenu.scenario }, changements: c }).length;

console.log(`Machine : ${cpus()[0]!.model.trim()} (${cpus().length} cœurs), Node ${process.version}`);
console.log(`Rush v${RUSH_SIM_VERSION} · 60 ticks par seconde · pas de changement de direction plus d'une fois tous les ${PAS_MIN_DIRECTION} ticks, de visée plus d'une fois tous les ${PAS_MIN_VISEE} ticks · plafond ${MAX_CHANGEMENTS} changements\n`);

// 1. Une partie de N minutes dans l'arène à 30 monstres (le pilote joue : ses entrées ressemblent à celles d'un joueur qui se bat).
for (const minutes of [2, 5]) {
  const ticks = minutes * 3600;
  const contenu = contenuScenario("arene", { monstres: 30 });
  const { changements } = jouerLePilote(contenu, REGLAGES_DEFAUT, ticks);
  const ms = chrono(() => jouer(contenu, changements.filter((c) => c.tick < ticks), REGLAGES_DEFAUT));
  // `jouer` rejoue jusqu'à la fin de la partie (10 minutes dans l'arène) : on compte donc le coût au tick, sur exactement `ticks` ticks.
  const msTicks = chrono(() => {
    const p = new Partie(contenu, REGLAGES_DEFAUT);
    let k = 0;
    let e = 0;
    while (!p.finie && p.tick < ticks) {
      while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
      p.avancer(e);
    }
  });
  void ms;
  console.log(`Arène à 30 monstres, ${minutes} min (${ticks} ticks) : rejeu ${msTicks.toFixed(0)} ms (${((msTicks * 1000) / ticks).toFixed(1)} µs par tick) · ${changements.length} changements d'entrée · rediffusion ${taille(changements, contenu)} caractères`);
}

// 2. Le pire joueur pour la taille : une entrée différente à chaque tick où le jeu a le droit de changer de direction (tous les 3 ticks) ou de visée (tous les 4 ticks), 5 minutes ; le plafond de changements (8 000) borne la suite.
const pire: Changement[] = [];
for (let t = 0, i = 0; t < 5 * 3600 && pire.length < MAX_CHANGEMENTS; t++) {
  if (t % PAS_MIN_DIRECTION !== 0 && t % PAS_MIN_VISEE !== 0) continue;
  pire.push({ tick: t, e: entree(i % 32, i % 5 === 0, i % 11 === 0, (i * 7) % 32) });
  i++;
}
console.log(`Pire rediffusion permise (${pire.length} changements : une entrée toutes les fois que la direction (tous les ${PAS_MIN_DIRECTION} ticks) ou la visée (tous les ${PAS_MIN_VISEE}) peut changer) : ${taille(pire, { scenario: "arene" })} caractères (limite acceptée : 40 000)`);

// 3. Le NIVEAU du jour (lot BR1) : le temps de génération, la longueur du chemin, le pilote (foncer : le Diamant provisoire ; nettoyer : une partie scriptée qui tue tout), le coût d'un rejeu.
const PREMIER = daysFromCivil(2026, 11, 2);
{
  const t0 = performance.now();
  const niveaux = Array.from({ length: 365 }, (_, i) => dailyRush(PREMIER + i).niveau!);
  const ms = performance.now() - t0;
  const long = niveaux.map((n) => n.longueurCm / 100);
  console.log(`Générateur (version ${RUSH_GENERATOR_VERSION}) : 365 niveaux en ${ms.toFixed(0)} ms (${(ms / 365).toFixed(2)} ms chacun) · tentatives ${(niveaux.reduce((a, n) => a + n.essais, 0) / 365).toFixed(2)} en moyenne, ${Math.max(...niveaux.map((n) => n.essais))} au plus · chemin principal ${Math.min(...long).toFixed(0)}-${Math.max(...long).toFixed(0)} m · détours ${Math.min(...niveaux.map((n) => n.detours.length))}-${Math.max(...niveaux.map((n) => n.detours.length))} · monstres ${Math.min(...niveaux.map((n) => n.monstres.length))}-${Math.max(...niveaux.map((n) => n.monstres.length))} · grille ${Math.max(...niveaux.map((n) => n.l * n.h))} cases au plus`);
}
const quantiles = (v: number[]): string => {
  const t = [...v].sort((a, b) => a - b);
  return `${t[0]!.toFixed(1)} / ${t[Math.floor(t.length / 2)]!.toFixed(1)} / ${t[t.length - 1]!.toFixed(1)}`;
};
const ecarts: number[] = [];
for (const strategie of ["foncer", "nettoyer"] as const) {
  const temps: number[] = [];
  let victoires = 0;
  let subis = 0;
  let pireTaille = 0;
  for (let k = 0; k < 60; k++) {
    const c = dailyRush(PREMIER + k);
    const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, strategie);
    if (r.resultat.victoire) {
      victoires++;
      temps.push(r.ticks / 60);
    }
    subis += r.resultat.subis;
    pireTaille = Math.max(pireTaille, taille(r.changements, { scenario: "jour" }));
    if (strategie === "nettoyer" && r.resultat.victoire) ecarts.push(r.ticks / 60 - jouerLePilote(c).ticks / 60);
  }
  console.log(`Pilote « ${strategie} », 60 jours : ${victoires}/60 victoires · temps min / médiane / max ${quantiles(temps)} s · ${(subis / 60).toFixed(2)} dégât(s) subi(s) en moyenne · rediffusion ${pireTaille} caractères au plus`);
}
console.log(`Écart nettoyer − foncer (parties gagnées des deux côtés, min / médiane / max) : ${quantiles(ecarts)} s`);
const jour = dailyRush(daysFromCivil(2026, 11, 5));
const bot = jouerLePilote(jour);
console.log(`Partie du jour (2026-11-05), le pilote qui fonce : ${bot.ticks} ticks (${(bot.ticks / 60).toFixed(1)} s), rejeu ${chrono(() => jouer(jour, bot.changements)).toFixed(2)} ms · ${bot.changements.length} changements · ${taille(bot.changements, { scenario: "jour" })} caractères`);
const pireJour = chrono(() => {
  const p = new Partie(jour, REGLAGES_DEFAUT);
  let t = 0;
  // Un chevalier qui ne meurt jamais et qui court en rond (dans l'arène) : le pire coût d'une rediffusion du jour (10 minutes, le golem et ses monstres en permanence).
  while (!p.finie) {
    p.c.coeurs = 3;
    p.c.degat = 0;
    p.avancer(entree((t >> 5) % 32, false, false));
    t++;
    void pilote;
  }
}, 3);
console.log(`Pire rejeu du jour (10 minutes, chevalier invincible qui court en rond) : ${pireJour.toFixed(0)} ms`);
// Le pire jour en rejeu : le pilote « nettoyer » qui tue tout, puis le golem, sur 60 jours.
let pireNettoyage = 0;
for (let k = 0; k < 60; k++) {
  const c = dailyRush(PREMIER + k);
  const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "nettoyer");
  pireNettoyage = Math.max(pireNettoyage, chrono(() => jouer(c, r.changements), 3));
}
console.log(`Rejeu de la pire partie « tout nettoyer » sur 60 jours : ${pireNettoyage.toFixed(1)} ms`);

// 4. Lot BR1b : la densité, les boucles, la course et le coût d'un détour (le pilote sur 60 jours).
{
  const niveaux = Array.from({ length: 365 }, (_, i) => dailyRush(PREMIER + i).niveau!);
  const q3 = (v: number[], d = 1): string => {
    const t = [...v].sort((a, b) => a - b);
    return `${t[0]!.toFixed(d)} / ${t[Math.floor(t.length / 2)]!.toFixed(d)} / ${t[t.length - 1]!.toFixed(d)}`;
  };
  const boucles = niveaux.reduce((a, n) => a + n.detours.filter((d) => d.hub2 >= 0).length, 0);
  const detoursTous = niveaux.reduce((a, n) => a + n.detours.length, 0);
  console.log(`BR1b, 365 niveaux : chemin principal ${q3(niveaux.map((n) => n.longueurCm / 100), 0)} m · plus long tronçon sans rencontre ${q3(niveaux.map((n) => tempsSansRencontre(n)))} s de course · rencontres ${q3(niveaux.map((n) => n.rencontres.length), 0)} · une clairière ou une rencontre tous les ${(niveaux.reduce((a, n) => a + n.longueurCm / 100 / (n.clairieres.filter((c) => c.genre === "etape").length + n.rencontres.length + 1), 0) / 365).toFixed(1)} m en moyenne`);
  console.log(`  détours : ${boucles}/${detoursTous} en boucle (${((100 * boucles) / detoursTous).toFixed(0)} %), ${niveaux.filter((n) => n.detours.every((d) => d.hub2 >= 0)).length}/365 jours entièrement en boucle · obstacles ${q3(niveaux.map((n) => n.obstacles.length), 0)} (${niveaux.reduce((a, n) => a + n.obstacles.filter((o) => o.contournable).length, 0)}/${niveaux.reduce((a, n) => a + n.obstacles.length, 0)} contournables) · monstres ${q3(niveaux.map((n) => n.monstres.length), 0)}`);
  const f: number[] = [];
  const nt: number[] = [];
  const arrivee: number[] = [];
  const course: number[] = [];
  const subisF: number[] = [];
  const det: number[] = [];
  let vf = 0;
  let vn = 0;
  for (let k = 0; k < 60; k++) {
    const c = dailyRush(PREMIER + k);
    const p = new Partie(c, REGLAGES_DEFAUT);
    const et = etatPilote("foncer");
    let avant = 0;
    let run = 0;
    while (!p.finie) {
      p.avancer(pilote(p, et));
      if (p.barriere < 0) {
        avant++;
        if (p.c.elan > 0) run++;
      }
    }
    subisF.push(p.subis);
    if (p.victoire) {
      vf++;
      f.push(p.tick / 60);
      arrivee.push(avant / 60);
      course.push((100 * run) / Math.max(1, avant));
    }
    const rn = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "nettoyer");
    if (rn.resultat.victoire) {
      vn++;
      nt.push(rn.ticks / 60);
    }
    for (const d of c.niveau!.detours) {
      const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "nettoyer", d.camp);
      if (r.resultat.victoire && p.victoire) det.push((r.ticks - p.tick) / 60);
    }
  }
  const med = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  console.log(`  pilote « foncer », 60 jours : ${vf}/60 victoires · total min / médiane / max ${q3(f)} s (golem compris) · à la barrière ${q3(arrivee)} s · course ${q3(course, 0)} % du trajet · ${(subisF.reduce((a, b) => a + b, 0) / 60).toFixed(2)} dégât(s) subi(s) en moyenne`);
  console.log(`  pilote « tout nettoyer » : ${vn}/60 victoires · ${q3(nt)} s · écart médian avec foncer ${(med(nt) - med(f)).toFixed(1)} s`);
  console.log(`  coût d'un détour pris seul (camp compris, par rapport à foncer) : ${q3(det)} s (${det.length} détours)`);
}
