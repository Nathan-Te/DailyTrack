// Le palier 1 de la scène (retouche 38b ; **mis en jeu au lot 43**, dans le premier chargement) : les éléments de course du mélange recommandé du lot 38
// (portiques « cartouches » de A, feux de départ et arche gonflable de B, plaques et panneaux de A, rebords de B aux couleurs de A), **nettoyés** et
// **posés selon les règles du lot 37** (`decorPose.ts` : un appui sous chaque pied, rien dans le passage, un rôle par élément ; chaque pièce passe par
// `placed`, le test de pose les relève). Des fonctions **par élément, paramétrées par thème et par palier** : le pas « géométrie » du palier 2 arrive
// par le contexte (`x.finition`, `finition.ts`, à la demande), ce module n'importe aucun module des pas.
//
// Corrections du 38b, § 2 : socles et pieds jusqu'au sol lointain ; mur de pneus léger ; route grise sous lumière chaude (sauf le Canyon) ; lampes de la
// Nuit qui suivent l'éclairage de piste qu'on pose. Lot 43 : **l'orange est à la voiture seule** (vibreurs, rebords et panneaux rouges passent au
// cramoisi `ROUGE_PISTE` : ΔE 2000 > 12 avec l'orange de Track, test `scene.test.ts`), feux de départ qui suivent le décompte, panneaux de distance
// avant les virages serrés, sponsors fictifs (`sponsors.ts`), textes des portiques tirés du catalogue (`Contexte.textes`).
import { CELL, CUT_HALF_LENGTH, SHOULDER_EDGE, WALL_HEIGHT, blockHalfWidth, isCurve, type Block, type PaletteName, type Track } from "@cdj/sim";
import { Builder, mix, shade, type V3 } from "../meshKit";
import { distanceSigns, type DistanceSpec, type SignSpec } from "../signage";
import { CHAPEAU, placed, type PoseKind, type PoseMeta } from "../decorPose";
import { SIGN_STYLES, drawGlyph, signStyleOf } from "../trackProps";
import { hasCap, onBlock, onRim, type Palette } from "../trackMesh";
import { COLONNES_FEUX, FEUX_ETEINTS, type EtatFeux } from "../feux";
import { boite, face, livree, pt, repereBloc, sol, tube, type Repere } from "./outils";
import { MARQUE, bandeau, chevronSol, damierSol, textureBandeau } from "./pieces";
import { CAOUTCHOUC, METAL_SOMBRE, PISTE_A, bordureVideP1, cuveA, plaqueA, REBORDS_B, rebordLegerDe, rivesA, tiretsA, vibreursA, type RebordB } from "./piste";
import { couleurRouteOrigine, jupeOrigine, type StyleRoute, type TronconRebord } from "./route";
import { rectSponsor, sponsorsDuTheme } from "./sponsors";
import type { Calques, Contexte } from "./types";

/** Béton des socles et des pieds qui descendent jusqu'au sol. */
const BETON = 0xb9bbbe;
/** Le vent de la scène (x, z) : les drapeaux flottent tous dans le même sens. */
export const VENT: readonly [number, number] = [0.94, 0.34];

// --- Couleurs : l'orange est à la voiture (lot 43) --------------------------------------------------------------------------------------

/**
 * Le rouge de la piste (vibreurs, rebords rouges, panneau de virage serré, plaque de super turbo) : un rouge franc, un peu plus sombre. Le rouge vif des
 * directions (`0xe8283a`) était à ΔE 11 de l'orange de Track (`0xe8552d`, la couleur de la voiture), le rouge-orangé de la Campagne à 6,5 et les vibreurs
 * du Rallye étaient orange : décision de Nathan (23/10/2026), l'orange est à la voiture seule, chaque élément de piste reste à ΔE 2000 > 12. Celui-ci est à
 * 15,6 de l'orange et à 18 du grenat (la palette du lot 40 : aucune couleur de voiture à moins de 15,6).
 */
export const ROUGE_PISTE = 0xc01818;
/** Les vibreurs du palier 1, là où ils changent (les autres thèmes gardent ceux de A : ambre et encre la nuit et en Ville, encre et crème au Canyon). */
const VIBREURS_P1: Partial<Record<PaletteName, [number, number]>> = {
  stade: [ROUGE_PISTE, 0xf4f4f4],
  desert: [ROUGE_PISTE, 0xf4f1e6],
  neige: [ROUGE_PISTE, 0xffffff],
  campagne: [ROUGE_PISTE, 0xf6f6f0],
  alpin: [ROUGE_PISTE, 0xf6f6f6],
};
/** Rebords et murets des bas-côtés du palier 1, là où ils changent (Col : glissière cramoisi ; Nuit : le muret orangé des bas-côtés devient encre et ambre ; Canyon). */
const REBORDS_P1: Partial<Record<PaletteName, { rebord?: [number, number]; fence?: [number, number]; skirt?: number }>> = {
  alpin: { rebord: [ROUGE_PISTE, 0xf6f6f6], fence: [ROUGE_PISTE, 0xf6f6f6] },
  nuit: { fence: [0x1e1b19, 0xf2b544] },
  // Canyon : la roche rouge (a8472a) éclairée virait à l'orange (ΔE 10 sur ses faces claires) ; une roche plus brune et plus sombre.
  // Sa jupe aussi (le remblai sous la route, éclairci sur les tremplins).
  canyon: { rebord: [0x7a3a2a, 0xe0a466], fence: [0x7a3a2a, 0xdc9a5e], skirt: 0x5e3a30 },
};

