import { svg } from "@cdj/ui";
import { el, row, segmented, slider } from "./dom";
import { ajouterTextes, fNombre, t } from "./i18n";
import { en, fr } from "./catalogue.reglages.volant";
import { PLAGE_ZONE_MORTE, clamp, shape, wrap180 } from "./steerMath";
import type { ButtonRect, Steerer, TouchPad } from "./touch";
import type { SteerFactory, SteerModule } from "./touchUi";
import "./steerWheel.css";

// Lot 52 — le volant (maquettes docs/lots/lot-52-commandes/maquettes.html, validées par Nathan) : un volant dessiné au bord de l'écran, qu'on tourne au doigt.
// **L'angle vient de la position du doigt autour du centre du volant**, jamais d'un glissement horizontal : le volant tourne de l'angle que le doigt balaie
// depuis la prise (pas de saut quand on le saisit à 3 h) ; le doigt peut glisser hors de la jante sans lâcher ; **butoir** à l'angle maximal (90° ou 135°,
// réglable ; c'est aussi la sensibilité) : le volant s'arrête, le point de prise suit le doigt, le retour est donc immédiat. Au lâcher, il revient au centre
// (retour visuel court ; la direction retombe à 0 tout de suite). Chargé à la demande : jamais dans le premier chargement.

/** Sous cette distance du centre (pixels), l'angle du doigt n'est pas fiable (le moyeu) : le doigt est ignoré tant qu'il y est. */
export const HUB_RADIUS_PX = 12;

