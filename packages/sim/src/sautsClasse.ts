import { CELL, blockSlope, isCurve, turnsLeft, type Block, type Track } from "./track";

// Lot 57 : la grammaire des sauts, vue par la mesure. Chaque saut d'un circuit (une rampe suivie d'un vide) se range selon ses cinq parties —
// approche, appel, vol, réception, sortie — et la source de sa vitesse ; chaque raccord entre deux blocs, selon ce qui change (pente, dévers,
// largeur, revêtement, hauteur en virage, cuve). Pur et sans effet : la mesure (`scripts/mesure-sauts.ts`), les tests et le générateur le lisent.

export type Approche = "droite" | "virage" | "descente" | "chicane";
export type Appel = "plat" | "devers" | "bosse" | "cuve" | "marche" | "virage";
export type Vol = "axe" | "tournant";
export type Reception = "axe" | "decalee" | "angle" | "basse" | "haute" | "virage" | "surface" | "etroite";
export type Sortie = "droite" | "virage" | "chicane";
export type Elan = "boost" | "elan";

export interface SautClasse {
  /** Indice du bloc d'appel (la rampe). */
  appelBloc: number;
  approche: Approche;
  appel: Appel;
  vol: Vol;
  /** Une ou plusieurs étiquettes (« basse » et « surface » peuvent aller ensemble) ; « axe » seule = rien de particulier. */
  reception: Reception[];
  sortie: Sortie;
  vitesse: Elan;
}

const isGap = (b: Block | undefined) => b?.kind === "gap";
const isPush = (b: Block) => b.kind === "boost" || b.kind === "turbo";
/** Un bloc d'appel : la rampe `K` (et ses formes du lot 57 : rampe en dévers, virage-tremplin), une montée suivie d'un vide (appel sur une crête). */
export const isAppel = (b: Block, next: Block | undefined): boolean => isGap(next) && b.kind !== "gap";

function appelOf(b: Block, prev: Block | undefined): Appel {
  if (isCurve(b.kind)) return "virage";
  if (b.tilt) return "devers";
  if (b.kind === "up" || b.kind === "bump") return "bosse";
  if (b.ramp) return "virage";
  if (prev && prev.cuve) return "cuve";
  if (b.kind === "kick" || b.kind === "jump") return "plat";
  return "marche";
}

/** L'approche : ce que font les trois blocs (≈ 100 m, 2 s) avant l'appel. */
function approcheOf(blocks: readonly Block[], k: number): Approche {
  const avant = blocks.slice(Math.max(0, k - 3), k);
  const virages = avant.filter((b) => isCurve(b.kind));
  if (virages.length >= 2 && virages.some((v) => turnsLeft(v.kind)) && virages.some((v) => !turnsLeft(v.kind))) return "chicane";
  if (virages.length > 0) return "virage";
  if (avant.some((b) => b.kind === "down" || b.tilt)) return "descente";
  return "droite";
}

/** Les sauts d'un circuit, rangés par parties. */
export function classerSauts(track: Track): SautClasse[] {
  const blocks = track.blocks;
  const out: SautClasse[] = [];
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k]!;
    if (!isAppel(b, blocks[k + 1])) continue;
    let i = k + 1;
    let rise = 0;
    while (isGap(blocks[i])) rise += blocks[i++]!.rise;
    const land = blocks[i];
    const reception: Reception[] = [];
    if (land) {
      // Un appel qui fait tourner la trajectoire ou la caisse (dévers, virage-tremplin) : la voiture arrive décalée, ou de biais sur un virage.
      const tourne = !!b.tilt || !!b.ramp;
      if (tourne && !isCurve(land.kind)) reception.push("decalee");
      if (rise < 0) reception.push("basse");
      if (rise > 0) reception.push("haute");
      if (isCurve(land.kind)) reception.push(tourne ? "angle" : "virage");
      if (land.surface !== b.surface) reception.push("surface");
      for (let j = i; j < Math.min(blocks.length, i + 3); j++) if (blocks[j]!.w1 < blocks[j]!.w0) reception.push("etroite");
    }
    if (reception.length === 0) reception.push("axe");
    // Sortie : ce qui vient dans les deux blocs (64 m) qui suivent la réception.
    let sortie: Sortie = "droite";
    const apres = blocks.slice(i, i + 3).filter((x) => isCurve(x.kind));
    const debut = land && isCurve(land.kind) ? 1 : 0;
    const suite = apres.slice(debut);
    if (suite.length >= 2 && turnsLeft(suite[0]!.kind) !== turnsLeft(suite[1]!.kind)) sortie = "chicane";
    else if (suite.length >= 1) sortie = "virage";
    const elan = blocks.slice(Math.max(0, k - 5), k + 1).some(isPush) ? "boost" : "elan";
    out.push({ appelBloc: k, approche: approcheOf(blocks, k), appel: appelOf(b, blocks[k - 1]), vol: b.ramp || b.tilt ? "tournant" : "axe", reception: [...new Set(reception)], sortie, vitesse: elan });
  }
  return out;
}

