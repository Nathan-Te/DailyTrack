// Retouche 38b — la direction des paliers : le mélange recommandé du lot 38 (éléments de course de A, feux de départ et arche gonflable de B,
// rebords de B aux couleurs de A, décor de B allégé, horizon du thème), **nettoyé** (palier 1), et ses fonctions de construction **par élément,
// paramétrées par thème et par palier** : chacune lit `x.reglages` et ajoute ce que les pas allumés demandent (palier 2 : pièces d'échelle,
// chanfreins, variété ; palier 3 : écrans, foule, drapeaux qui flottent). Écrit pour être repris tel quel par les lots de mise en œuvre.
//
// Ce que le palier 1 corrige du mélange du lot 38 (README du lot 38, § 5 et § 6) :
//   - le mur de pneus du Rallye allégé (`rebordB(…, { leger: true })` : ≈ 8 triangles par pile au lieu de 15) ;
//   - « rien en l'air » (règle du lot 37) : les socles des portiques et les pieds des panneaux, posés au-delà du bord de la route, descendent
//     jusqu'au sol lointain (ils flottaient au-dessus de la jupe) ;
//   - les rebords dans leur propre calque (`Calques.rebords`) : eux seuls projettent l'ombre de contact sur la piste (la surface plate de la route
//     n'est plus redessinée dans la carte d'ombres) — voir `composerPalier.ts`, qui intègre aussi la lumière de C au lieu de la repasser.
import { CELL, WALL_HEIGHT, blockHalfWidth, isCurve, type Block, type PaletteName } from "@cdj/sim";
import { shade, type Builder } from "../meshKit";
import type { SignSpec } from "../signage";
import { ambianceDOrigine, placesDeDecor } from "./composer";
import { DIRECTION_A, arrivee as arriveeA, ecart, panneau as panneauA, portiqueDepart as portiqueA, routeA, rythme as rythmeA } from "./directionA";
import { CAOUTCHOUC, METAL, METAL_SOMBRE, PEAU, RECETTES_B, REBORDS_B, SPONSORS, atlasB, feuxDeDepart, porteB, rect, routeB } from "./directionB";
import { banderole, boulons, cablePendant, coins, marque, pneusEmpiles, varierInstance } from "./finition";
import { boite, boiteChanfreinee, pt, repereBloc, type Repere } from "./outils";
import { MARQUE } from "./pieces";
import type { Reglages } from "./paliers";
import { onBlock, type StyleRoute } from "./route";
import { HORIZONS, type Calques, type Contexte, type Direction } from "./types";

/** Béton des socles et des pieds qui descendent jusqu'au sol. */
const BETON = 0xb9bbbe;
/** Le vent de la scène (x, z) : les drapeaux flottent tous dans le même sens. */
export const VENT: readonly [number, number] = [0.94, 0.34];

/**
 * La route des paliers : rebords de B (profil du thème) aux couleurs de A, vibreurs, lignes et tirets de A ; la Banquise garde le béton. Le mur de
 * pneus est léger au palier 1, complet dès que le pas « géométrie » est allumé.
 */
export function routeP(nom: PaletteName, r?: Reglages): StyleRoute {
  const a = routeA(nom);
  const b = routeB(nom, nom === "neige" ? "beton" : REBORDS_B[nom], { leger: !r?.geometrie });
  return { ...a, rebord: b.rebord, bordureVide: b.bordureVide };
}

/** Un pied plein du sol lointain jusqu'à la route (règle « rien en l'air ») : sous un socle, sous un panneau. */
function piedJusquAuSol(g: Builder, r: Repere, x: Contexte, b: Block, g0: number, g1: number, a0: number, a1: number) {
  const bas = x.floorY - b.y0;
  if (bas < -0.5) boite(g, r, g0, g1, bas, 0, a0, a1, shade(BETON, 0.85), shade(BETON, 0.8));
}

