import { graineDuJour } from "@cdj/core/graine";
import { describe, expect, it } from "vitest";
import { encoderEnveloppe } from "@cdj/core/enveloppe";
import { GAMES } from "../src/registry";
import { D_ESSAI, JOUR_ESSAI } from "./jeuNeufAide";
import { defPartyJouet as def, GEN, grainesVues, MIDI, rediffusion, SIM } from "./partyAide";
import { makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";

// Lot PA1 — le contrat serveur d'un jeu Party : le « niveau » d'un jour est la graine du jour et rien d'autre ; le rejeu reçoit la graine et valide le score ; aucune médaille, aucun thème, aucun jour figé.
// Le jeu jouet est dans `partyAide.ts`. SQLite et libSQL (`file:`), jamais Turso.

async function monter(): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: [...GAMES, def] });
  t.clock.now = MIDI;
  await ouvrirJeu(t, def.code);
  return t;
}
const entete = (n: number) => ({ "X-Player-Id": playerId(n) });

describe("jeu Party : le niveau est la graine du jour (lot PA1)", () => {
  it("sert la graine du jour comme seul contenu : ni thème, ni médailles, ni preuve", async () => {
    const t = await monter();
    const graine = graineDuJour("partyjouet", D_ESSAI);
    const jour = await t.call("GET", `/api/partyjouet/day/${JOUR_ESSAI}`);
    expect(jour.status).toBe(200);
    expect(jour.body.contenu).toEqual({ graine });
    expect(jour.body.theme ?? null).toBeNull();
    expect(jour.body.medals ?? null).toBeNull();
    expect(JSON.stringify(jour.body)).not.toMatch(/replay|preuve/);
  });

  it("une autre date a une autre graine, la même date la même", () => {
    expect(graineDuJour("partyjouet", D_ESSAI)).toBe(graineDuJour("partyjouet", D_ESSAI));
    expect(graineDuJour("partyjouet", D_ESSAI)).not.toBe(graineDuJour("partyjouet", D_ESSAI + 1));
  });

  it("rejoue avec la graine du jour, classe, et ne garde que le résultat du rejeu (jamais le score annoncé)", async () => {
    const t = await monter();
    grainesVues.length = 0;
    const biais = graineDuJour("partyjouet", D_ESSAI) % 7;
    const a = await t.call("POST", "/api/partyjouet/submit", { replay: rediffusion([10, 5]), name: "Joueur1", points: 9999 }, { headers: entete(1) });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ accepted: true, rank: 1, participants: 1, date: JOUR_ESSAI });
    expect(a.body.best).toMatchObject({ points: 15 + biais });
    expect(grainesVues).toEqual([graineDuJour("partyjouet", D_ESSAI)]);
    expect(a.body.medal ?? null).toBeNull();
    const b = await t.call("POST", "/api/partyjouet/submit", { replay: rediffusion([40]), name: "Joueur2" }, { headers: entete(2) });
    expect(b.body).toMatchObject({ rank: 1, participants: 2 });
    const board = await t.call("GET", `/api/partyjouet/day/${JOUR_ESSAI}/board`, undefined, { headers: entete(1) });
    expect(board.body.top.map((l: { name: string }) => l.name)).toEqual(["Joueur2", "Joueur1"]);
  });

  it("refuse une rediffusion d'un autre jour ou d'une autre version, par les codes de la liste", async () => {
    const t = await monter();
    const refus = async (replay: string) => (await t.call("POST", "/api/partyjouet/submit", { replay, name: "Nowy" }, { headers: entete(1) })).body;
    expect(await refus(rediffusion([1], D_ESSAI + 1))).toMatchObject({ error: "not_daily" });
    expect(await refus(encoderEnveloppe({ sim: SIM, g: 9, contenu: { jour: D_ESSAI }, charge: [1] }))).toMatchObject({ error: "version" });
    expect(await refus(rediffusion([]))).toMatchObject({ error: "not_finished" });
  });
});
