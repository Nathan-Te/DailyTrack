import { decoderEnveloppe, ErreurEnveloppe } from "@cdj/core/enveloppe";
import { describe, expect, it } from "vitest";
import type { GameDefinition } from "../src/games";
import { type ContratMinimal, definirJeuNeuf, refusDEnveloppe } from "../src/jeux/index";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId, type TestApi } from "./helpers";
import { contratEssai, D_ESSAI, ficheEssai, rediffusion, SIM } from "./jeuNeufAide";

// Lot PG2 — **les anciennes versions, côté serveur, d'un jeu neuf** : `generateurDuNiveau` (facultatif) du contrat minimal. Un jeu qui garde d'anciennes versions sert un jour figé sous le générateur 1 alors que le
// générateur courant est le 2 (la « montée de version ») : la rediffusion de ce jour nomme le générateur 1, et `memeContenu` la compare à celui **du niveau servi**, plus au seul générateur courant. Le jeu jouet
// (`jeuNeufAide.ts`) fait la montée : générateur courant 2, jour du 10/11 figé sous le 1, jours suivants sous le 2.
const MIDI = D_ESSAI * DAY_MS + 12 * 3_600_000;
const COURANT = 2;
const LIMITES = { maxCaracteres: 600, sims: [SIM], generateurs: [1, COURANT] };

interface NiveauG {
  jour: number;
  g: number;
}

/** Le contrat jouet après la montée de version : le générateur courant est le 2, le jour du 10/11 est figé sous le 1. `avecChamp` : le contrat dit `generateurDuNiveau`. */
function contratMonte(avecChamp: boolean): ContratMinimal<NiveauG, ReturnType<typeof decoderEnveloppe>, { points: number; octets: number; ticks: number }> {
  const base = contratEssai("score");
  return {
    ...(base as unknown as ContratMinimal<NiveauG, ReturnType<typeof decoderEnveloppe>, { points: number; octets: number; ticks: number }>),
    versions: () => ({ simVersion: SIM, generatorVersion: COURANT }),
    niveauDuJour: (jour) => ({ jour, g: jour <= D_ESSAI ? 1 : COURANT }),
    decoder(texte) {
      try {
        return decoderEnveloppe(texte, LIMITES);
      } catch (e) {
        if (e instanceof ErreurEnveloppe) throw refusDEnveloppe(e);
        throw e;
      }
    },
    rejouer(_niveau, texte) {
      const r = decoderEnveloppe(texte, LIMITES) as unknown as { charge: number[] };
      return { points: r.charge.reduce((a, b) => a + b, 0), octets: r.charge.length, ticks: r.charge.length * 2 };
    },
    ...(avecChamp ? { generateurDuNiveau: (n: NiveauG) => n.g } : {}),
  };
}

async function monter(avecChamp: boolean): Promise<{ t: TestApi; code: string }> {
  const fiche = ficheEssai("score");
  const def = definirJeuNeuf({ fiche, nom: "EssaiScore" }, () => contratMonte(avecChamp)) as unknown as GameDefinition<never>;
  const t = await makeApi({ seed: false, games: [...GAMES, def], allowCopies: true });
  t.clock.now = MIDI;
  await ouvrirJeu(t, def.code);
  return { t, code: def.code };
}
const envoyer = (t: TestApi, code: string, n: number, g: number) => t.call("POST", `/api/${code}/submit`, { replay: rediffusion([60, 40], D_ESSAI, g), name: `Joueur${n}` }, { headers: { "X-Player-Id": playerId(n) } });

describe("un jeu neuf qui garde d'anciennes versions (`generateurDuNiveau`)", () => {
  it("avec le champ : un jour figé sous l'ancien générateur est accepté, rejoué et classé après la montée de version", async () => {
    const { t, code } = await monter(true);
    const r = await envoyer(t, code, 1, 1);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ accepted: true, score: { points: 100 }, medal: "gold", rank: 1 });
  });

  it("avec le champ : une rediffusion qui nomme un autre générateur que celui du niveau servi reste refusée (`version`)", async () => {
    const { t, code } = await monter(true);
    const r = await envoyer(t, code, 1, COURANT); // le niveau du jour est servi sous le 1 : une partie du générateur 2 n'est pas la sienne
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "version" });
    expect((await envoyer(t, code, 2, 9)).body).toMatchObject({ error: "version" }); // une version que le serveur ne connaît pas : refusée par le décodage
  });

  it("sans le champ (le jeu d'avant) : la rediffusion est comparée au seul générateur courant — rien ne change", async () => {
    const { t, code } = await monter(false);
    expect((await envoyer(t, code, 1, 1)).body).toMatchObject({ error: "version" }); // le manque que le champ comble
    const r = await envoyer(t, code, 2, COURANT);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ accepted: true });
  });

  it("le générateur courant reste celui qu`info` annonce : seul le niveau figé garde le sien", async () => {
    const { t, code } = await monter(true);
    const info = await t.call("GET", `/api/${code}/info`);
    expect(info.body).toMatchObject({ generatorVersion: COURANT }); // le générateur courant reste annoncé ; seul le niveau figé garde le sien
  });
});
