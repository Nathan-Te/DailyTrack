import { BackSide, BufferGeometry, Color, DataTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, MeshToonMaterial, RedFormat, ShaderMaterial, Vector2, type Material, type Texture } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ENCRE } from "./palette";

// L'ombrage « cel » de Rush (lot BR0c) : un ombrage toon ADOUCI — une rampe à CINQ paliers aux transitions douces (une petite texture peinte, filtrée) — plus un petit liseré de lumière sur les personnages. Le contour a deux voies :
//  · en HAUTE qualité, il est dessiné par le post-traitement (profondeur : `rendu.ts`) et les coques sont éteintes ;
//  · en BASSE qualité, une COQUE inversée (la forme lissée, vue de l'intérieur) dont l'épaisseur est CONSTANTE À L'ÉCRAN (en pixels : on la décale dans l'espace de l'écran, pas dans celui du monde).
// Pas de fichier : la rampe est une texture de 64 pixels peinte ici.

/** Les cinq paliers de la rampe (de l'ombre à la pleine lumière) et les valeurs de `dot(normale, lumière) × 0,5 + 0,5` où l'on passe de l'un à l'autre. */
const PALIERS = [0.34, 0.54, 0.72, 0.88, 1.0] as const;
const SEUILS = [0.4, 0.52, 0.64, 0.78] as const;
const DOUCEUR = 0.05;
const lissage = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function rampe(): DataTexture {
  const n = 64;
  const d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    let v: number = PALIERS[0];
    for (let k = 0; k < SEUILS.length; k++) v += (PALIERS[k + 1]! - PALIERS[k]!) * lissage(SEUILS[k]! - DOUCEUR, SEUILS[k]! + DOUCEUR, u);
    d[i] = Math.round(v * 255);
  }
  const t = new DataTexture(d, n, 1, RedFormat);
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}
const degrade = rampe();

/** La couleur du liseré (une lumière chaude du ciel qui effleure les bords) et sa force. */
const LISERE = "vec3(1.0, 0.93, 0.78)";

/** Un matériau toon à rampe douce, avec le liseré de lumière. Chaque personnage a le sien (l'éclair blanc le modifie). `couleurs` : la forme porte ses couleurs par sommet ; `couleur` les multiplie. `lisere` : la force du liseré (0 pour le décor). */
export const plat = (couleur: number, couleurs = false, lisere = 0.32): MeshToonMaterial => {
  const m = new MeshToonMaterial({ color: couleur, gradientMap: degrade, vertexColors: couleurs });
  if (lisere > 0) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float lisere = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
         outgoingLight += ${LISERE} * lisere * ${lisere.toFixed(3)};
         #include <opaque_fragment>`,
      );
    };
    m.customProgramCacheKey = () => `lisere${lisere.toFixed(3)}`;
  }
  return m;
};
/** Un aplat sans lumière (les yeux, les lueurs, les effets). `intensite` > 1 : une lueur (le post-traitement la fait fleurir ; sans lui, elle reste une couleur vive). */
export const uni = (couleur: number, intensite = 1): MeshBasicMaterial => {
  const m = new MeshBasicMaterial({ color: couleur, fog: false });
  m.color.multiplyScalar(intensite);
  return m;
};

// --- Le contour par coque (basse qualité) ---------------------------------------------------------------------------------------------------------------------------------------------------------
/** L'épaisseur du contour en pixels à 1080 de haut (2,5) : elle suit la hauteur de l'écran. Celui du post-traitement (haute qualité) la prend telle quelle ; la coque (basse qualité) en montre un peu moins que son décalage (la moitié du trait se cache derrière la forme) : elle décale de 3,4. */
export const CONTOUR_PX_1080 = 2.5;
const COQUE_PX_1080 = 3.4;
/** La coque et le post-traitement ne se dessinent jamais ensemble : la coque est sur ce calque, que la caméra allume en basse qualité seulement. */
export const CALQUE_COQUE = 1;
/** Le pas du contour en coordonnées d'écran (−1 à 1) par pixel : partagé par toutes les coques, mis à jour à chaque redimensionnement. */
const pasContour = { value: new Vector2(0.003, 0.005) };
export function regler(largeur: number, hauteur: number, ratio = 1): void {
  const px = Math.max(2, (COQUE_PX_1080 * hauteur * ratio) / 1080);
  pasContour.value.set((2 * px) / (largeur * ratio), (2 * px) / (hauteur * ratio));
}
const matiereCoque = new ShaderMaterial({
  side: BackSide,
  uniforms: { pas: pasContour, c: { value: new Color(ENCRE) } },
  vertexShader: `uniform vec2 pas;
    void main(){
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec2 d = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy;
      float n = length(d);
      if (n > 1e-5) p.xy += d / n * pas * p.w;
      gl_Position = p;
    }`,
  fragmentShader: "uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }",
  fog: false,
});

