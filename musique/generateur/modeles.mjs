// Les modèles des boucles générées (lot « musique », seconde étape) : trois « familles » de morceaux, paramétrées par une petite fiche (tempo, gamme, accords, style de basse, de percussions…).
// Une fiche donne un morceau entier : `catalogue.mjs` en écrit une par scène (menu ou thème de chaque jeu), `morceaux.mjs` les réunit. **Tout est déterministe** : la mélodie est tirée d'un
// hasard semé par la graine de la fiche (aucune horloge) ; changer une valeur d'une fiche change le fichier — relancer `npm run musique:generer` puis `npm run musique`.
//   • `electro` : électro moderne (kick, basse, nappe, arpège, mélodie, pompage) — Track ;
//   • `chip`    : chiptune rétro (deux canaux carrés, basse triangle, canal de bruit) — Jump ;
//   • `calme`   : nappes, notes pincées et cloche, percussions très douces — Tower (le jeu se joue posément).
import { batterie, hasard, hz, montee, note } from "./moteur.mjs";

const PAS_PAR_BARRE = 16;
const dans = (b, de, a) => b >= de && b < a;

// ——— La théorie, en peu de lignes ———
export const GAMMES = {
  maj: [0, 2, 4, 5, 7, 9, 11],
  min: [0, 2, 3, 5, 7, 8, 10],
  dor: [0, 2, 3, 5, 7, 9, 10],
  mix: [0, 2, 4, 5, 7, 9, 10],
  lyd: [0, 2, 4, 6, 7, 9, 11],
  phr: [0, 1, 3, 5, 7, 8, 10],
};
/** La note MIDI du degré `i` (0 = tonique ; 7 = l'octave au-dessus ; négatif = en dessous) de la gamme. */
export function degre(tonique, gamme, i) {
  const g = GAMMES[gamme];
  return tonique + 12 * Math.floor(i / 7) + g[((i % 7) + 7) % 7];
}
/** L'accord (trois notes) bâti sur le degré `d`, et sa basse (deux octaves plus bas environ, dans le grave). */
export function accordDe(tonique, gamme, d) {
  const accord = [d, d + 2, d + 4].map((i) => degre(tonique, gamme, i));
  let basse = degre(tonique, gamme, d);
  while (basse > 45) basse -= 12;
  while (basse < 33) basse += 12;
  return { accord, basse };
}
/** Les accords d'une fiche : `prog` donne un degré par accord. */
const accordsDe = (f) => f.prog.map((d) => accordDe(f.tonique, f.gamme, d));

// ——— La mélodie : un crochet tiré du hasard semé, posé sur les accords ———
const RYTHMES = {
  vif: [
    [[0, 3], [4, 2], [6, 2], [8, 4], [14, 2]],
    [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    [[0, 4], [4, 2], [6, 2], [8, 3], [12, 4]],
    [[0, 2], [3, 1], [4, 3], [8, 2], [10, 2], [12, 2], [14, 2]],
    [[2, 2], [4, 2], [6, 4], [10, 2], [12, 4]],
    [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]],
  ],
  lent: [
    [[0, 6], [8, 6]],
    [[0, 4], [6, 4], [12, 4]],
    [[2, 4], [8, 8]],
    [[0, 8], [8, 4], [12, 4]],
  ],
};
/**
 * Une mélodie de `barres` mesures sur les accords `degres` (un accord toutes les `parAccord` mesures) : pour chaque mesure, [[pas, note MIDI, durée en pas]…]. Les temps forts
 * tombent sur une note de l'accord ; entre eux, la mélodie marche par degrés conjoints et revient vers le centre ; la dernière note se pose sur la fondamentale.
 */
