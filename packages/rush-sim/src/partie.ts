import { Rng } from "@cdj/core";
import { AMELIORATIONS, NB_AMELIORATIONS, indiceAmelioration, tirageDeCartes } from "./ameliorations";
import { BOSS, B_BELIER, B_CHENE, B_DUC, B_GOLEM, B_REINE, BOND, CHARGE, ETOURDI, INVOCATION, MARCHE, ANNONCE, ONDE, PIERRES, PLONGEON_DUC, POING, RACINES_CERCLES, RACINES_LIGNES, RECUPERE, RUGIT, SPORES, Z_BANDE, Z_INVOCATION, Z_SPORES } from "./bosses";
import { C_BOND, C_TOURBILLON, COEURS, DUREE_TICKS, MAX_MONSTRES, MAX_MONSTRES_VAGUE, MAX_SBIRES, NB_COMPETENCES, RAYON_ARENE, RAYON_CHAUVE, RAYON_CHEVALIER, RAYON_GELEE, RAYON_GOLEM, cm } from "./constantes";
import { competenceDe, coupDe, directionDe, esquiveDe, viseeDe } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, distance2, idiv, isqrt, unitaire, dirVers, modDir } from "./maths";
import { PONT, RAYON_VASE, SOL, caseDe, type Niveau } from "./niveau";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";
import { COS, SIN } from "./trig";

// La partie de Rush : 60 Hz, tout en entiers, l'état d'un seul tenant. À chaque tick, `avancer(entree)` applique l'octet d'entrée du tick (voir `entrees.ts`) puis fait avancer le monde : le chevalier, les apparitions,
// les monstres, le golem, les zones annoncées, les ondes, les contacts. **Le même code joue la partie du joueur et la rediffusion du serveur** ; la vue (`apps/rush`) ne fait que lire cet état.
// Le hasard (apparitions, pierres) vient d'une graine du contenu et n'est tiré qu'à des ticks fixés par l'état : une rediffusion refait les mêmes tirages.
// Lot BR5 : un HACK & SLASH. La RAGE (une jauge qui monte aux coups, aux morts, aux vases et, très lentement, au temps) permet une COMPÉTENCE choisie au départ (tourbillon, bond écrasant, lancer de bouclier : `choisirCompetence`, un
// événement d'entrée de la rediffusion que le serveur valide) ; les GÉLATONS (meutes de petites gelées, un coup chacun) ; les VASES (groupes de petits cassables d'un coup, au contenu tiré de la graine) ; le COUP D'ÉLAN (frapper en pleine course fait une fente).
// Lot BR2 : l'XP et les AMÉLIORATIONS. Un monstre tué ou un obstacle brisé lâche une gemme d'XP (elle vole vers le chevalier dans le rayon d'aimant et ne disparaît jamais) ; chaque niveau gagné FIGE le monde (`avancer` ne fait plus rien, le chrono
// non plus : il compte les ticks) jusqu'à ce que le joueur choisisse une carte parmi trois (`choisir`, un événement d'entrée de la rediffusion que le serveur valide). Le tirage est celui de la graine du jour et du numéro du niveau (`ameliorations.ts`).
// Lot BR1b : la COURSE hors combat (la vitesse monte de ×1,6 après ~1,2 s sans frapper, sans être touché et sans ennemi alerté à moins de 10 m ; elle retombe au premier coup, à la première alerte, au premier dégât ; pas de course dans l'arène),
// des monstres à l'alerte propre (les groupes : 10 à 12 m) et des OBSTACLES cassables (ronces : 1 coup, caisses : 2 coups ; le coup final en vaut 2) qui occupent des cases du chemin tant qu'ils tiennent.
// Lot BR0c : le coup du chevalier est plus lent et plus lourd (30 ticks, le coup final 42 ; anticipation, impact, récupération ; dégâts ×1,6 et ×2,5 au coup final ; il s'engage à 40 % de sa vitesse ; recul plus fort, les monstres glissent puis titubent) ;
// les points de vie sont en dixièmes (un coup ordinaire ôte 16, la gelée en a 30). Lot BR0b : l'entrée porte une VISÉE séparée du déplacement (le chevalier regarde et frappe où il vise, il marche où il veut) ; un coup TENU enchaîne ; le rythme des ennemis est ralenti et se règle d'un coup (`reglages.rythme`).

// --- Les types lus par le rendu -------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const LIBRE = 0;
export const COUP = 1;
export const ESQUIVE = 2;
/** Lot BR5 : le chevalier lance sa compétence (`c.comp`, `c.t` ticks depuis le début). */
export const COMPETENCE = 3;
export const GELEE = 0;
export const CHAUVE = 1;
/** Lot BR5 : le gélaton — une petite gelée en meute (6 à 12), un coup chacun. */
export const GELATON = 2;
// La chauve-souris : tourne, s'annonce, plonge, se repose.
export const ORBITE = 0;
export const ANNONCE_PLONGEON = 1;
export const PLONGEON = 2;
export const REPOS = 3;
// Le boss (états, attaques, zones) : `bosses.ts`, réexportés ici.
export { ANNONCE, BOND, CHARGE, ETOURDI, INVOCATION, MARCHE, ONDE, PIERRES, PLONGEON_DUC, POING, RACINES_CERCLES, RACINES_LIGNES, RECUPERE, RUGIT, SPORES, Z_BANDE, Z_INVOCATION, Z_SPORES } from "./bosses";

export interface Chevalier {
  x: number;
  y: number;
  /** Où il regarde (0 à 127). */
  dir: number;
  coeurs: number;
  etat: number;
  /** Les ticks écoulés dans l'état (coup, esquive). */
  t: number;
  /** Le coup en cours ou le dernier (0 à 2). */
  combo: number;
  /** Les ticks restants de l'appui sur « coup » gardé en mémoire. */
  tampon: number;
  /** Les ticks restants de l'appui sur « esquive » gardé en mémoire. */
  tampEsq: number;
  /** Les ticks sans coup avant que l'enchaînement reparte du premier. */
  reprise: number;
  /** L'attente avant la prochaine esquive. */
  attente: number;
  /** L'invincibilité de l'esquive. */
  esq: number;
  /** L'invincibilité après un dégât. */
  degat: number;
  kx: number;
  ky: number;
  /** Il bouge à ce tick (pour l'animation). */
  marche: boolean;
  /** Lot BR1b : les ticks calmes (sans coup, sans dégât, sans ennemi alerté à moins de `courseRayon`), plafonnés à `courseDelai`. */
  calme: number;
  /** Lot BR1b : la montée de la course, de 0 (la marche) à `courseMontee` (la vitesse de course) ; il ne monte qu'en marchant. */
  elan: number;
  /** Lot BR2 : le nombre de cœurs au plus (3, et « Cœur en plus »). */
  coeursMax: number;
  /** Lot BR5 : la jauge de rage (0 à `rageMax`), la compétence choisie (−1 : pas encore choisie), sa direction, les ticks restants de l'appui gardé en mémoire, l'« écho » armé (la prochaine utilisation ne rend rien), la fente du coup d'élan (les ticks restants)
   * et, pour le bond, d'où il part et où il atterrit. */
  rage: number;
  comp: number;
  cDir: number;
  tampComp: number;
  echo: number;
  fente: number;
  bx: number;
  by: number;
  tx: number;
  ty: number;
}

export interface Monstre {
  id: number;
  type: number;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  /** Les ticks restants de l'éclair blanc. */
  flash: number;
  etat: number;
  t: number;
  /** Le tick d'apparition : l'animation d'entrée et la phase de saut en dépendent. */
  age: number;
  /** Chauve-souris : l'angle de l'orbite (0 à 127) et son sens (±1) ; gelée : inutilisés. */
  a: number;
  sens: number;
  /** La direction verrouillée (vecteur de 1 024) du saut ou du plongeon. */
  cx: number;
  cy: number;
  /** Les ticks restants d'étourdissement (après avoir blessé le chevalier). */
  gel: number;
  duree: number;
  /** Le dernier coup qui l'a touché : un coup ne touche qu'une fois. */
  coup: number;
  /** Lot BR1 : sa place (le camp), son état de veille — 0 au repos, 1 en alerte (il poursuit), 2 de retour — et sa laisse (unités autour de sa place ; 0 : il poursuit partout, comme dans les scénarios d'essai). */
  hx: number;
  hy: number;
  alerte: number;
  laisse: number;
  /** Lot BR1b : son rayon d'alerte propre en unités (un groupe : 10 à 12 m), ou 0 : celui de son type. */
  ra: number;
  /** Lot BR3 : 0, un monstre du niveau ; 1, un sbire invoqué par un boss (le vieux chêne) ; 2, une petite gelée née de la reine : ni l'un ni l'autre ne lâche d'XP. */
  sbire: number;
}

/** Lot BR5 : un vase (jarre, tonneau, petite caisse) : un coup le brise, un coup en arc ou une compétence en brise plusieurs. Plein jusqu'à ce qu'on le brise ; `tirage` (0 à 99) donne son contenu. */
export interface VaseVivant {
  /** Son indice dans `niveau.vases` (ou dans la liste du scénario). */
  id: number;
  genre: number;
  x: number;
  y: number;
  r: number;
  /** Le dernier coup qui l'a touché : un coup ne touche qu'une fois. */
  coup: number;
  tirage: number;
  groupe: number;
}

/** Lot BR2 : une gemme d'XP posée au sol (un octaèdre ambre), qui vaut `v` points. Aimantée (`vers`), elle vole vers le chevalier jusqu'à être ramassée. Lot BR5 : `k` dit ce qu'elle est — 0 une gemme d'XP, 1 de la rage (`v` points de jauge), 2 un cœur (elle attend au sol tant que le chevalier a tous ses cœurs). */
export const GEMME_XP = 0;
export const GEMME_RAGE = 1;
export const GEMME_COEUR = 2;
export interface Gemme {
  id: number;
  x: number;
  y: number;
  v: number;
  k: number;
  vers: boolean;
  /** Le tick où elle est tombée (l'animation d'apparition). */
  age: number;
}

/** Lot BR2 : le choix en attente, au niveau `nv` gagné : trois cartes (des indices du catalogue). */
export interface ChoixOuvert {
  nv: number;
  cartes: number[];
}

/** Lot BR2 : l'onde de l'épée (« Onde d'épée » : le 3ᵉ coup la lance) : une courte lame qui file droit et blesse une fois chaque cible. */
export interface OndeEpee {
  x: number;
  y: number;
  dir: number;
  /** La distance parcourue (unités) et la portée. */
  d: number;
  portee: number;
  degats: number;
  /** Ce qu'elle a déjà touché : monstres (identifiants), obstacles (−1 − indice), le golem (0). */
  touches: number[];
}

/** Lot BR5 : le bouclier lancé : il part du chevalier, traverse jusqu'à `bouclierCibles` ennemis (les vases ne comptent pas), puis revient en blessant ce qu'il croise. */
export interface Bouclier {
  x: number;
  y: number;
  /** Où il est parti (unités), sa direction (0 à 127) et la distance parcourue à l'aller. */
  ox: number;
  oy: number;
  dir: number;
  d: number;
  portee: number;
  /** 0 à l'aller, 1 au retour. */
  etat: number;
  /** Combien d'ennemis il a traversés, ceux qu'il a touchés à l'aller et au retour (identifiants ; le boss : 0). */
  cibles: number;
  maxCibles: number;
  touches: number[];
  retour: number[];
  degats: number;
  age: number;
}

export interface Golem {
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  phase: number;
  etat: number;
  t: number;
  /** La durée de l'annonce (pour la fraction qui avance). Avec deux coups (phase 2 : deux poings, deux ondes) elle les compte tous les deux. */
  duree: number;
  /** Le tick (depuis le début de l'annonce) du premier impact : `duree` pour une seule frappe. */
  t1: number;
  attaque: number;
  /** Les ticks de marche avant la prochaine attaque. */
  repos: number;
  compteur: number;
  flash: number;
  dir: number;
  /** Les ticks restants de la récupération après une attaque (pour l'animation). */
  recup: number;
  /** Le dernier coup qui l'a touché. */
  coup: number;
  /** Lot BR3 : lequel des cinq boss (`BOSS`), le rayon de son corps, s'il est au sol (le grand-duc en vol ne l'est pas : il encaisse peu, rien ne le pousse), le nombre de divisions déjà faites (la reine), l'angle de son vol (le grand-duc),
   * la fin de sa dernière course (point et tick : le grand-duc et le bélier) et si la charge en cours finit contre le muret (le bélier). */
  kind: number;
  r: number;
  sol: number;
  div: number;
  a: number;
  ex: number;
  ey: number;
  ft: number;
  mur: number;
}

/** Un cercle rouge au sol : il frappe à `ti`. Lot BR3 : une BANDE (`Z_BANDE`) est un segment large de (x, y) à (x2, y2), `r` sa demi-largeur ; `dash` est la durée de la course du boss qui la parcourt (la fin de la bande, `ti`, est son arrivée). */
export interface Zone {
  type: number;
  x: number;
  y: number;
  r: number;
  t0: number;
  ti: number;
  /** 0 pour le premier coup d'une attaque, 1 pour le second (phase 2). */
  rang: number;
  x2: number;
  y2: number;
  dash: number;
}
/** Lot BR3 : un nuage de spores du vieux chêne, au sol jusqu'à `fin` : qui y reste perd un cœur (puis l'invincibilité des dégâts). */
export interface Nuage {
  x: number;
  y: number;
  r: number;
  t0: number;
  fin: number;
}
/** Une onde du golem : un anneau qui s'élargit depuis son centre. */
export interface OndeGolem {
  x: number;
  y: number;
  r: number;
  vitesse: number;
  epaisseur: number;
  rMax: number;
  touche: boolean;
}

export type GenreEvenement = "competence" | "pulsation" | "atterrissage" | "bouclier" | "bouclierRetour" | "bouclierTouche" | "elan" | "rage" | "division" | "choc" | "nuage" | "invoque" | "gemme" | "ramasse" | "niveau" | "carte" | "ondeEpee" | "tranchant" | "soin" | "moulinet" | "coup" | "touche" | "mort" | "esquive" | "frole" | "degats" | "annonce" | "impact" | "onde" | "phase2" | "victoire" | "defaite" | "apparition" | "bloque" | "sauve" | "alerte" | "barriere" | "eveil" | "brise";
/** Ce que le rendu doit savoir d'un tick (sons, éclats, secousse) : jamais lu par la simulation. */
export interface Evenement {
  k: GenreEvenement;
  tick: number;
  x: number;
  y: number;
  /** Selon le genre : le coup (0 à 2), les dégâts, le type de la cible… */
  a: number;
  b: number;
}

export interface Resultat {
  victoire: boolean;
  /** Le tick de la chute du golem (ou de la fin de la partie perdue). */
  ticks: number;
  coeurs: number;
  tues: number;
  /** Les dégâts reçus. */
  subis: number;
  /** Lot BR2 : le niveau atteint et l'XP ramassée. */
  nv: number;
  xp: number;
}

// --- Les constantes des règles --------------------------------------------------------------------------------------------------------------------------------------------------------------------
const DUREE_ESQUIVE = 12;
const ATTENTE_ESQUIVE = 40;
const DUREE_TAMPON = 16;
const DUREE_TAMPON_ESQUIVE = 6;
const DUREE_REPRISE = 30;
/** La phase active d'un coup (ticks après l'impact) : le chevalier s'engage tant qu'elle dure. */
const PHASE_ACTIVE = 4;
/** Les ticks où une cible touchée titube (elle ne fait rien) après avoir glissé : le coup ordinaire, le coup final. */
const TITUBE = [16, 16, 32] as const;
/** Le dégât de base (un « point » du jeu) : un coup ordinaire en ôte `degats` % (160 % → 16). */
const POINT = 10;
const RAYON_ZONE_POING = cm(250);
const RAYON_ZONE_PIERRE = cm(150);
const RAYON_ONDE = cm(760);
const VIE_GELEE = 30;
const VIE_CHAUVE = 10;
/** Lot BR5 : le gélaton meurt en un coup (un coup ordinaire en ôte 16). */
const VIE_GELATON = 10;
const RAYON_GELATON = cm(30);
/** Le scénario `mannequin` : six gelées qui ne bougent pas (positions en cm, chacune rentre chez elle après un coup) et un golem qui ne frappe pas ; rien ne meurt. */
const MANNEQUINS: readonly (readonly [number, number])[] = [[-330, 330], [-170, 250], [0, 210], [170, 250], [330, 330], [0, 60]];
const GOLEM_MANNEQUIN: readonly [number, number] = [0, -450];
const ARRET_DEGAT = 90;