/** Les socles du portique (palier 1 : pieds jusqu'au sol) et ses détails (palier 2 : boulons, pneus, câble, banderoles, drapeaux). */
function habillerPortique(c: Calques, x: Contexte, b: Block, q: number, drapeau: readonly number[]) {
  const r = repereBloc(b, q);
  const w = ecart(b, q);
  const fin = !!x.reglages?.geometrie;
  for (const s of [-1, 1]) {
    piedJusquAuSol(c.solide, r, x, b, s * w - 1.0, s * w + 1.0, -0.8, 0.8);
    if (!fin) continue;
    // Un socle prolongé vers qui arrive, protégé par deux piles de pneus (une sur deux au haut blanc) ; ses boulons.
    boiteChanfreinee(c.solide, r, s * w - 1.1, s * w + 1.1, -0.1, 0.7, -2.6, -0.9, 0.08, MARQUE.encre, shade(MARQUE.encre, 1.3));
    piedJusquAuSol(c.solide, r, x, b, s * w - 1.0, s * w + 1.0, -2.5, -0.8);
    for (const [k, dg] of [-0.45, 0.45].entries()) pneusEmpiles(c.solide, ...pt(r, s * w + dg, 0.7, -1.75), 3, k === 0 ? 0xf4f4f4 : CAOUTCHOUC);
    boulons(c.solide, r, coins(s * w - 1.1, s * w + 1.1, -0.9, 0.9, 0.14), 0.7, METAL);
    // Le câble d'alimentation qui descend de la poutre le long du pilier.
    cablePendant(c.solide, pt(r, s * (w - 0.75), 8.4, 0.3), pt(r, s * (w - 0.75), 0.72, 0.6), 0.25, CAOUTCHOUC, 6);
    // Banderole de sponsor sur le devant du socle.
    const logos = SPONSORS[x.palette];
    banderole(c.affiches, r, s * w - 1.05, s * w + 1.05, 0.08, 0.66, -2.62, rect(logos[(s + 1) / 2 % logos.length]!));
  }
  // Un drapeau en haut de chaque pilier (hampe : un tube), qui flotte dans le vent de la scène : dès qu'il y a des drapeaux (palier 2 :
  // figés ; palier 3 : animés).
  if (!c.drapeaux) return;
  for (const s of [-1, 1]) {
    const haut = pt(r, s * (w + 0.4), 11.6, 0);
    c.solide.box(haut[0] - 0.05, haut[1], haut[2] - 0.05, haut[0] + 0.05, haut[1] + 2.6, haut[2] + 0.05, METAL);
    c.drapeaux.drapeau([haut[0], haut[1] + 2.55, haut[2]], VENT, 1.7, 1.05, drapeau, s * 1.3 + b.index);
  }
}

/** Le portique de départ : la cartouche de A, les feux de B ; palier 2 : socles, pneus, câbles, drapeaux ; palier 3 : chronomètre à diodes. */
export function portiqueDepartP(c: Calques, x: Contexte, b: Block, q: number) {
  portiqueA(c, x, b, q);
  const r = repereBloc(b, q);
  feuxDeDepart(c, r, 8.6, -0.75);
  habillerPortique(c, x, b, q, [MARQUE.livree, MARQUE.asphalte]);
  if (x.reglages?.ecrans && c.chrono) {
    // Un chronomètre à diodes sur le devant du pilier droit, sous la livrée, lu par qui arrive (palier 3 : `vie.ts` le fait tourner).
    const w = ecart(b, q);
    c.chrono.face(r, -w - 0.62, -w + 0.62, 4.1, 4.95, -0.47, [0, 0, 1, 1]);
  }
}

export function arriveeP(c: Calques, x: Contexte, b: Block, q: number) {
  arriveeA(c, x, b, q);
  habillerPortique(c, x, b, q, [MARQUE.encre, MARQUE.creme, MARQUE.encre]);
}

