// Réglages (lot 29) : un panneau à onglets — Graphismes, Son, Jeu, Commandes, Profil. Tout s'applique tout de suite et se mémorise.
// Le DOM seulement : les valeurs sont dans settings.ts (`cdj:settings`), audioLogic.ts (`cdj:audio`) et touch.ts (`cdj:touch`) ; main.ts applique.
import { CAMERA_NAMES } from "./cameras";
import { button, el, overlay, row, segmented, slider, type Control } from "./dom";
import { withVolume, type AudioSettings } from "./audioLogic";
import { GAMEPAD_CONTROLS, KEYBOARD_CONTROLS } from "./howto";
import { mountProfileCard, type ProfileCard, type ProfileHost } from "./profileUi";
import {
  DEFAULT_SETTINGS,
  GHOST_CHOICES,
  GHOST_LABEL,
  QUALITY_CHOICES,
  QUALITY_LABEL,
  SPEED_FEEL_CHOICES,
  SPEED_FEEL_LABEL,
  type GameSettings,
  type QualityChoice,
} from "./settings";
import { touchSettingsControls } from "./touchUi";
import type { TouchPad } from "./touch";

export type SettingsTab = "graphics" | "sound" | "game" | "controls" | "profile";

export const TABS: readonly (readonly [SettingsTab, string])[] = [
  ["graphics", "Graphismes"],
  ["sound", "Son"],
  ["game", "Jeu"],
  ["controls", "Commandes"],
  ["profile", "Profil"],
];

export interface SettingsHost {
  /** Les réglages en cours (l'objet vivant : `apply` le modifie, l'enregistre et l'applique). */
  settings: GameSettings;
  apply(patch: Partial<GameSettings>): void;
  /** Son : réglages en cours et changement (enregistré et appliqué par `GameAudio`). */
  audio(): AudioSettings;
  setAudio(s: AudioSettings): void;
  /** Caméra par défaut (la touche C la change aussi). */
  camera(): string;
  setCamera(name: string): void;
  /** Qualité réellement appliquée en ce moment (0 basse, 1 moyenne, 2 haute) — utile en mode automatique. */
  qualityLevel(): number;
  /** Commandes tactiles (appareil tactile seulement) ; `changed` redessine les aides à l'écran. */
  touch: { pad: TouchPad; changed(): void } | null;
  profile: ProfileHost;
  /** Une qualité figée par l'adresse (`?quality=`) l'emporte : on le dit. */
  qualityFromUrl: boolean;
  openHowto(): void;
}

export interface SettingsUi {
  open(tab?: SettingsTab, onClose?: () => void): void;
  close(): void;
  isOpen(): boolean;
  /** Relit les valeurs (après un changement venu d'ailleurs : touche M, touche C, qualité automatique). */
  sync(): void;
}

const LEVEL_NAME = ["basse", "moyenne", "haute"] as const;
const CAMERA_LABEL: Record<string, string> = { proche: "Proche", loin: "Loin", capot: "Capot" };
const yesNo = [[true, "Oui"], [false, "Non"]] as const;

