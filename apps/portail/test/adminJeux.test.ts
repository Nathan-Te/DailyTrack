import { describe, expect, it } from "vitest";
import {
  RUBRIQUES_MENU,
  blocageDuJeu,
  categoriesDesJeux,
  cleMenuDeVue,
  consequenceEtat,
  couleurValide,
  filtrerJeux,
  filtreCategorie,
  infoEtat,
  joueursDuJour,
  nomCategorie,
  retireAuxJoueurs,
  rubriqueDuLien,
  siglePourJeu,
  texteBlocage,
  texteSurCouleur,
  totalRubrique,
} from "../src/adminDonnees";

// Lot N3 (plateforme) — la page « Jeux » et le menu du panneau : les calculs purs (le rendu est dans `apps/web/e2e/admin-panneau.spec.ts`).

const jeux = [
  { jeu: "track", nom: "Track", categorie: "jour" },
  { jeu: "pinball", nom: "Pinball", categorie: "arcade" },
  { jeu: "pile", nom: "Pile poil", categorie: "party" },
];

describe("la page « Jeux » : confirmation, recherche, filtres", () => {
  it("seul le geste qui retire un jeu aux joueurs (de On vers Aperçu ou Off) se confirme", () => {
    expect(retireAuxJoueurs("on", "preview")).toBe(true);
    expect(retireAuxJoueurs("on", "off")).toBe(true);
    for (const [de, vers] of [["off", "preview"], ["off", "on"], ["preview", "on"], ["preview", "off"], ["on", "on"]] as const) expect(retireAuxJoueurs(de, vers), `${de} → ${vers}`).toBe(false);
  });

  it("la confirmation d'un retrait dit combien de joueurs y ont joué aujourd'hui (0, 1, plusieurs, inconnu)", () => {
    expect(joueursDuJour(12)).toBe("12 joueurs y ont joué aujourd'hui.");
    expect(joueursDuJour(1)).toBe("1 joueur y a joué aujourd'hui.");
    expect(joueursDuJour(0)).toBe("Personne n'y a encore joué aujourd'hui.");
    expect(joueursDuJour(null)).toBe("Le nombre de joueurs du jour n'est pas connu.");
    expect(consequenceEtat("Track", "on", "preview", null, 41)).toMatch(/^41 joueurs y ont joué aujourd'hui\. Track disparaît/);
    expect(consequenceEtat("Track", "on", "off", null, 41)).toContain("41 joueurs");
    // Ouvrir ne parle pas de joueurs.
    expect(consequenceEtat("Track", "off", "on", null, 41)).not.toContain("joueur y");
  });

  it("la recherche ignore la casse et les accents et lit le nom, le dossier et la catégorie ; le filtre garde une catégorie", () => {
    expect(filtrerJeux(jeux, "PINB", "").map((j) => j.jeu)).toEqual(["pinball"]);
    expect(filtrerJeux(jeux, "arcade", "").map((j) => j.jeu)).toEqual(["pinball"]);
    expect(filtrerJeux(jeux, "classé", "").map((j) => j.jeu)).toEqual(["track"]);
    expect(filtrerJeux(jeux, "", "party").map((j) => j.jeu)).toEqual(["pile"]);
    expect(filtrerJeux(jeux, "p", "arcade").map((j) => j.jeu)).toEqual(["pinball"]);
    expect(filtrerJeux(jeux, "zzz", "")).toEqual([]);
    expect(filtrerJeux(jeux, "  ", "").length).toBe(3);
  });

  it("les catégories viennent des fiches, quelles qu'elles soient, avec leurs noms", () => {
    expect(categoriesDesJeux(jeux)).toEqual(["jour", "arcade", "party"]);
    expect(categoriesDesJeux([...jeux, { categorie: "course" }])).toEqual(["jour", "arcade", "party", "course"]);
    expect([nomCategorie("jour"), nomCategorie("arcade"), nomCategorie("party"), nomCategorie("course")]).toEqual(["Classé", "Arcade", "Party", "Course"]);
    expect([filtreCategorie("jour"), filtreCategorie("arcade")]).toEqual(["Classés", "Arcade"]);
  });
});

describe("la page « Jeux » : ce qui bloque, la vignette, l'état", () => {
  it("ce qui bloque s'écrit en clair, dans l'ordre de la fiche ; un code inconnu n'écrit jamais un message du serveur", () => {
    expect(texteBlocage({ code: "identite_incomplete", manque: ["illustration"] })).toBe("Il manque l'illustration");
    expect(texteBlocage({ code: "identite_incomplete", manque: ["police", "motif"] })).toBe("Il manque la police et le motif");
    expect(texteBlocage({ code: "identite_incomplete", manque: ["police", "motif", "illustration"] })).toBe("Il manque la police, le motif et l'illustration");
    expect(texteBlocage({ code: "identite_incomplete", manque: ["inconnu"] })).toBe("L'identité du jeu n'est pas complète");
    expect(texteBlocage({ code: "autre" })).toBe("Position interdite (autre)");
    const libre = { off: null, preview: null, on: null };
    expect(blocageDuJeu({ bloque: libre })).toBeNull();
    expect(blocageDuJeu({ bloque: { ...libre, on: { code: "x" } } })).toEqual({ code: "x" });
  });

  it("la vignette : deux lettres, la couleur de la fiche si elle est bien `#RRGGBB`, un texte lisible dessus", () => {
    expect(siglePourJeu("Pinball")).toBe("PI");
    expect(siglePourJeu("Pile poil")).toBe("PI");
    expect(siglePourJeu("X")).toBe("X");
    expect(couleurValide("#FFB892")).toBe("#FFB892");
    for (const mauvaise of [null, "", "red", "#FFF", "#12345G", "url(x)", "#FFB892;color:red"]) expect(couleurValide(mauvaise), String(mauvaise)).toBeNull();
    expect(texteSurCouleur("#1E1A17")).toBe("#F4EFE6"); // fond sombre : crème
    expect(texteSurCouleur("#F2C230")).toBe("#2A1E16"); // fond clair : encre
  });

  it("depuis quand : le jour de Paris du changement d'état, dit avec les mots de la maquette", () => {
    expect(infoEtat({ etat: "on", etatDepuis: "2026-10-12T22:00:00.000Z" })).toBe("En ligne depuis le 13 oct."); // 13 octobre à minuit, heure de Paris
    expect(infoEtat({ etat: "preview", etatDepuis: "2026-11-18T10:00:00.000Z" })).toBe("Aperçu depuis le 18 nov. : visible avec le lien seulement");
    expect(infoEtat({ etat: "off", etatDepuis: "2026-11-02T10:00:00.000Z" })).toBe("Fermé depuis le 2 nov. : « Bientôt » pour les joueurs");
    expect(infoEtat({ etat: "off", etatDepuis: null })).toBe("Fermé : « Bientôt » pour les joueurs");
    expect(infoEtat({ etat: "on", etatDepuis: "pas une date" })).toBe("En ligne");
  });
});

describe("le menu en quatre rubriques", () => {
  it("quatre rubriques, les liens du cahier des charges, les adresses `#/…` d'avant", () => {
    expect(RUBRIQUES_MENU.map((r) => [r.titre, r.liens.map((l) => l.texte)])).toEqual([
      ["Aujourd'hui", ["Tableau de bord", "Jeux"]],
      ["Communauté", ["Joueurs", "Groupes", "Images", "Retours"]],
      ["Diffusion", ["Nouveautés", "Message en direct"]],
      ["Suivi", ["Journal", "Outils de Track", "Outils de Jump"]],
    ]);
    const adresses = Object.fromEntries(RUBRIQUES_MENU.flatMap((r) => r.liens.map((l) => [l.cle, l.href])));
    expect(adresses).toEqual({
      tableau: "#/tableau",
      jeux: "#/jeux",
      joueurs: "#/joueurs",
      groupes: "#/groupes",
      images: "#/images",
      retours: "#/retours",
      nouveautes: "#/nouveautes",
      message: "#/message",
      journal: "#/journal",
      track: "../track/admin/",
      jump: "../jump/admin/",
    });
  });

  it("les compteurs : images, retours, lignes à rédiger ; le total d'une rubrique est le badge de son onglet", () => {
    const c = { images: 3, retours: 2, nouveautes: 5 };
    const [aujourdhui, communaute, diffusion, suivi] = RUBRIQUES_MENU;
    expect([totalRubrique(aujourdhui!, c), totalRubrique(communaute!, c), totalRubrique(diffusion!, c), totalRubrique(suivi!, c)]).toEqual([0, 5, 5, 0]);
    expect(totalRubrique(communaute!, { images: null, retours: null, nouveautes: null })).toBe(0); // pas encore lus : rien
  });

  it("une vue éclaire son entrée : la fiche d'un joueur « Joueurs », un retour « Retours », un groupe « Groupes »", () => {
    expect(["fiche", "retour", "groupe", "jeux"].map(cleMenuDeVue)).toEqual(["joueurs", "retours", "groupes", "jeux"]);
    expect(rubriqueDuLien("retours")?.id).toBe("communaute");
    expect(rubriqueDuLien("inconnue")).toBeNull();
  });
});
