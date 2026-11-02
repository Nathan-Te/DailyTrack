import { hasardAffichage } from "./hasardAffichage";
import { NIVEAU_MER } from "./profondeurs";

// Lot T9 — la LOGIQUE PURE des décors (sans Three.js, testée) : le vocabulaire de formes en aplat, les quatre plans et leur parallaxe verticale, et le registre d'altitude (ce qui remplit le ciel
// quand la tour monte). **Tout est de l'affichage** : rien ici ne lit la simulation. Aucune forme ne vient du hasard de la partie : les éléments du ciel sont semés par le hasard d'AFFICHAGE
// (`hasardAffichage.ts`, une graine par thème) ou par une table fixe. Les coordonnées des formes sont celles de la planche `tower-planche-decors.html` (pixels d'une vue de 400 × 300, 20 px par mètre,
// y vers le bas) : la planche se transcrit telle quelle, `enMetres` les pose dans le monde.

/** La planche : 20 px par mètre, 400 px de large (une « tuile » de 20 m). */
export const PX = 20;
export const TUILE_M = 20;
/** La ligne de l'eau, dans la planche (y = 250 px) : elle devient `NIVEAU_MER` dans le monde. */
export const LIGNE_PX = 250;

/** Les quatre plans : lointain, moyen, proche, et le sol (qui reste au premier plan, avec la plateforme). La part du mouvement de la caméra que chacun suit à l'écran : 0,2 · 0,5 · 0,8 · 1. */
export const PARALLAXE = [0.2, 0.5, 0.8, 1] as const;
export type NumeroPlan = 0 | 1 | 2 | 3;

/**
 * La parallaxe verticale : un plan qui suit `k` de la caméra défile à l'écran de `k × Δ` quand elle monte de `Δ` ; dans le monde il est donc décalé de `(1 − k) × Δ` (k = 1 : fixé au monde, comme
 * les pièces ; k = 0 : fixé à l'écran). `yRef` est le bas de la vue au départ de la partie (le décor y est tel que la planche le montre).
 */
export const decalageParallaxe = (k: number, yBas: number, yRef: number): number => (1 - k) * (yBas - yRef);

/** L'ordonnée (monde, plan non décalé) d'un élément du plan `k` qui est à `h` mètres au-dessus du bas de l'écran quand le bas de la vue est à l'altitude `a`. */
export const yPlan = (k: number, a: number, yRef: number, h = 0): number => k * a + (1 - k) * yRef + h;

/** Une ordonnée du monde en pixels de la planche, et l'inverse. */
export const yEnPx = (m: number): number => LIGNE_PX - (m - NIVEAU_MER) * PX;
export const yEnMetres = (px: number): number => (LIGNE_PX - px) / PX + NIVEAU_MER;
export const xEnMetres = (px: number): number => (px - TUILE_M * PX / 2) / PX;

/** Une forme en aplat. `ink` : un trait d'encre autour (la planche : 2 px). Polygones convexes seulement (les formes creuses s'écrivent en plusieurs formes). */
export type Forme =
  | { t: "r"; c: string; x: number; y: number; w: number; h: number; ink?: boolean }
  | { t: "p"; c: string; pts: readonly number[]; ink?: boolean }
  | { t: "c"; c: string; x: number; y: number; r: number; ink?: boolean }
  | { t: "l"; c: string; x1: number; y1: number; x2: number; y2: number; w: number };
/** Un rectangle (coin haut gauche, largeur, hauteur), un polygone, un disque, un trait épais. */
export const R = (c: string, x: number, y: number, w: number, h: number, ink = false): Forme => ({ t: "r", c, x, y, w, h, ink });
export const P = (c: string, pts: readonly number[], ink = false): Forme => ({ t: "p", c, pts, ink });
export const C = (c: string, x: number, y: number, r: number, ink = false): Forme => ({ t: "c", c, x, y, r, ink });
export const L = (c: string, x1: number, y1: number, x2: number, y2: number, w = 2): Forme => ({ t: "l", c, x1, y1, x2, y2, w });

/** Un relief en aplat (collines, falaises) : le haut suit les points `[x, y, x, y…]` (x croissants), le bas est la ligne `base` — un trapèze convexe par segment. */
export function Profil(c: string, base: number, pts: readonly number[], ink = false): Forme[] {
  const sortie: Forme[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) sortie.push(P(c, [pts[i]!, base, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, pts[i + 2]!, base], ink));
  return sortie;
}

/** Un ruban plat (aurore, vagues) : la ligne brisée `pts` épaissie vers le bas de `ep` px — un parallélogramme par segment. */
export function Ruban(c: string, ep: number, pts: readonly number[]): Forme[] {
  const sortie: Forme[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) sortie.push(P(c, [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, pts[i + 2]!, pts[i + 3]! + ep, pts[i]!, pts[i + 1]! + ep]));
  return sortie;
}

