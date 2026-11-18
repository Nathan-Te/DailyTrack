import { mixSeed, Rng } from "@cdj/core";
import { CASE, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, LARGEUR_MORCEAU, LIGNES, MORCEAUX_PAR_THEME, NB_THEMES } from "./constantes";
import { REGLES_COURANTES, cleDesRegles, reglesDe, type ReglagesEssai, type Regles } from "./regles";
import { BLOC, VIDE, type Bonus, type Morceau, type Motif, type Terrain } from "./monde";
import { CONSTRUCTIONS, creerCtx } from "./motifs";
import { COLONNE_PORTAIL, difficulte, planDuJour, SEL_MORCEAU, type PlanDuJour } from "./plan";
import { genererSection } from "./sections";
import { ordreDesThemes, THEMES_GRAVITY, type ThemeGravity } from "./themes";
import type { Seuils } from "./types";

// Le générateur du niveau du jour (lot GR1) : **infini et paresseux**. Le contenu d'un jour est minuscule (`Contenu` : le jour, la version, l'ordre des cinq thèmes) ; chaque morceau de 16 colonnes est tiré
// de (graine du jour, numéro du morceau) avec le PRNG entier de la plateforme (`Rng` de `@cdj/core`, mulberry32). Rien n'est tiré d'une date ni d'une horloge : **on monte `GRAVITY_GENERATOR_VERSION`, jamais une date**.
// Les motifs sont ceux de la maquette (`docs/gravity/maquettes/gravity-maquette-jouable.html`, `genererMorceau`), portés en entiers ; ce qui change, et pourquoi, est dit au README du lot GR1 (les pièces posées au-dessus
// d'un trou, les cases qui battent aujourd'hui alignées sur l'arrivée du joueur, le chemin sûr écrit morceau par morceau).

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Le contenu d'un jour : tout le reste (les morceaux) en découle. */
export interface Contenu {
  jour: number;
  /** La version du générateur qui l'a produit. */
  g: number;
  /** L'ordre des cinq thèmes, un thème tous les 19 morceaux, puis la boucle reprend. */
  ordre: readonly ThemeGravity[];
  /** Les seuils des médailles **figés avec le jour** (un fichier de jour les porte, `jours.ts`) : absents d'un jour qu'on génère. */
  seuilsFiges?: Seuils;
  /** Lot GR5 : la version de la simulation sous laquelle ce jour se joue (celle de son fichier figé ; absente : la courante). */
  sim?: number;
  /** Lot GR5 : les réglages d'essai (`?vitesse=`… hors production) : un contenu qui en porte est un **essai**, jamais classé. */
  reglages?: ReglagesEssai;
}

/**
 * Lot GR5 — **les générateurs par version** (comme `GENERATEURS` de Tower) : un jour figé se relit et se rejoue avec le générateur qui l'a créé, même après un passage à la version suivante. Une version s'AJOUTE
 * (le générateur courant est celui de `GRAVITY_GENERATOR_VERSION`) ; une ancienne reste tant qu'un jour figé la nomme (règle : `packages/gravity-sim/CLAUDE.md`, « Les anciennes versions »). `morceauxParTheme` : la
 * longueur d'un thème que cette version pose ; `ordre` : l'ordre des cinq thèmes d'un jour ; `morceau` : le morceau `m` (pure).
 */
export interface Generateur {
  morceauxParTheme: number;
  ordre(jour: number): readonly ThemeGravity[];
  morceau(jour: number, m: number, ordre: readonly ThemeGravity[], entree: 1 | -1, precedent: Motif | null, regles: Regles, plan: PlanDuJour): Morceau;
}
/** Les versions que `dailyGravity` sait appeler (la version 4 est définie plus bas, avec `genererMorceau`). Mutable seulement pour que les tests y posent une version factice : le code n'y ajoute rien à l'exécution. */
export const GENERATEURS: Record<number, Generateur> = {};
/** Les versions du générateur que ce code sait appeler. */
export const versionsGenerateur = (): number[] => Object.keys(GENERATEURS).map(Number);

