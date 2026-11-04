import { el, formatNombre, type Langue } from "@cdj/ui";
import type { Expression, Forme, PaletteTheme, ThemeBloc } from "@cdj/visuels/blocs";

// Lot DA1 : la section « Blocs » de la vitrine `/ui/` (recette et aperçus seulement). Une pièce de chaque forme, par thème, avec les états des yeux, dessinée **deux fois** : en Canvas 2D (le dessinateur pour un jeu en grille,
// `@cdj/visuels/blocs/canvas`) et par le dessinateur de Tower (Three.js, `@cdj/visuels/blocs/three`, celui que Tower appelle en jeu). Les deux lisent la même description ; le rendu doit être le même à l'œil. **L'écart est mesuré
// sur les pixels de chaque paire** (la part de pixels qui diffèrent nettement : le crénelage des bords en donne un peu, un défaut de dessin en donne beaucoup) et écrit sous la paire : `data-ecart` (0 à 1) ; la spec de la vitrine
// (`apps/web/e2e/portail.spec.ts`) le borne. Tout est chargé à la demande (Three.js compris) : la vitrine seule le paie. Un seul moteur WebGL pour toute la planche (les navigateurs en limitent le nombre).

/** Le côté d'une cellule, en pixels ; les pièces sont dessinées à 22 px par mètre, les yeux à 44 (une pièce O, grosse). */
const COTE = 112;
const K_PIECE = 22;
const K_YEUX = 44;
/** Un pixel « diffère nettement » au-delà de cet écart de canal (sur 255). */
const SEUIL_PIXEL = 48;

const THEMES: readonly ThemeBloc[] = ["port", "chantier", "canyon", "banquise", "jungle", "nuit"];
const FORMES: readonly Forme[] = ["I", "O", "T", "L", "J", "S", "Z"];

type Etat = { cle: string; niveau: 0 | 1 | 2 | 3; genre: "normal" | "chute" | "figee" | "soulage" | "glissante" | "plisse"; regard: { x: number; y: number }; clignement: number };
/** Les états des yeux : les quatre niveaux de panique, la chute, la pièce figée, l'air soulagé, la glissante, le coup de vent, un clin d'œil et le regard qui suit. */
const ETATS: readonly Etat[] = [
  { cle: "calme", niveau: 0, genre: "normal", regard: { x: 0, y: -0.5 }, clignement: 0 },
  { cle: "inquiet", niveau: 1, genre: "normal", regard: { x: 0, y: -0.5 }, clignement: 0 },
  { cle: "panique", niveau: 2, genre: "normal", regard: { x: 0, y: -0.5 }, clignement: 0 },
  { cle: "affole", niveau: 3, genre: "normal", regard: { x: 0, y: -0.5 }, clignement: 0 },
  { cle: "chute", niveau: 3, genre: "chute", regard: { x: 0, y: 1 }, clignement: 0 },
  { cle: "figee", niveau: 0, genre: "figee", regard: { x: 0, y: 0 }, clignement: 0 },
  { cle: "soulage", niveau: 0, genre: "soulage", regard: { x: 0, y: -0.6 }, clignement: 0 },
  { cle: "glissante", niveau: 0, genre: "glissante", regard: { x: 0, y: 0 }, clignement: 0 },
  { cle: "plisse", niveau: 0, genre: "plisse", regard: { x: 0.6, y: 0 }, clignement: 0 },
  { cle: "clin", niveau: 0, genre: "normal", regard: { x: 0, y: -0.5 }, clignement: 0.7 },
  { cle: "regardGauche", niveau: 0, genre: "normal", regard: { x: -1, y: 0.2 }, clignement: 0 },
  { cle: "regardDroite", niveau: 0, genre: "normal", regard: { x: 1, y: 0.2 }, clignement: 0 },
];
/** Le temps d'affichage de la planche (le tremblement et la pupille de la glissante en dépendent) : figé, pour que la planche soit la même à chaque ouverture. */
const T_PLANCHE = 1.3;

