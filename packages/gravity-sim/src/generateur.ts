import { mixSeed, Rng } from "@cdj/core";
import { tickOuLeJoueurArrive, vitesseCamera } from "./camera";
import { ALTERNE_BATTEMENT, CASE, CIBLE_CAMERA, CLIGNOTANT_CYCLE, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, LARGEUR_MORCEAU, LIGNES, MORCEAUX_PAR_THEME, NB_THEMES, TICKS_PAR_SECONDE, VY_MAX } from "./constantes";
import { REGLES_COURANTES, cleDesRegles, reglesDe, type ReglagesEssai, type Regles } from "./regles";
import { ALTERNE_A, ALTERNE_B, BLOC, CLIGNOTANT, GLACE, INVERSEUR, PIQUE, TAPIS, VENT, VIDE, type Bonus, type Etape, type Morceau, type Motif, type Objet, type Terrain } from "./monde";
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
  morceau(jour: number, m: number, ordre: readonly ThemeGravity[], entree: 1 | -1, precedent: Motif | null, regles: Regles): Morceau;
}
/** Les versions que `dailyGravity` sait appeler (la version 3 est définie plus bas, avec `genererMorceau`). Mutable seulement pour que les tests y posent une version factice : le code n'y ajoute rien à l'exécution. */
export const GENERATEURS: Record<number, Generateur> = {};
/** Les versions du générateur que ce code sait appeler. */
export const versionsGenerateur = (): number[] => Object.keys(GENERATEURS).map(Number);

/** Les règles d'un contenu : sa version de la simulation, la longueur de thème de son générateur, ses réglages d'essai. */
export function reglesDuContenu(c: Pick<Contenu, "g" | "sim" | "reglages">): Regles {
  const gen = GENERATEURS[c.g];
  if (!gen) throw new ErreurGenerateur(`version de générateur inconnue : ${c.g}`);
  return reglesDe(c.sim ?? GRAVITY_SIM_VERSION, gen.morceauxParTheme, c.reglages);
}

/** Sel de la graine des morceaux (propre au jeu). */
const SEL = 0x6a9d3f;
const DEMI = CASE >> 1;
/** Le numéro d'un morceau qui commence la boucle suivante (la difficulté repart de la base, relevée de 35 %). */
const RAMPE_PAR_BOUCLE = 35;

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

/** Le nombre de pas d'une traversée verticale de `h` unités, partie de l'arrêt (la gravité de la partie, plafonnée à `VY_MAX`) : le temps d'un vol d'une surface à l'autre. Entier, comme tout ici. */
export function pasDeTraversee(h: number, regles: Regles = REGLES_COURANTES): number {
  let vy = 0;
  let y = 0;
  let pas = 0;
  while (y < h && pas < 1000) {
    vy = Math.min(VY_MAX, vy + regles.gravite);
    y += Math.trunc(vy / TICKS_PAR_SECONDE);
    pas++;
  }
  return pas;
}
/** Combien de colonnes (arrondi au-dessus) le joueur parcourt en `pas` pas quand il arrive à la colonne `colonne` : la vitesse de la caméra y est connue d'avance (elle ne dépend que de la distance). **C'est ce qui permet de poser les surfaces à la vitesse à laquelle le morceau sera abordé.** */
export function colonnesParcourues(pas: number, colonne: number, regles: Regles = REGLES_COURANTES): number {
  const parPas = Math.trunc(vitesseCamera(Math.max(0, colonne * CASE - CIBLE_CAMERA), regles) / TICKS_PAR_SECONDE);
  return Math.trunc((pas * parPas + CASE - 1) / CASE);
}

/** Les 12 cases d'une colonne vide : un plafond et un sol de deux cases. */
const colonneVide = (): number[] => Array.from({ length: LIGNES }, (_, r) => (r < 2 || r >= LIGNES - 2 ? BLOC : VIDE));

/**
 * Le morceau `m` d'un jour : **pure**, la même chose pour le même (graine du jour, numéro, ordre, gravité d'entrée). `entree` est la gravité du chemin sûr à la fin du morceau précédent (+1 : sur le sol, −1 : au plafond ;
 * +1 pour le tout premier) : le motif est posé **à l'endroit ou en miroir** pour que le chemin sûr commence du côté où l'on arrive (un morceau ne demande jamais une inversion dans ses deux premières colonnes : à 12 cases/s
 * elle n'aurait pas la place d'être faite). Les inversions que le motif exige sont dans le motif, avec la place pour les faire. `precedent` : le motif du morceau d'avant (lot GR2 : certains motifs ne se posent pas
 * après certains autres à grande vitesse, voir le tirage).
 */
