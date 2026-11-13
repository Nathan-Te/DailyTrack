import { mixSeed, Rng } from "@cdj/core";
import { CM, TICKS_PAR_SECONDE, VERTIGE_GENERATOR_VERSION } from "./constantes";
import { PREMIER_JOUR_VERTIGE } from "./calendrier";
import { Partie } from "./course";
import { ErreurGenerateur, type Contenu } from "./generateur";
import { enregistrerFabriqueDuJour, type Boite, type Niveau } from "./niveaux";
import { assembler, robotDuModule, type Enchainement, type Mecanique, type Module } from "./modules";
import { gravite, IDENTITE, mul, ORIENTATIONS, type Mat } from "./orientation";
import { type VarianteDeModule, variantes, varianteDeCle } from "./variantes";
import { blocsDansUnePoche, blocsQuiSeRecouvrent, DISTANCE_PAIRES_MIN, distanceMinimaleEntrePaires, surfacesMarqueesQuiSeTouchent } from "./verifModules";

// **Le générateur du niveau du jour (lot V3, version 2)** : niveau = f(numéro de jour, version du générateur). Entiers et PRNG semé seulement (`Rng`, `mixSeed` de `@cdj/core`) : le même jour donne le même niveau sous Node et dans
// le navigateur (le golden le vérifie). La sortie est une LISTE DE MODULES posés (`Contenu.modules`, des clés de `variantes.ts`) ; leur position et leur repère de gravité se déduisent de leurs paliers (`assembler`, `modules.ts`).
// **Le générateur n'écrit jamais une date** (règle du dépôt) : un jour figé garde la liste, la version et les seuils, jamais un résultat de ce fichier recopié à la main.
//
// Les règles (le test des 365 jours, `generateur.test.ts`, les vérifie toutes sur chaque niveau) :
//   · **6 à 8 modules**, un temps du robot de **28 à 38 s** (de son premier mouvement à l'arrivée) ;
//   · **courbe de difficulté** : on commence facile (un premier module de difficulté 1), on finit plus dur (un dernier de 2 ou 3, la seconde moitié plus dure que la première) ;
//   · **variété** : au moins 3 mécaniques (hors la course, toujours jouée) ; jamais le même module (l'identifiant de base) deux fois de suite ; un module de base au plus deux fois ; au plus 2 passages dans un monde tourné ;
//   · **d'un jour à l'autre** : le premier module et le dernier ne sont jamais ceux de la veille, par construction — ils sortent de cycles (une permutation par bloc de jours, sans répéter le dernier d'un bloc au début du suivant) qui ne
//     dépendent que du numéro de jour, jamais du niveau servi la veille : le contenu d'un jour reste une fonction de (jour, version) ;
//   · **placement sûr** : aucun bloc de deux modules ne se recouvre, les modules non voisins restent à 30 m au moins l'un de l'autre (l'arrivée n'exige pas d'avoir passé les paliers : un niveau qui revient près de lui-même
//     offrirait un raccourci qui battrait le robot), surfaces marquées qui ne se touchent pas, poches de portails vides, deux paires de portails à plus de 40 m. Un niveau qui échoue à l'une de ces règles est refusé, et le tirage suivant
//     (même graine, tentative + 1) est essayé : « nouveau tirage déterministe ».
export const MODULES_MIN = 6;
export const MODULES_MAX = 8;
/** Le temps du robot visé : de 28 à 38 s. */
export const ROBOT_MIN_S = 28;
export const ROBOT_MAX_S = 38;
export const MECANIQUES_MIN = 3;
/** Au plus 2 passages dans un monde tourné, chacun d'au plus 4 modules (le module qui fait basculer, ceux du monde tourné, celui qui remet à l'endroit). */
export const PASSAGES_TOURNES_MAX = 2;
export const MODULES_TOURNES_MAX = 4;
/** La distance minimale entre deux modules non voisins (centimètres) : bien au-delà de la portée d'un saut avec dash (14,6 m) et d'une course sur le mur. */
export const DISTANCE_NON_VOISINS_CM = 3000;
/** Un module de base au plus deux fois dans un niveau. */
export const MEME_BASE_MAX = 2;
const TENTATIVES_MAX = 400;
/** Après autant de tirages refusés, le premier et le dernier module ne suivent plus leurs cycles (secours : jamais atteint sur les 365 jours testés). */
const TENTATIVES_AVANT_LIBRE = 150;

