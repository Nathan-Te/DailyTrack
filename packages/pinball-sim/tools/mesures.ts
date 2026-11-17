import { daysFromCivil } from "@cdj/core";
import { Rng } from "@cdj/core";
import { DROITE, DUREE_MAX_TICKS, GAUCHE, LANCEUR, MAX_EVENEMENTS, Partie, TICKS_PAR_SECONDE, dailyPinball, decoderRediffusion, enregistrer, jouer, jouerRobot, rejouer, type Contenu, type Evenement } from "../src/index";

// `npm run mesures:pinball -w @cdj/pinball-sim` : les chiffres du README du lot PB1 (déterminisme, coût d'un rejeu, taille d'une rediffusion, parties par seconde) ; lot PB4 : le joueur est le robot (3 minutes de jeu au plus par partie, le serveur rejoue jusqu'à la fin). Aucune base, aucun réseau.
const ROBOT_PAS = 180 * TICKS_PAR_SECONDE;
/** La partie du jeu poussée jusqu'au bout (comme la scène) : les événements à leur pas, jusqu'à la fin de la partie. */
const jeuJusquAuBout = (c: Contenu, evenements: readonly Evenement[]): ReturnType<Partie["resultat"]> => {
  const p = new Partie(c);
  let k = 0;
  while (!p.finie) {
    while (k < evenements.length && evenements[k]!.tick === p.tick) p.regler(evenements[k]!.c, evenements[k++]!.enfonce);
    p.avancer();
  }
  return p.resultat();
};
const premier = daysFromCivil(2026, 11, 2);
const ms = (f: () => void): number => {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
};
const med = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

/** Un joueur « nerveux » : `parSeconde` appuis par seconde sur chaque batteur (durée 0,1 à 0,3 s), au hasard ; une bille lancée en début de partie. Pour mesurer la taille d'une rediffusion, pas pour jouer. */
function nerveux(minutes: number, parSeconde: number, graine: number): Evenement[] {
  const rng = new Rng(graine);
  const fin = minutes * 60 * TICKS_PAR_SECONDE;
  const ev: Evenement[] = [
    { tick: 0, c: LANCEUR, enfonce: true },
    { tick: 300, c: LANCEUR, enfonce: false },
  ];
  for (const c of [GAUCHE, DROITE] as const) {
    let t = 400 + rng.int(60);
    while (t < fin - 200 && ev.length < MAX_EVENEMENTS - 2) {
      ev.push({ tick: t, c, enfonce: true });
      t += 60 + rng.int(120);
      ev.push({ tick: t, c, enfonce: false });
      t += Math.max(1, Math.trunc(TICKS_PAR_SECONDE / parSeconde) - 120 + rng.int(240));
    }
  }
  return ev.sort((a, b) => a.tick - b.tick);
}

console.log("— déterminisme : le jeu joue pas à pas les événements du robot jusqu'au bout, le serveur rejoue la rediffusion décodée");
let egaux = 0;
const JOURS = 40;
for (let i = 0; i < JOURS; i++) {
  const c = dailyPinball(premier + i);
  const { evenements } = jouerRobot(c, 1 + i, { maxTicks: ROBOT_PAS });
  const serveur = rejouer(c, enregistrer(c, evenements));
  const jeu = jeuJusquAuBout(c, evenements);
  if (JSON.stringify(serveur) === JSON.stringify(jeu)) egaux++;
  else console.log("  DIFFÉRENT", i, jeu, serveur);
}
console.log(`  ${egaux} / ${JOURS} jours : même score (client = serveur)`);

