// Lot 44 (déplacé au lot 45 de `decor/matiereC.ts`) — les coordonnées de texture « monde » : le grain du décor (lot 44) et la matière sobre du palier 2
// (lot 45 : la route, les portiques) suivent la géométrie, sans couture d'un maillage à l'autre. Un module à part : le décor et le pas « finition », tous deux
// à la demande, le partagent sans que l'un tire l'autre.
import { BufferAttribute, type BufferGeometry } from "three";

/** Coordonnées de texture « monde » par face (projection sur le plan le plus proche, 1 répétition tous les `pas` m) : le grain suit la géométrie. */
export function uvMonde(g: BufferGeometry, pas: number): void {
  const pos = g.getAttribute("position");
  if (!pos || g.index) return;
  const p = pos.array as ArrayLike<number>;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const bx = p[i * 3 + 3]! - p[i * 3]!, by = p[i * 3 + 4]! - p[i * 3 + 1]!, bz = p[i * 3 + 5]! - p[i * 3 + 2]!;
    const cx = p[i * 3 + 6]! - p[i * 3]!, cy = p[i * 3 + 7]! - p[i * 3 + 1]!, cz = p[i * 3 + 8]! - p[i * 3 + 2]!;
    const nx = Math.abs(by * cz - bz * cy);
    const ny = Math.abs(bz * cx - bx * cz);
    const nz = Math.abs(bx * cy - by * cx);
    for (let k = 0; k < 3; k++) {
      const x = p[(i + k) * 3]!, y = p[(i + k) * 3 + 1]!, z = p[(i + k) * 3 + 2]!;
      const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
      uv[(i + k) * 2] = u / pas;
      uv[(i + k) * 2 + 1] = v / pas;
    }
  }
  g.setAttribute("uv", new BufferAttribute(uv, 2));
}