/** Lot BR5 : la coque de contour d'un tas INSTANCIÉ (les gélatons, les vases) : la même, mais le décalage suit la matrice de chaque instance. */
export function coqueInstanciee(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: { pas: pasContour, c: { value: new Color(ENCRE) } },
    vertexShader: `uniform vec2 pas;
      void main(){
        mat4 mv = modelViewMatrix;
        #ifdef USE_INSTANCING
          mv = modelViewMatrix * instanceMatrix;
        #endif
        vec4 p = projectionMatrix * mv * vec4(position, 1.0);
        vec2 d = (projectionMatrix * vec4(normalize(mat3(mv) * normal), 0.0)).xy;
        float n = length(d);
        if (n > 1e-5) p.xy += d / n * pas * p.w;
        gl_Position = p;
      }`,
    fragmentShader: "uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }",
    fog: false,
  });
}

/** Lot BR-A3 : la coque de contour d'un modèle ANIMÉ (squelette) : la même, après le skinning (`USE_SKINNING` : Three.js le pose pour un `SkinnedMesh`). */
export function coqueSkinnee(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: { pas: pasContour, c: { value: new Color(ENCRE) } },
    vertexShader: `uniform vec2 pas;
      #include <common>
      #include <skinning_pars_vertex>
      void main(){
        #include <skinbase_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 p = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        vec2 d = (projectionMatrix * vec4(normalize(normalMatrix * objectNormal), 0.0)).xy;
        float n = length(d);
        if (n > 1e-5) p.xy += d / n * pas * p.w * 0.75;
        gl_Position = p;
      }`,
    fragmentShader: "uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }",
    fog: false,
  });
}

/** Lot BR-A3 : la MARQUE d'un modèle texturé dans l'alpha de l'image de la scène (haute qualité) : le post-traitement n'y trace que la SILHOUETTE (pas de traits intérieurs : la texture dessine déjà les détails, comme la cible). */
export const MARQUE_TEXTURE = 0.5;

/** Lot BR-A3 : le matériau d'un modèle tiers : la rampe toon et le liseré sur sa TEXTURE de couleur de base (`map`), et la marque « texturé » dans l'alpha. */
export function peau(map: Texture | null, lueur: Texture | null = null, lisere = 0.28): MeshToonMaterial {
  const m = new MeshToonMaterial({ color: 0xffffff, map, gradientMap: degrade });
  // La LUEUR (les yeux du golem) : une texture ajoutée à la lumière, ×2,4 (au-delà de 1 : le bloom la fait fleurir). Pas l'`emissive` de Three.js : il sert à l'éclair blanc d'un coup (`eclair`).
  const avecLueur = !!(lueur && map);
  m.onBeforeCompile = (sh) => {
    if (avecLueur) {
      sh.uniforms.tLueur = { value: lueur };
      sh.fragmentShader = "uniform sampler2D tLueur;\n" + sh.fragmentShader;
    }
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float lisere = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
       outgoingLight += ${LISERE} * lisere * ${lisere.toFixed(3)};
       ${avecLueur ? "outgoingLight += texture2D(tLueur, vMapUv).rgb * 2.4;" : ""}
       #include <opaque_fragment>
       gl_FragColor.a = ${MARQUE_TEXTURE.toFixed(2)};`,
    );
  };
  m.customProgramCacheKey = () => `peau${lisere.toFixed(3)}${avecLueur ? "l" : ""}`;
  return m;
}

const lisses = new WeakMap<BufferGeometry, BufferGeometry>();
/** La même forme aux normales lissées (sans arête vive) : le contour d'un cube ou d'un cylindre ne se déchire pas aux angles. */
export function lisse(g: BufferGeometry): BufferGeometry {
  let l = lisses.get(g);
  if (!l) {
    const c = g.clone();
    c.deleteAttribute("normal");
    c.deleteAttribute("uv");
    c.deleteAttribute("color");
    l = mergeVertices(c, 1e-4);
    l.computeVertexNormals();
    lisses.set(g, l);
  }
  return l;
}

export interface Piece {
  groupe: Group;
  corps: Mesh;
  matiere: MeshToonMaterial;
}

/** Une pièce : la forme ombrée (elle porte une ombre) et sa coque de contour (calque de la basse qualité), dans un groupe qu'on déplace et qu'on déforme d'un bloc. `couleurs` : la géométrie porte l'attribut `color` (pièces fusionnées). */
export function piece(g: BufferGeometry, couleur: number, avecContour = true, couleurs = false, matiereDonnee?: MeshToonMaterial): Piece {
  const groupe = new Group();
  const matiere = matiereDonnee ?? plat(couleur, couleurs);
  const corps = new Mesh(g, matiere);
  corps.castShadow = true;
  groupe.add(corps);
  if (avecContour) {
    const coque = new Mesh(lisse(g), matiereCoque);
    coque.layers.set(CALQUE_COQUE);
    groupe.add(coque);
  }
  return { groupe, corps, matiere };
}

/** Une forme sans ombrage ni contour (un œil, une lueur). */
export function aplat(g: BufferGeometry, couleur: number, intensite = 1): Mesh {
  return new Mesh(g, uni(couleur, intensite));
}

/** L'éclair blanc : de 0 (rien) à 1 (tout blanc). */
export function eclair(matieres: readonly Material[], f: number): void {
  for (const m of matieres) (m as MeshToonMaterial).emissive.setScalar(f);
}
