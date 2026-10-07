import { dailyCircuit, type ThemeName } from "@cdj/sim";

// Fil de travail des miniatures (lot 13) : générer un circuit du jour coûte ≈ 200 ms (le pilote automatique le rejoue pour le
// valider), 800 ms sur un téléphone lent. Les archives en demandent des dizaines : on les fait ici pour ne jamais geler l'écran.
// Le même `dailyCircuit` que le jeu et le serveur : aucun écart possible.

export interface GenRequest {
  seq: number;
  day: number;
  theme: ThemeName | null;
  /** Variante du planning (lot 14) ; 0 = le circuit d'origine. */
  variant?: number;
}
export interface GenReply {
  seq: number;
  spec: string;
  palette: string;
  theme: ThemeName;
  fallback: boolean;
  authorMs: number;
  error?: string;
}

const ctx = self as unknown as { onmessage: ((e: MessageEvent<GenRequest>) => void) | null; postMessage(m: GenReply): void };
ctx.onmessage = (e) => {
  const { seq, day, theme, variant } = e.data;
  try {
    const c = dailyCircuit(day, variant ?? 0, theme);
    ctx.postMessage({ seq, spec: c.spec, palette: c.palette, theme: c.theme, fallback: c.fallback, authorMs: c.authorMs });
  } catch (err) {
    ctx.postMessage({ seq, spec: "", palette: "", theme: "stade", fallback: true, authorMs: 0, error: String(err) });
  }
};
