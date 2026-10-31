// Réglages (lot 29, passés au socle au lot I4 ; maquette track-reglages.html) : un écran dans le cadre de Du Jour, à onglets — Graphismes, Son, Jeu,
// Commandes — puis la langue (`choixLangue` du socle), le lien vers le profil commun du portail et les mentions légales. Tout s'applique tout de suite et
// se mémorise. Le DOM seulement : les valeurs sont dans settings.ts (`cdj:settings`), audioLogic.ts (`cdj:audio`) et touch.ts (`cdj:touch`) ; main.ts applique.
// Les textes viennent du catalogue (`reglages.*`) ; changer de langue redessine l'écran tout de suite, le focus reste sur le choix de langue.
import { bouton, choixLangue, icone } from "@cdj/ui";
import { CAMERA_NAMES } from "./cameras";
import { creerCadre } from "./cadre";
import { el, row, segmented, slider, type Control } from "./dom";
import type { ControleMusique } from "@cdj/ui/src/panneauMusique";
import { withVolume, type AudioSettings } from "./audioLogic";
import { GAMEPAD_CONTROLS, KEYBOARD_CONTROLS } from "./howto";
import { controlsTable } from "./howtoUi";
import { langueCourante, lierMentions, onLangue, setLangue, t, traducteurDuSocle } from "./i18n";
import { profilHref } from "./profilLien";
import { DEFAULT_SETTINGS, GHOST_CHOICES, GHOST_KEY, SPEED_FEEL_CHOICES, SPEED_FEEL_KEY, type GameSettings } from "./settings";
import { CHOIX_GRAPHISMES, type ChoixGraphismes, type NiveauQualite } from "./qualite";
import { DEFAULT_TOUCH_SETTINGS, saveTouchSettings, type TouchPad } from "./touch";
import { aligner, dir } from "./touchUi";

export type SettingsTab = "graphics" | "sound" | "game" | "controls";

export const TABS: readonly (readonly [SettingsTab, string])[] = [
  ["graphics", "reglages.onglet.graphics"],
  ["sound", "reglages.onglet.sound"],
  ["game", "reglages.onglet.game"],
  ["controls", "reglages.onglet.controls"],
];

export interface SettingsHost {
  /** Les réglages en cours (l'objet vivant : `apply` le modifie, l'enregistre et l'applique). */
  settings: GameSettings;
  apply(patch: Partial<GameSettings>): void;
  /** Son : réglages en cours et changement (enregistré et appliqué par `GameAudio`). */
  audio(): AudioSettings;
  setAudio(s: AudioSettings): void;
  /** Lot « musique » : le lecteur de la musique commune (il se charge s'il ne l'est pas : l'onglet Son est un geste). */
  musique(): Promise<ControleMusique>;
  /** Caméra par défaut (la touche C la change aussi). */
  camera(): string;
  setCamera(name: string): void;
  /** Commandes tactiles (appareil tactile seulement) ; `changed` redessine les aides à l'écran. */
  touch: { pad: TouchPad; changed(): void } | null;
  /** Lot 45 : la « Qualité graphique » — un choix qui attend la fin de la course, le palier de la scène en ce moment (1 à 3). */
  graphismes(): { enAttente: boolean; niveau: NiveauQualite | null; trop?: boolean };
  openHowto(): void;
}

export interface SettingsUi {
  open(tab?: SettingsTab, onClose?: () => void): void;
  close(): void;
  isOpen(): boolean;
  /** Relit les valeurs (après un changement venu d'ailleurs : touche M, touche C, qualité automatique). */
  sync(): void;
}