// Le rythme des ennemis (lot BR0b : le prototype BR0 était trop rapide). Toutes ces durées sont des ticks et toutes ces vitesses des cm/s AU RYTHME 100 % ; `reglages.rythme` les met à l'échelle (`dur`, `vit`).
/** L'annonce de chaque attaque du golem (phase 1, phase 2), second coup compris ; le second poing est posé à l'impact du premier. */
const ANNONCE_GOLEM: readonly [number, number] = [70, 50];
/** La récupération après chaque attaque, sans frapper : la fenêtre pour taper. */
const RECUP_GOLEM = { [POING]: [90, 60], [ONDE]: [100, 65], [PIERRES]: [80, 55] } as const;
/** Les deux ondes de la phase 2 sont séparées de ce nombre de ticks (assez pour refaire une esquive). */
const ECART_ONDES = 70;
const ECART_PIERRES = 12;

// --- Lot BR3 : les quatre autres boss. Durées en ticks et vitesses en cm/s AU RYTHME 100 % (comme celles du golem) ; rayons en unités. ---
/** La récupération après chaque attaque (indice = l'attaque de `bosses.ts`), phase 1 et phase 2 : la fenêtre pour taper. Jamais moins de 80 et 55 (golem : 90 / 60 au poing). */
const RECUP_BOSS: readonly (readonly [number, number])[] = [[90, 60], [100, 65], [80, 55], [90, 60], [100, 70], [90, 60], [90, 60], [90, 60], [90, 60], [100, 65]];
/** La reine gelée : son bond écrasant (rayon du cercle), son élan (les ticks avant l'impact où elle saute), sa marche, ses divisions (‰ de vie : un quart, la moitié = la phase 2, puis tous les huitièmes) et leurs petites gelées. */
const REINE_ZONE = cm(330);
const REINE_ELAN = 24;
const REINE_VITESSE: readonly [number, number] = [90, 130];
const REINE_SEUILS: readonly number[] = [750, 500, 375, 250, 125];
const REINE_PETITES = 3;
const VIE_PETITE = 10;
/** Le grand-duc : la demi-largeur de sa bande, sa vitesse de plongeon, ce dont il dépasse le chevalier, le vol (son orbite autour du centre de l'arène : rayon, vitesse), le transit entre deux plongeons (ticks) et ce qu'il encaisse en vol (%). */
const DUC_BANDE = cm(130);
const DUC_VITESSE_PLONGEON = 2200;
const DUC_DEPASSE = cm(450);
const DUC_ORBITE = cm(600);
const DUC_VITESSE = 260;
const DUC_TRANSIT = 20;
const DUC_EN_VOL = 25;
/** Le bélier : la demi-largeur de sa ligne, sa vitesse de charge, ce dont il dépasse le chevalier (il ne touche le muret que si celui-ci est derrière le chevalier, à cette distance), sa marche, son étourdissement contre le muret (120 ticks). */
const BELIER_BANDE = cm(170);
const BELIER_VITESSE_CHARGE = 1800;
const BELIER_DEPASSE = cm(500);
const BELIER_VITESSE: readonly [number, number] = [120, 160];
const BELIER_ETOURDI = 120;
const BELIER_ECLATS = 3;
/** Le vieux chêne : sa suite d'attaques par phase, la demi-largeur et la longueur d'une racine, le rayon d'un cercle de racines, le rayon des spores par phase et leur durée au sol (ticks). */
const SUITE_CHENE: readonly (readonly number[])[] = [[RACINES_LIGNES, SPORES, INVOCATION, RACINES_CERCLES], [RACINES_LIGNES, SPORES, RACINES_CERCLES, INVOCATION, SPORES]];
const CHENE_BANDE = cm(110);
const CHENE_LONGUEUR = cm(1300);
const CHENE_CERCLE = cm(190);
const CHENE_SPORES: readonly [number, number] = [cm(300), cm(400)];
const SPORES_DUREE = 270;
const ECART_CERCLES = 14;
/** Lot BR5 : le gélaton s'écrase moins longtemps (22), bondit (14) plus vite (4,2 m/s) et se repose (6) : une meute se jette sur le chevalier ; il ne blesse que pendant son bond. */
const GELATON_ANNONCE = 22;
const GELATON_BOND = 14;
const GELATON_REPOS = 6;
const GELATON_VITESSE = 420;
const GELATON_VERROU = 4;
/** Une meute s'alerte d'un seul mouvement : les gélatons au repos à ce rayon (cm) du premier alerté le suivent. */
const RAYON_MEUTE = cm(700);
/** La gelée s'écrase (annonce) puis bondit puis se repose. */
const GELEE_ANNONCE = 30;
const GELEE_BOND = 24;
const GELEE_REPOS = 10;
const GELEE_VITESSE = 336;
/** La direction du bond est verrouillée un peu avant qu'il parte : on a le temps de se décaler. */
const GELEE_VERROU = 6;
/** La chauve-souris tourne, s'annonce (45), plonge (34), se repose (60). */
const CHAUVE_ANNONCE = 45;
const CHAUVE_PLONGEON = 34;
const CHAUVE_REPOS = 60;
const CHAUVE_VITESSE = 392;
const CHAUVE_VITESSE_PLONGEON = 805;
/** Lot BR1 : un monstre du niveau remarque le chevalier à ce rayon (autour de lui) ; il le lâche quand il s'est éloigné de sa place de `LAISSE` ou que le chevalier est à deux fois le rayon d'alerte. */
export const ALERTE_GELEE = cm(700);
export const ALERTE_CHAUVE = cm(1000);
export const LAISSE = cm(2000);
/** Le chevalier est dans l'arène (la barrière se referme derrière lui) quand il est à cette distance du bord. */
const ENTREE_ARENE = cm(200);
/** Une vague d'arène : la pause avant la suivante quand le terrain est presque vide. */
const PAUSE_VAGUE = 180;
/** Le moment de la partie figée de la vitrine (le chrono de `cible-ia.png`). */
const TICK_VITRINE = 1306;

// Lot BR2 : les indices des améliorations dans le catalogue.
const A_LOURDE = indiceAmelioration("lame-lourde");
const A_ALLONGE = indiceAmelioration("allonge");
const A_CADENCE = indiceAmelioration("cadence");
const A_TOURBILLON = indiceAmelioration("moulinet");
const A_ONDE = indiceAmelioration("onde-epee");
const A_BOTTES = indiceAmelioration("bottes-legeres");
const A_LONGUE = indiceAmelioration("esquive-longue");
const A_VIVE = indiceAmelioration("esquive-vive");
const A_TRANCHANTE = indiceAmelioration("esquive-tranchante");
const A_COEUR = indiceAmelioration("coeur-en-plus");
const A_SOIN = indiceAmelioration("soin");
const A_VOL = indiceAmelioration("vol-de-vie");
const A_BRISE = indiceAmelioration("brise-pierre");
const A_AIMANT = indiceAmelioration("aimant");
const A_RAGE_VIVE = indiceAmelioration("rage-vive");
const A_MAITRISE = indiceAmelioration("maitrise");
const A_ECHO = indiceAmelioration("echo");
const A_SIGNATURE = indiceAmelioration("signature");
/** Une gemme est ramassée à cette distance du chevalier (bord à bord) ; aimantée, elle vole à cette vitesse (cm/s, plus vite que la pleine course même avec les bottes). */
const RAMASSE = cm(70);
const VITESSE_GEMME = 1300;
/** L'onde d'épée file à cette vitesse (cm/s) ; elle touche à cette distance (cm) de son centre. */
const VITESSE_ONDE_EPEE = 1500;
const LARGEUR_ONDE_EPEE = cm(70);

// --- Lot BR5 : les compétences. ---
const DUREE_TAMPON_COMP = 6;
/** Le tourbillon frappe tout autour toutes les 12 ticks (la première passe à 6). */
const PAS_TOURBILLON = 12;
const DEBUT_TOURBILLON = 6;
/** Le bond : s'accroupir (annonce du cercle d'atterrissage), voler, se relever. */
export const BOND_ANNONCE = 8;
export const BOND_VOL = 20;
const BOND_RECUP = 10;
/** Le bouclier : le geste (il part au 5ᵉ tick) et la fin du geste. */
const BOUCLIER_LANCE = 5;
const BOUCLIER_FIN = 14;
const VITESSE_BOUCLIER = 1500;
const LARGEUR_BOUCLIER = cm(60);
/** Le bouclier revient avec ce % de ses dégâts aux ennemis qu'il n'avait pas touchés à l'aller. */
const RETOUR_BOUCLIER = 60;
/** Le rayon (cm) où un ennemi touché par un effet de zone (tourbillon, bond) compte : de bord à bord. */
const FENTE_PLUS = 2;

const carre = (n: number): number => n * n;
const rayonDe = (type: number): number => (type === GELEE ? RAYON_GELEE : type === GELATON ? RAYON_GELATON : RAYON_CHAUVE);
const viePar = (type: number): number => (type === GELEE ? VIE_GELEE : type === GELATON ? VIE_GELATON : VIE_CHAUVE);

/** Les durées des ennemis, mises au rythme de la partie : ce que le rendu lit pour animer (jamais lu par la simulation autrement). */
export interface Durees {
  gelatonAnnonce: number;
  gelatonBond: number;
  gelatonCycle: number;
  geleeAnnonce: number;
  geleeBond: number;
  geleeCycle: number;
  chauveAnnonce: number;
  chauvePlongeon: number;
}

export class Partie {
  tick = 0;
  readonly c: Chevalier;
  monstres: Monstre[] = [];
  readonly golem: Golem | null;
  zones: Zone[] = [];
  ondes: OndeGolem[] = [];
  /** Lot BR3 : les nuages de spores au sol. */
  nuages: Nuage[] = [];
  /** Le coup en cours (numéro croissant). */
  coupId = 0;
  tues = 0;
  subis = 0;
  victoire = false;
  perdue = false;
  /** Les événements du tick courant et des précédents, tant que le rendu ne les a pas pris (`journal` vrai). */
  evenements: Evenement[] = [];
  /** Les sandboxes ne meurent pas : le chevalier retrouve ses cœurs. */
  readonly immortel: boolean;
  private readonly rng: Rng;
  private prochainId = 1;
  private entreePrecedente = 0;
  private vague = 0;
  private finTick = -1;
  /** La vitesse de marche du chevalier, en unités par tick (celle des réglages, puis « Bottes légères »). */
  private vit: number;
  private readonly vitBase: number;
  /** Lot BR2 : l'XP ramassée, le niveau (1 au départ), les gemmes au sol, les ondes d'épée, le choix en attente (`null` : le monde tourne) et les paliers pris de chaque amélioration (indices du catalogue). */
  xp = 0;
  nv = 1;
  gemmes: Gemme[] = [];
  ondesEpee: OndeEpee[] = [];
  choix: ChoixOuvert | null = null;
  readonly paliers: number[] = new Array<number>(NB_AMELIORATIONS).fill(0);
  private prochaineGemme = 1;
  /** Le rythme des ennemis, en %. */
  private readonly rt: number;
  /** Les durées des ennemis, au rythme de la partie. */
  readonly durees: Durees;
  /** Les ticks depuis que l'arène s'est presque vidée (−1 : elle ne l'est pas) : la pause entre deux vagues. */
  private videDepuis = -1;
  /** Lot BR1 : le niveau du jour (grille), le centre de l'arène, le tick où la barrière s'est refermée (−1 : ouverte) et les cases de la porte. */
  readonly niveau: Niveau | null;
  /** Lot BR5 : les vases du niveau (ceux qu'on a brisés sont retirés), les boucliers lancés, la compétence à choisir avant de partir (`jour` seulement : le chrono ne démarre pas) et les gains de rage coupés pendant les coups d'une compétence. */
  vases: VaseVivant[] = [];
  boucliers: Bouclier[] = [];
  attenteDepart = false;
  private sansRage = false;
  private prochainVase = 0;
  /** Les scénarios d'essai (hors `jour`) remplissent la jauge vite : de quoi juger une compétence à froid. */
  private readonly rageRapide: boolean;
  readonly ax: number;
  readonly ay: number;
  barriere = -1;
  private readonly porte: ReadonlySet<number>;

  constructor(
    readonly contenu: Contenu,
    readonly reglages: Reglages = REGLAGES_DEFAUT,
    readonly journal = false,
  ) {
    this.rng = new Rng(contenu.graine);
    this.niveau = contenu.niveau;
    this.ax = this.niveau ? this.niveau.arene.x : 0;
    this.ay = this.niveau ? this.niveau.arene.y : 0;
    this.porte = new Set(this.niveau ? this.niveau.porte : []);
    this.vitBase = idiv(cm(reglages.vitesse), 60);
    this.vit = this.vitBase;
    this.rt = reglages.rythme;
    this.durees = { gelatonAnnonce: this.dur(GELATON_ANNONCE), gelatonBond: this.dur(GELATON_BOND), gelatonCycle: this.dur(GELATON_ANNONCE) + this.dur(GELATON_BOND) + this.dur(GELATON_REPOS), geleeAnnonce: this.dur(GELEE_ANNONCE), geleeBond: this.dur(GELEE_BOND), geleeCycle: this.dur(GELEE_ANNONCE) + this.dur(GELEE_BOND) + this.dur(GELEE_REPOS), chauveAnnonce: this.dur(CHAUVE_ANNONCE), chauvePlongeon: this.dur(CHAUVE_PLONGEON) };
    this.immortel = contenu.scenario === "arene" || contenu.scenario === "vitrine" || contenu.scenario === "mannequin" || contenu.scenario === "bestiaire" || contenu.scenario === "horde";
    this.rageRapide = contenu.scenario !== "jour" && contenu.scenario !== "cartes";
    this.attenteDepart = contenu.scenario === "jour" && contenu.competence < 0;
    this.c = { x: this.niveau ? this.niveau.depart.x : 0, y: this.niveau ? this.niveau.depart.y : cm(520), dir: this.niveau ? this.niveau.depart.dir : 96, coeurs: COEURS, etat: LIBRE, t: 0, combo: 0, tampon: 0, tampEsq: 0, reprise: 0, attente: 0, esq: 0, degat: 0, kx: 0, ky: 0, marche: false, calme: 0, elan: 0, coeursMax: COEURS, rage: this.rageRapide ? reglages.rageMax : 0, comp: contenu.competence >= 0 ? contenu.competence : this.attenteDepart ? -1 : 0, cDir: 0, tampComp: 0, echo: 0, fente: 0, bx: 0, by: 0, tx: 0, ty: 0 };
    if (contenu.scenario === "arene" || contenu.scenario === "bestiaire" || contenu.scenario === "horde") this.golem = null;
    else {
      // Lot BR3 : le boss du jour (le golem pour les scénarios d'essai qui n'en demandent pas un autre) ; ses points de vie sont un % de ceux du golem.
      const kind = contenu.boss;
      const hpMax = idiv(reglages.golemVie * BOSS[kind]!.vie, 100);
      const [gx, gy] = contenu.scenario === "mannequin" ? GOLEM_MANNEQUIN : [0, -300];
      // Dans le niveau, le boss dort au fond de l'arène, du côté opposé à l'entrée.
      const n = this.niveau;
      const px = n ? n.arene.x - idiv(COS[n.arene.dir]! * cm(300), 1024) : cm(gx);
      const py = n ? n.arene.y - idiv(SIN[n.arene.dir]! * cm(300), 1024) : cm(gy);
      const phase2 = contenu.phase2;
      this.golem = { x: px, y: py, hp: phase2 ? idiv(hpMax, 2) : hpMax, hpMax, phase: phase2 ? 2 : 1, etat: MARCHE, t: 0, duree: 0, t1: 0, attaque: 0, repos: this.dur(phase2 ? 50 : 150), compteur: 0, flash: 0, dir: n ? n.arene.dir : 32, recup: 0, coup: 0, kind, r: BOSS[kind]!.rayon, sol: kind === B_DUC && !n ? 0 : 1, div: phase2 ? 2 : 0, a: dirVers(px - this.ax, py - this.ay), ex: px, ey: py, ft: 0, mur: 0 };
    }
    if (contenu.scenario === "arene") {
      this.apparaitre(contenu.monstres > 0 ? Math.min(contenu.monstres, 6) : 4);
      this.vague = 1;
    }
    if (contenu.scenario === "horde") this.monterHorde();
    if (this.niveau) this.monterNiveau(this.niveau);
    // Lot BR2 : les améliorations d'un scénario d'essai, puis (`?scenario=cartes`) le choix ouvert tout de suite au niveau demandé.
    for (const id of contenu.ameliorations) this.prendre(indiceAmelioration(id), false);
    if (contenu.scenario === "cartes" && this.niveau) {
      this.nv = contenu.nv - 1;
      this.xp = this.xpSeuil(contenu.nv);
      this.verifierNiveau();
    }
    if (contenu.scenario === "vitrine") this.monterVitrine();
    if (contenu.scenario === "mannequin") this.monterMannequin();
  }

