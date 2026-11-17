import { daysFromCivil, formatDay } from "@cdj/core";
import { GENERATEURS, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, SIMS, dailyGravity, decoderRediffusion, enregistrer, figerJour, genererMorceau, jouer, jouerRobot, scoreParColonnes, terrainDuJour } from "@cdj/gravity-sim";
import { afterEach, describe, expect, it } from "vitest";
import { contratGravity } from "../src/gravity";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu, playerId } from "./helpers";

// Lot GR5 — **les anciennes versions, côté serveur** : un jour figé sous le générateur 4 et la simulation 3 est relu et rejoué avec ces versions-là **après** qu'une version suivante (factice ici, posée dans les registres) existe.
// Le jeu fait la même chose avec le même code (`packages/gravity-sim/test/versions.test.ts` : contenu, seuils, terrain, rejeu ; `apps/gravity/test/jourFige.test.ts` : la lecture du fichier par le jeu).
const JOUR = daysFromCivil(2026, 11, 10);
const DATE = formatDay(JOUR);
const SEUILS = { bronze: 3100, silver: 6200, gold: 9300, author: 15500 };

const poserVersionsFactices = (): void => {
  GENERATEURS[5] = { morceauxParTheme: 7, ordre: (j) => [...GENERATEURS[4]!.ordre(j)].reverse(), morceau: (j, m, ordre, entree, precedent, regles) => genererMorceau(j + 1, m, ordre, entree, precedent, regles) };
  SIMS[4] = { ...SIMS[3]!, gravite: 1800, ventGravite: 720, vitesseBase: 32768 };
};
afterEach(() => {
  delete GENERATEURS[5];
  delete SIMS[4];
});

describe("Gravity : un jour figé sous une ancienne version se rejoue à l'identique sur le serveur", () => {
  const fichier = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS))) as Record<string, unknown>;
  const partie = () => {
    const contenu = dailyGravity(JOUR);
    const changements = jouerRobot(terrainDuJour(contenu), { maxTicks: 4000 }).changements;
    return { changements, texte: enregistrer(contenu, changements), attendu: jouer(terrainDuJour(contenu), changements) };
  };

  it("le contrat lit le fichier v4, ses seuils figés, et rejoue sa rediffusion : même résultat avant et après la version suivante", () => {
    const p = partie();
    const avant = (() => {
      const c = contratGravity({ frozen: { [DATE]: fichier } });
      const n = c.niveauDuJour(JOUR) as Awaited<ReturnType<typeof c.niveauDuJour>> & { contenu: { g: number; sim: number } };
      return { n, mesure: c.rejouer(n, p.texte), seuils: c.seuils(n) };
    })();
    poserVersionsFactices();
    const c = contratGravity({ frozen: { [DATE]: fichier } });
    const n = c.niveauDuJour(JOUR) as typeof avant.n;
    expect(n.contenu).toMatchObject({ g: 4, sim: 3 });
    expect(c.decoder(p.texte)).toMatchObject({ g: 4, sim: 3 });
    expect(c.rejouer(n, p.texte)).toEqual(avant.mesure);
    expect(c.rejouer(n, p.texte)).toEqual(p.attendu);
    expect(c.seuils(n)).toEqual(SEUILS);
    expect(scoreParColonnes(c.rejouer(n, p.texte) as ReturnType<typeof jouer>)).toEqual(scoreParColonnes(p.attendu));
  });

  it("un jour sans fichier est servi par le générateur COURANT, jamais par la version factice", () => {
    poserVersionsFactices();
    const n = contratGravity({}).niveauDuJour(JOUR) as { contenu: { g: number; sim: number } };
    expect(n.contenu).toMatchObject({ g: GRAVITY_GENERATOR_VERSION, sim: GRAVITY_SIM_VERSION });
  });

  it("par la route : le jour figé v4 est envoyé, rejoué et classé (la version courante est encore la 3)", async () => {
    const p = partie();
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, joursFiges: { gravity: { [DATE]: fichier } } });
    t.clock.now = JOUR * DAY_MS + 12 * 3_600_000;
    await ouvrirJeu(t, "gravity");
    poserVersionsFactices(); // une version suivante existe dans le code : le jour v4 est toujours servi et rejoué tel qu'il a été figé
    const r = await t.call("POST", "/api/gravity/submit", { replay: p.texte, name: "Ancienne" }, { headers: { "X-Player-Id": playerId(1) } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.score).toEqual(scoreParColonnes(p.attendu));
    expect((await t.call("GET", `/api/gravity/day/${DATE}`)).body.medals).toEqual(SEUILS);
  });

  it("limite connue de la plateforme (README du lot GR5) : `memeContenu` du module compare au SEUL générateur courant, donc une rediffusion v5 d'un jour v5 est refusée tant que le courant est la v4", async () => {
    poserVersionsFactices();
    const f4 = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS, 5, 4)));
    const c4 = dailyGravity(JOUR, 5, 4);
    const texte = enregistrer(c4, jouerRobot(terrainDuJour(c4), { maxTicks: 1500 }).changements);
    expect(decoderRediffusion(texte)).toMatchObject({ g: 5, sim: 4 }); // le décodeur de Gravity la lit
    const t = await makeApi({ seed: false, games: GAMES, allowCopies: true, joursFiges: { gravity: { [DATE]: f4 } } });
    t.clock.now = JOUR * DAY_MS + 12 * 3_600_000;
    await ouvrirJeu(t, "gravity");
    const r = await t.call("POST", "/api/gravity/submit", { replay: texte, name: "Neuve" }, { headers: { "X-Player-Id": playerId(2) } });
    expect(r.status).toBe(409); // `version` : « recharge la page » — le module, zone de la plateforme, ne regarde pas le générateur du niveau
    expect(r.body.error).toBe("version");
  });
});
