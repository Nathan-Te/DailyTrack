import { bouton, el, icone, suivreDialogue, svg } from "@cdj/ui";
import { lier, onLangue, t } from "./i18n";

// « Comment jouer » (lot 10, **refait au lot I5** : charte rév. 7, § 9) : **dans le jeu**, jamais dans le cadre crème du portail — l'étiquette jaune
// posée sur la scène, sous le voile à rayures (comme la pause), trois points courts, le schéma des commandes (au doigt : les boutons aux bords, le centre
// au jeu ; au clavier : les touches) et un bouton « C'est parti » (`#help-close`). Montré **une seule fois**, au premier lancement (mémorisé :
// `jump:aide`), puis depuis la pause et l'accueil. Les textes viennent du catalogue (`aide.*`, `commandes.*`) : la fenêtre se redessine au changement
// de langue. Ouverte, la partie est en pause (main.ts).

export { HELP_SEEN_KEY, helpSeen, markHelpSeen } from "./homeLogic";

/** Les trois points de « Comment jouer » (catalogue). */
export const HOWTO_POINTS = ["aide.point1", "aide.point2", "aide.point3"] as const;
/** Les commandes, par appareil (« Comment jouer » au clavier, Réglages › Commandes). */
export const COMMANDES = {
  clavier: ["commandes.clavier.courir", "commandes.clavier.sauter", "commandes.clavier.reprendre", "commandes.clavier.recommencer", "commandes.clavier.pause", "commandes.clavier.fantome"],
  manette: ["commandes.manette.courir", "commandes.manette.sauter", "commandes.manette.reprendre", "commandes.manette.recommencer", "commandes.manette.pause"],
  tactile: ["commandes.tactile.direction", "commandes.tactile.saut", "commandes.tactile.pause"],
} as const;

/** Une liste de commandes (une ligne par clé du catalogue). */
export function listeCommandes(cles: readonly string[]): HTMLElement {
  return el("ul", { classe: "commandes" }, ...cles.map((c) => lier(el("li", { classe: "commande" }), c)));
}

/** Schéma des commandes tactiles : le jeu vu en paysage, avec les boutons là où on les trouve (des boîtes CSS, jamais de bitmap). Le centre reste libre. */
function schemaTactile(): HTMLElement {
  const fleche = (d: string) => svg("svg", { attrs: { viewBox: "0 0 30 30", width: 14, height: 14, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d, fill: "none", stroke: "currentColor", "stroke-width": 5, "stroke-linecap": "square" } }));
  const pause = el("span", { classe: "schema__btn schema__pause" }, el("span", { classe: "schema__barres" }));
  return el(
    "div",
    { classe: "schema", attrs: { "aria-hidden": "true" } },
    pause,
    el("span", { classe: "schema__bande" }),
    el("span", { classe: "schema__morts" }, icone("crane", { taille: 10 })),
    lier(el("span", { classe: "schema__centre" }), "aide.zone.libre"),
    el("div", { classe: "schema__gauche" }, el("span", { classe: "schema__btn" }, fleche("M19 5 9 15l10 10")), el("span", { classe: "schema__btn" }, fleche("M11 5l10 10-10 10"))),
    lier(el("span", { classe: "schema__btn schema__saut" }), "tactile.saut"),
  );
}

export interface HowtoUi {
  /** Ouvre l'aide ; `onClose` (facultatif) est appelé une fois, à la fermeture. */
  open(onClose?: () => void): void;
  close(): void;
  readonly isOpen: boolean;
}

export function mountHowto(device: "touch" | "keys", hooks: { onChange?: () => void } = {}): HowtoUi {
  let onClose: (() => void) | undefined;
  const racine = el("div", { classe: "voile voile--aide", attrs: { id: "help", hidden: true } });
  const dialogue = el("section", { classe: ["dialogue", "dialogue--aide"], attrs: { role: "dialog", "aria-modal": "true" } });
  racine.append(dialogue);
  let done: HTMLButtonElement | null = null;

  function render(): void {
    dialogue.setAttribute("aria-label", t("aide.aria"));
    const points = el("ol", { classe: "points" }, ...HOWTO_POINTS.map((cle, i) => el("li", { classe: "point" }, el("span", { classe: "point__n", texte: String(i + 1) }), el("span", { classe: "point__texte", texte: t(cle) }))));
    const aside = el("div", { classe: "aide__schema" });
    if (device === "touch") aside.append(schemaTactile(), el("p", { classe: "aide__legende", texte: t("aide.schema.legende") }));
    else aside.append(listeCommandes(COMMANDES.clavier));
    done = bouton({ texte: t("aide.parti"), variante: "jump", pleineLargeur: true, onClick: () => self.close() }) as HTMLButtonElement;
    done.id = "help-close";
    dialogue.replaceChildren(el("h2", { classe: "dialogue__titre", texte: t("aide.titre") }), el("div", { classe: "aide" }, points, aside), done);
  }
  render();
  document.body.append(racine);
  suivreDialogue(racine, { focusInitial: () => done }); // lot I6 : focus rendu à la fermeture (au bouton qui l'a ouverte)
  onLangue(() => {
    const had = done !== null && document.activeElement === done;
    render();
    if (had) done?.focus({ preventScroll: true });
  });

  const self: HowtoUi = {
    get isOpen() {
      return !racine.hidden;
    },
    open(cb) {
      onClose = cb;
      racine.hidden = false;
      done?.focus({ preventScroll: true });
      hooks.onChange?.();
    },
    close() {
      if (racine.hidden) return;
      racine.hidden = true;
      const f = onClose;
      onClose = undefined;
      hooks.onChange?.();
      f?.();
    },
  };
  // Échap ferme l'aide (avant tout le reste : elle est au-dessus).
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape" || racine.hidden) return;
      self.close();
      e.stopImmediatePropagation();
    },
    { capture: true },
  );
  return self;
}
