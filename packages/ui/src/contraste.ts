import { valeurJeton, type NomCouleur } from "./jetons";

// Contrastes (charte § 10, lot I1) : 4,5:1 pour tout texte, y compris les petites légendes ; 3:1 pour le texte de 24 px et plus. Chaque paire
// texte / fond utilisée par l'interface est déclarée ici ; le test `packages/ui/test/contraste.test.ts` les vérifie toutes et la vitrine
// `/ui/` les affiche avec leur rapport. **Une nouvelle paire de couleurs = une ligne ici** (elle doit passer le test).

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`couleur attendue au format #RRGGBB : ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function rapportContraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export interface PaireCouleurs {
  couleur: NomCouleur;
  fond: NomCouleur;
  /** `normal` : tout texte (≥ 4,5:1) ; `grand` : 24 px et plus seulement (≥ 3:1). */
  taille: "normal" | "grand";
  /** Où la paire sert (affiché dans la vitrine). */
  usage: string;
}

export const SEUILS = { normal: 4.5, grand: 3 } as const;

/** Les paires de l'interface (charte § 3 et maquettes du lot I0). */
export const PAIRES: readonly PaireCouleurs[] = [
  { couleur: "dj-encre", fond: "dj-creme", taille: "normal", usage: "texte de page" },
  { couleur: "dj-encre-douce", fond: "dj-creme", taille: "normal", usage: "texte secondaire" },
  { couleur: "dj-encre", fond: "dj-creme-2", taille: "normal", usage: "valeur d'une tuile" },
  { couleur: "dj-encre-douce", fond: "dj-creme-2", taille: "normal", usage: "légende d'une tuile" },
  { couleur: "dj-encre", fond: "dj-papier", taille: "normal", usage: "étiquette claire, champ" },
  { couleur: "dj-encre-douce", fond: "dj-papier", taille: "normal", usage: "numéro sur l'étiquette Jump" },
  { couleur: "dj-creme", fond: "dj-encre", taille: "normal", usage: "logo, choix de langue actif" },
  { couleur: "dj-papier", fond: "dj-encre", taille: "normal", usage: "étiquette « Important » d'un message en direct (information)" },
  { couleur: "dj-moutarde", fond: "dj-encre", taille: "normal", usage: "étiquette « Important » d'un message en direct" },
  { couleur: "dj-terre-texte", fond: "dj-terre", taille: "normal", usage: "bouton principal de marque" },
  { couleur: "dj-encre", fond: "dj-moutarde", taille: "normal", usage: "avatar, coque Jump" },
  { couleur: "dj-ambre", fond: "dj-ecran", taille: "normal", usage: "chiffres de l'afficheur" },
  { couleur: "dj-ecran-texte", fond: "dj-ecran", taille: "normal", usage: "légende de l'afficheur" },
  { couleur: "dj-diamant-texte", fond: "dj-diamant", taille: "normal", usage: "médaille Diamant obtenue" },
  { couleur: "dj-medaille-texte", fond: "dj-or", taille: "normal", usage: "médaille or obtenue" },
  { couleur: "dj-medaille-texte", fond: "dj-argent", taille: "normal", usage: "médaille argent obtenue" },
  { couleur: "dj-medaille-texte", fond: "dj-bronze", taille: "normal", usage: "médaille bronze obtenue" },
  { couleur: "track-asphalte", fond: "dj-or", taille: "normal", usage: "médaille or obtenue (Track)" },
  { couleur: "track-asphalte", fond: "dj-argent", taille: "normal", usage: "médaille argent obtenue (Track)" },
  { couleur: "track-asphalte", fond: "dj-bronze", taille: "normal", usage: "médaille bronze obtenue (Track)" },
  { couleur: "dj-diamant", fond: "track-asphalte", taille: "normal", usage: "médaille Diamant pas encore (Track, contour)" },
  { couleur: "dj-or", fond: "track-asphalte", taille: "normal", usage: "médaille or pas encore (Track, contour)" },
  { couleur: "dj-argent", fond: "track-asphalte", taille: "normal", usage: "médaille argent pas encore (Track, contour)" },
  { couleur: "dj-bronze", fond: "track-asphalte", taille: "normal", usage: "médaille bronze pas encore (Track, contour)" },
  { couleur: "track-texte", fond: "track-asphalte", taille: "normal", usage: "texte de l'étiquette Track" },
  { couleur: "track-texte-doux", fond: "track-asphalte", taille: "normal", usage: "texte secondaire Track" },
  { couleur: "track-livree-texte", fond: "track-asphalte", taille: "normal", usage: "écarts de temps, accents Track" },
  { couleur: "track-asphalte", fond: "track-livree", taille: "normal", usage: "bouton « Courir »" },
  { couleur: "track-asphalte", fond: "track-livree-texte", taille: "normal", usage: "bouton « Courir » survolé" },
  { couleur: "dj-papier", fond: "jump-encre", taille: "normal", usage: "bouton principal Jump survolé" },
  { couleur: "track-texte", fond: "track-piste", taille: "normal", usage: "aperçu du circuit" },
  { couleur: "track-texte", fond: "track-coque", taille: "normal", usage: "coque Track" },
  { couleur: "dj-ambre", fond: "track-asphalte", taille: "normal", usage: "focus sur asphalte" },
  { couleur: "dj-encre", fond: "jump-jaune", taille: "normal", usage: "étiquette Jump" },
  { couleur: "jump-jaune", fond: "jump-encre", taille: "normal", usage: "bouton principal Jump, autocollant" },
  { couleur: "dj-encre-douce", fond: "jump-jaune", taille: "normal", usage: "texte secondaire sur l'étiquette Jump" },
  { couleur: "dj-encre", fond: "jump-papier", taille: "normal", usage: "cadres Jump" },
  // Lot T1 (charte rév. 13) : l'étiquette de Tower.
  { couleur: "dj-encre", fond: "tower-menthe", taille: "normal", usage: "texte de l'étiquette Tower, pastille des paliers" },
  { couleur: "tower-menthe", fond: "dj-encre", taille: "normal", usage: "bouton principal Tower, vies de la bande" },
  { couleur: "dj-encre", fond: "tower-bonus", taille: "normal", usage: "pastille « Bonus » des paliers" },
];

/** Le rapport d'une paire déclarée, et s'il passe son seuil. */
export function verifierPaire(p: PaireCouleurs): { rapport: number; seuil: number; ok: boolean } {
  const rapport = rapportContraste(valeurJeton(p.couleur), valeurJeton(p.fond));
  const seuil = SEUILS[p.taille];
  return { rapport, seuil, ok: rapport >= seuil };
}
