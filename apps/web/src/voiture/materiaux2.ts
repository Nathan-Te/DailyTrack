// Lot 40 — les matériaux des paliers 2 et 3 (chargés à la demande : ce module n'est importé qu'au besoin). La caisse : une **peinture à deux
// couches** (`clearcoat`) qui reflète la carte d'environnement du thème (pas « reflets » de la scène), des vitres sombres réfléchissantes et
// opaques, des garnitures satinées ; ombrage lissé (les reflets glissent sur la caisse). Les roues : jantes en métal clair, pneus mats.
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import { LIVREE } from "./livree";
import type { FabriqueMateriaux } from "./modele";
import { finiParSommet, srgb } from "./pieces";

export const MATERIAUX_2: FabriqueMateriaux = {
  caisse: (livree, nuit) => finiParSommet(new MeshPhysicalMaterial({ vertexColors: true, side: DoubleSide, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1 }), { livree, nuit }, "voiture-2"),
  roue: (angle) => finiParSommet(new MeshStandardMaterial({ vertexColors: true }), { angle }, "voiture-2"),
  lisse: 40,
  matieres: () => ({
    palier: 2,
    peinture: { couleur: srgb(0xffffff), rugosite: 0.38, metal: 0, vernis: 1, livree: true },
    vitre: { couleur: srgb(0x0b1016), rugosite: 0.05, metal: 0.35, vernis: 1 },
    garniture: { couleur: srgb(0x1f1f22), rugosite: 0.55, metal: 0.1, vernis: 0 },
    creme: { couleur: srgb(LIVREE.creme), rugosite: 0.4, vernis: 1 },
    noir: { couleur: srgb(0x0f0f11), rugosite: 0.7, vernis: 0 },
    metal: { couleur: srgb(0xd5d9df), rugosite: 0.28, metal: 0.8, vernis: 0 },
  }),
  roueFinis: () => ({
    pneu: { couleur: srgb(0x17181b), rugosite: 0.93 },
    flanc: { couleur: srgb(0x202125), rugosite: 0.85 },
    metal: { couleur: srgb(0xd9dde3), rugosite: 0.3, metal: 0.6 },
    fond: { couleur: srgb(0x25272c), rugosite: 0.7, metal: 0.2 },
    moyeu: { couleur: srgb(LIVREE.creme), rugosite: 0.4 },
    disque: { couleur: srgb(0x4d5058), rugosite: 0.45, metal: 0.6 },
    etrier: { couleur: srgb(0xf2b544), rugosite: 0.45 },
  }),
};