/** Les couleurs des vibreurs du palier 1 pour un thème. */
export const vibreursP1 = (nom: PaletteName): readonly [number, number] => VIBREURS_P1[nom] ?? PISTE_A[nom].vibreur;

/**
 * La route sous une lumière chaude (palier 1) : sous le soleil doré de la Campagne ou ocre du Rallye (lumière de C), le gris chaud de A virait au brun
 * (on le voyait sur les captures du lot 38) — contraire à la règle « la route est un gris ». Un gris légèrement bleuté compense la lumière. **Le Canyon
 * garde sa route rouge-brun** sous son soleil rasant orangé (décision de Nathan, 22/10/2026 : `direction.md` § 9) : plus sombre et plus froide que le sable.
 */
export const ROUTE_SOUS_LUMIERE_CHAUDE: Partial<Record<PaletteName, [number, number]>> = { desert: [0x5a6372, 0x56606e], campagne: [0x606670, 0x5c626c] };

/** La palette du palier 1 pour un thème : celle de A (route, rebords, sol, ciel), la route grise sous lumière chaude, l'orange retiré de la piste. */
export function paletteP1(nom: PaletteName, base: Palette): Palette {
  const t = PISTE_A[nom];
  const corr = REBORDS_P1[nom];
  const rebord = corr?.rebord ?? t.rebord;
  return { ...base, road: ROUTE_SOUS_LUMIERE_CHAUDE[nom] ?? t.route, wallA: rebord[0], wallB: rebord[1], floorA: t.sol[0], floorB: t.sol[1], sky: t.ciel[1], zenith: t.ciel[0], fence: corr?.fence ?? base.fence, skirt: corr?.skirt ?? base.skirt };
}

/**
 * Les rebords et le bord du vide complets du pas « géométrie » (palier 2 : `rebordB` et `bordureVideB` de `rebordsComplets.ts`), donnés par le compositeur
 * qui les veut : le palier 1 du jeu n'en embarque pas le code.
 */
export interface RebordsComplets {
  rebord(nom: PaletteName, sorte: RebordB): (g: Builder, t: TronconRebord, lum?: Builder) => void;
  bordureVide: StyleRoute["bordureVide"];
}

/**
 * La route des paliers : rebords de B (profil du thème) aux couleurs de A, vibreurs, lignes et tirets de A ; la Banquise garde le béton. Le mur de
 * pneus est léger au palier 1, complet avec le pas « géométrie » (lot 45 : `complets` donnés, c'est que la géométrie est allumée).
 */
export function routeP(nom: PaletteName, complets?: RebordsComplets): StyleRoute {
  const sorte: RebordB = nom === "neige" ? "beton" : REBORDS_B[nom];
  const fin = !!complets;
  const rebord = complets ? complets.rebord(nom, sorte) : rebordLegerDe(sorte);
  // Assemblé pièce à pièce (et non en recouvrant les styles de A et de B) : le premier chargement ne garde que ce que le palier 1 dessine.
  return {
    rebord: (g, t, _pal, lum) => rebord(g, t, lum),
    bordureVide: fin ? complets!.bordureVide : bordureVideP1,
    vibreurs: vibreursA(vibreursP1(nom), fin),
    rives: rivesA,
    tirets: tiretsA,
    couleurRoute: couleurRouteOrigine,
    jupe: jupeOrigine,
    cuve: cuveA,
  };
}

// --- Pose (lot 37) ---------------------------------------------------------------------------------------------------------------------

/** Le bord de ce que la voiture roule au point `q` d'un bloc : la route, ou la bande avec des bas-côtés. */
const bordRoulant = (b: Block, q: number) => (b.shoulder ? SHOULDER_EDGE : isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, q));

/** Demi-écartement des piliers d'un portique ou des pieds d'une porte : au-delà du bord de la route (ou de la bande) et de son rebord. */
export function ecartP(b: Block, q: number): number {
  return bordRoulant(b, q) + 1.4;
}

/** Un élément posé : ses parties passent par `placed` (relevé des tests, rien dans le jeu). */
function poser(x: Contexte, kind: PoseKind, block: number) {
  const group = x.log?.group() ?? 0;
  return (part: PoseMeta["part"], appui: PoseMeta["appui"], builders: readonly Builder[], run: () => void) => placed(x.log, { kind, part, appui, group, block, style: "" }, builders, run);
}

/** Un pied plein du sol lointain jusqu'à la hauteur de la route (règle « rien en l'air ») : sous un socle, sous un panneau. */
function piedJusquAuSol(g: Builder, r: Repere, x: Contexte, _b: Block, g0: number, g1: number, a0: number, a1: number) {
  const bas = x.floorY - r.o[1]; // le repère est à la hauteur de la route en ce point (une pente n'est pas à `y0`)
  if (bas < -0.05) boite(g, r, g0, g1, bas, 0, a0, a1, shade(BETON, 0.85), shade(BETON, 0.8));
}

