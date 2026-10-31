// Lot 56 — l'ambiance de la Ville : le grondement diffus de la circulation (un fond grave et large, un chuintement de pneus sur le bitume mouillé), des voitures qui passent de
// gauche à droite ou de droite à gauche (un bruit qui monte puis s'éloigne), et de temps en temps un coup de klaxon, au loin.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, SR, alea, bruitRose, courbeAlea, ecrireNote, entre, filtrer, rendreLit, type Alea } from "../kit";

/** Une voiture qui passe : un chuintement de pneus dont la bande monte puis descend, un ronflement de moteur grave, sous une enveloppe en cloche (de plus en plus fort, puis plus loin). */
function passage(a: Alea, dur: number): Float32Array {
  const n = Math.round(dur * SR);
  const x = new Float32Array(n);
  const rose = bruitRose(n, a);
  const hauteur = entre(a, 0.8, 1.3);
  // Le chuintement : trois bandes passées en parallèle (le centre de chacune monte à l'approche, descend à l'éloignement).
  for (const [f, q, g] of [[520, 1.1, 1], [1100, 0.9, 0.6], [2200, 0.8, 0.28]] as const) {
    const m = n >> 3;
    for (let k = 0; k < 8; k++) {
      const u = (k + 0.5) / 8;
      const bosse = 1 + 0.45 * Math.sin(Math.PI * u) - 0.25 * u; // monte à l'approche, retombe plus bas à l'éloignement
      const morceau = filtrer(rose.subarray(k * m, (k + 1) * m + 1), "bandpass", f * hauteur * bosse, q);
      for (let i = 0; i < m; i++) x[k * m + i] = x[k * m + i]! + morceau[i]! * g;
    }
  }
  // Le moteur : une note grave qui glisse un peu (effet Doppler).
  const moteur = new Float32Array(n);
  ecrireNote(moteur, { t: 0, dur, f0: 95 * hauteur * 1.1, f1: 95 * hauteur * 0.8, partiels: [[1, 1], [2, 0.7], [3, 0.5], [4, 0.3]], attaque: 0.5, fenetre: 1, amp: 0.5 });
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const env = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 2);
    x[i] = (x[i]! * 5 + moteur[i]! * 0.7) * env;
  }
  return x;
}

/** Un klaxon : deux notes (une tierce) d'une trompe de voiture, carrées et légèrement désaccordées, une ou deux fois. */
function klaxon(a: Alea, coups: number): Float32Array {
  const x = new Float32Array(Math.round((0.5 * coups + 0.8) * SR));
  const f = entre(a, 380, 480);
  const impulsions = [[1, 1], [3, 0.33], [5, 0.2], [7, 0.14], [9, 0.1]] as const;
  for (let i = 0; i < coups; i++) {
    const t = 0.02 + i * (0.34 + a() * 0.15);
    const dur = i === coups - 1 ? 0.32 + a() * 0.3 : 0.16 + a() * 0.1;
    ecrireNote(x, { t, dur, f0: f, partiels: impulsions, attaque: 0.05, fenetre: 0.35, amp: 0.4 });
    ecrireNote(x, { t, dur, f0: f * 1.26, partiels: impulsions, attaque: 0.05, fenetre: 0.35, amp: 0.4 });
  }
  return filtrer(x, "lowpass", 2400, 0.7);
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const lit = await rendreLit(
    18,
    20261107,
    (a, sortie, r) => {
      // Le fond : le grondement grave de la circulation lointaine, qui houle.
      const grave = r.bq("lowpass", 210, 0.7);
      const g1 = r.g(0);
      r.suivre(g1.gain, courbeAlea(a, r.duree, 4.5, 0.03, 0.09), 0);
      r.brun(a).connect(grave).connect(g1).connect(sortie);
      // Le chuintement large de mille pneus.
      const bande = r.bq("bandpass", 900, 0.5);
      r.suivre(bande.frequency, courbeAlea(a, r.duree, 6, 600, 1300), 0);
      const g2 = r.g(0);
      r.suivre(g2.gain, courbeAlea(a, r.duree, 3.6, 0.35, 1, 1.3), 0);
      r.bruit(a).connect(bande).connect(g2).connect(sortie);
      // Un ronronnement de ventilation, tout bas.
      const v = r.osc("sawtooth", 58);
      const fv = r.bq("lowpass", 240, 0.6);
      const gv = r.g(0.05);
      v.connect(fv).connect(gv).connect(sortie);
    },
    0.06,
    true,
    70,
  );
  const a = alea(6060);
  const banque = new ConstructeurBanque();
  for (const d of [2.6, 3.2, 4, 3.6]) await banque.ajouter("voiture", passage(a, d));
  for (const c of [1, 1, 2, 3]) await banque.ajouter("klaxon", klaxon(a, c));
  return {
    theme: "ville",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    banque: banque.construire(),
    flux: [
      { nom: "voiture", ecart: [4, 10], premier: [1.5, 4], gain: [0.2, 0.42], pan: [-0.85, 0.85], balayage: [-0.9, 0.9], hauteur: [0.9, 1.15], coupure: 5000 },
      { nom: "klaxon", ecart: [22, 48], premier: [8, 16], gain: [0.16, 0.3], pan: [-0.9, 0.9], hauteur: [0.92, 1.1], coupure: 3500 },
    ],
    reactions: {},
  };
}
