// Les SONS de « Pinball » (lot PBS1), la **décision** : de ce qui change entre deux pas de la simulation, la liste des sons à jouer, leur recette (notes et bruits filtrés), leur priorité, et le mélange (plafond de voix, délai minimal
// par son, moments forts qui passent devant). **Pur** : aucun `AudioContext` ici, `sons.ts` ne fait que jouer ce qu'on décide. Web Audio procédural, **aucun fichier** (rien à télécharger). **Présentation seulement : rien ici ne
// touche la simulation, la rediffusion ni les versions** — la scène lit `partie.ev` et l'état avant et après chaque pas, comme la vibration du PB2.
//
// **Ajouter un son (le lot de gameplay qui suit)** : une ligne dans `Evenement` (son nom et ses paramètres), la règle qui le déclenche dans `sonsDuPas` (un bit `EV_*` ou un changement de `Photo`), sa recette dans `recetteDe`, son
// délai dans `DELAIS_S` s'il peut s'enchaîner ; le test `sons.test.ts` échoue tant que sa recette n'est pas propre (attaque, fin sans clic, niveau borné) et `tune-sons.ts` (`?debug&sons`) en veut un exemple (le type l'impose).
import { EV_BANQUE, EV_BUMPER, EV_CIBLE, EV_COULEE, EV_FIN, EV_GEYSER, EV_LANCE, EV_MANEGE, EV_MISSION, EV_ORBITE, EV_PERDUE, EV_PORTAIL, EV_RAIL, EV_RAMPE, EV_RECUL, EV_COMBO, EV_JACKPOT, EV_MULTI, EV_MULTI_FIN, EV_NIVEAU, EV_SAUVEE, EV_SLING, EV_SPINNER, EV_TOURBILLON, EV_TROU, EV_VERROU_ALLUME, EV_VERROUILLEE, EV_VOIE, NB_VOIES, type ThemePinball } from "@cdj/pinball-sim";

/** Une couche d'un son : une note (oscillateur) ou un bruit filtré, avec son enveloppe (attaque brève, décroissance exponentielle, fin à zéro : jamais de clic). */
export interface Couche {
  type: "note" | "bruit";
  onde?: OscillatorType;
  /** Fréquence de départ (Hz) : la note, ou le centre du filtre d'un bruit. */
  freq: number;
  /** Fréquence d'arrivée (glissando, ou balayage du filtre). */
  vers?: number;
  duree: number;
  /** Niveau de crête, avant le volume des effets. */
  gain: number;
  retard?: number;
  /** Un filtre : celui du bruit (centre `freq`), ou, pour une note, un filtre qui adoucit l'onde (centre `coupure`). */
  filtre?: BiquadFilterType;
  coupure?: number;
  q?: number;
}

/** Les sons de la table, un par chose que le joueur doit entendre. **Une ligne de plus ici = un son de plus.** */
export type Evenement =
  | { son: "batteur"; cote: "gauche" | "droite"; appui: boolean }
  | { son: "lanceur"; charge: number }
  | { son: "sling" }
  | { son: "bumper"; theme: ThemePinball; rang: number }
  | { son: "cible"; rang: number }
  | { son: "banque" }
  | { son: "spinner"; spin: number }
  | { son: "trou"; phase: "aspire" | "relance" }
  | { son: "voie"; n: number }
  | { son: "voies" }
  | { son: "manege" }
  | { son: "tourbillon"; phase: "prise" | "sortie" }
  | { son: "portail" }
  | { son: "geyser" }
  | { son: "coulee" }
  | { son: "rail" }
  | { son: "recul" }
  | { son: "rampe" }
  | { son: "orbite" }
  | { son: "combo"; rang: number }
  | { son: "mult"; mult: number; retard: number }
  | { son: "missionPas"; compteur: number }
  | { son: "mission" }
  // lot PBG2 : la boucle — le verrou s'allume, une bille y est verrouillée (la première, la deuxième), la multibille part, un jackpot (le rang de la prise, plus aigu à chaque fois), la multibille finit, la mission revient (niveau)
  | { son: "verrouAllume" }
  | { son: "verrouillee"; n: number }
  | { son: "multibille" }
  | { son: "jackpot"; rang: number }
  | { son: "multibilleFin" }
  | { son: "niveau"; n: number }
  | { son: "sauvee" }
  | { son: "perdue" }
  | { son: "fin" };
