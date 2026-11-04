import { describe, expect, it } from "vitest";
import { createApi } from "../src/api";
import { analyserPassage, cpuDuFil, creerMesures, typeDeBlocage } from "../src/mesures";
import type { Logger } from "../src/log";
import { NOON, openTestDb } from "./helpers";

// Lot D3 (C8 et C2) : les mesures du serveur. Lot D3b : **aucun test ne dépend de la vitesse ni de la charge de la machine** — la décision (« calcul » ou « attente ») est une fonction pure testée sur des valeurs injectées, la sentinelle est
// pilotée à la main avec une horloge et un processeur injectés (`horloge`, `cpu`, `passage`, `releve`), et le seul vrai blocage (dernier test du « réel ») ne vérifie que ce qu'une machine lente ne peut pas changer. Un vrai chronométrage est un outil.

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
/** Une horloge et un processeur que le test fait avancer à la main (ms et µs) : aucune durée réelle. */
function fausseMachine(depart = 1000) {
  const m = { t: depart, cpuUs: 0 };
  return {
    m,
    horloge: () => m.t,
    cpu: () => m.cpuUs,
    /** Le temps passe de `ms` ; le fil a consommé `cpuMs` de processeur pendant ce temps. */
    avancer: (ms: number, cpuMs = 0) => {
      m.t += ms;
      m.cpuUs += cpuMs * 1000;
    },
  };
}
const BLOCAGE = "blocage de la boucle d'événements";

describe("la décision : calcul ou attente (valeurs injectées)", () => {
  it("« calcul » quand le processeur consommé couvre l'essentiel de l'écart, « attente » sinon", () => {
    expect(typeDeBlocage(950, 1000)).toBe("calcul"); // le fil était occupé presque tout l'écart
    expect(typeDeBlocage(5, 1000)).toBe("attente"); // il dormait (conteneur gelé, hôte lent)
    expect(typeDeBlocage(0, 1000)).toBe("attente");
  });

  it("cas limites : la moitié exacte de l'écart est un calcul, un cheveu en dessous une attente ; un écart nul est un calcul sans processeur", () => {
    expect(typeDeBlocage(500, 1000)).toBe("calcul");
    expect(typeDeBlocage(499.9, 1000)).toBe("attente");
    expect(typeDeBlocage(0, 0)).toBe("calcul"); // 0 >= 0 : sans écart il n'y a rien à classer, la sentinelle n'écrit alors aucune ligne (le retard est nul)
    expect(typeDeBlocage(2000, 1000)).toBe("calcul"); // un processeur qui dépasse l'écart (mesure arrondie) reste un calcul
  });

  it("analyserPassage déduit le retard (écart moins le pas), le processeur en ms et le type, sans lire aucune horloge", () => {
    // un passage normal : écart = pas, aucun retard
    expect(analyserPassage({ maintenant: 1100, dernier: 1000, pasMs: 100, cpu: 3000, dernierCpu: 2000 })).toEqual({ retardMs: 0, ecartMs: 100, cpuMs: 1, type: "attente" });
    // un blocage de calcul : 1 500 ms d'écart, 1 400 ms de processeur
    expect(analyserPassage({ maintenant: 2500, dernier: 1000, pasMs: 100, cpu: 1_400_000, dernierCpu: 0 })).toEqual({ retardMs: 1400, ecartMs: 1500, cpuMs: 1400, type: "calcul" });
    // une attente : 1 500 ms d'écart, 20 ms de processeur
    expect(analyserPassage({ maintenant: 2500, dernier: 1000, pasMs: 100, cpu: 20_000, dernierCpu: 0 })).toMatchObject({ retardMs: 1400, cpuMs: 20, type: "attente" });
    // une horloge qui recule ne donne jamais un retard négatif
    expect(analyserPassage({ maintenant: 900, dernier: 1000, pasMs: 100, cpu: 0, dernierCpu: 0 }).retardMs).toBe(0);
  });

  it("cpuDuFil lit le fil principal quand threadCpuUsage existe, et se replie sur le processus sinon", () => {
    const avec = { threadCpuUsage: () => ({ user: 7, system: 3 }), cpuUsage: () => ({ user: 1000, system: 1000 }) };
    expect(cpuDuFil(avec)).toBe(10);
    const sans = { cpuUsage: () => ({ user: 1000, system: 500 }) };
    expect(cpuDuFil(sans)).toBe(1500);
  });
});