/** Panneau de virage : celui de A, ses pieds jusqu'au sol (palier 1) ; palier 2 : semelles boulonnées et jambe de force. */
export function panneauP(c: Calques, x: Contexte, hote: Block, s: SignSpec) {
  panneauA(c, x, hote, s);
  const r0 = repereBloc(hote, s.q, s.side * s.offset);
  const large = s.kind === "left" || s.kind === "right" ? 2.1 : 1.3;
  for (const g of [-large * 0.6, large * 0.6]) {
    piedJusquAuSol(c.solide, r0, x, hote, g - 0.08, g + 0.08, 0.15, 0.35);
    if (!x.reglages?.geometrie) continue;
    boite(c.solide, r0, g - 0.22, g + 0.22, 0, 0.04, 0.03, 0.47, METAL_SOMBRE);
    boulons(c.solide, r0, coins(g - 0.22, g + 0.22, 0.03, 0.47, 0.06), 0.04, METAL);
  }
  if (x.reglages?.geometrie) {
    // Jambe de force entre les deux pieds, en diagonale (la structure qui tient le panneau au vent).
    const a = pt(r0, -large * 0.6, 0.3, 0.25);
    const d = pt(r0, large * 0.6, 1.5, 0.25);
    c.solide.box(Math.min(a[0], d[0]) - 0.03, a[1], Math.min(a[2], d[2]) - 0.03, Math.max(a[0], d[0]) + 0.03, a[1] + 0.06, Math.max(a[2], d[2]) + 0.03, METAL_SOMBRE);
    boite(c.solide, r0, -large * 0.6, large * 0.6, 0.9, 0.96, 0.22, 0.28, METAL_SOMBRE);
  }
}

/** Rythme de vitesse de A ; palier 2 : un catadioptre ambre sur chaque repère. */
export function rythmeP(c: Calques, x: Contexte, b: Block, rapide: boolean) {
  rythmeA(c, x, b, rapide);
  if (!x.reglages?.geometrie || b.kind === "jump" || b.kind === "gap" || b.kind === "kick") return;
  const rail = b.open ? 0 : (x.pal.wallHeight ?? WALL_HEIGHT);
  const hw = (u: number) => (isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, u * CELL));
  for (const u of rapide ? [0.125, 0.375, 0.625, 0.875] : [0.25, 0.75]) {
    for (const side of [-1, 1]) {
      const p = onBlock(b, side * (hw(u) + 0.25), u, rail + (rapide ? 1.4 : 1.0));
      c.lumineux.box(p[0] - 0.13, p[1], p[2] - 0.13, p[0] + 0.13, p[1] + 0.12, p[2] + 0.13, 0xffb000);
    }
  }
}

/** Couleurs des maillots dans les tribunes. */
const MAILLOTS = [MARQUE.livree, 0x2e7dff, MARQUE.moutarde, 0xf4f4f4, 0x21a35a, 0xc084fc, 0xe8283a];

/**
 * La tribune du départ (celle de B) : gradins, toit sur poteaux, sponsors, socle plein jusqu'au sol. Les spectateurs sont tirés **de la même
 * façon** à tous les paliers (le reste du décor ne bouge pas) ; ils sont dessinés dans le décor, ou confiés à la foule animée (palier 3, `foule`).
 * Palier 2 : des drapeaux sur le toit ; palier 3 : un ruban d'écrans à diodes sur le devant.
 */
