import "@cdj/ui/src/tacourse.css";
import { traducteur, type Langue } from "@cdj/ui";
import { CATALOGUE_TACOURSE } from "@cdj/ui/src/catalogue.tacourse";
import { course } from "@cdj/ui/src/tacourse";
import type { Classement } from "./classementDonnees";
import { courseDesJoueurs, type ContexteCourse } from "./classementCourse";

// Lot U6 — « Ta course » de `/classement/`, **chargée à la demande** : la page affiche d'abord le podium et la liste, puis — seulement si tu y es classé (`moi`) — ce module, sa feuille et son catalogue arrivent et la barre se pose dans
// la colonne de droite (sur téléphone la feuille de la page la fixe au-dessus des onglets). Rien dans le premier chargement de la page.

/** Pose la barre dans `zone` (la page a pu se redessiner entre-temps : une zone qui n'est plus dans la page est ignorée). */
export function monterLaCourse(zone: HTMLElement | null, c: Classement, langue: Langue, contexte: ContexteCourse): void {
  if (!zone || !zone.isConnected) return;
  const donnees = courseDesJoueurs(c, contexte);
  zone.replaceChildren(...(donnees ? [course(traducteur(langue, CATALOGUE_TACOURSE), donnees)] : []));
  zone.closest(".classement-page")?.classList.toggle("classement-page--course", donnees !== null);
}
