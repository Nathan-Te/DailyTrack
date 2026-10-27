import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { stalactiteOffset, type AttemptState, type Level } from "@cdj/jump-sim";
import { DRIP_COUNT, DRIP_SIZE, STALACTITE_LOOK, buildStalactiteArt, stalactiteDrips, stalactiteLook, stalactiteSway } from "./stalactite";

// Les stalactites (lot 24), **affichage seul** : un pic de glace accroché au plafond, pointe rouge ; il tremble et laisse tomber de fines gouttes de glace pendant tout le
// tremblement (`stalactite.ts`, fonction pure de l'âge), tombe selon la simulation (`stalactiteOffset`, interpolé entre deux pas comme les presses), disparaît brisé. L'état vient de
// `AttemptState.stalactites` : jamais recalculé à part. Aucune secousse de caméra. **Carnage** (lot 17) : intacte, à 35 % d'opacité (`fade` < 1) ; un groupe chacune, une géométrie
// partagée, construits une fois.

export interface StalactiteStats {
  /** Pour chaque stalactite (ordre de `level.stalactites`) : l'âge dessiné (0 intacte, −1 brisée), le haut du corps (tuiles, y vers le bas), le balancement (tuiles), l'amplitude (0 à 1) et le nombre de gouttes visibles. */
  age: number[];
  y: number[];
  sway: number[];
  shake: number[];
  drips: number[];
  visible: boolean[];
  /** L'opacité dessinée (1 : normale ; 0,35 dans le carnage). */
  opacity: number;
}

export interface StalactiteArt {
  readonly stats: StalactiteStats;
  update(prev: Readonly<AttemptState>, state: Readonly<AttemptState>, alpha: number, fade: number, seconds: number): void;
}

/** Les stalactites d'un niveau ; `null` s'il n'en a pas. `colors.hazard` : le rouge du thème (la pointe). */
export function createStalactiteArt(world: Group, level: Level, colors: { hazard: number }): StalactiteArt | null {
  if (level.stalactites.length === 0) return null;
  const art = buildStalactiteArt(colors.hazard);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(art.pos, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(art.col, 3));
  geometry.setIndex(art.idx);
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const n = level.stalactites.length;
  const stats: StalactiteStats = { age: Array(n).fill(0), y: level.stalactites.map((s) => s.row), sway: Array(n).fill(0), shake: Array(n).fill(0), drips: Array(n).fill(0), visible: Array(n).fill(true), opacity: 1 };
  const dripGeometry = new PlaneGeometry(DRIP_SIZE, DRIP_SIZE * 1.6);
  const parts = level.stalactites.map((s) => {
    const group = new Group();
    group.position.set(s.col + 0.5, -s.row, 0.045);
    group.add(new Mesh(geometry, material));
    world.add(group);
    // Chaque stalactite a ses gouttes (matériau à elles : leur opacité change avec l'âge).
    const dripMat = new MeshBasicMaterial({ color: STALACTITE_LOOK.drip, transparent: true, opacity: 0 });
    const drips: Mesh[] = [];
    for (let k = 0; k < DRIP_COUNT; k++) {
      const m = new Mesh(dripGeometry, dripMat);
      m.visible = false;
      world.add(m);
      drips.push(m);
    }
    return { group, drips, dripMat };
  });
  let fade = 1;
  return {
    stats,
    update(prev, state, alpha, nextFade, seconds) {
      const v = Math.max(0, Math.min(1, nextFade));
      if (v !== fade) {
        fade = v;
        material.transparent = v < 1;
        material.opacity = v;
        stats.opacity = v;
      }
      const carnage = v < 1;
      level.stalactites.forEach((s, i) => {
        // Dans le carnage, chaque vie a son propre état : on dessine toujours l'état intact.
        const age = carnage ? 0 : (state.stalactites?.[i] ?? 0);
        const before = carnage ? 0 : (prev.stalactites?.[i] ?? 0);
        const look = stalactiteLook(age);
        const { group, drips, dripMat } = parts[i]!;
        group.visible = look.visible;
        stats.visible[i] = look.visible;
        stats.age[i] = age;
        // La chute est interpolée entre deux pas (comme les presses) ; un retour à l'intact (reprise) ou un tremblement ne s'interpole pas.
        const a = before > 0 ? stalactiteOffset(before) : 0;
        const b = stalactiteOffset(age);
        const drop = age > 0 && before > 0 ? (a + (b - a) * alpha) / 4096 : look.drop;
        const sway = stalactiteSway(look.shake, seconds);
        group.position.set(s.col + 0.5 + sway, -(s.row + drop), 0.045);
        stats.y[i] = s.row + drop;
        stats.sway[i] = sway;
        stats.shake[i] = look.shake;
        // Les gouttes : de fines particules de glace pendant tout le tremblement, tombant de la pointe ; jamais dans le carnage.
        const list = carnage ? [] : stalactiteDrips(age);
        stats.drips[i] = list.length;
        let op = 0;
        drips.forEach((m, k) => {
          const d = list[k];
          m.visible = d !== undefined && d.opacity > 0.001;
          if (!d) return;
          m.position.set(s.col + 0.5 + sway + d.dx, -(s.row + drop + 2) - d.dy, 0.046);
          op = Math.max(op, d.opacity);
        });
        // Une seule opacité pour les gouttes d'une même stalactite : la plus visible (continue, les gouttes sont décalées).
        dripMat.opacity = op * 0.85;
      });
    },
  };
}