describe("mesures (lot D3) — la sentinelle pilotée par une horloge injectée", () => {
  /** Une requête ouverte sur deux passages de la sentinelle, puis un écart de `ecartMs` avec `cpuMs` de processeur. */
  async function blocage(ecartMs: number, cpuMs: number, seuil = 1000) {
    const { log, lignes } = journal();
    const f = fausseMachine();
    const m = creerMesures({ log, pasMs: 100, seuilBlocageMs: seuil, releveMs: 3_600_000, horloge: f.horloge, cpu: f.cpu });
    let finir!: () => void;
    const requete = m.suivre("/api/jump/submit", () => new Promise<void>((r) => (finir = r)));
    f.avancer(100, 1);
    m.passage(); // premier passage avec la requête en cours
    f.avancer(ecartMs, cpuMs);
    m.passage(); // le blocage
    finir();
    await requete;
    return { m, lignes: lignes.filter((l) => l.message === BLOCAGE) };
  }

  it("un blocage de calcul écrit une ligne « calcul » avec le retard, le processeur, la requête en cours et la route", async () => {
    const { m, lignes } = await blocage(1500, 1450);
    expect(lignes).toHaveLength(1);
    const f = lignes[0]!.fields;
    expect(f.type).toBe("calcul");
    expect(f.retardMs).toBe(1400);
    expect(f.cpuMs).toBe(1450);
    expect(f.enRequete).toBe(true);
    expect(f.enCours).toBe(1);
    expect(f.routes).toContain("/api/jump/submit");
    expect(m.instantane().retardMax24hMs).toBe(1400);
    expect(m.instantane().blocages24h).toBe(1);
  });

  it("un retard sans processeur consommé est une « attente » (processus gelé ou hôte lent), pas un calcul", async () => {
    const { lignes } = await blocage(1500, 10);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.fields.type).toBe("attente");
    expect(lignes[0]!.fields.cpuMs).toBe(10);
    expect(lignes[0]!.fields.enRequete).toBe(true);
  });

  it("le seuil : un retard juste en dessous n'écrit rien, un retard égal au seuil écrit une ligne", async () => {
    expect((await blocage(1099, 1099)).lignes).toHaveLength(0); // retard 999 < 1 000
    expect((await blocage(1100, 1100)).lignes).toHaveLength(1); // retard 1 000 = seuil
  });

  it("une boucle qui respire n'écrit rien, et le nombre de lignes par minute est borné à 10", () => {
    const { log, lignes } = journal();
    const f = fausseMachine();
    const m = creerMesures({ log, pasMs: 100, seuilBlocageMs: 1000, releveMs: 3_600_000, horloge: f.horloge, cpu: f.cpu });
    for (let i = 0; i < 20; i++) {
      f.avancer(100, 1);
      m.passage();
    }
    expect(lignes.filter((l) => l.message === BLOCAGE)).toHaveLength(0);
    for (let i = 0; i < 15; i++) {
      f.avancer(1500, 1500);
      m.passage();
    }
    expect(lignes.filter((l) => l.message === BLOCAGE)).toHaveLength(10);
    m.releve(); // une nouvelle minute : le compte repart
    f.avancer(1500, 1500);
    m.passage();
    expect(lignes.filter((l) => l.message === BLOCAGE)).toHaveLength(11);
  });

  it("hors requête, un blocage n'est pas « en requête » et ne compte pas dans le retard vu pendant une requête", () => {
    const { log, lignes } = journal();
    const f = fausseMachine();
    const m = creerMesures({ log, pasMs: 100, seuilBlocageMs: 1000, releveMs: 3_600_000, horloge: f.horloge, cpu: f.cpu });
    f.avancer(2000, 5);
    m.passage();
    const b = lignes.filter((l) => l.message === BLOCAGE);
    expect(b).toHaveLength(1);
    expect(b[0]!.fields.enRequete).toBe(false);
    expect(b[0]!.fields.type).toBe("attente");
    expect(m.instantane().retardMax24hMs).toBe(0);
  });

  it("le relevé de la minute donne p50, p99, max, requêtes et mémoire — et rien quand l'instance n'a rien servi", async () => {
    const { log, lignes } = journal();
    const f = fausseMachine();
    const m = creerMesures({ log, horloge: f.horloge, cpu: f.cpu, releveMs: 3_600_000 });
    m.releve(); // pas de requête : pas de relevé
    expect(lignes.filter((l) => l.message === "boucle d'événements")).toHaveLength(0);
    await m.suivre("/api/portail/jour", async () => undefined);
    m.releve();
    const r = lignes.find((l) => l.message === "boucle d'événements");
    expect(r).toBeDefined();
    for (const k of ["fenetreMs", "p50Ms", "p99Ms", "maxMs", "maxEnRequeteMs", "requetes", "enCoursMax", "gcN", "gcMs", "gcMaxMs", "rssMo", "tasMo", "externeMo"]) expect(r!.fields).toHaveProperty(k);
    expect(r!.fields.requetes).toBe(1);
    m.releve(); // la minute suivante n'a rien servi : rien d'écrit
    expect(lignes.filter((l) => l.message === "boucle d'événements")).toHaveLength(1);
  });

  it("un envoi de plus de 3 s écrit ses étapes (lecture, contrôles, rejeu, écriture, SQL), un envoi rapide rien", async () => {
    const { log, lignes } = journal();
    const f = fausseMachine();
    const m = creerMesures({ log, seuilEnvoiMs: 3000, releveMs: 3_600_000, horloge: f.horloge, cpu: f.cpu });
    const base = await openTestDb();
    // La base chronométrée : l'horloge injectée avance de 7 ms pendant l'instruction SQL.
    const enveloppee = m.envelopper({ ...base, run: async (sql, params) => (f.avancer(7), base.run(sql, params)), first: base.first.bind(base), all: base.all.bind(base) });
    await m.suivre("/api/tower/submit", async () => {
      f.avancer(200); // lecture
      m.marquer("controles");
      f.avancer(300);
      m.marquer("rejeu");
      f.avancer(2500);
      await enveloppee.run("CREATE TABLE IF NOT EXISTS essai_mesures (a INTEGER)"); // la première écriture après le rejeu ouvre l'étape « écriture »
      f.avancer(100);
    });
    await m.suivre("/api/tower/submit", async () => f.avancer(5)); // rapide : rien
    const l = lignes.filter((x) => x.message === "envoi lent");
    expect(l).toHaveLength(1);
    const e = l[0]!.fields;
    expect(e).toMatchObject({ route: "/api/tower/submit", totalMs: 3107, lectureMs: 200, controlesMs: 300, rejeuMs: 2500, ecritureMs: 107, sqlMs: 7, sqlN: 1, enCours: 0 });
    // Les étapes ne reculent jamais.
    await m.suivre("/api/tower/submit", async () => {
      m.marquer("rejeu");
      m.marquer("controles");
      f.avancer(3500);
    });
    const dernier = lignes.filter((x) => x.message === "envoi lent").at(-1)!.fields;
    expect(dernier.controlesMs).toBe(0);
    expect(dernier.rejeuMs).toBe(3500);
    // Un envoi lent sur une autre route que « …/submit » n'écrit rien.
    await m.suivre("/api/portail/jour", async () => f.avancer(9000));
    expect(lignes.filter((x) => x.message === "envoi lent")).toHaveLength(2);
    base.close();
  });
});

