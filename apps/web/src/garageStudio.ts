// Lot 40c — la lumière de présentation du Garage, **au Garage seulement** : une lumière principale (chaude, de trois quarts avant), une lumière de contour (froide, de
// derrière) qui dessine l'arête du toit et des ailes, et un plateau sombre dont le sol reflète un peu la voiture (un vrai reflet plan, `Reflector`) : on voit les volumes de
// la tôle. Monté à l'ouverture du Garage, retiré à sa fermeture : en course, la lumière reste celle du thème. Chargé avec le Garage (à la demande). Rendu seul.
import { BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, type Scene } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/** Les couleurs de la présentation (recopiées de la charte : le rendu 3D ne lit pas le CSS) : le crème de Track pour le liseré du plateau. */
const CREME = 0xede3cf;
const RAYON = 3.3;

/** Un disque (ou un anneau : `interieur` > 0) à plat dans le plan xy, `n` côtés : le garage n'importe ni `CircleGeometry` ni `RingGeometry` (ils alourdiraient le premier chargement). */
function disque(rayon: number, n: number, interieur = 0): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  if (interieur <= 0) pos.push(0, 0, 0);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (interieur > 0) pos.push(Math.cos(a) * interieur, Math.sin(a) * interieur, 0);
    pos.push(Math.cos(a) * rayon, Math.sin(a) * rayon, 0);
  }
  for (let i = 0; i < n; i++) {
    if (interieur <= 0) idx.push(0, i + 1, i + 2);
    else idx.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  }
  return new BufferGeometry().setAttribute("position", new Float32BufferAttribute(pos, 3)).setIndex(idx);
}

export interface Studio {
  /** Ajoute les lumières et le plateau à la scène. */
  monter(): void;
  /** Place le tout autour de la voiture (`x, y, z` : sa position). */
  placer(x: number, y: number, z: number): void;
  /** Retire tout de la scène et libère la carte du reflet. */
  demonter(): void;
  readonly monte: boolean;
}

export function creerStudio(scene: Scene): Studio {
  let groupe: Group | null = null;
  let miroir: Reflector | null = null;
  const pieces: { dispose(): void }[] = [];
  const cible = new Group();
  return {
    get monte() {
      return !!groupe;
    },
    monter() {
      if (groupe) return;
      const g = new Group();
      // La lumière principale : chaude, haute, de trois quarts avant ; elle sculpte le capot, les ailes et le flanc.
      const principale = new DirectionalLight(0xfff0dc, 2.6);
      principale.position.set(-4.5, 6.5, 5.5);
      principale.target = cible;
      // Le contour : froid, bas, de derrière (de l'autre côté) ; il fait lire le haut du toit, les épaules et le becquet.
      const contour = new DirectionalLight(0xa9c8ff, 2.2);
      contour.position.set(5, 3.2, -6.5);
      contour.target = cible;
      g.add(principale, contour, cible);
      // Le plateau : un reflet plan et, par-dessus, un voile sombre (le sol « reflète un peu »), un liseré crème au bord.
      miroir = new Reflector(disque(RAYON, 56), { textureWidth: 384, textureHeight: 384, clipBias: 0.003, color: new Color(0x9a9aa2) });
      // Le reflet n'est redessiné qu'une image sur trois (la caméra tourne lentement) : la scène n'est pas dessinée deux fois à chaque image, ce qui pèserait sur un téléphone.
      const redessiner = miroir.onBeforeRender;
      let image = 0;
      miroir.onBeforeRender = function (this: Reflector, ...a: Parameters<typeof redessiner>) {
        if (image++ % 3 === 0) redessiner.apply(this, a);
      };
      miroir.rotation.x = -Math.PI / 2;
      miroir.position.y = 0.032;
      const voileGeo = disque(RAYON, 56);
      const voileMat = new MeshBasicMaterial({ color: 0x151517, transparent: true, opacity: 0.5, depthWrite: false });
      const voile = new Mesh(voileGeo, voileMat);
      voile.rotation.x = -Math.PI / 2;
      voile.position.y = 0.036;
      voile.renderOrder = 2;
      const anneauGeo = disque(RAYON, 56, RAYON - 0.07);
      const anneauMat = new MeshBasicMaterial({ color: CREME, transparent: true, opacity: 0.85, depthWrite: false });
      const anneau = new Mesh(anneauGeo, anneauMat);
      anneau.rotation.x = -Math.PI / 2;
      anneau.position.y = 0.04;
      anneau.renderOrder = 3;
      g.add(miroir, voile, anneau);
      pieces.push(voileGeo, voileMat, anneauGeo, anneauMat);
      groupe = g;
      scene.add(g);
    },
    placer(x, y, z) {
      if (!groupe) return;
      groupe.position.set(x, y, z);
      cible.position.set(0, 0.6, 0); // relatif au groupe : la voiture
    },
    demonter() {
      if (!groupe) return;
      scene.remove(groupe);
      miroir?.dispose();
      miroir?.geometry.dispose();
      for (const p of pieces.splice(0)) p.dispose();
      miroir = null;
      groupe = null;
    },
  };
}