export function melodie(f, graine, { barres = 8, parAccord = 2, rythmes = "vif", centre = f.tonique + 17 } = {}) {
  const rnd = hasard(graine);
  const choix = (liste) => liste[Math.floor(rnd() * liste.length)];
  const jeu = RYTHMES[rythmes];
  const rA = choix(jeu);
  const rB = choix(jeu);
  let milieu = -14;
  while (degre(f.tonique, f.gamme, milieu) < centre) milieu++;
  let cur = milieu;
  const mesures = [];
  for (let b = 0; b < barres; b++) {
    const d = f.prog[Math.floor(b / parAccord) % f.prog.length];
    const estDeLAccord = (j) => [0, 2, 4].includes((((j - d) % 7) + 7) % 7);
    const proche = (j) => {
      for (let k = 0; k < 4; k++) for (const s of [j + k, j - k]) if (estDeLAccord(s)) return s;
      return j;
    };
    const rythme = b % 2 === 0 ? rA : rB;
    const m = [];
    rythme.forEach(([pas, duree], i) => {
      let pas1 = choix([-2, -1, -1, 0, 1, 1, 2]);
      if (cur > milieu + 6) pas1 = Math.min(pas1, 0);
      if (cur < milieu - 2) pas1 = Math.max(pas1, 0);
      cur += pas1;
      if (pas % 4 === 0) cur = proche(cur);
      if (b === barres - 1 && i === rythme.length - 1) {
        // La dernière note se pose sur la fondamentale de l'accord, la plus proche.
        let k = 0;
        while ((((cur + k - d) % 7) + 7) % 7 !== 0 && (((cur - k - d) % 7) + 7) % 7 !== 0) k++;
        cur = (((cur + k - d) % 7) + 7) % 7 === 0 ? cur + k : cur - k;
      }
      m.push([pas, degre(f.tonique, f.gamme, cur), duree]);
    });
    mesures.push(m);
  }
  return mesures;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Famille « electro »
// ───────────────────────────────────────────────────────────────────────────────────────────────
/** Les motifs d'arpège : quel accord (0, 1, 2 = les trois notes, 3 = la fondamentale à l'octave) à chaque double-croche. */
const MOTIFS_ARP = {
  monte: [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2],
  rebond: [0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 3, 1, 0, 2, 3, 2],
  large: [0, 2, 3, 2, 0, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 1],
};
const PATRONS_BASSE = {
  sync: [[0, 2], [3, 2], [6, 3], [10, 2], [13, 2]],
  roll: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  tenue: [[0, 16]],
};

/**
 * Fiche `electro` : { bpm, graine, tonique, gamme, prog:[4 degrés], kicks:[pas], caisse:"clap"|"snare", basse:"sync"|"roll"|"tenue"|"contretemps", hats:0|1|2, stab, montee,
 * arp:{ motif, wave, gain, duty? }, lead:{ wave, gain, lp:[f0,f1], vib }, pompe, echo, salle, saturation, nappe:{ gain, lp:[f0,f1] }, rythmes }.
 */
export function electro(f) {
  const accords = accordsDe(f);
  const mA = melodie(f, f.graine + 11);
  const mB = melodie(f, f.graine + 23);
  const arp = { motif: "monte", wave: "pulse", gain: 0.05, ...f.arp };
  const lead = { wave: "saw", gain: 0.1, lp: [4200, 2300], ...f.lead };
  const nappe = { gain: 0.06, lp: [1500, 1000], ...f.nappe };
  const kicksPas = f.kicks ?? [0, 4, 8, 12];
  return {
    id: f.id,
    bpm: f.bpm,
    barres: 32,
    graine: f.graine,
    bus: ["kick", "perc", "bass", "pad", "arp", "stab", "lead", "fx"],
    compose({ bus, t, rnd, pasSec }) {
      const kicks = [];
      for (let b = 0; b < 32; b++) {
        const c = accords[Math.floor(b / 2) % accords.length];
        const groove = dans(b, 2, 30);
        const plein = dans(b, 8, 30);
        if (b % 2 === 0)
          c.accord.forEach((m, i) => note(bus.pad, t(b), 2 * PAS_PAR_BARRE * pasSec, { wave: "saw", f: hz(m), detune: [-10, 0, 10], gain: nappe.gain, a: 1, d: 0.5, s: 0.8, r: 1.7, lp: { f0: nappe.lp[0], f1: nappe.lp[1], tau: 0.7 }, pan: (i - 1) * 0.38 }));
        // Arpège de doubles-croches, plus fermé à l'intro et à la fin.
        const ouvert = groove ? 1 : 0.55;
        const tonesArp = [c.accord[0] + 12, c.accord[1] + 12, c.accord[2] + 12, c.accord[0] + 24];
        const motifArp = MOTIFS_ARP[arp.motif];
        for (let s = 0; s < 16; s++)
          note(bus.arp, t(b, s), pasSec * 1.5, { wave: arp.wave, duty: arp.duty ?? 0.35, f: hz(tonesArp[motifArp[s]]), gain: (s % 4 === 0 ? arp.gain : arp.gain * 0.72) * ouvert, a: 0.002, d: 0.1, s: 0, r: 0.05, lp: { f0: 5000 * ouvert, f1: 950, tau: 0.065 }, pan: s % 2 ? 0.38 : -0.38 });
        if (groove) {
          // Basse.
          if (f.basse === "contretemps") {
            note(bus.bass, t(b), PAS_PAR_BARRE * pasSec, { wave: "sine", f: hz(c.basse), gain: 0.38, a: 0.01, d: 0.2, s: 0.9, r: 0.08 });
            for (const s of [2, 6, 10, 14]) note(bus.bass, t(b, s), pasSec * 3, { wave: "saw", detune: [-6, 6], f: hz(c.basse), gain: 0.2, a: 0.004, d: 0.12, s: 0.6, r: 0.05, lp: { f0: 1100, f1: 240, tau: 0.1 } });
          } else {
            PATRONS_BASSE[f.basse ?? "sync"].forEach(([s, l], k) => {
              const fr = hz(c.basse + (k % 4 === 3 ? 12 : 0));
              note(bus.bass, t(b, s), pasSec * l, { wave: "sine", f: fr, gain: 0.5, a: 0.004, d: 0.1, s: 0.8, r: 0.06 });
              note(bus.bass, t(b, s), pasSec * l, { wave: "saw", f: fr, gain: 0.2, a: 0.004, d: 0.1, s: 0.7, r: 0.05, lp: { f0: 950, f1: 260, tau: 0.09 } });
            });
          }
          for (const s of kicksPas) {
            batterie.kick(bus.kick, t(b, s), 0.9, rnd);
            kicks.push(t(b, s));
          }
          const h = f.hats ?? 1;
          for (const s of [2, 6, 10, 14]) batterie.hat(bus.perc, t(b, s), 0.16, rnd, h === 2 && s === 14, s % 4 === 2 ? 0.2 : -0.2);
          if (h >= 1 && b >= 4) for (const s of [1, 5, 9, 13]) batterie.hat(bus.perc, t(b, s), 0.05, rnd, false, 0.3);
          if (h === 2 && b >= 4) for (const s of [3, 7, 11, 15]) batterie.hat(bus.perc, t(b, s), 0.04, rnd, false, -0.3);
          if (b >= 8 && f.caisse !== "aucune") for (const s of [4, 12]) (f.caisse === "snare" ? batterie.snare : batterie.clap)(bus.perc, t(b, s), f.caisse === "snare" ? 0.5 : 0.42, rnd);
        }
        if (plein && f.stab)
          for (const s of [3, 6, 11])
            c.accord.forEach((m, i) => note(bus.stab, t(b, s), pasSec * 1.5, { wave: "saw", detune: [-8, 8], f: hz(m + 12), gain: 0.04, a: 0.003, d: 0.12, s: 0, r: 0.1, lp: { f0: 3800, f1: 1300, tau: 0.1 }, pan: (i - 1) * 0.5 }));
        // Mélodie : le crochet, puis sa variante au milieu du morceau.
        const section = dans(b, 8, 16) || dans(b, 24, 30) ? mA : dans(b, 16, 24) ? mB : null;
        if (section) {
          for (const [s, m, l] of section[b % 8])
            note(bus.lead, t(b, s), pasSec * l, { wave: lead.wave, detune: [-8, 8], f: hz(m), gain: lead.gain, a: 0.012, d: 0.15, s: 0.6, r: 0.26, lp: { f0: lead.lp[0], f1: lead.lp[1], tau: 0.28 }, vib: { rate: 5.2, depth: 0.006, delay: 0.25 }, pan: 0.08 });
        }
        if (f.montee) {
          if (b === 6) montee(bus.fx, t(6), 2 * PAS_PAR_BARRE * pasSec, 0.15, rnd);
          if (b === 7) for (let s = 8; s < 16; s++) batterie.snare(bus.perc, t(b, s), 0.12 + (s - 8) * 0.05, rnd, s % 2 ? -0.3 : 0.3);
          if (b === 15 || b === 23) for (let s = 12; s < 16; s++) batterie.snare(bus.perc, t(b, s), 0.2 + (s - 12) * 0.06, rnd);
        }
      }
      const pas = pasSec * 4;
      return {
        kicks,
        pompe: { bass: f.pompe ?? 0.6, pad: (f.pompe ?? 0.6) * 0.85, arp: (f.pompe ?? 0.6) * 0.5, stab: (f.pompe ?? 0.6) * 0.6, lead: (f.pompe ?? 0.6) * 0.3 },
        tauPompe: 0.19,
        mix: { kick: 1, perc: 1, bass: 1, pad: 1, arp: 1, stab: 1, lead: 1, fx: 1 },
        envoiEcho: { arp: 0.6, stab: 0.35, lead: 0.45 },
        echo: [pas * 0.75, pas, f.echo ?? 0.4],
        retourEcho: 0.58,
        envoiReverb: { pad: 0.65, lead: 0.4, stab: 0.3, arp: 0.18, perc: 0.1, fx: 0.4 },
        retourReverb: 1,
        salle: f.salle ?? 0.85,
        saturation: f.saturation ?? 1.25,
      };
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Famille « chip »
// ───────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Fiche `chip` : { bpm, graine, tonique, gamme, prog:[8 degrés, une mesure chacun], batterie:"march"|"rock"|"sparse", basse:"bond"|"croche"|"tenue", arp:{ duty, motif },
 * lead:{ duty, gain }, bruitHaut }.
 */
export function chip(f) {
  const accords = accordsDe(f);
  const mA = melodie(f, f.graine + 5, { barres: 8, parAccord: 1, centre: f.tonique + 16 });
  const mB = melodie(f, f.graine + 17, { barres: 8, parAccord: 1, centre: f.tonique + 19 });
  const arp = { duty: 0.125, ...f.arp };
  const lead = { duty: 0.5, gain: 0.1, ...f.lead };
  const BASSES = { bond: [0, 0, 12, 0, 0, 0, 12, 7], croche: [0, 12, 0, 12, 0, 12, 0, 12], tenue: [0, 0, 0, 0, 0, 0, 0, 0] };
  return {
    id: f.id,
    bpm: f.bpm,
    barres: 32,
    graine: f.graine,
    bus: ["lead", "arp", "bass", "kick", "perc"],
    compose({ bus, t, rnd, pasSec }) {
      for (let b = 0; b < 32; b++) {
        const c = accords[b % accords.length];
        const drums = dans(b, 2, 30);
        const jouee = dans(b, 4, 28);
        const tones = [c.accord[0] + 12, c.accord[1] + 12, c.accord[2] + 12, c.accord[1] + 12];
        for (let s = 0; s < 16; s++) note(bus.arp, t(b, s), pasSec * (f.arp?.legato ? 1.8 : 0.9), { wave: "pulse", duty: arp.duty, f: hz(tones[s % 4]), gain: dans(b, 12, 20) ? 0.052 : 0.04, a: 0.001, d: 0.05, s: 0.5, r: 0.012, pan: s % 2 ? 0.3 : -0.3 });
        const gB = BASSES[f.basse ?? "bond"];
        if (f.basse === "tenue") {
          for (const s of [0, 8]) note(bus.bass, t(b, s), pasSec * 7.4, { wave: "tri", f: hz(c.basse), gain: 0.34, a: 0.004, d: 0.1, s: 0.9, r: 0.02 });
        } else {
          for (let i = 0; i < 8; i++) note(bus.bass, t(b, i * 2), pasSec * 1.7, { wave: "tri", f: hz(c.basse + gB[i]), gain: 0.34, a: 0.002, d: 0.05, s: 0.85, r: 0.012 });
        }
        if (drums) {
          const style = f.batterie ?? "march";
          const kicksPas = style === "march" ? [0, 4, 8, 12] : style === "rock" ? [0, 8, b % 2 ? 10 : 6] : [0, 8];
          const caisses = style === "sparse" ? [12] : [4, 12];
          for (const s of kicksPas) batterie.puceKick(bus.kick, t(b, s), style === "sparse" ? 0.5 : 0.7);
          for (const s of caisses) batterie.puceBruit(bus.perc, t(b, s), 0.085, style === "sparse" ? 0.13 : 0.2, rnd, 9000, 0.1);
          if (style !== "sparse") for (let s = 0; s < 16; s += 2) batterie.puceBruit(bus.perc, t(b, s + 1), 0.018, 0.06, rnd, f.bruitHaut ?? 15000, s % 4 ? -0.2 : 0.2);
        }
        if (jouee) {
          const cycle = Math.floor(b / 8);
          const section = cycle === 1 ? mB : mA;
          const double = dans(b, 12, 20);
          for (const [s, m, l] of section[b % 8]) {
            note(bus.lead, t(b, s), pasSec * l - 0.01, { wave: "pulse", duty: double ? lead.duty / 2 : lead.duty, f: hz(m), gain: lead.gain, a: 0.003, d: 0.06, s: 0.8, r: 0.03, vib: l >= 3 ? { rate: 5.5, depth: 0.004, delay: 0.12 } : null, pan: 0.05 });
            if (double || cycle === 2) note(bus.lead, t(b, s), pasSec * l - 0.01, { wave: "pulse", duty: 0.125, f: hz(m - 12), gain: 0.05, a: 0.003, d: 0.06, s: 0.8, r: 0.03, pan: -0.1 });
          }
        }
      }
      const beat = pasSec * 4;
      return {
        kicks: [],
        mix: { lead: 1, arp: 1, bass: 1, kick: 1, perc: 1 },
        envoiEcho: { lead: f.echo ?? 0.4, arp: 0.35 },
        echo: [beat * 0.75, beat, 0.3],
        lpEcho: 6000,
        retourEcho: 0.42,
        saturation: 1.2,
      };
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Famille « calme »
// ───────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Fiche `calme` : { bpm, graine, tonique, gamme, prog:[4 degrés, deux mesures chacun], perc:"aucune"|"doux"|"tribal"|"tic", pluck:{ wave, gain, duty? }, cloche:{ wave, gain },
 * nappe:{ wave, gain }, salle, echo }. 24 mesures : trois fois les quatre accords.
 */
export function calme(f) {
  const accords = accordsDe(f);
  const mA = melodie(f, f.graine + 3, { barres: 8, parAccord: 2, rythmes: "lent", centre: f.tonique + 19 });
  const mB = melodie(f, f.graine + 29, { barres: 8, parAccord: 2, rythmes: "lent", centre: f.tonique + 22 });
  const pluck = { wave: "tri", gain: 0.07, ...f.pluck };
  const cloche = { wave: "sine", gain: 0.11, ...f.cloche };
  const nappe = { wave: "saw", gain: 0.05, ...f.nappe };
  const motif = [0, 2, 1, 2, 0, 2, 1, 2];
  return {
    id: f.id,
    bpm: f.bpm,
    barres: 24,
    graine: f.graine,
    bus: ["kick", "perc", "bass", "pad", "pluck", "cloche"],
    compose({ bus, t, rnd, pasSec }) {
      const kicks = [];
      for (let b = 0; b < 24; b++) {
        const c = accords[Math.floor(b / 2) % accords.length];
        if (b % 2 === 0)
          c.accord.forEach((m, i) => note(bus.pad, t(b), 2 * PAS_PAR_BARRE * pasSec, { wave: nappe.wave, f: hz(m), detune: [-7, 0, 7], gain: nappe.gain, a: 1.4, d: 0.6, s: 0.85, r: 2, lp: { f0: 1300, f1: 800, tau: 1 }, pan: (i - 1) * 0.4 }));
        // Basse : une note longue par mesure, douce.
        if (dans(b, 2, 22)) note(bus.bass, t(b), PAS_PAR_BARRE * pasSec * 0.98, { wave: "sine", f: hz(c.basse), gain: 0.34, a: 0.03, d: 0.2, s: 0.85, r: 0.2 });
        // Notes pincées : croches arpégées.
        if (dans(b, 2, 22)) {
          const tones = [c.accord[0] + 12, c.accord[1] + 12, c.accord[2] + 12];
          for (let i = 0; i < 8; i++)
            note(bus.pluck, t(b, i * 2), pasSec * 1.5, { wave: pluck.wave, duty: pluck.duty ?? 0.5, f: hz(tones[motif[i]]), gain: i % 4 === 0 ? pluck.gain : pluck.gain * 0.7, a: 0.003, d: 0.18, s: 0.05, r: 0.1, lp: { f0: 3600, f1: 1000, tau: 0.12 }, pan: i % 2 ? 0.35 : -0.35 });
        }
        // Cloche : le crochet, rare et long.
        const section = dans(b, 8, 16) ? mA : dans(b, 16, 22) ? mB : null;
        if (section)
          for (const [s, m, l] of section[b % 8])
            note(bus.cloche, t(b, s), pasSec * l, { wave: cloche.wave, detune: [-4, 4], f: hz(m), gain: cloche.gain, a: 0.006, d: 0.5, s: 0.25, r: 0.9, vib: { rate: 4.6, depth: 0.004, delay: 0.3 }, pan: 0.1 });
        // Percussions très douces.
        if (dans(b, 4, 22) && f.perc && f.perc !== "aucune") {
          if (f.perc === "doux") {
            for (const s of [0, 10]) {
              batterie.kick(bus.kick, t(b, s), 0.42, rnd);
              kicks.push(t(b, s));
            }
            for (let s = 1; s < 16; s += 2) batterie.hat(bus.perc, t(b, s), 0.035, rnd, false, s % 4 === 1 ? -0.3 : 0.3);
          } else if (f.perc === "tribal") {
            for (const s of [0, 6, 10]) {
              batterie.kick(bus.kick, t(b, s), 0.4, rnd);
              kicks.push(t(b, s));
            }
            for (const s of [3, 7, 11, 14]) batterie.puceBruit(bus.perc, t(b, s), 0.05, 0.1, rnd, 3200, s % 2 ? 0.4 : -0.4);
          } else if (f.perc === "tic") {
            for (const s of [0, 4, 8, 12]) batterie.hat(bus.perc, t(b, s), 0.07, rnd, false, s % 8 ? -0.3 : 0.3);
            for (const s of [6, 14]) batterie.clap(bus.perc, t(b, s), 0.14, rnd);
          }
        }
      }
      const pas = pasSec * 4;
      return {
        kicks,
        pompe: { bass: 0.25, pad: 0.2 },
        tauPompe: 0.25,
        mix: { kick: 1, perc: 1, bass: 1, pad: 1, pluck: 1, cloche: 1 },
        envoiEcho: { pluck: 0.5, cloche: 0.5 },
        echo: [pas * 0.75, pas, f.echo ?? 0.38],
        lpEcho: 3600,
        retourEcho: 0.55,
        envoiReverb: { pad: 0.7, pluck: 0.35, cloche: 0.6, perc: 0.15 },
        retourReverb: 1,
        salle: f.salle ?? 0.9,
        saturation: 1.05,
      };
    },
  };
}

export const MODELES = { electro, chip, calme };
