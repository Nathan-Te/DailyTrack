// Fenêtre « Comment jouer » (lot 29 ; retouche du lot I4, charte rév. 7 § 9) : **dans le jeu**, pas dans le cadre crème du portail — l'étiquette asphalte posée sur la
// scène, sous un voile à rayures (comme la pause), trois points courts, le schéma des commandes (doigts : les boutons aux bords, le centre libre ; clavier : les touches) et
// un bouton « C'est parti ». Montrée une seule fois (le jeu gelé dessous), puis accessible depuis la pause, l'accueil et les réglages. Les textes viennent du catalogue
// (`aide.*`) : la fenêtre se redessine au changement de langue.
import { bouton, icone, svg, type NomIcone } from "@cdj/ui";
import { el } from "./dom";
import { HOWTO_POINTS, KEYBOARD_BASICS, type Control, type Device } from "./howto";
import { ICONES_TRACK, iconeTrack, type IconeTrack } from "./icones";
import { aCle, onLangue, t } from "./i18n";

export interface HowtoUi {
  /** Ouvre l'aide ; `onClose` (facultatif) est appelé une fois, à la fermeture. */
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

/** Une flèche de direction du schéma (la même forme que les boutons tactiles). */
function fleche(d: string): SVGSVGElement {
  return svg("svg", { attrs: { viewBox: "0 0 30 30", width: 14, height: 14, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d, fill: "none", stroke: "currentColor", "stroke-width": 5, "stroke-linecap": "square" } }));
}

/** Schéma des commandes tactiles : le jeu vu en paysage, avec les boutons là où on les trouve (des boîtes CSS, jamais de bitmap). Le centre reste libre. */
function touchDiagram(): HTMLElement {
  const d = el("div", "schema");
  d.setAttribute("aria-hidden", "true");
  const btn = (cls: string, content: Node | string) => {
    const b = el("span", `schema__btn ${cls}`);
    b.append(content);
    return b;
  };
  const haut = el("div", "schema__haut");
  haut.append(btn("", iconeTrack("pause", 12)), btn("", icone("drapeau", { taille: 12 })), btn("", iconeTrack("recommencer", 12)));
  const bande = el("span", "schema__bande");
  const rang = el("span", "schema__rang");
  const centre = el("span", "schema__centre", t("aide.zone.libre"));
  const gauche = el("div", "schema__gauche");
  gauche.append(btn("schema__fleche", fleche("M19 5 9 15l10 10")), btn("schema__fleche", fleche("M11 5l10 10-10 10")));
  const droite = el("div", "schema__droite");
  droite.append(btn("schema__frein", t("aide.zone.frein")), btn("schema__gaz", t("aide.zone.gaz")));
  d.append(haut, bande, rang, centre, gauche, droite);
  return d;
}

export function mountHowto(root: HTMLElement, device: Device, hooks: { onSeen?: () => void } = {}): HowtoUi {
  let onClose: (() => void) | undefined;
  let opened = false;
  const close = () => {
    if (!opened) return;
    opened = false;
    racine.hidden = true;
    const f = onClose;
    onClose = undefined;
    hooks.onSeen?.();
    f?.();
  };
  const racine = el("div", "voile voile--aide");
  racine.id = "howto";
  racine.hidden = true;
  const dialogue = el("section", "dialogue dj-sombre");
  dialogue.setAttribute("role", "dialog");
  dialogue.setAttribute("aria-modal", "true");
  const corps = el("div", "dialogue__corps");
  dialogue.append(corps);
  racine.append(dialogue);
  let done: HTMLElement | null = null;

  function render(): void {
    dialogue.setAttribute("aria-label", t("aide.titre"));
    const points = el("ol", "points");
    HOWTO_POINTS[device].forEach((cle, i) => {
      const li = el("li", "point");
      li.append(el("span", "point__n", String(i + 1)), el("span", "point__texte", t(cle)));
      points.append(li);
    });
    const aside = el("div", "aide__schema");
    if (device === "touch") aside.append(touchDiagram(), el("p", "aide__legende", t("aide.schema.legende")));
    else aside.append(controlsTable(KEYBOARD_BASICS));
    const grille = el("div", "aide");
    grille.append(points, aside);
    done = bouton({ texte: t("aide.parti"), variante: "track", pleineLargeur: true, onClick: close });
    done.id = "howto-done";
    corps.replaceChildren(el("h2", "dialogue__titre", t("aide.titre")), grille, done);
  }
  render();
  root.append(racine);
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
      racine.hidden = false;
      corps.scrollTop = 0;
      done?.focus({ preventScroll: true });
    },
    close,
    isOpen: () => opened,
  };
}
