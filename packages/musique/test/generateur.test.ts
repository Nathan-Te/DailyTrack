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
  MORCEAUX: Record<string, { id: string; bpm: number; barres: number; jeu: string; scenes: string[]; titre: string; tonique?: number; gamme?: string }>;
};
const { SCENES } = await import("../src/scenes");

describe("les boucles générées", () => {
  it("une boucle pour chaque scène de Track, de Jump, de Tower et de Blocks (le menu et chaque thème), un nombre de mesures multiple de huit", () => {
    const jouees = new Set(Object.values(MORCEAUX).flatMap((m) => m.scenes.map((s) => `${m.jeu}/${s}`)));
    for (const jeu of ["track", "jump", "tower", "blocks"] as const) for (const scene of SCENES[jeu]) expect(jouees.has(`${jeu}/${scene}`), `${jeu}/${scene}`).toBe(true);
    // Et rien qui ne soit une scène d'un jeu : le test des scènes inconnues est dans `description.test.ts`, ici on garde la liste juste.
    for (const m of Object.values(MORCEAUX)) {
      expect(m.barres % 8, m.id).toBe(0);
      expect(m.titre.length, m.id).toBeGreaterThan(0);
      for (const s of m.scenes) expect(SCENES[m.jeu as "track"], `${m.id} : ${s}`).toContain(s);
    }
    expect(new Set(Object.values(MORCEAUX).map((m) => m.titre)).size).toBe(Object.keys(MORCEAUX).length);
  });

  // Le rendu est coûteux : une mesure pour chaque boucle (longueur, valeurs valides, crête), un second rendu pour prouver le déterminisme d'un morceau de chaque famille, et la jonction fin → début sur quatre mesures pour ces mêmes morceaux
  // (les familles et les trois morceaux écrits à la main partagent le même moteur).
  const REPRESENTANTS = ["track-menu", "track-stade", "jump-menu", "tower-menu"];
  for (const id of Object.keys(MORCEAUX)) {
    it(`${id} : de la longueur de ses mesures, sans valeur invalide, crête à −1 dBFS (et déterministe pour un morceau de chaque famille)`, () => {
      const piece = MORCEAUX[id]!;
      const a = rendre(piece, { barres: 1 });
      expect(a.n).toBe(Math.round(((1 * 16 * 60) / piece.bpm / 4) * SR));
      if (REPRESENTANTS.includes(id)) expect(Buffer.from(a.L.buffer).equals(Buffer.from(rendre(piece, { barres: 1 }).L.buffer))).toBe(true);
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
    it(`${id} : boucle sans claquement`, () => {
      const a = rendre(MORCEAUX[id]!, { barres: 4 });
      // La jonction fin → début n'est pas un saut : l'écart entre le dernier et le premier échantillon est celui de deux échantillons voisins.
      let voisin = 0;
      for (let i = 1; i < 2000; i++) voisin = Math.max(voisin, Math.abs(a.L[i]! - a.L[i - 1]!));
      expect(Math.abs(a.L[a.n - 1]! - a.L[0]!)).toBeLessThanOrEqual(Math.max(voisin, 0.01) * 3);
    }, 60_000);
  }

  it("le fichier WAV : en-tête valide, stéréo 16 bits 44 100 Hz, la taille de ses échantillons", () => {
    const buf = rendre(MORCEAUX["jump-foret"]!, { barres: 1 });
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
    for (const jeu of ["track", "jump", "tower", "blocks"] as const)
      for (const scene of SCENES[jeu]) expect(d.pistes.some((p) => p.jeux.includes(jeu) && p.scenes?.includes(scene)), `${jeu}/${scene}`).toBe(true);
    // Chaque entrée générée porte les mêmes jeux et scènes que sa fiche (tant qu'elle n'a pas été remplacée : sa source dit alors autre chose).
    for (const p of d.pistes.filter((x) => MORCEAUX[x.id] && x.licence === "mienne")) expect([p.jeux, p.scenes], p.id).toEqual([[MORCEAUX[p.id]!.jeu], MORCEAUX[p.id]!.scenes]);
  });

  // Lot B6 : `barres` est un paramètre de la fiche `calme` (24 par défaut). Blocks joue 40 mesures : au moins 90 s avant de se répéter à l'identique, à chaque tempo.
  it("les boucles de Blocks durent au moins 90 s ; celles de Tower gardent leurs 24 mesures", () => {
    for (const m of Object.values(MORCEAUX).filter((x) => x.jeu === "blocks")) expect((m.barres * 240) / m.bpm, m.id).toBeGreaterThanOrEqual(90);
    for (const m of Object.values(MORCEAUX).filter((x) => x.jeu === "tower")) expect(m.barres, m.id).toBe(24);
  });

  it("musiques.json dit la tonalité de chaque boucle de Blocks comme sa fiche (tempo, tonique, gamme) : tout sur Do, ou La mineur pour la nuit", async () => {
    const { readFileSync } = await import("node:fs");
    const d = JSON.parse(readFileSync(join(RACINE, "musique/musiques.json"), "utf8")) as { pistes: { id: string; jeux: string[]; bpm?: number; tonique?: number; gamme?: string }[] };
    const blocks = d.pistes.filter((p) => p.jeux.includes("blocks"));
    expect(blocks.length).toBe(SCENES.blocks.length);
    for (const p of blocks) {
      const f = MORCEAUX[p.id]!;
      expect([p.bpm, p.tonique, p.gamme], p.id).toEqual([f.bpm, f.tonique, f.gamme]);
      expect(f.tonique! % 12 === 0 || (f.tonique === 57 && f.gamme === "min"), `${p.id} : sur Do (ou La mineur)`).toBe(true);
    }
  });

  // **Les empreintes** (lot B6) : le rendu entier d'une boucle de Tower ou de Blocks est celui dont `musique/servi/liste.json` a gardé l'empreinte (SHA-256 du WAV). Si le générateur change un octet d'une boucle de Tower, ce test
  // échoue : un changement du modèle `calme` (comme le paramètre `barres`) ne doit pas toucher les boucles déjà livrées. Pour un changement voulu : `npm run musique:generer`, `npm run musique`, et on le dit au lot.
  for (const id of Object.keys(MORCEAUX).filter((i) => i.startsWith("tower-") || i.startsWith("blocks-"))) {
    it(`${id} : le rendu entier a l'empreinte de la liste servie`, async () => {
      const { createHash } = await import("node:crypto");
      const { readFileSync } = await import("node:fs");
      const liste = JSON.parse(readFileSync(join(RACINE, "musique/servi/liste.json"), "utf8")) as { pistes: { id: string; sha: string }[] };
      const sha = createHash("sha256").update(versWav(rendre(MORCEAUX[id]!))).digest("hex");
      expect(sha).toBe(liste.pistes.find((p) => p.id === id)!.sha);
    }, 120_000);
  }
});
