import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHEMINS_HERITES, JEUX_SANS_NOM_DE_THEME, PREFIXES_HERITES, TABLES_HERITEES, clesDeCatalogue, clesManquantes, lireFiche, prefixesDeZones, projectionCI, projectionJeu, projectionPortail, projectionServeur, validerEnsemble, validerFiche, type FicheJeu } from "../src/fiche";
import { DOSSIER_FICHES, sorties } from "../src/ficheSorties";

// Lot K1 : la fiche d'un jeu (`config/jeux/<id>.json`) — la validation, TOUTES les fiches présentes, et les fichiers que `npm run fiches` en tire (à jour, comme `jetons.css`).

const RACINE = resolve(__dirname, "..", "..", "..");
// Lot K4e : les fiches du dépôt ET, en essai, celles de `CDJ_FICHES_SUPPLEMENTAIRES` (le jeu fictif de `scripts/jeu-fictif.mjs`) ; `brut(id)` ne lit que les trois jeux livrés.
const { lireFichesBrutes } = (await import(/* @vite-ignore */ join(RACINE, "scripts/fiches-brutes.mjs"))) as typeof import("../../../scripts/fiches-brutes.mjs");
const brut = (id: string): Record<string, any> => JSON.parse(readFileSync(join(RACINE, DOSSIER_FICHES, `${id}.json`), "utf8"));
const fiches = (): FicheJeu[] => lireFichesBrutes(RACINE).map((f) => lireFiche(f.brut, f.id)).sort((a, b) => a.ordre - b.ordre);

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
    const attendu = sorties(fiches(), (chemin) => existsSync(join(RACINE, chemin)));
    expect(Object.keys(attendu).sort()).toEqual([
      "apps/api/scripts/essais.generated.ts", // lot K4f : les modules d'essais des jeux neufs
      "apps/api/src/fiches.generated.ts",
      "apps/api/src/registre.generated.ts",
      "apps/portail/src/jeux.generated.css",
      "apps/portail/src/jeux.production.generated.css", // lot K4f : les variantes de production (sans les jeux témoins), lues par le portail de la production
      "config/jeux/projections/ci.json",
      "config/jeux/projections/jeu.json",
      "config/jeux/projections/portail.json",
      "config/jeux/projections/portail.production.json",
      "config/jeux/projections/serveur.json",
      "packages/core/src/fiches.generated.ts",
      "packages/core/src/fiches.production.generated.ts",
      "packages/musique/src/fiches.generated.ts",
      "packages/musique/src/fiches.production.generated.ts",
      "packages/profile/src/fiches.generated.ts",
      "packages/profile/src/fiches.production.generated.ts",
      "packages/ui/src/amis.generated.css",
      "packages/ui/src/fiches.generated.ts",
      "packages/ui/src/fiches.production.generated.ts",
      "packages/ui/src/jeux.generated.css",
      "packages/ui/src/jeux.production.generated.css",
      "scripts/catalogues-jeux.generated.ts",
    ]);
    for (const [chemin, contenu] of Object.entries(attendu)) {
      expect(existsSync(join(RACINE, chemin)), chemin).toBe(true);
      expect(readFileSync(join(RACINE, chemin), "utf8"), `${chemin} n'est pas à jour : npm run fiches`).toBe(contenu);
    }
  });

  it("aucune fiche ne reste orpheline : un fichier de projection d'un jeu supprimé n'existe pas", () => {
    const dossier = join(RACINE, DOSSIER_FICHES, "projections");
    expect(readdirSync(dossier).sort()).toEqual(["ci.json", "jeu.json", "portail.json", "portail.production.json", "serveur.json"]);
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
  it("lot K4c : un jeu sur la table commune `resultats_jeu` n'a besoin d'aucune table à lui, mais n'en vole pas une autre", () => {
    refuse((f) => (f.donnees.tables = []), "donnees.tables");
    const ok = (f: Record<string, any>) => {
      f.donnees.tableCommune = "resultats_jeu";
      f.donnees.tables = [];
    };
    const f = structuredClone(fiches().find((x) => x.id === "tower")!);
    ok(f);
    expect(validerFiche(f, "tower")).toEqual([]);
    refuse((g) => {
      ok(g);
      g.donnees.tables.push({ nom: "results", sort: "videe" });
    }, "doit commencer par « tower_ »");
    refuse((g) => ((g.donnees as { tableCommune?: string }).tableCommune = "results"), "donnees.tableCommune");
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
  it("lot A3 : la catégorie est `jour` ou `arcade` ; un jeu d'arcade n'entre jamais dans le cumul ; `categorieDepuis` est une date", () => {
    refuse((f) => delete f.categorie, "categorie");
    refuse((f) => (f.categorie = "tournoi"), "categorie : `jour` ou `arcade`");
    refuse((f) => (f.categorieDepuis = "demain"), "categorieDepuis");
    refuse((f) => (f.categorieDepuis = 20261103), "categorieDepuis");
    // Un jeu d'arcade a `classement.cumul: false` (règle de la catégorie, en plus de celle de l'unité).
    refuse((f) => {
      f.categorie = "arcade";
      f.classement.cumul = true;
    }, "un jeu d'arcade n'entre jamais dans le cumul");
    const ok = (modif: (f: Record<string, any>) => void, id = "tower") => {
      const f = structuredClone(brut(id));
      modif(f);
      return validerFiche(f, id);
    };
    expect(ok((f) => (f.categorieDepuis = "2026-11-05"))).toEqual([]);
    expect(ok((f) => (f.categorie = "jour"))).toEqual([]); // un jeu au score peut être du jour (hors cumul)
  });
  it("lot A3 : Track et Jump sont du jour, Tower est d'arcade (hors cumul), et la projection du portail n'écrit que l'arcade", () => {
    const parId = Object.fromEntries(fiches().map((f) => [f.id, f.categorie]));
    expect(parId).toMatchObject({ track: "jour", jump: "jour", tower: "arcade" });
    for (const f of fiches().filter((x) => x.categorie === "arcade")) expect(f.classement.cumul, f.id).toBe(false);
    const p = projectionPortail(fiches());
    expect(p.jeux.find((j) => j.id === "track")).not.toHaveProperty("categorie");
    expect(p.jeux.find((j) => j.id === "tower")).toMatchObject({ categorie: "arcade" });
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
    expect(j.jours).toEqual({
      mode: "fichier-par-jour",
      dossier: "apps/jump/public/levels",
      preuveInterditeEnProd: true,
      fabrication: { empreinte: "apps/api/scripts/jump-empreintes.ts", figer: { paquet: "@cdj/jump", script: "freeze:days", forme: "jusqu-a-la-veille" }, apresPose: { paquet: "@cdj/api", script: "jump:seed", sorties: ["apps/jump/public/demo"] } },
    });
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
    expect(t.jours).toEqual({ mode: "registre", registre: "packages/sim/src/jours-track.json", preuveInterditeEnProd: false, fabrication: { empreinte: "apps/api/scripts/track-empreintes.ts", registre: "apps/api/scripts/track-registre.ts" } });
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
    for (const j of p.jeux) expect(Object.keys(j).every((k) => ["accroche", "accrocheTheme", "categorie", "categorieDepuis", "code", "cumul", "format", "id", "premierJour", "titre"].includes(k)), j.id).toBe(true);
    expect(p.jeux.find((j) => j.id === "tower")).toEqual({ id: "tower", accroche: "portail.tower.accroche", cumul: false, categorie: "arcade", format: "hauteur" }); // code = id, absent ; lot A3 : seule l'arcade est écrite (`jour` est l'usage)
    expect(p.jeux.find((j) => j.id === "jump")).toEqual({ id: "jump", accroche: "portail.jump.accroche", titre: "jeu.jump.titre", accrocheTheme: "jump.replique.", premierJour: "2026-10-16" }); // code = id, cumul vrai et format `temps` : les défauts, absents
  });
  // Lot K4e : les trois jeux livrés (leurs listes historiques sont écrites en toutes lettres) ; les listes de TOUTES les fiches sont vérifiées juste après.
  const trois = () => ["track", "jump", "tower"].map((id) => lireFiche(brut(id), id));
  it("les listes de toutes les fiches (jeu neuf compris) suivent leurs fiches, dans l'ordre", () => {
    const l = fiches();
    const j = projectionJeu(l);
    expect(j.jeux.map((x) => x.id)).toEqual(l.map((f) => f.id));
    expect(j.prefixes).toEqual(l.map((f) => f.donnees.stockage.prefixe));
    expect(j.ou).toEqual(["portail", ...l.map((f) => f.message.ou)]);
    expect(j.zones).toEqual(["dujour", ...l.map((f) => f.zoneNouveautes)]);
    expect(j.publics).toEqual(l.filter((f) => f.etatDepart === "on").map((f) => f.id));
  });
  it("les listes qui doivent aussi contenir Track et Jump sont complètes, dans l'ordre historique : les paquets n'embarquent pas un octet de plus", () => {
    const j = projectionJeu(trois());
    expect(j.publics).toEqual(["track", "jump"]); // Tower est `off` : il n'est pas public
    expect(j.prefixes).toEqual(["cdj:", "jump:", "tower:"]);
    expect(j.ou).toEqual(["portail", "track", "jump", "tower"]);
    expect(j.zones).toEqual(["dujour", "track", "jump", "tower"]);
    expect(j.nomsDeZones).toEqual({ dujour: "Du Jour", track: "Track", jump: "Jump", tower: "Tower" });
    expect(j.jeux.map((x) => x.id)).toEqual(["track", "jump", "tower"]); // lot K1c : un jeu = une fiche, il n'y a plus de jeu sans fiche
  });
  it("un jeu `on` d'une fiche entre dans les jeux publics, dans l'ordre des fiches (Tower, une fois `on`, après Track et Jump)", () => {
    const l = trois().map((f) => (f.id === "tower" ? { ...f, etatDepart: "on" as const } : f));
    expect(projectionJeu(l).publics).toEqual(["track", "jump", "tower"]);
  });
});

// Lot K4b — comment un jeu fige, prépare et compare ses jours (`jours.fabrication`) : lu par `scripts/mise-en-production.mjs` et les workflows de production.
describe("jours.fabrication (lot K4b) : la chaîne de « Mettre en production » lit la fiche", () => {
  const refuse = (modif: (f: Record<string, any>) => void, id = "tower"): string => {
    const f = structuredClone(brut(id));
    modif(f);
    return validerFiche(f, id).join("\n");
  };
  it("Tower : un module d'empreinte, un script qui fige les jours protégés et un script qui prépare (fenêtre, garde)", () => {
    expect(lireFiche(brut("tower"), "tower").jours.fabrication).toEqual({
      empreinte: "apps/api/scripts/tower-empreintes.ts",
      figer: { paquet: "@cdj/tower-sim", script: "figer:tower", forme: "jours-proteges" },
      preparer: { paquet: "@cdj/tower-sim", script: "preparer:tower", joursApresBascule: 14, garde: "packages/tower-sim/test/jours.test.ts" },
    });
  });
  it("le bloc est obligatoire, avec son module d'empreinte ; un chemin hors du jeu est refusé", () => {
    expect(refuse((f) => delete f.jours.fabrication)).toContain("jours.fabrication");
    expect(refuse((f) => delete f.jours.fabrication.empreinte)).toContain("jours.fabrication.empreinte");
    expect(refuse((f) => (f.jours.fabrication.empreinte = "apps/api/scripts/jump-empreintes.ts"))).toContain("jours.fabrication.empreinte");
    expect(refuse((f) => (f.jours.fabrication.preparer.garde = "packages/sim/test/x.test.ts"))).toContain("jours.fabrication.preparer.garde");
  });
  it("un mode `fichier-par-jour` dit comment il fige ; un mode `registre` dit son module de registre, et ne fige ni ne prépare", () => {
    expect(refuse((f) => delete f.jours.fabrication.figer)).toContain("jours.fabrication.figer");
    expect(refuse((f) => (f.jours.fabrication.figer.forme = "toujours"))).toContain("jours.fabrication.figer.forme");
    expect(refuse((f) => (f.jours.fabrication.registre = "apps/api/scripts/tower-registre.ts"))).toContain("jours.fabrication.registre");
    expect(refuse((f) => delete f.jours.fabrication.registre, "track")).toContain("jours.fabrication.registre");
    expect(refuse((f) => (f.jours.fabrication.figer = { paquet: "@cdj/sim", script: "x", forme: "jours-proteges" }), "track")).toContain("jours.fabrication.figer");
  });
  it("un script npm est celui d'un paquet du jeu (apresPose : ou celui du serveur) ; la fenêtre est un entier ≥ 0", () => {
    expect(refuse((f) => (f.jours.fabrication.figer.paquet = "@cdj/jump"))).toContain("jours.fabrication.figer.paquet");
    expect(refuse((f) => (f.jours.fabrication.figer.script = "x && rm -rf /"))).toContain("jours.fabrication.figer.script");
    expect(refuse((f) => (f.jours.fabrication.preparer.joursApresBascule = -1))).toContain("joursApresBascule");
    expect(refuse((f) => (f.jours.fabrication.apresPose = { paquet: "@cdj/web", script: "seed", sorties: ["apps/tower/public/demo"] }))).toContain("apresPose.paquet");
    expect(refuse((f) => (f.jours.fabrication.apresPose = { paquet: "@cdj/api", script: "seed", sorties: ["apps/web/public/demo"] }))).toContain("apresPose.sorties");
  });
});

// Lot K4e — le jeu témoin, les clés de catalogue qu'une fiche exige, et les fiches d'un dossier de plus (essais seulement).
describe("un jeu témoin (lot K4e)", () => {
  const neuf = () => {
    const f = structuredClone(brut("tower"));
    f.id = f.code = f.message.ou = f.zoneNouveautes = "essai";
    return f;
  };
  it("`temoin` est un booléen ; un témoin ne range ses résultats que dans la table commune (aucune table à lui : la base de production n'en voit pas la trace)", () => {
    expect(validerFiche(brut("tower"), "tower")).toEqual([]);
    const t = structuredClone(brut("tower"));
    t.temoin = "oui";
    expect(validerFiche(t, "tower").join("\n")).toContain("temoin : booléen");
    t.temoin = true;
    expect(validerFiche(t, "tower").join("\n")).toContain("table commune");
    t.donnees.tables = [];
    expect(validerFiche(t, "tower").join("\n")).toContain("table commune"); // sans `tableCommune` : refusé aussi
    t.donnees.tableCommune = "resultats_jeu";
    expect(validerFiche(t, "tower")).toEqual([]);
    expect(neuf().id).toBe("essai");
  });
  it("les projections portent `temoin: true` pour un témoin et rien pour les autres", () => {
    const t = lireFiche({ ...brut("tower"), temoin: true, donnees: { ...brut("tower").donnees, tables: [], tableCommune: "resultats_jeu" } }, "tower");
    expect(projectionServeur([t]).jeux[0]).toMatchObject({ temoin: true });
    expect(projectionCI([t]).jeux[0]).toMatchObject({ temoin: true });
    expect(projectionJeu([t]).jeux[0]).toMatchObject({ temoin: true });
    const autre = lireFiche(brut("tower"), "tower");
    for (const p of [projectionServeur([autre]).jeux[0]!, projectionCI([autre]).jeux[0]!, projectionJeu([autre]).jeux[0]!]) expect(p).not.toHaveProperty("temoin");
  });
});

describe("les clés de catalogue qu'une fiche exige (lot K4e)", () => {
  it("le nom, l'accroche, le titre s'il y en a un, un nom par thème (sauf Track) et une réplique par thème pour une accroche par thème", () => {
    const tower = clesDeCatalogue(lireFiche(brut("tower"), "tower")).map((c) => c.cle);
    expect(tower).toEqual(["jeu.tower.nom", "portail.tower.accroche", ...["port", "chantier", "canyon", "banquise", "jungle", "nuit"].map((t) => `portail.theme.tower.${t}`)]);
    const jump = clesDeCatalogue(lireFiche(brut("jump"), "jump")).map((c) => c.cle);
    expect(jump).toContain("jeu.jump.titre");
    expect(jump).toContain("jump.replique.foret");
    expect(jump).toContain("portail.theme.jump.neon");
    const track = clesDeCatalogue(lireFiche(brut("track"), "track")).map((c) => c.cle);
    expect(track.some((k) => k.startsWith("portail.theme.track."))).toBe(false);
    expect(JEUX_SANS_NOM_DE_THEME).toEqual(["track"]);
  });
  it("une clé manquante donne une phrase qui nomme la fiche, la clé, le catalogue et la langue", () => {
    const f = lireFiche(brut("tower"), "tower");
    const complet = { fr: Object.fromEntries(clesDeCatalogue(f).map((c) => [c.cle, "x"])), en: Object.fromEntries(clesDeCatalogue(f).map((c) => [c.cle, "x"])) };
    expect(clesManquantes(f, { commun: complet, portail: complet })).toEqual([]);
    const sansAccroche = { fr: { ...complet.fr }, en: { ...complet.en } };
    delete (sansAccroche.en as Record<string, string>)["portail.tower.accroche"];
    expect(clesManquantes(f, { commun: complet, portail: sansAccroche })).toEqual(["fiche « tower » : la clé « portail.tower.accroche » manque au catalogue du portail (en)"]);
    expect(clesManquantes(f, { commun: { fr: {}, en: {} }, portail: complet })).toContain("fiche « tower » : la clé « jeu.tower.nom » manque au catalogue commun de @cdj/ui (fr)");
  });
});

describe("les fiches d'un dossier de plus (lot K4e, essais seulement)", () => {
  it("la variable est refusée hors essai, acceptée en essai, et un identifiant en double est une erreur claire", async () => {
    const m = (await import(/* @vite-ignore */ join(RACINE, "scripts/fiches-brutes.mjs"))) as typeof import("../../../scripts/fiches-brutes.mjs");
    expect(() => m.dossiersSupplementaires({ CDJ_FICHES_SUPPLEMENTAIRES: "/x" })).toThrow(/réservée aux essais/);
    expect(m.dossiersSupplementaires({ CDJ_FICHES_SUPPLEMENTAIRES: "/x:/y", CDJ_MODE_ESSAI: "1" })).toEqual(["/x", "/y"]);
    expect(m.dossiersSupplementaires({ CDJ_FICHES_SUPPLEMENTAIRES: "/x", NODE_ENV: "test" })).toEqual(["/x"]);
    expect(m.dossiersSupplementaires({})).toEqual([]);
    expect(() => m.lireFichesBrutes(RACINE, { CDJ_FICHES_SUPPLEMENTAIRES: join(RACINE, DOSSIER_FICHES), CDJ_MODE_ESSAI: "1" })).toThrow(/deux fiches pour le jeu « [a-z0-9]+ »/);
  });
});
