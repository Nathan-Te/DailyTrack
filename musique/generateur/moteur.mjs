// Le synthétiseur des boucles générées (lot « musique ») : quelques fonctions, aucune dépendance, **déterministe** (un hasard semé, aucune horloge) — les mêmes notes donnent les
// mêmes échantillons, bit pour bit. Il écrit dans des « bus » stéréo (flottants), que `rendre()` mélange (compression par le kick, écho, réverbération), **replie en boucle**
// (la queue de la fin retombe au début : la boucle ne coupe pas) et normalise. Rien ici n'est publié : seul le fichier préparé par `npm run musique` l'est.

export const SR = 44100;

/** Hasard semé (mulberry32). */
export function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
export const tampon = (n) => ({ n, L: new Float32Array(n), R: new Float32Array(n) });

// ——— Oscillateurs (bande limitée par polyBLEP : pas de repliement agressif) ———
function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}
function onde(type, ph, dt, duty) {
  switch (type) {
    case "saw":
      return 2 * ph - 1 - polyBlep(ph, dt);
    case "pulse": {
      let v = ph < duty ? 1 : -1;
      v += polyBlep(ph, dt);
      v -= polyBlep((ph - duty + 1) % 1, dt);
      return v;
    }
    case "tri":
      return 4 * Math.abs(ph - 0.5) - 1;
    default:
      return Math.sin(2 * Math.PI * ph);
  }
}

// ——— Filtres ———
function coefficients(type, f, q) {
  const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  const a0 = 1 + al;
  if (type === "lp") return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0 };
  return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0 };
}
export class Filtre {
  constructor(type, f = 1000, q = 0.707) {
    this.type = type;
    this.z1 = 0;
    this.z2 = 0;
    this.k = coefficients(type, f, q);
  }
  regler(f, q = 0.707) {
    this.k = coefficients(this.type, f, q);
  }
  traiter(x) {
    const k = this.k;
    const y = k.b0 * x + this.z1;
    this.z1 = k.b1 * x - k.a1 * y + this.z2;
    this.z2 = k.b2 * x - k.a2 * y;
    return y;
  }
}

/**
 * Une note dans un bus. `p` : `wave` (saw, pulse, tri, sine), `f` (Hz), `gain`, `pan` (−1 à 1), `detune` (centièmes de ton, une voix chacun), `duty` (pulse), enveloppe `a d s r`
 * (secondes ; `s` niveau), `lp` { f0, f1, tau, q } (le filtre passe de f0 à f1), `vib` { rate, depth, delay }.
 */
