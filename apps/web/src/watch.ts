import { TICK_RATE, replayTicks, type Replay } from "@cdj/sim";
import { fNombre, fTemps, t } from "./i18n";

// Revoir le meilleur tour (lot 27b) : logique pure du mode spectateur (aucun DOM, aucun rendu), testée par Vitest. La lecture rejoue la
// rediffusion avec le **même code** que le serveur et que le fantôme (`RunSession` + `ReplayPlayer`) : `packages/sim` n'a pas bougé et
// rien n'est envoyé au serveur. `main.ts` branche ces règles sur la boucle de jeu, `watchUi.ts` dessine la barre de lecture.

/** Vitesses de lecture : ralentis (×0,25 et ×0,5), normale, accélérée (×2). */
export const WATCH_SPEEDS = [0.25, 0.5, 1, 2] as const;
export type WatchSpeed = (typeof WATCH_SPEEDS)[number];

/** « Retour de 5 s ». */
export const REWIND_SECONDS = 5;
export const REWIND_TICKS = REWIND_SECONDS * TICK_RATE;

/**
 * Ce qu'on regarde : la rediffusion d'un tour, de qui, en combien de temps. `mode` dit d'où elle vient (`first` : le premier du classement
 * du jour, `mine` : ton record local, `salon` : le premier de la session) et sert à « Courir contre ce fantôme ».
 */
export interface WatchEntry {
  name: string;
  ms: number;
  splits: number[];
  replay: string;
  simVersion: number;
  mode: "first" | "mine" | "salon";
  /** Étiquette du fantôme quand on court contre lui (« premier : Alice »). */
  label: string;
  /** Couleur de la voiture (celle du fantôme). */
  color: number;
}

/** « Rediffusion de Alice — 31,456 s » / “Replay of Alice — 31.456 s”. */
export function watchTitle(name: string, ms: number): string {
  return t("revoir.titre", { nom: name, temps: fTemps(ms) });
}

/** Libellé court d'une vitesse : « ×0,25 », « ×2 » (« ×0.25 » en anglais). */
export function speedLabel(speed: number): string {
  return `×${fNombre(speed, Number.isInteger(speed) ? 0 : speed === 0.25 ? 2 : 1)}`;
}

/** Libellé du bouton (court : huit commandes tiennent sur la largeur d'un téléphone) : « ¼ », « ½ », « 1× », « 2× ». */
export function speedShort(speed: number): string {
  return speed === 0.25 ? "¼" : speed === 0.5 ? "½" : `${fNombre(speed)}×`;
}

/** Pas de la rediffusion à rejouer pour arriver à `current + delta`, borné entre le départ et l'arrivée. */
export function seekTick(current: number, total: number, delta: number): number {
  return Math.max(0, Math.min(total, Math.round(current + delta)));
}

/** Avancement ∈ [0, 1] (un tour de zéro pas est fini). */
export function progressOf(tick: number, total: number): number {
  return total <= 0 ? 1 : Math.max(0, Math.min(1, tick / total));
}

/** Pas correspondant à une position de la barre de progression ∈ [0, 1]. */
export function tickAt(fraction: number, total: number): number {
  return Math.max(0, Math.min(total, Math.round(fraction * total)));
}

/** Nombre de pas de la rediffusion (0 si elle est illisible). */
export function totalTicks(replay: Replay): number {
  return replayTicks(replay);
}

/** Adresse de la rediffusion du meilleur tour pour la page actuelle : mêmes réglages (jour, API, Salon…), plus `watch=best`. */
export function watchHref(search: string): string {
  const params = new URLSearchParams(search);
  params.set("watch", "best");
  return `?${params.toString()}`;
}

/** Idem à partir d'une adresse relative déjà construite (`?seed=2026-09-30`, ou `./` s'il n'y a aucun réglage). */
export function watchHrefFor(href: string): string {
  return watchHref(href.startsWith("?") ? href.slice(1) : "");
}

/** La même page sans la rediffusion (course normale). */
export function unwatchHref(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("watch");
  const q = params.toString();
  return q ? `?${q}` : "./";
}

/** Vrai si l'adresse demande à revoir le meilleur tour. */
export function wantsWatch(params: URLSearchParams): boolean {
  return params.get("watch") === "best";
}

/**
 * Caméras du spectateur : les trois de la touche C (proche, loin, capot) puis la **caméra libre** autour de la voiture, puis on reboucle.
 * `index` : caméra de poursuite (indice dans `CAMERAS`), `free` : caméra libre active.
 */
export function nextWatchCamera(index: number, free: boolean, count: number): { index: number; free: boolean } {
  if (free) return { index: 0, free: false };
  if (index + 1 >= count) return { index, free: true };
  return { index: index + 1, free: false };
}

/** Caméra libre : position relative à la voiture pour un lacet (autour de la verticale, lacet 0 = du côté +z), une hauteur (angle au-dessus du sol) et une distance. */
export function orbitOffset(yaw: number, pitch: number, dist: number): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch) * dist;
  return { x: Math.sin(yaw) * flat, y: Math.sin(pitch) * dist, z: Math.cos(yaw) * flat };
}

export const ORBIT_MIN_DIST = 4;
export const ORBIT_MAX_DIST = 45;
export const ORBIT_MIN_PITCH = -0.05;
export const ORBIT_MAX_PITCH = 1.45;

/** Borne la distance et la hauteur de la caméra libre (jamais sous le sol d'un côté, jamais à la verticale de l'autre). */
export function clampOrbit(pitch: number, dist: number): { pitch: number; dist: number } {
  return { pitch: Math.max(ORBIT_MIN_PITCH, Math.min(ORBIT_MAX_PITCH, pitch)), dist: Math.max(ORBIT_MIN_DIST, Math.min(ORBIT_MAX_DIST, dist)) };
}
