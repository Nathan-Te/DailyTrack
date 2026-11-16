import { AmbientLight, BackSide, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, SRGBColorSpace, WebGLRenderer, DoubleSide, FrontSide, Matrix4, Vector3 } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MODELES } from "../src/modeles/index";
import { coque } from "../src/modeles/outils";
import { modele3D } from "../src/modeles/trois";
import { ENCRE, type Modele3D } from "../src/modeles/types";
import { PALETTES } from "../src/dessin";
import type { ThemePinball } from "@cdj/pinball-sim";

// Un OUTIL du lot PBV4 (jamais dans le jeu ni dans la CI) : la planche « catalogue », les 16 modèles des modules communs côte à côte et de près, rendus par le vrai code des modèles (`src/modeles/`), sur un carré
// de la couleur du sol de leur thème, sous la lumière du jeu (ciel, soleil bas, reflets de la pièce) et la caméra du jeu (66° au-dessus de la table). Deux rangées par thème : au repos, puis au contact (le bumper
// enfoncé et allumé, la cible à mi-chute, le spinner tourné, le trou qui garde la bille). Chargé par `captures-lot-pbv4.spec.ts` depuis le serveur de dev de Vite (`npx vite --port 4190`).

const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];
const TYPES = ["bumper", "cible", "spinner", "trou"] as const;

export function dessinerCatalogue(canvas: HTMLCanvasElement, contact: boolean): void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(2);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const scene = new Scene();
  scene.background = new Color("#24170e");
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new HemisphereLight("#ffe6c0", "#5a3a22", 0.41), new AmbientLight("#ffffff", 0.1));
  const soleil = new DirectionalLight("#ffc888", 1.15);
  soleil.position.set(-300, 500, -600);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 2000 });
  scene.add(soleil);
  const encre = new MeshBasicMaterial({ color: ENCRE, side: BackSide });
  const PAS = 62;
  THEMES.forEach((theme, ligne) => {
    TYPES.forEach((type, col) => {
      const g = new Group();
      g.position.set((col - 1.5) * PAS, 0, (ligne - 1.5) * PAS);
      const sol = new Mesh(new PlaneGeometry(PAS - 4, PAS - 4), new MeshStandardMaterial({ color: PALETTES[theme].fond, roughness: 0.6 }));
      sol.rotation.x = -Math.PI / 2;
      sol.receiveShadow = true;
      g.add(sol);
      const m: Modele3D = modele3D(theme, type);
      const lum = type === "trou" ? MODELES[theme].lumieres.trou : MODELES[theme].lumieres.bumper;
      for (const p of m.pieces) {
        const couleur = p.role === "lumiere" ? (contact ? new Color(lum[1]).multiplyScalar(1.8) : new Color(lum[0])) : new Color(p.m.teintes?.[col % p.m.teintes.length] ?? p.m.c);
        if (p.variante === 1 && !contact) continue;
        if (p.variante === 0 && contact) continue;
        const mat = new MeshStandardMaterial({ color: couleur, roughness: p.m.rug ?? 0.45, metalness: p.m.met ?? 0, envMapIntensity: p.m.env ?? 0.5, emissive: p.m.em ?? "#000000", transparent: (p.m.op ?? 1) < 1, opacity: p.m.op ?? 1, depthWrite: (p.m.op ?? 1) >= 1, side: p.m.deux ? DoubleSide : FrontSide });
        const mesh = new Mesh(p.geo, mat);
        mesh.castShadow = !p.sansOmbre;
        mesh.receiveShadow = true;
        // au contact : la même animation que `trois.ts`
        const a = new Matrix4();
        if (contact && p.role === "haut") {
          const y = m.pivot?.[1] ?? 3;
          a.makeTranslation(0, y, 0).multiply(new Matrix4().makeScale(1.12, 0.72, 1.12)).multiply(new Matrix4().makeTranslation(0, -y, 0));
        }
        if (contact && p.role === "tourne") {
          const pv = m.pivot ?? [0, 0, 0];
          const ax = m.axe ?? [1, 0, 0];
          a.makeTranslation(pv[0], pv[1], pv[2]).multiply(new Matrix4().makeRotationAxis(new Vector3(...ax).normalize(), 0.5)).multiply(new Matrix4().makeTranslation(-pv[0], -pv[1], -pv[2]));
        }
        if (contact && type === "cible") a.makeTranslation(0, -10, -3).multiply(new Matrix4().makeRotationX(-0.55)).multiply(new Matrix4().makeTranslation(0, 0, 3));
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(a);
        g.add(mesh);
        if (p.contour) {
          const c = new Mesh(coque(p.geo, p.contour), encre);
          c.matrixAutoUpdate = false;
          c.matrix.copy(a);
          g.add(c);
        }
      }
      scene.add(g);
    });
  });
  const camera = new PerspectiveCamera(20, canvas.clientWidth / canvas.clientHeight, 10, 4000);
  const el = (66 * Math.PI) / 180;
  camera.position.set(0, Math.sin(el) * 820, Math.cos(el) * 820 + 8);
  camera.lookAt(0, 0, 8);
  renderer.render(scene, camera);
}
