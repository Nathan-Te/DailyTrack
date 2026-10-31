// Lot 56 — l'ambiance de la Nuit : des grillons (plusieurs, chacun son tempo et sa hauteur, en groupes de « tri-tri-tri »), un souffle de nuit, le bourdonnement électrique des lampadaires
// (la couche liée au décor : 100 Hz et ses harmoniques, le crépitement d'un arc) et, très rarement, une chouette.
import type { DonneesAmbiance } from "../donnees";
import { ConstructeurBanque, FONDU, SR, alea, courbeAlea, ecrireClic, ecrireNote, entre, filtrer, normaliserRms, rendreLit, respirer, type Alea } from "../kit";

/** Des grillons : `nb` insectes, chacun un « tri-tri-tri » de 3 ou 4 impulsions sur une porteuse de 4 à 5,3 kHz, répété à son rythme (2 à 4 groupes par seconde), avec ses silences. Une boucle par groupe : seuls les échantillons qui sonnent sont calculés. */
async function grillons(a: Alea, secondes: number, nb: number): Promise<Float32Array> {
  const n = Math.round(secondes * SR);
  const x = new Float32Array(n);
  for (let k = 0; k < nb; k++) {
    const f = entre(a, 4000, 5300);
    const groupe = 1 / entre(a, 2.2, 3.8); // durée d'un groupe (s)
    const impulsions = a() < 0.5 ? 3 : 4;
    const amp = entre(a, 0.4, 1);
    // Il se tait par moments (une à quatre secondes), comme tous les grillons : chacun son silence.
    const pause = entre(a, 6, 11);
    const silence = entre(a, 0.8, 2.6);
    const decalagePause = a() * pause;
    const w = (2 * Math.PI * f) / SR;
    let ph = 0;
    for (let debut = -a() * groupe; debut < secondes; debut += groupe) {
      if ((debut + decalagePause + pause * 10) % pause > pause - silence) continue;
      const dureeImpulsion = (groupe * 0.72) / (impulsions * 2 - 1); // une impulsion, un silence, une impulsion…
      for (let m = 0; m < impulsions; m++) {
        const t0 = debut + m * 2 * dureeImpulsion;
        const i0 = Math.max(0, Math.round(t0 * SR));
        const i1 = Math.min(n, Math.round((t0 + dureeImpulsion) * SR));
        for (let i = i0; i < i1; i++) {
          const u = (i / SR - t0) / dureeImpulsion;
          const s = 4 * u * (1 - u);
          ph += w;
          x[i] = x[i]! + amp * s * s * Math.sin(ph);
        }
      }
    }
    await respirer();
  }
  return x;
}

/** Le bourdonnement d'un lampadaire : 100 Hz et ses harmoniques (le secteur redressé), un grésillement fin, un crépitement d'arc de temps en temps. Rendu **périodique** (8 s : la forme d'onde se
 *  répète tous les 441 échantillons, la modulation tous les 8 s), pour que la boucle n'ait pas de couture. Le canal droit est le même son décalé. */
