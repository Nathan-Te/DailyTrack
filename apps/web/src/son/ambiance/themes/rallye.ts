// Lot 56 — l'ambiance du Rallye : un vent sec qui souffle par rafales sur les cailloux, des graviers qui roulent, un rapace au loin.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, SR, alea, courbeAlea, ecrireClic, ecrireNote, echo, entre, normaliserCrete, rendreLit } from "../kit";

/** Des graviers qui roulent : des claquements secs et minuscules, d'abord rapprochés puis de plus en plus espacés (la pierre qui s'arrête). */
function graviers(a: ReturnType<typeof alea>, dur: number): Float32Array {
  const x = new Float32Array(Math.round(dur * SR));
  let t = 0.02;
  let pas = 0.012 + a() * 0.02;
  while (t < dur - 0.05) {
    ecrireClic(x, t, 0.004 + a() * 0.006, 2200 + a() * 2800, 1.4, 0.3 + a() * 0.7, a);
    t += pas;
    pas *= 1.08 + a() * 0.18; // le roulement ralentit
  }
  return x;
}

/** Le cri d'un rapace : un « kiii-êr » à la voix claire et rauque (partiels, léger vibrato), qui monte puis retombe ; une réverbération simple le met au loin. */
function rapace(a: ReturnType<typeof alea>, dur: number, f: number): Float32Array {
  const x = new Float32Array(Math.round((dur + 0.4) * SR));
  const partiels = [[1, 1], [2, 0.5], [3, 0.28], [4, 0.12]] as const;
  ecrireNote(x, { t: 0.02, dur: dur * 0.45, f0: f * 0.82, f1: f * 1.12, partiels, vib: [26, 0.012], attaque: 0.25, amp: 0.5 });
  ecrireNote(x, { t: 0.02 + dur * 0.4, dur: dur * 0.6, f0: f * 1.12, f1: f * 0.62, partiels, vib: [20, 0.02], attaque: 0.08, amp: 0.45 });
  // Le souffle rauque de la voix.
  ecrireClic(x, 0.05, dur * 0.8, f * 1.5, 0.8, 0.05, a);
  return echo(x, 0.31, 3, 0.4, 2800);
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const lit = await rendreLit(
    18,
    20261102,
    (a, sortie, r) => {
      // Les rafales : une courbe lente et inégale, de rares pointes fortes.
      const rafale = courbeAlea(a, r.duree, 4.5, 0.18, 1, 1.6);
      // Le souffle sec : du bruit rose passe-bas dont la coupure monte avec la rafale.
      const souffle = r.bq("lowpass", 700, 0.6);
      r.suivre(souffle.frequency, courbeAlea(a, r.duree, 4.5, 450, 1900, 1.6), 0);
      const gs = r.g(0);
      r.suivre(gs.gain, rafale, 0);
      r.bruit(a).connect(souffle).connect(gs).connect(sortie);
      // Le frémissement de la broussaille et de l'herbe sèche : un bruissement aigu, seulement dans les rafales.
      const brou = r.bq("bandpass", 2300, 0.9);
      const gb = r.g(0);
      const rafale2 = courbeAlea(a, r.duree, 3.1, 0, 0.1, 1.8);
      r.suivre(gb.gain, rafale2, 0);
      r.bruit(a).connect(brou).connect(gb).connect(sortie);
      // Un sifflement ténu dans les rochers, quand le vent forcit.
      const sif = r.bq("bandpass", 1700, 14);
      r.suivre(sif.frequency, courbeAlea(a, r.duree, 6, 1250, 2300), 0);
      const gsif = r.g(0);
      r.suivre(gsif.gain, courbeAlea(a, r.duree, 5, 0, 0.11, 2.4), 0);
      r.bruit(a).connect(sif).connect(gsif).connect(sortie);
    },
    0.06,
  );
  const a = alea(7733);
  const banque = new ConstructeurBanque();
  for (let i = 0; i < 5; i++) await banque.ajouter("graviers", graviers(a, entre(a, 0.7, 1.7)));
  for (const [dur, f] of [[1.0, 2300], [1.25, 1900], [0.8, 2650], [1.5, 2100]] as const) await banque.ajouter("rapace", rapace(a, dur, f));
  return {
    theme: "rallye",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    banque: banque.construire(),
    flux: [
      { nom: "graviers", ecart: [5, 12], premier: [2, 6], gain: [0.12, 0.3], pan: [-0.85, 0.85], hauteur: [0.85, 1.2], coupure: 7000 },
      { nom: "rapace", ecart: [16, 34], premier: [7, 14], gain: [0.2, 0.34], pan: [-0.7, 0.7], hauteur: [0.9, 1.1], coupure: 4000 },
    ],
    reactions: {},
  };
}
