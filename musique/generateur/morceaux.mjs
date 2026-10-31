// Les boucles générées par le code (lot « musique », premier essai) : trois morceaux écrits note par note, rendus par `moteur.mjs`. Chacun fait 32 mesures et **se replie en boucle** ; son
// début et sa fin sont des nappes (pas de percussions) pour que le fondu de 3 s du lecteur, entre la fin et le début, se fonde sans à-coup.
// Changer une note ou une graine change le fichier : relancer `npm run musique:generer` puis `npm run musique`.
import { batterie, hz, montee, note } from "./moteur.mjs";

const PAS_PAR_BARRE = 16;
const dans = (b, de, a) => b >= de && b < a;
/** Les notes d'un accord, étendues d'une octave : [t0, t1, t2, t0+12, t1+12, t2+12]. */
const etendu = (accord) => [...accord, ...accord.map((n) => n + 12)];

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 1. Track — menu : « Pole position » (112 BPM, la mineur) : électro moderne, tranquille, qui donne envie de partir.
// ───────────────────────────────────────────────────────────────────────────────────────────────
const PROG_MENU = [
  { basse: 33, accord: [57, 60, 64] }, // Am
  { basse: 29, accord: [53, 57, 60] }, // F
  { basse: 36, accord: [55, 60, 64] }, // C
  { basse: 31, accord: [55, 59, 62] }, // G
];
/** Le crochet mélodique : [pas, indice dans l'accord étendu, durée en pas]. */
const CRO_MENU = [[0, 5, 3], [4, 4, 2], [6, 3, 2], [8, 5, 4], [14, 4, 2], [16, 3, 3], [20, 4, 2], [22, 5, 2], [24, 5, 6], [30, 4, 2]];
const CRO_MENU_B = [[0, 5, 3], [4, 3, 2], [6, 4, 2], [8, 5, 4], [14, 3, 2], [16, 4, 3], [20, 5, 2], [22, 4, 2], [24, 3, 6], [30, 4, 2]];