export type NomSon = Evenement["son"];

/** Ce que la scène lit de la partie avant et après un pas (deux objets réutilisés : aucun tableau ni objet n'est créé à chaque pas). */
export interface Photo {
  gauche: boolean;
  droite: boolean;
  lanceur: boolean;
  /** La charge du lanceur, 0 à 1 000. */
  charge: number;
  dansLanceur: boolean;
  /** Les pas qu'il reste à la bille captive (trou ou tourbillon), et si c'est un tourbillon. */
  captif: number;
  captifTb: number;
  mult: number;
  compteur: number;
  /** Combien de couloirs du haut sont allumés. */
  voies: number;
  /** Rang du bumper touché à ce pas (−1 : aucun) et nombre de cibles tombées de la banque la plus avancée (0 : aucune) : la scène ne les cherche que quand l'événement a eu lieu. */
  bumper: number;
  cible: number;
  /** Lot PBG1 : le rang du combo en cours (0 : aucun). */
  combo: number;
  /** Lot PBG2 : les billes verrouillées, le rang du dernier jackpot de la multibille et le niveau de la mission. */
  verrouillees: number;
  jackpots: number;
  niveau: number;
  /** La vitesse de rotation la plus grande des spinners (`Partie.spin`), lue quand un spinner vient de tourner. */
  spin: number;
}
export const photoVide = (): Photo => ({ gauche: false, droite: false, lanceur: false, charge: 0, dansLanceur: true, captif: 0, captifTb: -1, mult: 1, compteur: 0, voies: 0, bumper: -1, cible: 0, combo: 0, verrouillees: 0, jackpots: 0, niveau: 1, spin: 0 });

const AUCUN: Evenement[] = [];

/**
 * Les sons d'un pas de la simulation (`ev` : les bits `EV_*` de `Partie.ev`), dans l'ordre où on les entend ; `avant` et `apres` : l'état autour du pas. Pure. **Le cas courant (rien ne se passe) ne crée rien.**
 * Les règles qui regroupent : la mission réussie prend la place du cran de multiplicateur qu'elle donne ; la dernière bille perdue est « fin de partie », pas « bille perdue » ; le troisième couloir allumé est l'arpège,
 * pas un « ding » (et le cran de multiplicateur qu'il donne suit l'arpège).
 */