/** Les règles d'un contenu : sa version de la simulation, la longueur de thème de son générateur, ses réglages d'essai. */
export function reglesDuContenu(c: Pick<Contenu, "g" | "sim" | "reglages">): Regles {
  const gen = GENERATEURS[c.g];
  if (!gen) throw new ErreurGenerateur(`version de générateur inconnue : ${c.g}`);
  return reglesDe(c.sim ?? GRAVITY_SIM_VERSION, gen.morceauxParTheme, c.reglages);
}

/** Sel de la graine des morceaux (propre au jeu) : celui du plan (`plan.ts`, qui refait les premiers tirages d'un morceau). */
const SEL = SEL_MORCEAU;
const DEMI = CASE >> 1;

/** Le contenu du jour avec le générateur `version` (le courant par défaut) et la simulation `sim` (la courante par défaut) ; `essai` : les réglages d'essai (hors production). Une version inconnue lève `ErreurGenerateur`. */
export function dailyGravity(jour: number, version: number = GRAVITY_GENERATOR_VERSION, sim: number = GRAVITY_SIM_VERSION, essai?: ReglagesEssai): Contenu {
  const gen = GENERATEURS[version];
  if (!gen) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  if (!versionsSimJouablesConnues(sim)) throw new ErreurGenerateur(`version de simulation inconnue : ${sim}`);
  return { jour, g: version, ordre: gen.ordre(jour), sim, ...(essai && Object.keys(essai).length > 0 ? { reglages: essai } : {}) };
}
const versionsSimJouablesConnues = (sim: number): boolean => {
  try {
    reglesDe(sim, MORCEAUX_PAR_THEME);
    return true;
  } catch {
    return false;
  }
};

export { colonnesParcourues, pasDeTraversee } from "./traversee";
import { colonnesParcourues, pasDeTraversee } from "./traversee";

/** Les 12 cases d'une colonne vide : un plafond et un sol de deux cases. */
const colonneVide = (): number[] => Array.from({ length: LIGNES }, (_, r) => (r < 2 || r >= LIGNES - 2 ? BLOC : VIDE));

/**
 * Le morceau `m` d'un jour : **pure**, la même chose pour le même (graine du jour, numéro, ordre, gravité d'entrée). `entree` est la gravité du chemin sûr à la fin du morceau précédent (+1 : sur le sol, −1 : au plafond ;
 * +1 pour le tout premier) : le motif est posé **à l'endroit ou en miroir** pour que le chemin sûr commence du côté où l'on arrive. **Lot GR7 : ce que le morceau contient est choisi par le plan du jour** (`plan.info(m).pioche` :
 * le motif du catalogue, sa variante, sa difficulté), construit par `motifs.ts`. `precedent` n'est plus lu (le plan se souvient des motifs d'avant : pas deux fois le même à moins de 6 morceaux).
 */
