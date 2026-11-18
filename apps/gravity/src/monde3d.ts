// Le monde de Gravity dessiné avec Three.js (lot GR3) : **les fonds, les tuiles et les couleurs viennent de `@cdj/visuels/plateformes`** (la DA de Jump : cinq thèmes, tuiles à bord clair selon leurs voisines, fonds en parallaxe), le reste
// — piques, blocs qui changent, inverseur, vent, tapis animé, pièces, gemmes, bonus — est propre à Gravity (`dessins.ts`). **Ce fichier ne lit que l'état de la simulation** (le terrain, les objets pris, le pas) : aucune logique de jeu.
//
// Le monde est infini : un morceau (16 colonnes) est construit quand il entre dans le champ et libéré quand il en sort ; un fond (une « bande » de 19 morceaux, un thème) est construit de même, **coupé net à la frontière du thème**
// par deux plans de découpe. Repère : x vers la droite en cases, y = −rangée (la rangée 0 est en haut), comme `@cdj/visuels`.
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Plane, Vector3, type Material } from "three";
import { ALTERNE_A, ALTERNE_B, BLOC, CASE, CLIGNOTANT, FRAGILE, FRAGILE_DELAI, GLACE, INVERSEUR, LARGEUR_MORCEAU, LIGNES, MORCEAUX_PAR_THEME, PIQUE, TAPIS, VENT, VIDE, caseDe, etatLaser, positionScie, type Fragile, type Laser, type Partie, type Scie, type Terrain, type TypePortail } from "@cdj/gravity-sim";
import { BELT_BAND, BELT_GAP, BELT_STYLE, THEMES, WIND_STYLE, type Theme } from "@cdj/visuels/plateformes";
import { Art, artGeometry, buildParallax, buildTileArt, layerOffset, visibleLayers, type CodesTuiles } from "@cdj/visuels/plateformes/three";
import type { CouleursGravity } from "./couleurs";
import { dessinCadrePortail, dessinIconePortail, dessinVoilePortail } from "./dessinsModes";
import { CHUTE_VISIBLE, ajouterPique, dessinAnnonceLaser, dessinBloc, dessinBonus, dessinChevrons, dessinFaisceau, dessinFleche, dessinFragile, dessinGemme, dessinInverseur, dessinLentille, dessinPiece, dessinRail, dessinScie, etatDuBloc, niveauDeFissure, type TypeBloc, type VarianteBloc } from "./dessins";

/** Colonnes de contexte lues de chaque côté d'un morceau pour que ses bords se raccordent à ses voisins (tuiles, ombres de profondeur). */
const MARGE = 4;
const VARIANTES: readonly VarianteBloc[] = ["plein", "alerte", "absent", "retour"];
const TYPES_BLOC: readonly TypeBloc[] = [CLIGNOTANT, ALTERNE_A, ALTERNE_B];

const CODES: CodesTuiles = {
  estMatiere: (t) => t === BLOC || t === TAPIS || t === GLACE,
  estGlace: (t) => t === GLACE,
  estPic: (t) => t === PIQUE,
  sensTapis: (t) => (t === TAPIS ? 1 : 0),
  vide: VIDE,
};

/** Les triangles d'un tampon dont le centre est dans les colonnes [x0, x1) : le morceau ne garde que les siennes, les colonnes de contexte ne servent qu'à raccorder les bords. */
export function geometrieDesColonnes(art: Art, x0: number, x1: number): BufferGeometry | null {
  const renum = new Map<number, number>();
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < art.idx.length; i += 3) {
    const s = [art.idx[i]!, art.idx[i + 1]!, art.idx[i + 2]!];
    const cx = (art.pos[s[0]! * 3]! + art.pos[s[1]! * 3]! + art.pos[s[2]! * 3]!) / 3;
    if (cx < x0 || cx >= x1) continue;
    for (const v of s) {
      let n = renum.get(v);
      if (n === undefined) {
        n = pos.length / 3;
        renum.set(v, n);
        pos.push(art.pos[v * 3]!, art.pos[v * 3 + 1]!, art.pos[v * 3 + 2]!);
        col.push(art.col[v * 3]!, art.col[v * 3 + 1]!, art.col[v * 3 + 2]!);
      }
      idx.push(n);
    }
  }
  if (idx.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Pour chaque case de la grille : la distance (cases) au pique le plus proche, que la garniture des tuiles évite (pas de bosse près d'un danger). */
function degagement(tuiles: ArrayLike<number>, largeur: number): Float32Array {
  const d = new Float32Array(largeur * LIGNES).fill(99);
  for (let r = 0; r < LIGNES; r++)
    for (let c = 0; c < largeur; c++) {
      if (tuiles[r * largeur + c] !== PIQUE) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= LIGNES || cc < 0 || cc >= largeur) continue;
          d[rr * largeur + cc] = Math.min(d[rr * largeur + cc]!, Math.hypot(dr, dc));
        }
    }
  return d;
}

