import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validerFiche } from "@cdj/core/fiche";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { ENTREES_MECANIQUES, TEINTES, choisirTeinte, cloner, construirePassation, fichesExistantes, fichiersDuModele, lireOptions, planifier, portsLibres, principal, renommer, resume, verifierId } from "../../../scripts/nouveau-jeu.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { classer, contient } from "../../../scripts/kit-bout-en-bout.mjs";

// Lot K4g — (l'identifiant `banctest` : `scripts/jeu-fictif.mjs` pose lui-même un jeu `essai` dans sa copie) le générateur `npm run nouveau-jeu` (scripts/nouveau-jeu.mjs) : ses règles pures, son plan à blanc sur le dépôt réel (rien n'est écrit) et la preuve que ce qu'il ferait reste dans les zones du jeu.
// Le vrai passage (génération, typage, tests, construction, e2e) est celui du job « Kit de bout en bout » (scripts/kit-bout-en-bout.mjs), sur une copie du dépôt.
const RACINE = join(import.meta.dirname, "../../..");
const c = { id: "banctest", nom: "Banctest", ident: "Banctest", majuscules: "BANCTEST", sel: "0x123456", ports: { site: 4999, serveur: 8999 } };
const globVersRegExp = (glob: string) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`);

describe("l'identifiant et les options", () => {
  it("refuse un tiret, une majuscule, un nom trop court, un nom réservé, le modèle et un jeu qui existe", () => {
    for (const id of ["banctest-temps", "Banctest", "ab", "web", "cibles", "tower", "1jeu", "a".repeat(21)]) expect(() => verifierId(id, RACINE), id).toThrow();
    expect(() => verifierId("banctesttemps", RACINE)).not.toThrow();
  });
  it("lit les options : le nom par défaut est l'identifiant en majuscule initiale, le classement score par défaut", () => {
    const o = lireOptions(["--id", "banctest"]);
    expect({ id: o.id, nom: o.nom, classement: o.classement, aBlanc: o.aBlanc }).toEqual({ id: "banctest", nom: "Banctest", classement: "score", aBlanc: false });
    expect(lireOptions(["--id", "z4x", "--nom", "Zèbre 4", "--classement", "temps", "--a-blanc"])).toMatchObject({ nom: "Zèbre 4", classement: "temps", aBlanc: true });
    expect(() => lireOptions([])).toThrow(/--id/);
    expect(() => lireOptions(["--id", "banctest", "--classement", "hauteur"])).toThrow(/score|temps/);
  });
});

describe("le renommage", () => {
  it("renomme l'identité du jeu partout (chemins, paquets, constantes, identifiants, préfixes) et le nom affiché", () => {
    const t = renommer('import { CIBLES_SIM_VERSION, dailyCibles } from "@cdj/cibles-sim"; // « Cibles » : apps/cibles, cibles:records, "sable" 0xc1b1e5 4176 8793', c);
    expect(t).toBe('import { BANCTEST_SIM_VERSION, dailyBanctest } from "@cdj/banctest-sim"; // « Banctest » : apps/banctest, banctest:records, "clair" 0x123456 4999 8999');
    expect(renommer("disabled ardoise", c)).toBe("disabled sombre"); // le mot « sable » de « disabled » n'est pas un thème
  });
  it("le modèle, une fois renommé, ne garde aucun nom de « Cibles » dans ses fichiers copiés", () => {
    for (const f of fichiersDuModele(RACINE)) {
      const t = renommer(readFileSync(join(RACINE, f), "utf8"), c);
      expect(t, f).not.toMatch(/Cibles|CIBLES|cibles/);
    }
  });
  it("les fichiers du modèle : son application, sa simulation, son serveur ; ni documents, ni captures, ni jours figés, ni fichiers construits", () => {
    const fichiers: string[] = fichiersDuModele(RACINE);
    expect(fichiers).toEqual(expect.arrayContaining(["apps/cibles/src/main.ts", "packages/cibles-sim/src/variante.ts", "apps/api/src/cibles.ts", "apps/api/scripts/cibles-essais.ts", "apps/api/test/cibles.test.ts"]));
    expect(fichiers.filter((f) => /docs\/|captures-|dist|tsbuildinfo|\/jours\/[0-9]/.test(f))).toEqual([]);
  });
});

describe("cloner, teintes, ports", () => {
  it("clone après chaque suite de lignes qui répondent, sans rien retirer", () => {
    const r = cloner("a\nx1\nx2\nb\nx3\n", (l: string) => l.startsWith("x"), (run: string[]) => run.map((l) => `${l}!`));
    expect(r).toEqual({ texte: "a\nx1\nx2\nx1!\nx2!\nb\nx3\nx3!\n", ajouts: 3 });
  });
  it("la teinte est la première qu'aucune fiche n'utilise", () => {
    const fiches = fichesExistantes(RACINE);
    const [fond, coque] = choisirTeinte(fiches);
    const utilisees = fiches.flatMap((f: { etiquette: { fond: string; coque: string } }) => [f.etiquette.fond.toUpperCase(), f.etiquette.coque.toUpperCase()]);
    expect(utilisees).not.toContain(fond.toUpperCase());
    expect(utilisees).not.toContain(coque.toUpperCase());
    expect(TEINTES.map(([f]: string[]) => f)).toContain(fond);
    expect(() => choisirTeinte([...fiches, ...TEINTES.map(([f, k]: string[]) => ({ etiquette: { fond: f, coque: k } }))])).toThrow(/teinte/);
  });
  it("les ports d'un jeu neuf ne sont ceux d'aucun jeu existant", () => {
    const p = portsLibres(RACINE);
    expect(p.site).toBeGreaterThan(4176);
    expect(p.serveur).toBeGreaterThan(8793);
    for (const dejaPris of [4173, 4174, 4175, 4176, 8787, 8788, 8789, 8790, 8791, 8793]) expect([p.site, p.serveur]).not.toContain(dejaPris);
  });
});

describe("le plan à blanc, sur le dépôt réel", () => {
  for (const classement of ["score", "temps"] as const) {
    it(`« ${classement} » : une fiche valide, des fichiers dans les zones du jeu, des lignes ajoutées aux seules entrées mécaniques`, async () => {
      const plan = await planifier({ id: "banctest", nom: "Banctest", classement, aBlanc: true, passation: false, sansCommandes: true, racine: RACINE });
      expect(validerFiche(plan.fiche, "banctest")).toEqual([]);
      expect(plan.fiche).toMatchObject({ id: "banctest", etatDepart: "off", temoin: false, etiquette: { dessin: "generique" } });
      expect(plan.fiche.classement.format).toBe(classement === "temps" ? "temps" : "entier");
      expect(plan.fiche.classement.colonnes.map((k: { nom: string }) => k.nom)).toEqual(classement === "temps" ? ["temps", "submitted_at", "player_id"] : ["touches", "dernier", "submitted_at", "player_id"]);
      const zones = (plan.fiche.zones.jeu as string[]).map(globVersRegExp);
      const hors = plan.creations.map((f: { chemin: string }) => f.chemin).filter((ch: string) => !zones.some((z: RegExp) => z.test(ch)) && ch !== "config/jeux/banctest.json");
      expect(hors).toEqual([]);
      expect(plan.editions.map((e: { chemin: string }) => e.chemin).sort()).toEqual([...ENTREES_MECANIQUES].sort());
      for (const e of plan.editions) expect(e.apres.length, e.chemin).toBeGreaterThan(e.avant.length);
      const variante = plan.creations.find((f: { chemin: string }) => f.chemin.endsWith("src/variante.ts")).contenu as string;
      expect(variante).toContain(`export const VARIANTE_NOM: NomVariante = "${classement}";`);
      // Le texte visible ne garde rien de « Cibles » : nom, phrases, aide « à remplacer ».
      const fr = plan.creations.find((f: { chemin: string }) => f.chemin === "apps/banctest/src/catalogue.fr.ts").contenu as string;
      expect(fr).toContain("À remplacer");
      expect(fr).not.toMatch(/[Cc]ible/);
      // Rien n'est écrit par un plan.
      expect(existsSync(join(RACINE, "apps/banctest"))).toBe(false);
    });
  }
  it("`principal --a-blanc` liste ce qu'il créerait, affiche les 5 étapes et n'écrit rien", async () => {
    const lignes: string[] = await principal(["--id", "banctest", "--a-blanc"]);
    const texte = lignes.join("\n");
    expect(texte).toMatch(/À BLANC/);
    expect(texte).toContain("+ apps/banctest/src/ (");
    expect(texte).toContain("main.ts");
    expect(texte).toContain("~ apps/api/Dockerfile");
    for (let i = 1; i <= 5; i++) expect(texte).toContain(`  ${i}. `);
    expect(existsSync(join(RACINE, "docs/banctest"))).toBe(false);
  });
  it("refuse un jeu qui existe (le modèle, une fiche)", async () => {
    await expect(principal(["--id", "cibles", "--a-blanc"])).rejects.toThrow();
    await expect(principal(["--id", "tower", "--a-blanc"])).rejects.toThrow(/existe|réservé|refusé/);
  });
});

describe("la passation, tenue à jour depuis les CLAUDE.md", () => {
  it("reprend les zones de la fiche, les règles du CLAUDE.md racine et la méthode ; rien n'est inventé à la main", async () => {
    const plan = await planifier({ id: "banctest", nom: "Banctest", classement: "temps", aBlanc: true, passation: false, sansCommandes: true, racine: RACINE });
    const texte: string = construirePassation(RACINE, plan.fiche, { classement: "temps", teinte: plan.teinte });
    for (const t of ["# Passation — Banctest", "## 1. Où en est ce jeu", "## 2. La plateforme en bref", "## 3. Tes zones", "## 5. Les règles de la plateforme", "## 6. La charte visuelle", "## 7. La méthode", "`apps/banctest/**`", "à choisir par Nathan", "off` → `preview` → `on`"]) expect(texte, t).toContain(t);
    // Les règles viennent du CLAUDE.md racine : sa première puce « Un lot = une session » y est (résumée).
    expect(texte).toContain("Un lot = une session = une branche = une PR brouillon");
    expect(texte.length).toBeGreaterThan(5_000);
    expect(texte.length).toBeLessThan(45_000); // à coller dans une conversation : pas un livre
  });
  it("`resume` garde les puces de premier niveau d'une section et coupe les longues à la fin d'une phrase", () => {
    const md = "## Titre\n- **A** court.\n  suite indentée ignorée\n- " + "mot ".repeat(200) + "\n## Autre\n- hors section";
    const r: string[] = resume(md, "Titre", 100);
    expect(r).toHaveLength(2);
    expect(r[0]).toBe("- **A** court.");
    expect(r[1]!.endsWith("[…]")).toBe(true);
  });
});

describe("le contrôle des fichiers hors zones du job de bout en bout", () => {
  it("`contient` : tout ce qui y était y est encore", () => {
    expect(contient({ a: 1, l: [1, { b: 2 }, 3] }, { a: 1, l: [{ b: 2 }] })).toBe(true);
    expect(contient({ a: 1, l: [1] }, { a: 1, l: [2] })).toBe(false);
    expect(contient({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
  it("`classer` range ce qui a changé : zones du jeu, fiche et fichiers générés passent ; un autre fichier est signalé", () => {
    const avant = new Map([["README.md", "1"], ["apps/api/Dockerfile", "1"]]);
    const apres = new Map([["README.md", "2"], ["apps/api/Dockerfile", "2"], ["apps/banctest/src/main.ts", "1"], ["config/jeux/banctest.json", "1"], ["packages/ui/src/fiches.generated.ts", "2"], ["scripts/fiches.ts", "9"]]);
    const r = classer(avant, apres, RACINE, RACINE, [["apps/banctest/**"]]);
    expect(r.horsDesZones.sort()).toEqual(["README.md", "scripts/fiches.ts"].sort());
  });
});
