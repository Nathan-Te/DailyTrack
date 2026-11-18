import { afterEach, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  ErreurGenerateur,
  ErreurRediffusion,
  GENERATEURS,
  GRAVITY_GENERATOR_VERSION,
  GRAVITY_SIM_VERSION,
  Partie,
  SIMS,
  dailyGravity,
  decoderRediffusion,
  empreinteContenu,
  enregistrer,
  figerJour,
  genererMorceau,
  jouer,
  jouerRobot,
  lireJourFige,
  rejouer,
  seuilsDe,
  terrainDuJour,
  versionsGenerateur,
  versionsSimJouables,
} from "../src/index";

// Lot GR5 — **les anciennes versions** (lot GR7 : les versions courantes sont maintenant 5 et 4, les anciennes ont été retirées — le jeu est `off`, aucun jour figé) : un jour figé se relit et se rejoue avec la version du générateur et de la simulation qui l'a créé, même après un passage à la version suivante. Le « passage » est joué ici : une
// version 4 du générateur et une version 3 de la simulation **factices** (une longueur de thème, une gravité et des morceaux autres) sont posées dans les registres, le jour figé sous la version courante (5 et 4) est
// relu et rejoué : il doit être **identique** — son contenu (l'empreinte), ses seuils, son terrain, et le résultat d'une partie rejouée.
const JOUR = daysFromCivil(2026, 11, 9);
const SEUILS = { bronze: 3100, silver: 6200, gold: 9300, author: 15500 };

/** Une version 6 du générateur : un thème de 7 morceaux, l'ordre inversé, les morceaux du jour suivant — tout autre que la 5. */
const poserVersionsFactices = (): void => {
  GENERATEURS[6] = { morceauxParTheme: 7, ordre: (j) => [...GENERATEURS[5]!.ordre(j)].reverse(), morceau: (j, m, ordre, entree, precedent, regles) => genererMorceau(j + 1, m, ordre, entree, precedent, regles) };
  SIMS[5] = { ...SIMS[4]!, gravite: 1800, ventGravite: 720, vitesseBase: 36864 };
};
afterEach(() => {
  delete GENERATEURS[6];
  delete SIMS[5];
});

/** Ce qu'un jour figé donne : tout ce qui doit rester identique après le passage à la version suivante. */
function releve(json: unknown) {
  const c = lireJourFige(json);
  expect(c).not.toBeNull();
  const contenu = c!;
  const terrain = terrainDuJour(contenu);
  const robot = jouerRobot(terrain, { maxTicks: 4000 });
  return { g: contenu.g, sim: contenu.sim, ordre: [...contenu.ordre], empreinte: empreinteContenu(contenu), seuils: seuilsDe(contenu), morceaux: [0, 1, 2, 30].map((k) => [...terrain.morceau(k).cases]), appuis: robot.changements, texte: enregistrer(contenu, robot.changements), resultat: jouer(terrain, robot.changements) };
}

describe("les registres des versions", () => {
  it("la version courante est dans chaque registre", () => {
    expect(versionsGenerateur()).toContain(GRAVITY_GENERATOR_VERSION);
    expect(versionsSimJouables()).toContain(GRAVITY_SIM_VERSION);
  });
  it("une version inconnue du générateur ou de la simulation est refusée, jamais rabattue sur la courante", () => {
    expect(() => dailyGravity(JOUR, 99)).toThrow(ErreurGenerateur);
    expect(() => dailyGravity(JOUR, GRAVITY_GENERATOR_VERSION, 99)).toThrow(ErreurGenerateur);
  });
  it("la version 6 factice se pose et s'enlève : les registres sont ceux d'avant", () => {
    poserVersionsFactices();
    expect(versionsGenerateur()).toContain(6);
    expect(versionsSimJouables()).toContain(5);
    delete GENERATEURS[6];
    delete SIMS[5];
    expect(versionsGenerateur()).not.toContain(6);
    expect(versionsSimJouables()).not.toContain(5);
  });
});

