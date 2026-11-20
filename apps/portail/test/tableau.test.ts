import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { A_COMPLETER, FICHIER_DATES, FICHIER_TABLEAU, TITRES_PASSATION, calculer, cheminPassation, dossierDesLots, ecarts, lirePassation, lireJeux, lotsDe } from "../../../scripts/tableau.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { construirePassation, planifier, sectionsFinales, sectionsParDefaut } from "../../../scripts/nouveau-jeu.mjs";

// Lot O1 (plateforme, organisation) — `npm run tableau` écrit docs/tableau.md : une ligne par jeu des fiches et une ligne « Plateforme », lues dans les fiches, les README de lots
// et les trois sections finales de chaque passation. Ce test garde : la forme commune des passations, la fraîcheur du tableau (sans git : les dates sont dans docs/tableau-dates.json),
// l'avertissement « lots depuis », et le générateur `nouveau-jeu` (il écrit les trois sections et `--passation` les conserve).
const RACINE = join(import.meta.dirname, "../../..");
const ZONES: string[] = ["plateforme", ...(lireJeux(RACINE) as { id: string; temoin: boolean }[]).map((j) => j.id)];
const AVEC_PASSATION: string[] = ["plateforme", ...(lireJeux(RACINE) as { id: string; temoin: boolean }[]).filter((j) => !j.temoin).map((j) => j.id)];

const passation = (ou: string[], prochain: string, decisions: string[] | "aucune") =>
  `# Passation\n\n## 1. Autre\n- x\n\n## ${TITRES_PASSATION[0]}\n${ou.map((l) => `- ${l}`).join("\n")}\n\n## ${TITRES_PASSATION[1]}\n${prochain}\n\n## ${TITRES_PASSATION[2]}\n${decisions === "aucune" ? "aucune" : decisions.map((l) => `- ${l}`).join("\n")}\n`;

describe("la forme commune des passations", () => {
  it("chaque zone à conversation (la plateforme et chaque jeu qui n'est pas un témoin) a sa passation, et elle se termine par les trois sections", () => {
    for (const id of AVEC_PASSATION) {
      const chemin = cheminPassation(id);
      expect(existsSync(join(RACINE, chemin)), `${chemin} existe`).toBe(true);
      expect(lirePassation(readFileSync(join(RACINE, chemin), "utf8")).problemes, chemin).toEqual([]);
    }
  });
  it("lit les trois sections ; « aucune » est une réponse permise aux décisions", () => {
    const p = lirePassation(passation(["a", "b"], "Le lot X.", "aucune"));
    expect(p).toMatchObject({ ouOnEnEst: ["a", "b"], prochainLot: "Le lot X.", decisions: "aucune", problemes: [] });
    expect(lirePassation(passation(["a"], "X", ["Nathan : choisir"])).decisions).toEqual(["Nathan : choisir"]);
  });
  it("refuse : plus de 5 lignes, un prochain lot sur plusieurs lignes, des décisions sans puces, des titres changés ou pas en dernier", () => {
    expect(lirePassation(passation(["1", "2", "3", "4", "5", "6"], "X", "aucune")).problemes.join()).toContain("6 lignes");
    expect(lirePassation(passation(["1"], "X\nY", "aucune")).problemes.join()).toContain("une seule");
    expect(lirePassation(passation(["1"], "X", "aucune").replace("aucune", "du texte libre")).problemes.join()).toContain("puces");
    expect(lirePassation(passation(["1"], "X", "aucune").replace("Prochain lot", "Suite")).problemes.join()).toContain("doit se terminer par les sections");
    expect(lirePassation(`${passation(["1"], "X", "aucune")}\n## Annexe\ntexte\n`).problemes.join()).toContain("doit se terminer par les sections");
    expect(lirePassation("# Rien\n").problemes).toHaveLength(1);
  });
  it("l'empreinte ne change que si l'une des trois sections change", () => {
    const base = lirePassation(passation(["a"], "X", "aucune")).empreinte;
    expect(lirePassation(passation(["a"], "X", "aucune").replace("## 1. Autre\n- x", "## 1. Autre\n- y")).empreinte).toBe(base);
    expect(lirePassation(passation(["b"], "X", "aucune")).empreinte).not.toBe(base);
  });
});