export const trackMenu = {
  id: "track-menu",
  bpm: 112,
  barres: 32,
  graine: 1101,
  bus: ["kick", "perc", "bass", "pad", "arp", "lead"],
  compose({ bus, t, rnd, pasSec }) {
    const kicks = [];
    for (let b = 0; b < 32; b++) {
      const c = PROG_MENU[Math.floor(b / 2) % 4];
      const groove = dans(b, 2, 30);
      // Nappe : un accord toutes les deux mesures.
      if (b % 2 === 0)
        c.accord.forEach((m, i) => note(bus.pad, t(b), 2 * PAS_PAR_BARRE * pasSec, { wave: "saw", f: hz(m), detune: [-9, 0, 9], gain: 0.06, a: 0.9, d: 0.5, s: 0.8, r: 1.6, lp: { f0: 1500, f1: 1050, tau: 0.6 }, pan: (i - 1) * 0.35 }));
      // Arpège de doubles-croches, plus fermé à l'intro et à la fin.
      const ouvert = groove ? 1 : 0.55;
      const motifArp = [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2];
      const tonesArp = [c.accord[0] + 12, c.accord[1] + 12, c.accord[2] + 12, c.accord[0] + 24];
      for (let s = 0; s < 16; s++)
        note(bus.arp, t(b, s), pasSec * 1.6, { wave: "pulse", duty: 0.35, f: hz(tonesArp[motifArp[s]]), gain: (s % 4 === 0 ? 0.06 : 0.042) * ouvert, a: 0.002, d: 0.1, s: 0, r: 0.05, lp: { f0: 4800 * ouvert, f1: 900, tau: 0.07 }, pan: s % 2 ? 0.35 : -0.35 });
      if (groove) {
        // Basse : sinus + dent de scie fermée, syncopée.
        [[0, 2], [3, 2], [6, 3], [10, 2], [13, 2]].forEach(([s, l], k) => {
          const f = hz(c.basse + (k === 3 ? 12 : 0));
          note(bus.bass, t(b, s), pasSec * l, { wave: "sine", f, gain: 0.5, a: 0.004, d: 0.1, s: 0.8, r: 0.06 });
          note(bus.bass, t(b, s), pasSec * l, { wave: "saw", f, gain: 0.2, a: 0.004, d: 0.1, s: 0.7, r: 0.05, lp: { f0: 900, f1: 260, tau: 0.09 } });
        });
        for (const s of [0, 4, 8, 12]) {
          batterie.kick(bus.kick, t(b, s), 0.85, rnd);
          kicks.push(t(b, s));
        }
        for (const s of [2, 6, 10, 14]) batterie.hat(bus.perc, t(b, s), 0.16, rnd, false, s % 4 === 2 ? 0.2 : -0.2);
        if (b >= 4) for (const s of [1, 5, 9, 13]) batterie.hat(bus.perc, t(b, s), 0.05, rnd, false, 0.3);
        if (b >= 8) for (const s of [4, 12]) batterie.clap(bus.perc, t(b, s), 0.42, rnd);
      }
      // Mélodie : le crochet, puis sa variante plus haute au milieu.
      if (b % 2 === 0 && (dans(b, 8, 16) || dans(b, 24, 30) || dans(b, 16, 24))) {
        const motif = dans(b, 16, 24) ? CRO_MENU_B : CRO_MENU;
        const tones = etendu(c.accord).map((m) => m + 12);
        for (const [s, k, l] of motif)
          note(bus.lead, t(b, s), pasSec * l, { wave: "saw", detune: [-7, 7], f: hz(tones[k]), gain: 0.1, a: 0.012, d: 0.15, s: 0.6, r: 0.28, lp: { f0: 4200, f1: 2300, tau: 0.3 }, vib: { rate: 5.2, depth: 0.006, delay: 0.25 }, pan: 0.1 });
      }
    }
    const pas = pasSec * 4;
    return {
      kicks,
      pompe: { bass: 0.55, pad: 0.5, arp: 0.28, lead: 0.15 },
      tauPompe: 0.18,
      mix: { kick: 1, perc: 1, bass: 1, pad: 1, arp: 1, lead: 1 },
      envoiEcho: { arp: 0.55, lead: 0.45 },
      echo: [pas * 0.75, pas, 0.38],
      retourEcho: 0.55,
      envoiReverb: { pad: 0.6, lead: 0.4, arp: 0.2, perc: 0.1 },
      retourReverb: 1,
      salle: 0.85,
      saturation: 1.2,
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 2. Track — thème Nuit : « Périphérique » (128 BPM, mi mineur) : électro nerveuse, basse sur les contretemps, arpège qui rebondit.
// ───────────────────────────────────────────────────────────────────────────────────────────────
const PROG_NUIT = [
  { basse: 40, accord: [52, 55, 59] }, // Em
  { basse: 36, accord: [52, 55, 60] }, // C
  { basse: 43, accord: [55, 59, 62] }, // G
  { basse: 38, accord: [54, 57, 62] }, // D
];
const CRO_NUIT = [[0, 3, 3], [4, 4, 2], [6, 3, 2], [8, 5, 4], [14, 4, 2], [16, 3, 3], [20, 5, 2], [22, 4, 2], [24, 3, 6]];

export const trackNuit = {
  id: "track-nuit",
  bpm: 128,
  barres: 32,
  graine: 2202,
  bus: ["kick", "perc", "bass", "pad", "arp", "stab", "lead", "fx"],
  compose({ bus, t, rnd, pasSec }) {
    const kicks = [];
    for (let b = 0; b < 32; b++) {
      const c = PROG_NUIT[Math.floor(b / 2) % 4];
      const groove = dans(b, 2, 30);
      const plein = dans(b, 8, 30);
      if (b % 2 === 0)
        c.accord.forEach((m, i) => note(bus.pad, t(b), 2 * PAS_PAR_BARRE * pasSec, { wave: "saw", f: hz(m), detune: [-11, 0, 11], gain: 0.055, a: 1.1, d: 0.5, s: 0.8, r: 1.8, lp: { f0: 1000, f1: 700, tau: 0.8 }, pan: (i - 1) * 0.4 }));
      // Arpège de doubles-croches (dents de scie courtes), très écho.
      const tonesArp = [c.accord[0] + 12, c.accord[1] + 12, c.accord[2] + 12, c.accord[1] + 24];
      const motifArp = [0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 3, 1, 0, 2, 3, 2];
      const ouvert = groove ? 1 : 0.5;
      for (let s = 0; s < 16; s++)
        note(bus.arp, t(b, s), pasSec * 1.4, { wave: "saw", f: hz(tonesArp[motifArp[s]]), gain: (s % 4 === 0 ? 0.05 : 0.036) * ouvert, a: 0.002, d: 0.09, s: 0, r: 0.04, lp: { f0: 5200 * ouvert, f1: 1000, tau: 0.06 }, pan: s % 2 ? 0.4 : -0.4 });
      if (groove) {
        // Basse sur les contretemps + sinus tenu sous la mesure.
        note(bus.bass, t(b), PAS_PAR_BARRE * pasSec, { wave: "sine", f: hz(c.basse), gain: 0.38, a: 0.01, d: 0.2, s: 0.9, r: 0.08 });
        for (const s of [2, 6, 10, 14]) note(bus.bass, t(b, s), pasSec * 3, { wave: "saw", detune: [-6, 6], f: hz(c.basse), gain: 0.2, a: 0.004, d: 0.12, s: 0.6, r: 0.05, lp: { f0: 1100, f1: 240, tau: 0.1 } });
        for (const s of [0, 4, 8, 12]) {
          batterie.kick(bus.kick, t(b, s), 1, rnd);
          kicks.push(t(b, s));
        }
        for (const s of [2, 6, 10, 14]) batterie.hat(bus.perc, t(b, s), 0.17, rnd, true, 0.15);
        if (b >= 4) for (const s of [1, 3, 5, 7, 9, 11, 13, 15]) batterie.hat(bus.perc, t(b, s), s % 4 === 3 ? 0.07 : 0.045, rnd, false, s % 2 ? -0.25 : 0.25);
        if (b >= 8) for (const s of [4, 12]) batterie.clap(bus.perc, t(b, s), 0.5, rnd);
      }
      if (plein) {
        // Accords piqués, syncopés.
        for (const s of [3, 6, 11])
          c.accord.forEach((m, i) => note(bus.stab, t(b, s), pasSec * 1.5, { wave: "saw", detune: [-8, 8], f: hz(m + 12), gain: 0.04, a: 0.003, d: 0.12, s: 0, r: 0.1, lp: { f0: 3800, f1: 1300, tau: 0.1 }, pan: (i - 1) * 0.5 }));
      }
      // Mélodie sombre au centre du morceau.
      if (b % 2 === 0 && dans(b, 16, 24)) {
        const tones = etendu(c.accord).map((m) => m + 12);
        for (const [s, k, l] of CRO_NUIT) note(bus.lead, t(b, s), pasSec * l, { wave: "saw", detune: [-9, 9], f: hz(tones[k]), gain: 0.085, a: 0.01, d: 0.12, s: 0.55, r: 0.2, lp: { f0: 3400, f1: 1700, tau: 0.25 }, pan: 0.05 });
      }
      // Montée avant le « drop » de la mesure 8.
      if (b === 6) montee(bus.fx, t(6), 2 * PAS_PAR_BARRE * pasSec, 0.16, rnd);
      if (b === 7) for (let s = 8; s < 16; s++) batterie.snare(bus.perc, t(b, s), 0.12 + (s - 8) * 0.05, rnd, s % 2 ? -0.3 : 0.3);
      if (b === 15 || b === 23) for (let s = 12; s < 16; s++) batterie.snare(bus.perc, t(b, s), 0.2 + (s - 12) * 0.06, rnd);
    }
    const pas = pasSec * 4;
    return {
      kicks,
      pompe: { bass: 0.75, pad: 0.6, arp: 0.5, stab: 0.5, lead: 0.3 },
      tauPompe: 0.2,
      mix: { kick: 1, perc: 1, bass: 1, pad: 1, arp: 1, stab: 1, lead: 1, fx: 1 },
      envoiEcho: { arp: 0.7, stab: 0.35, lead: 0.5 },
      echo: [pas * 0.75, pas, 0.42],
      retourEcho: 0.6,
      envoiReverb: { pad: 0.7, lead: 0.4, stab: 0.3, arp: 0.15, fx: 0.4 },
      retourReverb: 1,
      salle: 0.86,
      saturation: 1.3,
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────────────────────────
// 3. Jump — thème Forêt : « Sous les feuilles » (140 BPM, do majeur) : chiptune — deux canaux carrés, une basse triangle et le canal de bruit.
// ───────────────────────────────────────────────────────────────────────────────────────────────
const PROG_FORET = [
  { basse: 48, accord: [60, 64, 67] }, // C
  { basse: 45, accord: [57, 60, 64] }, // Am
  { basse: 41, accord: [57, 60, 65] }, // F
  { basse: 43, accord: [55, 59, 62] }, // G
  { basse: 48, accord: [60, 64, 67] }, // C
  { basse: 40, accord: [55, 59, 64] }, // Em
  { basse: 41, accord: [57, 60, 65] }, // F
  { basse: 43, accord: [55, 59, 62] }, // G
];
/** La mélodie : une mesure par accord ([pas, hauteur MIDI, durée]), huit mesures puis on recommence. */
const MELODIE_FORET = [
  [[0, 76, 2], [2, 79, 2], [4, 76, 2], [6, 72, 2], [8, 74, 4], [12, 72, 2], [14, 74, 2]],
  [[0, 72, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
  [[0, 77, 2], [2, 81, 2], [4, 77, 2], [6, 72, 2], [8, 74, 2], [10, 77, 2], [12, 81, 4]],
  [[0, 79, 2], [2, 83, 2], [4, 79, 2], [6, 74, 2], [8, 76, 3], [11, 74, 1], [12, 72, 4]],
  [[0, 79, 3], [4, 76, 1], [5, 79, 1], [6, 84, 2], [8, 83, 2], [10, 79, 2], [12, 76, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 83, 4], [8, 79, 2], [10, 76, 2], [12, 71, 4]],
  [[0, 81, 4], [4, 77, 2], [6, 81, 2], [8, 84, 4], [12, 81, 2], [14, 77, 2]],
  [[0, 83, 2], [2, 79, 2], [4, 74, 2], [6, 79, 2], [8, 83, 4], [12, 86, 4]],
];

export const jumpForet = {
  id: "jump-foret",
  bpm: 140,
  barres: 32,
  graine: 3303,
  bus: ["lead", "arp", "bass", "kick", "perc"],
  compose({ bus, t, rnd, pasSec }) {
    for (let b = 0; b < 32; b++) {
      const k = b % 8;
      const c = PROG_FORET[k];
      const drums = dans(b, 2, 30);
      const lead = dans(b, 4, 28);
      // Arpège carré fin (12,5 %), en doubles-croches.
      const tones = [c.accord[0] + 12, c.accord[1] + 12, c.accord[2] + 12, c.accord[1] + 12];
      for (let s = 0; s < 16; s++) note(bus.arp, t(b, s), pasSec * 0.9, { wave: "pulse", duty: 0.125, f: hz(tones[s % 4]), gain: dans(b, 12, 20) ? 0.052 : 0.04, a: 0.001, d: 0.05, s: 0.5, r: 0.012, pan: s % 2 ? 0.3 : -0.3 });
      // Basse triangle, croches sautillantes : fondamentale, fondamentale, octave, fondamentale…
      const gB = [0, 0, 12, 0, 0, 0, 12, 7];
      for (let i = 0; i < 8; i++) note(bus.bass, t(b, i * 2), pasSec * 1.7, { wave: "tri", f: hz(c.basse + gB[i]), gain: 0.34, a: 0.002, d: 0.05, s: 0.85, r: 0.012 });
      if (drums) {
        for (const s of [0, 8, b % 2 ? 10 : 6]) batterie.puceKick(bus.kick, t(b, s), 0.7);
        for (const s of [4, 12]) batterie.puceBruit(bus.perc, t(b, s), 0.085, 0.2, rnd, 9000, 0.1);
        for (let s = 0; s < 16; s += 2) batterie.puceBruit(bus.perc, t(b, s + 1), 0.018, 0.06, rnd, 15000, s % 4 ? -0.2 : 0.2);
      }
      if (lead) {
        const duty = dans(b, 12, 20) ? 0.25 : 0.5;
        for (const [s, m, l] of MELODIE_FORET[k]) {
          note(bus.lead, t(b, s), pasSec * l - 0.01, { wave: "pulse", duty, f: hz(m), gain: 0.1, a: 0.003, d: 0.06, s: 0.8, r: 0.03, vib: l >= 3 ? { rate: 5.5, depth: 0.004, delay: 0.12 } : null, pan: 0.05 });
          if (dans(b, 12, 20)) note(bus.lead, t(b, s), pasSec * l - 0.01, { wave: "pulse", duty: 0.125, f: hz(m - 12), gain: 0.05, a: 0.003, d: 0.06, s: 0.8, r: 0.03, pan: -0.1 });
        }
      }
    }
    const beat = pasSec * 4;
    return {
      kicks: [],
      mix: { lead: 1, arp: 1, bass: 1, kick: 1, perc: 1 },
      envoiEcho: { lead: 0.4, arp: 0.35 },
      echo: [beat * 0.75, beat, 0.3],
      lpEcho: 6000,
      retourEcho: 0.42,
      saturation: 1.2,
    };
  },
};

export const MORCEAUX = { [trackMenu.id]: trackMenu, [trackNuit.id]: trackNuit, [jumpForet.id]: jumpForet };
