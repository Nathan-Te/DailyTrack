import { VERTIGE_GENERATOR_VERSION } from "./constantes";
import type { NomNiveau } from "./niveaux";

// Le contenu du jour. Au prototype, tous les jours jouent le MÊME parcours (celui de la maquette, sans le portail) : le niveau du jour assemblé de modules est le lot V2. **Pure** : rien ne vient d'une horloge.

export interface Contenu {
  jour: number;
  g: number;
  niveau: NomNiveau;
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Le contenu d'un jour. Les anciennes versions du générateur restent appelables tant qu'un jour figé les nomme (ici : une seule). */
export function dailyVertige(jour: number, version: number = VERTIGE_GENERATOR_VERSION): Contenu {
  if (version !== 1) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  return { jour, g: version, niveau: "parcours" };
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers et le nom du niveau) : un texte de huit hexadécimaux. */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  for (const n of [contenu.jour, contenu.g]) {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  }
  for (let i = 0; i < contenu.niveau.length; i++) octet(contenu.niveau.charCodeAt(i));
  return h.toString(16).padStart(8, "0");
}