/** Une ellipse (un manchot, une goutte) : un polygone à douze côtés. */
export const Ell = (c: string, cx: number, cy: number, rx: number, ry: number, ink = false): Forme =>
  P(c, Array.from({ length: 12 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 6), cy + ry * Math.sin((i * Math.PI) / 6)]).flat(), ink);

/** Les mêmes formes, décalées de `dx`, `dy` pixels (un élément du ciel se dessine autour de l'origine puis se pose). */
export function deplacer(formes: readonly Forme[], dx: number, dy: number): Forme[] {
  return formes.map((f): Forme => {
    switch (f.t) {
      case "r":
      case "c":
        return { ...f, x: f.x + dx, y: f.y + dy };
      case "l":
        return { ...f, x1: f.x1 + dx, y1: f.y1 + dy, x2: f.x2 + dx, y2: f.y2 + dy };
      case "p":
        return { ...f, pts: f.pts.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    }
  });
}

/** Une animation lente (affichage seulement ; coupée avec `prefers-reduced-motion`) : des formes qui bougent d'un tout petit peu.
 *  `bob` : monte et descend de `a` px ; `derive` : va et vient de `a` px ; `tombe` : tombe en boucle sur `a` px (la neige) ; `scintille` : s'allume et s'éteint (fenêtres, étoiles) ; `T` : la période (s). */
export interface Anim {
  mode: "bob" | "derive" | "tombe" | "scintille";
  plan: NumeroPlan;
  formes: readonly Forme[];
  a: number;
  T: number;
  /** Le déphasage (0 à 1). */
  ph?: number;
  /** Les formes suivent l'écran (la neige tombe devant le ciel, pas dans le monde). */
  ecran?: boolean;
}

/** Un plan : `centre` n'est posé qu'une fois (au milieu), `repete` l'est sur chaque tuile (en miroir une fois sur deux) pour couvrir un grand écran. */
export interface PlanDecor {
  centre: readonly Forme[];
  repete: readonly Forme[];
}

/** Une bande de ciel : au-dessus de `de` mètres de tour, le ciel est de cette couleur (des aplats qui se suivent, jamais un dégradé). */
export interface BandeCiel {
  de: number;
  c: string;
}

/** Ce qui peuple le ciel à une altitude. */
export type GenreCiel = "nuage" | "nuageHaut" | "oiseaux" | "avion" | "montgolfiere" | "etoiles" | "aurore" | "vautour" | "perroquet" | "chauve";
export interface ZoneCiel {
  /** Entre ces deux hauteurs de tour (m). */
  de: number;
  a: number;
  genres: readonly GenreCiel[];
}

export interface DecorTheme {
  /** Les quatre plans : lointain, moyen, proche, sol. */
  plans: readonly [PlanDecor, PlanDecor, PlanDecor, PlanDecor];
  anims: readonly Anim[];
  /** Le ciel haut : des bandes de couleur, puis le registre d'altitude. */
  bandes: readonly BandeCiel[];
  zones: readonly ZoneCiel[];
  /** La couleur des nuages, des étoiles et des oiseaux du ciel. */
  ciel: { nuage: string; nuageHaut: string; oiseau: string; etoile: string; avion: string; ballon: readonly string[]; aurore: readonly string[] };
  /** Ce qui s'ajoute à la plateforme (neige, planches), en mètres autour de son dessus, selon sa demi-largeur. */
  plateforme?: (hw: number) => readonly Forme[];
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Le registre d'altitude : « au-dessus de 15 à 20 m le décor change, pour qu'une tour de 50 m n'ait jamais un fond vide ».

/** À partir de cette hauteur de tour (m) le décor change : après les plans de la planche et quelques nuages hauts, des nuages et des oiseaux, puis le ciel haut. */
export const ALTITUDE_REGISTRE = 15;
/** Jusqu'où le ciel est semé (m) : bien au-delà de ce qu'une partie atteint (le Diamant est plafonné à 60 m). */
export const ALTITUDE_MAX = 160;
/** Le pas de semis (m de tour) : un « rang » d'éléments par pas. */
export const PAS_SEMIS = 6;
/** Combien d'éléments de chaque genre par rang, selon son plan : un plan lent montre une grande étendue d'altitudes à la fois (il en faut peu par rang), un plan rapide une petite (il en faut plus). */
const PAR_RANG: Readonly<Record<0 | 1 | 2, number>> = { 0: 1, 1: 2, 2: 2 };
/** La demi-largeur du ciel semé (m) : plus que n'importe quel écran. */
export const DEMI_LARGEUR_CIEL = 40;

/** Un élément du ciel : son genre, son plan (la parallaxe qui le fait défiler), sa position (x en m, `a` = la hauteur de tour à laquelle il est au milieu de l'écran), sa taille. */
export interface ItemCiel {
  genre: GenreCiel;
  plan: 0 | 1 | 2;
  x: number;
  /** La hauteur de la tour (m) pour laquelle l'élément est au milieu de l'écran de paysage. */
  a: number;
  echelle: number;
  /** Une variante (0 à 3) : deux nuages voisins ne sont pas jumeaux. */
  v: number;
}

/** Le plan (parallaxe) de chaque genre : les nuages et les étoiles au loin, les oiseaux et les avions plus près, les montgolfières au milieu. */
const PLAN_DE: Readonly<Record<GenreCiel, 0 | 1 | 2>> = { nuage: 1, nuageHaut: 0, oiseaux: 2, avion: 1, montgolfiere: 1, etoiles: 0, aurore: 0, vautour: 2, perroquet: 2, chauve: 2 };
/** Chaque thème a sa graine : le même ciel à chaque partie (une graine = toujours la même suite). */
const GRAINE: Readonly<Record<string, number>> = { port: 0x7071, chantier: 0xc4a2, canyon: 0xca17, banquise: 0xba91, jungle: 0x1a9e, nuit: 0x9167 };

/**
 * Sème le ciel d'un thème : pour chaque rang (tous les `PAS_SEMIS` m de tour, de 0 à `ALTITUDE_MAX`), des éléments des genres de la zone d'altitude, répartis sur la largeur par le
 * hasard d'AFFICHAGE d'une graine fixe (jamais celui de la partie). Deux appels donnent la même liste.
 */
export function semerCiel(theme: string, zones: readonly ZoneCiel[]): ItemCiel[] {
  const hasard = hasardAffichage(GRAINE[theme] ?? 0x5eed);
  const sortie: ItemCiel[] = [];
  for (let a = 0; a <= ALTITUDE_MAX; a += PAS_SEMIS) {
    const zone = zones.find((z) => a >= z.de && a < z.a);
    if (!zone) continue;
    // Chaque genre de la zone, à sa densité, réparti sur la largeur par le hasard d'AFFICHAGE d'une graine fixe : le ciel est plein sans amas.
    for (const genre of zone.genres) {
      const n = PAR_RANG[PLAN_DE[genre]];
      for (let i = 0; i < n; i++) {
        const x = ((i + hasard()) / n - 0.5) * 2 * DEMI_LARGEUR_CIEL;
        sortie.push({ genre, plan: PLAN_DE[genre], x, a: a + (hasard() - 0.5) * (PAS_SEMIS - 1), echelle: 0.8 + hasard() * 0.6, v: Math.floor(hasard() * 4) });
      }
    }
  }
  return sortie;
}

/** Les genres présents à une hauteur de tour (la zone qui la contient), vide hors registre. */
export function genresA(zones: readonly ZoneCiel[], hauteur: number): readonly GenreCiel[] {
  return zones.find((z) => hauteur >= z.de && hauteur < z.a)?.genres ?? [];
}

// Les formes d'un élément du ciel, en pixels de la planche autour de (0, 0), à l'échelle `e`.
const e2 = (formes: readonly Forme[], e: number): Forme[] =>
  formes.map((f): Forme => {
    switch (f.t) {
      case "r":
        return { ...f, x: f.x * e, y: f.y * e, w: f.w * e, h: f.h * e };
      case "c":
        return { ...f, x: f.x * e, y: f.y * e, r: f.r * e };
      case "l":
        return { ...f, x1: f.x1 * e, y1: f.y1 * e, x2: f.x2 * e, y2: f.y2 * e };
      case "p":
        return { ...f, pts: f.pts.map((v) => v * e) };
    }
  });

/** Les formes d'un genre d'élément du ciel, autour de l'origine, aux couleurs du thème. */
export function formesDeCiel(item: ItemCiel, c: DecorTheme["ciel"]): Forme[] {
  const e = item.echelle;
  const v = item.v;
  switch (item.genre) {
    case "nuage":
      return e2([R(c.nuage, -45, 0, 90, 14), R(c.nuage, -29 + v * 4, -10, 34, 11), R(c.nuage, 8 - v * 3, -7, 26, 9)], e);
    case "nuageHaut":
      return e2([R(c.nuageHaut, -60, 0, 120, 14), R(c.nuageHaut, -34 + v * 5, -10, 52, 11), R(c.nuageHaut, 20 - v * 4, -5, 34, 9)], e);
    case "oiseaux":
    case "perroquet":
      return e2([L(c.oiseau, -14, -4, -7, 2, 2.2), L(c.oiseau, -7, 2, 0, -4, 2.2), L(c.oiseau, 0, -4, 7, 2, 2.2), L(c.oiseau, 7, 2, 14, -4, 2.2), L(c.oiseau, 20, 6, 25, 11, 2.2), L(c.oiseau, 25, 11, 30, 6, 2.2)], e);
    case "vautour":
      return e2([L(c.oiseau, -22, -2, -10, 6, 3), L(c.oiseau, -10, 6, 0, 0, 3), L(c.oiseau, 0, 0, 10, 6, 3), L(c.oiseau, 10, 6, 22, -2, 3), C(c.oiseau, 0, 1, 3)], e);
    case "chauve":
      return e2([P(c.oiseau, [-12, -3, -4, 3, 0, -1, 4, 3, 12, -3, 6, 6, 0, 3, -6, 6]), C(c.oiseau, 0, 0, 2.5)], e);
    case "avion":
      return e2([R(c.nuageHaut, -150, 6, 120, 3), R(c.avion, -30, 0, 54, 9, true), P(c.avion, [-6, 0, 6, 0, -2, -14, -10, -14], true), P(c.avion, [-30, 0, -24, 0, -30, -9], true), P(c.avion, [24, 0, 24, 9, 34, 4.5])], e);
    case "montgolfiere":
      return e2([C(c.ballon[v % c.ballon.length]!, 0, 0, 22, true), R(c.ballon[(v + 1) % c.ballon.length]!, -6, -22, 12, 44), L(c.oiseau, -10, 20, -6, 36, 1.4), L(c.oiseau, 10, 20, 6, 36, 1.4), R(c.ballon[(v + 2) % c.ballon.length]!, -7, 36, 14, 9, true)], e);
    case "etoiles":
      return e2([R(c.etoile, -3, -3, 4, 4), R(c.etoile, 38, 14, 3, 3), R(c.etoile, -34, 20, 3, 3), L(c.etoile, 62, -10, 62, -2, 1.6), L(c.etoile, 58, -6, 66, -6, 1.6), R(c.etoile, 86, 24, 3, 3)], e);
    case "aurore":
      return e2([P(c.aurore[0]!, [-90, 4, -30, -12, 30, -4, 90, -14, 90, -4, 30, 8, -30, 0, -90, 16]), P(c.aurore[1 % c.aurore.length]!, [-70, 26, -10, 10, 50, 18, 100, 6, 100, 14, 50, 28, -10, 20, -70, 36])], e);
  }
}

/** Tous les nombres d'une forme sont finis et leurs tailles positives (le test des décors le vérifie pour chaque thème). */
export function formeValide(f: Forme): boolean {
  switch (f.t) {
    case "r":
      return [f.x, f.y, f.w, f.h].every(Number.isFinite) && f.w > 0 && f.h > 0;
    case "c":
      return [f.x, f.y, f.r].every(Number.isFinite) && f.r > 0;
    case "l":
      return [f.x1, f.y1, f.x2, f.y2, f.w].every(Number.isFinite) && f.w > 0;
    case "p":
      return f.pts.length >= 6 && f.pts.length % 2 === 0 && f.pts.every(Number.isFinite);
  }
}

/** Toutes les formes d'un thème par couleur : de quoi vérifier le contraste de chaque plan (les formes du ciel semé comprises). `aire` : la surface couverte en px² (rectangles et disques ; une forme convexe, par la formule du lacet). */
export function couleursDuTheme(theme: DecorTheme): { plan: string; c: string; aire: number }[] {
  const aireDe = (f: Forme): number => {
    switch (f.t) {
      case "r":
        return f.w * f.h;
      case "c":
        return Math.PI * f.r * f.r;
      case "l":
        return Math.hypot(f.x2 - f.x1, f.y2 - f.y1) * f.w;
      case "p": {
        let s = 0;
        for (let i = 0; i < f.pts.length; i += 2) {
          const j = (i + 2) % f.pts.length;
          s += f.pts[i]! * f.pts[j + 1]! - f.pts[j]! * f.pts[i + 1]!;
        }
        return Math.abs(s) / 2;
      }
    }
  };
  const sortie: { plan: string; c: string; aire: number }[] = [];
  const noms = ["lointain", "moyen", "proche", "sol"];
  theme.plans.forEach((p, i) => {
    for (const f of [...p.centre, ...p.repete]) sortie.push({ plan: noms[i]!, c: f.c, aire: aireDe(f) });
  });
  for (const a of theme.anims) for (const f of a.formes) sortie.push({ plan: `${noms[a.plan]} (animé)`, c: f.c, aire: aireDe(f) });
  for (const b of theme.bandes) sortie.push({ plan: "ciel haut", c: b.c, aire: 400 * 600 });
  for (const item of semerCiel("verif", theme.zones)) for (const f of formesDeCiel(item, theme.ciel)) sortie.push({ plan: `ciel (${item.genre})`, c: f.c, aire: aireDe(f) });
  return sortie;
}
