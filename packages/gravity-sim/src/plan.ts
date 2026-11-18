import { mixSeed, Rng } from "@cdj/core";
import { Trajectoire, vitesseCamera } from "./camera";
import { CASE, CIBLE_CAMERA, FACTEUR_NORMAL, LARGEUR_MORCEAU, MODE_ONDE, NB_THEMES, type ModeDeVol } from "./constantes";
import { DANGERS, META, MOTIFS, RANG_D_INTRODUCTION, SOUFFLE, CALME, type Danger, type Meta } from "./catalogue";
import { FACTEUR_DU_PORTAIL, type Motif, type TypePortail } from "./monde";
import type { Regles } from "./regles";
import { cleDesRegles } from "./regles";
import { ordreDesThemes, type ThemeGravity } from "./themes";
import { colonnesParcourues, pasDeTraversee } from "./traversee";

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
/** Une section à danger : au moins 3 morceaux de contenu. */
export const SECTION_DANGER_MIN = 3;

export interface InfoSection {
  mode: 1 | 2 | 3;
  /** Le rang du morceau dans la section : 0 à `longueur − 1` pour le contenu, `longueur` pour le morceau de retour. */
  rang: number;
  longueur: number;
  /** La première section de ce mode dans le jour : facile. */
  facile: boolean;
  /** Lot GR7 : le danger que la section porte (des scies en avion, des lasers en onde…), ou null ; sa variante (0 à 5 : le style et la taille) ; son identifiant de motif (`avion`, `avion+scies`…). */
  danger: Danger | null;
  variante: number;
  id: string;
}
export interface InfoMorceau {
  section: InfoSection | null;
  /** Le portail de vitesse de ce morceau (à la colonne `COLONNE_PORTAIL`), s'il y en a un. */
  vitesse: TypePortail | null;
  /** Le facteur de vitesse (pour cent) en vigueur à la colonne 0 de ce morceau. */
  facteurEntree: number;
  /** Le morceau d'après est le premier d'une section : celui-ci est calme et finit sur le sol. */
  avantSection: boolean;
  /** Lot GR7 : ce que le plan a choisi pour ce morceau de gravité (null dans une section : `section` dit tout). */
  pioche: Pioche | null;
}

/** Sel de la graine des morceaux (propre au jeu) : le même que celui du générateur. */
export const SEL_MORCEAU = 0x6a9d3f;
const SEL_PLAN = 0x3b71c5;
const SEL_VITESSE = 0x52f8a1;
const SEL_PIOCHE = 0x2d94f1;
const SEL_VAGUE = 0x71c3a9;

/** La difficulté d'un morceau, de 0 à 100 : monte sur le tour des cinq thèmes, repart de la base relevée de 35 % à la boucle suivante. Elle règle encore les dimensions des morceaux de section (`sections.ts`). */
export const RAMPE_PAR_BOUCLE = 35;
export function difficulte(m: number, regles: Regles): number {
  const parBoucle = regles.morceauxParTheme * NB_THEMES;
  return Math.min(100, Math.trunc(((m % parBoucle) * 100) / 60) + Math.trunc(m / parBoucle) * RAMPE_PAR_BOUCLE);
}

/**
 * **Ce que le plan a choisi pour un morceau de gravité** (lot GR7) : le motif du catalogue, sa variante, sa difficulté de 1 à 5, s'il est un morceau pour souffler (pièces, aucun danger), et le danger qu'il **introduit** (le premier passage
 * d'un danger : seul, facile, annoncé à l'écran).
 */
export interface Pioche {
  id: string;
  variante: number;
  diff: number;
  souffle: boolean;
  intro: Danger | null;
  technique: boolean;
}
/** Ce que le plan choisit pour un morceau de section en plus du mode : le danger (ou null) et la variante. */
export const idDeSection = (mode: 1 | 2 | 3, danger: Danger | null): string => `${mode === 1 ? "avion" : mode === 2 ? "onde" : "ressort"}${danger ? `+${danger}` : ""}`;

