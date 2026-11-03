import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { ADAPTATEUR_TOWER } from "../src/tower";
import { FICHES_SERVEUR } from "../src/fiches.generated";
import { type AdaptateurTable, sqlDe, verifierAdaptateur, versFiche, versTable } from "../src/jeux/index";

// Lot K2 — le module des jeux : l'adaptateur de table fabrique les requêtes du classement. Deux preuves : (1) pour Tower, le texte est celui que `tower.ts` écrivait à la main (le plan des requêtes et les lignes
// lues ne changent pas) ; (2) un **autre adaptateur** — une table partagée, des clés normalisées en croissant (`signe: -1`), comme sera `resultats_jeu` au lot K4 — passe par le même constructeur et se classe
// correctement sur une vraie base (sans créer cette table dans le schéma : la table de ce test n'existe que dans ce fichier).

const tower = FICHES_SERVEUR.find((f) => f.code === "tower")!;

describe("l'adaptateur de Tower", () => {
  it("dit le classement de la fiche (hauteur ↓, vies ↓, ticks ↑, envoi ↑, identifiant ↑)", () => {
    expect(() => verifierAdaptateur(tower.classement.colonnes, ADAPTATEUR_TOWER)).not.toThrow();
    expect(() => verifierAdaptateur([...tower.classement.colonnes].reverse(), ADAPTATEUR_TOWER)).toThrow(/ne dit pas le classement/);
    expect(() => verifierAdaptateur(tower.classement.colonnes, { ...ADAPTATEUR_TOWER, colonnes: [{ ...ADAPTATEUR_TOWER.colonnes[0]!, sens: "asc" }, ...ADAPTATEUR_TOWER.colonnes.slice(1)] })).toThrow();
  });

  it("fabrique les requêtes que Tower écrivait à la main", () => {
    const s = sqlDe(ADAPTATEUR_TOWER);
    expect(s.rang).toBe(
      "SELECT (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm > ?)" +
        " + (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm = ? AND vies > ?)" +
        " + (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm = ? AND vies = ? AND ticks < ?)" +
        " + (SELECT COUNT(*) FROM tower_results WHERE day = ? AND hidden = 0 AND hauteur_mm = ? AND vies = ? AND ticks = ? AND (submitted_at < ? OR (submitted_at = ? AND player_id < ?))) AS n",
    );
    expect(s.parametresRang(7, { hauteur_mm: 10, vies: 2, ticks: 300 }, 99, "x")).toEqual([7, 10, 7, 10, 2, 7, 10, 2, 300, 7, 10, 2, 300, 99, 99, "x"]);
    expect(s.top).toBe(
      "SELECT r.hauteur_mm AS hauteur_mm, r.vies AS vies, r.ticks AS ticks, r.medal AS medal, p.name AS name, p.ref AS ref FROM tower_results r JOIN players p ON p.id = r.player_id WHERE r.day = ? AND r.hidden = 0 ORDER BY r.hauteur_mm DESC, r.vies DESC, r.ticks ASC, r.submitted_at ASC, r.player_id ASC LIMIT ?",
    );
    expect(s.classes).toBe("SELECT player_id, hauteur_mm, vies, ticks, medal, submitted_at FROM tower_results WHERE day = ? AND hidden = 0 ORDER BY hauteur_mm DESC, vies DESC, ticks ASC, submitted_at ASC, player_id ASC");
    expect(s.colonnesInsert).toEqual(ADAPTATEUR_TOWER.colonnesEcrites);
    expect(s.insertion).toContain("ON CONFLICT (day, player_id) DO UPDATE SET tirage = excluded.tirage, hauteur_mm = excluded.hauteur_mm, hauteur_max_mm = excluded.hauteur_max_mm, vies = excluded.vies, ticks = excluded.ticks,");
    expect(s.insertion).toContain("WHERE tower_results.apercu = excluded.apercu AND (excluded.hauteur_mm > tower_results.hauteur_mm OR (excluded.hauteur_mm = tower_results.hauteur_mm AND (excluded.vies > tower_results.vies OR (excluded.vies = tower_results.vies AND (excluded.ticks < tower_results.ticks)))))");
    const remplace = /DO UPDATE SET (.*)\n/.exec(s.insertion)![1]!; // ce qu'une meilleure partie remplace : ni le premier envoi, ni le masquage, ni l'aperçu
    expect(remplace).not.toMatch(/first_at|hidden|apercu/);
  });
});