// --- Portiques : départ et arrivée ------------------------------------------------------------------------------------------------------

interface StylePortique {
  kind: "arche-depart" | "arche-arrivee";
  texte: string;
  pilier: number;
  /** La bande verticale sur la face intérieure des piliers (à hauteur de voiture : jamais l'orange). */
  interieur: number;
  /** Les rayures de la livrée en haut des piliers. */
  bande: [number, number];
  fond: number;
  encre: number;
  damier?: boolean;
  livree?: boolean;
}

/** Hauteur (m) du dessous de la poutre d'un portique au-dessus de la route. */
const POUTRE = 8.6;

/**
 * Un portique « cartouche » (A) : deux piliers plats sur leurs socles, qui **descendent jusqu'au sol lointain** ; une poutre-panneau bordée d'encre avec son
 * ombre nette décalée (l'ombre `4px 4px 0` de la charte), un bandeau de texte sur les deux faces (un seul maillage), la livrée en haut. Les socles portent
 * deux sponsors (petits, bas : discrets). Rend le repère et l'écart des piliers.
 */
function portiqueP(c: Calques, x: Contexte, b: Block, q: number, st: StylePortique, sousLaPoutre?: (r: Repere) => void) {
  const r = repereBloc(b, q);
  const w = ecartP(b, q);
  const h = POUTRE;
  const haut = 3.0;
  const pose = poser(x, st.kind, b.index);
  const logos = sponsorsDuTheme(x.palette);
  for (const s of [-1, 1]) {
    const g0 = s * w - 0.7;
    const g1 = s * w + 0.7;
    pose("pied", "sol", [c.solide], () => {
      piedJusquAuSol(c.solide, r, x, b, s * w - 1.0, s * w + 1.0, -0.8, 0.8);
      boite(c.solide, r, s * w - 1.1, s * w + 1.1, -0.1, 0.7, -0.9, 0.9, MARQUE.encre);
      if (x.finition) x.finition.colonne(c.solide, r, g0, g1, 0.7, h + haut, -0.45, 0.45, 0.06, st.pilier);
      else boite(c.solide, r, g0, g1, 0.7, h + haut, -0.45, 0.45, st.pilier);
      const inner = s > 0 ? g0 - 0.01 : g1 + 0.01;
      c.solide.quad(pt(r, inner, 0.7, -0.46), pt(r, inner, 0.7, 0.46), pt(r, inner, h, 0.46), pt(r, inner, h, -0.46), st.interieur);
      livree(c.solide, r, g0, g1, h - 3.2, h - 0.6, -0.46, 0.35, st.bande[0], st.bande[1]);
    });
    // Un sponsor sur le devant de chaque socle, lu par qui arrive.
    c.affiches.face(r, s * w - 1.0, s * w + 1.0, 0.1, 0.62, -0.92, rectSponsor(logos[(s + 1) / 2]!));
  }
  pose("surplomb", "sol", [c.solide, c.lumineux], () => {
    boite(c.solide, r, -w - 1.05, w + 0.35, h - 0.4, h + haut - 0.4, 0.35, 0.8, MARQUE.encre);
    boite(c.solide, r, -w - 0.7, w + 0.7, h, h + haut, -0.6, 0.35, st.fond, MARQUE.encre);
    if (st.livree) livree(c.solide, r, -w - 0.7, w + 0.7, h + haut - 0.55, h + haut, -0.61, 0.5, MARQUE.livree, MARQUE.asphalte);
    sousLaPoutre?.(r);
  });
  if (!c.aerien && st.texte) {
    const tex = textureBandeau(st.texte, { fond: st.fond, encre: st.encre, ...(st.damier ? { damier: [MARQUE.encre, MARQUE.creme] as [number, number] } : {}), cadre: [10, MARQUE.encre] });
    const g = w + 0.4;
    const h0 = h + 0.2;
    const h1 = h + haut - (st.livree ? 0.6 : 0.2);
    // Les deux faces dans un seul maillage (un appel de rendu par portique) : l'avant lu par qui arrive, l'arrière par qui repart.
    c.bandeaux.push(bandeau(tex, pt(r, g, h0, -0.62), pt(r, -g, h0, -0.62), pt(r, -g, h1, -0.62), pt(r, g, h1, -0.62), [pt(r, -g, h0 - 0.4, 0.82), pt(r, g, h0 - 0.4, 0.82), pt(r, g, h1 - 0.4, 0.82), pt(r, -g, h1 - 0.4, 0.82)]));
  }
  return { r, w };
}

