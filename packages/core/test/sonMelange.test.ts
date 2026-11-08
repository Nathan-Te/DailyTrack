import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lot S2 : **le son d'un jeu se mêle à celui du téléphone, il ne le coupe pas.** Ce test échoue si le code d'une application ou d'un paquet rejoue du son par un élément média
// (`new Audio(`, `createMediaElementSource` : un élément qui joue prend la main sur l'audio du téléphone, Android compris), s'il pose la session audio `"playback"` (iPhone : elle
// interrompt les autres sons), s'il déclare une Media Session (le jeu n'est pas un lecteur de médias), ou s'il crée un contexte audio ailleurs que par la fonction commune
// `ouvrirContexteAudio` (`packages/core/src/audio.ts`), qui pose la session `ambient`.

const RACINE = new URL("../../..", import.meta.url).pathname;
const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === "dist") continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (EXTENSIONS.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/** Les `src` de chaque application et de chaque paquet. */
function sources(): string[] {
  const out: string[] = [];
  for (const groupe of ["apps", "packages"]) {
    for (const nom of readdirSync(join(RACINE, groupe))) {
      const src = join(RACINE, groupe, nom, "src");
      try {
        if (statSync(src).isDirectory()) out.push(...fichiers(src));
      } catch {
        /* pas de src */
      }
    }
  }
  return out;
}

/** Le code sans ses commentaires (les consignes écrites en commentaire peuvent nommer ce qui est interdit). */
function code(chemin: string): string {
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .map((l) => l.replace(/\s\/\/\s.*$/, ""))
    .join("\n");
}

const FONCTION_COMMUNE = "packages/core/src/audio.ts";
const rel = (chemin: string) => chemin.slice(RACINE.length);

const INTERDITS: { motif: RegExp; pourquoi: string; sauf?: string }[] = [
  { motif: /new\s+Audio\s*\(/, pourquoi: "un élément audio qui joue coupe la vidéo ou la musique du joueur : jouer par Web Audio (decodeAudioData + AudioBufferSourceNode)" },
  { motif: /createMediaElementSource/, pourquoi: "brancher un élément média sur Web Audio garde la main sur l'audio du téléphone : jouer par Web Audio" },
  { motif: /["'`]playback["'`]/, pourquoi: "la session `playback` interrompt les autres sons sur iPhone : `ouvrirContexteAudio` pose `ambient`" },
  { motif: /createElement\(\s*["'`](audio|video)["'`]/, pourquoi: "un élément média qui joue coupe les autres sons du téléphone" },
  { motif: /mediaSession|MediaMetadata/, pourquoi: "le jeu ne déclare ni titre ni contrôles de lecture (pas de Media Session)" },
  { motif: /\.audioSession\b/, pourquoi: "la session audio se pose en un seul endroit : `ouvrirContexteAudio`", sauf: FONCTION_COMMUNE },
  { motif: /new\s+(?:Ctor|AudioContext|webkitAudioContext)\s*\(|window\.AudioContext|\.webkitAudioContext/, pourquoi: "un contexte audio s'ouvre par `ouvrirContexteAudio` (session `ambient`)", sauf: FONCTION_COMMUNE },
];

describe("le son des jeux se mêle à celui du téléphone (lot S2)", () => {
  const liste = sources();

  it("il y a des sources à vérifier (le test lit bien les apps et les paquets)", () => {
    expect(liste.length).toBeGreaterThan(200);
    expect(liste.map(rel)).toContain(FONCTION_COMMUNE);
    expect(liste.map(rel)).toContain("packages/musique/src/lecteur.ts");
  });

  for (const { motif, pourquoi, sauf } of INTERDITS) {
    it(`${motif} n'apparaît dans aucun src${sauf ? ` (sauf ${sauf})` : ""}`, () => {
      const fautifs = liste.filter((f) => rel(f) !== sauf && motif.test(code(f))).map(rel);
      expect(fautifs, pourquoi).toEqual([]);
    });
  }

  it("le contrôle attrape bien ce qu'il prétend attraper", () => {
    for (const exemple of ["const a = new Audio();", "const a = new Audio('x.mp3')", "ctx.createMediaElementSource(el)", 's.type = "playback";', "navigator.mediaSession.metadata = null", 'document.createElement("audio")']) {
      expect(INTERDITS.some((i) => !i.sauf && i.motif.test(exemple)), exemple).toBe(true);
    }
    for (const exemple of ["new AudioBufferSourceNode(ctx)", 'session.type = "ambient"', "ctx.decodeAudioData(octets)"]) {
      expect(INTERDITS.some((i) => i.motif.test(exemple)), exemple).toBe(false);
    }
  });

  it("la fonction commune pose bien `ambient`", () => {
    expect(readFileSync(join(RACINE, FONCTION_COMMUNE), "utf8")).toMatch(/SESSION_AUDIO = "ambient"/);
  });
});