  /** La compétence est choisie au départ (`jour`) : un événement d'entrée de la rediffusion, validé par le serveur. Refusé (rend `false`, rien ne change) quand aucun choix n'est attendu ou que l'index n'est pas celui d'une compétence. */
  choisirCompetence(index: number): boolean {
    if (!this.attenteDepart || !Number.isInteger(index) || index < 0 || index >= NB_COMPETENCES) return false;
    this.attenteDepart = false;
    this.c.comp = index;
    return true;
  }

  /** Une durée en ticks au rythme de la partie (arrondie, au moins 1) : plus le rythme est haut, plus c'est court. */
  dur(n: number): number {
    return Math.max(1, idiv(n * 100 + idiv(this.rt, 2), this.rt));
  }
  /** Une vitesse en cm/s → unités par tick au rythme de la partie. */
  private vitesse(cmParSeconde: number): number {
    return idiv(cm(cmParSeconde) * this.rt, 6000);
  }

  /** Les monstres du niveau : chacun à sa place, au repos, avec sa laisse. */
  private monterNiveau(n: Niveau): void {
    for (const m of n.monstres) {
      this.monstres.push({ id: this.prochainId++, type: m.type, x: m.x, y: m.y, kx: 0, ky: 0, hp: viePar(m.type), flash: 0, etat: ORBITE, t: 0, age: -100, a: this.rng.int(128), sens: this.rng.int(2) === 0 ? 1 : -1, cx: 0, cy: 0, gel: 0, duree: 120 + this.rng.int(120), coup: 0, hx: m.x, hy: m.y, alerte: 0, laisse: LAISSE, ra: m.alerte, sbire: 0 });
    }
    for (const v of n.vases) this.vases.push({ id: this.prochainVase++, genre: v.genre, x: v.x, y: v.y, r: RAYON_VASE[v.genre]!, coup: 0, tirage: v.tirage, groupe: v.groupe });
  }

  /** Le golem dort tant que la barrière de l'arène est ouverte. */
  get golemEveille(): boolean {
    return !this.niveau || this.barriere >= 0;
  }

  /** La scène figée de la vitrine : la composition de `docs/rush/maquettes/cible-ia.png` (le golem au centre avec un cercle d'annonce, le chevalier à gauche, quatre gelées, deux chauves-souris). Le jeu ne la fait pas avancer. */
  private monterVitrine(): void {
    this.tick = TICK_VITRINE;
    const g = this.golem!;
    g.x = cm(60);
    g.y = -cm(150);
    g.hp = idiv(g.hpMax * 3, 5);
    g.etat = ANNONCE;
    g.attaque = POING;
    g.duree = g.t1 = this.dur(ANNONCE_GOLEM[0]);
    g.t = g.duree + 1; // le poing vient de s'abattre (le golem de la cible a les poings au sol) ; le cercle, lui, est annoncé aux trois cinquièmes
    g.dir = 32;
    this.zones.push({ type: POING, x: cm(60), y: cm(50), r: RAYON_ZONE_POING, t0: this.tick - idiv(g.duree * 6, 10), ti: this.tick + g.duree - idiv(g.duree * 6, 10), rang: 0, x2: 0, y2: 0, dash: 0 });
    this.c.x = -cm(400);
    this.c.y = cm(250);
    this.c.dir = 52; // il regarde vers le bas à gauche, l'épée devant lui : son visage se voit
    this.c.marche = true;
    this.monstres = [];
    const bete = (type: number, x: number, y: number, t: number, a = 0): void => {
      this.monstres.push({ id: this.prochainId++, type, x: cm(x), y: cm(y), kx: 0, ky: 0, hp: type === GELEE ? VIE_GELEE : VIE_CHAUVE, flash: 0, etat: ORBITE, t, age: 0, a, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0, hx: cm(x), hy: cm(y), alerte: 1, laisse: 0, ra: 0, sbire: 0 });
    };
    bete(GELEE, -140, -520, 12);
    bete(GELEE, -560, 330, 40);
    bete(GELEE, 700, 20, 3);
    bete(GELEE, 480, 560, 33);
    bete(CHAUVE, -490, -300, 0, 20);
    bete(CHAUVE, 770, -270, 0, 90);
  }

  /** Le scénario `mannequin` (lot BR0c) : le chevalier face à six gelées immobiles et à un golem qui ne frappe pas, pour juger le coup, l'impact et l'enchaînement tenu. Rien ne meurt, rien ne blesse. */
  private monterMannequin(): void {
    this.c.y = cm(520);
    this.c.dir = 96;
    for (const [x, y] of MANNEQUINS) this.monstres.push({ id: this.prochainId++, type: GELEE, x: cm(x), y: cm(y), kx: 0, ky: 0, hp: VIE_GELEE, flash: 0, etat: ORBITE, t: 0, age: -100, a: 0, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0, hx: cm(x), hy: cm(y), alerte: 1, laisse: 0, ra: 0, sbire: 0 });
  }

  get finie(): boolean {
    return this.victoire || this.perdue || this.tick >= DUREE_TICKS;
  }

  resultat(): Resultat {
    return { victoire: this.victoire, ticks: this.finTick >= 0 ? this.finTick : this.tick, coeurs: this.c.coeurs, tues: this.tues, subis: this.subis, nv: this.nv, xp: this.xp };
  }

  /** L'empreinte de tout l'état (FNV-1a 32 bits sur ses entiers) : deux parties identiques ont la même à chaque tick. Les essais de déterminisme (Node, trois navigateurs) la comparent. */
  empreinte(): string {
    let h = 0x811c9dc5;
    const nombre = (n: number): void => {
      for (let i = 0; i < 4; i++) h = Math.imul(h ^ ((n >>> (8 * i)) & 0xff), 0x01000193) >>> 0;
    };
    const objet = (o: object | null): void => {
      if (o === null) return nombre(0xdead);
      for (const v of Object.values(o)) nombre(typeof v === "boolean" ? (v ? 1 : 0) : (v as number));
    };
    nombre(this.tick);
    nombre(this.tues);
    nombre(this.subis);
    nombre(this.coupId);
    nombre(this.barriere);
    nombre(this.xp);
    nombre(this.nv);
    nombre(this.choix ? this.choix.nv : 0);
    for (const n of this.paliers) nombre(n);
    for (const g of this.gemmes) objet(g);
    for (const o of this.ondesEpee) {
      nombre(o.x);
      nombre(o.y);
      nombre(o.d);
    }
    objet(this.c);
    objet(this.golem);
    for (const m of this.monstres) objet(m);
    for (const z of this.zones) objet(z);
    for (const o of this.ondes) objet(o);
    for (const n of this.nuages) objet(n);
    for (const v of this.vases) {
      nombre(v.id);
      nombre(v.coup);
    }
    for (const b of this.boucliers) {
      nombre(b.x);
      nombre(b.y);
      nombre(b.d);
      nombre(b.etat);
      nombre(b.cibles);
    }
    return h.toString(16).padStart(8, "0");
  }

  /** Le rendu a lu les événements. */
  vider(): void {
    this.evenements.length = 0;
  }

  private ev(k: GenreEvenement, x: number, y: number, a = 0, b = 0): void {
    if (this.journal) this.evenements.push({ k, tick: this.tick, x, y, a, b });
  }

