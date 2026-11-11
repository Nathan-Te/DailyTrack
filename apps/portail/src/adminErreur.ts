import { el } from "@cdj/ui";
import { ErreurAdmin, texteErreur } from "./adminDonnees";

// Lot K5b (plateforme) — le refus d'une action confirmée du panneau, qu'on ne rate pas : le serveur refuse après que la fenêtre de confirmation s'est fermée, et le message ne doit pas
// tomber loin de l'action. Le refus s'affiche **sur la ligne de l'action** (la fiche d'un jeu, une image, un groupe, une ligne de résultat, une nouveauté…), en bandeau d'erreur de la
// charte (`admin-message--erreur`), avec `role="alert"` et le focus ; il reste jusqu'à l'action suivante (la fenêtre de confirmation suivante, ou la vue redessinée l'efface).
// La ligne est celle du bouton cliqué (`suivreDeclencheur`, écouteur en capture sur la page : Safari ne donne pas le focus à un bouton qu'on clique, `activeElement` ne servirait pas) ;
// les clics dans une fenêtre de dialogue ne comptent pas (le bouton « Confirmer » n'est pas l'action). Tout est posé en `textContent`.

export const CLASSE_REFUS = "admin-refus-action";
const CLASSE_LIGNE_REFUS = "admin-refus-action-ligne";

let declencheur: Element | null = null;

/** Retient le dernier bouton ou lien cliqué hors d'un dialogue : c'est lui qui désigne la ligne de l'action. À installer une fois. */
export function suivreDeclencheur(doc: Document = document): void {
  doc.addEventListener(
    "click",
    (ev) => {
      const cible = (ev.target as Element | null)?.closest?.("button, a");
      if (cible && !cible.closest("dialog")) declencheur = cible;
    },
    true,
  );
}

/** Retire le bandeau de refus affiché (la prochaine action commence). */
export function effacerRefus(doc: Document = document): void {
  doc.querySelectorAll(`.${CLASSE_LIGNE_REFUS}, .${CLASSE_REFUS}`).forEach((n) => n.remove());
}

/**
 * Pose le bandeau d'erreur sur la ligne de l'action (`depuis`, par défaut le dernier bouton cliqué) et lui donne le focus. La ligne : le `tr`, `li`, `section` ou `article` le plus proche ;
 * dans un tableau le bandeau prend sa propre ligne juste dessous ; sinon il suit le groupe de boutons de l'action. Sans ligne trouvée (bouton disparu), il ouvre le contenu.
 */
export function poserRefus(texte: string, depuis: Element | null = declencheur): HTMLElement {
  const doc = depuis?.ownerDocument ?? document;
  effacerRefus(doc);
  const bandeau = el("p", { classe: ["admin-message", "admin-message--erreur", CLASSE_REFUS], attrs: { role: "alert", tabindex: "-1", "data-refus-action": "" }, texte });
  const ligne = depuis?.isConnected ? depuis.closest("tr, li, section, article") : null;
  if (!ligne) doc.querySelector(".admin-contenu")?.prepend(bandeau);
  else if (ligne.tagName === "TR") ligne.after(el("tr", { classe: CLASSE_LIGNE_REFUS }, el("td", { attrs: { colspan: String(Math.max(1, ligne.children.length)) } }, bandeau)));
  else {
    const groupe = depuis!.closest(".admin-actions");
    if (groupe && ligne.contains(groupe) && groupe.parentElement) groupe.after(bandeau);
    else ligne.append(bandeau);
  }
  bandeau.focus();
  return bandeau;
}

/** Le refus d'une action confirmée : un 401 ramène à la connexion, le reste se dit sur la ligne de l'action. `texte` : un texte plus précis que celui du code. */
export async function refuserAction(ctx: { sessionExpiree: () => Promise<void> }, e: unknown, texte?: string): Promise<void> {
  if (e instanceof ErreurAdmin && e.statut === 401) await ctx.sessionExpiree();
  else poserRefus(texte ?? texteErreur(e));
}
