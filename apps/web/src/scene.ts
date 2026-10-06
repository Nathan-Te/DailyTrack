import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

/** Scène du lot 0 : un cube qui tourne. Remplacée par le rendu du circuit au lot 2. */
export function createDemoScene(canvasParent: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasParent.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x1b2a55);

  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(2.5, 2, 3.5);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const cube = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshStandardMaterial({ color: 0xffc83d, flatShading: true }));
  scene.add(cube);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  renderer.setAnimationLoop((t) => {
    cube.rotation.x = t * 0.0006;
    cube.rotation.y = t * 0.0009;
    renderer.render(scene, camera);
  });

  return { renderer, scene, camera, cube };
}