type Description = typeof import("@cdj/visuels/blocs");
interface Moteurs {
  d: Description;
  canvas: typeof import("@cdj/visuels/blocs/canvas");
  three: typeof import("@cdj/visuels/blocs/three");
  lib: typeof import("three");
  themes: typeof import("@cdj/visuels/blocs/themes");
  rendu: import("three").WebGLRenderer | null;
}

async function charger(): Promise<Moteurs> {
  const [d, canvas, three, lib, themes] = await Promise.all([import("@cdj/visuels/blocs"), import("@cdj/visuels/blocs/canvas"), import("@cdj/visuels/blocs/three"), import("three"), import("@cdj/visuels/blocs/themes")]);
  let rendu: import("three").WebGLRenderer | null = null;
  try {
    rendu = new lib.WebGLRenderer({ antialias: true });
    rendu.setPixelRatio(1);
    rendu.setSize(COTE, COTE, false);
  } catch {
    rendu = null; // pas de WebGL : la planche montre le Canvas 2D seul, et le dit
  }
  return { d, canvas, three, lib, themes, rendu };
}

const palette = (m: Moteurs, theme: ThemeBloc): PaletteTheme => (theme === "port" ? m.d.PALETTE_PORT : m.themes.PALETTES[theme]);

/** Le dessin d'une cellule par le dessinateur de Tower : le même appel que la scène de Tower (`poserCouches`, `Yeux`), vu de face, à `k` pixels par mètre, sur le ciel du thème. Renvoie les pixels, ou null sans WebGL. */
function parTower(m: Moteurs, cible: CanvasRenderingContext2D, p: PaletteTheme, k: number, couches: ReturnType<Description["decrirePiece"]>, yeux: { x: number; y: number; x2: Expression } | null): boolean {
  const r = m.rendu;
  if (!r) return false;
  const demi = COTE / 2 / k;
  const camera = new m.lib.OrthographicCamera(-demi, demi, demi, -demi, 0.1, 50);
  camera.position.z = 10;
  const scene = new m.lib.Scene();
  const g = new m.lib.Group();
  m.three.poserCouches(g, couches);
  if (yeux) {
    const y = new m.three.Yeux(g, yeux.x, yeux.y, 1, 0);
    y.appliquer(yeux.x2, T_PLANCHE);
  }
  scene.add(g);
  r.setClearColor(new m.lib.Color(p.ciel));
  r.render(scene, camera);
  cible.drawImage(r.domElement, 0, 0); // tout de suite, dans la même tâche : le tampon du moteur n'est pas gardé
  return true;
}

function nouveauCanvas(nom: string, libelle: string): HTMLCanvasElement {
  return el("canvas", { classe: "vitrine-blocs__canvas", attrs: { width: COTE, height: COTE, role: "img", "aria-label": libelle, "data-moteur": nom } });
}

/** La part de pixels qui diffèrent nettement entre deux canvases de même taille (0 à 1). */
function ecart(a: CanvasRenderingContext2D, b: CanvasRenderingContext2D): number {
  const x = a.getImageData(0, 0, COTE, COTE).data;
  const y = b.getImageData(0, 0, COTE, COTE).data;
  let n = 0;
  for (let i = 0; i < x.length; i += 4) if (Math.max(Math.abs(x[i]! - y[i]!), Math.abs(x[i + 1]! - y[i + 1]!), Math.abs(x[i + 2]! - y[i + 2]!)) > SEUIL_PIXEL) n++;
  return n / (COTE * COTE);
}

interface Cellule {
  m: Moteurs;
  langue: Langue;
  texte: (cle: string) => string;
  theme: ThemeBloc;
  forme: Forme;
  rot: number;
  k: number;
  etat: Etat | null;
  legende: string;
}

