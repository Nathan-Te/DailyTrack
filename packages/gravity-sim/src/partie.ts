import { avancerCamera, vitesseCamera } from "./camera";
import {
  AIMANT_PART,
  AIMANT_RAYON,
  AIMANT_TICKS,
  BONUS_PORTEE,
  BORD_MARGE,
  BORD_RETOUR,
  CASE,
  CIBLE_CAMERA,
  DEPART_X,
  DEPART_Y,
  DUREE_MAX_TICKS,
  AVANCE_MAX,
  GEMME_PORTEE,
  GRACE,
  GRAVITE,
  INVULNERABILITE,
  LARGEUR_MORCEAU,
  LIGNES,
  MORCEAUX_PAR_THEME,
  MULT_MAX,
  PIECE_MANQUEE,
  PIECE_PORTEE,
  PIECES_PAR_PALIER,
  PIQUE_X0,
  PIQUE_X1,
  PIQUE_Y0,
  PIQUE_Y1,
  POINTS_GEMME,
  POINTS_PIECE,
  RATTRAPAGE,
  SAUVETAGE_VY,
  SAUVETAGE_Y_BAS,
  SAUVETAGE_Y_HAUT,
  TAILLE,
  TAMPON,
  TAPIS_DEN,
  TAPIS_NUM,
  TICKS_PAR_SECONDE,
  VENT_GRAVITE,
  VENT_POUSSEE,
  VENT_VY_MIN,
  VIDE_BAS,
  VIDE_HAUT,
  VY_MAX,
} from "./constantes";
import { GLACE, INVERSEUR, PIQUE, TAPIS, VENT, solide, type Terrain } from "./monde";

// La partie de Gravity : **entière, un pas = 1/120 s**. Le joueur court vers la droite à la vitesse de la caméra ; **la seule entrée est un appui** (`appuyer`), qui inverse la gravité s'il y a une surface sous les
// pieds (ou si on vient de la quitter : temps de grâce), jamais sur la glace ; un appui juste avant un contact est gardé (tampon). Tout est en unités du monde (1 case = 4 096) et en unités par seconde, **aucun flottant** :
// la physique est celle de la fonction `pas()` de la maquette, à ses constantes (`constantes.ts`), avec les deux défauts de la maquette corrigés (voir `pas`, `placerLibre`).
//
// À chaque pas : (1) la caméra avance ; (2) un appui gardé, si l'on touche une surface, inverse la gravité ; (3) la course (la caméra + 4,2 cases est visée, rattrapage si on a du retard, tapis × 1,35, un mur arrête) ;
// (4) la chute (gravité, vent, collision par axe) ; (5) le ramassage (aimant, pièces, gemmes, bonus) ; (6) les morts (le vide, le bord gauche). Le pique est testé à chaque collision. **Le bouclier sauve une fois**
// puis laisse 0,8 s d'invulnérabilité.

export const MORT_VIDE = 1;
export const MORT_PIQUE = 2;
export const MORT_BORD = 3;
export const MORT_TEMPS = 4;
export type CauseDeMort = 1 | 2 | 3 | 4;

/** Ce qui vient de se passer pendant le dernier pas (des drapeaux, pour le rendu et les sons : ils n'entrent jamais dans la suite de la partie). */
export const EV_INVERSION = 1;
export const EV_ATTERRISSAGE = 2;
export const EV_PIECE = 4;
export const EV_GEMME = 8;
export const EV_BONUS = 16;
export const EV_BOUCLIER = 32;
export const EV_INVERSEUR = 64;
export const EV_MORT = 128;
export const EV_MANQUEE = 256;

/** Une pièce en cours de partie : sa position (l'aimant la déplace), son état (0 libre, 1 prise, 2 manquée). */
export interface PieceEtat {
  x: number;
  y: number;
  etat: 0 | 1 | 2;
}
/** L'état des objets d'un morceau : ses pièces, ses gemmes et ses bonus (pris ou non). */
export interface ChargeMorceau {
  pieces: PieceEtat[];
  gemmes: boolean[];
  bonus: boolean[];
}

export interface Resultat {
  /** Le score : la distance plus les points des pièces et des gemmes. */
  score: number;
  /** La distance en mètres depuis le départ. */
  distance: number;
  pieces: number;
  gemmes: number;
  /** Le plus haut multiplicateur atteint. */
  multMax: number;
  /** Les pas joués (la partie finit au plus à `DUREE_MAX_TICKS`). */
  ticks: number;
  /** Pourquoi elle a fini : `MORT_*`. */
  cause: CauseDeMort;
  /** Les appuis donnés. */
  appuis: number;
  /** Les inversions de gravité faites. */
  inversions: number;
}

