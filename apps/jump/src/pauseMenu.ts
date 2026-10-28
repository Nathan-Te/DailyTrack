import { bouton, boutonPleinEcran, el, icone } from "@cdj/ui";
import { remplirVerrou } from "./ghostUi";
import { lier, lierMentions, onLangue, t } from "./i18n";

// La pause (lot 8, **refaite au lot I5** : maquette `jump-pause.html`, charte rév. 7 § 9). Posée **sur la scène, sous le voile à rayures** (motif net, ni flou
// ni transparence) : l'étiquette jaune avec « PAUSE », le niveau et l'état de la partie (morts, point de passage), la réplique du thème, **REPRENDRE**,
// puis les actions rares — tout recommencer, le fantôme, le son, les réglages (l'écran Réglages, dans le cadre crème), « Comment jouer », le plein écran
// (si le navigateur le permet), l'accueil de Jump, « ‹ DU JOUR » (le portail) et les mentions légales ; la version du jeu en petit. Ouverte, la partie est
// en pause (aucun pas de simulation : le chrono est figé). Les réglages du joueur (son, sensations, fantôme du premier, taches) sont dans `settingsUi.ts`.
// Lot 27 : « Depuis le point de passage » existe (la reprise volontaire, quatrième bit de la commande, niveaux en version 11) ; elle n'est montrée que quand elle a un sens
// (un point franchi, un niveau de la version 11). Comme DailyTrack, la touche R la fait et Entrée recommence à zéro.

export interface PauseView {
  /** « Niveau n° 5 · Forêt » (vide pour un morceau ou un scénario). */
  niveau: string;
  /** « 7 morts · point 2/4 ». */
  etat: string;
  /** La réplique du thème (une seule par écran). */
  replique: string;
  /** Lot G1 : le fantôme choisi, par son nom (« le tien », « le premier », « Diamant », « aucun ») : l'entrée dit « Fantôme : {nom} » et fait tourner le choix. */
  fantome: string;
  /** Lot G1 : le Diamant existe ici mais le niveau du jour n'est pas fini : la ligne grisée « Finis le niveau pour le débloquer ». */
  diamantVerrou: boolean;
  sound: boolean;
  /** « sim v3 · 2026-10-20 » (l'étiquette de version n'est plus dans le jeu qu'avec `?debug`). */
  version: string;
  /** Lot 27 : la reprise au dernier point de passage a un sens (un point franchi, niveau en version 11). */
  canResume: boolean;
}

export interface PauseMenuOptions {
  onResume(): void;
  onRestart(): void;
  /** Lot 27 : « Depuis le point de passage » (reprise volontaire, le chrono continue). */
  onRespawn?(): void;
  onGhost(): void;
  onSound(): void;
  onSettings(): void;
  onHelp(): void;
  /** Lot 10 : retour à l'accueil de Jump. */
  onHome?(): void;
}

export interface PauseMenu {
  readonly isOpen: boolean;
  open(view: PauseView): void;
  update(view: PauseView): void;
  close(): void;
  readonly element: HTMLElement;
  /** Lot N2 : l'emplacement du message en direct (en tête de la pause) ; vide, il n'occupe aucune place. */
  readonly hoteMessage: HTMLElement;
}