/** Les cinq colonnes de deux feux de départ, pendues sous la poutre du portique (face à qui arrive) ; allumées par le jeu pendant le décompte (`FeuxDepart`). */
function feuxDuPortique(c: Calques, r: Repere) {
  const h = POUTRE;
  const a = -0.75;
  // Les boîtiers pendent sous la poutre : leur bas est à 7,1 m au-dessus de la route (le passage est à 4,6 m).
  for (let i = 0; i < COLONNES_FEUX; i++) {
    const gg = (2 - i) * 1.1; // la colonne 0 à gauche du pilote : les feux s'allument un à un de gauche à droite
    boite(c.solide, r, gg - 0.4, gg + 0.4, h - 1.5, h, a - 0.2, a + 0.2, CAOUTCHOUC);
    const lampes = () => {
      for (const y of [h - 0.5, h - 1.1]) c.lumineux.prism(...pt(r, gg, y - 0.2, a - 0.21), 0.22, 0.22, 0.4, 8, c.feux ? FEU_ETEINT : FEU_ROUGE);
    };
    if (c.feux) c.feux.poser(c.lumineux, lampes, i);
    else lampes();
  }
}

/** Le portique de départ : la cartouche de A aux couleurs de la marque, les feux de B ; au sol la ligne crème et encre et la case de départ. */
export function portiqueDepartP(c: Calques, x: Contexte, b: Block, q: number) {
  const { r, w } = portiqueP(c, x, b, q, { kind: "arche-depart", texte: x.textes?.depart ?? "", pilier: MARQUE.asphalte, interieur: MARQUE.creme, bande: [MARQUE.livree, MARQUE.asphalte], fond: MARQUE.creme, encre: MARQUE.asphalte, livree: true }, (rp) => feuxDuPortique(c, rp));
  x.finition?.portique(c, x, b, q, w, [MARQUE.livree, MARQUE.asphalte]);
  // Ligne de départ : crème et encre (la livrée orange reste en hauteur, sur le portique : au sol, devant la voiture, l'orange est à elle seule).
  const hw = blockHalfWidth(b, q);
  sol(c.route, r, -hw, hw, -0.5, 0.5, 0.05, MARQUE.creme);
  sol(c.route, r, -hw, hw, 0.5, 1.3, 0.05, MARQUE.encre);
  const r8 = repereBloc(b, 8);
  for (const s of [-1, 1]) sol(c.route, r8, s * 1.4 - 0.2, s * 1.4 + 0.2, -2.4, 3.2, 0.05, MARQUE.creme);
  sol(c.route, r8, -1.6, 1.6, 3.0, 3.4, 0.05, MARQUE.creme);
}

export function arriveeP(c: Calques, x: Contexte, b: Block, q: number) {
  const { r, w } = portiqueP(c, x, b, q, { kind: "arche-arrivee", texte: x.textes?.arrivee ?? "", pilier: MARQUE.encre, interieur: MARQUE.creme, bande: [MARQUE.creme, MARQUE.encre], fond: MARQUE.creme, encre: MARQUE.encre, damier: true });
  x.finition?.portique(c, x, b, q, w, [MARQUE.encre, MARQUE.creme, MARQUE.encre]);
  damierSol(c.route, r, blockHalfWidth(b, q), 2, 2, 0.05, MARQUE.encre, MARQUE.creme);
}

// --- Feux de départ ---------------------------------------------------------------------------------------------------------------------

const FEU_ETEINT = 0x2a0d0b;
const FEU_ROUGE = 0xff1f4f; // un rouge un peu rosé : ΔE 15 avec l'orange de la voiture (0xff2a1a en était à 6)
const FEU_VERT = 0x2bd94a;

/**
 * Les feux de départ du jeu : les sommets de chaque colonne de lampes dans le calque `lumineux` (aucun maillage de plus), repeints quand l'état change.
 * Lecture seule de la course : `main.ts` donne l'état du décompte (`etatFeux`, `feux.ts`).
 */
export class FeuxDepart {
  private plages: { debut: number; fin: number; colonne: number }[] = [];
  etat: EtatFeux = FEUX_ETEINTS;

  poser(lumineux: Builder, run: () => void, colonne: number) {
    const debut = lumineux.col.length;
    run();
    this.plages.push({ debut, fin: lumineux.col.length, colonne });
  }

  get vide(): boolean {
    return this.plages.length === 0;
  }

  /** Repeint les lampes dans le tableau des couleurs (linéaires, celui du calque `lumineux`) ; rend la plage changée, ou `null`. */
  peindre(col: Float32Array, etat: EtatFeux, lineaire: (hex: number) => [number, number, number]): [number, number] | null {
    if (this.plages.length === 0) return null;
    this.etat = etat;
    let d = Infinity;
    let f = 0;
    for (const p of this.plages) {
      const hex = etat.vert ? FEU_VERT : p.colonne < etat.rouges ? FEU_ROUGE : FEU_ETEINT;
      const [r, g, b] = lineaire(hex);
      for (let i = p.debut; i < p.fin; i += 3) {
        col[i] = r;
        col[i + 1] = g;
        col[i + 2] = b;
      }
      d = Math.min(d, p.debut);
      f = Math.max(f, p.fin);
    }
    return [d, f];
  }
}

// --- Porte de contrôle : l'arche gonflable de B ---------------------------------------------------------------------------------------

