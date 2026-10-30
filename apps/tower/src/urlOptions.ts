// Les paramètres d'adresse de Tower (lots T1 et T2) — règle R9 : **fermés en production** (`restreint`), où la page ne sert d'ailleurs à rien (Tower est `off`, scripts/site.mjs ne la
// publie pas). Un nouveau paramètre d'adresse rejoint cette fonction.
//   (rien)                    le contenu d'AUJOURD'HUI (lot T2 : `dailyTower`, ou le jour figé s'il existe) — le jeu
//   ?seed=AAAA-MM-JJ          le contenu de ce jour. R9 (même règle que `?seed=` de Jump) : sur la production une date FUTURE est refusée (le contenu d'aujourd'hui s'ouvre) ; sur un aperçu de
//                             branche ou en local toutes les dates sont ouvertes. Une date illisible ouvre le contenu d'aujourd'hui.
//   ?scenario=essai           la suite fixe d'essai du lot T1 : 40 pièces, une plateforme de 7 m, aucun palier — fermé en production
//   ?scenario=paliers         une tour prête juste sous 10 m (lot T2) ; `&effet=lierre|figee|petite|geante|vent|glissante` force l'effet du premier palier (lierre par défaut) — fermé en production
//   ?scenario=banc            la démonstration de la physique du lot T0 (`&engine=a|b`, `&libre`) ; son panneau est `&debug&tune` — fermé en production
//   ?debug                    une ligne d'état (tick, phase, empreinte) et la porte `window.__tower` pour les tests
//   ?debug&tune               + le panneau des réglages de sensation (curseurs)
//   ?tactile=1 | 0            force l'interface tactile (boutons aux bords) ou la coupe ; sans lui, l'appareil décide (pointeur grossier)
import { parseDay } from "@cdj/core";
import { EFFETS, type Effet } from "@cdj/tower-sim";

export type Scenario = "jour" | "essai" | "paliers" | "banc";
export interface OptionsUrl {
  scenario: Scenario;
  /** `?seed=` lu (numéro de jour civil), null s'il est absent, illisible ou fermé (production sans date passée : voir `choisirJour`). */
  seed: number | null;
  /** `?effet=` du scénario des paliers. */
  effet: Effet;
  debug: boolean;
  tune: boolean;
  tactile: "1" | "0" | null;
}

export const PRODUCTION = import.meta.env.VITE_PRODUCTION === "1";

export function lireOptions(search: string, restreint: boolean): OptionsUrl {
  const q = new URLSearchParams(search);
  const tactile = q.get("tactile");
  const demande = q.get("scenario");
  const effet = q.get("effet");
  return {
    scenario: restreint ? "jour" : demande === "banc" || demande === "essai" || demande === "paliers" ? demande : "jour",
    seed: parseDay(q.get("seed") ?? ""),
    effet: !restreint && (EFFETS as readonly string[]).includes(effet ?? "") ? (effet as Effet) : "lierre",
    debug: !restreint && q.has("debug"),
    tune: !restreint && q.has("debug") && q.has("tune"),
    tactile: tactile === "1" || tactile === "0" ? tactile : null,
  };
}

/** Le jour à jouer : `seed` s'il est lisible, sinon aujourd'hui ; sur la production, une date future est refusée (`refuse` : le jeu le dit) et c'est aujourd'hui qui s'ouvre. */
export function choisirJour(seed: number | null, aujourdhui: number, restreint: boolean): { jour: number; refuse: boolean } {
  if (seed === null) return { jour: aujourdhui, refuse: false };
  if (restreint && seed > aujourdhui) return { jour: aujourdhui, refuse: true };
  return { jour: seed, refuse: false };
}
