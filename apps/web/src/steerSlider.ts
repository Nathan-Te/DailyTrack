import { el, row, slider } from "./dom";
import { ajouterTextes, fNombre, t } from "./i18n";
import { en, fr } from "./catalogue.reglages.glissiere";
import { PLAGE_SENSIBILITE, PLAGE_ZONE_MORTE, clamp, shape } from "./steerMath";
import type { ButtonRect, Steerer, TouchPad } from "./touch";
import type { SteerFactory, SteerModule } from "./touchUi";
import "./steerSlider.css";

// Lot 52 — la glissière (maquettes docs/lots/lot-52-commandes/maquettes.html, validées par Nathan) : un rail au bord de l'écran (à gauche, à droite si la disposition
// est inversée), un curseur que le pouce fait glisser. **Position absolue** : le curseur va sous le doigt et la direction suit sa position (plus de point de pose,
// comme au joystick du lot 10, qu'elle remplace) ; toute la zone du bord est active, le doigt peut quitter le rail (en haut, en bas) sans le lâcher ; au lâcher, le
// curseur revient au centre. Chargée à la demande : jamais dans le premier chargement.

/** Marge du rail dans sa plaque et demi-largeur du curseur (56 px, `steerSlider.css`). */
const BORD = 14;
const DEMI_CURSEUR = 28;

/** Demi-course du centre du curseur (pixels) pour un rail de largeur `w` : le curseur reste dans la plaque, à 6 px du bord au bout du rail. */
export const sliderCourse = (w: number): number => w / 2 - DEMI_CURSEUR - 6;

/** Position du curseur ∈ [-1, 1] pour un doigt à l'abscisse `x` : sous le doigt, jusqu'aux bouts du rail. */
export function sliderPosition(x: number, rect: Pick<ButtonRect, "x" | "w">): number {
  return clamp((x - (rect.x + rect.w / 2)) / sliderCourse(rect.w), -1, 1);
}

/** La direction : la position du curseur à la sensibilité réglée (×2 = deux fois moins de course), après la zone morte. */
export function sliderSteer(x: number, rect: Pick<ButtonRect, "x" | "w">, s: { sensitivity: number; deadzone: number }): number {
  return shape(clamp((x - (rect.x + rect.w / 2)) / (sliderCourse(rect.w) / s.sensitivity), -1, 1), s.deadzone);
}

export class SliderSteerer implements Steerer {
  finger: number | null = null;
  x = 0;
  constructor(private readonly pad: TouchPad) {}
  down(id: number, x: number): void {
    this.finger = id;
    this.x = x;
  }
  move(id: number, x: number): void {
    if (id === this.finger) this.x = x;
  }
  up(id: number): void {
    if (id === this.finger) this.finger = null;
  }
  release(): void {
    this.finger = null;
  }
  steer(): number {
    const rect = this.pad.rect("steer");
    return this.finger === null || !rect ? 0 : sliderSteer(this.x, rect, this.pad.settings);
  }
  /** Position du curseur dessiné ∈ [-1, 1] (0 au repos). */
  position(): number {
    const rect = this.pad.rect("steer");
    return this.finger === null || !rect ? 0 : sliderPosition(this.x, rect);
  }
}

export const create: SteerFactory = (pad): SteerModule => {
  ajouterTextes({ fr, en });
  const steerer = new SliderSteerer(pad);
  return {
    steerer,
    hint: (_, cd) => ({ direction: t("tactile.indice.glissiere", { cote: cd }) }),
    mount(host) {
      const rail = el("div", "glissiere__rail");
      const curseur = el("div", "glissiere__curseur");
      curseur.append(el("i"), el("i"), el("i"));
      const racine = el("div", "glissiere");
      const graduations = Array.from({ length: 9 }, (_, i) => el("i", i === 4 ? "glissiere__graduation glissiere__graduation--centre" : "glissiere__graduation"));
      racine.append(rail, ...graduations, curseur);
      host.append(racine);
      const layout = () => {
        const r = pad.rect("steer");
        racine.hidden = !r;
        if (!r) return;
        racine.style.left = `${r.x}px`;
        racine.style.top = `${r.y}px`;
        racine.style.width = `${r.w}px`;
        racine.style.height = `${r.h}px`;
        graduations.forEach((g, i) => (g.style.left = `${BORD + (i / 8) * (r.w - 2 * BORD)}px`));
        render();
      };
      const render = () => {
        const r = pad.rect("steer");
        if (!r) return;
        curseur.classList.toggle("on", steerer.finger !== null);
        curseur.style.left = `${r.w / 2 + steerer.position() * sliderCourse(r.w)}px`;
      };
      layout();
      return { layout, render, unmount: () => racine.remove() };
    },
    rows(apply) {
      const sensibilite = slider(PLAGE_SENSIBILITE, () => pad.settings.sensitivity, (v) => apply({ sensitivity: v }), (v) => `×${fNombre(v, 2)}`, t("tactile.sensibilite.nom"));
      const zoneMorte = slider(PLAGE_ZONE_MORTE, () => pad.settings.deadzone, (v) => apply({ deadzone: v }), (v) => `${fNombre(Math.round(v * 100))} %`, t("tactile.zoneMorte.nom"));
      return {
        nodes: [row(t("tactile.sensibilite.nom"), sensibilite.box, t("tactile.sensibilite.aide")), row(t("tactile.zoneMorte.nom"), zoneMorte.box)],
        sync: () => [sensibilite, zoneMorte].forEach((c) => c.sync()),
      };
    },
  };
};