/** Hauteur (m) du sommet de l'arche gonflable au-dessus de la route ; rayon (m) de ses boudins. */
const ARCHE_H = 8.5;
const BOUDIN = 0.85;
/** Sous cette hauteur (m, dessous du boudin), un boudin fait partie d'un pied : il doit rester au-delà du bord de la route (lot 37). */
const ARCHE_JAMBE = 5.2;

/**
 * Porte d'un point de contrôle : **l'arche gonflable** (B), un demi-ovale « carré » de boudins (super-ellipse d'exposant 4 : ses flancs montent droit),
 * assez large pour que tout ce qui est à moins de 5,2 m de haut reste au-delà du bord de la route (ou de la bande) : le passage est libre à 4,6 m au moins
 * sur toute la largeur ; bandes blanches, lestée à ses pieds sur des socles qui descendent jusqu'au sol ; une petite banderole de sponsor sur le dessus ;
 * la bande au sol de la couleur du contrôle. Le lot 38 posait des bornes de chronométrage sur la route : retirées.
 */
export function porteP(c: Calques, x: Contexte, b: Block) {
  const q = CELL / 2;
  const r = repereBloc(b, q);
  const bord = bordRoulant(b, q);
  const w = 1.08 * bord + 1.4;
  const col = x.pal.checkpoint;
  const fin = !!x.finition; // lot 45 : la géométrie du palier 2 est là
  const n = fin ? 28 : 16;
  const pose = poser(x, "porte", b.index);
  // Les points de l'arche : |g/w|⁴ + |h/H|⁴ = 1, de la gauche (angle 0) à la droite (angle π).
  const point = (i: number): V3 => {
    const a = (i / n) * Math.PI;
    const cs = Math.cos(a);
    return pt(r, Math.sign(cs) * Math.sqrt(Math.abs(cs)) * w, Math.sqrt(Math.sin(a)) * ARCHE_H, 0);
  };
  const hauteur = (i: number) => Math.sqrt(Math.sin((i / n) * Math.PI)) * ARCHE_H;
  // Un boudin bas (son dessous sous `ARCHE_JAMBE`) est une partie du pied ; le reste de l'arche est le surplomb.
  const jambe = (i: number) => Math.min(hauteur(i - 1), hauteur(i)) - BOUDIN < ARCHE_JAMBE;
  const boudin = (i: number) => tube(c.solide, point(i - 1), point(i), BOUDIN, fin ? 12 : 6, Math.floor(((i - 0.5) / n) * 16) % 3 === 2 ? 0xffffff : col);
  for (const s of [-1, 1]) {
    pose("pied", "sol", [c.solide], () => {
      piedJusquAuSol(c.solide, r, x, b, s * w - 1, s * w + 1, -1, 1);
      boite(c.solide, r, s * w - 1, s * w + 1, 0, 0.6, -1, 1, CAOUTCHOUC);
      for (let i = 1; i <= n; i++) if (jambe(i) && (s > 0 ? i <= n / 2 : i > n / 2)) boudin(i);
    });
  }
  pose("surplomb", "sol", [c.solide, c.lumineux], () => {
    for (let i = 1; i <= n; i++) if (!jambe(i)) boudin(i);
    for (const s of [-1, 1]) c.lumineux.halo(...pt(r, s * w * 0.7, ARCHE_H * 0.75, 0), col, 6);
  });
  const logos = sponsorsDuTheme(x.palette);
  const rect = rectSponsor(logos[b.index % logos.length]!);
  c.affiches.face(r, -1.8, 1.8, ARCHE_H - 0.1, ARCHE_H + 0.7, -0.86, rect);
  c.affiches.quad(pt(r, -1.8, ARCHE_H - 0.1, 0.86), pt(r, 1.8, ARCHE_H - 0.1, 0.86), pt(r, 1.8, ARCHE_H + 0.7, 0.86), pt(r, -1.8, ARCHE_H + 0.7, 0.86), rect);
  const hw = b.shoulder ? SHOULDER_EDGE : blockHalfWidth(b, q);
  sol(c.lumineux, r, -hw, hw, -0.5, 0.5, 0.05, mix(col, 0xffffff, 0.25));
}

// --- Plaques ----------------------------------------------------------------------------------------------------------------------------

export function plaqueP(c: Calques, x: Contexte, b: Block) {
  plaqueA(c, b, x.pal.boost, MARQUE.encre, MARQUE.encre, 3);
  c.lumineux.halo(...pt(repereBloc(b, CELL / 2), 0, 0.6, 0), x.pal.boost, 7);
}

/** Super turbo : plaque cramoisi (l'orange est à la voiture), chevrons jaunes. */
export function turboP(c: Calques, _x: Contexte, b: Block) {
  plaqueA(c, b, ROUGE_PISTE, 0xffd23f, MARQUE.encre, 3);
  c.lumineux.halo(...pt(repereBloc(b, CELL / 2), 0, 0.6, 0), ROUGE_PISTE, 9);
}

