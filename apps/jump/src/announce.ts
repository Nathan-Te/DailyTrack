import { TICK_RATE, type BlinkCycle, type Gust } from "@cdj/jump-sim";

// L'annonce des éléments à horloge (lot 18) — **affichage seul**, logique pure et testée. Principe : un élément à horloge **annonce chacun de ses
// changements d'état**, assez tôt, par un signe **continu et simple** (une jauge qui descend ou qui monte, une vitesse qui décroît) ; jamais de
// clignotement rapide (rien au-dessus de `FLICKER_MAX_HZ`, par lisibilité et pour les personnes photosensibles) ; et **l'affichage ne ment jamais** :
// l'annonce se calcule à partir de la fonction de l'horloge (l'avenir est exact et déterministe), mais ne montre jamais un état que la simulation
// n'a pas (un bloc plein reste cerné d'un trait plein jusqu'au pas où il disparaît ; un bloc absent n'a qu'un contour pointillé et un remplissage
// translucide jusqu'au pas où il revient ; les feuilles sont à l'arrêt exactement quand la rafale cesse).
//
//   - **Nuit, blocs clignotants** : pendant les `vanish` dernières secondes d'une phase présente, la face se vide comme une jauge qui descend
//     (vide pile au pas de la disparition) ; absent, le bloc reste en contour pointillé et, pendant les `appear` secondes avant sa réapparition, ce
//     contour se remplit (plein pile au pas de la réapparition). Une phase plus courte que l'annonce : l'annonce couvre au plus sa moitié.
//   - **Forêt, rafales** : les feuilles frémissent `gustLead` secondes avant le début, vont à pleine vitesse pendant la rafale, ralentissent pendant
//     les `gustTail` dernières secondes et sont à l'arrêt quand elle cesse. La force du vent dans la simulation ne change pas.

/** Au-dessus de cette fréquence (Hz), un signe qui change d'aspect est un clignotement : interdit (lisibilité, photosensibilité). */
export const FLICKER_MAX_HZ = 3;

/** Durées d'annonce, en secondes (réglables dans `?debug&tune`, section « Annonce des éléments à horloge »). */
export const ANNOUNCE_DEFAULTS = {
  /** Nuit : la face d'un bloc présent se vide pendant ses dernières secondes. */
  vanish: 0.6,
  /** Nuit : le contour d'un bloc absent se remplit pendant les secondes qui précèdent son retour. */
  appear: 0.4,
  /** Forêt : les feuilles frémissent avant le début d'une rafale. */
  gustLead: 0.4,
  /** Forêt : les feuilles ralentissent pendant la fin d'une rafale. */
  gustTail: 0.4,
};
export type AnnounceKey = keyof typeof ANNOUNCE_DEFAULTS;
export const ANNOUNCE: Record<AnnounceKey, number> = { ...ANNOUNCE_DEFAULTS };

/** Pas d'une durée d'annonce (secondes → pas de simulation, au moins 0). */
export const announceTicks = (key: AnnounceKey): number => Math.max(0, Math.round(ANNOUNCE[key] * TICK_RATE));

/** La fenêtre d'annonce d'une phase de `length` pas : la durée voulue, au plus la moitié de la phase. */
export function announceWindow(wanted: number, length: number): number {
  return Math.max(0, Math.min(wanted, Math.floor(length / 2)));
}

// ——— Nuit : la jauge des blocs clignotants ———

/** Où en est un groupe de blocs clignotants : plein ou absent, pas avant le changement (au moins 1), durée de la phase en cours (pas). */
export interface BlinkPhase {
  solid: boolean;
  left: number;
  length: number;
}

/**
 * La phase du groupe `group` du cycle `c` à l'horloge `phase` (négative avant le départ : `q` se lit modulo le cycle). Le même calcul que
 * `blinkIsSolid` de la simulation (`b` : plein pour `q < solide` ; `d` : pour `q ≥ solide`, avec `q = (phase + décalage) mod cycle`).
 */
