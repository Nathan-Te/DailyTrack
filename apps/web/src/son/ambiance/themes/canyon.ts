// Lot 56 — l'ambiance du Canyon : des rafales qui s'engouffrent entre les parois (grondement creux, souffle, « tuyau d'orgue » du vent dans la roche) et un écho qui revient ;
// un cri lointain et des pierres qui roulent, répétés par l'écho des parois.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, SR, alea, courbeAlea, ecrireClic, ecrireNote, echo, entre, filtrer, bruitRose, rendreLit, type Alea } from "../kit";

/** Un cri de corbeau, âpre : une note de scie à formants qui retombe, deux fois ; l'écho des parois le rend trois fois, de plus en plus sourd. */
function corbeau(a: Alea, coups: number): Float32Array {
  const x = new Float32Array(Math.round(0.9 * SR));
  const f = entre(a, 380, 520);
  const partiels = [[1, 1], [2, 0.8], [3, 0.7], [4, 0.55], [5, 0.4], [6, 0.3], [7, 0.2]] as const;
  for (let i = 0; i < coups; i++) {
    ecrireNote(x, { t: 0.03 + i * 0.36, dur: 0.3, f0: f * 1.06, f1: f * 0.82, partiels, vib: [70, 0.04], attaque: 0.12, amp: 0.4 });
  }
  const formants = filtrer(x, "bandpass", 1150, 1.4);
  for (let i = 0; i < x.length; i++) x[i] = x[i]! * 0.4 + formants[i]! * 1.4;
  return echo(x, 0.52, 4, 0.52, 2100);
}

/** Des pierres qui dévalent une paroi : une cascade de chocs sourds, de plus en plus proches, l'écho derrière. */
function pierres(a: Alea): Float32Array {
  const x = new Float32Array(Math.round(1.4 * SR));
  let t = 0.02;
  let pas = 0.09;
  for (let i = 0; i < 22; i++) {
    const f = entre(a, 380, 1500);
    ecrireClic(x, t, 0.012 + a() * 0.02, f, 2.5, 0.35 + a() * 0.65, a);
    ecrireNote(x, { t, dur: 0.05, f0: f * 0.45, f1: f * 0.25, attaque: 0.05, fenetre: 2, amp: 0.25 });
    t += pas * (0.5 + a());
    pas *= 0.93;
  }
  return echo(x, 0.47, 3, 0.5, 1900);
}

/** Un coup de vent dans une anfractuosité : un souffle creux qui monte et retombe (une seule fois). */
function sifflement(a: Alea, dur: number): Float32Array {
  const x = new Float32Array(Math.round(dur * SR));
  const f = entre(a, 380, 620);
  const b = filtrer(bruitRose(x.length, a), "bandpass", f, 9);
  for (let i = 0; i < x.length; i++) x[i] = b[i]! * Math.pow(Math.sin((Math.PI * i) / x.length), 1.5) * 4;
  return echo(x, 0.43, 3, 0.55, 1700);
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const lit = await rendreLit(
    20,
    20261105,
    (a, sortie, r) => {
      // Les rafales du canyon : amples, lentes, de vrais creux de silence entre elles.
      const rafale = courbeAlea(a, r.duree, 6, 0.05, 1, 1.8);
      const grave = r.bq("bandpass", 230, 1.6);
      r.suivre(grave.frequency, courbeAlea(a, r.duree, 7, 140, 380), 0);
      const g1 = r.g(0);
      r.suivre(g1.gain, rafale, 0);
      r.bruit(a).connect(grave).connect(g1);
      const souffle = r.bq("bandpass", 900, 0.9);
      r.suivre(souffle.frequency, courbeAlea(a, r.duree, 5, 520, 1500), 0);
      const g2 = r.g(0);
      r.suivre(g2.gain, courbeAlea(a, r.duree, 6, 0, 0.55, 2), 0);
      r.bruit(a).connect(souffle).connect(g2);
      // Le tuyau d'orgue de la roche : deux fréquences creuses (≈ 140 et 210 Hz), étroites, qui montent avec la rafale.
      const mix = r.g(1);
      g1.connect(mix);
      g2.connect(mix);
      for (const f0 of [143, 212]) {
        const tuyau = r.bq("bandpass", f0, 26);
        r.suivre(tuyau.frequency, courbeAlea(a, r.duree, 8, f0 * 0.93, f0 * 1.08), 0);
        const gt = r.g(0);
        r.suivre(gt.gain, courbeAlea(a, r.duree, 6, 0, 0.5, 2.4), 0);
        r.bruit(a).connect(tuyau).connect(gt).connect(mix);
      }
      // L'écho des parois : une ligne à retard (0,47 s) avec un passe-bas dans la boucle ; le son direct reste devant.
      const retard = r.ctx.createDelay(1);
      retard.delayTime.value = 0.47;
      const boucle = r.g(0.42);
      const sombre = r.bq("lowpass", 1400, 0.5);
      mix.connect(sortie);
      mix.connect(retard);
      retard.connect(sombre).connect(boucle).connect(retard);
      sombre.connect(sortie);
    },
    0.06,
  );
  const a = alea(3131);
  const banque = new ConstructeurBanque();
  for (const coups of [1, 2, 2, 3]) await banque.ajouter("corbeau", corbeau(a, coups));
  for (let i = 0; i < 3; i++) await banque.ajouter("pierres", pierres(a));
  for (const d of [1.1, 1.6, 2.1]) await banque.ajouter("sifflement", sifflement(a, d));
  return {
    theme: "canyon",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    banque: banque.construire(),
    flux: [
      { nom: "corbeau", ecart: [18, 40], premier: [6, 13], gain: [0.2, 0.36], pan: [-0.85, 0.85], hauteur: [0.9, 1.1], coupure: 3500 },
      { nom: "pierres", ecart: [24, 50], premier: [10, 20], gain: [0.16, 0.3], pan: [-0.9, 0.9], hauteur: [0.9, 1.1], coupure: 3000 },
      { nom: "sifflement", ecart: [10, 22], premier: [3, 8], gain: [0.18, 0.34], pan: [-0.8, 0.8], hauteur: [0.9, 1.1], coupure: 2800 },
    ],
    reactions: {},
  };
}
