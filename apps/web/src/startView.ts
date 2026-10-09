// Vue de départ plongeante (lot 25) : au Col alpin, pendant le décompte, la caméra est haute derrière la voiture et regarde la descente,
// loin en contrebas ; elle rejoint la caméra de poursuite avant le départ. Présentation seule : rien dans `sim`.

/** Réglages de la vue : hauteur et recul de la caméra au-dessus de la voiture (m). */
export const PLUNGE = { up: 48, back: 14 } as const;
/** Bloc du circuit que la vue regarde (la descente, quelques blocs devant le départ). */
export const PLUNGE_LOOK_BLOCK = 12;
/** La vue est entière jusqu'à ce temps restant au décompte (s), puis glisse vers la poursuite jusqu'à `PLUNGE_END`. */
export const PLUNGE_HOLD = 1.6;
export const PLUNGE_END = 0.3;

/** Part de la vue plongeante (1 = entière, 0 = caméra de poursuite) selon le temps restant au décompte (s) ; lissage cubique. */
export function plungeMix(countdownLeft: number): number {
  const t = (countdownLeft - PLUNGE_END) / (PLUNGE_HOLD - PLUNGE_END);
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Point visé par la vue : la route `PLUNGE_LOOK_BLOCK` blocs plus loin (ou le dernier bloc), à partir de la ligne médiane du circuit. */
export function plungeTarget(line: { x: number[]; y: number[]; z: number[]; block: number[] }): [number, number, number] {
  let k = line.block.findIndex((b) => b >= PLUNGE_LOOK_BLOCK);
  if (k < 0) k = line.x.length - 1;
  return [line.x[k]!, line.y[k]!, line.z[k]!];
}
