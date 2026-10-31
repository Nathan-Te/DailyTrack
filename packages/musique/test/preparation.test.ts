import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifierDescription } from "../src/description";
import { lireListe } from "../src/liste";
import { CLE_REGLAGES, CLE_REPRISE } from "../src/logique";
import { PREPARATION, argsEncodage, argsMesure, blocCredits, construireListe, ecartsAvecLaListe, empreinte, injecterCredits, lireMesure, nomServi, texteListe, LUFS_VISE } from "../outils/preparation";
import { CLES_GARDEES } from "@cdj/profile";

const ROOT = join(__dirname, "../../..");
// `scripts/site.mjs` n'a pas de déclaration de types : chargé par chemin (comme `packages/ui/test/applications.ts` charge ses modules).
const { copierMusique } = (await import(/* @vite-ignore */ join(ROOT, "scripts/site.mjs"))) as { copierMusique(out: string, source?: string): number };
const MESURE = `[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-23.50",\n\t"input_tp" : "-4.10",\n\t"input_lra" : "6.20",\n\t"input_thresh" : "-34.00",\n\t"output_i" : "-18.10",\n\t"target_offset" : "0.10"\n}\n`;

describe("la préparation des morceaux (npm run musique)", () => {
  it("le nom du fichier préparé change avec la source et avec la préparation, jamais autrement", () => {
    const a = empreinte(new TextEncoder().encode("a"));
    const b = empreinte(new TextEncoder().encode("b"));
    expect(nomServi("mon-id", a)).toMatch(/^mon-id-[0-9a-f]{8}\.m4a$/);
    expect(nomServi("mon-id", a)).toBe(nomServi("mon-id", a));
    expect(nomServi("mon-id", a)).not.toBe(nomServi("mon-id", b));
    expect(PREPARATION).toContain("aac");
  });

  it("ffmpeg : mesure du volume puis AAC stéréo 96 k lisible partout (conteneur MP4, début du fichier prêt pour le flux), volume ramené à la cible", () => {
    expect(argsMesure("in.wav").join(" ")).toContain(`loudnorm=I=${LUFS_VISE}`);
    const m = lireMesure(MESURE)!;
    expect(m.input_i).toBe("-23.50");
    const args = argsEncodage("in.wav", "out.m4a", m);
    const ligne = args.join(" ");
    expect(ligne).toContain("-c:a aac");
    expect(ligne).toContain("-b:a 96k");
    expect(ligne).toContain("-movflags +faststart");
    expect(ligne).toContain("-map_metadata -1");
    expect(ligne).toContain("measured_I=-23.50");
    expect(ligne).toContain("linear=true");
    expect(args.at(-1)).toBe("out.m4a");
  });

  it("la mesure de ffmpeg : lue en fin de sortie ; absente ou incomplète → null", () => {
    expect(lireMesure("rien")).toBeNull();
    expect(lireMesure('{ "input_i": "x" }')).toBeNull();
    expect(lireMesure(`${MESURE}\nsuite`)).not.toBeNull();
  });

  const desc = verifierDescription({ pistes: [{ id: "un", titre: "Un", artiste: "A", fichier: "un.mp3", jeux: ["tous"], licence: "mienne", poids: 2, volumeDb: -1.5 }, { id: "deux", titre: "Deux", artiste: "B", fichier: "deux.mp3", jeux: ["portail"], licence: "CC-BY-4.0", credit: "Deux par B (CC BY 4.0)", source: "https://exemple.org" }] }, { fichierExiste: () => true });
  it("la liste servie : jeux résolus, crédit toujours écrit, poids et correction repris, relisible par le jeu", () => {
    const infos = new Map([["un", { fichier: "un-11111111.m4a", duree: 100.04 }], ["deux", { fichier: "deux-22222222.m4a", duree: 50 }]]);
    const l = construireListe({ pistes: desc.pistes }, infos);
    expect(l.pistes[0]).toMatchObject({ jeux: ["track", "jump", "tower"], credit: "« Un » — A", poids: 2, volumeDb: -1.5, duree: 100 });
    expect(l.pistes[1]).toMatchObject({ jeux: ["portail"], credit: "Deux par B (CC BY 4.0)" });
    expect(lireListe(JSON.parse(texteListe(l)))).toEqual(l);
    expect(() => construireListe({ pistes: desc.pistes }, new Map())).toThrow();
  });

  it("à jour ou pas : la source changée, un fichier préparé qui manque, un morceau retiré sont dits", () => {
    const infos = new Map([["un", { fichier: nomServi("un", "E1"), duree: 1 }], ["deux", { fichier: nomServi("deux", "E2"), duree: 1 }]]);
    const l = construireListe({ pistes: desc.pistes }, infos);
    const e = (f: string) => (f === "un.mp3" ? "E1" : "E2");
    const tous = new Set<string>([...infos.values()].map((i) => i.fichier));
    expect(ecartsAvecLaListe({ pistes: desc.pistes }, l, e, tous)).toEqual([]);
    expect(ecartsAvecLaListe({ pistes: desc.pistes }, l, () => "autre", tous).filter((x) => x.includes("a changé")).length).toBe(2);
    expect(ecartsAvecLaListe({ pistes: desc.pistes }, l, e, new Set()).filter((x) => x.includes("manque")).length).toBe(2);
    expect(ecartsAvecLaListe({ pistes: desc.pistes.slice(0, 1) }, l, e, tous).join()).toContain("plus dans musiques.json");
    expect(ecartsAvecLaListe({ pistes: desc.pistes }, null, e, tous).length).toBeGreaterThan(0);
  });
});