export function sonsDuPas(ev: number, avant: Photo, apres: Photo, theme: ThemePinball): Evenement[] {
  const batteurs = avant.gauche !== apres.gauche || avant.droite !== apres.droite;
  const relache = avant.captif > 0 && apres.captif === 0;
  const pas = apres.compteur > avant.compteur;
  const cran = apres.mult > avant.mult;
  if (ev === 0 && !batteurs && !relache) return AUCUN;
  const sons: Evenement[] = [];
  if (avant.gauche !== apres.gauche) sons.push({ son: "batteur", cote: "gauche", appui: apres.gauche });
  if (avant.droite !== apres.droite) sons.push({ son: "batteur", cote: "droite", appui: apres.droite });
  if (ev & EV_LANCE) sons.push({ son: "lanceur", charge: avant.charge });
  if (ev & EV_SLING) sons.push({ son: "sling" });
  if (ev & EV_BUMPER) sons.push({ son: "bumper", theme, rang: Math.max(0, apres.bumper) });
  if (ev & EV_CIBLE) sons.push({ son: "cible", rang: Math.max(1, apres.cible) });
  if (ev & EV_BANQUE) sons.push({ son: "banque" });
  if (ev & EV_SPINNER) sons.push({ son: "spinner", spin: apres.spin });
  if (ev & EV_TROU) sons.push({ son: "trou", phase: "aspire" });
  if (ev & EV_VOIE) sons.push(apres.voies >= NB_VOIES ? { son: "voies" } : { son: "voie", n: Math.max(1, apres.voies) });
  if (ev & EV_MANEGE) sons.push({ son: "manege" });
  if (ev & EV_TOURBILLON) sons.push({ son: "tourbillon", phase: "prise" });
  if (ev & EV_PORTAIL) sons.push({ son: "portail" });
  if (ev & EV_GEYSER) sons.push({ son: "geyser" });
  if (ev & EV_COULEE) sons.push({ son: "coulee" });
  // lot PBG1 : les rails — la bille est prise (un souffle qui monte), elle recule (un petit choc sourd), une rampe ou l'orbite est menée à son bout, le combo monte (dès le deuxième rail, plus haut à chaque rang)
  if (ev & EV_RAIL) sons.push({ son: "rail" });
  if (ev & EV_RECUL) sons.push({ son: "recul" });
  if (ev & EV_RAMPE) sons.push({ son: "rampe" });
  if (ev & EV_ORBITE) sons.push({ son: "orbite" });
  if (ev & EV_COMBO) sons.push({ son: "combo", rang: Math.max(2, apres.combo) });
  if (relache) sons.push(avant.captifTb >= 0 ? { son: "tourbillon", phase: "sortie" } : { son: "trou", phase: "relance" });
  if (ev & EV_MISSION) sons.push({ son: "mission" });
  else {
    if (pas) sons.push({ son: "missionPas", compteur: apres.compteur });
    if (cran) sons.push({ son: "mult", mult: apres.mult, retard: ev & EV_VOIE ? RETARD_APRES_ARPEGE_S : 0 });
  }
  // lot PBG2 : la boucle — la multibille qui part remplace « bille verrouillée » (la deuxième) ; le verrou s'allume après la fanfare de la mission
  if (ev & EV_VERROU_ALLUME) sons.push({ son: "verrouAllume" });
  if (ev & EV_MULTI) sons.push({ son: "multibille" });
  else if (ev & EV_VERROUILLEE) sons.push({ son: "verrouillee", n: Math.max(1, apres.verrouillees) });
  if (ev & EV_JACKPOT) sons.push({ son: "jackpot", rang: Math.max(1, apres.jackpots) });
  if (ev & EV_MULTI_FIN) sons.push({ son: "multibilleFin" });
  if (ev & EV_NIVEAU) sons.push({ son: "niveau", n: apres.niveau });
  if (ev & EV_SAUVEE) sons.push({ son: "sauvee" });
  if (ev & EV_FIN) sons.push({ son: "fin" });
  else if (ev & EV_PERDUE) sons.push({ son: "perdue" });
  return sons;
}
/** Le cran de multiplicateur que donne le troisième couloir passe après l'arpège. */
export const RETARD_APRES_ARPEGE_S = 0.3;

// ---- les recettes ----

export interface Recette {
  nom: NomSon;
  couches: Couche[];
  /** 0 discret (le cliquetis du spinner) à 3 essentiel (la mission, la fin) : un son essentiel passe toujours, et passe devant. */
  priorite: number;
  /** Durée totale (s), couches et retards compris. */
  duree: number;
}

/** Fréquence d'une note, en demi-tons depuis le la 440 Hz. */
export const noteFreq = (demiTons: number): number => 440 * 2 ** (demiTons / 12);
const PENTATONIQUE = [0, 2, 4, 7, 9] as const;
const borne = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v));

const note = (onde: OscillatorType, freq: number, duree: number, gain: number, retard = 0, vers?: number): Couche => ({ type: "note", onde, freq, duree, gain, retard, vers });
const adoucie = (c: Couche, coupure: number, q = 0.7): Couche => ({ ...c, filtre: "lowpass", coupure, q });
const bruit = (freq: number, duree: number, gain: number, retard = 0, vers?: number, filtre: BiquadFilterType = "bandpass", q = 1.2): Couche => ({ type: "bruit", freq, duree, gain, retard, vers, filtre, q });

function recette(nom: NomSon, priorite: number, couches: Couche[]): Recette {
  return { nom, priorite, couches, duree: couches.reduce((m, c) => Math.max(m, (c.retard ?? 0) + c.duree), 0) };
}
/** Décale toutes les couches (les sons qui doivent suivre un autre). */
const apres = (couches: Couche[], retard: number): Couche[] => couches.map((c) => ({ ...c, retard: (c.retard ?? 0) + retard }));

