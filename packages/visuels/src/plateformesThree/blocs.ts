import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { BLOCK_STYLE, BLOC_FORME, type BlockStyle } from "../plateformes";

// Les blocs qui changent — clignotant (nuit), alternés A et B (néon) —, **dessinés par Three.js** (lot PG1, repris du jeu d'origine sans changement) : la forme de chaque pièce du bloc et le montage d'un bloc. **Affichage seul** : ce
// fichier ne lit aucune simulation ; le jeu pose, à chaque image, l'opacité et la position de ce que ce montage lui rend (les états : plein, absent, prévenu, en attente, jauge, filigrane…). Un bloc se compose de :
//   - une **face** colorée (elle part du bas du bloc : sa hauteur dessinée est le niveau de la jauge), un **liseré** clair fin et un liseré épais (le bloc qui attend la sortie du personnage) ;
//   - pour un **clignotant** seulement : un **contour pointillé** (le bloc absent qui revient) et le **trait de niveau** de la jauge ; aucun repère ;
//   - pour un **alterné** : son **repère** (une barre pour A, un losange pour B : la couleur ne porte pas seule l'information), en filigrane quand le bloc est absent, et une **pastille** au coin, de la forme et de la couleur
//     du jeu suivant (une petite barre pour A… le petit losange du B : l'autre jeu).
// Un matériau par bloc (l'opacité varie bloc par bloc) ; les géométries sont partagées (`geometriesDeBloc`, une fois par niveau). Les tailles et les opacités de repère sont dans `BLOC_FORME` et `BLOC_OPACITES`.

export type GenreBloc = "blink" | "A" | "B";

