import { describe, expect, it } from "vitest";
import { NOM_DE_ZONE, ZONES_NOUVEAUTES, lirePourLesJoueurs, zoneDeNom } from "@cdj/core/nouveautes";
import { GAMES } from "../src/registry";

// Les nouveautés (changelog) ont une zone par jeu : un jeu ajouté au registre sans sa zone ferait refuser ses lignes « Pour les joueurs » (zone inconnue) et le panneau
// ne la proposerait pas. Ce test échoue le jour où l'on ajoute un jeu sans l'ajouter à `ZONES_NOUVEAUTES` (`packages/core/src/nouveautes.ts`).
describe("nouveautés : une zone par jeu du registre", () => {
  // La zone d'un jeu est lue dans son nom (`DailyTrack` → `track`, `DailyJump` → `jump`, `Tower` → `tower`, par `zoneDeNom`) ; Track a pour code `cdj`, d'où ce détour.
  const zonesDesJeux = GAMES.map((g) => ({ jeu: g.name, zone: zoneDeNom(g.name) }));

  it("chaque jeu du registre a sa zone", () => {
    for (const { jeu, zone } of zonesDesJeux) expect(zone, `le jeu « ${jeu} » n'a pas de zone dans ZONES_NOUVEAUTES (packages/core/src/nouveautes.ts)`).not.toBeNull();
    expect(new Set(zonesDesJeux.map((z) => z.zone)).size).toBe(GAMES.length);
  });

  it("hors les jeux, la seule zone est la plateforme (`dujour`)", () => {
    const prises = new Set(zonesDesJeux.map((z) => z.zone));
    expect(ZONES_NOUVEAUTES.filter((z) => !prises.has(z))).toEqual(["dujour"]);
  });

  it("le nom de chaque zone, avec ou sans « Daily », est reconnu dans une PR", () => {
    for (const z of ZONES_NOUVEAUTES) expect(zoneDeNom(NOM_DE_ZONE[z])).toBe(z);
    expect(zoneDeNom("DailyTower")).toBe("tower");
    expect(zoneDeNom("tower")).toBe("tower");
    expect(zoneDeNom("Autre")).toBeNull();
    const lues = lirePourLesJoueurs("## Pour les joueurs\n- [Tower] Les pièces s'emboîtent mieux. // The pieces fit together better.\n");
    expect(lues.lignes).toMatchObject([{ zone: "tower", malformee: false, en: "The pieces fit together better." }]);
  });
});
