// Le morceau d'essai (lot « musique ») : quelques secondes d'une petite suite de notes **générées par ce code** (aucun enregistrement, aucun droit à vérifier : CC0). Il sert aux tests et à
// `npm run musique -- --essai`, qui l'ajoute à `musique/musiques.json` (pour Track) afin de voir tout le chemin — préparation, liste, lecteur, réglages — sans avoir de morceau à soi.

export const ESSAI = { id: "essai", titre: "Essai", artiste: "Du Jour (généré par le code)", fichier: "essai.wav", jeux: ["track"], licence: "CC0", source: "généré par le code pour les essais" } as const;

/** Un fichier WAV (mono, 16 bits, 22 050 Hz) de `secondes` secondes : quatre notes en arpège, chacune avec une attaque et une décroissance. Déterministe. */
export function wavEssai(secondes = 6): Uint8Array {
  const taux = 22_050;
  const n = Math.round(taux * secondes);
  const octets = new Uint8Array(44 + n * 2);
  const v = new DataView(octets.buffer);
  const texte = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  texte(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  texte(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taux, true);
  v.setUint32(28, taux * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texte(36, "data");
  v.setUint32(40, n * 2, true);
  const notes = [261.6, 329.6, 392, 523.3];
  for (let i = 0; i < n; i++) {
    const t = i / taux;
    const pas = t * 2;
    const phase = pas % 1;
    const enveloppe = Math.min(1, phase * 20) * (1 - phase * 0.6);
    v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * notes[Math.floor(pas) % 4]! * t) * enveloppe * 9000), true);
  }
  return octets;
}
