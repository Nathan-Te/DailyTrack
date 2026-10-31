// Lot 56 — l'ambiance de la Campagne : des oiseaux de plusieurs espèces (une mésange, un merle, une tourterelle, un pinson), des insectes qui stridulent dans l'herbe, une brise
// légère, et une cloche au loin.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, SR, alea, courbeAlea, FONDU, ecrireCloche, ecrireNote, echo, entre, filtrer, parmi, rendreLit, respirer, type Alea } from "../kit";

/** Une mésange : « ti-ti-ti-tuu », de petites notes aiguës qui plongent. */
function mesange(a: Alea): Float32Array {
  const x = new Float32Array(Math.round(1.3 * SR));
  const n = 3 + Math.floor(a() * 3);
  let t = 0.02;
  const f = entre(a, 4300, 5200);
  for (let i = 0; i < n; i++) {
    ecrireNote(x, { t, dur: 0.075, f0: f * (1 + 0.04 * (i % 2)), f1: f * 0.74, partiels: [[1, 1], [2, 0.14]], attaque: 0.2, amp: 0.5 });
    t += 0.115 + a() * 0.03;
  }
  ecrireNote(x, { t: t + 0.02, dur: 0.22, f0: f * 0.7, f1: f * 0.52, partiels: [[1, 1]], attaque: 0.3, amp: 0.5 });
  return echo(x, 0.22, 2, 0.3, 4200);
}

/** Un merle : une phrase flûtée de notes qui montent et descendent, des silences entre les motifs. */
function merle(a: Alea): Float32Array {
  const x = new Float32Array(Math.round(3.2 * SR));
  let t = 0.05;
  let f = entre(a, 1500, 2100);
  const n = 7 + Math.floor(a() * 4);
  for (let i = 0; i < n; i++) {
    const dur = 0.09 + a() * 0.22;
    const f1 = f * (0.7 + a() * 0.75);
    ecrireNote(x, { t, dur, f0: f, f1, partiels: [[1, 1], [2, 0.22], [3, 0.06]], vib: i % 3 === 0 ? [34, 0.01] : undefined, attaque: 0.2, amp: 0.5 });
    t += dur + (a() < 0.25 ? 0.28 + a() * 0.2 : 0.03 + a() * 0.05);
    f = Math.min(2900, Math.max(1100, f1 * (0.9 + a() * 0.25)));
  }
  return echo(x, 0.28, 2, 0.28, 3600);
}

/** Une tourterelle : « hou-hou-hou », trois notes graves et rondes. */
function tourterelle(a: Alea): Float32Array {
  const x = new Float32Array(Math.round(1.8 * SR));
  const f = entre(a, 480, 620);
  ecrireNote(x, { t: 0.05, dur: 0.2, f0: f * 0.85, f1: f * 1.05, partiels: [[1, 1], [2, 0.2]], attaque: 0.35, amp: 0.5 });
  for (let i = 0; i < 3; i++) ecrireNote(x, { t: 0.42 + i * 0.3, dur: 0.24, f0: f * 1.02, f1: f * 0.92, partiels: [[1, 1], [2, 0.18]], attaque: 0.3, amp: 0.5 });
  return echo(x, 0.3, 2, 0.28, 2000);
}

/** Un pinson : un trille rapide qui descend, puis une petite fioriture. */
function pinson(a: Alea): Float32Array {
  const x = new Float32Array(Math.round(2.2 * SR));
  const n = 14 + Math.floor(a() * 5);
  let f = entre(a, 5000, 5800);
  let t = 0.02;
  for (let i = 0; i < n; i++) {
    ecrireNote(x, { t, dur: 0.04, f0: f, f1: f * 0.8, partiels: [[1, 1]], attaque: 0.3, amp: 0.45 });
    t += 0.062 - 0.0008 * i;
    f *= 0.975;
  }
  ecrireNote(x, { t: t + 0.04, dur: 0.18, f0: 2200, f1: 4200, partiels: [[1, 1], [2, 0.2]], attaque: 0.2, amp: 0.5 });
  ecrireNote(x, { t: t + 0.24, dur: 0.1, f0: 4000, f1: 2900, partiels: [[1, 1]], attaque: 0.2, amp: 0.45 });
  return echo(x, 0.25, 2, 0.28, 4500);
}

