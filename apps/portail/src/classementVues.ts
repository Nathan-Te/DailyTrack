import type { Classement, LigneClassement } from "./classementDonnees";
import type { Jour, JoueurDuJour } from "./jour";

// Lot A1 : la logique pure du classement du jour au chrono — les onglets (Cumulé · un jeu par jeu du jour), la vue gardée dans l'adresse (`?vue=`), la
// séparation « Un jeu sur deux » et ce que dit la tuile de l'accueil. Sans DOM, testée dans `test/classementVues.test.ts`.

/** La vue par défaut : le cumul des jeux du jour. Les autres vues sont le dossier d'un jeu sur le site (`track`, `jump`). */
export const VUE_CUMUL = "cumul";

/** La vue demandée par l'adresse (`?vue=`) : le cumul si elle manque ou n'a pas la forme d'un dossier de jeu (le serveur dit si le jeu existe ce jour-là). */
export function vueDeLAdresse(search: string): string {
  const brut = new URLSearchParams(search).get("vue");
  return brut !== null && /^[a-z][a-z0-9-]{0,19}$/.test(brut) ? brut : VUE_CUMUL;
}

/** L'adresse qui garde le jour et la vue affichés (aujourd'hui et le cumul : rien dans l'adresse). Rend un nouvel objet, `href` n'est pas modifié. */
export function adresseDeVue(href: string, o: { date: string | null; vue: string }): URL {
  const url = new URL(href);
  // Toujours dans le même ordre (`date` puis `vue`) : une adresse ne change pas selon le chemin qui y a mené.
  url.searchParams.delete("date");
  url.searchParams.delete("vue");
  if (o.date !== null) url.searchParams.set("date", o.date);
  if (o.vue !== VUE_CUMUL) url.searchParams.set("vue", o.vue);
  return url;
}

/** Un onglet : l'identifiant de la vue, le code du jeu au registre (absent pour le cumul) et son nom si le serveur le déclare. */
export interface Onglet {
  vue: string;
  jeu?: string;
  nom?: string;
}

/** Les onglets d'un jour : Cumulé, puis un par jeu qui existe ce jour-là, dans l'ordre du registre (Track, Jump). */
export function onglets(jeux: readonly { jeu: string; site: string; nom: string }[]): Onglet[] {
  return [{ vue: VUE_CUMUL }, ...jeux.map((j) => ({ vue: j.site, jeu: j.jeu, nom: j.nom }))];
}

/** L'onglet voisin au clavier (flèches, Début, Fin), en bouclant ; `null` pour une autre touche. */
export function ongletVoisin(position: number, total: number, touche: string): number | null {
  if (touche === "ArrowRight") return (position + 1) % total;
  if (touche === "ArrowLeft") return (position - 1 + total) % total;
  if (touche === "Home") return 0;
  if (touche === "End") return total - 1;
  return null;
}

/**
 * La séparation « Un jeu sur deux » : la position (dans `lignes`) de la première ligne d'un joueur qui n'a pas fini tous les jeux, ou `null` s'il n'y
 * en a pas (la vue d'un jeu, un jour où tout le monde a tout fini, ou personne). Les lignes complètes viennent toujours d'abord (règle du serveur).
 */
export function positionSeparation(lignes: readonly Pick<LigneClassement, "complet">[]): number | null {
  const i = lignes.findIndex((l) => !l.complet);
  return i < 0 ? null : i;
}

/** Faut-il montrer la séparation dans ce classement ? Seulement dans le cumul. */
export const aSeparation = (c: Pick<Classement, "vue" | "top">): number | null => (c.vue === VUE_CUMUL ? positionSeparation(c.top) : null);

/**
 * Ce que dit la tuile « Classement du jour » de l'accueil :
 *  - `cumul` : la place et le temps cumulé (« 9e », « 1:42,315 cumulés ») ;
 *  - `manque` : un seul jeu fini — sa place sous « Un jeu sur deux » et le jeu à finir pour avoir un cumul (« Finis Jump pour le cumul ») ;
 *  - `inviter` : aucun jeu fini aujourd'hui (l'invitation d'avant).
 */
export type TuileClassement =
  | { type: "cumul"; rang: number; cumulMs: number }
  | { type: "manque"; rang: number; jeu: { jeu: string; nom?: string } }
  | { type: "inviter" };

export function tuileDuClassement(joueur: JoueurDuJour | undefined, jeux: Jour["jeux"]): TuileClassement {
  const rang = joueur?.rangDuJour;
  if (!joueur || rang == null) return { type: "inviter" };
  if (joueur.cumulMs != null) return { type: "cumul", rang, cumulMs: joueur.cumulMs };
  const manquant = jeux.find((j) => j.etat?.statut !== "fini");
  return manquant ? { type: "manque", rang, jeu: { jeu: manquant.jeu, nom: manquant.nom } } : { type: "inviter" };
}
