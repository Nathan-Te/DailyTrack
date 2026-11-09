import { readFileSync } from "node:fs";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { enregistrerModele, lireGlb, NOMS_MODELES, type Modele, type NomModele } from "../src/modeles";

// Les tests lisent les modèles PUBLIÉS (`apps/rush/public/modeles/*.glb`, ceux que le jeu charge) depuis le disque, avec le même lecteur et le même décodeur meshopt que le jeu.
export const DOSSIER_MODELES = new URL("../public/modeles/", import.meta.url);

export async function lireDuDisque(nom: NomModele): Promise<Modele> {
  await MeshoptDecoder.ready;
  const b = readFileSync(new URL(`${nom}.glb`, DOSSIER_MODELES));
  return lireGlb(nom, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
}

/** Lit et enregistre tous les modèles (les acteurs créés ensuite les prennent). */
export async function chargerTousDuDisque(): Promise<Map<NomModele, Modele>> {
  const tous = new Map<NomModele, Modele>();
  for (const n of NOMS_MODELES) {
    const m = await lireDuDisque(n);
    enregistrerModele(m);
    tous.set(n, m);
  }
  return tous;
}
