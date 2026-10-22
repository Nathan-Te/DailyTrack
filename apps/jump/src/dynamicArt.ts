import { BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, SpriteMaterial, CanvasTexture } from "three";
import type { AttemptState, Level } from "@cdj/jump-sim";
import { BLOCK_STYLE, blockLooks, type BlockLook } from "./blocks";

// Le dessin des blocs clignotants (nuit) et alternés (néon), lot 12 — **affichage seul** : il ne lit que l'état de l'essai (`blockLooks`).
//   - un bloc **plein** : une face colorée, un liseré clair, un repère (aucun pour un clignotant, une barre pour A, un losange pour B) ;
//   - un bloc **absent** : seulement son contour, discret, pour qu'on sache où il reviendra ;
//   - un bloc qui va **s'éteindre** vacille pendant 0,25 s : la face clignote (effets normaux) ; **avec le mouvement réduit**, rien ne clignote :
//     la face s'éclaircit et le contour s'épaissit à mesure que l'instant approche (c'est une information de jeu, elle reste lisible) ;
//   - un bloc qui devrait être plein mais attend la sortie du personnage : contour épais, face absente.
// Un matériau par bloc (l'opacité varie bloc par bloc), construits une fois ; rien n'est créé en jeu. ~100 blocs au plus par niveau du jour.

/** Épaisseur du contour fin et du contour épais (tuiles). */
const THIN = 0.05;
const THICK = 0.14;

/** Un cadre carré de côté `size` (tuiles) d'épaisseur `t`, en 8 triangles. */
function frameGeometry(size: number, t: number): BufferGeometry {
  const h = size / 2;
  const i = h - t;
  const rects: [number, number, number, number][] = [
    [-h, h - t, h, h], // haut
    [-h, -h, h, -h + t], // bas
    [-h, -i, -i, i], // gauche
    [i, -i, h, i], // droite
  ];
  const pos: number[] = [];
  for (const [x0, y0, x1, y1] of rects) pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  return g;
}

/** Le losange du repère B (carré tourné de 45°). */
function diamondGeometry(r: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([-r, 0, 0, 0, -r, 0, r, 0, 0, -r, 0, 0, r, 0, 0, 0, r, 0], 3));
  return g;
}

/** Étiquette de texte (debug) : sprite sans éclairage. */
function labelSprite(text: string, color: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(11, 16, 32, 0.8)";
  ctx.fillRect(0, 0, 220, 64);
  ctx.fillStyle = color;
  ctx.font = "700 38px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 14, 34);
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false, transparent: true }));
  sprite.scale.set(2.6, 0.75, 1);
  sprite.visible = false;
  return sprite;
}

export interface DynamicStats {
  /** Blocs clignotants et alternés dessinés. */
  blinks: number;
  alts: number;
  /** Pleins, absents, vacillants, en attente de la sortie du personnage, à la dernière image. */
  solid: number;
  absent: number;
  wobbling: number;
  waiting: number;
  /** Blocs au contour épais (vacillants sans mouvement, en attente de la sortie) et opacité de la face du premier bloc qui vacille (−1 : aucun) : de quoi vérifier ce qui se voit. */
  thick: number;
  wobbleOpacity: number;
  /** Lot 17 : l'estompage des clignotants appliqué à la dernière image (1 : aucun) et l'opacité de la face du premier clignotant plein qui ne vacille pas / du premier bloc alterné plein (−1 : aucun). Les alternés ne suivent pas l'horloge : jamais estompés. */
  clockFade: number;
  blinkFace: number;
  altFace: number;
  /** Le jeu solide à la dernière image (0 : A, 1 : B ; −1 sans blocs alternés) et l'éclat en cours (0 à 1). */
  alt: number;
  flash: number;
}

export interface DynamicBlocks {
  /**
   * Pose l'aspect de chaque bloc d'après l'état (`clock` : secondes ; `animate` faux : mouvement réduit ou effets aucun). `fade` (lot 17, 1 par
   * défaut) : l'estompage des blocs **clignotants**, qui suivent l'horloge, pendant le carnage ; les blocs alternés ne changent pas.
   */
  update(state: Readonly<AttemptState>, clock: number, animate: boolean, view: { x: number; y: number; halfW: number; halfH: number }, fade?: number): void;
  /** Lance un éclat bref (bascule, remise à A) : 1 = plein, décroît tout seul. */
  flash(amount: number): void;
  readonly stats: DynamicStats;
}

