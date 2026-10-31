import { decoderRediffusion, encoderRediffusion, enregistrer, type Partie, type Rapier, type Rediffusion, rejouerParTranches, type Scenario } from "@cdj/tower-sim";
import type { Fantome, FantomePiece } from "./fantomeLocal";

// Le rejeu du fantôme local (lot T2) — **chargé à la demande** (`import()` à la fin d'une partie) : l'enregistrement, l'encodage et le rejeu de la rediffusion n'ont aucune raison de peser
// sur le premier chargement (budget `tower.jsCss`). La mémoire du fantôme (`MemoireFantome`) reste dans `fantomeLocal.ts`.

/** Les commandes d'une partie finie, copiées tout de suite (la partie est détruite dès qu'on rejoue). */
export type Enregistrement = Pick<Partie, "commandesJouees" | "scenario" | "reglages">;

/** L'enregistrement d'une partie finie (`enregistrer` de `@cdj/tower-sim`), pour que `jeu.ts` n'importe rien d'autre que ce module à la demande. */
export { enregistrer };

/** Relit une rediffusion gardée dans le navigateur (`tower:records`) : lève `ErreurRediffusion` si elle ne se relit plus (autre version, texte abîmé) — l'appelant l'ignore. */
export const lireRediffusion = (texte: string): Rediffusion => decoderRediffusion(texte);

/** Le fantôme d'une partie finie : sa rediffusion ; la silhouette viendra de `silhouetteDe`. */
export function fantomeDe(rediffusion: Rediffusion, resultat: { hauteurMm: number; vies: number; ticks: number }): Fantome {
  return { hauteurMm: resultat.hauteurMm, vies: resultat.vies, ticks: resultat.ticks, rediffusion, code: encoderRediffusion(rediffusion), pieces: null };
}

/** Rend la main au navigateur (entre deux tranches de ticks). */
const respirer = (): Promise<void> => new Promise((fini) => setTimeout(fini, 0));

/** La silhouette d'une rediffusion : les pièces encore sur la tour à la fin de la partie REJOUÉE sur `contenu`, tranche par tranche. */
export async function silhouetteDe(R: Rapier, contenu: Scenario, rediffusion: Rediffusion): Promise<FantomePiece[]> {
  const g = rejouerParTranches(R, contenu, rediffusion);
  for (;;) {
    const n = g.next();
    if (n.done) return n.value.vue.pieces.filter((p) => p.etat === "libre").map((p) => ({ kind: p.kind, rot: p.rot, taille: p.taille, x: p.x, y: p.y, angle: p.angle }));
    await respirer();
  }
}