const idiv = (a: number, b: number): number => Math.trunc(a / b);
// 1 case = 4 096 = 2^12 : un décalage arithmétique est la division par une case, arrondie vers le bas (justement pour les positions négatives).
const CASE_BITS = 12;
const enCases = (u: number): number => u >> CASE_BITS;
const DEMI_JOUEUR = TAILLE >> 1;
const CASES_PAR_MORCEAU = LARGEUR_MORCEAU * CASE;

export class Partie {
  tick = 0;
  /** La caméra (le bord gauche de l'écran) et le joueur (le coin haut-gauche de sa boîte), en unités. */
  cam = 0;
  x = DEPART_X;
  y = DEPART_Y;
  vy = 0;
  /** +1 : la gravité tire vers le bas ; −1 : vers le haut. */
  g: 1 | -1 = 1;
  /** Posé sur une surface (dans le sens de la gravité) au dernier pas, et laquelle (le type de la case). */
  sol = false;
  surface = 0;
  /** Les pas restants du temps de grâce (on vient de quitter un bord) et du tampon (un appui attend un contact). */
  grace = 0;
  tampon = 0;
  /** Les pas restants d'invulnérabilité (après un bouclier) et d'aimant. */
  invuln = 0;
  aimant = 0;
  bouclier = false;
  pieces = 0;
  gemmes = 0;
  points = 0;
  chaine = 0;
  mult = 1;
  multMax = 1;
  appuis = 0;
  inversions = 0;
  /** 0 tant que la partie dure ; sinon `MORT_*`. */
  mort: 0 | CauseDeMort = 0;
  /** Les événements du dernier pas (`EV_*`). */
  ev = 0;
  /** Les positions avant le dernier pas : le rendu interpole entre elles et les actuelles. */
  precX = DEPART_X;
  precY = DEPART_Y;
  precCam = 0;
  /** Vrai si un essai (`sauterAuThemeSuivant`) a déplacé le joueur : la partie n'est plus rejouable, elle n'est jamais classée. */
  essai = false;
  /** Les objets, morceau par morceau (chargés à la demande, dans l'ordre : `charge(k)`). */
  charges: ChargeMorceau[] = [];

  // Le résultat de la dernière collision (`heurte`), sans allocation.
  private hCx = 0;
  private hCy = 0;
  private hType = 0;

  constructor(readonly terrain: Terrain) {}

  get finie(): boolean {
    return this.mort !== 0;
  }
  /** La distance en mètres depuis le départ (le joueur ne recule jamais). */
  get distance(): number {
    return enCases(this.x - DEPART_X);
  }
  get score(): number {
    return this.distance + this.points;
  }
  /** Le numéro du thème en cours (0 à 4 dans l'ordre du jour, puis la boucle). */
  get rangDuTheme(): number {
    return idiv(idiv(this.x, CASES_PAR_MORCEAU), MORCEAUX_PAR_THEME);
  }
  /** L'appui est-il pris en compte maintenant (une surface sous les pieds ou quittée à l'instant, et pas de glace) ? */
  get peutInverser(): boolean {
    return (this.sol || this.grace > 0) && this.surface !== GLACE;
  }

  /** L'état des objets du morceau `k` (les morceaux avant lui sont chargés aussi). */
  charge(k: number): ChargeMorceau {
    while (this.charges.length <= k) {
      const m = this.terrain.morceau(this.charges.length);
      this.charges.push({ pieces: m.pieces.map((p) => ({ x: p.x, y: p.y, etat: 0 as const })), gemmes: m.gemmes.map(() => false), bonus: m.bonus.map(() => false) });
    }
    return this.charges[k]!;
  }

  /** Le joueur touche l'écran à ce pas (avant `avancer`) : l'appui est gardé 14 pas (0,12 s). */
  appuyer(): void {
    if (this.mort !== 0) return;
    this.appuis++;
    this.tampon = TAMPON;
  }

  /** Une copie indépendante de l'état (pour essayer un coup à l'avance : le robot, les tests). Le terrain est partagé (il est immuable). */
  copier(): Partie {
    const c = new Partie(this.terrain);
    Object.assign(c, this);
    c.charges = this.charges.map((ch) => ({ pieces: ch.pieces.map((p) => ({ ...p })), gemmes: [...ch.gemmes], bonus: [...ch.bonus] }));
    return c;
  }

