// Retouche 38b — les paliers de qualité de la scène, au-dessus du mélange recommandé du lot 38. **Rendu seul** : un palier ne change jamais la
// simulation (ni la route qui porte la voiture, ni le circuit, ni le chrono). Un palier est une liste de **pas**, chacun commutable seul
// (la vitrine les montre avec et sans) ; un lot de mise en œuvre choisira, par appareil, le palier et les pas gardés.
//
// - Palier 1, « base » : le mélange recommandé du lot 38, nettoyé (lumière de C intégrée, ombres de contact des seuls rebords, mur de pneus allégé).
// - Palier 2, « finition » : même chemin de rendu (aucune passe de plus), plus de soin — géométrie, variété, matière (sobre : décision de Nathan,
//   38c), traces de pneus, reflets. « Matière détaillée » (l'ancienne matière du 38b) n'est dans aucun palier : une case pour comparer.
// - Palier 3, « vitrine » : le plafond — lumière (ombres, occlusion, brume, nuages), vie (drapeaux, foule, écrans, particules), post-traitement
//   (étalonnage, anticrénelage, halo), chacun commutable séparément.

export type Palier = 1 | 2 | 3;

export const PAS_IDS = ["geometrie", "variete", "matiere", "traces", "detaillee", "reflets", "ombres", "occlusion", "brume", "nuages", "drapeaux", "foule", "ecrans", "particules", "etalonnage", "anticrenelage", "halo"] as const;
export type PasId = (typeof PAS_IDS)[number];

/** Les réglages d'une scène : chaque pas allumé ou non. */
export type Reglages = Readonly<Record<PasId, boolean>>;

/** Les familles de pas (les textes de la vitrine sont dans `src/vitrine/textesPaliers.ts` : ici, des identifiants). */
export type Famille = "finition" | "lumiere" | "vie" | "post";

export interface Pas {
  id: PasId;
  palier: 2 | 3;
  famille: Famille;
  /** Ajoute une passe de rendu plein écran (post-traitement) : coût surtout sur la carte graphique, à juger sur un vrai téléphone. */
  passe?: boolean;
  /** Pour comparer seulement (38c : l'ancienne matière) : dans aucun palier, coupé par défaut ; à retirer au lot de mise en œuvre. */
  comparaison?: boolean;
}

/** Les pas, dans l'ordre de la vitrine. */
export const PAS: readonly Pas[] = [
  { id: "geometrie", palier: 2, famille: "finition" },
  { id: "variete", palier: 2, famille: "finition" },
  { id: "matiere", palier: 2, famille: "finition" },
  { id: "traces", palier: 2, famille: "finition" },
  { id: "detaillee", palier: 2, famille: "finition", comparaison: true },
  { id: "reflets", palier: 2, famille: "finition" },
  { id: "ombres", palier: 3, famille: "lumiere" },
  { id: "occlusion", palier: 3, famille: "lumiere", passe: true },
  { id: "brume", palier: 3, famille: "lumiere" },
  { id: "nuages", palier: 3, famille: "lumiere" },
  { id: "drapeaux", palier: 3, famille: "vie" },
  { id: "foule", palier: 3, famille: "vie" },
  { id: "ecrans", palier: 3, famille: "vie" },
  { id: "particules", palier: 3, famille: "vie" },
  { id: "etalonnage", palier: 3, famille: "post", passe: true },
  { id: "anticrenelage", palier: 3, famille: "post", passe: true },
  { id: "halo", palier: 3, famille: "post", passe: true },
];

/** Les réglages d'un palier : tous ses pas et ceux des paliers en dessous (jamais un pas de comparaison). */
export function reglagesDuPalier(p: Palier): Reglages {
  return Object.fromEntries(PAS.map((s) => [s.id, !s.comparaison && s.palier <= p])) as Record<PasId, boolean>;
}

/** Le palier dont les réglages sont exactement ceux-ci, ou `null` (réglages à la carte). */
export function palierDe(r: Reglages): Palier | null {
  for (const p of [1, 2, 3] as const) if (PAS_IDS.every((id) => r[id] === reglagesDuPalier(p)[id])) return p;
  return null;
}

/** Les mêmes réglages avec un pas changé. */
export function avecPas(r: Reglages, id: PasId, actif: boolean): Reglages {
  return { ...r, [id]: actif };
}

/** Il faut une chaîne de post-traitement (rendu dans une cible puis passes plein écran). */
export function avecPost(r: Reglages): boolean {
  return PAS.some((p) => p.passe && r[p.id]);
}

/** Les réglages en texte court (adresse, légendes) : « 2 », ou « 1+matiere+halo », « 3-occlusion ». */
export function texteReglages(r: Reglages): string {
  const p = palierDe(r);
  if (p) return String(p);
  // Le palier le plus proche (le moins de différences), puis les écarts.
  let best: Palier = 1;
  let ecart = Infinity;
  for (const q of [1, 2, 3] as const) {
    const n = PAS_IDS.filter((id) => r[id] !== reglagesDuPalier(q)[id]).length;
    if (n < ecart) {
      ecart = n;
      best = q;
    }
  }
  const base = reglagesDuPalier(best);
  return `${best}${PAS_IDS.filter((id) => r[id] !== base[id])
    .map((id) => `${r[id] ? "+" : "-"}${id}`)
    .join("")}`;
}

/** Lit un texte de `texteReglages` (inconnu : le palier 1). */
export function lireReglages(t: string | null | undefined): Reglages {
  const m = /^([123])((?:[+-][a-z]+)*)$/.exec(t ?? "");
  if (!m) return reglagesDuPalier(1);
  let r = reglagesDuPalier(Number(m[1]) as Palier);
  for (const [, signe, id] of m[2]!.matchAll(/([+-])([a-z]+)/g)) if ((PAS_IDS as readonly string[]).includes(id!)) r = avecPas(r, id as PasId, signe === "+");
  return r;
}
