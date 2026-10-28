import { BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, SpriteMaterial, CanvasTexture } from "three";
import type { AttemptState, Level } from "@cdj/jump-sim";
import { BLOCK_STYLE, blockLooks, type BlockLook } from "./blocks";

// Le dessin des blocs clignotants (nuit) et alternés (néon), lot 12 — **affichage seul** : il ne lit que l'état de l'essai (`blockLooks`).
//   - un bloc **plein** : une face colorée, un liseré clair, un repère (aucun pour un clignotant, une barre pour A, un losange pour B) ;
//   - un bloc **absent** : seulement son contour, discret, pour qu'on sache où il reviendra (un clignotant : contour **pointillé**, lot 18) ;
//   - lot 28, **l'état suivant des alternés se lit sur les blocs** : un bloc alterné absent garde son repère (barre pour A, losange pour B), en filigrane — c'est le jeu qui apparaîtra au prochain
//     saut — et un bloc alterné plein porte, au coin, une pastille de la forme et de la couleur de ce prochain jeu ; à chaque bascule le jeu qui vient de disparaître laisse un instant sa trace
//     (une face fantôme qui s'éteint avec l'éclat) : la bascule se voit à chaque saut, et jamais sans saut (le dessin ne change d'état que si la simulation le fait) ;
//   - lot 18, l'annonce (`announce.ts`) : un clignotant plein qui va **s'éteindre** voit sa face **se vider comme une jauge qui descend** pendant ses
//     0,6 dernières secondes (vide pile au pas de la disparition) ; absent, son contour pointillé **se remplit** pendant les 0,4 s avant son retour
//     (plein pile au pas de la réapparition). Aucun clignotement, avec ou sans mouvement réduit : c'est une information de jeu ;
//   - un bloc qui devrait être plein mais attend la sortie du personnage : contour épais, face absente.
// Un matériau par bloc (l'opacité varie bloc par bloc), construits une fois ; rien n'est créé en jeu. ~100 blocs au plus par niveau du jour.

/** Épaisseur du contour fin et du contour épais (tuiles). */
const THIN = 0.05;
const THICK = 0.14;
/** Côté de la face et du contour (tuiles) ; tirets par côté du contour pointillé (cinq tirets, quatre vides) ; épaisseur du trait du niveau de la jauge. */
const FACE = 0.92;
const FRAME = 0.96;
const DASHES = 5;
const LEVEL_LINE = 0.05;
/** Opacité du remplissage d'un bloc absent dont le contour se remplit (translucide : il n'est pas encore là) et du contour pointillé, au repos et plein. */
const REFILL_FACE = 0.4;
const DOTTED_MIN = 0.4;
const DOTTED_MAX = 0.9;
/** Lot 28 : l'opacité du repère d'un bloc alterné absent (en filigrane) et de la face fantôme laissée par la bascule (à l'éclat plein). */
const MARK_GHOST = 0.55;
const GHOST_FACE = 0.45;

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