/** Les blocs d'un niveau ; null s'il n'en a pas (rien n'est construit). `hitbox` : `?debug&hitbox`. */
export function createDynamicBlocks(world: Group, level: Level, hitbox: boolean): DynamicBlocks | null {
  const total = level.blinks.length + level.alts.length;
  if (total === 0) return null;
  const thin = frameGeometry(0.96, THIN);
  const thick = frameGeometry(0.96, THICK);
  const faceGeo = new PlaneGeometry(0.92, 0.92);
  const barGeo = new PlaneGeometry(0.46, 0.11);
  const diamond = diamondGeometry(0.17);
  const cells: { col: number; row: number; kind: "blink" | "A" | "B" }[] = [
    ...level.blinks.map((b) => ({ col: b.col, row: b.row, kind: "blink" as const })),
    ...level.alts.map((a) => ({ col: a.col, row: a.row, kind: a.set === 0 ? ("A" as const) : ("B" as const) })),
  ];
  const styleOf = (k: "blink" | "A" | "B") => (k === "blink" ? BLOCK_STYLE.blink : k === "A" ? BLOCK_STYLE.altA : BLOCK_STYLE.altB);
  const blocks = cells.map((c) => {
    const style = styleOf(c.kind);
    const g = new Group();
    g.position.set(c.col + 0.5, -c.row - 0.5, 0.03);
    const faceMat = new MeshBasicMaterial({ color: style.fill, transparent: true, side: DoubleSide });
    const face = new Mesh(faceGeo, faceMat);
    const edgeMat = new MeshBasicMaterial({ color: style.edge, transparent: true, side: DoubleSide });
    const frameThin = new Mesh(thin, edgeMat);
    const frameThick = new Mesh(thick, edgeMat);
    frameThin.position.z = 0.002;
    frameThick.position.z = 0.002;
    g.add(face, frameThin, frameThick);
    let mark: Mesh | null = null;
    if (c.kind === "A") mark = new Mesh(barGeo, edgeMat);
    else if (c.kind === "B") mark = new Mesh(diamond, edgeMat);
    if (mark) {
      mark.position.z = 0.004;
      g.add(mark);
    }
    world.add(g);
    return { g, face, faceMat, edgeMat, frameThin, frameThick, mark, base: new Color(style.fill), edge: new Color(style.edge), kind: c.kind };
  });

  // ——— ?debug&hitbox : l'état solide (cadre vert) ou absent (croix rouge) de chaque bloc, et le jeu A ou B actif ———
  let solidBoxes: LineSegments | null = null;
  let absentCrosses: LineSegments | null = null;
  let labels: { A: Sprite; B: Sprite } | null = null;
  const boxPos = new Float32Array(total * 24);
  const crossPos = new Float32Array(total * 12);
  if (hitbox) {
    solidBoxes = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0x00ff66 }));
    absentCrosses = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xff5599 }));
    for (const l of [solidBoxes, absentCrosses]) {
      l.position.z = 0.5;
      l.frustumCulled = false;
      world.add(l);
    }
    // Tampons préalloués, réécrits à chaque image (jamais de géométrie recréée) : `BufferAttribute`, pas `Float32BufferAttribute` (qui copie).
    solidBoxes.geometry.setAttribute("position", new BufferAttribute(boxPos, 3));
    absentCrosses.geometry.setAttribute("position", new BufferAttribute(crossPos, 3));
    labels = { A: labelSprite("JEU A ACTIF", "#2fd6c8"), B: labelSprite("JEU B ACTIF", "#c07bff") };
    world.add(labels.A, labels.B);
    for (const s of [labels.A, labels.B]) s.position.z = 0.7;
  }

  const looks: BlockLook[] = [];
  const white = new Color(0xffffff);
  const tmp = new Color();
  let flashAmount = 0;
  let lastClock = 0;
  const stats: DynamicStats = { blinks: level.blinks.length, alts: level.alts.length, solid: 0, absent: 0, wobbling: 0, waiting: 0, thick: 0, wobbleOpacity: -1, clockFade: 1, blinkFace: -1, altFace: -1, alt: level.alts.length > 0 ? 0 : -1, flash: 0 };

  return {
    stats,
    flash(amount) {
      flashAmount = Math.max(flashAmount, Math.min(1, amount));
    },
    update(state, clock, animate, view, fade = 1) {
      const dt = Math.max(0, Math.min(0.1, clock - lastClock));
      lastClock = clock;
      // L'éclat s'éteint en ≈ 0,25 s ; sans mouvement, il n'y en a pas (une information, pas un effet : la bascule se voit à l'état des blocs).
      flashAmount = animate ? Math.max(0, flashAmount - dt * 4) : 0;
      blockLooks(level, state, looks);
      stats.solid = stats.absent = stats.wobbling = stats.waiting = stats.thick = 0;
      stats.wobbleOpacity = -1;
      stats.blinkFace = stats.altFace = -1;
      stats.clockFade = fade;
      stats.alt = level.alts.length > 0 ? (state.alt ?? 0) : -1;
      stats.flash = flashAmount;
      let nb = 0;
      let nc = 0;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        const look = looks[i]!;
        const x = b.g.position.x - 0.5;
        const y = -b.g.position.y - 0.5;
        if (look.solid) stats.solid++;
        else stats.absent++;
        if (look.wobble > 0) stats.wobbling++;
        if (look.waiting) stats.waiting++;
        // Le bloc plein : face, liseré fin ; le bloc absent : contour discret ; en attente de la sortie : contour épais.
        const pulse = animate ? 0.65 + 0.35 * Math.sin(clock * 7 + i) : 0.85;
        let faceOpacity = 0;
        let edgeOpacity = 0.4;
        let thickOn = false;
        let scale = 1;
        if (look.solid) {
          faceOpacity = 1;
          edgeOpacity = 1;
          if (look.wobble > 0) {
            if (animate) {
              // Vacille : la face clignote, de plus en plus vite et de plus en plus creux à l'approche de l'extinction.
              const on = Math.floor(clock * (14 + 18 * look.wobble) + i) % 2 === 0;
              faceOpacity = on ? 1 : 0.25 + 0.3 * (1 - look.wobble);
            } else {
              // Mouvement réduit : rien ne clignote. La face s'éclaircit sans à-coup et le contour s'épaissit, la face se resserre.
              faceOpacity = 1 - 0.55 * look.wobble;
              thickOn = look.wobble >= 0.3;
              scale = 1 - 0.1 * look.wobble;
            }
          }
        } else if (look.waiting) {
          thickOn = true;
          edgeOpacity = pulse;
        }
        // Lot 17 : pendant le carnage, les clignotants (qui suivent l'horloge) sont estompés ; l'opacité de la face et du contour suit.
        if (b.kind === "blink") {
          faceOpacity *= fade;
          edgeOpacity *= fade;
        }
        if (look.solid && look.wobble <= 0) {
          if (b.kind === "blink" && stats.blinkFace < 0) stats.blinkFace = faceOpacity;
          if (b.kind !== "blink" && stats.altFace < 0) stats.altFace = faceOpacity;
        }
        if (thickOn) stats.thick++;
        if (look.wobble > 0 && stats.wobbleOpacity < 0) stats.wobbleOpacity = faceOpacity;
        b.face.visible = faceOpacity > 0.01;
        b.faceMat.opacity = faceOpacity;
        b.face.scale.set(scale, scale, 1);
        b.frameThin.visible = !thickOn;
        b.frameThick.visible = thickOn;
        b.edgeMat.opacity = edgeOpacity;
        if (b.mark) b.mark.visible = look.solid && look.wobble < 0.7;
        // Éclat : les blocs alternés pleins tirent vers le blanc.
        tmp.copy(b.base);
        b.faceMat.color.copy(b.kind !== "blink" && look.solid && flashAmount > 0 ? tmp.lerp(white, 0.75 * flashAmount) : b.base);
        if (solidBoxes && absentCrosses) {
          if (look.solid) {
            const o = nb * 24;
            const a = x;
            const c = x + 1;
            const d = -y;
            const e = -y - 1;
            boxPos.set([a, d, 0, c, d, 0, c, d, 0, c, e, 0, c, e, 0, a, e, 0, a, e, 0, a, d, 0], o);
            nb++;
          } else {
            const o = nc * 12;
            const a = x + 0.15;
            const c = x + 0.85;
            const d = -y - 0.15;
            const e = -y - 0.85;
            crossPos.set([a, d, 0, c, e, 0, a, e, 0, c, d, 0], o);
            nc++;
          }
        }
      }
      if (solidBoxes && absentCrosses && labels) {
        solidBoxes.geometry.setDrawRange(0, nb * 8);
        absentCrosses.geometry.setDrawRange(0, nc * 4);
        solidBoxes.geometry.getAttribute("position")!.needsUpdate = true;
        absentCrosses.geometry.getAttribute("position")!.needsUpdate = true;
        const alt = state.alt ?? 0;
        const show = level.alts.length > 0;
        labels.A.visible = show && alt === 0;
        labels.B.visible = show && alt === 1;
        for (const s of [labels.A, labels.B]) s.position.set(view.x + view.halfW - 1.6, view.y + view.halfH - 1.9, 0.7);
      }
    },
  };
}
