// Lot T0 — mesures (HORS simulation : elles lisent les flottants du snapshot, avec Math.hypot / cos / sin ; jamais dans l'état d'un moteur).
import { tourPropre } from "../banc";
import { type Engine, type PieceSpec, type Snapshot, type World, type WorldConfig } from "../interface";
import { pieceBoxes } from "../pieces";

/** Hauteur du point le plus haut des pièces non perdues (coins exacts de leurs boîtes tournées de l'angle courant). */
export function hauteurTour(s: Snapshot, specs: PieceSpec[]): number {
  let h = 0;
  for (const p of s.pieces) {
    if (p.lost) continue;
    const spec = specs[p.id]!;
    const c = Math.cos(p.angle);
    const sn = Math.sin(p.angle);
    for (const b of pieceBoxes(spec.kind, spec.rot)) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const lx = (b.cx + sx * b.hw) / 8;
        const ly = (b.cy + sy * b.hh) / 8;
        const top = p.y + sn * lx + c * ly;
        if (top > h) h = top;
      }
    }
  }
  return h;
}

export interface Stabilite {
  moteur: string;
  secondes: number;
  /** Plus grand déplacement d'une pièce par rapport à sa place de départ, en mètres. */
  derive: number;
  deriveAngle: number;
  /** Plus grand déplacement d'une pièce entre deux pas, après les 2 premières secondes, en mètres. */
  tremblement: number;
  /** Premier pas où toutes les pièces dorment (null : jamais). */
  dormiAu: number | null;
  tombees: number;
  hauteurDebut: number;
  hauteurFin: number;
}

/** Une tour posée proprement reste-t-elle immobile ? `secondes` de simulation, une mesure par pas. */
export function mesurerStabilite(engine: Engine, config: WorldConfig, secondes = 30, specs: PieceSpec[] = tourPropre()): Stabilite {
  const world: World = engine.createWorld(config);
  for (const s of specs) engine.addPiece(world, s);
  const depart = engine.snapshot(world);
  const hauteurDebut = hauteurTour(depart, specs);
  let prec = depart;
  let derive = 0;
  let deriveAngle = 0;
  let tremblement = 0;
  let dormiAu: number | null = null;
  const total = secondes * config.hz;
  for (let t = 1; t <= total; t++) {
    engine.step(world);
    const s = engine.snapshot(world);
    for (let i = 0; i < s.pieces.length; i++) {
      const p = s.pieces[i]!;
      const q = depart.pieces[i]!;
      const r = prec.pieces[i]!;
      if (p.lost) continue;
      derive = Math.max(derive, Math.hypot(p.x - q.x, p.y - q.y));
      deriveAngle = Math.max(deriveAngle, Math.abs(p.angle - q.angle));
      if (t > 2 * config.hz) tremblement = Math.max(tremblement, Math.hypot(p.x - r.x, p.y - r.y));
    }
    if (dormiAu === null && engine.awake(world) === 0) dormiAu = t;
    prec = s;
  }
  const fin = engine.snapshot(world);
  const res: Stabilite = {
    moteur: engine.name,
    secondes,
    derive,
    deriveAngle,
    tremblement,
    dormiAu,
    tombees: fin.pieces.filter((p) => p.lost).length,
    hauteurDebut,
    hauteurFin: hauteurTour(fin, specs),
  };
  engine.dispose(world);
  return res;
}