/** Un cadre pointillé (lot 18) : `DASHES` tirets par côté, autant de vides que de tirets moins un, d'épaisseur `t`. */
function dashedFrameGeometry(size: number, t: number): BufferGeometry {
  const h = size / 2;
  const part = size / (2 * DASHES - 1);
  const pos: number[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number) => pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  for (let i = 0; i < DASHES; i++) {
    const a = -h + 2 * i * part;
    const b = a + part;
    rect(a, h - t, b, h); // haut
    rect(a, -h, b, -h + t); // bas
    rect(-h, a, -h + t, b); // gauche
    rect(h - t, a, h, b); // droite
  }
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
  /** Pleins, absents, en attente de la sortie du personnage, à la dernière image. */
  solid: number;
  absent: number;
  waiting: number;
  /** Lot 18 : clignotants dont la jauge se vide (pleins, jauge sous 1), dont le contour se remplit (absents, jauge au-dessus de 0), au contour pointillé. */
  draining: number;
  refilling: number;
  dotted: number;
  /** Lot 18 : la hauteur de face dessinée de chaque clignotant (0 vide … 1 pleine ; ordre de `Level.blinks`) et l'opacité du premier trait de niveau visible (−1 : aucun). */
  fills: number[];
  levelLine: number;
  /** Blocs au contour épais (en attente de la sortie) : de quoi vérifier ce qui se voit. */
  thick: number;
  /** Lot 17 : l'estompage des clignotants appliqué à la dernière image (1 : aucun) et l'opacité de la face du premier clignotant plein qui ne vacille pas / du premier bloc alterné plein (−1 : aucun). Les alternés ne suivent pas l'horloge : jamais estompés. */
  clockFade: number;
  blinkFace: number;
  altFace: number;
  /** Le jeu solide à la dernière image (0 : A, 1 : B ; −1 sans blocs alternés) et l'éclat en cours (0 à 1). */
  alt: number;
  flash: number;
  /** Lot 28 : le jeu que le prochain saut rendra solide (0 : A, 1 : B ; −1 sans blocs alternés), les repères en filigrane des blocs alternés absents, les pastilles « prochain jeu » des blocs pleins, les faces fantômes de la dernière bascule. */
  next: number;
  marks: number;
  pips: number;
  ghosts: number;
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
  const thin = frameGeometry(FRAME, THIN);
  const thick = frameGeometry(FRAME, THICK);
  const dashed = dashedFrameGeometry(FRAME, THIN);
  // La face part du bas du bloc (lot 18) : sa hauteur dessinée est le niveau de la jauge.
  const faceGeo = new PlaneGeometry(FACE, FACE).translate(0, FACE / 2, 0);
  const lineGeo = new PlaneGeometry(FACE, LEVEL_LINE);
  const barGeo = new PlaneGeometry(0.46, 0.11);
  const diamond = diamondGeometry(0.17);
  // Lot 28 : la pastille du prochain jeu, au coin d'un bloc alterné plein (une petite barre pour A, un petit losange pour B).
  const pipBar = new PlaneGeometry(0.2, 0.06);
  const pipDiamond = diamondGeometry(0.075);
  const PIP = 0.32;
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
    face.position.y = -FACE / 2;
    const edgeMat = new MeshBasicMaterial({ color: style.edge, transparent: true, side: DoubleSide });
    const frameThin = new Mesh(thin, edgeMat);
    const frameThick = new Mesh(thick, edgeMat);
    frameThin.position.z = 0.002;
    frameThick.position.z = 0.002;
    g.add(face, frameThin, frameThick);
    // Lot 18 : le contour pointillé d'un clignotant absent et le trait qui marque le niveau de la jauge (seulement pour les clignotants).
    let frameDash: Mesh | null = null;
    let line: Mesh | null = null;
    if (c.kind === "blink") {
      frameDash = new Mesh(dashed, edgeMat);
      frameDash.position.z = 0.002;
      line = new Mesh(lineGeo, edgeMat);
      line.position.z = 0.003;
      line.visible = false;
      frameDash.visible = false;
      g.add(frameDash, line);
    }
    // Lot 28 : le repère du jeu (un matériau à lui : en filigrane quand le bloc est absent) et la pastille du jeu suivant (la forme et la couleur de l'autre jeu).
    let mark: Mesh | null = null;
    let markMat: MeshBasicMaterial | null = null;
    let pip: Mesh | null = null;
    let pipMat: MeshBasicMaterial | null = null;
    if (c.kind !== "blink") {
      markMat = new MeshBasicMaterial({ color: style.edge, transparent: true, side: DoubleSide });
      mark = new Mesh(c.kind === "A" ? barGeo : diamond, markMat);
      mark.position.z = 0.004;
      const other = c.kind === "A" ? BLOCK_STYLE.altB : BLOCK_STYLE.altA;
      pipMat = new MeshBasicMaterial({ color: other.edge, transparent: true, side: DoubleSide });
      pip = new Mesh(c.kind === "A" ? pipDiamond : pipBar, pipMat);
      pip.position.set(PIP, PIP, 0.005);
      pip.visible = false;
      g.add(mark, pip);
    }
    world.add(g);
    return { g, face, faceMat, edgeMat, frameThin, frameThick, frameDash, line, mark, markMat, pip, base: new Color(style.fill), edge: new Color(style.edge), kind: c.kind };
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
  const stats: DynamicStats = { blinks: level.blinks.length, alts: level.alts.length, solid: 0, absent: 0, waiting: 0, draining: 0, refilling: 0, dotted: 0, fills: level.blinks.map(() => 0), levelLine: -1, thick: 0, clockFade: 1, blinkFace: -1, altFace: -1, alt: level.alts.length > 0 ? 0 : -1, flash: 0, next: level.alts.length > 0 ? 1 : -1, marks: 0, pips: 0, ghosts: 0 };

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
      stats.solid = stats.absent = stats.waiting = stats.draining = stats.refilling = stats.dotted = stats.thick = 0;
      stats.levelLine = -1;
      stats.blinkFace = stats.altFace = -1;
      stats.clockFade = fade;
      stats.alt = level.alts.length > 0 ? (state.alt ?? 0) : -1;
      stats.next = level.alts.length > 0 ? 1 - (state.alt ?? 0) : -1;
      stats.marks = stats.pips = stats.ghosts = 0;
      stats.flash = flashAmount;
      let nb = 0;
      let nc = 0;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        const look = looks[i]!;
        const x = b.g.position.x - 0.5;
        const y = -b.g.position.y - 0.5;
        const isBlink = b.kind === "blink";
        if (look.solid) stats.solid++;
        else stats.absent++;
        if (look.waiting) stats.waiting++;
        // Le bloc plein : face, liseré fin ; le bloc absent : contour discret (pointillé pour un clignotant) ; en attente de la sortie : contour épais.
        const pulse = animate ? 0.65 + 0.35 * Math.sin(clock * 7 + i) : 0.85;
        let faceOpacity = 0;
        let edgeOpacity = isBlink ? DOTTED_MIN : 0.4;
        let thickOn = false;
        let dottedOn = false;
        let lineOpacity = 0;
        let height = 0;
        if (look.solid) {
          // Plein : la face est une jauge (lot 18), pleine hors annonce, qui descend pendant les derniers instants ; le contour reste plein et franc
          // (le bloc est solide jusqu'au pas où il disparaît).
          faceOpacity = 1;
          edgeOpacity = 1;
          height = isBlink ? look.fill : 1;
          if (isBlink && look.fill < 1) {
            stats.draining++;
            lineOpacity = 1;
          }
        } else if (look.waiting) {
          thickOn = true;
          edgeOpacity = pulse;
        } else if (isBlink) {
          // Absent : contour pointillé discret ; pendant l'annonce du retour, il se remplit (translucide : il n'est pas encore là) et se renforce.
          dottedOn = true;
          if (look.fill > 0) {
            stats.refilling++;
            height = look.fill;
            faceOpacity = REFILL_FACE;
            edgeOpacity = DOTTED_MIN + (DOTTED_MAX - DOTTED_MIN) * look.fill;
            lineOpacity = 0.7;
          }
        }
        // La trace de la dernière bascule : le jeu qui vient de disparaître laisse une face fantôme qui s'éteint avec l'éclat (jamais sans mouvement : l'éclat est alors nul).
        if (!isBlink && !look.solid && !look.waiting && flashAmount > 0.01) {
          faceOpacity = GHOST_FACE * flashAmount;
          height = 1;
          stats.ghosts++;
        }
        // Lot 17 : pendant le carnage, les clignotants (qui suivent l'horloge) sont estompés ; l'opacité de la face et du contour suit.
        if (isBlink) {
          faceOpacity *= fade;
          edgeOpacity *= fade;
          lineOpacity *= fade;
        }
        if (look.solid && (!isBlink || look.fill >= 1)) {
          if (isBlink && stats.blinkFace < 0) stats.blinkFace = faceOpacity;
          if (!isBlink && stats.altFace < 0) stats.altFace = faceOpacity;
        }
        if (thickOn) stats.thick++;
        if (dottedOn) stats.dotted++;
        if (isBlink) stats.fills[i] = height;
        b.face.visible = faceOpacity > 0.01 && height > 0.001;
        b.faceMat.opacity = faceOpacity;
        b.face.scale.set(1, Math.max(0.0001, height), 1);
        b.frameThin.visible = !thickOn && !dottedOn;
        b.frameThick.visible = thickOn;
        if (b.frameDash) b.frameDash.visible = dottedOn;
        b.edgeMat.opacity = edgeOpacity;
        if (b.line) {
          const shown = lineOpacity > 0.01 && height > 0.001 && height < 1;
          b.line.visible = shown;
          if (shown) {
            b.line.position.y = -FACE / 2 + FACE * height;
            if (stats.levelLine < 0) stats.levelLine = lineOpacity;
          }
        }
        // Lot 28 : le repère du jeu reste visible quand le bloc est absent (en filigrane : c'est le jeu qui apparaît au prochain saut) ; la pastille du jeu suivant marque les blocs pleins.
        if (b.mark && b.markMat) {
          b.mark.visible = true;
          b.markMat.opacity = look.solid ? 1 : MARK_GHOST;
          if (!look.solid) stats.marks++;
        }
        if (b.pip) {
          b.pip.visible = look.solid;
          if (look.solid) stats.pips++;
        }
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