export function note(bus, t0, dur, p) {
  const { wave = "saw", f, gain = 0.3, pan = 0, detune = [0], duty = 0.5, a = 0.005, d = 0.1, s = 0.7, r = 0.1, lp = null, vib = null } = p;
  const n0 = Math.round(t0 * SR);
  if (n0 >= bus.n) return; // au-delà de la fin du rendu (un essai court)
  const nOn = Math.round(dur * SR);
  const nTot = nOn + Math.round(r * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const U = detune.length;
  const norm = 1 / Math.sqrt(U);
  const ph = detune.map((_, i) => (i * 0.3719) % 1);
  const mult = detune.map((c) => 2 ** (c / 1200));
  const filtre = lp ? new Filtre("lp", lp.f0, lp.q ?? 0.8) : null;
  const env = (t) => (t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : s);
  const niveauFin = env(dur);
  for (let i = 0; i < nTot; i++) {
    const idx = n0 + i;
    if (idx < 0 || idx >= bus.n) continue;
    const t = i / SR;
    const e = i < nOn ? env(t) : niveauFin * (1 - (i - nOn) / (nTot - nOn)) ** 2;
    let fr = f;
    if (vib) fr *= 1 + vib.depth * Math.sin(2 * Math.PI * vib.rate * t) * Math.min(1, Math.max(0, (t - vib.delay) / 0.25));
    let v = 0;
    for (let u = 0; u < U; u++) {
      const dt = (fr * mult[u]) / SR;
      v += onde(wave, ph[u], dt, duty);
      ph[u] += dt;
      if (ph[u] >= 1) ph[u] -= 1;
    }
    v *= norm;
    if (filtre) {
      if ((i & 15) === 0) filtre.regler(lp.f1 + (lp.f0 - lp.f1) * Math.exp(-t / (lp.tau ?? 0.2)), lp.q ?? 0.8);
      v = filtre.traiter(v);
    }
    const y = v * e * gain;
    bus.L[idx] += y * gl;
    bus.R[idx] += y * gr;
  }
}

// ——— Percussions ———
function bruit(rnd) {
  return rnd() * 2 - 1;
}
export const batterie = {
  /** Grosse caisse : un sinus qui plonge de 150 à 45 Hz, et un petit claquement. */
  kick(bus, t0, g = 1, rnd) {
    const n = Math.round(0.42 * SR);
    const n0 = Math.round(t0 * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      const t = i / SR;
      const fr = 44 + 110 * Math.exp(-t / 0.032);
      ph += fr / SR;
      let y = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.13) * g;
      if (i < 90) y += bruit(rnd) * 0.25 * (1 - i / 90) * g;
      bus.L[idx] += y;
      bus.R[idx] += y;
    }
  },
  /** Caisse claire : du bruit filtré et un corps à 190 Hz. */
  snare(bus, t0, g = 1, rnd, pan = 0) {
    const n = Math.round(0.22 * SR);
    const n0 = Math.round(t0 * SR);
    const hp = new Filtre("hp", 1400, 0.7);
    const lpf = new Filtre("lp", 9000, 0.7);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      const t = i / SR;
      ph += (190 - 60 * Math.min(1, t / 0.1)) / SR;
      const y = (lpf.traiter(hp.traiter(bruit(rnd))) * Math.exp(-t / 0.075) * 0.9 + Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.05) * 0.5) * g;
      bus.L[idx] += y * (1 - pan * 0.4);
      bus.R[idx] += y * (1 + pan * 0.4);
    }
  },
  /** Claquement de mains : trois salves de bruit rapprochées, puis une queue. */
  clap(bus, t0, g = 1, rnd) {
    const n = Math.round(0.3 * SR);
    const n0 = Math.round(t0 * SR);
    const bp = new Filtre("hp", 900, 0.8);
    const lpf = new Filtre("lp", 6500, 0.8);
    for (let i = 0; i < n; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      const t = i / SR;
      const salves = [0, 0.011, 0.023].reduce((s, d) => s + (t >= d && t < d + 0.01 ? Math.exp(-(t - d) / 0.004) : 0), 0);
      const queue = t > 0.023 ? Math.exp(-(t - 0.023) / 0.07) * 0.55 : 0;
      const y = lpf.traiter(bp.traiter(bruit(rnd))) * (salves + queue) * g * 0.8;
      bus.L[idx] += y;
      bus.R[idx] += y;
    }
  },
  /** Charleston : du bruit aigu, court (fermé) ou long (ouvert). */
  hat(bus, t0, g = 1, rnd, ouvert = false, pan = 0) {
    const dec = ouvert ? 0.16 : 0.032;
    const n = Math.round((ouvert ? 0.4 : 0.1) * SR);
    const n0 = Math.round(t0 * SR);
    const hp = new Filtre("hp", 7200, 0.9);
    for (let i = 0; i < n; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      const t = i / SR;
      const y = hp.traiter(bruit(rnd)) * Math.exp(-t / dec) * g;
      bus.L[idx] += y * (1 - pan * 0.5);
      bus.R[idx] += y * (1 + pan * 0.5);
    }
  },
  /** Percussions « puce » : bruit à basse fréquence d'échantillonnage (le canal de bruit d'une vieille console) et triangle qui plonge. */
  puceKick(bus, t0, g = 1) {
    const n = Math.round(0.16 * SR);
    const n0 = Math.round(t0 * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      const t = i / SR;
      ph += (46 + 170 * Math.exp(-t / 0.03)) / SR;
      const y = onde("tri", ph % 1, 0, 0) * Math.exp(-t / 0.09) * g;
      bus.L[idx] += y;
      bus.R[idx] += y;
    }
  },
  puceBruit(bus, t0, dur, g, rnd, hauteur = 6000, pan = 0) {
    const n = Math.round(dur * SR * 4);
    const n0 = Math.round(t0 * SR);
    const pas = Math.max(1, Math.round(SR / hauteur));
    let v = 0;
    for (let i = 0; i < n; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      if (i % pas === 0) v = rnd() < 0.5 ? 1 : -1;
      const y = v * Math.exp(-(i / SR) / dur) * g;
      bus.L[idx] += y * (1 - pan * 0.5);
      bus.R[idx] += y * (1 + pan * 0.5);
    }
  },
};

