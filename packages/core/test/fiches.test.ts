import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { JEUX_SANS_FICHE, lireFiche, prefixesDeZones, projectionJeu, projectionPortail, validerEnsemble, validerFiche, type FicheJeu } from "../src/fiche";
import { DOSSIER_FICHES, sorties } from "../src/ficheSorties";

// Lot K1 : la fiche d'un jeu (`config/jeux/<id>.json`) — la validation, TOUTES les fiches présentes, et les fichiers que `npm run fiches` en tire (à jour, comme `jetons.css`).

const RACINE = resolve(__dirname, "..", "..", "..");
const brut = (id: string): Record<string, any> => JSON.parse(readFileSync(join(RACINE, DOSSIER_FICHES, `${id}.json`), "utf8"));
const fiches = (): FicheJeu[] =>
  readdirSync(join(RACINE, DOSSIER_FICHES))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => lireFiche(brut(f.slice(0, -5)), f.slice(0, -5)))
    .sort((a, b) => a.ordre - b.ordre);

describe("les fiches du dépôt", () => {
  it("chacune est valide et se contredit avec aucune autre", () => {
    const l = fiches();
    expect(l.map((f) => f.id)).toContain("tower");
    expect(validerEnsemble(l)).toEqual([]);
    for (const f of l) expect(validerFiche(f, f.id), f.id).toEqual([]);
  });

  it("Tower : un nouveau jeu naît `off`, classé à la hauteur, hors du cumul au temps", () => {
    const t = lireFiche(brut("tower"), "tower");
    expect(t.etatDepart).toBe("off");
    expect(t.classement).toMatchObject({ cumul: false, unite: "mm", format: "hauteur" });
    expect(t.classement.colonnes[0]).toEqual({ nom: "hauteur_mm", sens: "desc" });
    expect(t.jours.mode).toBe("fichier-par-jour");
    expect(t.jours.preuveInterditeEnProd).toBe(true);
  });

  it("les fichiers générés (projections et vues des paquets) sont à jour : `npm run fiches` sinon", () => {
    const attendu = sorties(fiches());
    expect(Object.keys(attendu).sort()).toEqual([
      "config/jeux/projections/ci.json",
      "config/jeux/projections/jeu.json",
      "config/jeux/projections/portail.json",
      "config/jeux/projections/serveur.json",
      "packages/core/src/fiches.generated.ts",
      "packages/musique/src/fiches.generated.ts",
      "packages/profile/src/fiches.generated.ts",
      "packages/ui/src/fiches.generated.ts",
    ]);
    for (const [chemin, contenu] of Object.entries(attendu)) {
      expect(existsSync(join(RACINE, chemin)), chemin).toBe(true);
      expect(readFileSync(join(RACINE, chemin), "utf8"), `${chemin} n'est pas à jour : npm run fiches`).toBe(contenu);
    }
  });

  it("aucune fiche ne reste orpheline : un fichier de projection d'un jeu supprimé n'existe pas", () => {
    const dossier = join(RACINE, DOSSIER_FICHES, "projections");
    expect(readdirSync(dossier).sort()).toEqual(["ci.json", "jeu.json", "portail.json", "serveur.json"]);
  });
});

describe("la validation refuse ce qui sortirait du jeu", () => {
  const cas = (modif: (f: Record<string, any>) => void): string[] => {
    const f = structuredClone(brut("tower"));
    modif(f);
    return validerFiche(f, "tower");
  };
  const refuse = (modif: (f: Record<string, any>) => void, morceau: string) => expect(cas(modif).join("\n")).toContain(morceau);

  it("un fichier ne se fait pas passer pour un autre jeu", () => {
    expect(validerFiche(brut("tower"), "jump").join("\n")).toContain("id : doit être « jump »");
  });
  it("des zones de CI ailleurs que dans les siennes : refusé (la fiche est écrite par le lot du jeu)", () => {
    refuse((f) => f.zones.jeu.push("packages/core/**"), "n'est pas dans les zones du jeu");
    refuse((f) => f.zones.jeu.push("apps/tower/../api/**"), "n'est pas dans les zones du jeu");
    refuse((f) => f.zones.serveur.push("docs/tower/x.md"), "doit aussi être dans zones.jeu");
    refuse((f) => (f.e2e.zones["tower-x"] = { globs: ["apps/web/**"] }), "n'est pas dans les zones du jeu");
    refuse((f) => (f.e2e.zones["track-sim"] = { globs: ["apps/tower/**"] }), "ne définit que ses zones");
    refuse((f) => (f.jours.dossier = "apps/web/public"), "un dossier du jeu");
  });
  it("une table d'un autre jeu, un autre préfixe de stockage, une autre destination : refusés", () => {
    refuse((f) => f.donnees.tables.push({ nom: "results", sort: "videe" }), "doit commencer par « tower_ »");
    refuse((f) => (f.donnees.stockage.prefixe = "cdj:"), "donnees.stockage");
    refuse((f) => (f.donnees.stockage.reglagesGardes = ["jump:settings"]), "donnees.stockage");
    refuse((f) => (f.message.ou = "jump"), "message.ou");
    refuse((f) => (f.zoneNouveautes = "track"), "zoneNouveautes");
    refuse((f) => (f.budget.lignes = ["track.jsCss"]), "budget.lignes");
  });
  it("un jeu à la hauteur n'entre pas dans le cumul au temps", () => {
    refuse((f) => (f.classement.cumul = true), "seul un jeu au temps entre dans le cumul");
  });
  it("une couleur, un état, une scène, un spec sans zone : refusés", () => {
    refuse((f) => (f.etiquette.fond = "menthe"), "etiquette.fond");
    refuse((f) => (f.etiquette.police = "x; } body { display: none"), "etiquette.police");
    refuse((f) => (f.etatDepart = "preview"), "etatDepart");
    refuse((f) => f.musique.scenes.push("theme:nuit"), "musique.scenes");
    refuse((f) => (f.e2e.specs["x.spec.ts"] = []), "au moins une zone");
    refuse((f) => (f.e2e.fumee = ["absent.spec.ts"]), "e2e.fumee");
    refuse((f) => delete f.nom, "nom");
  });
  it("tous les problèmes sont rendus d'un coup", () => {
    const f = structuredClone(brut("tower"));
    f.ordre = 0;
    f.premierJour = "demain";
    expect(validerFiche(f, "tower").length).toBeGreaterThanOrEqual(2);
    expect(() => lireFiche(f, "tower")).toThrow(/ordre[\s\S]*premierJour/);
    expect(validerFiche(42)).toEqual(["la fiche n'est pas un objet JSON"]);
  });
  it("deux fiches ne partagent ni identifiant, ni code, ni ordre, ni table", () => {
    const t = lireFiche(brut("tower"), "tower");
    expect(validerEnsemble([t, t]).join("\n")).toMatch(/id « tower »[\s\S]*ordre[\s\S]*table « tower_results »/);
  });
  it("les zones qu'un jeu peut réclamer sont les siennes", () => {
    expect(prefixesDeZones("tower")).toContain("packages/tower-sim/");
    expect(prefixesDeZones("tower").every((p) => p.includes("tower"))).toBe(true);
  });
});