/** Un cadre carré de côté `size` (tuiles) d'épaisseur `t`, en 8 triangles. */
export function frameGeometry(size: number, t: number): BufferGeometry {
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

/** Un cadre pointillé : `BLOC_FORME.tirets` tirets par côté, autant de vides que de tirets moins un, d'épaisseur `t`. */
export function dashedFrameGeometry(size: number, t: number): BufferGeometry {
  const h = size / 2;
  const part = size / (2 * BLOC_FORME.tirets - 1);
  const pos: number[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number) => pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  for (let i = 0; i < BLOC_FORME.tirets; i++) {
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
export function diamondGeometry(r: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([-r, 0, 0, 0, -r, 0, r, 0, 0, -r, 0, 0, r, 0, 0, 0, r, 0], 3));
  return g;
}

/** Les géométries partagées par tous les blocs d'un niveau. */
export interface GeometriesDeBloc {
  thin: BufferGeometry;
  thick: BufferGeometry;
  dashed: BufferGeometry;
  face: PlaneGeometry;
  ligne: PlaneGeometry;
  barre: PlaneGeometry;
  losange: BufferGeometry;
  pastilleBarre: PlaneGeometry;
  pastilleLosange: BufferGeometry;
}

export function geometriesDeBloc(): GeometriesDeBloc {
  const f = BLOC_FORME;
  return {
    thin: frameGeometry(f.cadre, f.fin),
    thick: frameGeometry(f.cadre, f.epais),
    dashed: dashedFrameGeometry(f.cadre, f.fin),
    // La face part du bas du bloc : sa hauteur dessinée est le niveau de la jauge.
    face: new PlaneGeometry(f.face, f.face).translate(0, f.face / 2, 0),
    ligne: new PlaneGeometry(f.face, f.traitDeNiveau),
    barre: new PlaneGeometry(f.barre.w, f.barre.h),
    losange: diamondGeometry(f.losange),
    // La pastille du prochain jeu : une petite barre pour A, un petit losange pour B.
    pastilleBarre: new PlaneGeometry(f.pastille.barre.w, f.pastille.barre.h),
    pastilleLosange: diamondGeometry(f.pastille.losange),
  };
}

/** Le style (couleurs réservées) d'un genre de bloc. */
export const styleDeBloc = (k: GenreBloc): BlockStyle => (k === "blink" ? BLOCK_STYLE.blink : k === "A" ? BLOCK_STYLE.altA : BLOCK_STYLE.altB);

/** Ce que le jeu garde d'un bloc monté pour le poser à chaque image : le groupe et chaque pièce, avec son matériau. */
export interface BlocDessine {
  g: Group;
  face: Mesh;
  faceMat: MeshBasicMaterial;
  edgeMat: MeshBasicMaterial;
  frameThin: Mesh;
  frameThick: Mesh;
  /** Le contour pointillé et le trait de niveau : un clignotant seulement (cachés au départ). */
  frameDash: Mesh | null;
  line: Mesh | null;
  /** Le repère du jeu (barre ou losange), son matériau, la pastille du jeu suivant (cachée au départ) : un alterné seulement. */
  mark: Mesh | null;
  markMat: MeshBasicMaterial | null;
  pip: Mesh | null;
  pipMat: MeshBasicMaterial | null;
  base: Color;
  edge: Color;
  kind: GenreBloc;
}

/** Monte un bloc de ce genre sur la case (col, row) ; le jeu l'ajoute à son monde (`world.add(bloc.g)`). */
export function creerBloc(kind: GenreBloc, col: number, row: number, geos: GeometriesDeBloc): BlocDessine {
  const f = BLOC_FORME;
  const style = styleDeBloc(kind);
  const g = new Group();
  g.position.set(col + 0.5, -row - 0.5, f.z.bloc);
  const faceMat = new MeshBasicMaterial({ color: style.fill, transparent: true, side: DoubleSide });
  const face = new Mesh(geos.face, faceMat);
  face.position.y = -f.face / 2;
  const edgeMat = new MeshBasicMaterial({ color: style.edge, transparent: true, side: DoubleSide });
  const frameThin = new Mesh(geos.thin, edgeMat);
  const frameThick = new Mesh(geos.thick, edgeMat);
  frameThin.position.z = f.z.contour;
  frameThick.position.z = f.z.contour;
  g.add(face, frameThin, frameThick);
  // Le contour pointillé d'un clignotant absent et le trait qui marque le niveau de la jauge (seulement pour les clignotants).
  let frameDash: Mesh | null = null;
  let line: Mesh | null = null;
  if (kind === "blink") {
    frameDash = new Mesh(geos.dashed, edgeMat);
    frameDash.position.z = f.z.contour;
    line = new Mesh(geos.ligne, edgeMat);
    line.position.z = f.z.trait;
    line.visible = false;
    frameDash.visible = false;
    g.add(frameDash, line);
  }
  // Le repère du jeu (un matériau à lui : en filigrane quand le bloc est absent) et la pastille du jeu suivant (la forme et la couleur de l'autre jeu).
  let mark: Mesh | null = null;
  let markMat: MeshBasicMaterial | null = null;
  let pip: Mesh | null = null;
  let pipMat: MeshBasicMaterial | null = null;
  if (kind !== "blink") {
    markMat = new MeshBasicMaterial({ color: style.edge, transparent: true, side: DoubleSide });
    mark = new Mesh(kind === "A" ? geos.barre : geos.losange, markMat);
    mark.position.z = f.z.repere;
    const other = kind === "A" ? BLOCK_STYLE.altB : BLOCK_STYLE.altA;
    pipMat = new MeshBasicMaterial({ color: other.edge, transparent: true, side: DoubleSide });
    pip = new Mesh(kind === "A" ? geos.pastilleLosange : geos.pastilleBarre, pipMat);
    pip.position.set(f.pastille.coin, f.pastille.coin, f.z.pastille);
    pip.visible = false;
    g.add(mark, pip);
  }
  return { g, face, faceMat, edgeMat, frameThin, frameThick, frameDash, line, mark, markMat, pip, pipMat, base: new Color(style.fill), edge: new Color(style.edge), kind };
}
