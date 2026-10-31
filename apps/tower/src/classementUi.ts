import { el, formatNombre, formatRang, suivreDialogue } from "@cdj/ui";
import { type ClassementTower, type LigneTower, medailleLue } from "./apiTower";
import { langueCourante, t } from "./i18n";
import { formatHauteur } from "./formatHauteur";

// Le classement du jour de Tower, côté DOM (lot T4) : la même ligne (rang, pseudo, vies, hauteur) pour le bloc de l'accueil (les trois premiers, « … », ta ligne en moutarde), pour l'arrivée
// et pour le classement en dialogue sur la scène (les 50 premiers et ta ligne, sur le modèle de `jump-classement.html`). Tout texte vient du catalogue ; un pseudo est une donnée : posé en
// `textContent`, jamais interprété (règle R7).

/** Une ligne : `rang · pseudo · vies · hauteur`. `moi` : ta ligne (moutarde). */
export function ligneClassement(l: LigneTower, moi = false): HTMLElement {
  const m = medailleLue(l.medal);
  return el(
    "li",
    { classe: ["rang", moi && "rang--moi"], attrs: { "data-rang": String(l.rank), ...(m ? { "data-medaille": m } : {}) } },
    el("b", { classe: "rang__n", texte: formatRang(l.rank, langueCourante()) }),
    el("span", { classe: "rang__nom", texte: moi ? t("classement.toi") : l.name }),
    el("span", { classe: "rang__vies", texte: t("classement.vies", { n: l.vies }) }),
    el("b", { classe: "rang__hauteur", texte: formatHauteur(l.hauteurMm) }),
  );
}

/** Le séparateur « … » entre les premiers et ta ligne. */
export const separateur = (): HTMLElement => el("li", { classe: "rang rang--trou", attrs: { "aria-hidden": "true" } }, el("b", { classe: "rang__n", texte: "…" }));

/** Les trois premiers, « … » si ta place est plus loin, puis ta ligne : le bloc de l'accueil. Rend les lignes (vide : personne n'est classé). */
export function lignesDeLAccueil(b: ClassementTower, n = 3): HTMLElement[] {
  const haut = b.top.slice(0, n);
  const lignes = haut.map((l) => ligneClassement(l, b.me !== null && l.rank === b.me.rank && l.name === b.me.name));
  if (b.me && b.me.rank > n) {
    if (b.me.rank > n + 1) lignes.push(separateur());
    lignes.push(ligneClassement(b.me, true));
  }
  return lignes;
}

/** Le texte de l'en-tête : « 96 classés ». */
export const nombreDeClasses = (n: number): string => t("classement.classes", { n, total: formatNombre(n, langueCourante()) });

export interface DialogueClassement {
  ouvrir(b: ClassementTower | null, etat?: "ok" | "chargement" | "indisponible"): void;
  fermer(): void;
  readonly ouvert: boolean;
}

/**
 * Le classement en dialogue sur la scène : les 50 premiers et ta ligne ; « Fermer ». `racine` : l'élément qui porte déjà la scène (le voile à rayures est posé dessus, comme la pause).
 */
export function monterClassement(racine: HTMLElement, o: { surFermeture?: () => void } = {}): DialogueClassement {
  const voile = el("div", { classe: "voile voile--classement", attrs: { id: "classement-ecran", hidden: true } });
  const dialogue = el("section", { classe: "dialogue dialogue--classement", attrs: { role: "dialog", "aria-modal": "true" } });
  const titre = el("h2", { classe: "dialogue__titre" });
  const sous = el("span", { classe: "classement__sous" });
  const liste = el("ol", { classe: "rangs", attrs: { id: "classement-liste" } });
  const message = el("p", { classe: "classement__message", attrs: { role: "status" } });
  const fermer = el("button", { classe: "bouton-jouer bouton-jouer--petit", attrs: { type: "button", id: "classement-fermer" } });
  dialogue.append(el("div", { classe: "classement__tete" }, titre, sous), message, liste, fermer);
  voile.append(dialogue);
  racine.append(voile);
  suivreDialogue(voile, { focusInitial: () => fermer });
  let ouvert = false;
  const fermerTout = () => {
    if (!ouvert) return;
    ouvert = false;
    voile.hidden = true;
    o.surFermeture?.();
  };
  fermer.addEventListener("click", fermerTout);
  voile.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      fermerTout();
    }
  });
  return {
    get ouvert() {
      return ouvert;
    },
    ouvrir(b, etat = "ok") {
      dialogue.setAttribute("aria-label", t("classement.titre"));
      titre.textContent = t("classement.titre");
      fermer.textContent = t("classement.fermer");
      sous.textContent = b ? nombreDeClasses(b.participants) : "";
      message.textContent = etat === "chargement" ? t("classement.chargement") : etat === "indisponible" || !b ? t("classement.indisponible") : b.participants === 0 ? t("classement.vide") : "";
      message.hidden = message.textContent === "";
      liste.replaceChildren();
      if (b && b.participants > 0) {
        liste.append(...b.top.map((l) => ligneClassement(l, b.me !== null && l.rank === b.me.rank && l.name === b.me.name)));
        if (b.me && b.me.rank > b.top.length) liste.append(separateur(), ligneClassement(b.me, true));
      }
      ouvert = true;
      voile.hidden = false;
      dialogue.scrollTop = 0;
    },
    fermer: fermerTout,
  };
}