/** Le bumper de chaque thème (le rang du bumper touché choisit la note dans une gamme pentatonique : un trio de bumpers fait un petit accord, jamais une fausse note). */
function bumper(theme: ThemePinball, rang: number, v: number): Couche[] {
  const n = PENTATONIQUE[((rang % 5) + 5) % 5]!;
  const k = 1 + 0.012 * v;
  switch (theme) {
    case "foire": {
      // Une pomme d'amour : un « toc » sucré, bref et clair.
      const f = 660 * 2 ** (n / 12) * k;
      return [note("triangle", f, 0.13, 0.17, 0, f * 0.97), note("sine", f * 2, 0.08, 0.06), bruit(3200, 0.016, 0.09, 0, 1600, "highpass", 0.8)];
    }
    case "ocean": {
      // Une bulle : un « bloop » qui monte vite, et une petite bulle qui le suit.
      const f = 230 * 2 ** (n / 12) * k;
      return [note("sine", f, 0.13, 0.22, 0, f * 2.4), note("sine", f * 1.6, 0.09, 0.09, 0.055, f * 3.2)];
    }
    case "espace": {
      // Une planète : un pincement de synthé, deux dents de scie légèrement désaccordées dont le filtre se ferme.
      const f = 330 * 2 ** (n / 12) * k;
      return [
        adoucie(note("sawtooth", f, 0.22, 0.08), f * 6),
        adoucie(note("sawtooth", f * 1.007, 0.22, 0.07), f * 4),
        note("sine", f / 2, 0.2, 0.1),
      ];
    }
    case "volcan": {
      // Une braise : un petit éclat sourd et un crépitement (trois grains de bruit aigus, de moins en moins forts).
      const f = 150 * 2 ** (n / 12) * k;
      return [note("sine", f, 0.09, 0.2, 0, f * 0.45), bruit(3600, 0.018, 0.17, 0, 1900, "highpass", 0.9), bruit(4300, 0.014, 0.12, 0.016 + 0.01 * v, 2200, "highpass", 0.9), bruit(3000, 0.012, 0.08, 0.04 + 0.014 * v, 1600, "highpass", 0.9)];
    }
  }
}