export function genererMorceau(jour: number, m: number, ordre: readonly ThemeGravity[], entree: 1 | -1 = 1, _precedent: Motif | null = null, regles: Regles = REGLES_COURANTES, plan: PlanDuJour = planDuJour(jour, regles, ordre)): Morceau {
  const rng = new Rng(mixSeed(mixSeed(jour, SEL), m));
  const REG = regles;
  const parTheme = REG.morceauxParTheme;
  const theme = ordre[Math.trunc(m / parTheme) % NB_THEMES]!;
  /** La difficulté de 0 à 100 : règle encore les dimensions des sections (`sections.ts`). */
  const d = difficulte(m, REG);
  const x0 = m * LARGEUR_MORCEAU;
  const info = plan.info(m);

  // **Lot GR6 : un morceau de contenu d'une section à mode** (avion, onde, ressort) est écrit par `genererSection` (`sections.ts`) ; le morceau de retour et celui d'avant une section sont des morceaux de gravité calmes.
  if (info.section && info.section.rang < info.section.longueur) {
    const sec = genererSection({ jour, m, info: info.section, plan, d: info.section.facile ? 0 : d, rng });
    const bonusSection: Bonus[] = [];
    const axeMilieu = sec.axe[8]!;
    const mil = { x: (x0 + 8) * CASE + (CASE >> 1), y: axeMilieu };
    if (m % 23 === 11) bonusSection.push({ ...mil, type: "bouclier" });
    if (m % 23 === 19) bonusSection.push({ ...mil, type: "aimant" });
    return {
      m,
      theme,
      motif: sec.motif,
      ...(info.section.danger ? { danger: info.section.danger } : {}),
      variante: info.section.variante,
      difficulte: info.section.facile ? 1 : Math.max(2, Math.min(5, 2 + Math.trunc(d / 35))),
      ...(info.section.rang > 0 ? { suiteDeSection: true } : {}),
      cases: sec.cases,
      pieces: sec.pieces,
      gemmes: sec.gemmes,
      bonus: bonusSection,
      chemin: [{ c0: 0, c1: LARGEUR_MORCEAU, y: Math.trunc(axeMilieu / CASE), g: 1 }],
      portails: sec.portails,
      scies: sec.scies,
      lasers: sec.lasers,
      axe: sec.axe,
      decalage: 0,
      entree,
      sortie: 1,
    };
  }

  /** Le morceau de retour d'une section n'a pas de pioche : il est calme. */
  const pioche = info.pioche ?? { id: "calme", variante: 0, diff: 1, souffle: true, intro: null, technique: false };
  const vite = colonnesParcourues(pasDeTraversee(3 * CASE, REG), x0 + 8, REG, plan.facteurAu((x0 + 8) * CASE + (CASE >> 1))) >= 5;
  const ctx = creerCtx({ m, x0, d, entree, theme, REG, rng, plan, vite });
  if (info.vitesse) ctx.portails.push({ c: COLONNE_PORTAIL, type: info.vitesse });
  let id = pioche.id;
  let variante = pioche.variante;
  // Les trois premiers morceaux sont calmes ; le morceau d'avant une section finit sur le sol (calme, ou un inverseur quand on arrive du plafond) ; celui de retour d'une section est calme et porte le portail de retour.
  if (info.section) {
    id = "calme";
    ctx.portails.push({ c: COLONNE_PORTAIL, type: "gravite" });
  } else if (info.avantSection) id = entree === 1 ? "calme" : "inverseur";
  else if (m < 3) {
    // Le départ : un couloir, des pièces sur une rangée, une rangée sur deux au plafond.
    id = "calme";
  }
  if (id === "calme" && m < 3 && m % 2) {
    ctx.orienter(-1, true);
    ctx.voie(2, 14, 2, -1);
    ctx.miroir = false;
  } else CONSTRUCTIONS[id === "calme" ? "calme" : id]!(ctx, variante);
  if (ctx.chemin.length === 0) throw new ErreurGenerateur(`morceau ${m} : le motif ${id} n'a posé aucun chemin`);
  // Les bonus : posés par le niveau, aux mêmes endroits pour toutes les parties.
  const rangeeBonus = ctx.rangeeEnLAir ?? ctx.rangeeEn(8);
  const bonus: Bonus[] = [];
  const bonusEn = (type: Bonus["type"]): Bonus => ({ x: (x0 + 8) * CASE + DEMI, y: (2 * rangeeBonus + 1) * DEMI, type });
  if (m % 23 === 11) bonus.push(bonusEn("bouclier"));
  if (m % 23 === 19) bonus.push(bonusEn("aimant"));
  const nom = info.avantSection && id === "inverseur" ? "transition" : id === "trou" ? (entree === 1 ? "trouBas" : "trouHaut") : id.startsWith("special-") ? "special" : id;
  return {
    m,
    theme,
    motif: nom,
    variante,
    difficulte: id === "calme" || id === "souffle" || pioche.souffle ? 1 : pioche.diff,
    cases: ctx.cases,
    pieces: ctx.pieces,
    gemmes: ctx.gemmes,
    bonus,
    chemin: ctx.chemin,
    portails: ctx.portails,
    scies: ctx.scies,
    lasers: ctx.lasers,
    axe: [],
    decalage: ctx.decalage,
    entree,
    sortie: ctx.chemin[ctx.chemin.length - 1]!.g,
  };
}

// Les terrains du jour sont gardés en mémoire (un jour est rejoué des centaines de fois par le serveur) ; au plus huit.
const GARDES = new Map<string, Terrain>();