/** Moteur coupé : des rayures d'alerte à 45°, encre et jaune, sur toute la largeur. */
export function coupureP(c: Calques, _x: Contexte, b: Block) {
  const r = repereBloc(b, CELL / 2);
  const hw = blockHalfWidth(b, CELL / 2);
  const L = CUT_HALF_LENGTH;
  sol(c.route, r, -hw, hw, -L, L, 0.04, 0xffd23f);
  for (let g = -hw - 2 * L; g < hw; g += 2.4) {
    const P = (gg: number, a: number) => pt(r, Math.max(-hw, Math.min(hw, gg)), 0.05, a);
    c.route.quad(P(g, -L), P(g + 1.2, -L), P(g + 1.2 + 2 * L, L), P(g + 2 * L, L), MARQUE.encre);
  }
}

// --- Panneaux ---------------------------------------------------------------------------------------------------------------------------

/** Couleur de la plaque d'un panneau de virage : jaune, orange, cramoisi (serré) ou bleu (cuve). */
function plaqueDe(s: SignSpec): number {
  const style = signStyleOf(s.kind, s.severity);
  return style === "red" ? ROUGE_PISTE : SIGN_STYLES[style]!.plate;
}

/**
 * Panneau de virage (A) : large (4,2 × 1,7 m), sur deux pieds **qui descendent jusqu'au sol lointain**, plaque sans éclairage, son ombre nette d'encre
 * derrière, 1 à 3 chevrons étalés. Planté assez loin du bord pour que la plaque ne surplombe jamais la route (son bord intérieur reste au-delà du bord
 * de la route, ou de la bande, et du rebord).
 */
export function panneauP(c: Calques, x: Contexte, hote: Block, s: SignSpec) {
  const large = s.kind === "left" || s.kind === "right" ? 2.1 : 1.3;
  const bord = s.offset - 1.6;
  const r0 = repereBloc(hote, s.q, s.side * (bord + large + 0.6));
  const plaque = plaqueDe(s);
  const encre = signStyleOf(s.kind, s.severity) === "yellow" || signStyleOf(s.kind, s.severity) === "orange" ? MARQUE.encre : MARQUE.papier;
  const h0 = 1.6;
  const h1 = h0 + 1.7;
  poser(x, "panneau", hote.index)("pied", "sol", [c.solide, c.lumineux], () => {
    for (const g of [-large * 0.6, large * 0.6]) {
      piedJusquAuSol(c.solide, r0, x, hote, g - 0.08, g + 0.08, 0.15, 0.35);
      boite(c.solide, r0, g - 0.08, g + 0.08, 0, h0 + 0.2, 0.15, 0.35, MARQUE.encre);
    }
    boite(c.solide, r0, -large + 0.25, large + 0.25, h0 - 0.25, h1 - 0.25, 0.12, 0.3, MARQUE.encre);
    boite(c.solide, r0, -large, large, h0, h1, -0.12, 0.1, encre === MARQUE.encre ? MARQUE.encre : MARQUE.papier);
    face(c.lumineux, r0, -large + 0.12, large - 0.12, h0 + 0.12, h1 - 0.12, -0.13, plaque);
    // Glyphe : chevrons, rampe ou cuve, comme l'existant (même lecture), dans le calque sans éclairage.
    const centre = pt(r0, 0, (h0 + h1) / 2, -0.13);
    const pl = { c: centre, right: [-r0.l[0], 0, -r0.l[2]] as V3, up: [0, 1, 0] as V3, toward: [-r0.f[0], 0, -r0.f[2]] as V3 };
    const sc = (h1 - h0 - 0.3) / 1.8;
    const scaled = { ...pl, right: pl.right.map((v) => v * sc) as V3, up: pl.up.map((v) => v * sc) as V3 };
    if (s.kind === "left" || s.kind === "right") {
      const dir = s.kind === "right" ? 1 : -1;
      for (let i = 0; i < s.severity; i++) {
        const u = (i - (s.severity - 1) / 2) * 1.1 * dir;
        drawGlyph(c.lumineux, { ...scaled, c: [centre[0] + pl.right[0] * u, centre[1], centre[2] + pl.right[2] * u] }, s.kind, 1, 0, 0.01, encre);
      }
    } else drawGlyph(c.lumineux, scaled, s.kind, s.severity, s.cuve, 0.01, encre);
  });
  x.finition?.panneau(c, x, hote, r0, large);
}

/**
 * Lot 43 — un panneau de distance avant un virage serré (décision de Nathan : oui) : rôle *signaler*. Une plaque d'encre de 1 × 1,25 m portant 3, 2 ou
 * 1 barres crème obliques, sur un poteau qui descend jusqu'au sol, du même côté que le panneau du virage ; plus bas et plus petit que lui (il ne
 * cache ni la voiture ni le virage). Position : `distanceSigns` (signage.ts), calculée depuis la géométrie du circuit.
 */
