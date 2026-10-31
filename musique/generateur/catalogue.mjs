// Le catalogue des boucles générées (lot « musique », seconde étape) : **une fiche par scène** (le menu de chaque jeu et chacun de ses thèmes), rendue par un modèle de `modeles.mjs`.
// `jeu` et `scenes` disent où la boucle joue (les mêmes noms que `musique/musiques.json` et `packages/musique/src/scenes.ts`) ; `titre` est celui qui s'affiche dans le panneau.
// Les trois premiers morceaux (le menu et la Nuit de Track, la Forêt de Jump) restent écrits note par note dans `morceaux.mjs`.
// **Remplacer une boucle par un morceau acheté** : voir `docs/plateforme/musique.md` (on garde la scène, on change la source).
// Tonique : une note MIDI (60 = do central) ; `prog` : des degrés de la gamme (0 = I, 4 = V, 5 = vi…).
import { calme, chip, electro } from "./modeles.mjs";

const piece = (modele, jeu, scenes, titre, fiche) => ({ ...modele({ ...fiche }), jeu, scenes, titre });

// ——— Track : électro moderne, rythmée ———
export const TRACK = [
  piece(electro, "track", ["theme:stade"], "Tribune", {
    id: "track-stade", bpm: 132, graine: 4401, tonique: 62, gamme: "maj", prog: [0, 4, 5, 3], basse: "roll", hats: 1, stab: true, montee: true,
    arp: { motif: "large", wave: "saw", gain: 0.048 }, lead: { wave: "saw", gain: 0.105, lp: [4800, 2600] }, pompe: 0.62, salle: 0.8,
  }),
  piece(electro, "track", ["theme:rallye"], "Spéciale", {
    id: "track-rallye", bpm: 140, graine: 4502, tonique: 52, gamme: "dor", prog: [0, 0, 3, 6], kicks: [0, 6, 10], caisse: "snare", basse: "roll", hats: 2, stab: true, montee: true,
    arp: { motif: "rebond", wave: "pulse", gain: 0.046, duty: 0.3 }, lead: { wave: "saw", gain: 0.095, lp: [3600, 1900] }, pompe: 0.7, salle: 0.78, saturation: 1.5,
  }),
  piece(electro, "track", ["theme:banquise"], "Verglas", {
    id: "track-banquise", bpm: 118, graine: 4603, tonique: 53, gamme: "lyd", prog: [0, 1, 0, 4], kicks: [0, 8], caisse: "aucune", basse: "tenue", hats: 0, stab: false,
    arp: { motif: "large", wave: "tri", gain: 0.085 }, lead: { wave: "saw", gain: 0.085, lp: [3000, 1900] }, nappe: { gain: 0.07, lp: [2200, 1400] }, pompe: 0.4, echo: 0.5, salle: 0.93,
  }),
  piece(electro, "track", ["theme:campagne"], "Chemin de terre", {
    id: "track-campagne", bpm: 110, graine: 4704, tonique: 55, gamme: "mix", prog: [0, 6, 3, 0], basse: "sync", hats: 1, stab: false,
    arp: { motif: "monte", wave: "pulse", gain: 0.05, duty: 0.25 }, lead: { wave: "saw", gain: 0.1, lp: [2800, 1800] }, nappe: { gain: 0.055, lp: [1300, 900] }, pompe: 0.45, salle: 0.75,
  }),
  piece(electro, "track", ["theme:canyon"], "Mirage", {
    id: "track-canyon", bpm: 124, graine: 4805, tonique: 57, gamme: "phr", prog: [0, 1, 0, 6], kicks: [0, 8, 11], basse: "tenue", hats: 1, stab: true,
    arp: { motif: "rebond", wave: "saw", gain: 0.042 }, lead: { wave: "saw", gain: 0.1, lp: [3200, 1700] }, nappe: { gain: 0.065, lp: [1100, 750] }, pompe: 0.55, echo: 0.46, salle: 0.9, saturation: 1.3,
  }),
  piece(electro, "track", ["theme:col"], "Lacets", {
    id: "track-col", bpm: 126, graine: 4906, tonique: 55, gamme: "maj", prog: [0, 2, 3, 4], basse: "contretemps", hats: 1, stab: true, montee: true,
    arp: { motif: "large", wave: "saw", gain: 0.045 }, lead: { wave: "saw", gain: 0.11, lp: [5000, 2800] }, nappe: { gain: 0.07, lp: [1800, 1200] }, pompe: 0.58, salle: 0.88,
  }),
  piece(electro, "track", ["theme:ville"], "Heure de pointe", {
    id: "track-ville", bpm: 118, graine: 5007, tonique: 60, gamme: "min", prog: [0, 5, 2, 6], basse: "sync", hats: 2, stab: true,
    arp: { motif: "monte", wave: "pulse", gain: 0.05, duty: 0.5 }, lead: { wave: "saw", gain: 0.095, lp: [3800, 2000] }, pompe: 0.62, salle: 0.8, saturation: 1.35,
  }),
];

