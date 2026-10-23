// Lot 40c — les détails communs des voitures au standard (standard.md § 2) : rétroviseur sur son pied, poignées, calandre à ailettes, plaque vierge. Chaque plan les place où il veut
// (coordonnées de la voiture : +z devant, +x à gauche) ; tout est dans le maillage de la caisse. Rendu seul.
import { boite, cle, pave } from "./forme";
import type { Contexte } from "./modele";
import { ellipsoide } from "./surfaces";
import type { Pieces } from "./pieces";

/** Les bornes (x0 ≤ x1) d'une pièce du côté `s` (+1 à gauche) à partir de bornes données pour le côté gauche. */
export const cote = (s: number, a: number, b: number): [number, number] => (s > 0 ? [a, b] : [-b, -a]);

/**
 * Un rétroviseur attaché par son pied à la portière : un pied sombre fixé au coin de la vitre (`pied` : x intérieur, x extérieur, y bas, y haut, z), une coque ovale peinte
 * (`coque` : centre et rayons) et la glace sombre sur sa face arrière. Aucun cube qui flotte.
 */
export function retroviseur(p: Pieces, c: Contexte, s: number, o: { pied: [number, number, number, number, number]; centre: [number, number, number]; rayons: [number, number, number] }): void {
  const [x0, x1, y0, y1, z] = o.pied;
  pave(p, ...cote(s, x0, x1), y0, y1, z - 0.04, z + 0.04, c.m.cadre);
  ellipsoide(p, [s * o.centre[0], o.centre[1], o.centre[2]], o.rayons, c.palier === 1 ? 8 : 14, c.palier === 1 ? 5 : 8, c.m.peinture);
  const [cx, cy, cz] = o.centre;
  const [rx, ry, rz] = o.rayons;
  pave(p, ...cote(s, cx - rx * 0.9, cx + rx * 0.8), cy - ry * 0.55, cy + ry * 0.55, cz - rz - 0.004, cz - rz + 0.004, c.m.noir);
}

/** Une poignée de portière (un fond sombre et la poignée) à la hauteur `y`, centrée en `z`, sur un flanc dont la tôle est à `x` (côté gauche). */
export function poignee(p: Pieces, c: Contexte, s: number, z: number, y: number, x: number, longueur = 0.2): void {
  pave(p, ...cote(s, x - 0.005, x + 0.042), y - 0.022, y + 0.022, z - longueur / 2, z + longueur / 2, c.m.cadre);
  pave(p, ...cote(s, x, x + 0.052), y - 0.012, y + 0.013, z - longueur / 2 + 0.02, z + longueur / 2 - 0.02, c.m.peinture);
}

/** Une calandre ou une prise d'air : un fond sombre et `n` ailettes horizontales claires (1 cm), contre une face verticale tournée vers `sens` (+1 avant, −1 arrière) en `z`. */
export function ailettes(p: Pieces, c: Contexte, x0: number, x1: number, y0: number, y1: number, z: number, n: number, sens = 1): void {
  const a = sens > 0 ? z - 0.03 : z - 0.006;
  const b = sens > 0 ? z + 0.006 : z + 0.03;
  pave(p, x0, x1, y0, y1, a, b, c.m.cadre);
  for (let k = 0; k < n; k++) {
    const y = y0 + ((k + 0.5) * (y1 - y0)) / n - 0.006;
    pave(p, x0 + 0.02, x1 - 0.02, y, y + 0.012, sens > 0 ? z - 0.01 : z - 0.002, sens > 0 ? z + 0.014 : z + 0.01, c.m.grille);
  }
}

/** Une plaque minéralogique vierge (cadre sombre, fond crème) ; `sens` = +1 à l'avant, −1 à l'arrière. */
export function plaque(p: Pieces, c: Contexte, y: number, z: number, sens: number): void {
  const z0 = sens > 0 ? z : z - 0.015;
  pave(p, -0.26, 0.26, y - 0.065, y + 0.065, z0, z0 + 0.015, c.m.noir);
  pave(p, -0.24, 0.24, y - 0.05, y + 0.05, sens > 0 ? z0 + 0.012 : z0 - 0.004, sens > 0 ? z0 + 0.018 : z0 + 0.004, c.m.creme);
}

/** Un montant (de vitre ou central) : un tronc de pyramide sombre posé sur la vitre latérale, entre `z0` et `z1`, de `y0` (demi-largeur `w0`) à `y1` (`w1`). */
export function montant(p: Pieces, c: Contexte, y0: number, w0: number, z0: number, z1: number, y1: number, w1: number): void {
  boite(p, y0, w0, z0, z1, y1, w1, z0, z1, c.m.cadre);
}

type P2 = [number, number];
/**
 * Une section de capot, de coffre ou de poupe presque plate (lot 40c, retour de Nathan sur la Sparrow) : l'aile (`epaule`, la ceinture vive) peut être plus haute que le capot (`haut`, au bord de sa
 * bombe d'un centimètre) : les ailes forment des bosses au-dessus des roues, la roue ne traverse jamais la tôle. Le haut de la roue est à 0,76 m : une aile à 0,83 m et plus.
 */
export const capotPlat = (z: number, b: number, seuil: P2, flanc: P2, epaule: P2, haut: number) =>
  cle(z, { bas: b, seuil, flanc, epaule, vitre: [epaule[0] - 0.06, epaule[1] + (haut - epaule[1]) * 0.4], toit: [epaule[0] * 0.66, haut], dessus: haut + 0.012 });
