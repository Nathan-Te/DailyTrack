import { el, suivreDialogue, svg } from "@cdj/ui";
import { installerCataloguesDesEcrans } from "./catalogue.ecrans.fr";
import { installerCataloguesDuJeu } from "./catalogue.jeu.fr";
import { commandes } from "./commandes";
import { boutonJouer } from "./composants";
import { langueCourante, t } from "./i18n";
import { storageKey } from "./stockage";

// « Comment jouer » (lot T4), en dialogue sur le modèle de Jump : trois points courts, le schéma des commandes, « C'est parti ». **Montré une fois au premier lancement**, puis à la demande
// (le bouton de l'accueil, la pause). Chargé à la demande (il ne pèse pas sur le premier chargement). Le drapeau « déjà vu » est la clé gardée `tower:aide:vu` (une donnée de jeu).
// Lot T7 (règle M2) : **le schéma cite les touches CHOISIES** (`commandes.ts`), jamais des touches écrites ici ; il est redessiné à chaque ouverture (un changement dans Réglages › Commandes s'y lit tout de suite).

export const CLE_AIDE_VUE = storageKey("aide:vu");

type Magasin = Pick<Storage, "getItem" | "setItem"> | null;

/** L'aide a-t-elle déjà été montrée à ce navigateur ? (stockage illisible : non, elle se remontrerait à chaque visite — c'est voulu.) */
export function aideDejaVue(stockage: Magasin): boolean {
  try {
    return stockage?.getItem(CLE_AIDE_VUE) === "1";
  } catch {
    return false;
  }
}

export function marquerAideVue(stockage: Magasin): void {
  try {
    stockage?.setItem(CLE_AIDE_VUE, "1");
  } catch {
    /* stockage refusé : elle se remontrera */
  }
}

const touche = (texte: string): HTMLElement => el("kbd", { classe: "touche", texte });
/** Les touches choisies d'une ou plusieurs actions, deux au plus chacune (l'origine en a deux ou trois). */
const touchesDe = (...ids: string[]): HTMLElement[] => ids.flatMap((id) => commandes.nomsTouches(id, langueCourante()).slice(0, 2).map(touche));

/** Le schéma des commandes : ce que fait chaque touche (clavier, celles du joueur) — ou chaque bouton (écran tactile). */
function schema(tactile: boolean): HTMLElement {
  const ligne = (touches: HTMLElement[], cle: string): HTMLElement => el("div", { classe: "aide__commande" }, el("span", { classe: "aide__touches" }, ...touches), el("span", { texte: t(cle) }));
  if (tactile) {
    const bouton = (d: string): SVGSVGElement => svg("svg", { classe: "aide__icone", attrs: { viewBox: "0 0 30 30", width: 22, height: 22, "aria-hidden": "true" } }, svg("path", { attrs: { d } }));
    const pastille = (d: string): HTMLElement => el("span", { classe: "touche touche--icone" }, bouton(d));
    return el(
      "div",
      { classe: "aide__schema", attrs: { role: "group", "aria-label": t("aide.commandes") } },
      ligne([pastille("M19 5 9 15l10 10"), pastille("M11 5l10 10-10 10")], "aide.deplacer"),
      ligne([pastille("M6 5l9 9 9-9M6 15l9 9 9-9")], "aide.descendre"),
      ligne([pastille("M25 16a9 9 0 1 1-3-6.7")], "aide.tourner"),
    );
  }
  return el(
    "div",
    { classe: "aide__schema", attrs: { role: "group", "aria-label": t("aide.commandes") } },
    ligne(touchesDe("gauche", "droite"), "aide.deplacer"),
    ligne(touchesDe("tourner"), "aide.tourner"),
    ligne(touchesDe("descendre"), "aide.descendre"),
    ligne(touchesDe("pause"), "aide.pause"),
    el("p", { classe: "aide__note", texte: t("aide.manette") }),
    el("p", { classe: "aide__note", texte: t("aide.reglables") }),
  );
}

export interface Aide {
  readonly ouverte: boolean;
  ouvrir(): void;
  fermer(): void;
}

/** Monte le dialogue sur `racine` (le voile à rayures est posé dessus), fermé ; `surFermeture` : après « C'est parti » ou Échap. */
export function monterAide(racine: HTMLElement, o: { tactile: boolean; surFermeture?: () => void }): Aide {
  installerCataloguesDuJeu();
  installerCataloguesDesEcrans();
  const voile = el("div", { classe: "voile voile--aide", attrs: { id: "aide-ecran", hidden: true } });
  const dialogue = el("section", { classe: "dialogue dialogue--aide", attrs: { role: "dialog", "aria-modal": "true", "aria-label": t("aide.titre") } });
  const ok = boutonJouer(t("aide.ok"), () => fermer(), "aide-ok");
  let schemaCourant = schema(o.tactile);
  dialogue.append(
    el("h2", { classe: "dialogue__titre", texte: t("aide.titre") }),
    el("ol", { classe: "aide__points" }, ...(["aide.point1", "aide.point2", "aide.point3"] as const).map((cle) => el("li", { texte: t(cle) }))),
    schemaCourant,
    ok,
  );
  voile.append(dialogue);
  racine.append(voile);
  suivreDialogue(voile, { focusInitial: () => ok });
  let ouverte = false;
  function fermer(): void {
    if (!ouverte) return;
    ouverte = false;
    voile.hidden = true;
    o.surFermeture?.();
  }
  voile.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    fermer();
  });
  return {
    get ouverte() {
      return ouverte;
    },
    ouvrir() {
      if (ouverte) return;
      ouverte = true;
      const nouveau = schema(o.tactile); // les touches ont pu changer depuis la dernière ouverture
      schemaCourant.replaceWith(nouveau);
      schemaCourant = nouveau;
      dialogue.scrollTop = 0;
      voile.hidden = false;
    },
    fermer,
  };
}
