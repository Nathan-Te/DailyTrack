// Retouche 40b — la voiture choisie (contrat commun des lots 40b, 41 et 42) : `voitureChoisie()` rend `{ id, couleur, motif }`, relu à chaque
// construction de la voiture ; `choisirVoiture(…)` l'enregistre (le Garage du lot 41). Le choix est gardé dans le navigateur sous `cdj:track:garage`.
// Un choix illisible, ou une voiture non débloquée, retombe sur la civile en orange de Track. `?voiture=<id>&couleur=<n>&motif=<m>` (recette et
// aperçus : `choixDeLAdresse`) montre une voiture sans rien enregistrer ni vérifier ; les courses jouées ainsi ne sont pas classées.
//
// Lot 41 : **les déblocages viennent du serveur** (`GET /api/garage`, réponse de l'envoi d'un temps), jamais d'un calcul du jeu sur ses records.
// La même clé garde ce que le dernier appel réussi a débloqué (`debloquees`) et les voitures déjà vues au Garage (`vues`, la pastille « Nouveau ») :
// hors connexion, la civile plus ces voitures-là ; le jeu n'est jamais bloqué.
import { gameStorage } from "../storage";
import { VOITURES, VOITURE_DEFAUT, ficheVoiture } from "./catalogue";
import { MOTIFS, PALETTE, type MotifLivree } from "./livree";

/** Le choix : la voiture (id du catalogue), la couleur (rang dans `PALETTE`, 0 = orange de Track), le motif de la livrée. */
export interface ChoixVoiture {
  id: string;
  couleur: number;
  motif: MotifLivree;
}

export const CLE_GARAGE = "cdj:track:garage";
export const CHOIX_DEFAUT: Readonly<ChoixVoiture> = Object.freeze({ id: VOITURE_DEFAUT, couleur: 0, motif: "bande" });

type Lecture = () => Pick<Storage, "getItem">;
type Ecriture = () => Pick<Storage, "getItem" | "setItem">;

/** Ce que la clé garde (tout est facultatif : une clé de la retouche 40b n'a que le choix). */
interface Garde {
  id?: unknown;
  couleur?: unknown;
  motif?: unknown;
  /** Lot 41 : les voitures débloquées selon le dernier appel réussi au serveur. */
  debloquees?: unknown;
  /** Lot 41 : les voitures déjà vues au Garage. */
  vues?: unknown;
}

function lire(stockage: Lecture): Garde {
  try {
    const brut = JSON.parse(stockage().getItem(CLE_GARAGE) ?? "null") as unknown;
    return brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Garde) : {};
  } catch {
    return {}; // stockage indisponible ou illisible
  }
}

function ecrire(stockage: Ecriture, maj: Partial<Garde>): boolean {
  try {
    stockage().setItem(CLE_GARAGE, JSON.stringify({ ...lire(stockage), ...maj }));
    return true;
  } catch {
    return false; // navigation privée, stockage bloqué : tant pis
  }
}

/** Les identifiants connus du catalogue dans une liste lue (le reste est ignoré). */
const ids = (brut: unknown): string[] => (Array.isArray(brut) ? VOITURES.map((v) => v.id).filter((id) => brut.includes(id)) : []);

/** Les voitures débloquées : la civile, plus ce que le dernier appel réussi au serveur a débloqué (gardé dans le navigateur). */
export function voituresDebloquees(stockage: Lecture = gameStorage): Set<string> {
  return new Set([VOITURE_DEFAUT, ...ids(lire(stockage).debloquees)]);
}

/** Note la réponse du serveur (les voitures débloquées) : elle remplace la précédente (le serveur fait foi, un code chargé compris). */
export function noterDeblocages(debloquees: readonly string[], stockage: Ecriture = gameStorage): void {
  const liste = ids(debloquees).filter((id) => id !== VOITURE_DEFAUT);
  if (JSON.stringify(liste) !== JSON.stringify(ids(lire(stockage).debloquees))) ecrire(stockage, { debloquees: liste });
}

/** Les voitures débloquées pas encore vues au Garage (la pastille « Nouveau »). La civile n'est jamais nouvelle. */
export function voituresNouvelles(stockage: Lecture = gameStorage): string[] {
  const vues = new Set(ids(lire(stockage).vues));
  return [...voituresDebloquees(stockage)].filter((id) => id !== VOITURE_DEFAUT && !vues.has(id));
}

/** Le Garage a montré ces voitures : elles ne sont plus nouvelles. */
export function marquerVues(vues: readonly string[], stockage: Ecriture = gameStorage): void {
  const deja = ids(lire(stockage).vues);
  const tout = ids([...deja, ...vues]);
  if (tout.length !== deja.length) ecrire(stockage, { vues: tout });
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
export function voitureChoisie(stockage: Lecture = gameStorage): ChoixVoiture {
  const choix = lireChoix(lire(stockage));
  if (!choix || !voituresDebloquees(stockage).has(choix.id)) return { ...CHOIX_DEFAUT };
  return choix;
}

/** Enregistre le choix (le Garage) ; un choix illisible ou une voiture verrouillée ne sont pas écrits (`false`). */
export function choisirVoiture(choix: ChoixVoiture, stockage: Ecriture = gameStorage): boolean {
  const c = lireChoix(choix);
  if (!c || !voituresDebloquees(stockage).has(c.id)) return false;
  return ecrire(stockage, { id: c.id, couleur: c.couleur, motif: c.motif });
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
