import type { OptionsPartie } from "@cdj/kit/jeu/types";

// Les textes que le jeu écrit lui-même (« 4 582 pts », « combo ×3 »). Lot « manques de Blocks » : plus de traducteur global fourni par `main.ts` — le kit donne `t` (et la langue) à la scène (`OptionsPartie`) et le
// passe aux fonctions de la définition (`formatScore`, `scorePartage`, `extrasPartage`) : chaque fonction reçoit son traducteur. Aucune chaîne en dur : tout vient des catalogues `fr` + `en`.
export type Traduire = OptionsPartie["t"];

/** Un score écrit pour un joueur : `4 582 pts` (le nombre au format de la langue : « 4 582 » ou « 4,582 »). */
export const ecrireScore = (n: number, t: Traduire, langue: string): string => t("score.valeur", { n: formaterNombre(n, langue) });

/** Un nombre au format de la langue (« 4 582 » en français, « 4,582 » en anglais), avec une espace insécable : il ne se coupe jamais en bout de ligne. */
export const formaterNombre = (n: number, langue: string): string => new Intl.NumberFormat(langue === "en" ? "en-US" : "fr-FR").format(n).replace(/[\u202f\u2009]/g, "\u00a0");

/** La part « combo ×7 » de la ligne à partager ; rien sans combo (un combo de 0 n'est pas à montrer). */
export const ecrireComboPartage = (combo: number, t: Traduire): string | null => (combo > 0 ? t("partage.combo", { n: combo }) : null);