/** Une cellule : la même pièce en Canvas 2D (à gauche) et par le dessinateur de Tower (à droite), et l'écart mesuré entre les deux. */
function cellule(c: Cellule): HTMLElement {
  const { m } = c;
  const p = palette(m, c.theme);
  const bs = m.d.boitesDeForme(c.forme, c.rot);
  const couches = m.d.decrirePiece(bs, { couleur: p.pieces[c.forme], encre: m.d.ENCRE });
  const centre = m.d.centreDesYeux(bs);
  const expression = c.etat ? m.d.expressionDe({ niveau: c.etat.niveau, genre: c.etat.genre, regard: c.etat.regard, clignement: c.etat.clignement, t: T_PLANCHE }) : null;
  const nom = `${c.legende} · ${c.theme}`;
  const a = nouveauCanvas("canvas2d", `${nom} · ${c.texte("vitrine.blocs.canvas")}`);
  const b = nouveauCanvas("tower", `${nom} · ${c.texte("vitrine.blocs.tower")}`);
  const ca = a.getContext("2d")!;
  const cb = b.getContext("2d")!;
  ca.fillStyle = p.ciel;
  ca.fillRect(0, 0, COTE, COTE);
  cb.fillStyle = p.ciel;
  cb.fillRect(0, 0, COTE, COTE);
  const poses = expression ? m.d.disposerYeux(centre.x, centre.y, 1, expression, T_PLANCHE, 0) : undefined;
  m.canvas.dessinerPiece(ca, { x: COTE / 2, y: COTE / 2, pxParMetre: c.k }, couches, poses);
  const avecTower = parTower(m, cb, p, c.k, couches, expression ? { x: centre.x, y: centre.y, x2: expression } : null);
  const e = avecTower ? ecart(ca, cb) : null;
  const mesure = el("span", { classe: "vitrine-blocs__ecart dj-chiffres", texte: e === null ? c.texte("vitrine.blocs.sansWebgl") : `${c.texte("vitrine.blocs.ecart")} ${formatNombre(e * 100, c.langue, 1)} %` });
  const racine = el("figure", { classe: "vitrine-blocs__cellule", attrs: { "data-forme": c.forme, "data-theme": c.theme, ...(c.etat ? { "data-etat": c.etat.cle } : {}), ...(e === null ? {} : { "data-ecart": String(e) }) } }, el("div", { classe: "vitrine-blocs__paire" }, a, b), el("figcaption", { classe: "vitrine-blocs__legende" }, el("span", { texte: c.legende }), mesure));
  return racine;
}

/** La section : pour chaque thème, une ligne avec les sept formes, une autre avec les états des yeux. `texte` : les textes de la page (clés `vitrine.blocs.*`) ; la zone est remplie quand le module est arrivé. */
export function remplirBlocs(langue: Langue, texte: (cle: string) => string): HTMLElement {
  const zone = el("div", { classe: "vitrine-blocs", attrs: { "data-blocs": langue } });
  void charger().then((m) => {
    const enfants: HTMLElement[] = [el("p", { classe: "vitrine-intro", texte: texte("vitrine.blocs.intro") })];
    if (!m.rendu) enfants.push(el("p", { classe: "vitrine-intro", attrs: { role: "status" }, texte: texte("vitrine.blocs.sansWebgl") }));
    enfants.push(el("div", { classe: "vitrine-blocs__cles" }, el("span", { texte: `◧ ${texte("vitrine.blocs.canvas")}` }), el("span", { texte: `◨ ${texte("vitrine.blocs.tower")}` })));
    for (const theme of THEMES) {
      const base = { m, langue, texte, theme, rot: 0 };
      enfants.push(
        el("h3", { classe: "vitrine-sous-titre", attrs: { "data-theme-titre": theme }, texte: texte(`vitrine.blocs.theme.${theme}`) }),
        el("div", { classe: "vitrine-blocs__ligne" }, ...FORMES.map((forme) => cellule({ ...base, forme, k: K_PIECE, etat: ETATS[0]!, legende: forme }))),
        el("div", { classe: "vitrine-blocs__ligne" }, ...ETATS.map((etat) => cellule({ ...base, forme: "O", k: K_YEUX, etat, legende: texte(`vitrine.blocs.etat.${etat.cle}`) }))),
      );
    }
    zone.replaceChildren(...enfants);
    zone.dataset.pret = "true";
  });
  return zone;
}
