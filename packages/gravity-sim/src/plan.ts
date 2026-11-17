import { mixSeed, Rng } from "@cdj/core";
import { Trajectoire } from "./camera";
import { CASE, FACTEUR_NORMAL, LARGEUR_MORCEAU, MODE_ONDE, NB_THEMES, type ModeDeVol } from "./constantes";
import { FACTEUR_DU_PORTAIL, type Motif, type TypePortail } from "./monde";
import type { Regles } from "./regles";
import { cleDesRegles } from "./regles";

// LE PLAN DU JOUR (lot GR6) : **où sont les sections à mode et les portails de vitesse**, décidé une fois pour tout le niveau, de façon pure (la graine du jour, le rang du thème) — le générateur d'un morceau le lit pour savoir
// s'il est dans une section (et laquelle), s'il porte un portail, à quelle vitesse la caméra y arrive. Le plan se construit **paresseusement et dans l'ordre** (le facteur de vitesse d'un morceau est celui du dernier portail).
//
// **Les sections** : une section est `longueur` morceaux de contenu (2 à 4 : 4 à 8 secondes) puis **un morceau de retour** (« le retour propre au mode gravité » : le portail de retour, puis un couloir libre avec son sol) ; le portail
// d'entrée est à la colonne `COLONNE_PORTAIL` du premier morceau, **le morceau d'avant est toujours calme et finit sur le sol** (on entre avec la gravité vers le bas). **L'introduction** : au rang 0 de la première boucle la
// première section est un avion, au rang 1 une onde, au rang 2 un ressort — **selon le rang du thème, pas selon le thème lui-même** —, **la première section de chaque mode est facile** (deux morceaux, un couloir large).
// Ensuite les modes se mélangent, plus nombreux et plus denses à chaque boucle. **Les portails de vitesse** arrivent dès le 2e thème : rapides là où le passage laisse respirer, lents avant un passage technique.

/** La colonne (du morceau) des portails : celui d'entrée d'une section, celui de retour, ceux de vitesse. */
export const COLONNE_PORTAIL = 1;
/** Les morceaux de contenu d'une section : 2 à 4. */
export const SECTION_MIN = 2;
export const SECTION_MAX = 4;

export interface InfoSection {
  mode: 1 | 2 | 3;
  /** Le rang du morceau dans la section : 0 à `longueur − 1` pour le contenu, `longueur` pour le morceau de retour. */
  rang: number;
  longueur: number;
  /** La première section de ce mode dans le jour : facile. */
  facile: boolean;
}
export interface InfoMorceau {
  section: InfoSection | null;
  /** Le portail de vitesse de ce morceau (à la colonne `COLONNE_PORTAIL`), s'il y en a un. */
  vitesse: TypePortail | null;
  /** Le facteur de vitesse (pour cent) en vigueur à la colonne 0 de ce morceau. */
  facteurEntree: number;
  /** Le morceau d'après est le premier d'une section : celui-ci est calme et finit sur le sol. */
  avantSection: boolean;
}

/** Les motifs « qui laissent respirer » et les motifs « techniques » des morceaux de gravité : les portails de vitesse en dépendent. */
const TECHNIQUES: readonly string[] = ["zigzag", "milieu", "escalier", "etages", "inverseur", "ilots", "special"];

/** La difficulté d'un morceau, de 0 à 100 : monte sur le tour des cinq thèmes, repart de la base relevée de 35 % à la boucle suivante (celle du générateur de la version 3, inchangée). */
export const RAMPE_PAR_BOUCLE = 35;
export function difficulte(m: number, regles: Regles): number {
  const parBoucle = regles.morceauxParTheme * NB_THEMES;
  return Math.min(100, Math.trunc(((m % parBoucle) * 100) / 60) + Math.trunc(m / parBoucle) * RAMPE_PAR_BOUCLE);
}

/** Sel de la graine des morceaux (propre au jeu) : le même que celui du générateur. */
export const SEL_MORCEAU = 0x6a9d3f;
const SEL_PLAN = 0x3b71c5;
const SEL_VITESSE = 0x52f8a1;

const LISTE: readonly Motif[] = ["trouBas", "trouHaut", "zigzag", "pilier", "pics", "milieu", "escalier", "etages", "inverseur", "ilots"];
/**
 * Le motif tiré d'un morceau de gravité **avant** les remplacements que la vitesse impose : les deux premiers tirages du générateur (`special`, puis le motif), refaits ici pour que le plan sache, sans générer le morceau, s'il
 * est technique. Les trois premiers morceaux sont calmes.
 */
