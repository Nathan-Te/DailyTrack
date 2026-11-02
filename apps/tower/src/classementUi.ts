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
    { classe: ["rang", moi && "rang--moi"], attrs: { "data-rang": String(l.rank), ...(m ? { "data-medaille": m } : {}), ...(l.ref ? { "data-ref": l.ref } : {}) } },
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

export type EtatClassement = "ok" | "chargement" | "indisponible";

export interface DialogueClassement {
  ouvrir(b: ClassementTower | null, etat?: EtatClassement): void;
  fermer(): void;
  readonly ouvert: boolean;
}

/** Ce que l'accueil et le jeu donnent pour les amis : le serveur (`session.base`), la lecture de l'identité (à l'ouverture : elle peut naître entre-temps) et le jour du classement. `@cdj/profile` n'est pas importé ici : un morceau de plus dans le premier chargement. */
export interface SourceAmis {
  base: string | null;
  id: () => string | null;
  date: string | null;
}

/** Ce que les amis savent de l'écran : un joueur sans identité ni serveur n'a pas de sélecteur (`null`). */
export interface ContexteAmis {
  base: string;
  playerId: string;
  /** Le jour dont le classement est montré (`AAAA-MM-JJ`). */
  date: string;
}

/**
 * Les morceaux de l'écran que le morceau des amis habille (le sélecteur, les lignes touchables, le bloc du bas) et ce qu'il y range : le choix de filtre et son contrôleur. Une ligne touchable porte `data-ref`.
 * Le dialogue n'a, lui, qu'un `import()` : tout le reste (contexte, état, requêtes) est dans `amisClassement.ts`.
 */
export interface HoteAmis {
  tete: HTMLElement;
  sous: HTMLElement;
  message: HTMLElement;
  liste: HTMLElement;
  /** Redessine « Tous » (le dialogue sait le faire seul). */
  rendreTous(): void;
  /** Les lignes et l'en-tête du dialogue, prêtés au morceau des amis (il n'importe rien de ce fichier : un morceau partagé de plus dans le premier chargement). */
  ligne: typeof ligneClassement;
  classes: typeof nombreDeClasses;
  /** D'où lire le contexte des amis (`undefined` : pas d'amis dans ce dialogue). */
  amis?: SourceAmis;
  /** Le filtre choisi, posé par le morceau des amis : « Amis » prend la liste, le dialogue ne redessine plus « Tous ». */
  filtre?: "tous" | "amis";
  controle?: Promise<ControleAmis>;
}

export interface ControleAmis {
  /** Le dialogue vient de s'ouvrir. */
  ouverture(): void;
  /** Le classement « Tous » a changé (ou ne répond pas) ; le dialogue l'a déjà dessiné si « Tous » est choisi. */
  tous(b: ClassementTower | null, etat: EtatClassement): void;
}

/**
 * `racine` : l'élément qui porte déjà la scène (le voile à rayures est posé dessus, comme la pause). `amis` : d'où lire le contexte des amis.
 */
export function monterClassement(racine: HTMLElement, o: { surFermeture?: () => void; amis?: SourceAmis } = {}): DialogueClassement {
  const voile = el("div", { classe: "voile voile--classement", attrs: { id: "classement-ecran", hidden: true } });
  const dialogue = el("section", { classe: "dialogue dialogue--classement", attrs: { role: "dialog", "aria-modal": "true" } });
  const titre = el("h2", { classe: "dialogue__titre" });
  const sous = el("span", { classe: "classement__sous" });
  const tete = el("div", { classe: "classement__tete" }, titre, sous);
  const liste = el("ol", { classe: "rangs", attrs: { id: "classement-liste" } });
  const message = el("p", { classe: "classement__message", attrs: { role: "status" } });
  const fermer = el("button", { classe: "bouton-jouer bouton-jouer--petit", attrs: { type: "button", id: "classement-fermer" } });
  dialogue.append(tete, message, liste, fermer);
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

  let derniere: { b: ClassementTower | null; etat: EtatClassement } = { b: null, etat: "ok" };
  const rendreTous = (): void => {
    const { b, etat } = derniere;
    sous.textContent = b ? nombreDeClasses(b.participants) : "";
    message.textContent = etat === "chargement" ? t("classement.chargement") : etat === "indisponible" || !b ? t("classement.indisponible") : b.participants === 0 ? t("classement.vide") : "";
    message.hidden = message.textContent === "";
    liste.replaceChildren();
    if (b && b.participants > 0) {
      liste.append(...b.top.map((l) => ligneClassement(l, b.me !== null && l.rank === b.me.rank && l.name === b.me.name)));
      if (b.me && b.me.rank > b.top.length) liste.append(separateur(), ligneClassement(b.me, true));
    }
  };

  const hote: HoteAmis = { tete, sous, message, liste, rendreTous, ligne: ligneClassement, classes: nombreDeClasses, amis: o.amis };

  return {
    get ouvert() {
      return ouvert;
    },
    ouvrir(b, etat = "ok") {
      const neuve = !ouvert;
      derniere = { b, etat };
      dialogue.setAttribute("aria-label", t("classement.titre"));
      titre.textContent = t("classement.titre");
      fermer.textContent = t("classement.fermer");
      if (hote.filtre !== "amis") rendreTous();
      ouvert = true;
      voile.hidden = false;
      if (neuve) dialogue.scrollTop = 0;
      // Lot F2 : le morceau des amis (sélecteur, feuille, lignes « Amis »), à la demande, seulement dans un dialogue qui a une source d'amis.
      if (o.amis) void import("./amisClassement").then((m) => m.surOuverture(hote, neuve, b, etat), () => undefined);
    },
    fermer: fermerTout,
  };
}
