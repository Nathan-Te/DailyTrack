import { decoderEnveloppe, encoderEnveloppe, ErreurEnveloppe } from "@cdj/core/enveloppe";
import type { GameDefinition } from "../src/games";
import { type ContratParty, definirJeuParty, type FicheServeur, RefusJeu, refusDEnveloppe, type RejeuNeuf } from "../src/jeux/index";
import { D_ESSAI } from "./jeuNeufAide";
import { DAY_MS } from "./helpers";

// Lot PA1 — **un jeu Party jouet** pour prouver le contrat Party (`apps/api/src/jeux/party.ts`) sans vrai jeu : la charge d'une rediffusion est une suite d'octets ; les points sont leur somme plus la graine du
// jour modulo 7 (la preuve que la graine arrive au rejeu). Le jeu fictif de la CI (`scripts/jeu-fictif.mjs`) en est la version complète, générée.

export const MIDI = D_ESSAI * DAY_MS + 12 * 3_600_000;
export const SIM = 1;
export const GEN = 1;
const LIMITES = { maxCaracteres: 600, sims: [SIM], generateurs: [GEN] };

export const fichePartie = {
  id: "partyjouet",
  code: "partyjouet",
  etatDepart: "off",
  premierJour: "2026-11-01",
  categorie: "party",
  classement: {
    colonnes: [
      { nom: "points", sens: "desc" },
      { nom: "submitted_at", sens: "asc" },
      { nom: "player_id", sens: "asc" },
    ],
    cumul: false,
    unite: "points",
    format: "entier",
  },
  rejeu: { unitesServeur: 1, maxTicks: 1000 },
} as unknown as FicheServeur;

interface Mesure {
  points: number;
}
interface Rejeu extends RejeuNeuf {
  charge: readonly number[];
}
/** Les graines que le rejeu du jeu jouet a reçues (pour le test). */
export const grainesVues: number[] = [];
const contrat = (): ContratParty<Rejeu, Mesure> => ({
  versions: () => ({ simVersion: SIM, generatorVersion: GEN }),
  decoder(texte) {
    try {
      return decoderEnveloppe(texte, LIMITES);
    } catch (e) {
      if (e instanceof ErreurEnveloppe) throw refusDEnveloppe(e);
      throw e;
    }
  },
  rejouer({ graine }, texte) {
    grainesVues.push(graine);
    const r = decoderEnveloppe(texte, LIMITES);
    if (r.charge.length === 0) throw new RefusJeu("not_finished", "Partie vide");
    return { points: r.charge.reduce((a, b) => a + b, 0) + (graine % 7) };
  },
  score: (m) => ({ points: m.points }),
  entrees: (r) => `partyjouet|${r.charge.join(",")}`,
});
export const defPartyJouet = definirJeuParty<Rejeu, Mesure, never>({ fiche: fichePartie, nom: "PartyJouet" }, () => contrat()) as GameDefinition<never>;
export const rediffusion = (charge: number[], jour = D_ESSAI) => encoderEnveloppe({ sim: SIM, g: GEN, contenu: { jour }, charge });