export function motifBrut(jour: number, m: number, d: number): Motif {
  if (m < 3) return "calme";
  const rng = new Rng(mixSeed(mixSeed(jour, SEL_MORCEAU), m));
  const special = rng.chance(38);
  return special ? "special" : LISTE[rng.int(d < 30 ? 7 : LISTE.length)]!;
}

interface Placee {
  mode: 1 | 2 | 3;
  premier: number;
  longueur: number;
  facile: boolean;
}

/** Le plan d'un jour sous des règles données. */
export class PlanDuJour {
  private readonly infos: InfoMorceau[] = [];
  private readonly sections: Placee[] = [];
  /** Le rang de thème dont les sections sont placées (exclu), et les modes déjà vus (masque de bits). */
  private themesPlaces = 0;
  private modesVus = 0;
  private dernierMode = 0;
  readonly trajectoire: Trajectoire;
  constructor(
    readonly jour: number,
    readonly regles: Regles,
  ) {
    this.trajectoire = new Trajectoire(regles, (x) => this.facteurAu(x));
  }

  /** Place les sections des thèmes jusqu'au thème `T` inclus. */
  private placerJusqu(T: number): void {
    while (this.themesPlaces <= T) this.placerTheme(this.themesPlaces++);
  }

  private placerTheme(T: number): void {
    const parTheme = this.regles.morceauxParTheme;
    const rang = T % NB_THEMES;
    const boucle = Math.trunc(T / NB_THEMES);
    const rng = new Rng(mixSeed(mixSeed(this.jour, SEL_PLAN), T));
    const base = T * parTheme;
    // Le nombre de sections : une aux trois premiers thèmes (l'introduction), deux aux suivants, une de plus à chaque boucle.
    let n = (rang < 3 ? 1 : 2) + boucle;
    const modes: (1 | 2 | 3)[] = [];
    const longueurs: number[] = [];
    for (let i = 0; i < n; i++) {
      let mode: 1 | 2 | 3;
      if (i === 0 && boucle === 0 && rang < 3) mode = (rang + 1) as 1 | 2 | 3;
      else {
        mode = (1 + rng.int(3)) as 1 | 2 | 3;
        if (mode === (this.dernierMode as number)) mode = ((mode % 3) + 1) as 1 | 2 | 3;
      }
      this.dernierMode = mode;
      modes.push(mode);
      longueurs.push(SECTION_MIN + rng.int(SECTION_MAX - SECTION_MIN + 1));
    }
    // L'introduction est courte : deux morceaux.
    const facile = modes.map((mode) => (this.modesVus & (1 << mode)) === 0);
    const vusAvant = this.modesVus;
    for (const mode of modes) this.modesVus |= 1 << mode;
    for (let i = 0; i < n; i++) {
      // Un mode est facile la première fois du jour qu'on le rencontre ; deux sections du même thème qui le seraient : seule la première l'est.
      if (facile[i]) longueurs[i] = SECTION_MIN;
      if ((vusAvant & (1 << modes[i]!)) === 0 && modes.indexOf(modes[i]!) !== i) facile[i] = false;
    }
    // La place : au plus `parTheme − début − 1` morceaux (le dernier morceau du thème reste normal), chaque section prend `longueur + 1` (son retour), deux morceaux de gravité entre deux sections.
    const debutMin = T === 0 ? 4 : 2;
    const ECART_MIN = 2;
    const dispo = parTheme - debutMin - 1;
    const besoin = (k: number): number => {
      let b = 0;
      for (let i = 0; i < k; i++) b += longueurs[i]! + 1 + (i > 0 ? ECART_MIN : 0);
      return b;
    };
    while (n > 0 && besoin(n) > dispo) {
      // Trop serré : on raccourcit d'abord les sections, puis on en retire.
      const longue = longueurs.findIndex((l, i) => i < n && l > SECTION_MIN && !facile[i]);
      if (longue >= 0) longueurs[longue]!--;
      else n--;
    }
    let reste = dispo - besoin(n);
    let curseur = debutMin;
    for (let i = 0; i < n; i++) {
      const extra = i === n - 1 ? rng.int(reste + 1) : rng.int(Math.trunc(reste / 2) + 1);
      reste -= extra;
      curseur += extra + (i > 0 ? ECART_MIN : 0);
      this.sections.push({ mode: modes[i]!, premier: base + curseur, longueur: longueurs[i]!, facile: facile[i]! });
      curseur += longueurs[i]! + 1;
    }
  }

