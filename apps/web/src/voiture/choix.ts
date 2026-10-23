// Retouche 40b — la voiture choisie (contrat commun des lots 40b, 41 et 42) : `voitureChoisie()` rend `{ id, couleur, motif }`, relu à chaque
// construction de la voiture ; `choisirVoiture(…)` l'enregistre (le Garage du lot 41). Le choix est gardé dans le navigateur sous `cdj:track:garage`.
// Un choix illisible, ou une voiture non débloquée, retombe sur la civile en orange de Track. `?voiture=<id>&couleur=<n>&motif=<m>` (recette et
// aperçus : `choixDeLAdresse`) montre une voiture sans rien enregistrer ni vérifier ; les courses jouées ainsi ne sont pas classées.
import { listDayBests } from "../records";
import { gameStorage } from "../storage";
import { VOITURES, VOITURE_DEFAUT, ficheVoiture, type FicheVoiture } from "./catalogue";
import { MOTIFS, PALETTE, type MotifLivree } from "./livree";

/** Le choix : la voiture (id du catalogue), la couleur (rang dans `PALETTE`, 0 = orange de Track), le motif de la livrée. */
export interface ChoixVoiture {
  id: string;
  couleur: number;
  motif: MotifLivree;
}

export const CLE_GARAGE = "cdj:track:garage";
export const CHOIX_DEFAUT: Readonly<ChoixVoiture> = Object.freeze({ id: VOITURE_DEFAUT, couleur: 0, motif: "bande" });

/** Ce qui débloque les voitures : jours joués, circuits du jour avec l'or (ou mieux) et avec la médaille d'auteur. */
export interface Progres {
  jours: number;
  or: number;
  auteur: number;
}

/** Les progrès gardés dans ce navigateur (les records des circuits du jour). Le lot 41 les fera vérifier par le serveur. */
export function progresLocal(): Progres {
  const p: Progres = { jours: 0, or: 0, auteur: 0 };
  for (const b of listDayBests().values()) {
    p.jours++;
    if (b.medal === "gold" || b.medal === "author") p.or++;
    if (b.medal === "author") p.auteur++;
  }
  return p;
}

/** La voiture est-elle débloquée ? (`abonnement` : jamais, pour l'instant.) */
export function estDebloquee(f: FicheVoiture, p: Progres): boolean {
  const d = f.deblocage;
  if (d.type === "defaut") return true;
  if (d.type === "jours") return p.jours >= d.nombre;
  if (d.type === "medailles") return (d.medaille === "auteur" ? p.auteur : p.or) >= d.nombre;
  return false;
}

/** Un choix lu (stockage, adresse) : `null` s'il est illisible (voiture inconnue, couleur hors de la palette, motif inconnu). */
export function lireChoix(brut: unknown): ChoixVoiture | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Partial<Record<keyof ChoixVoiture, unknown>>;
  if (typeof o.id !== "string" || !ficheVoiture(o.id)) return null;
  if (typeof o.couleur !== "number" || !Number.isInteger(o.couleur) || o.couleur < 0 || o.couleur >= PALETTE.length) return null;
  if (typeof o.motif !== "string" || !(MOTIFS as readonly string[]).includes(o.motif)) return null;
  return { id: o.id, couleur: o.couleur, motif: o.motif as MotifLivree };
}

/** La voiture choisie (stockage du navigateur) ; illisible ou non débloquée : la civile en orange de Track. */
export function voitureChoisie(progres: () => Progres = progresLocal, stockage: () => Pick<Storage, "getItem"> = gameStorage): ChoixVoiture {
  let choix: ChoixVoiture | null = null;
  try {
    choix = lireChoix(JSON.parse(stockage().getItem(CLE_GARAGE) ?? "null"));
  } catch {
    /* stockage indisponible ou illisible */
  }
  if (!choix || !estDebloquee(ficheVoiture(choix.id)!, progres())) return { ...CHOIX_DEFAUT };
  return choix;
}

/** Enregistre le choix (le Garage) ; un choix illisible n'est pas écrit. */
export function choisirVoiture(choix: ChoixVoiture, stockage: () => Pick<Storage, "setItem"> = gameStorage): boolean {
  const c = lireChoix(choix);
  if (!c) return false;
  try {
    stockage().setItem(CLE_GARAGE, JSON.stringify(c));
    return true;
  } catch {
    return false; // navigation privée, stockage bloqué : tant pis
  }
}

/**
 * `?voiture=<id>&couleur=<n>&motif=<m>` (recette et aperçus ; le jeu l'ignore en production) : une voiture montrée telle quelle, sans
 * vérifier les déblocages ni rien enregistrer. `couleur` et `motif` absents : ceux par défaut. `null` sans `?voiture=` ou si elle est inconnue.
 */
export function choixDeLAdresse(params: URLSearchParams): ChoixVoiture | null {
  const id = params.get("voiture");
  if (id === null) return null;
  const n = params.get("couleur");
  return lireChoix({ id, couleur: n === null || n === "" ? CHOIX_DEFAUT.couleur : Number(n), motif: params.get("motif") || CHOIX_DEFAUT.motif });
}

/** Les identifiants des voitures (la page d'admin les propose). */
export const IDS_VOITURES: readonly string[] = VOITURES.map((v) => v.id);
