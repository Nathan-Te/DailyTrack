import { el, type Langue } from "@cdj/ui";
import type { Look, Motion, Theme, ThemeName } from "@cdj/visuels/plateformes";

// Lot DA2 : la section « Plateformes » de la vitrine `/ui/` (recette et aperçus seulement) : les cinq thèmes d'un jeu de plateformes, dessinés par le
// dessinateur Three.js commun (`@cdj/visuels/plateformes/three`, celui que Jump appelle en jeu) sur une petite grille de démonstration (sol, bloc
// surélevé, tapis, glace), le personnage dans ses poses, et les blocs à mécanique par leurs couleurs réservées (clignotant, alterné A et B, vent).
// Tout est chargé à la demande (Three.js compris) : la vitrine seule le paie. Un seul moteur WebGL pour toute la planche (les navigateurs en limitent
// le nombre) ; les scènes sont copiées dans des canvas 2D. Le décor posé (arbres, lampadaires…) dépend du niveau d'un jeu : il n'est pas montré ici.

/** Une scène : 20 × 7 tuiles à 32 px. */
const LARGEUR = 20;
const HAUTEUR = 7;
const K = 32;
/** Côté du personnage (tuiles) : celui de la boîte de Jump (3 072 / 4 096 de tuile). */
const BOITE = 0.75;
const BLOC = 88;

// Une grille de démonstration : 0 vide, 1 plein, 2 glace, 3 tapis vers la droite, 4 tapis vers la gauche.
const SOL = 5;
const TUILES = new Uint8Array(LARGEUR * HAUTEUR);
for (let c = 0; c < LARGEUR; c++) for (let r = SOL; r < HAUTEUR; r++) TUILES[r * LARGEUR + c] = 1;
for (const c of [12, 13]) TUILES[(SOL - 1) * LARGEUR + c] = 1;
for (let c = 4; c <= 7; c++) TUILES[SOL * LARGEUR + c] = c < 6 ? 3 : 4;
for (let c = 15; c <= 18; c++) TUILES[SOL * LARGEUR + c] = 2;
const GRILLE = { width: LARGEUR, height: HAUTEUR, tiles: TUILES };

type Moteurs = {
  d: typeof import("@cdj/visuels/plateformes");
  three: typeof import("@cdj/visuels/plateformes/three");
  lib: typeof import("three");
  rendu: import("three").WebGLRenderer | null;
};

