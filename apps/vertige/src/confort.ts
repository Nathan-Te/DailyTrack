// Le confort de jeu : ce que le joueur règle pour sa tête et son estomac, jamais pour la simulation (la partie rejouée par le serveur n'en dépend pas) — la sensibilité de la souris, le champ de vision (70 à 110°),
// l'inclinaison de la caméra sur le mur et le balancement de la marche (activés ou non), la durée de la transition de la caméra à une bascule de gravité (réglée dans `?debug&tune`). Une seule clé de stockage, `vertige:confort` (un réglage gardé de la fiche : `donnees.stockage.reglagesGardes`).
export interface Confort {
  /** En pour cent de la sensibilité d'origine (0,0022 rad par point de souris). */
  sensibilite: number;
  /** Le champ de vision vertical, en degrés. */
  champ: number;
  roulis: boolean;
  /** Le léger balancement de la caméra à la marche (lot V1 : le retour de sensation passe par la caméra, il n'y a plus de mains). */
  balancement: boolean;
  /** La durée, en millisecondes, de la transition de la caméra quand la gravité tourne (0 : sec). */
  transition: number;
}
export const CONFORT_DEFAUT: Readonly<Confort> = { sensibilite: 100, champ: 84, roulis: true, balancement: true, transition: 300 };
export const BORNES_CONFORT = { sensibilite: [20, 300], champ: [70, 110], transition: [0, 1000] } as const;
export const CLE_CONFORT = "vertige:confort";

const borne = (v: unknown, [min, max]: readonly [number, number], defaut: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : defaut);

/** Un confort lu d'un objet quelconque (stockage, adresse) : chaque valeur bornée, le reste prend la valeur d'origine. */
export function confortDe(brut: unknown, base: Readonly<Confort> = CONFORT_DEFAUT): Confort {
  const j = (typeof brut === "object" && brut !== null ? brut : {}) as Record<string, unknown>;
  return {
    sensibilite: borne(j.sensibilite, BORNES_CONFORT.sensibilite, base.sensibilite),
    champ: borne(j.champ, BORNES_CONFORT.champ, base.champ),
    roulis: typeof j.roulis === "boolean" ? j.roulis : base.roulis,
    balancement: typeof j.balancement === "boolean" ? j.balancement : base.balancement,
    transition: borne(j.transition, BORNES_CONFORT.transition, base.transition),
  };
}

export function lireConfort(stockage: Pick<Storage, "getItem"> | null): Confort {
  try {
    return confortDe(JSON.parse(stockage?.getItem(CLE_CONFORT) ?? "null"));
  } catch {
    return { ...CONFORT_DEFAUT };
  }
}
export function ecrireConfort(stockage: Pick<Storage, "setItem"> | null, c: Confort): void {
  try {
    stockage?.setItem(CLE_CONFORT, JSON.stringify(c));
  } catch {
    /* stockage refusé : le réglage vaut pour cette page */
  }
}
