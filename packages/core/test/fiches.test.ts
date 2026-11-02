import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHEMINS_HERITES, PREFIXES_HERITES, TABLES_HERITEES, lireFiche, prefixesDeZones, projectionJeu, projectionPortail, validerEnsemble, validerFiche, type FicheJeu } from "../src/fiche";
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

describe("Track (lot K1c) : sa fiche", () => {
  const track = () => lireFiche(brut("track"), "track");
  it("public d'emblée, premier de l'ordre, classé au temps (ms) dans le cumul ; code du registre `cdj`, dossiers `web` et `sim`", () => {
    const t = track();
    expect(t).toMatchObject({ code: "cdj", ordre: 1, etatDepart: "on", premierJour: "2026-10-13", dossiers: { app: "web", sim: "sim" }, partage: { extras: ["rang"] }, admin: { outils: true } });
    expect(t.classement).toMatchObject({ cumul: true, unite: "ms", format: "temps" });
    expect(t.classement.colonnes.map((c) => c.nom)).toEqual(["ms", "submitted_at", "player_id"]);
    expect(t.medailles.methode).toBe("facteurs-auteur");
    expect(t.jours).toEqual({ mode: "registre", registre: "packages/sim/src/jours-track.json", preuveInterditeEnProd: false });
    expect(t.donnees.stockage.prefixe).toBe("cdj:");
  });
  it("ses tables sont celles d'avant la règle, nommées une à une : la vidée et la gardée", () => {
    const t = track();
    expect(t.donnees.tables.map((x) => x.nom).sort()).toEqual([...TABLES_HERITEES.track!].sort());
    expect(t.donnees.tables.filter((x) => x.sort === "gardee").map((x) => x.nom)).toEqual(["circuits", "planning"]);
  });
  it("la validation reste « un jeu ne réclame que ses propres chemins » : les dossiers, tables, préfixes et fichiers hérités de Track ne sont permis qu'à Track", () => {
    const refuse = (id: string, modif: (f: Record<string, any>) => void, morceau: string) => {
      const f = structuredClone(brut(id));
      modif(f);
      expect(validerFiche(f, id).join("\n"), morceau).toContain(morceau);
    };
    // Track ne peut pas réclamer les dossiers d'un autre jeu, ni un dossier hors de `dossiers`.
    refuse("track", (f) => f.zones.jeu.push("apps/jump/**"), "n'est pas dans les zones du jeu");
    refuse("track", (f) => f.zones.jeu.push("packages/jump-sim/**"), "n'est pas dans les zones du jeu");
    refuse("track", (f) => f.zones.documents.push("packages/ui/src/composants.ts"), "n'est pas dans les zones du jeu");
    refuse("track", (f) => f.zones.jeu.push("apps/api/src/jump.ts"), "n'est pas dans les zones du jeu");
    refuse("track", (f) => f.donnees.tables.push({ nom: "jump_results", sort: "videe" }), "doit commencer par « track_ »");
    refuse("track", (f) => (f.donnees.stockage.prefixe = "jump:"), "donnees.stockage");
    refuse("track", (f) => (f.dossiers = { app: "Web/../x", sim: "sim" }), "dossiers");
    // Les autres jeux n'héritent de rien de Track.
    refuse("jump", (f) => f.zones.jeu.push("apps/api/src/cdj.ts"), "n'est pas dans les zones du jeu");
    refuse("jump", (f) => f.donnees.tables.push({ nom: "results", sort: "videe" }), "doit commencer par « jump_ »");
    refuse("tower", (f) => (f.donnees.stockage.prefixe = "cdj:"), "donnees.stockage");
    refuse("jump", (f) => (f.dossiers = { app: "web", sim: "sim" }), "n'est pas dans les zones du jeu"); // des dossiers déclarés ne rendent pas ceux de Jump permis
    expect(Object.keys(CHEMINS_HERITES).sort()).toEqual(["jump", "track"]);
    expect(PREFIXES_HERITES).toEqual({ track: "cdj:" });
  });
  it("deux jeux ne déclarent pas le même dossier (la fiche de Jump ne peut pas viser `apps/web`)", () => {
    const j: FicheJeu = { ...lireFiche(brut("jump"), "jump"), dossiers: { app: "web", sim: "sim" } }; // (non validée : on vérifie la contradiction entre fiches)
    expect(validerEnsemble([track(), j]).join("\n")).toMatch(/dossier « apps\/web » : track et jump/);
  });
  it("un mode `registre` demande son fichier (et pas de dossier) ; `fichier-par-jour` demande son dossier", () => {
    const refuse = (modif: (f: Record<string, any>) => void) => {
      const f = structuredClone(brut("track"));
      modif(f);
      return validerFiche(f, "track").join("\n");
    };
    expect(refuse((f) => delete f.jours.registre)).toContain("jours.registre");
    expect(refuse((f) => (f.jours.dossier = "apps/web/public"))).toContain("jours.registre");
    expect(refuse((f) => (f.jours.registre = "packages/jump-sim/src/x.json"))).toContain("jours.registre");
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
    expect(j.jeux.map((x) => x.id)).toEqual(["track", "jump", "tower"]); // lot K1c : un jeu = une fiche, il n'y a plus de jeu sans fiche
  });
  it("un jeu `on` d'une fiche entre dans les jeux publics, dans l'ordre des fiches (Tower, une fois `on`, après Track et Jump)", () => {
    const l = fiches().map((f) => (f.id === "tower" ? { ...f, etatDepart: "on" as const } : f));
    expect(projectionJeu(l).publics).toEqual(["track", "jump", "tower"]);
  });
});
