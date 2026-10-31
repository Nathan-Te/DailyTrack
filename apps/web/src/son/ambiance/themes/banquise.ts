// Lot 56 — l'ambiance de la Banquise : un vent froid, fin et sifflant, et la glace qui travaille — des « pings » qui plongent (la glace d'un lac qui se fend), des craquements secs,
// et de longs gémissements graves.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, alea, courbeAlea, ecrireClic, ecrireNote, entre, filtrer, rendreLit, SR, bruitRose } from "../kit";

/** Le « ping » d'une fissure qui court sous la glace : une note qui plonge très vite (3 à 4 kHz vers 700 Hz), répétée de plus en plus bas et de plus en plus vite. */
function ping(a: ReturnType<typeof alea>, n: number): Float32Array {
  const x = new Float32Array(Math.round((0.35 * n + 0.5) * SR));
  let t = 0.01;
  let f = entre(a, 2900, 4300);
  let pas = entre(a, 0.11, 0.18);
  for (let i = 0; i < n; i++) {
    ecrireClic(x, t, 0.01, 5200, 0.8, 0.6, a);
    ecrireNote(x, { t, dur: 0.2 + 0.05 * (n - i), f0: f, f1: f * 0.22, partiels: [[1, 1], [1.5, 0.18]], attaque: 0.02, fenetre: 2.2, amp: 0.55 });
    t += pas;
    pas *= 0.86;
    f *= 0.9;
  }
  return x;
}

/** Un craquement sec : un éclat aigu, puis des éclats plus petits en cascade. */
function craquement(a: ReturnType<typeof alea>): Float32Array {
  const x = new Float32Array(Math.round(0.9 * SR));
  ecrireClic(x, 0.02, 0.02, 3800, 0.7, 1, a);
  ecrireClic(x, 0.025, 0.07, 900, 1.2, 0.6, a);
  let t = 0.06;
  for (let i = 0; i < 9; i++) {
    ecrireClic(x, t, 0.006 + a() * 0.01, 2500 + a() * 3000, 1.6, 0.35 * Math.exp(-i / 3.5), a);
    t += 0.025 + a() * 0.07;
  }
  return x;
}

/** Le gémissement de la glace : un grave qui glisse (60 → 38 Hz) avec des harmoniques grinçantes et un frottement. */
function gemissement(a: ReturnType<typeof alea>, dur: number): Float32Array {
  const x = new Float32Array(Math.round(dur * SR));
  const f = entre(a, 62, 90);
  ecrireNote(x, { t: 0, dur, f0: f, f1: f * 0.55, partiels: [[1, 1], [2, 0.7], [3, 0.5], [5, 0.25], [7, 0.12]], vib: [entre(a, 3, 7), 0.035], attaque: 0.45, fenetre: 1.2, amp: 0.5 });
  const bruit = filtrer(bruitRose(x.length, a), "bandpass", 240, 3);
  for (let i = 0; i < x.length; i++) x[i] = x[i]! + bruit[i]! * 0.5 * Math.sin((Math.PI * i) / x.length);
  return x;
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const lit = await rendreLit(
    18,
    20261103,
    (a, sortie, r) => {
      const rafale = courbeAlea(a, r.duree, 4, 0.25, 1, 1.4);
      // Le vent froid : plus fin et plus haut que celui du Rallye — passe-haut, bande étroite qui monte et descend.
      const hp = r.bq("highpass", 380, 0.6);
      const bande = r.bq("bandpass", 1100, 0.9);
      r.suivre(bande.frequency, courbeAlea(a, r.duree, 4.4, 650, 1700), 0);
      const g = r.g(0);
      r.suivre(g.gain, rafale, 0);
      r.bruit(a).connect(hp).connect(bande).connect(g).connect(sortie);
      // Deux sifflements fins, étroits et mobiles, dans les rafales : le vent dans la glace.
      for (const [f0, f1, pic] of [[1500, 2300, 0.2], [2700, 3700, 0.1]] as const) {
        const sif = r.bq("bandpass", f0, 22);
        r.suivre(sif.frequency, courbeAlea(a, r.duree, 5.5, f0, f1), 0);
        const gs = r.g(0);
        r.suivre(gs.gain, courbeAlea(a, r.duree, 3.6, 0, pic, 2.2), 0);
        r.bruit(a).connect(sif).connect(gs).connect(sortie);
      }
      // Un souffle grave très bas, comme l'étendue qui respire.
      const bas = r.bq("lowpass", 160, 0.7);
      const gb = r.g(0.07);
      r.brun(a).connect(bas).connect(gb).connect(sortie);
    },
    0.055,
  );
  const a = alea(9091);
  const banque = new ConstructeurBanque();
  for (const n of [2, 3, 4, 5]) await banque.ajouter("ping", ping(a, n));
  for (let i = 0; i < 4; i++) await banque.ajouter("craquement", craquement(a));
  for (const d of [1.3, 1.8, 2.4]) await banque.ajouter("gemissement", gemissement(a, d));
  return {
    theme: "banquise",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    banque: banque.construire(),
    flux: [
      { nom: "ping", ecart: [9, 22], premier: [3, 8], gain: [0.18, 0.4], pan: [-0.85, 0.85], hauteur: [0.85, 1.2], coupure: 8000 },
      { nom: "craquement", ecart: [8, 18], premier: [5, 11], gain: [0.16, 0.34], pan: [-0.8, 0.8], hauteur: [0.9, 1.1], coupure: 7000 },
      { nom: "gemissement", ecart: [18, 38], premier: [8, 16], gain: [0.22, 0.4], pan: [-0.6, 0.6], hauteur: [0.85, 1.15], coupure: 3000 },
    ],
    reactions: {},
  };
}
