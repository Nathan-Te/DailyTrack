// Lot 52 — l'arithmétique commune de la glissière, du volant et du gyroscope : une direction analogique ∈ [-1, 1] à partir d'une course normalisée.
// Logique pure, testée par Vitest. Chargé à la demande avec les modes (jamais dans le premier chargement).

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * La direction pour une course normalisée `d` (±1 = braquage à fond, sans zone morte) : zéro dans la zone morte, puis linéaire jusqu'au plein braquage.
 * C'est la forme qu'avait le glissement du joystick (lot 10) : un ancien réglage de sensibilité et de zone morte garde son sens.
 */
export function shape(d: number, deadzone: number): number {
  const a = Math.abs(d);
  if (a <= deadzone) return 0;
  const v = Math.min(1, (a - deadzone) / (1 - deadzone));
  return d < 0 ? -v : v;
}

/** Un angle ramené à ]−180, 180] degrés. */
export function wrap180(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/**
 * Les plages des curseurs de sensibilité et de zone morte, les mêmes que `SENSITIVITY_RANGE` et `DEADZONE_RANGE` de `touch.ts` (un test le vérifie) : les modules chargés à
 * la demande n'importent aucune valeur de `touch.ts` ni de `touchUi.ts`, pour que l'empaqueteur laisse ces deux fichiers dans le premier chargement, d'un seul tenant.
 */
export const PLAGE_SENSIBILITE = { min: 0.5, max: 2, step: 0.05 } as const;
export const PLAGE_ZONE_MORTE = { min: 0, max: 0.3, step: 0.01 } as const;
