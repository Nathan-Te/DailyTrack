import { TICKS_PAR_SECONDE, TOUR, UNITE } from "./constantes";
import { div } from "./entiers";

// **Toutes les constantes de sensation de Pinball sont ICI, dans un seul objet** (lot PB1) : la pente, les rebonds, la force des batteurs et du lanceur, la bille sauvée. C'est ce que le `?debug&tune` du lot PB2 fera
// bouger en direct. Les valeurs sont celles de la maquette (`docs/pinball/maquettes/pinball-maquette-jouable.html`), en unités physiques ENTIÈRES : des pixels, des pixels par seconde, des millièmes (‰), des
// millièmes de radian. `deriver` les ramène aux unités de la simulation (point fixe, par pas) une fois par partie. **Changer une valeur par défaut change toute partie rejouée : on monte `PINBALL_SIM_VERSION`
// et on régénère le golden.** Une partie d'essai (`?debug&tune`) joue avec un autre objet : elle n'est jamais classée, le serveur ne connaît que `REGLAGES`.

export interface Reglages {
  /** La pente de la table, en px/s² (la maquette : 820). */
  pente: number;
  /** La vitesse maximale de la bille, en px/s (1 500 : à 600 pas par seconde, 2,5 px par pas). */
  vitesseMax: number;
  /** Les rebonds en ‰ (200 = 0,2 : la bille garde 20 % de sa vitesse normale). */
  rebondMur: number;
  rebondGuide: number;
  rebondFond: number;
  rebondPoteau: number;
  rebondBumper: number;
  rebondCible: number;
  /** Le rebond sur un batteur, relatif à sa surface en mouvement (300 : la maquette envoie la bille à 1,3 fois la vitesse relative). */
  rebondBatteur: number;
  /** Ce qu'un mur garde de la vitesse à chaque contact, en ‰ (995). */
  frottementMur: number;
  /** Les coups des bumpers (le trio, la paire) et du lance-pierre, en px/s ajoutés selon la normale ; le lance-pierre ne frappe qu'à plus de `seuilSling` px/s. */
  kickBumper: number;
  kickMini: number;
  kickSling: number;
  seuilSling: number;
  /** Les batteurs : l'angle de repos et l'angle levé (millièmes de radian, le batteur gauche ; le droit est son image), les vitesses (millièmes de radian par seconde) en montant et en descendant. */
  batteurRepos: number;
  batteurHaut: number;
  batteurVitesseHaut: number;
  batteurVitesseBas: number;
  /** Le lanceur : la vitesse de départ la plus faible et le supplément à pleine charge (px/s), la charge en ‰ par seconde (1 200 : pleine en 0,83 s). */
  lanceurBase: number;
  lanceurPlus: number;
  lanceurCharge: number;
  /** Le trou garde la bille `trouGarde` pas, puis la relance à `trouVitesse` px/s ; il ne reprend pas avant `trouPause` pas ; la bille ne tombe dedans qu'à moins de `trouVitesseMax` px/s. */
  trouGarde: number;
  trouVitesse: number;
  trouPause: number;
  trouVitesseMax: number;
  /** Bille sauvée : une bille perdue dans les `sauvee` premiers pas qui suivent son entrée en jeu revient au lanceur, une fois par bille. **0 = la fonction n'existe pas** (Nathan la tranchera en jouant). */
  sauvee: number;
  /** La chute d'une banque de cibles complète : elle se relève après `banqueRelevee` pas ; les lampes des couloirs du haut s'éteignent `voiesRelevees` pas après la troisième. */
  banqueRelevee: number;
  voiesRelevees: number;
  // --- Lot PB3 : les éléments des thèmes (valeurs de la maquette, en px, px/s, px/s², pas) et les buts des missions.
  /** Les Bulles (océan) : des bumpers plus doux (coups du trio et de la paire, px/s). */
  kickBulles: number;
  kickMiniBulles: number;
  /** Le manège : la poussée tangentielle au bord du plateau est `manegeVitesse × 96` px/s² (6 : la maquette). */
  manegeVitesse: number;
  /** Le tourbillon : l'attraction au centre (px/s²), la poussée en spirale (px/s²), la garde (pas) puis la pause avant de reprendre, la vitesse de la recrache (px/s). */
  tourbillonForce: number;
  tourbillonSpirale: number;
  tourbillonGarde: number;
  tourbillonPause: number;
  tourbillonVitesse: number;
  /** Le trou noir : sa force (px³/s² : l'attraction vaut `force / distance²` px/s², plafonnée à 1 400). */
  trouNoirForce: number;
  /** Les portails : la pause des deux après un passage (pas). */
  portailPause: number;
  /** Le geyser : la vitesse vers le haut (px/s), la pause entre deux jets (pas), la poussée de côté qui éloigne la bille (px/s) et le nombre de jets par bille (la garantie qu'il ne garde jamais la bille). */
  geyserVitesse: number;
  geyserPause: number;
  geyserDevie: number;
  geyserParBille: number;
  /** La coulée : l'accélération vers le haut d'une bille qui y monte (px/s², plus forte que la pente). */
  couleeForce: number;
  /** Les buts des quatre missions (tours de manège, plongées dans le tourbillon, passages par un portail, geysers). */
  butManege: number;
  butTourbillon: number;
  butPortail: number;
  butGeyser: number;
}

