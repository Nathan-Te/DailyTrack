import { mixSeed, Rng } from "@cdj/core";
import { BONUS_PLATEAU_VIDE, COLONNES, PLAFOND_PIECES, POINTS_EFFACEMENT, POSES_SANS_EFFACEMENT_MAX, RAMPE_PAR_DEFAUT_V1, type Rampe } from "./constantes";
import { anciensTirages } from "./generateur";
import { rejeuxAnciens } from "./rediffusion";
import { graineDuJour } from "./suite";
import { compterPleines, effacer, estVide, type Grille, peutPoser, pleines, poser, tientQuelquePart, VIDE } from "./grille";
import { PIECES, type Piece } from "./pieces";
import type { Resultat } from "./partie";

// LES RÈGLES V1 (une pièce à la fois, une pièce suivante montrée ; tirage v3) — **gelées, uniquement pour REJOUER un jour figé en v1** (lot B8). Rien de ceci ne sert à jouer : le jeu joue les règles v2 (`partie.ts`).
// Si un jour a été figé (fichier de jour) avec `sim` 1 et `g` 3, le serveur continue de le servir en v1 et de rejouer ses rediffusions ici, au bit près de ce qu'elles valaient ; ses seuils sont ceux du fichier.
// Le tirage v3 garde les poids de base d'alors (`POIDS_V3`, indexés par le nom de la famille de pièces) : changer ceux du catalogue (`pieces.ts`) ne change rien ici.

/** Les poids de base du tirage v3, par nom de pièce sans son orientation (le même que `DEFINITIONS` de `pieces.ts` avant le lot B8). */
const POIDS_V3: Readonly<Record<string, number>> = { domino: 8, barre3: 12, barre4: 5, barre5: 3, carre2: 6, carre3: 2, coin: 14, l: 4, grandl: 2, t: 4, grandt: 2, s: 3, z: 3, rect: 2 };
const poidsDeBase = (p: Piece): number => POIDS_V3[p.nom.replace(/-\d+$/, "")] ?? 0;
const RANGS_SANS_TRES_GROSSE_V1 = 6;
const ECHELLE = 100;

function poidsAuRangV1(p: Piece, rang: number, precedente: Piece | null, rampe: Rampe): number {
  if (rang < RANGS_SANS_TRES_GROSSE_V1 && p.tresGrosse) return 0;
  if (p.boite33 && precedente?.boite33) return 0;
  return poidsDeBase(p) * (ECHELLE + rampe.pente * p.grosseur * Math.min(rang, rampe.rangMax));
}

/** La suite du tirage v3 (une pièce par rang), telle que l'a servie le lot B3. */
export function genererSuiteV3(graine: number, rampe: Rampe = RAMPE_PAR_DEFAUT_V1, n: number = PLAFOND_PIECES): number[] {
  const suite: number[] = [];
  let avant: Piece | null = null;
  for (let rang = 0; rang < n; rang++) {
    let total = 0;
    for (const p of PIECES) total += poidsAuRangV1(p, rang, avant, rampe);
    let reste = new Rng(mixSeed(graine, rang)).int(total);
    for (const p of PIECES) {
      const w = poidsAuRangV1(p, rang, avant, rampe);
      if (reste < w) {
        avant = p;
        break;
      }
      reste -= w;
    }
    suite.push(avant!.id);
  }
  return suite;
}

/** Rejoue une partie v1 : les actions sont `ligne × 8 + colonne`, une pose de la pièce du moment ; mêmes refus que le rejeu v2 (`null` + message en cas d'erreur, jamais d'exception). */
export function jouerV1(contenu: { suite: readonly number[]; depart?: Grille }, actions: readonly number[]): { resultat: Resultat } | { erreur: "action_illegale" | "apres_la_fin" | "non_terminee" | "trop_longue"; message: string } {
  if (actions.length > PLAFOND_PIECES) return { erreur: "trop_longue", message: "trop de poses" };
  let g: Grille = contenu.depart ?? VIDE;
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let sans = 0;
  let rang = 0;
  const fini = (): boolean => rang >= PLAFOND_PIECES || !tientQuelquePart(g, PIECES[contenu.suite[rang]!]!);
  for (let i = 0; i < actions.length; i++) {
    if (fini()) return { erreur: "apres_la_fin", message: `action ${i} après la fin de la partie` };
    const a = actions[i]!;
    const p = PIECES[contenu.suite[rang]!]!;
    const col = a % COLONNES;
    const ligne = Math.floor(a / COLONNES);
    if (!Number.isInteger(a) || a < 0 || a >= 64 || !peutPoser(g, p, col, ligne)) return { erreur: "action_illegale", message: `action ${i} illégale` };
    g = poser(g, p, col, ligne);
    const m = pleines(g);
    const n = compterPleines(m);
    let gain = p.cases;
    if (n > 0) {
      g = effacer(g, m.lignes, m.colonnes);
      combo++;
      gain += POINTS_EFFACEMENT * n * n * combo;
      sans = 0;
      if (estVide(g)) gain += BONUS_PLATEAU_VIDE;
      if (combo > comboMax) comboMax = combo;
    } else if (++sans >= POSES_SANS_EFFACEMENT_MAX && combo > 0) combo = 0;
    score += gain;
    rang++;
  }
  if (!fini()) return { erreur: "non_terminee", message: "la partie n'est pas terminée" };
  return { resultat: { score, combo: comboMax, poses: rang, raison: rang >= PLAFOND_PIECES ? "plafond" : "bloquee" } };
}

/**
 * **Active les règles v1** : le tirage v3 (`dailyBlocks(jour, 3)`) et le rejeu v1 (`rejouer` sur un jour de tirage 3). Le serveur l'appelle au démarrage ; **le jeu ne l'appelle jamais** (il ne sait pas jouer les règles v1, et ce code ne doit pas
 * entrer dans son premier chargement). Idempotent. Une fonction exportée plutôt qu'un effet de bord d'import : le paquet est `sideEffects: false`, un import sans usage serait retiré d'un lot.
 */
export function activerReglesV1(): void {
  anciensTirages.set(3, (jour) => genererSuiteV3(graineDuJour(jour)));
  rejeuxAnciens.set(1, jouerV1);
}