  /** Un pas de la partie. */
  avancer(): void {
    if (this.mort !== 0) return;
    this.ev = 0;
    this.precX = this.x;
    this.precY = this.y;
    this.precCam = this.cam;
    this.pas();
    this.tick++;
    if (this.tampon > 0) this.tampon--;
    if (this.grace > 0) this.grace--;
    if (this.mort === 0 && this.tick >= DUREE_MAX_TICKS) this.mort = MORT_TEMPS;
  }

  resultat(): Resultat {
    return { score: this.score, distance: this.distance, pieces: this.pieces, gemmes: this.gemmes, multMax: this.multMax, ticks: this.tick, cause: (this.mort || MORT_TEMPS) as CauseDeMort, appuis: this.appuis, inversions: this.inversions };
  }

  /** Les cases qui touchent la boîte en `(px, py)` : 0 rien, 1 une case solide (sa place dans `hCx` / `hCy`), 2 un pique (sa boîte réduite est touchée). Le pique l'emporte sur le reste (comme dans la maquette). */
  private heurte(px: number, py: number): number {
    const x0 = enCases(px);
    const x1 = enCases(px + TAILLE - 1);
    const y0 = enCases(py);
    const y1 = enCases(py + TAILLE - 1);
    let res = 0;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0) continue;
      const k = idiv(cx, LARGEUR_MORCEAU);
      const morceau = this.terrain.morceau(k);
      const base = (cx - k * LARGEUR_MORCEAU) * LIGNES;
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= LIGNES) continue;
        const type = morceau.cases[base + cy]!;
        if (type === PIQUE) {
          const gx = cx * CASE;
          const gy = cy * CASE;
          if (px + TAILLE > gx + PIQUE_X0 && px < gx + PIQUE_X1 && py + TAILLE > gy + PIQUE_Y0 && py < gy + PIQUE_Y1) return 2;
        } else if (res === 0 && solide(type, this.tick, morceau.decalage)) {
          res = 1;
          this.hCx = cx;
          this.hCy = cy;
          this.hType = type;
        }
      }
    }
    return res;
  }

  private typeEn(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cy >= LIGNES) return 0;
    const k = idiv(cx, LARGEUR_MORCEAU);
    return this.terrain.morceau(k).cases[(cx - k * LARGEUR_MORCEAU) * LIGNES + cy]!;
  }

  private pas(): void {
    // La caméra : sa vitesse monte avec la distance.
    const vitesse = vitesseCamera(this.cam);
    this.cam = avancerCamera(this.cam);

    // L'inversion : seulement au contact d'une surface (le tampon garde l'appui, la grâce le laisse passer après un bord), jamais sur la glace.
    // **Défaut de la maquette (a)** : elle donnait `vy = −g × 2` (un élan vers la surface qu'on quitte) que le sol annulait aussitôt. L'élan est donc nul ici : même jeu, sans un pas perdu.
    if (this.tampon > 0 && this.peutInverser) {
      this.g = (this.g === 1 ? -1 : 1) as 1 | -1;
      this.sol = false;
      this.grace = 0;
      this.tampon = 0;
      this.vy = 0;
      this.inversions++;
      this.ev |= EV_INVERSION;
    }

    // L'horizontal : la course, rattrapage si on a du retard, un mur arrête.
    const cible = this.cam + CIBLE_CAMERA;
    let vx = this.surface === TAPIS && this.sol ? idiv(vitesse * TAPIS_NUM, TAPIS_DEN) : vitesse;
    if (this.x < cible) vx += RATTRAPAGE;
    if (this.x > cible + AVANCE_MAX) vx = idiv(vitesse * 9, 10);
    let nx = this.x + idiv(vx, TICKS_PAR_SECONDE);
    let h = this.heurte(nx, this.y);
    if (h === 2) {
      if (this.danger(MORT_PIQUE)) return;
      h = 0;
    }
    if (h === 1) nx = this.hCx * CASE - TAILLE - 1;
    if (nx > this.x) this.x = nx;

    // Le vertical : la gravité (ou le vent, qui porte vers le haut et allège la gravité), puis la collision.
    const dansVent = this.typeEn(enCases(this.x + DEMI_JOUEUR), enCases(this.y + DEMI_JOUEUR)) === VENT;
    this.vy += (dansVent ? -VENT_POUSSEE : 0) + this.g * (dansVent ? VENT_GRAVITE : GRAVITE);
    if (dansVent && this.vy < VENT_VY_MIN) this.vy = VENT_VY_MIN;
    if (this.vy > VY_MAX) this.vy = VY_MAX;
    else if (this.vy < -VY_MAX) this.vy = -VY_MAX;
    const etaitAuSol = this.sol;
    let ny = this.y + idiv(this.vy, TICKS_PAR_SECONDE);
    h = this.heurte(this.x, ny);
    this.sol = false;
    if (h === 2) {
      if (this.danger(MORT_PIQUE)) return;
      h = 0;
    }
    if (h === 1) {
      if (this.vy > 0) ny = this.hCy * CASE - TAILLE - 1;
      else ny = (this.hCy + 1) * CASE + 1;
      // On touche la surface seulement si on allait dans le sens de la gravité (sinon, c'est la tête qui cogne).
      if ((this.vy > 0 && this.g === 1) || (this.vy < 0 && this.g === -1)) {
        if (!etaitAuSol && Math.abs(this.vy) > 6 * CASE) this.ev |= EV_ATTERRISSAGE;
        this.sol = true;
        this.surface = this.hType;
        if (this.hType === INVERSEUR) {
          this.g = (this.g === 1 ? -1 : 1) as 1 | -1;
          this.sol = false;
          this.ev |= EV_INVERSEUR;
        }
      }
      this.vy = 0;
    }
    if (etaitAuSol && !this.sol) this.grace = GRACE + 1; // + 1 : le pas qui finit la décrémente aussitôt (8 pas de grâce pleins)
    this.y = ny;

    // Le ramassage : l'aimant attire les pièces proches (leur position fait partie de l'état), puis pièces, gemmes, bonus.
    const cxj = this.x + DEMI_JOUEUR;
    const cyj = this.y + DEMI_JOUEUR;
    if (this.aimant > 0) this.aimant--;
    if (this.invuln > 0) this.invuln--;
    const k0 = Math.max(0, idiv(this.cam - 8 * CASE, CASES_PAR_MORCEAU));
    const k1 = idiv(this.cam + 30 * CASE, CASES_PAR_MORCEAU);
    for (let k = k0; k <= k1; k++) {
      const charge = this.charge(k);
      const morceau = this.terrain.morceau(k);
      for (const p of charge.pieces) {
        if (p.etat !== 0 || p.x > this.cam + 30 * CASE) continue;
        if (this.aimant > 0) {
          const dx = p.x - cxj;
          const dy = p.y - cyj;
          if (dx * dx + dy * dy < AIMANT_RAYON * AIMANT_RAYON) {
            p.x += idiv(cxj - p.x, AIMANT_PART);
            p.y += idiv(cyj - p.y, AIMANT_PART);
          }
        }
        if (Math.abs(p.x - cxj) < PIECE_PORTEE && Math.abs(p.y - cyj) < PIECE_PORTEE) {
          p.etat = 1;
          this.pieces++;
          this.chaine++;
          this.mult = Math.min(MULT_MAX, 1 + idiv(this.chaine, PIECES_PAR_PALIER));
          if (this.mult > this.multMax) this.multMax = this.mult;
          this.points += POINTS_PIECE * this.mult;
          this.ev |= EV_PIECE;
        } else if (p.x < this.cam - PIECE_MANQUEE) {
          // Une pièce sortie de l'écran sans avoir été prise : le multiplicateur retombe.
          p.etat = 2;
          this.chaine = 0;
          this.mult = 1;
          this.ev |= EV_MANQUEE;
        }
      }
      morceau.gemmes.forEach((o, i) => {
        if (!charge.gemmes[i] && Math.abs(o.x - cxj) < GEMME_PORTEE && Math.abs(o.y - cyj) < GEMME_PORTEE) {
          charge.gemmes[i] = true;
          this.gemmes++;
          this.points += POINTS_GEMME * this.mult;
          this.ev |= EV_GEMME;
        }
      });
      morceau.bonus.forEach((o, i) => {
        if (!charge.bonus[i] && Math.abs(o.x - cxj) < BONUS_PORTEE && Math.abs(o.y - cyj) < BONUS_PORTEE) {
          charge.bonus[i] = true;
          if (o.type === "bouclier") this.bouclier = true;
          else this.aimant = AIMANT_TICKS;
          this.ev |= EV_BONUS;
        }
      });
    }

    // Les morts : le vide, en haut ou en bas ; le bord gauche de l'écran (le bouclier en sauve une).
    if (this.y < VIDE_HAUT || this.y > VIDE_BAS) {
      if (this.danger(MORT_VIDE)) return;
    }
    if (this.x < this.cam - BORD_MARGE) {
      if (this.danger(MORT_BORD)) return;
    }
  }

  /** Un danger (pique, vide, bord) : vrai si la partie est finie. En invulnérabilité ou avec le bouclier, on est sauvé (et le bouclier se consomme). */
  private danger(cause: CauseDeMort): boolean {
    if (this.invuln > 0) {
      this.sauver(cause);
      return false;
    }
    if (!this.bouclier) {
      this.mort = cause;
      this.ev |= EV_MORT;
      return true;
    }
    this.bouclier = false;
    this.invuln = INVULNERABILITE;
    this.ev |= EV_BOUCLIER;
    this.sauver(cause);
    return false;
  }

  /**
   * Le sauvetage. Le vide : replacé près de la surface d'en face et lancé vers elle (la gravité s'inverse). Le bord : replacé à 2 cases devant la caméra.
   * **Défaut de la maquette (b)** : elle posait `x = caméra + 2` sans regarder, donc parfois dans un mur ; ici on cherche l'emplacement libre le plus proche (`placerLibre`).
   */
  private sauver(cause: CauseDeMort): void {
    if (cause === MORT_VIDE) {
      const bas = this.y > (LIGNES - 1) * CASE;
      this.g = bas ? -1 : 1;
      const [x, y] = this.placerLibre(this.x, bas ? SAUVETAGE_Y_BAS : SAUVETAGE_Y_HAUT);
      this.x = Math.max(this.x, x);
      this.y = y;
      this.vy = bas ? -SAUVETAGE_VY : SAUVETAGE_VY;
      this.sol = false;
      this.grace = 0;
    } else if (cause === MORT_BORD) {
      const [x, y] = this.placerLibre(this.cam + BORD_RETOUR, this.y);
      if (y !== this.y) this.vy = 0;
      this.x = Math.max(this.x, x);
      this.y = y;
    }
  }

  /** L'emplacement libre le plus proche de `(x, y)` : on cherche par quarts de case, du plus petit déplacement au plus grand (vers la droite, vers le haut ou le bas). Sans rien trouver : l'emplacement demandé. */
  private placerLibre(x: number, y: number): [number, number] {
    const Q = CASE >> 2;
    const MAX_COUT = 96;
    for (let cout = 0; cout <= MAX_COUT; cout++) {
      for (let a = 0; a <= cout; a++) {
        const b = cout - a;
        for (const sens of b === 0 ? [1] : [1, -1]) {
          const px = x + a * Q;
          const py = y + sens * b * Q;
          if (py < 0 || py > VIDE_BAS - TAILLE) continue;
          if (this.heurte(px, py) === 0) return [px, py];
        }
      }
    }
    return [x, y];
  }

  /**
   * **Pour les essais seulement** (la touche T, `?theme=`) : saute au début du thème suivant, posé au sol. Ce n'est pas rejouable : la partie est marquée `essai`, le jeu ne l'envoie jamais (le serveur
   * rejoue des appuis, il ne sait pas téléporter).
   */
  sauterAuThemeSuivant(): void {
    if (this.mort !== 0) return;
    const colonne = idiv(this.x, CASE);
    const prochain = (idiv(idiv(colonne, LARGEUR_MORCEAU), MORCEAUX_PAR_THEME) + 1) * MORCEAUX_PAR_THEME * LARGEUR_MORCEAU;
    this.x = (prochain + 2) * CASE;
    this.y = DEPART_Y;
    this.g = 1;
    this.vy = 0;
    this.sol = false;
    this.grace = 0;
    this.tampon = 0;
    this.cam = this.x - CIBLE_CAMERA;
    this.precX = this.x;
    this.precY = this.y;
    this.precCam = this.cam;
    this.essai = true;
  }
}

/** Joue une partie entière : `appuis` est la liste des pas où le joueur a touché l'écran (strictement croissante). Jusqu'à la mort ou aux dix minutes. */
export function jouer(terrain: Terrain, appuis: readonly number[]): Resultat {
  const p = new Partie(terrain);
  let k = 0;
  while (!p.finie) {
    while (k < appuis.length && appuis[k]! <= p.tick) {
      if (appuis[k] === p.tick) p.appuyer();
      k++;
    }
    p.avancer();
  }
  return p.resultat();
}