interface BlocVu {
  type: TypeBloc;
  mesh: Mesh;
  etat: VarianteBloc;
}
interface ChevronsVu {
  mesh: Mesh;
  x0: number;
}
interface VentVu {
  fleches: Mesh[];
  /** La case : colonne et rangée. */
  cx: number;
  rangee: number;
}
/** Un portail (lot GR6) : son cadre et son voile (qui battent doucement), son icône (qui reste droite). */
interface PortailVu {
  cadre: Mesh;
  voile: Mesh;
  icone: Mesh;
  /** Un déphasage propre (le battement), en radians. */
  phase: number;
}
/** Lot GR7 : un sol fragile (sa case et son maillage), une scie (son disque ; le rail est fixe), un laser (l'annonce, le rayon, les deux lentilles). */
interface FragileVu {
  mesh: Mesh;
  cx: number;
  rangee: number;
  niveau: number;
}
interface ScieVue {
  scie: Scie;
  disque: Mesh;
  phase: number;
}
interface LaserVu {
  laser: Laser;
  annonce: Mesh;
  faisceau: Mesh;
  lentilles: Mesh[];
}
interface MorceauVu {
  groupe: Group;
  fragiles: FragileVu[];
  scies: ScieVue[];
  lasers: LaserVu[];
  portails: PortailVu[];
  decalage: number;
  blocs: BlocVu[];
  chevrons: ChevronsVu[];
  vent: VentVu[];
  pieces: Mesh[];
  gemmes: Mesh[];
  bonus: Mesh[];
  geometries: BufferGeometry[];
  materiaux: Material[];
}
interface BandeVue {
  groupe: Group;
  plans: { mesh: Mesh; index: number }[];
  theme: Theme;
  debut: number;
  geometries: BufferGeometry[];
  materiau: Material;
}

export interface EtatDuMonde {
  /** Le bord gauche de l'écran, et la largeur de l'écran, en cases ; le centre vertical visé (−6 : le milieu du monde). */
  cam: number;
  largeur: number;
  /** Le pas de la simulation et le temps de jeu (secondes de pas : la pause fige tout). */
  tick: number;
  temps: number;
}