/** Souffle qui monte (montée avant un « drop ») : du bruit dont le filtre passe-haut grimpe, de plus en plus fort. */
export function montee(bus, t0, dur, g, rnd) {
  const n = Math.round(dur * SR);
  const n0 = Math.round(t0 * SR);
  const hp = new Filtre("hp", 300, 1.2);
  for (let i = 0; i < n; i++) {
    const idx = n0 + i;
    if (idx >= bus.n) break;
    const x = i / n;
    if ((i & 31) === 0) hp.regler(300 + 7000 * x * x, 1.2);
    const y = hp.traiter(bruit(rnd)) * x * x * g;
    bus.L[idx] += y;
    bus.R[idx] += y;
  }
}

/** Pompage : le bus est baissé à chaque kick, puis remonte (le « sidechain » de la musique de danse). */
export function pomper(bus, kicks, profondeur, tau) {
  const duck = new Float32Array(bus.n).fill(1);
  for (const tk of kicks) {
    const n0 = Math.round(tk * SR);
    const dureeSec = tau * 5;
    for (let i = 0; i < dureeSec * SR; i++) {
      const idx = n0 + i;
      if (idx >= bus.n) break;
      const d = 1 - profondeur * Math.exp(-(i / SR) / tau);
      if (d < duck[idx]) duck[idx] = d;
    }
  }
  for (let i = 0; i < bus.n; i++) {
    bus.L[i] *= duck[i];
    bus.R[i] *= duck[i];
  }
}

/** Écho en ping-pong (temps en secondes, retour `fb`, filtre dans la boucle). Rend un nouveau bus ; l'entrée n'est pas modifiée. */
export function echo(src, tG, tD, fb, lpHz = 4200) {
  const out = tampon(src.n);
  const dL = Math.round(tG * SR);
  const dR = Math.round(tD * SR);
  const fL = new Filtre("lp", lpHz, 0.7);
  const fR = new Filtre("lp", lpHz, 0.7);
  for (let i = 0; i < src.n; i++) {
    const inp = (src.L[i] + src.R[i]) * 0.5;
    const l = (i >= dL ? out.R[i - dL] : 0) * fb + inp;
    const r = (i >= dR ? out.L[i - dR] : 0) * fb;
    out.L[i] = fL.traiter(i >= dL ? l : inp);
    out.R[i] = fR.traiter(r);
  }
  return out;
}

/** Réverbération (Freeverb : huit peignes et quatre filtres passe-tout par côté). */
export function reverb(src, salle = 0.84, amorti = 0.22) {
  const out = tampon(src.n);
  const PEIGNES = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const PASSE_TOUT = [556, 441, 341, 225];
  for (const [canal, decalage] of [["L", 0], ["R", 23]]) {
    const peignes = PEIGNES.map((d) => ({ buf: new Float32Array(d + decalage), i: 0, mem: 0 }));
    const passes = PASSE_TOUT.map((d) => ({ buf: new Float32Array(d + decalage), i: 0 }));
    const o = out[canal];
    for (let n = 0; n < src.n; n++) {
      const x = (src.L[n] + src.R[n]) * 0.5 * 0.015;
      let s = 0;
      for (const c of peignes) {
        const y = c.buf[c.i];
        c.mem = y * (1 - amorti) + c.mem * amorti;
        c.buf[c.i] = x + c.mem * salle;
        c.i = (c.i + 1) % c.buf.length;
        s += y;
      }
      for (const p of passes) {
        const b = p.buf[p.i];
        const y = -s + b;
        p.buf[p.i] = s + b * 0.5;
        p.i = (p.i + 1) % p.buf.length;
        s = y;
      }
      o[n] = s;
    }
  }
  return out;
}