describe("Jump (lot K1b) : sa fiche", () => {
  it("public d'emblée, classé au temps (ticks), dans le cumul ; ses jours sont un fichier par jour, preuve interdite en production", () => {
    const j = lireFiche(brut("jump"), "jump");
    expect(j).toMatchObject({ code: "jump", ordre: 2, etatDepart: "on", premierJour: "2026-10-16", partage: { extras: ["morts", "rang"] }, admin: { outils: true } });
    expect(j.classement).toMatchObject({ cumul: true, unite: "ticks", format: "temps" });
    expect(j.classement.colonnes.map((c) => c.nom)).toEqual(["ticks", "submitted_at", "player_id"]);
    expect(j.medailles.methode).toBe("figees-niveau");
    expect(j.jours).toEqual({ mode: "fichier-par-jour", dossier: "apps/jump/public/levels", preuveInterditeEnProd: true });
    expect(j.donnees.tables.map((t) => `${t.nom}:${t.sort}`)).toEqual(["jump_results:videe", "jump_lives:videe", "jump_deaths:videe", "jump_levels:gardee"]);
  });
  it("un chemin hérité (`apps/api/scripts/measure-jump.ts`) est permis à Jump seul, nommé un par un", () => {
    expect(validerFiche(brut("jump"), "jump")).toEqual([]);
    const f = structuredClone(brut("tower"));
    f.zones.jeu.push("apps/api/scripts/measure-jump.ts");
    expect(validerFiche(f, "tower").join("\n")).toContain("n'est pas dans les zones du jeu");
    const g = structuredClone(brut("jump"));
    g.zones.jeu.push("apps/api/scripts/measure-autre.ts");
    expect(validerFiche(g, "jump").join("\n")).toContain("n'est pas dans les zones du jeu");
  });
});

describe("les projections", () => {
  it("le portail ne reçoit que ce qu'il dessine (ni zones, ni tables, ni versions, ni thèmes : un octet de plus pèse sur son budget)", () => {
    const p = projectionPortail(fiches());
    // Seul ce qui s'écarte de l'usage est écrit (code ≠ id, titre, accrocheTheme, premierJour, cumul faux, format ≠ temps) : un octet de JSON pèse sur le budget du portail.
    for (const j of p.jeux) expect(Object.keys(j).every((k) => ["accroche", "accrocheTheme", "code", "cumul", "format", "id", "premierJour", "titre"].includes(k)), j.id).toBe(true);
    expect(p.jeux.find((j) => j.id === "tower")).toEqual({ id: "tower", accroche: "portail.tower.accroche", cumul: false, format: "hauteur" }); // code = id, absent
    expect(p.jeux.find((j) => j.id === "jump")).toEqual({ id: "jump", accroche: "portail.jump.accroche", titre: "jeu.jump.titre", accrocheTheme: "jump.replique.", premierJour: "2026-10-16" }); // code = id, cumul vrai et format `temps` : les défauts, absents
  });
  it("les listes qui doivent aussi contenir Track et Jump sont complètes, dans l'ordre historique : les paquets n'embarquent pas un octet de plus", () => {
    const j = projectionJeu(fiches());
    expect(j.publics).toEqual(["track", "jump"]); // Tower est `off` : il n'est pas public
    expect(j.prefixes).toEqual(["cdj:", "jump:", "tower:"]);
    expect(j.ou).toEqual(["portail", "track", "jump", "tower"]);
    expect(j.zones).toEqual(["dujour", "track", "jump", "tower"]);
    expect(j.nomsDeZones).toEqual({ dujour: "Du Jour", track: "Track", jump: "Jump", tower: "Tower" });
    expect(JEUX_SANS_FICHE.map((x) => x.id)).toEqual(["track"]); // lot K1b : Jump a sa fiche ; Track attend le lot K1c
  });
  it("un jeu `on` d'une fiche entre dans les jeux publics, dans l'ordre des fiches (Tower, une fois `on`, après Track et Jump)", () => {
    const l = fiches().map((f) => (f.id === "tower" ? { ...f, etatDepart: "on" as const } : f));
    expect(projectionJeu(l).publics).toEqual(["track", "jump", "tower"]);
  });
});
