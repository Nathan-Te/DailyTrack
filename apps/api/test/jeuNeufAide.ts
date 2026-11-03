import { daysFromCivil } from "@cdj/core";
import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe } from "@cdj/core/enveloppe";
import type { GameDefinition } from "../src/games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, refusDEnveloppe, type RejeuNeuf } from "../src/jeux/index";

// Lot K4c — un **jeu jouet** pour prouver le contrat minimal d'un jeu neuf sans dépendre d'un vrai jeu : la charge d'une rediffusion est une suite d'octets ; le score est leur somme (jeu au score, du plus grand
// au plus petit) ou leur nombre (jeu au temps, du plus petit au plus grand). Deux fiches de test, deux sens de classement. Le vrai témoin est « Cibles » (`apps/api/src/cibles.ts`).

export const JOUR_ESSAI = "2026-11-10";
export const D_ESSAI = daysFromCivil(2026, 11, 10);
export const SIM = 1;
export const GEN = 1;

/** La fiche de test d'un jeu au **score** (points, du plus grand au plus petit, départage : le moins d'octets) ou au **temps** (ticks, du plus petit au plus grand). */
export function ficheEssai(sens: "score" | "temps"): FicheServeur {
  const score = sens === "score";
  return {
    id: score ? "essaiscore" : "essaitemps",
    code: score ? "essaiscore" : "essaitemps",
    etatDepart: "off",
    premierJour: "2026-11-01",
    classement: {
      colonnes: score
        ? [
            { nom: "points", sens: "desc" },
            { nom: "octets", sens: "asc" },
            { nom: "submitted_at", sens: "asc" },
            { nom: "player_id", sens: "asc" },
          ]
        : [
            { nom: "ticks", sens: "asc" },
            { nom: "submitted_at", sens: "asc" },
            { nom: "player_id", sens: "asc" },
          ],
      cumul: false,
      unite: score ? "points" : "ticks",
      format: score ? "entier" : "temps",
    },
    rejeu: { unitesServeur: 1, maxTicks: 1000 },
  } as unknown as FicheServeur;
}

interface Niveau {
  jour: number;
}
interface Mesure {
  points: number;
  octets: number;
  ticks: number;
}
interface Rejeu extends RejeuNeuf {
  charge: readonly number[];
}

const LIMITES = { maxCaracteres: 600, sims: [SIM], generateurs: [GEN] };

export const rediffusion = (charge: number[], jour = D_ESSAI, g = GEN): string => encoderEnveloppe({ sim: SIM, g, contenu: { jour }, charge });

/** Le contrat minimal du jeu jouet — rien d'autre n'est écrit. */
export function contratEssai(sens: "score" | "temps"): ContratMinimal<Niveau, Rejeu, Mesure> {
  const score = sens === "score";
  return {
    versions: () => ({ simVersion: SIM, generatorVersion: GEN }),
    niveauDuJour: (jour) => ({ jour }),
    decoder(texte) {
      try {
        return decoderEnveloppe(texte, LIMITES);
      } catch (e) {
        if (e instanceof ErreurEnveloppe) throw refusDEnveloppe(e);
        throw e;
      }
    },
    rejouer(_niveau, texte) {
      const r = decoderEnveloppe(texte, LIMITES);
      if (r.charge.length === 0) throw new RefusJeu("not_finished", "Partie vide");
      return { points: r.charge.reduce((a, b) => a + b, 0), octets: r.charge.length, ticks: r.charge.length * 2 };
    },
    score: (m): Record<string, number> => (score ? { points: m.points, octets: m.octets } : { ticks: m.ticks }),
    seuils: () => (score ? { author: 200, gold: 100, silver: 50, bronze: 20 } : { author: 4, gold: 10, silver: 20, bronze: 40 }),
    entrees: (r) => `essai|${r.charge.join(",")}`,
    theme: () => "plat",
    ticksParSeconde: 60,
  };
}

export function jeuEssai(sens: "score" | "temps"): GameDefinition<never> {
  return definirJeuNeuf<Niveau, Rejeu, Mesure, never>({ fiche: ficheEssai(sens), nom: sens === "score" ? "EssaiScore" : "EssaiTemps" }, () => contratEssai(sens)) as GameDefinition<never>;
}