/** Les valeurs de la maquette (à régler au jeu : « Les sensations » du seed). */
export const REGLAGES: Reglages = {
  pente: 820,
  vitesseMax: 1500,
  rebondMur: 450,
  rebondGuide: 300,
  rebondFond: 100,
  rebondPoteau: 400,
  rebondBumper: 200,
  rebondCible: 400,
  rebondBatteur: 300,
  frottementMur: 995,
  kickBumper: 420,
  kickMini: 360,
  kickSling: 420,
  seuilSling: 60,
  batteurRepos: 520,
  batteurHaut: -420,
  batteurVitesseHaut: 24000,
  batteurVitesseBas: 13000,
  lanceurBase: 780,
  lanceurPlus: 520,
  lanceurCharge: 1200,
  trouGarde: 540,
  trouVitesse: 560,
  trouPause: 900,
  trouVitesseMax: 650,
  sauvee: 3000,
  banqueRelevee: 720,
  voiesRelevees: 360,
  kickBulles: 330,
  kickMiniBulles: 285,
  manegeVitesse: 6,
  tourbillonForce: 900,
  tourbillonSpirale: 700,
  tourbillonGarde: 540,
  tourbillonPause: 960,
  tourbillonVitesse: 560,
  trouNoirForce: 260000,
  portailPause: 480,
  geyserVitesse: 880,
  geyserPause: 420,
  geyserDevie: 90,
  geyserParBille: 8,
  couleeForce: 1500,
  butManege: 5,
  butTourbillon: 3,
  butPortail: 3,
  butGeyser: 4,
};

export const copierReglages = (r: Reglages = REGLAGES): Reglages => ({ ...r });

/** Les mêmes réglages dans les unités de la simulation : point fixe, par pas, angles en `TOUR`. */
export interface Derives {
  /** L'ajout de vitesse par pas (unités/s). */
  graviteParPas: number;
  vitesseMax: number;
  vitesseMax2: number;
  /** Les angles des batteurs et leurs écarts par pas, en seizièmes de millier de tour. */
  repos: number;
  haut: number;
  montee: number;
  descente: number;
  /** La charge du lanceur par pas, de 0 à 1 000. */
  chargeParPas: number;
  seuilSling: number;
  trouVitesseMax2: number;
  /** Les éléments des thèmes (lot PB3) : des accélérations en unités/s² (la partie en ajoute le six-centième à chaque pas), `couleeParPas` déjà par pas. */
  manegeAcc: number;
  tourbillonRadial: number;
  tourbillonTangent: number;
  couleeParPas: number;
}

/** Un angle de millièmes de radian en angle de la table (`TOUR` = 2π = 6 283 millièmes de radian, arrondi). */
const angle = (mrad: number): number => div(mrad * TOUR, 6283);

export function deriver(r: Reglages): Derives {
  const vmax = r.vitesseMax * UNITE;
  const tm = r.trouVitesseMax * UNITE;
  return {
    graviteParPas: div(r.pente * UNITE, TICKS_PAR_SECONDE),
    vitesseMax: vmax,
    vitesseMax2: vmax * vmax,
    repos: angle(r.batteurRepos),
    haut: angle(r.batteurHaut),
    montee: div(angle(r.batteurVitesseHaut), TICKS_PAR_SECONDE),
    descente: div(angle(r.batteurVitesseBas), TICKS_PAR_SECONDE),
    chargeParPas: div(r.lanceurCharge, TICKS_PAR_SECONDE),
    seuilSling: r.seuilSling * UNITE,
    trouVitesseMax2: tm * tm,
    manegeAcc: r.manegeVitesse * 96 * UNITE,
    tourbillonRadial: r.tourbillonForce * UNITE,
    tourbillonTangent: r.tourbillonSpirale * UNITE,
    couleeParPas: div(r.couleeForce * UNITE, TICKS_PAR_SECONDE),
  };
}