/** Le son d'un événement. `variation` ∈ [0, 1) fait varier un peu la hauteur : le jeu la tire d'un hasard d'AFFICHAGE, jamais de la simulation. */
export function recetteDe(e: Evenement, variation = 0.5): Recette {
  const v = variation - 0.5;
  switch (e.son) {
    case "batteur":
      // Le claquement mécanique d'un batteur qui monte ; la relâche est plus douce et plus sourde.
      return e.appui
        ? recette("batteur", 1, [bruit(2600 * (e.cote === "droite" ? 1.07 : 1) * (1 + 0.08 * v), 0.04, 0.2, 0, 800, "bandpass", 1.1), note("sine", 150 * (e.cote === "droite" ? 1.06 : 1), 0.08, 0.26, 0, 62), note("triangle", 420, 0.03, 0.06, 0, 240)])
        : recette("batteur", 1, [bruit(1500 * (1 + 0.08 * v), 0.035, 0.08, 0, 520, "bandpass", 0.9), note("sine", 110, 0.06, 0.1, 0, 70)]);
    case "lanceur": {
      // La détente du ressort : un fouet qui se relâche, plus fort si la charge était pleine.
      const k = 0.45 + 0.55 * borne(e.charge / 1000);
      return recette("lanceur", 1, [note("triangle", 460 * (1 + 0.05 * v), 0.16, 0.16 * k, 0, 110), bruit(2000, 0.12, 0.12 * k, 0, 420, "bandpass", 0.9), note("sine", 170, 0.09, 0.24 * k, 0, 55)]);
    }
    case "sling":
      // Un claquement sec.
      return recette("sling", 1, [bruit(3300 * (1 + 0.06 * v), 0.03, 0.21, 0, 1300, "bandpass", 1.5), note("triangle", 560 * (1 + 0.04 * v), 0.05, 0.13, 0, 250)]);
    case "bumper":
      return recette("bumper", 1, bumper(e.theme, e.rang, v));
    case "cible": {
      // Un « tock » de bois, un peu plus haut à chaque cible de la banque.
      const f = 480 * 2 ** (([0, 4, 7][Math.min(2, Math.max(0, e.rang - 1))]!) / 12) * (1 + 0.02 * v);
      return recette("cible", 1, [note("sine", f, 0.09, 0.22, 0, f * 0.62), bruit(1600, 0.035, 0.13, 0, 650, "bandpass", 2)]);
    }
    case "banque":
      // La banque est tombée : un arpège brillant qui monte, après le dernier « tock ».
      return recette("banque", 2, apres([0, 4, 7, 12].flatMap((d, i) => [note("triangle", 523 * 2 ** (d / 12), 0.15, 0.15, i * 0.065), note("sine", 1046 * 2 ** (d / 12), 0.1, 0.04, i * 0.065)]), 0.06));
    case "spinner": {
      // Un clic de roue à rochet ; plus la roue tourne vite, plus il est haut.
      const k = 1 + 0.7 * borne(e.spin / 30000);
      return recette("spinner", 0, [bruit(4200 * k * (1 + 0.1 * v), 0.016, 0.3, 0, 2600 * k, "bandpass", 2.2), note("triangle", 1900 * k, 0.014, 0.1)]);
    }
    case "trou":
      // La bille est aspirée (un glissement qui plonge et se ferme), puis relancée (un « pop » qui monte).
      return e.phase === "aspire"
        ? recette("trou", 1, [note("sine", 950, 0.3, 0.15, 0, 170), bruit(1400, 0.3, 0.1, 0, 300, "lowpass", 0.8)])
        : recette("trou", 1, [note("triangle", 190, 0.17, 0.18, 0, 720), bruit(500, 0.13, 0.12, 0, 2600, "bandpass", 1)]);
    case "voie": {
      // Un « ding » : plus haut à chaque couloir allumé.
      const f = 880 * 2 ** (([0, 4, 7][Math.min(2, Math.max(0, e.n - 1))]!) / 12);
      return recette("voie", 1, [note("sine", f, 0.32, 0.17), note("sine", f * 2.01, 0.2, 0.05)]);
    }
    case "voies":
      // Les trois couloirs sont allumés : un arpège qui monte.
      return recette("voies", 2, [0, 4, 7, 12, 16].map((d, i) => note("triangle", 659 * 2 ** (d / 12), 0.16, 0.15, i * 0.05)));
    case "manege":
      // Un tour de manège : quelques notes d'orgue de barbarie (deux anches un peu désaccordées, un filtre qui les adoucit), en valse.
      return recette(
        "manege",
        1,
        [0, 4, 7, 4].flatMap((d, i) => {
          const f = 392 * 2 ** (d / 12);
          return [adoucie(note("square", f, 0.1, 0.05, i * 0.1), 1800), adoucie(note("square", f * 1.006, 0.1, 0.045, i * 0.1), 1800), note("sine", f * 2, 0.08, 0.04, i * 0.1)];
        }),
      );
    case "tourbillon":
      // Un souffle qui tourne (le filtre monte, puis redescend) ; la sortie est un petit « pop ».
      return e.phase === "prise"
        ? recette("tourbillon", 1, [bruit(350, 0.45, 0.13, 0, 2300, "bandpass", 3), bruit(2300, 0.45, 0.12, 0.45, 300, "bandpass", 3), note("sine", 260, 0.9, 0.05, 0, 520)])
        : recette("tourbillon", 1, [note("sine", 300, 0.12, 0.17, 0, 680), bruit(900, 0.1, 0.09, 0, 2400, "bandpass", 1)]);
    case "portail":
      // Un passage : on plonge dans l'un et on sort de l'autre.
      return recette("portail", 1, [note("sine", 1250, 0.12, 0.14, 0, 280), note("sine", 280, 0.17, 0.14, 0.1, 1400), bruit(1500, 0.28, 0.06, 0, 3500, "bandpass", 1.5)]);
    case "geyser":
      // Un jet de vapeur : un souffle de bruit qui monte et s'éteint.
      return recette("geyser", 1, [bruit(2200 * (1 + 0.08 * v), 0.55, 0.2, 0, 6000, "bandpass", 0.7), note("sine", 120, 0.28, 0.12, 0, 230)]);
    case "coulee":
      // Un grondement qui s'éloigne par le haut.
      return recette("coulee", 1, [bruit(220, 0.5, 0.22, 0, 90, "lowpass", 0.7), note("sine", 75, 0.5, 0.18, 0, 44)]);
    case "rail":
      // La bille entre sur un rail : un souffle qui monte, et le ronflement du rail qui s'éloigne.
      return recette("rail", 1, [bruit(500, 0.4, 0.16, 0, 3200, "bandpass", 1.6), note("sine", 180, 0.45, 0.1, 0, 420)]);
    case "recul":
      // Trop lente : le rail la rend, un petit choc sourd qui descend.
      return recette("recul", 1, [note("sine", 220, 0.18, 0.2, 0, 70), bruit(700, 0.14, 0.1, 0, 220, "lowpass", 0.8)]);
    case "rampe":
      // Une rampe réussie : trois notes claires qui montent, la dernière tenue.
      return recette("rampe", 2, [0, 5, 9].map((d, i) => note("triangle", 587 * 2 ** (d / 12), i === 2 ? 0.28 : 0.1, 0.16, i * 0.07)));
    case "orbite":
      // L'orbite : un balayage qui tourne et retombe en deux notes.
      return recette("orbite", 2, [bruit(900, 0.3, 0.1, 0, 2600, "bandpass", 2), note("triangle", 698, 0.1, 0.15, 0.04), note("triangle", 880, 0.24, 0.15, 0.12)]);
    case "combo": {
      // Le combo : un « ding » brillant, d'un demi-ton plus haut à chaque rang (de 2 à 6).
      const f = 1046 * 2 ** ((borne(e.rang, 2, 6) - 2) / 12);
      return recette("combo", 2, apres([note("sine", f, 0.3, 0.17), note("sine", f * 1.5, 0.2, 0.08, 0.05), note("sine", f * 2.01, 0.15, 0.04)], 0.1));
    }
    case "mult": {
      // Une courte fanfare, plus aiguë à chaque cran (×2 : sol ; un ton de plus à chaque cran).
      const f = 392 * 2 ** ((2 * (borne(e.mult, 2, 6) - 2)) / 12);
      return recette("mult", 2, apres([note("triangle", f, 0.1, 0.16), note("triangle", f * 1.25, 0.1, 0.16, 0.08), note("triangle", f * 1.5, 0.1, 0.16, 0.16), note("triangle", f * 2, 0.3, 0.17, 0.24), note("sine", f * 4, 0.2, 0.04, 0.24)], e.retard));
    }
    case "missionPas": {
      // Un pas de la jauge : une note claire, un peu plus haute à chaque pas ; elle suit le son de l'élément.
      const f = 587 * 2 ** ((2 * Math.max(1, e.compteur)) / 12);
      return recette("missionPas", 2, apres([note("sine", f, 0.2, 0.15), note("sine", f * 2, 0.12, 0.05)], 0.12));
    }
    case "mission":
      // La mission réussie : une vraie fanfare, la plus longue des sons de la table.
      return recette("mission", 3, [
        ...[0, 4, 7, 12, 7, 12, 16].map((d, i) => note("triangle", 523 * 2 ** (d / 12), i === 6 ? 0.55 : 0.12, 0.17, i * 0.1)),
        ...[0, 4, 7, 12, 7, 12, 16].map((d, i) => note("sine", 1046 * 2 ** (d / 12), i === 6 ? 0.45 : 0.1, 0.06, i * 0.1)),
        bruit(6000, 0.5, 0.05, 0.6, 9000, "highpass", 0.8),
      ]);
    case "verrouAllume":
      // Le verrou s'allume (après la fanfare de la mission) : un déclic de serrure et deux notes claires qui montent.
      return recette("verrouAllume", 2, apres([bruit(2400, 0.05, 0.14, 0, 900, "bandpass", 2), note("square", 196, 0.07, 0.07, 0, 150), note("triangle", 698, 0.12, 0.15, 0.08), note("triangle", 988, 0.3, 0.16, 0.18), note("sine", 1976, 0.2, 0.04, 0.18)], 0.9));
    case "verrouillee": {
      // Une bille verrouillée : un « clac » métallique sourd, un peu plus haut pour la deuxième.
      const k = e.n >= 2 ? 1.19 : 1;
      return recette("verrouillee", 2, [note("sine", 170 * k, 0.12, 0.24, 0, 70), bruit(3000, 0.04, 0.14, 0, 1200, "bandpass", 2), note("triangle", 523 * k, 0.16, 0.12, 0.07), note("triangle", 784 * k, 0.24, 0.12, 0.13)]);
    }
    case "multibille":
      // Le départ de la multibille : une fanfare qui monte, un roulement de billes qui s'envolent, la plus pleine des sons de la boucle.
      return recette("multibille", 3, [
        bruit(500, 0.5, 0.16, 0, 5000, "bandpass", 1.3),
        ...[0, 4, 7, 12, 16, 19, 24].map((d, i) => note("triangle", 392 * 2 ** (d / 12), i === 6 ? 0.5 : 0.1, 0.17, 0.05 + i * 0.075)),
        ...[0, 7, 12, 19].map((d, i) => note("sine", 784 * 2 ** (d / 12), 0.35, 0.05, 0.3 + i * 0.075)),
        note("sine", 98, 0.5, 0.2, 0, 60),
      ]);
    case "jackpot": {
      // Un jackpot : une cloche brillante, deux tons plus haute à chaque prise (la huitième s'arrête là).
      const f = 880 * 2 ** ((2 * (borne(e.rang, 1, 8) - 1)) / 12);
      return recette("jackpot", 2, [note("sine", f, 0.4, 0.17), note("sine", f * 2.76, 0.25, 0.06), note("triangle", f * 1.5, 0.3, 0.09, 0.06), bruit(6000, 0.08, 0.06, 0, 9000, "highpass", 0.8)]);
    }
    case "multibilleFin":
      // La multibille s'arrête : trois notes qui redescendent doucement.
      return recette("multibilleFin", 2, [0, -5, -9].map((d, i) => note("triangle", 698 * 2 ** (d / 12), i === 2 ? 0.35 : 0.12, 0.14, i * 0.1)));
    case "niveau": {
      // La mission revient, plus haut : une petite fanfare qui monte d'un ton à chaque niveau (au plus cinq tons de plus).
      const f = 523 * 2 ** ((2 * (borne(e.n, 2, 7) - 2)) / 12);
      return recette("niveau", 3, [0, 4, 7, 12].map((d, i) => note("triangle", f * 2 ** (d / 12), i === 3 ? 0.4 : 0.1, 0.16, i * 0.09)));
    }
    case "sauvee":
      // La bille est sauvée : un petit jingle qui monte, rassurant.
      return recette("sauvee", 2, [0, 7, 12, 16].map((d, i) => note("triangle", 440 * 2 ** (d / 12), i === 3 ? 0.3 : 0.1, 0.15, i * 0.075)));
    case "perdue":
      // La bille est perdue : une chute qui descend, puis un petit choc sourd. Pas punitif.
      return recette("perdue", 2, [note("sine", 540, 0.55, 0.2, 0, 105), note("triangle", 405, 0.5, 0.1, 0.05, 82), note("sine", 78, 0.16, 0.2, 0.5, 48)]);
    case "fin":
      // La fin de la partie : quatre notes qui descendent et un accord grave qui se pose.
      return recette("fin", 3, [
        ...[0, -3, -7, -12].map((d, i) => note("triangle", 523 * 2 ** (d / 12), 0.2, 0.18, i * 0.17)),
        note("sine", 131, 0.8, 0.2, 0.68),
        note("triangle", 196, 0.8, 0.12, 0.68),
        note("triangle", 247, 0.8, 0.1, 0.68),
      ]);
  }
}

