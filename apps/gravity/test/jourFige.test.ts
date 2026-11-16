import { daysFromCivil, formatDay } from "@cdj/core";
import { GENERATEURS, dailyGravity, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, Partie, SIMS, decoderRediffusion, empreinteContenu, enregistrer, figerJour, genererMorceau, jouer, jouerRobot, rejouer, terrainDuJour } from "@cdj/gravity-sim";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contenuDuJour } from "../src/niveau";

// Lot GR5 — **le jeu relit un jour figé sous une ancienne version** : le fichier `jours/AAAA-MM-JJ.json` d'un jour figé en v3 (générateur) et 2 (simulation) est lu par `niveau.ts` avec ces versions-là, même quand le code connaît
// une version suivante (factice, posée dans les registres) ; la partie jouée dessus (`Partie` + `enregistrer`, exactement ce que `scene.ts` fait) donne la rediffusion que le serveur rejoue à l'identique
// (`apps/api/test/gravityVersions.test.ts`). Un jour sans fichier, lui, est généré par la version courante.
const JOUR = daysFromCivil(2026, 11, 9);
const DATE = formatDay(JOUR);
const SEUILS = { bronze: 3100, silver: 6200, gold: 9300, author: 15500 };
const THEME = dailyGravity(JOUR).ordre[0]!; // le thème du jour : un autre (`?theme=`, un essai) tourne l'ordre et recalcule les seuils

const poserVersionsFactices = (): void => {
  GENERATEURS[4] = { morceauxParTheme: 7, ordre: (j) => [...GENERATEURS[3]!.ordre(j)].reverse(), morceau: (j, m, ordre, entree, precedent, regles) => genererMorceau(j + 1, m, ordre, entree, precedent, regles) };
  SIMS[3] = { ...SIMS[2]!, gravite: 1800, ventGravite: 720, vitesseBase: 32768 };
};
const servir = (fichiers: Record<string, unknown>): void => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      const date = /(\d{4}-\d{2}-\d{2})\.json$/.exec(String(url))?.[1] ?? "";
      return date in fichiers ? { ok: true, json: async () => fichiers[date] } : { ok: false, json: async () => null };
    }),
  );
};
afterEach(() => {
  delete GENERATEURS[4];
  delete SIMS[3];
  vi.unstubAllGlobals();
});

describe("le jeu relit un jour figé en v3 après le passage à la v4", () => {
  const fichier = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS))) as Record<string, unknown>;

  it("le contenu lu est celui du fichier : mêmes versions, mêmes seuils, même contenu — avant et après la v4", async () => {
    servir({ [DATE]: fichier });
    const avant = await contenuDuJour(JOUR, "http://localhost/", THEME);
    poserVersionsFactices();
    const apres = await contenuDuJour(JOUR, "http://localhost/", THEME);
    expect(apres).toMatchObject({ g: 3, sim: 2, seuilsFiges: SEUILS });
    expect(apres.ordre).toEqual(avant.ordre);
    expect(empreinteContenu(apres)).toBe(empreinteContenu(avant));
  });

  it("la partie jouée dessus donne la rediffusion que le serveur rejoue : mêmes versions écrites, même résultat", async () => {
    servir({ [DATE]: fichier });
    const avant = await contenuDuJour(JOUR, "http://localhost/", THEME);
    const appuis = jouerRobot(terrainDuJour(avant), { maxTicks: 3500 }).appuis;
    const attendu = jouer(terrainDuJour(avant), appuis);
    poserVersionsFactices();
    const contenu = await contenuDuJour(JOUR, "http://localhost/", THEME);
    // ce que la scène fait : une `Partie` sur le terrain du contenu, les appuis, puis `enregistrer(contenu, appuis)`
    const p = new Partie(terrainDuJour(contenu));
    let k = 0;
    while (!p.finie) {
      if (appuis[k] === p.tick) {
        p.appuyer();
        k++;
      }
      p.avancer();
    }
    expect(p.resultat()).toEqual(attendu);
    const texte = enregistrer(contenu, appuis);
    expect(decoderRediffusion(texte)).toMatchObject({ g: 3, sim: 2 });
    expect(rejouer(contenu, texte)).toEqual(attendu);
  });

  it("un jour sans fichier est généré par la version courante (jamais par la factice)", async () => {
    servir({});
    poserVersionsFactices();
    const c = await contenuDuJour(JOUR, "http://localhost/", THEME);
    expect(c).toMatchObject({ g: GRAVITY_GENERATOR_VERSION, sim: GRAVITY_SIM_VERSION });
  });
});
