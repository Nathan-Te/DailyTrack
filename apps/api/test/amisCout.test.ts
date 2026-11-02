import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openLibsql } from "../src/libsql-open";
import { REFERENCE, construireBaseDeReference } from "../scripts/baseDeReference";
import { AMIS_AUJOURDHUI, NOMBRES_D_AMIS, mesurerAmis, type MesureRouteAmis } from "../scripts/amisCout";
import { TEST_DB } from "./helpers";

// Lot F2 — le garde-fou des lignes lues des amis (règle du lot R14). Turso facture les lignes parcourues et le quota du mois est commun à toutes les bases : les routes des amis sont mesurées pour 0, 10 et
// 100 amis sur la base de référence (300 joueurs, 14 jours de parties dans chaque jeu ; `scripts/amisCout.ts`), base libSQL **locale** comptée (`src/comptage.ts`), jamais Turso.
//
// Plafonds (lues = lignes parcourues + lignes rendues, estimation basse), mesurés le 02/11/2026 :
//   - routes des amis seules (liste, suggestions, ajout, lien) : 2 à 102 lignes à froid → plafond **150** ; elles ne lisent que la liste du joueur (une lecture par ami : clé primaire de `amities`).
//   - classements filtrés et « 3e entre amis » : le classement du jour est celui que le portail garde déjà (calculé une fois par fenêtre et par instance, comme « Tous » : ≈ 600 lues à froid pour la
//     référence) + une ligne par ami à froid comme à chaud ; Jump lit en plus les morts des seuls amis. Plafond à froid **770 + 2 lignes par ami** ; à chaud **30 + 2 lignes par ami**.
//   - dans tous les cas : au plus 10 lignes parcourues sans index (un `SCAN`) et 30 instructions.
const SEULES = new Set(["GET /api/amis", "suggestions (q=pil)", "ajouter un ami", "créer un lien d'invitation"]);

describe.skipIf(TEST_DB === "libsql")("amis : lignes lues pour 0, 10 et 100 amis", () => {
  const mesures = new Map<number, MesureRouteAmis[]>();
  let dossier = "";
  beforeAll(async () => {
    dossier = mkdtempSync(join(tmpdir(), "cdj-amis-cout-"));
    const db = await openLibsql({ url: `file:${join(dossier, "reference.db")}`, comptage: true });
    await construireBaseDeReference(db, AMIS_AUJOURDHUI);
    for (const n of NOMBRES_D_AMIS) mesures.set(n, await mesurerAmis(db, db.compte, AMIS_AUJOURDHUI, n));
    db.close();
  }, 240_000);
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));

  it("toutes les routes répondent 200", () => {
    expect(REFERENCE.joueurs).toBe(300); // les plafonds sont écrits pour cette référence
    for (const [n, liste] of mesures) expect(liste.map((m) => [`${n} amis · ${m.route}`, m.statut])).toEqual(liste.map((m) => [`${n} amis · ${m.route}`, 200]));
    expect(mesures.get(100)!.length).toBeGreaterThanOrEqual(12);
  });

  it("aucune route des amis ne parcourt une table ni ne dépasse son plafond de lignes lues", () => {
    for (const [n, liste] of mesures) {
      for (const m of liste) {
        const seule = SEULES.has(m.route);
        for (const [quand, x] of [["à froid", m.froid], ["à chaud", m.chaud]] as const) {
          if (!x) continue;
          const plafond = seule ? 150 : quand === "à froid" ? 770 + 2 * n : 30 + 2 * n;
          expect(x.lues, `${n} amis · ${m.route} ${quand} : lignes lues`).toBeLessThanOrEqual(plafond);
          expect(x.parcourues, `${n} amis · ${m.route} ${quand} : lignes parcourues sans index`).toBeLessThanOrEqual(10);
          expect(x.instructions, `${n} amis · ${m.route} ${quand} : instructions`).toBeLessThanOrEqual(30);
        }
      }
    }
  });

  it("aucune requête par ami : à chaud, le nombre d'instructions d'un classement filtré ne dépend pas du nombre d'amis", () => {
    for (const nom of ["portail classement cumul, filtre=amis", "Track classement, filtre=amis", "Jump classement, filtre=amis", "Tower classement, filtre=amis", "portail jour (joueur, avec amis)"]) {
      const parAmis = NOMBRES_D_AMIS.map((n) => mesures.get(n)!.find((m) => m.route === nom)!.chaud!.instructions);
      expect(new Set(parAmis).size, `${nom} : ${parAmis.join(" / ")} instructions pour 0 / 10 / 100 amis`).toBe(1);
    }
  });
});
