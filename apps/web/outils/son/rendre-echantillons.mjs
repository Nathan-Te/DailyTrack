// Lot 55 (partie B), approche B — rend **hors ligne** les boucles de moteur de chaque profil : `node --experimental-strip-types apps/web/outils/son/rendre-echantillons.mjs`
// (Node 22 et ffmpeg ; sortie : `apps/web/src/son/boucles/`, 6 boucles AAC mono 22,05 kHz par profil et `manifeste.json`). Le résultat est versé dans le dépôt : la
// planche (et, si Nathan choisit B, le jeu) n'a rien à rendre à l'exécution. Déterministe : mêmes graines, mêmes fichiers (à la version de l'encodeur près).
//
// Le modèle : à chaque allumage d'un cylindre, une impulsion de pression traverse l'échappement — une somme de **résonances amorties** (les modes du tuyau,
// propres à chaque moteur) plus une bouffée de bruit (la combustion). Les allumages se suivent à la période du régime (4 temps : un cycle = 2 tours, une
// boucle = un nombre entier de cycles, donc sans raccord) ; chaque cylindre a son amplitude (le grondement d'un gros moteur) et un moteur fatigué rate des
// allumages. On écrit trois copies de la période : la fenêtre qui boucle est la copie du milieu (l'AAC ajoute un peu de silence au début et à la fin).
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILS, VOITURES_SON } from "../../src/son/profils.ts";

const SR = 22050;
const SORTIE = fileURLToPath(new URL("../../src/son/boucles/", import.meta.url));
/**
 * Les régimes de référence de chaque profil : **en progression géométrique** du ralenti au rouge (retouche après écoute de Nathan : avec des boucles réparties
 * linéairement, la première boucle était jouée jusqu'à 2,2 fois plus vite que son régime, donc « trop aiguë »). Huit boucles : deux voisines sont toujours à moins
 * de 1,35 fois l'une de l'autre, la vitesse de lecture reste entre 0,75 et 1,35.
 */
const BOUCLES = 8;
/** Durée minimale (s) d'une période de boucle : assez de cycles pour que la variation entre cylindres s'entende. */
const PERIODE_MIN = 0.44;

/**
 * Le caractère de l'échappement de chaque profil (ce que le synthé de l'approche A ne fait pas) : les fréquences des modes (Hz) et leur poids, la durée
 * (s) de leur amortissement, la part de bruit de combustion, la variation d'un cylindre à l'autre, la probabilité de rater un allumage, le cliquetis.
 */
const ECHAPPEMENT = {
  civile: { modes: [150, 330, 640, 1300], poids: [1, 0.8, 0.5, 0.24], amortissement: 0.014, bruit: 0.13, variation: 0.1, rate: 0, cliquetis: 0 },
  muscle: { modes: [72, 155, 310, 620], poids: [1, 0.9, 0.55, 0.3], amortissement: 0.026, bruit: 0.1, variation: 0.28, rate: 0, cliquetis: 0 },
  monoplace: { modes: [540, 1150, 2400, 4300], poids: [1, 0.7, 0.45, 0.25], amortissement: 0.006, bruit: 0.08, variation: 0.03, rate: 0, cliquetis: 0 },
  fourgon: { modes: [120, 260, 520], poids: [1, 0.7, 0.4], amortissement: 0.017, bruit: 0.3, variation: 0.38, rate: 0.045, cliquetis: 0.5 },
  // Les six autres voitures du Garage (chacune un type de moteur, jamais un modèle précis).
  evolution: { modes: [160, 350, 700, 1500], poids: [1, 0.8, 0.5, 0.3], amortissement: 0.011, bruit: 0.16, variation: 0.08, rate: 0, cliquetis: 0 },
  rallye: { modes: [170, 380, 760, 1600], poids: [1, 0.85, 0.55, 0.35], amortissement: 0.01, bruit: 0.2, variation: 0.12, rate: 0.015, cliquetis: 0 },
  gt: { modes: [110, 240, 480, 980], poids: [1, 0.8, 0.5, 0.28], amortissement: 0.018, bruit: 0.09, variation: 0.05, rate: 0, cliquetis: 0 },
  roadster: { modes: [190, 420, 860, 1700], poids: [1, 0.75, 0.5, 0.3], amortissement: 0.009, bruit: 0.12, variation: 0.06, rate: 0, cliquetis: 0 },
  pickup: { modes: [60, 130, 260, 520], poids: [1, 0.9, 0.55, 0.3], amortissement: 0.03, bruit: 0.12, variation: 0.3, rate: 0, cliquetis: 0 },
  proto: { modes: [420, 900, 1900, 3600], poids: [1, 0.7, 0.45, 0.25], amortissement: 0.007, bruit: 0.09, variation: 0.04, rate: 0, cliquetis: 0 },
};

