import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { BOSS_IDS, CRACHEUR, GELATON, GELEE, TOTEM, type Contenu } from "@cdj/rush-sim";

// LES MODÈLES de Rush (lot BR-A1) : faits dans Blender par un script par modèle (`apps/rush/modeles/*.py`), exportés en glTF binaire, compressés par gltfpack (meshopt + quantification) dans `public/modeles/<nom>.glb`.
// Ce module les CHARGE (seulement ceux du jour : le boss du jour, les monstres présents, le chevalier, les vases) et les LIT sans le GLTFLoader de Three.js (un lecteur de quelques dizaines de lignes : aucun matériau, aucune
// texture, aucune animation — des maillages colorés par sommet et des pièces nommées). Le contrat, écrit aussi en tête de `modeles/commun.py` :
//  · une PIÈCE est un nœud nommé (`corps`, `tete`, `bras_g`…) ; sa géométrie est donnée dans SON repère (l'origine est le pivot de l'articulation, là où le code pose le groupe de la pièce) ; la translation du nœud est gardée
//    (`pivot`) pour que les tests la comparent à celle du code ;
//  · les maillages sous un nœud nommé (gltfpack y ajoute des nœuds sans nom qui portent la déquantification) sont cuits dans le repère de la pièce ;
//  · COLOR_0 : la couleur par sommet (linéaire) ; NORMAL : les normales (les plans taillés de la pierre sont des faces plates).
// Sans modèle chargé (les tests sous Node, un réseau en panne), chaque acteur garde sa forme procédurale d'avant : le jeu reste jouable.

/** Les modèles et leurs pièces nommées (l'ordre ne compte pas). Un modèle manquant ou une pièce manquante : la forme procédurale. */
export const PIECES = {
  chevalier: ["corps", "tete", "yeux", "plume", "arme", "bouclier", "pied_g", "pied_d"],
  golem: ["corps", "tete", "bras_g", "bras_d", "avant_bras_g", "avant_bras_d", "jambe_g", "jambe_d"],
  reine: ["corps", "couronne", "yeux"],
  "grand-duc": ["corps", "tete", "yeux", "ailes_g", "ailes_d"],
  belier: ["corps", "tete", "yeux", "patte_ag", "patte_ad", "patte_rg", "patte_rd"],
  chene: ["corps", "cime", "bras_g", "bras_d"],
  gelee: ["corps"],
  gelaton: ["corps"],
  "chauve-souris": ["corps", "yeux", "ailes_g", "ailes_d"],
  cracheur: ["corps"],
  chaman: ["corps"],
  totem: ["corps"],
  "porte-bouclier": ["corps", "bouclier"],
  couronne: ["corps"],
  jarre: ["corps", "eclat_1", "eclat_2", "eclat_3", "eclat_4"],
  tonneau: ["corps", "eclat_1", "eclat_2", "eclat_3", "eclat_4"],
  caisse: ["corps", "eclat_1", "eclat_2", "eclat_3", "eclat_4"],
  projectile: ["corps"],
  bouclier: ["corps"],
} as const;
export type NomModele = keyof typeof PIECES;
export const NOMS_MODELES = Object.keys(PIECES) as NomModele[];

/** Le modèle de chaque boss, dans l'ordre de `BOSS_IDS` ; de chaque type de monstre, dans l'ordre de `MONSTRES_IDS` ; de chaque genre de vase. */
export const MODELE_BOSS: readonly NomModele[] = ["golem", "reine", "grand-duc", "belier", "chene"];
export const MODELE_MONSTRE: readonly NomModele[] = ["gelee", "chauve-souris", "gelaton", "cracheur", "chaman", "totem", "porte-bouclier"];
export const MODELE_VASE: readonly NomModele[] = ["jarre", "tonneau", "caisse"];

export interface PieceModele {
  /** La géométrie dans le repère de la pièce (position, normale, couleur ; indexée). */
  geo: BufferGeometry;
  /** La translation du nœud dans le repère de son parent (le pivot de l'articulation). */
  pivot: [number, number, number];
  /** Le nom de la pièce parente, ou `null` (la racine). */
  parent: string | null;
}
export interface Modele {
  nom: string;
  pieces: Map<string, PieceModele>;
  triangles: number;
}

