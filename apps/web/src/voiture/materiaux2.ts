// Lot 40 — les matériaux des paliers 2 et 3 (chargés à la demande : ce module n'est importé qu'au besoin). La caisse : une **peinture à deux
// couches** (`clearcoat`) qui reflète la carte d'environnement du thème (pas « reflets » de la scène), des vitres sombres réfléchissantes et
// opaques, des garnitures satinées ; ombrage lissé (les reflets glissent sur la caisse). Les roues : jantes en métal clair, pneus mats.
// Lot 40c : les mêmes couleurs que le palier 1 (la voiture ne change pas de teinte d'un palier à l'autre), la livrée dans le nuanceur, l'ombrage lissé
// avec des arêtes vives. Lot 45 : la carte d'environnement du thème est posée par matériau (`refleter`, composerP1.ts ; jamais `scene.environment`) ;
// `envMapIntensity` règle la part de chaque matériau, que l'intensité du thème multiplie.
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import { LIVREE } from "./livree";
import type { FabriqueMateriaux } from "./modele";
import { finiParSommet, srgb } from "./pieces";

export const MATERIAUX_2: FabriqueMateriaux = {
  caisse: (livree, nuit) => finiParSommet(new MeshPhysicalMaterial({ vertexColors: true, side: DoubleSide, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1 }), { livree, nuit }, "voiture-2"),
  roue: (angle) => finiParSommet(new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, envMapIntensity: 0.5 }), { angle }, "voiture-2"),
  lisse: 42,
  reflets: 0,
  matieres: () => ({
    palier: 2,
    peinture: { couleur: srgb(0xffffff), rugosite: 0.36, metal: 0, vernis: 1, livree: true },
    vitre: { couleur: srgb(0x0c141d), rugosite: 0.05, metal: 0.3, vernis: 1, vitre: true },
    garniture: { couleur: srgb(0x232428), rugosite: 0.55, metal: 0.1, vernis: 0 },
    creme: { couleur: srgb(LIVREE.creme), rugosite: 0.4, vernis: 1 },
    noir: { couleur: srgb(0x131417), rugosite: 0.65, vernis: 0 },
    metal: { couleur: srgb(0xcfd4db), rugosite: 0.26, metal: 0.7, vernis: 0 },
    cadre: { couleur: srgb(0x101114), rugosite: 0.4, vernis: 0.5 },
    grille: { couleur: srgb(0x40444b), rugosite: 0.32, metal: 0.55, vernis: 0 },
    boitier: { couleur: srgb(0x7b828c), rugosite: 0.18, metal: 0.7, vernis: 0 },
    plastique: { couleur: srgb(0x383a40), rugosite: 0.75, vernis: 0 },
  }),
  roueFinis: () => ({
    pneu: { couleur: srgb(0x202125), rugosite: 0.93 },
    flanc: { couleur: srgb(0x2b2d32), rugosite: 0.85 },
    marque: { couleur: srgb(0x70737b), rugosite: 0.65 },
    metal: { couleur: srgb(0xf0f2f6), rugosite: 0.34, metal: 0.12 },
    fond: { couleur: srgb(0x1c1d21), rugosite: 0.7, metal: 0.2 },
    moyeu: { couleur: srgb(0xeceff4), rugosite: 0.3, metal: 0.15 },
    disque: { couleur: srgb(0x303237), rugosite: 0.4, metal: 0.4 },
    etrier: { couleur: srgb(0xd7352b), rugosite: 0.4 },
  }),
};
