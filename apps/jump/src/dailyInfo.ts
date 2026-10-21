import { parseDay } from "@cdj/core";
import { jumpMedalFor, type DailyLevel, type JumpMedal, type JumpMedals } from "@cdj/jump-sim";
import { nomMedaille, type TypeMedaille } from "@cdj/ui";
import { fDateCourte, fNumero, fTicks, nomTheme, t, traducteurDuSocle } from "./i18n";

// Le niveau du jour vu par le jeu (lot 5), **logique pure** (testée sans DOM) : quel jour ouvrir (`?seed=` et la porte des jours futurs),
// aperçu ou site publié, la médaille visée, les textes du HUD et du bandeau d'arrivée.
//
// **La porte des jours futurs n'est pas une protection** : le générateur est dans le code publié, n'importe qui peut calculer le niveau de
// demain. Elle évite seulement de tomber dessus par un lien. La vraie garantie viendra du serveur (phase 2), qui n'acceptera que les temps du
// jour.

/** Ce qu'il faut de `location` pour décider du mode (de quoi tester sans navigateur). */
export interface PageLocation {
  hostname: string;
  pathname: string;
}

/** Un serveur local : la machine elle-même, ou une adresse du réseau local (téléphone branché sur `npm run dev:jump -- --host`). */
function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "" ||
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h === "::1" ||
    h === "0.0.0.0" ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

/**
 * Lot R4 (plateforme) : un canal d'aperçu Firebase d'une PR (`<site>--<canal>-<empreinte>.web.app`) ou le site de recette
 * (`recette.<domaine>`, qui sert `main` en entier).
 */
export function isFirebasePreviewHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return /^[a-z0-9-]+--[a-z0-9-]+\.web\.app$/.test(h) || h.startsWith("recette.");
}

/**
 * **Aperçu** : un aperçu de PR (canal Firebase, lot R4 ; avant : chemin contenant `/b/<branche>/` sur GitHub Pages), le site de recette ou le
 * serveur local ; toutes les dates y sont ouvertes. Sinon, c'est le site de production : les dates futures y sont refusées.
 */
export function isPreview(loc: PageLocation): boolean {
  return /\/b\/[^/]+\//.test(loc.pathname) || isLocalHost(loc.hostname) || isFirebasePreviewHost(loc.hostname);
}

/**
 * `jour` : le niveau d'aujourd'hui ; `archive` : un jour passé ; `futur` : un jour à venir (aperçu seulement) ; `essai` (lot 11) : le niveau
 * d'une date joué avec un **thème forcé** (`?theme=`), un autre niveau que celui du jour : jamais enregistré, ni historique, ni série, ni partage.
 */
export type DayMode = "jour" | "archive" | "futur" | "essai";

export interface DayChoice {
  /** Le jour dont on ouvre le niveau. */
  day: number;
  mode: DayMode;
  /** Vrai si `?seed=` demandait un jour futur sur le site publié : on ouvre le niveau du jour, avec un message discret. */
  refused: boolean;
}

/**
 * Le jour à ouvrir. Sans `?seed=` (ou une date illisible) : aujourd'hui. Un jour passé : en archive. Un jour futur : ouvert sur un aperçu,
 * **refusé sur le site publié** (on ouvre aujourd'hui). `?debug` et `&solution` n'entrent pas ici : ils ne lèvent jamais le refus.
 */
export function chooseDay(seed: number | null, today: number, preview: boolean): DayChoice {
  if (seed === null || seed === today) return { day: today, mode: "jour", refused: false };
  if (seed < today) return { day: seed, mode: "archive", refused: false };
  return preview ? { day: seed, mode: "futur", refused: false } : { day: today, mode: "jour", refused: true };
}

/** Lot I5 : les textes du jour viennent du catalogue (dans la langue du joueur). */
export const refusedText = (): string => t("jour.refuse");
export const newDayText = (): string => t("jour.nouveau");

/** Les émojis des médailles : **seulement dans la ligne à partager** (charte § 6), jamais dans l'interface (les mêmes que ceux du portail). */
export const MEDAL_ICON: Record<JumpMedal, string> = { author: "🏆", gold: "🥇", silver: "🥈", bronze: "🥉" };
/** La médaille de Jump vue par le socle (`medaille`, couleurs et noms communs aux jeux). */
export const MEDAL_TYPE: Record<JumpMedal, TypeMedaille> = { author: "auteur", gold: "or", silver: "argent", bronze: "bronze" };
/** Le nom d'une médaille dans la langue du joueur (« Or », « Gold »). */
export const medalWord = (m: JumpMedal): string => nomMedaille(traducteurDuSocle(), MEDAL_TYPE[m]);
const ORDER: readonly JumpMedal[] = ["bronze", "silver", "gold", "author"];

/** La prochaine médaille visée d'après le meilleur temps (pas) : la première qu'il ne tient pas encore ; null si l'auteur est battu. */
export function nextMedal(best: number | null, medals: JumpMedals): { medal: JumpMedal; ticks: number } | null {
  const have = best === null ? null : jumpMedalFor(best, medals);
  const from = have === null ? 0 : ORDER.indexOf(have) + 1;
  const medal = ORDER[from];
  return medal ? { medal, ticks: medals[medal] } : null;
}

/** « Jump n° 12 » (« Jump #12 »), ou « Jump » avant le premier jour. */
export function levelTitle(number: number): string {
  return number >= 1 ? t("jour.titre", { numero: fNumero(number) }) : t("jeu.jump.nom");
}

/**
 * Le titre du niveau, montré **au départ seulement** (lot I5, charte § 9 : le centre reste libre, rien d'empilé sous la bande en permanence) :
 * « Jump n° 5 · Forêt », et le mode (archive, à venir, essai de thème, aperçu). La médaille visée a sa plaque à part (en haut à droite).
 */
export function dayLine(daily: Pick<DailyLevel, "number" | "date"> & { theme?: string }, choice: DayChoice, preview: boolean): string {
  const parts = [levelTitle(daily.number)];
  if (daily.theme) parts.push(nomTheme(daily.theme));
  if (choice.mode === "archive") parts.push(t("jour.archive", { date: shortDate(daily.date) }));
  if (choice.mode === "futur") parts.push(t("jour.futur", { date: shortDate(daily.date) }));
  if (choice.mode === "essai") parts.push(t("jour.essai", { date: shortDate(daily.date) }));
  if (preview) parts.push(t("jour.apercu"));
  return parts.join(" · ");
}

/** « dim. 18 oct. » / « Sun, Oct 18 » (la date courte du socle, dans la langue du joueur). */
export function shortDate(date: string): string {
  const d = parseDay(date);
  return d === null ? date : fDateCourte(d);
}

/** Bandeau d'arrivée du niveau du jour (lectures, essais) : la médaille obtenue et le temps de l'auteur. */
export function finishMedalText(time: number, medals: JumpMedals): { medal: JumpMedal | null; text: string } {
  const medal = jumpMedalFor(time, medals);
  const got = medal ? t(`arrivee.medaille.${medal}`) : t("bandeau.sansMedaille", { temps: fTicks(medals.bronze) });
  return { medal, text: t("bandeau.medailleAuteur", { medaille: got, auteur: fTicks(medals.author) }) };
}