export function panneauDistanceP(c: Calques, x: Contexte, d: DistanceSpec) {
  const hote = x.track.blocks[d.block]!;
  const r0 = repereBloc(hote, d.q, d.side * (d.offset + 0.4));
  const h0 = 1.3;
  const h1 = 2.55;
  poser(x, "panneau", hote.index)("pied", "sol", [c.solide, c.lumineux], () => {
    piedJusquAuSol(c.solide, r0, x, hote, -0.07, 0.07, 0.1, 0.24);
    boite(c.solide, r0, -0.07, 0.07, 0, h0, 0.1, 0.24, METAL_SOMBRE);
    boite(c.solide, r0, -0.55, 0.55, h0 - 0.05, h1 + 0.05, 0, 0.08, MARQUE.encre);
    face(c.lumineux, r0, -0.5, 0.5, h0, h1, -0.01, MARQUE.encre);
    // Les barres : des parallélogrammes crème inclinés, centrés sur la plaque.
    for (let k = 0; k < d.barres; k++) {
      const g = (k - (d.barres - 1) / 2) * 0.3;
      c.lumineux.quad(pt(r0, g + 0.16, h0 + 0.14, -0.02), pt(r0, g + 0.02, h0 + 0.14, -0.02), pt(r0, g - 0.16, h1 - 0.14, -0.02), pt(r0, g - 0.02, h1 - 0.14, -0.02), MARQUE.creme);
    }
  });
}

/** Tous les panneaux de distance d'un circuit. */
export function panneauxDistanceP(c: Calques, x: Contexte, signs?: readonly SignSpec[]): number {
  const liste = distanceSigns(x.track, signs);
  for (const d of liste) panneauDistanceP(c, x, d);
  return liste.length;
}

// --- Rythme de vitesse ------------------------------------------------------------------------------------------------------------------

/** Où sont les repères de vitesse sur un bloc rapide (fractions : tous les 16 m, comme les bornes de l'existant). */
export const POSES_RYTHME = [0.25, 0.75] as const;

/**
 * Rythme de vitesse (A, posé selon le lot 37) : **seulement dans les portions rapides** (ailleurs, des bornes n'auraient pas de rôle), des repères plats
 * encre et ambre tous les 8 m sur le chapeau des rebords pleins, et, un bloc droit sur deux, une arche plate à bandes ambre et asphalte dont les pieds
 * descendent jusqu'au sol, de l'autre côté du rebord.
 */
export function rythmeP(c: Calques, x: Contexte, b: Block, rapide: boolean) {
  if (!rapide || b.kind === "jump" || b.kind === "gap" || b.kind === "kick" || b.cuve) return;
  const cap = x.pal.wallHeight ?? WALL_HEIGHT;
  if (hasCap(b)) {
    for (const u of POSES_RYTHME) {
      for (const side of [-1, 1] as const) {
        const p = onRim(b, u, side, CHAPEAU / 2, cap);
        poser(x, "poteau", b.index)("pied", "rebord", [c.solide], () => {
          // Un repère plat : un fût d'encre, sa tête ambre sur les faces tournées vers la route (14 triangles).
          c.solide.box(p[0] - 0.12, p[1], p[2] - 0.12, p[0] + 0.12, p[1] + 2.6, p[2] + 0.12, MARQUE.encre);
          const v = onBlock(b, 0, u, 0);
          const l = Math.hypot(v[0] - p[0], v[2] - p[2]) || 1;
          const nx = (v[0] - p[0]) / l;
          const nz = (v[2] - p[2]) / l;
          const P = (s: number, y: number): V3 => [p[0] + nx * 0.125 - nz * 0.125 * s, p[1] + y, p[2] + nz * 0.125 + nx * 0.125 * s];
          c.solide.quad(P(-1, 1.9), P(1, 1.9), P(1, 2.6), P(-1, 2.6), MARQUE.ambre);
        });
      }
    }
  }
  x.finition?.rythme(c, x, b, rapide);
  if (b.index % 2 !== 0 || isCurve(b.kind) || b.banked) return;
  const q = CELL / 2;
  const r = repereBloc(b, q);
  const w = bordRoulant(b, q) + CHAPEAU + 0.1 + 0.3;
  const pose = poser(x, "arche-vitesse", b.index);
  const bas = x.floorY - r.o[1];
  for (const s of [-1, 1]) pose("pied", "sol", [c.solide], () => boite(c.solide, r, s * w - 0.3, s * w + 0.3, bas, 7.4, -0.3, 0.3, MARQUE.asphalte));
  pose("surplomb", "sol", [c.solide], () => {
    boite(c.solide, r, -w - 0.3, w + 0.3, 6.2, 7.4, -0.3, 0.3, MARQUE.asphalte);
    livree(c.solide, r, -w, w, 6.3, 7.3, -0.31, 0.6, MARQUE.ambre, MARQUE.asphalte);
  });
}

// --- Sponsors des rebords -----------------------------------------------------------------------------------------------------------

/** Où sont les panneaux de sponsors sur les rebords du départ et de l'arrivée : intervalles (m) du bloc, loin des portiques. */
const SPONSORS_DEPART: readonly [number, number][] = [[3, 7], [11, 15]];
const SPONSORS_ARRIVEE: readonly [number, number][] = [[3, 7], [23, 27]];

