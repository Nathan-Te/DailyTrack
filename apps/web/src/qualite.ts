// Lot 45 — **la règle de qualité automatique** (38b, § 5) et le réglage « Qualité graphique » : quel palier de scène chaque appareil tient. Logique pure
// (testée : `test/qualite.test.ts`) ; `main.ts` applique sa décision (`reconstructeur.demander`, hors course). Ce module (premier chargement) dit le palier au
// chargement et s'il faut mesurer ; la mesure elle-même est dans `qualiteMesure.ts`, chargé à la demande (première visite, chaque semaine, écran changé).
//
// - **On mesure, on ne devine pas** : à l'accueil, la scène du jour tourne ; on écarte les 30 premières images (compilation des programmes), puis on prend la
//   **médiane de 90 intervalles d'image**, à la densité d'écran du jeu (plafonnée à 2).
// - **Seuils** (écran à 60 Hz ; ramenés à la fréquence de l'écran, 90 ou 120 Hz) : médiane ≤ 13 ms → on monte d'un palier et on remesure ; ≥ 22 ms → on descend.
// - **Points de départ** : téléphone ou tablette → palier 2 (plus la vie et le ciel) ; ordinateur (pointeur fin, écran large) → palier 3 (sans passe plein
//   écran : le lot 47 les apporte) ; rendu logiciel (pas de carte graphique : SwiftShader, llvmpipe) ou navigateur piloté par un test → palier 1, sans mesure.
// - **Garde-fous** : sans demi-flottants rendables ou avec moins de 4 Go annoncés, aucune passe plein écran (`passesPermises`, pour le lot 47) ; deux mesures
//   ratées de suite (« descendre ») au-dessus du palier 1 → on redescend et on s'en souvient (`plafond` durable) ; une mesure interrompue ne compte pas.
// - **Mémorisé** sous `cdj:qualite` (palier, date, médiane) ; remesuré si l'écran change de taille d'un facteur 1,5, ou après une semaine.
// **Seul le rendu change** : un palier ne touche jamais la simulation.

export type NiveauQualite = 1 | 2 | 3;
/** Le réglage du joueur : Auto (la règle), Économie (palier 1), Équilibrée (palier 2), Maximale (palier 3 et ce que l'appareil supporte). */
export type ChoixGraphismes = "auto" | "economie" | "equilibree" | "maximale";
export const CHOIX_GRAPHISMES: readonly ChoixGraphismes[] = ["auto", "economie", "equilibree", "maximale"];
export const NIVEAU_DU_CHOIX: Record<ChoixGraphismes, NiveauQualite | null> = { auto: null, economie: 1, equilibree: 2, maximale: 3 };

/** Remesurer après une semaine, ou si l'écran change de taille d'un facteur 1,5 (en pixels dessinés). */
export const VALIDITE_MS = 7 * 86_400_000;
export const FACTEUR_ECRAN = 1.5;
export const QUALITE_KEY = "cdj:qualite";

/** Ce qu'on sait de l'appareil (lu une fois au chargement). */
export interface Appareil {
  /** Pointeur fin et écran large : un ordinateur. */
  ordinateur: boolean;
  /** Rendu logiciel (pas de carte graphique) ou navigateur piloté par un test : le palier 1, sans mesure. */
  logiciel: boolean;
  /** Cibles en demi-flottants rendables (`EXT_color_buffer_half_float`, ou les flottants de WebGL 2). */
  demiFlottants: boolean;
  /** `navigator.deviceMemory` (Go) quand il est annoncé. */
  memoire?: number;
}

/** Le point de départ de la mesure. */
export const depart = (a: Appareil): NiveauQualite => (a.logiciel ? 1 : a.ordinateur ? 3 : 2);

/** Passes plein écran permises (lot 47) : un ordinateur, des demi-flottants rendables et 4 Go au moins (quand c'est annoncé). Jamais sur un téléphone (décision du 22/10). */
export const passesPermises = (a: Appareil): boolean => a.ordinateur && !a.logiciel && a.demiFlottants && (a.memoire ?? 4) >= 4;

/** Lot 47b : le post-traitement ne se donne que sur choix explicite (« Maximale ») là où les passes sont permises ; Auto ne l'allume jamais (en attendant le lot 50). */
export const postVoulu = (choix: ChoixGraphismes, a: Appareil): boolean => choix === "maximale" && passesPermises(a);

/** Ce qui est gardé sous `cdj:qualite`. */
export interface MemoireQualite {
  palier: NiveauQualite;
  /** Heure de la dernière mesure (ms). */
  date: number;
  /** Médiane de la dernière mesure (ms) ; `null` : pas encore mesuré. */
  mediane: number | null;
  /** Pixels dessinés à la mesure (largeur × hauteur × densité²). */
  pixels: number;
  /** Mesures ratées de suite (une médiane ≥ 22 ms à 60 Hz) au-dessus du palier 1. */
  echecs: number;
  /** Palier à ne plus dépasser : une descente (le temps de la série de mesures) ou, après deux échecs de suite, durable (« on s'en souvient »). */
  plafond: NiveauQualite | null;
  durable: boolean;
}

/** `cdj:qualite` lu ; illisible ou d'un autre format : `null` (on remesure). */
export function lireMemoire(raw: string | null): MemoireQualite | null {
  try {
    const o = JSON.parse(raw ?? "null") as Partial<MemoireQualite> | null;
    return o && [1, 2, 3].includes(o.palier!) && o.date! > 0 && o.pixels! > 0 ? ({ mediane: null, echecs: 0, plafond: null, durable: false, ...o } as MemoireQualite) : null;
  } catch {
    return null;
  }
}

/** La mémoire vaut encore : une mesure réussie, il y a moins d'une semaine, sur un écran de taille voisine (facteur 1,5). */
export function memoireValable(m: MemoireQualite | null, maintenant: number, pixels: number): boolean {
  if (!m || m.mediane === null || maintenant - m.date > VALIDITE_MS || maintenant < m.date) return false;
  const r = pixels / Math.max(1, m.pixels);
  return r < FACTEUR_ECRAN && r > 1 / FACTEUR_ECRAN;
}

/** Le palier au chargement (le réglage Auto) : celui de la mémoire si elle vaut, sinon le point de départ (sous le plafond durable). `mesurer` : à l'accueil. */
export function palierAuChargement(a: Appareil, m: MemoireQualite | null, maintenant: number, pixels: number): { palier: NiveauQualite; mesurer: boolean } {
  if (a.logiciel) return { palier: 1, mesurer: false };
  if (m && memoireValable(m, maintenant, pixels)) return { palier: m.palier, mesurer: false };
  // Remesurer : depuis le point de départ, sous le plafond durable (deux échecs de suite) ; une série pas finie (rien de mesuré) : on reprend où elle en était.
  const plafond = m?.durable ? m.plafond ?? 3 : 3;
  const palier = m && m.mediane === null ? m.palier : depart(a);
  return { palier: Math.min(palier, plafond) as NiveauQualite, mesurer: true };
}
