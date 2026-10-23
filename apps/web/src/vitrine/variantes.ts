// Les colonnes de la vitrine. **Planche des directions (lot 38)** : l'existant (la vraie scène du jeu, `buildTrackScene`), les trois directions et le
// mélange recommandé. **Planche des paliers (retouche 38b)** : l'existant, les paliers 1, 2 et 3 au-dessus du mélange, et « à la carte » (les pas
// cochés en tête de page). Chaque colonne est chargée à la demande (`import()`) : un morceau à elle, dont la construction mesure le poids
// (vite.vitrine.config.ts).
import type { PaletteName, Track } from "@cdj/sim";
import type { PerspectiveCamera, WebGLRenderer } from "three";
import type { TrackScene } from "../trackMesh";
import { buildTrackScene } from "../scene/socle";
import { composerScene } from "../scene/composer";
import { reglagesDuPalier, type Reglages } from "../scene/paliers";

export type VarianteId = "existant" | "A" | "B" | "C" | "M" | "P1" | "P2" | "P3" | "carte";

/** Ce que rend le chargement d'une colonne : de quoi construire une scène, et (paliers) de quoi la dessiner. */
export interface Fabrique {
  construire(track: Track, palette: PaletteName): TrackScene;
  /** Dessine une image de la scène (carte d'environnement, animation au temps `t`, post-traitement) ; rend la mémoire des cibles du post-traitement. */
  rendre?(ts: TrackScene, r: WebGLRenderer, camera: PerspectiveCamera, w: number, h: number, t: number): number;
  /** Ce qui demande le moteur de rendu, une fois par scène (carte d'environnement). */
  preparer?(ts: TrackScene, r: WebGLRenderer): void;
  /** Libère ce que la colonne tient dans un moteur (les cibles du post-traitement). */
  liberer?(r: WebGLRenderer): void;
}

export interface Variante {
  id: VarianteId;
  titre: string;
  resume: string;
  /** Les morceaux dont le poids est celui de la colonne (poids.json, mesuré à la construction). */
  morceaux: string[];
  /** Charge la colonne (son morceau) et rend sa fabrique : on mesure la construction seule, sans le chargement. */
  charger(): Promise<Fabrique>;
}

const EXISTANT: Variante = {
  id: "existant",
  titre: "Existant",
  resume: "La scène du jeu aujourd'hui (lot 23).",
  morceaux: [],
  charger: async () => ({ construire: (track, palette) => buildTrackScene(track, palette) }),
};

export const VARIANTES: Variante[] = [
  EXISTANT,
  {
    id: "A",
    titre: "A — Net et graphique",
    resume: "Silhouettes franches, peu de pièces, aplats, bandes et marquages forts, lumière en trois tons (la charte « Cartouches » en 3D).",
    morceaux: ["directionA"],
    charger: async () => {
      const { DIRECTION_A } = await import("../scene/directionA");
      return { construire: (track, palette) => composerScene(track, palette, DIRECTION_A) };
    },
  },
  {
    id: "B",
    titre: "B — Détaillé",
    resume: "Formes chanfreinées et petites pièces qui racontent (pneus, drapeaux, câbles, rivets, sponsors fictifs), matériaux variés ; tout fusionné.",
    morceaux: ["directionB"],
    charger: async () => {
      const { DIRECTION_B } = await import("../scene/directionB");
      return { construire: (track, palette) => composerScene(track, palette, DIRECTION_B) };
    },
  },
  {
    id: "C",
    titre: "C — Lumière et matière",
    resume: "Les formes de l'existant ; le ciel, la brume, la lumière et l'ombrage par thème, l'occlusion par sommets, des textures dessinées au chargement.",
    morceaux: ["directionC"],
    charger: async () => {
      const { appliquerC } = await import("../scene/directionC");
      return { construire: (track, palette) => appliquerC(buildTrackScene(track, palette), palette, track) };
    },
  },
  {
    id: "M",
    titre: "Mélange recommandé",
    resume: "La proposition du lot : les éléments et rebords de A, un décor de B allégé, la lumière de C.",
    morceaux: ["directionM", "directionA", "directionB", "directionC"],
    charger: async () => {
      const [{ DIRECTION_M }, { appliquerC }] = await Promise.all([import("../scene/directionM"), import("../scene/directionC")]);
      return { construire: (track, palette) => appliquerC(composerScene(track, palette, DIRECTION_M), palette, track) };
    },
  },
];

/** Les morceaux de la planche des paliers (le compositeur et chaque famille de pas : leur poids est lu dans poids.json). */
export const MORCEAUX_PALIERS = { base: ["palier1"], finition: ["finition", "matiere", "reflets"], vitrine: ["lumiere3", "vie", "post"] } as const;

/** Une colonne de palier : les réglages au moment de construire (« à la carte » : ceux de la tête de page). */
function palier(id: VarianteId, titre: string, resume: string, morceaux: string[], reglages: () => Reglages): Variante {
  return {
    id,
    titre,
    resume,
    morceaux,
    charger: async () => {
      const m = await import("./scenesPaliers");
      const fab = m.fabriquePalier(reglages);
      return {
        construire: fab,
        rendre: (ts, r, camera, w, h, t) => m.rendrePalier(ts as ReturnType<typeof fab>, r, camera, w, h, t),
        preparer: (ts, r) => (ts as ReturnType<typeof fab>).preparer(r),
        liberer: (r) => m.libererChaine(r),
      };
    },
  };
}

/** Les colonnes de la planche des paliers ; `carte()` rend les réglages de la colonne « à la carte ». */
export function variantesPaliers(carte: () => Reglages): Variante[] {
  const p1 = reglagesDuPalier(1);
  const p2 = reglagesDuPalier(2);
  const p3 = reglagesDuPalier(3);
  return [
    EXISTANT,
    palier("P1", "Palier 1 — base", "Le mélange recommandé du lot 38, nettoyé : lumière de C intégrée, ombres de contact des seuls rebords, mur de pneus allégé, rien en l'air, soleil du bon côté.", [...MORCEAUX_PALIERS.base], () => p1),
    palier("P2", "Palier 2 — finition", "Même chemin de rendu, plus de soin : géométrie, variété, matière (textures fines, relief, traces), reflets du ciel.", [...MORCEAUX_PALIERS.base, ...MORCEAUX_PALIERS.finition], () => p2),
    palier("P3", "Palier 3 — vitrine", "Le plafond : ombres nettes et loin, occlusion, brume, nuages, vie (drapeaux, foule, écrans, particules), post-traitement.", [...MORCEAUX_PALIERS.base, ...MORCEAUX_PALIERS.finition, ...MORCEAUX_PALIERS.vitrine], () => p3),
    palier("carte", "À la carte", "Les pas cochés en tête de page (réglages communs avec la vue en mouvement).", [...MORCEAUX_PALIERS.base, ...MORCEAUX_PALIERS.finition, ...MORCEAUX_PALIERS.vitrine], carte),
  ];
}