// ——— Jump : chiptune rétro ———
export const JUMP = [
  piece(chip, "jump", ["menu"], "Écran titre", {
    id: "jump-menu", bpm: 128, graine: 6101, tonique: 60, gamme: "maj", prog: [0, 4, 5, 2, 3, 0, 3, 4], batterie: "march", basse: "bond",
    arp: { duty: 0.125 }, lead: { duty: 0.5, gain: 0.1 },
  }),
  piece(chip, "jump", ["theme:usine"], "Chaîne de montage", {
    id: "jump-usine", bpm: 150, graine: 6202, tonique: 57, gamme: "min", prog: [0, 0, 5, 6, 0, 0, 3, 4], batterie: "rock", basse: "croche",
    arp: { duty: 0.25 }, lead: { duty: 0.25, gain: 0.095 }, bruitHaut: 11000,
  }),
  piece(chip, "jump", ["theme:glace"], "Neige molle", {
    id: "jump-glace", bpm: 112, graine: 6303, tonique: 53, gamme: "lyd", prog: [0, 1, 0, 4, 0, 1, 5, 4], batterie: "sparse", basse: "tenue",
    arp: { duty: 0.5, legato: true }, lead: { duty: 0.5, gain: 0.09 }, echo: 0.55,
  }),
  piece(chip, "jump", ["theme:nuit"], "Ruelle", {
    id: "jump-nuit", bpm: 124, graine: 6404, tonique: 52, gamme: "min", prog: [0, 5, 2, 6, 0, 5, 3, 6], batterie: "sparse", basse: "bond",
    arp: { duty: 0.125 }, lead: { duty: 0.125, gain: 0.09 }, echo: 0.5,
  }),
  piece(chip, "jump", ["theme:neon"], "Autoroute 84", {
    id: "jump-neon", bpm: 150, graine: 6505, tonique: 54, gamme: "min", prog: [0, 5, 2, 6, 0, 5, 3, 4], batterie: "march", basse: "croche",
    arp: { duty: 0.25 }, lead: { duty: 0.25, gain: 0.1 }, echo: 0.45,
  }),
];

// ——— Tower : calme, on empile posément ———
export const TOWER = [
  piece(calme, "tower", ["menu"], "Premier étage", {
    id: "tower-menu", bpm: 88, graine: 7101, tonique: 55, gamme: "maj", prog: [0, 4, 5, 3], perc: "doux", pluck: { wave: "tri", gain: 0.075 }, cloche: { wave: "sine", gain: 0.11 },
  }),
  piece(calme, "tower", ["theme:port"], "Marée basse", {
    id: "tower-port", bpm: 92, graine: 7202, tonique: 57, gamme: "mix", prog: [0, 6, 3, 0], perc: "doux", pluck: { wave: "tri", gain: 0.07 }, cloche: { wave: "sine", gain: 0.12 }, echo: 0.45,
  }),
  piece(calme, "tower", ["theme:chantier"], "Échafaudage", {
    id: "tower-chantier", bpm: 100, graine: 7303, tonique: 55, gamme: "dor", prog: [0, 3, 6, 3], perc: "tic", pluck: { wave: "pulse", gain: 0.06, duty: 0.3 }, cloche: { wave: "tri", gain: 0.09 },
  }),
  piece(calme, "tower", ["theme:canyon"], "Terre rouge", {
    id: "tower-canyon", bpm: 80, graine: 7404, tonique: 52, gamme: "phr", prog: [0, 1, 0, 6], perc: "tribal", pluck: { wave: "tri", gain: 0.07 }, cloche: { wave: "sine", gain: 0.12 }, salle: 0.93,
  }),
  piece(calme, "tower", ["theme:banquise"], "Cristaux", {
    id: "tower-banquise", bpm: 76, graine: 7505, tonique: 53, gamme: "lyd", prog: [0, 1, 0, 4], perc: "aucune", pluck: { wave: "sine", gain: 0.085 }, cloche: { wave: "tri", gain: 0.1 }, salle: 0.94, echo: 0.5,
  }),
  piece(calme, "tower", ["theme:jungle"], "Canopée", {
    id: "tower-jungle", bpm: 96, graine: 7606, tonique: 55, gamme: "mix", prog: [0, 3, 4, 3], perc: "tribal", pluck: { wave: "pulse", gain: 0.058, duty: 0.2 }, cloche: { wave: "sine", gain: 0.1 },
  }),
  piece(calme, "tower", ["theme:nuit"], "Veilleuse", {
    id: "tower-nuit", bpm: 70, graine: 7707, tonique: 57, gamme: "min", prog: [0, 5, 2, 6], perc: "aucune", pluck: { wave: "sine", gain: 0.08 }, cloche: { wave: "sine", gain: 0.12 }, salle: 0.93,
  }),
];

export const GENEREES = [...TRACK, ...JUMP, ...TOWER];
