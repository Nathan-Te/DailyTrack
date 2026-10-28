import { describe, expect, it } from "vitest";
import { traducteur } from "@cdj/ui";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "../src/catalogue";
import { EMOJIS, lienDuPortail, lignePartage, morceauDeJeu, textePartage, type JeuPartage, type OptionsPartage, type StatutPartage } from "../src/partage";
import { construireOptions } from "../src/partageDuJour";
import type { Etat, Jour } from "../src/jour";

// Lot I3 : la ligne de partage de la journée — pour chaque combinaison de statuts (pas joué, en cours, fini avec chaque médaille, fini sans médaille),
// avec et sans série, journée parfaite, avant et après le 23/10, en français et en anglais. Les émojis sont ceux des jeux ; rien d'identifiant.

const LIEN = "https://playdujour.com/";
const fini = (medaille: StatutPartage extends infer S ? (S extends { fini: true; medaille: infer M } ? M : never) : never): StatutPartage => ({ fini: true, medaille });
const pas: StatutPartage = { fini: false };
const jeux = (a: StatutPartage, b: StatutPartage): JeuPartage[] => [
  { nom: "Track", statut: a },
  { nom: "Jump", statut: b },
];
const base = (o: Partial<OptionsPartage>): OptionsPartage => ({ titre: "Du Jour #1", jeux: jeux(pas, pas), serie: 0, parfaite: false, lien: LIEN, ...o });

describe("la ligne de partage de la journée", () => {
  it("la forme du sujet : `Du Jour #1 — Track 🥇 · Jump 🥈 — 🔥 5` puis le lien", () => {
    const o = base({ jeux: jeux(fini("gold"), fini("silver")), serie: 5 });
    expect(lignePartage(o)).toBe("Du Jour #1 — Track 🥇 · Jump 🥈 — 🔥 5");
    expect(textePartage(o)).toBe("Du Jour #1 — Track 🥇 · Jump 🥈 — 🔥 5\nhttps://playdujour.com/");
  });

  it("chaque médaille a son émoji (ceux des jeux) ; fini sans médaille : une coche ; pas fini (pas joué, en cours) : `⬜`", () => {
    expect(EMOJIS).toMatchObject({ author: "💎", gold: "🥇", silver: "🥈", bronze: "🥉" });
    for (const [medaille, emoji] of [["author", "💎"], ["gold", "🥇"], ["silver", "🥈"], ["bronze", "🥉"], [null, "✅"]] as const) {
      expect(morceauDeJeu({ nom: "Track", statut: fini(medaille) })).toBe(`Track ${emoji}`);
    }
    expect(morceauDeJeu({ nom: "Jump", statut: pas })).toBe("Jump ⬜");
  });

  it("toutes les combinaisons de statuts des deux jeux, avec la série (le premier jeu fini : série 1)", () => {
    const statuts: [string, StatutPartage][] = [["pas joué ou en cours", pas], ["auteur", fini("author")], ["or", fini("gold")], ["argent", fini("silver")], ["bronze", fini("bronze")], ["sans médaille", fini(null)]];
    const attendu: Record<string, string> = { "pas joué ou en cours": "⬜", auteur: "💎", or: "🥇", argent: "🥈", bronze: "🥉", "sans médaille": "✅" };
    let n = 0;
    for (const [a, sa] of statuts) {
      for (const [b, sb] of statuts) {
        const morceau = (nom: string, nomStatut: string) => `${nom} ${attendu[nomStatut]}`;
        expect(lignePartage(base({ jeux: jeux(sa, sb), serie: 3 })), `${a} / ${b}`).toBe(`Du Jour #1 — ${morceau("Track", a)} · ${morceau("Jump", b)} — 🔥 3`);
        n++;
      }
    }
    expect(n).toBe(36);
  });

  it("sans série, la partie 🔥 disparaît ; journée parfaite : une étoile après la série", () => {
    expect(lignePartage(base({ jeux: jeux(fini("bronze"), pas), serie: 0 }))).toBe("Du Jour #1 — Track 🥉 · Jump ⬜");
    expect(lignePartage(base({ jeux: jeux(fini("gold"), fini("author")), serie: 12, parfaite: true }))).toBe("Du Jour #1 — Track 🥇 · Jump 💎 — 🔥 12 ⭐");
    expect(lignePartage(base({ jeux: jeux(fini("gold"), fini("author")), serie: 1, parfaite: true }))).toBe("Du Jour #1 — Track 🥇 · Jump 💎 — 🔥 1 ⭐");
  });

  it("un jeu de plus (n° 3) entre dans la ligne sans rien changer", () => {
    const trois = [...jeux(fini("gold"), pas), { nom: "Lune", statut: fini("silver") as StatutPartage }];
    expect(lignePartage(base({ jeux: trois, serie: 2 }))).toBe("Du Jour #1 — Track 🥇 · Jump ⬜ · Lune 🥈 — 🔥 2");
  });

  it("le lien est l'origine courante : la production, la recette, un aperçu", () => {
    expect(lienDuPortail({ origin: "https://playdujour.com" })).toBe("https://playdujour.com/");
    expect(lienDuPortail({ origin: "https://recette.playdujour.com" })).toBe("https://recette.playdujour.com/");
    expect(lienDuPortail({ origin: "https://playdujour-recette--pr-92-ab12cd34.web.app" })).toBe("https://playdujour-recette--pr-92-ab12cd34.web.app/");
  });
});

