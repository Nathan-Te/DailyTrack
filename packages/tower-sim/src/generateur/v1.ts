// Lot T2 — générateur du contenu du jour, version 1. Ce fichier ne change plus une fois qu'un jour servi l'a utilisé : une évolution est une version 2 à côté.
import { mixSeed, Rng, formatDay } from "@cdj/core";
import type { PieceKind } from "../../lab/interface";
import { PIECE_KINDS } from "../../lab/interface";
import { EFFETS, type Effet, PALIERS_METRES, problemePaliers } from "../paliers";
import type { Contenu } from "./index";

/** Le nombre de pièces d'une partie. */
export const NB_PIECES = 40;
/** Les demi-largeurs possibles de la plateforme, en huitièmes de mètre : 5 m, 6 m, 7 m et 8 m de large. Le calibrage fin viendra aux lots T3 et T5. */
export const PLATEFORME_DEMI8_CHOIX: readonly number[] = [20, 24, 28, 32];
/** Les bornes de la plateforme (huitièmes de mètre, demi-largeur) : tout contenu du jour est entre les deux. */
export const PLATEFORME_BORNES = { minDemi8: 20, maxDemi8: 32 } as const;

/** Sel du jour de Tower (une valeur propre au jeu : la graine d'un jour de Tower n'est celle d'aucun autre jeu). */
const SEL_TOWER = 0x70e12;
// Un tirage par sujet, chacun sur sa propre graine : ajouter un sujet ne déplace pas les autres.
const SUJET_SACS = 1;
const SUJET_PLATEFORME = 2;
const SUJET_PALIERS = 3;
const SUJET_VENT = 4;

/**
 * La suite de `n` pièces tirée par sacs de sept : chaque tétromino une fois par sac (un sac est un mélange des sept), les sacs bout à bout ; le dernier sac est coupé.
 * Sans série absurde : au plus deux pièces identiques d'affilée (le dernier d'un sac et le premier du suivant), et un même tétromino revient au plus 13 pièces plus loin.
 */
export function suiteParSacs(rng: Rng, n: number): PieceKind[] {
  const suite: PieceKind[] = [];
  while (suite.length < n) suite.push(...rng.shuffle(PIECE_KINDS));
  return suite.slice(0, n);
}

/** Une suite a-t-elle deux pièces identiques d'affilée (la jonction de deux sacs : la borne basse de la distance entre deux apparitions d'un même tétromino) ? */
export const aDoublon = (pieces: readonly PieceKind[]): boolean => pieces.some((k, i) => i > 0 && pieces[i - 1] === k);
/** Un même tétromino revient-il 13 pièces plus loin (le premier d'un sac, puis le dernier du suivant : la borne haute) ? */
export const aEcartMaximal = (pieces: readonly PieceKind[]): boolean => pieces.some((k, i) => pieces.indexOf(k, i + 1) === i + 13);

/** Les effets des paliers : un mélange des six effets qui respecte les règles (`problemePaliers`), tiré par essais successifs sur des graines dérivées. */
export function tirerPaliers(graine: number): Effet[] {
  for (let essai = 0; essai < 10_000; essai++) {
    const effets = new Rng(mixSeed(graine, essai)).shuffle(EFFETS);
    if (problemePaliers(effets) === null) return effets;
  }
  throw new Error("aucun tirage de paliers ne respecte les règles"); // ne se produit pas : 36 mélanges sur 720 sont valides
}

export function dailyTowerV1(jour: number): Contenu {
  const graine = mixSeed(jour, SEL_TOWER);
  const pieces = suiteParSacs(new Rng(mixSeed(graine, SUJET_SACS)), NB_PIECES);
  const plateformeDemi8 = new Rng(mixSeed(graine, SUJET_PLATEFORME)).pick(PLATEFORME_DEMI8_CHOIX);
  const effets = tirerPaliers(mixSeed(graine, SUJET_PALIERS));
  const ventSens = new Rng(mixSeed(graine, SUJET_VENT)).int(2) === 0 ? -1 : 1;
  return {
    nom: formatDay(jour),
    jour,
    g: 1,
    theme: "port",
    pieces,
    plateformeDemi8,
    paliers: PALIERS_METRES.map((metres, i) => ({ metres, effet: effets[i]! })),
    ventSens,
  };
}
