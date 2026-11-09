import { buildFigure, type Figure } from "./figures";
import { combinaison, classerSauts, sautDansLAxe, type SautClasse } from "./sautsClasse";
import { parseTrack, type WidthLetter } from "./track";

// Lot 57b (générateur v23) : ce qu'une figure fait du point de vue de la grammaire des sauts — combien de ses sauts sont « ligne droite → tremplin → réception dans l'axe », quelles
// combinaisons elle pose, combien de gestes elle demande (la technicité, que le budget d'un circuit additionne). Tout est lu sur la figure posée seule dans un cadre d'essai (cinq
// droites avant, deux après), sur ses variantes : un rangement de la figure seule, pas celui d'un circuit précis (le circuit fini est vérifié, `fauteSauts`, generator.ts). Pur, mis en cache.

/** Le circuit d'essai d'une figure (même cadre que `createFigureTrack`, mais à la largeur et au sens donnés), ou `null` si la variante est impossible. */
function cadre(f: Figure, left: boolean, width: WidthLetter, variant: number) {
  const body = buildFigure(f, left, width, variant);
  if (!body) return null;
  return parseTrack(`technicite-${f.name}`, [`S/${width}@start`, "S", "S", "S", "S", "S", ...(body[0] === "S" ? body.slice(1) : body), "S", "S@finish"].join(" "));
}

const classes = new Map<string, SautClasse[][]>();
/**
 * Les sauts de la figure, rangés par parties, pour chaque variante qui se construit (route normale, premier virage à gauche — le miroir et la largeur ne changent pas le rangement ;
 * route large puis étroite si la normale est impossible) ; aucun pour une figure sans saut (`jump` faux).
 */
export function sautsDeLaFigure(f: Figure): SautClasse[][] {
  let out = classes.get(f.name);
  if (!out) {
    out = [];
    if (f.jump)
      for (let v = 0; v < f.variants; v++) {
        const t = cadre(f, true, "n", v) ?? cadre(f, true, "l", v) ?? cadre(f, true, "e", v);
        if (t) out.push(classerSauts(t));
      }
    classes.set(f.name, out);
  }
  return out;
}

/** Le plus de sauts « droite → tremplin → axe » que la figure peut poser (au pire de ses variantes) et le moins (au mieux : une variante qui n'en pose aucun suffit). */
export function sautsDansLAxe(f: Figure): { min: number; max: number } {
  const n = sautsDeLaFigure(f).map((l) => l.filter(sautDansLAxe).length);
  return n.length ? { min: Math.min(...n), max: Math.max(...n) } : { min: 0, max: 0 };
}

/** Les gestes qu'un saut demande en plus du tremplin droit : approche, appel, vol, réception, sortie (sans compter une réception « plus basse », qui ne demande que de la vitesse). */
export const gestesDuSaut = (s: SautClasse): number =>
  (s.approche !== "droite" ? 1 : 0) + (s.appel !== "plat" ? 1 : 0) + (s.vol !== "axe" ? 1 : 0) + s.reception.filter((r) => r !== "axe" && r !== "basse").length + (s.sortie !== "droite" ? 1 : 0);

/** La technicité d'une figure : celle qu'elle déclare (la grammaire), sinon la somme des gestes de ses sauts (le pire de ses variantes). */
export function technicite(f: Figure): number {
  if (f.technicite !== undefined) return f.technicite;
  return Math.max(0, ...sautsDeLaFigure(f).map((l) => l.reduce((n, s) => n + gestesDuSaut(s), 0)));
}

/** Les combinaisons de la figure sur sa première variante, route normale, premier virage à gauche : sert à refuser deux sauts de même combinaison avant de poser quoi que ce soit. */
export function combinaisonsDeBase(f: Figure): string[] {
  const t = cadre(f, true, "n", 0) ?? cadre(f, true, "l", 0) ?? cadre(f, true, "e", 0);
  return t ? classerSauts(t).map(combinaison) : [];
}