/** Les insectes : `nb` stridulations (des grappes d'impulsions rapides sur une porteuse aiguë), chacune son tempo, sa hauteur, ses silences ; le tout dans l'herbe. Une boucle par grappe : seuls les échantillons qui sonnent sont calculés. */
async function insectes(a: Alea, secondes: number, nb: number): Promise<Float32Array> {
  const n = Math.round(secondes * SR);
  const x = new Float32Array(n);
  for (let k = 0; k < nb; k++) {
    const f0 = entre(a, 5300, 7400);
    const cadence = entre(a, 38, 74);
    const cycle = entre(a, 0.9, 2.6);
    const duree = cycle * entre(a, 0.32, 0.6);
    const amp = entre(a, 0.35, 1);
    let ph = 0;
    for (let debut = -a() * cycle; debut < secondes; debut += cycle) {
      const w = (2 * Math.PI * f0 * (1 + 0.012 * (a() - 0.5))) / SR;
      const i0 = Math.max(0, Math.round(debut * SR));
      const i1 = Math.min(n, Math.round((debut + duree) * SR));
      for (let i = i0; i < i1; i++) {
        const t = i / SR;
        const u = (t - debut) / duree;
        const grappe = 4 * u * (1 - u);
        const p = t * cadence - Math.floor(t * cadence);
        const s = p < 0.5 ? 4 * p * (1 - 2 * p) * 2 : 0; // une bosse par période (parabole), puis le silence
        ph += w;
        x[i] = x[i]! + amp * grappe * s * s * Math.sin(ph);
      }
    }
    await respirer();
  }
  return x;
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const a = alea(4242);
  const ins = await insectes(alea(777), 18 + FONDU, 7);
  const lit = await rendreLit(
    18,
    20261104,
    (b, sortie, r) => {
      // La brise : un souffle doux et lent, tout bas.
      const brise = r.bq("lowpass", 520, 0.5);
      r.suivre(brise.frequency, courbeAlea(b, r.duree, 5, 260, 760), 0);
      const g = r.g(0);
      r.suivre(g.gain, courbeAlea(b, r.duree, 5, 0.25, 1, 1.3), 0);
      r.bruit(b).connect(brise).connect(g).connect(sortie);
      // Un frisson dans le feuillage.
      const feuilles = r.bq("bandpass", 2600, 0.8);
      const gf = r.g(0);
      r.suivre(gf.gain, courbeAlea(b, r.duree, 3.4, 0, 0.18, 2), 0);
      r.bruit(b).connect(feuilles).connect(gf).connect(sortie);
      // Les insectes (le canal droit est le même champ décalé : large).
      const gi = r.g(0.1);
      r.brut(filtrer(ins, "highpass", 3800, 0.7)).connect(gi).connect(sortie);
    },
    0.05,
  );
  const banque = new ConstructeurBanque();
  for (let i = 0; i < 3; i++) await banque.ajouter("mesange", mesange(a));
  for (let i = 0; i < 3; i++) await banque.ajouter("merle", merle(a));
  for (let i = 0; i < 3; i++) await banque.ajouter("tourterelle", tourterelle(a));
  for (let i = 0; i < 3; i++) await banque.ajouter("pinson", pinson(a));
  // La cloche d'un village, au loin : un, deux, ou trois coups.
  for (const coups of [1, 2, 3]) {
    const x = new Float32Array(Math.round((2.6 + coups * 1.4) * SR));
    for (let i = 0; i < coups; i++) ecrireCloche(x, 0.03 + i * 1.5, parmi(a, [392, 330, 440] as const), 2.5, 0.4);
    await banque.ajouter("cloche", filtrer(x, "lowpass", 2200, 0.6));
  }
  return {
    theme: "campagne",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    banque: banque.construire(),
    flux: [
      { nom: "mesange", ecart: [5, 12], premier: [1.5, 4], gain: [0.25, 0.5], pan: [-0.9, 0.9], hauteur: [0.9, 1.12], coupure: 9000 },
      { nom: "merle", ecart: [11, 24], premier: [4, 9], gain: [0.25, 0.45], pan: [-0.8, 0.8], hauteur: [0.9, 1.1], coupure: 6500 },
      { nom: "tourterelle", ecart: [18, 40], premier: [8, 15], gain: [0.25, 0.4], pan: [-0.7, 0.7], hauteur: [0.92, 1.08], coupure: 3500 },
      { nom: "pinson", ecart: [10, 22], premier: [3, 7], gain: [0.22, 0.42], pan: [-0.9, 0.9], hauteur: [0.9, 1.1], coupure: 9000 },
      { nom: "cloche", ecart: [40, 80], premier: [14, 26], gain: [0.3, 0.5], pan: [-0.7, 0.7], hauteur: [1, 1], coupure: 2400 },
    ],
    reactions: {},
  };
}
