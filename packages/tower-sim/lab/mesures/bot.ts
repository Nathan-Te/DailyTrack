// Lot T0 — le tour du bot : une pièce essayée en ~40 positions × 4 rotations, chaque essai simulé JUSQU'À STABILISATION sur une COPIE du monde ; on garde le meilleur
// compromis hauteur / stabilité. Sert à deux choses : mesurer le coût d'un tour (README) et CALIBRER une fois la suite du banc (tools/calibrer-banc.ts).
// Hors simulation (Math.hypot…) : c'est un outil de mesure.
import { type Commande, apparition, sommetTour } from "../banc";
import { type Engine, type PieceKind, type PieceSpec, type Snapshot, type World, type WorldConfig } from "../interface";

export interface EtatBot {
  world: World;
  /** Les pièces du monde, dans l'ordre d'ajout (le bot a besoin de leur forme pour lire le sommet). */
  specs: PieceSpec[];
}

export interface OptionsBot {
  /** Nombre de positions essayées (réparties de −2,5 m à +2,5 m). */
  positions: number;
  rotations: number;
  /** Plafond de pas simulés par essai (300 = 5 s à 60 Hz). */
  maxPas: number;
  /** « bas » : garde la tour la plus basse sans perte (calibration d'une tour sage) ; « haut » : la plus haute sans perte. */
  but: "bas" | "haut";
}

export const BOT_PAR_DEFAUT: OptionsBot = { positions: 40, rotations: 4, maxPas: 300, but: "bas" };

export interface Essai {
  rot: number;
  x8: number;
  score: number;
  pas: number;
  perdues: number;
  sommet: number;
  trouble: number;
}

export interface TourDeBot {
  meilleur: Essai;
  essais: number;
  /** Total de pas de simulation faits (somme des essais). */
  pas: number;
}

function stable(a: Snapshot, b: Snapshot): boolean {
  for (let i = 0; i < a.pieces.length; i++) {
    const p = a.pieces[i]!;
    const q = b.pieces[i]!;
    if (p.lost) continue;
    if (Math.hypot(p.x - q.x, p.y - q.y) > 0.004 || Math.abs(p.angle - q.angle) > 0.004) return false;
  }
  return true;
}

/** Essaie une position × une rotation sur une copie du monde, jusqu'à ce que plus rien ne bouge. */
export function essayer(engine: Engine, etat: EtatBot, kind: PieceKind, rot: number, x8: number, maxPas: number): { snap: Snapshot; pas: number; specs: PieceSpec[] } {
  const w = engine.clone(etat.world);
  const cmd: Commande = { tick: 0, kind, rot, x8, vx8: 0, depart: "dessus" };
  const spec = apparition(cmd, sommetTour(engine.snapshot(w), etat.specs));
  engine.addPiece(w, spec);
  let pas = 0;
  let prec = engine.snapshot(w);
  while (pas < maxPas) {
    for (let i = 0; i < 10; i++) engine.step(w);
    pas += 10;
    const s = engine.snapshot(w);
    if (pas >= 30 && stable(prec, s)) {
      prec = s;
      break;
    }
    prec = s;
  }
  engine.dispose(w);
  return { snap: prec, pas, specs: [...etat.specs, spec] };
}

export function tourDeBot(engine: Engine, etat: EtatBot, kind: PieceKind, options: OptionsBot = BOT_PAR_DEFAUT): TourDeBot {
  const avant = engine.snapshot(etat.world);
  const perdAvant = avant.pieces.filter((p) => p.lost).length;
  let meilleur: Essai | null = null;
  let total = 0;
  let essais = 0;
  for (let r = 0; r < options.rotations; r++) {
    for (let k = 0; k < options.positions; k++) {
      const x8 = -20 + Math.floor((40 * k) / options.positions);
      const { snap, pas, specs } = essayer(engine, etat, kind, r, x8, options.maxPas);
      total += pas;
      essais++;
      const perdues = snap.pieces.filter((p) => p.lost).length - perdAvant;
      const sommet = sommetTour(snap, specs);
      let trouble = 0;
      for (let i = 0; i < avant.pieces.length; i++) {
        const p = snap.pieces[i]!;
        const q = avant.pieces[i]!;
        if (!q.lost && !p.lost) trouble += Math.hypot(p.x - q.x, p.y - q.y);
      }
      const score = options.but === "bas" ? sommet + 50 * perdues + 4 * trouble : -sommet + 50 * perdues + 4 * trouble;
      if (!meilleur || score < meilleur.score) meilleur = { rot: r, x8, score, pas, perdues, sommet, trouble };
    }
  }
  return { meilleur: meilleur!, essais, pas: total };
}

/** Un monde vide sur lequel le bot joue des pièces posées une à une (utilitaire de la calibration et de la mesure). */
export function poserSansCommande(engine: Engine, config: WorldConfig): EtatBot {
  return { world: engine.createWorld(config), specs: [] };
}

/** Pose réellement une commande (rotation, position, éventuellement jetée de côté) et laisse la tour se stabiliser ; rend les pas faits (multiple de 10). */
export function poser(engine: Engine, etat: EtatBot, cmd: Commande, maxPas = 900): number {
  const spec = apparition(cmd, sommetTour(engine.snapshot(etat.world), etat.specs));
  engine.addPiece(etat.world, spec);
  etat.specs.push(spec);
  let pas = 0;
  let prec = engine.snapshot(etat.world);
  while (pas < maxPas) {
    for (let i = 0; i < 10; i++) engine.step(etat.world);
    pas += 10;
    const s = engine.snapshot(etat.world);
    const ok = pas >= 30 && stable(prec, s);
    prec = s;
    if (ok) break;
  }
  return pas;
}