// --- La lecture d'un .glb -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
interface Gltf {
  nodes?: { name?: string; mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }[];
  meshes?: { primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[] }[];
  accessors?: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { buffer: number; byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }[];
  scenes?: { nodes: number[] }[];
}
const COMPOSANTES: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const TYPES: Record<number, { taille: number; lire: (d: DataView, o: number) => number; max: number }> = {
  5120: { taille: 1, lire: (d, o) => d.getInt8(o), max: 127 },
  5121: { taille: 1, lire: (d, o) => d.getUint8(o), max: 255 },
  5122: { taille: 2, lire: (d, o) => d.getInt16(o, true), max: 32767 },
  5123: { taille: 2, lire: (d, o) => d.getUint16(o, true), max: 65535 },
  5125: { taille: 4, lire: (d, o) => d.getUint32(o, true), max: 4294967295 },
  5126: { taille: 4, lire: (d, o) => d.getFloat32(o, true), max: 1 },
};

/** Lit un .glb (compressé par gltfpack ou non). `decodeur` : le décodeur meshopt, prêt (`MeshoptDecoder` après `ready`). */
export function lireGlb(nom: string, donnees: ArrayBuffer, decodeur: typeof MeshoptDecoder = MeshoptDecoder): Modele {
  const vue = new DataView(donnees);
  if (vue.getUint32(0, true) !== 0x46546c67) throw new Error(`${nom} : ce n'est pas un .glb`);
  let o = 12;
  let json: Gltf | null = null;
  let bin: Uint8Array | null = null;
  while (o < donnees.byteLength) {
    const long = vue.getUint32(o, true);
    const type = vue.getUint32(o + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(donnees, o + 8, long))) as Gltf;
    else if (type === 0x004e4942) bin = new Uint8Array(donnees, o + 8, long);
    o += 8 + long;
  }
  if (!json || !bin) throw new Error(`${nom} : .glb incomplet`);
  const g = json;
  const binaire = bin;
  // Les vues de tampon, décompressées une fois (meshopt) : chacune devient un tableau d'octets.
  const vues = new Map<number, Uint8Array>();
  const vueDe = (i: number): Uint8Array => {
    let v = vues.get(i);
    if (v) return v;
    const bv = g.bufferViews![i]!;
    const ext = bv.extensions?.EXT_meshopt_compression;
    if (ext) {
      v = new Uint8Array(ext.count * ext.byteStride);
      const source = binaire.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
      decodeur.decodeGltfBuffer(v, ext.count, ext.byteStride, source, ext.mode, ext.filter ?? "NONE");
    } else {
      v = binaire.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    }
    vues.set(i, v);
    return v;
  };
  // Un accesseur en flottants (les normalisés ramenés à −1..1 ou 0..1).
  const flottants = (i: number): { tab: Float32Array; n: number } => {
    const a = g.accessors![i]!;
    const n = COMPOSANTES[a.type]!;
    const t = TYPES[a.componentType]!;
    const octets = vueDe(a.bufferView!);
    const pas = g.bufferViews![a.bufferView!]!.extensions?.EXT_meshopt_compression?.byteStride ?? g.bufferViews![a.bufferView!]!.byteStride ?? n * t.taille;
    const d = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    const tab = new Float32Array(a.count * n);
    for (let k = 0; k < a.count; k++) {
      for (let c = 0; c < n; c++) {
        const brut = t.lire(d, (a.byteOffset ?? 0) + k * pas + c * t.taille);
        tab[k * n + c] = a.normalized ? Math.max(-1, brut / t.max) : brut;
      }
    }
    return { tab, n };
  };
  const indices = (i: number): Uint16Array | Uint32Array => {
    const a = g.accessors![i]!;
    const t = TYPES[a.componentType]!;
    const octets = vueDe(a.bufferView!);
    const d = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    const tab = a.count > 65535 || a.componentType === 5125 ? new Uint32Array(a.count) : new Uint16Array(a.count);
    for (let k = 0; k < a.count; k++) tab[k] = t.lire(d, (a.byteOffset ?? 0) + k * t.taille);
    return tab;
  };
  const locale = (i: number): Matrix4 => {
    const n = g.nodes![i]!;
    if (n.matrix) return new Matrix4().fromArray(n.matrix);
    const t = n.translation ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0, 1];
    const s = n.scale ?? [1, 1, 1];
    return new Matrix4().compose(new Vector3(t[0], t[1], t[2]), new Quaternion(r[0], r[1], r[2], r[3]), new Vector3(s[0], s[1], s[2]));
  };
  const pieces = new Map<string, PieceModele>();
  const morceaux = new Map<string, BufferGeometry[]>();
  let triangles = 0;
  // La descente : `piece` la pièce nommée la plus proche au-dessus, `m` la matrice des nœuds sans nom depuis elle.
  // Blender nomme ses objets pour tout le fichier : une deuxième pièce `corps` y devient `corps.001` ; le suffixe n'est pas le nom de la pièce.
  const nomDe = (i: number): string | undefined => g.nodes![i]!.name?.replace(/\.\d+$/, "");
  const descendre = (i: number, piece: string | null, m: Matrix4, parent: string | null): void => {
    const n = { ...g.nodes![i]!, name: nomDe(i) };
    let ici = piece;
    let mat = m;
    let parentDesEnfants = parent;
    if (n.name && piece !== null && n.mesh === undefined && (n.children?.length ?? 0) > 0) {
      // un nœud nommé : une pièce (la racine du modèle n'en est pas une)
      ici = n.name;
      mat = new Matrix4();
      const t = n.translation ?? [0, 0, 0];
      pieces.set(n.name, { geo: new BufferGeometry(), pivot: [t[0]!, t[1]!, t[2]!], parent });
      parentDesEnfants = n.name;
    } else if (n.name && piece !== null && n.mesh !== undefined) {
      // un nœud nommé qui porte lui-même son maillage (sans gltfpack) : sa géométrie est dans son repère
      ici = n.name;
      mat = new Matrix4();
      const t = n.translation ?? [0, 0, 0];
      pieces.set(n.name, { geo: new BufferGeometry(), pivot: [t[0]!, t[1]!, t[2]!], parent });
      parentDesEnfants = n.name;
    } else if (piece !== null) {
      mat = m.clone().multiply(locale(i));
    }
    if (n.mesh !== undefined && ici !== null) {
      for (const p of g.meshes![n.mesh]!.primitives) {
        if ((p.mode ?? 4) !== 4) continue;
        const geo = new BufferGeometry();
        const pos = flottants(p.attributes.POSITION!);
        geo.setAttribute("position", new BufferAttribute(pos.tab, 3));
        if (p.attributes.NORMAL !== undefined) geo.setAttribute("normal", new BufferAttribute(flottants(p.attributes.NORMAL).tab, 3));
        if (p.attributes.COLOR_0 !== undefined) {
          const c = flottants(p.attributes.COLOR_0);
          const rgb = new Float32Array((c.tab.length / c.n) * 3);
          for (let k = 0; k < rgb.length / 3; k++) for (let j = 0; j < 3; j++) rgb[k * 3 + j] = c.tab[k * c.n + j]!;
          geo.setAttribute("color", new BufferAttribute(rgb, 3));
        }
        if (p.indices !== undefined) geo.setIndex(new BufferAttribute(indices(p.indices), 1));
        geo.applyMatrix4(mat);
        // une normale quantifiée puis déformée par la matrice : on la renormalise
        const nr = geo.getAttribute("normal");
        if (nr) {
          const v = new Vector3();
          for (let k = 0; k < nr.count; k++) {
            v.fromBufferAttribute(nr, k).normalize();
            nr.setXYZ(k, v.x, v.y, v.z);
          }
        }
        triangles += (geo.index ? geo.index.count : pos.tab.length / 3) / 3;
        const liste = morceaux.get(ici) ?? [];
        liste.push(geo);
        morceaux.set(ici, liste);
      }
    }
    for (const c of n.children ?? []) descendre(c, ici, mat, parentDesEnfants);
  };
  const racines = g.scenes?.[0]?.nodes ?? [];
  for (const r of racines) {
    const n = g.nodes![r]!;
    // la racine du modèle (le vide qui porte son nom) : ses enfants sont les pièces
    for (const c of n.children ?? []) descendre(c, "", new Matrix4(), null);
  }
  for (const [nomPiece, geos] of morceaux) {
    const p = pieces.get(nomPiece);
    if (!p) continue;
    p.geo = geos.length === 1 ? geos[0]! : fusionnerGeos(geos);
  }
  return { nom, pieces, triangles };
}

