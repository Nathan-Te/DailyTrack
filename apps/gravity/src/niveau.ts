import { GRAVITY_GENERATOR_VERSION, MODE_AVION, MODE_ONDE, MODE_RESSORT, THEMES_GRAVITY, dailyGravity, jouerRobot, lireJourFige, ordreCommencantPar, planDuJour, seuilsEnTranches, terrainDuJour, type Contenu, type Seuils, type ThemeGravity } from "@cdj/gravity-sim";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { DISTANCE_DU_ROBOT, distanceAvantMorceau, lireEssais, type EssaiRecette } from "./essai";
import { lireReglagesEssai } from "./reglagesEssai";

// Le niveau du jour, chargé À LA DEMANDE (`import()` de `definition.ts`) : le générateur, les morceaux, le robot et le calcul des seuils ne sont pas dans le premier chargement (l'accueil). Le contenu rendu porte ses
// seuils (`seuilsFiges` : ceux du fichier de jour figé s'il y en a un ; sinon ceux du robot, calculés **en arrière-plan** — voir `seuilsEnArrierePlan` — et lus par `DEFINITION.seuils` à l'écran de fin).
declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Les tranches du robot : au plus 4 ms de calcul toutes les 16 ms (un quart d'un écran à 60 Hz), le temps d'une partie y suffit largement. */
/** Le rang de simulation du mode d'un essai `?mode=` (lot GR6) : écrit ici et non lu de `modesLogique.ts`, qui n'est que de la scène — un module partagé de plus ferait un morceau non nommé de `budget.aLaDemande`. */
const RANG_DU_MODE = { avion: MODE_AVION, onde: MODE_ONDE, ressort: MODE_RESSORT } as const;
const TRANCHE_MS = 4;
const PAUSE_MS = 16;
const DEPART_MS = 400;

/**
 * Les seuils d'un jour qui n'est pas figé : le robot (`seuils.ts`) joue environ une seconde ; **il ne gèle jamais le jeu** — il tourne par tranches pendant que le joueur joue (`setTimeout`), et si la partie finit avant
 * lui, l'écran de fin termine le calcul d'un trait (c'est le même, la recherche est pure). Un objet à getters, lu comme des seuils ordinaires par le kit. **En production les jours servis auront leur fichier** (`figer` et
 * `preparer` de la fiche) : ce calcul ne sert qu'aux jours d'essai, d'archive et de recette (README du lot GR2).
 */
function seuilsEnArrierePlan(contenu: Contenu): { seuils: Seuils; pret: () => Seuils | null } {
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
  const seuils = Object.defineProperties({} as Seuils, {
    bronze: { get: () => lire().bronze, enumerable: true },
    silver: { get: () => lire().silver, enumerable: true },
    gold: { get: () => lire().gold, enumerable: true },
    author: { get: () => lire().author, enumerable: true },
  });
  // `pret` (lot GR3) : les seuils s'ils sont calculés, **sans jamais forcer le calcul** (le HUD les lit à chaque image : lire `seuils` le terminerait d'un trait et gèlerait la partie).
  return { seuils, pret: () => fini };
}

/** Le contenu d'un jour : le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit (avec ses seuils figés), sinon le générateur courant. `theme` : le thème effectif ; s'il n'est pas celui du jour (`?theme=`, essai hors production, jamais classé), l'ordre est tourné pour le mettre en tête. */
export async function contenuDuJour(jour: number, base: string, theme: string): Promise<Contenu> {
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
  contenu ??= dailyGravity(jour, GRAVITY_GENERATOR_VERSION);
  if (theme !== contenu.ordre[0] && (THEMES_GRAVITY as readonly string[]).includes(theme)) contenu = { ...contenu, ordre: ordreCommencantPar(contenu.ordre, theme as ThemeGravity), seuilsFiges: undefined };
  // Les réglages d'essai (lot GR5, `?vitesse=`… hors production, jamais classés) : le contenu porte les règles de l'essai ; les seuils du fichier ne valent plus, le robot les recalcule avec ces règles.
  const reglages = lireReglagesEssai(typeof location === "undefined" ? "" : location.search, production);
  if (reglages) contenu = { ...contenu, reglages, seuilsFiges: undefined };
  const calcul = contenu.seuilsFiges ? null : seuilsEnArrierePlan(contenu);
  const rendu: Contenu & { essai?: EssaiRecette; pretSeuils: () => Seuils | null } = { ...contenu, seuilsFiges: contenu.seuilsFiges ?? calcul!.seuils, pretSeuils: calcul ? calcul.pret : () => contenu.seuilsFiges ?? null };
  // Les essais de recette (`?robot`, `?morceau=<n>`, hors production) : le robot joue ici, avant la partie (une à deux secondes), et la scène rejoue ses appuis.
  const essais = lireEssais(typeof location === "undefined" ? "" : location.search, production);
  // Lot GR6 — `?mode=<mode>` : le morceau où commence la première section de ce mode (le plan du jour, avec les règles du contenu), sauf si `?morceau=` le dit déjà ; aucune section (−1) : rien.
  let morceau = essais.morceau;
  const planDuContenu = (): ReturnType<typeof planDuJour> => planDuJour(rendu.jour, terrainDuJour(rendu).regles!, rendu.ordre);
  if (morceau === null && essais.mode !== null) {
    const n = planDuContenu().premierMorceauDuMode(RANG_DU_MODE[essais.mode]);
    if (n >= 1) morceau = n;
  }
  // Lot GR7 — `?danger=<danger>` : le morceau qui introduit ce danger (sa première rencontre), si ni `?morceau=` ni `?mode=` n'ont parlé ; aucun (−1) : rien.
  if (morceau === null && essais.danger !== null) {
    const n = planDuContenu().premierMorceauDuDanger(essais.danger);
    if (n >= 1) morceau = n;
  }
  if (essais.robot || morceau !== null) {
    await new Promise((r) => setTimeout(r, 30)); // laisse l'écran de chargement se peindre avant le calcul
    const cible = morceau === null ? 0 : distanceAvantMorceau(morceau);
    let depart = 0;
    const r = jouerRobot(terrainDuJour(rendu), { maxDistance: essais.robot ? DISTANCE_DU_ROBOT : cible, arrets: cible > 0 ? [cible] : [], surPoint: (_d, p) => void (depart = p.tick) });
    rendu.essai = { robot: essais.robot, changements: r.changements, depart };
  }
  return rendu;
}
