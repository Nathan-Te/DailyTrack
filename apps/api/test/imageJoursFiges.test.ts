import { daysFromCivil, formatDay } from "@cdj/core";
import { figerJour } from "@cdj/cibles-sim";
import { describe, expect, it } from "vitest";
import { controlerJeu, jeuxAControler } from "../../../scripts/image-jours-figes.mjs";
import { GAMES } from "../src/registry";
import { DAY_MS, makeApi, ouvrirJeu } from "./helpers";

// Lot K4f — le contrôle de l'image du serveur (`scripts/image-jours-figes.mjs`, job `api-image`) lit les jours figés de chaque jeu dans sa fiche. Ici contre le vrai `createApi`, avec Cibles.
const JOUR = daysFromCivil(2026, 11, 10);
const MIDI = JOUR * DAY_MS + 12 * 3_600_000;
const fichier = (j: number) => ({ date: formatDay(j), contenu: figerJour(j) });

async function appelDe(jours: number[], environnement: "recette" | "production") {
  const t = await makeApi({ seed: false, games: GAMES, joursFiges: { cibles: Object.fromEntries(jours.map((j) => [formatDay(j), figerJour(j)])) }, environment: environnement });
  t.clock.now = MIDI;
  if (environnement !== "production") await ouvrirJeu(t, "cibles");
  return async (chemin: string) => {
    const r = await t.call("GET", chemin, undefined, { headers: environnement === "production" ? {} : { "X-Forwarded-Host": "recette--pr-1-abcdef0.web.app" } });
    return { status: r.status, body: r.body };
  };
}
const cibles = { id: "cibles", temoin: true };

describe("le contrôle des jours figés de l'image", () => {
  it("passe quand /info liste exactement les fichiers et que chaque jour est servi (le futur ne l'est pas)", async () => {
    const jours = [JOUR - 1, JOUR, JOUR + 1];
    const appel = await appelDe(jours, "recette");
    const r = await controlerJeu({ jeu: cibles, jours: jours.map(fichier), appel, environnement: "recette" });
    expect(r.ecarts).toEqual([]);
    expect(r.rapport).toMatch(/3 jour/);
  });
  it("signale un fichier du dépôt que l'image n'a pas, et un jour à venir servi", async () => {
    const appel = await appelDe([JOUR], "recette");
    const r = await controlerJeu({ jeu: cibles, jours: [JOUR, JOUR + 2].map(fichier), appel, environnement: "recette" });
    expect(r.ecarts.join("\n")).toMatch(/jours figés de \/info/);
  });
  it("un jeu témoin est absent d'un serveur de production (404) : c'est le résultat attendu, un 200 est un écart", async () => {
    const appel = await appelDe([JOUR], "production");
    expect((await controlerJeu({ jeu: cibles, jours: [fichier(JOUR)], appel, environnement: "production" })).ecarts).toEqual([]);
    const ouvert = await appelDe([JOUR], "recette");
    expect((await controlerJeu({ jeu: cibles, jours: [fichier(JOUR)], appel: ouvert, environnement: "production" })).ecarts.join()).toMatch(/témoin répond/);
  });
  it("lit les jeux et leurs dossiers dans les fiches (config/jeux/projections/ci.json), Cibles compris", () => {
    const ids = jeuxAControler().map((x: { jeu: { id: string } }) => x.jeu.id);
    expect(ids).toEqual(expect.arrayContaining(["jump", "tower", "cibles"]));
    expect(ids).not.toContain("track");
  });
});
