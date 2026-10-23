// Le décor du palier 1 de la vitrine (retouche 38b) et la direction des paliers (`DIRECTION_P`) : la tribune du départ, le décor de B allégé, les
// écrans du départ (palier 3). **Pas dans le jeu** : le décor du palier 1 est le lot suivant (« décor 3D à la demande ») ; le jeu garde le décor
// d'aujourd'hui (`decorGeometry`, trackMesh.ts). Lot 43 : séparé de `palier1.ts` (premier chargement), qui ne tire plus ni B ni `finition.ts`.
import { CELL, WALL_HEIGHT, blockHalfWidth, type Block } from "@cdj/sim";
import { shade } from "../meshKit";
import { ambianceDOrigine, placesDeDecor } from "./composer";
import { DIRECTION_A } from "./directionA";
import { METAL, METAL_SOMBRE, PEAU, RECETTES_B, SPONSORS, rect } from "./directionB";
import { marque, varierInstance } from "./finition";
import { boite, boiteChanfreinee, pt, repereBloc, type Repere } from "./outils";
import { MARQUE } from "./pieces";
import { onBlock } from "./route";
import { VENT, arriveeP, coupureP, panneauP, paletteP1, plaqueP, porteP, portiqueDepartP, routeP, rythmeP, turboP } from "./palier1";
import { atlasSponsors } from "./sponsors";
import { RUBAN_RAPPORT, ecransDuDepart } from "./vie";

/** Béton des socles. */
const BETON = 0xb9bbbe;
import { HORIZONS, type Calques, type Contexte, type Direction } from "./types";

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
  if (x.reglages?.ecrans && c.ecrans) c.ecrans.quad(pt(r, -0.03, 0.2, -10.5), pt(r, -0.03, 0.2, 10.5), pt(r, -0.03, 0.95, 10.5), pt(r, -0.03, 0.95, -10.5), [0, 0, 21 / 0.75 / RUBAN_RAPPORT, 1]);
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

/** La direction des paliers (le mélange nettoyé) : les éléments de course du palier 1 (`palier1.ts`, ceux du jeu) et le décor de la vitrine. */
export const DIRECTION_P: Direction = /* @__PURE__ */ (() => ({
  ...DIRECTION_A,
  id: "M",
  nom: "Paliers (mélange nettoyé)",
  materiau: "standard",
  palette: paletteP1,
  ambiance: (nom, pal, look) => {
    const amb = ambianceDOrigine(pal, look);
    return { ...amb, silhouettes: { ...amb.silhouettes, forme: HORIZONS[nom] } };
  },
  route: (nom) => routeP(nom),
  portiqueDepart: portiqueDepartP,
  arrivee: arriveeP,
  porte: porteP,
  plaque: plaqueP,
  turbo: turboP,
  coupure: coupureP,
  panneau: panneauP,
  rythme: rythmeP,
  // Les éléments de course portent les sponsors du jeu (`sponsors.ts`) ; le décor de la vitrine garde l'atlas de B (`atlasDecor`).
  atlas: atlasSponsors,
  decor: decorP,
}))();
