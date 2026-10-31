// Lot T3 — la préparation d'un jour : `dailyTower`, le bot, les médailles. Le bot coûte des dizaines de secondes par jour : il ne peut tourner ni au chargement du jour ni à la première partie, les
// médailles d'un jour sont préparées à l'avance (`npm run preparer:tower`, tools/preparer.ts) et écrites dans le fichier du jour avec la preuve de l'auteur. Le branchement à « Mettre en
// production » est un lot de la plateforme (T4).
import { empreinteContenu } from "../empreinte";
import { dailyTower, GENERATEUR_TIRAGE, TOWER_GENERATOR_VERSION } from "../generateur";
import { figerJour, type JourFige, type JourLu, lireJour } from "../jours";
import { diamantDe, medaillesDe } from "../medailles";
import type { Rapier } from "../rapier";
import { encoderRediffusion, type Rejeu, rejouerComplet } from "../rediffusion";
import { choisirTirage, dansLaPlage, type Essai, TIRAGES_MAX } from "../tirage";
import { type Compteurs, jouerBotRobuste, type ResultatRobuste } from "./bot";

/** Ce qu'un tirage a coûté et donné (pour le rapport et `preparer:tower`). */
export interface EssaiTirage extends Essai {
  /** La hauteur de la vraie partie du bot, avant le plafond. */
  hauteurMm: number;
  variante: number;
  ticks: number;
}

/**
 * Le fichier d'un jour préparé : le jour figé (`figerJour`) avec ses médailles et la preuve du bot ; et ce que le calcul a coûté.
 * **Lot T3b — le tirage** : pour le générateur 3, la préparation essaie les tirages 0, 1, 2… (au plus `TIRAGES_MAX`) et garde le PREMIER dont le Diamant (la hauteur du bot, plafonnée) tombe dans
 * la plage `PLAGE_DIAMANT_MM` ; si aucun n'y tombe, le plus proche (`choisirTirage`). Les générateurs 1 et 2 n'ont qu'un seul « tirage », le 0. `essayer` rend la partie du bot d'un contenu
 * (le bot robuste par défaut ; un test peut en passer un autre pour dérouler la règle sans calculer).
 */
export function preparerJour(
  R: Rapier,
  jour: number,
  g: number = TOWER_GENERATOR_VERSION,
  essayer: (contenu: ReturnType<typeof dailyTower>) => Pick<ResultatRobuste, "resultat" | "rediffusion" | "variante" | "compteurs" | "ticksTotal"> = (c) => jouerBotRobuste(R, c),
): { fichier: JourFige; hauteurMm: number; diamantMm: number; tirage: number; dedans: boolean; essais: EssaiTirage[]; variante: number; compteurs: Compteurs } {
  const essais: EssaiTirage[] = [];
  const parties: ReturnType<typeof essayer>[] = [];
  for (let tirage = 0; tirage < (g >= GENERATEUR_TIRAGE ? TIRAGES_MAX : 1); tirage++) {
    const bot = essayer(dailyTower(jour, g, tirage));
    const diamantMm = diamantDe(bot.resultat.hauteurMm, g);
    essais.push({ tirage, diamantMm, hauteurMm: bot.resultat.hauteurMm, variante: bot.variante, ticks: bot.ticksTotal });
    parties.push(bot);
    if (g < GENERATEUR_TIRAGE || dansLaPlage(diamantMm)) break;
  }
  const { essai, dedans } = choisirTirage(essais);
  const bot = parties[essai.tirage]!;
  const fichier = figerJour(jour, g, essai.tirage);
  fichier.medailles = medaillesDe(essai.diamantMm);
  fichier.preuve = encoderRediffusion(bot.rediffusion);
  return { fichier, hauteurMm: bot.resultat.hauteurMm, diamantMm: essai.diamantMm, tirage: essai.tirage, dedans, essais, variante: bot.variante, compteurs: { ...bot.compteurs, ticks: bot.ticksTotal } };
}

/**
 * Le garde-fou d'un fichier de jour préparé (le texte JSON déjà lu) : il se relit, son contenu est exactement celui que la version `g` du générateur produit AU TIRAGE écrit, il a ses
 * médailles et sa preuve, et **la preuve rejouée donne la hauteur du bot, dont le Diamant écrit est `min(cette hauteur, plafond)`** (lot T3b ; avant le générateur 3, exactement cette hauteur).
 * Rend le motif du refus, ou le jour lu et le rejeu de sa preuve (lot T4 : le serveur en tire la silhouette du Diamant sans rejouer deux fois). Ne relance pas le bot (trop long) : il rejoue
 * seulement sa preuve.
 */
export function examinerJourPrepare(R: Rapier, json: unknown, jour: number): string | { lu: JourLu & { medailles: NonNullable<JourLu["medailles"]>; preuve: string }; rejeu: Rejeu } {
  const lu = lireJour(json, jour);
  if (typeof lu === "string") return lu;
  if (empreinteContenu(lu.contenu) !== empreinteContenu(dailyTower(jour, lu.contenu.g, lu.contenu.tirage ?? 0))) return `ne se régénère pas à l'identique avec g${lu.contenu.g}`;
  if (!lu.medailles) return "pas de médailles";
  if (!lu.preuve) return "pas de preuve";
  try {
    const rejeu = rejouerComplet(R, lu.contenu, lu.preuve);
    const diamant = diamantDe(rejeu.resultat.hauteurMm, lu.contenu.g);
    if (diamant !== lu.medailles.auteur) return `la preuve rejouée donne ${rejeu.resultat.hauteurMm} mm (Diamant ${diamant} mm), le Diamant écrit est ${lu.medailles.auteur} mm`;
    return { lu: { ...lu, medailles: lu.medailles, preuve: lu.preuve }, rejeu };
  } catch (e) {
    return `la preuve ne se rejoue pas : ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Le garde-fou d'un fichier de jour préparé : le motif du refus, ou null (voir `examinerJourPrepare`). */
export function verifierJourPrepare(R: Rapier, json: unknown, jour: number): string | null {
  const r = examinerJourPrepare(R, json, jour);
  return typeof r === "string" ? r : null;
}
