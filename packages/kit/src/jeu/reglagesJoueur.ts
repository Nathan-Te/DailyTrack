// Les réglages du joueur d'un jeu neuf (`<id>:reglages`) : lus en partie (animations réduites, fantôme au départ, vibration), écrits par l'écran Réglages. Jamais dans la simulation.
// Lot B1 : `vibration` (« oui » par défaut) — une clé de plus dans la MÊME donnée de stockage (`<id>:reglages`) : aucune nouvelle clé du navigateur.
export interface ReglagesJoueur {
  v: 1;
  mouvement: "normal" | "reduit";
  fantome: "aucun" | "meilleure";
  vibration: "oui" | "non";
}
const DEFAUT: ReglagesJoueur = { v: 1, mouvement: "normal", fantome: "aucun", vibration: "oui" };
const cle = (c: { fiche: { prefixe: string } }): string => `${c.fiche.prefixe}reglages`;

export function lireReglages(c: { fiche: { prefixe: string } }, stockage: Pick<Storage, "getItem"> | null): ReglagesJoueur {
  try {
    const j = JSON.parse(stockage?.getItem(cle(c)) ?? "null") as Partial<ReglagesJoueur> | null;
    return { v: 1, mouvement: j?.mouvement === "reduit" ? "reduit" : "normal", fantome: j?.fantome === "meilleure" ? "meilleure" : "aucun", vibration: j?.vibration === "non" ? "non" : "oui" };
  } catch {
    return DEFAUT;
  }
}
export function ecrire(c: { fiche: { prefixe: string } }, stockage: Pick<Storage, "setItem"> | null, r: ReglagesJoueur): void {
  try {
    stockage?.setItem(cle(c), JSON.stringify(r));
  } catch {
    /* stockage refusé : le réglage vaut pour cette page */
  }
}

/** Le vibreur d'une partie (pur, testé) : lit le réglage à chaque appel (un réglage changé en pause vaut tout de suite) et ne vibre que sur un appareil tactile qui sait vibrer. */
export function creerVibreur(lire: () => ReglagesJoueur, nav: { vibrate?: (motif: number | number[]) => boolean } | null, tactile: boolean): (motif: number | readonly number[]) => void {
  return (motif) => {
    if (!tactile || typeof nav?.vibrate !== "function" || lire().vibration !== "oui") return;
    try {
      nav.vibrate(typeof motif === "number" ? motif : [...motif]);
    } catch {
      /* vibration refusée par le navigateur : rien */
    }
  };
}
