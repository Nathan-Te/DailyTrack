import type { Lecteur, StockageMin } from "./lecteur";
import type { JeuMusique } from "./types";

// **Le branchement : une ligne par jeu** — `const musique = brancherMusique("track", gameStorage)` — et c'est tout le premier chargement. Ce fichier n'importe rien d'autre que
// des types : le lecteur (`demarrage.ts`) n'est chargé qu'au **premier geste** du joueur, jamais avant (testé : `test/premierChargement.test.ts`). Le jeu peut ensuite baisser la
// musique (`baisser(0.4)` en course), la couper avec son propre son (`sourdine(true)`) et ouvrir les réglages (`reglages` : le lecteur, chargé s'il ne l'est pas encore).

export interface Musique {
  /** Où en est le jeu : `menu` (l'accueil) ou `theme:<code>` (un niveau de ce thème) ; `null` : nulle part en particulier. La musique suit en fondu (`docs/plateforme/musique.md`). */
  scene(nom: string | null): void;
  /** Le niveau demandé par le jeu, de 0 à 1 (1 : pleine). Garde la dernière valeur jusqu'au chargement du lecteur. */
  baisser(niveau: number): void;
  /** Le son du jeu est coupé : la musique aussi. */
  sourdine(coupe: boolean): void;
  /** Le lecteur (le charge s'il ne l'est pas : à appeler depuis un geste, par exemple l'ouverture des réglages). */
  lecteur(): Promise<Lecteur>;
}

const GESTES = ["pointerdown", "keydown", "touchend", "click"];

export function brancherMusique(jeu: JeuMusique, stockage?: () => StockageMin | null): Musique {
  const q = { baisse: 1, sourdine: false, scene: null as string | null };
  let l: Lecteur | undefined;
  let p: Promise<Lecteur> | undefined;
  const charger = () => (p ??= import("./demarrage").then((m) => (l = m.demarrer(jeu, stockage?.() ?? null, q))));
  const demarrer = () => {
    for (const g of GESTES) removeEventListener(g, demarrer);
    void charger().catch(() => undefined);
  };
  for (const g of GESTES) addEventListener(g, demarrer, { passive: true });
  return {
    baisser: (n) => ((q.baisse = n), l?.baisser(n)),
    sourdine: (s) => ((q.sourdine = s), l?.sourdine(s)),
    scene: (n) => ((q.scene = n), l?.scene(n)),
    lecteur: charger,
  };
}
