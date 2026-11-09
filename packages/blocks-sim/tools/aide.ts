import { daysFromCivil } from "@cdj/core";
import { type ReglageSaisi, RAMPE_PAR_DEFAUT, REGLAGE_PAR_DEFAUT } from "../src/index";
import { jouerDiamant, LARGEUR_FAISCEAU } from "../src/diamant";
import { jouerFaible } from "../src/faible";
import { jouerGlouton } from "../src/glouton";
import type { ContenuJouable } from "../src/generateur";
import { completeUneLigne, piecesPosables, TAILLE_SERIE, Partie, type Grille, type Piece, serieAuRang, resoudreReglage } from "../src/index";

// Aide commune aux outils de mesure du lot B8c : les arguments d'adresse (`--nom=valeur`), le réglage du tirage, les bots, et l'observation d'une partie série par série.

export const arg = (n: string): string | undefined => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
export const nombre = (n: string, d: number): number => Number(arg(n) ?? d);
export const liste = (n: string, d: readonly number[]): number[] => (arg(n)?.split(",").map(Number) ?? [...d]);

/** Le réglage du tirage lu des arguments : `--essais=40 --pente=1 --rangmax=80 --posable=25,100,60 --pouce=60,45,80`. */
export function reglageDesArguments(): ReglageSaisi {
  const [jusqua, rang, pct] = liste("posable", [REGLAGE_PAR_DEFAUT.posable.jusqua, REGLAGE_PAR_DEFAUT.posable.rang, REGLAGE_PAR_DEFAUT.posable.pct]);
  const [p, pFin, pRang] = liste("pouce", [REGLAGE_PAR_DEFAUT.pouce.pct, REGLAGE_PAR_DEFAUT.pouce.pctFin, REGLAGE_PAR_DEFAUT.pouce.rang]);
  return {
    rampe: { pente: nombre("pente", RAMPE_PAR_DEFAUT.pente), rangMax: nombre("rangmax", RAMPE_PAR_DEFAUT.rangMax), apres: nombre("apres", RAMPE_PAR_DEFAUT.apres ?? 0) },
    essais: nombre("essais", REGLAGE_PAR_DEFAUT.essais),
    posable: { jusqua: jusqua!, rang: rang!, pct: pct! },
    pouce: { pct: p!, pctFin: pFin!, rang: pRang! },
  };
}

export const premierJour = (): number => {
  const du = arg("du");
  return du ? daysFromCivil(Number(du.slice(0, 4)), Number(du.slice(5, 7)), Number(du.slice(8, 10))) : daysFromCivil(2026, 11, 2);
};

export type NomBot = "faible" | "moyen" | "diamant";
export const jouerBot = (nom: NomBot, contenu: ContenuJouable, jusqua = Infinity): { actions: number[]; resultat: { score: number; poses: number; raison: string; combo: number } } => {
  if (nom === "faible") return jouerFaible(contenu);
  if (nom === "moyen") return jouerGlouton(contenu, jusqua);
  return jouerDiamant(contenu, nombre("k", LARGEUR_FAISCEAU), jusqua);
};

/** Une série à son arrivée : son rang, la grille qu'elle a vue, ses pièces. */
export interface SerieVue {
  rang: number;
  grille: Grille;
  pieces: readonly Piece[];
}

/** Rejoue des actions et rend chaque série à son arrivée (la première comprise). */
export function seriesVues(contenu: ContenuJouable, actions: readonly number[]): SerieVue[] {
  const p = new Partie(contenu);
  const out: SerieVue[] = [];
  const noter = (): void => {
    if (!p.finie || p.dernieresPieces.some((x) => x !== null)) out.push({ rang: p.serie, grille: p.grille, pieces: p.dernieresPieces.filter((x): x is Piece => x !== null) });
  };
  noter();
  for (const a of actions) {
    const avant = p.serie;
    if (p.jouerAction(a) === null) throw new Error("rejeu illégal");
    if (p.serie !== avant && !p.finie) noter();
  }
  return out;
}

/** Ce qu'une série vue donne à mesurer : posable (les trois pièces tiennent dans un ordre) et coup de pouce (une pièce, seule, efface une ligne) — que l'exigence ait été posée ou non. */
export const posableVue = (s: SerieVue): boolean => piecesPosables(s.grille, s.pieces) === s.pieces.length;
export const pouceVu = (s: SerieVue): boolean => completeUneLigne(s.grille, s.pieces);

export { resoudreReglage, serieAuRang, TAILLE_SERIE };