describe("mesures (lot D3) — le vrai fil, sans rien qui dépende de la charge", () => {
  it("un vrai blocage du fil principal écrit une ligne bien formée avec la route qui tournait (le type dépend de la machine : il se vérifie sur valeurs injectées ci-dessus)", async () => {
    const { log, lignes } = journal();
    const m = creerMesures({ log, pasMs: 10, seuilBlocageMs: 80, releveMs: 3_600_000 });
    m.demarrer();
    try {
      await attendre(20);
      await m.suivre("/api/jump/submit", async () => {
        occuper(200); // le fil principal est occupé 200 ms au moins : une machine lente ne peut que l'allonger
        await attendre(10);
      });
    } finally {
      m.arreter();
    }
    const b = lignes.filter((l) => l.message === BLOCAGE);
    expect(b.length).toBeGreaterThanOrEqual(1);
    const f = b[0]!.fields;
    expect(f.retardMs as number).toBeGreaterThanOrEqual(150); // plancher : le blocage a duré 200 ms, aucune charge ne le raccourcit
    expect(["calcul", "attente"]).toContain(f.type);
    expect(f.routes).toContain("/api/jump/submit");
    expect(typeof f.cpuMs).toBe("number");
    expect(Object.keys(f).sort()).toEqual(["cpuMs", "enCours", "enRequete", "gcMs", "retardMs", "routes", "type"]);
    expect(m.instantane().blocages24h).toBeGreaterThanOrEqual(0);
  });
});

describe("mesures (lot D3) — vie privée", () => {
  it("aucun identifiant, pseudo, adresse ni corps dans les lignes (route sans date ni identifiant)", async () => {
    const { log, lignes } = journal();
    // Lot D3b : une horloge qui avance de 5 s à chaque lecture — l'envoi est « lent » à coup sûr, la ligne est toujours écrite (le test ne dépend plus du temps réel).
    let t = 0;
    const m = creerMesures({ log, pasMs: 10, seuilBlocageMs: 50, seuilEnvoiMs: 10, releveMs: 3_600_000, horloge: () => (t += 5000), cpu: () => 0 });
    const db = await openTestDb();
    const api = createApi({ db, now: () => NOON, mesures: m, log, allowCopies: true });
    const ID = "ab".repeat(16);
    try {
      const res = await api.handle(new Request(`http://api.test/api/jump/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": ID }, body: JSON.stringify({ name: "PseudoSecret", replay: "R" }) }), { clientKey: "203.0.113.9" });
      expect(res.status).toBeGreaterThanOrEqual(400); // refusé : peu importe, seule la forme des lignes compte
      m.passage();
      m.releve();
    } finally {
      db.close();
    }
    expect(lignes.some((l) => l.message === "envoi lent")).toBe(true); // le test regarde bien des lignes écrites
    const texte = JSON.stringify(lignes);
    expect(texte).not.toContain(ID);
    expect(texte).not.toContain("PseudoSecret");
    expect(texte).not.toContain("203.0.113.9");
  });
});