/** Les modules qui ouvrent un niveau (difficulté 1) et ceux qui le ferment (difficulté 2 ou 3) : l'identifiant de base ; chaque jour en prend un dans son cycle. */
export const OUVERTURES: readonly string[] = ["saut-1", "mur-1", "dash-1", "gravite-1", "portail-1"];
export const CLOTURES: readonly string[] = ["saut-2", "mur-2", "dash-2", "gravite-2", "portail-quart", "portail-gravite", "mur-dash", "gravite-portail", "portail-gravite-retour"];

/**
 * Le rang `index` d'un cycle sur `pool` : les éléments se suivent par blocs de `pool.length` jours, chaque bloc est une permutation semée par son numéro, et **le premier d'un bloc n'est jamais le dernier du bloc d'avant**.
 * Deux jours qui se suivent n'ont donc jamais le même élément, sans que l'un connaisse le niveau de l'autre.
 */
export function cycle(pool: readonly string[], index: number, graine: number): string {
  const k = pool.length;
  const bloc = Math.floor(index / k);
  const permutation = (b: number): string[] => new Rng(mixSeed(b, graine)).shuffle(pool);
  const p = permutation(bloc);
  const avant = permutation(bloc - 1);
  if (p[0] === avant[k - 1]) [p[0], p[1]] = [p[1]!, p[0]!];
  return p[index - bloc * k]!;
}
const GRAINE_OUVERTURE = 11;
const GRAINE_CLOTURE = 29;
/** Le module qui ouvre le niveau d'un jour, et celui qui le ferme (identifiants de base). */
export const ouvertureDuJour = (jour: number): string => cycle(OUVERTURES, jour - PREMIER_JOUR_VERTIGE, GRAINE_OUVERTURE);
export const clotureDuJour = (jour: number): string => cycle(CLOTURES, jour - PREMIER_JOUR_VERTIGE, GRAINE_CLOTURE);

// ---------------------------------------------------------------- le monde tourné
/** Les gravités (0 à 5) à chaque palier : au départ, puis après chaque module. */
export function gravitesDesPaliers(modules: readonly Module[]): number[] {
  let R: Mat = IDENTITE;
  const out: number[] = [gravite(R)];
  for (const m of modules) {
    R = mul(R, ORIENTATIONS[m.sortie.ori]!);
    out.push(gravite(R));
  }
  return out;
}
const BAS = 3;
const HAUT = 2;
/** Les passages dans un monde tourné : les suites de modules joués avec une gravité qui n'est pas vers le bas à leur entrée ou à leur sortie (la longueur de chaque suite). */
export function passagesTournes(modules: readonly Module[]): number[] {
  const g = gravitesDesPaliers(modules);
  const suites: number[] = [];
  let courante = 0;
  modules.forEach((_m, k) => {
    if (g[k] !== BAS || g[k + 1] !== BAS) courante++;
    else if (courante > 0) {
      suites.push(courante);
      courante = 0;
    }
  });
  if (courante > 0) suites.push(courante);
  return suites;
}

// ---------------------------------------------------------------- le contrôle d'un niveau
const ecartCm = (a: Boite, b: Boite): number => {
  const dx = Math.floor(Math.max(0, b.x0 - a.x1, a.x0 - b.x1) / CM);
  const dy = Math.floor(Math.max(0, b.y0 - a.y1, a.y0 - b.y1) / CM);
  const dz = Math.floor(Math.max(0, b.z0 - a.z1, a.z0 - b.z1) / CM);
  return dx * dx + dy * dy + dz * dz;
};
/** Les groupes de blocs d'un niveau assemblé : la dalle de départ, puis ceux de chaque module (l'ordre de `assembler`). */
export function groupesDeBlocs(niveau: Niveau, modules: readonly Module[]): Niveau["blocs"][] {
  const groupes: Niveau["blocs"][] = [niveau.blocs.slice(0, 1)];
  let debut = 1;
  for (const m of modules) {
    groupes.push(niveau.blocs.slice(debut, debut + m.blocs.length));
    debut += m.blocs.length;
  }
  return groupes;
}
/** La distance la plus courte (cm) entre les blocs de deux groupes. */
export function distanceMinimaleCm(a: Niveau["blocs"], b: Niveau["blocs"]): number {
  let min = Infinity;
  for (const x of a) for (const y of b) min = Math.min(min, ecartCm(x.boite, y.boite));
  return Math.sqrt(min);
}

