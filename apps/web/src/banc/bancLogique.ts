// Lot 50 — **le banc d'essai du rendu** (`?banc`, recette et aperçus seulement) : la partie pure (testée : `test/banc.test.ts`). Les configurations mesurées,
// les statistiques d'une mesure (temps d'image : médiane, 95ᵉ et 99ᵉ centiles, pire image ; carte graphique par passe ; fil principal) et le rapport (JSON).
// Le module qui fait rouler la voiture et dessine est `banc.ts`, chargé à la demande comme lui.
import type { PaletteName } from "@cdj/sim";
import { FORME_JEU, type FormeChaine } from "../scene/post";

/** Version du format du rapport (à incrémenter si ses champs changent : les rapports se comparent d'un lot à l'autre). */
export const VERSION_RAPPORT = 4;
/** Le bout de circuit mesuré : départ du circuit de ce jour (un jour passé ne change jamais), dans la course du pilote automatique, à partir de 2 s. */
export const BANC_JOUR = "2026-10-20";
export const BANC_DEBUT_S = 2;
/** Durées (ms) : la mise en route d'une configuration (programmes compilés, textures envoyées : écartée), puis la mesure. */
export const DUREES = { normal: { chauffe: 700, mesure: 2500 }, court: { chauffe: 150, mesure: 400 } } as const;
export type ModeBanc = keyof typeof DUREES;

export const THEMES_BANC = ["stade", "nuit", "ville"] as const satisfies readonly PaletteName[];
export type ThemeBanc = (typeof THEMES_BANC)[number];

/** La chaîne du lot 50, dans une forme. */
export interface Chaine50 {
  version: 50;
  forme: FormeChaine;
  halo: boolean;
  etalonnage: boolean;
  anticrenelage: boolean;
}

export interface ConfigBanc {
  id: string;
  libelle: string;
  /** Le moteur de rendu : avec multi-échantillonnage de l'écran (`antialias`, comme le jeu jusqu'ici) ou sans. */
  ecran: "msaa" | "sans";
  palier: "P1" | "P2" | "P3";
  plus: readonly string[];
  chaine: Chaine50 | null;
  /** Densité de l'écran : celle du jeu (`native` : celle de l'appareil, plafonnée à 2), 1, ou plafonnée à 1,5. */
  densite: "native" | 1 | 1.5;
  themes: readonly ThemeBanc[];
}

const F50: FormeChaine = { ...FORME_JEU };
const C50: Chaine50 = { version: 50, forme: F50, halo: true, etalonnage: true, anticrenelage: true };
const TOUS = THEMES_BANC;
const SN: readonly ThemeBanc[] = ["stade", "nuit"];
const S: readonly ThemeBanc[] = ["stade"];
const N: readonly ThemeBanc[] = ["nuit"];
const P2_PLUS = ["vie", "ciel"];

/**
 * Toutes les configurations, dans l'ordre de passage (par moteur, puis par thème : une scène par thème et par palier). `dpr` : la densité de l'appareil. Version 3 (après
 * le rapport 2 de Nathan) : la chaîne du jeu (`FORME_JEU`), ses parties et ses variantes ; la chaîne du lot 47 n'existe plus (ses mesures sont dans le README du lot 50).
 * Version 4 (lot 51) : **la scène est toujours à la résolution native** — plus de variantes de plafond de pixels — et le rapport dit la taille du canevas et de chaque cible.
 */
