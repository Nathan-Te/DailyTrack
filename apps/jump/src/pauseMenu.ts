import type { EffectsLevel, PlayerSettings } from "./settings";

// Menu ⏸ (lot 8), DOM seulement : Reprendre, Recommencer, les réglages du joueur et l'aide des commandes. Ouvert, la partie est en pause
// (aucun pas de simulation : le chrono est figé). Les réglages s'appliquent tout de suite et se mémorisent (`settings.ts`) ; ils ne touchent
// jamais à la simulation. Cibles d'au moins 44 px (boutons, curseurs, choix), en portrait comme en paysage.

export interface PauseMenuOptions {
  settings: PlayerSettings;
  onChange(s: PlayerSettings, changed: keyof PlayerSettings): void;
  onResume(): void;
  onRestart(): void;
  /** Lot 10 : retour à l'accueil. */
  onHome?(): void;
  /** Le téléphone sait vibrer (`navigator.vibrate`) : sinon le réglage le dit. */
  canVibrate: boolean;
  /** Lot P2 (plateforme) : Réglages › Profil (le profil commun, `profileUi.ts`), placé avant l'aide des commandes. */
  profile?: HTMLElement;
}

export interface PauseMenu {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  readonly element: HTMLElement;
}

const EFFECT_LABELS: Record<EffectsLevel, string> = { normal: "Normal", reduit: "Réduit", aucun: "Aucun" };