  /** Les sections placées jusqu'au thème `T` (utile aux essais : `?mode=`). */
  sectionsJusqua(T: number): readonly Placee[] {
    this.placerJusqu(T);
    return this.sections;
  }

  /** Le premier morceau de la première section du `mode` donné (1 avion, 2 onde, 3 ressort), ou −1 si les `themes` premiers thèmes n'en ont pas. */
  premierMorceauDuMode(mode: ModeDeVol, themes = 2 * NB_THEMES): number {
    this.placerJusqu(themes - 1);
    return this.sections.find((s) => s.mode === mode)?.premier ?? -1;
  }

  /** Le morceau `m` : sa section, son portail de vitesse, le facteur de vitesse d'entrée. */
  info(m: number): InfoMorceau {
    while (this.infos.length <= m) this.etendre();
    return this.infos[m]!;
  }

  private etendre(): void {
    const m = this.infos.length;
    const parTheme = this.regles.morceauxParTheme;
    const T = Math.trunc(m / parTheme);
    this.placerJusqu(T + 1); // le thème suivant aussi : une section peut commencer au premier morceau du suivant
    const facteurEntree = m === 0 ? FACTEUR_NORMAL : this.facteurApres(m - 1);
    let section: InfoSection | null = null;
    for (const s of this.sections) {
      if (m >= s.premier && m <= s.premier + s.longueur) {
        section = { mode: s.mode, rang: m - s.premier, longueur: s.longueur, facile: s.facile };
        break;
      }
    }
    const avantSection = this.sections.some((s) => s.premier === m + 1);
    let vitesse: TypePortail | null = null;
    if (section === null && T >= 1 && m >= parTheme) vitesse = this.tirerVitesse(m, T, facteurEntree, avantSection);
    this.infos.push({ section, vitesse, facteurEntree, avantSection });
  }

  /** Le facteur de vitesse après le morceau `m` (sa fin). */
  private facteurApres(m: number): number {
    const i = this.infos[m]!;
    return i.vitesse ? FACTEUR_DU_PORTAIL[i.vitesse]! : i.facteurEntree;
  }

  /**
   * Faut-il un portail de vitesse en tête du morceau `m` de gravité, et lequel ? **Rapide là où l'on respire** (calme, trou, pilier, pics), **lent avant un passage technique** (et avant une onde, le mode le plus nerveux).
   * Environ un morceau sur cinq au deuxième thème, plus à chaque boucle ; jamais deux fois le même facteur de suite (un portail qui ne change rien n'a pas de raison d'être).
   */
  private tirerVitesse(m: number, T: number, facteurEntree: number, avantSection: boolean): TypePortail | null {
    const rng = new Rng(mixSeed(mixSeed(this.jour, SEL_VITESSE), m));
    const boucle = Math.trunc(T / NB_THEMES);
    if (!rng.chance(Math.min(60, 20 + 12 * boucle + 4 * (T % NB_THEMES)))) return null;
    const suivantOnde = avantSection && this.sections.some((s) => s.premier === m + 1 && s.mode === MODE_ONDE);
    const technique = TECHNIQUES.includes(motifBrut(this.jour, m, difficulte(m, this.regles)));
    let type: TypePortail;
    if (technique || suivantOnde) type = "lent";
    else {
      const t = rng.int(100);
      type = t < 40 ? "v1" : t < 80 || T < 2 ? "v2" : "v3";
    }
    return FACTEUR_DU_PORTAIL[type] === facteurEntree ? null : type;
  }

  /** Le facteur de vitesse qui vaut quand le centre du joueur est en `x` unités : celui du dernier portail de vitesse franchi. */
  facteurAu(x: number): number {
    const m = Math.max(0, Math.trunc(x / (LARGEUR_MORCEAU * CASE)));
    const i = this.info(m);
    if (i.vitesse && x > (m * LARGEUR_MORCEAU + COLONNE_PORTAIL) * CASE + (CASE >> 1)) return FACTEUR_DU_PORTAIL[i.vitesse]!;
    return i.facteurEntree;
  }
}

const GARDES = new Map<string, PlanDuJour>();
/** Le plan d'un jour sous des règles données, gardé en mémoire (au plus huit). */
export function planDuJour(jour: number, regles: Regles): PlanDuJour {
  const cle = `${jour}:${cleDesRegles(regles)}`;
  let p = GARDES.get(cle);
  if (!p) {
    if (GARDES.size >= 8) GARDES.delete(GARDES.keys().next().value!);
    p = new PlanDuJour(jour, regles);
    GARDES.set(cle, p);
  }
  return p;
}