// ---- le mélange : plafond de voix, délai minimal, priorité ----

/** Le plafond de sons joués en même temps : au-delà, un son moins prioritaire cède la place, ou n'est pas joué. */
export const VOIX_MAX = 10;
/** Jamais plus : même un moment fort vole la place du plus discret et du plus ancien. */
export const VOIX_ABSOLU = 14;
/** Au plus autant de voix du même son à la fois (un bumper qui enchaîne ne fait pas un mur de sons). */
export const PAR_SON_MAX = 3;
/** Le délai minimal entre deux sons du même nom (s) : celui d'un son qui peut s'enchaîner vite (un bumper, un lance-pierre) ; les autres, 40 ms (jamais deux fois le même d'un seul coup). */
export const DELAIS_S: Readonly<Partial<Record<NomSon, number>>> = {
  batteur: 0.025,
  bumper: 0.05,
  sling: 0.06,
  cible: 0.04,
  spinner: 0.032,
  voie: 0.09,
  trou: 0.15,
  manege: 0.2,
  tourbillon: 0.4,
  portail: 0.2,
  geyser: 0.25,
  coulee: 0.25,
  rail: 0.3,
  rampe: 0.25,
  orbite: 0.25,
  combo: 0.15,
  missionPas: 0.15,
};
export const DELAI_DEFAUT_S = 0.04;

