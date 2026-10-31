import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openLibsql } from "../src/libsql-open";
import { REFERENCE, REFERENCE_AUJOURDHUI, construireBaseDeReference } from "../scripts/baseDeReference";
import { mesurerRoutes, type MesureRoute } from "../scripts/routesChaudes";
import { TEST_DB } from "./helpers";

// Lot R14 — le garde-fou des lignes lues. Turso facture les lignes **parcourues**, pas les lignes rendues, et le quota du mois est commun à toutes les bases : une route chaude qui se met à
// parcourir une table fait grimper la facture à chaque appel. Les routes les plus appelées sont mesurées sur la base de référence (300 joueurs, 14 jours de parties dans chaque jeu ;
// `scripts/baseDeReference.ts`) avec une base libSQL **locale** comptée (`src/comptage.ts`) ; un dépassement des plafonds ci-dessous fait échouer la CI.
//
// Les plafonds (lues = lignes parcourues + lignes rendues, mesure à froid : une instance neuve, le cas fréquent avec `min-instances=0`). Mesurés le 29/10/2026 :
//   - lectures « d'un joueur » (classement Track, profil, lecture regroupée de Jump, message en direct) : 1 à 24 lignes → plafond **100** : leur coût ne dépend ni du nombre de joueurs ni du
//     nombre de jours (index `results_by_time`, `results_by_player`, clés primaires) ; passer à 100, c'est qu'une requête a perdu son index.
//   - routes qui calculent le classement du jour du portail (visiteur sans joueur : 3 ; avec joueur et classement : ≈ 450) : le calcul lit les 1,9 lignes par joueur du jour, **une fois par
//     fenêtre de 45 s et par instance** (lot I3) → plafond **= 2 lignes par résultat du jour de la référence (333) + 100 = 770** ; au-delà, il se met à lire autre chose que le jour.
//   - envois (Track, Jump) : 8 et 20 lignes → plafond **100**.
//   - dans tous les cas : **au plus 10 lignes parcourues sans index** (un `SCAN`), au plus **30 instructions** (chaque instruction est un aller-retour réseau vers Turso).
const PLAFOND_LECTURE = 100;
const PLAFOND_CLASSEMENT_JOUR = 770;
const PLAFOND_PARCOURUES = 10;
const PLAFOND_INSTRUCTIONS = 30;
const CLASSEMENT = new Set(["portail jour (joueur)", "portail classement (cumul)"]);

// La mesure ouvre sa propre base libSQL locale : la faire une fois suffit (le projet « libsql » rejouerait la même chose).
describe.skipIf(TEST_DB === "libsql")("routes chaudes : lignes lues sur la base de référence", () => {
  let mesures: MesureRoute[] = [];
  let dossier = "";
  beforeAll(async () => {
    dossier = mkdtempSync(join(tmpdir(), "cdj-chaudes-"));
    const db = await openLibsql({ url: `file:${join(dossier, "reference.db")}`, comptage: true });
    await construireBaseDeReference(db, REFERENCE_AUJOURDHUI);
    mesures = await mesurerRoutes(db, db.compte, REFERENCE_AUJOURDHUI);
    db.close();
  }, 180_000);
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));

  it("toutes les routes répondent 200", () => {
    expect(mesures.map((m) => [m.route, m.statut])).toEqual(mesures.map((m) => [m.route, 200]));
    expect(mesures.length).toBeGreaterThanOrEqual(12);
  });

  it("aucune route chaude ne parcourt une table ni ne dépasse son plafond de lignes lues", () => {
    expect(REFERENCE.joueurs).toBe(300); // les plafonds sont écrits pour cette référence
    for (const m of mesures) {
      for (const [quand, x] of [["à froid", m.froid], ["à chaud", m.chaud]] as const) {
        if (!x) continue;
        const plafond = CLASSEMENT.has(m.route) ? PLAFOND_CLASSEMENT_JOUR : PLAFOND_LECTURE;
        expect(x.lues, `${m.route} ${quand} : lignes lues`).toBeLessThanOrEqual(plafond);
        expect(x.parcourues, `${m.route} ${quand} : lignes parcourues sans index`).toBeLessThanOrEqual(PLAFOND_PARCOURUES);
        expect(x.instructions, `${m.route} ${quand} : instructions`).toBeLessThanOrEqual(PLAFOND_INSTRUCTIONS);
      }
    }
  });

  it("une instance qui a déjà calculé le classement n'y relit rien (à chaud)", () => {
    const classement = mesures.find((m) => m.route === "portail classement (cumul)")!;
    expect(classement.chaud!.lues).toBe(0);
  });
});
