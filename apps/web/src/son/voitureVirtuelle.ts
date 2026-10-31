// Lot 55 (partie B) — la voiture virtuelle de la planche sonore : une course de 31 s écrite à la main (ralenti, coup de gaz à l'arrêt, accélération
// à fond sur six rapports, lever de pied, freinage avec blocage, relance sur la terre en dérive, turbo, vibreur, saut et réception, arrêt), pour que
// chaque approche soit écoutée sur **exactement** les mêmes situations. Pure : `voitureVirtuelle(t)` ne dépend que du temps.
import type { SurfaceKind } from "@cdj/sim";

export interface TrameVirtuelle {
  speed: number;
  throttle: number;
  brake: boolean;
  slide: number;
  grounded: boolean;
  surface: SurfaceKind;
  kerb: number;
  boost: boolean;
  /** Coupure du moteur (échec de la voiture : non utilisé ici, gardé pour la forme de `AudioFrame`). */
  cut: boolean;
}

export const DUREE_SCENARIO = 31;

/** Les moments du scénario, pour la légende de la planche (et les tests : chaque situation existe). */
export const MOMENTS: readonly { t: number; nom: string }[] = [
  { t: 0, nom: "Ralenti" },
  { t: 1.2, nom: "Coup de gaz à l'arrêt" },
  { t: 3, nom: "Accélération à fond (six rapports)" },
  { t: 14, nom: "Lever de pied" },
  { t: 15.4, nom: "Freinage, pneus qui crissent" },
  { t: 18, nom: "Relance sur la terre, en dérive" },
  { t: 22, nom: "Turbo" },
  { t: 24.5, nom: "Vibreur" },
  { t: 26, nom: "Saut et réception" },
  { t: 26.7, nom: "Roue libre" },
  { t: 29, nom: "Freinage à l'arrêt" },
];

const lerp = (a: number, b: number, x: number) => a + (b - a) * Math.min(1, Math.max(0, x));

export function voitureVirtuelle(temps: number): TrameVirtuelle {
  const t = ((temps % DUREE_SCENARIO) + DUREE_SCENARIO) % DUREE_SCENARIO;
  const base: TrameVirtuelle = { speed: 0, throttle: 0, brake: false, slide: 0, grounded: true, surface: "road", kerb: 0, boost: false, cut: false };
  if (t < 1.2) return base;
  if (t < 3) {
    // Coup de gaz à l'arrêt : le moteur monte, puis retombe.
    const m = t - 1.2;
    return { ...base, throttle: m < 0.25 ? m / 0.25 : m < 0.85 ? 1 : 0 };
  }
  if (t < 14) return { ...base, speed: 76 * (1 - Math.exp(-(t - 3) / 7.5)), throttle: 1 };
  const v14 = 76 * (1 - Math.exp(-(14 - 3) / 7.5));
  if (t < 15.4) return { ...base, speed: v14 - 4.6 * (t - 14) }; // lever de pied : le frein moteur
  const v15 = v14 - 4.6 * 1.4;
  if (t < 18) {
    const x = (t - 15.4) / 2.6;
    return { ...base, speed: lerp(v15, 16, x), brake: true, slide: x < 0.35 ? 0.3 : 0.05 };
  }
  if (t < 22) {
    const m = t - 18;
    return { ...base, speed: 16 + 24 * (1 - Math.exp(-m / 2)), throttle: 1, surface: "dirt", slide: 0.34 * Math.abs(Math.sin((Math.PI * 2 * m) / 1.6)) };
  }
  const v22 = 16 + 24 * (1 - Math.exp(-4 / 2));
  if (t < 24.5) return { ...base, speed: lerp(v22, 62, (t - 22) / 1.2), throttle: 1, boost: t < 23.6 };
  if (t < 26) return { ...base, speed: 62, throttle: 1, kerb: 2 };
  if (t < 26.7) return { ...base, speed: 62, throttle: 0.6, grounded: false };
  if (t < 29) return { ...base, speed: lerp(62, 22, (t - 26.7) / 2.3) };
  const x = (t - 29) / 2;
  return { ...base, speed: lerp(22, 0, x), brake: x < 0.9, slide: x < 0.5 ? 0.14 : 0 };
}

/** Le gaz que la boîte lit : la trame le donne déjà (0 pendant un lever de pied, la roue libre, l'arrêt). */
export const gazDe = (f: TrameVirtuelle): number => (f.cut ? 0 : f.throttle);