describe("un jour figé en v5 se rejoue à l'identique après le passage à la v6", () => {
  const fichier = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS))) as Record<string, unknown>;
  it("le fichier nomme les versions qui l'ont produit", () => {
    expect(fichier).toMatchObject({ date: formatDay(JOUR), g: 5, sim: 4, seuils: SEUILS });
  });
  it("même contenu, mêmes seuils, même terrain, même rediffusion et même résultat qu'avant la v6", () => {
    const avant = releve(fichier);
    poserVersionsFactices();
    const apres = releve(fichier);
    expect(apres).toEqual(avant);
    expect(apres).toMatchObject({ g: 5, sim: 4, seuils: SEUILS });
    expect(apres.resultat.ticks).toBeGreaterThan(1000); // une vraie partie, pas un rejeu vide
  });
  it("la v6 est bien une autre chose : le même jour, sous les nouvelles versions, ne donne ni le même contenu ni le même résultat", () => {
    const avant = releve(fichier);
    poserVersionsFactices();
    const neuf = dailyGravity(JOUR, 6, 5);
    expect(neuf).toMatchObject({ g: 6, sim: 5 });
    expect(empreinteContenu(neuf)).not.toBe(avant.empreinte);
    expect(neuf.ordre).toEqual([...avant.ordre].reverse());
    expect(terrainDuJour(neuf).regles).toMatchObject({ sim: 5, gravite: 1800, morceauxParTheme: 7 });
    expect(terrainDuJour(lireJourFige(fichier)!).regles).toMatchObject({ sim: 4, gravite: 1570, morceauxParTheme: 19 });
    expect(jouer(terrainDuJour(neuf), avant.appuis)).not.toEqual(avant.resultat);
  });
  it("une rediffusion du jour v5 se rejoue sur le jour v5 ; elle est refusée sur le jour v6, et inversement", () => {
    const v4 = lireJourFige(fichier)!;
    const appuis = jouerRobot(terrainDuJour(v4), { maxTicks: 2000 }).changements;
    const texte3 = enregistrer(v4, appuis);
    poserVersionsFactices();
    const v5 = dailyGravity(JOUR, 6, 5);
    const texte4 = enregistrer(v5, appuis);
    expect(rejouer(v4, texte3)).toEqual(jouer(terrainDuJour(v4), appuis));
    expect(rejouer(v5, texte4)).toEqual(jouer(terrainDuJour(v5), appuis));
    expect(() => rejouer(v5, texte3)).toThrow(ErreurRediffusion);
    expect(() => rejouer(v4, texte4)).toThrow(ErreurRediffusion);
    expect(decoderRediffusion(texte3)).toMatchObject({ g: 5, sim: 4 });
    expect(decoderRediffusion(texte4)).toMatchObject({ g: 6, sim: 5 });
  });
  it("sans la v6 dans le code, une rediffusion v6 n'est pas lue : « recharge la page »", () => {
    poserVersionsFactices();
    const texte4 = enregistrer(dailyGravity(JOUR, 6, 5), [60]);
    delete GENERATEURS[6];
    delete SIMS[5];
    expect(() => decoderRediffusion(texte4)).toThrow(expect.objectContaining({ code: "version_inconnue" }));
  });
  it("un jour figé en v6 se relit tant que la v6 est dans le code, et plus après qu'on l'a retirée (règle : on ne retire que ce qu'aucun jour figé ne nomme)", () => {
    poserVersionsFactices();
    const f4 = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS, 6, 5)));
    expect(f4).toMatchObject({ g: 6, sim: 5 });
    expect(lireJourFige(f4)).toMatchObject({ g: 6, sim: 5 });
    delete GENERATEURS[6];
    delete SIMS[5];
    expect(lireJourFige(f4)).toBeNull();
  });
  it("la partie lit les règles de son terrain : la vitesse et la gravité d'une autre version se voient, celles du jour figé ne bougent pas", () => {
    poserVersionsFactices();
    const v4 = lireJourFige(fichier)!;
    const v5 = dailyGravity(JOUR, GRAVITY_GENERATOR_VERSION, 5);
    const a = new Partie(terrainDuJour(v4));
    const b = new Partie(terrainDuJour(v5));
    for (let i = 0; i < 30; i++) {
      a.avancer();
      b.avancer();
    }
    expect(a.regles.gravite).toBe(1570);
    expect(b.regles.gravite).toBe(1800);
    expect(a.cam).not.toBe(b.cam); // la caméra de la v4 factice part plus vite (36 864 contre 32 768 unités par seconde)
  });
});
