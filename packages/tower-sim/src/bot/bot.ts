// Lot T3 — le bot de l'auteur : glouton, pièce par pièce. Il joue une vraie partie (celle d'un jour), dont la rediffusion est la preuve de l'auteur et dont la hauteur est le Diamant.
//
// À chaque pièce (dès qu'elle naît), il essaie des positions × rotations sur une COPIE de la partie (`Partie.cloner`) : il envoie les vraies commandes (tourner, déplacer, descendre),
// laisse la tour se calmer et la mesure. Il garde le meilleur compromis hauteur / stabilité (la note : `noteEssai`, en millimètres entiers) et joue ces commandes sur la vraie partie. Rien
// n'est tiré au hasard : l'ordre des essais est fixe (du centre vers les bords), à note égale le premier essayé l'emporte ; deux passages donnent la même preuve. Les paliers et leurs effets
// s'appliquent au bot comme au joueur (les copies les portent). La pièce suivante est retenue en l'air pendant un essai (`Partie.retenir`) : elle ne vient pas heurter la tour avant la fin du jugement.
//
// **Le bot joue comme un joueur : il ne pose une pièce que là où un joueur la voit.** La caméra ne montre que `PROFONDEUR_VISIBLE_MM` sous le sommet de la tour ; un coup dont la pièce se pose plus
// bas (au pied de la tour, sur la plateforme, hors de l'écran) est INTERDIT, et **jeter une pièce à la mer ou s'arrêter en jetant ses dernières pièces n'existe pas** : le Diamant est la hauteur
// où finit une vraie partie, effondrements compris. (Premier essai du lot T3 : le bot s'y servait de la plateforme et de la mer comme d'une poubelle ; relevé par Nathan.)
//
// **Arrêt anticipé** : un essai dont la borne haute (le point le plus haut de la tour au lâcher, plus `MARGE_BORNE_MM`) ne peut plus battre la
// meilleure note est abandonné sans être jugé. Les essais sont d'abord menés jusqu'au lâcher, puis jugés du plus haut au plus bas.
import type { PieceKind } from "../../lab/interface";
import { COMMANDE, DEMI_CASE_8 } from "../constantes";
import { Partie, type Resultat, type Scenario } from "../partie";
import type { Rapier } from "../rapier";
import { enregistrer, type Rediffusion } from "../rediffusion";
import {
  CALME_MAX_TICKS,
  CALME_MIN_TICKS,
  CALME_TICKS,
  CALME_VITESSE,
  MARGE_BORNE_MM,
  PENALITE_MOUVEMENT,
  PENALITE_VIE,
  POSITIONS_PAR_COTE,
  PROFONDEUR_VISIBLE_MM,
  BUDGET_TICKS,
  SATISFAIT_MM,
  FINALISTES,
  LARGEUR_POIDS_PCT,
  LARGEUR_PROFONDEUR_MM,
} from "./constantes";

/** Les quarts de tour qui donnent des formes distinctes : 1 pour O, 2 pour I, S et Z, 4 pour les autres. */
export const ROTATIONS: Readonly<Record<PieceKind, number>> = { O: 1, I: 2, S: 2, Z: 2, T: 4, L: 4, J: 4 };

export interface OptionsBot {
  /** Positions essayées de chaque côté de l'apparition (pas de la demi-case). */
  positionsParCote: number;
  /** Le poids de la largeur du sommet dans la note, en pourcentage. */
  largeurPct: number;
  /**
   * Pour les MESURES seulement (un joueur imparfait, `tools/mesures-t3.ts`) : le décalage, en demi-cases, appliqué au coup retenu de la pièce `numero` (0 : aucun). Le bot de l'auteur n'en a
   * jamais ; il ne change pas le calcul des autres pièces, qui se fait sur la partie réellement jouée.
   */
  decalage?: (numero: number) => number;
  /** Le plafond de ticks de calcul de cette partie (voir `BUDGET_TICKS`) : au-delà, le calcul est abandonné (`bot` rend `null`) — réservé aux reprises. Absent : aucun plafond. */
  plafondTicks?: number;
}
export const OPTIONS_BOT: Readonly<OptionsBot> = { positionsParCote: POSITIONS_PAR_COTE, largeurPct: LARGEUR_POIDS_PCT };

/** La note d'un coup (millimètres entiers) : la hauteur stable, moins une pénalité par vie perdue, moins une pénalité par pièce qui bouge encore à la fin du jugement. */
export const noteEssai = (hauteurMm: number, viesPerdues: number, mouvantes: number): number => hauteurMm - PENALITE_VIE * viesPerdues - PENALITE_MOUVEMENT * mouvantes;

/** Un coup : `rot` quarts de tour, puis `dx` pas de demi-case (négatif : à gauche). Les commandes sont une par tick, DESCENDRE levé tout du long (confort, sans effet physique). */
export interface Coup {
  rot: number;
  dx: number;
}

