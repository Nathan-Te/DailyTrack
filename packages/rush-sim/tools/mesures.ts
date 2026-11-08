import { cpus } from "node:os";
import { daysFromCivil } from "@cdj/core";
import { BOSS_IDS, REGLAGES_DEFAUT, MAX_CHANGEMENTS, competenceDuPilote, PAS_MIN_DIRECTION, PAS_MIN_VISEE, Partie, contenuScenario, dailyRush, encoderRediffusion, entree, etatPilote, jouer, jouerLePilote, pasDuPilote, tempsSansRencontre, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, type Changement, type Choix } from "../src/index";

// Les mesures des lots BR0 à BR2 (l'ÉQUILIBRE des trois stratégies est dans `tools/equilibre.ts` : `npm run equilibre:rush -w @cdj/rush-sim`) : `npm run mesures:rush -w @cdj/rush-sim` (Node seulement ; aucune base, aucun réseau). Le coût du rejeu d'une partie de 2 et de 5 minutes, la taille de la rediffusion, le coût par tick d'un jeu à
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
const taille = (c: Changement[], contenu: { scenario: string }, choix: Choix[] = []): number => encoderRediffusion({ sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, contenu: { scenario: contenu.scenario }, changements: c, choix }).length;

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
for (const strategie of ["foncer", "peu", "beaucoup"] as const) {
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
    pireTaille = Math.max(pireTaille, taille(r.changements, { scenario: "jour" }, r.choix));
    if (strategie === "beaucoup" && r.resultat.victoire) ecarts.push(r.ticks / 60 - jouerLePilote(c).ticks / 60);
  }
  console.log(`Pilote « ${strategie} », 60 jours : ${victoires}/60 victoires · temps min / médiane / max ${quantiles(temps)} s · ${(subis / 60).toFixed(2)} dégât(s) subi(s) en moyenne · rediffusion ${pireTaille} caractères au plus`);
}
console.log(`Écart beaucoup − foncer (parties gagnées des deux côtés, min / médiane / max) : ${quantiles(ecarts)} s`);
const jour = dailyRush(daysFromCivil(2026, 11, 5));
const bot = jouerLePilote(jour);
const botTout = jouerLePilote(jour, REGLAGES_DEFAUT, Infinity, "beaucoup");
console.log(`Partie du jour (2026-11-05), le pilote qui fonce : ${bot.ticks} ticks (${(bot.ticks / 60).toFixed(1)} s), rejeu ${chrono(() => jouer(jour, bot.changements, REGLAGES_DEFAUT, bot.choix, bot.competence)).toFixed(2)} ms · ${bot.changements.length} changements, ${bot.choix.length} choix · ${taille(bot.changements, { scenario: "jour" }, bot.choix)} caractères`);
console.log(`Partie du jour (2026-11-05), le pilote « beaucoup d'XP » : ${botTout.ticks} ticks (${(botTout.ticks / 60).toFixed(1)} s), niveau ${botTout.resultat.nv}, rejeu ${chrono(() => jouer(jour, botTout.changements, REGLAGES_DEFAUT, botTout.choix, botTout.competence)).toFixed(2)} ms · ${botTout.changements.length} changements, ${botTout.choix.length} choix · ${taille(botTout.changements, { scenario: "jour" }, botTout.choix)} caractères`);
const pireJour = chrono(() => {
  const p = new Partie(jour, REGLAGES_DEFAUT);
  p.choisirCompetence(0); // lot BR5 : la compétence se choisit avant de partir (sinon la partie n'avance pas)
  let t = 0;
  // Un chevalier qui ne meurt jamais et qui court en rond (dans l'arène) : le pire coût d'une rediffusion du jour (10 minutes, le golem et ses monstres en permanence).
  while (!p.finie) {
    p.c.coeurs = 3;
    p.c.degat = 0;
    if (p.choix) p.choisir(p.choix.nv, 0);
    p.avancer(entree((t >> 5) % 32, false, false));
    t++;
  }
}, 3);
console.log(`Pire rejeu du jour (10 minutes, chevalier invincible qui court en rond) : ${pireJour.toFixed(0)} ms`);
// Le pire jour en rejeu : le pilote « nettoyer » qui tue tout, puis le golem, sur 60 jours.
let pireNettoyage = 0;
for (let k = 0; k < 60; k++) {
  const c = dailyRush(PREMIER + k);
  const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "beaucoup");
  pireNettoyage = Math.max(pireNettoyage, chrono(() => jouer(c, r.changements, REGLAGES_DEFAUT, r.choix, r.competence), 3));
}
console.log(`Rejeu de la pire partie « beaucoup d'XP » sur 60 jours : ${pireNettoyage.toFixed(1)} ms`);

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
  console.log(`  détours : ${boucles}/${detoursTous} en boucle (${((100 * boucles) / detoursTous).toFixed(0)} %), ${niveaux.filter((n) => n.detours.every((d) => d.hub2 >= 0)).length}/365 jours entièrement en boucle · vases ${q3(niveaux.map((n) => n.vases.length), 0)} (min / médiane / max) · monstres ${q3(niveaux.map((n) => n.monstres.length), 0)} · camps de ${q3(niveaux.flatMap((n) => n.detours.map((d) => n.monstres.filter((m) => m.camp === d.camp).length)), 0)}`);
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
    p.choisirCompetence(competenceDuPilote(c.boss)); // lot BR5
    const et = etatPilote("foncer");
    let avant = 0;
    let run = 0;
    while (!p.finie) {
      pasDuPilote(p, et);
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
    const rn = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "beaucoup");
    if (rn.resultat.victoire) {
      vn++;
      nt.push(rn.ticks / 60);
    }
    for (const d of c.niveau!.detours) {
      const r = jouerLePilote(c, REGLAGES_DEFAUT, Infinity, "beaucoup", d.camp);
      if (r.resultat.victoire && p.victoire) det.push((r.ticks - p.tick) / 60);
    }
  }
  const med = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
  console.log(`  pilote « foncer », 60 jours : ${vf}/60 victoires · total min / médiane / max ${q3(f)} s (golem compris) · à la barrière ${q3(arrivee)} s · course ${q3(course, 0)} % du trajet · ${(subisF.reduce((a, b) => a + b, 0) / 60).toFixed(2)} dégât(s) subi(s) en moyenne`);
  console.log(`  pilote « beaucoup d'XP » : ${vn}/60 victoires · ${q3(nt)} s · écart médian avec foncer ${(med(nt) - med(f)).toFixed(1)} s`);
  console.log(`  coût d'un détour pris seul (camp compris, par rapport à foncer) : ${q3(det)} s (${det.length} détours)`);
}