export function blinkPhase(c: BlinkCycle, group: number, phase: number): BlinkPhase {
  const q = (((phase + c.shift) % c.cycle) + c.cycle) % c.cycle;
  const inFirst = q < c.solid;
  const solid = group === 0 ? inFirst : !inFirst;
  return { solid, left: inFirst ? c.solid - q : c.cycle - q, length: solid ? (group === 0 ? c.solid : c.cycle - c.solid) : group === 0 ? c.cycle - c.solid : c.solid };
}

/**
 * Le niveau de la jauge d'un groupe, de 0 (vide) à 1 (pleine), selon `vanishTicks` / `appearTicks` pas d'annonce.
 *   - **présent** : 1 hors annonce ; pendant les `w` derniers pas, `left / (w + 1)` (de w/(w+1) à 1/(w+1)) : décroît d'un pas à l'autre, et vaut 0
 *     au pas où il disparaît ;
 *   - **absent** : 0 hors annonce ; pendant les `w` derniers pas, `1 − left / (w + 1)` (de 1/(w+1) à w/(w+1)) ; vaut 1 au pas où il revient.
 * L'annonce compte donc exactement `w` pas (0,6 s = 72 pas à la disparition), tous strictement entre 0 et 1.
 * Continue, monotone dans chaque phase, sans aucun va-et-vient : pas de clignotement possible.
 */
export function blinkGauge(p: BlinkPhase, vanishTicks: number, appearTicks: number): number {
  if (p.solid) {
    const w = announceWindow(vanishTicks, p.length);
    return w > 0 && p.left <= w ? p.left / (w + 1) : 1;
  }
  const w = announceWindow(appearTicks, p.length);
  return w > 0 && p.left <= w ? 1 - p.left / (w + 1) : 0;
}

// ——— Forêt : le vent des rafales ———

/** Où en est une rafale : souffle-t-elle, pas avant le changement (au moins 1), durée de la phase en cours (pas). */
export interface GustPhase {
  blowing: boolean;
  left: number;
  length: number;
}

/** La phase d'une rafale à l'horloge `phase` (même calcul que `windBlows` de la simulation). */
export function gustPhase(g: Gust, phase: number): GustPhase {
  const q = (((phase + g.shift) % g.cycle) + g.cycle) % g.cycle;
  const blowing = q < g.active;
  return { blowing, left: blowing ? g.active - q : g.cycle - q, length: blowing ? g.active : g.cycle - g.active };
}

/** Ce que le dessin lit du vent d'une zone en rafale : `lead` (0 à 1) le frémissement qui précède le début, `flow` (0 à 1) la vitesse des feuilles. */
export interface GustFeel {
  /** Part du frémissement : 0 hors annonce, `1 − left / (w + 1)` pendant les `w` pas avant le début (w/(w+1) au dernier pas calme). */
  lead: number;
  /** Vitesse des feuilles : 0 à l'arrêt, 1 à pleine vitesse, `left / (w + 1)` pendant les `w` derniers pas de la rafale (0 au pas où elle cesse). */
  flow: number;
}

/**
 * Le frémissement et la vitesse des feuilles d'une rafale (`leadTicks` / `tailTicks` : durées d'annonce en pas, chacune au plus la moitié de
 * sa phase). Les feuilles sont à l'arrêt (`flow` = 0) tant que la rafale ne souffle pas et **exactement** au pas où elle cesse.
 */
export function gustFeel(p: GustPhase, leadTicks: number, tailTicks: number): GustFeel {
  if (p.blowing) {
    const w = announceWindow(tailTicks, p.length);
    return { lead: 0, flow: w > 0 && p.left <= w ? p.left / (w + 1) : 1 };
  }
  const w = announceWindow(leadTicks, p.length);
  return { lead: w > 0 && p.left <= w ? 1 - p.left / (w + 1) : 0, flow: 0 };
}

/**
 * L'intensité du vent d'une zone en rafale, de 0 à 1, pour ce qui se montre sans bouger (opacité des feuilles et des flèches du mouvement réduit) :
 * monte pendant l'annonce du début, 1 pendant la rafale, descend pendant l'annonce de la fin. Continue (aucun saut), jamais clignotante.
 */
export function gustIntensity(f: GustFeel, blowing: boolean): number {
  return blowing ? f.flow : f.lead;
}