describe("les crédits des mentions légales", () => {
  const l = construireListe({ pistes: verifierDescription({ pistes: [{ id: "un", titre: "Un <b>", artiste: "A & B", fichier: "un.mp3", jeux: ["track"], licence: "mienne" }] }, { fichierExiste: () => true }).pistes }, new Map([["un", { fichier: "un-1.m4a", duree: 1 }]]));

  it("le même nombre d'éléments de liste dans les deux langues, le texte du crédit échappé (jamais du HTML), et une phrase sans morceau", () => {
    const fr = blocCredits(l, "fr");
    expect(fr.match(/<li\b/g)?.length).toBe(1);
    expect(blocCredits(l, "en").match(/<li\b/g)?.length).toBe(1);
    expect(fr).toContain("&lt;b&gt;");
    expect(fr).toContain("A &amp; B");
    expect(blocCredits({ version: 1, debit: "", pistes: [] }, "fr")).toContain("Aucun morceau");
    expect(blocCredits({ version: 1, debit: "", pistes: [] }, "en")).toContain("No track");
  });

  it("injecter remplace seulement ce qui est entre les marques, et refuse une page sans marques", () => {
    const page = "avant\n<!-- musique:debut -->\nvieux\n<!-- musique:fin -->\naprès";
    const nouveau = injecterCredits(page, blocCredits(l, "fr"));
    expect(nouveau.startsWith("avant\n")).toBe(true);
    expect(nouveau.endsWith("\naprès")).toBe(true);
    expect(nouveau).not.toContain("vieux");
    expect(injecterCredits(nouveau, blocCredits(l, "fr"))).toBe(nouveau);
    expect(() => injecterCredits("rien", "x")).toThrow("marques");
  });

  const pageFr = readFileSync(join(ROOT, "apps/portail/mentions-legales/index.html"), "utf8");
  const pageEn = readFileSync(join(ROOT, "apps/portail/legal/index.html"), "utf8");
  const liste = lireListe(JSON.parse(readFileSync(join(ROOT, "musique/servi/liste.json"), "utf8")))!;

  it("parité : les crédits publiés sont, dans les deux pages de mentions, exactement ceux de la liste servie (`npm run musique` les écrit)", () => {
    expect(pageFr).toContain(blocCredits(liste, "fr"));
    expect(pageEn).toContain(blocCredits(liste, "en"));
    for (const p of liste.pistes) {
      expect(pageFr, p.id).toContain(`data-piste="${p.id}"`);
      expect(pageEn, p.id).toContain(`data-piste="${p.id}"`);
    }
    expect(pageEn.match(/data-piste="/g)?.length).toBe(pageFr.match(/data-piste="/g)?.length);
  });

  it("les deux pages nomment la rubrique de la musique (même identifiant) et les clés gardées dans le navigateur", () => {
    for (const page of [pageFr, pageEn]) {
      expect(page).toContain('<h3 id="musique">');
      expect(page).toContain(`<code>${CLE_REGLAGES}</code>`);
      expect(page).toContain(`<code>${CLE_REPRISE}</code>`);
    }
  });

  it("le volume et le choix de couper sont un réglage gardé au « Nouveau départ » ; la reprise n'est jamais dans le stockage de l'appareil", () => {
    expect(CLES_GARDEES).toContain(CLE_REGLAGES);
    expect(CLES_GARDEES).not.toContain(CLE_REPRISE);
    const nav = readFileSync(join(ROOT, "packages/musique/src/navigateur.ts"), "utf8");
    expect(nav).toContain("sessionStorage");
  });
});

