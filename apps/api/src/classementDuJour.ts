import type { ClasseDuJour, MedaillePortail, ScorePortail } from "./games";

// Lot I3 (plateforme, phase 3), refait au lot A1 : le **classement du jour au chrono**, tous jeux confondus. Calcul pur (testé :
// `test/classementDuJour.test.ts`) ; les routes et le cache sont dans `portail.ts`. Ce fichier ne connaît aucun jeu : il reçoit, pour chaque jeu qui
// existe ce jour-là, la liste de ses classés **dans l'ordre du classement prouvé du jeu** (crochet `portail.classes`), avec le temps rejoué par le
// serveur et la médaille de chacun. Aucun temps annoncé n'entre ici.
//
// **Trois vues** : (1) un jeu — le meilleur temps prouvé du jour de chaque joueur, croissant, dans l'ordre même du classement du jeu ;
// (2) le **cumul** : d'abord les joueurs qui ont fini **tous** les jeux du jour, par la somme de leurs meilleurs temps prouvés (croissante), puis,
// sous une séparation, ceux qui n'en ont fini qu'une partie, rangés par leur meilleur rang dans un jeu (les premiers de chaque jeu, puis les
// deuxièmes…, le jeu du registre d'abord à rang égal).
// **Égalité** (au cumul) : le premier à avoir atteint ce temps — l'horodatage le plus tardif de ses essais classés ; enfin l'identifiant, pour qu'un
// ordre toujours le même sorte de deux égalités parfaites.
// Les points de médailles (4 · 3 · 2 · 1) n'existent plus : la médaille n'est qu'une pastille à côté du temps.

/** Ce qu'un joueur a fait dans un jeu : sa place, son temps rejoué, sa médaille et l'instant de son essai classé. */
export interface ResultatJeu {
  rang: number;
  tempsMs: number;
  medaille: MedaillePortail | null;
  /** L'horodatage (ms) de l'essai classé. */
  at: number;
  /** Lot TP : le score en hauteur (un jeu classé à la hauteur : jamais dans le cumul, mais le résultat garde sa forme). */
  score?: ScorePortail;
  /** Lot F2 : les pas exacts de l'essai (le classement filtré « Amis » les rend ; le classement du jour ne les rend jamais). */
  ticks?: number;
}

/** Un joueur classé du jour. `resultats[i]` : son résultat dans le jeu n° i de `ClassementDuJour.jeux`, `null` s'il ne l'a pas fini. */
export interface LigneDuJour {
  id: string;
  resultats: (ResultatJeu | null)[];
  /** A-t-il fini tous les jeux du jour ? */
  complet: boolean;
  /** La somme de ses meilleurs temps, `null` tant qu'il n'a pas tout fini. */
  cumulMs: number | null;
  /** L'instant où il a atteint son cumul : le plus tardif de ses essais classés. */
  at: number;
  /** Joueur à un jeu partiel : son meilleur rang dans un jeu, et ce jeu (à rang égal, le premier du registre). 0 s'il est complet. */
  meilleurRang: number;
  meilleurJeu: number;
}

/** Le classement d'un jour : une liste par jeu et le cumul, chacune triée (le premier d'abord). */
export interface ClassementDuJour {
  /** Les codes des jeux du jour, dans l'ordre de `resultats`. */
  jeux: string[];
  /** Le nombre de classés de chaque jeu (même ordre). */
  classesParJeu: number[];
  /** Les joueurs de chaque jeu, dans l'ordre de ce jeu : le rang d'un joueur est sa position (`resultats[g].rang`). */
  parJeu: LigneDuJour[][];
  /** Tous les joueurs qui ont fini au moins un jeu : les complets au chrono, puis les autres. */
  cumul: LigneDuJour[];
  /** Identifiant → position dans `cumul`. */
  index: Map<string, number>;
  /**
   * Toutes les lignes par identifiant, y compris celles qui ne sont pas dans `cumul` (un joueur qui n'a fini qu'un jeu hors cumul, Rush en arcade) : les vues **par jeu** lisent ici, jamais dans `cumul`.
   */
  lignes: Map<string, LigneDuJour>;
  /**
   * Lot TP : les jeux classés à la **hauteur** (Tower), chacun avec ses classés dans l'ordre de son classement. Ils n'entrent ni dans `jeux`, ni dans `cumul` : le cumul au temps les ignore.
   * Absent (jamais posé par `classerLaJournee`) pour un classement qui n'en a pas : `portail.ts` le pose.
   */
  hauteurs?: { jeu: string; classes: readonly ClasseDuJour[]; index: Map<string, number> }[];
}