export function genererMorceau(jour: number, m: number, ordre: readonly ThemeGravity[], entree: 1 | -1 = 1, precedent: Motif | null = null, regles: Regles = REGLES_COURANTES): Morceau {
  const rng = new Rng(mixSeed(mixSeed(jour, SEL), m));
  const REG = regles;
  const parTheme = REG.morceauxParTheme;
  const parBoucle = parTheme * NB_THEMES;
  const theme = ordre[Math.trunc(m / parTheme) % NB_THEMES]!;
  const boucle = Math.trunc(m / parBoucle);
  /** La difficulté de 0 à 100 : monte sur le tour des cinq thèmes, repart de la base relevée de 35 % à la boucle suivante. */
  const d = Math.min(100, Math.trunc(((m % parBoucle) * 100) / 60) + boucle * RAMPE_PAR_BOUCLE);
  const x0 = m * LARGEUR_MORCEAU;

  const cases = new Uint8Array(LARGEUR_MORCEAU * LIGNES);
  for (let c = 0; c < LARGEUR_MORCEAU; c++) cases.set(colonneVide(), c * LIGNES);
  const pieces: Objet[] = [];
  const gemmes: Objet[] = [];
  const bonus: Bonus[] = [];
  const chemin: Etape[] = [];
  let decalage = 0;
  /** La rangée où le bonus est posé quand aucune étape du chemin ne couvre la colonne 8 (une trajectoire en l'air). */
  let rangeeEnLAir: number | null = null;
  /** Le miroir : toutes les rangées et les gravités sont renversées (le sol devient le plafond). Décidé par chaque motif avant de poser quoi que ce soit. */
  let miroir = false;
  const R = (r: number): number => (miroir ? LIGNES - 1 - r : r);
  const G = (g: 1 | -1): 1 | -1 => (miroir ? ((-g) as 1 | -1) : g);
  /** Le motif est écrit pour une première étape de gravité `g1` ; `meme` : on veut arriver du côté de cette étape (sol → sol), sinon du côté opposé (une inversion d'entrée, courte : on passe de la surface à la plateforme voisine). */
  const orienter = (g1: 1 | -1, meme: boolean): void => {
    miroir = meme ? g1 !== entree : g1 === entree;
  };

  const poser = (c: number, r: number, type: number): void => {
    const rr = R(r);
    if (c >= 0 && c < LARGEUR_MORCEAU && rr >= 0 && rr < LIGNES) cases[c * LIGNES + rr] = type;
  };
  /** Le centre de la colonne `c`, à la rangée `r` (le centre de la case). */
  const centre = (c: number, r: number): Objet => ({ x: (x0 + c) * CASE + DEMI, y: (2 * R(r) + 1) * DEMI });
  /** Un trou au sol (`haut` faux) ou au plafond : les deux cases de la surface disparaissent. */
  const trou = (de: number, a: number, haut: boolean): void => {
    for (let c = de; c < Math.min(a, LARGEUR_MORCEAU); c++) {
      poser(c, haut ? 0 : LIGNES - 2, VIDE);
      poser(c, haut ? 1 : LIGNES - 1, VIDE);
    }
  };
  /** Une étape du chemin sûr, avec des pièces toutes les deux colonnes sur la rangée du joueur. */
  const voie = (de: number, a: number, rangee: number, g: 1 | -1): void => {
    chemin.push({ c0: de, c1: a, y: R(rangee), g: G(g) });
    for (let c = de; c < a; c += 2) pieces.push(centre(c, rangee));
  };
  /** Une étape du chemin sûr sans pièces. */
  const etape = (de: number, a: number, rangee: number, g: 1 | -1): void => void chemin.push({ c0: de, c1: a, y: R(rangee), g: G(g) });
  /** Des pièces en l'air (la trajectoire que le vent porte). */
  const enLAir = (de: number, a: number, rangee: number): void => {
    rangeeEnLAir = R(rangee);
    for (let c = de; c < a; c += 2) pieces.push(centre(c, rangee));
  };
  const n = (): number => 3 + rng.int(2 + Math.trunc((d * 4) / 100));
  /** La rangée de l'étape qui couvre la colonne `c` (sinon la dernière étape, sinon le sol). */
  const rangeeEn = (c: number): number => chemin.find((e) => e.c0 <= c && c < e.c1)?.y ?? chemin[chemin.length - 1]?.y ?? 9;
  /** Une gemme à la rangée `r` du motif (avant miroir). */
  const gemme = (c: number, r: number): void => void gemmes.push(centre(c, r));

  let motif: Motif;
  if (m < 3) {
    // Les trois premiers morceaux sont calmes : un couloir, des pièces sur une rangée.
    motif = "calme";
    if (m % 2) voie(2, 14, 2, -1);
    else voie(2, 14, 9, 1);
  } else {
    // Un morceau sur trois environ porte la case spéciale du thème ; sinon un motif commun (les sept premiers tant que la difficulté est basse).
    const special = rng.chance(38);
    const LISTE: readonly Motif[] = ["trouBas", "trouHaut", "zigzag", "pilier", "pics", "milieu", "escalier", "etages", "inverseur", "ilots"];
    motif = special ? "special" : LISTE[rng.int(d < 30 ? 7 : LISTE.length)]!;
    // **Lot GR2 : deux motifs que le robot ne passe pas partout à grande vitesse.** (1) L'escalier montant : arrivé du sol, on s'accroche sous la première marche, puis sous la seconde, puis le plafond vous reprend — trois vols de
    // 3, 5 et 5 colonnes à 12,5 m/s, plus les temps de se poser : plus que les 16 colonnes, et le morceau finirait à mi-hauteur, là où le suivant n'attend personne. Au-delà de 10 m/s (un vol de 3 cases fait 5 colonnes) il
    // devient un trou, qui finit au plafond ; l'escalier qui descend (arrivée du plafond) finit au sol et reste. (2) Les îlots demandent un vol de 5 cases dès la colonne 2 : après un morceau dont le dernier vol atterrit
    // dans le suivant (étages, milieu, escalier : on touche la surface après le bout du morceau) il n'y a plus la place de s'y préparer à grande vitesse : l'îlot devient un trou.
    const vite = colonnesParcourues(pasDeTraversee(3 * CASE, REG), x0 + 8, REG) >= 5;
    if (motif === "escalier" && entree === 1 && vite) motif = "trouBas";
    if (motif === "ilots" && vite && precedent !== null && (precedent === "etages" || precedent === "milieu" || precedent === "escalier")) motif = "trouHaut";
    switch (motif) {
      case "trouBas":
      case "trouHaut": {
        // Un trou : on est du côté qui reste (le motif est en miroir au besoin, `trouBas` et `trouHaut` ne diffèrent que par leur nom).
        orienter(-1, true);
        const l = n();
        trou(4, 4 + l, false);
        voie(3, 5 + l, 2, -1);
        break;
      }
      case "zigzag": {
        orienter(-1, true);
        trou(2, 2 + n(), false);
        trou(9, 9 + Math.min(6, n()), true);
        voie(2, 7, 2, -1);
        voie(10, 15, 9, 1);
        break;
      }
      case "pilier": {
        orienter(-1, true);
        for (const c of [8, 9]) for (let y = 0; y < 4; y++) poser(c, 9 - y, BLOC);
        rng.chance(50);
        voie(3, 14, 2, -1);
        break;
      }
      case "pics": {
        orienter(-1, true);
        const l = 4 + rng.int(3 + Math.trunc((d * 4) / 100));
        for (let c = 4; c < Math.min(LARGEUR_MORCEAU, 4 + l); c++) poser(c, 9, PIQUE);
        voie(3, 4 + l, 2, -1);
        break;
      }
      case "milieu": {
        // Une plateforme de deux cases au milieu, sol et plafond troués : on se tient dessus (rangée 4) ou dessous (rangée 7), du côté qu'on atteint d'une inversion depuis la surface d'où l'on vient.
        // **Lot GR2 : la plateforme finit assez tôt pour qu'on ait rejoint le sol ou le plafond avant le bout du morceau** (le suivant n'attend personne à mi-hauteur) : la descente depuis la plateforme fait 5 cases,
        // `sortie` colonnes de course (4 à 7 m/s, 7 à 12,5 m/s), plus une de marge ; la plateforme dépasse le trou d'une colonne de chaque côté, comme avant (13 colonnes de trou à basse vitesse, 5 à 12,5 m/s).
        orienter(1, false);
        const sortie = colonnesParcourues(pasDeTraversee(5 * CASE, REG), x0 + 12, REG) + 1;
        const fin = Math.max(8, Math.min(13, LARGEUR_MORCEAU - sortie));
        trou(3, fin, false);
        trou(3, fin, true);
        for (let c = 2; c < fin + 1; c++) {
          poser(c, 5, BLOC);
          poser(c, 6, BLOC);
        }
        voie(3, fin, 4, 1);
        rng.chance(50);
        if (rng.chance(25)) gemme(Math.min(8, fin - 2), rng.chance(50) ? 4 : 7);
        break;
      }
      case "inverseur": {
        // Trois cases d'inverseur sur une surface, et cette même surface trouée plus loin : on les touche, la gravité s'inverse, on traverse jusqu'à la surface d'en face.
        orienter(1, true);
        rng.chance(50);
        for (let c = 6; c < 9; c++) poser(c, 10, INVERSEUR);
        trou(10, 15, false);
        voie(4, 9, 9, 1);
        voie(10, 15, 2, -1);
        break;
      }
      case "escalier": {
        // Deux plateformes au milieu, en marches : d'en bas on s'accroche sous la première puis sous la seconde (une inversion au début) ; en miroir, d'en haut on descend de marche en marche sans rien toucher.
        orienter(-1, false);
        trou(3, 16, false);
        trou(3, 15, true);
        for (let c = 1; c < 8; c++) poser(c, 7, BLOC);
        for (let c = 6; c < 14; c++) poser(c, 4, BLOC);
        voie(3, 8, 8, -1);
        voie(8, 14, 5, -1);
        break;
      }
      case "etages": {
        // Deux étages au milieu de l'écran : l'étage haut (rangée 4) troué en A, l'étage bas (rangée 7) long de 13 colonnes ; sous eux le sol est un vide, et le plafond reste là pour finir. Par-dessus l'étage haut (arrivée
        // du plafond), on tombe dans le trou A sur l'étage bas, puis on s'accroche sous lui jusqu'à son bout et on monte au plafond ; par-dessous l'étage bas (arrivée du sol), on le suit jusqu'à son bout et le plafond d'en haut
        // vous prend. Pas de miroir : les deux chemins existent, et **les deux finissent au plafond**, comme le morceau suivant l'attend (lot GR2 : l'étage haut ne retenait plus le joueur jusqu'au bord du morceau).
        // **Le trou A suit la vitesse.** Pour traverser un étage d'une case la boîte (0,8) doit descendre de 1,8 case : 34 pas, soit `trav` colonnes de course (3 à 9 m/s, 4 à 12,5 m/s) ; le trou est large de `trav + 3` colonnes
        // (de quoi y tenir, plus une fenêtre) ; l'étage haut commence par 5 colonnes, de quoi se poser en arrivant du plafond (le morceau d'avant finit souvent à la colonne 16 sous un îlot : le plafond se rejoint aux premières colonnes).
        const trav = colonnesParcourues(pasDeTraversee(Math.trunc((9 * CASE) / 5), REG), x0 + 8, REG);
        const chute = colonnesParcourues(pasDeTraversee(3 * CASE, REG), x0 + 8, REG);
        const a0 = 5;
        const a1 = Math.min(LARGEUR_MORCEAU - 4, a0 + trav + 3);
        for (let c = 0; c < LARGEUR_MORCEAU; c++) {
          if (c < a0 || (c >= a1 && c < a1 + 3)) poser(c, 4, BLOC);
          if (c < 13) poser(c, 7, BLOC);
        }
        trou(2, 14, false);
        rng.chance(50);
        rng.chance(50);
        if (entree === -1) {
          voie(1, a0 + 1, 3, 1);
          voie(Math.min(a0 + chute - 1, 10), 13, 6, 1);
        } else voie(1, 13, 8, -1);
        voie(14, 16, 2, -1);
        if (rng.chance(35)) gemme(14, 2);
        break;
      }
      case "ilots": {
        // Des îlots flottants, en bas puis en haut, au-dessus du vide : on saute de l'un à l'autre en inversant (on arrive du plafond sur le premier ; en miroir, du sol sous le premier).
        // **Lot GR2 : l'écart entre deux îlots suit la vitesse** — un vol d'un îlot bas (rangée 8) à un îlot haut (rangée 3) dure 45 pas et fait 3 colonnes à 7 m/s, 5 à 12,5 m/s : les îlots sont posés tous les
        // `vol + 3` colonnes (de quoi se poser, attendre `ROBOT_ECART_MIN` pas et repartir avec une fenêtre), larges de `vol − 1` (3 à 4 colonnes), et le vide s'arrête après le dernier.
        orienter(1, false);
        const vol = colonnesParcourues(pasDeTraversee(Math.trunc((13 * CASE) / 4), REG), x0 + 8, REG);
        const largeur = Math.max(3, Math.min(5, vol));
        const ecart = vol + 4;
        // Après le dernier îlot on quitte sa surface pour rejoindre le sol ou le plafond (2 cases de vol, 2 à 4 colonnes) : il finit assez tôt pour que ce soit fait avant le bout du morceau, que le suivant attend sur
        // une surface (à 12,5 m/s il ne reste de la place que pour un seul îlot).
        const queue = colonnesParcourues(pasDeTraversee(2 * CASE, REG), x0 + 14, REG) + 1;
        const iles: number[] = [];
        for (let c = 2; c + largeur + queue <= LARGEUR_MORCEAU && iles.length < 4; c += ecart) iles.push(c);
        if (iles.length === 0) iles.push(2);
        const finVide = Math.min(LARGEUR_MORCEAU, iles[iles.length - 1]! + largeur + 2);
        trou(2, finVide, false);
        trou(2, finVide, true);
        iles.forEach((c0, k) => {
          const bas = k % 2 === 0;
          for (let c = c0; c < c0 + largeur; c++) poser(c, bas ? 8 : 3, BLOC);
          voie(c0, c0 + largeur, bas ? 7 : 4, bas ? 1 : -1);
        });
        break;
      }
      case "special": {
        switch (theme) {
          case "usine": {
            // Des tapis roulants au sol et au plafond, un trou en face de la course : il faut quitter le sol (il pousse plus vite) avant qu'il s'arrête.
            orienter(1, true);
            for (let c = 1; c < 15; c++) {
              poser(c, 10, TAPIS);
              poser(c, 1, TAPIS);
            }
            const l = Math.min(5, n());
            const haut = rng.chance(50);
            trou(9, 9 + l, haut);
            if (haut) voie(2, 15, 9, 1);
            else {
              voie(2, 5, 9, 1);
              voie(10, 15, 2, -1);
            }
            break;
          }
          case "glace": {
            // Une surface de glace : on ne peut pas y prendre appui. On court sur la surface d'en face, puis un trou après la glace oblige à passer de l'autre côté.
            orienter(1, true);
            rng.chance(50);
            for (let c = 2; c < 10; c++) poser(c, 1, GLACE);
            trou(10, 15, false);
            voie(2, 10, 9, 1);
            voie(10, 15, 2, -1);
            break;
          }
          case "nuit": {
            // Cinq colonnes de cases qui battent (clignotantes) sur une surface, l'autre surface est trouée : on traverse en rythme. Le battement est aligné sur l'arrivée du joueur : la traversée prévue est possible.
            orienter(1, true);
            rng.chance(50);
            for (let c = 5; c < 10; c++) {
              poser(c, 10, CLIGNOTANT);
              poser(c, 11, CLIGNOTANT);
            }
            trou(4, 12, true);
            voie(3, 13, 9, 1);
            const arrivee = tickOuLeJoueurArrive((x0 + 4) * CASE, REG);
            decalage = (CLIGNOTANT_CYCLE - (arrivee % CLIGNOTANT_CYCLE)) % CLIGNOTANT_CYCLE;
            break;
          }
          case "neon": {
            // Deux couleurs, une seule solide à la fois : on court sur la première, on inverse au battement, on se pose sur la seconde. Le battement est aligné sur l'arrivée du joueur.
            // **Lot GR2 : la seconde couleur est posée là où le vol d'une surface à l'autre atterrit.** Du plafond au sol il y a 7,25 cases : 75 pas, soit `vol` colonnes de course (5 à 7 m/s, 8 à 12,5 m/s) ; partant de
            // la première couleur (colonnes 3 à 7) on atterrit à `vol` colonnes de plus, la seconde commence donc `vol − 1` colonnes après sa première colonne et le vide la suit.
            orienter(1, true);
            const vol = colonnesParcourues(pasDeTraversee(Math.trunc((29 * CASE) / 4), REG), x0 + 8, REG);
            const b0 = Math.min(LARGEUR_MORCEAU - 3, 2 + vol);
            const b1 = Math.min(LARGEUR_MORCEAU, 9 + vol);
            trou(3, b1, false);
            trou(3, b1, true);
            for (let c = 3; c < 8; c++) poser(c, 10, ALTERNE_A);
            for (let c = b0; c < b1; c++) poser(c, 1, ALTERNE_B);
            voie(3, 8, 9, 1);
            voie(b0 + 1, b1, 2, -1);
            const bascule = tickOuLeJoueurArrive((x0 + 7) * CASE, REG);
            decalage = (((ALTERNE_BATTEMENT - bascule) % (2 * ALTERNE_BATTEMENT)) + 2 * ALTERNE_BATTEMENT) % (2 * ALTERNE_BATTEMENT);
            break;
          }
          default: {
            // Forêt : un courant d'air au-dessus d'un trou du sol. On quitte le sol avant le trou, le vent porte d'un coup jusqu'au plafond (poussée vers le haut, gravité allégée) ; arrivé du plafond, on y reste. Le vent ne se renverse pas : pas de miroir.
            trou(4, 12, false);
            for (let c = 5; c < 11; c++) for (let y = 3; y < 10; y++) poser(c, y, VENT);
            if (entree === 1) {
              etape(2, 4, 9, 1);
              etape(7, 16, 2, -1);
            } else etape(2, 16, 2, -1);
            enLAir(4, 12, 5);
            break;
          }
        }
        if (rng.chance(30)) gemme(13, R(rangeeDeLEtape(chemin, 13)));
        break;
      }
    }
  }
  // Les bonus : posés par le niveau, aux mêmes endroits pour toutes les parties.
  const rangeeBonus = rangeeEnLAir ?? rangeeEn(8);
  const bonusEn = (type: Bonus["type"]): Bonus => ({ x: (x0 + 8) * CASE + DEMI, y: (2 * rangeeBonus + 1) * DEMI, type });
  if (m % 23 === 11) bonus.push(bonusEn("bouclier"));
  if (m % 23 === 19) bonus.push(bonusEn("aimant"));
  return { m, theme, motif, cases, pieces, gemmes, bonus, chemin, decalage, entree, sortie: chemin[chemin.length - 1]!.g };
}

