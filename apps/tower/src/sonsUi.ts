import { el } from "@cdj/ui";
import { t } from "./i18n";
import type { ReglagesSons } from "./reglagesSons";

// Le réglage des effets sonores (lot T5), une case « Sons » et un volume — **un seul morceau pour la pause et pour Réglages › Son** (lot T7). Il lit et écrit par les fonctions que son hôte donne
// (en partie : l'état du jeu, qui coupe aussi le souffle du vent ; depuis l'accueil : le stockage). Aucun texte écrit en dur.

export interface BlocSons {
  readonly element: HTMLElement;
  /** Relit le réglage (à l'ouverture de l'écran). */
  relire(): void;
  /** Redessine les textes (langue). */
  traduire(): void;
}

export function monterBlocSons(o: { lire(): ReglagesSons; ecrire(r: ReglagesSons): void; idCase: string; idVolume: string; classe?: string }): BlocSons {
  const caseSons = el("input", { attrs: { type: "checkbox", id: o.idCase } }) as HTMLInputElement;
  const nom = el("span", { classe: "pause__sons-nom" });
  const volume = el("input", { attrs: { type: "range", min: 0, max: 100, step: 5, id: o.idVolume } }) as HTMLInputElement;
  const element = el("div", { classe: ["pause__sons", o.classe], attrs: { role: "group" } }, el("label", { classe: "pause__sons-case" }, caseSons, nom), volume);
  const relire = (): void => {
    const r = o.lire();
    caseSons.checked = r.actifs;
    volume.value = String(Math.round(r.volume * 100));
    volume.disabled = !r.actifs;
  };
  const ecrire = (): void => {
    o.ecrire({ actifs: caseSons.checked, volume: Number(volume.value) / 100 });
    volume.disabled = !caseSons.checked;
  };
  caseSons.addEventListener("change", ecrire);
  volume.addEventListener("input", ecrire);
  const traduire = (): void => {
    nom.textContent = t("pause.sons");
    element.setAttribute("aria-label", t("pause.sons"));
    volume.setAttribute("aria-label", t("pause.sons.volume"));
  };
  traduire();
  relire();
  return { element, relire, traduire };
}
