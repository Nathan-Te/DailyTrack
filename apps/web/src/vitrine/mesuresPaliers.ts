// Retouche 38b — mesures de référence des paliers, au profil téléphone (Chromium, processeur ×4, rendu logiciel). **Écrit par**
// `MESURE=1 npx playwright test mesure-lot38b --project=chromium` (apps/web/e2e/mesure-lot38b.spec.ts) : ne pas modifier à la main.
import type { PasId } from "../scene/paliers";

export interface MesureColonne {
  /** Temps d'image moyen (ms, image attendue jusqu'au bout) en caméra de poursuite, moyenne des thèmes ; et le pire thème. */
  imageMs?: number;
  imageMaxMs?: number;
  /** Temps d'envoi seul (fil principal, ms). */
  envoiMs?: number;
  /** Construction de la scène d'un circuit (ms, textures déjà dessinées), moyenne des thèmes ; et le pire thème. */
  constructionMs?: number;
  constructionMaxMs?: number;
  appels?: number;
  triangles?: number;
  trianglesMax?: number;
  /** Mémoire des textures dessinées et des cibles de rendu (octets), moyenne des thèmes. */
  textures?: number;
  cibles?: number;
}

/** Ce qu'un pas ajoute, seul, au palier 1 (moyenne des thèmes mesurés) : écarts d'image, de construction, de triangles, d'appels, de mémoire. */
export interface MesurePas {
  imageMs?: number;
  constructionMs?: number;
  triangles?: number;
  appels?: number;
  memoire?: number;
}

export const MESURES_PALIERS: { date: string | null; profil: string | null; colonnes: Record<string, MesureColonne>; pas: Partial<Record<PasId, MesurePas>> } = {
  "date": null,
  "profil": null,
  "colonnes": {},
  "pas": {}
};