async function charger(): Promise<Moteurs> {
  const [d, three, lib] = await Promise.all([import("@cdj/visuels/plateformes"), import("@cdj/visuels/plateformes/three"), import("three")]);
  let rendu: import("three").WebGLRenderer | null = null;
  try {
    rendu = new lib.WebGLRenderer({ antialias: true });
    rendu.setPixelRatio(1);
  } catch {
    rendu = null; // pas de WebGL : la planche le dit
  }
  return { d, three, lib, rendu };
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

function canvas(l: number, h: number, libelle: string, attrs: Record<string, string> = {}): HTMLCanvasElement {
  return el("canvas", { classe: "vitrine-plateformes__canvas", attrs: { width: l, height: h, role: "img", "aria-label": libelle, ...attrs } });
}

/** Le regard et les pieds d'une pose, comme l'animation du jeu les donne (`feetTarget`), sans lissage. */
function poseDe(m: Moteurs, mouvement: Motion, stride: number): Look {
  const cible = m.d.feetTarget(mouvement, stride);
  return { ...m.d.restLook(), stride, pose: cible.pose, feet: cible.feet, bob: cible.bob };
}
const COURSE: Motion = { vx: 8, vyUp: 0, ground: true, slide: 0, runSpeed: 11, fallSpeed: 22 };
const POSES: readonly { cle: string; look: (m: Moteurs) => Look }[] = [
  { cle: "arret", look: (m) => m.d.restLook() },
  { cle: "course", look: (m) => poseDe(m, COURSE, 0.75) },
  { cle: "montee", look: (m) => poseDe(m, { ...COURSE, vx: 0, vyUp: 8, ground: false }, 0) },
  { cle: "chute", look: (m) => poseDe(m, { ...COURSE, vx: 0, vyUp: -12, ground: false }, 0) },
  { cle: "mur", look: (m) => poseDe(m, { ...COURSE, vx: 0, vyUp: -2, ground: false, slide: 1 }, 0) },
];

/** Une scène vue de face par le dessinateur commun : le ciel, les plans de parallaxe, les tuiles de la grille, le personnage. Renvoie null sans WebGL. */
interface Vue {
  x0: number;
  x1: number;
  /** Haut et bas de la vue (tuiles, y vers le haut : le sol est à −`SOL`). */
  haut: number;
  bas: number;
  /** Pixels par tuile. */
  k: number;
}
const VUE_SCENE: Vue = { x0: 0, x1: LARGEUR, haut: 0, bas: -HAUTEUR, k: K };
/** Les poses : deux tuiles de large autour du personnage, à 64 px par tuile (les pieds se voient). */
const VUE_POSE: Vue = { x0: 1.5, x1: 3.5, haut: -3.4, bas: -SOL - 0.6, k: 64 };

function scene(m: Moteurs, theme: Theme, look: Look, x: number, vue: Vue = VUE_SCENE): HTMLCanvasElement | null {
  const r = m.rendu;
  if (!r) return null;
  const { lib, three: t } = m;
  const l = (vue.x1 - vue.x0) * vue.k;
  const h = (vue.haut - vue.bas) * vue.k;
  r.setSize(l, h, false);
  r.setClearColor(new lib.Color(theme.palette.background), 1);
  const cam = new lib.OrthographicCamera(vue.x0, vue.x1, vue.haut, vue.bas, -10, 10);
  const s = new lib.Scene();
  const matiere = () => new lib.MeshBasicMaterial({ vertexColors: true, side: lib.DoubleSide });
  const plans = matiere();
  for (const p of t.buildParallax(theme, LARGEUR, `vitrine:${theme.name}`)) {
    const mesh = new lib.Mesh(t.artGeometry(p.art), plans);
    const o = t.layerOffset(p.layer, (vue.x0 + vue.x1) / 2, (vue.haut + vue.bas) / 2, -HAUTEUR / 2);
    mesh.position.set(o.x, o.y, 0);
    s.add(mesh);
  }
  const codes = { estMatiere: (c: number) => c >= 1 && c <= 4, estGlace: (c: number) => c === 2, estPic: () => false, sensTapis: (c: number) => (c === 3 ? 1 : c === 4 ? -1 : 0), vide: 0 };
  const sol = matiere();
  for (const c of t.buildTileArt(GRILLE, theme.tiles, codes, new Float32Array(LARGEUR * HAUTEUR).fill(9)).chunks) if (c.art.triangles > 0) s.add(new lib.Mesh(t.artGeometry(c.art), sol));
  const perso = t.creerPersonnage({ couleur: theme.palette.player, largeur: BOITE, hauteur: BOITE });
  perso.groupe.position.set(x, -SOL, 0.2);
  perso.poser({ look });
  s.add(perso.groupe);
  r.render(s, cam);
  const sortie = canvas(l, h, `${theme.label}`, { "data-theme": theme.name, "data-moteur": "three" });
  sortie.getContext("2d")!.drawImage(r.domElement, 0, 0); // tout de suite, dans la même tâche : le tampon du moteur n'est pas gardé
  return sortie;
}

/** Un bloc à mécanique : un carré à ses couleurs réservées (Canvas 2D, d'après `BLOCK_STYLE` et `WIND_STYLE`). */
function bloc(m: Moteurs, cle: string, libelle: string): HTMLElement {
  const c = canvas(BLOC, BLOC, libelle, { "data-bloc": cle });
  const g = c.getContext("2d")!;
  const { BLOCK_STYLE, WIND_STYLE, WIND_EDGE_OPACITY, WIND_ARROW_ON } = m.d;
  g.fillStyle = hex(m.d.THEMES.nuit.palette.background);
  g.fillRect(0, 0, BLOC, BLOC);
  const o = 12;
  const w = BLOC - 2 * o;
  const plein = (fill: number, edge: number) => {
    g.fillStyle = hex(fill);
    g.fillRect(o, o, w, w);
    g.strokeStyle = hex(edge);
    g.lineWidth = 4;
    g.strokeRect(o + 2, o + 2, w - 4, w - 4);
  };
  if (cle === "clignotant") plein(BLOCK_STYLE.blink.fill, BLOCK_STYLE.blink.edge);
  else if (cle === "absent") {
    g.strokeStyle = hex(BLOCK_STYLE.blink.edge);
    g.lineWidth = 3;
    g.setLineDash([6, 5]);
    g.strokeRect(o + 1.5, o + 1.5, w - 3, w - 3);
  } else if (cle === "alterneA" || cle === "alterneB") {
    const s = cle === "alterneA" ? BLOCK_STYLE.altA : BLOCK_STYLE.altB;
    plein(s.fill, s.edge);
    g.fillStyle = hex(s.edge);
    if (cle === "alterneA") g.fillRect(BLOC / 2 - 3, o + 12, 6, w - 24); // le repère de A : une barre
    else {
      g.beginPath(); // le repère de B : un losange
      g.moveTo(BLOC / 2, o + 14);
      g.lineTo(BLOC - o - 14, BLOC / 2);
      g.lineTo(BLOC / 2, BLOC - o - 14);
      g.lineTo(o + 14, BLOC / 2);
      g.closePath();
      g.fill();
    }
  } else if (cle === "vent") {
    g.globalAlpha = WIND_EDGE_OPACITY * 3;
    g.strokeStyle = hex(WIND_STYLE.edge);
    g.lineWidth = 2;
    g.strokeRect(o + 1, o + 1, w - 2, w - 2);
    g.globalAlpha = WIND_ARROW_ON;
    g.fillStyle = hex(WIND_STYLE.arrow);
    for (const y of [BLOC * 0.36, BLOC * 0.64]) {
      g.beginPath();
      g.moveTo(o + 14, y - 6);
      g.lineTo(BLOC - o - 26, y - 6);
      g.lineTo(BLOC - o - 26, y - 13);
      g.lineTo(BLOC - o - 10, y);
      g.lineTo(BLOC - o - 26, y + 13);
      g.lineTo(BLOC - o - 26, y + 6);
      g.lineTo(o + 14, y + 6);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    for (const [x, y, col] of [[0.3, 0.2, WIND_STYLE.leaf], [0.7, 0.8, WIND_STYLE.leafDark], [0.5, 0.5, WIND_STYLE.pollen]] as const) {
      g.fillStyle = hex(col);
      g.fillRect(BLOC * x - 3, BLOC * y - 3, 6, 6);
    }
  }
  return el("figure", { classe: "vitrine-plateformes__bloc", attrs: { "data-bloc": cle } }, c, el("figcaption", { classe: "vitrine-plateformes__legende", texte: libelle }));
}

/** La section : un thème par ligne (la scène avec le personnage à l'arrêt, le tapis et la glace), les poses du personnage, les blocs à mécanique. `texte` : les textes de la page (clés `vitrine.plateformes.*`) ; la zone est remplie quand le module est arrivé. */
export function remplirPlateformes(langue: Langue, texte: (cle: string) => string): HTMLElement {
  const zone = el("div", { classe: "vitrine-plateformes", attrs: { "data-plateformes": langue } });
  void charger().then((m) => {
    const enfants: HTMLElement[] = [el("p", { classe: "vitrine-intro", texte: texte("vitrine.plateformes.intro") })];
    if (!m.rendu) enfants.push(el("p", { classe: "vitrine-intro", attrs: { role: "status" }, texte: texte("vitrine.plateformes.sansWebgl") }));
    for (const nom of m.d.THEME_NAMES as readonly ThemeName[]) {
      const theme = m.d.THEMES[nom];
      const c = scene(m, theme, m.d.restLook(), 2.5);
      enfants.push(el("h3", { classe: "vitrine-sous-titre", attrs: { "data-theme-titre": nom }, texte: texte(`vitrine.plateformes.theme.${nom}`) }), el("div", { classe: "vitrine-plateformes__ligne" }, ...(c ? [c] : [])));
    }
    // Les poses du personnage, sur le premier thème.
    enfants.push(el("h3", { classe: "vitrine-sous-titre", texte: texte("vitrine.plateformes.poses") }));
    const poses: HTMLElement[] = [];
    for (const p of POSES) {
      const c = scene(m, m.d.THEMES.foret, p.look(m), 2.5, VUE_POSE);
      if (c) poses.push(el("figure", { classe: "vitrine-plateformes__bloc", attrs: { "data-pose": p.cle } }, c, el("figcaption", { classe: "vitrine-plateformes__legende", texte: texte(`vitrine.plateformes.pose.${p.cle}`) })));
    }
    enfants.push(el("div", { classe: "vitrine-plateformes__ligne vitrine-plateformes__ligne--poses" }, ...poses));
    enfants.push(
      el("h3", { classe: "vitrine-sous-titre", texte: texte("vitrine.plateformes.blocs") }),
      el("div", { classe: "vitrine-plateformes__ligne" }, ...["clignotant", "absent", "alterneA", "alterneB", "vent"].map((k) => bloc(m, k, texte(`vitrine.plateformes.bloc.${k}`)))),
    );
    zone.replaceChildren(...enfants);
    zone.dataset.pret = "true";
  });
  return zone;
}