export function mountPauseMenu(opts: PauseMenuOptions): PauseMenu {
  const root = el("div", { classe: "voile voile--pause", attrs: { id: "menu", hidden: true } });
  const dialog = el("section", { classe: ["dialogue", "dialogue--pause"], attrs: { role: "dialog", "aria-modal": "true" } });
  root.append(dialog);
  const titre = lier(el("h2", { classe: "dialogue__titre" }), "pause.titre");
  const niveau = el("span", { classe: "pause__niveau" });
  const etat = el("span", { classe: "pause__etat" });
  const replique = el("p", { classe: "pause__replique" });
  const tete = el("div", { classe: "pause__tete" }, titre, el("span", { classe: "pause__infos" }, niveau, etat));

  const resume = bouton({ texte: t("pause.reprendre"), variante: "jump", pleineLargeur: true, onClick: () => opts.onResume() }) as HTMLButtonElement;
  resume.id = "menu-resume";
  lier(resume, "pause.reprendre");
  const second = (id: string, cle: string, onClick: () => void) => {
    const b = bouton({ texte: t(cle), variante: "secondaire", onClick: () => onClick() }) as HTMLButtonElement;
    b.id = id;
    lier(b, cle);
    return b;
  };
  const restart = second("menu-restart", "pause.recommencer", () => opts.onRestart());
  const respawn = second("menu-respawn", "pause.pointDePassage", () => opts.onRespawn?.());
  const ghost = second("menu-ghost", "fantome.bouton", () => opts.onGhost());
  delete ghost.dataset.t; // son texte porte le nom du choix : `show` l'écrit (et le redessine à chaque langue)
  const diamant = el("p", { classe: "fantome-verrou", attrs: { id: "menu-diamant", hidden: true } });
  const sound = second("menu-sound", "pause.son.oui", () => opts.onSound());
  const settings = second("menu-settings", "pause.reglages", () => opts.onSettings());
  const help = second("menu-help", "pause.aide", () => opts.onHelp());
  // Lot I7 : le plein écran de la pause est le bouton du socle, en texte (même logique que celui de la partie et de l'accueil) ; caché s'il n'est pas possible.
  const full = boutonPleinEcran({ t, id: "menu-fullscreen", classe: ["dj-bouton", "dj-bouton--secondaire"], texte: true });
  const home = second("menu-home", "pause.accueil", () => opts.onHome?.());
  home.hidden = !opts.onHome;
  // Lot I2 de la plateforme : le retour au portail « ‹ DU JOUR » (le logo des barres des jeux, un lien de 44 px).
  const portail = el("a", { classe: "pause__portail", attrs: { id: "menu-portail", href: "../" } }, icone("chevron", { taille: 18 }), lier(el("span", { classe: "dj-logo dj-logo--petit" }), "barre.retour"));
  lier(portail, "barre.retour.aria", undefined, "aria-label");
  // Lot R5 (plateforme) : la page « Mentions légales et confidentialité » du site (racine de playdujour.com) ; lot I6 : celle de la langue choisie.
  const mentions = lierMentions(lier(el("a", { classe: "pause__lien", attrs: { id: "menu-mentions", href: "../mentions-legales/" } }), "pause.mentions"));
  const version = el("span", { classe: "pause__version", attrs: { id: "menu-version" } });
  const actions = el("div", { classe: "pause__actions" }, respawn, restart, ghost, diamant, sound, settings, help, full, home, portail);
  const hoteMessage = el("div", { classe: ["message-direct", "message-direct--pause"] });
  dialog.append(hoteMessage, tete, replique, resume, actions, el("div", { classe: "pause__pied" }, mentions, version));
  document.body.append(root);

  let open = false;
  let view: PauseView | null = null;
  const show = (v: PauseView) => {
    view = v;
    dialog.setAttribute("aria-label", t("pause.aria"));
    niveau.textContent = v.niveau;
    niveau.hidden = v.niveau === "";
    etat.textContent = v.etat;
    replique.textContent = v.replique ? t("commun.citation", { texte: v.replique }) : "";
    replique.hidden = v.replique === "";
    ghost.textContent = t("fantome.bouton", { nom: v.fantome });
    diamant.hidden = !v.diamantVerrou;
    if (v.diamantVerrou) remplirVerrou(diamant);
    lier(sound, v.sound ? "pause.son.oui" : "pause.son.non");
    sound.setAttribute("aria-pressed", v.sound ? "true" : "false");
    version.textContent = v.version;
    respawn.hidden = !v.canResume;
  };
  onLangue(() => {
    if (view) show(view);
  });

  return {
    get isOpen() {
      return open;
    },
    element: root,
    hoteMessage,
    open(v) {
      show(v);
      if (open) return;
      open = true;
      root.hidden = false;
      dialog.scrollTop = 0;
      resume.focus({ preventScroll: true });
    },
    update(v) {
      show(v);
    },
    close() {
      if (!open) return;
      open = false;
      root.hidden = true;
      (document.activeElement as HTMLElement | null)?.blur?.();
    },
  };
}