// --- À partir de la réponse du serveur, en français et en anglais --------------------------------------------------------------------------
const finiEtat = (medaille: Etat extends infer E ? (E extends { statut: "fini"; medaille: infer M } ? M : never) : never): Etat => ({ statut: "fini", tempsMs: 31_402, medaille, rang: 3, classes: 40 });
function jour(journee: number | null, etats: [Etat, Etat], joueur: Partial<NonNullable<Jour["joueur"]>> = {}): Jour {
  const seuils = { author: 1, gold: 2, silver: 3, bronze: 4 };
  return {
    date: "2026-10-23",
    journee,
    maintenant: "2026-10-23T10:00:00.000Z",
    prochainJour: "2026-10-23T22:00:00.000Z",
    jeux: [
      { jeu: "cdj", numero: 11, theme: "nuit", seuils, premierJour: "2026-10-13", etat: etats[0], site: "track", nom: "Track" },
      { jeu: "jump", numero: 8, theme: "usine", seuils, premierJour: "2026-10-16", etat: etats[1], site: "jump", nom: "Jump" },
    ],
    joueur: { pseudo: "Alice", serie: 5, aProlonger: false, journeesParfaites: 1, aujourdhuiParfaite: false, ...joueur },
  };
}
const pasJoue: Etat = { statut: "pas_joue" };
const enCours: Etat = { statut: "en_cours", morts: 12 };

describe("la ligne de partage depuis la réponse du serveur", () => {
  for (const langue of ["fr", "en"] as const) {
    const t = traducteur(langue, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
    const texte = (j: Jour) => {
      const o = construireOptions(t, j, LIEN);
      return o ? textePartage(o) : null;
    };

    it(`(${langue}) après le 23/10 : le numéro de la journée, les médailles, la série`, () => {
      expect(texte(jour(1, [finiEtat("gold"), finiEtat("silver")]))).toBe("Du Jour #1 — Track 🥇 · Jump 🥈 — 🔥 5\nhttps://playdujour.com/");
      expect(texte(jour(42, [finiEtat("author"), enCours], { serie: 17 }))).toBe("Du Jour #42 — Track 💎 · Jump ⬜ — 🔥 17\nhttps://playdujour.com/");
    });

    it(`(${langue}) avant le 23/10 : « Du Jour » sans numéro`, () => {
      expect(texte(jour(null, [finiEtat(null), pasJoue], { serie: 1 }))).toBe("Du Jour — Track ✅ · Jump ⬜ — 🔥 1\nhttps://playdujour.com/");
    });

    it(`(${langue}) journée parfaite : l'étoile ; rien de fini : pas de ligne à partager`, () => {
      expect(texte(jour(3, [finiEtat("bronze"), finiEtat("gold")], { serie: 3, aujourdhuiParfaite: true }))).toBe("Du Jour #3 — Track 🥉 · Jump 🥇 — 🔥 3 ⭐\nhttps://playdujour.com/");
      expect(texte(jour(3, [pasJoue, enCours]))).toBeNull();
    });

    it(`(${langue}) rien d'identifiant : ni le pseudo, ni un identifiant, ni un code`, () => {
      const ligne = texte(jour(1, [finiEtat("gold"), finiEtat("silver")], { pseudo: "Alice-Secrète" }))!;
      expect(ligne).not.toContain("Alice");
      expect(ligne).not.toMatch(/CDJ2|[0-9a-f]{32}/i);
    });
  }

  it("les mots viennent du catalogue de la langue (le titre ; les noms des jeux)", () => {
    const fr = construireOptions(traducteur("fr", CATALOGUE_PORTAIL, CATALOGUE_COMMUN), jour(7, [finiEtat("gold"), pasJoue]), LIEN)!;
    const en = construireOptions(traducteur("en", CATALOGUE_PORTAIL, CATALOGUE_COMMUN), jour(7, [finiEtat("gold"), pasJoue]), LIEN)!;
    expect(fr.titre).toBe("Du Jour #7");
    expect(en.titre).toBe("Du Jour #7");
    expect(fr.jeux.map((j) => j.nom)).toEqual(["Track", "Jump"]);
  });
});
