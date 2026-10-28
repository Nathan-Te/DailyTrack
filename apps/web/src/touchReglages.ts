import { el as makeEl, row, segmented, type Control } from "./dom";
import { t } from "./i18n";
import type { ButtonSize, SteerMode, TouchPad, TouchSettings } from "./touch";
import type { aligner as Aligner, dir as Dir, SteerRows } from "./touchUi";

// Réglages des commandes tactiles de Réglages › Commandes (lots 10 et 29, lot 52), **chargés à la demande** : `settingsUi.ts` les importe quand l'onglet « Commandes » s'ouvre,
// pas au premier chargement. Le choix du mode, la taille, la disposition inversée, l'accélérateur, la vibration, puis les réglages du mode choisi (ils viennent de son module :
// vides tant qu'il n'est pas chargé).

const MODES: readonly (readonly [SteerMode, string])[] = [
  ["buttons", "tactile.direction.boutons"],
  ["slider", "tactile.direction.glissiere"],
  ["wheel", "tactile.direction.volant"],
  ["gyro", "tactile.direction.gyro"],
];

/**
 * Réglages des commandes tactiles (mode de direction, taille, disposition inversée, accélérateur, vibration, et ceux du mode choisi : lot 52, apportés par son module),
 * appliqués tout de suite et mémorisés (`cdj:touch`). Montés dans Réglages › Commandes ; `onChange` redessine les aides à l'écran.
 */
/** Ce que `settingsUi.ts` lui passe : il n'importe aucune valeur de `touch.ts` ni de `touchUi.ts` (elles restent dans le premier chargement, d'un seul tenant, avec `main.ts`). */
export interface OutilsTactiles {
  dir: typeof Dir;
  aligner: typeof Aligner;
  defauts: Readonly<TouchSettings>;
  enregistrer(s: Readonly<TouchSettings>): void;
}

export function touchSettingsControls(pad: TouchPad, onChange: () => void, { dir, aligner, defauts, enregistrer }: OutilsTactiles): Control {
  const apply = (patch: Partial<TouchSettings>) => {
    if (patch.steerMode !== undefined) {
      if (patch.steerMode === "gyro" && pad.settings.steerMode !== "gyro") dir.avant = pad.settings.steerMode; // pour y revenir si le gyroscope est refusé
      dir.carte = null;
      carte.replaceChildren();
    }
    Object.assign(pad.settings, patch);
    enregistrer(pad.settings);
    pad.releaseAll();
    sync();
    onChange();
    if (patch.steerMode !== undefined) void aligner();
  };
  const steerMode = segmented<SteerMode>(MODES.map(([m, cle]) => [m, t(cle)] as const), () => pad.settings.steerMode, (v) => apply({ steerMode: v }), t("tactile.direction.nom"));
  const size = segmented<ButtonSize>([["small", t("tactile.taille.small")], ["medium", t("tactile.taille.medium")], ["large", t("tactile.taille.large")]], () => pad.settings.buttonSize, (v) => apply({ buttonSize: v }), t("tactile.taille.nom"));
  const mirrored = segmented<boolean>([[true, t("reglages.oui")], [false, t("reglages.non")]], () => pad.settings.mirrored, (v) => apply({ mirrored: v }), t("tactile.inverse.nom"));
  const throttle = segmented<boolean>([[false, t("tactile.accelerateur.bouton")], [true, t("tactile.accelerateur.auto")]], () => pad.settings.autoThrottle, (v) => apply({ autoThrottle: v }), t("tactile.accelerateur.nom"));
  const vibration = segmented<boolean>([[true, t("reglages.oui")], [false, t("reglages.non")]], () => pad.settings.vibration, (v) => apply({ vibration: v }), t("tactile.vibration.nom"));
  const reset = makeEl("button", "dj-bouton dj-bouton--secondaire", t("tactile.reinit"));
  reset.type = "button";
  reset.addEventListener("click", () => apply({ ...defauts }));
  // La carte du dernier retour (gyroscope refusé), puis les réglages du mode choisi (ils viennent de son module : vides tant qu'il n'est pas chargé).
  const carte = makeEl("div", "reglage reglage--pleine");
  const extra = makeEl("div", "reglages__tactile-liste");
  let rows: SteerRows | null = null;
  const dessiner = () => {
    carte.replaceChildren(...(dir.carte ? [dir.carte] : []));
    const c = dir.courant;
    rows = c && c.mode === pad.settings.steerMode ? c.module.rows(apply) : null;
    extra.replaceChildren(...(rows?.nodes ?? []));
    sync();
  };
  dir.surChangement = dessiner;
  const box = makeEl("div", "reglages__tactile-liste");
  box.append(
    row(t("tactile.direction.nom"), steerMode.box, t("tactile.direction.aide")),
    carte,
    extra,
    row(t("tactile.taille.nom"), size.box),
    row(t("tactile.inverse.nom"), mirrored.box, t("tactile.inverse.aide")),
    row(t("tactile.accelerateur.nom"), throttle.box, t("tactile.accelerateur.aide")),
    row(t("tactile.vibration.nom"), vibration.box, t("tactile.vibration.aide")),
    reset,
  );
  function sync() {
    for (const c of [steerMode, size, mirrored, throttle, vibration]) c.sync();
    rows?.sync();
  }
  dessiner();
  sync();
  return { box, sync };
}