export function tribuneP(c: Calques, x: Contexte, b: Block, rnd: () => number) {
  const hw = blockHalfWidth(b, CELL / 2);
  const r = repereBloc(b, 16, hw + 4.2);
  boite(c.decor, r, 0, 8.5, x.floorY - b.y0, 0.2, -11, 11, BETON);
  for (let i = 0; i < 3; i++) {
    const g0 = i * 2.4;
    boite(c.decor, r, g0, 8.5, 0, 1 + i * 1.2, -11, 11, shade(BETON, 1 - i * 0.04));
    for (let a = -10.5; a < 10.5; a += 0.75) {
      if (rnd() < 0.15) continue;
      // Un spectateur tourné vers la piste : léger décalage, taille, maillot, peau (cinq tirages, comme `foule` de B).
      const rr: Repere = { o: pt(r, g0 + 1.2, 1 + i * 1.2, a), f: [-r.l[0], 0, -r.l[2]], l: r.f };
      const gx = (rnd() - 0.5) * 0.3;
      const da = (rnd() - 0.5) * 0.6;
      const t = 1.5 + rnd() * 0.25;
      const maillot = MAILLOTS[Math.floor(rnd() * MAILLOTS.length)]!;
      const peau = PEAU[Math.floor(rnd() * PEAU.length)]!;
      if (c.foule) {
        const p = pt(rr, gx, 0, da);
        c.foule.push({ x: p[0], y: p[1], z: p[2], cap: Math.atan2(rr.f[0], rr.f[2]), couleur: maillot });
      } else {
        boite(c.decor, rr, gx - 0.22, gx + 0.22, 0, t - 0.35, da - 0.14, da + 0.14, maillot);
        boite(c.decor, rr, gx - 0.13, gx + 0.13, t - 0.33, t, da - 0.12, da + 0.12, peau);
      }
    }
  }
  for (const a of [-10.6, 0, 10.6]) boite(c.decor, r, 8.05, 8.35, 0, 7.6, a - 0.15, a + 0.15, METAL_SOMBRE);
  boiteChanfreinee(c.decor, r, -0.8, 8.6, 7.6, 8.0, -11.4, 11.4, 0.1, MARQUE.livree);
  const logos = SPONSORS[x.palette];
  for (let i = 0; i < 4; i++) c.affiches.quad(pt(r, -0.85, 7.6, -11 + i * 5.5), pt(r, -0.85, 7.6, -11 + (i + 1) * 5.5 - 0.3), pt(r, -0.85, 8.0, -11 + (i + 1) * 5.5 - 0.3), pt(r, -0.85, 8.0, -11 + i * 5.5), rect(logos[i % logos.length]!));
  if (c.drapeaux) {
    for (const a of [-10.6, 0, 10.6]) {
      const haut = pt(r, 8.2, 8.0, a);
      c.decor.box(haut[0] - 0.04, haut[1], haut[2] - 0.04, haut[0] + 0.04, haut[1] + 2.4, haut[2] + 0.04, METAL);
      c.drapeaux.drapeau([haut[0], haut[1] + 2.35, haut[2]], VENT, 1.4, 0.9, [a === 0 ? MARQUE.livree : 0x2e7dff, 0xf4f4f4], a * 0.7);
    }
  }
  // Le ruban d'écrans sur le devant de la tribune (palier 3, `vie.ts` le fait défiler).
  if (x.reglages?.ecrans && c.ecrans) c.ecrans.quad(pt(r, -0.03, 0.2, 10.5), pt(r, -0.03, 0.2, -10.5), pt(r, -0.03, 0.95, -10.5), pt(r, -0.03, 0.95, 10.5), [0, 0, 21 / 0.75 / RUBAN_RAPPORT, 1]);
}

/** Rapport largeur / hauteur du ruban des écrans (`vie.ts`) : pour qu'un écran de L × H m garde ses lettres droites, u va de 0 à (L / H) / RAPPORT. */
export const RUBAN_RAPPORT = 16;

