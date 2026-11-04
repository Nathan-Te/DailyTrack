import { describe, expect, it } from "vitest";
import { createApi } from "../src/api";
import { creerMesures } from "../src/mesures";
import type { Logger } from "../src/log";
import { NOON, openTestDb } from "./helpers";

// Lot D3 (C8 et C2) : les mesures du serveur. Des seuils courts (la sentinelle à 10 ms, un « blocage » à 80 ms) pour que le test tienne en une seconde ; la logique est celle de la production.

type Ligne = { severity: string; message: string; fields: Record<string, unknown> };
function journal(): { log: Logger; lignes: Ligne[] } {
  const lignes: Ligne[] = [];
  return { lignes, log: (severity, message, fields = {}) => void lignes.push({ severity, message, fields }) };
}
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const occuper = (ms: number) => {
  const fin = performance.now() + ms;
  while (performance.now() < fin) {
    /* le fil principal est occupé : c'est ce qu'on veut mesurer */
  }
};

describe("mesures (lot D3)", () => {
  it("écrit une ligne « blocage » avec ce qui tournait, le processeur et le type « calcul »", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 10, seuilBlocageMs: 80, releveMs: 3_600_000 });
    m.demarrer();
    try {
      await attendre(40); // la sentinelle a un premier passage
      const en = m.suivre("/api/jump/submit", async () => {
        await attendre(30);
        occuper(200); // un calcul de 200 ms dans le fil principal, pendant une requête
        await attendre(30);
      });
      await en;
      await attendre(30);
    } finally {
      m.arreter();
    }
    const b = lignes.filter((l) => l.message === "blocage de la boucle d'événements");
    expect(b.length).toBeGreaterThanOrEqual(1);
    expect(b[0]!.fields.retardMs as number).toBeGreaterThanOrEqual(150);
    expect(b[0]!.fields.type).toBe("calcul");
    expect(b[0]!.fields.enRequete).toBe(true);
    expect(b[0]!.fields.routes).toContain("/api/jump/submit");
    expect(m.instantane().retardMax24hMs).toBeGreaterThanOrEqual(150);
    expect(m.instantane().blocages24h).toBeGreaterThanOrEqual(1);
  });

  it("un retard sans processeur consommé est une « attente » (processus gelé ou hôte lent), pas un calcul", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 10, seuilBlocageMs: 80, releveMs: 3_600_000 });
    m.demarrer();
    try {
      await attendre(40);
      await m.suivre("/api/portail/jour", async () => {
        await attendre(20);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200); // le fil dort 200 ms sans consommer de processeur (comme un conteneur gelé)
        await attendre(30);
      });
      await attendre(30);
    } finally {
      m.arreter();
    }
    const b = lignes.filter((l) => l.message === "blocage de la boucle d'événements");
    expect(b.length).toBeGreaterThanOrEqual(1);
    expect(b[0]!.fields.type).toBe("attente");
    expect(b[0]!.fields.cpuMs as number).toBeLessThan(60);
  });

  it("n'écrit rien quand la boucle respire, et borne le nombre de lignes par minute", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 5, seuilBlocageMs: 20, releveMs: 3_600_000 });
    m.demarrer();
    try {
      await attendre(30);
      for (let i = 0; i < 15; i++) {
        occuper(40);
        await attendre(10);
      }
    } finally {
      m.arreter();
    }
    const b = lignes.filter((l) => l.message === "blocage de la boucle d'événements");
    expect(b.length).toBeGreaterThan(0);
    expect(b.length).toBeLessThanOrEqual(10);
  });

  it("le relevé de la minute donne p50, p99, max, requêtes et mémoire — et rien quand l'instance n'a rien servi", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 10, releveMs: 60 });
    m.demarrer();
    try {
      await attendre(100); // pas de requête : pas de relevé
      expect(lignes.filter((l) => l.message === "boucle d'événements")).toHaveLength(0);
      await m.suivre("/api/portail/jour", async () => attendre(5));
      await attendre(100);
    } finally {
      m.arreter();
    }
    const r = lignes.find((l) => l.message === "boucle d'événements");
    expect(r).toBeDefined();
    for (const k of ["fenetreMs", "p50Ms", "p99Ms", "maxMs", "maxEnRequeteMs", "requetes", "enCoursMax", "gcN", "gcMs", "gcMaxMs", "rssMo", "tasMo", "externeMo"]) expect(r!.fields).toHaveProperty(k);
    expect(r!.fields.requetes).toBe(1);
  });

  it("un envoi de plus de 3 s écrit ses étapes (lecture, contrôles, rejeu, écriture, SQL), un envoi rapide rien", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 50, seuilEnvoiMs: 60, releveMs: 3_600_000 });
    const db = openTestDb;
    const base = await db();
    const enveloppee = m.envelopper(base);
    await m.suivre("/api/tower/submit", async () => {
      await attendre(20); // lecture
      m.marquer("controles");
      await attendre(20);
      m.marquer("rejeu");
      await attendre(40);
      await enveloppee.run("CREATE TABLE IF NOT EXISTS essai_mesures (a INTEGER)"); // la première écriture après le rejeu ouvre l'étape « écriture »
      await attendre(10);
    });
    await m.suivre("/api/tower/submit", async () => attendre(5));
    const l = lignes.filter((x) => x.message === "envoi lent");
    expect(l).toHaveLength(1);
    const f = l[0]!.fields;
    expect(f.route).toBe("/api/tower/submit");
    expect(f.totalMs as number).toBeGreaterThanOrEqual(80);
    expect(f.lectureMs as number).toBeGreaterThanOrEqual(15);
    expect(f.controlesMs as number).toBeGreaterThanOrEqual(15);
    expect(f.rejeuMs as number).toBeGreaterThanOrEqual(35);
    expect(f.ecritureMs as number).toBeGreaterThanOrEqual(8);
    expect(f.sqlN).toBe(1);
    // Les étapes ne reculent jamais.
    await m.suivre("/api/tower/submit", async () => {
      m.marquer("rejeu");
      m.marquer("controles");
      await attendre(70);
    });
    const dernier = lignes.filter((x) => x.message === "envoi lent").at(-1)!.fields;
    expect(dernier.controlesMs).toBe(0);
    base.close();
  });

  it("aucun identifiant, pseudo, adresse ni corps dans les lignes (route sans date ni identifiant)", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 10, seuilBlocageMs: 50, seuilEnvoiMs: 10, releveMs: 40 });
    m.demarrer();
    const db = await openTestDb();
    const api = createApi({ db, now: () => NOON, mesures: m, log, allowCopies: true });
    const ID = "ab".repeat(16);
    try {
      const res = await api.handle(new Request(`http://api.test/api/jump/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": ID }, body: JSON.stringify({ name: "PseudoSecret", replay: "R" }) }), { clientKey: "203.0.113.9" });
      expect(res.status).toBeGreaterThanOrEqual(400); // refusé : peu importe, seule la forme des lignes compte
      await attendre(120);
    } finally {
      m.arreter();
      db.close();
    }
    const texte = JSON.stringify(lignes);
    expect(texte).not.toContain(ID);
    expect(texte).not.toContain("PseudoSecret");
    expect(texte).not.toContain("203.0.113.9");
  });
});