function bourdonnement(a: Alea, secondes: number): Float32Array[] {
  const n = Math.round(secondes * SR);
  const x = new Float32Array(n);
  // Une période de forme d'onde : 441 échantillons = deux périodes de 100 Hz (22 050 Hz ÷ 100 = 220,5).
  const harm: readonly (readonly [number, number])[] = [[100, 1], [200, 0.62], [300, 0.46], [400, 0.2], [500, 0.17], [700, 0.08], [900, 0.05]];
  const table = new Float32Array(441);
  for (let i = 0; i < 441; i++) for (const [f, g] of harm) table[i] = table[i]! + g * Math.sin((2 * Math.PI * f * i) / SR);
  // La modulation lente (0,125 Hz et 0,5 Hz : périodique sur 8 s), calculée toutes les 64 échantillons et interpolée.
  const BLOC = 64;
  const mod = (t: number) => 0.8 + 0.12 * Math.sin(2 * Math.PI * 0.125 * t) + 0.08 * Math.sin(2 * Math.PI * 0.5 * t + 2);
  let mA = mod(0);
  let mB = mod(BLOC / SR);
  for (let i = 0; i < n; i++) {
    const r = i % BLOC;
    if (i > 0 && r === 0) {
      mA = mB;
      mB = mod((i + BLOC) / SR);
    }
    x[i] = table[i % 441]! * (mA + (mB - mA) * (r / BLOC));
  }
  // Le grésillement : du bruit aigu coupé au rythme du secteur (100 Hz).
  const bruit = filtrer(new Float32Array(n).map(() => a() * 2 - 1), "bandpass", 3200, 1.2);
  for (let i = 0; i < n; i++) {
    const p = (i * 100) / SR;
    const s = Math.max(0, 1 - 2 * Math.abs(p - Math.floor(p) - 0.5)); // une dent de scie triangulaire à 100 Hz
    x[i] = x[i]! + bruit[i]! * 0.12 * s * s;
  }
  // Les arcs : quelques éclats, jamais plus de 6 sur la durée.
  const arcs = 3 + Math.floor(a() * 3);
  for (let k = 0; k < arcs; k++) {
    const t0 = a() * (secondes - 0.2);
    for (let j = 0; j < 5; j++) ecrireClic(x, t0 + j * 0.011 * (0.5 + a()), 0.006, 2800 + a() * 3000, 1.1, 0.2 + a() * 0.2, a);
  }
  const d = new Float32Array(n);
  const decalage = Math.round(n * 0.37);
  for (let i = 0; i < n; i++) d[i] = x[(i + decalage) % n]!;
  return [x, d];
}

/** Une chouette : « hou… hou-hou », trois notes graves, creuses, avec un léger glissé. */
function chouette(a: Alea): Float32Array {
  const x = new Float32Array(Math.round(2.4 * SR));
  const f = entre(a, 380, 460);
  ecrireNote(x, { t: 0.05, dur: 0.42, f0: f * 1.05, f1: f * 0.95, partiels: [[1, 1], [2, 0.18]], attaque: 0.3, amp: 0.5 });
  for (const t of [0.85, 1.3]) ecrireNote(x, { t, dur: 0.36, f0: f * 1.02, f1: f * 0.9, partiels: [[1, 1], [2, 0.15]], attaque: 0.28, amp: 0.5 });
  const e = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) e[i] = x[i]!;
  return filtrer(e, "lowpass", 1400, 0.6);
}

export async function fabriquer(): Promise<DonneesAmbiance> {
  const a = alea(1111);
  // Le lit : les grillons (un champ de 9), un souffle de nuit très bas.
  const grillonsPrets = await grillons(alea(2020), 16 + FONDU, 9);
  const lit = await rendreLit(
    16,
    20261108,
    (b, sortie, r) => {
      const air = r.bq("lowpass", 360, 0.5);
      const ga = r.g(0);
      r.suivre(ga.gain, courbeAlea(b, r.duree, 6, 0.1, 0.5), 0);
      r.bruit(b).connect(air).connect(ga).connect(sortie);
      r.brut(filtrer(grillonsPrets, "highpass", 3000, 0.7)).connect(sortie);
    },
    0.05,
  );
  const lampadaire = bourdonnement(alea(4040), 8);
  normaliserRms(lampadaire, 0.1);
  const banque = new ConstructeurBanque();
  for (let i = 0; i < 2; i++) await banque.ajouter("chouette", chouette(a));
  return {
    theme: "nuit",
    niveau: 0.65,
    lit,
    deuxLectures: true,
    local: { canaux: lampadaire, base: 0.2 },
    banque: banque.construire(),
    flux: [{ nom: "chouette", ecart: [30, 70], premier: [10, 22], gain: [0.22, 0.34], pan: [-0.8, 0.8], hauteur: [0.9, 1.1], coupure: 1800 }],
    reactions: {},
  };
}