export function configurations(dpr: number, mode: ModeBanc = "normal"): ConfigBanc[] {
  const c = (id: string, libelle: string, o: Partial<ConfigBanc> & Pick<ConfigBanc, "ecran" | "themes">): ConfigBanc => ({ id, libelle, palier: "P3", plus: [], chaine: null, densite: "native", ...o });
  const natif = Math.min(dpr, 2);
  const forme = (f: Partial<FormeChaine>): Chaine50 => ({ ...C50, forme: { ...F50, ...f } });
  const liste: ConfigBanc[] = [
    // Moteur avec multi-échantillonnage de l'écran (le jeu sans la chaîne).
    c("p1", "Palier 1", { ecran: "msaa", palier: "P1", themes: SN }),
    c("p2", "Palier 2 + vie et ciel", { ecran: "msaa", palier: "P2", plus: P2_PLUS, themes: SN }),
    c("p3", "Palier 3", { ecran: "msaa", themes: TOUS }),
    ...(natif !== 1 ? [c("p3-d1", "Palier 3, densité 1", { ecran: "msaa", densite: 1, themes: S })] : []),
    // Moteur sans multi-échantillonnage de l'écran (la chaîne : jamais deux multi-échantillonnages).
    c("p3-sans-msaa", "Palier 3, écran sans multi-échantillonnage (référence)", { ecran: "sans", themes: S }),
    c("p3-50", "Palier 3 + post-traitement (la chaîne du jeu)", { ecran: "sans", chaine: C50, themes: TOUS }),
    c("50-sans-halo", "Chaîne : sans halo", { ecran: "sans", chaine: { ...C50, halo: false }, themes: N }),
    c("50-sans-etalonnage", "Chaîne : sans étalonnage", { ecran: "sans", chaine: { ...C50, etalonnage: false }, themes: S }),
    c("50-sans-fxaa", "Chaîne : sans FXAA", { ecran: "sans", chaine: { ...C50, anticrenelage: false }, themes: S }),
    c("50-copie", "Mode copie (tonalité et FXAA)", { ecran: "sans", chaine: { ...C50, halo: false, etalonnage: false }, themes: S }),
    c("50-halo-quart", "Chaîne : halo au quart de la résolution", { ecran: "sans", chaine: forme({ haloDepart: 2 }), themes: N }),
    c("50-demi", "Chaîne : scène en demi-flottants (8 octets)", { ecran: "sans", chaine: forme({ format: "demi" }), themes: N }),
    c("50-msaa4", "Chaîne : scène multi-échantillonnée ×4", { ecran: "sans", chaine: forme({ echantillons: 4 }), themes: SN }),
    ...(natif !== 1 ? [c("50-d1", "Chaîne, densité 1", { ecran: "sans", chaine: C50, densite: 1, themes: S })] : []),
    ...(natif > 1.5 ? [c("50-d15", "Chaîne, densité 1,5 au plus", { ecran: "sans", chaine: C50, densite: 1.5, themes: S })] : []),
  ];
  // Le banc court (e2e, rendu logiciel) : une configuration de chaque sorte, un thème.
  if (mode === "court") return liste.filter((x) => ["p1", "p3", "p3-50"].includes(x.id)).map((x) => ({ ...x, themes: x.id === "p3-50" ? N : S }));
  return liste;
}

/** Les mesures dans l'ordre de passage : par moteur, puis par thème, puis par palier (une scène par thème et par palier). */
export function plan(configs: readonly ConfigBanc[]): { config: ConfigBanc; theme: ThemeBanc }[] {
  const out: { config: ConfigBanc; theme: ThemeBanc }[] = [];
  for (const ecran of ["msaa", "sans"] as const)
    for (const theme of THEMES_BANC)
      for (const palier of ["P1", "P2", "P3"] as const) for (const config of configs) if (config.ecran === ecran && config.palier === palier && config.themes.includes(theme)) out.push({ config, theme });
  return out;
}

/** Centile `p` (0–100) d'une liste, par le rang le plus proche. */
export function centile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.max(0, Math.ceil((p / 100) * t.length) - 1))]!;
}

const arrondi = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

/** Ce qu'on garde d'une mesure. */
export interface MesureBanc {
  config: string;
  libelle: string;
  theme: ThemeBanc;
  images: number;
  /** Temps d'image (ms, entre deux images affichées). */
  image: { mediane: number; p95: number; p99: number; pire: number };
  /** Images par seconde (moyenne de la mesure). */
  ips: number;
  /** Carte graphique (ms, médianes) : le total de l'image et chaque passe ; `null` sans minuteur. */
  gpu: { total: number; passes: Record<string, number> } | null;
  /** Fil principal (ms) : la préparation et l'envoi de l'image. */
  filPrincipal: { mediane: number; p95: number };
  /** Appels de rendu de l'image (médiane), programmes au total, compilés pendant la mesure, tâches longues pendant la mesure. */
  appels: number;
  programmes: number;
  compilations: number;
  tachesLongues: number;
  /** Taille du tampon de dessin (pixels) et densité. */
  tampon: [number, number];
  densite: number;
  /** Lot 51 : la taille de chaque cible de la chaîne (la scène : largeur, hauteur, échantillons ; puis celles du halo) ; `null` : dessin direct, sans cible. */
  cibles: { scene: [number, number, number]; halo: [number, number][] } | null;
  /** La chaîne a refusé ses cibles (dessin direct) ; ou une erreur. */
  echec?: string;
}

