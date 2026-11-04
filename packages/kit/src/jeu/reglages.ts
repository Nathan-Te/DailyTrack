import { barreJeu, cheminMentions, creerCadre, el, type TraducteurCommun } from "@cdj/ui";
import { cleAction, commandesDuJeu } from "./commandes";
import { ecrire, lireReglages, type ReglagesJoueur } from "./reglagesJoueur";
import type { ContexteJeu } from "./types";

// Réglages (à la demande), le cadre commun : **Son** (le bloc commun de la musique : volume, couper, morceau suivant), **Affichage** (les animations réduites, le fantôme au départ), **Commandes** (l'écran du socle :
// Clavier · Manette · Tactile), les liens du profil commun, des mentions légales et de « Un bug ? Une idée ? ». Les réglages s'appliquent tout de suite et se gardent (`<id>:reglages`) ; ils ne touchent jamais à la simulation.
export function monterReglages<C>(c: ContexteJeu<C>): { ouvrir(): void } {
  const { t } = c.i18n;
  let s = lireReglages(c, c.donnees.stockage);
  const cadre = creerCadre({
    id: "jeu-reglages",
    haut: true,
    etiquette: "jeu-ecran",
    barre: () => barreJeu(c.i18n.socle() as unknown as TraducteurCommun, { href: "../", jour: c.jour, retour: { texte: t(`jeu.${c.fiche.id}.nom`).toUpperCase(), ariaLabel: t("kit.reglages.titre"), onClick: () => (cadre.racine.hidden = true) } }),
    aria: () => t("kit.reglages.aria"),
  });
  const segment = <K extends keyof Omit<ReglagesJoueur, "v">>(quoi: K, choix: readonly { valeur: ReglagesJoueur[K]; cle: string }[]): HTMLElement => {
    const groupe = el("div", { classe: "jeu-segment", attrs: { role: "group", "data-setting": quoi, "aria-label": t(`kit.reglages.${quoi}`) } });
    const boutons = choix.map((x) => {
      const b = el("button", { classe: "jeu-segment__bouton", attrs: { type: "button", "data-value": String(x.valeur) }, texte: t(x.cle) });
      b.addEventListener("click", () => {
        s = { ...s, [quoi]: x.valeur };
        ecrire(c, c.donnees.stockage, s);
        maj();
      });
      groupe.append(b);
      return b;
    });
    const maj = (): void => boutons.forEach((b, i) => b.setAttribute("aria-pressed", s[quoi] === choix[i]!.valeur ? "true" : "false"));
    maj();
    return groupe;
  };
  const ligne = (cleNom: string, g: HTMLElement): HTMLElement => el("div", { classe: "jeu-reglages__ligne" }, el("span", { texte: t(cleNom) }), g);
  const placeMusique = el("div", { classe: "jeu-reglages__musique" });
  void import("@cdj/ui/src/panneauMusique").then((m) => m.monterPanneau(() => c.musique.lecteur() as never, placeMusique), () => undefined);
  const hoteCommandes = el("div", { classe: "jeu-reglages__commandes", attrs: { id: "jeu-reglages-commandes" } });
  const commandes = commandesDuJeu(c.fiche, c.def, c.i18n);
  void import("@cdj/ui/src/commandesEcran").then((m) => {
    const e = m.ecranCommandes({ commandes, t: (k) => t(k), cleAction, ongletInitial: c.donnees.tactile ? "tactile" : "clavier", tactile: () => el("p", { classe: "dj-commandes__etat", texte: t("kit.commandes.tactile") }) });
    hoteCommandes.replaceChildren(e.racine);
  });
  const retours = el("button", { classe: "jeu-lien", attrs: { id: "jeu-reglages-retours", type: "button" }, texte: t("kit.reglages.retours") });
  retours.addEventListener("click", () => void import("@cdj/ui/src/retoursOuvrir").then(() => import("./retours")).then((m) => m.ouvrirRetours(c.fiche.id, c.donnees.base, c.donnees.stockage)));
  cadre.corps.append(
    el("h2", { classe: "jeu-ecran__titre", texte: t("kit.reglages.titre") }),
    el("section", { classe: "jeu-reglages__section" }, el("h3", { texte: t("kit.reglages.son") }), placeMusique),
    el("section", { classe: "jeu-reglages__section" }, el("h3", { texte: t("kit.reglages.affichage") }), ligne("kit.reglages.mouvement", segment("mouvement", [{ valeur: "normal", cle: "kit.reglages.mouvement.normal" }, { valeur: "reduit", cle: "kit.reglages.mouvement.reduit" }])), ligne("kit.reglages.fantome", segment("fantome", [{ valeur: "aucun", cle: "kit.reglages.fantome.aucun" }, { valeur: "meilleure", cle: "kit.reglages.fantome.meilleure" }]))),
    el("section", { classe: "jeu-reglages__section" }, el("h3", { texte: t("kit.reglages.commandes") }), hoteCommandes),
    el("p", { classe: "jeu-reglages__liens" }, el("a", { classe: "jeu-lien", attrs: { href: `../profil/?retour=/${c.fiche.id}/`, id: "jeu-reglages-profil" }, texte: t("kit.reglages.profil") }), el("a", { classe: "jeu-lien", attrs: { href: cheminMentions(c.i18n.langue, "../"), id: "jeu-reglages-mentions" }, texte: t("kit.reglages.mentions") }), retours),
  );
  cadre.racine.hidden = true;
  return {
    ouvrir() {
      cadre.majBarre();
      cadre.racine.hidden = false;
    },
  };
}
