// Lot 55 (partie B) — approche A : **la synthèse** en direct. Une onde périodique riche en harmoniques à la fréquence d'allumage (régime ÷ 60 × cylindres ÷ 2),
// une seconde voix légèrement désaccordée (la rugosité), l'harmonique ½ (le « lope » d'un gros moteur), une saturation douce (le grain sous charge), un
// filtre passe-bas qui s'ouvre avec le régime et la charge (lever le pied étouffe le moteur), le souffle d'admission (bruit filtré) et la pétarade. Aucun fichier.
// Coût : une douzaine de nœuds, quelques paramètres réglés à chaque image ; le poids est celui de ce code.
import { frequenceAllumage, type ProfilMoteur } from "./profils";
import { regimeNormal } from "./boite";
import { Compteur, lerp, type EntreeMoteur, type Moteur } from "./moteur";

/** Courbe de saturation douce (tanh) ; `forcee` > 1 la rend plus mordante. */
function courbe(forcee: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * forcee) / Math.tanh(forcee);
  }
  return c;
}

export function creerSynthese(ctx: BaseAudioContext, sortie: AudioNode, p: ProfilMoteur, bruit: AudioBuffer): Moteur {
  const c = new Compteur();
  const t = p.timbre;
  // L'onde : harmoniques 1/kᵖ, avec un léger creux sur les harmoniques impairs hauts (une voix de moteur, pas une dent de scie de synthé).
  const N = t.harmoniques;
  const reel = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let k = 1; k <= N; k++) imag[k] = (1 / Math.pow(k, t.pente)) * (k % 2 === 0 ? 1 : 0.85);
  const onde = ctx.createPeriodicWave(reel, imag);

  const sortieMoteur = c.nd(ctx.createGain());
  sortieMoteur.gain.value = p.niveau * p.etalon.synthese;
  sortieMoteur.connect(sortie);

  const mix = c.nd(ctx.createGain());
  const o1 = c.nd(ctx.createOscillator());
  o1.setPeriodicWave(onde);
  const o2 = c.nd(ctx.createOscillator());
  o2.setPeriodicWave(onde);
  const sub = c.nd(ctx.createOscillator());
  sub.type = "triangle";
  const g1 = c.nd(ctx.createGain());
  g1.gain.value = 0.6;
  const g2 = c.nd(ctx.createGain());
  g2.gain.value = 0.25 + 0.3 * t.rugosite;
  const gSub = c.nd(ctx.createGain());
  gSub.gain.value = 0.9 * t.grondement;
  o1.connect(g1).connect(mix);
  o2.connect(g2).connect(mix);
  sub.connect(gSub).connect(mix);

  const sat = c.nd(ctx.createWaveShaper());
  sat.curve = courbe(1 + 3.5 * t.saturation);
  sat.oversample = "none";
  const lp = c.nd(ctx.createBiquadFilter());
  lp.type = "lowpass";
  lp.Q.value = 0.9;
  const amp = c.nd(ctx.createGain());
  amp.gain.value = 0;
  mix.connect(sat).connect(lp).connect(amp).connect(sortieMoteur);

  // Le tremblement d'un moteur fatigué : un LFO sur l'amplitude.
  const lfo = c.nd(ctx.createOscillator());
  lfo.frequency.value = 9;
  const lfoProf = c.nd(ctx.createGain());
  lfoProf.gain.value = 0.16 * t.rugosite;
  lfo.connect(lfoProf).connect(amp.gain);

  // Le souffle de l'admission.
  const sb = c.nd(ctx.createBufferSource());
  sb.buffer = bruit;
  sb.loop = true;
  const bp = c.nd(ctx.createBiquadFilter());
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  const gSouffle = c.nd(ctx.createGain());
  gSouffle.gain.value = 0;
  sb.connect(bp).connect(gSouffle).connect(sortieMoteur);

  o1.start();
  o2.start();
  sub.start();
  lfo.start();
  sb.start();

  let dernierRegime = p.ralenti;
  return {
    nom: "Synthèse (A)",
    get noeuds() {
      return c.n;
    },
    maj(e: EntreeMoteur) {
      const now = e.t ?? ctx.currentTime;
      const k = 0.025;
      const f = frequenceAllumage(e.rpm, p.cylindres);
      const rn = regimeNormal(p, e.rpm);
      o1.frequency.setTargetAtTime(f, now, k);
      o2.frequency.setTargetAtTime(f * (1 + 0.007 * t.rugosite) + 0.4 * t.rugosite, now, k);
      sub.frequency.setTargetAtTime(f * 0.5, now, k);
      // Lever de pied : le filtre se ferme (le moteur s'étouffe) ; plein gaz il s'ouvre avec le régime.
      const coupure = lerp(t.coupure[0], t.coupure[1], rn) * (0.35 + 0.65 * e.charge);
      lp.frequency.setTargetAtTime(coupure, now, k);
      const niveau = (0.1 + 0.62 * e.charge) * (0.55 + 0.45 * rn) * (e.enAir ? 0.85 : 1);
      amp.gain.setTargetAtTime(niveau, now, k);
      bp.frequency.setTargetAtTime(280 + 2300 * rn, now, k);
      gSouffle.gain.setTargetAtTime(t.souffle * 0.075 * (0.15 + e.charge) * (0.3 + 0.7 * rn), now, k);
      // Pétarade : un lever de pied brutal à haut régime.
      if (p.petards && dernierRegime > 0.62 * p.rouge && e.charge < 0.05 && e.rpm < dernierRegime - 25) petarades(ctx, sortieMoteur, bruit, c, 2 + Math.round(2 * rn), now);
      dernierRegime = e.rpm;
    },
    petarade() {
      petarades(ctx, sortieMoteur, bruit, c, 3, ctx.currentTime);
    },
    arreter() {
      c.tout();
    },
  };
}

let dernierePetarade = 0;
/** Quelques claquements secs et graves à l'échappement ; au plus une rafale toutes les 0,6 s. */
function petarades(ctx: BaseAudioContext, sortie: AudioNode, bruit: AudioBuffer, c: Compteur, n: number, now: number): void {
  if (now >= dernierePetarade && now - dernierePetarade < 0.6) return;
  dernierePetarade = now;
  for (let i = 0; i < n; i++) {
    const t0 = now + 0.03 + i * (0.045 + 0.03 * ((i * 7) % 3));
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const s = c.bref(ctx.createBufferSource(), f, g);
    s.buffer = bruit;
    f.type = "bandpass";
    f.frequency.value = 260 + 140 * ((i * 5) % 4);
    f.Q.value = 1.4;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.75, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    s.connect(f).connect(g).connect(sortie);
    s.start(t0, i * 0.13);
    s.stop(t0 + 0.09);
  }
}
