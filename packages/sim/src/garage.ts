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

// --- La voiture d'une course (lot 51) ------------------------------------------------------------------------------------------------------------
// Chaque course classée (circuit du jour, Salon) garde la voiture avec laquelle elle a été courue : le modèle, la couleur, le motif et la teinte du motif.
// **Une donnée à part** : jamais dans la rediffusion ni dans la simulation (golden et rediffusions ne bougent pas). Le jeu la joint à l'envoi ; le serveur
// vérifie qu'elle est débloquée pour ce joueur (les règles ci-dessus) et, sinon, garde la Sparrow en orange. Le choix du Garage (voiture, couleur, motif,
// teinte) est gardé par le serveur, par joueur : même type.

/** Le nombre de couleurs de caisse du Garage, les motifs de livrée, le nombre de teintes de motif : ceux de `apps/web/src/voiture/livree.ts` (testé : `voitureChoix.test.ts`). */
export const COULEURS_VOITURE = 8;
export const MOTIFS_VOITURE = ["course", "flancs", "filet", "bicolore", "chevrons", "damier", "rond", "unie"] as const;
export type MotifVoiture = (typeof MOTIFS_VOITURE)[number];
export const TEINTES_VOITURE = 4;

/** Une voiture : le modèle (`VOITURES_GARAGE`), le rang de la couleur de caisse, le motif de la livrée et le rang de la teinte du motif (0 : automatique). */
export interface VoitureDeCourse {
  id: IdVoiture;
  couleur: number;
  motif: MotifVoiture;
  teinteMotif: number;
}

/** La voiture de repli : la civile (la Sparrow), en orange de Track, au motif par défaut. Celle des courses d'avant le lot 51 et d'un choix illisible ou verrouillé. */
export const VOITURE_PAR_DEFAUT: Readonly<VoitureDeCourse> = Object.freeze({ id: "civile", couleur: 0, motif: "course", teinteMotif: 0 });

/** Une voiture lue d'une donnée quelconque (corps d'une requête, base) : `null` si elle est illisible (voiture inconnue, couleur ou teinte hors des listes, motif inconnu). */
export function voitureLue(brut: unknown): VoitureDeCourse | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  if (typeof o.id !== "string" || !(VOITURES_GARAGE as readonly string[]).includes(o.id)) return null;
  if (typeof o.couleur !== "number" || !Number.isInteger(o.couleur) || o.couleur < 0 || o.couleur >= COULEURS_VOITURE) return null;
  if (typeof o.motif !== "string" || !(MOTIFS_VOITURE as readonly string[]).includes(o.motif)) return null;
  const t = o.teinteMotif ?? 0;
  if (typeof t !== "number" || !Number.isInteger(t) || t < 0 || t >= TEINTES_VOITURE) return null;
  return { id: o.id as IdVoiture, couleur: o.couleur, motif: o.motif as MotifVoiture, teinteMotif: t };
}

/** La voiture gardée en base : `id.couleur.motif.teinte` (`civile.0.course.0`) ; une ligne d'avant le lot 51 n'en a pas (`NULL`). */
export const coderVoiture = (v: VoitureDeCourse): string => `${v.id}.${v.couleur}.${v.motif}.${v.teinteMotif}`;

/** La voiture lue en base : celle de la ligne, ou la Sparrow en orange (ligne d'avant le lot 51, valeur abîmée). */
export function decoderVoiture(code: string | null | undefined): VoitureDeCourse {
  if (typeof code === "string") {
    const morceaux = code.split(".");
    if (morceaux.length === 4) {
      const v = voitureLue({ id: morceaux[0], couleur: Number(morceaux[1]), motif: morceaux[2], teinteMotif: Number(morceaux[3]) });
      if (v) return v;
    }
  }
  return { ...VOITURE_PAR_DEFAUT };
}

/**
 * La voiture qu'un joueur a le droit de garder : celle qu'il annonce si elle est lisible **et débloquée** pour cette progression (`ouvert` : tout est
 * débloqué, le joueur de démonstration de la recette), sinon la Sparrow en orange (rien d'annoncé, illisible ou verrouillée : le repli de l'envoi d'une course).
 */
export function voitureAutorisee(brut: unknown, progres: ProgresGarage, ouvert = false): VoitureDeCourse {
  const v = voitureLue(brut);
  if (!v) return { ...VOITURE_PAR_DEFAUT };
  return ouvert || estDebloquee(DEBLOCAGES[v.id], progres) ? v : { ...VOITURE_PAR_DEFAUT };
}