describe("un autre adaptateur : une table partagée, des clés en croissant (la forme de `resultats_jeu`)", () => {
  // Un jeu de points (le plus grand d'abord) puis de ticks (le plus court d'abord) : la table range `-points` en croissant.
  const A: AdaptateurTable = {
    table: "resultats_essai",
    filtreJeu: { colonne: "jeu", valeur: "cibles" },
    colonnes: [
      { nom: "points", colonne: "cle1", sens: "asc", signe: -1 },
      { nom: "ticks", colonne: "cle2", sens: "asc" },
    ],
    colonnesEcrites: ["cle1", "cle2", "medal", "replay", "first_at", "submitted_at", "inputs_hash", "hidden", "apercu"],
    colonnesGardees: ["first_at", "hidden", "apercu"],
    niveaux: { table: "niveaux_essai", colonnes: [] },
  };
  const ficheEssai = [
    { nom: "points", sens: "desc" as const },
    { nom: "ticks", sens: "asc" as const },
    { nom: "submitted_at", sens: "asc" as const },
    { nom: "player_id", sens: "asc" as const },
  ];

  function base(): DatabaseSync {
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE resultats_essai (jeu TEXT NOT NULL, day INTEGER NOT NULL, player_id TEXT NOT NULL, cle1 INTEGER NOT NULL, cle2 INTEGER NOT NULL, medal TEXT, replay TEXT,
      first_at INTEGER, submitted_at INTEGER NOT NULL, inputs_hash TEXT, hidden INTEGER NOT NULL DEFAULT 0, apercu INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jeu, day, player_id))`);
    db.exec("CREATE INDEX essai_par_rang ON resultats_essai (jeu, day, hidden, cle1, cle2, submitted_at, player_id)");
    return db;
  }
  const s = sqlDe(A);
  function envoyer(db: DatabaseSync, id: string, points: number, ticks: number, at: number): void {
    const v = versTable(A, { points, ticks }, {});
    const valeurs: Record<string, unknown> = { ...v, medal: null, replay: "x", first_at: at, submitted_at: at, inputs_hash: id, hidden: 0, apercu: 0 };
    db.prepare(s.insertion).run(1, id, ...s.colonnesInsert.map((c) => valeurs[c] as never));
  }

  it("dit le classement de la fiche malgré le signe de la table", () => {
    expect(() => verifierAdaptateur(ficheEssai, A)).not.toThrow();
    expect(() => verifierAdaptateur(ficheEssai.map((c) => (c.nom === "points" ? { ...c, sens: "asc" as const } : c)), A)).toThrow();
  });

  it("classe : le rang par l'index, le haut du classement, le remplacement par une meilleure partie seulement", () => {
    const db = base();
    envoyer(db, "a", 12, 500, 1);
    envoyer(db, "b", 30, 900, 2);
    envoyer(db, "c", 30, 800, 3);
    envoyer(db, "d", 5, 100, 4);
    const rang = (points: number, ticks: number, at: number, id: string) => (db.prepare(s.rang).get(...s.parametresRang(1, { points, ticks }, at, id) as never[]) as { n: number }).n + 1;
    expect([rang(30, 800, 3, "c"), rang(30, 900, 2, "b"), rang(12, 500, 1, "a"), rang(5, 100, 4, "d")]).toEqual([1, 2, 3, 4]);
    // Même points et mêmes ticks : le premier envoyé passe devant.
    envoyer(db, "e", 30, 800, 9);
    expect(rang(30, 800, 9, "e")).toBe(2);
    const top = db.prepare(s.top.replace("p.name AS name, p.ref AS ref FROM resultats_essai r JOIN players p ON p.id = r.player_id", "r.player_id AS name, NULL AS ref FROM resultats_essai r")).all(1, 10) as Record<string, unknown>[];
    expect(top.map((r) => r.name)).toEqual(["c", "e", "b", "a", "d"]);
    expect(versFiche(A, top[0]! as never)).toMatchObject({ points: 30, ticks: 800 }); // le signe de la table s'annule à la lecture
    // Une moins bonne partie ne remplace rien ; une meilleure (plus de points) oui.
    envoyer(db, "b", 10, 100, 20);
    expect((db.prepare("SELECT cle1 FROM resultats_essai WHERE player_id = 'b'").get() as { cle1: number }).cle1).toBe(-30);
    envoyer(db, "b", 40, 999, 21);
    expect((db.prepare("SELECT cle1, first_at, submitted_at FROM resultats_essai WHERE player_id = 'b'").get() as Record<string, number>)).toEqual({ cle1: -40, first_at: 2, submitted_at: 21 });
    // À points égaux, moins de ticks : meilleur.
    envoyer(db, "b", 40, 998, 22);
    expect((db.prepare("SELECT cle2 FROM resultats_essai WHERE player_id = 'b'").get() as { cle2: number }).cle2).toBe(998);
  });

  it("la portée d'une table partagée est dans chaque requête (un autre jeu n'y entre jamais)", () => {
    for (const texte of [s.rang, s.top, s.participants, s.classes, s.etat, s.profil, s.moiProfil, s.copie, s.masquer, s.effacer, s.viderApercu]) expect(texte).toContain("jeu = 'cibles' AND");
    expect(s.insertion).toContain("INSERT INTO resultats_essai (jeu, day, player_id,");
    expect(s.insertion).toContain("ON CONFLICT (jeu, day, player_id)");
  });
});
