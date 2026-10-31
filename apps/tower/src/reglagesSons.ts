import { storageKey } from "./stockage";

// Le réglage des sons de Tower (lot T5) : une case « Sons » et un volume, **dans la pause** (charte : les actions rares vont dans la pause). **Il n'existe pas de réglage de sons commun à la
// plateforme** (Track garde `cdj:audio`, Jump `jump:settings`, la musique commune `cdj:musique` ne règle que la musique) : Tower garde le sien, `tower:sons` (donnée de jeu, effacée au « Nouveau
// départ »). Lectures et écritures protégées : sans stockage, les sons sont allumés au volume par défaut.

export interface ReglagesSons {
  actifs: boolean;
  /** Le volume des effets, 0 à 1. */
  volume: number;
}
export const SONS_DEFAUT: Readonly<ReglagesSons> = { actifs: true, volume: 0.8 };
export const CLE_SONS = storageKey("sons");

export function lireSons(s: Pick<Storage, "getItem"> | null): ReglagesSons {
  try {
    const brut = s?.getItem(CLE_SONS);
    if (!brut) return { ...SONS_DEFAUT };
    const o = JSON.parse(brut) as Partial<ReglagesSons>;
    const volume = typeof o.volume === "number" && Number.isFinite(o.volume) ? Math.min(1, Math.max(0, o.volume)) : SONS_DEFAUT.volume;
    return { actifs: typeof o.actifs === "boolean" ? o.actifs : SONS_DEFAUT.actifs, volume };
  } catch {
    return { ...SONS_DEFAUT };
  }
}

export function ecrireSons(s: Pick<Storage, "setItem"> | null, r: ReglagesSons): void {
  try {
    s?.setItem(CLE_SONS, JSON.stringify({ actifs: r.actifs, volume: Math.round(r.volume * 100) / 100 }));
  } catch {
    // Pas de stockage : le réglage vaut pour la session.
  }
}