export interface Decision {
  jouer: boolean;
  /** La voix à couper (en fondu, jamais d'un coup) pour faire de la place. */
  couper: number | null;
  /** Le numéro de la voix si elle joue. */
  id: number;
}

/** Le mélange : qui joue, qui cède la place, qui est refusé. Pur et déterministe (le temps est donné). */
export class Melange {
  private voix: { id: number; son: NomSon; debut: number; fin: number; priorite: number }[] = [];
  private dernier = new Map<NomSon, number>();
  private suivant = 1;

  /** Le nombre de voix en cours à l'instant `t`. */
  enCours(t: number): number {
    this.purger(t);
    return this.voix.length;
  }

  private purger(t: number): void {
    if (this.voix.some((v) => v.fin <= t)) this.voix = this.voix.filter((v) => v.fin > t);
  }

  /** Un son demande à jouer à l'instant `t` (s, l'horloge du contexte audio), pour `duree` secondes. */
  demander(son: NomSon, priorite: number, duree: number, t: number): Decision {
    this.purger(t);
    const refus: Decision = { jouer: false, couper: null, id: 0 };
    const avant = this.dernier.get(son);
    if (avant !== undefined && t - avant < (DELAIS_S[son] ?? DELAI_DEFAUT_S)) return refus;
    if (priorite < 3 && this.voix.filter((v) => v.son === son).length >= PAR_SON_MAX) return refus;
    let couper: number | null = null;
    const plafond = priorite >= 3 ? VOIX_ABSOLU : VOIX_MAX;
    if (this.voix.length >= plafond) {
      // la victime : la moins prioritaire, la plus ancienne ; elle ne cède que devant un son plus prioritaire (ou un moment essentiel)
      let victime = this.voix[0]!;
      for (const v of this.voix) if (v.priorite < victime.priorite || (v.priorite === victime.priorite && v.debut < victime.debut)) victime = v;
      if (victime.priorite >= priorite && priorite < 3) return refus;
      couper = victime.id;
      this.voix = this.voix.filter((v) => v.id !== victime.id);
    }
    const id = this.suivant++;
    this.voix.push({ id, son, debut: t, fin: t + duree, priorite });
    this.dernier.set(son, t);
    return { jouer: true, couper, id };
  }
}