describe("docs/tableau.md", () => {
  it("est à jour (sinon : npm run tableau, après la mise à jour de la passation de ta zone)", () => {
    expect(ecarts(RACINE), `${FICHIER_TABLEAU} et ${FICHIER_DATES}`).toEqual([]);
  });
  it("a une ligne par jeu des fiches et une ligne « Plateforme » ; il renvoie à /admin/ pour l'état de la production", () => {
    const texte = readFileSync(join(RACINE, FICHIER_TABLEAU), "utf8");
    for (const j of lireJeux(RACINE) as { nom: string }[]) expect(texte, j.nom).toMatch(new RegExp(`^\\| \\*\\*${j.nom}\\*\\* \\|`, "m"));
    expect(texte).toMatch(/^\| \*\*Plateforme\*\* \|/m);
    expect(texte).toContain("`/admin/` › Jeux");
  });
  it("chaque zone a un dernier lot, lu dans son dossier de lots (Track : docs/lots)", () => {
    expect(dossierDesLots("track")).toBe("docs/lots");
    expect(dossierDesLots("blocks")).toBe("docs/blocks/lots");
    for (const id of ZONES.filter((z) => z !== "cibles")) expect((lotsDe(id, RACINE) as string[]).length, id).toBeGreaterThan(0);
  });
});