/**
 * Les champs dérivés d'une ligne, à partir de ses résultats. `at` : l'instant le plus tardif de ses essais classés.
 * `horsCumul[g]` : le jeu n° g a un classement au temps mais **n'entre pas dans le cumul** (fiche `classement.cumul: false`, Rush en arcade) : son résultat reste dans `resultats` (sa vue le lit),
 * mais il ne fait ni `complet`, ni `cumulMs`, ni le meilleur rang du joueur partiel.
 */
export function ligneDe(id: string, resultats: (ResultatJeu | null)[], horsCumul?: readonly boolean[]): LigneDuJour {
  const dansLeCumul = (g: number): boolean => !horsCumul?.[g];
  const finis = resultats.filter((r): r is ResultatJeu => r !== null);
  const finisDuCumul = resultats.filter((r, g): r is ResultatJeu => r !== null && dansLeCumul(g));
  const complet = finisDuCumul.length > 0 && finisDuCumul.length === resultats.filter((_, g) => dansLeCumul(g)).length;
  let meilleurJeu = 0;
  let meilleurRang = 0;
  if (!complet) {
    resultats.forEach((r, g) => {
      if (r && dansLeCumul(g) && (meilleurRang === 0 || r.rang < meilleurRang)) {
        meilleurRang = r.rang;
        meilleurJeu = g;
      }
    });
  }
  return {
    id,
    resultats,
    complet,
    cumulMs: complet ? finisDuCumul.reduce((s, r) => s + r.tempsMs, 0) : null,
    at: finis.reduce((m, r) => Math.max(m, r.at), 0),
    meilleurRang,
    meilleurJeu,
  };
}