/** Fusionne des géométries indexées de mêmes attributs (les primitives d'une pièce). */
function fusionnerGeos(geos: BufferGeometry[]): BufferGeometry {
  const noms = Object.keys(geos[0]!.attributes);
  const sortie = new BufferGeometry();
  let total = 0;
  let totalIdx = 0;
  for (const g of geos) {
    total += g.getAttribute("position").count;
    totalIdx += g.index ? g.index.count : g.getAttribute("position").count;
  }
  for (const n of noms) {
    const taille = geos[0]!.getAttribute(n).itemSize;
    const tab = new Float32Array(total * taille);
    let o = 0;
    for (const g of geos) {
      const a = g.getAttribute(n);
      tab.set(a.array as Float32Array, o);
      o += a.count * taille;
    }
    sortie.setAttribute(n, new BufferAttribute(tab, taille));
  }
  const idx = total > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);
  let o = 0;
  let base = 0;
  for (const g of geos) {
    const n = g.getAttribute("position").count;
    if (g.index) for (let k = 0; k < g.index.count; k++) idx[o++] = g.index.getX(k) + base;
    else for (let k = 0; k < n; k++) idx[o++] = k + base;
    base += n;
  }
  sortie.setIndex(new BufferAttribute(idx, 1));
  return sortie;
}

