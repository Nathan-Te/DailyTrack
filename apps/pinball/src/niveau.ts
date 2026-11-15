import { PINBALL_GENERATOR_VERSION, THEMES_PINBALL, dailyPinball, lireJourFige, seuilsDe, type Contenu, type ThemePinball } from "@cdj/pinball-sim";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";

// La table du jour, chargée À LA DEMANDE (`import()` de `definition.ts`) : le générateur et le calcul des seuils ne sont pas dans le premier chargement (l'accueil). Le contenu rendu porte ses seuils (`seuilsFiges` :
// ceux du fichier de jour figé s'il y en a un, sinon le calcul provisoire) : `DEFINITION.seuils` les lit sans rien importer.
declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Le contenu d'un jour : le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit (avec ses seuils figés), sinon le générateur courant. `theme` : le thème effectif ; s'il n'est pas celui du jour (`?theme=`, essai hors production, jamais classé), la table prend ses couleurs. */
export async function contenuDuJour(jour: number, base: string, theme: string): Promise<Contenu> {
  const date = formatDay(jour);
  let contenu: Contenu | null = null;
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      contenu = lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  contenu ??= dailyPinball(jour, PINBALL_GENERATOR_VERSION);
  if (theme !== contenu.theme && (THEMES_PINBALL as readonly string[]).includes(theme)) contenu = { ...contenu, theme: theme as ThemePinball, seuilsFiges: undefined };
  return { ...contenu, seuilsFiges: contenu.seuilsFiges ?? seuilsDe(contenu) };
}
