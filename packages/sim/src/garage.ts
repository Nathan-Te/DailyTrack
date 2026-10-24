// Lot 41 — les règles du Garage : ce qui débloque chaque voiture, **une ligne par voiture**, lues par le serveur (cdj.ts : `GET /api/garage`,
// réponse de l'envoi) **et** par le jeu (apps/web/src/voiture/catalogue.ts) : une seule source. Les voitures sont purement cosmétiques : rien
// ici ne touche à la simulation. Fichier léger (lot 36) : il n'importe que `medals.ts`.
import { medalFor, medalsFor } from "./medals";

/**
 * Comment une voiture se débloque. `medailles` : un nombre de circuits du jour avec au moins cette médaille (`or` : l'or ou l'auteur) ;
 * `jours` : un nombre de jours joués (circuits du jour finis). `abonnement` est réservé : aucune voiture ne l'utilise, il ne s'affiche nulle part.
 */
export type Deblocage = { type: "defaut" } | { type: "medailles"; medaille: "or" | "auteur"; nombre: number } | { type: "jours"; nombre: number } | { type: "abonnement" };

/** Les voitures du Garage, dans l'ordre où le jeu les montre (lot 42 : de la plus facile à gagner à la plus difficile). */
export const VOITURES_GARAGE = ["civile", "fourgon", "evolution", "rallye", "gt", "roadster", "pickup", "proto", "muscle", "monoplace"] as const;
export type IdVoiture = (typeof VOITURES_GARAGE)[number];

/**
 * **Les règles (décision de Nathan, 23/10/2026)** : la civile dès le départ ; A (évolution) 3 circuits du jour avec l'or ou l'auteur ;
 * B (GT) 10 jours joués ; C (proto) 1 médaille d'auteur. **Lot 42 (décision de Nathan, 24/10/2026)** : la fourgonnette 3 jours joués, la rallye
 * 7, le roadster 14, le pick-up 6 ors, la muscle car 30 jours joués (prestige : les plus assidus), la monoplace 3 médailles d'auteur (prestige :
 * les meilleurs). Une ligne à changer pour ajuster une règle.
 */
export const DEBLOCAGES: Readonly<Record<IdVoiture, Deblocage>> = {
  civile: { type: "defaut" },
  fourgon: { type: "jours", nombre: 3 },
  evolution: { type: "medailles", medaille: "or", nombre: 3 },
  rallye: { type: "jours", nombre: 7 },
  gt: { type: "jours", nombre: 10 },
  roadster: { type: "jours", nombre: 14 },
  pickup: { type: "medailles", medaille: "or", nombre: 6 },
  proto: { type: "medailles", medaille: "auteur", nombre: 1 },
  muscle: { type: "jours", nombre: 30 },
  monoplace: { type: "medailles", medaille: "auteur", nombre: 3 },
};

/** Ce qui débloque les voitures : jours joués, circuits du jour avec l'or (ou mieux), avec la médaille d'auteur. */
export interface ProgresGarage {
  jours: number;
  or: number;
  auteur: number;
}

/** Un résultat du circuit du jour, tel que le serveur l'a rejoué : le jour, le meilleur temps, le temps du pilote de ce jour (`null` : inconnu). */
export interface ResultatDuJour {
  day: number;
  ms: number;
  authorMs: number | null;
}

/**
 * La progression d'un joueur à partir de ses meilleurs temps du jour (un par jour). **Une médaille compte avec les seuils de son jour**
 * (`medalsFor(temps du pilote, jour)` : bascule du 28/10/2026 comprise) ; un jour dont le circuit est inconnu compte comme joué, sans médaille.
 */
export function progresGarage(resultats: readonly ResultatDuJour[]): ProgresGarage {
  const p: ProgresGarage = { jours: 0, or: 0, auteur: 0 };
  const vus = new Set<number>();
  for (const r of resultats) {
    if (vus.has(r.day)) continue; // un jour ne compte qu'une fois
    vus.add(r.day);
    p.jours++;
    const m = r.authorMs === null ? null : medalFor(r.ms, medalsFor(r.authorMs, r.day));
    if (m === "author" || m === "gold") p.or++;
    if (m === "author") p.auteur++;
  }
  return p;
}

/** Où en est le joueur pour un déblocage : `fait` sur `nombre` (`null` : rien à compter — la civile, l'abonnement). */
export function avancement(d: Deblocage, p: ProgresGarage): { fait: number; nombre: number } | null {
  if (d.type === "jours") return { fait: Math.min(p.jours, d.nombre), nombre: d.nombre };
  if (d.type === "medailles") return { fait: Math.min(d.medaille === "auteur" ? p.auteur : p.or, d.nombre), nombre: d.nombre };
  return null;
}

/** La voiture est-elle débloquée ? (`abonnement` : jamais, pour l'instant.) */
export function estDebloquee(d: Deblocage, p: ProgresGarage): boolean {
  if (d.type === "defaut") return true;
  const a = avancement(d, p);
  return a !== null && a.fait >= a.nombre;
}

/** L'état d'une voiture rendu par le serveur (`GET /api/garage`, réponse de l'envoi). */
export interface EtatVoiture {
  id: IdVoiture;
  debloquee: boolean;
  /** Progression vers le déblocage (`null` : la civile). */
  progres: { fait: number; nombre: number } | null;
}

/** L'état de toutes les voitures pour cette progression. */
export function etatGarage(p: ProgresGarage): EtatVoiture[] {
  return VOITURES_GARAGE.map((id) => ({ id, debloquee: estDebloquee(DEBLOCAGES[id], p), progres: avancement(DEBLOCAGES[id], p) }));
}

/** Les voitures débloquées par `apres` qui ne l'étaient pas par `avant` (une course vient de les débloquer). */
export function nouvellesVoitures(avant: ProgresGarage, apres: ProgresGarage): IdVoiture[] {
  return VOITURES_GARAGE.filter((id) => !estDebloquee(DEBLOCAGES[id], avant) && estDebloquee(DEBLOCAGES[id], apres));
}
