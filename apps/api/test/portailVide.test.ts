import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION } from "@cdj/blocks-sim";
import { daysFromCivil } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { ESSAIS_BLOCKS } from "../scripts/blocks-essais";
import { CLASSEMENT_FENETRE_MS } from "../src/portail";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId } from "./helpers";

// Lot « manques de Blocks » (point 15) : un classement VIDE d'un jour ouvert n'est pas gardé par le portail. Avant, une lecture faite avant que quiconque ait joué (un cumul lu par une page, un test) figeait la
// vue 45 s : le premier classé n'apparaissait qu'à la fenêtre suivante. Un classement qui a des classés reste gardé toute sa fenêtre (c'est le coût que la fenêtre limite, lot I3).
const JOUR = daysFromCivil(2026, 11, 10);
const VERSIONS = { simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION };

describe("le classement du portail : un classement vide d'un jour ouvert n'est pas gardé", () => {
  it("le premier classé se voit tout de suite ; ensuite la fenêtre garde le classement comme avant", async () => {
    const t = await makeApi({ seed: false, games: GAMES });
    t.clock.now = JOUR * DAY_MS + 12 * 3_600_000;
    await ouvrirJeu(t, "blocks");
    const envoyer = (n: number) => t.call("POST", "/api/blocks/submit", { replay: ESSAIS_BLOCKS.partie(JOUR, VERSIONS, n).rediffusion, name: `Joueur${n}` }, { headers: { "X-Player-Id": playerId(n) } });
    const classes = async () => (await t.call("GET", "/api/portail/classement?vue=blocks")).body.classes as number;
    expect(await classes()).toBe(0); // lu à vide : rien n'est gardé
    expect((await envoyer(1)).status).toBe(200);
    expect(await classes()).toBe(1); // le premier classé est là, sans attendre la fenêtre
    expect((await envoyer(2)).status).toBe(200);
    expect(await classes()).toBe(1); // un classement qui a des classés est gardé toute sa fenêtre (lot I3)…
    t.clock.now += CLASSEMENT_FENETRE_MS + 1000;
    expect(await classes()).toBe(2); // …puis recalculé
  });
});
