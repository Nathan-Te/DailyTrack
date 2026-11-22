import { jeuPartyDuJour } from "@cdj/core/jeux";
import { describe, expect, it } from "vitest";
import { GAMES } from "../src/registry";
import { D_ESSAI } from "./jeuNeufAide";
import { MIDI, partyJouetDe, rediffusion } from "./partyAide";
import { DAY_MS, makeApi, ouvrirJeu, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot PA1b — **le tour de rôle des jeux Party** : chaque jour de Paris, un jeu Party `on` est le jeu du jour (dans l'ordre des dates d'ouverture, en boucle, calculé du seul numéro du jour) ; seul lui a un classement, les
// autres refusent l'envoi par `not_party_of_the_day` ; sans jeu Party `on`, pas de jeu du jour ; un jeu ouvert en cours de journée ne change pas le jeu du jour commencé. Horloge maîtrisée : aucune date du calendrier en dur
// au-delà du jour d'essai commun des tests (`D_ESSAI`). SQLite et libSQL (`file:`), jamais Turso.

const A = partyJouetDe("partya");
const B = partyJouetDe("partyb");
const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });
const envoyer = (t: TestApi, code: string, jour: number, n = 1) => t.call("POST", `/api/${code}/submit`, { replay: rediffusion([10], jour), name: `Joueur${n}` }, as(n));

async function api(ouverts: { jeu: typeof A; du: number }[]): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: [...GAMES, A, B] });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  for (const o of ouverts) await ouvrirJeu(t, o.jeu.code, o.du);
  return t;
}
/** Le jeu du jour que la plateforme annonce (`GET /api/jeux`), et celui que la fonction pure calcule pour les mêmes jeux. */
const dujour = async (t: TestApi): Promise<string | null> => (await t.call("GET", "/api/jeux")).body.party.jeu;

describe(`tour de rôle des jeux Party (${TEST_DB})`, () => {
  it("sans jeu Party `on` : pas de jeu du jour, et aucun envoi n'est accepté", { timeout: 30_000 }, async () => {
    const t = await api([]);
    expect((await t.call("GET", "/api/jeux")).body.party).toMatchObject({ jeu: null, prochains: {} });
    expect((await t.call("GET", "/api/portail/jour")).body.party).toMatchObject({ jeu: null });
    expect((await envoyer(t, A.code, D_ESSAI)).status).toBe(404); // `off` : game_unavailable
  });

  it("un seul jeu Party `on` est le jeu de tous les jours ; le portail et /api/jeux disent la même chose", { timeout: 30_000 }, async () => {
    const t = await api([{ jeu: A, du: D_ESSAI - 3 }]);
    expect(await dujour(t)).toBe(A.code);
    const jour = (await t.call("GET", "/api/portail/jour")).body;
    expect(jour.party.jeu).toBe(A.code);
    expect((await envoyer(t, A.code, D_ESSAI)).status).toBe(200);
  });

  it("à deux jeux : un seul est classé le jour D, l'autre est refusé (code de la liste), et ils alternent d'un jour à l'autre", { timeout: 60_000 }, async () => {
    const t = await api([{ jeu: A, du: D_ESSAI - 5 }, { jeu: B, du: D_ESSAI - 3 }]);
    const lice = [{ site: A.code, depuis: D_ESSAI - 5 }, { site: B.code, depuis: D_ESSAI - 3 }];
    const vus: string[] = [];
    for (let i = 0; i < 2; i++) {
      const jour = D_ESSAI + i;
      t.clock.now = MIDI + i * DAY_MS;
      const gagnant = (await dujour(t))!;
      expect(gagnant).toBe(jeuPartyDuJour(lice, jour)); // la plateforme suit la règle pure, sans table
      const perdant = gagnant === A.code ? B.code : A.code;
      expect((await envoyer(t, gagnant, jour, 1 + i)).status).toBe(200);
      const refus = await envoyer(t, perdant, jour, 1 + i);
      expect(refus).toMatchObject({ status: 409, body: { error: "not_party_of_the_day" } });
      vus.push(gagnant);
    }
    expect(vus[0]).not.toBe(vus[1]);
  });

  it("le jeu dit avant la partie s'il est classé (`party.classe`) et, sinon, quand il le sera (`prochain`)", { timeout: 60_000 }, async () => {
    const t = await api([{ jeu: A, du: D_ESSAI - 5 }, { jeu: B, du: D_ESSAI - 3 }]);
    const gagnant = (await dujour(t))!;
    const autre = gagnant === A.code ? B.code : A.code;
    const date = new Date(D_ESSAI * DAY_MS).toISOString().slice(0, 10);
    const bg = (await t.call("GET", `/api/${gagnant}/day/${date}/board`)).body;
    const ba = (await t.call("GET", `/api/${autre}/day/${date}/board`)).body;
    expect(bg.party).toMatchObject({ classe: true });
    expect(ba.party).toMatchObject({ classe: false });
    expect(ba.party.prochain).toBe(new Date((D_ESSAI + 1) * DAY_MS).toISOString().slice(0, 10)); // à deux jeux, l'autre est en tête demain
  });

  it("le classement du jour ne garde que le jeu Party du jour (onglet) ; les autres jeux Party n'y sont pas", { timeout: 60_000 }, async () => {
    const t = await api([{ jeu: A, du: D_ESSAI - 5 }, { jeu: B, du: D_ESSAI - 3 }]);
    await ouvrirJeu(t, "track", 0);
    const gagnant = (await dujour(t))!;
    await envoyer(t, gagnant, D_ESSAI);
    const classement = (await t.call("GET", "/api/portail/classement")).body;
    const party = classement.jeux.filter((j: { categorie?: string }) => j.categorie === "party");
    expect(party.map((j: { site: string }) => j.site)).toEqual([gagnant]);
  });

  it("un jeu ouvert en cours de journée ne change pas le jeu du jour commencé (il compte dès le lendemain)", { timeout: 60_000 }, async () => {
    // B s'ouvre aujourd'hui (D_ESSAI) : il est `on`, mais sa période commence demain (`periodesApres`, lot P).
    const t = await api([{ jeu: A, du: D_ESSAI - 5 }, { jeu: B, du: D_ESSAI + 1 }]);
    expect(await dujour(t)).toBe(A.code);
    expect((await envoyer(t, B.code, D_ESSAI)).status).toBe(409);
    // Demain, B est en lice : le tour de rôle compte deux jeux.
    t.clock.now = MIDI + DAY_MS;
    const lice = [{ site: A.code, depuis: D_ESSAI - 5 }, { site: B.code, depuis: D_ESSAI + 1 }];
    expect(await dujour(t)).toBe(jeuPartyDuJour(lice, D_ESSAI + 1));
  });

  it("l'aperçu voit tous les jeux Party du registre en lice (un jeu en brouillon se montre « classé » à son tour)", { timeout: 30_000 }, async () => {
    const t = await api([]);
    const r = await t.call("GET", "/api/jeux", undefined, { headers: { Origin: "https://dailytrack--pr-12-abcdef01.web.app" } });
    // Hors recette (l'environnement de test n'est pas la production) un aperçu de PR voit les jeux comme `on`.
    expect(r.body.apercu).toBe(true);
    expect(r.body.party.jeu).not.toBeNull();
  });
});
