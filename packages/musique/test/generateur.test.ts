import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Les boucles générées par le code (`musique/generateur/`, lot « musique ») : le rendu est déterministe, de la longueur exacte de ses mesures, replié en boucle (la fin retombe sur le
// début), sans valeur invalide ni écrêtage. On rend quatre mesures seulement (le rendu entier de chaque morceau prend quelques secondes : `npm run musique:generer`).
const RACINE = join(__dirname, "../../..");
type Tampon = { n: number; L: Float32Array; R: Float32Array };
const { rendre, versWav, SR } = (await import(/* @vite-ignore */ join(RACINE, "musique/generateur/moteur.mjs"))) as {
  rendre(piece: unknown, o?: { barres?: number }): Tampon;
  versWav(b: Tampon): Uint8Array;
  SR: number;
};
const { MORCEAUX } = (await import(/* @vite-ignore */ join(RACINE, "musique/generateur/morceaux.mjs"))) as {
  MORCEAUX: Record<string, { id: string; bpm: number; barres: number; jeu: string; scenes: string[]; titre: string }>;
};
const { SCENES } = await import("../src/scenes");

describe("les boucles générées", () => {
  it("une boucle pour chaque scène de Track, de Jump et de Tower (le menu et chaque thème), un nombre de mesures multiple de huit", () => {
    const jouees = new Set(Object.values(MORCEAUX).flatMap((m) => m.scenes.map((s) => `${m.jeu}/${s}`)));
    for (const jeu of ["track", "jump", "tower"] as const) for (const scene of SCENES[jeu]) expect(jouees.has(`${jeu}/${scene}`), `${jeu}/${scene}`).toBe(true);
    // Et rien qui ne soit une scène d'un jeu : le test des scènes inconnues est dans `description.test.ts`, ici on garde la liste juste.
    for (const m of Object.values(MORCEAUX)) {
      expect(m.barres % 8, m.id).toBe(0);
      expect(m.titre.length, m.id).toBeGreaterThan(0);
      for (const s of m.scenes) expect(SCENES[m.jeu as "track"], `${m.id} : ${s}`).toContain(s);
    }
    expect(new Set(Object.values(MORCEAUX).map((m) => m.titre)).size).toBe(Object.keys(MORCEAUX).length);
  });

  // Le rendu est coûteux : deux mesures pour chaque boucle (longueur, valeurs valides, crête) ; le déterminisme et la jonction fin → début, sur quatre mesures, pour un morceau de chaque famille
  // (les familles et les trois morceaux écrits à la main partagent le même moteur).
  const REPRESENTANTS = ["track-menu", "track-stade", "jump-menu", "tower-menu"];
  for (const id of Object.keys(MORCEAUX)) {
    it(`${id} : de la longueur de ses mesures, sans valeur invalide, crête à −1 dBFS`, () => {
      const piece = MORCEAUX[id]!;
      const a = rendre(piece, { barres: 2 });
      expect(a.n).toBe(Math.round(((2 * 16 * 60) / piece.bpm / 4) * SR));
      let crete = 0;
      for (let i = 0; i < a.n; i++) {
        expect(Number.isFinite(a.L[i]!) && Number.isFinite(a.R[i]!)).toBe(true);
        crete = Math.max(crete, Math.abs(a.L[i]!), Math.abs(a.R[i]!));
      }
      expect(crete).toBeGreaterThan(0.85);
      expect(crete).toBeLessThanOrEqual(0.9);
    }, 60_000);
  }
  for (const id of REPRESENTANTS) {
    it(`${id} : déterministe, boucle sans claquement`, () => {
      const piece = MORCEAUX[id]!;
      const a = rendre(piece, { barres: 4 });
      expect(Buffer.from(a.L.buffer).equals(Buffer.from(rendre(piece, { barres: 4 }).L.buffer))).toBe(true);
      // La jonction fin → début n'est pas un saut : l'écart entre le dernier et le premier échantillon est celui de deux échantillons voisins.
      let voisin = 0;
      for (let i = 1; i < 2000; i++) voisin = Math.max(voisin, Math.abs(a.L[i]! - a.L[i - 1]!));
      expect(Math.abs(a.L[a.n - 1]! - a.L[0]!)).toBeLessThanOrEqual(Math.max(voisin, 0.01) * 3);
    }, 60_000);
  }

  it("le fichier WAV : en-tête valide, stéréo 16 bits 44 100 Hz, la taille de ses échantillons", () => {
    const buf = rendre(MORCEAUX["jump-foret"]!, { barres: 2 });
    const wav = versWav(buf);
    const txt = (o: number, n: number) => new TextDecoder().decode(wav.slice(o, o + n));
    expect([txt(0, 4), txt(8, 4), txt(12, 4), txt(36, 4)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    const v = new DataView(wav.buffer);
    expect([v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true)]).toEqual([2, 44_100, 16]);
    expect(wav.length).toBe(44 + buf.n * 4);
  });

  it("musiques.json couvre chaque scène (menu et thèmes) : un morceau généré ou, une fois remplacé à la main, un morceau acheté", async () => {
    const { readFileSync } = await import("node:fs");
    const d = JSON.parse(readFileSync(join(RACINE, "musique/musiques.json"), "utf8")) as { pistes: { id: string; jeux: string[]; scenes?: string[]; licence: string }[] };
    for (const jeu of ["track", "jump", "tower"] as const)
      for (const scene of SCENES[jeu]) expect(d.pistes.some((p) => p.jeux.includes(jeu) && p.scenes?.includes(scene)), `${jeu}/${scene}`).toBe(true);
    // Chaque entrée générée porte les mêmes jeux et scènes que sa fiche (tant qu'elle n'a pas été remplacée : sa source dit alors autre chose).
    for (const p of d.pistes.filter((x) => MORCEAUX[x.id] && x.licence === "mienne")) expect([p.jeux, p.scenes], p.id).toEqual([[MORCEAUX[p.id]!.jeu], MORCEAUX[p.id]!.scenes]);
  });
});