export interface RapportNiveau {
  /** Les règles non respectées (vide : le niveau est valide). */
  refus: string[];
  /** Le temps du robot, de son premier mouvement à l'arrivée (pas), 0 s'il n'arrive pas. */
  ticksRobot: number;
  /** La distance la plus courte entre deux modules non voisins (m), `Infinity` s'il n'y en a pas. */
  distanceNonVoisins: number;
}

/** Tout ce que le niveau doit respecter, vérifié sur le niveau assemblé (les règles de V2 sur l'enchaînement entier, et celles de V3). */
export function controlerNiveau(cles: readonly string[], e: Enchainement, modules: readonly Module[]): RapportNiveau {
  const refus: string[] = [];
  const n = modules.length;
  if (n < MODULES_MIN || n > MODULES_MAX) refus.push(`${n} modules (de ${MODULES_MIN} à ${MODULES_MAX})`);
  const bases = cles.map((c) => varianteDeCle(c)!.base);
  bases.forEach((b, i) => i > 0 && b === bases[i - 1] && refus.push(`le module « ${b} » deux fois de suite`));
  for (const b of new Set(bases)) if (bases.filter((x) => x === b).length > MEME_BASE_MAX) refus.push(`le module « ${b} » plus de ${MEME_BASE_MAX} fois`);
  const mecaniques = new Set<Mecanique>(modules.flatMap((m) => m.etiquettes.mecaniques));
  mecaniques.delete("course");
  if (mecaniques.size < MECANIQUES_MIN) refus.push(`${mecaniques.size} mécaniques (au moins ${MECANIQUES_MIN} hors la course)`);
  const d = modules.map((m) => m.etiquettes.difficulte);
  if (d[0] !== 1) refus.push(`le premier module est de difficulté ${d[0]} (1 attendue)`);
  if (d[n - 1]! < 2) refus.push(`le dernier module est de difficulté ${d[n - 1]} (2 ou 3 attendue)`);
  const somme = (v: number[]): number => v.reduce((s, x) => s + x, 0);
  const moitie = Math.floor(n / 2);
  if (somme(d.slice(n - moitie)) <= somme(d.slice(0, moitie))) refus.push(`la seconde moitié n'est pas plus dure que la première (${d.join("")})`);
  const g = gravitesDesPaliers(modules);
  if (g.includes(HAUT)) refus.push("la gravité va vers le haut à un palier");
  const suites = passagesTournes(modules);
  if (suites.length > PASSAGES_TOURNES_MAX) refus.push(`${suites.length} passages dans un monde tourné (${PASSAGES_TOURNES_MAX} au plus)`);
  if (suites.some((s) => s > MODULES_TOURNES_MAX)) refus.push(`un passage de ${Math.max(...suites)} modules dans un monde tourné (${MODULES_TOURNES_MAX} au plus)`);

  // La géométrie : aucun bloc de deux modules voisins ne se recouvre, les modules non voisins sont éloignés, les contraintes de V2 valent sur le niveau entier.
  const groupes = groupesDeBlocs(e.niveau, modules);
  let proche = Infinity;
  for (let a = 0; a < groupes.length; a++)
    for (let b = a + 1; b < groupes.length; b++) {
      if (b === a + 1) {
        if (blocsQuiSeRecouvrent(groupes[a]!, groupes[b]!).length > 0) refus.push(`les modules ${a} et ${b} se recouvrent`);
      } else proche = Math.min(proche, distanceMinimaleCm(groupes[a]!, groupes[b]!));
    }
  if (proche < DISTANCE_NON_VOISINS_CM) refus.push(`deux modules non voisins à ${(proche / 100).toFixed(1)} m (${DISTANCE_NON_VOISINS_CM / 100} m au moins)`);
  if (surfacesMarqueesQuiSeTouchent(e.niveau.blocs).length > 0) refus.push("des surfaces marquées se touchent");
  if (blocsDansUnePoche(e.niveau).length > 0) refus.push("un bloc dans la poche d'un portail");
  if (distanceMinimaleEntrePaires(e.niveau.portails ?? []) < DISTANCE_PAIRES_MIN) refus.push("deux paires de portails à moins de 40 m");

  // Le robot : sa solution entière se rejoue de bout en bout, il arrive sans chute après avoir capturé chaque palier, et chaque module dure autant que seul.
  const p = new Partie(e.niveau);
  for (const c of e.solution) {
    if (p.finie) break;
    p.avancer(c);
  }
  const arrive = p.fin >= 0;
  if (!arrive) refus.push("le robot n'arrive pas");
  else {
    if (p.chutes > 0) refus.push(`le robot chute ${p.chutes} fois`);
    if (p.captures !== n + 1) refus.push(`${p.captures} paliers capturés sur ${n + 1}`);
    if (e.solution.length !== p.fin) refus.push("des pas après l'arrivée du robot");
    modules.forEach((m, i) => {
      const dans = e.paliersRobot[i + 1]! - e.paliersRobot[i]!;
      if (dans !== robotDuModule(m).ticks) refus.push(`${cles[i]} : ${dans} pas dans le niveau, ${robotDuModule(m).ticks} seul`);
    });
  }
  const ticksRobot = arrive ? p.resultat().ticks : 0;
  const secondes = ticksRobot / TICKS_PAR_SECONDE;
  if (arrive && (secondes < ROBOT_MIN_S || secondes > ROBOT_MAX_S)) refus.push(`le robot met ${secondes.toFixed(1)} s (de ${ROBOT_MIN_S} à ${ROBOT_MAX_S} s)`);
  return { refus, ticksRobot, distanceNonVoisins: proche === Infinity ? Infinity : proche / 100 };
}

