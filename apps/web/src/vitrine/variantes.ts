// Lot 38 — les colonnes de la vitrine : l'existant (la vraie scène du jeu, `buildTrackScene`), les trois directions et le mélange recommandé.
// Chaque direction est chargée à la demande (`import()`) : un morceau à elle, dont la construction mesure le poids (vite.vitrine.config.ts).
import type { PaletteName, Track } from "@cdj/sim";
import { buildTrackScene, type TrackScene } from "../trackMesh";
import { composerScene } from "../scene/composer";

export type VarianteId = "existant" | "A" | "B" | "C" | "M";

export interface Variante {
  id: VarianteId;
  titre: string;
  resume: string;
  /** Le morceau dont le poids est celui de la direction (poids.json, mesuré à la construction). */
  morceaux: string[];
  /** Charge la direction (son morceau) et rend sa fonction de construction : on mesure la construction seule, sans le chargement. */
  charger(): Promise<(track: Track, palette: PaletteName) => TrackScene>;
}

export const VARIANTES: Variante[] = [
  {
    id: "existant",
    titre: "Existant",
    resume: "La scène du jeu aujourd'hui (lot 23).",
    morceaux: [],
    charger: async () => (track, palette) => buildTrackScene(track, palette),
  },
  {
    id: "A",
    titre: "A — Net et graphique",
    resume: "Silhouettes franches, peu de pièces, aplats, bandes et marquages forts, lumière en trois tons (la charte « Cartouches » en 3D).",
    morceaux: ["directionA"],
    charger: async () => {
      const { DIRECTION_A } = await import("../scene/directionA");
      return (track, palette) => composerScene(track, palette, DIRECTION_A);
    },
  },
  {
    id: "B",
    titre: "B — Détaillé",
    resume: "Formes chanfreinées et petites pièces qui racontent (pneus, drapeaux, câbles, rivets, sponsors fictifs), matériaux variés ; tout fusionné.",
    morceaux: ["directionB"],
    charger: async () => {
      const { DIRECTION_B } = await import("../scene/directionB");
      return (track, palette) => composerScene(track, palette, DIRECTION_B);
    },
  },
  {
    id: "C",
    titre: "C — Lumière et matière",
    resume: "Les formes de l'existant ; le ciel, la brume, la lumière et l'ombrage par thème, l'occlusion par sommets, des textures dessinées au chargement.",
    morceaux: ["directionC"],
    charger: async () => {
      const { appliquerC } = await import("../scene/directionC");
      return (track, palette) => appliquerC(buildTrackScene(track, palette), palette, track);
    },
  },
  {
    id: "M",
    titre: "Mélange recommandé",
    resume: "La proposition du lot : les éléments et rebords de A, un décor de B allégé, la lumière de C.",
    morceaux: ["directionM", "directionA", "directionB", "directionC"],
    charger: async () => {
      const [{ DIRECTION_M }, { appliquerC }] = await Promise.all([import("../scene/directionM"), import("../scene/directionC")]);
      return (track, palette) => appliquerC(composerScene(track, palette, DIRECTION_M), palette, track, { melange: true });
    },
  },
];
