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

// Lot GR5 — **les anciennes versions** : un jour figé se relit et se rejoue avec la version du générateur et de la simulation qui l'a créé, même après un passage à la version suivante. Le « passage » est joué ici : une
// version 4 du générateur et une version 3 de la simulation **factices** (une longueur de thème, une gravité et des morceaux autres) sont posées dans les registres, le jour figé sous la version courante (3 et 2) est
// relu et rejoué : il doit être **identique** — son contenu (l'empreinte), ses seuils, son terrain, et le résultat d'une partie rejouée.
const JOUR = daysFromCivil(2026, 11, 9);
const SEUILS = { bronze: 3100, silver: 6200, gold: 9300, author: 15500 };

/** Une version 4 du générateur : un thème de 7 morceaux, l'ordre inversé, les morceaux du jour suivant — tout autre que la 3. */
const poserVersionsFactices = (): void => {
  GENERATEURS[4] = { morceauxParTheme: 7, ordre: (j) => [...GENERATEURS[3]!.ordre(j)].reverse(), morceau: (j, m, ordre, entree, precedent, regles) => genererMorceau(j + 1, m, ordre, entree, precedent, regles) };
  SIMS[3] = { ...SIMS[2]!, gravite: 1800, ventGravite: 720, vitesseBase: 32768 };
};
afterEach(() => {
  delete GENERATEURS[4];
  delete SIMS[3];
});

/** Ce qu'un jour figé donne : tout ce qui doit rester identique après le passage à la version suivante. */
function releve(json: unknown) {
  const c = lireJourFige(json);
  expect(c).not.toBeNull();
  const contenu = c!;
  const terrain = terrainDuJour(contenu);
  const robot = jouerRobot(terrain, { maxTicks: 4000 });
  return { g: contenu.g, sim: contenu.sim, ordre: [...contenu.ordre], empreinte: empreinteContenu(contenu), seuils: seuilsDe(contenu), morceaux: [0, 1, 2, 30].map((k) => [...terrain.morceau(k).cases]), appuis: robot.appuis, texte: enregistrer(contenu, robot.appuis), resultat: jouer(terrain, robot.appuis) };
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
  it("la version 4 factice se pose et s'enlève : les registres sont ceux d'avant", () => {
    poserVersionsFactices();
    expect(versionsGenerateur()).toContain(4);
    expect(versionsSimJouables()).toContain(3);
    delete GENERATEURS[4];
    delete SIMS[3];
    expect(versionsGenerateur()).not.toContain(4);
    expect(versionsSimJouables()).not.toContain(3);
  });
});

describe("un jour figé en v3 se rejoue à l'identique après le passage à la v4", () => {
  const fichier = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS))) as Record<string, unknown>;
  it("le fichier nomme les versions qui l'ont produit", () => {
    expect(fichier).toMatchObject({ date: formatDay(JOUR), g: 3, sim: 2, seuils: SEUILS });
  });
  it("même contenu, mêmes seuils, même terrain, même rediffusion et même résultat qu'avant la v4", () => {
    const avant = releve(fichier);
    poserVersionsFactices();
    const apres = releve(fichier);
    expect(apres).toEqual(avant);
    expect(apres).toMatchObject({ g: 3, sim: 2, seuils: SEUILS });
    expect(apres.resultat.ticks).toBeGreaterThan(1000); // une vraie partie, pas un rejeu vide
  });
  it("la v4 est bien une autre chose : le même jour, sous les nouvelles versions, ne donne ni le même contenu ni le même résultat", () => {
    const avant = releve(fichier);
    poserVersionsFactices();
    const neuf = dailyGravity(JOUR, 4, 3);
    expect(neuf).toMatchObject({ g: 4, sim: 3 });
    expect(empreinteContenu(neuf)).not.toBe(avant.empreinte);
    expect(neuf.ordre).toEqual([...avant.ordre].reverse());
    expect(terrainDuJour(neuf).regles).toMatchObject({ sim: 3, gravite: 1800, morceauxParTheme: 7 });
    expect(terrainDuJour(lireJourFige(fichier)!).regles).toMatchObject({ sim: 2, gravite: 1570, morceauxParTheme: 19 });
    expect(jouer(terrainDuJour(neuf), avant.appuis)).not.toEqual(avant.resultat);
  });
  it("une rediffusion du jour v3 se rejoue sur le jour v3 ; elle est refusée sur le jour v4, et inversement", () => {
    const v3 = lireJourFige(fichier)!;
    const appuis = jouerRobot(terrainDuJour(v3), { maxTicks: 2000 }).appuis;
    const texte3 = enregistrer(v3, appuis);
    poserVersionsFactices();
    const v4 = dailyGravity(JOUR, 4, 3);
    const texte4 = enregistrer(v4, appuis);
    expect(rejouer(v3, texte3)).toEqual(jouer(terrainDuJour(v3), appuis));
    expect(rejouer(v4, texte4)).toEqual(jouer(terrainDuJour(v4), appuis));
    expect(() => rejouer(v4, texte3)).toThrow(ErreurRediffusion);
    expect(() => rejouer(v3, texte4)).toThrow(ErreurRediffusion);
    expect(decoderRediffusion(texte3)).toMatchObject({ g: 3, sim: 2 });
    expect(decoderRediffusion(texte4)).toMatchObject({ g: 4, sim: 3 });
  });
  it("sans la v4 dans le code, une rediffusion v4 n'est pas lue : « recharge la page »", () => {
    poserVersionsFactices();
    const texte4 = enregistrer(dailyGravity(JOUR, 4, 3), [60]);
    delete GENERATEURS[4];
    delete SIMS[3];
    expect(() => decoderRediffusion(texte4)).toThrow(expect.objectContaining({ code: "version_inconnue" }));
  });
  it("un jour figé en v4 se relit tant que la v4 est dans le code, et plus après qu'on l'a retirée (règle : on ne retire que ce qu'aucun jour figé ne nomme)", () => {
    poserVersionsFactices();
    const f4 = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS, 4, 3)));
    expect(f4).toMatchObject({ g: 4, sim: 3 });
    expect(lireJourFige(f4)).toMatchObject({ g: 4, sim: 3 });
    delete GENERATEURS[4];
    delete SIMS[3];
    expect(lireJourFige(f4)).toBeNull();
  });
  it("la partie lit les règles de son terrain : la vitesse et la gravité d'une autre version se voient, celles du jour figé ne bougent pas", () => {
    poserVersionsFactices();
    const v3 = lireJourFige(fichier)!;
    const v4 = dailyGravity(JOUR, GRAVITY_GENERATOR_VERSION, 3);
    const a = new Partie(terrainDuJour(v3));
    const b = new Partie(terrainDuJour(v4));
    for (let i = 0; i < 30; i++) {
      a.avancer();
      b.avancer();
    }
    expect(a.regles.gravite).toBe(1570);
    expect(b.regles.gravite).toBe(1800);
    expect(a.cam).not.toBe(b.cam); // la caméra de la v3 factice part plus vite (32 768 contre 28 672 unités par seconde)
  });
});
