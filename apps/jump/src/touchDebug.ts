import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";

// Ligne de vérification des commandes tactiles (lot 29, `?debug`) : outil interne de Nathan, en français (exempté des catalogues). Elle dit, à chaque
// toucher, les doigts que le jeu croit posés et les touches qu'il tient : sur un téléphone, « doigts 0 · aucune touche tenue » doit revenir dès que le
// dernier doigt est levé. Pure : le DOM (`#touchdebug`) est dans `touchUi.ts`.

/** Pourquoi les doigts ont été lâchés d'office (et non par un lever normal) : le dernier est rappelé en fin de ligne. */
export type ReleaseReason = "annulation" | "perte de capture" | "toucher perdu" | "focus" | "visibilité" | "pagehide" | "rotation" | "panneau" | "souris ignorée";

export function touchDebugLine(fingers: number, bits: number, last: ReleaseReason | null): string {
  const keys = [bits & INPUT_LEFT ? "←" : "", bits & INPUT_RIGHT ? "→" : "", bits & INPUT_JUMP ? "SAUT" : ""].filter(Boolean);
  const held = keys.length === 0 ? "aucune touche tenue" : `${keys.join(" et ")} ${keys.length === 1 ? "tenue" : "tenues"}`;
  return `doigts ${fingers} · ${held}${last ? ` · dernier relâchement : ${last}` : ""}`;
}