/** Le saut « ligne droite → tremplin plat → réception dans l'axe » (même plus bas ou plus haut) : celui dont Nathan dit qu'il est partout. */
export const sautDansLAxe = (s: SautClasse): boolean =>
  s.approche === "droite" && s.appel === "plat" && s.vol === "axe" && s.reception.every((r) => r === "axe" || r === "basse" || r === "haute");
/** Le même, au sens strict : réception au même niveau, rien d'autre. */
export const sautDansLAxeStrict = (s: SautClasse): boolean => sautDansLAxe(s) && s.reception.length === 1 && s.reception[0] === "axe";

/** La combinaison d'un saut, en une clé (deux sauts consécutifs d'un circuit n'ont jamais la même, à partir de la grammaire). */
export const combinaison = (s: SautClasse): string => `${s.approche}|${s.appel}|${s.vol}|${s.reception.join("+")}|${s.sortie}`;

// --- Transitions ------------------------------------------------------------------------------

export type Transition = "pente-crete" | "pente-creux" | "devers" | "largeur" | "surface" | "virage-pente" | "cuve" | "rebords";

export interface TransitionClasse {
  /** Le raccord est entre les blocs `bloc` et `bloc + 1` (une transition de largeur : dans le bloc `bloc`). */
  bloc: number;
  kind: Transition;
}

/** Ce qui change d'un bloc au suivant (hors sauts : une rampe et son vide ne sont pas une transition). */
export function classerTransitions(track: Track): TransitionClasse[] {
  const blocks = track.blocks;
  const out: TransitionClasse[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i]!;
    if (a.w0 !== a.w1) out.push({ bloc: i, kind: "largeur" });
    const b = blocks[i + 1];
    if (!b || a.kind === "gap" || b.kind === "gap") continue;
    const sa = blockSlope(a, CELL);
    const sb = blockSlope(b, 0);
    const pa = a.kind === "kick" || a.kind === "jump" ? 0 : sa;
    if (Math.abs(sb - pa) > 1e-6 && !isCurve(a.kind) && !isCurve(b.kind)) out.push({ bloc: i, kind: sb < pa ? "pente-crete" : "pente-creux" });
    if ((isCurve(a.kind) && (b.kind === "up" || b.kind === "down")) || (isCurve(b.kind) && (a.kind === "up" || a.kind === "down")) || (isCurve(a.kind) && a.rise !== 0) || (isCurve(b.kind) && b.rise !== 0)) out.push({ bloc: i, kind: "virage-pente" });
    if (a.banked !== b.banked || !!a.tilt !== !!b.tilt) out.push({ bloc: i, kind: "devers" });
    if (a.surface !== b.surface) out.push({ bloc: i, kind: "surface" });
    if ((a.cuve > 0) !== (b.cuve > 0)) out.push({ bloc: i, kind: "cuve" });
    if (a.open !== b.open) out.push({ bloc: i, kind: "rebords" });
  }
  return out;
}