/** Les commandes d'un coup jusqu'à la fin des déplacements ; au-delà, DESCENDRE seul. */
export function commandesDuCoup(c: Coup): number[] {
  const m: number[] = [];
  for (let i = 0; i < c.rot; i++) m.push(COMMANDE.TOURNER | COMMANDE.DESCENDRE);
  for (let i = 0; i < Math.abs(c.dx); i++) m.push((c.dx < 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE) | COMMANDE.DESCENDRE);
  return m;
}

/** Les coups essayés pour une pièce, dans l'ordre fixe : du centre vers les bords (0, −1, +1, −2…), chaque rotation. */
export function coupsDe(kind: PieceKind, plateformeDemi8: number, o: Readonly<OptionsBot> = OPTIONS_BOT): Coup[] {
  const k = Math.min(o.positionsParCote, Math.floor(plateformeDemi8 / DEMI_CASE_8) + 1);
  const dxs = [0];
  for (let i = 1; i <= k; i++) dxs.push(-i, i);
  const coups: Coup[] = [];
  for (const dx of dxs) for (let rot = 0; rot < ROTATIONS[kind]; rot++) coups.push({ rot, dx });
  return coups;
}

interface Essai {
  coup: Coup;
  masques: number[];
  copie: Partie;
  /** Borne haute de la note, connue au lâcher. */
  borne: number;
  note: number | null;
  /** La pièce se pose hors de la zone visible (plus bas que `PROFONDEUR_VISIBLE_MM` sous le sommet de la tour) : le coup n'existe pas pour le bot. */
  interdit: boolean;
}

/** Un coup est interdit si la pièce se pose (centre à `yMm`) plus bas que `PROFONDEUR_VISIBLE_MM` sous le sommet de la tour d'avant (`sommetAvantMm`) : hors de l'écran, un joueur ne la voit pas. */
export const coupInterdit = (yMm: number, sommetAvantMm: number): boolean => yMm < sommetAvantMm - PROFONDEUR_VISIBLE_MM;

/** Les chiffres d'un tour de calcul (pour les mesures). */
export interface Compteurs {
  essais: number;
  elagues: number;
  ticks: number;
  /** Ticks de l'anticipation (compris dans `ticks`). */
  ticksAnticipation: number;
}

/** Joue les commandes du coup sur une copie jusqu'au lâcher de la pièce `id`. */
function jusquAuLacher(base: Partie, coup: Coup, id: number, n: Compteurs): { masques: number[]; copie: Partie } {
  const copie = base.cloner();
  const plan = commandesDuCoup(coup);
  const masques: number[] = [];
  for (let k = 0; k < 4000; k++) {
    const m = k < plan.length ? plan[k]! : COMMANDE.DESCENDRE;
    masques.push(m);
    copie.avancer(m);
    n.ticks++;
    if (copie.idActive !== id) break;
  }
  return { masques, copie };
}

/** Laisse la partie `c` avancer sans commande jusqu'au calme (ou `max` ticks) : une pièce qui tombe n'arrête pas l'essai, on veut voir si la tour suit. `min` : pas de jugement avant ce tick. */
function calmer(c: Partie, min: number, max: number, n: Compteurs): void {
  let calmes = 0;
  for (let t = 0; t < max; t++) {
    if (c.etape === "fini") return;
    c.avancer(0);
    n.ticks++;
    if (t + 1 < min) continue;
    calmes = c.agitees(CALME_VITESSE) === 0 ? calmes + 1 : 0;
    if (calmes >= CALME_TICKS) return;
  }
}

/** Le premier jugement d'un coup : la tour se calme (la pièce suivante retenue en l'air) ; la note est celle de la tour calme. */
function juger(e: Essai, tombeesAvant: number, options: Readonly<OptionsBot>, n: Compteurs): number {
  const c = e.copie;
  c.retenir(true);
  calmer(c, CALME_MIN_TICKS, CALME_MAX_TICKS, n);
  const l = c.lecture();
  return noteEssai(l.hauteurMm, l.tombees - tombeesAvant, c.agitees(CALME_VITESSE)) + Math.floor((c.largeurSommetMm(LARGEUR_PROFONDEUR_MM) * options.largeurPct) / 100);
}

/**
 * Essaie les `coups` de la pièce active `id` de `base` et rend les `k` meilleurs (du premier au dernier), avec tous les essais (à libérer par l'appelant). Chaque coup est mené jusqu'au
 * lâcher ; puis, du plus haut au plus bas, on ne juge un coup que si sa borne haute peut encore le placer parmi les `k` meilleurs (arrêt anticipé).
 */
