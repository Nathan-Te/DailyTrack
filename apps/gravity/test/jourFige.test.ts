import { daysFromCivil, formatDay } from "@cdj/core";
import { GENERATEURS, dailyGravity, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, Partie, SIMS, decoderRediffusion, empreinteContenu, enregistrer, figerJour, genererMorceau, jouer, jouerRobot, rejouer, terrainDuJour } from "@cdj/gravity-sim";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contenuDuJour } from "../src/niveau";

// Lot GR5 — **le jeu relit un jour figé sous une ancienne version** (lot GR6 : les versions courantes sont 4 et 3 ; les anciennes 3 et 2 ont été retirées, le jeu est `off`) : le fichier `jours/AAAA-MM-JJ.json` d'un jour figé en v4 (générateur) et 3 (simulation) est lu par `niveau.ts` avec ces versions-là, même quand le code connaît
// une version suivante (factice, posée dans les registres) ; la partie jouée dessus (`Partie` + `enregistrer`, exactement ce que `scene.ts` fait) donne la rediffusion que le serveur rejoue à l'identique
// (`apps/api/test/gravityVersions.test.ts`). Un jour sans fichier, lui, est généré par la version courante.
const JOUR = daysFromCivil(2026, 11, 9);
const DATE = formatDay(JOUR);
const SEUILS = { bronze: 3100, silver: 6200, gold: 9300, author: 15500 };
const THEME = dailyGravity(JOUR).ordre[0]!; // le thème du jour : un autre (`?theme=`, un essai) tourne l'ordre et recalcule les seuils

const poserVersionsFactices = (): void => {
  GENERATEURS[5] = { morceauxParTheme: 7, ordre: (j) => [...GENERATEURS[4]!.ordre(j)].reverse(), morceau: (j, m, ordre, entree, precedent, regles) => genererMorceau(j + 1, m, ordre, entree, precedent, regles) };
  SIMS[4] = { ...SIMS[3]!, gravite: 1800, ventGravite: 720, vitesseBase: 32768 };
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
  delete GENERATEURS[5];
  delete SIMS[4];
  vi.unstubAllGlobals();
});

describe("le jeu relit un jour figé en v4 après le passage à la v5", () => {
  const fichier = JSON.parse(JSON.stringify(figerJour(JOUR, SEUILS))) as Record<string, unknown>;

  it("le contenu lu est celui du fichier : mêmes versions, mêmes seuils, même contenu — avant et après la v5", async () => {
    servir({ [DATE]: fichier });
    const avant = await contenuDuJour(JOUR, "http://localhost/", THEME);
    poserVersionsFactices();
    const apres = await contenuDuJour(JOUR, "http://localhost/", THEME);
    expect(apres).toMatchObject({ g: 4, sim: 3, seuilsFiges: SEUILS });
    expect(apres.ordre).toEqual(avant.ordre);
    expect(empreinteContenu(apres)).toBe(empreinteContenu(avant));
  });

  it("la partie jouée dessus donne la rediffusion que le serveur rejoue : mêmes versions écrites, même résultat", async () => {
    servir({ [DATE]: fichier });
    const avant = await contenuDuJour(JOUR, "http://localhost/", THEME);
    const changements = jouerRobot(terrainDuJour(avant), { maxTicks: 3500 }).changements;
    const attendu = jouer(terrainDuJour(avant), changements);
    poserVersionsFactices();
    const contenu = await contenuDuJour(JOUR, "http://localhost/", THEME);
    // ce que la scène fait : une `Partie` sur le terrain du contenu, les changements du bouton (appui, relâché…), puis `enregistrer(contenu, partie.changements)`
    const p = new Partie(terrainDuJour(contenu));
    let k = 0;
    while (!p.finie) {
      if (changements[k] === p.tick) {
        if (k % 2 === 0) p.appuyer();
        else p.relacher();
        k++;
      }
      p.avancer();
    }
    expect(p.resultat()).toEqual(attendu);
    expect(p.changements).toEqual(changements.filter((c) => c < p.tick));
    const texte = enregistrer(contenu, p.changements);
    expect(decoderRediffusion(texte)).toMatchObject({ g: 4, sim: 3 });
    expect(rejouer(contenu, texte)).toEqual(attendu);
  });

  it("un jour sans fichier est généré par la version courante (jamais par la factice)", async () => {
    servir({});
    poserVersionsFactices();
    const c = await contenuDuJour(JOUR, "http://localhost/", THEME);
    expect(c).toMatchObject({ g: GRAVITY_GENERATOR_VERSION, sim: GRAVITY_SIM_VERSION });
  });
});
