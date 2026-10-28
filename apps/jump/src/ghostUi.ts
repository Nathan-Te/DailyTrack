import { el, medaille } from "@cdj/ui";
import { t, traducteurDuSocle } from "./i18n";

// Le fantôme Diamant dans l'interface (lot G1), DOM seulement : la ligne grisée « Diamant · Finis le niveau pour le débloquer. » de l'accueil et de la pause,
// tant que le niveau du jour n'est pas fini. La pastille est celle de la médaille du socle (`--dj-diamant`), **pas encore obtenue** (aplat neutre dans Jump : grisée).

/** Remplit (dans la langue courante) la ligne du Diamant verrouillé. */
export function remplirVerrou(p: HTMLElement): void {
  p.replaceChildren(medaille(traducteurDuSocle(), { type: "diamant", obtenue: false, jeu: "jump" }), el("span", { classe: "fantome-verrou__texte", texte: t("fantome.verrouille") }));
}