/** Les panneaux à diodes le long de la ligne droite du départ, posés sur les rebords (palier 3, pas « écrans »). */
function ecransDuDepart(c: Calques, x: Contexte) {
  const b = x.track.blocks[0]!;
  if (!c.ecrans || b.open) return;
  const rail = x.pal.wallHeight ?? WALL_HEIGHT;
  for (const side of [-1, 1]) {
    const hw = blockHalfWidth(b, CELL / 2);
    const p0 = onBlock(b, side * (hw + 0.2), 0.12, rail + 0.05);
    const p1 = onBlock(b, side * (hw + 0.2), 0.62, rail + 0.05);
    const L = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    const H = 0.8;
    const [a, d] = side > 0 ? [p1, p0] : [p0, p1];
    c.ecrans.quad(a, d, [d[0], d[1] + H, d[2]], [a[0], a[1] + H, a[2]], [0, 0, L / H / RUBAN_RAPPORT, 1]);
    // Le dos des écrans (un caisson sombre) : ils ne sont pas des feuilles.
    c.solide.box(Math.min(p0[0], p1[0]) - 0.05, p0[1] - 0.05, Math.min(p0[2], p1[2]) - 0.05, Math.max(p0[0], p1[0]) + 0.05, p0[1], Math.max(p0[2], p1[2]) + 0.05, METAL_SOMBRE);
  }
}

/**
 * Le décor (à la demande dans le jeu) : la tribune du départ, le décor de B allégé (une place sur deux près de la piste, une par cellule plus
 * loin ; la Ville garde sa densité). Palier 2, « variété » : chaque instance tourne un peu, change de taille, de teinte, s'use (une autre suite
 * que celle du décor : il reste à sa place).
 */
export function decorP(c: Calques, x: Contexte, rnd: () => number) {
  tribuneP(c, x, x.track.blocks[0]!, rnd);
  if (x.reglages?.ecrans) ecransDuDepart(c, x);
  const recette = RECETTES_B[x.palette];
  const proche = x.palette === "ville" ? 0.85 : 0.5;
  const varie = x.reglages?.variete ? x.varie : undefined;
  for (const p of placesDeDecor(x.track, rnd, (anneau) => (anneau === 1 ? (rnd() < proche ? 1 : 0) : 1))) {
    const m = varie ? marque(c) : null;
    recette(c, x, p, rnd);
    if (m && varie) varierInstance(c, m, p.x, x.floorY, p.z, varie);
  }
}

/**
 * La route sous une lumière chaude (palier 1) : sous le soleil orangé du Canyon, doré de la Campagne ou ocre du Rallye (lumière de C), le gris
 * chaud de A virait au brun (on le voyait sur les captures du lot 38) — contraire à la règle « la route est un gris ». Un gris légèrement bleuté
 * compense la lumière : la route reste plus froide et plus sombre que le sable et la terre.
 */
export const ROUTE_SOUS_LUMIERE_CHAUDE: Partial<Record<PaletteName, [number, number]>> = { desert: [0x5a6372, 0x56606e], canyon: [0x55637e, 0x515f7a], campagne: [0x606670, 0x5c626c] };

/** La direction des paliers (le mélange nettoyé) : un lot de mise en œuvre la reprend telle quelle. */
export const DIRECTION_P: Direction = /* @__PURE__ */ (() => ({
  ...DIRECTION_A,
  id: "M",
  nom: "Paliers (mélange nettoyé)",
  materiau: "standard",
  palette: (nom, base) => {
    const p = DIRECTION_A.palette(nom, base);
    const route = ROUTE_SOUS_LUMIERE_CHAUDE[nom];
    return route ? { ...p, road: route } : p;
  },
  ambiance: (nom, pal, look) => {
    const amb = ambianceDOrigine(pal, look);
    return { ...amb, silhouettes: { ...amb.silhouettes, forme: HORIZONS[nom] } };
  },
  route: (nom) => routeP(nom),
  portiqueDepart: portiqueDepartP,
  arrivee: arriveeP,
  porte: porteB,
  plaque: DIRECTION_A.plaque,
  turbo: DIRECTION_A.turbo,
  coupure: DIRECTION_A.coupure,
  panneau: panneauP,
  rythme: rythmeP,
  atlas: atlasB,
  decor: decorP,
}))();
