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
  "date": "2026-10-22",
  "profil": "Chromium 141.0.7390.37 (rendu logiciel SwiftShader), paysage 844 × 390, densité 1, processeur ×4 ; colonnes : moyenne des 8 thèmes, 30 images par vue ; pas : écart au palier 1 sur theme-stade, theme-rallye, theme-nuit, theme-col, 20 images",
  "colonnes": {
    "existant": {
      "imageMs": 174.4,
      "imageMaxMs": 264.8,
      "envoiMs": 4.5,
      "constructionMs": 342.9,
      "constructionMaxMs": 657.5,
      "appels": 123,
      "triangles": 90576,
      "trianglesMax": 168332,
      "textures": 811028,
      "cibles": 4194304
    },
    "P1": {
      "imageMs": 201.8,
      "imageMaxMs": 267.1,
      "envoiMs": 4.1,
      "constructionMs": 275.6,
      "constructionMaxMs": 371.8,
      "appels": 123.4,
      "triangles": 87153,
      "trianglesMax": 122091,
      "textures": 4046847,
      "cibles": 4194304
    },
    "P2": {
      "imageMs": 462.3,
      "imageMaxMs": 569.4,
      "envoiMs": 4.3,
      "constructionMs": 394.4,
      "constructionMaxMs": 597,
      "appels": 123.4,
      "triangles": 109276,
      "trianglesMax": 149962,
      "textures": 11299494,
      "cibles": 4882432
    },
    "P3": {
      "imageMs": 925.4,
      "imageMaxMs": 1021.1,
      "envoiMs": 8.2,
      "constructionMs": 416.1,
      "constructionMaxMs": 516.6,
      "appels": 275.4,
      "triangles": 252801,
      "trianglesMax": 339502,
      "textures": 13221883,
      "cibles": 51566320
    }
  },
  "pas": {
    "geometrie": {
      "imageMs": -6.9,
      "constructionMs": 56.1,
      "triangles": 28043,
      "appels": 0,
      "memoire": 0
    },
    "variete": {
      "imageMs": -21.3,
      "constructionMs": -45.8,
      "triangles": 0,
      "appels": 0,
      "memoire": 0
    },
    "matiere": {
      "imageMs": 35,
      "constructionMs": -17.9,
      "triangles": 263,
      "appels": 0,
      "memoire": 7252647
    },
    "reflets": {
      "imageMs": 140.4,
      "constructionMs": -28.3,
      "triangles": 0,
      "appels": 0,
      "memoire": 688128
    },
    "ombres": {
      "imageMs": -14.3,
      "constructionMs": -33.1,
      "triangles": 17172,
      "appels": 1,
      "memoire": 12582912
    },
    "occlusion": {
      "imageMs": 273.5,
      "constructionMs": -79.1,
      "triangles": 89941,
      "appels": 128.3,
      "memoire": 28966080
    },
    "brume": {
      "imageMs": 2.3,
      "constructionMs": 7.3,
      "triangles": 0,
      "appels": 0,
      "memoire": 0
    },
    "nuages": {
      "imageMs": 4,
      "constructionMs": -21.5,
      "triangles": 2208,
      "appels": 1,
      "memoire": 1398101
    },
    "drapeaux": {
      "imageMs": -12.7,
      "constructionMs": -20,
      "triangles": 372,
      "appels": 1.5,
      "memoire": 0
    },
    "foule": {
      "imageMs": -17.6,
      "constructionMs": -33.1,
      "triangles": -1420,
      "appels": 0,
      "memoire": 0
    },
    "ecrans": {
      "imageMs": -9,
      "constructionMs": -28.6,
      "triangles": 48,
      "appels": 0,
      "memoire": 524288
    },
    "particules": {
      "imageMs": -8.1,
      "constructionMs": -54.4,
      "triangles": 0,
      "appels": 1,
      "memoire": 0
    },
    "etalonnage": {
      "imageMs": 38.2,
      "constructionMs": -28.7,
      "triangles": 2,
      "appels": 2,
      "memoire": 23699520
    },
    "anticrenelage": {
      "imageMs": 97,
      "constructionMs": -62.4,
      "triangles": 4,
      "appels": 4,
      "memoire": 26332800
    },
    "halo": {
      "imageMs": 140.3,
      "constructionMs": -20.8,
      "triangles": 14,
      "appels": 14,
      "memoire": 26201136
    }
  }
};