describe("le calcul, sur un petit dépôt", () => {
  const fabriquer = () => {
    const r = mkdtempSync(join(tmpdir(), "tableau-"));
    const ecrire = (f: string, t: string) => {
      mkdirSync(join(r, f, ".."), { recursive: true });
      writeFileSync(join(r, f), t);
    };
    ecrire("config/jeux/zeta.json", JSON.stringify({ id: "zeta", ordre: 1, nom: { fr: "Zeta", en: "Zeta" }, categorie: "arcade", etatDepart: "off", premierJour: "2026-11-02", identite: { police: "A", motif: "uni", illustration: "à choisir" } }));
    ecrire("docs/zeta/lots/lot-Z1-un.md", "# Lot Z1 — le premier\n");
    ecrire("docs/zeta/lots/lot-Z2-deux.md", "# Lot Z2 — le second\n");
    ecrire("docs/zeta/lots/image.png", "x");
    ecrire("docs/plateforme/lots/lot-P1.md", "# Lot P1 — plateforme\n");
    ecrire("docs/zeta/passation.md", passation(["un état"], "Z3", ["Nathan : choisir"]));
    ecrire("docs/plateforme/passation.md", passation(["un état"], "P2", "aucune"));
    return { r, ecrire };
  };
  it("dit ce qui manque à l'identité, ne prend que les README lot-*.md, date ce qui est nouveau et ne bouge plus ensuite", () => {
    const { r } = fabriquer();
    try {
      const a = calculer(r, "2026-11-20");
      const zeta = a.lignes.find((l: { zone: { id: string } }) => l.zone.id === "zeta");
      expect(zeta.zone.identiteManque).toEqual(["illustration"]);
      expect(zeta.lots).toEqual(["docs/zeta/lots/lot-Z1-un.md", "docs/zeta/lots/lot-Z2-deux.md"]);
      expect(zeta.dernier).toBe("docs/zeta/lots/lot-Z2-deux.md");
      expect(a.texte).toContain("⚠ identité");
      expect(a.dates.lots["docs/zeta/lots/lot-Z1-un.md"]).toBe("2026-11-20");
      // Un second calcul, un autre jour, avec les dates écrites : rien ne bouge.
      writeFileSync(join(r, FICHIER_DATES), JSON.stringify(a.dates));
      const b = calculer(r, "2026-12-01");
      expect(b.dates).toEqual(a.dates);
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });
  it("avertit quand des lots sont plus récents que la passation ; l'avertissement part quand la passation change", () => {
    const { r, ecrire } = fabriquer();
    try {
      const a = calculer(r, "2026-11-20");
      writeFileSync(join(r, FICHIER_DATES), JSON.stringify(a.dates));
      expect(a.lignes.every((l: { depuis: string[] }) => l.depuis.length === 0)).toBe(true);
      ecrire("docs/zeta/lots/lot-Z3-trois.md", "# Lot Z3 — le troisième\n");
      const b = calculer(r, "2026-11-25");
      const zeta = b.lignes.find((l: { zone: { id: string } }) => l.zone.id === "zeta");
      expect(zeta.depuis).toEqual(["docs/zeta/lots/lot-Z3-trois.md"]);
      expect(b.texte).toContain("⚠ 1 lot depuis");
      writeFileSync(join(r, FICHIER_DATES), JSON.stringify(b.dates));
      // La conversation met la passation à jour : même jour que le lot, plus d'avertissement.
      ecrire("docs/zeta/passation.md", passation(["un nouvel état"], "Z4", "aucune"));
      const c = calculer(r, "2026-11-25");
      expect(c.lignes.find((l: { zone: { id: string } }) => l.zone.id === "zeta").depuis).toEqual([]);
      expect(c.dates.passations["docs/zeta/passation.md"].jour).toBe("2026-11-25");
    } finally {
      rmSync(r, { recursive: true, force: true });
    }
  });
});

describe("le générateur `nouveau-jeu` et les trois sections", () => {
  it("une passation neuve les écrit (titres fixes, en dernier) : un squelette dit ce que le dépôt sait, jamais plus", () => {
    const squelette: string = sectionsParDefaut("banctest", { squelette: true, seedVide: true });
    const p = lirePassation(`# T\n\n${squelette}\n`);
    expect(p.problemes).toEqual([]);
    expect(p.decisions).toContain("Nathan : écrire le seed (`docs/banctest/seed.md`).");
    const apres: string = sectionsParDefaut("banctest", { squelette: false, seedVide: false });
    expect(apres).toContain(A_COMPLETER);
    expect(lirePassation(`# T\n\n${apres}\n`).problemes).toEqual([]);
  });
  it("construirePassation les écrit à la fin ; `conserver` les reprend telles quelles", async () => {
    const plan = await planifier({ id: "banctest", nom: "Banctest", classement: "temps", aBlanc: true, passation: false, sansCommandes: true, racine: RACINE });
    const neuve: string = construirePassation(RACINE, plan.fiche, { classement: "temps", teinte: plan.teinte });
    expect(lirePassation(neuve).problemes).toEqual([]);
    const gardees = "## Où on en est\n- écrit par la conversation\n\n## Prochain lot\nLe lot Q.\n\n## Décisions en attente\naucune";
    const reecrite: string = construirePassation(RACINE, plan.fiche, { classement: "temps", teinte: plan.teinte, conserver: gardees });
    expect(reecrite.endsWith(`${gardees}\n`)).toBe(true);
    expect(reecrite).not.toContain("Le seed écrit par Nathan");
  });
  it("`--passation` sur un jeu qui existe garde ses trois sections", async () => {
    const plan = await planifier({ id: "blocks", passation: true, aBlanc: false, sansCommandes: true, racine: RACINE });
    const actuel = readFileSync(join(RACINE, "docs/blocks/passation.md"), "utf8");
    const nouveau: string = plan.creations[0].contenu;
    expect(sectionsFinales(actuel)).not.toBeNull();
    expect(nouveau.endsWith(`${sectionsFinales(actuel)}\n`)).toBe(true);
  });
});