// 5. Lot BR3 : les cinq boss. Pour chacun, sur le même jour du niveau : le PIRE rejeu (10 minutes, chevalier invincible qui court en rond, le boss et ses sbires en permanence) à comparer au budget du kit (`rejeu.unitesServeur` de la fiche : une
// unité du plafond global ≈ 15 ms de calcul, lot R7), et la taille de la rediffusion du pilote qui fonce sur 60 jours forcés (scénario `boss`).
for (let b = 0; b < BOSS_IDS.length; b++) {
  const jourB = { ...dailyRush(daysFromCivil(2026, 11, 5)), boss: b };
  const pire5 = chrono(() => {
    const p = new Partie(jourB, REGLAGES_DEFAUT);
    p.choisirCompetence(0); // lot BR5
    let t = 0;
    while (!p.finie) {
      p.c.coeurs = 3;
      p.c.degat = 0;
      if (p.choix) p.choisir(p.choix.nv, 0);
      p.avancer(entree((t >> 5) % 32, t % 7 === 0, false));
      // le boss et ses sbires restent vivants : on ne laisse pas le chevalier tomber le boss
      if (p.golem) p.golem.hp = p.golem.hpMax;
      t++;
    }
  }, 3);
  let tailleMax = 0;
  let ticksMax = 0;
  for (let k = 0; k < 60; k++) {
    const c = contenuScenario("boss", { boss: b, jour: k });
    const r = jouerLePilote(c);
    tailleMax = Math.max(tailleMax, taille(r.changements, { scenario: "boss" }, r.choix));
    ticksMax = Math.max(ticksMax, r.ticks);
  }
  console.log(`${BOSS_IDS[b]!.padEnd(10)} : pire rejeu du jour (10 min, boss immortel) ${pire5.toFixed(0)} ms (≈ ${(pire5 / 15).toFixed(1)} unités de 15 ms) · rediffusion du pilote (60 jours forcés) ${tailleMax} caractères au plus, ${ticksMax} ticks au plus`);
}