/** Générateur semé (mulberry32). */
function semer(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rend une période de boucle : `{ x, rpm }` (le régime effectif, qui rend la période entière en échantillons). */
function rendre(id, rpmVoulu, graine) {
  const p = PROFILS[id];
  const e = ECHAPPEMENT[id];
  const alea = semer(graine);
  const cycle = 120 / rpmVoulu; // 2 tours
  const M = Math.max(2, Math.ceil(PERIODE_MIN / cycle));
  const N = Math.round(M * cycle * SR);
  const rpm = (120 * M * SR) / N;
  const x = new Float32Array(N);
  // Réponse impulsionnelle d'un allumage : modes amortis + bouffée de bruit.
  const duree = Math.round(Math.min(0.09, e.amortissement * 6) * SR);
  const ri = new Float32Array(duree);
  const rn = (rpmVoulu - p.ralenti) / (p.rouge - p.ralenti);
  const chaud = 1 + 0.1 * rn; // le gaz chaud accorde un peu plus haut
  for (let m = 0; m < e.modes.length; m++) {
    const f = e.modes[m] * chaud;
    for (let j = 0; j < duree; j++) ri[j] += e.poids[m] * Math.exp(-j / SR / e.amortissement) * Math.sin((2 * Math.PI * f * j) / SR);
  }
  for (let j = 0; j < duree; j++) ri[j] += e.bruit * (alea() * 2 - 1) * Math.exp(-j / SR / (e.amortissement * 0.45));
  // Un cylindre = une amplitude fixe (la boucle la répète à chaque cycle), un tout petit décalage d'instant.
  const cyl = p.cylindres;
  const amp = Array.from({ length: cyl }, () => 1 + e.variation * (alea() - 0.5) * 2);
  const decal = Array.from({ length: cyl }, () => (alea() - 0.5) * 0.06);
  for (let c = 0; c < M; c++) {
    for (let i = 0; i < cyl; i++) {
      if (e.rate && alea() < e.rate) continue; // un allumage raté
      const t = ((c * cyl + i + decal[i]) / (M * cyl)) * N;
      const debut = Math.round(t);
      const a = amp[i] * (0.9 + 0.2 * alea());
      for (let j = 0; j < duree; j++) x[(debut + j) % N] += a * ri[j];
      if (e.cliquetis && alea() < e.cliquetis * 0.3) {
        // Le cliquetis d'une soupape fatiguée : un petit clic sec, à contretemps.
        const d2 = (debut + Math.round(0.4 * (N / (M * cyl)))) % N;
        for (let j = 0; j < 40; j++) x[(d2 + j) % N] += 0.35 * (alea() * 2 - 1) * Math.exp(-j / 9);
      }
    }
  }
  // Le grain de la combustion : saturation douce, puis retrait du continu, puis niveau (RMS constant ; le jeu règle le volume selon le régime).
  let moy = 0;
  for (const v of x) moy += v;
  moy /= N;
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    x[i] = Math.tanh(1.3 * (x[i] - moy));
    s2 += x[i] * x[i];
  }
  // Le souffle de l'admission et du bloc : un bruit lissé (période = la boucle), plus fort avec le régime, et le passe-bas qui ôte l'aigu criard (un pôle, circulaire :
  // la boucle reste sans raccord). La coupure suit celle du moteur (`timbre.coupure`), un peu plus haut : l'oreille veut de la matière, pas du sifflement.
  const blanc = new Float32Array(N);
  for (let i = 0; i < N; i++) blanc[i] = alea() * 2 - 1;
  const bruit = new Float32Array(N);
  const aBruit = 1 - Math.exp((-2 * Math.PI * (300 + 900 * rn)) / SR);
  let lisse = blanc[N - 1];
  for (let tour = 0; tour < 2; tour++) {
    for (let i = 0; i < N; i++) {
      lisse += aBruit * (blanc[i] - lisse);
      if (tour === 1) bruit[i] = lisse;
    }
  }
  let rb = 0;
  for (const v of bruit) rb += v * v;
  const niveauBruit = (0.1 + 0.18 * rn) * Math.sqrt(s2 / N) / Math.sqrt(rb / N + 1e-12);
  const fc = (p.timbre.coupure[0] + rn * (p.timbre.coupure[1] - p.timbre.coupure[0])) * 1.5;
  const ac = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let y = x[N - 1];
  for (let tour = 0; tour < 2; tour++) {
    for (let i = 0; i < N; i++) {
      y += ac * (x[i] + niveauBruit * bruit[i] * (tour === 1 ? 1 : 0) - y);
      if (tour === 1) x[i] = y;
    }
  }
  s2 = 0;
  for (let i = 0; i < N; i++) s2 += x[i] * x[i];
  const g = 0.2 / Math.sqrt(s2 / N);
  let crete = 0;
  for (let i = 0; i < N; i++) {
    x[i] *= g;
    crete = Math.max(crete, Math.abs(x[i]));
  }
  if (crete > 0.92) for (let i = 0; i < N; i++) x[i] *= 0.92 / crete;
  return { x, rpm, N, M };
}

/** Écrit un WAV mono 16 bits de trois copies de la période. */
function ecrireWav(chemin, x) {
  const n = x.length * 3;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let k = 0; k < 3; k++) for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + 2 * (k * x.length + i));
  writeFileSync(chemin, b);
}

const tmp = join(tmpdir(), `rendre-son-${process.pid}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(SORTIE, { recursive: true });
const manifeste = { sr: SR, profils: {} };
try {
  VOITURES_SON.forEach((id, ip) => {
    const p = PROFILS[id];
    const boucles = [];
    for (let i = 0; i < BOUCLES; i++) {
      const voulu = p.ralenti * Math.pow(p.rouge / p.ralenti, i / (BOUCLES - 1));
      const { x, rpm, N } = rendre(id, voulu, 1000 * (ip + 1) + i);
      const wav = join(tmp, `${id}-${i}.wav`);
      const fichier = `${id}-${i}.m4a`;
      ecrireWav(wav, x);
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-ar", String(SR), "-c:a", "aac", "-b:a", "40k", join(SORTIE, fichier)]);
      const L = N / SR;
      boucles.push({ fichier, rpm: Math.round(rpm * 10) / 10, debut: Math.round(L * 1e6) / 1e6, fin: Math.round(2 * L * 1e6) / 1e6 });
      console.log(`${fichier}  ${Math.round(rpm)} tr/min  boucle ${(L * 1000).toFixed(0)} ms`);
    }
    manifeste.profils[id] = boucles;
  });
  writeFileSync(join(SORTIE, "manifeste.json"), `${JSON.stringify(manifeste, null, 2)}\n`);
  console.log("manifeste.json écrit");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