describe("l'état du dépôt : ce que la CI vérifie (équivalent de `npm run musique -- --verifier`)", () => {
  const description = JSON.parse(readFileSync(join(ROOT, "musique/musiques.json"), "utf8"));
  const v = verifierDescription(description, { fichierExiste: (f) => existsSync(join(ROOT, "musique/pistes", f)) });
  const liste = lireListe(JSON.parse(readFileSync(join(ROOT, "musique/servi/liste.json"), "utf8")))!;

  it("musiques.json est valide (licence, jeux, fichiers) et la liste servie est à jour", () => {
    expect(v.erreurs).toEqual([]);
    const servis = new Set(readdirSync(join(ROOT, "musique/servi")).filter((f) => f.endsWith(".m4a")));
    const e = (f: string) => empreinte(readFileSync(join(ROOT, "musique/pistes", f)));
    expect(ecartsAvecLaListe({ pistes: v.pistes }, liste, e, servis), "lance `npm run musique` puis ajoute le résultat au commit").toEqual([]);
  });

  it("le site assemblé reçoit les morceaux préparés (jamais les sources) et vérifie que chaque fichier de la liste y est", () => {
    const out = mkdtempSync(join(tmpdir(), "musique-site-"));
    expect(copierMusique(out)).toBe(liste.pistes.length);
    expect(existsSync(join(out, "musique/liste.json"))).toBe(true);
    expect(existsSync(join(out, "musique/pistes"))).toBe(false);
    // Un fichier manquant dans le dossier préparé fait échouer l'assemblage.
    const faux = mkdtempSync(join(tmpdir(), "musique-faux-"));
    mkdirSync(faux, { recursive: true });
    writeFileSync(join(faux, "liste.json"), JSON.stringify({ version: 1, debit: "96k", pistes: [{ id: "x", fichier: "x-1.m4a" }] }));
    expect(() => copierMusique(mkdtempSync(join(tmpdir(), "musique-site-")), faux)).toThrow("x-1.m4a");
  });

  it("firebase.json : les fichiers préparés ont un cache sans fin (leur nom porte l'empreinte)", () => {
    const hs = (JSON.parse(readFileSync(join(ROOT, "firebase.json"), "utf8")) as { hosting: { headers: { source?: string; headers: { key: string; value: string }[] }[] } }).hosting.headers;
    const m = hs.find((h) => h.source === "/musique/*.m4a");
    expect(m?.headers[0]).toEqual({ key: "Cache-Control", value: "public, max-age=31536000, immutable" });
  });
});

describe("le morceau d'essai, généré par le code", () => {
  it("un WAV valide, très court, déterministe, que la vérification accepte (CC0, avec sa source)", async () => {
    const { ESSAI, wavEssai } = await import("../outils/essai");
    const a = wavEssai(2);
    expect(new TextDecoder().decode(a.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(a.slice(8, 12))).toBe("WAVE");
    expect(a.length).toBe(44 + 22_050 * 2 * 2);
    expect(wavEssai(2)).toEqual(a);
    expect(a.some((o) => o !== 0)).toBe(true);
    expect(verifierDescription({ pistes: [ESSAI] }, { fichierExiste: () => true }).erreurs).toEqual([]);
  });
});