export class Monde {
  readonly groupe = new Group();
  private readonly morceaux = new Map<number, MorceauVu>();
  private readonly bandes = new Map<number, BandeVue>();
  private readonly mat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  private readonly matVentFond = new MeshBasicMaterial({ color: WIND_STYLE.leaf, transparent: true, opacity: 0.14, side: DoubleSide, depthWrite: false });
  private readonly matVentBord = new MeshBasicMaterial({ color: WIND_STYLE.edge, transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false });
  private readonly matFleche = new MeshBasicMaterial({ color: WIND_STYLE.arrow, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false });
  private readonly partagees: BufferGeometry[] = [];
  private readonly geoPiece: BufferGeometry;
  private readonly geoGemme: BufferGeometry;
  private readonly geoBonus: Record<"bouclier" | "aimant", BufferGeometry>;
  private readonly geoInverseur: BufferGeometry;
  private readonly geoFleche: BufferGeometry;
  private readonly geoBloc = new Map<string, BufferGeometry>();
  /** Lot GR7 : les dessins des dangers, partagés (les fissures à quatre niveaux, le disque de scie, les rails par longueur, les lentilles, le rayon et son annonce). */
  private readonly geoFragile: BufferGeometry[];
  private readonly geoScie: BufferGeometry;
  private readonly geoRails = new Map<number, BufferGeometry>();
  private readonly geoLentille: BufferGeometry;
  private readonly geoFaisceau: BufferGeometry;
  private readonly geoAnnonceLaser: BufferGeometry;
  private readonly matFaisceau = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, side: DoubleSide, depthWrite: false });
  private readonly matAnnonceLaser = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, side: DoubleSide, depthWrite: false });
  /** Lot GR6 : les tampons des portails, gardés par type et par hauteur libre (en rangées) — partagés par tous les portails qui se ressemblent. */
  private readonly geoPortails = new Map<string, BufferGeometry>();
  private readonly matVoile = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.24, side: DoubleSide, depthWrite: false });

  /** Lot GR5 : la longueur d'un thème (un essai peut la régler : `?longueur=`) vient des règles du terrain, plus d'une constante. */
  private readonly morceauxParTheme: number;
  private readonly colonnesParBande: number;

  constructor(
    private readonly terrain: Terrain,
    private readonly jour: number,
    private readonly c: CouleursGravity,
    private readonly reduit: boolean,
  ) {
    this.morceauxParTheme = terrain.regles?.morceauxParTheme ?? MORCEAUX_PAR_THEME;
    this.colonnesParBande = this.morceauxParTheme * LARGEUR_MORCEAU;
    const garder = (a: Art): BufferGeometry => {
      const g = artGeometry(a);
      this.partagees.push(g);
      return g;
    };
    this.geoPiece = garder(dessinPiece(c.encre, c.papier));
    this.geoGemme = garder(dessinGemme(c.encre, c.diamant));
    this.geoBonus = { bouclier: garder(dessinBonus("bouclier", c.encre, c.papier, c.diamant)), aimant: garder(dessinBonus("aimant", c.encre, c.papier, c.diamant)) };
    this.geoInverseur = garder(dessinInverseur(c.papier));
    this.geoFleche = garder(dessinFleche(0xffffff));
    for (const t of TYPES_BLOC) for (const v of VARIANTES) this.geoBloc.set(`${t}:${v}`, garder(dessinBloc(t, v)));
    this.geoFragile = ([0, 1, 2, 3] as const).map((n) => garder(dessinFragile(n, c.encre)));
    this.geoScie = garder(dessinScie(c.encre, c.papier));
    this.geoLentille = garder(dessinLentille(c.encre));
    this.geoFaisceau = garder(dessinFaisceau());
    this.geoAnnonceLaser = garder(dessinAnnonceLaser());
  }

  /** Le thème d'un morceau : celui de la bande où il se trouve. */
  themeDe(k: number): Theme {
    return THEMES[this.terrain.morceau(k).theme];
  }

  // ——— Les morceaux ———
  private construireMorceau(k: number): MorceauVu {
    const m = this.terrain.morceau(k);
    const theme = THEMES[m.theme];
    const groupe = new Group();
    const vu: MorceauVu = { groupe, fragiles: [], scies: [], lasers: [], portails: [], decalage: m.decalage, blocs: [], chevrons: [], vent: [], pieces: [], gemmes: [], bonus: [], geometries: [], materiaux: [] };
    const x0 = k * LARGEUR_MORCEAU;

    // Les tuiles : la grille du morceau avec `MARGE` colonnes de ses voisins de chaque côté ; seules les colonnes du morceau sont gardées.
    const L = LARGEUR_MORCEAU + 2 * MARGE;
    const tuiles = new Uint8Array(L * LIGNES);
    for (let r = 0; r < LIGNES; r++) for (let j = 0; j < L; j++) tuiles[r * L + j] = caseDe(this.terrain, x0 - MARGE + j, r);
    const art = buildTileArt({ width: L, height: LIGNES, tiles: tuiles }, theme.tiles, CODES, degagement(tuiles, L));
    for (const ch of art.chunks) {
      const g = geometrieDesColonnes(ch.art, MARGE, MARGE + LARGEUR_MORCEAU);
      if (!g) continue;
      vu.geometries.push(g);
      const mesh = new Mesh(g, this.mat);
      mesh.position.x = x0 - MARGE;
      groupe.add(mesh);
    }

    // Les cases qui ne sont pas de la matière : piques (un tampon), blocs qui changent, inverseurs, vent.
    const piques = new Art();
    const vent = new Art();
    const ventBord = new Art();
    const ventCases: { cx: number; r: number }[] = [];
    const estVent = (cx: number, r: number): boolean => caseDe(this.terrain, cx, r) === VENT;
    for (let c = 0; c < LARGEUR_MORCEAU; c++) {
      const cx = x0 + c;
      for (let r = 0; r < LIGNES; r++) {
        const type = m.cases[c * LIGNES + r]!;
        if (type === VIDE) continue;
        if (type === PIQUE) {
          // pointe vers la surface en face : base posée sur la matière dessous, sinon accrochée au-dessus
          const dessous = caseDe(this.terrain, cx, r + 1);
          ajouterPique(piques, cx, r, dessous !== VIDE && dessous !== PIQUE && dessous !== VENT);
        } else if (type === CLIGNOTANT || type === ALTERNE_A || type === ALTERNE_B) {
          const mesh = new Mesh(this.geoBloc.get(`${type}:plein`)!, this.mat);
          mesh.position.set(cx, -r - 1, 0);
          groupe.add(mesh);
          vu.blocs.push({ type, mesh, etat: "plein" });
        } else if (type === FRAGILE) {
          const mesh = new Mesh(this.geoFragile[0]!, this.mat);
          mesh.position.set(cx, -r - 1, 0);
          groupe.add(mesh);
          vu.fragiles.push({ mesh, cx, rangee: r, niveau: 0 });
        } else if (type === INVERSEUR) {
          const mesh = new Mesh(this.geoInverseur, this.mat);
          mesh.position.set(cx, -r - 1, 0);
          groupe.add(mesh);
        } else if (type === VENT) {
          ventCases.push({ cx, r });
          vent.rect(cx, -r - 1, cx + 1, -r, 0.01, 0xffffff);
          const l = 0.05;
          if (!estVent(cx, r - 1)) ventBord.rect(cx, -r - l, cx + 1, -r, 0.011, 0xffffff);
          if (!estVent(cx, r + 1)) ventBord.rect(cx, -r - 1, cx + 1, -r - 1 + l, 0.011, 0xffffff);
          if (!estVent(cx - 1, r)) ventBord.rect(cx, -r - 1, cx + l, -r, 0.011, 0xffffff);
          if (!estVent(cx + 1, r)) ventBord.rect(cx + 1 - l, -r - 1, cx + 1, -r, 0.011, 0xffffff);
        }
      }
    }
    const ajouter = (a: Art, materiau: Material): void => {
      if (a.idx.length === 0) return;
      const g = artGeometry(a);
      vu.geometries.push(g);
      groupe.add(new Mesh(g, materiau));
    };
    ajouter(piques, this.mat);
    ajouter(vent, this.matVentFond);
    ajouter(ventBord, this.matVentBord);
    for (const { cx, r } of ventCases) {
      const fleches = [0, 1].map(() => {
        const f = new Mesh(this.geoFleche, this.matFleche);
        groupe.add(f);
        return f;
      });
      vu.vent.push({ fleches, cx, rangee: r });
    }

    // Les tapis : des chevrons qui glissent sur la bande de la face du dessus (découpés aux bouts du tapis par deux plans), un par tronçon.
    for (let r = 1; r < LIGNES; r++) {
      let c = 0;
      while (c < LARGEUR_MORCEAU) {
        const expose = (cc: number): boolean => m.cases[cc * LIGNES + r] === TAPIS && caseDe(this.terrain, x0 + cc, r - 1) === VIDE;
        if (!expose(c)) {
          c++;
          continue;
        }
        let fin = c;
        while (fin < LARGEUR_MORCEAU && expose(fin)) fin++;
        const debut = x0 + c;
        const longueur = fin - c;
        const g = artGeometry(dessinChevrons(longueur, 0xffffff, 1));
        const materiau = new MeshBasicMaterial({ color: BELT_STYLE.chevron, side: DoubleSide, clippingPlanes: [new Plane(new Vector3(1, 0, 0), -(debut + 0.1)), new Plane(new Vector3(-1, 0, 0), debut + longueur - 0.1)] });
        vu.geometries.push(g);
        vu.materiaux.push(materiau);
        const mesh = new Mesh(g, materiau);
        mesh.position.set(debut, -r - BELT_GAP - BELT_BAND / 2, 0);
        groupe.add(mesh);
        vu.chevrons.push({ mesh, x0: debut });
        c = fin;
      }
    }

    // Les scies (lot GR7) : un rail d'encre, fixe, et le disque rouge qui y va et vient (sa place et sa rotation sont posées à chaque image).
    m.scies.forEach((sc, i) => {
      const dx = (sc.x1 - sc.x0) / CASE;
      const dy = -(sc.y1 - sc.y0) / CASE;
      const longueur = Math.hypot(dx, dy);
      const cle = Math.round(longueur * 4);
      let rail = this.geoRails.get(cle);
      if (!rail) this.geoRails.set(cle, (rail = artGeometry(dessinRail(longueur, this.c.encre))));
      const r = new Mesh(rail, this.mat);
      r.position.set(sc.x0 / CASE, -sc.y0 / CASE, 0);
      r.rotation.z = Math.atan2(dy, dx);
      groupe.add(r);
      const disque = new Mesh(this.geoScie, this.mat);
      groupe.add(disque);
      vu.scies.push({ scie: sc, disque, phase: i * 1.7 });
    });
    // Les lasers (lot GR7) : deux lentilles aux bouts, le mince trait pâle de l'annonce et le rayon (qui ne se montrent qu'à leur tour).
    for (const l of m.lasers) {
      const x = x0 + l.c + 0.5;
      const haut = -l.r0;
      const bas = -(l.r1 + 1);
      const hauteur = haut - bas;
      const poserLaser = (mesh: Mesh): Mesh => {
        mesh.position.set(x, bas, 0);
        mesh.scale.y = hauteur;
        mesh.visible = false;
        groupe.add(mesh);
        return mesh;
      };
      const annonce = poserLaser(new Mesh(this.geoAnnonceLaser, this.matAnnonceLaser));
      const faisceau = poserLaser(new Mesh(this.geoFaisceau, this.matFaisceau));
      const lentilles = [haut, bas].map((y) => {
        const lentille = new Mesh(this.geoLentille, this.mat);
        lentille.position.set(x, y, 0);
        groupe.add(lentille);
        return lentille;
      });
      vu.lasers.push({ laser: l, annonce, faisceau, lentilles });
    }

    // Les portails (lot GR6) : une arche de papier et d'encre sur la plus grande ouverture de leur colonne, avec l'icône de leur mode.
    for (const [i, p] of m.portails.entries()) {
      const ouverture = this.ouverture(m.cases, p.c);
      if (!ouverture) continue;
      const rangees = ouverture.bas - ouverture.haut + 1;
      const x = x0 + p.c + 0.5;
      const y = -(ouverture.haut + ouverture.bas + 1) / 2;
      const poser = (mesh: Mesh, z: number): Mesh => {
        mesh.position.set(x, y, z);
        groupe.add(mesh);
        return mesh;
      };
      vu.portails.push({
        cadre: poser(new Mesh(this.geoPortail(p.type, rangees, "cadre"), this.mat), 0.06),
        voile: poser(new Mesh(this.geoPortail(p.type, rangees, "voile"), this.matVoile), 0.05),
        icone: poser(new Mesh(this.geoPortail(p.type, rangees, "icone"), this.mat), 0.07),
        phase: i * 1.3 + p.c,
      });
    }

    // Les objets à ramasser : une maille par objet, partagent leur géométrie ; leur place et leur visibilité sont posées à chaque image.
    for (let i = 0; i < m.pieces.length; i++) vu.pieces.push(this.objet(groupe, this.geoPiece));
    for (const g of m.gemmes) {
      const o = this.objet(groupe, this.geoGemme);
      o.position.set(g.x / 4096, -g.y / 4096, 0);
      vu.gemmes.push(o);
    }
    for (const b of m.bonus) {
      const o = this.objet(groupe, this.geoBonus[b.type]);
      o.position.set(b.x / 4096, -b.y / 4096, 0);
      vu.bonus.push(o);
    }
    return vu;
  }

  /** La plus grande ouverture (rangées `haut` à `bas`, comprises) de la colonne `c` du morceau : ce que traverse le joueur (le vide, le vent et les piques ne sont pas de la matière). Null s'il n'y en a pas. */
  private ouverture(cases: Uint8Array, c: number): { haut: number; bas: number } | null {
    let meilleure: { haut: number; bas: number } | null = null;
    let debut = -1;
    for (let r = 0; r <= LIGNES; r++) {
      const type = r < LIGNES ? cases[c * LIGNES + r]! : BLOC;
      const libre = type === VIDE || type === VENT || type === PIQUE;
      if (libre && debut < 0) debut = r;
      if (!libre && debut >= 0) {
        if (!meilleure || r - debut > meilleure.bas - meilleure.haut + 1) meilleure = { haut: debut, bas: r - 1 };
        debut = -1;
      }
    }
    return meilleure;
  }

  /** Un tampon de portail : le cadre (encre et bande de la couleur du mode), le voile ou l'icône ; gardé par type, partie et hauteur (le dessin de l'icône n'en dépend pas). */
  private geoPortail(type: TypePortail, rangees: number, partie: "cadre" | "voile" | "icone"): BufferGeometry {
    const cle = partie === "icone" ? `${type}:icone` : `${type}:${rangees}:${partie}`;
    let g = this.geoPortails.get(cle);
    if (!g) {
      const demi = Math.max(0.6, rangees / 2 - 0.08);
      g = artGeometry(partie === "cadre" ? dessinCadrePortail(type, demi, this.c.encre, this.c.papier) : partie === "voile" ? dessinVoilePortail(type, demi, this.c.papier) : dessinIconePortail(type, this.c.encre, this.c.papier));
      this.geoPortails.set(cle, g);
    }
    return g;
  }

  private objet(groupe: Group, geo: BufferGeometry): Mesh {
    const o = new Mesh(geo, this.mat);
    groupe.add(o);
    return o;
  }

  private libererMorceau(vu: MorceauVu): void {
    this.groupe.remove(vu.groupe);
    for (const g of vu.geometries) g.dispose();
    for (const mt of vu.materiaux) mt.dispose();
  }

  // ——— Les fonds : un thème par bande, coupé net à sa frontière ———
  private construireBande(b: number): BandeVue {
    const debut = b * this.colonnesParBande;
    const fin = debut + this.colonnesParBande;
    const theme = this.themeDe(b * this.morceauxParTheme);
    const materiau = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, clippingPlanes: [new Plane(new Vector3(1, 0, 0), -debut), new Plane(new Vector3(-1, 0, 0), fin)] });
    const groupe = new Group();
    const geometries: BufferGeometry[] = [];
    const ciel = new Art();
    ciel.rect(debut - 80, -150, fin + 80, 150, -9, theme.palette.background);
    const gc = artGeometry(ciel);
    geometries.push(gc);
    groupe.add(new Mesh(gc, materiau));
    const plans: BandeVue["plans"] = [];
    const couches = buildParallax(theme, this.colonnesParBande, `${this.jour}:${b}`);
    // mouvement réduit : tous les plans restent, mais collés à l'écran (`layerOffset`, mouvement 0) — rien ne défile
    const n = visibleLayers(couches.length, false);
    for (let i = 0; i < n; i++) {
      const g = artGeometry(couches[i]!.art);
      geometries.push(g);
      const mesh = new Mesh(g, materiau);
      groupe.add(mesh);
      plans.push({ mesh, index: i });
    }
    return { groupe, plans, theme, debut, geometries, materiau };
  }

  /** Construit ce qui entre dans le champ, libère ce qui en sort, et pose tout ce qui bouge. */
  maj(e: EtatDuMonde, partie: Partie): void {
    const k0 = Math.max(0, Math.floor(e.cam / LARGEUR_MORCEAU) - 1);
    const k1 = Math.floor((e.cam + e.largeur) / LARGEUR_MORCEAU) + 1;
    for (const [k, vu] of this.morceaux) {
      if (k < k0 - 1 || k > k1 + 1) {
        this.libererMorceau(vu);
        this.morceaux.delete(k);
      }
    }
    for (let k = k0; k <= k1; k++) {
      if (this.morceaux.has(k)) continue;
      const vu = this.construireMorceau(k);
      this.morceaux.set(k, vu);
      this.groupe.add(vu.groupe);
    }
    const b0 = Math.floor(k0 / this.morceauxParTheme);
    const b1 = Math.floor(k1 / this.morceauxParTheme);
    for (const [b, bande] of this.bandes) {
      if (b < b0 || b > b1) {
        this.groupe.remove(bande.groupe);
        for (const g of bande.geometries) g.dispose();
        bande.materiau.dispose();
        this.bandes.delete(b);
      }
    }
    for (let b = b0; b <= b1; b++) {
      if (!this.bandes.has(b)) {
        const bande = this.construireBande(b);
        this.bandes.set(b, bande);
        this.groupe.add(bande.groupe);
      }
    }

    // Les fonds suivent la caméra selon le facteur de chaque plan (mouvement réduit : ils restent collés à l'écran).
    const centre = e.cam + e.largeur / 2;
    for (const bande of this.bandes.values()) {
      for (const { mesh, index } of bande.plans) {
        const o = layerOffset(bande.theme.parallax[index]!, centre - bande.debut, -LIGNES / 2, -LIGNES / 2, this.reduit ? 0 : 1);
        mesh.position.set(bande.debut + o.x, o.y, 0);
      }
    }

    const decalageTapis = (e.temps * 1.5) % 0.5;
    for (const [k, vu] of this.morceaux) {
      for (const bloc of vu.blocs) {
        const etat = etatDuBloc(bloc.type, e.tick, vu.decalage);
        if (etat !== bloc.etat) {
          bloc.etat = etat;
          bloc.mesh.geometry = this.geoBloc.get(`${bloc.type}:${etat}`)!;
        }
      }
      for (const ch of vu.chevrons) ch.mesh.position.x = ch.x0 + (this.reduit ? 0 : decalageTapis);
      // les portails battent doucement (le cadre s'élargit et se resserre) ; mouvement réduit : ils restent fixes
      for (const pt of vu.portails) {
        const battement = this.reduit ? 1 : 1 + 0.07 * Math.sin(e.temps * 4.5 + pt.phase);
        pt.cadre.scale.x = battement;
        pt.voile.scale.x = battement;
      }
      // Lot GR7 : les sols fragiles (les fissures grandissent, puis le tronçon tombe), les scies (elles tournent et vont et viennent), les lasers (le trait pâle, puis le rayon).
      for (const f of vu.fragiles) this.majFragile(f, partie.fragiles, e.tick);
      for (const sv of vu.scies) {
        const [sx, sy] = positionScie(sv.scie, e.tick);
        sv.disque.position.set(sx / CASE, -sy / CASE, 0);
        sv.disque.rotation.z = this.reduit ? sv.phase : -(e.temps * 9 + sv.phase);
      }
      for (const lv of vu.lasers) {
        const etat = etatLaser(e.tick, lv.laser.decalage);
        // l'annonce clignote de plus en plus vite avant que le rayon brûle ; mouvement réduit : le trait reste allumé
        const clignote = this.reduit ? true : Math.trunc(e.tick / (etat === 1 ? 8 : 4)) % 2 === 0;
        lv.annonce.visible = etat === 1 && clignote;
        lv.faisceau.visible = etat === 2;
        if (etat === 2) lv.faisceau.scale.x = this.reduit ? 1 : 1 + 0.12 * Math.sin(e.temps * 70);
        for (const l of lv.lentilles) l.scale.setScalar(etat === 2 ? 1.2 : etat === 1 ? 1.08 : 1);
      }
      for (const v of vu.vent) {
        for (let i = 0; i < v.fleches.length; i++) {
          const f = v.fleches[i]!;
          // une flèche monte d'une case par seconde et se fond dans les bords de sa case : le flux paraît continu d'une case à l'autre
          const u = this.reduit ? 0.5 : (e.temps * 1.1 + i * 0.5) % 1;
          const s = Math.max(0.05, Math.sin(Math.PI * u));
          f.position.set(v.cx + 0.3 + i * 0.4, -v.rangee - 1 + u, 0);
          f.scale.set(s, s, 1);
        }
      }
      const charge = partie.charge(k);
      const m = this.terrain.morceau(k);
      for (let i = 0; i < vu.pieces.length; i++) {
        const pc = charge.pieces[i]!;
        const o = vu.pieces[i]!;
        o.visible = pc.etat === 0;
        if (!o.visible) continue;
        // la pièce tourne sur elle-même (la tranche : une fente), au rythme du temps de jeu, déphasée selon sa place
        o.position.set(pc.x / 4096, -pc.y / 4096, 0);
        o.scale.x = this.reduit ? 1 : Math.max(0.18, Math.abs(Math.cos(e.temps * 3 + m.pieces[i]!.x / 4096)));
      }
      for (let i = 0; i < vu.gemmes.length; i++) {
        const o = vu.gemmes[i]!;
        o.visible = !charge.gemmes[i];
        o.position.y = -m.gemmes[i]!.y / 4096 + (this.reduit ? 0 : Math.sin(e.temps * 3) * 0.08);
      }
      for (let i = 0; i < vu.bonus.length; i++) {
        const o = vu.bonus[i]!;
        o.visible = !charge.bonus[i];
        o.position.y = -m.bonus[i]!.y / 4096 + (this.reduit ? 0 : Math.sin(e.temps * 2.5) * 0.1);
      }
    }
  }

  /** Un sol fragile : intact, puis les fissures qui grandissent depuis qu'on s'y est posé, puis il tombe (il glisse vers le bas et disparaît) — le tronçon entier, au pas de sa chute. */
  private majFragile(f: FragileVu, runs: readonly Fragile[], tick: number): void {
    let run: Fragile | null = null;
    for (const r of runs) if (r.cy === f.rangee && f.cx >= r.cx0 && f.cx <= r.cx1) run = r;
    const age = run ? tick - run.t0 : -1;
    if (age >= FRAGILE_DELAI) {
      const depuis = age - FRAGILE_DELAI;
      f.mesh.visible = depuis < CHUTE_VISIBLE;
      if (f.mesh.visible) {
        f.mesh.position.y = -f.rangee - 1 - 0.0016 * depuis * depuis;
        f.mesh.rotation.z = this.reduit ? 0 : -0.012 * depuis * (f.cx % 2 === 0 ? 1 : -1);
      }
      return;
    }
    f.mesh.visible = true;
    f.mesh.position.y = -f.rangee - 1;
    f.mesh.rotation.z = 0;
    // un léger tremblement quand il est sur le point de tomber (jamais avec « réduire les animations »)
    if (age >= FRAGILE_DELAI - 14 && !this.reduit) f.mesh.position.x = f.cx + (Math.trunc(tick / 2) % 2 === 0 ? 0.02 : -0.02);
    else f.mesh.position.x = f.cx;
    const niveau = niveauDeFissure(age, FRAGILE_DELAI);
    if (niveau !== f.niveau) {
      f.niveau = niveau;
      f.mesh.geometry = this.geoFragile[niveau]!;
    }
  }

  detruire(): void {
    for (const vu of this.morceaux.values()) this.libererMorceau(vu);
    this.morceaux.clear();
    for (const bande of this.bandes.values()) {
      for (const g of bande.geometries) g.dispose();
      bande.materiau.dispose();
    }
    this.bandes.clear();
    for (const g of this.partagees) g.dispose();
    for (const g of this.geoPortails.values()) g.dispose();
    this.geoPortails.clear();
    for (const g of this.geoRails.values()) g.dispose();
    this.geoRails.clear();
    for (const mt of [this.mat, this.matVentFond, this.matVentBord, this.matFleche, this.matVoile, this.matFaisceau, this.matAnnonceLaser]) mt.dispose();
    this.groupe.clear();
  }
}