function classer(base: Partie, id: number, coups: readonly Coup[], tombeesAvant: number, k: number, options: Readonly<OptionsBot>, n: Compteurs): { classes: Essai[]; tous: Essai[] } {
  const tous: Essai[] = [];
  const sommetAvant = base.lecture().sommetMm;
  for (const coup of coups) {
    const { masques, copie } = jusquAuLacher(base, coup, id, n);
    const l = copie.lecture();
    n.essais++;
    // La pièce posée : où ? Une pièce déjà tombée sous la plateforme n'est « posée » nulle part (c'est une vie perdue, que la note compte), les autres le sont à la hauteur de leur centre.
    const p = copie.vue().pieces[id]!;
    tous.push({
      coup,
      masques,
      copie,
      borne: l.sommetMm + MARGE_BORNE_MM + Math.floor(((copie.largeurSommetMm(LARGEUR_PROFONDEUR_MM) + MARGE_BORNE_MM) * options.largeurPct) / 100) - PENALITE_VIE * (l.tombees - tombeesAvant),
      note: null,
      interdit: p.etat === "libre" && coupInterdit(Math.round(p.y * 1000), sommetAvant),
    });
  }
  // Les coups permis ; s'il n'y en a aucun (jamais en pratique : poser la pièce sur le sommet est toujours possible), le moins mauvais des interdits.
  const permis = tous.some((e) => !e.interdit);
  const ordre = tous.map((_, i) => i).filter((i) => !permis || !tous[i]!.interdit).sort((a, b) => tous[b]!.borne - tous[a]!.borne || a - b);
  const classes: number[] = [];
  const avant = (a: number, b: number): boolean => tous[a]!.note! > tous[b]!.note! || (tous[a]!.note === tous[b]!.note && a < b);
  for (const i of ordre) {
    const e = tous[i]!;
    if (e.note === null) {
      const pire = classes.length >= k ? tous[classes[k - 1]!]!.note! : -Infinity;
      if (e.borne < pire) {
        n.elagues++;
        continue;
      }
      e.note = juger(e, tombeesAvant, options, n);
    }
    classes.push(i);
    for (let j = classes.length - 1; j > 0 && avant(classes[j]!, classes[j - 1]!); j--) [classes[j], classes[j - 1]] = [classes[j - 1]!, classes[j]!];
    if (classes.length > k) classes.pop();
  }
  return { classes: classes.map((i) => tous[i]!), tous };
}

/**
 * L'anticipation : la valeur d'un coup est celle du meilleur coup de la pièce SUIVANTE (connue : la plaque « Suivante »), jugé de la même façon. Un coup qui laisse une tour où
 * plus rien ne se pose vaut peu, même s'il est le plus haut ; c'est ce qui évite les mâts qui s'effondrent à la pièce d'après. Les positions de la suivante sont une sur deux.
 */
function anticiper(e: Essai, tombeesAvant: number, options: Readonly<OptionsBot>, plateformeDemi8: number, n: Compteurs): number {
  const l = e.copie.lecture();
  if (l.phase !== "jeu" || l.active < 0) return e.note!;
  const suivante = e.copie.vue().pieces[l.active]!.kind;
  const coups = coupsDe(suivante, plateformeDemi8, options).filter((c) => c.dx % 2 === 0 && Math.abs(c.dx) <= options.positionsParCote);
  const { classes, tous } = classer(e.copie, l.active, coups, tombeesAvant, 1, options, n);
  const valeur = classes[0]!.note!;
  for (const x of tous) x.copie.dispose();
  return valeur;
}

export interface ResultatBot {
  rediffusion: Rediffusion;
  resultat: Resultat;
  compteurs: Compteurs;
}

/**
 * Joue le jour (ou le scénario) `contenu`. Un générateur : il rend la main à chaque pièce décidée en rendant ses masques de commandes (un par tick, jusqu'au lâcher de la pièce), de
 * quoi la jouer à l'écran (`&bot`) ; la valeur finale est la preuve, le résultat et les compteurs — **`null` si le plafond de ticks (`options.plafondTicks`) a coupé le calcul** : une partie
 * non finie n'est pas une preuve. La partie est jouée jusqu'au bout, comme celle d'un joueur. `R` est le module Rapier chargé.
 */
