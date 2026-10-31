// Lot 55 (partie B) — la boîte de vitesses **virtuelle** : la voiture du jeu n'a pas de rapports, le son en invente six. Pure et déterministe (aucune
// horloge, aucun hasard) : on lui donne la vitesse, le gaz et le temps écoulé, elle rend le rapport, le régime, la charge et l'état d'un passage.
// Le régime est celui qu'on entend : il monte dans un rapport, retombe au suivant (avec une coupure de couple), s'emballe au démarrage voiture arrêtée,
// retombe au ralenti sans gaz. Le son ne lit que la vitesse et le gaz : il ne peut rien changer à la course.
import { ETAGEMENT, type ProfilMoteur } from "./profils";

export interface EtatBoite {
  /** Rapport engagé, de 1 à `ETAGEMENT.length`. */
  rapport: number;
  /** Régime du moteur (tr/min), lissé. */
  rpm: number;
  /** Charge ∈ [0, 1] : le gaz, coupé pendant un passage. */
  charge: number;
  /** ∈ [0, 1] : 1 à l'instant d'un changement de rapport, retombe à 0 (coupure de couple). */
  passage: number;
  /** Sens du dernier changement (1 : monté, −1 : rétrogradé, 0 : aucun). */
  sens: -1 | 0 | 1;
  /** Secondes depuis le dernier changement. */
  depuis: number;
  /** Nombre de changements depuis le début (outil de test). */
  changements: number;
}

/** Durée (s) d'un passage de rapport : le couple est coupé, le régime tombe vers le rapport suivant. */
export const DUREE_PASSAGE = 0.2;
/** Temps minimal (s) entre deux changements : ni pompage ni rafale. */
export const ENTRE_CHANGEMENTS = 0.45;
/** Constante de temps (s) du régime vers sa cible, gaz ouvert / fermé. */
const SUIVI_OUVERT = 0.09;
const SUIVI_FERME = 0.28;

export function boiteInitiale(p: ProfilMoteur): EtatBoite {
  return { rapport: 1, rpm: p.ralenti, charge: 0, passage: 0, sens: 0, depuis: 9, changements: 0 };
}

const borne = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/** Le régime que la vitesse impose dans un rapport : le haut du rapport (`monte` × rouge) à la vitesse d'étagement. */
export function regimeRoue(p: ProfilMoteur, rapport: number, vitesse: number): number {
  const v = vitesse < 0 ? 0 : vitesse;
  return (v / ETAGEMENT[rapport - 1]!) * p.monte * p.rouge;
}

/**
 * Un pas de `dt` secondes. `vitesse` en m/s, `gaz` ∈ [0, 1]. Voiture arrêtée, un coup de gaz emballe le moteur (embrayage qui patine) jusqu'à un peu plus de la moitié
 * de la plage ; en l'air, le moteur s'emballe un peu (les roues ne freinent plus).
 */
export function pasBoite(e: EtatBoite, p: ProfilMoteur, vitesse: number, gaz: number, dt: number, enAir = false): EtatBoite {
  const g = borne(gaz, 0, 1);
  let { rapport, passage, sens, depuis, changements } = e;
  depuis += dt;
  // --- Le rapport ---------------------------------------------------------------------------------------------------------------
  let changement: -1 | 0 | 1 = 0;
  if (depuis >= ENTRE_CHANGEMENTS) {
    const surRegime = regimeRoue(p, rapport, vitesse);
    if (rapport < ETAGEMENT.length && surRegime >= p.monte * p.rouge && g > 0.2) changement = 1;
    else if (rapport > 1 && regimeRoue(p, rapport, vitesse) < p.descend * p.rouge) changement = -1;
  }
  if (changement !== 0) {
    // En rétrogradant on saute directement au rapport où le régime est correct (freinage fort : deux rapports d'un coup).
    let r = rapport + changement;
    if (changement < 0) while (r > 1 && regimeRoue(p, r, vitesse) < p.descend * p.rouge) r--;
    rapport = r;
    passage = 1;
    sens = changement;
    depuis = 0;
    changements++;
  } else {
    passage = Math.max(0, passage - dt / DUREE_PASSAGE);
  }
  // --- Le régime ----------------------------------------------------------------------------------------------------------------
  const roue = regimeRoue(p, rapport, vitesse);
  // Voiture (presque) arrêtée : l'embrayage patine, le moteur est libre jusqu'à la moitié de la plage de régime selon le gaz.
  const libre = p.ralenti + g * 0.55 * (p.rouge - p.ralenti);
  const embrayage = vitesse < ETAGEMENT[0]! * 0.35 ? libre : 0;
  let cible = Math.max(p.ralenti, roue, embrayage);
  // En l'air les roues ne freinent plus le moteur : il prend quelques pour cent de plus que la vitesse ne l'impose.
  if (enAir) cible = Math.max(cible, roue * (1 + 0.18 * g));
  cible = Math.min(p.rouge, cible);
  // Pendant un passage, le régime tombe vers la cible du nouveau rapport en perdant le couple : la fenêtre dure `DUREE_PASSAGE`.
  const tau = g > 0.05 && passage < 0.5 ? SUIVI_OUVERT : SUIVI_FERME;
  const k = 1 - Math.exp(-dt / tau);
  const rpm = borne(e.rpm + (cible - e.rpm) * k, p.ralenti * 0.95, p.rouge);
  const charge = passage > 0 ? g * (1 - passage) * 0.3 : g;
  return { rapport, rpm, charge, passage, sens, depuis, changements };
}

/** Régime normalisé ∈ [0, 1] entre le ralenti et le rouge. */
export const regimeNormal = (p: ProfilMoteur, rpm: number): number => borne((rpm - p.ralenti) / (p.rouge - p.ralenti), 0, 1);
