// Lot 56 — l'ambiance du Col alpin : le vent d'altitude, large et ample, qui passe en gros souffles sourds avec des sifflements hauts, et des sonnailles lointaines — des clarines de
// troupeau, de quelques coups espacés, de hauteurs différentes.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, SR, alea, courbeAlea, ecrireNote, entre, filtrer, parmi, rendreLit, type Alea } from "../kit";

/** Un coup de clarine : une cloche plate de métal, deux partiels inharmoniques qui claquent puis tintent, 0,3 à 0,7 s. */
function clarine(x: Float32Array, t0: number, f: number, amp: number): void {
  const dur = 0.35 + 250 / f;
  ecrireNote(x, { t: t0, dur, f0: f, f1: f * 0.995, partiels: [[1, 1], [2.42, 0.55], [3.9, 0.28], [5.6, 0.12]], attaque: 0.012, fenetre: 3.2, amp });
}

/** Une grappe de sonnailles : un troupeau qui avance — de 4 à 10 coups irréguliers, de deux ou trois cloches différentes, une pause de temps en temps. */
function sonnailles(a: Alea): Float32Array {
  const dur = 3.4;
  const x = new Float32Array(Math.round((dur + 0.8) * SR));
  const cloches = [parmi(a, [540, 610, 680] as const), parmi(a, [760, 830, 910] as const), parmi(a, [420, 470] as const)];
  let t = 0.03;
  const n = 5 + Math.floor(a() * 6);
  for (let i = 0; i < n; i++) {
    clarine(x, t, parmi(a, cloches), 0.35 + a() * 0.45);
    t += 0.13 + a() * 0.3 + (a() < 0.18 ? 0.45 : 0);
    if (t > dur) break;
  }
  return filtrer(x, "lowpass", 3600, 0.6);
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const lit = await rendreLit(
    20,
    20261106,
    (a, sortie, r) => {
      // Le grand vent : ample, sourd, des « whoumps » de rafale (grave) sous un souffle large.
      const rafale = courbeAlea(a, r.duree, 5, 0.15, 1, 1.5);
      const corps = r.bq("bandpass", 480, 0.55);
      r.suivre(corps.frequency, courbeAlea(a, r.duree, 5.5, 280, 800), 0);
      const g = r.g(0);
      r.suivre(g.gain, rafale, 0);
      r.bruit(a).connect(corps).connect(g).connect(sortie);
      const haut = r.bq("highpass", 1600, 0.6);
      const gh = r.g(0);
      r.suivre(gh.gain, courbeAlea(a, r.duree, 3.8, 0, 0.3, 2), 0);
      r.bruit(a).connect(haut).connect(gh).connect(sortie);
      // Un sifflement d'altitude, mince.
      const sif = r.bq("bandpass", 2300, 20);
      r.suivre(sif.frequency, courbeAlea(a, r.duree, 5, 1900, 3200), 0);
      const gs = r.g(0);
      r.suivre(gs.gain, courbeAlea(a, r.duree, 4, 0, 0.13, 2.2), 0);
      r.bruit(a).connect(sif).connect(gs).connect(sortie);
      // Le « whoump » du vent qui frappe : un grave sourd, dans les fortes rafales seulement.
      const whoump = r.bq("lowpass", 120, 0.8);
      const gw = r.g(0);
      r.suivre(gw.gain, courbeAlea(a, r.duree, 5, 0, 0.25, 3), 0);
      r.brun(a).connect(whoump).connect(gw).connect(sortie);
    },
    0.06,
  );
  const a = alea(8008);
  const banque = new ConstructeurBanque();
  for (let i = 0; i < 5; i++) await banque.ajouter("sonnailles", sonnailles(a));
  // Un sifflement de marmotte : bref, aigu, deux fois (rare).
  for (let i = 0; i < 2; i++) {
    const x = new Float32Array(Math.round(0.9 * SR));
    const f = entre(a, 2100, 2600);
    ecrireNote(x, { t: 0.03, dur: 0.25, f0: f * 0.8, f1: f * 1.15, partiels: [[1, 1], [2, 0.12]], attaque: 0.1, amp: 0.5 });
    ecrireNote(x, { t: 0.4, dur: 0.3, f0: f * 1.15, f1: f * 0.85, partiels: [[1, 1], [2, 0.1]], attaque: 0.1, amp: 0.5 });
    await banque.ajouter("marmotte", x);
  }
  return {
    theme: "col",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    banque: banque.construire(),
    flux: [
      { nom: "sonnailles", ecart: [9, 20], premier: [3, 8], gain: [0.14, 0.3], pan: [-0.9, 0.9], hauteur: [0.92, 1.1], coupure: 3500 },
      { nom: "marmotte", ecart: [30, 60], premier: [12, 24], gain: [0.18, 0.3], pan: [-0.8, 0.8], hauteur: [0.92, 1.08], coupure: 5000 },
    ],
    reactions: {},
  };
}
