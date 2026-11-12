import { ecrireTemps } from "@cdj/vertige-sim";
import { MODULES, robotDuModule, type Mecanique, type Module } from "@cdj/vertige-sim/modules";
import type { OptionsPartie } from "@cdj/kit/jeu/types";
import { texteEssai, type CleEssai } from "./essaiTextes";

// La galerie de modules (lot V2, `?scenario=modules&debug`, jamais en production) : un panneau qui liste les modules de la bibliothèque — nom, étiquettes, temps du robot — avec « Voir la solution » (la caméra rejoue la
// solution du robot, depuis l'état canonique d'entrée) et « Jouer » (le joueur part au repos, avant le palier d'entrée). Chargé à la demande : le premier chargement ne la porte pas.
export interface ApiGalerie {
  /** Charge un module : `voir` = le robot joue ; sinon c'est le joueur. */
  charger(m: Module, voir: boolean): void;
}
export interface Galerie {
  /** Le module affiché et son mode : le panneau le met en évidence. */
  marquer(id: string): void;
  detruire(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, texte?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

export function monterGalerie(racine: HTMLElement, o: OptionsPartie, api: ApiGalerie, courant: string): Galerie {
  const t = (cle: CleEssai, p?: Record<string, string | number>): string => texteEssai(o.langue, cle, p);
  const panneau = el("aside", "vertige-galerie");
  panneau.setAttribute("aria-label", t("galerie.titre"));
  panneau.append(el("h3", "", `${t("galerie.titre")} (${MODULES.length})`));
  const liste = el("ol", "vertige-galerie__liste");
  const lignes = new Map<string, HTMLElement>();
  for (const m of MODULES) {
    const robot = robotDuModule(m);
    const ligne = el("li", "vertige-galerie__module");
    ligne.dataset.module = m.id;
    const etiquettes = [...m.etiquettes.mecaniques.map((e: Mecanique) => t(`galerie.mecanique.${e}` as CleEssai)), t("galerie.difficulte", { n: m.etiquettes.difficulte })].join(" · ");
    const voir = el("button", "vertige-bouton", t("galerie.voir"));
    voir.type = "button";
    voir.dataset.action = "voir";
    voir.addEventListener("click", () => api.charger(m, true));
    const jouer = el("button", "vertige-bouton", t("galerie.jouer"));
    jouer.type = "button";
    jouer.dataset.action = "jouer";
    jouer.addEventListener("click", () => api.charger(m, false));
    const actions = el("div", "vertige-galerie__actions");
    actions.append(voir, jouer);
    ligne.append(el("div", "vertige-galerie__nom", `${m.id} — ${m.nom}`), el("div", "vertige-galerie__etiquettes", etiquettes), el("div", "vertige-galerie__robot", `${t("galerie.robot")} : ${ecrireTemps(robot.ticks, o.langue)}`), actions);
    liste.append(ligne);
    lignes.set(m.id, ligne);
  }
  panneau.append(liste);
  racine.append(panneau);
  const marquer = (id: string): void => lignes.forEach((l, k) => l.setAttribute("aria-current", String(k === id)));
  marquer(courant);
  return { marquer, detruire: () => panneau.remove() };
}
