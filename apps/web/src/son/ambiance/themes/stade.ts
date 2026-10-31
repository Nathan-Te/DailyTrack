// Lot 56 — l'ambiance du Stade : une rumeur de foule lointaine (du babil : des voix de bruit passées dans des formants de voyelles, au rythme de syllabes irrégulières,
// sous un passe-bas qui l'éloigne), la grande rumeur de la tribune de départ (la couche liée au décor), la clameur d'un point de contrôle et l'ovation de l'arrivée
// (voix, puis applaudissements).
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, Rendu, SR, alea, babil, courbeAlea, courbeEnveloppe, crete, ecrireClic, normaliserCrete, rendreLit } from "../kit";

/** Une salve d'applaudissements : `n` claquements entre `t0` et `t0 + dur`, plus nombreux au milieu. */
function applaudissements(sortie: Float32Array, a: ReturnType<typeof alea>, t0: number, dur: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const u = (a() + a() + a()) / 3; // plus dense au centre
    ecrireClic(sortie, t0 + u * dur, 0.018 + a() * 0.014, 1800 + a() * 2600, 1.1, 0.25 + a() * 0.5, a);
  }
}

/** Une clameur ou une ovation rendue hors ligne : des voix en foule dont le volume monte, tient et retombe, puis les applaudissements. */
async function acclamation(graine: number, dur: number, voix: number, montee: number, claps: number): Promise<Float32Array> {
  const r = new Rendu(dur, 0);
  const a = alea(graine);
  babil(r, alea(graine + 1), r.ctx.destination, { voix, syllabe: [2.5, 4.5], formants: [[420, 900], [1000, 2500]], brillance: 4200, enveloppe: courbeEnveloppe(dur, montee, dur * 0.45, 1) });
  const x = (await r.lire(false))[0]!;
  // Les voix sont ramenées à une crête de 0,6, les claquements ajoutés par-dessus, plus clairs.
  const m = crete(x);
  for (let i = 0; i < x.length; i++) x[i] = (x[i]! / (m || 1)) * 0.6;
  applaudissements(x, a, dur * 0.18, dur * 0.7, claps);
  return x;
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  // Le lit : la foule lointaine, un murmure dense et lent, de grandes houles de rumeur.
  const lit = await rendreLit(
    12,
    20261031,
    (a, sortie, r) => {
      const houle = r.g(0);
      r.suivre(houle.gain, courbeAlea(a, r.duree, 5.5, 0.5, 1), 0);
      babil(r, a, houle, { voix: 10, syllabe: [3, 5.5], brillance: 2600 });
      // Le grondement bas de la masse (brun, passe-bas) et le souffle des voix aiguës, bien en dessous.
      const bas = r.bq("lowpass", 380, 0.6);
      const gbas = r.g(0);
      r.suivre(gbas.gain, courbeAlea(a, r.duree, 3.2, 0.01, 0.04), 0);
      r.brun(a).connect(bas).connect(gbas).connect(houle);
      houle.connect(sortie);
    },
    0.06,
  );
  // La tribune de départ (couche liée au décor) : plus près, plus de voix, plus claire, des houles plus fortes.
  const tribune = await rendreLit(
    10,
    20261101,
    (a, sortie, r) => {
      const houle = r.g(0);
      r.suivre(houle.gain, courbeAlea(a, r.duree, 2.4, 0.35, 1, 1.4), 0);
      babil(r, a, houle, { voix: 14, syllabe: [3, 6], formants: [[300, 850], [950, 2800]], brillance: 4600 });
      houle.connect(sortie);
    },
    0.1,
  );
  const banque = new ConstructeurBanque();
  for (let i = 0; i < 2; i++) await banque.ajouter("clameur", await acclamation(31 + i, 2.4, 10, 0.35, 30));
  await banque.ajouter("ovation", await acclamation(71, 5.5, 14, 0.9, 110));
  // Quelques salves de claquements isolés, loin dans la foule (rares, très discrètes).
  const a = alea(5150);
  for (let i = 0; i < 3; i++) {
    const x = new Float32Array(Math.round(0.9 * SR));
    for (let k = 0; k < 14; k++) ecrireClic(x, a() * 0.7, 0.012 + a() * 0.01, 1500 + a() * 3000, 1.2, 0.3 + a() * 0.4, a);
    await banque.ajouter("claps", normaliserCrete(x));
  }
  return {
    theme: "stade",
    niveau: 0.6,
    lit,
    deuxLectures: true,
    local: { canaux: tribune, base: 0.12 },
    banque: banque.construire(),
    flux: [{ nom: "claps", ecart: [9, 20], premier: [4, 9], gain: [0.1, 0.22], pan: [-0.8, 0.8], hauteur: [0.9, 1.15], coupure: 5200 }],
    reactions: { checkpoint: { nom: "clameur", gain: 0.9 }, finish: { nom: "ovation", gain: 1 } },
  };
}