// ---- les sons continus : roulement, ressort, trou noir, cliquetis du spinner ----

/** Le niveau du roulement de la bille (0 à 0,05) : un souffle très bas dont le volume suit la vitesse (px/s, 1 500 au plus) ; rien à l'arrêt. */
export const niveauRoulement = (vitesse: number): number => (vitesse < 40 ? 0 : 0.05 * borne(vitesse / 1500) ** 1.3);
/** La fréquence du filtre du roulement (Hz) : plus la bille va vite, plus le souffle est clair. */
export const coupureRoulement = (vitesse: number): number => 160 + 900 * borne(vitesse / 1500);
/** La hauteur du ressort du lanceur (Hz) : elle monte avec la charge (0 à 1 000) ; rien tant que le joueur ne tient pas le lanceur. */
export const hauteurRessort = (charge: number): number => 85 * 2 ** (1.7 * borne(charge / 1000));
export const niveauRessort = (charge: number): number => (charge <= 0 ? 0 : 0.045 + 0.04 * borne(charge / 1000));
/** Le grondement du trou noir (0 à 0,13) : plus la bille s'en approche, plus il est fort ; rien hors de son rayon. */
export const niveauTrouNoir = (distance: number, rayon: number): number => (distance >= rayon || rayon <= 0 ? 0 : 0.13 * (1 - distance / rayon) ** 1.5);
/** La cadence du cliquetis (clics par seconde) selon la vitesse de rotation du spinner (`Partie.spin`, 30 000 au plus) : 0 quand il ne tourne presque plus. */
export const cadenceSpinner = (spin: number): number => (spin < 800 ? 0 : Math.min(22, 4 + (spin / 1000) * 0.7));

/** Le cliquetis du spinner : combien de clics tombent dans `dt` secondes à la cadence de la rotation. Un reste se garde d'une image à l'autre. */
export class Cliquetis {
  private reste = 0;
  avancer(dt: number, spin: number): number {
    const c = cadenceSpinner(spin);
    if (c === 0) {
      this.reste = 0;
      return 0;
    }
    this.reste += c * Math.min(dt, 0.1);
    const n = Math.floor(this.reste);
    this.reste -= n;
    return n;
  }
}

/** Du curseur de volume du joueur (0 à 1) au niveau des effets : quadratique, comme le son des autres jeux (le bas du curseur est fin) ; 0 ou illisible : rien ne se joue. */
export const niveauEffets = (volume: number): number => (volume > 0 ? Math.min(1, volume) ** 2 : 0);