/** Les intervalles et les temps d'une mesure → `MesureBanc` (sans les champs propres à la configuration). */
export function resumer(
  m: { intervalles: readonly number[]; fil: readonly number[]; appels: readonly number[]; gpu: readonly Record<string, number>[] | null },
): Pick<MesureBanc, "images" | "image" | "ips" | "gpu" | "filPrincipal" | "appels"> {
  const iv = m.intervalles;
  const somme = iv.reduce((s, x) => s + x, 0);
  let gpu: MesureBanc["gpu"] = null;
  if (m.gpu && m.gpu.length > 0) {
    const noms = [...new Set(m.gpu.flatMap((g) => Object.keys(g)))];
    const passes: Record<string, number> = {};
    for (const n of noms) passes[n] = arrondi(centile(m.gpu.map((g) => g[n] ?? 0), 50), 3);
    gpu = { total: arrondi(centile(m.gpu.map((g) => Object.values(g).reduce((s, x) => s + x, 0)), 50), 3), passes };
  }
  return {
    images: iv.length,
    image: { mediane: arrondi(centile(iv, 50)), p95: arrondi(centile(iv, 95)), p99: arrondi(centile(iv, 99)), pire: arrondi(iv.length ? Math.max(...iv) : 0) },
    ips: iv.length && somme > 0 ? arrondi((iv.length * 1000) / somme, 1) : 0,
    gpu,
    filPrincipal: { mediane: arrondi(centile(m.fil, 50), 3), p95: arrondi(centile(m.fil, 95), 3) },
    appels: centile(m.appels, 50),
  };
}

/** L'en-tête du rapport : la machine. */
export interface EnteteBanc {
  carteGraphique: string;
  navigateur: string;
  /** Taille du canevas (CSS) et densité de l'appareil. */
  canevas: [number, number];
  densite: number;
  /** Lot 51 : le tampon de dessin du jeu (pixels) : le canevas × la densité du jeu (celle de l'appareil, plafonnée à 2). */
  tampon: [number, number];
  pleinEcran: boolean;
  /** Fréquence de l'écran estimée (Hz). */
  frequence: number;
  /** Le palier qu'Auto donne à cet appareil (`cdj:qualite`, ou son point de départ), et si la chaîne y est permise. */
  palierAuto: number;
  passesPermises: boolean;
  /** Le minuteur de la carte graphique (`EXT_disjoint_timer_query_webgl2`) : présent ou non. */
  minuteurGpu: boolean;
}

export interface RapportBanc {
  version: number;
  date: string;
  mode: ModeBanc;
  circuit: { jour: string; id: string; debut: number };
  durees: { chauffe: number; mesure: number };
  entete: EnteteBanc;
  mesures: MesureBanc[];
  /** Durée totale du banc (s). */
  dureeS: number;
}

/** Lot 51 : le tampon de dessin d'un canevas de `w` × `h` (CSS) à la densité `d` — ce que fait `WebGLRenderer.setSize` (partie entière). */
export const tamponAttendu = (w: number, h: number, d: number): [number, number] => [Math.floor(w * d), Math.floor(h * d)];

/**
 * Lot 51 : la résolution d'une mesure est la bonne — son tampon vaut le canevas × la densité de la mesure, et, quand la chaîne dessine, la cible de la scène a **cette taille**
 * (jamais moins : la netteté ne se paie pas en pixels), son halo est plus petit ou égal.
 */
export function resolutionConforme(m: MesureBanc, canevas: readonly [number, number]): boolean {
  const [w, h] = tamponAttendu(canevas[0], canevas[1], m.densite);
  if (m.tampon[0] !== w || m.tampon[1] !== h) return false;
  if (!m.cibles) return true;
  return m.cibles.scene[0] === w && m.cibles.scene[1] === h && m.cibles.halo.every(([x, y]) => x <= w && y <= h);
}

/** Un rapport bien formé : chaque mesure a ses images et des temps positifs et ordonnés (médiane ≤ 95ᵉ ≤ 99ᵉ ≤ pire). */
export function rapportValide(r: unknown): r is RapportBanc {
  const x = r as RapportBanc;
  if (!x || x.version !== VERSION_RAPPORT || !x.entete || !Array.isArray(x.mesures) || x.mesures.length === 0) return false;
  if (typeof x.entete.carteGraphique !== "string" || !(x.entete.frequence > 0) || !(x.entete.densite > 0)) return false;
  if (!Array.isArray(x.entete.tampon)) return false;
  return x.mesures.every((m) => {
    if (m.echec) return typeof m.echec === "string";
    if (!resolutionConforme(m, x.entete.canevas)) return false;
    const i = m.image;
    return m.images > 0 && i.mediane > 0 && i.mediane <= i.p95 && i.p95 <= i.p99 && i.p99 <= i.pire && m.ips > 0 && m.compilations >= 0 && m.tachesLongues >= 0 && THEMES_BANC.includes(m.theme);
  });
}
