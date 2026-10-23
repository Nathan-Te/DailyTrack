// Lot 41 — les vignettes des voitures du Garage : chaque modèle dessiné une fois, de trois quarts avant, par le moteur hors écran des miniatures
// (`sharedRenderer`, thumbnail.ts, prêté par le jeu : aucun contexte WebGL de plus), en orange de Track ; une voiture verrouillée en silhouette (même modèle, matière
// plate). Chargé avec le Garage (jamais au premier écran) ; gardées en mémoire (une image par voiture et par état). Sans WebGL : pas d'image.
import { DirectionalLight, HemisphereLight, MeshBasicMaterial, NeutralToneMapping, PerspectiveCamera, Scene, Color, type Mesh, type WebGLRenderer } from "three";
import type { FicheVoiture } from "./voiture/catalogue";
import { PALETTE } from "./voiture/livree";
import { construireVoiture, type Voiture } from "./voiture/modele";

export const VIGNETTE_L = 240;
export const VIGNETTE_H = 110;
/** Le fond des cartes du Garage (`--track-piste` de la charte, recopié en nombre : le rendu 3D ne lit pas le CSS). */
const FOND = 0x26221f;

/** La teinte d'une voiture verrouillée (une silhouette : même modèle, matière plate, sans livrée). */
export const TEINTE_SILHOUETTE = 0x0f0d0c;

/** Une voiture verrouillée : sa forme, toute noire (une matière plate pour tous ses maillages ; les matières d'origine sont libérées). */
export function enSilhouette(v: Voiture): void {
  const noir = new MeshBasicMaterial({ color: TEINTE_SILHOUETTE });
  v.group.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const ancienne of Array.isArray(m.material) ? m.material : [m.material]) ancienne.dispose();
    m.material = noir;
  });
}

const cache = new Map<string, Promise<string | null>>();

/** L'image d'une voiture (adresse `data:`), ou `null` (pas de WebGL, modèle introuvable). */
export function vignette(fiche: FicheVoiture, silhouette: boolean, moteur: () => WebGLRenderer | null): Promise<string | null> {
  const cle = `${fiche.id}|${silhouette}`;
  let p = cache.get(cle);
  if (!p) {
    p = dessiner(fiche, silhouette, moteur).catch(() => null);
    cache.set(cle, p);
  }
  return p;
}

async function dessiner(fiche: FicheVoiture, silhouette: boolean, moteur: () => WebGLRenderer | null): Promise<string | null> {
  const plan = await fiche.charger();
  const renderer = moteur();
  if (!renderer) return null;
  const scene = new Scene();
  scene.background = new Color(FOND);
  scene.add(new HemisphereLight(0xdfeaff, 0x4a4440, 1.6));
  const soleil = new DirectionalLight(0xffffff, 2.2);
  soleil.position.set(-4, 8, 6);
  scene.add(soleil);
  const v = construireVoiture(plan, { palier: 1, couleur: PALETTE[0]!.hex, numero: "", motif: "bande" });
  if (silhouette) enSilhouette(v);
  v.group.rotation.y = 0.6;
  v.update({ forward: 0, steerAngle: 0.25, braking: false, droop: [0, 0, 0, 0], dt: 0 });
  scene.add(v.group);
  const camera = new PerspectiveCamera(15, VIGNETTE_L / VIGNETTE_H, 0.1, 100);
  camera.position.set(0, 2.6, 11);
  camera.lookAt(0, 0.55, 0);
  try {
    renderer.setSize(VIGNETTE_L, VIGNETTE_H, false);
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.render(scene, camera);
    const out = document.createElement("canvas");
    out.width = VIGNETTE_L;
    out.height = VIGNETTE_H;
    // Copie immédiate (le tampon n'est valable que pendant la tâche en cours) ; le canvas est relu par `toDataURL` (lot R3 : `willReadFrequently`).
    out.getContext("2d", { willReadFrequently: true })!.drawImage(renderer.domElement, 0, 0);
    return renderer.getContext().isContextLost() ? null : out.toDataURL("image/png");
  } finally {
    v.dispose();
  }
}
