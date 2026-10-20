// Fenêtre « Comment jouer » (lot 29, passée au socle au lot I4) : une page courte et visuelle dans le cadre de Du Jour. Les commandes de l'appareil en cours
// d'abord (clavier ou doigts), les autres repliées ; les idées à retenir en dessous. Montrée à la première visite, puis accessible depuis l'accueil, la pause
// et les réglages. Les textes viennent du catalogue (`aide.*`) : la fenêtre se redessine au changement de langue.
import { bouton, icone, type NomIcone } from "@cdj/ui";
import { creerCadre } from "./cadre";
import { el } from "./dom";
import { GAMEPAD_CONTROLS, KEYBOARD_CONTROLS, TIPS, TOUCH_CONTROLS, type Control, type Device } from "./howto";
import { ICONES_TRACK, iconeTrack, type IconeTrack } from "./icones";
import { aCle, onLangue, t } from "./i18n";

export interface HowtoUi {
  /** Ouvre l'aide ; `onClose` est appelé une fois, à la fermeture (l'accueil enchaîne alors sur la course). */
  open(onClose?: () => void): void;
  close(): void;
  isOpen(): boolean;
}

/** Une icône par son nom : celles de Track d'abord, sinon celles du socle. */
export function iconeParNom(nom: string, taille = 18): SVGSVGElement {
  return (ICONES_TRACK as readonly string[]).includes(nom) ? iconeTrack(nom as IconeTrack, taille) : icone(nom as NomIcone, { taille });
}

/** Une touche, un geste ou une icône : un nom littéral (« Z »), une clé `aide.touche.*` ou `icone:<nom>`. */
function touche(k: string): HTMLElement {
  const e = el("kbd");
  if (k.startsWith("icone:")) e.append(iconeParNom(k.slice("icone:".length)));
  else e.textContent = aCle(k) ? t(k) : k;
  return e;
}

/** La liste des commandes d'un appareil (aussi montrée dans Réglages › Commandes). */
export function controlsTable(list: Control[]): HTMLElement {
  const table = el("div", "commandes");
  for (const c of list) {
    const row = el("div", "commande");
    const keys = el("span", "touches");
    c.keys.forEach((k, i) => {
      if (i > 0) keys.append(el("span", "ou", "·"));
      keys.append(touche(k));
    });
    row.append(keys, el("span", "fait", t(c.does)));
    table.append(row);
  }
  return table;
}

/** Schéma de l'écran tactile : où poser les doigts (pas de bitmap : des boîtes CSS, toujours nettes). */
function touchDiagram(): HTMLElement {
  const d = el("div", "schema");
  d.setAttribute("aria-hidden", "true");
  const left = el("div", "schema__zone schema__zone--tourner");
  left.append(el("b", "", t("aide.zone.tourner")), el("span", "", t("aide.zone.glisse")));
  const brake = el("div", "schema__zone schema__zone--frein");
  brake.append(el("b", "", t("aide.zone.frein")));
  const gas = el("div", "schema__zone schema__zone--gaz");
  gas.append(el("b", "", t("aide.zone.gaz")));
  d.append(left, brake, gas);
  return d;
}

export function mountHowto(root: HTMLElement, device: Device, hooks: { onSeen?: () => void } = {}): HowtoUi {
  let onClose: (() => void) | undefined;
  let opened = false;
  const close = () => {
    if (!opened) return;
    opened = false;
    cadre.racine.hidden = true;
    const f = onClose;
    onClose = undefined;
    hooks.onSeen?.();
    f?.();
  };
  const cadre = creerCadre({ id: "howto", titreAria: "aide.titre", retour: "jeu", onRetour: close, haut: true });
  cadre.racine.hidden = true;
  let done: HTMLElement | null = null;

  const section = (title: string, content: HTMLElement, open: boolean) => {
    const d = el("details", "repli");
    d.open = open;
    d.append(el("summary", "", title), content);
    return d;
  };

  function render(): void {
    const touchBox = () => {
      const box = el("div");
      box.append(touchDiagram(), controlsTable(TOUCH_CONTROLS));
      return box;
    };
    const drive = el("section", "conduire");
    drive.append(el("h2", "reglages__section", t("aide.conduire")));
    if (device === "touch") {
      drive.append(section(t("aide.section.doigts"), touchBox(), true), section(t("aide.section.clavier"), controlsTable(KEYBOARD_CONTROLS), false), section(t("aide.section.manette"), controlsTable(GAMEPAD_CONTROLS), false));
    } else {
      drive.append(section(t("aide.section.clavier"), controlsTable(KEYBOARD_CONTROLS), true), section(t("aide.section.manette"), controlsTable(GAMEPAD_CONTROLS), false), section(t("aide.section.doigtsAussi"), touchBox(), false));
    }
    const tips = el("section", "conseils");
    for (const tip of TIPS) {
      const c = el("div", "conseil");
      c.append(el("div", "conseil__icone", ""), el("div", "conseil__texte"));
      c.firstElementChild!.append(iconeParNom(tip.icon, 26));
      c.lastElementChild!.append(el("h3", "", t(tip.heading)), el("p", "", t(tip.body)));
      tips.append(c);
    }
    done = bouton({ texte: t("aide.compris"), variante: "track", pleineLargeur: true, onClick: close });
    done.id = "howto-done";
    const tete = el("div", "etiquette__tete");
    tete.append(el("h1", "etiquette__titre", t("aide.titre")));
    cadre.corps.replaceChildren(tete, tips, drive, done);
  }
  render();
  root.append(cadre.racine);
  // La langue change : la fenêtre se redessine (ouverte ou non), le focus reste sur le bouton de fin.
  onLangue(() => {
    const had = done !== null && document.activeElement === done;
    render();
    if (had) done?.focus({ preventScroll: true });
  });

  return {
    open(cb) {
      onClose = cb;
      opened = true;
      cadre.racine.hidden = false;
      cadre.corps.scrollTop = 0;
      done?.focus({ preventScroll: true });
    },
    close,
    isOpen: () => opened,
  };
}