/** Aide des commandes (affichée dans le menu). */
export const COMMANDS_HELP: readonly { device: string; lines: readonly string[] }[] = [
  { device: "Clavier", lines: ["← → (ou Q D) : courir", "Espace, ↑ ou Z : sauter", "R : recommencer", "Échap ou P : menu", "G : fantôme"] },
  { device: "Manette", lines: ["Stick ou croix : courir", "A ou B : sauter", "Select : recommencer", "Start : menu"] },
  { device: "Tactile", lines: ["Moitié gauche : ← →", "Moitié droite : sauter", "↻ : recommencer", "⏸ : menu", "👻 : fantôme"] },
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function mountPauseMenu(opts: PauseMenuOptions): PauseMenu {
  let s = { ...opts.settings };
  const root = el("div");
  root.id = "menu";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Pause");
  root.hidden = true;

  const head = el("div", "mhead");
  head.append(el("h2", undefined, "Pause"));
  const actions = el("div", "mactions");
  const resume = el("button", "mbtn primary", "Reprendre");
  resume.type = "button";
  resume.id = "menu-resume";
  const restart = el("button", "mbtn", "Recommencer");
  restart.type = "button";
  restart.id = "menu-restart";
  actions.append(resume, restart);
  // Lot 10 : l'accueil (on y revient par le menu ⏸ une fois la partie lancée).
  const home = el("button", "mbtn", "Accueil");
  home.type = "button";
  home.id = "menu-home";
  home.hidden = !opts.onHome;
  // Lot I2 de la plateforme : le retour au portail « Du Jour » (clé prête à traduire : barre.retour du catalogue commun, lot I5).
  const portail = el("a", "mbtn mportail", "‹ Du Jour");
  portail.id = "menu-portail";
  portail.href = "../";
  portail.setAttribute("aria-label", "Retour au portail Du Jour");
  portail.dataset.t = "barre.retour";
  actions.append(home, portail);
  head.append(actions);
  root.append(head);

  const change = (key: keyof PlayerSettings) => opts.onChange({ ...s }, key);

  // ——— Son ———
  const sound = el("section", "msection");
  sound.append(el("h3", undefined, "Son"));
  const slider = (key: "volume" | "sfx" | "ambience", label: string, hint?: string) => {
    const row = el("label", "mrow range");
    row.dataset.setting = key;
    const name = el("span", "mlabel", label);
    const out = el("output", "mvalue");
    const input = el("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "5";
    const show = () => {
      input.value = String(Math.round(s[key] * 100));
      out.textContent = `${Math.round(s[key] * 100)} %`;
    };
    input.addEventListener("input", () => {
      s = { ...s, [key]: Number(input.value) / 100 };
      out.textContent = `${input.value} %`;
      change(key);
    });
    row.append(name, out, input);
    if (hint) row.append(el("span", "mhint", hint));
    sound.append(row);
    return show;
  };
  const shows: (() => void)[] = [];
  shows.push(slider("volume", "Volume général"));
  shows.push(slider("sfx", "Effets sonores"));
  shows.push(slider("ambience", "Ambiance", "Les ambiances arrivent avec les thèmes (lot 9)."));
  root.append(sound);

  // ——— Sensations ———
  const feel = el("section", "msection");
  feel.append(el("h3", undefined, "Sensations"));
  const toggle = (key: "vibration" | "shake" | "reducedMotion", label: string, hint?: string) => {
    const b = el("button", "mbtn mtoggle");
    b.type = "button";
    b.dataset.setting = key;
    const show = () => {
      b.setAttribute("aria-pressed", s[key] ? "true" : "false");
      b.textContent = `${label} : ${s[key] ? "oui" : "non"}`;
    };
    b.addEventListener("click", () => {
      s = { ...s, [key]: !s[key] };
      show();
      change(key);
    });
    feel.append(b);
    if (hint) feel.append(el("p", "mhint", hint));
    return show;
  };
  shows.push(toggle("vibration", "Vibrations", opts.canVibrate ? undefined : "Cet appareil ne vibre pas (iPhone, ordinateur)."));
  shows.push(toggle("shake", "Tremblement d'écran"));
  shows.push(toggle("reducedMotion", "Mouvement réduit", "Ni secousse, ni particules, ni traînée ; le fond ne défile plus."));
  const seg = el("div", "mseg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Effets visuels");
  seg.dataset.setting = "effects";
  seg.append(el("span", "mlabel", "Effets visuels"));
  const segButtons = el("div", "msegbtns");
  const effectButtons = (Object.keys(EFFECT_LABELS) as EffectsLevel[]).map((level) => {
    const b = el("button", "mbtn", EFFECT_LABELS[level]);
    b.type = "button";
    b.dataset.value = level;
    b.addEventListener("click", () => {
      s = { ...s, effects: level };
      shows.forEach((f) => f());
      change("effects");
    });
    segButtons.append(b);
    return b;
  });
  seg.append(segButtons, el("p", "mhint", "Les taches de peinture restent toujours."));
  shows.push(() => effectButtons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.value === s.effects ? "true" : "false")));
  feel.append(seg);
  root.append(feel);

  // ——— Lot P2 : les fantômes ———
  const ghosts = el("section", "msection");
  ghosts.append(el("h3", undefined, "Fantômes"));
  const firstGhost = el("button", "mbtn mtoggle");
  firstGhost.type = "button";
  firstGhost.dataset.setting = "firstGhost";
  firstGhost.id = "menu-first-ghost";
  shows.push(() => {
    firstGhost.setAttribute("aria-pressed", s.firstGhost ? "true" : "false");
    firstGhost.textContent = `Fantôme du premier : ${s.firstGhost ? "oui" : "non"}`;
  });
  firstGhost.addEventListener("click", () => {
    s = { ...s, firstGhost: !s.firstGhost };
    shows.forEach((f) => f());
    change("firstGhost");
  });
  ghosts.append(firstGhost, el("p", "mhint", "Le meilleur essai du jour, en mauve, avec son pseudo, à côté de ton fantôme (cyan). Ton fantôme : bouton 👻 ou touche G."));
  root.append(ghosts);

  // ——— Lot P3 : les taches de tout le monde ———
  const stainsSection = el("section", "msection");
  stainsSection.append(el("h3", undefined, "Taches"));
  const othersStains = el("button", "mbtn mtoggle");
  othersStains.type = "button";
  othersStains.dataset.setting = "othersStains";
  othersStains.id = "menu-others-stains";
  shows.push(() => {
    othersStains.setAttribute("aria-pressed", s.othersStains ? "true" : "false");
    othersStains.textContent = `Taches de tout le monde : ${s.othersStains ? "oui" : "non"}`;
  });
  othersStains.addEventListener("click", () => {
    s = { ...s, othersStains: !s.othersStains };
    shows.forEach((f) => f());
    change("othersStains");
  });
  stainsSection.append(othersStains, el("p", "mhint", "Les morts des autres joueurs du jour, plus pâles et plus petites que les tiennes : on voit où le niveau tue."));
  root.append(stainsSection);

  // ——— Lot P2 : Réglages › Profil ———
  if (opts.profile) root.append(opts.profile);

  // ——— Commandes ———
  const help = el("section", "msection mhelp");
  help.append(el("h3", undefined, "Commandes"));
  for (const d of COMMANDS_HELP) {
    const block = el("div", "mdevice");
    block.append(el("h4", undefined, d.device));
    const ul = el("ul");
    for (const line of d.lines) ul.append(el("li", undefined, line));
    block.append(ul);
    help.append(block);
  }
  root.append(help);

  // ——— Lot R5 (plateforme) : la page « Mentions légales et confidentialité » du site (racine de playdujour.com) ———
  const legal = el("p", "mhint mlegal");
  const mentions = el("a", undefined, "Mentions légales et confidentialité");
  mentions.id = "menu-mentions";
  mentions.href = "../mentions-legales/";
  legal.append(mentions);
  root.append(legal);

  document.body.append(root);
  shows.forEach((f) => f());

  let open = false;
  resume.addEventListener("click", () => opts.onResume());
  restart.addEventListener("click", () => opts.onRestart());
  home.addEventListener("click", () => opts.onHome?.());

  return {
    get isOpen() {
      return open;
    },
    element: root,
    open() {
      if (open) return;
      open = true;
      root.hidden = false;
      root.scrollTop = 0;
      resume.focus({ preventScroll: true });
    },
    close() {
      if (!open) return;
      open = false;
      root.hidden = true;
      (document.activeElement as HTMLElement | null)?.blur?.();
    },
  };
}