  // --- Un tick -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  avancer(entree: number): void {
    if (this.finie || this.choix || this.attenteDepart) return; // lot BR2 : un niveau gagné fige le monde jusqu'au choix ; lot BR5 : la compétence se choisit avant de partir
    this.tick++;
    const front = (bit: boolean, avant: boolean): boolean => bit && !avant;
    const coupFront = front(coupDe(entree), coupDe(this.entreePrecedente));
    const esquiveFront = front(esquiveDe(entree), esquiveDe(this.entreePrecedente));
    const compFront = front(competenceDe(entree), competenceDe(this.entreePrecedente));
    this.entreePrecedente = entree;
    this.mouvementChevalier(directionDe(entree), viseeDe(entree), coupFront, coupDe(entree), esquiveFront, compFront);
    if (this.tick % 60 === 0) this.gagnerRage(this.rageRapide ? idiv(this.reglages.rageMax, 6) : this.reglages.rageTemps);
    if (this.niveau && this.barriere < 0 && distance(this.c.x, this.c.y, this.ax, this.ay) < RAYON_ARENE - ENTREE_ARENE) this.fermerBarriere();
    this.apparitions();
    for (const m of this.monstres) this.mouvementMonstre(m);
    this.separer();
    if (this.golem && this.golemEveille) this.mouvementGolem(this.golem);
    this.resoudreZones();
    this.avancerOndes();
    this.majNuages();
    this.contacts();
    this.avancerOndesEpee();
    this.avancerBoucliers();
    this.ramasser();
    this.monstres = this.monstres.filter((m) => m.hp > 0);
    if (this.golem && this.golem.hp <= 0 && !this.victoire) this.gagner();
    if (!this.finie) this.verifierNiveau();
  }

  /** Le chevalier entre dans l'arène : la barrière se referme derrière lui et le golem se réveille (il rugit, invulnérable, un instant). */
  private fermerBarriere(): void {
    const n = this.niveau!;
    this.barriere = this.tick;
    this.ev("barriere", n.arene.ex, n.arene.ey);
    const g = this.golem;
    if (g && g.hp > 0) {
      g.etat = RUGIT;
      g.t = 0;
      g.duree = this.dur(60);
      this.ev("eveil", g.x, g.y);
    }
  }

  // --- Le chevalier ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private mouvementChevalier(direction: number, visee: number, coupFront: boolean, coupTenu: boolean, esquiveFront: boolean, compFront = false): void {
    const c = this.c;
    if (c.tampon > 0) c.tampon--;
    // Un appui est gardé en mémoire ; un coup TENU l'est à chaque tick : il enchaîne les trois coups en boucle, à la cadence du combo.
    if (coupFront || coupTenu) c.tampon = DUREE_TAMPON;
    if (c.tampEsq > 0) c.tampEsq--;
    if (esquiveFront) c.tampEsq = DUREE_TAMPON_ESQUIVE;
    if (c.tampComp > 0) c.tampComp--;
    if (compFront) c.tampComp = DUREE_TAMPON_COMP;
    if (c.attente > 0) c.attente--;
    if (c.esq > 0) c.esq--;
    if (c.degat > 0) c.degat--;
    if (c.reprise > 0 && --c.reprise === 0 && c.etat === LIBRE) c.combo = 0;
    c.marche = false;
    this.majCourse(direction >= 0 && c.etat === LIBRE);

    // L'esquive coupe un coup à n'importe quel moment (survivre passe avant) ; un appui un peu trop tôt est gardé en mémoire.
    const dureeCoup = this.dureeCoup(c.combo);
    if (c.tampEsq > 0 && c.attente === 0 && c.etat !== ESQUIVE && !this.bondEnVol()) {
      c.tampEsq = 0;
      // L'esquive part dans la direction du déplacement ; à l'arrêt, vers la visée ; sinon où le chevalier regarde.
      const d = direction >= 0 ? direction * 4 : visee >= 0 ? visee * 4 : c.dir;
      c.dir = d;
      c.etat = ESQUIVE;
      c.t = 0;
      c.esq = this.reglages.fenetreEsquive;
      c.attente = Math.max(8, ATTENTE_ESQUIVE - this.paliers[A_VIVE]! * this.reglages.esquiveVive);
      if (this.paliers[A_TRANCHANTE]! > 0) this.coupId++; // l'esquive est un « coup » : chaque cible n'y est blessée qu'une fois
      c.tampon = 0;
      this.ev("esquive", c.x, c.y, d);
    }

    // Lot BR5 : la compétence (jauge pleine) coupe un coup ; l'esquive, elle, passe avant (survivre) et la coupe aussi.
    if (c.tampComp > 0 && c.comp >= 0 && c.rage >= this.reglages.rageMax && (c.etat === LIBRE || c.etat === COUP)) this.lancerCompetence(direction, visee);

    if (c.etat === ESQUIVE) {
      // la marche est plus lente depuis BR0c (−10 %) : la course de l'esquive garde sa longueur (lot BR2 : « Esquive longue » l'allonge, les « Bottes légères » non)
      const v = idiv(idiv(this.vitBase * 29, 10) * (100 + this.paliers[A_LONGUE]! * this.reglages.esquiveLongue), 100);
      this.deplacer(c, idiv(COS[c.dir]! * v, 1024), idiv(SIN[c.dir]! * v, 1024));
      c.marche = true;
      if (this.paliers[A_TRANCHANTE]! > 0) this.tranchant();
      if (++c.t >= DUREE_ESQUIVE) {
        c.etat = LIBRE;
        c.t = 0;
      }
    } else if (c.etat === COMPETENCE) {
      this.majCompetence(direction);
    } else if (c.etat === COUP) {
      // Le coup (lot BR0c) : anticipation (jusqu'à l'impact), phase active (4 ticks), récupération jusqu'au bout. Il s'engage : à `engagement` % de sa vitesse, dans la direction tenue, sinon vers où il frappe tant que dure la phase active.
      const impact = this.impactCoup(c.combo);
      const v = idiv(this.vit * this.reglages.engagement, 100);
      if (c.fente > 0) {
        // Lot BR5 — le COUP D'ÉLAN : une fente vers l'avant (`elanDistance`) jusqu'à un peu après l'impact, quoi que tienne le joueur.
        c.fente--;
        this.deplacer(c, idiv(COS[c.dir]! * idiv(cm(this.reglages.elanDistance), this.dureeFente(c.combo)), 1024), idiv(SIN[c.dir]! * idiv(cm(this.reglages.elanDistance), this.dureeFente(c.combo)), 1024));
        c.marche = true;
      } else if (direction >= 0) {
        this.deplacer(c, idiv(COS[direction * 4]! * v, 1024), idiv(SIN[direction * 4]! * v, 1024));
        c.marche = true;
      } else if (c.t <= impact + PHASE_ACTIVE) {
        const elan = c.combo === 2 ? idiv(v * 3, 2) : v;
        this.deplacer(c, idiv(COS[c.dir]! * elan, 1024), idiv(SIN[c.dir]! * elan, 1024));
      }
      if (c.t === impact) this.frapper();
      c.t++;
      if (c.t >= dureeCoup) {
        // Le coup tenu (ou un appui gardé en mémoire) enchaîne à la fin du coup, jamais avant : l'enchaînement garde le rythme du coup.
        if (c.tampon > 0) this.commencerCoup((c.combo + 1) % 3, direction, visee);
        else {
          c.etat = LIBRE;
          c.t = 0;
          c.reprise = DUREE_REPRISE;
        }
      }
    } else {
      // Libre : marcher, ou commencer un coup. Avec une visée, le chevalier regarde où il vise (même à l'arrêt) et marche où il veut ; sans visée, il regarde où il va.
      if (visee >= 0) c.dir = visee * 4;
      if (c.tampon > 0) this.commencerCoup(c.reprise > 0 ? (c.combo + 1) % 3 : 0, direction, visee);
      else if (direction >= 0) {
        const marche = direction * 4;
        if (visee < 0) c.dir = marche;
        c.marche = true;
        const v = this.vitesseCourse();
        this.deplacer(c, idiv(COS[marche]! * v, 1024), idiv(SIN[marche]! * v, 1024));
      }
    }
    // Le recul : il s'ajoute au mouvement et s'éteint.
    if (c.kx !== 0 || c.ky !== 0) {
      this.deplacer(c, c.kx, c.ky);
      c.kx = amortir(c.kx);
      c.ky = amortir(c.ky);
    }
    this.pousserHorsDuGolem(c);
    this.pousserHorsDesVases(c);
  }

  /**
   * La course hors combat (lot BR1b), une fois par tick : le chevalier se calme (`calme` compte les ticks tranquilles) ; passé `courseDelai`, sa vitesse monte en `courseMontee` ticks (tant qu'il marche) jusqu'à `courseFacteur` % de la marche.
   * Tout ce qui est du combat la coupe d'un coup : un coup (`commencerCoup`), un dégât (`blesser`) ; un ennemi qui s'alerte (`veille`) ou déjà alerté à moins de `courseRayon` empêche d'en commencer une (lot BR5 : il ne coupe plus celle qui est lancée). Pas de course hors du niveau, ni une fois la barrière fermée.
   */
  private majCourse(marche: boolean): void {
    const c = this.c;
    const r = this.reglages;
    if (!this.niveau || this.barriere >= 0 || c.etat === COUP) {
      c.calme = 0;
      c.elan = 0;
      return;
    }
    const rayon = cm(r.courseRayon);
    const menace = this.monstres.some((m) => m.hp > 0 && m.alerte === 1 && distance2(m.x, m.y, c.x, c.y) < rayon * rayon);
    // Lot BR5 : un ennemi alerté à moins du rayon empêche de COMMENCER une course, mais ne coupe plus celle qui est lancée : c'est ce qui permet le COUP D'ÉLAN (frapper en pleine course) pour ouvrir un combat.
    if (menace) c.calme = 0;
    else if (c.calme < r.courseDelai) c.calme++;
    else if (marche && c.elan < r.courseMontee) c.elan++;
    // Lot BR5 : s'arrêter coupe la course (quelques ticks pour freiner) — le chevalier peut « tenir sa ligne » devant un groupe qui s'éveille au lieu de foncer dedans.
    if (!marche && c.elan > 0) c.elan = Math.max(0, c.elan - 3);
  }

  /** La vitesse de marche du tick, en unités par tick : la marche, ou la course qui monte (jamais lue par la vue autrement que par `elan`). */
  private vitesseCourse(): number {
    const c = this.c;
    const r = this.reglages;
    if (c.elan <= 0) return this.vit;
    return idiv(this.vit * (100 * r.courseMontee + (r.courseFacteur - 100) * c.elan), 100 * r.courseMontee);
  }

  /** La course en cours, de 0 (la marche) à 100 (la pleine course) : la vue penche le chevalier et trace les lignes de vitesse d'après elle. */
  get course(): number {
    return idiv(this.c.elan * 100, Math.max(1, this.reglages.courseMontee));
  }

  /** Le pourcentage de durée d'un coup (lot BR2) : « Lame lourde » l'allonge, « Cadence » le raccourcit (jamais sous la moitié). */
  private pctDuree(): number {
    const r = this.reglages;
    return Math.max(50, 100 + this.paliers[A_LOURDE]! * r.lourdeLenteur - this.paliers[A_CADENCE]! * r.cadenceGain);
  }
  dureeCoup(s: number): number {
    const base = s === 2 ? idiv(this.reglages.cadence * 14, 10) : this.reglages.cadence;
    return Math.max(8, idiv(base * this.pctDuree() + 50, 100));
  }
  /** Le tick de l'impact dans le coup : la fin de l'anticipation (le coup final prend 4/3 de temps pour lever l'épée). */
  impactCoup(s: number): number {
    const base = Math.max(2, s === 2 ? idiv(this.reglages.anticipation * 4, 3) : this.reglages.anticipation);
    return Math.max(2, idiv(base * this.pctDuree() + 50, 100));
  }
  /** Les dégâts d'un coup (en dixièmes de point de vie) : ordinaire `degats` % du point, le coup final `coupFinal` % de cela, puis « Lame lourde ». */
  degatsCoup(s: number): number {
    const base = idiv(POINT * this.reglages.degats, 100);
    const d = s === 2 ? idiv(base * this.reglages.coupFinal, 100) : base;
    return idiv(d * (100 + this.paliers[A_LOURDE]! * this.reglages.lourdeDegats), 100);
  }
  /** Les dégâts contre le boss : « Brise-pierre » les augmente (autant que l'affinité du boss le dit : tout contre le golem et le bélier de carrière, peu contre les autres) ; le grand-duc en vol n'en encaisse qu'un quart. */
  degatsContreGolem(d: number, g: Golem | null = this.golem): number {
    const brise = idiv(this.paliers[A_BRISE]! * this.reglages.briseDegats * (g ? BOSS[g.kind]!.brise : 100), 100);
    // l'affinité : chaque palier d'une carte que ce boss favorise (Brise-pierre a déjà la sienne) ajoute `affinite` %
    let plein = idiv(d * (100 + brise), 100);
    if (g && BOSS[g.kind]!.affin) for (const id of BOSS[g.kind]!.favorise) if (id !== "brise-pierre") for (let k = this.paliers[indiceAmelioration(id)]!; k > 0; k--) plein = idiv(plein * (100 + this.reglages.affinite), 100);
    return g && g.kind === B_DUC && g.sol === 0 ? idiv(plein * DUC_EN_VOL, 100) : plein;
  }
  /** La portée du coup `s` (unités) : le coup final porte 25 % plus loin ; « Allonge ». */
  porteeCoup(s: number): number {
    return idiv(cm(this.reglages.portee) * (s === 2 ? 125 : 100) * (100 + this.paliers[A_ALLONGE]! * this.reglages.allongePortee), 10000);
  }
  /** La demi-ouverture de l'arc du coup `s` (degrés) : le coup final 30° de plus ; « Allonge » ; « Tourbillon » : 180 (tout autour). */
  arcCoup(s: number): number {
    if (s === 2 && this.paliers[A_TOURBILLON]! > 0) return 180;
    return Math.min(120, this.reglages.arc + (s === 2 ? 30 : 0) + this.paliers[A_ALLONGE]! * this.reglages.allongeArc);
  }

  private commencerCoup(s: number, direction: number, visee: number): void {
    const c = this.c;
    c.etat = COUP;
    c.t = 0;
    c.combo = s;
    c.tampon = 0;
    c.reprise = 0;
    // Lot BR5 — frapper en PLEINE course (la montée à 70 % au moins : le pilote, qui frappe sans tenir de direction, a déjà freiné d'un cran) fait un coup d'élan : une fente vers l'avant. La course s'arrête ensuite, comme avant.
    c.fente = this.course >= 70 && this.reglages.elanDistance > 0 ? this.dureeFente(s) : 0;
    c.calme = 0;
    c.elan = 0;
    this.coupId++;
    // Il frappe où le joueur VISE (la souris, le stick droit) ; sans visée, vers ce que le joueur tient ; sans direction (ou presque en face d'un ennemi), vers l'ennemi le plus proche (visée assistée).
    const cible = this.plusProche(cm(420));
    if (visee >= 0) c.dir = visee * 4;
    else if (direction >= 0) {
      c.dir = direction * 4;
      if (cible) {
        const v = dirVers(cible.x - c.x, cible.y - c.y);
        const ecart = Math.min(modDir(v - c.dir), modDir(c.dir - v));
        if (ecart <= 12) c.dir = v;
      }
    } else if (cible) c.dir = dirVers(cible.x - c.x, cible.y - c.y);
    this.ev("coup", c.x, c.y, s, c.dir);
    if (c.fente > 0) this.ev("elan", c.x, c.y, c.dir);
  }

  /** La durée de la fente du coup d'élan : de l'anticipation à un peu après l'impact. */
  private dureeFente(s: number): number {
    return this.impactCoup(s) + FENTE_PLUS;
  }

  /** Le monstre (ou le golem) le plus proche à moins de `max` (bord à bord). */
  private plusProche(max: number): { x: number; y: number } | null {
    const c = this.c;
    let meilleur: { x: number; y: number } | null = null;
    let d2m = Infinity;
    const essayer = (x: number, y: number, r: number): void => {
      const d = distance(c.x, c.y, x, y) - r;
      if (d <= max && d * d < d2m) {
        d2m = d * d;
        meilleur = { x, y };
      }
    };
    for (const m of this.monstres) if (m.hp > 0) essayer(m.x, m.y, rayonDe(m.type));
    for (const v of this.vases) if (v.id >= 0) essayer(v.x, v.y, v.r);
    if (this.golem && this.golem.hp > 0) essayer(this.golem.x, this.golem.y, this.golem.r);
    return meilleur;
  }

  /** L'impact du coup : tout ce qui est dans l'arc est touché, une fois par coup. */
  private frapper(): void {
    const c = this.c;
    const s = c.combo;
    const portee = this.porteeCoup(s);
    const demi = this.arcCoup(s);
    const tout = demi >= 180;
    const seuil = COS[Math.min(64, idiv(demi * 128, 360))]!;
    const fx = COS[c.dir]!;
    const fy = SIN[c.dir]!;
    const dans = (x: number, y: number, r: number): boolean => {
      const dx = x - c.x;
      const dy = y - c.y;
      const d = isqrt(dx * dx + dy * dy);
      if (d - r > portee) return false;
      if (d <= r || tout) return true;
      // Le centre doit être dans l'arc, élargi de la taille de la cible (un grand corps est touché de plus loin sur le côté).
      return dx * fx + dy * fy >= seuil * d - r * 1024;
    };
    // Lot BR5 : le coup d'élan frappe plus fort (×1,5) et repousse bien plus (le ×2 du recul).
    const elan = c.fente > 0;
    const degats = elan ? idiv(this.degatsCoup(s) * this.reglages.elanDegats, 100) : this.degatsCoup(s);
    const force = idiv(cm(this.reglages.recul) * (s === 2 ? 20 : 10) * (elan ? this.reglages.elanRecul : 100), 1000);
    if (tout) this.ev("moulinet", c.x, c.y, s);
    for (const m of this.monstres) {
      if (m.hp <= 0 || m.coup === this.coupId || !dans(m.x, m.y, rayonDe(m.type))) continue;
      this.toucherMonstre(m, degats, s, force, c.x, c.y);
    }
    // Lot BR5 : un vase cède d'un coup, et un coup en arc en brise plusieurs ; ce qu'il contient tombe à sa place.
    this.casserLesVases((v) => v.coup !== this.coupId && dans(v.x, v.y, v.r));
    const g = this.golem;
    if (g && g.hp > 0 && g.coup !== this.coupId && dans(g.x, g.y, g.r)) this.toucherGolem(g, degats, s);
    // Lot BR2 : « Onde d'épée » — le 3ᵉ coup lance une courte lame devant lui.
    if (s === 2 && this.paliers[A_ONDE]! > 0) {
      this.ondesEpee.push({ x: c.x, y: c.y, dir: c.dir, d: 0, portee: cm(this.reglages.ondePortee), degats: idiv(degats * this.reglages.ondeDegats, 100), touches: [] });
      this.ev("ondeEpee", c.x, c.y, c.dir);
    }
  }

  /** Un monstre touché par `degats` (le coup `s`, l'esquive, l'onde) : l'éclair, le recul qui le repousse depuis (sx, sy), le titubement, l'alerte, la mort (et ses gemmes). */
  private toucherMonstre(m: Monstre, degats: number, s: number, force: number, sx: number, sy: number): void {
    const c = this.c;
    m.coup = this.coupId;
    if (m.laisse > 0 && m.alerte !== 1) {
      m.alerte = 1;
      m.t = 0;
      this.alerterLaMeute(m);
    }
    m.hp -= degats;
    m.flash = 7;
    if (!this.sansRage) this.gagnerRage(this.reglages.rageTouche);
    m.gel = Math.max(m.gel, TITUBE[s]!); // elle glisse (le recul) puis titube
    const [ux, uy] = unitaire(m.x - sx, m.y - sy);
    const ex = ux === 0 && uy === 0 ? COS[c.dir]! : ux;
    const ey = ux === 0 && uy === 0 ? SIN[c.dir]! : uy;
    m.kx = idiv(ex * force, 1024);
    m.ky = idiv(ey * force, 1024);
    if (m.type === CHAUVE && (m.etat === PLONGEON || m.etat === ANNONCE_PLONGEON)) {
      m.etat = REPOS;
      m.t = 0;
    }
    this.ev("touche", m.x, m.y, s, m.type);
    if (this.contenu.scenario === "mannequin") m.hp = VIE_GELEE; // le mannequin ne meurt pas
    if (m.hp <= 0) {
      this.tues++;
      this.ev("mort", m.x, m.y, m.type, s);
      if (!this.sansRage) this.gagnerRage(this.reglages.rageTue);
      const base = m.type === GELEE ? this.reglages.xpGelee : m.type === GELATON ? this.reglages.xpGelaton : this.reglages.xpChauve;
      const camp = (this.niveau?.monstres[m.id - 1]?.camp ?? -1) >= 0; // un monstre d'un camp (au bout d'un détour) vaut plus : le détour est un pari
      if (m.sbire === 0) this.lacher(m.x, m.y, camp ? idiv(base * this.reglages.xpCamp, 100) : base); // lot BR3 : les sbires d'un boss ne lâchent rien
      // « Vol de vie » : un cœur tous les N monstres tués.
      if (this.paliers[A_VOL]! > 0 && this.tues % this.reglages.volVie === 0) this.soigner(1);
    }
  }

  /** Brise les vases que `touche` désigne (une seule fois chacun), et ce qu'ils contiennent tombe ; les vases brisés sont retirés. */
  private casserLesVases(touche: (v: VaseVivant) => boolean): void {
    if (this.vases.length === 0) return;
    let casse = false;
    for (const v of this.vases) {
      if (v.id < 0 || !touche(v)) continue;
      v.coup = this.coupId;
      this.casserVase(v);
      casse = true;
    }
    if (casse) this.vases = this.vases.filter((v) => v.id >= 0);
  }

  /** Le contenu d'un vase d'après son tirage (0 une gemme d'XP, 1 de la rage, 2 un cœur) : les seuils sont des réglages, le tirage vient de la graine du jour. */
  contenuDuVase(tirage: number): number {
    const r = this.reglages;
    return tirage < r.vaseGemme ? GEMME_XP : tirage < r.vaseGemme + r.vaseRage ? GEMME_RAGE : GEMME_COEUR;
  }

  private casserVase(v: VaseVivant): void {
    const contenu = this.contenuDuVase(v.tirage);
    v.id = -1 - v.id; // marqué brisé (retiré par `casserLesVases`)
    this.ev("brise", v.x, v.y, v.genre, contenu);
    if (!this.sansRage) this.gagnerRage(this.reglages.rageVase);
    if (contenu === GEMME_XP) this.lacher(v.x, v.y, this.reglages.xpVase, GEMME_XP);
    else if (contenu === GEMME_RAGE) this.lacher(v.x, v.y, this.reglages.rageButin, GEMME_RAGE);
    else this.lacher(v.x, v.y, 1, GEMME_COEUR);
  }

  /** La jauge de rage monte de `n` (+ « Rage vive »), sans dépasser son maximum. */
  private gagnerRage(n: number): void {
    const c = this.c;
    const max = this.reglages.rageMax;
    if (n <= 0 || c.rage >= max) return;
    const gain = idiv(n * (100 + this.paliers[A_RAGE_VIVE]! * this.reglages.rageVive), 100);
    c.rage = Math.min(max, c.rage + gain);
    if (c.rage >= max) this.ev("rage", c.x, c.y, max);
  }

  /** Les vases sont pleins pour le chevalier : il ne les traverse pas (les monstres, eux, passent). Il est repoussé le long du bord du vase. */
  private pousserHorsDesVases(c: { x: number; y: number }): void {
    for (const v of this.vases) {
      if (v.id < 0) continue;
      const somme = v.r + RAYON_CHEVALIER;
      const dx = c.x - v.x;
      const dy = c.y - v.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= somme * somme) continue;
      const d = isqrt(d2);
      const [ux, uy] = d === 0 ? [0, 1024] : unitaire(dx, dy);
      c.x = v.x + idiv(ux * somme, 1024);
      c.y = v.y + idiv(uy * somme, 1024);
    }
  }

  private toucherGolem(g: Golem, degats: number, s: number): void {
    g.coup = this.coupId;
    if (g.etat === RUGIT) return void this.ev("bloque", g.x, g.y);
    g.hp -= this.degatsContreGolem(degats, g);
    g.flash = 7;
    if (!this.sansRage) this.gagnerRage(this.reglages.rageTouche);
    const phase2 = g.phase === 1 && g.hp > 0 && g.hp * 2 <= g.hpMax;
    this.ev("touche", g.x, g.y, s, phase2 ? 3 : 2); // b : 2 = le golem, 3 = le golem qui passe en phase 2 par ce coup
    if (this.contenu.scenario === "mannequin") g.hp = g.hpMax; // le mannequin ne meurt pas
    else if (phase2) this.entrerPhase2(g);
    // La reine se divise à chaque seuil de vie franchi.
    if (g.kind === B_REINE) while (g.div < REINE_SEUILS.length && g.hp > 0 && g.hp * 1000 <= g.hpMax * REINE_SEUILS[g.div]!) {
      g.div++;
      this.diviser(g);
    }
  }

  /** « Esquive tranchante » : pendant la course de l'esquive, ce qui est au contact du chevalier est blessé (une fois par esquive). */
  private tranchant(): void {
    const c = this.c;
    const degats = idiv(idiv(POINT * this.reglages.degats, 100) * this.reglages.tranchanteDegats * (100 + this.paliers[A_LOURDE]! * this.reglages.lourdeDegats), 10000);
    for (const m of this.monstres) {
      if (m.hp <= 0 || m.coup === this.coupId) continue;
      const somme = rayonDe(m.type) + RAYON_CHEVALIER + cm(35);
      if (distance2(c.x, c.y, m.x, m.y) >= somme * somme) continue;
      this.ev("tranchant", m.x, m.y);
      this.toucherMonstre(m, degats, 0, cm(this.reglages.recul), c.x, c.y);
    }
    this.casserLesVases((v) => v.coup !== this.coupId && distance2(c.x, c.y, v.x, v.y) < carre(v.r + RAYON_CHEVALIER + cm(35)));
    const g = this.golem;
    if (g && g.hp > 0 && g.coup !== this.coupId && distance2(c.x, c.y, g.x, g.y) < carre(g.r + RAYON_CHEVALIER + cm(35))) {
      this.ev("tranchant", g.x, g.y);
      this.toucherGolem(g, degats, 0);
    }
  }

  /** Les ondes d'épée avancent et blessent une fois chaque cible qu'elles croisent. */
  private avancerOndesEpee(): void {
    if (this.ondesEpee.length === 0) return;
    const v = idiv(cm(VITESSE_ONDE_EPEE), 60);
    for (const o of this.ondesEpee) {
      o.d += v;
      const x = o.x + idiv(COS[o.dir]! * o.d, 1024);
      const y = o.y + idiv(SIN[o.dir]! * o.d, 1024);
      for (const m of this.monstres) {
        if (m.hp <= 0 || o.touches.includes(m.id)) continue;
        const somme = rayonDe(m.type) + LARGEUR_ONDE_EPEE;
        if (distance2(x, y, m.x, m.y) >= somme * somme) continue;
        o.touches.push(m.id);
        this.toucherMonstre(m, o.degats, 0, cm(this.reglages.recul), o.x, o.y);
      }
      this.casserLesVases((v) => !o.touches.includes(-1 - v.id) && distance2(x, y, v.x, v.y) < carre(v.r + LARGEUR_ONDE_EPEE) && (o.touches.push(-1 - v.id), true));
      const g = this.golem;
      if (g && g.hp > 0 && !o.touches.includes(0) && distance2(x, y, g.x, g.y) < carre(g.r + LARGEUR_ONDE_EPEE)) {
        o.touches.push(0);
        const avant = g.coup;
        this.toucherGolem(g, o.degats, 0);
        g.coup = avant;
      }
    }
    this.ondesEpee = this.ondesEpee.filter((o) => o.d < o.portee);
  }

  // --- Les compétences (lot BR5) -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  /** Le bond est en l'air : l'esquive ne le coupe pas (il est invulnérable). */
  private bondEnVol(): boolean {
    const c = this.c;
    return c.etat === COMPETENCE && c.comp === C_BOND && c.t >= BOND_ANNONCE && c.t < BOND_ANNONCE + BOND_VOL;
  }

  /** Le palier de la carte « Maîtrise » en % de dégâts (lot BR5) et de zone. */
  private pctMaitriseDegats(): number {
    return 100 + this.paliers[A_MAITRISE]! * this.reglages.maitriseDegats;
  }
  private pctMaitriseZone(): number {
    return 100 + this.paliers[A_MAITRISE]! * this.reglages.maitriseZone;
  }
  /** Les dégâts d'une frappe de compétence : `pct` % d'un coup ordinaire (Lame lourde comprise), + « Maîtrise ». */
  private degatsCompetence(pct: number): number {
    return idiv(idiv(this.degatsCoup(0) * pct, 100) * this.pctMaitriseDegats(), 100);
  }
  /** La durée du tourbillon en ticks (« Signature » l'allonge). */
  dureeTourbillon(): number {
    return idiv(this.reglages.tourbillonDuree * (100 + this.paliers[A_SIGNATURE]! * this.reglages.signatureTourbillon), 100);
  }
  /** Le rayon (unités) du tourbillon et de l'onde du bond, « Maîtrise » comprise. */
  rayonTourbillon(): number {
    return idiv(cm(this.reglages.tourbillonRayon) * this.pctMaitriseZone(), 100);
  }
  rayonBond(): number {
    return idiv(cm(this.reglages.bondRayon) * this.pctMaitriseZone(), 100);
  }
  /** L'étourdissement du bond en ticks (« Signature »). */
  etourdiBond(): number {
    return this.reglages.bondEtourdi + this.paliers[A_SIGNATURE]! * this.reglages.signatureBond;
  }
  /** Le nombre d'ennemis que le bouclier traverse avant de revenir (« Signature »). */
  ciblesBouclier(): number {
    return this.reglages.bouclierCibles + this.paliers[A_SIGNATURE]! * this.reglages.signatureBouclier;
  }
  /** Le chevalier peut lancer sa compétence (jauge pleine, une compétence choisie, ni en esquive ni déjà en compétence). */
  get competencePrete(): boolean {
    const c = this.c;
    return c.comp >= 0 && c.rage >= this.reglages.rageMax && (c.etat === LIBRE || c.etat === COUP);
  }

  /** Le chevalier lance sa compétence : la jauge se vide (« Écho » en rend une part, une fois sur deux), la direction est la visée, sinon ce que le joueur tient, sinon l'ennemi proche. */
  private lancerCompetence(direction: number, visee: number): void {
    const c = this.c;
    const cible = this.plusProche(cm(900));
    let d = c.dir;
    if (visee >= 0) d = visee * 4;
    else if (direction >= 0) {
      d = direction * 4;
      if (cible) {
        const v = dirVers(cible.x - c.x, cible.y - c.y);
        if (Math.min(modDir(v - d), modDir(d - v)) <= 12) d = v;
      }
    } else if (cible) d = dirVers(cible.x - c.x, cible.y - c.y);
    c.dir = d;
    c.cDir = d;
    c.etat = COMPETENCE;
    c.t = 0;
    c.tampComp = 0;
    c.tampon = 0;
    c.reprise = 0;
    c.combo = 0;
    c.calme = 0;
    c.elan = 0;
    c.fente = 0;
    // la jauge : vidée ; « Écho » en garde une part la première fois, rien la seconde (une seconde utilisation à moitié prix)
    if (this.paliers[A_ECHO]! > 0 && c.echo === 0) {
      c.rage = idiv(this.reglages.rageMax * this.reglages.echoRend, 100);
      c.echo = 1;
    } else {
      c.rage = 0;
      c.echo = 0;
    }
    c.bx = c.x;
    c.by = c.y;
    if (c.comp === C_BOND) this.viserLeBond();
    this.ev("competence", c.x, c.y, c.comp, d);
  }

  /** Le point d'atterrissage du bond : à `bondPortee` dans la direction, mais pas dans un mur, hors de l'arène, dans le boss ni dans un vase (le dernier point libre du trajet). */
  private viserLeBond(): void {
    const c = this.c;
    const portee = this.reglages.bondPortee;
    let lx = c.x;
    let ly = c.y;
    for (let dcm = 25; dcm <= portee; dcm += 25) {
      const x = c.x + idiv(COS[c.cDir]! * cm(dcm), 1024);
      const y = c.y + idiv(SIN[c.cDir]! * cm(dcm), 1024);
      if (!this.atterrissageLibre(x, y)) break;
      lx = x;
      ly = y;
    }
    c.tx = lx;
    c.ty = ly;
  }

  private atterrissageLibre(x: number, y: number): boolean {
    if (this.niveau && this.barriere < 0) {
      if (!this.libre(x, y, RAYON_CHEVALIER)) return false;
    } else if (distance(x, y, this.ax, this.ay) > RAYON_ARENE - RAYON_CHEVALIER) return false;
    const g = this.golem;
    if (g && g.hp > 0 && g.sol === 1 && distance2(x, y, g.x, g.y) < carre(g.r + RAYON_CHEVALIER + cm(20))) return false;
    for (const v of this.vases) if (v.id >= 0 && distance2(x, y, v.x, v.y) < carre(v.r + RAYON_CHEVALIER)) return false;
    return true;
  }

  /** Un tick de compétence : le tourbillon frappe autour (toutes les 12 ticks) et avance lentement ; le bond s'accroupit, vole, atterrit ; le bouclier part au 5ᵉ tick. */
  private majCompetence(direction: number): void {
    const c = this.c;
    const r = this.reglages;
    const t = c.t;
    if (c.comp === C_TOURBILLON) {
      if (direction >= 0 && r.tourbillonVitesse > 0) {
        const v = idiv(this.vit * r.tourbillonVitesse, 100);
        this.deplacer(c, idiv(COS[direction * 4]! * v, 1024), idiv(SIN[direction * 4]! * v, 1024));
        c.marche = true;
      }
      if (t >= DEBUT_TOURBILLON && (t - DEBUT_TOURBILLON) % PAS_TOURBILLON === 0) this.pulsation(idiv(t - DEBUT_TOURBILLON, PAS_TOURBILLON));
      c.t++;
      if (c.t >= this.dureeTourbillon()) this.finirCompetence();
    } else if (c.comp === C_BOND) {
      if (t >= BOND_ANNONCE && t < BOND_ANNONCE + BOND_VOL) {
        const k = t - BOND_ANNONCE + 1;
        c.x = c.bx + idiv((c.tx - c.bx) * k, BOND_VOL);
        c.y = c.by + idiv((c.ty - c.by) * k, BOND_VOL);
        c.esq = Math.max(c.esq, 2); // invulnérable en l'air
        if (k === BOND_VOL) this.atterrir();
      }
      c.t++;
      if (c.t >= BOND_ANNONCE + BOND_VOL + BOND_RECUP) this.finirCompetence();
    } else {
      if (t === BOUCLIER_LANCE) this.lancerLeBouclier();
      c.t++;
      if (c.t >= BOUCLIER_FIN) this.finirCompetence();
    }
  }

  private finirCompetence(): void {
    const c = this.c;
    c.etat = LIBRE;
    c.t = 0;
    c.reprise = 0;
  }

  /** Une passe du tourbillon : tout ce qui est autour du chevalier (monstres, vases, boss) est frappé, une fois par passe. */
  private pulsation(i: number): void {
    const c = this.c;
    const rayon = this.rayonTourbillon();
    const degats = this.degatsCompetence(this.reglages.tourbillonDegats);
    const force = idiv(cm(this.reglages.recul) * 10, 100); // une poussée très légère : repoussés plus loin que le rayon, les ennemis échapperaient aux passes suivantes
    this.coupId++;
    this.sansRage = true;
    this.ev("pulsation", c.x, c.y, i, rayon);
    for (const m of this.monstres) if (m.hp > 0 && distance(c.x, c.y, m.x, m.y) - rayonDe(m.type) <= rayon) this.toucherMonstre(m, degats, 0, force, c.x, c.y);
    this.casserLesVases((v) => distance(c.x, c.y, v.x, v.y) - v.r <= rayon);
    const g = this.golem;
    if (g && g.hp > 0 && g.coup !== this.coupId && distance(c.x, c.y, g.x, g.y) - g.r <= rayon) this.toucherGolem(g, degats, 0);
    this.sansRage = false;
  }

  /** L'atterrissage du bond : une onde de choc écrase tout autour, les ennemis sont étourdis et repoussés. */
  private atterrir(): void {
    const c = this.c;
    const rayon = this.rayonBond();
    const degats = this.degatsCompetence(this.reglages.bondDegats);
    const force = idiv(cm(this.reglages.recul) * 15, 10);
    const etourdi = this.etourdiBond();
    this.coupId++;
    this.sansRage = true;
    this.ev("atterrissage", c.x, c.y, rayon);
    for (const m of this.monstres) {
      if (m.hp <= 0 || distance(c.x, c.y, m.x, m.y) - rayonDe(m.type) > rayon) continue;
      this.toucherMonstre(m, degats, 2, force, c.x, c.y);
      if (m.hp > 0) m.gel = Math.max(m.gel, etourdi);
    }
    this.casserLesVases((v) => distance(c.x, c.y, v.x, v.y) - v.r <= rayon);
    const g = this.golem;
    if (g && g.hp > 0 && g.coup !== this.coupId && distance(c.x, c.y, g.x, g.y) - g.r <= rayon) this.toucherGolem(g, degats, 0);
    this.sansRage = false;
    this.pousserHorsDuGolem(c);
    this.pousserHorsDesVases(c);
  }

  private lancerLeBouclier(): void {
    const c = this.c;
    const x = c.x + idiv(COS[c.cDir]! * cm(60), 1024);
    const y = c.y + idiv(SIN[c.cDir]! * cm(60), 1024);
    this.boucliers.push({ x, y, ox: x, oy: y, dir: c.cDir, d: 0, portee: cm(this.reglages.bouclierPortee), etat: 0, cibles: 0, maxCibles: this.ciblesBouclier(), touches: [], retour: [], degats: this.degatsCompetence(this.reglages.bouclierDegats), age: 0 });
    this.ev("bouclier", x, y, c.cDir);
  }

  /** Les boucliers lancés : à l'aller ils traversent jusqu'à `maxCibles` ennemis (les vases se brisent sans compter) ; à `portee` ou après la dernière cible ils reviennent et blessent (à 60 %) ce qu'ils n'avaient pas touché. */
  private avancerBoucliers(): void {
    if (this.boucliers.length === 0) return;
    const c = this.c;
    const v = idiv(cm(VITESSE_BOUCLIER), 60);
    this.sansRage = true;
    for (const b of this.boucliers) {
      b.age++;
      if (b.etat === 0) {
        b.d += v;
        b.x = b.ox + idiv(COS[b.dir]! * b.d, 1024);
        b.y = b.oy + idiv(SIN[b.dir]! * b.d, 1024);
      } else {
        const d = distance(b.x, b.y, c.x, c.y);
        const pas = Math.min(d, v + idiv(v, 10));
        if (d > 0) {
          b.x += idiv((c.x - b.x) * pas, d);
          b.y += idiv((c.y - b.y) * pas, d);
        }
      }
      const retour = b.etat === 1;
      const liste = retour ? b.retour : b.touches;
      const degats = retour ? idiv(b.degats * RETOUR_BOUCLIER, 100) : b.degats;
      for (const m of this.monstres) {
        if (m.hp <= 0 || liste.includes(m.id) || (retour && b.touches.includes(m.id)) || distance2(b.x, b.y, m.x, m.y) >= carre(rayonDe(m.type) + LARGEUR_BOUCLIER)) continue;
        liste.push(m.id);
        if (!retour) b.cibles++;
        this.coupId++;
        this.toucherMonstre(m, degats, 0, cm(this.reglages.recul), b.x, b.y);
        this.ev("bouclierTouche", m.x, m.y, retour ? 1 : 0);
      }
      const g = this.golem;
      if (g && g.hp > 0 && !liste.includes(0) && !(retour && b.touches.includes(0)) && distance2(b.x, b.y, g.x, g.y) < carre(g.r + LARGEUR_BOUCLIER)) {
        liste.push(0);
        if (!retour) b.cibles++;
        this.coupId++;
        const avant = g.coup;
        this.toucherGolem(g, degats, 0);
        g.coup = avant;
        this.ev("bouclierTouche", g.x, g.y, retour ? 1 : 0);
      }
      this.coupId++;
      this.casserLesVases((q) => distance2(b.x, b.y, q.x, q.y) < carre(q.r + LARGEUR_BOUCLIER));
      if (!retour && (b.d >= b.portee || b.cibles >= b.maxCibles)) {
        b.etat = 1;
        this.ev("bouclierRetour", b.x, b.y);
      } else if (retour && distance(b.x, b.y, c.x, c.y) <= RAMASSE) b.age = 9999;
    }
    this.sansRage = false;
    this.boucliers = this.boucliers.filter((b) => b.age < 240);
  }

  // --- La horde (lot BR5) --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  /** Le scénario `horde` : trente gélatons en couronne, dix gelées derrière, des groupes de vases autour de l'arène ; le chevalier au centre-bas, la jauge pleine. Quand la horde est fauchée, une autre arrive. */
  private monterHorde(): void {
    this.c.y = cm(300);
    this.c.dir = 96;
    this.monstres = [];
    this.vases = [];
    this.horde();
    this.vasesDeLaHorde();
  }

  private horde(): void {
    const nouveau = (type: number, x: number, y: number, t: number): void => {
      this.monstres.push({ id: this.prochainId++, type, x, y, kx: 0, ky: 0, hp: viePar(type), flash: 0, etat: ORBITE, t, age: this.tick, a: dirVers(x, y), sens: 1, cx: 0, cy: 0, gel: 0, duree: 120 + (t % 90), coup: 0, hx: x, hy: y, alerte: 1, laisse: 0, ra: 0, sbire: 0 });
    };
    for (let i = 0; i < 30; i++) {
      const a = modDir(idiv(i * 128, 30) + 5);
      const r = cm(620 + (i % 3) * 110);
      nouveau(GELATON, idiv(COS[a]! * r, 1024), cm(-150) + idiv(SIN[a]! * r, 1024), (i * 7) % this.durees.gelatonCycle);
    }
    for (let i = 0; i < 10; i++) {
      const a = modDir(idiv(i * 128, 10) + 9);
      const r = cm(930);
      nouveau(GELEE, idiv(COS[a]! * r, 1024), cm(-150) + idiv(SIN[a]! * r, 1024), (i * 13) % this.durees.geleeCycle);
    }
  }

  /** Quatre groupes de vases aux quatre coins de l'arène d'essai : 6, 8, 10 et 12 vases. */
  private vasesDeLaHorde(): void {
    const groupes: readonly (readonly [number, number, number])[] = [[-640, 380, 6], [650, 360, 8], [-520, -640, 10], [560, -660, 12]];
    let g = 0;
    for (const [cx, cy, n] of groupes) {
      for (let i = 0; i < n; i++) {
        const a = modDir(idiv(i * 128, n) + g * 11);
        const r = i === 0 ? 0 : cm(60 + (i % 3) * 38);
        const genre = (i + g) % 3;
        this.vases.push({ id: this.prochainVase++, genre, x: cm(cx) + idiv(COS[a]! * r, 1024), y: cm(cy) + idiv(SIN[a]! * r, 1024), r: RAYON_VASE[genre]!, coup: 0, tirage: (i * 37 + g * 11) % 100, groupe: g });
      }
      g++;
    }
  }

  // --- L'XP et les améliorations (lot BR2) ---------------------------------------------------------------------------------------------------------------------------------------------------------
  /** L'XP cumulée qu'il faut pour ATTEINDRE le niveau `n` (le niveau 1 : 0) : le niveau suivant coûte `xpBase`, puis `xpPas` de plus à chaque niveau. */
  xpSeuil(n: number): number {
    if (n <= 1) return 0;
    return (n - 1) * this.reglages.xpBase + this.reglages.xpPas * idiv((n - 1) * (n - 2), 2);
  }

  /** Une gemme tombe (seulement dans le niveau du jour : les scénarios d'essai n'ont pas d'XP). */
  private lacher(x: number, y: number, v: number, k = GEMME_XP): void {
    if ((!this.niveau && this.contenu.scenario !== "horde") || v <= 0) return;
    this.gemmes.push({ id: this.prochaineGemme++, x, y, v, k, vers: false, age: this.tick });
    this.ev("gemme", x, y, v, k);
  }

  /** Les gemmes dans le rayon d'aimant volent vers le chevalier (et ne s'arrêtent plus) ; au contact, elles sont ramassées. */
  private ramasser(): void {
    if (this.gemmes.length === 0) return;
    const c = this.c;
    const rayon = idiv(cm(this.reglages.aimant) * (100 + this.paliers[A_AIMANT]! * this.reglages.aimantGain), 100);
    const v = idiv(cm(VITESSE_GEMME), 60);
    const reste: Gemme[] = [];
    for (const g of this.gemmes) {
      const d = distance(g.x, g.y, c.x, c.y);
      // un cœur attend au sol tant que le chevalier a tous les siens
      if (g.k === GEMME_COEUR && c.coeurs >= c.coeursMax) {
        g.vers = false;
        reste.push(g);
        continue;
      }
      if (d < rayon) g.vers = true;
      if (g.vers && d > 0) {
        const pas = Math.min(d, v);
        g.x += idiv((c.x - g.x) * pas, d);
        g.y += idiv((c.y - g.y) * pas, d);
      }
      if (distance(g.x, g.y, c.x, c.y) <= RAMASSE) {
        if (g.k === GEMME_RAGE) this.gagnerRage(g.v);
        else if (g.k === GEMME_COEUR) this.soigner(g.v);
        else this.xp += g.v;
        this.ev("ramasse", g.x, g.y, g.v, g.k);
      } else reste.push(g);
    }
    this.gemmes = reste;
  }

  /** L'XP atteint le niveau suivant : le niveau monte et le choix s'ouvre (trois cartes tirées de la graine du jour et du niveau). Une fois à la fois. */
  private verifierNiveau(): void {
    if (this.choix || !this.niveau || this.xp < this.xpSeuil(this.nv + 1)) return;
    this.nv++;
    this.choix = { nv: this.nv, cartes: tirageDeCartes(this.contenu.graine, this.nv, this.paliers) };
    this.ev("niveau", this.c.x, this.c.y, this.nv);
  }

  /**
   * Le joueur choisit la carte `index` (0 à 2) du niveau `nv`. **Un événement d'entrée de la rediffusion** : refusé (rend `false`, rien ne change) quand aucun niveau n'est gagné, quand `nv` n'est pas celui du choix en attente ou quand la carte n'existe pas.
   * Le monde repart ; si l'XP déjà ramassée donne un autre niveau, un nouveau choix s'ouvre aussitôt.
   */
  choisir(nv: number, index: number): boolean {
    const ch = this.choix;
    if (!ch || ch.nv !== nv || !Number.isInteger(index) || index < 0 || index >= ch.cartes.length) return false;
    this.choix = null;
    this.prendre(ch.cartes[index]!, true);
    this.ev("carte", this.c.x, this.c.y, ch.cartes[index]!, nv);
    this.verifierNiveau();
    return true;
  }

  /** Une amélioration prise : son palier monte et son effet joue (les effets de durée se lisent dans les accesseurs ; les cœurs et la vitesse changent ici). */
  private prendre(i: number, joue: boolean): void {
    if (i < 0 || i >= NB_AMELIORATIONS || this.paliers[i]! >= AMELIORATIONS[i]!.max) return;
    if (i !== A_SOIN) this.paliers[i]!++;
    const c = this.c;
    if (i === A_BOTTES) this.vit = idiv(this.vitBase * (100 + this.paliers[A_BOTTES]! * this.reglages.bottesVitesse), 100);
    else if (i === A_COEUR) {
      c.coeursMax++;
      c.coeurs++;
    } else if (i === A_SOIN && joue) this.soigner(1);
    else if (i === A_SOIN) c.coeurs = Math.min(c.coeursMax, c.coeurs + 1);
  }

  private soigner(n: number): void {
    const c = this.c;
    if (c.coeurs >= c.coeursMax) return;
    c.coeurs = Math.min(c.coeursMax, c.coeurs + n);
    this.ev("soin", c.x, c.y, c.coeurs);
  }

  // --- Les monstres ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private apparaitre(n: number): void {
    for (let i = 0; i < n && this.monstres.length < MAX_MONSTRES; i++) {
      const angle = this.rng.int(128);
      const tirage = this.rng.int(100);
      const type = tirage < 45 ? GELATON : tirage < 75 ? GELEE : CHAUVE; // lot BR5 : l'arène d'essai a des gélatons
      const r = RAYON_ARENE - cm(70);
      const x = idiv(COS[angle]! * r, 1024);
      const y = idiv(SIN[angle]! * r, 1024);
      const t = this.rng.int(40);
      this.monstres.push({ id: this.prochainId++, type, x, y, kx: 0, ky: 0, hp: viePar(type), flash: 0, etat: ORBITE, t, age: this.tick, a: dirVers(x - this.c.x, y - this.c.y), sens: this.rng.int(2) === 0 ? 1 : -1, cx: 0, cy: 0, gel: 0, duree: 120 + this.rng.int(120), coup: 0, hx: x, hy: y, alerte: 1, laisse: 0, ra: 0, sbire: 0 });
      this.ev("apparition", x, y, type);
    }
  }

  private apparitions(): void {
    const k = this.contenu.scenario;
    if (k === "horde") {
      // La horde fauchée (il en reste quelques-uns), une autre arrive après une pause ; les vases aussi se refont quand il n'en reste plus.
      if (this.monstres.length > 4) this.videDepuis = -1;
      else if (this.videDepuis < 0) this.videDepuis = this.tick;
      else if (this.tick - this.videDepuis >= 120) {
        this.monstres = [];
        this.horde();
        if (this.vases.length < 12) {
          this.vases = [];
          this.vasesDeLaHorde();
        }
        this.videDepuis = -1;
      }
      return;
    }
    if (k === "arene") {
      if (this.contenu.monstres > 0) {
        // Le test de charge : l'arène garde `monstres` monstres en vie, cinq de plus toutes les 1,5 s.
        if (this.tick % 90 === 0) {
          this.vague++;
          if (this.monstres.length < this.contenu.monstres) this.apparaitre(Math.min(5, this.contenu.monstres - this.monstres.length));
        }
        return;
      }
      // Par défaut : des vagues (au plus `MAX_MONSTRES_VAGUE` à la fois). La suivante ne vient qu'après une pause, quand le terrain est presque vide.
      if (this.monstres.length > 1) this.videDepuis = -1;
      else if (this.videDepuis < 0) this.videDepuis = this.tick;
      else if (this.tick - this.videDepuis >= this.dur(PAUSE_VAGUE)) {
        this.vague++;
        this.apparaitre(Math.min(MAX_MONSTRES_VAGUE - this.monstres.length, 3 + this.vague));
        this.videDepuis = -1;
      }
    }
  }

  private mouvementMonstre(m: Monstre): void {
    const c = this.c;
    if (m.flash > 0) m.flash--;
    if (m.hp <= 0) return;
    if (m.kx !== 0 || m.ky !== 0) {
      this.deplacer(m, m.kx, m.ky);
      m.kx = amortir(m.kx);
      m.ky = amortir(m.ky);
    }
    if (m.gel > 0) {
      m.gel--;
      return;
    }
    if (m.laisse > 0) this.veille(m);
    if (this.contenu.scenario === "mannequin") {
      // Le mannequin ne bouge pas : après un coup (glissade, puis titubement) il rentre à sa place, sans attaquer.
      const [hx, hy] = MANNEQUINS[(m.id - 1) % MANNEQUINS.length]!;
      const d = distance(m.x, m.y, cm(hx), cm(hy));
      if (d > 0) {
        const v = Math.min(d, this.vitesse(180));
        m.x += idiv((cm(hx) - m.x) * v, d);
        m.y += idiv((cm(hy) - m.y) * v, d);
      }
      m.t = 0;
      return;
    }
    if (m.type === GELEE || m.type === GELATON) {
      // Au repos (lot BR1), elle reste à sa place. En alerte elle s'écrase (annonce), vise juste avant de bondir, bondit, se repose ; de retour, elle bondit vers sa place. (Lot BR5 : le gélaton fait de même, en plus court et plus vite.)
      if (m.laisse > 0 && m.alerte === 0) {
        m.t = 0;
        return;
      }
      const but = m.alerte === 2 ? { x: m.hx, y: m.hy } : c;
      const d = this.durees;
      const gelaton = m.type === GELATON;
      const cycle = gelaton ? d.gelatonCycle : d.geleeCycle;
      const annonce = gelaton ? d.gelatonAnnonce : d.geleeAnnonce;
      const bond = gelaton ? d.gelatonBond : d.geleeBond;
      m.t = (m.t + 1) % cycle;
      if (m.t === Math.max(1, annonce - (gelaton ? GELATON_VERROU : GELEE_VERROU))) {
        const [ux, uy] = unitaire(but.x - m.x, but.y - m.y);
        m.cx = ux;
        m.cy = uy;
      }
      if (m.t >= annonce && m.t < annonce + bond) {
        const v = this.vitesse(gelaton ? GELATON_VITESSE : GELEE_VITESSE);
        this.deplacer(m, idiv(m.cx * v, 1024), idiv(m.cy * v, 1024));
      }
      return;
    }
    // La chauve-souris.
    m.t++;
    if (m.etat === ORBITE) {
      if (m.t % 2 === 0) m.a = modDir(m.a + m.sens);
      // Elle tourne autour du chevalier (en alerte) ; au repos, autour de sa place, de près ; de retour, elle rentre.
      const sur = m.laisse === 0 || m.alerte === 1;
      const rayon = sur ? cm(450) : m.alerte === 2 ? 0 : cm(150);
      const tx = (sur ? c.x : m.hx) + idiv(COS[m.a]! * rayon, 1024);
      const ty = (sur ? c.y : m.hy) + idiv(SIN[m.a]! * rayon, 1024);
      const d = distance(m.x, m.y, tx, ty);
      const v = Math.min(d, this.vitesse(CHAUVE_VITESSE));
      if (d > 0) this.deplacer(m, idiv((tx - m.x) * v, d), idiv((ty - m.y) * v, d));
      if (sur && m.t >= m.duree) {
        m.etat = ANNONCE_PLONGEON;
        m.t = 0;
      }
    } else if (m.etat === ANNONCE_PLONGEON) {
      if (m.t >= this.durees.chauveAnnonce) {
        const [ux, uy] = unitaire(c.x - m.x, c.y - m.y);
        m.cx = ux;
        m.cy = uy;
        m.etat = PLONGEON;
        m.t = 0;
      }
    } else if (m.etat === PLONGEON) {
      const v = this.vitesse(CHAUVE_VITESSE_PLONGEON);
      this.deplacer(m, idiv(m.cx * v, 1024), idiv(m.cy * v, 1024));
      if (m.t >= this.durees.chauvePlongeon) {
        m.etat = REPOS;
        m.t = 0;
      }
    } else if (m.t >= this.dur(CHAUVE_REPOS)) {
      m.etat = ORBITE;
      m.t = 0;
      m.a = dirVers(m.x - c.x, m.y - c.y);
      m.duree = 120 + this.rng.int(120);
    }
  }

  /** La veille d'un monstre du niveau : il remarque le chevalier à son rayon d'alerte, le poursuit tant qu'il reste dans sa laisse, puis rentre à sa place (et ne regarde plus le chevalier avant d'y être). */
  private veille(m: Monstre): void {
    const c = this.c;
    const dc = distance(m.x, m.y, c.x, c.y);
    const alerte = m.ra > 0 ? m.ra : m.type === CHAUVE ? ALERTE_CHAUVE : ALERTE_GELEE;
    if (m.alerte === 0) {
      if (this.barriere < 0 && dc < alerte) {
        m.alerte = 1;
        m.t = m.type === GELATON ? (m.id * 7) % this.durees.gelatonCycle : 0; // une meute ne bondit pas d'un seul bloc
        c.calme = 0; // lot BR1b : un ennemi qui s'alerte empêche d'en commencer une (lot BR5 : il ne coupe plus la course lancée)
        this.ev("alerte", m.x, m.y, m.type);
        this.alerterLaMeute(m);
      }
    } else if (m.alerte === 1) {
      if (distance(m.x, m.y, m.hx, m.hy) > m.laisse || dc > alerte * 2 || this.barriere >= 0) {
        m.alerte = 2;
        if (m.type === CHAUVE) {
          m.etat = ORBITE;
          m.t = 0;
        }
      }
    } else if (distance(m.x, m.y, m.hx, m.hy) < cm(100)) {
      m.alerte = 0;
      m.t = 0;
      if (m.type === CHAUVE) m.etat = ORBITE;
    }
  }

  /** Lot BR5 — une meute s'alerte d'un seul mouvement : quand un gélaton s'alerte, ceux qui sont au repos à moins de 7 m de lui le suivent (ils se jettent en groupe). */
  private alerterLaMeute(m: Monstre): void {
    if (m.type !== GELATON) return;
    for (const q of this.monstres) {
      if (q === m || q.type !== GELATON || q.hp <= 0 || q.laisse === 0 || q.alerte !== 0 || distance2(q.x, q.y, m.x, m.y) > RAYON_MEUTE * RAYON_MEUTE) continue;
      q.alerte = 1;
      q.t = (q.id * 7) % this.durees.gelatonCycle;
      this.ev("alerte", q.x, q.y, q.type);
    }
  }

  /** Les monstres (et le golem) ne se superposent pas : ils se repoussent. */
  private separer(): void {
    const ms = this.monstres;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i]!;
      if (a.hp <= 0) continue;
      const ra = rayonDe(a.type);
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j]!;
        if (b.hp <= 0) continue;
        if (this.niveau && (a.type === CHAUVE || b.type === CHAUVE)) continue; // dans le niveau, la chauve-souris vole par-dessus les autres
        if (a.laisse > 0 && a.alerte === 0 && b.laisse > 0 && b.alerte === 0) continue; // lot BR5 : deux monstres au repos ne bougent pas et le générateur les a posés à l'écart (150 monstres : on ne compare pas leurs 11 000 paires à chaque tick)
        const somme = ra + rayonDe(b.type);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= somme * somme) continue;
        const d = isqrt(d2);
        const recouvre = idiv(somme - d, 2);
        const [ux, uy] = d === 0 ? [1024, 0] : unitaire(dx, dy);
        this.pousserMonstre(a, -idiv(ux * recouvre, 1024), -idiv(uy * recouvre, 1024));
        this.pousserMonstre(b, idiv(ux * recouvre, 1024), idiv(uy * recouvre, 1024));
      }
      this.pousserHorsDuGolem(a, ra);
      this.dansArene(a, ra);
    }
  }

  // --- Le boss : le golem de BR0 et, depuis BR3, la reine gelée, le grand-duc, le bélier et le vieux chêne ---------------------------------------------------------------------------------------
  private entrerPhase2(g: Golem): void {
    g.phase = 2;
    g.etat = RUGIT;
    g.t = 0;
    g.duree = this.dur(100);
    g.sol = 1;
    this.zones = [];
    // Seul le golem rugit en lançant une onde ; les autres rugissent, invulnérables, sans rien lancer.
    if (g.kind === B_GOLEM) this.zones.push({ type: ONDE, x: g.x, y: g.y, r: RAYON_ONDE, t0: this.tick, ti: this.tick + this.dur(70), rang: 0, x2: 0, y2: 0, dash: 0 });
    this.ev("phase2", g.x, g.y);
  }

  private mouvementGolem(g: Golem): void {
    if (g.flash > 0) g.flash--;
    if (g.hp <= 0) return;
    g.t++;
    if (g.etat === RUGIT) {
      if (g.t >= g.duree) {
        g.etat = MARCHE;
        g.t = 0;
        g.repos = this.dur(g.phase === 2 ? 60 : this.niveau ? 100 : 60);
        if (g.kind === B_DUC) g.sol = 0; // il prend l'air
      }
      return;
    }
    if (g.etat === ANNONCE) {
      this.courseDuBoss(g);
      if (g.t >= g.duree) this.finAnnonce(g);
      return;
    }
    if (g.etat === RECUPERE) {
      if (g.t >= g.recup) {
        g.etat = MARCHE;
        g.t = 0;
        g.repos = this.dur(idiv(this.reglages.golemCadence * (g.phase === 2 ? 62 : 100) * BOSS[g.kind]!.repos, 10000));
        if (g.kind === B_DUC) g.sol = 0;
      }
      return;
    }
    if (g.etat === ETOURDI) {
      if (g.t >= g.duree) {
        g.etat = MARCHE;
        g.t = 0;
        g.repos = this.dur(60);
      }
      return;
    }
    // Il marche vers le chevalier (le grand-duc tourne en l'air, le chêne ne bouge pas), puis choisit son attaque.
    const c = this.c;
    const dx = c.x - g.x;
    const dy = c.y - g.y;
    const d = isqrt(dx * dx + dy * dy);
    g.dir = dirVers(dx, dy);
    if (this.contenu.scenario === "mannequin") return; // le mannequin ne marche pas et ne frappe pas : il regarde le chevalier
    const ph = g.phase === 2 ? 1 : 0;
    if (g.kind === B_DUC) this.voler(g);
    else if (g.kind !== B_CHENE && d > g.r + RAYON_CHEVALIER + cm(60)) {
      const v = this.vitesse(g.kind === B_REINE ? REINE_VITESSE[ph]! : g.kind === B_BELIER ? BELIER_VITESSE[ph]! : g.phase === 2 ? 150 : 105);
      g.x += idiv(idiv(dx * 1024, d) * v, 1024);
      g.y += idiv(idiv(dy * 1024, d) * v, 1024);
      if (g.kind !== B_GOLEM) this.dansArene(g, g.r);
    }
    if (g.repos > 0) g.repos--;
    if (g.repos === 0) this.lancerAttaque(g, d);
  }

  /** Le grand-duc en l'air tourne autour du centre de l'arène (il se rend à son orbite depuis où il a atterri). */
  private voler(g: Golem): void {
    if (this.tick % 3 === 0) g.a = modDir(g.a + 1);
    const tx = this.ax + idiv(COS[g.a]! * DUC_ORBITE, 1024);
    const ty = this.ay + idiv(SIN[g.a]! * DUC_ORBITE, 1024);
    const d = distance(g.x, g.y, tx, ty);
    if (d === 0) return;
    const v = Math.min(d, this.vitesse(DUC_VITESSE));
    g.x += idiv((tx - g.x) * v, d);
    g.y += idiv((ty - g.y) * v, d);
  }

  /** Pendant l'annonce, le boss se déplace d'après les zones : la reine saute vers son cercle dans les derniers ticks ; le grand-duc et le bélier parcourent leur bande (le duc passe de l'une à l'autre en transit). */
  private courseDuBoss(g: Golem): void {
    if (g.kind === B_REINE) {
      let z: Zone | null = null;
      for (const q of this.zones) if (q.type === POING && q.ti > this.tick && (!z || q.ti < z.ti)) z = q;
      if (z && z.ti - this.tick <= this.dur(REINE_ELAN)) {
        const reste = z.ti - this.tick;
        g.x += idiv(z.x - g.x, reste);
        g.y += idiv(z.y - g.y, reste);
      }
    } else if (g.kind === B_DUC || g.kind === B_BELIER) {
      for (const z of this.zones) {
        if (z.type !== Z_BANDE) continue;
        const debut = z.ti - z.dash;
        if (this.tick >= debut) {
          const k = this.tick - debut;
          g.x = z.x + idiv((z.x2 - z.x) * k, z.dash);
          g.y = z.y + idiv((z.y2 - z.y) * k, z.dash);
        } else if (g.kind === B_DUC && g.ft > 0) {
          // transit entre deux plongeons : de la fin du premier au début du second
          const k = this.tick - g.ft;
          const n = Math.max(1, debut - g.ft);
          g.x = g.ex + idiv((z.x - g.ex) * k, n);
          g.y = g.ey + idiv((z.y - g.ey) * k, n);
        }
        return;
      }
    }
  }

  /** La fin de l'annonce : le bélier qui a percuté le muret est étourdi (et lâche des éclats en phase 2) ; les autres récupèrent (la fenêtre pour taper) ; le grand-duc se pose. */
  private finAnnonce(g: Golem): void {
    const ph = g.phase === 2 ? 1 : 0;
    if (g.kind === B_BELIER && g.mur === 1) {
      g.mur = 0;
      g.etat = ETOURDI;
      g.t = 0;
      g.duree = this.dur(BELIER_ETOURDI);
      this.ev("choc", g.x, g.y, g.phase);
      if (g.phase === 2) {
        // « éclats au choc » : des pierres annoncées tombent autour de lui pendant qu'il est étourdi
        const annonce = this.dur(ANNONCE_GOLEM[1]);
        for (let i = 0; i < BELIER_ECLATS; i++) {
          const ang = this.rng.int(128);
          const r = cm(300) + this.rng.int(cm(300));
          const [x, y] = this.dansLArene(g.x + idiv(COS[ang]! * r, 1024), g.y + idiv(SIN[ang]! * r, 1024), cm(100));
          this.zones.push({ type: PIERRES, x, y, r: RAYON_ZONE_PIERRE, t0: this.tick, ti: this.tick + annonce + i * this.dur(ECART_PIERRES), rang: 0, x2: 0, y2: 0, dash: 0 });
        }
      }
      return;
    }
    if (g.kind === B_DUC) g.sol = 1;
    g.etat = RECUPERE;
    g.t = 0;
    g.recup = this.dur(RECUP_BOSS[g.attaque]![ph]!);
  }

  /** Un point ramené dans le disque de l'arène (à `marge` du bord). */
  private dansLArene(x: number, y: number, marge: number): [number, number] {
    const dx = x - this.ax;
    const dy = y - this.ay;
    const d = isqrt(dx * dx + dy * dy);
    const max = RAYON_ARENE - marge;
    return d > max ? [this.ax + idiv(dx * max, d), this.ay + idiv(dy * max, d)] : [x, y];
  }

  /** La distance, depuis (px, py) dans la direction `u` (vecteur de 1 024), jusqu'au bord de l'arène (à `marge` du bord). */
  private jusquAuBord(px: number, py: number, ux: number, uy: number, marge: number): number {
    const R = RAYON_ARENE - marge;
    const qx = px - this.ax;
    const qy = py - this.ay;
    const b = idiv(qx * ux + qy * uy, 1024);
    const disc = b * b - (qx * qx + qy * qy - R * R);
    return disc < 0 ? 0 : Math.max(0, -b + isqrt(disc));
  }

  /** La course qui part de (px, py) vers (tx, ty) et dépasse la cible de `depasse`, arrêtée au bord de l'arène (à `marge`) : où elle finit, sa longueur et si elle finit CONTRE le bord. */
  private finDeCourse(px: number, py: number, tx: number, ty: number, depasse: number, marge: number): { x2: number; y2: number; len: number; mur: boolean } {
    let [ux, uy] = unitaire(tx - px, ty - py);
    if (ux === 0 && uy === 0) [ux, uy] = [1024, 0];
    const voulu = distance(px, py, tx, ty) + depasse;
    const bord = this.jusquAuBord(px, py, ux, uy, marge);
    const len = Math.min(voulu, bord);
    return { x2: px + idiv(ux * len, 1024), y2: py + idiv(uy * len, 1024), len, mur: voulu >= bord - cm(30) };
  }

  /** Des gelées naissent : invoquées par le chêne (`sbire` 1) ou issues de la reine qui se divise (2, plus petites). Elles poursuivent le chevalier partout et ne lâchent pas d'XP. */
  private naitre(x: number, y: number, sbire: number): void {
    if (this.monstres.filter((m) => m.sbire !== 0 && m.hp > 0).length >= MAX_SBIRES) return;
    const [nx, ny] = this.dansLArene(x, y, cm(60));
    this.monstres.push({ id: this.prochainId++, type: GELEE, x: nx, y: ny, kx: 0, ky: 0, hp: sbire === 2 ? VIE_PETITE : VIE_GELEE, flash: 0, etat: ORBITE, t: this.rng.int(20), age: this.tick, a: 0, sens: 1, cx: 0, cy: 0, gel: sbire === 2 ? 300 : 60, duree: 999, coup: 0, hx: nx, hy: ny, alerte: 1, laisse: 0, ra: 0, sbire });
  }

  /** La reine se divise à chaque seuil de vie franchi (un quart, la moitié, puis chaque huitième) : trois petites gelées naissent autour d'elle. */
  private diviser(g: Golem): void {
    const base = this.rng.int(128);
    for (let i = 0; i < REINE_PETITES; i++) {
      const ang = modDir(base + idiv(i * 128, REINE_PETITES));
      const r = g.r + cm(150);
      this.naitre(g.x + idiv(COS[ang]! * r, 1024), g.y + idiv(SIN[ang]! * r, 1024), 2);
    }
    this.ev("division", g.x, g.y, REINE_PETITES);
  }

  private lancerAttaque(g: Golem, dChevalier: number): void {
    if (g.kind !== B_GOLEM) return this.lancerAutre(g);
    const c = this.c;
    const suite = g.phase === 2 ? [POING, ONDE, PIERRES, POING, PIERRES, ONDE] : [POING, PIERRES, POING, ONDE];
    let a = suite[g.compteur % suite.length]!;
    g.compteur++;
    if (a === POING && dChevalier > cm(700)) a = PIERRES; // trop loin pour un coup de poing
    g.attaque = a;
    g.etat = ANNONCE;
    g.t = 0;
    const maintenant = this.tick;
    const annonce = this.dur(ANNONCE_GOLEM[g.phase === 2 ? 1 : 0]);
    g.t1 = annonce;
    if (a === POING) {
      // Le cercle est posé là où le chevalier se tient : il a le temps de partir.
      const tx = c.x;
      const ty = c.y;
      this.zones.push({ type: POING, x: tx, y: ty, r: RAYON_ZONE_POING, t0: maintenant, ti: maintenant + annonce, rang: 0, x2: 0, y2: 0, dash: 0 });
      // Phase 2 : le second coup est annoncé à l'impact du premier, sur le chevalier (voir `resoudreZones`), avec la même annonce.
      g.duree = g.phase === 2 ? annonce * 2 : annonce;
      this.ev("annonce", tx, ty, POING);
    } else if (a === ONDE) {
      this.zones.push({ type: ONDE, x: g.x, y: g.y, r: RAYON_ONDE, t0: maintenant, ti: maintenant + annonce, rang: 0, x2: 0, y2: 0, dash: 0 });
      g.duree = g.phase === 2 ? annonce + this.dur(ECART_ONDES) : annonce;
      this.ev("annonce", g.x, g.y, ONDE);
    } else {
      const n = g.phase === 2 ? 5 : 3;
      const ecart = this.dur(ECART_PIERRES);
      for (let i = 0; i < n; i++) {
        let x = c.x;
        let y = c.y;
        if (i > 0) {
          const ang = this.rng.int(128);
          const r = cm(200) + this.rng.int(cm(450));
          x += idiv(COS[ang]! * r, 1024);
          y += idiv(SIN[ang]! * r, 1024);
          const dx = x - this.ax;
          const dy = y - this.ay;
          const d = isqrt(dx * dx + dy * dy);
          const max = RAYON_ARENE - cm(100);
          if (d > max) {
            x = this.ax + idiv(dx * max, d);
            y = this.ay + idiv(dy * max, d);
          }
        }
        this.zones.push({ type: PIERRES, x, y, r: RAYON_ZONE_PIERRE, t0: maintenant, ti: maintenant + annonce + i * ecart, rang: 0, x2: 0, y2: 0, dash: 0 });
      }
      g.duree = annonce + (n - 1) * ecart;
      this.ev("annonce", c.x, c.y, PIERRES);
    }
  }

  /** L'attaque de la reine, du grand-duc, du bélier ou du chêne. **Toute annonce dure 70 ticks en phase 1 et 50 en phase 2 au moins** (celle d'une course compte avant le départ du boss), comme celle du golem. */
  private lancerAutre(g: Golem): void {
    const c = this.c;
    const ph2 = g.phase === 2;
    const maintenant = this.tick;
    const annonce = this.dur(ANNONCE_GOLEM[ph2 ? 1 : 0]);
    g.etat = ANNONCE;
    g.t = 0;
    g.t1 = annonce;
    g.ft = 0;
    g.mur = 0;
    const zone = (type: number, x: number, y: number, r: number, ti: number, rang = 0, x2 = 0, y2 = 0, dash = 0): void => void this.zones.push({ type, x, y, r, t0: maintenant, ti, rang, x2, y2, dash });
    if (g.kind === B_REINE) {
      // Un bond écrasant sur le chevalier ; en phase 2, un second bond annoncé sur lui à l'impact du premier (comme le poing du golem).
      g.attaque = BOND;
      zone(POING, c.x, c.y, REINE_ZONE, maintenant + annonce);
      g.duree = ph2 ? annonce * 2 : annonce;
      this.ev("annonce", c.x, c.y, BOND);
    } else if (g.kind === B_DUC) {
      // Un plongeon en ligne vers le chevalier (la bande est posée là où il se tient) ; en phase 2 un second, croisé, annoncé en même temps.
      g.attaque = PLONGEON_DUC;
      const v = this.vitesse(DUC_VITESSE_PLONGEON);
      const t1 = this.finDeCourse(g.x, g.y, c.x, c.y, DUC_DEPASSE, g.r + cm(60));
      const d1 = Math.max(12, idiv(t1.len + v - 1, v));
      const ti1 = maintenant + annonce + d1;
      zone(Z_BANDE, g.x, g.y, DUC_BANDE, ti1, 0, t1.x2, t1.y2, d1);
      g.duree = annonce + d1;
      this.ev("annonce", c.x, c.y, PLONGEON_DUC);
      if (ph2) {
        // la seconde bande traverse la première, à angle droit, par la place du chevalier
        let [ux, uy] = unitaire(t1.x2 - g.x, t1.y2 - g.y);
        if (ux === 0 && uy === 0) [ux, uy] = [1024, 0];
        const signe = this.rng.int(2) === 0 ? 1 : -1;
        const wx = -uy * signe;
        const wy = ux * signe;
        const avant = Math.min(cm(1200), this.jusquAuBord(c.x, c.y, wx, wy, g.r + cm(60)));
        const px = c.x + idiv(wx * avant, 1024);
        const py = c.y + idiv(wy * avant, 1024);
        const t2 = this.finDeCourse(px, py, c.x, c.y, DUC_DEPASSE, g.r + cm(60));
        const d2 = Math.max(12, idiv(t2.len + v - 1, v));
        const ti2 = ti1 + this.dur(DUC_TRANSIT) + d2;
        zone(Z_BANDE, px, py, DUC_BANDE, ti2, 1, t2.x2, t2.y2, d2);
        g.duree = ti2 - maintenant;
      }
    } else if (g.kind === B_BELIER) {
      // Une charge en ligne droite vers le chevalier ; contre le muret il est étourdi (voir `finAnnonce`) ; en phase 2, si elle ne l'a pas atteint, une seconde enchaînée (voir `resoudreBande`).
      g.attaque = CHARGE;
      const t1 = this.finDeCourse(g.x, g.y, c.x, c.y, BELIER_DEPASSE, g.r);
      const d1 = Math.max(12, idiv(t1.len + this.vitesse(BELIER_VITESSE_CHARGE) - 1, this.vitesse(BELIER_VITESSE_CHARGE)));
      g.mur = t1.mur ? 1 : 0;
      zone(Z_BANDE, g.x, g.y, BELIER_BANDE, maintenant + annonce + d1, 0, t1.x2, t1.y2, d1);
      g.duree = annonce + d1 + 1; // un tick de plus : la charge enchaînée se décide à l'arrivée, avant la fin de l'annonce
      this.ev("annonce", c.x, c.y, CHARGE);
    } else {
      // Le vieux chêne : une suite d'attaques, sans bouger.
      const suite = SUITE_CHENE[ph2 ? 1 : 0]!;
      const a = suite[g.compteur % suite.length]!;
      g.compteur++;
      g.attaque = a;
      g.duree = annonce;
      if (a === RACINES_LIGNES) {
        // une racine droit sur le chevalier et une de travers ; en phase 2, six en étoile
        const k0 = dirVers(c.x - g.x, c.y - g.y);
        const sens = this.rng.int(2) === 0 ? 1 : -1;
        const angles = ph2 ? [0, 21, 43, 64, 85, 107] : [0, 14 * sens];
        for (const da of angles) {
          const k = modDir(k0 + da);
          zone(Z_BANDE, g.x, g.y, CHENE_BANDE, maintenant + annonce, 0, g.x + idiv(COS[k]! * CHENE_LONGUEUR, 1024), g.y + idiv(SIN[k]! * CHENE_LONGUEUR, 1024), 0);
        }
        this.ev("annonce", c.x, c.y, RACINES_LIGNES);
      } else if (a === RACINES_CERCLES) {
        const ecart = this.dur(ECART_CERCLES);
        for (let i = 0; i < 4; i++) {
          let x = c.x;
          let y = c.y;
          if (i > 0) {
            const ang = this.rng.int(128);
            const r = cm(200) + this.rng.int(cm(450));
            [x, y] = this.dansLArene(x + idiv(COS[ang]! * r, 1024), y + idiv(SIN[ang]! * r, 1024), cm(100));
          }
          zone(PIERRES, x, y, CHENE_CERCLE, maintenant + annonce + i * ecart);
        }
        g.duree = annonce + 3 * ecart;
        this.ev("annonce", c.x, c.y, RACINES_CERCLES);
      } else if (a === SPORES) {
        zone(Z_SPORES, c.x, c.y, CHENE_SPORES[ph2 ? 1 : 0]!, maintenant + annonce);
        this.ev("annonce", c.x, c.y, SPORES);
      } else {
        // 2 ou 3 gelées naîtront autour de lui
        const n = 2 + this.rng.int(2);
        const base = this.rng.int(128);
        for (let i = 0; i < n; i++) {
          const ang = modDir(base + idiv(i * 128, n));
          const r = g.r + cm(280);
          const [x, y] = this.dansLArene(g.x + idiv(COS[ang]! * r, 1024), g.y + idiv(SIN[ang]! * r, 1024), cm(100));
          zone(Z_INVOCATION, x, y, cm(90), maintenant + annonce);
        }
        this.ev("annonce", g.x, g.y, INVOCATION);
      }
    }
  }

  /** Une bande arrive à son terme : qui y est encore est blessé ; le boss qui la parcourait est arrivé (le bélier de phase 2 enchaîne une seconde charge s'il n'a pas touché le muret). */
  private resoudreBande(z: Zone, g: Golem | null, restantes: Zone[]): void {
    const c = this.c;
    const [px, py] = pointDuSegment(c.x, c.y, z.x, z.y, z.x2, z.y2);
    this.ev("impact", z.x2, z.y2, Z_BANDE, z.r);
    if (distance2(c.x, c.y, px, py) < z.r * z.r) this.blesser(px, py, 1);
    if (!g || z.dash === 0) return;
    g.x = z.x2;
    g.y = z.y2;
    g.ex = z.x2;
    g.ey = z.y2;
    g.ft = this.tick;
    if (g.kind === B_BELIER && g.phase === 2 && g.mur === 0 && z.rang === 0 && g.etat === ANNONCE) {
      const annonce = this.dur(ANNONCE_GOLEM[1]);
      const v = this.vitesse(BELIER_VITESSE_CHARGE);
      const t2 = this.finDeCourse(g.x, g.y, c.x, c.y, BELIER_DEPASSE, g.r);
      const d2 = Math.max(12, idiv(t2.len + v - 1, v));
      g.mur = t2.mur ? 1 : 0;
      restantes.push({ type: Z_BANDE, x: g.x, y: g.y, r: BELIER_BANDE, t0: this.tick, ti: this.tick + annonce + d2, rang: 1, x2: t2.x2, y2: t2.y2, dash: d2 });
      g.duree = g.t + annonce + d2 + 1;
      this.ev("annonce", c.x, c.y, CHARGE);
    }
  }

  private resoudreZones(): void {
    if (this.zones.length === 0) return;
    const restantes: Zone[] = [];
    for (const z of this.zones) {
      if (this.tick < z.ti) {
        restantes.push(z);
        continue;
      }
      const g = this.golem;
      if (z.type === ONDE) {
        this.ondes.push({ x: z.x, y: z.y, r: g ? g.r : RAYON_GOLEM, vitesse: this.vOnde(), epaisseur: cm(110), rMax: z.r + cm(80), touche: false });
        this.ev("onde", z.x, z.y);
        // Phase 2 : une seconde onde, `ECART_ONDES` ticks plus tard (plus que l'attente de l'esquive : elle doit pouvoir se refaire).
        if (g && g.phase === 2 && g.etat === ANNONCE && g.attaque === ONDE && z.rang === 0) restantes.push({ type: ONDE, x: z.x, y: z.y, r: z.r, t0: this.tick, ti: this.tick + this.dur(ECART_ONDES), rang: 1, x2: 0, y2: 0, dash: 0 });
        continue;
      }
      if (z.type === Z_BANDE) {
        this.resoudreBande(z, g, restantes);
        continue;
      }
      if (z.type === Z_SPORES) {
        this.nuages.push({ x: z.x, y: z.y, r: z.r, t0: this.tick, fin: this.tick + this.dur(SPORES_DUREE) });
        this.ev("nuage", z.x, z.y, z.r);
        continue;
      }
      if (z.type === Z_INVOCATION) {
        this.naitre(z.x, z.y, 1);
        this.ev("invoque", z.x, z.y);
        continue;
      }
      this.ev("impact", z.x, z.y, z.type, z.r);
      if (distance2(this.c.x, this.c.y, z.x, z.y) < z.r * z.r) this.blesser(z.x, z.y, 1);
      // Phase 2 : le second coup (poing du golem, bond de la reine) est annoncé sur le chevalier, là où il se tient à l'impact du premier, avec la même annonce.
      if (z.type === POING && g && g.phase === 2 && g.etat === ANNONCE && z.rang === 0) restantes.push({ type: z.type, x: this.c.x, y: this.c.y, r: z.r, t0: this.tick, ti: this.tick + g.t1, rang: 1, x2: 0, y2: 0, dash: 0 });
    }
    this.zones = restantes;
  }

  /** Les nuages de spores : qui reste dedans perd un cœur (l'invincibilité des dégâts le protège ensuite 1,5 s) ; ils s'éteignent à leur fin. */
  private majNuages(): void {
    if (this.nuages.length === 0) return;
    const c = this.c;
    this.nuages = this.nuages.filter((n) => this.tick < n.fin);
    for (const n of this.nuages) if (distance2(c.x, c.y, n.x, n.y) < n.r * n.r) this.blesser(n.x, n.y, 1);
  }

  /** La vitesse d'une onde du golem, en unités par tick (au rythme de la partie) : le pilote la lit. */
  vOnde(): number {
    return this.vitesse(950);
  }

  private avancerOndes(): void {
    if (this.ondes.length === 0) return;
    for (const o of this.ondes) {
      o.r += o.vitesse;
      if (!o.touche) {
        const d = distance(this.c.x, this.c.y, o.x, o.y);
        if (Math.abs(d - o.r) < idiv(o.epaisseur, 2) + idiv(RAYON_CHEVALIER, 2)) {
          if (this.vulnerable()) {
            o.touche = true;
            this.blesser(o.x, o.y, 1);
          } else if (this.c.esq > 0) {
            o.touche = true;
            this.ev("frole", this.c.x, this.c.y);
          }
        }
      }
    }
    this.ondes = this.ondes.filter((o) => o.r < o.rMax);
  }

  private gagner(): void {
    this.victoire = true;
    this.finTick = this.tick;
    this.zones = [];
    this.ondes = [];
    this.nuages = [];
    if (this.golem) this.ev("victoire", this.golem.x, this.golem.y);
  }

  // --- Les dégâts au chevalier ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private vulnerable(): boolean {
    return this.c.esq === 0 && this.c.degat === 0;
  }

  private contacts(): void {
    const c = this.c;
    if (!this.vulnerable() || this.contenu.scenario === "mannequin") return;
    for (const m of this.monstres) {
      if (m.hp <= 0 || m.gel > 0) continue;
      if (m.type === CHAUVE && m.etat === REPOS) continue;
      // Lot BR5 : un gélaton ne blesse que PENDANT SON BOND (le danger est annoncé, lisible) : on peut traverser une meute qui s'écrase ou se repose pour la faucher.
      if (m.type === GELATON && !(m.t >= this.durees.gelatonAnnonce && m.t < this.durees.gelatonAnnonce + this.durees.gelatonBond)) continue;
      const somme = rayonDe(m.type) + RAYON_CHEVALIER;
      if (distance2(c.x, c.y, m.x, m.y) < somme * somme) {
        m.gel = 40;
        const [ux, uy] = unitaire(m.x - c.x, m.y - c.y);
        m.kx = idiv(ux * cm(30), 1024);
        m.ky = idiv(uy * cm(30), 1024);
        if (m.type === CHAUVE) {
          m.etat = REPOS;
          m.t = 0;
        }
        this.blesser(m.x, m.y, 1);
        return;
      }
    }
  }

  private blesser(sx: number, sy: number, n: number): void {
    const c = this.c;
    if (!this.vulnerable()) {
      if (c.esq > 0) this.ev("frole", c.x, c.y);
      return;
    }
    c.coeurs -= n;
    this.subis += n;
    c.degat = ARRET_DEGAT;
    c.calme = 0;
    c.elan = 0;
    const [ux, uy] = unitaire(c.x - sx, c.y - sy);
    const dx = ux === 0 && uy === 0 ? 0 : ux;
    const dy = ux === 0 && uy === 0 ? 1024 : uy;
    c.kx = idiv(dx * cm(48), 1024);
    c.ky = idiv(dy * cm(48), 1024);
    // Lot BR5 : un dégât ne coupe pas une compétence (le tourbillon est un blindage ; le bond est invulnérable en l'air)
    if (c.etat !== COMPETENCE) {
      c.etat = LIBRE;
      c.t = 0;
    }
    c.tampon = 0;
    c.reprise = 0;
    c.combo = 0;
    c.fente = 0;
    this.ev("degats", c.x, c.y, c.coeurs);
    if (c.coeurs <= 0) {
      if (this.immortel) {
        c.coeurs = c.coeursMax;
        c.degat = 150;
        this.ev("sauve", c.x, c.y);
      } else {
        this.perdue = true;
        this.finTick = this.tick;
        this.ev("defaite", c.x, c.y);
      }
    }
  }

  // --- Les déplacements ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Un déplacement. Sans niveau (les scénarios) : le disque de l'arène. Dans le niveau (lot BR1) : la GRILLE — le chevalier et les gelées glissent le long des murs, du vide et des bords de pont (un axe après l'autre), la chauve-souris vole
   * par-dessus — puis, une fois la barrière refermée, le disque de l'arène retient le chevalier (et ce qui est dans l'arène).
   */
  private deplacer(e: { x: number; y: number }, dx: number, dy: number): void {
    if (!this.niveau) {
      e.x += dx;
      e.y += dy;
      this.dansArene(e, e === this.c ? RAYON_CHEVALIER : 0);
      return;
    }
    if (e === this.c) {
      if (this.barriere >= 0) {
        e.x += dx;
        e.y += dy;
        this.dansArene(e, RAYON_CHEVALIER);
      } else this.glisser(e, dx, dy, RAYON_CHEVALIER);
      return;
    }
    const m = e as Monstre;
    if (m.type === CHAUVE) {
      e.x += dx;
      e.y += dy;
    } else this.glisser(e, dx, dy, RAYON_GELEE);
    if (this.barriere >= 0) this.dansArene(e, 0);
  }

  /** Les monstres qui se repoussent : dans le niveau, un monstre au sol ne traverse pas les murs. */
  private pousserMonstre(m: Monstre, dx: number, dy: number): void {
    if (this.niveau) this.deplacer(m, dx, dy);
    else {
      m.x += dx;
      m.y += dy;
    }
  }

  /** La case sous le point est marchable (et la porte est fermée ou non). */
  private marchable(x: number, y: number): boolean {
    const n = this.niveau!;
    const idx = caseDe(n, x, y);
    if (idx < 0) return false;
    const c = n.cases[idx]!;
    return (c === SOL || c === PONT) && !(this.barriere >= 0 && this.porte.has(idx));
  }

  /** Un disque de rayon `r` tient en (x, y) : les quatre coins de son carré sont sur des cases marchables (une case fait 2 m, plus que tout corps). */
  private libre(x: number, y: number, r: number): boolean {
    return this.marchable(x - r, y - r) && this.marchable(x + r, y - r) && this.marchable(x - r, y + r) && this.marchable(x + r, y + r);
  }

  private glisser(e: { x: number; y: number }, dx: number, dy: number, r: number): void {
    // Coincé dans un mur (la porte vient de se fermer sur lui) : on le laisse sortir.
    if (!this.libre(e.x, e.y, r)) {
      e.x += dx;
      e.y += dy;
      return;
    }
    if (this.libre(e.x + dx, e.y, r)) e.x += dx;
    if (this.libre(e.x, e.y + dy, r)) e.y += dy;
  }

  private dansArene(e: { x: number; y: number }, rayon: number): void {
    if (this.niveau && this.barriere < 0) return;
    const max = RAYON_ARENE - rayon;
    const dx = e.x - this.ax;
    const dy = e.y - this.ay;
    const d2 = dx * dx + dy * dy;
    // Dans le niveau, ce qui est resté dehors (un monstre poursuivant) n'est pas ramené dans l'arène.
    if (this.niveau && e !== this.c && d2 > (RAYON_ARENE + cm(100)) * (RAYON_ARENE + cm(100))) return;
    if (d2 > max * max) {
      const d = isqrt(d2);
      e.x = this.ax + idiv(dx * max, d);
      e.y = this.ay + idiv(dy * max, d);
    }
  }

  private pousserHorsDuGolem(e: { x: number; y: number }, rayon = RAYON_CHEVALIER): void {
    const g = this.golem;
    if (!g || g.hp <= 0 || g.sol === 0) return; // le grand-duc en vol ne pousse personne
    const somme = g.r + rayon;
    const dx = e.x - g.x;
    const dy = e.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= somme * somme) return;
    const d = isqrt(d2);
    const [ux, uy] = d === 0 ? [0, 1024] : unitaire(dx, dy);
    e.x = g.x + idiv(ux * somme, 1024);
    e.y = g.y + idiv(uy * somme, 1024);
    this.dansArene(e, rayon);
  }
}

/** Le recul décroît de 20 % par tick et s'éteint sous 8 unités. */
function amortir(v: number): number {
  const n = v - idiv(v, 5);
  return Math.abs(n) < 8 ? 0 : n;
}

/** Le point du segment (ax, ay)-(bx, by) le plus proche de (px, py). */
export function pointDuSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return [ax, ay];
  // t en 1 024es, borné à [0, 1 024]
  const t = Math.max(0, Math.min(1024, idiv(((px - ax) * dx + (py - ay) * dy) * 1024, l2)));
  return [ax + idiv(dx * t, 1024), ay + idiv(dy * t, 1024)];
}