/** Le terrain d'un contenu : ses morceaux, tirés à la demande puis gardés, **par le générateur de sa version et sous les règles de sa simulation** (lot GR5). */
export function terrainDuJour(contenu: Pick<Contenu, "jour" | "ordre" | "g" | "sim" | "reglages">): Terrain {
  const regles = reglesDuContenu(contenu);
  const cle = `${contenu.jour}:${contenu.g}:${cleDesRegles(regles)}:${contenu.ordre.join(",")}`;
  const garde = GARDES.get(cle);
  if (garde) return garde;
  const gen = GENERATEURS[contenu.g]!;
  const plan = planDuJour(contenu.jour, regles, contenu.ordre);
  const morceaux: Morceau[] = [];
  // Les morceaux se tirent dans l'ordre : chacun a besoin de la gravité de sortie du précédent (`entree`).
  const terrain: Terrain = {
    regles,
    morceau(k) {
      while (morceaux.length <= k) morceaux.push(gen.morceau(contenu.jour, morceaux.length, contenu.ordre, morceaux.length === 0 ? 1 : morceaux[morceaux.length - 1]!.sortie, morceaux.length === 0 ? null : morceaux[morceaux.length - 1]!.motif, regles, plan));
      return morceaux[k]!;
    },
  };
  if (GARDES.size >= 8) GARDES.delete(GARDES.keys().next().value!);
  GARDES.set(cle, terrain);
  return terrain;
}

/** Combien de morceaux l'empreinte couvre : deux tours des cinq thèmes (la boucle aussi), sous les règles de la version courante. */
export const MORCEAUX_DE_L_EMPREINTE = 2 * MORCEAUX_PAR_THEME * NB_THEMES;

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers : le jour, la version, l'ordre, puis les cases, objets et chemins des deux premiers tours) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const entier = (v: number): void => {
    for (let k = 0; k < 4; k++) h = Math.imul(h ^ ((v >>> (8 * k)) & 0xff), 0x01000193) >>> 0;
  };
  entier(contenu.jour);
  entier(contenu.g);
  for (const t of contenu.ordre) entier(THEMES_GRAVITY.indexOf(t));
  const terrain = terrainDuJour(contenu);
  const nb = 2 * terrain.regles!.morceauxParTheme * NB_THEMES; // deux tours des cinq thèmes, sous les règles du contenu
  for (let k = 0; k < nb; k++) {
    const m = terrain.morceau(k);
    for (const v of m.cases) entier(v);
    for (const o of [...m.pieces, ...m.gemmes, ...m.bonus]) {
      entier(o.x);
      entier(o.y);
    }
    for (const b of m.bonus) entier(b.type === "bouclier" ? 1 : 2);
    for (const e of m.chemin) for (const v of [e.c0, e.c1, e.y, e.g + 1]) entier(v);
    for (const q of m.portails) for (const v of [q.c, PORTAILS.indexOf(q.type)]) entier(v);
    for (const v of m.axe) entier(v);
    for (const q of m.scies) for (const v of [q.x0, q.y0, q.x1, q.y1, q.periode, q.decalage]) entier(v);
    for (const q of m.lasers) for (const v of [q.c, q.r0, q.r1, q.decalage]) entier(v);
    entier(m.variante ?? 0);
    entier(m.decalage);
    entier(m.entree + 1);
  }
  return h.toString(16).padStart(8, "0");
}

const PORTAILS: readonly string[] = ["avion", "onde", "ressort", "gravite", "lent", "v1", "v2", "v3"];

/**
 * Le générateur de la version 5 (lot GR7 : le catalogue de motifs à variantes, la courbe en vagues, les trois dangers ; avant : lot GR6, les sections à mode) : `genererMorceau`, avec l'ordre des thèmes de Jump et 19 morceaux par thème. **Les versions 2, 3 et 4 sont retirées** :
 * le jeu est `off`, aucun jour n'est figé, aucun fichier ne les nomme (`packages/gravity-sim/CLAUDE.md`, « Les anciennes versions »).
 */
GENERATEURS[5] = { morceauxParTheme: MORCEAUX_PAR_THEME, ordre: ordreDesThemes, morceau: genererMorceau };
