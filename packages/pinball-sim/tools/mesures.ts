import { daysFromCivil } from "@cdj/core";
import { Rng } from "@cdj/core";
import { DROITE, DUREE_MAX_TICKS, GAUCHE, LANCEUR, MAX_EVENEMENTS, TICKS_PAR_SECONDE, dailyPinball, decoderRediffusion, enregistrer, jouer, piloter, rejouer, type Evenement } from "../src/index";

// `npm run mesures:pinball -w @cdj/pinball-sim` : les chiffres du README du lot PB1 (déterminisme, coût d'un rejeu, taille d'une rediffusion, parties par seconde du pilote). Aucune base, aucun réseau.
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

console.log("— déterminisme : le pilote joue pas à pas (le jeu), le serveur rejoue la rediffusion décodée");
let egaux = 0;
const JOURS = 40;
for (let i = 0; i < JOURS; i++) {
  const c = dailyPinball(premier + i);
  const { evenements, partie } = piloter(c, DUREE_MAX_TICKS);
  const serveur = rejouer(c, enregistrer(c, evenements));
  const ok = JSON.stringify(serveur) === JSON.stringify(partie.resultat());
  if (ok) egaux++;
  else console.log("  DIFFÉRENT", i, partie.resultat(), serveur);
}
console.log(`  ${egaux} / ${JOURS} jours : même score (client = serveur)`);

console.log("— coût d'un rejeu (le serveur, pilote d'essai qui survit à la bille)");
const longues = [] as { c: ReturnType<typeof dailyPinball>; ev: Evenement[]; ticks: number }[];
for (let i = 0; i < 80 && longues.length < 6; i++) {
  const c = dailyPinball(premier + i);
  const p = piloter(c, DUREE_MAX_TICKS);
  if (p.partie.tick >= 5 * 60 * TICKS_PAR_SECONDE) longues.push({ c, ev: p.evenements, ticks: p.partie.tick });
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

console.log("— taille d'une rediffusion de 10 minutes");
const pilote10 = piloter(dailyPinball(premier + 4), 10 * 60 * TICKS_PAR_SECONDE);
for (const [nom, ev, jour] of [
  ["pilote d'essai", pilote10.evenements, premier + 4],
  ["joueur nerveux 2 appuis/s par batteur", nerveux(10, 2, 1), premier],
  ["joueur nerveux 4 appuis/s par batteur", nerveux(10, 4, 2), premier],
  ["joueur nerveux 5 appuis/s par batteur (le plus vite possible)", nerveux(10, 5, 3), premier],
] as const) {
  const code = enregistrer(dailyPinball(jour), ev);
  console.log(`  ${nom} : ${ev.length} événements, ${code.length} caractères (relu : ${decoderRediffusion(code).evenements.length})`);
}

console.log("— parties par seconde (le pilote d'essai, tables des 60 premiers jours, partie entière)");
let parties = 0;
let pas = 0;
const t0 = performance.now();
for (let i = 0; i < 60; i++) {
  const p = piloter(dailyPinball(premier + i), DUREE_MAX_TICKS);
  parties++;
  pas += p.partie.tick;
}
const s = (performance.now() - t0) / 1000;
console.log(`  ${parties} parties, ${pas} pas en ${s.toFixed(1)} s : ${(parties / s).toFixed(1)} parties/s, durée moyenne ${(pas / parties / TICKS_PAR_SECONDE).toFixed(0)} s de jeu, ${(pas / s / 1e6).toFixed(2)} millions de pas/s (pilote compris)`);