/**
 * Lot 43 — quelques panneaux de sponsors fictifs posés sur le chapeau des rebords du départ et de l'arrivée (rôle *habiller*) : bas (0,45 m), tournés vers
 * la route, des couleurs éteintes. Seulement sur un rebord plein d'un bloc droit.
 */
export function sponsorsRebordsP(c: Calques, x: Contexte) {
  const cap = x.pal.wallHeight ?? WALL_HEIGHT;
  const logos = sponsorsDuTheme(x.palette);
  let k = 2;
  const blocs: [Block, readonly [number, number][]][] = [[x.track.blocks[0]!, SPONSORS_DEPART], [x.track.blocks[x.track.blocks.length - 1]!, SPONSORS_ARRIVEE]];
  for (const [b, places] of blocs) {
    if (!hasCap(b) || isCurve(b.kind) || b.bumpy || b.w0 !== b.w1) continue;
    for (const side of [-1, 1] as const) {
      for (const [q0, q1] of places) {
        const a = onRim(b, q0 / CELL, side, CHAPEAU / 2, cap);
        const d = onRim(b, q1 / CELL, side, CHAPEAU / 2, cap);
        poser(x, "sponsor", b.index)("pied", "rebord", [c.solide], () => {
          c.solide.box(Math.min(a[0], d[0]) - 0.03, a[1], Math.min(a[2], d[2]) - 0.03, Math.max(a[0], d[0]) + 0.03, a[1] + 0.5, Math.max(a[2], d[2]) + 0.03, METAL_SOMBRE);
        });
        // L'affiche, sur la face tournée vers la route, lue dans le sens de la course à gauche, à rebours à droite (on la regarde en tournant la tête).
        const vers = onBlock(b, 0, (q0 + q1) / 2 / CELL, 0);
        const l = Math.hypot(vers[0] - a[0], vers[2] - a[2]) || 1;
        const ix = ((vers[0] - a[0]) / l) * 0.04;
        const iz = ((vers[2] - a[2]) / l) * 0.04;
        const [g, e] = side > 0 ? [a, d] : [d, a];
        const P = (p: V3, y: number): V3 => [p[0] + ix, p[1] + y, p[2] + iz];
        c.affiches.quad(P(g, 0.05), P(e, 0.05), P(e, 0.45), P(g, 0.45), rectSponsor(logos[k++ % logos.length]!));
      }
    }
  }
}

// --- La nuit : l'éclairage de piste (C), posé selon le lot 37 -------------------------------------------------------------------------

/** L'éclairage de piste de la Nuit : les lampadaires posés (dans les calques) et la position des têtes (où poser les lampes réelles et les flaques). */
export interface EclairagePiste {
  sources: [number, number, number][];
  /** Centre de chaque flaque de lumière sur la route. */
  flaques: V3[];
}

/**
 * L'éclairage de piste des thèmes de nuit (C) : un lampadaire sur le chapeau du rebord tous les deux blocs pleins (côtés alternés), une potence au-dessus de
 * la route à 7,2 m, sa tête lumineuse et son halo ; les lampes réelles et les flaques de lumière (le compositeur) **suivent ces lampadaires**. Lot 37 : le
 * pied est sur le chapeau (plus au-delà, dans le vide), rien sur un bloc sans rebord, un bas-côté, une cuve ou un saut.
 */
export function eclairagePisteP(c: Calques, x: Contexte, couleur: number): EclairagePiste {
  const sources: [number, number, number][] = [];
  const flaques: V3[] = [];
  const cap = x.pal.wallHeight ?? WALL_HEIGHT;
  for (const b of x.track.blocks) {
    if (b.index % 2 !== 0 || !hasCap(b) || b.kind === "kick" || b.mark) continue;
    const cote = (b.index >> 1) % 2 === 0 ? 1 : -1;
    const hw = isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, CELL / 2);
    const pied = onRim(b, 0.5, cote, CHAPEAU / 2, cap);
    const vers = onBlock(b, cote * (hw - 1.4), 0.5, 7.2);
    const pose = poser(x, "lampadaire", b.index);
    pose("pied", "rebord", [c.solide], () => c.solide.box(pied[0] - 0.12, pied[1], pied[2] - 0.12, pied[0] + 0.12, vers[1] + 0.05, pied[2] + 0.12, 0x2a2f45));
    pose("surplomb", "rebord", [c.solide, c.lumineux], () => {
      c.solide.box(Math.min(pied[0], vers[0]) - 0.1, vers[1] - 0.1, Math.min(pied[2], vers[2]) - 0.1, Math.max(pied[0], vers[0]) + 0.1, vers[1] + 0.05, Math.max(pied[2], vers[2]) + 0.1, 0x2a2f45);
      c.lumineux.box(vers[0] - 0.35, vers[1] - 0.25, vers[2] - 0.35, vers[0] + 0.35, vers[1] - 0.1, vers[2] + 0.35, couleur);
      c.lumineux.halo(vers[0], vers[1] - 0.3, vers[2], couleur, 6);
    });
    sources.push([vers[0], vers[1], vers[2]]);
    flaques.push(onBlock(b, cote * (hw - 1.4) * 0.6, 0.5, 0.08));
  }
  return { sources, flaques };
}