console.log("— coût d'un rejeu (le serveur, parties du robot qui durent)");
const longues = [] as { c: ReturnType<typeof dailyPinball>; ev: Evenement[]; ticks: number }[];
for (let i = 0; i < 80 && longues.length < 6; i++) {
  const c = dailyPinball(premier + i);
  const ev = jouerRobot(c, 1 + i, { maxTicks: ROBOT_PAS }).evenements;
  const ticks = jouer(c, ev).ticks;
  if (ticks >= 5 * 60 * TICKS_PAR_SECONDE) longues.push({ c, ev, ticks });
}
const msParTick: number[] = [];
for (const l of longues) {
  const t = med([0, 1, 2].map(() => ms(() => jouer(l.c, l.ev))));
  msParTick.push(t / l.ticks);
}
const cout = med(msParTick);
for (const minutes of [5, 10, 15, 20]) {
  const ticks = minutes * 60 * TICKS_PAR_SECONDE;
  const note = ticks > DUREE_MAX_TICKS ? " (extrapolé : au-delà de la durée maximale)" : "";
  console.log(`  ${minutes} min = ${ticks} pas : ≈ ${(cout * ticks).toFixed(0)} ms${note}`);
}
console.log(`  ${(1 / cout / 1000).toFixed(2)} millions de pas par seconde`);

// lot PBG2 : une partie riche en multibilles (trois billes en jeu, des collisions entre elles) coûte plus par pas qu'une partie à une bille : on rejoue de vraies parties du robot de 15 minutes, avec des multibilles, jusqu'à la fin
console.log("— lot PBG2 : coût d'un rejeu de 15 minutes, avec des multibilles (le serveur, parties du robot de 15 minutes)");
const riches: { nom: string; ev: Evenement[]; c: ReturnType<typeof dailyPinball> }[] = [];
for (let i = 0; i < 12 && riches.length < 4; i++) {
  const c = dailyPinball(premier + 5 * i + 1);
  const r = jouerRobot(c, 1 + i, { maxTicks: DUREE_MAX_TICKS });
  if (r.partie.multibilles >= 3) riches.push({ nom: `${c.theme}:${c.plan} (${r.partie.multibilles} multibilles, ${r.partie.jackpotsPartie} jackpots, fin à ${(r.partie.tick / TICKS_PAR_SECONDE / 60).toFixed(1)} min)`, ev: r.evenements, c });
}
for (const l of riches) {
  const ticks = jouer(l.c, l.ev).ticks;
  const t = med([0, 1, 2].map(() => ms(() => jouer(l.c, l.ev))));
  console.log(`  ${l.nom} : ${ticks} pas rejoués en ${t.toFixed(0)} ms (${(ticks / t / 1000).toFixed(2)} millions de pas par seconde), ${enregistrer(l.c, l.ev).length} caractères`);
}

console.log("— taille d'une rediffusion de 10 minutes");
const robot3 = jouerRobot(dailyPinball(premier + 4), 1, { maxTicks: ROBOT_PAS });
for (const [nom, ev, jour] of [
  ["robot (3 minutes)", robot3.evenements, premier + 4],
  ["joueur nerveux 2 appuis/s par batteur", nerveux(10, 2, 1), premier],
  ["joueur nerveux 4 appuis/s par batteur", nerveux(10, 4, 2), premier],
  ["joueur nerveux 5 appuis/s par batteur (le plus vite possible)", nerveux(10, 5, 3), premier],
] as const) {
  const code = enregistrer(dailyPinball(jour), ev);
  console.log(`  ${nom} : ${ev.length} événements, ${code.length} caractères (relu : ${decoderRediffusion(code).evenements.length})`);
}

console.log("— parties par seconde (le robot, tables des 12 premiers jours, 3 minutes de jeu au plus)");
let parties = 0;
let pas = 0;
const t0 = performance.now();
for (let i = 0; i < 12; i++) {
  const p = jouerRobot(dailyPinball(premier + i), 1 + i, { maxTicks: ROBOT_PAS });
  parties++;
  pas += p.partie.tick;
}
const s = (performance.now() - t0) / 1000;
console.log(`  ${parties} parties, ${pas} pas en ${s.toFixed(1)} s : ${(parties / s).toFixed(1)} parties/s, durée moyenne ${(pas / parties / TICKS_PAR_SECONDE).toFixed(0)} s de jeu, ${(pas / s / 1e6).toFixed(2)} millions de pas/s (robot compris)`);
