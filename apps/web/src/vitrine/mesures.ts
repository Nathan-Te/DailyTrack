// Lot 38 — mesures de référence de la vitrine, au profil téléphone (Chromium, processeur ×4, rendu logiciel). **Écrit par**
// `MESURE=1 npx playwright test mesure-lot38 --project=chromium` (apps/web/e2e/mesure-lot38.spec.ts) : ne pas modifier à la main.

export interface MesureVariante {
  /** Temps d'image moyen (ms, image attendue jusqu'au bout) en caméra de poursuite, moyenne des huit thèmes ; et le pire thème. */
  imageMs?: number;
  imageMaxMs?: number;
  /** Temps d'envoi seul (fil principal, ms). */
  envoiMs?: number;
  /** Construction de la scène d'un circuit (ms), moyenne des huit thèmes ; et le pire thème. */
  constructionMs?: number;
  constructionMaxMs?: number;
  appels?: number;
  triangles?: number;
  trianglesMax?: number;
}

export const MESURES: { date: string | null; profil: string | null; variantes: Record<string, MesureVariante> } = {
  "date": "2026-10-22",
  "profil": "Chromium 141.0.7390.37 (rendu logiciel SwiftShader), paysage 844 × 390, densité 1, processeur ×4 ; moyenne des 8 thèmes, 40 images par vue",
  "variantes": {
    "existant": {
      "imageMs": 185,
      "imageMaxMs": 306,
      "envoiMs": 4.7,
      "constructionMs": 345.6,
      "constructionMaxMs": 592.1,
      "appels": 123,
      "triangles": 90576,
      "trianglesMax": 168332
    },
    "A": {
      "imageMs": 116.3,
      "imageMaxMs": 130.2,
      "envoiMs": 3.9,
      "constructionMs": 121.8,
      "constructionMaxMs": 184.7,
      "appels": 120,
      "triangles": 33596,
      "trianglesMax": 39932
    },
    "B": {
      "imageMs": 183.1,
      "imageMaxMs": 226.3,
      "envoiMs": 4.5,
      "constructionMs": 396.1,
      "constructionMaxMs": 552.5,
      "appels": 121.3,
      "triangles": 92819,
      "trianglesMax": 116794
    },
    "C": {
      "imageMs": 248.3,
      "imageMaxMs": 389.4,
      "envoiMs": 4.9,
      "constructionMs": 415.9,
      "constructionMaxMs": 712.7,
      "appels": 124.8,
      "triangles": 100830,
      "trianglesMax": 175318
    },
    "M": {
      "imageMs": 217.3,
      "imageMaxMs": 248.8,
      "envoiMs": 4.6,
      "constructionMs": 332.7,
      "constructionMaxMs": 459.6,
      "appels": 123.1,
      "triangles": 97473,
      "trianglesMax": 141432
    }
  }
};
