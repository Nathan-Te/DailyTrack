import { formatDay } from "@cdj/core";
import { ecrireTemps, type Contenu } from "@cdj/vertige-sim";
import { dailyVertige, varianteDeCle } from "@cdj/vertige-sim/modules";
import type { OptionsPartie } from "@cdj/kit/jeu/types";
import { texteEssai, type CleEssai } from "./essaiTextes";

// La galerie des jours (lot V3, `?scenario=jours&debug`, jamais en production) : les 14 prochains jours à partir de celui qu'on joue — pour chacun, la liste des modules du niveau, le temps du robot (le Diamant), « Voir la
// démonstration » (la caméra rejoue le robot sur ce niveau) et « Jouer ». Les niveaux se génèrent un par un (une soixantaine de millisecondes chacun) pour que la page reste vivante. Chargé à la demande : le premier chargement ne la porte pas.
export const JOURS_DE_LA_GALERIE = 14;

export interface ApiGalerieJours {
  /** Charge le niveau d'un jour : `voir` = le robot joue ; sinon c'est le joueur. */
  charger(c: Contenu, voir: boolean): void;
}
export interface GalerieJours {
  /** Le jour affiché et son mode : le panneau le met en évidence. */
  marquer(jour: number): void;
  detruire(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texte?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

export function monterGalerieJours(racine: HTMLElement, o: OptionsPartie, api: ApiGalerieJours, premier: number): GalerieJours {
  const t = (cle: CleEssai, p?: Record<string, string | number>): string => texteEssai(o.langue, cle, p);
  const panneau = el("aside", "vertige-galerie vertige-galerie--jours");
  panneau.setAttribute("aria-label", t("jours.titre"));
  panneau.append(el("h3", "", t("jours.titre")));
  const liste = el("ol", "vertige-galerie__liste");
  panneau.append(liste);
  racine.append(panneau);
  const lignes = new Map<number, HTMLElement>();
  let detruit = false;
  const ajouter = (jour: number): void => {
    const c = dailyVertige(jour);
    const ligne = el("li", "vertige-galerie__module");
    ligne.dataset.jour = formatDay(jour);
    const cles = c.modules ?? [];
    const voir = el("button", "vertige-bouton", t("jours.voir"));
    voir.type = "button";
    voir.dataset.action = "voir";
    voir.addEventListener("click", () => api.charger(c, true));
    const jouer = el("button", "vertige-bouton", t("galerie.jouer"));
    jouer.type = "button";
    jouer.dataset.action = "jouer";
    jouer.addEventListener("click", () => api.charger(c, false));
    const actions = el("div", "vertige-galerie__actions");
    actions.append(voir, jouer);
    const modules = el("div", "vertige-galerie__etiquettes", cles.map((k) => `${k} (${varianteDeCle(k)?.difficulte ?? "?"})`).join(" › "));
    modules.dataset.modules = cles.join(",");
    ligne.append(el("div", "vertige-galerie__nom", `${formatDay(jour)} — ${t("jours.modules", { n: cles.length })}`), modules, el("div", "vertige-galerie__robot", `${t("galerie.robot")} : ${ecrireTemps(c.ticksRobot ?? 0, o.langue)}`), actions);
    liste.append(ligne);
    lignes.set(jour, ligne);
  };
  const suite = (i: number): void => {
    if (detruit || i >= JOURS_DE_LA_GALERIE) return;
    ajouter(premier + i);
    setTimeout(() => suite(i + 1), 0);
  };
  suite(0);
  return {
    marquer: (jour) => lignes.forEach((l, k) => l.setAttribute("aria-current", String(k === jour))),
    detruire: () => {
      detruit = true;
      panneau.remove();
    },
  };
}