/** Angle d'un point autour d'un centre, en degrés : 0 en haut, positif vers la droite (sens des aiguilles d'une montre). `null` au moyeu. */
export function angleAround(cx: number, cy: number, x: number, y: number): number | null {
  const dx = x - cx;
  const dy = y - cy;
  if (Math.hypot(dx, dy) < HUB_RADIUS_PX) return null;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/** La direction du volant tourné de `angle` degrés, butoir à `max` : la zone morte est une part de l'angle maximal. */
export const wheelSteer = (angle: number, max: number, deadzone: number): number => shape(clamp(angle / max, -1, 1), deadzone);

export class WheelSteerer implements Steerer {
  finger: number | null = null;
  /** Angle du volant, degrés, entre −max et +max. */
  angle = 0;
  private last: number | null = null;
  constructor(private readonly pad: TouchPad) {}

  private centre(): { x: number; y: number } | null {
    const r: ButtonRect | undefined = this.pad.rect("steer");
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }

  down(id: number, x: number, y: number): void {
    const c = this.centre();
    this.finger = id;
    this.angle = 0;
    this.last = c ? angleAround(c.x, c.y, x, y) : null;
  }

  move(id: number, x: number, y: number): void {
    const c = this.centre();
    if (id !== this.finger || !c) return;
    const a = angleAround(c.x, c.y, x, y);
    if (a === null) return;
    if (this.last !== null) {
      const max = this.pad.settings.wheelAngle;
      this.angle = clamp(this.angle + wrap180(a - this.last), -max, max);
    }
    this.last = a; // au butoir, le point de prise suit le doigt : revenir en arrière tourne tout de suite
  }

  up(id: number): void {
    if (id === this.finger) this.release();
  }

  release(): void {
    this.finger = null;
    this.last = null;
    this.angle = 0;
  }

  steer(): number {
    return wheelSteer(this.angle, this.pad.settings.wheelAngle, this.pad.settings.wheelDeadzone);
  }
}

/** Un point de la circonférence du dessin (viewBox 160, centre 80), `a` degrés depuis le haut. */
const point = (a: number, r: number): [number, number] => [80 + r * Math.sin((a * Math.PI) / 180), 80 - r * Math.cos((a * Math.PI) / 180)];
const trait = (cls: string, x1: number, y1: number, x2: number, y2: number) => svg("line", { classe: cls, attrs: { x1, y1, x2, y2 } });

export const create: SteerFactory = (pad): SteerModule => {
  ajouterTextes({ fr, en });
  const steerer = new WheelSteerer(pad);
  return {
    steerer,
    hint: (_, cd) => ({ direction: t("tactile.indice.volant", { cote: cd }) }),
    mount(host) {
      const racine = el("div", "volant");
      const dessin = svg("svg", { attrs: { viewBox: "0 0 160 160", "aria-hidden": "true", focusable: "false" } });
      const groupeReperes = svg("g");
      const roue = svg(
        "g",
        { classe: "volant__roue" },
        trait("volant__rayon-bord", 80, 80, 22, 80), trait("volant__rayon-bord", 80, 80, 138, 80), trait("volant__rayon-bord", 80, 80, 80, 138),
        trait("volant__rayon", 80, 80, 22, 80), trait("volant__rayon", 80, 80, 138, 80), trait("volant__rayon", 80, 80, 80, 138),
        svg("circle", { classe: "volant__jante-bord", attrs: { cx: 80, cy: 80, r: 58 } }),
        svg("circle", { classe: "volant__jante", attrs: { cx: 80, cy: 80, r: 58 } }),
        svg("rect", { classe: "volant__marque", attrs: { x: 74, y: 14, width: 12, height: 16 } }),
        svg("circle", { classe: "volant__moyeu", attrs: { cx: 80, cy: 80, r: 17 } }),
        svg("circle", { classe: "volant__moyeu-centre", attrs: { cx: 80, cy: 80, r: 7 } }),
      );
      // Le repère fixe, en haut : la direction se lit entre lui et la marque de livrée de la jante.
      const repere = svg("path", { classe: "volant__repere", attrs: { d: "M73 4 L87 4 L80 19 Z" } });
      dessin.append(groupeReperes, repere, roue);
      racine.append(dessin);
      host.append(racine);
      let max = 0;
      /** Les groupeReperes fixes autour du volant : tous les 15°, plus gros au butoir (suivent l'angle maximal réglé). */
      const reperes = () => {
        max = pad.settings.wheelAngle;
        groupeReperes.replaceChildren();
        for (let a = -max; a <= max; a += 15) {
          const fort = Math.abs(a) === max;
          const [x1, y1] = point(a, 70);
          const [x2, y2] = point(a, fort ? 79 : 75);
          groupeReperes.append(trait(fort ? "volant__butoir" : "volant__graduation", x1, y1, x2, y2));
        }
      };
      const layout = () => {
        const r = pad.rect("steer");
        racine.hidden = !r;
        if (!r) return;
        racine.style.left = `${r.x}px`;
        racine.style.top = `${r.y}px`;
        racine.style.width = `${r.w}px`;
        racine.style.height = `${r.h}px`;
        if (max !== pad.settings.wheelAngle) reperes();
        render();
      };
      const render = () => {
        racine.classList.toggle("on", steerer.finger !== null);
        roue.style.transform = `rotate(${steerer.angle}deg)`;
      };
      reperes();
      layout();
      return { layout, render, unmount: () => racine.remove() };
    },
    rows(apply) {
      const angle = segmented<number>([[90, "90°"], [135, "135°"]], () => pad.settings.wheelAngle, (v) => apply({ wheelAngle: v === 135 ? 135 : 90 }), t("tactile.angle.nom"));
      const zoneMorte = slider(PLAGE_ZONE_MORTE, () => pad.settings.wheelDeadzone, (v) => apply({ wheelDeadzone: v }), (v) => `${fNombre(Math.round(v * 100))} %`, t("tactile.zoneMorte.nom"));
      return {
        nodes: [row(t("tactile.angle.nom"), angle.box, t("tactile.angle.aide")), row(t("tactile.zoneMorte.nom"), zoneMorte.box)],
        sync: () => [angle, zoneMorte].forEach((c) => c.sync()),
      };
    },
  };
};