export function* bot(R: Rapier, contenu: Scenario, options: Readonly<OptionsBot> = OPTIONS_BOT): Generator<number[], ResultatBot | null> {
  const partie = new Partie(R, contenu);
  const compteurs: Compteurs = { essais: 0, elagues: 0, ticks: 0, ticksAnticipation: 0 };
  try {
    for (let numero = 0; ; numero++) {
      const l0 = partie.lecture();
      if (l0.phase !== "jeu" || l0.active < 0) break;
      if (options.plafondTicks !== undefined && compteurs.ticks > options.plafondTicks) return null;
      const kind = partie.vue().pieces[l0.active]!.kind;
      // 1. Les meilleurs coups de la pièce.
      const { classes, tous: essais } = classer(partie, l0.active, coupsDe(kind, contenu.plateformeDemi8, options), l0.tombees, FINALISTES, options, compteurs);
      const classesI = classes.map((e) => essais.indexOf(e));
      // 2. L'anticipation des finalistes.
      let meilleur = -1;
      let valeur = -Infinity;
      const t0 = compteurs.ticks;
      for (const i of classesI) {
        const v = anticiper(essais[i]!, l0.tombees, options, contenu.plateformeDemi8, compteurs);
        if (v > valeur) {
          valeur = v;
          meilleur = i;
        }
      }
      compteurs.ticksAnticipation += compteurs.ticks - t0;
      // 3. Le coup retenu, sur la vraie partie.
      let choix = essais[meilleur]!;
      const d = options.decalage?.(numero) ?? 0;
      if (d !== 0) choix = essais.find((e) => e.coup.rot === choix.coup.rot && e.coup.dx === choix.coup.dx + d) ?? choix;
      const masques = choix.masques;
      for (const e of essais) e.copie.dispose();
      for (const m of masques) partie.avancer(m);
      yield masques;
    }
    while (partie.etape !== "fini") partie.avancer(0);
    return { rediffusion: enregistrer(partie), resultat: partie.resultat()!, compteurs };
  } finally {
    partie.dispose();
  }
}

/** Le jour d'un trait, avec ou sans plafond : `null` seulement si le plafond a coupé le calcul. */
export function essayerBot(R: Rapier, contenu: Scenario, options: Readonly<OptionsBot> = OPTIONS_BOT): ResultatBot | null {
  const g = bot(R, contenu, options);
  for (;;) {
    const n = g.next();
    if (n.done) return n.value;
  }
}

/** Le jour d'un trait, sans plafond : les commandes de chaque pièce sont jetées, on garde la preuve et le résultat. */
export function jouerBot(R: Rapier, contenu: Scenario, options: Readonly<OptionsBot> = OPTIONS_BOT): ResultatBot {
  const r = essayerBot(R, contenu, { ...options, plafondTicks: undefined });
  return r!;
}

/** Les réglages essayés l'un après l'autre quand le résultat est médiocre (le poids de la largeur du sommet) : le premier est le réglage ordinaire. */
export const VARIANTES_BOT: readonly Readonly<OptionsBot>[] = [OPTIONS_BOT, { ...OPTIONS_BOT, largeurPct: 20 }, { ...OPTIONS_BOT, largeurPct: 100 }, { ...OPTIONS_BOT, largeurPct: 0 }];

export interface ResultatRobuste extends ResultatBot {
  /** Le rang de la variante qui a donné la preuve (0 : le réglage ordinaire). */
  variante: number;
  /** Le total de ticks de calcul de toutes les variantes essayées. */
  ticksTotal: number;
}

/**
 * Le Diamant d'un jour : si le réglage ordinaire donne moins de `SATISFAIT_MM` (une tour qui s'effondre dès les premières pièces), on essaie les variantes suivantes et on garde la meilleure
 * preuve (la première à égalité). **Le total est plafonné en ticks de calcul** (`BUDGET_TICKS`, pas en secondes : aucune horloge) pour rester sous les 90 s d'une journée sur un cœur.
 * `premier` : le résultat du réglage ordinaire s'il a déjà été calculé (le Web Worker le calcule en le montrant pièce par pièce).
 */
export function jouerBotRobuste(
  R: Rapier,
  contenu: Scenario,
  premier: ResultatBot = jouerBot(R, contenu, VARIANTES_BOT[0]!),
  /** Pour les tests seulement : un autre seuil de satisfaction et un autre budget de ticks. */
  limites: { satisfaitMm: number; budgetTicks: number } = { satisfaitMm: SATISFAIT_MM, budgetTicks: BUDGET_TICKS },
): ResultatRobuste {
  let meilleur: ResultatRobuste = { ...premier, variante: 0, ticksTotal: premier.compteurs.ticks };
  for (let v = 1; v < VARIANTES_BOT.length && meilleur.resultat.hauteurMm < limites.satisfaitMm; v++) {
    const reste = limites.budgetTicks - meilleur.ticksTotal;
    if (reste <= 0) break;
    const r = essayerBot(R, contenu, { ...VARIANTES_BOT[v]!, plafondTicks: reste });
    if (r === null) return { ...meilleur, ticksTotal: limites.budgetTicks }; // le budget est épuisé au milieu de cette variante : abandonnée, elle n'a pas de preuve
    const total = meilleur.ticksTotal + r.compteurs.ticks;
    meilleur = r.resultat.hauteurMm > meilleur.resultat.hauteurMm ? { ...r, variante: v, ticksTotal: total } : { ...meilleur, ticksTotal: total };
  }
  return meilleur;
}