export function mountSettings(root: HTMLElement, host: SettingsHost): SettingsUi {
  let tab: SettingsTab = "graphics";
  let onClose: (() => void) | undefined;
  let opened = false;
  const close = () => {
    if (!opened) return;
    opened = false;
    cadre.racine.hidden = true;
    const f = onClose;
    onClose = undefined;
    f?.();
  };
  const cadre = creerCadre({ id: "settings", titreAria: "reglages.titre", retour: "jeu", onRetour: close, haut: true });
  cadre.racine.hidden = true;
  cadre.racine.classList.add("settings");

  let controls: Control[] = [];
  /** Charge et monte les réglages tactiles (une fois par construction de l'écran) ; `null` quand c'est fait ou sans appareil tactile. */
  let chargerTactile: (() => void) | null = null;
  /** Lot « musique » : le bloc commun de la musique (réglages communs aux trois jeux), monté à la première ouverture de l'onglet Son : lecteur et panneau se chargent à ce moment-là. */
  let chargerMusique: (() => void) | null = null;
  let graphismesNote: HTMLElement;
  let tabButtons = new Map<SettingsTab, HTMLButtonElement>();
  let pages: Record<SettingsTab, HTMLElement>;

  const reg = <C extends Control>(c: C): C => {
    controls.push(c);
    return c;
  };
  const s = host.settings;
  const yesNo = (): readonly (readonly [boolean, string])[] => [[true, t("reglages.oui")], [false, t("reglages.non")]];
  const bool = (key: "particles" | "skids" | "shake" | "shadows" | "board" | "splits", label: string) => reg(segmented<boolean>(yesNo(), () => s[key], (v) => host.apply({ [key]: v }), label));

  /** Bâtit tout l'écran dans la langue courante (à l'ouverture et à chaque changement de langue). */
  function build(): void {
    controls = [];
    // --- Graphismes ---
    // Lot 45 : la « Qualité graphique » (le palier de la scène), le seul réglage de qualité : la fluidité dans un palier est toujours automatique (`QualityGovernor`, lot 9).
    const graphismes = reg(segmented<ChoixGraphismes>(CHOIX_GRAPHISMES.map((c) => [c, t(`reglages.graphismes.${c}`)] as const), () => s.graphismes, (v) => host.apply({ graphismes: v }), t("reglages.graphismes.nom")));
    graphismesNote = el("p", "note");
    const speedFeel = reg(segmented(SPEED_FEEL_CHOICES.map((v) => [v, t(SPEED_FEEL_KEY[v])] as const), () => s.speedFeel, (v) => host.apply({ speedFeel: v }), t("reglages.sensation.nom")));
    const graphics = el("div", "reglages__page");
    graphics.append(
      row(t("reglages.graphismes.nom"), graphismes.box, t("reglages.graphismes.aide")),
      graphismesNote,
      row(t("reglages.particules.nom"), bool("particles", t("reglages.particules.nom")).box, t("reglages.particules.aide")),
      row(t("reglages.traces.nom"), bool("skids", t("reglages.traces.nom")).box),
      row(t("reglages.secousses.nom"), bool("shake", t("reglages.secousses.nom")).box, t("reglages.secousses.aide")),
      row(t("reglages.sensation.nom"), speedFeel.box, t("reglages.sensation.aide")),
      row(t("reglages.ombres.nom"), bool("shadows", t("reglages.ombres.nom")).box, t("reglages.ombres.aide")),
    );

    // --- Son ---
    const pct = (v: number) => `${Math.round(v * 100)} %`;
    const range = { min: 0, max: 1, step: 0.05 };
    const vol = reg(slider(range, () => host.audio().volume, (v) => host.setAudio(withVolume(host.audio(), v)), pct, t("reglages.son.volume")));
    const engine = reg(slider(range, () => host.audio().engine, (v) => host.setAudio({ ...host.audio(), engine: v }), pct, t("reglages.son.moteur")));
    const effects = reg(slider(range, () => host.audio().effects, (v) => host.setAudio({ ...host.audio(), effects: v }), pct, t("reglages.son.effets.nom")));
    const ambience = reg(slider(range, () => host.audio().ambience, (v) => host.setAudio({ ...host.audio(), ambience: v }), pct, t("reglages.son.ambiance.nom")));
    const mute = reg(
      segmented<boolean>([[false, t("reglages.son.avec")], [true, t("reglages.son.muet.nom")]], () => host.audio().volume <= 0, (v) => {
        const a = host.audio();
        host.setAudio(v ? { ...a, volume: 0, last: a.volume > 0 ? a.volume : a.last } : { ...a, volume: a.last > 0 ? a.last : 0.55 });
      }, t("reglages.son.muet.nom")),
    );
    const sound = el("div", "reglages__page");
    sound.append(
      row(t("reglages.son.muet.nom"), mute.box, t("reglages.son.muet.aide")),
      row(t("reglages.son.volume"), vol.box),
      row(t("reglages.son.moteur"), engine.box),
      row(t("reglages.son.effets.nom"), effects.box, t("reglages.son.effets.aide")),
      row(t("reglages.son.ambiance.nom"), ambience.box, t("reglages.son.ambiance.aide")),
    );
    const placeMusique = el("div", "reglages__musique");
    sound.append(placeMusique);
    chargerMusique = () => {
      chargerMusique = null;
      void import("@cdj/ui/src/panneauMusique").then((m) => m.monterPanneau(host.musique, placeMusique), () => undefined);
    };

    // --- Jeu ---
    const camera = reg(segmented(CAMERA_NAMES.map((n) => [n, t(`reglages.camera.${n}`)] as const), () => host.camera() as (typeof CAMERA_NAMES)[number], (v) => host.setCamera(v), t("reglages.camera.nom")));
    const ghost = reg(segmented(GHOST_CHOICES.map((g) => [g, t(GHOST_KEY[g])] as const), () => s.ghost, (v) => host.apply({ ghost: v }), t("reglages.fantome.nom")));
    const unit = reg(segmented<GameSettings["unit"]>([["kmh", "km/h"], ["mph", "mph"]], () => s.unit, (v) => host.apply({ unit: v }), t("reglages.unite.nom"))); // i18n-ok: unités, les mêmes dans les deux langues
    const game = el("div", "reglages__page");
    game.append(
      row(t("reglages.camera.nom"), camera.box, t("reglages.camera.aide")),
      row(t("reglages.fantome.nom"), ghost.box, t("reglages.fantome.aide")),
      row(t("reglages.classement.nom"), bool("board", t("reglages.classement.nom")).box, t("reglages.classement.aide")),
      row(t("reglages.temps.nom"), bool("splits", t("reglages.temps.nom")).box, t("reglages.temps.aide")),
      row(t("reglages.unite.nom"), unit.box),
    );

    // --- Commandes ---
    const commands = el("div", "reglages__page");
    const reminder = (title: string, list: typeof KEYBOARD_CONTROLS, open: boolean) => {
      const d = el("details", "repli");
      d.open = open;
      d.append(el("summary", "", title), controlsTable(list));
      return d;
    };
    commands.append(reminder(t("reglages.clavier"), KEYBOARD_CONTROLS, !host.touch), reminder(t("reglages.manette"), GAMEPAD_CONTROLS, false));
    if (host.touch) {
      // Lot 52 : les réglages tactiles sont un morceau chargé à la demande (`touchReglages.ts`), à la première ouverture de l'onglet « Commandes » : ils n'ont rien à faire dans le premier chargement.
      const box = el("section", "reglages__tactile");
      const liste = controls;
      box.append(el("h2", "reglages__section", t("reglages.tactile.titre")));
      commands.append(box);
      const { pad, changed } = host.touch;
      chargerTactile = () => {
        chargerTactile = null;
        void import("./touchReglages").then((m) => {
          const touch = m.touchSettingsControls(pad, changed, { dir, aligner, defauts: DEFAULT_TOUCH_SETTINGS, enregistrer: saveTouchSettings });
          liste.push(touch);
          box.append(touch.box);
          touch.sync();
        });
      };
    } else {
      commands.append(el("p", "note", t("reglages.tactile.absent")));
    }
    const howto = bouton({ texte: t("reglages.aide"), variante: "secondaire", onClick: () => host.openHowto() });
    howto.id = "settings-howto";
    commands.append(howto);

    pages = { graphics, sound, game, controls: commands };
    const tabs = el("div", "segment reglages__onglets");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", t("reglages.sections"));
    tabButtons = new Map();
    for (const [id, cle] of TABS) {
      const b = el("button", "segment__bouton", t(cle));
      b.type = "button";
      b.id = `tab-${id}`;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", `page-${id}`);
      b.addEventListener("click", () => show(id));
      tabs.append(b);
      tabButtons.set(id, b);
      pages[id].id = `page-${id}`;
      pages[id].setAttribute("role", "tabpanel");
      pages[id].setAttribute("aria-labelledby", b.id);
    }
    // Flèches gauche / droite entre les onglets.
    tabs.addEventListener("keydown", (e) => {
      const ids = TABS.map(([i]) => i);
      const i = ids.indexOf(tab);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const next = ids[(i + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length]!;
        show(next);
        tabButtons.get(next)!.focus();
      }
    });

    // --- Bas de l'écran : langue, profil commun, mentions légales, réinitialisation ---
    const langue = el("section", "reglages__langue");
    const langueTitre = el("h2", "reglages__section", t("reglages.langue.titre"));
    langue.append(langueTitre, choixLangue(traducteurDuSocle(), { langue: langueCourante(), onChange: (l) => setLangue(l) }));
    const liens = el("div", "reglages__liens");
    const profil = el("a", "reglages__lien reglages__lien--profil", t("reglages.profil"));
    profil.id = "settings-profile";
    profil.setAttribute("href", profilHref(location.origin, location.pathname));
    const mentions = el("a", "reglages__lien", t("reglages.mentions"));
    mentions.id = "settings-mentions";
    lierMentions(mentions); // lot I6 : la page de la langue choisie
    for (const a of [profil, mentions]) a.append(icone("chevron", { taille: 16 }));
    liens.append(profil, mentions);
    const reset = bouton({
      texte: t("reglages.reinit"),
      variante: "secondaire",
      onClick: () => {
        host.apply({ ...DEFAULT_SETTINGS });
        host.setAudio({ ...host.audio(), engine: 1, effects: 1, ambience: 1 });
      },
    });
    reset.id = "settings-reset";

    const tete = el("div", "etiquette__tete");
    tete.append(el("h1", "etiquette__titre", t("reglages.titre")));
    cadre.corps.replaceChildren(tete, tabs, graphics, sound, game, commands, reset, langue, liens);
    show(tab);
  }

  function show(id: SettingsTab): void {
    tab = id;
    for (const [i, b] of tabButtons) {
      b.setAttribute("aria-selected", String(i === id)); // lot I6 : un onglet n'a pas d'`aria-pressed` (axe : aria-allowed-attr)
      b.tabIndex = i === id ? 0 : -1;
      pages[i].hidden = i !== id;
    }
    cadre.corps.scrollTop = 0;
    if (id === "controls") chargerTactile?.();
    if (id === "sound") chargerMusique?.();
    sync();
  }

  function sync(): void {
    // Rien à relire tant que la fenêtre n'a pas été ouverte : au montage, main.ts n'a pas fini d'initialiser ce que `host` lit (caméra, qualité).
    if (!opened) return;
    for (const c of controls) c.sync();
    const g = host.graphismes();
    const niveau = g.niveau && CHOIX_GRAPHISMES[g.niveau];
    // En attente : la raison ; en Auto : le palier choisi pour l'appareil ; sinon ce que contient le choix fait.
    graphismesNote.textContent = g.enAttente ? t("reglages.graphismes.attente") : s.graphismes === "auto" ? (niveau ? t("reglages.graphismes.actuel", { niveau: t(`reglages.graphismes.${niveau}`) }) : "") : t(`reglages.graphismes.detail.${s.graphismes}`);
    // Lot 50 : une course trop lente pour ce qui était dessiné — Auto a déjà allégé l'image ; un autre choix la garde, la note le dit.
    if (g.trop && !g.enAttente && s.graphismes !== "auto" && s.graphismes !== "economie") graphismesNote.textContent += ` ${t("reglages.graphismes.tropLourd")}`;
    graphismesNote.hidden = !graphismesNote.textContent;
  }

  build();
  root.append(cadre.racine);
  // La langue change : tout l'écran se redessine, le focus reste sur le bouton de langue touché.
  onLangue((l) => {
    const avait = cadre.racine.contains(document.activeElement);
    build();
    if (avait) cadre.racine.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus({ preventScroll: true });
  });

  return {
    open(id = tab, cb) {
      onClose = cb;
      opened = true;
      cadre.racine.hidden = false;
      show(id);
      tabButtons.get(id)!.focus({ preventScroll: true });
    },
    close,
    isOpen: () => opened,
    sync,
  };
}