/** Un tirage qu'un test ou le laboratoire des motifs impose (`PlanDuJour.options.forcer`) : jamais utilisé par le jeu. */
export interface OptionsPlan {
  /** Aucune section à mode (le laboratoire ne teste que la gravité). */
  sansSections?: boolean;
  /** Tous les morceaux à partir de celui-ci sont calmes (le laboratoire : le robot regarde deux morceaux devant lui, ils ne doivent pas être des motifs au hasard). */
  calmeDepuis?: number;
  /** Impose le motif et la variante d'un morceau. */
  forcer?: ReadonlyMap<number, { id: string; variante: number }>;
}

interface Placee {
  mode: 1 | 2 | 3;
  premier: number;
  longueur: number;
  facile: boolean;
  danger: Danger | null;
  variante: number;
}

/** Deux introductions de danger sont séparées d'au moins 5 morceaux. */
const ECART_D_INTRODUCTION = 5;
/** Les variantes d'un morceau de section : 6 (le style, couloir ou champ, et la taille). */
export const VARIANTES_DE_SECTION = 6;
/** Combien de morceaux la vague de tension compte avant un morceau pour souffler : 3 ou 4 à la première boucle, 4 ou 5 ensuite (« plus dense »). */
const TENDUS_MIN = 3;

/** Le plan d'un jour sous des règles données. */
export class PlanDuJour {
  private readonly infos: InfoMorceau[] = [];
  private readonly sections: Placee[] = [];
  /** Le rang de thème dont les sections sont placées (exclu), et les modes déjà vus (masque de bits). */
  private themesPlaces = 0;
  private modesVus = 0;
  private dernierMode = 0;
  /** Lot GR7 — l'état de la pioche, sur les morceaux dans l'ordre : les identifiants des derniers morceaux, les couples (motif, variante) déjà posés dans chaque boucle, la vague de tension, les dangers déjà introduits. */
  private readonly histo: string[] = [];
  private readonly utilises = new Map<string, Set<number>>();
  private readonly utilisesSections = new Map<string, Set<number>>();
  private tendus = 0;
  private longueurVague = TENDUS_MIN;
  private readonly introduits = new Set<Danger>();
  /** Le morceau de la dernière introduction d'un danger : deux introductions sont séparées d'au moins `ECART_D_INTRODUCTION` morceaux (chacun arrive seul). */
  private dernierIntro = -100;
  readonly trajectoire: Trajectoire;
  constructor(
    readonly jour: number,
    readonly regles: Regles,
    readonly options: OptionsPlan = {},
    /** L'ordre des cinq thèmes du contenu (celui du jour, ou tourné par l'essai `?theme=`) : le motif spécial d'un thème ne sort que dans ce thème. */
    readonly ordre: readonly ThemeGravity[] = ordreDesThemes(jour),
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
    let n = this.options.sansSections ? 0 : (rang < 3 ? 1 : 2) + boucle;
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
    // Lot GR7 : le danger de chaque section se décide ici, avant la place : une section à danger fait **au moins 3 morceaux** (à grande vitesse deux morceaux ne laissent pas la place d'un seul obstacle après le couloir libre).
    const tirages = modes.map(() => ({ tirage: rng.int(100), choix: rng.int(2) }));
    const vusAvant = this.modesVus;
    for (const mode of modes) this.modesVus |= 1 << mode;
    for (let i = 0; i < n; i++) {
      // Un mode est facile la première fois du jour qu'on le rencontre ; deux sections du même thème qui le seraient : seule la première l'est.
      if (facile[i]) longueurs[i] = SECTION_MIN;
      if ((vusAvant & (1 << modes[i]!)) === 0 && modes.indexOf(modes[i]!) !== i) facile[i] = false;
    }
    const dangers = modes.map((mode, i) => this.dangerDeSection(mode, boucle, rang, facile[i]!, tirages[i]!.tirage, tirages[i]!.choix));
    for (let i = 0; i < n; i++) if (dangers[i] !== null) longueurs[i] = Math.max(longueurs[i]!, SECTION_DANGER_MIN);
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
      const longue = longueurs.findIndex((l, i) => i < n && l > (dangers[i] !== null ? SECTION_DANGER_MIN : SECTION_MIN) && !facile[i]);
      if (longue >= 0) longueurs[longue]!--;
      else n--;
    }
    let reste = dispo - besoin(n);
    let curseur = debutMin;
    for (let i = 0; i < n; i++) {
      const extra = i === n - 1 ? rng.int(reste + 1) : rng.int(Math.trunc(reste / 2) + 1);
      reste -= extra;
      curseur += extra + (i > 0 ? ECART_MIN : 0);
      // Lot GR7 : un danger dans la section, jamais dans les thèmes de l'introduction des dangers (les trois premiers thèmes de la première boucle) ni dans la première section d'un mode ; **la variante** : jamais deux fois la même dans une boucle.
      const danger = dangers[i]!;
      const id = idDeSection(modes[i]!, danger);
      const pris = this.utilisesSections.get(`${boucle}:${id}`) ?? this.utilisesSections.set(`${boucle}:${id}`, new Set()).get(`${boucle}:${id}`)!;
      const libres = Array.from({ length: VARIANTES_DE_SECTION }, (_, v) => v).filter((v) => !pris.has(v));
      const variante = libres.length > 0 ? libres[rng.int(libres.length)]! : rng.int(VARIANTES_DE_SECTION);
      pris.add(variante);
      this.sections.push({ mode: modes[i]!, premier: base + curseur, longueur: longueurs[i]!, facile: facile[i]!, danger, variante });
      curseur += longueurs[i]! + 1;
    }
  }

  /** Le danger d'une section : de la 2e boucle (ou des deux derniers thèmes de la 1re), une section sur deux ou presque en porte un ; la première section d'un mode n'en a jamais. L'avion : scies ou lasers ; l'onde : lasers ou scies ; le ressort : des scies. */
  private dangerDeSection(mode: 1 | 2 | 3, boucle: number, rang: number, facile: boolean, tirage: number, choix: number): Danger | null {
    if (facile || (boucle === 0 && rang < 3)) return null;
    if (tirage >= (boucle === 0 ? 50 : 70)) return null;
    if (mode === 3) return "scies";
    if (mode === 1) return choix === 0 ? "scies" : "lasers";
    return choix === 0 ? "lasers" : "scies";
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

  /** Le premier morceau qui **introduit** le danger donné (`?danger=`), ou −1 s'il n'y en a pas dans les deux premiers tours. */
  premierMorceauDuDanger(danger: Danger, morceaux = 2 * NB_THEMES * this.regles.morceauxParTheme): number {
    for (let m = 0; m < morceaux; m++) if (this.info(m).pioche?.intro === danger) return m;
    return -1;
  }

  /** Le morceau `m` : sa section, son portail de vitesse, le facteur de vitesse d'entrée, ce que le plan a choisi. */
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
        section = { mode: s.mode, rang: m - s.premier, longueur: s.longueur, facile: s.facile, danger: s.danger, variante: s.variante, id: idDeSection(s.mode, s.danger) };
        break;
      }
    }
    const avantSection = this.sections.some((s) => s.premier === m + 1);
    let pioche: Pioche | null = null;
    if (section === null) pioche = this.piocher(m, T, avantSection, facteurEntree);
    else {
      this.histo.push(section.id);
      if (section.rang === section.longueur) this.tendus = 0; // le retour propre est un morceau pour souffler
    }
    let vitesse: TypePortail | null = null;
    if (section === null && T >= 1 && m >= parTheme) vitesse = this.tirerVitesse(m, T, facteurEntree, avantSection, pioche!.technique);
    this.infos.push({ section, vitesse, facteurEntree, avantSection, pioche });
  }

  /** Le facteur de vitesse après le morceau `m` (sa fin). */
  private facteurApres(m: number): number {
    const i = this.infos[m]!;
    return i.vitesse ? FACTEUR_DU_PORTAIL[i.vitesse]! : i.facteurEntree;
  }

  /** Le morceau de gravité `m` va-t-il être abordé vite (un vol de 3 cases fait 5 colonnes ou plus : au-delà de 10 cases/s environ) ? Calculé comme le générateur, sur la vitesse d'entrée. */
  private vite(m: number, facteurEntree: number, seuil = 5): boolean {
    return colonnesParcourues(pasDeTraversee(3 * CASE, this.regles), m * LARGEUR_MORCEAU + 8, this.regles, facteurEntree) >= seuil;
  }

  /**
   * **La pioche** (lot GR7) : le motif, la variante et la difficulté du morceau de gravité `m`. Dans l'ordre : les trois premiers morceaux et celui d'avant une section sont calmes ; **l'introduction d'un danger** (le premier passage, seul, facile) à son
   * rang de thème ; **la vague** (3 ou 4 morceaux tendus à la difficulté qui monte, puis un morceau pour souffler : des pièces, aucun danger) ; sinon un motif dont la difficulté colle à la cible de la vague, **jamais le même motif à moins de 6 morceaux,
   * jamais la même variante deux fois dans une boucle**, un danger seulement après son introduction.
   */
  private piocher(m: number, T: number, avantSection: boolean, facteurEntree: number): Pioche {
    const parTheme = this.regles.morceauxParTheme;
    const boucle = Math.trunc(T / NB_THEMES);
    const rangTheme = T % NB_THEMES;
    const calme = (): Pioche => {
      this.histo.push(CALME.id);
      this.tendus = 0;
      return { id: CALME.id, variante: 0, diff: 1, souffle: true, intro: null, technique: false };
    };
    const forcee = this.options.forcer?.get(m);
    if (forcee) {
      const meta = META.get(forcee.id);
      this.histo.push(forcee.id);
      return { id: forcee.id, variante: forcee.variante, diff: meta?.diff ?? 1, souffle: forcee.id === SOUFFLE.id, intro: null, technique: meta?.technique ?? false };
    }
    if (m < 3 || avantSection || (this.options.calmeDepuis !== undefined && m >= this.options.calmeDepuis)) return calme();
    const rng = new Rng(mixSeed(mixSeed(this.jour, SEL_PIOCHE), m));
    // La vague : un morceau pour souffler quand la tension a duré.
    if (this.tendus >= this.longueurVague) {
      this.tendus = 0;
      this.longueurVague = TENDUS_MIN + (boucle > 0 ? 1 : 0) + new Rng(mixSeed(mixSeed(this.jour, SEL_VAGUE), m)).int(2);
      this.histo.push(SOUFFLE.id);
      return { id: SOUFFLE.id, variante: this.variantePour(boucle, SOUFFLE.id, SOUFFLE.variantes, rng), diff: 1, souffle: true, intro: null, technique: false };
    }
    const vite = this.vite(m, facteurEntree);
    const vite4 = this.vite(m, facteurEntree, 4);
    const vitesseDepart = vitesseCamera(Math.max(0, m * LARGEUR_MORCEAU * CASE - CIBLE_CAMERA), this.regles, facteurEntree);
    const position = this.tendus;
    // La cible : la difficulté de base monte avec la distance dans la boucle et avec la boucle ; la vague la creuse au début (1er morceau tendu) et la relève à la fin.
    const parBoucle = parTheme * NB_THEMES;
    const base = 1 + Math.trunc(((m % parBoucle) * 4) / parBoucle) + Math.min(2, boucle);
    const cible = Math.max(1, Math.min(5, base + (position === 0 ? -1 : position >= 2 ? 1 : 0)));
    // L'introduction d'un danger de ce rang : seul, facile, à un endroit fixe du thème.
    const dansTheme = m - T * parTheme;
    if (boucle === 0) {
      const INTRO: Readonly<Record<Danger, { id: string; place: number }>> = { scies: { id: "scieSol", place: 5 }, fragiles: { id: "fragilePont", place: 5 }, lasers: { id: "laserSimple", place: 12 } };
      for (const d of DANGERS) {
        if (RANG_D_INTRODUCTION[d] !== rangTheme || this.introduits.has(d) || dansTheme < INTRO[d].place || m - this.dernierIntro < ECART_D_INTRODUCTION) continue;
        this.introduits.add(d);
        this.dernierIntro = m;
        const meta = META.get(INTRO[d].id)!;
        this.histo.push(meta.id);
        this.marquer(boucle, meta.id, 0);
        this.tendus++;
        return { id: meta.id, variante: 0, diff: 1, souffle: false, intro: d, technique: true };
      }
    }
    const recents = new Set(this.histo.slice(-5));
    const candidats: { meta: Meta; poids: number }[] = [];
    const themeNom = this.ordre[T % NB_THEMES]!;
    for (const meta of MOTIFS) {
      if (recents.has(meta.id)) continue;
      if (meta.theme !== undefined && meta.theme !== themeNom) continue;
      if (meta.danger !== null && !this.dangerPermis(meta, boucle, rangTheme)) continue;
      if (meta.pasVite && vite) continue;
      if (vite4 && meta.pasApres?.includes(this.histo[this.histo.length - 1] ?? "")) continue;
      if (meta.vmin !== undefined && vitesseDepart < meta.vmin * CASE) continue;
      if (this.variantesLibres(boucle, meta).length === 0) continue;
      const ecart = Math.abs(meta.diff - cible);
      const f = ecart === 0 ? 24 : ecart === 1 ? 12 : ecart === 2 ? 4 : 1;
      // Un motif pas encore vu dans cette boucle est quatre fois plus probable : la boucle montre le plus de motifs distincts possible.
      const neuf = (this.utilises.get(`${boucle}:${meta.id}`)?.size ?? 0) === 0;
      candidats.push({ meta, poids: (meta.poids ?? 100) * f * (neuf ? 4 : 1) });
    }
    if (candidats.length === 0) return calme();
    const total = candidats.reduce((a, c) => a + c.poids, 0);
    let tirage = rng.int(total);
    let choisi = candidats[candidats.length - 1]!.meta;
    for (const c of candidats) {
      tirage -= c.poids;
      if (tirage < 0) {
        choisi = c.meta;
        break;
      }
    }
    const libres = this.variantesLibres(boucle, choisi);
    const variante = libres[rng.int(libres.length)]!;
    this.marquer(boucle, choisi.id, variante);
    this.histo.push(choisi.id);
    this.tendus++;
    return { id: choisi.id, variante, diff: choisi.diff, souffle: false, intro: null, technique: choisi.technique };
  }

  /** Un danger est-il permis à ce rang de thème ? Seulement après son introduction (ou à la 2e boucle) ; un motif qui en combine plusieurs, à partir du 4e thème. */
  private dangerPermis(meta: Meta, boucle: number, rangTheme: number): boolean {
    if (meta.danger === null) return true;
    if (boucle === 0) {
      if (!this.introduits.has(meta.danger)) return false;
      if (meta.combine && (rangTheme < 3 || this.introduits.size < DANGERS.length)) return false;
    }
    return true;
  }
  private variantesLibres(boucle: number, meta: Meta): number[] {
    const pris = this.utilises.get(`${boucle}:${meta.id}`);
    return Array.from({ length: meta.variantes }, (_, v) => v).filter((v) => !pris?.has(v));
  }
  private marquer(boucle: number, id: string, variante: number): void {
    const cle = `${boucle}:${id}`;
    (this.utilises.get(cle) ?? this.utilises.set(cle, new Set()).get(cle)!).add(variante);
  }
  private variantePour(boucle: number, id: string, n: number, rng: Rng): number {
    const pris = this.utilises.get(`${boucle}:${id}`);
    const libres = Array.from({ length: n }, (_, v) => v).filter((v) => !pris?.has(v));
    const v = libres.length > 0 ? libres[rng.int(libres.length)]! : rng.int(n);
    this.marquer(boucle, id, v);
    return v;
  }

  /**
   * Faut-il un portail de vitesse en tête du morceau `m` de gravité, et lequel ? **Rapide là où l'on respire** (calme, trou, pilier, pics), **lent avant un passage technique** (et avant une onde, le mode le plus nerveux).
   * Environ un morceau sur cinq au deuxième thème, plus à chaque boucle ; jamais deux fois le même facteur de suite (un portail qui ne change rien n'a pas de raison d'être).
   */
  private tirerVitesse(m: number, T: number, facteurEntree: number, avantSection: boolean, technique: boolean): TypePortail | null {
    const rng = new Rng(mixSeed(mixSeed(this.jour, SEL_VITESSE), m));
    const boucle = Math.trunc(T / NB_THEMES);
    if (!rng.chance(Math.min(60, 20 + 12 * boucle + 4 * (T % NB_THEMES)))) return null;
    const suivantOnde = avantSection && this.sections.some((s) => s.premier === m + 1 && s.mode === MODE_ONDE);
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
export function planDuJour(jour: number, regles: Regles, ordre: readonly ThemeGravity[] = ordreDesThemes(jour)): PlanDuJour {
  const cle = `${jour}:${cleDesRegles(regles)}:${ordre.join(",")}`;
  let p = GARDES.get(cle);
  if (!p) {
    if (GARDES.size >= 8) GARDES.delete(GARDES.keys().next().value!);
    p = new PlanDuJour(jour, regles, {}, ordre);
    GARDES.set(cle, p);
  }
  return p;
}