export function mountSettings(root: HTMLElement, host: SettingsHost): SettingsUi {
  let tab: SettingsTab = "graphics";
  let onClose: (() => void) | undefined;
  const close = () => {
    if (ov.root.hidden) return;
    ov.root.hidden = true;
    const f = onClose;
    onClose = undefined;
    f?.();
  };
  const ov = overlay("settings", "Réglages", close);
  ov.root.classList.add("settings");

  const controls: Control[] = [];
  const reg = <T extends Control>(c: T): T => {
    controls.push(c);
    return c;
  };
  const s = host.settings;
  const bool = (key: "particles" | "skids" | "shake" | "shadows" | "board" | "splits", label: string) =>
    reg(segmented<boolean>(yesNo, () => s[key], (v) => host.apply({ [key]: v }), label));

  // --- Graphismes ---
  const quality = reg(segmented<QualityChoice>(QUALITY_CHOICES.map((q) => [q, QUALITY_LABEL[q]] as const), () => s.quality, (v) => host.apply({ quality: v }), "Qualité graphique"));
  const qualityNote = el("p", "note");
  const speedFeel = reg(segmented(SPEED_FEEL_CHOICES.map((v) => [v, SPEED_FEEL_LABEL[v]] as const), () => s.speedFeel, (v) => host.apply({ speedFeel: v }), "Sensation de vitesse"));
  const graphics = el("div", "tabpage");
  graphics.append(
    row("Qualité", quality.box, "Automatique : le jeu baisse seul les détails s'il ramerait, et les remonte ensuite."),
    qualityNote,
    row("Particules", bool("particles", "Particules").box, "Fumée, poussière, étincelles, flammes, confettis."),
    row("Traces de pneus", bool("skids", "Traces de pneus").box),
    row("Secousses de caméra", bool("shake", "Secousses de caméra").box, "Chocs, réceptions et vibreurs."),
    row("Sensation de vitesse", speedFeel.box, "Champ de vision qui s'ouvre, lignes de vitesse, vibration à très haute vitesse."),
    row("Ombres", bool("shadows", "Ombres").box, "Ombres portées de la voiture (qualité moyenne et haute)."),
  );

  // --- Son ---
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const range = { min: 0, max: 1, step: 0.05 };
  const vol = reg(slider(range, () => host.audio().volume, (v) => host.setAudio(withVolume(host.audio(), v)), pct, "Volume général"));
  const engine = reg(slider(range, () => host.audio().engine, (v) => host.setAudio({ ...host.audio(), engine: v }), pct, "Moteur"));
  const effects = reg(slider(range, () => host.audio().effects, (v) => host.setAudio({ ...host.audio(), effects: v }), pct, "Effets"));
  const ambience = reg(slider(range, () => host.audio().ambience, (v) => host.setAudio({ ...host.audio(), ambience: v }), pct, "Ambiance"));
  const mute = reg(
    segmented<boolean>([[false, "Son"], [true, "Muet"]], () => host.audio().volume <= 0, (v) => {
      const a = host.audio();
      host.setAudio(v ? { ...a, volume: 0, last: a.volume > 0 ? a.volume : a.last } : { ...a, volume: a.last > 0 ? a.last : 0.55 });
    }, "Muet"),
  );
  const sound = el("div", "tabpage");
  sound.append(
    row("Muet", mute.box, "La touche M fait de même."),
    row("Volume général", vol.box),
    row("Moteur", engine.box),
    row("Effets", effects.box, "Crissements, roulement, vent, bruitages."),
    row("Ambiance", ambience.box, "Le fond sonore du thème du jour."),
  );

  // --- Jeu ---
  const camera = reg(segmented(CAMERA_NAMES.map((n) => [n, CAMERA_LABEL[n] ?? n] as const), () => host.camera() as (typeof CAMERA_NAMES)[number], (v) => host.setCamera(v), "Caméra par défaut"));
  const ghost = reg(segmented(GHOST_CHOICES.map((g) => [g, GHOST_LABEL[g]] as const), () => s.ghost, (v) => host.apply({ ghost: v }), "Fantôme affiché"));
  const unit = reg(segmented<GameSettings["unit"]>([["kmh", "km/h"], ["mph", "mph"]], () => s.unit, (v) => host.apply({ unit: v }), "Unité de vitesse"));
  const game = el("div", "tabpage");
  game.append(
    row("Caméra par défaut", camera.box, "Au départ ; la touche C ou le bouton 🎥 la change aussi."),
    row("Fantôme affiché", ghost.box, "Au prochain départ. Le premier et le joueur devant demandent le classement."),
    row("Classement en course", bool("board", "Classement en course").box, "Affiché dans un coin ; la touche L le replie."),
    row("Temps intermédiaires", bool("splits", "Temps intermédiaires").box, "Ton temps à chaque point de contrôle, comparé au fantôme."),
    row("Unité de vitesse", unit.box),
  );

  // --- Commandes ---
  const commands = el("div", "tabpage");
  const reminder = (title: string, list: typeof KEYBOARD_CONTROLS) => {
    const d = el("details", "dev");
    d.open = title === "Clavier" && !host.touch;
    const body = el("div", "controls");
    for (const c of list) {
      const r = el("div", "ctl");
      const keys = el("span", "keys");
      c.keys.forEach((k, i) => {
        if (i > 0) keys.append(el("span", "or", "·"));
        keys.append(el("kbd", "", k));
      });
      r.append(keys, el("span", "does", c.does));
      body.append(r);
    }
    d.append(el("summary", "", title), body);
    return d;
  };
  commands.append(reminder("Clavier", KEYBOARD_CONTROLS), reminder("Manette", GAMEPAD_CONTROLS));
  if (host.touch) {
    const t = touchSettingsControls(host.touch.pad, host.touch.changed);
    controls.push(t);
    const box = el("section", "touchbox");
    box.append(el("h3", "", "Commandes tactiles"), t.box);
    commands.append(box);
  } else {
    commands.append(el("p", "note", "Sur un téléphone ou une tablette, les réglages des commandes tactiles (direction, sensibilité, taille des boutons, accélérateur automatique, vibration) apparaissent ici."));
  }
  commands.append(button("❓ Comment jouer", "link", () => host.openHowto()));

  // --- Profil ---
  const profile: ProfileCard = mountProfileCard(host.profile);
  const profilePage = el("div", "tabpage");
  profilePage.append(profile.root);

  const reset = button("Rétablir les réglages par défaut", "small reset", () => {
    host.apply({ ...DEFAULT_SETTINGS });
    host.setAudio({ ...host.audio(), engine: 1, effects: 1, ambience: 1 });
  });
  reset.id = "settings-reset";

  const pages: Record<SettingsTab, HTMLElement> = { graphics, sound, game, controls: commands, profile: profilePage };
  const tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");
  const tabButtons = new Map<SettingsTab, HTMLButtonElement>();
  for (const [id, label] of TABS) {
    const b = el("button", "tab", label);
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
  ov.body.append(tabs, graphics, sound, game, commands, profilePage, reset);
  root.append(ov.root);

  function show(id: SettingsTab) {
    tab = id;
    for (const [t, b] of tabButtons) {
      b.classList.toggle("on", t === id);
      b.setAttribute("aria-selected", String(t === id));
      b.tabIndex = t === id ? 0 : -1;
      pages[t].hidden = t !== id;
    }
    ov.body.scrollTop = 0;
    sync();
  }
  // Flèches gauche / droite entre les onglets.
  tabs.addEventListener("keydown", (e) => {
    const ids = TABS.map(([t]) => t);
    const i = ids.indexOf(tab);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const next = ids[(i + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length]!;
      show(next);
      tabButtons.get(next)!.focus();
    }
  });

  function sync() {
    for (const c of controls) c.sync();
    const level = LEVEL_NAME[host.qualityLevel()] ?? "haute";
    qualityNote.textContent = host.qualityFromUrl ? "La qualité est imposée par l'adresse de la page (?quality=)." : s.quality === "auto" ? `Niveau actuel : ${level}.` : "";
    qualityNote.hidden = !qualityNote.textContent;
    profile.refresh();
  }

  return {
    open(id = tab, cb) {
      onClose = cb;
      ov.root.hidden = false;
      show(id);
      tabButtons.get(id)!.focus({ preventScroll: true });
    },
    close,
    isOpen: () => !ov.root.hidden,
    sync,
  };
}