/** L'ordre du cumul : les complets d'abord (cumul, puis premier arrivé), puis les autres (meilleur rang, jeu du registre, premier arrivé) ; l'identifiant en dernier. */
export function comparer(a: LigneDuJour, b: LigneDuJour): number {
  if (a.complet !== b.complet) return a.complet ? -1 : 1;
  const ordre = a.complet ? (a.cumulMs as number) - (b.cumulMs as number) : a.meilleurRang - b.meilleurRang || a.meilleurJeu - b.meilleurJeu;
  if (ordre) return ordre;
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Le classement du jour à partir des classés de chaque jeu du jour. Pur. */
export function classerLaJournee(jeux: readonly { jeu: string; classes: readonly ClasseDuJour[]; horsCumul?: boolean }[]): ClassementDuJour {
  const horsCumul = jeux.map((j) => j.horsCumul === true);
  const parJoueur = new Map<string, (ResultatJeu | null)[]>();
  jeux.forEach((j, g) => {
    j.classes.forEach((c, i) => {
      let resultats = parJoueur.get(c.playerId);
      if (!resultats) {
        resultats = jeux.map(() => null);
        parJoueur.set(c.playerId, resultats);
      }
      resultats[g] = { rang: i + 1, tempsMs: c.tempsMs, medaille: c.medaille, at: c.at, ...(c.score ? { score: c.score } : {}), ...(c.ticks !== undefined ? { ticks: c.ticks } : {}) };
    });
  });
  const lignes = new Map([...parJoueur].map(([id, r]) => [id, ligneDe(id, r, horsCumul)] as const));
  const parJeu = jeux.map((j, g) => j.classes.map((c) => lignes.get(c.playerId)!).filter((l) => l.resultats[g] !== null));
  // Un joueur qui n'a fini que des jeux hors cumul a sa place dans la vue de ces jeux (`parJeu`), pas dans le cumul.
  const cumul = [...lignes.values()].filter((l) => l.resultats.some((r, g) => r !== null && !horsCumul[g])).sort(comparer);
  return { jeux: jeux.map((j) => j.jeu), classesParJeu: jeux.map((j) => j.classes.length), parJeu, cumul, index: new Map(cumul.map((l, i) => [l.id, i])), lignes };
}

/**
 * Où se place un joueur dont on connaît le résultat **exact** (ses états dans chaque jeu, lus à l'instant) alors que le classement gardé peut dater
 * de quelques dizaines de secondes. Gardé et au même cumul (ou aux mêmes jeux finis) : sa place gardée. Sinon (il vient de finir, ou a amélioré son
 * temps) : on le met après tous ceux qui le valent ou le devancent — il vient de finir, il est le dernier arrivé à son temps —, en ne se comptant
 * pas deux fois s'il figure dans l'ancien classement. `classes` compte les joueurs du classement gardé, plus lui s'il n'y était pas.
 */
const memeBilan = (l: LigneDuJour, moi: LigneDuJour): boolean => l.complet === moi.complet && l.cumulMs === moi.cumulMs && l.meilleurRang === moi.meilleurRang && l.meilleurJeu === moi.meilleurJeu;

export function placer(c: ClassementDuJour, moi: LigneDuJour): { rang: number; classes: number } {
  const gardee = c.index.get(moi.id);
  if (gardee !== undefined) {
    const l = c.cumul[gardee]!;
    if (memeBilan(l, moi)) return { rang: gardee + 1, classes: c.cumul.length };
  }
  const arrive = { ...moi, at: Number.POSITIVE_INFINITY };
  let devant = 0;
  for (const l of c.cumul) if (l.id !== moi.id && comparer(l, arrive) < 0) devant++;
  return { rang: devant + 1, classes: c.cumul.length + (gardee === undefined ? 1 : 0) };
}

/**
 * Lot F2 : la ligne qui sert à **ordonner** un joueur dont on connaît le bilan exact parmi les lignes du classement gardé : la sienne si elle y est avec le même bilan (il garde son rang d'arrivée), sinon
 * lui, arrivé le dernier à ce temps (comme `placer`).
 */
export function ligneDeTri(c: ClassementDuJour, moi: LigneDuJour): LigneDuJour {
  const gardee = c.index.get(moi.id);
  if (gardee !== undefined && memeBilan(c.cumul[gardee]!, moi)) return c.cumul[gardee]!;
  return { ...moi, at: Number.POSITIVE_INFINITY };
}

/**
 * Lot F2 : « 3e entre amis » — la place d'un joueur (son bilan exact) parmi lui et ses amis qui ont fini au moins un jeu ce jour-là, dans l'ordre du cumul. `null` quand aucun de ses amis n'a rien fini
 * (rien à comparer). Les amis masqués n'ont aucune ligne dans le classement (les classements écartent `hidden = 1`) : ils ne comptent pas. Pur ; une lecture de la liste des amis, aucune requête par ami.
 */
export function rangEntreAmis(c: ClassementDuJour, moi: LigneDuJour, amis: Iterable<string>): { rang: number; sur: number } | null {
  const reference = ligneDeTri(c, moi);
  let presents = 0;
  let devant = 0;
  for (const ami of amis) {
    if (ami === moi.id) continue;
    const i = c.index.get(ami);
    if (i === undefined) continue;
    presents++;
    if (comparer(c.cumul[i]!, reference) < 0) devant++;
  }
  return presents === 0 ? null : { rang: devant + 1, sur: presents + 1 };
}

/** Une ligne du classement entre amis de l'accueil : son rang entre amis (`null` : rien fini au cumul), et sa ligne du classement du jour (`null` : rien fini). */
export interface LigneEntreAmis {
  id: string;
  rang: number | null;
  ligne: LigneDuJour | null;
}

/**
 * Lot U1 — le classement du jour **entre amis** de l'accueil : toi (ton bilan exact : tu te places comme `rangEntreAmis`, arrivé le dernier à ton temps) et tes amis, dans l'ordre du cumul du classement
 * gardé ; ceux qui n'ont rien fini au cumul viennent après, sans rang, dans l'ordre reçu (celui du pseudo). Pur ; aucune requête par ami (le classement gardé et la liste des amis suffisent).
 */
export function classerEntreAmis(c: ClassementDuJour, moiId: string, moi: LigneDuJour | null, amis: readonly string[]): LigneEntreAmis[] {
  const classes: LigneEntreAmis[] = [];
  const sans: LigneEntreAmis[] = [];
  for (const id of amis) {
    if (id === moiId) continue;
    const i = c.index.get(id);
    (i === undefined ? sans : classes).push({ id, rang: null, ligne: i === undefined ? (c.lignes.get(id) ?? null) : c.cumul[i]! });
  }
  if (moi) classes.push({ id: moiId, rang: null, ligne: ligneDeTri(c, moi) });
  else sans.unshift({ id: moiId, rang: null, ligne: null });
  classes.sort((a, b) => comparer(a.ligne!, b.ligne!));
  classes.forEach((x, i) => (x.rang = i + 1));
  return [...classes, ...sans];
}
