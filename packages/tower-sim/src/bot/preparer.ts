// Lot T3 — la préparation d'un jour : `dailyTower`, le bot, les médailles. Le bot coûte des dizaines de secondes par jour : il ne peut tourner ni au chargement du jour ni à la première partie, les
// médailles d'un jour sont préparées à l'avance (`npm run preparer:tower`, tools/preparer.ts) et écrites dans le fichier du jour avec la preuve de l'auteur. Le branchement à « Mettre en
// production » est un lot de la plateforme (T4).
import { empreinteContenu } from "../empreinte";
import { dailyTower, TOWER_GENERATOR_VERSION } from "../generateur";
import { figerJour, type JourFige, lireJour } from "../jours";
import { medaillesDe } from "../medailles";
import type { Rapier } from "../rapier";
import { encoderRediffusion, rejouer } from "../rediffusion";
import { type Compteurs, jouerBotRobuste } from "./bot";

/** Le fichier d'un jour préparé : le jour figé (`figerJour`) avec ses médailles et la preuve du bot ; et ce que le calcul a coûté. */
export function preparerJour(R: Rapier, jour: number, g: number = TOWER_GENERATOR_VERSION): { fichier: JourFige; hauteurMm: number; variante: number; compteurs: Compteurs } {
  const bot = jouerBotRobuste(R, dailyTower(jour, g));
  const fichier = figerJour(jour, g);
  fichier.medailles = medaillesDe(bot.resultat.hauteurMm);
  fichier.preuve = encoderRediffusion(bot.rediffusion);
  return { fichier, hauteurMm: bot.resultat.hauteurMm, variante: bot.variante, compteurs: { ...bot.compteurs, ticks: bot.ticksTotal } };
}

/**
 * Le garde-fou d'un fichier de jour préparé (le texte JSON déjà lu) : il se relit, son contenu est exactement celui que la version `g` du générateur produit, il a ses médailles et sa preuve,
 * et **la preuve rejouée donne exactement le Diamant écrit**. Rend le motif du refus, ou null. Ne relance pas le bot (trop long) : il rejoue seulement sa preuve.
 */
export function verifierJourPrepare(R: Rapier, json: unknown, jour: number): string | null {
  const lu = lireJour(json, jour);
  if (typeof lu === "string") return lu;
  if (empreinteContenu(lu.contenu) !== empreinteContenu(dailyTower(jour, lu.contenu.g))) return `ne se régénère pas à l'identique avec g${lu.contenu.g}`;
  if (!lu.medailles) return "pas de médailles";
  if (!lu.preuve) return "pas de preuve";
  try {
    const hauteurMm = rejouer(R, lu.contenu, lu.preuve).hauteurMm;
    if (hauteurMm !== lu.medailles.auteur) return `la preuve rejouée donne ${hauteurMm} mm, le Diamant écrit est ${lu.medailles.auteur} mm`;
  } catch (e) {
    return `la preuve ne se rejoue pas : ${e instanceof Error ? e.message : String(e)}`;
  }
  return null;
}