// ---------------------------------------------------------------- le tirage
const poidsDe = (rng: Rng, poids: readonly number[]): number => {
  let r = rng.int(poids.reduce((s, x) => s + x, 0));
  for (let i = 0; i < poids.length; i++) {
    r -= poids[i]!;
    if (r < 0) return i;
  }
  return poids.length - 1;
};
const cle = (v: VarianteDeModule): string => v.cle;

/** Le tirage `tentative` d'un jour : une liste de clés de modules, ou `null` si la graine ne mène à rien (un cul-de-sac des règles de variété). Ne regarde pas encore la géométrie. */
export function tirer(jour: number, tentative: number): string[] | null {
  const rng = new Rng(mixSeed(jour, mixSeed(VERTIGE_GENERATOR_VERSION, tentative)));
  const libre = tentative >= TENTATIVES_AVANT_LIBRE;
  const tout = variantes();
  const n = [6, 6, 6, 6, 7, 7, 7, 7, 7, 8][rng.int(10)]!;
  const ouverture = libre ? rng.pick(OUVERTURES) : ouvertureDuJour(jour);
  const cloture = libre ? rng.pick(CLOTURES) : clotureDuJour(jour);
  const choisi: VarianteDeModule[] = [];
  const gravites: number[] = [BAS];
  const R0: Mat[] = [IDENTITE];
  const poser = (v: VarianteDeModule): boolean => {
    const R = mul(R0[R0.length - 1]!, ORIENTATIONS[v.module.sortie.ori]!);
    if (gravite(R) === HAUT) return false;
    R0.push(R);
    gravites.push(gravite(R));
    choisi.push(v);
    return true;
  };
  const combien = (base: string): number => choisi.filter((x) => x.base === base).length;
  for (let i = 0; i < n; i++) {
    const premier = i === 0;
    const dernier = i === n - 1;
    const precedent = choisi[i - 1]?.base;
    const candidats = tout.filter((v) => {
      if (premier) return v.base === ouverture && v.difficulte === 1;
      if (dernier) return v.base === cloture && v.difficulte >= 2;
      if (v.base === precedent || combien(v.base) >= MEME_BASE_MAX || choisi.some((x) => x.cle === v.cle)) return false;
      if (i === n - 2 && v.base === cloture) return false;
      if (v.base === ouverture || v.base === cloture) return false;
      return true;
    });
    if (candidats.length === 0) return null;
    // Le poids d'un candidat : sa difficulté contre celle qu'on attend à ce rang (1 au début, 3 à la fin) — la courbe de difficulté.
    const attendue = 1 + Math.floor((3 * i) / n);
    const poids = candidats.map((v) => (v.difficulte === attendue ? 6 : Math.abs(v.difficulte - attendue) === 1 ? 3 : 1));
    // Un candidat dont la sortie met la gravité vers le haut est écarté : on retire et on retente le poids sans lui.
    let reste = candidats.map((v, k) => ({ v, w: poids[k]! }));
    let pose = false;
    while (reste.length > 0 && !pose) {
      const k = poidsDe(rng, reste.map((x) => x.w));
      pose = poser(reste[k]!.v);
      if (!pose) reste = reste.filter((_x, j) => j !== k);
    }
    if (!pose) return null;
  }
  return choisi.map(cle);
}