/** La rangée (déjà en miroir) de l'étape qui couvre la colonne `c`, sinon celle de la dernière étape. */
const rangeeDeLEtape = (chemin: readonly Etape[], c: number): number => (chemin.find((e) => e.c0 <= c && c < e.c1) ?? chemin[chemin.length - 1]!).y;

// Les terrains du jour sont gardés en mémoire (un jour est rejoué des centaines de fois par le serveur) ; au plus huit.
const GARDES = new Map<string, Terrain>();

/** Le terrain d'un contenu : ses morceaux, tirés à la demande puis gardés, **par le générateur de sa version et sous les règles de sa simulation** (lot GR5). */
export function terrainDuJour(contenu: Pick<Contenu, "jour" | "ordre" | "g" | "sim" | "reglages">): Terrain {
  const regles = reglesDuContenu(contenu);
  const cle = `${contenu.jour}:${contenu.g}:${cleDesRegles(regles)}:${contenu.ordre.join(",")}`;
  const garde = GARDES.get(cle);
  if (garde) return garde;
  const gen = GENERATEURS[contenu.g]!;
  const morceaux: Morceau[] = [];
  // Les morceaux se tirent dans l'ordre : chacun a besoin de la gravité de sortie du précédent (`entree`).
  const terrain: Terrain = {
    regles,
    morceau(k) {
      while (morceaux.length <= k) morceaux.push(gen.morceau(contenu.jour, morceaux.length, contenu.ordre, morceaux.length === 0 ? 1 : morceaux[morceaux.length - 1]!.sortie, morceaux.length === 0 ? null : morceaux[morceaux.length - 1]!.motif, regles));
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
    entier(m.decalage);
    entier(m.entree + 1);
  }
  return h.toString(16).padStart(8, "0");
}

/** Le générateur de la version 3 (lot GR2 : îlots, étages et néon suivent la vitesse) : `genererMorceau`, avec l'ordre des thèmes de Jump et 19 morceaux par thème. */
GENERATEURS[3] = { morceauxParTheme: MORCEAUX_PAR_THEME, ordre: ordreDesThemes, morceau: genererMorceau };
