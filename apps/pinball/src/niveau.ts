import { DUREE_PARTIE_ROBOT, PARTIES_DU_ROBOT, PINBALL_GENERATOR_VERSION, THEMES_PINBALL, dailyPinball, graineDuRobot, jouerRobot, lireJourFige, seuilsEnTranches, type Contenu, type Evenement, type Seuils, type ThemePinball } from "@cdj/pinball-sim";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { lireEssai } from "./essai";

// La table du jour, chargée À LA DEMANDE (`import()` de `definition.ts`) : le générateur, le robot et le calcul des seuils ne sont pas dans le premier chargement (l'accueil). Le contenu rendu porte ses seuils
// (`seuilsFiges` : ceux du fichier de jour figé s'il y en a un ; sinon ceux du robot, calculés **en arrière-plan** — voir `seuilsEnArrierePlan` — et lus par `DEFINITION.seuils` à l'écran de fin).
declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Les tranches du robot : au plus 4 ms de calcul toutes les 16 ms (un quart d'un écran à 60 Hz), à partir du moment où la table est lue. */
const TRANCHE_MS = 4;
const PAUSE_MS = 16;
const DEPART_MS = 400;

/** Ce que `niveau.ts` joint au contenu quand `?robot` est demandé : les événements de sa partie et le pas où elle s'arrête (la scène les rejoue). */
export interface RobotDuJour {
  evenements: Evenement[];
  fin: number;
}

/**
 * Les seuils d'un jour qui n'est pas figé : le robot (`seuils.ts`) joue quatre parties, de 3 à 6 secondes de calcul sur un ordinateur, plus sur un téléphone ; **il ne gèle jamais le jeu** — il tourne par tranches
 * pendant que le joueur est sur l'accueil puis joue (`setTimeout`), et si la partie finit avant lui, l'écran de fin termine le calcul d'un trait (c'est le même, la recherche est pure). Un objet à getters, lu comme
 * des seuils ordinaires par le kit. **En production les jours servis ont leur fichier** (`figer` et `preparer` de la fiche) : ce calcul ne sert qu'aux jours d'essai, d'archive et de recette (README du lot PB4).
 */
function seuilsEnArrierePlan(contenu: Contenu): Seuils {
  const g = seuilsEnTranches(contenu);
  let fini: Seuils | null = null;
  const avancer = (jusquA: number): void => {
    while (!fini && performance.now() < jusquA) {
      const r = g.next();
      if (r.done) fini = r.value;
    }
  };
  const pas = (): void => {
    avancer(performance.now() + TRANCHE_MS);
    if (!fini) setTimeout(pas, PAUSE_MS);
  };
  if (typeof setTimeout !== "undefined") setTimeout(pas, DEPART_MS);
  const lire = (): Seuils => {
    avancer(Infinity);
    return fini!;
  };
  return Object.defineProperties({} as Seuils, {
    bronze: { get: () => lire().bronze, enumerable: true },
    silver: { get: () => lire().silver, enumerable: true },
    gold: { get: () => lire().gold, enumerable: true },
    author: { get: () => lire().author, enumerable: true },
  });
}

/** Le contenu d'un jour : le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit (avec ses seuils figés), sinon le générateur courant. `theme` : le thème effectif ; s'il n'est pas celui du jour (`?theme=`, essai hors production, jamais classé), la table prend ses couleurs. */
export async function contenuDuJour(jour: number, base: string, theme: string): Promise<Contenu & { robot?: RobotDuJour }> {
  const date = formatDay(jour);
  const production = import.meta.env.VITE_PRODUCTION === "1";
  let contenu: Contenu | null = null;
  if (dateDemandable(date, production, JOURS_FIGES)) {
    try {
      contenu = lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  contenu ??= dailyPinball(jour, PINBALL_GENERATOR_VERSION);
  // Un autre thème (`?theme=`, essai) : la table de ce thème ce jour-là, avec ses éléments et sa mission (lot PB3), jamais celle du jour avec d'autres couleurs.
  if (theme !== contenu.theme && (THEMES_PINBALL as readonly string[]).includes(theme)) contenu = dailyPinball(jour, PINBALL_GENERATOR_VERSION, theme as ThemePinball);
  const rendu: Contenu & { robot?: RobotDuJour } = { ...contenu, seuilsFiges: contenu.seuilsFiges ?? seuilsEnArrierePlan(contenu) };
  // L'essai de recette `?robot` (hors production) : le robot joue ici, avant la partie (quelques secondes), et la scène rejoue ses appuis. C'est l'une des parties qui donnent les seuils (la première, ou `?robot=<n>`).
  const essai = lireEssai(typeof location === "undefined" ? "" : location.search, production);
  if (essai.robot !== null) {
    await new Promise((r) => setTimeout(r, 30)); // laisse l'écran de chargement se peindre avant le calcul
    const r = jouerRobot(contenu, graineDuRobot(essai.robot % PARTIES_DU_ROBOT), { maxTicks: DUREE_PARTIE_ROBOT });
    rendu.robot = { evenements: r.evenements, fin: r.partie.tick };
  }
  return rendu;
}
