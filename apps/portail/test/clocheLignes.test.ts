import { describe, expect, it } from "vitest";
import { lignesDeCloche, type TraducteurCloche } from "../src/clocheLignes";
import { NOUVEAUTES_LUES_KEY } from "../src/nouveautesDonnees";

// Lot U4 : la feuille de la cloche est la même sur l'accueil et sur les autres pages — ses lignes (la dernière nouveauté, les réponses non lues) viennent d'une seule fonction.
const t: TraducteurCloche = { t: (cle, p) => (p ? `${cle}:${Object.values(p).join(",")}` : cle) };
const stockage = (lue = 0) => ({ getItem: (k: string) => (k === NOUVEAUTES_LUES_KEY ? String(lue) : null), setItem: () => undefined });
const nouveaute = { id: 3, date: "2026-11-06", titre: { fr: "Un titre", en: "A title" }, lignes: [], publieLe: 1_000 };

describe("lot U4 : les lignes de la cloche", () => {
  it("rien de connu : pas de ligne, pas de point", () => {
    expect(lignesDeCloche(t, "fr", stockage(), null, "../")).toEqual({ lignes: [], point: false });
  });
  it("la dernière nouveauté, dans la langue du joueur, avec son point tant qu'elle n'est pas lue sur l'appareil", () => {
    const r = lignesDeCloche(t, "fr", stockage(0), { nouveaute, joueur: undefined }, "../");
    expect(r.point).toBe(true);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0]).toMatchObject({ texte: "Un titre", href: "../nouveautes/", nonLue: true });
    expect(lignesDeCloche(t, "en", stockage(0), { nouveaute, joueur: undefined }, "../").lignes[0]!.texte).toBe("A title");
    // Lue : plus de point, la ligne reste.
    const lue = lignesDeCloche(t, "fr", stockage(1_000), { nouveaute, joueur: undefined }, "../");
    expect(lue.point).toBe(false);
    expect(lue.lignes[0]!.nonLue).toBe(false);
  });
  it("un joueur connu a la ligne « Mes messages » : les réponses non lues allument le point, sans réponse la ligne le dit", () => {
    const joueur = (n: number) => ({ messagesNonLus: n }) as never;
    const avec = lignesDeCloche(t, "fr", stockage(1_000), { nouveaute, joueur: joueur(2) }, "");
    expect(avec.point).toBe(true);
    expect(avec.lignes[1]).toMatchObject({ href: "messages/", nonLue: true, texte: "portail.cloche.reponses:2" });
    const sans = lignesDeCloche(t, "fr", stockage(1_000), { nouveaute, joueur: joueur(0) }, "");
    expect(sans.point).toBe(false);
    expect(sans.lignes[1]).toMatchObject({ nonLue: false, texte: "portail.cloche.aucuneReponse" });
    // Un visiteur (sans `joueur`) n'a pas de ligne de messages.
    expect(lignesDeCloche(t, "fr", stockage(1_000), { nouveaute, joueur: undefined }, "").lignes).toHaveLength(1);
  });
  it("le chemin vers la racine suit la page (l'accueil : « », les autres pages : « ../ »)", () => {
    const j = { nouveaute, joueur: { messagesNonLus: 1 } as never };
    expect(lignesDeCloche(t, "fr", stockage(), j, "").lignes.map((l) => l.href)).toEqual(["nouveautes/", "messages/"]);
    expect(lignesDeCloche(t, "fr", stockage(), j, "../").lignes.map((l) => l.href)).toEqual(["../nouveautes/", "../messages/"]);
  });
});
