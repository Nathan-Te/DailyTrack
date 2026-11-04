import { bouton, creerCadre, barreJeu, el, type TraducteurCommun } from "@cdj/ui";
import { commandesDuJeu, cleAction } from "./commandes";
import type { ContexteJeu } from "./types";

// « Comment jouer » (à la demande) : les points du jeu (`DefinitionJeu.aide`, clés de son catalogue) et le rappel des commandes choisies ; ouvert une fois au premier lancement (`<id>:aide:vu`), puis à la demande.
export const cleAideVue = (fiche: { prefixe: string }): string => `${fiche.prefixe}aide:vu`;
export function aideDejaVue(fiche: { prefixe: string }, stockage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return stockage?.getItem(cleAideVue(fiche)) === "1";
  } catch {
    return true; // stockage refusé : on ne harcèle pas
  }
}

export function monterAide<C>(c: ContexteJeu<C>): { ouvrir(): void } {
  const { t } = c.i18n;
  const ok = bouton({ texte: t("kit.aide.ok"), variante: "marque" }) as HTMLButtonElement;
  ok.id = "jeu-aide-ok";
  const cadre = creerCadre({
    id: "jeu-aide",
    haut: true,
    etiquette: "jeu-ecran",
    barre: () => barreJeu(c.i18n.socle() as unknown as TraducteurCommun, { href: "../", jour: c.jour, retour: { texte: t(`jeu.${c.fiche.id}.nom`).toUpperCase(), ariaLabel: t("kit.aide.ok"), onClick: fermer } }),
    aria: () => t("kit.aide.aria"),
  });
  const touches = commandesDuJeu(c.fiche, c.def, c.i18n);
  function dessiner(): void {
    cadre.corps.replaceChildren(
      el("h2", { classe: "jeu-ecran__titre", texte: t("kit.aide.titre") }),
      el("ul", { classe: "jeu-aide" }, ...c.def.aide.map((cle) => el("li", { texte: t(cle) }))),
      el("p", { classe: "jeu-aide__commandes" }, [...c.def.actions, ...[{ id: "pause" }]].map((a) => `${t(cleAction(a.id))} : ${touches.texteTouches(a.id, c.i18n.langue)}`).join(" · ")),
      ok,
    );
  }
  function fermer(): void {
    cadre.racine.hidden = true;
    try {
      c.donnees.stockage?.setItem(cleAideVue(c.fiche), "1");
    } catch {
      /* stockage refusé */
    }
  }
  ok.addEventListener("click", fermer);
  return {
    ouvrir() {
      dessiner();
      cadre.majBarre();
      cadre.racine.hidden = false;
      ok.focus();
    },
  };
}