// --- Le registre des modèles chargés --------------------------------------------------------------------------------------------------------------------------------------------------------------
// Un CACHE d'actifs (jamais un état de partie) : un modèle lu une fois sert à toutes les parties de la page ; les acteurs le lisent à leur création.
const charges = new Map<NomModele, Modele>();

/** Le modèle `nom` s'il est chargé, sinon `null` (la forme procédurale). */
export function modele(nom: NomModele): Modele | null {
  return charges.get(nom) ?? null;
}
/** La géométrie d'une pièce d'un modèle chargé, ou `null`. */
export function pieceDe(nom: NomModele, piece: string): BufferGeometry | null {
  return charges.get(nom)?.pieces.get(piece)?.geo ?? null;
}
/** Enregistre un modèle lu (les tests sous Node le font depuis le disque). */
export function enregistrerModele(m: Modele): void {
  charges.set(m.nom as NomModele, m);
}
/** Oublie tous les modèles (tests). */
export function oublierModeles(): void {
  charges.clear();
}

/** Les modèles de toute partie (le chevalier, les vases, le bouclier lancé, la couronne des élites) : on peut les demander avant de connaître le jour. */
export const MODELES_COMMUNS: readonly NomModele[] = ["chevalier", "jarre", "tonneau", "caisse", "bouclier", "couronne"];

/** Les modèles dont une partie a besoin : le chevalier, les vases, le bouclier lancé, la couronne des élites ; le boss du jour ; les monstres PRÉSENTS dans le niveau (camps, groupes, épreuve) et ceux qu'on peut faire naître (le totem : des
 *  gélatons ; la reine et le chêne : des gelées) ; le projectile s'il y a un cracheur. Un scénario d'essai sans niveau prend tous les monstres ; le bestiaire, tous les boss. */
export function modelesDuContenu(c: Pick<Contenu, "niveau" | "boss" | "scenario" | "ennemis">): NomModele[] {
  const noms = new Set<NomModele>(MODELES_COMMUNS);
  const types = new Set<number>();
  if (c.niveau) {
    for (const m of c.niveau.monstres) types.add(m.type);
    for (const v of c.niveau.epreuve?.vagues ?? []) for (const m of v) types.add(m.type);
  } else for (let t = 0; t < MODELE_MONSTRE.length; t++) types.add(t);
  if (types.has(TOTEM)) types.add(GELATON);
  const bosses = c.scenario === "bestiaire" ? BOSS_IDS.map((_, i) => i) : [c.boss];
  for (const b of bosses) {
    noms.add(MODELE_BOSS[b] ?? "golem");
    if (b === 1 || b === 4) types.add(GELEE); // la reine se divise en gelées, le chêne en invoque
  }
  for (const t of types) noms.add(MODELE_MONSTRE[t] ?? "gelee");
  if (types.has(CRACHEUR)) noms.add("projectile");
  return [...noms];
}

const enCours = new Map<NomModele, Promise<boolean>>();
/**
 * Charge (en parallèle) les modèles demandés depuis `modeles/<nom>.glb` relativement à `base`, s'ils ne le sont pas déjà (une demande en cours n'est jamais refaite). Un modèle qui ne vient pas garde la forme procédurale ;
 * jamais plus de `delai` ms d'attente en tout (le chargement continue derrière, pour la partie suivante).
 */
export async function chargerModeles(noms: readonly NomModele[], base: string, delai = 8000): Promise<{ charges: NomModele[]; manques: NomModele[] }> {
  const resultat = { charges: [] as NomModele[], manques: [] as NomModele[] };
  const un = (n: NomModele): Promise<boolean> => {
    if (charges.has(n)) return Promise.resolve(true);
    let p = enCours.get(n);
    if (!p) {
      p = (async () => {
        try {
          await MeshoptDecoder.ready;
          const r = await fetch(new URL(`modeles/${n}.glb`, base));
          if (!r.ok) throw new Error(String(r.status));
          charges.set(n, lireGlb(n, await r.arrayBuffer()));
          return true;
        } catch {
          return false;
        } finally {
          enCours.delete(n);
        }
      })();
      enCours.set(n, p);
    }
    return p;
  };
  const tous = Promise.all(noms.map(async (n) => ((await un(n)) ? resultat.charges : resultat.manques).push(n)));
  let fin: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([tous, new Promise<void>((r) => (fin = setTimeout(r, delai)))]);
  clearTimeout(fin);
  for (const n of noms) if (!resultat.charges.includes(n) && !resultat.manques.includes(n)) resultat.manques.push(n);
  return resultat;
}
