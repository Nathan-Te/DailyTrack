import { describe, expect, it } from "vitest";
import { MIGRATIONS, SCHEMA } from "../src/db";

// Lot R6 : les migrations de la base sont **en avant seulement et compatibles avec le code d'avant** — le retour arrière (`retour-arriere.yml`) remet l'ancien serveur sur la base que
// le nouveau a déjà migrée (la base n'est jamais restaurée). Donc une migration ne fait que AJOUTER : une colonne que l'ancien code ignore et qui est vide (NULL) ou a une valeur par défaut
// pour ses insertions, un index ordinaire, une table nouvelle. Jamais renommer, supprimer une colonne, réécrire des données, ni poser une contrainte que l'ancien code violerait.
// Ce test refuse toute autre forme ; la preuve par le code d'avant lui-même (l'ancien serveur sur une base migrée, puis `smoke`) est faite par `scripts/base-migree.mjs`, lancé par « Mettre
// en production » et sa répétition. Une exception se justifie ici, par écrit.

/** Tables supprimées par une migration : abandonnées depuis plusieurs mises en production (aucun code en production ne les lit plus). Ajouter une table ici = la justifier. */
const SUPPRESSIONS_PERMISES: Record<string, string> = {
  salon_podiums: "lot 27b : plus aucun code ne la lit depuis la mise en production de ce lot",
};

const AJOUT_DE_COLONNE = /^ALTER TABLE (\w+) ADD COLUMN (\w+) (INTEGER|TEXT|REAL)( NOT NULL DEFAULT -?\w+| DEFAULT -?\w+)?$/;
const INDEX_ORDINAIRE = /^CREATE INDEX IF NOT EXISTS (\w+) ON (\w+) \([\w, ]+\)$/;
const SUPPRESSION = /^DROP TABLE IF EXISTS (\w+)$/;

describe("migrations de la base (lot R6)", () => {
  it("chaque migration est une addition que le code d'avant ignore : colonne vide ou par défaut, index ordinaire, ou suppression d'une table abandonnée", () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (const sql of MIGRATIONS) {
      const flat = sql.replace(/\s+/g, " ").trim();
      const colonne = AJOUT_DE_COLONNE.exec(flat);
      if (colonne) {
        // `NOT NULL` sans valeur par défaut ferait échouer l'insertion de l'ancien code, qui ne connaît pas la colonne.
        expect(/NOT NULL/.test(flat) && !/DEFAULT/.test(flat), `${flat} : NOT NULL sans DEFAULT`).toBe(false);
        continue;
      }
      if (INDEX_ORDINAIRE.test(flat)) continue;
      const suppression = SUPPRESSION.exec(flat);
      if (suppression) {
        expect(SUPPRESSIONS_PERMISES[suppression[1]!], `${flat} : une table supprimée doit être justifiée dans SUPPRESSIONS_PERMISES`).toBeTruthy();
        expect(SCHEMA.join("\n"), `${suppression[1]} est encore dans le schéma`).not.toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${suppression[1]}\\b`));
        continue;
      }
      throw new Error(`migration non permise : « ${flat} » (seulement ADD COLUMN vide ou par défaut, CREATE INDEX ordinaire, DROP TABLE justifié ; voir ce fichier)`);
    }
  });

  it("une colonne ajoutée n'est jamais ajoutée deux fois, et chaque migration est rejouable sans effet (une instance qui redémarre rejoue tout)", () => {
    const colonnes = MIGRATIONS.map((m) => AJOUT_DE_COLONNE.exec(m.replace(/\s+/g, " ").trim())).filter(Boolean).map((m) => `${m![1]}.${m![2]}`);
    expect(new Set(colonnes).size).toBe(colonnes.length);
    for (const sql of MIGRATIONS) expect(/IF NOT EXISTS|IF EXISTS|ADD COLUMN/.test(sql), sql).toBe(true);
  });
});
