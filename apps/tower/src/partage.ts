import type { NomMedaille } from "@cdj/tower-sim";
import { formatNombre, type Langue } from "@cdj/ui";

// La ligne à partager de Tower (lot T4), **logique pure** (testée sans DOM), au format du seed (§ 3) et des autres jeux :
//   `Du Jour · Tower #12 — 42,7 m — 🥇 — ❤️❤️🖤`
// Le titre `Du Jour · Tower #N` vient du catalogue (le même dans les deux langues) ; la hauteur est arrondie à UNE décimale (le format de la langue : `42.7 m` en anglais) ; la médaille
// (💎 pour le Diamant) est omise quand il n'y en a pas ; un cœur ❤️ par vie restante et un 🖤 par vie perdue. **Les émojis ne vivent que dans cette ligne** (charte § 6) : ils sont écrits
// ici par leur code, jamais dans un catalogue ni une feuille de style (`test/partage.test.ts` le vérifie sur tout `src/`). Rien d'identifiant (ni pseudo, ni rang : le rang de l'écran
// d'arrivée n'est pas dans la ligne, décision de la maquette).

/** Les émojis de la ligne, par code. */
export const EMOJI_MEDAILLE: Readonly<Record<NomMedaille, string>> = {
  bronze: "\u{1F949}",
  argent: "\u{1F948}",
  or: "\u{1F947}",
  auteur: "\u{1F48E}",
};
export const EMOJI_VIE = "\u{2764}\u{FE0F}";
export const EMOJI_VIE_PERDUE = "\u{1F5A4}";

export interface DonneesPartage {
  /** `Du Jour · Tower #12` (ou avec la date, avant le premier jour), déjà dans la langue. */
  titre: string;
  hauteurMm: number;
  medaille: NomMedaille | null;
  /** Les vies restantes et le total (3). */
  vies: number;
  total: number;
  langue: Langue;
}

/** La hauteur à une décimale, en mètres, arrondie au dixième le plus proche (entiers : jamais 42,65 → 42,6 par un flottant). */
export function hauteurPartagee(hauteurMm: number, langue: Langue): string {
  const dixiemes = Math.floor((hauteurMm + 50) / 100);
  return `${formatNombre(dixiemes / 10, langue, 1)} m`;
}

/** Les cœurs : un plein par vie restante, un noir par vie perdue. */
export function coeursPartages(vies: number, total: number): string {
  const restantes = Math.max(0, Math.min(total, vies));
  return EMOJI_VIE.repeat(restantes) + EMOJI_VIE_PERDUE.repeat(Math.max(0, total - restantes));
}

/** `Du Jour · Tower #12 — 42,7 m — 🥇 — ❤️❤️🖤` (sans médaille : ce morceau est omis). */
export function ligneDePartage(d: DonneesPartage): string {
  const morceaux = [d.titre, hauteurPartagee(d.hauteurMm, d.langue)];
  if (d.medaille) morceaux.push(EMOJI_MEDAILLE[d.medaille]);
  morceaux.push(coeursPartages(d.vies, d.total));
  return morceaux.join(" — ");
}

/** Texte complet : la ligne, puis le lien du jeu (l'adresse courante sans paramètre : un aperçu de branche partage un lien d'aperçu). */
export function textePartage(d: DonneesPartage, lieu: { origin: string; pathname: string }): string {
  return `${ligneDePartage(d)}\n${lieu.origin}${lieu.pathname}`;
}