export function ajouter(dest, src, g = 1) {
  for (let i = 0; i < dest.n; i++) {
    dest.L[i] += src.L[i] * g;
    dest.R[i] += src.R[i] * g;
  }
}

/**
 * Le rendu d'une boucle. `piece` : { bpm, barres, graine, bus: [noms], compose(ctx) }. `compose` écrit les notes dans `ctx.bus.<nom>` (`ctx.t(barre, pas)` : l'instant d'une double-croche)
 * et rend le plan du mélange : { kicks (instants), pompe: { bus: profondeur }, tauPompe, mix: { bus: gain }, envoiEcho / envoiReverb: { bus: niveau }, echo: [temps G, temps D, retour],
 * retourEcho, retourReverb, salle }. Les bus sont mélangés, la queue (réverbération, écho, fin des notes) est **repliée sur le début** : la boucle ne coupe pas. Normalisée à −1 dBFS.
 * Rend { n, L, R } de `barres` mesures exactement.
 */
export function rendre(piece, { barres = piece.barres, graine = piece.graine } = {}) {
  const pasSec = 60 / piece.bpm / 4; // une double-croche
  const N = Math.round(barres * 16 * pasSec * SR);
  const QUEUE = Math.min(Math.round(4 * SR), N);
  const total = N + QUEUE;
  const rnd = hasard(graine);
  const bus = Object.fromEntries(piece.bus.map((nom) => [nom, tampon(total)]));
  const t = (barre, pas = 0) => (barre * 16 + pas) * pasSec;
  const plan = piece.compose({ bus, t, rnd, pasSec, barres, total });
  for (const [nom, prof] of Object.entries(plan.pompe ?? {})) pomper(bus[nom], plan.kicks ?? [], prof, plan.tauPompe ?? 0.16);
  const sec = tampon(total);
  for (const [nom, g] of Object.entries(plan.mix)) ajouter(sec, bus[nom], g);
  const envoi = (niveaux) => {
    const e = tampon(total);
    for (const [nom, g] of Object.entries(niveaux ?? {})) ajouter(e, bus[nom], g);
    return e;
  };
  if (plan.envoiEcho && plan.echo) ajouter(sec, echo(envoi(plan.envoiEcho), plan.echo[0], plan.echo[1], plan.echo[2], plan.lpEcho ?? 4200), plan.retourEcho ?? 0.5);
  if (plan.envoiReverb) ajouter(sec, reverb(envoi(plan.envoiReverb), plan.salle ?? 0.84, plan.amorti ?? 0.22), plan.retourReverb ?? 1);
  // Repli en boucle : ce qui dépasse la fin retombe au début.
  const out = tampon(N);
  for (let i = 0; i < N; i++) {
    const j = N + i;
    out.L[i] = sec.L[i] + (i < QUEUE ? sec.L[j] : 0);
    out.R[i] = sec.R[i] + (i < QUEUE ? sec.R[j] : 0);
  }
  // Écrêtage doux puis crête à −1 dBFS.
  const drive = plan.saturation ?? 1.1;
  let crete = 0;
  for (let i = 0; i < N; i++) {
    out.L[i] = Math.tanh(out.L[i] * drive);
    out.R[i] = Math.tanh(out.R[i] * drive);
    crete = Math.max(crete, Math.abs(out.L[i]), Math.abs(out.R[i]));
  }
  const g = crete > 0 ? 0.891 / crete : 1;
  for (let i = 0; i < N; i++) {
    out.L[i] *= g;
    out.R[i] *= g;
  }
  return out;
}

/** Un fichier WAV (stéréo, 16 bits, 44 100 Hz) : des octets. */
export function versWav(buf) {
  const n = buf.n;
  const octets = new Uint8Array(44 + n * 4);
  const v = new DataView(octets.buffer);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + n * 4, true);
  txt(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(buf.L[i] * 32767))), true);
    v.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(buf.R[i] * 32767))), true);
  }
  return octets;
}