// ---------------------------------------------------------------- les niveaux assemblés
const modulesDe = (cles: readonly string[]): Module[] => cles.map((c) => {
  const v = varianteDeCle(c);
  if (!v) throw new ErreurGenerateur(`module inconnu : ${c}`);
  return v.module;
});
const ASSEMBLES = new Map<string, Enchainement>();
/** Le niveau assemblé d'une liste de clés de modules (construit une fois : la solution du robot et ses temps en font partie). */
export function assemblerCles(cles: readonly string[]): Enchainement {
  const k = cles.join("|");
  let e = ASSEMBLES.get(k);
  if (!e) ASSEMBLES.set(k, (e = assembler(modulesDe(cles), "jour")));
  return e;
}
/** Enregistre la fabrique du niveau du jour (`niveauDuContenu`, `niveaux.ts`) : à l'initialisation de ce fichier, et à chaque appel du générateur (un paquet `sideEffects: false` peut y voir disparaître un import qui n'a que cet effet). */
export function enregistrerNiveauDuJour(): void {
  enregistrerFabriqueDuJour((cles) => assemblerCles(cles).niveau);
}
enregistrerNiveauDuJour();

export interface Generation {
  contenu: Contenu;
  /** Le nombre de tirages essayés avant celui qui est servi (0 : le premier), et si le secours (cycles ignorés) a servi. */
  refuses: number;
  secours: boolean;
  /** Les motifs de refus des tirages écartés (pour les mesures du lot). */
  motifs: string[];
}
const GENERES = new Map<number, Generation>();

/** Le niveau d'un jour avec le détail de sa génération (mesures, tests). */
export function genererNiveau(jour: number): Generation {
  let g = GENERES.get(jour);
  if (g) return g;
  enregistrerNiveauDuJour();
  const motifs: string[] = [];
  for (let t = 0; t < TENTATIVES_MAX; t++) {
    const cles = tirer(jour, t);
    if (!cles) {
      motifs.push("tirage sans issue");
      continue;
    }
    const mods = modulesDe(cles);
    // Les règles qui ne regardent pas la géométrie d'abord (un tirage qui les enfreint ne coûte pas un assemblage).
    const suites = passagesTournes(mods);
    if (suites.length > PASSAGES_TOURNES_MAX || suites.some((s) => s > MODULES_TOURNES_MAX)) {
      motifs.push("monde tourné");
      continue;
    }
    const meca = new Set(mods.flatMap((m) => m.etiquettes.mecaniques));
    meca.delete("course");
    if (meca.size < MECANIQUES_MIN) {
      motifs.push("mécaniques");
      continue;
    }
    const e = assemblerCles(cles);
    const rapport = controlerNiveau(cles, e, mods);
    if (rapport.refus.length === 0) {
      g = { contenu: { jour, g: VERTIGE_GENERATOR_VERSION, niveau: "jour", modules: cles, ticksRobot: rapport.ticksRobot }, refuses: t, secours: t >= TENTATIVES_AVANT_LIBRE, motifs };
      GENERES.set(jour, g);
      return g;
    }
    ASSEMBLES.delete(cles.join("|")); // un niveau refusé ne reste pas en mémoire
    motifs.push(rapport.refus[0]!.replace(/[0-9.,]+/g, "N"));
  }
  throw new ErreurGenerateur(`aucun niveau valide pour le jour ${jour} en ${TENTATIVES_MAX} tirages`);
}

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme : la version 1 est le parcours de la maquette. */
export function dailyVertige(jour: number, version: number = VERTIGE_GENERATOR_VERSION): Contenu {
  if (version === 1) return { jour, g: 1, niveau: "parcours" };
  if (version !== VERTIGE_GENERATOR_VERSION) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  return genererNiveau(jour).contenu;
}

/** Le niveau assemblé d'un contenu du jour (le robot, ses temps, le niveau) ; une erreur pour un contenu qui n'est pas celui d'un niveau assemblé. */
export function enchainementDuContenu(contenu: Pick<Contenu, "modules">): Enchainement {
  if (!contenu.modules) throw new ErreurGenerateur("ce contenu n'est pas un niveau assemblé de modules");
  return assemblerCles(contenu.modules);
}
/** Les commandes du robot d'un jour : sa rediffusion est le fantôme Diamant. */
export const robotDuJour = (contenu: Pick<Contenu, "modules">): Enchainement["solution"] => enchainementDuContenu(contenu).solution;

/** Oublie les niveaux construits (les tests de mesure de temps de génération). */
export function viderCachesDuGenerateur(): void {
  GENERES.clear();
  ASSEMBLES.clear();
}
